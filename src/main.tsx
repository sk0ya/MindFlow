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
  
  // クラウド同期テストスイート
  import('./test-cloud-sync.js');
  
  // ストレージ統合テスト
  import('./test-storage-integration.js');
  
  // 同期診断ツール
  import('./test-sync-diagnosis.js');
  
  // シンプル化クラウドストレージテスト
  import('./test-simplified-cloud.js');
  
  // ブラウザ間同期テスト
  import('./test-cross-browser-sync.js');
  
  // リアルタイム同期修正テスト
  import('./test-realtime-sync-fix.js');
  
  // クラウド認証タイミングテスト
  import('./test-cloud-auth-timing.js');
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
