import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import FavoritesFeature from './favorites/FavoritesFeature.jsx'
import FolderDialogGuard from './favorites/FolderDialogGuard.jsx'
import BookmarkFavoriteEnhancer from './favorites/BookmarkFavoriteEnhancer.jsx'
import '@xyflow/react/dist/style.css'
import './styles.css'
import './favorites/favorites.css'
import './favorites/folder-dialog-guard.css'
import './favorites/bookmark-favorite.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <FavoritesFeature />
    <FolderDialogGuard />
    <BookmarkFavoriteEnhancer />
  </React.StrictMode>,
)
