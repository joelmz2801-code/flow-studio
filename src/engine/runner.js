import { getBuiltinConfig, resolveModel, getKeyIndex, setKeyIndex, isQuotaError, DEFAULT_MODEL } from './builtin.js'
// ─────────────────────────────────────────────
// 工作流执行引擎：按连线拓扑递归求值，带缓存
// ─────────────────────────────────────────────

function joinUrl(base, path) {
  if (!path) return base
  if (/^https?:\/\//.test(path)) return path
  return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '')
}

// 从各种常见响应结构中提取图片
function extractImage(json) {
  const d = json?.data?.[0]
  if (d?.b64_json) return `data:image/png;base64,${d.b64_json}`
  if (d?.url) return d.url
  if (json?.url) return json.url
  if (json?.images?.[0]?.url) return json.images[0].url
  if (json?.images?.[0]?.b64_json) return `data:image/png;base64,${json.images[0].b64_json}`
  // chat.completions 风格：从 markdown 中提取
  const content = json?.choices?.[0]?.message?.content
  if (typeof content === 'string') {
    const m = content.match(/!\[[^\]]*\]\((https?:\/\/[^)]+|data:image[^)]+)\)/) || content.match(/(https?:\/\/\S+\.(?:png|jpe?g|webp)\S*)/i)
    if (m) return m[1]
  }
  const imgs = json?.choices?.[0]?.message?.images
  if (imgs?.[0]?.image_url?.url) return imgs[0].image_url.url
  return null
}

function extractVideo(json) {
  const d = json?.data?.[0]
  return (
    d?.url || d?.video_url || json?.video_url || json?.url ||
    json?.output?.video_url || json?.output?.[0] || null
  )
}

async function apiPost(url, apiKey, body, signal) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || text.slice(0, 300)
    throw new Error(`API ${res.status}: ${msg}`)
  }
  return json
}

async function apiGet(url, apiKey, signal) {
  const res = await fetch(url, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    signal,
  })
  return res.json()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ─────────────────────────────────────────────

export async function runGraph(targetIds, { nodes, edges, updateData }) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const cache = new Map()

  const incoming = (id) => edges.filter((e) => e.target === id)

  async function inputOf(id, handle) {
    const edge = incoming(id).find((e) => e.targetHandle === handle)
    if (!edge) return undefined
    return exec(edge.source)
  }

  async function exec(id) {
    if (cache.has(id)) return cache.get(id)
    const promise = execInner(id)
    cache.set(id, promise)
    return promise
  }

  async function execInner(id) {
    const node = nodeMap.get(id)
    if (!node) throw new Error('节点不存在')
    const d = node.data
    updateData(id, { status: 'running', error: null })
    try {
      let output
      switch (node.type) {
        case 'apiConfig': {
          if (!d.baseUrl) throw new Error('请填写 Base URL')
          output = { ...d }
          break
        }
        case 'refImage': {
          if (!d.image) throw new Error('请先上传参考图')
          output = d.image
          break
        }
        case 'refAggregate': {
          const imgs = []
          for (const h of ['img1', 'img2', 'img3', 'img4']) {
            const v = await inputOf(id, h)
            if (v) imgs.push(v)
          }
          if (imgs.length === 0) throw new Error('未接入任何参考图')
          output = imgs
          updateData(id, { count: imgs.length })
          break
        }
        case 'imageGen': {
          // 未连接 API 配置时，自动使用内置通道
          const config = (await inputOf(id, 'config')) || getBuiltinConfig()
          let refs = await inputOf(id, 'refs')
          if (typeof refs === 'string') refs = [refs]
          if (!d.prompt) throw new Error('请填写提示词')
          const body = {
            model: config.imageModel,
            prompt: d.prompt,
            n: 1,
            size: d.size || '1024x1024',
          }
          if (refs?.length) body.image = refs // 参考图（多数兼容网关接受 base64/url 数组）
          const json = await apiPost(joinUrl(config.baseUrl, config.imagePath), config.apiKey, body)
          const img = extractImage(json)
          if (!img) throw new Error('响应中未找到图片: ' + JSON.stringify(json).slice(0, 200))
          output = img
          updateData(id, { result: img })
          break
        }
        case 'videoGen': {
          // 未连接 API 配置时，自动使用内置通道
          const config = (await inputOf(id, 'config')) || getBuiltinConfig()
          const refImage = await inputOf(id, 'image')
          if (!d.prompt) throw new Error('请填写提示词')
          const body = { model: config.videoModel, prompt: d.prompt }
          if (refImage) body.image = refImage // 图生视频
          if (d.duration) body.duration = Number(d.duration)
          const url = joinUrl(config.baseUrl, config.videoPath)
          let json = await apiPost(url, config.apiKey, body)
          let video = extractVideo(json)
          // 异步任务：轮询直到完成
          const taskId = json?.id || json?.task_id
          let tries = 0
          while (!video && taskId && tries < 60) {
            await sleep(5000)
            json = await apiGet(`${url}/${taskId}`, config.apiKey)
            const status = (json?.status || '').toLowerCase()
            if (['failed', 'error', 'cancelled'].includes(status)) {
              throw new Error('视频任务失败: ' + JSON.stringify(json).slice(0, 200))
            }
            video = extractVideo(json)
            tries++
            updateData(id, { progressText: `生成中… 第 ${tries} 次查询` })
          }
          if (!video) throw new Error('未获取到视频结果: ' + JSON.stringify(json).slice(0, 200))
          output = video
          updateData(id, { result: video, progressText: null })
          break
        }
        case 'preview': {
          // 预览节点：仅查看，绝不保存
          const media = await inputOf(id, 'media')
          if (!media) throw new Error('没有可预览的内容')
          updateData(id, { media })
          output = media
          break
        }
        case 'saveFile': {
          const media = await inputOf(id, 'media')
          if (!media) throw new Error('没有可保存的内容')
          await downloadMedia(media, d.filename || 'flow-studio-output')
          updateData(id, { savedAt: new Date().toLocaleTimeString() })
          output = media
          break
        }
        default:
          throw new Error(`未知节点类型 ${node.type}`)
      }
      updateData(id, { status: 'done' })
      return output
    } catch (err) {
      updateData(id, { status: 'error', error: err.message })
      throw err
    }
  }

  const results = await Promise.allSettled(targetIds.map((id) => exec(id)))
  return results
}

export async function downloadMedia(media, filename) {
  let blob
  if (media.startsWith('data:')) {
    const res = await fetch(media)
    blob = await res.blob()
  } else {
    try {
      const res = await fetch(media)
      blob = await res.blob()
    } catch {
      // 跨域下载失败时直接打开链接
      window.open(media, '_blank')
      return
    }
  }
  const ext = blob.type.includes('video') ? 'mp4' : blob.type.split('/')[1] || 'png'
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${filename}.${ext}`
  a.click()
  URL.revokeObjectURL(a.href)
}

// ─────────────────────────────────────────────
// 对话式生图：供聊天页面调用（内置多通道，额度不足自动切换 Key）
// ─────────────────────────────────────────────
export async function generateImage({ prompt, size, refs = [], model }, signal) {
  const ch = resolveModel(model || DEFAULT_MODEL)
  const body = { model: ch.apiModel, prompt, n: 1 }
  if (size) body.size = size
  if (refs?.length) body.image = refs

  const total = ch.keys.length
  const start = getKeyIndex(ch.providerId, total)
  let lastErr
  for (let i = 0; i < total; i++) {
    const idx = (start + i) % total
    try {
      const json = await apiPost(joinUrl(ch.baseUrl, ch.imagePath), ch.keys[idx], body, signal)
      const img = extractImage(json)
      if (!img) throw new Error('响应中未找到图片: ' + JSON.stringify(json).slice(0, 200))
      if (idx !== start) setKeyIndex(ch.providerId, idx) // 记住可用通道
      return img
    } catch (err) {
      if (err?.name === 'AbortError') throw err
      lastErr = err
      // 额度类错误 → 静默切换下一个 Key；其他错误直接抛出
      if (isQuotaError(err) && i < total - 1) continue
      if (!isQuotaError(err)) throw err
    }
  }
  throw lastErr
}

// 拉取可用模型列表（xy 通道，用于自定义模型搜索）
export async function listModels() {
  const ch = resolveModel(DEFAULT_MODEL)
  const idx = getKeyIndex(ch.providerId, ch.keys.length)
  const res = await fetch(joinUrl(ch.baseUrl, '/v1/models'), {
    headers: { Authorization: `Bearer ${ch.keys[idx]}` },
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const json = await res.json()
  const ids = (json.data || json.models || [])
    .map((m) => (typeof m === 'string' ? m : m.id))
    .filter(Boolean)
  return [...new Set(ids)].sort()
}
