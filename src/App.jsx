import React, { useEffect } from 'react'
import { useStore, syncFromCloud, clearUserData, applyRealtimeChatChange, applyRealtimePresetChange, applyRealtimeCustomPromptChange } from './store.js'
import { useAuth } from './useAuth.js'
import { subscribeToChanges } from './lib/sync.js'
import Sidebar from './Sidebar.jsx'
import ChatPage from './ChatPage.jsx'
import SettingsModal from './SettingsModal.jsx'
import PromptLibrary from './PromptLibrary.jsx'
import AuthPage from './AuthPage.jsx'
import GrowthExperience from './GrowthExperience.jsx'

export default function App() {
  const activeView = useStore((s) => s.activeView)
  const mobileNavOpen = useStore((s) => s.mobileNavOpen)
  const setMobileNavOpen = useStore((s) => s.setMobileNavOpen)
  const { user, loading, isAuthEnabled } = useAuth()

  useEffect(() => {
    if (!user) {
      clearUserData()
      return
    }
    syncFromCloud(user.id)
    const unsub = subscribeToChanges(user.id,
      (payload) => { applyRealtimeChatChange(payload) },
      (payload) => { applyRealtimePresetChange(payload) },
      (payload) => { applyRealtimeCustomPromptChange(payload) },
    )
    return unsub
  }, [user?.id])

  if (loading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner spinner-blue" style={{ width: 24, height: 24 }} />
      </div>
    )
  }

  if (isAuthEnabled && !user) return <AuthPage />

  const chatView = activeView.type === 'chat' ? activeView : { type: 'chat', id: null }

  return (
    <div className="app">
      <header className="mobile-topbar">
        <button className="icon-btn" onClick={() => setMobileNavOpen(true)} aria-label="打开菜单">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <span className="mobile-title">Joel Flow Studio</span>
        <span style={{ width: 34 }} />
      </header>
      {mobileNavOpen && <div className="nav-backdrop" onClick={() => setMobileNavOpen(false)} />}
      <Sidebar />
      <div className="main-area">
        <ChatPage chatId={chatView.id} />
        <GrowthExperience activeView={chatView} />
      </div>
      <SettingsModal />
      <PromptLibrary />
    </div>
  )
}
