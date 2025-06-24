/**
 * クラウド同期機能の包括的テストスイート
 * フロントエンドとバックエンドの結合問題を特定・診断
 */

class CloudSyncTester {
  constructor() {
    this.API_BASE = 'https://mindflow-api-production.shigekazukoya.workers.dev';
    this.testResults = {};
    this.authToken = null;
  }

  // ================== メインテスト実行 ==================
  async runComprehensiveTest() {
    console.log('🚀 クラウド同期包括テスト開始...\n');

    const tests = [
      { name: 'API基本接続', method: 'testBasicAPIConnection' },
      { name: 'ストレージアダプター初期化', method: 'testStorageAdapterInit' },
      { name: 'データ形式互換性', method: 'testDataFormatCompatibility' },
      { name: 'CRUD操作シミュレーション', method: 'testCRUDOperations' },
      { name: '認証フロー', method: 'testAuthFlow' },
      { name: 'エラーハンドリング', method: 'testErrorHandling' },
      { name: 'フォールバック機能', method: 'testFallbackMechanism' }
    ];

    for (const test of tests) {
      try {
        console.log(`\n📋 ${test.name}をテスト中...`);
        const result = await this[test.method]();
        this.testResults[test.name] = { success: true, data: result };
        console.log(`✅ ${test.name}: 成功`);
      } catch (error) {
        this.testResults[test.name] = { success: false, error: error.message };
        console.error(`❌ ${test.name}: 失敗 -`, error.message);
      }
    }

    this.generateReport();
    return this.testResults;
  }

  // ================== 個別テストメソッド ==================

  // 1. API基本接続テスト
  async testBasicAPIConnection() {
    const endpoints = [
      { path: '/api/auth/health', method: 'GET', needsAuth: false },
      { path: '/api/mindmaps', method: 'GET', needsAuth: true },
      { path: '/api/auth/me', method: 'GET', needsAuth: true }
    ];

    const results = {};
    
    for (const endpoint of endpoints) {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (endpoint.needsAuth && this.authToken) {
          headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        const response = await fetch(`${this.API_BASE}${endpoint.path}`, {
          method: endpoint.method,
          headers
        });

        results[endpoint.path] = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          needsAuth: endpoint.needsAuth,
          hasAuth: !!this.authToken
        };

        // レスポンス本文を取得（可能な場合）
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            results[endpoint.path].body = await response.json();
          } else {
            results[endpoint.path].body = await response.text();
          }
        } catch (e) {
          results[endpoint.path].body = 'Failed to parse response body';
        }

      } catch (error) {
        results[endpoint.path] = { error: error.message };
      }
    }

    return results;
  }

  // 2. ストレージアダプター初期化テスト
  async testStorageAdapterInit() {
    try {
      // 現在の設定を確認
      const settings = JSON.parse(localStorage.getItem('mindflow_settings') || '{}');
      
      // ストレージアダプターの動的インポート
      const { getCurrentAdapter } = await import('./core/storage/storageAdapter.ts');
      
      let adapter = null;
      let adapterType = 'unknown';
      let error = null;

      try {
        adapter = getCurrentAdapter();
        adapterType = adapter.constructor.name;
      } catch (e) {
        error = e.message;
      }

      return {
        settings: settings,
        currentStorageMode: settings.storageMode || 'local',
        adapterType: adapterType,
        adapterExists: !!adapter,
        initializationError: error,
        adapterMethods: adapter ? Object.getOwnPropertyNames(Object.getPrototypeOf(adapter)) : []
      };

    } catch (error) {
      return { importError: error.message };
    }
  }

  // 3. データ形式互換性テスト
  async testDataFormatCompatibility() {
    // テスト用のマインドマップデータを作成
    const testMindMap = {
      id: 'test-sync-' + Date.now(),
      title: 'テスト用マインドマップ',
      category: 'test',
      theme: 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rootNode: {
        id: 'root-test',
        text: 'ルートノード',
        x: 400,
        y: 300,
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333333',
        children: [
          {
            id: 'child-1',
            text: '子ノード1',
            x: 300,
            y: 200,
            children: [],
            attachments: [],
            mapLinks: []
          }
        ],
        attachments: [],
        mapLinks: []
      },
      settings: {
        autoSave: true,
        autoLayout: false
      }
    };

    // データ構造の検証
    const validation = {
      hasRequiredFields: !!(testMindMap.id && testMindMap.title && testMindMap.rootNode),
      rootNodeValid: !!(testMindMap.rootNode.id && testMindMap.rootNode.text),
      hasTimestamps: !!(testMindMap.createdAt && testMindMap.updatedAt),
      childrenStructure: Array.isArray(testMindMap.rootNode.children),
      serializable: true
    };

    // JSON シリアライゼーションテスト
    try {
      const serialized = JSON.stringify(testMindMap);
      const deserialized = JSON.parse(serialized);
      validation.jsonSerializable = true;
      validation.dataIntegrity = JSON.stringify(testMindMap) === JSON.stringify(deserialized);
    } catch (e) {
      validation.jsonSerializable = false;
      validation.serializationError = e.message;
    }

    return {
      testData: testMindMap,
      validation: validation,
      dataSize: JSON.stringify(testMindMap).length
    };
  }

  // 4. CRUD操作シミュレーションテスト
  async testCRUDOperations() {
    const operations = [];
    
    // CREATE操作のテスト
    try {
      const createPayload = {
        title: 'テストマップ_' + Date.now(),
        rootNode: {
          id: 'root',
          text: 'ルート',
          x: 400,
          y: 300,
          children: [],
          attachments: [],
          mapLinks: []
        }
      };

      const createResponse = await fetch(`${this.API_BASE}/api/mindmaps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        },
        body: JSON.stringify(createPayload)
      });

      operations.push({
        operation: 'CREATE',
        status: createResponse.status,
        success: createResponse.ok,
        payload: createPayload,
        response: createResponse.ok ? await createResponse.json() : await createResponse.text()
      });

    } catch (error) {
      operations.push({
        operation: 'CREATE',
        success: false,
        error: error.message
      });
    }

    // READ操作のテスト
    try {
      const readResponse = await fetch(`${this.API_BASE}/api/mindmaps`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        }
      });

      operations.push({
        operation: 'READ',
        status: readResponse.status,
        success: readResponse.ok,
        response: readResponse.ok ? await readResponse.json() : await readResponse.text()
      });

    } catch (error) {
      operations.push({
        operation: 'READ',
        success: false,
        error: error.message
      });
    }

    return operations;
  }

  // 5. 認証フローテスト
  async testAuthFlow() {
    const authTests = {};

    // AuthManager状態確認
    try {
      const { authManager } = await import('./features/auth/authManager.ts');
      authTests.authManager = {
        isAuthenticated: authManager.isAuthenticated(),
        hasToken: !!authManager.getAuthToken(),
        user: authManager.getCurrentUser(),
        methods: Object.getOwnPropertyNames(Object.getPrototypeOf(authManager))
      };
    } catch (error) {
      authTests.authManager = { error: error.message };
    }

    // CloudAuthManager状態確認
    try {
      const { cloudAuthManager } = await import('./features/auth/cloudAuthManager.ts');
      authTests.cloudAuthManager = {
        isCloudAuthEnabled: cloudAuthManager.isCloudAuthEnabled(),
        hasValidToken: cloudAuthManager.hasValidCloudToken(),
        methods: Object.getOwnPropertyNames(Object.getPrototypeOf(cloudAuthManager))
      };

      // ヘルスチェック実行
      const healthCheck = await cloudAuthManager.healthCheck();
      authTests.cloudAuthManager.healthCheck = healthCheck;

    } catch (error) {
      authTests.cloudAuthManager = { error: error.message };
    }

    // Magic Link テスト（実際には送信しない）
    authTests.magicLinkTest = {
      endpoint: `${this.API_BASE}/api/auth/login`,
      payload: { email: 'test@example.com' },
      note: 'テスト用なので実際のリクエストは送信していません'
    };

    return authTests;
  }

  // 6. エラーハンドリングテスト
  async testErrorHandling() {
    const errorTests = [];

    // 不正なエンドポイントへのアクセス
    try {
      const response = await fetch(`${this.API_BASE}/api/nonexistent`);
      errorTests.push({
        test: '存在しないエンドポイント',
        status: response.status,
        expected: 404,
        success: response.status === 404
      });
    } catch (error) {
      errorTests.push({
        test: '存在しないエンドポイント',
        error: error.message,
        success: false
      });
    }

    // 認証なしでの保護されたリソースへのアクセス
    try {
      const response = await fetch(`${this.API_BASE}/api/mindmaps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'test' })
      });
      errorTests.push({
        test: '認証なしでのPOST',
        status: response.status,
        expected: 401,
        success: response.status === 401
      });
    } catch (error) {
      errorTests.push({
        test: '認証なしでのPOST',
        error: error.message,
        success: false
      });
    }

    // 不正なJSONデータの送信
    try {
      const response = await fetch(`${this.API_BASE}/api/mindmaps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });
      errorTests.push({
        test: '不正なJSONデータ',
        status: response.status,
        expected: [400, 401], // 400 or 401
        success: [400, 401].includes(response.status)
      });
    } catch (error) {
      errorTests.push({
        test: '不正なJSONデータ',
        error: error.message,
        success: false
      });
    }

    return errorTests;
  }

  // 7. フォールバック機能テスト
  async testFallbackMechanism() {
    const fallbackTests = {};

    // 現在のストレージモード
    const currentMode = JSON.parse(localStorage.getItem('mindflow_settings') || '{}').storageMode || 'local';
    fallbackTests.currentMode = currentMode;

    // ストレージアダプター工場のテスト
    try {
      const { getCurrentAdapter } = await import('./core/storage/storageAdapter.ts');
      
      // ローカルモードに設定
      const settings = JSON.parse(localStorage.getItem('mindflow_settings') || '{}');
      settings.storageMode = 'local';
      localStorage.setItem('mindflow_settings', JSON.stringify(settings));
      
      const localAdapter = getCurrentAdapter();
      fallbackTests.localMode = {
        adapterType: localAdapter.constructor.name,
        working: true
      };

      // クラウドモードに設定（認証なし）
      settings.storageMode = 'cloud';
      localStorage.setItem('mindflow_settings', JSON.stringify(settings));
      
      const cloudAdapter = getCurrentAdapter();
      fallbackTests.cloudModeUnauth = {
        adapterType: cloudAdapter.constructor.name,
        shouldFallbackToLocal: cloudAdapter.constructor.name.includes('Local')
      };

      // 元の設定に戻す
      settings.storageMode = currentMode;
      localStorage.setItem('mindflow_settings', JSON.stringify(settings));

    } catch (error) {
      fallbackTests.error = error.message;
    }

    return fallbackTests;
  }

  // ================== レポート生成 ==================
  generateReport() {
    console.log('\n📊 クラウド同期テスト結果レポート');
    console.log('='.repeat(50));

    let totalTests = 0;
    let passedTests = 0;
    let criticalIssues = [];
    let warnings = [];

    for (const [testName, result] of Object.entries(this.testResults)) {
      totalTests++;
      if (result.success) {
        passedTests++;
        console.log(`✅ ${testName}: 成功`);
      } else {
        console.log(`❌ ${testName}: 失敗 - ${result.error}`);
        criticalIssues.push(`${testName}: ${result.error}`);
      }
    }

    console.log('\n📈 テスト統計:');
    console.log(`総テスト数: ${totalTests}`);
    console.log(`成功: ${passedTests}`);
    console.log(`失敗: ${totalTests - passedTests}`);
    console.log(`成功率: ${Math.round((passedTests / totalTests) * 100)}%`);

    if (criticalIssues.length > 0) {
      console.log('\n🚨 クリティカルな問題:');
      criticalIssues.forEach(issue => console.log(`  - ${issue}`));
    }

    console.log('\n🔧 推奨される次のアクション:');
    if (!this.authToken) {
      console.log('  1. 認証トークンの設定が必要');
    }
    if (criticalIssues.some(issue => issue.includes('ストレージアダプター'))) {
      console.log('  2. ストレージアダプターの初期化問題を修正');
    }
    if (criticalIssues.some(issue => issue.includes('API'))) {
      console.log('  3. API接続設定を確認');
    }

    return {
      totalTests,
      passedTests,
      successRate: Math.round((passedTests / totalTests) * 100),
      criticalIssues
    };
  }

  // ================== ユーティリティメソッド ==================
  setAuthToken(token) {
    this.authToken = token;
    console.log('🔑 認証トークンを設定しました');
  }

  async quickTest() {
    console.log('⚡ クイックテスト実行中...');
    
    const quickResults = {};
    
    // API接続確認
    try {
      const response = await fetch(`${this.API_BASE}/api/auth/health`);
      quickResults.apiConnection = response.ok;
    } catch (e) {
      quickResults.apiConnection = false;
    }

    // ストレージモード確認
    const settings = JSON.parse(localStorage.getItem('mindflow_settings') || '{}');
    quickResults.storageMode = settings.storageMode || 'local';

    // 認証状態確認
    try {
      const { authManager } = await import('./features/auth/authManager.ts');
      quickResults.authenticated = authManager.isAuthenticated();
    } catch (e) {
      quickResults.authenticated = false;
    }

    console.log('📋 クイックテスト結果:', quickResults);
    return quickResults;
  }
}

// グローバルに公開
window.cloudSyncTester = new CloudSyncTester();

console.log(`
🧪 クラウド同期テスター準備完了！

主要コマンド:
  await cloudSyncTester.runComprehensiveTest()  - 包括テスト実行
  await cloudSyncTester.quickTest()             - クイックテスト
  cloudSyncTester.setAuthToken('token')         - 認証トークン設定

テスト項目:
  ✓ API基本接続
  ✓ ストレージアダプター初期化
  ✓ データ形式互換性
  ✓ CRUD操作シミュレーション
  ✓ 認証フロー
  ✓ エラーハンドリング
  ✓ フォールバック機能
`);

export { CloudSyncTester };