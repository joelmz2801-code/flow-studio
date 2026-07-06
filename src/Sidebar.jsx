import React from 'react'
import { useStore } from './store.js'

export default function Sidebar() {
  const {
    chats, activeView, sidebarCollapsed, searchQuery,
    setActiveView, toggleSidebar, setSearchQuery,
    createChat, removeChat, setSettingsOpen,
  } = useStore()

  const q = searchQuery.trim().toLowerCase()
  const filteredChats = q
    ? chats.filter(
        (c) =>
          (c.title || '').toLowerCase().includes(q) ||
          c.messages.some((m) => (m.text || '').toLowerCase().includes(q)),
      )
    : chats
  const showFlow = !q || '工作流节点'.includes(q) || 'workflow'.includes(q)

  const isFlow = activeView.type === 'flow'

  if (sidebarCollapsed) {
    return (
      <aside className="sidebar collapsed">
        <button className="icon-btn sb-toggle" onClick={toggleSidebar} title="展开侧边栏">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        </button>
        <button className="icon-btn" onClick={createChat} title="新对话">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <button
          className={`icon-btn ${!isFlow ? 'active' : ''}`}
          onClick={() => setActiveView({ type: 'chat', id: chats[0]?.id || null })}
          title="对话"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
        <button
          className={`icon-btn ${isFlow ? 'active' : ''}`}
          onClick={() => setActiveView({ type: 'flow' })}
          title="工作流节点"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8.5 8.5 15.5 15.5" strokeLinecap="round"/></svg>
        </button>
        <div className="sb-spacer" />
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="设置">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </aside>
    )
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">
          <span className="dot dot-b" /><span className="dot dot-r" /><span className="dot dot-y" /><span className="dot dot-g" />
        </div>
        <div className="brand-text">
          <h1>Joel Flow Studio</h1>
          <p>AI 创作工作台</p>
        </div>
        <button className="icon-btn sb-toggle" onClick={toggleSidebar} title="收起侧边栏">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      </div>

      <button className="new-chat-btn" onClick={createChat}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        新对话
      </button>

      <div className="search-box">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索对话或页面…"
        />
        {searchQuery && (
          <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
        )}
      </div>

      <div className="sb-section">
        <div className="sb-section-title">页面</div>
        {showFlow && (
          <button
            className={`sb-item ${isFlow ? 'active' : ''}`}
            onClick={() => setActiveView({ type: 'flow' })}
          >
            <span className="sb-item-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8.5 8.5 15.5 15.5" strokeLinecap="round"/></svg>
            </span>
            <span className="sb-item-label">工作流节点</span>
          </button>
        )}
      </div>

      <div className="sb-section sb-chats">
        <div className="sb-section-title">对话</div>
        {filteredChats.length === 0 && (
          <div className="sb-empty">{q ? '没有匹配的对话' : '暂无对话，点击「新对话」开始'}</div>
        )}
        {filteredChats.map((c) => (
          <button
            key={c.id}
            className={`sb-item ${!isFlow && activeView.id === c.id ? 'active' : ''}`}
            onClick={() => setActiveView({ type: 'chat', id: c.id })}
          >
            <span className="sb-item-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </span>
            <span className="sb-item-label">{c.title || '新对话'}</span>
            <span
              className="sb-item-del"
              title="删除对话"
              onClick={(e) => { e.stopPropagation(); removeChat(c.id) }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6"/></svg>
            </span>
          </button>
        ))}
      </div>

      <div className="sb-foot">
        <button className="sb-item sb-settings" onClick={() => setSettingsOpen(true)}>
          <span className="sb-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </span>
          <span className="sb-item-label">设置</span>
        </button>
      </div>
    </aside>
  )
}
