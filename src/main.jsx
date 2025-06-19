import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { debugSync } from './debug-sync.js'

// Make debug function available globally
if (typeof window !== 'undefined') {
  window.debugSync = debugSync;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
