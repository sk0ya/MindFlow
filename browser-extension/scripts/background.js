/**
 * MindFlow Ollama Bridge - Background Script
 * ローカルOllamaサーバーとの通信を処理します
 */

console.log('🚀 MindFlow Ollama Bridge background script loaded');

// ハートビート機能でbackground scriptが生きているか確認
setInterval(() => {
  console.log('💓 Background script heartbeat');
}, 60000); // 1分ごと

// Ollama APIへのリクエストを処理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request);
  
  if (request.action === 'ollamaRequest') {
    handleOllamaRequest(request, sendResponse);
    return true; // 非同期レスポンスを示す
  }
  
  if (request.action === 'testConnection') {
    testOllamaConnection(request, sendResponse);
    return true;
  }
  
  if (request.action === 'getModels') {
    getOllamaModels(request, sendResponse);
    return true;
  }
});

/**
 * Ollamaへのリクエストを処理
 */
async function handleOllamaRequest(request, sendResponse) {
  try {
    const { url, options } = request;
    
    console.log('🔄 Making Ollama request to:', url);
    console.log('📤 Original request options:', JSON.stringify(options, null, 2));
    
    // Ollamaに適したヘッダーを設定（必要最小限）
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json'
        // ブラウザ固有のヘッダーを除外してOllamaとの互換性を確保
      },
      // リダイレクトを許可
      redirect: 'follow'
    };
    
    // POSTリクエストの場合のみbodyを追加
    if (options.method === 'POST' && options.body) {
      requestOptions.body = options.body;
    }
    
    console.log('📤 Final request options:', JSON.stringify(requestOptions, null, 2));
    
    const response = await fetch(url, requestOptions);
    
    console.log('📥 Response status:', response.status, response.statusText);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      // 詳細なエラー情報を取得
      let errorDetails = '';
      let errorBody = '';
      try {
        errorBody = await response.text();
        errorDetails = errorBody ? ` - Body: ${errorBody}` : '';
      } catch (e) {
        console.warn('Failed to read error response body:', e);
      }
      
      // 403エラーの場合は特別な処理
      if (response.status === 403) {
        console.error('🚫 Ollama CORS/Access Error Details:', {
          status: response.status,
          statusText: response.statusText,
          url: url,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorBody
        });
        throw new Error(`Ollama access denied (403). Please check OLLAMA_ORIGINS setting: ${response.statusText}${errorDetails}`);
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}${errorDetails}`);
    }
    
    const data = await response.json();
    
    console.log('✅ Ollama response received:', data);
    
    sendResponse({
      success: true,
      data: data,
      status: response.status
    });
    
  } catch (error) {
    console.error('❌ Ollama request failed:', error);
    console.error('Error stack:', error.stack);
    
    sendResponse({
      success: false,
      error: error.message,
      status: error.status || 0
    });
  }
}

/**
 * Ollama接続テスト
 */
async function testOllamaConnection(request, sendResponse) {
  try {
    const baseUrl = request.baseUrl || 'http://localhost:11434';
    console.log('🔄 Testing Ollama connection to:', baseUrl);
    
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('📥 Connection test response:', response.status, response.statusText);
    
    if (!response.ok) {
      // エラー詳細を取得
      let errorDetails = '';
      try {
        const errorText = await response.text();
        errorDetails = errorText ? ` - ${errorText}` : '';
      } catch (e) {
        console.warn('Failed to read error response body:', e);
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}${errorDetails}`);
    }
    
    const data = await response.json();
    console.log('✅ Connection test successful, models:', data.models?.length || 0);
    
    sendResponse({
      success: true,
      message: `Ollama接続成功 (${data.models?.length || 0}個のモデル検出)`
    });
    
  } catch (error) {
    console.error('❌ Ollama connection test failed:', error);
    
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 利用可能なモデル一覧を取得
 */
async function getOllamaModels(request, sendResponse) {
  try {
    const baseUrl = request.baseUrl || 'http://localhost:11434';
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const modelNames = data.models ? data.models.map(model => model.name) : [];
    
    sendResponse({
      success: true,
      models: modelNames
    });
    
  } catch (error) {
    console.error('Failed to get Ollama models:', error);
    
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// 拡張機能のインストール・更新時
chrome.runtime.onInstalled.addListener((details) => {
  console.log('MindFlow Ollama Bridge installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // 初回インストール時の処理
    chrome.storage.local.set({
      'ollamaBaseUrl': 'http://localhost:11434',
      'enabled': true
    });
  }
});