import React, { useEffect, useRef, useState } from 'react'
import { useStore } from './store.js'
import { generateImage, generateVideo, generateChat, downloadMedia, listModels, CHAT_TOOLS } from './engine/runner.js'
import { Logo } from './components/Logo.jsx'

import { BUILTIN_MODELS, DEFAULT_MODEL } from './engine/builtin.js'


// ── 画幅比例（附使用场景说明）──────────────────
const RATIOS = [
  { id: 'auto', w: 1, h: 1, name: 'Auto', label: '自动', desc: '由模型智能决定画幅' },
  { id: '1:1', w: 1, h: 1, name: '1:1', label: '方形', desc: '头像 · 社交贴图' },
  { id: '16:9', w: 16, h: 9, name: '16:9', label: '宽屏', desc: '电脑壁纸 · 视频封面' },
  { id: '9:16', w: 9, h: 16, name: '9:16', label: '竖屏', desc: '手机壁纸 · 短视频' },
  { id: '3:4', w: 3, h: 4, name: '3:4', label: '竖幅', desc: '人像拍照 · 种草配图' },
  { id: '4:3', w: 4, h: 3, name: '4:3', label: '横幅', desc: '风景 · PPT 配图' },
  { id: '2:3', w: 2, h: 3, name: '2:3', label: '海报', desc: '电影海报 · 印刷物料' },
]

// ── 风格预设 ──────────────────────────────────
const STYLES = [
  { id: 'none', name: '自由发挥', icon: '✨', desc: '不限定风格', prompt: '' },
  { id: 'photo', name: '写实摄影', icon: '📷', desc: '真实光影质感', prompt: '写实摄影风格，真实细节，专业布光，浅景深，高清质感' },
  { id: 'anime', name: '动漫插画', icon: '🎏', desc: '日系二次元', prompt: '日系动漫插画风格，精致线条，鲜明色彩，细腻上色' },
  { id: 'watercolor', name: '水彩手绘', icon: '🖌️', desc: '柔和晕染笔触', prompt: '水彩画风格，柔和晕染，纸张纹理，清透色彩' },
  { id: 'oil', name: '古典油画', icon: '🖼️', desc: '厚涂经典质感', prompt: '古典油画风格，厚涂笔触，丰富层次，典雅色调' },
  { id: 'cyber', name: '赛博朋克', icon: '🌃', desc: '霓虹未来都市', prompt: '赛博朋克风格，霓虹灯光，未来都市，电影感氛围' },
  { id: 'guofeng', name: '国风水墨', icon: '🏮', desc: '工笔意境留白', prompt: '中国风工笔画，水墨意境，留白构图，东方美学' },
  { id: 'c4d', name: '3D 渲染', icon: '🧊', desc: 'C4D 立体质感', prompt: '3D 渲染，C4D 风格，柔和光影，细腻材质，产品级质感' },
  { id: 'flat', name: '极简扁平', icon: '🔷', desc: '干净几何插画', prompt: '极简扁平插画风格，几何图形，大面积留白，克制配色' },
  { id: 'pixel', name: '像素艺术', icon: '👾', desc: '复古游戏像素', prompt: '像素艺术风格，复古游戏画面，8-bit 质感' },
]

const SUGGESTIONS = [
  { icon: '🚀', text: '一只戴着宇航员头盔的柴犬，赛博朋克城市夜景，电影感光效' },
  { icon: '🌫️', text: '水彩风格的江南水乡，清晨薄雾，白墙黛瓦' },
  { icon: '🧊', text: '未来感极简产品海报，悬浮的透明玻璃立方体，柔和渐变背景' },
  { icon: '🕊️', text: '国风插画：山间仙鹤，云雾缭绕，工笔画质感' },
]

// 按目标比例换算像素尺寸（约 100 万像素，对齐 64 的倍数）
function sizeForRatio(w, h) {
  const area = 1024 * 1024
  const W = Math.max(256, Math.round(Math.sqrt((area * w) / h) / 64) * 64)
  const H = Math.max(256, Math.round(Math.sqrt((area * h) / w) / 64) * 64)
  return `${W}x${H}`
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.readAsDataURL(file)
  })
}

// 通用弹出层：点击外部自动关闭
function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return { open, setOpen, ref }
}

export default function ChatPage({ chatId }) {
  const chats = useStore((s) => s.chats)
  const { createChat, appendMessage, updateMessage, renameChat, setPromptLibOpen, consumePendingPrompt, removeChat, clearChatMedia, deleteMessage } = useStore()
  const pendingPrompt = useStore((st) => st.pendingPrompt)
  const chat = chats.find((c) => c.id === chatId) || null

  const [input, setInput] = useState('')
  useEffect(() => {
    if (pendingPrompt) {
      setInput(pendingPrompt)
      consumePendingPrompt()
      setTimeout(() => taRef.current?.focus(), 60)
    }
  }, [pendingPrompt])
  const [ratio, setRatio] = useState(RATIOS[0])
  const [style, setStyle] = useState(STYLES[0])
  const [refs, setRefs] = useState([])
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const dragCounter = useRef(0)
  const abortRef = useRef(null)
  const fileRef = useRef()
  const scrollRef = useRef()
  const taRef = useRef()
  const ratioPop = usePopover()
  const stylePop = usePopover()
  const modelPop = usePopover()
  // 默认模型策略：新对话默认使用文本对话模型（Command AI）；不恢复生图/视频模型作为默认
  const [model, setModel] = useState(() => {
    const saved = localStorage.getItem('jfs-model')
    // 仅恢复文本对话模型，生图/视频模型不作为初始默认
    if (saved) {
      const m = BUILTIN_MODELS.find((b) => b.id === saved)
      if (m?.type === 'chat') return saved
    }
    return DEFAULT_MODEL
  })
  const [modelQuery, setModelQuery] = useState('')

  const presets = useStore((s) => s.presets)

  // 先收集自定义预设中可见模型的 ID，自定义模型优先（覆盖同 ID 的内置模型）
  const _customIds = new Set()
  presets.forEach((p) => {
    if (p.models && Array.isArray(p.models)) {
      p.models.forEach((m) => { if (m.visible) _customIds.add(m.id) })
    }
  })

  const allVisibleModels = []
  BUILTIN_MODELS.forEach((b) => {
    if (_customIds.has(b.id)) return  // 自定义预设中有同 ID → 跳过内置
    allVisibleModels.push({
      id: b.id,
      label: b.label,
      desc: b.desc,
      type: b.type || 'image',
      isBuiltin: true,
      supportsTools: !!b.supportsTools
    })
  })
  presets.forEach((p) => {
    if (p.models && Array.isArray(p.models)) {
      p.models.forEach((m) => {
        if (m.visible) {
          allVisibleModels.push({
            id: m.id,
            label: m.id,
            desc: `${m.type === 'video' ? '视频模型' : m.type === 'chat' ? '文本模型' : m.type === 'image' ? '图片模型' : '未设置类型'} | ${p.name || '自定义'}`,
            type: m.type || null,
            isBuiltin: false,
            supportsTools: !!m.supportsTools
          })
        }
      })
    }
  })

  useEffect(() => {
    if (allVisibleModels.length > 0 && !allVisibleModels.some(m => m.id === model)) {
      // 当前模型不可用 → 回退到默认文本模型，而非任意生图模型
      setModel(DEFAULT_MODEL)
    }
  }, [allVisibleModels, model])

  const pickModel = (m) => {
    setModel(m)
    localStorage.setItem('jfs-model', m)
    modelPop.setOpen(false)
    setModelQuery('')
  }


  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [chat?.messages?.length, busy])

  // textarea 自适应高度：随内容增长，限制 24-160px，平滑过渡
  const autoGrow = () => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const next = Math.min(160, Math.max(24, ta.scrollHeight))
    ta.style.height = next + 'px'
  }
  useEffect(() => { autoGrow() }, [input])

  // 删除当前对话（带选项）
  const handleDeleteChat = () => {
    if (!chat) return
    const choice = window.confirm(
      `删除当前对话「${chat.title || '新对话'}」？\n\n` +
      `· 点击「确定」→ 删除整个对话（含所有消息）\n` +
      `· 点击「取消」后再次操作 → 仅清除对话中的图片/视频，保留文字记录\n\n` +
      `如需「仅清除图片」，请取消此对话框后将再次询问。`
    )
    if (choice) {
      removeChat(chat.id)
    } else {
      const sub = window.confirm('改为「仅清除图片/视频」？文字记录将保留。')
      if (sub) clearChatMedia(chat.id)
    }
  }

  // 删除单条消息
  const handleDeleteMessage = (msgId) => {
    if (!chat) return
    if (window.confirm('删除这条消息？')) deleteMessage(chat.id, msgId)
  }

  // 复制消息内容（文本/图片 URL/视频 URL）
  const handleCopyMessage = async (m) => {
    let payload = ''
    if (m.images?.filter(Boolean).length > 0) {
      payload = m.images.find(Boolean) || ''
    } else if (m.videos?.filter(Boolean).length > 0) {
      payload = m.videos.find(Boolean) || ''
    } else {
      payload = m.text || ''
    }
    if (!payload) return
    try {
      await navigator.clipboard.writeText(payload)
    } catch {
      try { await navigator.clipboard.writeText(m.text || '') } catch {}
    }
    setToast('已复制')
  }

  // 重新生成：使用原消息的 text + refs 重新发送
  const handleRegenerate = (m) => {
    if (!chat || busy) return
    send(m.text, m.refs || [])
  }

  // 轻量 toast（复制成功提示，2 秒自动消失）
  const [toast, setToast] = useState(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1600)
    return () => clearTimeout(t)
  }, [toast])

  // 将 AI 生成的图片添加到输入框作为参考图（上限 4 张）
  const addAsReference = (images) => {
    const valid = (images || []).filter(Boolean)
    if (valid.length === 0) return
    setRefs((r) => [...r, ...valid].slice(0, 4))
    setTimeout(() => taRef.current?.focus(), 0)
  }

  const attach = async (files) => {
    const list = Array.from(files || []).slice(0, 4 - refs.length)
    const urls = await Promise.all(list.map(fileToDataUrl))
    setRefs((r) => [...r, ...urls].slice(0, 4))
  }

  // 粘贴图片
  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    const imageFiles = []
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) imageFiles.push(file)
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault()
      attach(imageFiles)
    }
  }

  // 拖拽图片 — 用计数器 + window 级兜底，防止"松开以添加参考图"卡在屏幕中间
  const handleDrop = (e) => {
    e.preventDefault()
    dragCounter.current = 0
    setDragOver(false)
    const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'))
    if (files.length > 0) attach(files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    dragCounter.current++
    if (dragCounter.current === 1) setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    dragCounter.current = Math.max(0, dragCounter.current - 1)
    if (dragCounter.current === 0) setDragOver(false)
  }

  // 兜底：拖出窗口、ESC 取消、未拖入就释放等情况，强制关闭 overlay
  useEffect(() => {
    const reset = () => {
      dragCounter.current = 0
      setDragOver(false)
    }
    const onWindowDragEnd = () => reset()
    const onWindowDrop = () => reset()
    const onKeyDown = (e) => { if (e.key === 'Escape') reset() }
    window.addEventListener('dragend', onWindowDragEnd)
    window.addEventListener('drop', onWindowDrop)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('dragend', onWindowDragEnd)
      window.removeEventListener('drop', onWindowDrop)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const activeModelObj = allVisibleModels.find(m => m.id === model)
  const isVideo = activeModelObj?.type === 'video'
  const isChat = activeModelObj?.type === 'chat'
  const isImage = activeModelObj?.type === 'image'
  const isUnsetType = !activeModelObj?.type

  // 生图意图检测已废弃：文本模型不再自动转接生图，避免"画""draw"等普通用词误触
  // 用户需要生图时：
  //   1) 上传参考图 → 自动走图生图
  //   2) 主动从模型下拉框切换到图片模型
  //   3) 由文本模型通过 tool_calls 主动调用 generate_image 工具

  // Auto 模式智能画幅：按 prompt 关键词决定比例
  // 默认 1:1，匹配到人像/竖屏关键词 → 9:16，匹配到风景/横幅关键词 → 16:9，匹配到竖幅 → 3:4
  const detectAutoRatio = (text) => {
    const t = (text || '').toLowerCase()
    // 竖屏/竖幅/人像/手机壁纸/海报/全身像
    const portraitRe = /(竖|竖屏|竖幅|海报|人像|全身|半身|头像|手机壁纸|故事|stories?|story|reel|reels|portrait|poster|vertical|standing|tall|人物|人物像|特写|人脸|脸|fashion|服装|时装|模特|model)/i
    // 横幅/宽屏/风景/电脑壁纸/电影/视频封面
    const landscapeRe = /(横|横幅|宽屏|风景|山川|山河|草原|大海|湖|天空|电脑壁纸|壁纸|全景|wide|landscape|banner|panorama|panoramic|电影|影|视频封面|封面|天空|建筑|城市|街景|cinematic|movie)/i
    // 4:3 横幅
    const fourThreeRe = /(4:3|四三|横幅|landscape photo|传统|风景照|风光)/i
    // 3:4 竖幅
    const threeFourRe = /(3:4|三四|竖幅|portrait photo|人像照|证件|全身照|全身像)/i
    if (threeFourRe.test(t)) return RATIOS.find((r) => r.id === '3:4')
    if (fourThreeRe.test(t)) return RATIOS.find((r) => r.id === '4:3')
    if (portraitRe.test(t)) return RATIOS.find((r) => r.id === '9:16')
    if (landscapeRe.test(t)) return RATIOS.find((r) => r.id === '16:9')
    // 没匹配到任何关键词 → 1:1 方形
    return RATIOS.find((r) => r.id === '1:1')
  }

  const send = async (textOverride, refsOverride) => {
    const text = (textOverride ?? input).trim()
    if (!text || busy) return

    // 模型类型未设置时拦截
    if (isUnsetType && !refsOverride && refs.length === 0) {
      setToast('请先在设置中为该模型选择类型（image / text / video）')
      return
    }

    let id = chatId
    if (!chat) id = createChat()

    // 重新生成时使用原消息的 refs；否则用当前 state
    const activeRefs = refsOverride || refs

    // 自动转接逻辑：
    // 1. 上传了参考图 → 一律走图生图（agnes-image-2.1-flash）
    // 2. 文本模型不再基于关键词自动转生图（避免误触）
    // 3. 文本模型可通过 tool_calls 调用 generate_image 工具主动生图
    let activeModel = model
    let activeIsVideo = isVideo
    let activeIsChat = isChat
    if (activeRefs.length > 0) {
      // 有参考图 → 图生图模式
      activeModel = 'agnes-image-2.1-flash'
      activeIsVideo = false
      activeIsChat = false
    }

    const userMsg = {
      id: `m${Date.now()}u`, role: 'user', text, refs: activeRefs, time: Date.now(),
      meta: [
        activeRefs.length > 0 ? `图生图 ×${activeRefs.length}` : '',
        ratio.id !== 'auto' && ratio.name !== '1:1' ? `画幅 ${ratio.name}` : '',
        style.id !== 'none' ? style.name : '',
        activeModel
      ].filter(Boolean),
    }
    appendMessage(id, userMsg)

    const current = useStore.getState().chats.find((c) => c.id === id)
    if (current && current.messages.length <= 1) {
      renameChat(id, text.slice(0, 24))
    }

    // Auto 模式：根据 prompt 关键词智能选择画幅
    const effectiveRatio = ratio.id === 'auto' ? detectAutoRatio(text) : ratio
    // 把识别出的画幅附加到 userMsg 的 meta 上（覆盖上面占位）
    if (ratio.id === 'auto' && effectiveRatio.id !== '1:1') {
      const updated = useStore.getState().chats.find((c) => c.id === id)
      const u = updated?.messages.find((m) => m.id === userMsg.id)
      if (u && !u.meta.find((t) => t.startsWith('画幅'))) {
        updateMessage(id, userMsg.id, { meta: [...u.meta, `画幅 ${effectiveRatio.name} · 自动`] })
      }
    }

    const aiId = `m${Date.now()}a`
    appendMessage(id, {
      id: aiId, role: 'assistant', status: 'loading', text: '', images: [], videos: [],
      mediaType: activeIsVideo ? 'video' : (activeIsChat ? 'chat' : 'image'),
      ratio: ratio.id === 'auto' ? null : { w: ratio.w, h: ratio.h }, time: Date.now(),
    })

    // 重新生成时不清空当前输入框和 ref chips（保留用户当前输入上下文）
    if (!refsOverride) {
      setInput('')
      setRefs([])
    }
    setBusy(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const prompt = style.prompt ? `${text}\n\n画面风格：${style.prompt}` : text
      if (activeIsVideo) {
        const video = await generateVideo({ prompt, model: activeModel, refImage: activeRefs[0] }, controller.signal)
        updateMessage(id, aiId, { status: 'done', videos: [video], text: '' })
      } else if (activeIsChat) {
        // 多轮上下文：从当前对话累积所有 user/assistant 消息
        // 排除 status='loading' 或 'error' 的占位消息
        const current = useStore.getState().chats.find((c) => c.id === id)
        const history = (current?.messages || [])
          .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.text && m.status !== 'loading')
          .map((m) => ({ role: m.role, content: m.text }))
        const chatContext = history.length > 0 ? history : [{ role: 'user', content: prompt }]
        // 只对支持 tool use 的模型注入工具列表（Cohere Command、OpenRouter hy3 等不支持，强行传会 400）
        const chatSupportsTools = !!activeModelObj?.supportsTools
        const result = await generateChat({
          messages: chatContext,
          model: activeModel,
          ...(chatSupportsTools ? { tools: CHAT_TOOLS, tool_choice: 'auto' } : {}),
        }, controller.signal)

        // 工具调用分支：执行 generate_image
        if (result?.type === 'tool_calls' && Array.isArray(result.message?.tool_calls)) {
          const toolCall = result.message.tool_calls.find(
            (tc) => tc?.function?.name === 'generate_image'
          )
          if (toolCall) {
            let args = {}
            try { args = JSON.parse(toolCall.function.arguments || '{}') } catch { args = {} }
            const imagePrompt = (args.prompt || text).trim()
            const imageSize = args.size || '1024x1024'
            // 把工具调用意图写入消息气泡
            updateMessage(id, aiId, {
              status: 'loading',
              text: result.content || `正在生成图片：${imagePrompt.slice(0, 80)}…`,
              mediaType: 'chat',
            })
            try {
              const img = await generateImage({
                prompt: imagePrompt,
                size: imageSize,
                refs: [],
                model: 'agnes-image-2.1-flash',
              }, controller.signal)
              // 合并为新消息：保留文字说明 + 附加图片
              updateMessage(id, aiId, {
                status: 'done',
                text: result.content || `已生成图片：${imagePrompt}`,
                images: [img],
                mediaType: 'chat',
              })
            } catch (imgErr) {
              updateMessage(id, aiId, {
                status: 'error',
                text: `${result.content || ''}\n\n[生图失败] ${imgErr.message}`.trim(),
              })
            }
            return
          }
        }

        // 普通文本回复
        const responseText = result?.content ?? (typeof result === 'string' ? result : '')
        updateMessage(id, aiId, { status: 'done', text: responseText })
      } else {
        const img = await generateImage({ prompt, size: effectiveRatio.id === 'auto' ? sizeForRatio(effectiveRatio.w, effectiveRatio.h) : sizeForRatio(ratio.w, ratio.h), refs: activeRefs, model: activeModel }, controller.signal)
        updateMessage(id, aiId, { status: 'done', images: [img], text: '' })
      }
    } catch (err) {
      if (err?.name === 'AbortError' || /aborted/i.test(err?.message || '')) {
        updateMessage(id, aiId, { status: 'error', text: '已中断生成' })
      } else {
        updateMessage(id, aiId, { status: 'error', text: err.message })
      }
    } finally {
      abortRef.current = null
      setBusy(false)
      setTimeout(() => taRef.current?.focus(), 0)
    }
  }

  const stopGenerate = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }



  const onKeyDown = (e) => {
    // 中文/日文输入法选词阶段, Enter 用于确认候选词而非提交
    // nativeEvent.isComposing 覆盖 React 17 之前的版本; e.isComposing 覆盖 React 18+
    // 任一为 true 时, 不触发 send, 避免"你好"等输入被误判为提交指令
    if (e.key !== 'Enter' || e.shiftKey) return
    if (e.nativeEvent?.isComposing || e.isComposing) return
    if (e.keyCode === 229) return // 兜底: 部分浏览器在 IME 期间 keyCode 固定为 229
    e.preventDefault()
    send()
  }

  const messages = chat?.messages || []

  return (
    <div
      className="chat-page"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onPaste={handlePaste}
    >
      {/* 顶部对话操作栏：仅在有消息时显示 */}
      {chat && chat.messages && chat.messages.length > 0 && (
        <div className="chat-topbar">
          <div className="chat-topbar-title" title={chat.title || '新对话'}>
            {chat.title || '新对话'}
          </div>
          <div className="chat-topbar-actions">
            <button
              className="chat-topbar-btn"
              onClick={handleDeleteChat}
              title="删除对话 / 清除图片"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              删除对话
            </button>
          </div>
        </div>
      )}

      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="chat-hero">
            <div className="hero-logo">
              <Logo size={56} withText textSize={28} />
            </div>
            <h2>今天想创作点什么？</h2>
            <p>描述画面，挑一个画幅和风格，剩下的交给我</p>
            <div className="hero-suggestions">
              {SUGGESTIONS.map((sg) => (
                <button key={sg.text} className="suggestion" onClick={() => send(sg.text)}>
                  <span className="sg-icon">{sg.icon}</span>{sg.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-thread">
            {messages.map((m) => (
              <Message
                key={m.id}
                m={m}
                onDelete={handleDeleteMessage}
                onAddReference={addAsReference}
                onCopy={handleCopyMessage}
                onRegenerate={m.role === 'user' ? handleRegenerate : null}
              />
            ))}
          </div>
        )}
      </div>

      <div className="composer-wrap">
        <div className="composer">
          {refs.length > 0 && (
            <div className="composer-refs">
              {refs.map((r, i) => (
                <div key={i} className="ref-chip">
                  <img src={r} alt={`参考图 ${i + 1}`} />
                  <button onClick={() => setRefs(refs.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
            </div>
          )}
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            placeholder="描述你想生成的画面，Enter 发送，Shift+Enter 换行…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="composer-bar">
            {/* 回形针：上传参考图 */}
            <button className="icon-btn" title="添加参考图（最多 4 张）" onClick={() => fileRef.current?.click()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
            </button>

            {/* 提示词灵感库 */}
            <button className="icon-btn" title="提示词灵感库" onClick={() => setPromptLibOpen(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.5 1 2.5h6c0-1 .4-1.9 1-2.5A6 6 0 0 0 12 3z"/></svg>
            </button>

            {/* 画幅比例选择 */}
            <div className="pop-anchor" ref={ratioPop.ref}>
              <button className={`pill-btn ${ratioPop.open ? 'active' : ''}`} onClick={() => ratioPop.setOpen(!ratioPop.open)}>
                {ratio.id === 'auto' ? <span className="ratio-auto-ic">A</span> : <RatioIcon w={ratio.w} h={ratio.h} />}
                {ratio.name}
              </button>
              {ratioPop.open && (
                <div className="popover">
                  <div className="pop-title">画幅比例</div>
                  {RATIOS.map((r) => (
                    <button
                      key={r.id}
                      className={`pop-item ${ratio.id === r.id ? 'selected' : ''}`}
                      onClick={() => { setRatio(r); ratioPop.setOpen(false) }}
                    >
                      {r.id === 'auto' ? <span className="ratio-auto-ic">A</span> : <RatioIcon w={r.w} h={r.h} />}
                      <span className="pop-item-main">
                        <b>{r.name} <em>{r.label}</em></b>
                        <small>{r.desc}</small>
                      </span>
                      {ratio.id === r.id && <span className="pop-check">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 风格选择 */}
            <div className="pop-anchor" ref={stylePop.ref}>
              <button className={`pill-btn ${stylePop.open ? 'active' : ''}`} onClick={() => stylePop.setOpen(!stylePop.open)}>
                <span className="pill-emoji">{style.icon}</span>
                {style.id === 'none' ? '风格' : style.name}
              </button>
              {stylePop.open && (
                <div className="popover popover-styles">
                  <div className="pop-title">画面风格</div>
                  <div className="style-grid">
                    {STYLES.map((st) => (
                      <button
                        key={st.id}
                        className={`style-card ${style.id === st.id ? 'selected' : ''}`}
                        onClick={() => { setStyle(st); stylePop.setOpen(false) }}
                      >
                        <span className="style-icon">{st.icon}</span>
                        <b>{st.name}</b>
                        <small>{st.desc}</small>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 模型选择 */}
            <div className="pop-anchor" ref={modelPop.ref}>
              <button className={`pill-btn ${modelPop.open ? 'active' : ''}`} onClick={() => modelPop.setOpen(!modelPop.open)} title="选择生图模型">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6v6H9z"/></svg>
                <span className="pill-model">{allVisibleModels.find((b) => b.id === model)?.label || model}</span>

              </button>
              {modelPop.open && (
                <div className="popover popover-models">
                  <div className="pop-title">选择模型</div>
                  <input
                    className="model-search"
                    placeholder="搜索或输入自定义模型…"
                    value={modelQuery}
                    autoFocus
                    onChange={(e) => setModelQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' || !modelQuery.trim()) return
                      if (e.nativeEvent?.isComposing || e.isComposing || e.keyCode === 229) return
                      pickModel(modelQuery.trim())
                    }}
                  />
                  <div className="model-list">
                    {(() => {
                      const q = modelQuery.trim().toLowerCase()
                      const filtered = allVisibleModels.filter(
                        (m) => !q || m.id.toLowerCase().includes(q) || m.label.toLowerCase().includes(q)
                      )
                      
                      // Group by type instead of source
                      const TYPE_GROUPS = [
                        { type: 'image', label: '图片模型', icon: '🖼' },
                        { type: 'video', label: '视频模型', icon: '🎬' },
                        { type: 'chat',  label: '文本模型', icon: '💬' },
                        { type: null,    label: '未设置类型', icon: '⚠' },
                      ]
                      const groups = TYPE_GROUPS.map(g => ({
                        ...g,
                        items: filtered.filter(m => (m.type || null) === g.type),
                      })).filter(g => g.items.length > 0)
                      
                      return (
                        <>
                          {groups.map((g) => (
                            <div key={g.type} className="chat-model-group">
                              <div className="chat-model-group-title">
                                <span>{g.icon}</span>
                                <span>{g.label}</span>
                                <span className="model-type-group-count">{g.items.length}</span>
                              </div>
                              {g.items.map((m) => (
                                <button
                                  key={m.id}
                                  className={`chat-model-item ${model === m.id ? 'selected' : ''}`}
                                  onClick={() => pickModel(m.id)}
                                >
                                  <span className={`model-type-badge ${m.type || 'unset'}`}>{m.type || '未设置'}</span>
                                  <span className="chat-model-item-info">
                                    <span className="chat-model-item-label">{m.label}</span>
                                    <span className="chat-model-item-desc">{m.desc}</span>
                                  </span>
                                  {model === m.id && <span className="pop-check">✓</span>}
                                </button>
                              ))}
                            </div>
                          ))}
                          
                          {filtered.length === 0 && (
                            <div className="model-hint">没有匹配的已启用模型</div>
                          )}
                        </>
                      )
                    })()}
                  </div>

                </div>
              )}
            </div>

            <div className="spacer" />
            {busy ? (
              <button
                className="send-btn stop-btn"
                onClick={stopGenerate}
                title="中断生成"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
            ) : (
              <button
                className="send-btn"
                onClick={() => send()}
                disabled={!input.trim()}
                title="发送"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { attach(e.target.files); e.target.value = '' }} />
        </div>
        <div className="composer-hint">生成结果由 AI 模型生成 · 请遵守相关法律法规</div>
      </div>

      {/* 轻量 toast 提示（复制成功等） */}
      {toast && <div className="msg-toast">{toast}</div>}
    </div>
  )
}

// 按比例绘制的小示意框
function RatioIcon({ w, h }) {
  const max = 14
  const rw = w >= h ? max : Math.max(6, Math.round((max * w) / h))
  const rh = h >= w ? max : Math.max(6, Math.round((max * h) / w))
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <rect
        x={(18 - rw) / 2} y={(18 - rh) / 2} width={rw} height={rh}
        rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6"
      />
    </svg>
  )
}

const revealedSet = new Set()

function Message({ m, onDelete, onAddReference, onCopy, onRegenerate }) {
  const shouldAnimate = m.status === 'done' && m.images?.filter(Boolean).length > 0 && !revealedSet.has(m.id)

  if (shouldAnimate) {
    revealedSet.add(m.id)
  }
  if (m.role === 'user') {
    return (
      <div className="msg msg-user">
        <div className="msg-content">
          <div className="bubble bubble-user">
            {m.refs?.length > 0 && (
              <div className="msg-refs">
                {m.refs.map((r, i) => r && <img key={i} src={r} alt="参考图" />)}
              </div>
            )}
            {m.text}
            {m.meta?.length > 0 && (
              <div className="msg-meta">{m.meta.map((t) => <span key={t}>{t}</span>)}</div>
            )}
          </div>
          {m.status !== 'loading' && (
            <div className="msg-foot">
              {onCopy && (
                <button className="msg-icon-btn" onClick={() => onCopy(m)} title="复制消息内容">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              )}
              {onRegenerate && (
                <button className="msg-icon-btn" onClick={() => onRegenerate(m)} title="使用同一条指令和参考图重新生成">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                </button>
              )}
              {onDelete && (
                <button className="msg-icon-btn msg-del-icon" onClick={() => onDelete(m.id)} title="删除此消息">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const ar = m.ratio ? `${m.ratio.w} / ${m.ratio.h}` : '1 / 1'
  return (
    <div className="msg msg-ai">
      <div className="ai-avatar">
        <Logo size={28} />
      </div>
      <div className="msg-content">
        <div className="bubble bubble-ai">
          {m.status === 'loading' && m.mediaType === 'chat' && (!m.images || m.images.length === 0) && (
            <div className="gen-text-loading" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted)', fontSize: '13px' }}>
              <span className="spinner spinner-blue" />
              正在思考…
            </div>
          )}
          {m.status === 'loading' && m.mediaType === 'chat' && m.images && m.images.length > 0 && (
            <div className="gen-text-loading" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted)', fontSize: '13px' }}>
              <span className="spinner spinner-blue" />
              {m.text || '正在生图…'}
            </div>
          )}
          {m.status === 'loading' && m.mediaType !== 'chat' && (
            <div className="gen-frame" style={{ aspectRatio: ar }}>
              <div className="gen-mist" />
              <div className="gen-sheen" />
              <div className="gen-frame-label">
                <span className="spinner spinner-blue" />
                {m.mediaType === 'video' ? '正在生成视频…' : '正在绘制…'}
              </div>
            </div>
          )}
          {m.status === 'error' && <div className="gen-error">⚠ 生成失败：{m.text}</div>}
          {m.text && m.status === 'done' && <div className="ai-chat-text" style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>}
          {m.images?.filter(Boolean).map((img, i) => (
            <RevealImage key={i} src={img} ratio={ar} animate={shouldAnimate} />
          ))}
          {m.videos?.filter(Boolean).map((vid, i) => (
            <RevealVideo key={i} src={vid} ratio={ar} />
          ))}
          {m.status === 'done' && m.images?.filter(Boolean).length === 0 && m.videos?.filter(Boolean).length === 0 && !m.text && (
            <div className="gen-error">（媒体数据未保留，仅保存了会话记录）</div>
          )}
        </div>
        {m.status !== 'loading' && (
          <div className="msg-foot">
            {m.images?.filter(Boolean).length > 0 && onAddReference && (
              <button className="msg-icon-btn" onClick={() => onAddReference(m.images)} title="添加为参考图">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
              </button>
            )}
            {onCopy && (
              <button className="msg-icon-btn" onClick={() => onCopy(m)} title="复制消息内容">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            )}
            {onDelete && (
              <button className="msg-icon-btn msg-del-icon" onClick={() => onDelete(m.id)} title="删除此消息">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function RevealVideo({ src, ratio }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="gen-video" style={!loaded ? { aspectRatio: ratio } : undefined}>
      {!loaded && (
        <div className="gen-frame gen-frame-fill">
          <div className="gen-mist" />
          <div className="gen-sheen" />
        </div>
      )}
      <video
        src={src}
        controls
        muted
        loop
        className={loaded ? 'reveal' : 'pending'}
        onLoadedData={() => setLoaded(true)}
        style={{ display: loaded ? 'block' : 'none', width: '100%', borderRadius: '14px', border: '1px solid var(--border)' }}
      />
      {loaded && (
        <div className="gen-actions">
          <button onClick={() => downloadMedia(src, `joel-flow-studio-${Date.now()}`)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            下载视频
          </button>
        </div>
      )}
    </div>
  )
}


// 图片加载完成后：先模糊显现，再逐渐晕染清晰
function RevealImage({ src, ratio, animate = true }) {
  const [loaded, setLoaded] = useState(false)
  const shouldAnimate = animate && loaded
  return (
    <div className="gen-image" style={!loaded ? { aspectRatio: ratio } : undefined}>
      {!loaded && (
        <div className="gen-frame gen-frame-fill">
          <div className="gen-mist" />
          <div className="gen-sheen" />
        </div>
      )}
      <img
        src={src}
        alt="生成结果"
        className={shouldAnimate ? 'reveal' : ''}
        style={!loaded ? { opacity: 0 } : undefined}
        onLoad={() => setLoaded(true)}
      />
      {loaded && (
        <div className="gen-actions">
          <button onClick={() => downloadMedia(src, `joel-flow-studio-${Date.now()}`)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            下载
          </button>
        </div>
      )}
    </div>
  )
}
