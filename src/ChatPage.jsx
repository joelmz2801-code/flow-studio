import React, { useEffect, useRef, useState } from 'react'
import { useStore } from './store.js'
import { generateImage, downloadMedia } from './engine/runner.js'

const SIZES = ['1024x1024', '1024x1536', '1536x1024', '512x512']

const SUGGESTIONS = [
  '一只戴着宇航员头盔的柴犬，赛博朋克城市夜景，电影感光效',
  '水彩风格的江南水乡，清晨薄雾，白墙黛瓦',
  '未来感极简产品海报，悬浮的透明玻璃立方体，柔和渐变背景',
  '国风插画：山间仙鹤，云雾缭绕，工笔画质感',
]

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.readAsDataURL(file)
  })
}

export default function ChatPage({ chatId }) {
  const chats = useStore((s) => s.chats)
  const { createChat, appendMessage, updateMessage, renameChat } = useStore()
  const chat = chats.find((c) => c.id === chatId) || null

  const [input, setInput] = useState('')
  const [size, setSize] = useState('1024x1024')
  const [refs, setRefs] = useState([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef()
  const scrollRef = useRef()
  const taRef = useRef()

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [chat?.messages?.length, busy])

  const attach = async (files) => {
    const list = Array.from(files || []).slice(0, 4 - refs.length)
    const urls = await Promise.all(list.map(fileToDataUrl))
    setRefs((r) => [...r, ...urls].slice(0, 4))
  }

  const send = async (textOverride) => {
    const text = (textOverride ?? input).trim()
    if (!text || busy) return
    let id = chatId
    if (!chat) id = createChat()

    const userMsg = { id: `m${Date.now()}u`, role: 'user', text, refs, time: Date.now() }
    appendMessage(id, userMsg)

    // 首条消息作为会话标题
    const current = useStore.getState().chats.find((c) => c.id === id)
    if (current && current.messages.length <= 1) {
      renameChat(id, text.slice(0, 24))
    }

    const aiId = `m${Date.now()}a`
    appendMessage(id, { id: aiId, role: 'assistant', status: 'loading', text: '', images: [], time: Date.now() })

    setInput('')
    setRefs([])
    setBusy(true)
    try {
      const img = await generateImage({ prompt: text, size, refs })
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
            <p>输入描述即可生成图片，也可以附上参考图</p>
            <div className="hero-suggestions">
              {SUGGESTIONS.map((sg) => (
                <button key={sg} className="suggestion" onClick={() => send(sg)}>{sg}</button>
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
            <button className="tool-btn" title="添加参考图（最多 4 张）" onClick={() => fileRef.current?.click()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
              参考图
            </button>
            <select className="size-select" value={size} onChange={(e) => setSize(e.target.value)} title="图片尺寸">
              {SIZES.map((s) => <option key={s}>{s}</option>)}
            </select>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>
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
        </div>
      </div>
    )
  }
  return (
    <div className="msg msg-ai">
      <div className="ai-avatar">
        <span className="dot dot-b" /><span className="dot dot-r" /><span className="dot dot-y" /><span className="dot dot-g" />
      </div>
      <div className="bubble bubble-ai">
        {m.status === 'loading' && (
          <div className="gen-loading">
            <span className="spinner spinner-blue" />
            正在生成图片，请稍候…
          </div>
        )}
        {m.status === 'error' && <div className="gen-error">⚠ 生成失败：{m.text}</div>}
        {m.images?.filter(Boolean).map((img, i) => (
          <div key={i} className="gen-image">
            <img src={img} alt="生成结果" />
            <div className="gen-actions">
              <button onClick={() => downloadMedia(img, `flow-studio-${Date.now()}`)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                下载
              </button>
            </div>
          </div>
        ))}
        {m.status === 'done' && m.images?.filter(Boolean).length === 0 && (
          <div className="gen-error">（图片数据未保留，仅保存了会话记录）</div>
        )}
      </div>
    </div>
  )
}
