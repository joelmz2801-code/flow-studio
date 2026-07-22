import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import FavoritesFeature from './favorites/FavoritesFeature.jsx'
import FolderDialogGuard from './favorites/FolderDialogGuard.jsx'
import BookmarkFavoriteEnhancer from './favorites/BookmarkFavoriteEnhancer.jsx'
import SidebarFavoritesEnhancer from './favorites/SidebarFavoritesEnhancer.jsx'
import DeleteConfirmUI from './DeleteConfirmUI.jsx'
import '@xyflow/react/dist/style.css'
import './styles.css'
import './auth-landing.css'
import './ui-polish.css'
import './favorites/favorites.css'
import './favorites/folder-dialog-guard.css'
import './favorites/bookmark-favorite.css'
import './favorites/sidebar-favorites.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <FavoritesFeature />
      <FolderDialogGuard />
      <BookmarkFavoriteEnhancer />
      <SidebarFavoritesEnhancer />
      <DeleteConfirmUI />
    </ErrorBoundary>
  </React.StrictMode>,
)
