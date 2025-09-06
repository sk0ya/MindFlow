/**
 * MindFlow Ollama Bridge - Content Script
 * WebページにOllama Bridge APIを注入します
 */

console.log('MindFlow Ollama Bridge content script loaded');

// ページにMindFlowOllamaBridge APIを注入
const script = document.createElement('script');
script.src = chrome.runtime.getURL('scripts/injected.js');
script.onload = function() {
  this.remove();
};
(document.head || document.documentElement).appendChild(script);

// バックグラウンドスクリプトとのメッセージング
window.addEventListener('message', function(event) {
  // 同じオリジンからのメッセージのみ処理
  if (event.source !== window) return;
  
  if (event.data.type === 'MINDFLOW_OLLAMA_REQUEST') {
    console.log('Content script received request:', event.data);
    
    // バックグラウンドスクリプトにリクエストを転送
    chrome.runtime.sendMessage({
      action: event.data.action,
      url: event.data.url,
      options: event.data.options,
      baseUrl: event.data.baseUrl
    }, function(response) {
      console.log('Content script received response:', response);
      
      // 結果をWebページに送信
      window.postMessage({
        type: 'MINDFLOW_OLLAMA_RESPONSE',
        requestId: event.data.requestId,
        response: response
      }, '*');
    });
  }
});