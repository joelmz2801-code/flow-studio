import React from 'react'
import { useStore } from './store.js'
import Sidebar from './Sidebar.jsx'
import ChatPage from './ChatPage.jsx'
import FlowPage from './FlowPage.jsx'
import SettingsModal from './SettingsModal.jsx'

export default function App() {
  const activeView = useStore((s) => s.activeView)
  const mobileNavOpen = useStore((s) => s.mobileNavOpen)
  const setMobileNavOpen = useStore((s) => s.setMobileNavOpen)

  return (
    <div className="app">
      <header className="mobile-topbar">
        <button className="icon-btn" onClick={() => setMobileNavOpen(true)} aria-label="打开菜单">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <span className="mobile-title">Joel Flow Studio</span>
        <span style={{ width: 34 }} />
      </header>
      {mobileNavOpen && <div className="nav-backdrop" onClick={() => setMobileNavOpen(false)} />}
      <Sidebar />
      <div className="main-area">
        {activeView.type === 'flow' ? <FlowPage /> : <ChatPage chatId={activeView.id} />}
      </div>
      <SettingsModal />
    </div>
  )
}
