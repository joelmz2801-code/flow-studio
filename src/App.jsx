import React from 'react'
import { useStore } from './store.js'
import Sidebar from './Sidebar.jsx'
import ChatPage from './ChatPage.jsx'
import FlowPage from './FlowPage.jsx'
import SettingsModal from './SettingsModal.jsx'

export default function App() {
  const activeView = useStore((s) => s.activeView)

  return (
    <div className="app">
      <Sidebar />
      <div className="main-area">
        {activeView.type === 'flow' ? <FlowPage /> : <ChatPage chatId={activeView.id} />}
      </div>
      <SettingsModal />
    </div>
  )
}
