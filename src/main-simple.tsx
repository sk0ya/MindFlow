/**
 * シンプル版のメインエントリーポイント（テスト用）
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import SimpleApp from './SimpleApp';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <SimpleApp />
  </React.StrictMode>,
);