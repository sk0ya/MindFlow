/**
 * MindFlow Ollama Bridge - Injected Script  
 * WebページのグローバルスコープにOllama APIを提供します
 */

console.log('🚀 MindFlow Ollama Bridge injected script loaded');
console.log('📍 Current URL:', window.location.href);
console.log('🔍 User Agent:', navigator.userAgent);

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
          clearTimeout(timeoutId);
          
          console.log('🔄 Extension response received:', event.data.response);
          
          if (event.data.response.success) {
            resolve(event.data.response);
          } else {
            console.error('❌ Extension request failed:', event.data.response);
            reject(new Error(event.data.response.error || 'Unknown extension error'));
          }
        }
      };
      
      window.addEventListener('message', responseListener);
      
      // タイムアウト設定（60秒 - 長いテキスト生成に対応）
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', responseListener);
        reject(new Error('Request timeout (60 seconds). The model might be processing a complex request.'));
      }, 60000);
      
      // リクエストを送信
      console.log('📤 Sending extension request:', {
        type: 'MINDFLOW_OLLAMA_REQUEST',
        action: 'ollamaRequest',
        requestId: requestId,
        url: url,
        options: options
      });
      
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
          clearTimeout(timeoutId);
          resolve(event.data.response);
        }
      };
      
      window.addEventListener('message', responseListener);
      
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', responseListener);
        reject(new Error('Connection test timeout (10 seconds)'));
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
          clearTimeout(timeoutId);
          
          if (event.data.response.success) {
            resolve(event.data.response.models);
          } else {
            reject(new Error(event.data.response.error));
          }
        }
      };
      
      window.addEventListener('message', responseListener);
      
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', responseListener);
        reject(new Error('Get models timeout (10 seconds)'));
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
console.log('🎉 Dispatching mindflowOllamaBridgeReady event');
window.dispatchEvent(new CustomEvent('mindflowOllamaBridgeReady', {
  detail: {
    version: window.MindFlowOllamaBridge.version,
    available: true
  }
}));

console.log('✅ MindFlowOllamaBridge API available:', window.MindFlowOllamaBridge);

// グローバルスコープでも確認できるようにする
window.testOllamaBridge = function() {
  console.log('🧪 Extension test function called');
  return {
    available: !!window.MindFlowOllamaBridge,
    version: window.MindFlowOllamaBridge?.version,
    url: window.location.href
  };
};