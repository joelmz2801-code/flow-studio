import { getBuiltinConfig, resolveModel, randomKeyIndex, isQuotaError, DEFAULT_MODEL } from './builtin.js'
import { buildPromptVariables, renderPromptTemplate } from './promptVariables.js'
import { useStore } from '../store.js'

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
    d?.url || d?.video_url || d?.remixed_from_video_id ||
    json?.video_url || json?.url || json?.remixed_from_video_id ||
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

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(new Error('aborted'))
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort)
    resolve()
  }, ms)
  const onAbort = () => {
    clearTimeout(timer)
    reject(new Error('aborted'))
  }
  signal?.addEventListener('abort', onAbort, { once: true })
})

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
          // 对齐 ComfyUI：Agnes 模型走 extra_body，GPT 模型走顶层
          if (refs?.length) {
            const isGpt = /^gpt-image/i.test(config.imageModel)
            const imageData = refs.length === 1 ? refs[0] : refs
            if (isGpt) {
              body.image = imageData
              body.response_format = 'url'
            } else {
              body.extra_body = { response_format: 'url', image: imageData }
            }
          }
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
          const videoId = json?.video_id
          const taskId = json?.id || json?.task_id
          let tries = 0
          while (!video && (videoId || taskId) && tries < 60) {
            await sleep(5000)
            if (videoId) {
              json = await apiGet(`${joinUrl(config.baseUrl, '/agnesapi')}?video_id=${videoId}`, config.apiKey)
            } else {
              json = await apiGet(`${url}/${taskId}`, config.apiKey)
            }
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

async function fetchBlob(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.blob()
  } catch { return null }
}

export async function downloadMedia(media, filename) {
  let blob
  if (media.startsWith('data:')) {
    const res = await fetch(media)
    blob = await res.blob()
  } else {
    blob = await fetchBlob(media)
    if (!blob) {
      // 兜底：通过图片代理转一遍拿到可下载的字节
      blob = await fetchBlob('https://images.weserv.nl/?url=' + encodeURIComponent(media.replace(/^https?:\/\//, '')))
    }
    if (!blob) {
      // 实在拿不到字节时才打开新窗口
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
// gpt-image 系列只接受固定尺寸，按方向吸附到最接近的合法值
function snapSizeForModel(apiModel, size) {
  if (!size || !/^gpt-image/i.test(apiModel)) return size
  const [w, h] = size.split('x').map(Number)
  if (!w || !h) return 'auto'
  if (w > h) return '1536x1024'
  if (h > w) return '1024x1536'
  return '1024x1024'
}

export function resolveModelWithPresets(modelId, presets) {
  if (presets && Array.isArray(presets)) {
    for (const p of presets) {
      if (p.models && Array.isArray(p.models)) {
        const found = p.models.find((m) => m.id === modelId)
        if (found) {
          return {
            providerId: 'custom',
            baseUrl: p.baseUrl,
            keys: p.apiKey ? p.apiKey.split(',').map(k => k.trim()).filter(Boolean) : [],
            apiModel: found.id,
            chatPath: p.chatPath || '/v1/chat/completions',
            imagePath: p.imagePath || '/v1/images/generations',
            videoPath: p.videoPath || '/v1/videos',
            type: found.type || 'image',
            supportsTools: !!found.supportsTools
          }
        }
      }
    }
  }
  const builtin = resolveModel(modelId)
  return { ...builtin }
}

async function urlToDataUri(url, signal) {
  if (!url || url.startsWith('data:')) return url
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return url
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return url
  }
}

// 检测字符串是否包含中文字符
// 保留以备后续使用，但生图/视频不再自动翻译，由 API 自行处理
function hasChinese(text) {
  if (!text) return false
  return /[\u4e00-\u9fa5]/.test(text)
}

export async function generateImage({ prompt, size, refs = [], model }, signal) {
  const presets = useStore.getState().presets
  const ch = resolveModelWithPresets(model || DEFAULT_MODEL, presets)
  const hasRefs = refs && refs.length > 0
  // 不再做中文→英文翻译，直接把原始 prompt 交给生图 API
  const finalPrompt = prompt
  const body = { model: ch.apiModel, prompt: finalPrompt, n: 1 }
  const snapped = snapSizeForModel(ch.apiModel, size)
  if (snapped) body.size = snapped

  const isGptModel = /^gpt-image/i.test(ch.apiModel)
  if (hasRefs) {
    // refs 是 string[]，元素为 Data URI (data:image/png;base64,...) 或 URL
    // 自动把 URL refs 转 base64（部分中转代理不直接接受 URL）
    const normalized = await Promise.all(refs.map((r) => urlToDataUri(r, signal)))
    // ComfyUI 经验：单张图传字符串，多张图传数组（部分 API 仅接受数组）
    const imageData = normalized.length === 1 ? normalized[0] : normalized
    if (isGptModel) {
      body.image = imageData
      body.response_format = 'url'
    } else {
      body.extra_body = {
        response_format: 'url',
        image: imageData,
      }
    }
  }

  const total = ch.keys.length
  if (total === 0) {
    throw new Error('API Key 不能为空，请在设置中配置。')
  }
  const start = randomKeyIndex(total)
  let lastErr
  for (let i = 0; i < total; i++) {
    const idx = (start + i) % total
    try {
      const json = await apiPost(joinUrl(ch.baseUrl, ch.imagePath), ch.keys[idx], body, signal)
      const img = extractImage(json)
      if (!img) throw new Error('响应中未找到图片: ' + JSON.stringify(json).slice(0, 200))
      return img
    } catch (err) {
      if (err?.name === 'AbortError') throw err
      lastErr = err
      if (isQuotaError(err) && i < total - 1) continue
      if (!isQuotaError(err)) throw err
    }
  }
  throw lastErr
}

export async function generateVideo({ prompt, model, refImage }, signal) {
  const presets = useStore.getState().presets
  const ch = resolveModelWithPresets(model, presets)
  // 不再做中文→英文翻译，直接把原始 prompt 交给生视频 API
  const body = { model: ch.apiModel, prompt }
  if (refImage) body.image = refImage

  const total = ch.keys.length
  if (total === 0) {
    throw new Error('API Key 不能为空，请在设置中配置。')
  }

  const url = joinUrl(ch.baseUrl, ch.videoPath || '/v1/videos')
  const start = randomKeyIndex(total)
  let lastErr
  for (let i = 0; i < total; i++) {
    const idx = (start + i) % total
    if (signal?.aborted) throw new Error('aborted')
    try {
      const apiKey = ch.keys[idx]
      let json = await apiPost(url, apiKey, body, signal)
      if (signal?.aborted) throw new Error('aborted')
      let video = extractVideo(json)
      const videoId = json?.video_id
      const taskId = json?.id || json?.task_id
      let tries = 0
      while (!video && (videoId || taskId) && tries < 60) {
        if (signal?.aborted) throw new Error('aborted')
        await sleep(5000, signal)
        if (signal?.aborted) throw new Error('aborted')
        // 推荐方式：用 video_id 查询 /agnesapi?video_id=
        if (videoId) {
          json = await apiGet(`${joinUrl(ch.baseUrl, '/agnesapi')}?video_id=${videoId}`, apiKey, signal)
        } else {
          // 兼容旧版：用 task_id 查询 /v1/videos/<task_id>
          json = await apiGet(`${url}/${taskId}`, apiKey, signal)
        }
        if (signal?.aborted) throw new Error('aborted')
        const status = (json?.status || '').toLowerCase()
        if (['failed', 'error', 'cancelled'].includes(status)) {
          throw new Error('视频任务失败: ' + JSON.stringify(json).slice(0, 200))
        }
        video = extractVideo(json)
        tries++
      }
      if (!video) throw new Error('未获取到视频结果')
      return video
    } catch (err) {
      if (err?.name === 'AbortError' || /aborted/i.test(err?.message || '')) throw err
      lastErr = err
      if (isQuotaError(err) && i < total - 1) continue
      throw err
    }
  }
  throw lastErr
}

// ── 工具定义：供文本模型通过 function calling 调用 ──────────────
// 当前仅暴露 generate_image 工具，未来可加 generate_video 等
export const CHAT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: '根据用户描述生成一张图片。仅在用户明确希望生成图片时调用；如果只是想聊天、问答、解释概念，不要调用此工具。',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: '图片的英文或中文描述，越具体越好。',
          },
          size: {
            type: 'string',
            enum: ['1024x1024', '1536x1024', '1024x1536', 'auto'],
            description: '图片尺寸，默认 1024x1024。',
          },
        },
        required: ['prompt'],
      },
    },
  },
]

export async function generateChat({ messages, model, tools, tool_choice }, signal) {
  const presets = useStore.getState().presets
  const ch = resolveModelWithPresets(model, presets)
  // 注入用户自定义提示词（按顺序拼接为 system message）
  // 不再硬编码任何系统提示词，完全由用户在设置 → 提示词 tab 自行配置
  // 支持 {{date}} / {{time}} / {{username}} 等变量占位符（类似 Cherry Studio「可变量」）
  const hasSystem = messages?.some((m) => m.role === 'system')
  const variables = buildPromptVariables({
    model: ch.apiModel,
    username: useStore.getState().user?.email?.split('@')[0] || useStore.getState().user?.user_metadata?.name || 'User',
  })
  const customParts = (useStore.getState().customPrompts || [])
    .filter((p) => p && p.enabled && (p.text || '').trim())
    .map((p) => {
      const rendered = renderPromptTemplate(p.text, variables)
      return p.name ? `[${p.name}]\n${rendered}` : rendered
    })
  const sysContent = customParts.join('\n\n')
  const finalMessages = (hasSystem || !sysContent)
    ? messages
    : [{ role: 'system', content: sysContent }, ...messages]
  const body = {
    model: ch.apiModel,
    messages: finalMessages,
  }
  // 注入 tools（OpenAI 兼容格式）
  if (tools && Array.isArray(tools) && tools.length > 0) {
    body.tools = tools
    if (tool_choice) body.tool_choice = tool_choice
  }
  const url = joinUrl(ch.baseUrl, ch.chatPath || '/v1/chat/completions')
  const total = ch.keys.length
  if (total === 0) {
    throw new Error('API Key 不能为空，请在设置中配置。')
  }

  let lastErr
  const start = randomKeyIndex(total)
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) throw new Error('aborted')
    const idx = (start + i) % total
    try {
      const apiKey = ch.keys[idx]
      const json = await apiPost(url, apiKey, body, signal)
      if (signal?.aborted) throw new Error('aborted')
      const message = json?.choices?.[0]?.message || {}
      // 工具调用：返回原始 message 对象（包含 tool_calls）
      if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
        return { type: 'tool_calls', message, content: message.content || '' }
      }
      const content = message.content
      if (typeof content !== 'string') {
        throw new Error('响应中未找到文本内容')
      }
      return { type: 'text', content }
    } catch (err) {
      if (err?.name === 'AbortError' || /aborted/i.test(err?.message || '')) throw err
      lastErr = err
      if (isQuotaError(err) && i < total - 1) continue
      throw err
    }
  }
  throw lastErr
}


export async function fetchModelsList(baseUrl, apiKey) {
  const endpoints = ['/v1/models', '/api/v1/models', '/models']
  const keys = apiKey ? apiKey.split(',').map(k => k.trim()).filter(Boolean) : []
  const keyToUse = keys[0] || ''
  
  let lastErr
  for (const ep of endpoints) {
    try {
      const url = joinUrl(baseUrl, ep)
      const res = await fetch(url, {
        headers: keyToUse ? { Authorization: `Bearer ${keyToUse}` } : {},
        signal: AbortSignal.timeout(6000)
      })
      if (res.ok) {
        const json = await res.json()
        const ids = (json.data || json.models || [])
          .map((m) => (typeof m === 'string' ? m : m.id))
          .filter(Boolean)
        if (ids.length > 0) {
          return [...new Set(ids)].sort()
        }
      } else {
        const text = await res.text()
        lastErr = new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`)
      }
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr || new Error('无法连接到 API 地址获取模型列表，请检查网络或配置。')
}

export async function testApiConnection(baseUrl, apiKey) {
  try {
    const list = await fetchModelsList(baseUrl, apiKey)
    return { success: true, count: list.length }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// 拉取可用模型列表（xy 通道，用于自定义模型搜索）
export async function listModels() {
  const ch = resolveModel('image-2')
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

