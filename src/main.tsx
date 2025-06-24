import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { debugSync } from './debug-sync.js'

// Make debug function available globally
if (typeof window !== 'undefined') {
  (window as any).debugSync = debugSync;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
