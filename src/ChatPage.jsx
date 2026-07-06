import React, { useEffect, useRef, useState } from 'react'
import { useStore } from './store.js'
import { generateImage, downloadMedia, listModels } from './engine/runner.js'
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
  const { createChat, appendMessage, updateMessage, renameChat } = useStore()
  const chat = chats.find((c) => c.id === chatId) || null

  const [input, setInput] = useState('')
  const [ratio, setRatio] = useState(RATIOS[0])
  const [style, setStyle] = useState(STYLES[0])
  const [customW, setCustomW] = useState('')
  const [customH, setCustomH] = useState('')
  const [refs, setRefs] = useState([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef()
  const scrollRef = useRef()
  const taRef = useRef()
  const ratioPop = usePopover()
  const stylePop = usePopover()
  const modelPop = usePopover()
  const [model, setModel] = useState(() => localStorage.getItem('jfs-model') || DEFAULT_MODEL)
  const [models, setModels] = useState(null)      // null=未加载 []=失败或为空
  const [modelQuery, setModelQuery] = useState('')

  const pickModel = (m) => {
    setModel(m)
    localStorage.setItem('jfs-model', m)
    modelPop.setOpen(false)
    setModelQuery('')
  }

  useEffect(() => {
    if (!modelPop.open || models !== null) return
    listModels().then(setModels).catch(() => setModels([]))
  }, [modelPop.open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [chat?.messages?.length, busy])

  const attach = async (files) => {
    const list = Array.from(files || []).slice(0, 4 - refs.length)
    const urls = await Promise.all(list.map(fileToDataUrl))
    setRefs((r) => [...r, ...urls].slice(0, 4))
  }

  const applyCustomRatio = () => {
    const w = parseInt(customW, 10)
    const h = parseInt(customH, 10)
    if (!w || !h || w <= 0 || h <= 0) return
    const g = ((a, b) => (b ? g(b, a % b) : a))(w, h)
    setRatio({ id: 'custom', w: w / g, h: h / g, name: `${w}:${h}`, label: '自定义', desc: '' })
    ratioPop.setOpen(false)
  }

  const send = async (textOverride) => {
    const text = (textOverride ?? input).trim()
    if (!text || busy) return
    let id = chatId
    if (!chat) id = createChat()

    const userMsg = {
      id: `m${Date.now()}u`, role: 'user', text, refs, time: Date.now(),
      meta: [ratio.id !== 'auto' && ratio.name !== '1:1' ? `画幅 ${ratio.name}` : '', style.id !== 'none' ? style.name : '', model].filter(Boolean),
    }
    appendMessage(id, userMsg)

    const current = useStore.getState().chats.find((c) => c.id === id)
    if (current && current.messages.length <= 1) {
      renameChat(id, text.slice(0, 24))
    }

    const aiId = `m${Date.now()}a`
    appendMessage(id, {
      id: aiId, role: 'assistant', status: 'loading', text: '', images: [],
      ratio: ratio.id === 'auto' ? null : { w: ratio.w, h: ratio.h }, time: Date.now(),
    })

    setInput('')
    setRefs([])
    setBusy(true)
    try {
      const prompt = style.prompt ? `${text}\n\n画面风格：${style.prompt}` : text
      const img = await generateImage({ prompt, size: ratio.id === 'auto' ? undefined : sizeForRatio(ratio.w, ratio.h), refs, model })
      updateMessage(id, aiId, { status: 'done', images: [img], text: '' })
    } catch (err) {
      updateMessage(id, aiId, { status: 'error', text: err.message })
    } finally {
      setBusy(false)
      setTimeout(() => taRef.current?.focus(), 0)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const messages = chat?.messages || []

  return (
    <div className="chat-page">
      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="chat-hero">
            <div className="hero-logo">
              <span className="dot dot-b" /><span className="dot dot-r" /><span className="dot dot-y" /><span className="dot dot-g" />
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
              <Message key={m.id} m={m} />
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
                  <div className="pop-divider" />
                  <div className="pop-custom">
                    <span>自定义</span>
                    <input type="number" min="1" placeholder="宽" value={customW} onChange={(e) => setCustomW(e.target.value)} />
                    <i>:</i>
                    <input type="number" min="1" placeholder="高" value={customH} onChange={(e) => setCustomH(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyCustomRatio()} />
                    <button onClick={applyCustomRatio} disabled={!parseInt(customW, 10) || !parseInt(customH, 10)}>应用</button>
                  </div>
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
                <span className="pill-model">{BUILTIN_MODELS.find((b) => b.id === model)?.label || model}</span>
              </button>
              {modelPop.open && (
                <div className="popover popover-models">
                  <div className="pop-title">生图模型</div>
                  <input
                    className="model-search"
                    placeholder="搜索或输入自定义模型…"
                    value={modelQuery}
                    autoFocus
                    onChange={(e) => setModelQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && modelQuery.trim() && pickModel(modelQuery.trim())}
                  />
                  <div className="model-list">
                    {(() => {
                      const q = modelQuery.trim().toLowerCase()
                      const builtins = BUILTIN_MODELS.filter(
                        (b) => !q || b.label.toLowerCase().includes(q) || b.id.toLowerCase().includes(q)
                      )
                      const builtinIds = new Set(BUILTIN_MODELS.map((b) => b.id))
                      const extra = (models || []).filter(
                        (m) => !builtinIds.has(m) && (!q || m.toLowerCase().includes(q))
                      )
                      return (
                        <>
                          {builtins.length > 0 && <div className="model-group">内置模型</div>}
                          {builtins.map((b) => (
                            <button key={b.id} className={`pop-item model-item ${model === b.id ? 'selected' : ''}`} onClick={() => pickModel(b.id)}>
                              <span className="pop-item-main">
                                <b>{b.label}</b>
                                <small>{b.desc}</small>
                              </span>
                              {model === b.id && <span className="pop-check">✓</span>}
                            </button>
                          ))}
                          {models === null && <div className="model-hint">正在获取更多模型…</div>}
                          {extra.length > 0 && <div className="model-group">更多模型</div>}
                          {extra.map((m) => (
                            <button key={m} className={`pop-item model-item ${model === m ? 'selected' : ''}`} onClick={() => pickModel(m)}>
                              <span className="pop-item-main"><b>{m}</b></span>
                              {model === m && <span className="pop-check">✓</span>}
                            </button>
                          ))}
                          {models !== null && !builtins.length && !extra.length && (
                            <div className="model-hint">
                              没有匹配的模型{q ? <>，按 Enter 使用 “{modelQuery.trim()}”</> : ''}
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                  {modelQuery.trim() && !(models || []).includes(modelQuery.trim()) && (
                    <button className="model-use-custom" onClick={() => pickModel(modelQuery.trim())}>
                      使用自定义模型 “{modelQuery.trim()}”
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="spacer" />
            <button
              className={`send-btn ${busy ? 'busy' : ''}`}
              onClick={() => send()}
              disabled={busy || !input.trim()}
              title="发送"
            >
              {busy ? (
                <span className="spinner" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
              )}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { attach(e.target.files); e.target.value = '' }} />
        </div>
        <div className="composer-hint">生成结果由 AI 模型生成 · 请遵守相关法律法规</div>
      </div>
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

function Message({ m }) {
  if (m.role === 'user') {
    return (
      <div className="msg msg-user">
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
      </div>
    )
  }

  const ar = m.ratio ? `${m.ratio.w} / ${m.ratio.h}` : '1 / 1'
  return (
    <div className="msg msg-ai">
      <div className="ai-avatar">
        <span className="dot dot-b" /><span className="dot dot-r" /><span className="dot dot-y" /><span className="dot dot-g" />
      </div>
      <div className="bubble bubble-ai">
        {m.status === 'loading' && (
          <div className="gen-frame" style={{ aspectRatio: ar }}>
            <div className="gen-mist" />
            <div className="gen-sheen" />
            <div className="gen-frame-label">
              <span className="spinner spinner-blue" />
              正在绘制…
            </div>
          </div>
        )}
        {m.status === 'error' && <div className="gen-error">⚠ 生成失败：{m.text}</div>}
        {m.images?.filter(Boolean).map((img, i) => (
          <RevealImage key={i} src={img} ratio={ar} />
        ))}
        {m.status === 'done' && m.images?.filter(Boolean).length === 0 && (
          <div className="gen-error">（图片数据未保留，仅保存了会话记录）</div>
        )}
      </div>
    </div>
  )
}

// 图片加载完成后：先模糊显现，再逐渐晕染清晰
function RevealImage({ src, ratio }) {
  const [loaded, setLoaded] = useState(false)
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
        className={loaded ? 'reveal' : 'pending'}
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
