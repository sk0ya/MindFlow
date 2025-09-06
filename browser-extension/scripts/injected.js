/**
 * MindFlow Ollama Bridge - Injected Script  
 * WebページのグローバルスコープにOllama APIを提供します
 */

console.log('MindFlow Ollama Bridge injected script loaded');

// グローバルAPIオブジェクトを作成
window.MindFlowOllamaBridge = {
  version: '1.0.0',
  available: true,
  
  /**
   * Ollamaリクエストを送信
   */
  async request(url, options = {}) {
    return new Promise((resolve, reject) => {
      const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      // レスポンスリスナーを設定
      const responseListener = (event) => {
        if (event.data.type === 'MINDFLOW_OLLAMA_RESPONSE' && 
            event.data.requestId === requestId) {
          
          window.removeEventListener('message', responseListener);
          
          if (event.data.response.success) {
            resolve(event.data.response);
          } else {
            reject(new Error(event.data.response.error));
          }
        }
      };
      
      window.addEventListener('message', responseListener);
      
      // タイムアウト設定（30秒）
      setTimeout(() => {
        window.removeEventListener('message', responseListener);
        reject(new Error('Request timeout'));
      }, 30000);
      
      // リクエストを送信
      window.postMessage({
        type: 'MINDFLOW_OLLAMA_REQUEST',
        action: 'ollamaRequest',
        requestId: requestId,
        url: url,
        options: options
      }, '*');
    });
  },
  
  /**
   * Ollama接続をテスト
   */
  async testConnection(baseUrl = 'http://localhost:11434') {
    return new Promise((resolve, reject) => {
      const requestId = 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      const responseListener = (event) => {
        if (event.data.type === 'MINDFLOW_OLLAMA_RESPONSE' && 
            event.data.requestId === requestId) {
          
          window.removeEventListener('message', responseListener);
          resolve(event.data.response);
        }
      };
      
      window.addEventListener('message', responseListener);
      
      setTimeout(() => {
        window.removeEventListener('message', responseListener);
        reject(new Error('Connection test timeout'));
      }, 10000);
      
      window.postMessage({
        type: 'MINDFLOW_OLLAMA_REQUEST',
        action: 'testConnection',
        requestId: requestId,
        baseUrl: baseUrl
      }, '*');
    });
  },
  
  /**
   * 利用可能なモデル一覧を取得
   */
  async getModels(baseUrl = 'http://localhost:11434') {
    return new Promise((resolve, reject) => {
      const requestId = 'models_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      const responseListener = (event) => {
        if (event.data.type === 'MINDFLOW_OLLAMA_RESPONSE' && 
            event.data.requestId === requestId) {
          
          window.removeEventListener('message', responseListener);
          
          if (event.data.response.success) {
            resolve(event.data.response.models);
          } else {
            reject(new Error(event.data.response.error));
          }
        }
      };
      
      window.addEventListener('message', responseListener);
      
      setTimeout(() => {
        window.removeEventListener('message', responseListener);
        reject(new Error('Get models timeout'));
      }, 10000);
      
      window.postMessage({
        type: 'MINDFLOW_OLLAMA_REQUEST',
        action: 'getModels',
        requestId: requestId,
        baseUrl: baseUrl
      }, '*');
    });
  }
};

// 拡張機能が利用可能であることをページに通知
window.dispatchEvent(new CustomEvent('mindflowOllamaBridgeReady', {
  detail: {
    version: window.MindFlowOllamaBridge.version,
    available: true
  }
}));

console.log('MindFlowOllamaBridge API available:', window.MindFlowOllamaBridge);