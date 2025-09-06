/**
 * MindFlow Ollama Bridge - Popup Script
 */

document.addEventListener('DOMContentLoaded', function() {
  const statusEl = document.getElementById('status');
  const statusTextEl = document.getElementById('status-text');
  const urlInput = document.getElementById('ollama-url');
  const testButton = document.getElementById('test-connection');
  const openMindflowButton = document.getElementById('open-mindflow');
  
  // 保存された設定を読み込み
  chrome.storage.local.get(['ollamaBaseUrl'], function(result) {
    if (result.ollamaBaseUrl) {
      urlInput.value = result.ollamaBaseUrl;
    }
  });
  
  // 初期接続テスト
  testConnection();
  
  // 接続テストボタン
  testButton.addEventListener('click', testConnection);
  
  // URL変更時に保存
  urlInput.addEventListener('change', function() {
    const url = urlInput.value.trim();
    chrome.storage.local.set({ ollamaBaseUrl: url });
  });
  
  // MindFlow開くボタン
  openMindflowButton.addEventListener('click', function() {
    chrome.tabs.create({ 
      url: 'https://sk0ya.github.io/MindFlow/' 
    });
    window.close();
  });
  
  /**
   * 接続テストを実行
   */
  async function testConnection() {
    const url = urlInput.value.trim() || 'http://localhost:11434';
    
    setStatus('testing', '接続をテスト中...');
    testButton.disabled = true;
    
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'testConnection',
          baseUrl: url
        }, function(response) {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      if (response.success) {
        setStatus('success', '✅ Ollamaに正常に接続されています');
        
        // モデル一覧も取得
        try {
          const modelsResponse = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
              action: 'getModels', 
              baseUrl: url
            }, function(response) {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(response);
              }
            });
          });
          
          if (modelsResponse.success && modelsResponse.models.length > 0) {
            setStatus('success', `✅ 接続成功 (${modelsResponse.models.length}個のモデルを検出)`);
          }
        } catch (modelError) {
          console.warn('Failed to get models:', modelError);
        }
        
      } else {
        setStatus('error', `❌ 接続失敗: ${response.error}`);
      }
    } catch (error) {
      console.error('Connection test error:', error);
      setStatus('error', `❌ 接続エラー: ${error.message}`);
    } finally {
      testButton.disabled = false;
    }
  }
  
  /**
   * ステータス表示を更新
   */
  function setStatus(type, text) {
    statusEl.className = `status ${type}`;
    statusTextEl.textContent = text;
  }
});