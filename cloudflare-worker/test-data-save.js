// D1データベースへの保存テスト

const API_BASE = 'https://mindflow-api-production.shigekazukoya.workers.dev';

const testMindMapData = {
  id: 'test-mindmap-001',
  title: 'テストマインドマップ',
  rootNode: {
    id: 'root',
    text: 'テストルートノード',
    x: 400,
    y: 300,
    children: [
      {
        id: 'child1',
        text: 'テスト子ノード1',
        x: 300,
        y: 200,
        children: []
      },
      {
        id: 'child2',
        text: 'テスト子ノード2',
        x: 500,
        y: 200,
        children: []
      }
    ]
  },
  settings: {
    autoSave: true,
    autoLayout: true
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

async function testDataSave() {
  try {
    console.log('マインドマップデータ作成テスト開始...');
    
    // 認証なしでのテスト（X-User-IDヘッダー使用）
    const response = await fetch(`${API_BASE}/api/mindmaps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': 'test-user-manual'
      },
      body: JSON.stringify(testMindMapData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ データ保存成功:', result);
    } else {
      console.log('❌ データ保存失敗:', result);
    }
    
    return result;
  } catch (error) {
    console.error('❌ テストエラー:', error);
    return null;
  }
}

async function testDataFetch() {
  try {
    console.log('\nマインドマップデータ取得テスト開始...');
    
    const response = await fetch(`${API_BASE}/api/mindmaps`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': 'test-user-manual'
      }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ データ取得成功:', result);
      console.log(`データ件数: ${result.mindmaps ? result.mindmaps.length : 0}`);
    } else {
      console.log('❌ データ取得失敗:', result);
    }
    
    return result;
  } catch (error) {
    console.error('❌ テストエラー:', error);
    return null;
  }
}

// テスト実行
async function runTests() {
  console.log('=== MindFlow API テスト ===\n');
  
  // データ保存テスト
  await testDataSave();
  
  // 少し待ってからデータ取得テスト
  await new Promise(resolve => setTimeout(resolve, 1000));
  await testDataFetch();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testDataSave, testDataFetch, runTests };
} else {
  runTests();
}