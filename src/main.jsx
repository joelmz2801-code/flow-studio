import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import FeatureHub from './FeatureHub.jsx'
import '@xyflow/react/dist/style.css'
import './styles.css'
import './feature-hub.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <FeatureHub />
  </React.StrictMode>,
)
