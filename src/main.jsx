import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import FavoritesFeature from './favorites/FavoritesFeature.jsx'
import FolderDialogGuard from './favorites/FolderDialogGuard.jsx'
import '@xyflow/react/dist/style.css'
import './styles.css'
import './favorites/favorites.css'
import './favorites/folder-dialog-guard.css'
import './favorites/mobile.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <FavoritesFeature />
    <FolderDialogGuard />
  </React.StrictMode>,
)
