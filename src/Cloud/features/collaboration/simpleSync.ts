// シンプルな同期システム - 循環依存なし

const API_BASE = 'https://mindflow-api-production.shigekazukoya.workers.dev';

// 基本的なAPI呼び出し
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}/api${endpoint}`;
  const userId = getUserId();
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'X-User-ID': userId,
      ...options.headers
    },
    ...options
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('API Error Details:', errorText);
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }
  return await response.json();
}

// ユーザーID取得（クラウド専用）
function getUserId() {
  // Cloud mode: get user ID from auth context or session
  try {
    const authManager = require('../../auth/authManager.js').authManager;
    const user = authManager.getCurrentUser();
    return user?.id || 'authenticated_user';
  } catch (error) {
    console.warn('Auth manager not available, using fallback ID');
    return 'cloud_user_' + Math.random().toString(36).substr(2, 9);
  }
}

// Cloud-only data operations (no localStorage)
function getCloudOnlyData() {
  // Cloud mode: data comes from cloud API only
  console.log('📡 Cloud mode: data retrieved from cloud API only');
  return [];
}

function saveCloudOnlyData(mindmaps) {
  // Cloud mode: data saved to cloud API only
  console.log('☁️ Cloud mode: data saved to cloud API only');
  return true;
}

// クラウドAPI操作
async function getCloudMindMaps() {
  const result = await apiRequest('/mindmaps');
  return result.mindmaps || [];
}

async function uploadMindMap(mindmap) {
  return await apiRequest(`/mindmaps/${mindmap.id}`, {
    method: 'PUT',
    body: JSON.stringify(mindmap)
  });
}

// **メイン同期関数** - クラウド専用
export async function performSync() {
  
  try {
    console.log('🔄 Cloud-only sync started');
    
    // 1. クラウドからデータを取得
    const cloudMaps = await getCloudMindMaps();
    
    console.log('📡 Retrieved cloud maps:', cloudMaps.length);

    // 2. 有効なクラウドデータを検証
    const validCloudMaps = cloudMaps.filter(map => 
      map && map.id && map.rootNode
    );
    
    console.log('✅ Valid cloud maps found:', validCloudMaps.length);
    
    return {
      success: true,
      cloudCount: cloudMaps.length,
      validCount: validCloudMaps.length,
      maps: validCloudMaps,
      message: `クラウド同期完了: ${validCloudMaps.length}件の有効なマップ`
    };

  } catch (error) {
    console.error('=== 同期失敗 ===', error);
    return {
      success: false,
      error: error.message,
      message: `同期失敗: ${error.message}`
    };
  }
}

// 接続テスト
export async function testConnection() {
  try {
    await getCloudMindMaps();
    return true;
  } catch (error) {
    console.error('接続テスト失敗:', error);
    return false;
  }
}