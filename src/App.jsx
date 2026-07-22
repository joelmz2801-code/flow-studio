import React, { Suspense, lazy, useEffect } from 'react'
import { useStore, syncFromCloud, clearUserData, applyRealtimeChatChange, applyRealtimePresetChange, applyRealtimeCustomPromptChange } from './store.js'
import { useAuth } from './useAuth.js'
import { subscribeToChanges } from './lib/sync.js'
import Sidebar from './Sidebar.jsx'
import ChatPage from './ChatPage.jsx'
import AuthPage from './AuthPage.jsx'

const SettingsModal = lazy(() => import('./SettingsModal.jsx'))
const PromptLibrary = lazy(() => import('./PromptLibrary.jsx'))
const GrowthExperience = lazy(() => import('./GrowthExperience.jsx'))

function AppFallback() {
  return <div className="app-loading" role="status" aria-label="正在加载"><span className="spinner spinner-blue" /></div>
}

export default function App() {
  const activeView = useStore((s) => s.activeView)
  const mobileNavOpen = useStore((s) => s.mobileNavOpen)
  const setMobileNavOpen = useStore((s) => s.setMobileNavOpen)
  const { user, loading, isAuthEnabled } = useAuth()

  useEffect(() => {
    if (!user) {
      clearUserData()
      return undefined
    }
    syncFromCloud(user.id)
    return subscribeToChanges(
      user.id,
      applyRealtimeChatChange,
      applyRealtimePresetChange,
      applyRealtimeCustomPromptChange,
    )
  }, [user?.id])

  if (loading) return <AppFallback />
  if (isAuthEnabled && !user) return <AuthPage />

  const chatView = activeView.type === 'chat' ? activeView : { type: 'chat', id: null }

  return (
    <div className="app">
      <header className="mobile-topbar">
        <button className="icon-btn" onClick={() => setMobileNavOpen(true)} aria-label="打开菜单">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <span className="mobile-title">Joel Flow Studio</span><span style={{ width: 34 }} />
      </header>
      {mobileNavOpen && <div className="nav-backdrop" onClick={() => setMobileNavOpen(false)} />}
      <Sidebar />
      <div className="main-area">
        <ChatPage chatId={chatView.id} />
        <Suspense fallback={null}><GrowthExperience activeView={chatView} /></Suspense>
      </div>
      <Suspense fallback={null}><SettingsModal /><PromptLibrary /></Suspense>
    </div>
  )
}
