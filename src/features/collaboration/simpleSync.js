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

// ユーザーID取得
function getUserId() {
  let userId = localStorage.getItem('mindflow_user_id');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('mindflow_user_id', userId);
  }
  return userId;
}

// ローカルストレージ操作
function getLocalMindMaps() {
  try {
    const data = localStorage.getItem('mindmaps');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load local mindmaps:', error);
    return [];
  }
}

function saveLocalMindMaps(mindmaps) {
  try {
    localStorage.setItem('mindmaps', JSON.stringify(mindmaps));
    return true;
  } catch (error) {
    console.error('Failed to save local mindmaps:', error);
    return false;
  }
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

// **メイン同期関数**
export async function performSync() {
  
  try {
    // 1. ローカルデータを取得
    const localMaps = getLocalMindMaps().filter(map => 
      map && map.id && map.rootNode
    );

    // 2. ローカルマップをクラウドに送信
    const uploadResults = [];
    for (const map of localMaps) {
      try {
        const result = await uploadMindMap(map);
        uploadResults.push({ success: true, id: map.id, result });
      } catch (error) {
        console.error('アップロード失敗:', map.id, error);
        uploadResults.push({ success: false, id: map.id, error: error.message });
      }
    }

    // 3. クラウドからデータを取得
    const cloudMaps = await getCloudMindMaps();

    // 4. 有効なクラウドデータをローカルに保存
    const validCloudMaps = cloudMaps.filter(map => 
      map && map.id && map.rootNode
    );
    
    if (validCloudMaps.length > 0) {
      saveLocalMindMaps(validCloudMaps);
    }
    return {
      success: true,
      localCount: localMaps.length,
      cloudCount: cloudMaps.length,
      uploadResults,
      message: `同期完了: ローカル${localMaps.length}件 → クラウド${cloudMaps.length}件`
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