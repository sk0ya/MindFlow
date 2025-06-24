import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Debug functions only in development
if (import.meta.env.DEV && typeof window !== 'undefined') {
  import('./debug-sync.js').then(({ debugSync }) => {
    (window as any).debugSync = debugSync;
  });
  
  // クラウドモードデバッグ機能
  import('./debug-cloud.js');
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
