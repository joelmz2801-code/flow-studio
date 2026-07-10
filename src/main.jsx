import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import FavoritesFeature from './favorites/FavoritesFeature.jsx'
import FavoriteButtonLayout from './favorites/FavoriteButtonLayout.jsx'
import '@xyflow/react/dist/style.css'
import './styles.css'
import './favorites/favorites.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <FavoritesFeature />
    <FavoriteButtonLayout />
  </React.StrictMode>,
)
