/**
 * リアルタイム同期の問題診断と修正テスト
 * require is not defined エラーとストレージアダプター問題の解決
 */

class RealtimeSyncFixTester {
  constructor() {
    this.results = {};
  }

  async runRealtimeSyncFixTest() {
    console.log('🔧 リアルタイム同期修正テスト開始...\n');

    const tests = [
      { name: 'require エラーの確認', method: 'testRequireError' },
      { name: 'StorageAdapterFactory 修正確認', method: 'testStorageAdapterFactory' },
      { name: 'CloudStorageAdapter 初期化', method: 'testCloudStorageAdapterInit' },
      { name: 'リアルタイム同期動作確認', method: 'testRealtimeSyncOperation' },
      { name: 'ブラウザ間同期シミュレーション', method: 'testCrossBrowserSync' }
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

    this.generateFixReport();
    return this.results;
  }

  // 1. require エラーの確認
  async testRequireError() {
    console.log('🔍 require関数の使用をチェック中...');
    
    try {
      // StorageAdapterFactoryを呼び出してエラーが発生するかテスト
      const { StorageAdapterFactory } = await import('./core/storage/storageAdapter.ts');
      
      // クラウドモード設定
      localStorage.setItem('mindflow_settings', JSON.stringify({
        storageMode: 'cloud'
      }));
      
      // アダプター作成をテスト
      const adapter = StorageAdapterFactory.create();
      
      return {
        adapterCreated: !!adapter,
        adapterType: adapter.constructor.name,
        noRequireError: true,
        actualError: null
      };
    } catch (error) {
      return {
        adapterCreated: false,
        adapterType: null,
        noRequireError: false,
        actualError: error.message,
        isRequireError: error.message.includes('require is not defined')
      };
    }
  }

  // 2. StorageAdapterFactory の修正確認
  async testStorageAdapterFactory() {
    console.log('🏭 StorageAdapterFactory の動作をテスト中...');
    
    const { StorageAdapterFactory, getCurrentAdapter, reinitializeAdapter } = await import('./core/storage/storageAdapter.ts');
    const { authManager } = await import('./features/auth/authManager.ts');
    
    const tests = {};
    
    // 認証状態のテスト
    tests.authState = {
      isAuthenticated: authManager.isAuthenticated(),
      hasToken: !!authManager.getAuthToken()
    };
    
    // ローカルモードでのテスト
    localStorage.setItem('mindflow_settings', JSON.stringify({
      storageMode: 'local'
    }));
    
    const localAdapter = StorageAdapterFactory.create();
    tests.localMode = {
      created: !!localAdapter,
      type: localAdapter.constructor.name,
      isLocal: localAdapter.constructor.name.includes('Local')
    };
    
    // クラウドモードでのテスト
    localStorage.setItem('mindflow_settings', JSON.stringify({
      storageMode: 'cloud'
    }));
    
    const cloudAdapter = StorageAdapterFactory.create();
    tests.cloudMode = {
      created: !!cloudAdapter,
      type: cloudAdapter.constructor.name,
      isCloud: cloudAdapter.constructor.name.includes('Cloud'),
      fallbackToLocal: cloudAdapter.constructor.name.includes('Local')
    };
    
    // getCurrentAdapter のテスト
    const currentAdapter = getCurrentAdapter();
    tests.getCurrentAdapter = {
      works: !!currentAdapter,
      type: currentAdapter.constructor.name,
      isSameInstance: currentAdapter === getCurrentAdapter() // シングルトンかチェック
    };
    
    // reinitializeAdapter のテスト
    const newAdapter = reinitializeAdapter();
    tests.reinitialize = {
      works: !!newAdapter,
      type: newAdapter.constructor.name,
      isDifferentInstance: newAdapter !== currentAdapter
    };
    
    return tests;
  }

  // 3. CloudStorageAdapter 初期化テスト
  async testCloudStorageAdapterInit() {
    console.log('☁️ CloudStorageAdapter の初期化をテスト中...');
    
    const { CloudStorageAdapter } = await import('./core/storage/storageAdapter.ts');
    const { authManager } = await import('./features/auth/authManager.ts');
    
    const initResults = {};
    
    // 認証状態の確認
    initResults.authRequired = {
      isAuthenticated: authManager.isAuthenticated(),
      hasToken: !!authManager.getAuthToken()
    };
    
    if (!authManager.isAuthenticated()) {
      console.log('⚠️ 認証されていないため、CloudStorageAdapterのテストをスキップ');
      return {
        ...initResults,
        skipped: true,
        reason: 'Not authenticated'
      };
    }
    
    try {
      // CloudStorageAdapter を直接作成
      const adapter = new CloudStorageAdapter();
      
      initResults.directCreation = {
        success: true,
        name: adapter.name,
        useSyncAdapter: adapter.useSyncAdapter,
        hasApiCall: typeof adapter.apiCall === 'function'
      };
      
      // 初期化テスト
      await adapter.ensureInitialized();
      initResults.initialization = {
        success: true,
        isInitialized: adapter.isInitialized,
        baseUrl: adapter.baseUrl
      };
      
      // 簡単なAPI呼び出しテスト
      try {
        const maps = await adapter.getAllMaps();
        initResults.apiCall = {
          success: true,
          mapsCount: Array.isArray(maps) ? maps.length : 'not array'
        };
      } catch (apiError) {
        initResults.apiCall = {
          success: false,
          error: apiError.message
        };
      }
      
    } catch (error) {
      initResults.directCreation = {
        success: false,
        error: error.message
      };
    }
    
    return initResults;
  }

  // 4. リアルタイム同期の動作確認
  async testRealtimeSyncOperation() {
    console.log('🔄 リアルタイム同期の動作をテスト中...');
    
    const { realtimeSync } = await import('./core/sync/realtimeSync.ts');
    
    const syncTests = {};
    
    // 同期状態の確認
    const status = realtimeSync.getStatus();
    syncTests.status = {
      isEnabled: status.isEnabled,
      syncFrequency: status.syncFrequency,
      lastSyncTime: status.lastSyncTime,
      mapsInSnapshot: status.mapsInSnapshot
    };
    
    // イベントリスナーのテスト
    let eventReceived = false;
    const testListener = (event) => {
      eventReceived = true;
      console.log('🎉 テストイベント受信:', event.type);
    };
    
    const unsubscribe = realtimeSync.addEventListener('map_updated', testListener);
    syncTests.eventListener = {
      registered: typeof unsubscribe === 'function'
    };
    
    // 手動同期テスト
    try {
      await realtimeSync.syncNow();
      syncTests.manualSync = {
        success: true,
        error: null
      };
    } catch (error) {
      syncTests.manualSync = {
        success: false,
        error: error.message
      };
    }
    
    // 同期頻度変更テスト
    const originalFreq = realtimeSync.getStatus().syncFrequency;
    realtimeSync.setSyncFrequency(10000);
    const newFreq = realtimeSync.getStatus().syncFrequency;
    realtimeSync.setSyncFrequency(originalFreq); // 元に戻す
    
    syncTests.frequencyChange = {
      original: originalFreq,
      changed: newFreq,
      restored: realtimeSync.getStatus().syncFrequency === originalFreq
    };
    
    // クリーンアップ
    unsubscribe();
    
    return syncTests;
  }

  // 5. ブラウザ間同期のシミュレーション
  async testCrossBrowserSync() {
    console.log('🌐 ブラウザ間同期をシミュレーション中...');
    
    const { getCurrentAdapter } = await import('./core/storage/storageAdapter.ts');
    const { authManager } = await import('./features/auth/authManager.ts');
    
    if (!authManager.isAuthenticated()) {
      return {
        skipped: true,
        reason: 'Not authenticated'
      };
    }
    
    const adapter = getCurrentAdapter();
    const syncSimulation = {};
    
    // 現在のマップ一覧を取得
    try {
      const initialMaps = await adapter.getAllMaps();
      syncSimulation.initialState = {
        success: true,
        mapCount: initialMaps.length,
        mapTitles: initialMaps.slice(0, 3).map(m => m.title)
      };
      
      // テストマップを作成（他のブラウザからの変更をシミュレート）
      const testMap = {
        id: `browser-sync-test-${Date.now()}`,
        title: `同期テスト ${new Date().toLocaleTimeString()}`,
        category: 'realtime-test',
        theme: 'default',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rootNode: {
          id: 'root',
          text: 'リアルタイム同期テスト',
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
      
      // マップを作成
      const createdMap = await adapter.createMap(testMap);
      syncSimulation.mapCreation = {
        success: true,
        mapId: createdMap.id,
        title: createdMap.title
      };
      
      // 作成後にマップ一覧を再取得
      const updatedMaps = await adapter.getAllMaps();
      syncSimulation.afterCreation = {
        success: true,
        mapCount: updatedMaps.length,
        increased: updatedMaps.length > initialMaps.length
      };
      
      // 5秒待機してリアルタイム同期をテスト
      console.log('⏱️ 5秒間待機してリアルタイム同期をテスト...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 再度マップ一覧を取得
      const finalMaps = await adapter.getAllMaps();
      syncSimulation.afterDelay = {
        success: true,
        mapCount: finalMaps.length,
        containsTestMap: finalMaps.some(m => m.id === createdMap.id)
      };
      
    } catch (error) {
      syncSimulation.error = {
        message: error.message,
        step: 'map_operations'
      };
    }
    
    return syncSimulation;
  }

  // 修正レポート生成
  generateFixReport() {
    console.log('\n🔧 リアルタイム同期修正レポート');
    console.log('='.repeat(60));
    
    const criticalIssues = [];
    const fixedIssues = [];
    const remainingIssues = [];
    
    // require エラーの確認
    const requireTest = this.results['require エラーの確認'];
    if (requireTest?.success) {
      if (requireTest.data.noRequireError) {
        fixedIssues.push('require is not defined エラーが修正されました');
      } else if (requireTest.data.isRequireError) {
        criticalIssues.push('require is not defined エラーが残存しています');
      }
    }
    
    // StorageAdapterFactory の確認
    const factoryTest = this.results['StorageAdapterFactory 修正確認'];
    if (factoryTest?.success) {
      if (factoryTest.data.cloudMode?.fallbackToLocal) {
        remainingIssues.push('クラウドモードでもローカルアダプターにフォールバック');
      } else if (factoryTest.data.cloudMode?.isCloud) {
        fixedIssues.push('CloudStorageAdapter が正常に作成されています');
      }
    }
    
    // CloudStorageAdapter 初期化の確認
    const initTest = this.results['CloudStorageAdapter 初期化'];
    if (initTest?.success && !initTest.data.skipped) {
      if (initTest.data.initialization?.success) {
        fixedIssues.push('CloudStorageAdapter の初期化が成功しています');
      } else {
        remainingIssues.push('CloudStorageAdapter の初期化に問題があります');
      }
    }
    
    // リアルタイム同期の確認
    const syncTest = this.results['リアルタイム同期動作確認'];
    if (syncTest?.success) {
      if (syncTest.data.manualSync?.success) {
        fixedIssues.push('リアルタイム同期の手動実行が成功しています');
      } else {
        remainingIssues.push('リアルタイム同期の手動実行に問題があります');
      }
    }
    
    // レポート出力
    console.log('\n✅ 修正された問題:');
    if (fixedIssues.length === 0) {
      console.log('  (修正された問題なし)');
    } else {
      fixedIssues.forEach(issue => console.log(`  ✅ ${issue}`));
    }
    
    console.log('\n🚨 重要な残存問題:');
    if (criticalIssues.length === 0) {
      console.log('  ✅ 重要な問題はありません');
    } else {
      criticalIssues.forEach(issue => console.log(`  ❌ ${issue}`));
    }
    
    console.log('\n⚠️ 軽微な残存問題:');
    if (remainingIssues.length === 0) {
      console.log('  ✅ 軽微な問題はありません');
    } else {
      remainingIssues.forEach(issue => console.log(`  ⚠️ ${issue}`));
    }
    
    // 次のステップ
    console.log('\n🔧 推奨される次のアクション:');
    if (criticalIssues.length > 0) {
      console.log('  1. require is not defined エラーの完全修正');
      console.log('  2. ESモジュール環境でのimport文の使用');
    }
    if (remainingIssues.some(issue => issue.includes('フォールバック'))) {
      console.log('  3. 認証状態の確認とクラウドアダプター作成の修正');
    }
    console.log('  4. 両方のブラウザでこのテストを実行して結果を比較');
    
    // ブラウザ間同期の確認方法
    console.log('\n🌐 ブラウザ間同期の確認方法:');
    console.log('  1. このテストを2つのブラウザで実行');
    console.log('  2. 片方で testCrossBrowserSync() を実行');
    console.log('  3. もう片方で5秒後にマップ一覧を確認');
    console.log('  4. 新しいテストマップが表示されれば同期成功');
    
    return {
      fixedIssues,
      criticalIssues,
      remainingIssues,
      totalTests: Object.keys(this.results).length,
      passedTests: Object.values(this.results).filter(r => r.success).length
    };
  }
}

// グローバルに公開
window.realtimeSyncFixTester = new RealtimeSyncFixTester();

console.log(`
🔧 リアルタイム同期修正テスター準備完了！

主要コマンド:
  await realtimeSyncFixTester.runRealtimeSyncFixTest()

個別テスト:
  await realtimeSyncFixTester.testRequireError()
  await realtimeSyncFixTester.testStorageAdapterFactory()
  await realtimeSyncFixTester.testCloudStorageAdapterInit()
  await realtimeSyncFixTester.testRealtimeSyncOperation()
  await realtimeSyncFixTester.testCrossBrowserSync()

このテストで確認される項目:
  ✓ require is not defined エラーの修正確認
  ✓ StorageAdapterFactory の動作確認
  ✓ CloudStorageAdapter の初期化
  ✓ リアルタイム同期の動作
  ✓ ブラウザ間同期のシミュレーション
`);

export { RealtimeSyncFixTester };