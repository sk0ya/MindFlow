/**
 * MindFlow Ollama Bridge - Content Script
 * WebページにOllama Bridge APIを注入します
 */

console.log('🚀 MindFlow Ollama Bridge content script loaded');
console.log('📍 Content script running on:', window.location.href);
console.log('🔍 Document readyState:', document.readyState);

// ページにMindFlowOllamaBridge APIを注入
try {
  const script = document.createElement('script');
  const scriptUrl = chrome.runtime.getURL('scripts/injected.js');
  console.log('📂 Injecting script from:', scriptUrl);
  
  script.src = scriptUrl;
  script.onload = function() {
    console.log('✅ Injected script loaded successfully');
    this.remove();
  };
  script.onerror = function() {
    console.error('❌ Failed to load injected script');
  };
  
  (document.head || document.documentElement).appendChild(script);
  console.log('📤 Script injection attempted');
} catch (error) {
  console.error('❌ Error injecting script:', error);
}

// バックグラウンドスクリプトとのメッセージング
window.addEventListener('message', function(event) {
  // 同じオリジンからのメッセージのみ処理
  if (event.source !== window) return;
  
  if (event.data.type === 'MINDFLOW_OLLAMA_REQUEST') {
    console.log('📨 Content script received request:', event.data);
    
    // バックグラウンドスクリプトにリクエストを転送
    const message = {
      action: event.data.action,
      url: event.data.url,
      options: event.data.options,
      baseUrl: event.data.baseUrl
    };
    
    console.log('📤 Content script forwarding to background:', message);
    
    chrome.runtime.sendMessage(message, function(response) {
      if (chrome.runtime.lastError) {
        console.error('❌ Chrome runtime error:', chrome.runtime.lastError);
        response = {
          success: false,
          error: chrome.runtime.lastError.message
        };
      }
      
      console.log('📥 Content script received response:', response);
      
      // 結果をWebページに送信
      window.postMessage({
        type: 'MINDFLOW_OLLAMA_RESPONSE',
        requestId: event.data.requestId,
        response: response
      }, '*');
    });
  }
});