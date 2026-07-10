import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import FavoritesFeature from './favorites/FavoritesFeature.jsx'
import './favorites/placeFavoriteAction.js'
import '@xyflow/react/dist/style.css'
import './styles.css'
import './favorites/favorites.css'
import './favorites/favorite-action.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <FavoritesFeature />
  </React.StrictMode>,
)
