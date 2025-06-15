// API接続テスト用スクリプト

async function testAPI() {
  try {
    console.log('🚀 Testing Cloudflare Workers API...');
    
    // 1. マインドマップ一覧取得テスト
    console.log('\n1. Testing GET /api/mindmaps');
    const response1 = await fetch('http://localhost:8787/api/mindmaps', {
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': 'test-user'
      }
    });
    
    const data1 = await response1.json();
    console.log('Response:', JSON.stringify(data1, null, 2));
    
    // 2. マインドマップ作成テスト
    console.log('\n2. Testing POST /api/mindmaps');
    const testMindMap = {
      id: 'test-map-' + Date.now(),
      title: 'テストマインドマップ',
      rootNode: {
        id: 'root',
        text: 'ルートノード',
        x: 400,
        y: 300,
        children: [
          {
            id: 'child1',
            text: '子ノード1',
            x: 200,
            y: 200,
            children: []
          }
        ]
      },
      settings: {
        autoSave: true,
        autoLayout: true
      }
    };
    
    const response2 = await fetch('http://localhost:8787/api/mindmaps', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': 'test-user'
      },
      body: JSON.stringify(testMindMap)
    });
    
    const data2 = await response2.json();
    console.log('Response:', JSON.stringify(data2, null, 2));
    
    // 3. 作成されたマインドマップの取得テスト
    if (data2.id) {
      console.log('\n3. Testing GET /api/mindmaps/' + data2.id);
      const response3 = await fetch(`http://localhost:8787/api/mindmaps/${data2.id}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'test-user'
        }
      });
      
      const data3 = await response3.json();
      console.log('Response:', JSON.stringify(data3, null, 2));
    }
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// テスト実行
testAPI();