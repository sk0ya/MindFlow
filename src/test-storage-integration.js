/**
 * ストレージ統合テスト
 * フロントエンドストレージアダプターとバックエンドAPIの結合を詳細テスト
 */

class StorageIntegrationTester {
  constructor() {
    this.results = {};
  }

  async runStorageIntegrationTest() {
    console.log('🔍 ストレージ統合テスト開始...\n');

    const tests = [
      { name: 'ストレージルーター動作確認', method: 'testStorageRouter' },
      { name: 'ローカルストレージアダプター', method: 'testLocalStorageAdapter' },
      { name: 'クラウドストレージアダプター', method: 'testCloudStorageAdapter' },
      { name: 'データ保存・読み込みフロー', method: 'testDataSaveLoadFlow' },
      { name: 'エラー時のフォールバック', method: 'testErrorFallback' },
      { name: 'アダプター切り替え', method: 'testAdapterSwitching' }
    ];

    for (const test of tests) {
      try {
        console.log(`\n📋 ${test.name}をテスト中...`);
        const result = await this[test.method]();
        this.results[test.name] = { success: true, data: result };
        console.log(`✅ ${test.name}: 成功`);
      } catch (error) {
        this.results[test.name] = { success: false, error: error.message };
        console.error(`❌ ${test.name}: 失敗 -`, error.message);
      }
    }

    this.generateStorageReport();
    return this.results;
  }

  // 1. ストレージルーター動作確認
  async testStorageRouter() {
    const routerTests = {};

    try {
      // ストレージルーターのインポート
      const storageRouter = await import('./core/storage/storageRouter.ts');
      
      routerTests.importSuccess = true;
      routerTests.availableMethods = Object.keys(storageRouter);
      
      // 各メソッドの存在確認
      const expectedMethods = [
        'getCurrentMindMap',
        'getAllMindMaps', 
        'saveMindMap',
        'createNewMindMap',
        'deleteMindMap'
      ];
      
      routerTests.methodCheck = {};
      for (const method of expectedMethods) {
        routerTests.methodCheck[method] = typeof storageRouter[method] === 'function';
      }

      // 設定によるルーティング確認
      const settings = JSON.parse(localStorage.getItem('mindflow_settings') || '{}');
      routerTests.currentMode = settings.storageMode || 'local';
      
      // isCloudStorageEnabled関数のテスト
      if (storageRouter.isCloudStorageEnabled) {
        routerTests.cloudEnabled = storageRouter.isCloudStorageEnabled();
      }

    } catch (error) {
      routerTests.importError = error.message;
    }

    return routerTests;
  }

  // 2. ローカルストレージアダプター
  async testLocalStorageAdapter() {
    const localTests = {};

    try {
      // 設定を一時的にローカルモードに変更
      const originalSettings = JSON.parse(localStorage.getItem('mindflow_settings') || '{}');
      const testSettings = { ...originalSettings, storageMode: 'local' };
      localStorage.setItem('mindflow_settings', JSON.stringify(testSettings));

      // アダプターの取得
      const { getCurrentAdapter } = await import('./core/storage/storageAdapter.ts');
      const adapter = getCurrentAdapter();

      localTests.adapterType = adapter.constructor.name;
      localTests.isLocalAdapter = adapter.constructor.name.includes('Local');
      
      // アダプターのメソッド確認
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(adapter));
      localTests.availableMethods = methods;
      localTests.hasCRUDMethods = [
        'getAllMindMaps',
        'getMindMap', 
        'saveMindMap',
        'deleteMindMap'
      ].every(method => methods.includes(method));

      // テストデータでの操作
      if (typeof adapter.getAllMindMaps === 'function') {
        try {
          const maps = await adapter.getAllMindMaps();
          localTests.getAllMindMaps = {
            success: true,
            count: Array.isArray(maps) ? maps.length : 'not array',
            data: Array.isArray(maps) ? maps.slice(0, 2) : maps // 最初の2件だけ
          };
        } catch (error) {
          localTests.getAllMindMaps = { success: false, error: error.message };
        }
      }

      // 設定を元に戻す
      localStorage.setItem('mindflow_settings', JSON.stringify(originalSettings));

    } catch (error) {
      localTests.error = error.message;
    }

    return localTests;
  }

  // 3. クラウドストレージアダプター
  async testCloudStorageAdapter() {
    const cloudTests = {};

    try {
      // 設定を一時的にクラウドモードに変更
      const originalSettings = JSON.parse(localStorage.getItem('mindflow_settings') || '{}');
      const testSettings = { ...originalSettings, storageMode: 'cloud' };
      localStorage.setItem('mindflow_settings', JSON.stringify(testSettings));

      // アダプターの取得
      const { getCurrentAdapter } = await import('./core/storage/storageAdapter.ts');
      const adapter = getCurrentAdapter();

      cloudTests.adapterType = adapter.constructor.name;
      cloudTests.isCloudAdapter = adapter.constructor.name.includes('Cloud');
      
      // アダプターのメソッド確認
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(adapter));
      cloudTests.availableMethods = methods;
      
      // 初期化状態の確認
      if (typeof adapter.ensureInitialized === 'function') {
        try {
          await adapter.ensureInitialized();
          cloudTests.initialization = { success: true };
        } catch (error) {
          cloudTests.initialization = { success: false, error: error.message };
        }
      }

      // 認証状態の確認
      const { authManager } = await import('./features/auth/authManager.ts');
      cloudTests.authState = {
        isAuthenticated: authManager.isAuthenticated(),
        hasToken: !!authManager.getAuthToken()
      };

      // API通信テスト（認証が必要）
      if (authManager.isAuthenticated()) {
        try {
          const maps = await adapter.getAllMindMaps();
          cloudTests.getAllMindMaps = {
            success: true,
            count: Array.isArray(maps) ? maps.length : 'not array',
            data: Array.isArray(maps) ? maps.slice(0, 2) : maps
          };
        } catch (error) {
          cloudTests.getAllMindMaps = { success: false, error: error.message };
        }
      } else {
        cloudTests.getAllMindMaps = { skipped: 'Not authenticated' };
      }

      // 設定を元に戻す
      localStorage.setItem('mindflow_settings', JSON.stringify(originalSettings));

    } catch (error) {
      cloudTests.error = error.message;
    }

    return cloudTests;
  }

  // 4. データ保存・読み込みフロー
  async testDataSaveLoadFlow() {
    const flowTests = {};

    // テストデータ作成
    const testData = {
      id: 'integration-test-' + Date.now(),
      title: 'ストレージ統合テスト',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rootNode: {
        id: 'root',
        text: 'テストルート',
        x: 400,
        y: 300,
        children: [],
        attachments: [],
        mapLinks: []
      },
      settings: {
        autoSave: true,
        autoLayout: false
      }
    };

    try {
      // 現在のアダプターで保存テスト
      const { getCurrentAdapter } = await import('./core/storage/storageAdapter.ts');
      const adapter = getCurrentAdapter();

      flowTests.adapterType = adapter.constructor.name;

      // 保存操作
      if (typeof adapter.saveMindMap === 'function') {
        try {
          const saveResult = await adapter.saveMindMap(testData);
          flowTests.save = {
            success: true,
            result: saveResult
          };

          // 保存後の読み込みテスト
          if (typeof adapter.getMindMap === 'function') {
            try {
              const loadedData = await adapter.getMindMap(testData.id);
              flowTests.load = {
                success: true,
                dataIntegrity: loadedData && loadedData.id === testData.id,
                data: loadedData
              };
            } catch (error) {
              flowTests.load = { success: false, error: error.message };
            }
          }

          // 削除テスト
          if (typeof adapter.deleteMindMap === 'function') {
            try {
              const deleteResult = await adapter.deleteMindMap(testData.id);
              flowTests.delete = {
                success: true,
                result: deleteResult
              };
            } catch (error) {
              flowTests.delete = { success: false, error: error.message };
            }
          }

        } catch (error) {
          flowTests.save = { success: false, error: error.message };
        }
      } else {
        flowTests.save = { skipped: 'saveMindMap method not available' };
      }

    } catch (error) {
      flowTests.error = error.message;
    }

    return flowTests;
  }

  // 5. エラー時のフォールバック
  async testErrorFallback() {
    const fallbackTests = {};

    try {
      // ネットワークエラーシミュレーション
      const originalFetch = window.fetch;
      
      // フェッチを一時的に無効化
      window.fetch = () => Promise.reject(new Error('Network error simulation'));

      // クラウドモードでエラーが発生した場合の動作確認
      const originalSettings = JSON.parse(localStorage.getItem('mindflow_settings') || '{}');
      const cloudSettings = { ...originalSettings, storageMode: 'cloud' };
      localStorage.setItem('mindflow_settings', JSON.stringify(cloudSettings));

      const { getCurrentAdapter } = await import('./core/storage/storageAdapter.ts');
      const adapter = getCurrentAdapter();

      fallbackTests.errorScenario = {
        settingsMode: 'cloud',
        adapterType: adapter.constructor.name,
        fallbackToLocal: adapter.constructor.name.includes('Local')
      };

      // フェッチを復元
      window.fetch = originalFetch;
      
      // 設定を元に戻す
      localStorage.setItem('mindflow_settings', JSON.stringify(originalSettings));

    } catch (error) {
      fallbackTests.error = error.message;
    }

    return fallbackTests;
  }

  // 6. アダプター切り替え
  async testAdapterSwitching() {
    const switchTests = {};

    try {
      const { getCurrentAdapter } = await import('./core/storage/storageAdapter.ts');
      const originalSettings = JSON.parse(localStorage.getItem('mindflow_settings') || '{}');

      // ローカルモード
      const localSettings = { ...originalSettings, storageMode: 'local' };
      localStorage.setItem('mindflow_settings', JSON.stringify(localSettings));
      const localAdapter = getCurrentAdapter();
      
      switchTests.local = {
        mode: 'local',
        adapterType: localAdapter.constructor.name
      };

      // クラウドモード
      const cloudSettings = { ...originalSettings, storageMode: 'cloud' };
      localStorage.setItem('mindflow_settings', JSON.stringify(cloudSettings));
      const cloudAdapter = getCurrentAdapter();
      
      switchTests.cloud = {
        mode: 'cloud',
        adapterType: cloudAdapter.constructor.name
      };

      // 切り替えが正しく動作するか
      switchTests.switchingWorks = localAdapter.constructor.name !== cloudAdapter.constructor.name;

      // 設定を元に戻す
      localStorage.setItem('mindflow_settings', JSON.stringify(originalSettings));

    } catch (error) {
      switchTests.error = error.message;
    }

    return switchTests;
  }

  generateStorageReport() {
    console.log('\n📊 ストレージ統合テスト結果レポート');
    console.log('='.repeat(60));

    let criticalIssues = [];
    let recommendations = [];

    for (const [testName, result] of Object.entries(this.results)) {
      if (result.success) {
        console.log(`✅ ${testName}: 正常動作`);
        
        // 特定の問題をチェック
        if (testName === 'クラウドストレージアダプター' && result.data.authState && !result.data.authState.isAuthenticated) {
          recommendations.push('クラウド機能を使用するには認証が必要です');
        }
        
        if (testName === 'アダプター切り替え' && result.data.switchingWorks === false) {
          criticalIssues.push('ストレージアダプターの切り替えが正しく動作していません');
        }
        
      } else {
        console.log(`❌ ${testName}: 失敗 - ${result.error}`);
        criticalIssues.push(`${testName}: ${result.error}`);
      }
    }

    console.log('\n🔍 診断結果:');
    
    if (criticalIssues.length === 0) {
      console.log('✅ ストレージシステムは基本的に正常に動作しています');
    } else {
      console.log('🚨 発見された問題:');
      criticalIssues.forEach(issue => console.log(`  - ${issue}`));
    }

    if (recommendations.length > 0) {
      console.log('\n💡 推奨事項:');
      recommendations.forEach(rec => console.log(`  - ${rec}`));
    }

    console.log('\n🔧 次のステップ:');
    console.log('  1. 認証フローの実装');
    console.log('  2. クラウドAPI通信の詳細テスト');
    console.log('  3. データ同期ロジックの確認');

    return {
      criticalIssues,
      recommendations,
      totalTests: Object.keys(this.results).length,
      passedTests: Object.values(this.results).filter(r => r.success).length
    };
  }
}

// グローバルに公開
window.storageIntegrationTester = new StorageIntegrationTester();

console.log(`
🔧 ストレージ統合テスター準備完了！

メインコマンド:
  await storageIntegrationTester.runStorageIntegrationTest()

このテストで確認される項目:
  ✓ ストレージルーター動作
  ✓ ローカル/クラウドアダプター
  ✓ データ保存・読み込みフロー
  ✓ エラー時のフォールバック
  ✓ アダプター切り替え機能
`);

export { StorageIntegrationTester };