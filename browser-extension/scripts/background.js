/**
 * MindFlow Ollama Bridge - Background Script
 * ローカルOllamaサーバーとの通信を処理します
 */

console.log('MindFlow Ollama Bridge background script loaded');

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
    
    console.log('Making Ollama request to:', url);
    console.log('Request options:', options);
    
    // CORSヘッダーを追加
    const requestOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };
    
    const response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('Ollama response received:', data);
    
    sendResponse({
      success: true,
      data: data,
      status: response.status
    });
    
  } catch (error) {
    console.error('Ollama request failed:', error);
    
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
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    sendResponse({
      success: true,
      message: 'Ollama接続成功'
    });
    
  } catch (error) {
    console.error('Ollama connection test failed:', error);
    
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