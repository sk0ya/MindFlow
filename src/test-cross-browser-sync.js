/**
 * ブラウザ間同期テストケース
 * 2つのブラウザ間でデータが同期されるかを検証
 */

class CrossBrowserSyncTester {
  constructor() {
    this.results = {};
    this.testUserId = 'test@example.com';
  }

  async runCrossBrowserSyncTest() {
    console.log('🌐 ブラウザ間同期テスト開始...\n');
    console.log('📍 このテストは2つのブラウザウィンドウで実行してください');
    console.log('📍 両方のウィンドウで同じメールアドレスでログインしてください\n');

    const tests = [
      { name: '認証状態確認', method: 'testAuthenticationStatus' },
      { name: 'ストレージモード確認', method: 'testStorageMode' },
      { name: 'DB保存テスト', method: 'testDatabaseSave' },
      { name: 'DB読み込みテスト', method: 'testDatabaseLoad' },
      { name: 'リアルタイム同期テスト', method: 'testRealtimeSync' },
      { name: 'マップ作成・更新同期', method: 'testMapSyncOperations' },
      { name: 'ノード操作同期', method: 'testNodeSyncOperations' }
    ];

    for (const test of tests) {
      try {
        console.log(`\n📋 ${test.name}を実行中...`);
        const result = await this[test.method]();
        this.results[test.name] = { success: true, data: result };
        console.log(`✅ ${test.name}: 成功`);
      } catch (error) {
        this.results[test.name] = { success: false, error: error.message };
        console.error(`❌ ${test.name}: 失敗 -`, error.message);
      }
    }

    this.generateSyncReport();
    return this.results;
  }

  // 認証状態の確認
  async testAuthenticationStatus() {
    const { authManager } = await import('./features/auth/authManager.ts');
    const { cloudAuthManager } = await import('./features/auth/cloudAuthManager.ts');
    
    const authStatus = {
      isAuthenticated: authManager.isAuthenticated(),
      hasToken: !!authManager.getAuthToken(),
      user: authManager.getCurrentUser(),
      cloudAuthEnabled: cloudAuthManager.isCloudAuthEnabled(),
      cloudToken: cloudAuthManager.getCloudSyncToken()
    };

    console.log('🔐 認証状態:', authStatus);

    if (!authStatus.isAuthenticated) {
      throw new Error('認証されていません。クラウド同期には認証が必要です。');
    }

    return authStatus;
  }

  // ストレージモードの確認
  async testStorageMode() {
    const settings = JSON.parse(localStorage.getItem('mindflow_settings') || '{}');
    const storageMode = settings.storageMode || 'local';
    
    console.log('💾 現在のストレージモード:', storageMode);
    
    if (storageMode !== 'cloud') {
      throw new Error('ストレージモードがcloudではありません。同期にはクラウドモードが必要です。');
    }

    // アダプターの確認
    const { getCurrentAdapter } = await import('./core/storage/storageAdapter.ts');
    const adapter = getCurrentAdapter();
    
    return {
      mode: storageMode,
      adapterType: adapter.constructor.name,
      adapterName: adapter.name,
      isCloudAdapter: adapter.constructor.name.includes('Cloud')
    };
  }

  // DB保存のテスト
  async testDatabaseSave() {
    const { getCurrentAdapter } = await import('./core/storage/storageAdapter.ts');
    const adapter = getCurrentAdapter();
    
    // テスト用マップデータ
    const testMap = {
      id: `sync-test-${Date.now()}`,
      title: `同期テスト ${new Date().toLocaleTimeString()}`,
      category: 'test',
      theme: 'default',
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

    console.log('📤 DBに保存中:', testMap.title);
    
    try {
      // マップを作成
      const savedMap = await adapter.createMap(testMap);
      
      console.log('✅ DB保存成功:', savedMap);
      
      // 保存確認のため再度読み込み
      const loadedMap = await adapter.getMap(savedMap.id);
      
      return {
        saveSuccess: true,
        savedId: savedMap.id,
        loadSuccess: !!loadedMap,
        dataIntegrity: loadedMap?.title === testMap.title
      };
    } catch (error) {
      console.error('❌ DB保存エラー:', error);
      throw error;
    }
  }

  // DB読み込みのテスト
  async testDatabaseLoad() {
    const { getCurrentAdapter } = await import('./core/storage/storageAdapter.ts');
    const adapter = getCurrentAdapter();
    
    console.log('📥 DBからマップ一覧を読み込み中...');
    
    try {
      const maps = await adapter.getAllMaps();
      
      console.log(`✅ ${maps.length}個のマップを読み込みました`);
      
      // 最新のマップ情報を表示
      if (maps.length > 0) {
        const latestMaps = maps.slice(-3).reverse();
        console.log('最新のマップ:');
        latestMaps.forEach(map => {
          console.log(`  - ${map.title} (ID: ${map.id}, 更新: ${new Date(map.updatedAt).toLocaleString()})`);
        });
      }
      
      return {
        mapCount: maps.length,
        maps: maps.slice(-5) // 最新5件
      };
    } catch (error) {
      console.error('❌ DB読み込みエラー:', error);
      throw error;
    }
  }

  // リアルタイム同期のテスト
  async testRealtimeSync() {
    console.log('🔄 リアルタイム同期機能を確認中...');
    
    // 現在の実装を確認
    const checks = {
      hasWebSocket: false,
      hasPolling: false,
      hasSyncAdapter: false,
      syncMechanism: 'none'
    };

    // CloudSyncAdapterの存在確認
    try {
      const { cloudSyncAdapter } = await import('./core/storage/cloudSyncAdapter.ts');
      if (cloudSyncAdapter) {
        checks.hasSyncAdapter = true;
        const stats = cloudSyncAdapter.getStats();
        checks.syncAdapterStats = stats;
      }
    } catch (error) {
      console.log('CloudSyncAdapterは使用されていません');
    }

    // 現在のアダプターの同期機能確認
    const { getCurrentAdapter } = await import('./core/storage/storageAdapter.ts');
    const adapter = getCurrentAdapter();
    
    if (adapter.useSyncAdapter) {
      checks.syncMechanism = 'CloudSyncAdapter';
    } else {
      checks.syncMechanism = 'Manual refresh required';
    }

    console.log('同期メカニズム:', checks);
    
    return checks;
  }

  // マップの作成・更新同期テスト
  async testMapSyncOperations() {
    console.log('🗺️ マップ同期操作テスト...');
    console.log('⚠️ 別のブラウザでこのテストの結果を確認してください');
    
    const { getCurrentAdapter } = await import('./core/storage/storageAdapter.ts');
    const adapter = getCurrentAdapter();
    
    const timestamp = Date.now();
    const operations = [];
    
    // 1. 新しいマップを作成
    const newMap = {
      id: `browser-sync-${timestamp}`,
      title: `ブラウザ同期テスト ${new Date().toLocaleTimeString()}`,
      category: 'sync-test',
      theme: 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rootNode: {
        id: 'root',
        text: 'このマップは別のブラウザで見えるはずです',
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
      const created = await adapter.createMap(newMap);
      operations.push({
        operation: 'create',
        success: true,
        mapId: created.id,
        title: created.title
      });
      console.log('✅ マップ作成完了:', created.title);
      
      // 2. マップを更新
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
      
      const updatedData = {
        ...created,
        title: `${created.title} (更新済み)`,
        updatedAt: new Date().toISOString()
      };
      
      const updated = await adapter.updateMap(created.id, updatedData);
      operations.push({
        operation: 'update',
        success: true,
        mapId: updated.id,
        title: updated.title
      });
      console.log('✅ マップ更新完了:', updated.title);
      
    } catch (error) {
      operations.push({
        operation: 'error',
        success: false,
        error: error.message
      });
      console.error('❌ 操作エラー:', error);
    }
    
    return {
      operations,
      instruction: '別のブラウザでgetAllMaps()を実行して、このマップが表示されるか確認してください'
    };
  }

  // ノード操作の同期テスト
  async testNodeSyncOperations() {
    console.log('🔲 ノード同期操作テスト...');
    
    const { getCurrentAdapter } = await import('./core/storage/storageAdapter.ts');
    const adapter = getCurrentAdapter();
    
    // 最新のマップを取得
    const maps = await adapter.getAllMaps();
    const testMap = maps.find(m => m.category === 'sync-test') || maps[0];
    
    if (!testMap) {
      throw new Error('テスト用のマップが見つかりません');
    }
    
    console.log(`📍 マップ「${testMap.title}」でノード操作をテスト`);
    
    const nodeOperations = [];
    
    try {
      // ノードを追加
      const newNode = {
        id: `node-${Date.now()}`,
        text: `同期テストノード ${new Date().toLocaleTimeString()}`,
        x: 500,
        y: 200,
        children: [],
        attachments: [],
        mapLinks: []
      };
      
      const addResult = await adapter.addNode(testMap.id, newNode, 'root');
      nodeOperations.push({
        operation: 'addNode',
        success: addResult.success,
        nodeId: addResult.newId || newNode.id
      });
      console.log('✅ ノード追加完了');
      
      // ノードを更新
      if (addResult.success) {
        const updateResult = await adapter.updateNode(
          testMap.id, 
          addResult.newId || newNode.id, 
          { text: `${newNode.text} (更新済み)` }
        );
        nodeOperations.push({
          operation: 'updateNode',
          success: updateResult.success
        });
        console.log('✅ ノード更新完了');
      }
      
    } catch (error) {
      nodeOperations.push({
        operation: 'error',
        success: false,
        error: error.message
      });
      console.error('❌ ノード操作エラー:', error);
    }
    
    return {
      mapId: testMap.id,
      mapTitle: testMap.title,
      operations: nodeOperations
    };
  }

  // 同期レポート生成
  generateSyncReport() {
    console.log('\n📊 ブラウザ間同期テスト結果');
    console.log('='.repeat(60));
    
    const issues = [];
    const recommendations = [];
    
    // 認証チェック
    if (!this.results['認証状態確認']?.success) {
      issues.push('認証が必要です');
    }
    
    // ストレージモードチェック
    if (!this.results['ストレージモード確認']?.success) {
      issues.push('クラウドモードが有効ではありません');
    }
    
    // DB保存チェック
    if (this.results['DB保存テスト']?.success) {
      console.log('✅ DBへの保存は正常に動作しています');
    } else {
      issues.push('DBへの保存に問題があります');
    }
    
    // リアルタイム同期チェック
    const syncData = this.results['リアルタイム同期テスト']?.data;
    if (syncData && syncData.syncMechanism === 'Manual refresh required') {
      issues.push('リアルタイム同期が実装されていません');
      recommendations.push('手動でページをリロードするか、定期的にgetAllMaps()を呼び出す必要があります');
    }
    
    console.log('\n🚨 発見された問題:');
    if (issues.length === 0) {
      console.log('  ✅ 問題は検出されませんでした');
    } else {
      issues.forEach(issue => console.log(`  ❌ ${issue}`));
    }
    
    console.log('\n💡 推奨事項:');
    if (recommendations.length === 0) {
      console.log('  ✅ 追加の推奨事項はありません');
    } else {
      recommendations.forEach(rec => console.log(`  💡 ${rec}`));
    }
    
    console.log('\n🔧 同期を確認する方法:');
    console.log('  1. 両方のブラウザで同じメールアドレスでログイン');
    console.log('  2. 一方のブラウザでマップを作成・更新');
    console.log('  3. もう一方のブラウザで以下を実行:');
    console.log('     await crossBrowserSyncTester.refreshAndCheck()');
    console.log('  4. または手動でページをリロード');
    
    return {
      issues,
      recommendations,
      dbSaveWorks: this.results['DB保存テスト']?.success || false,
      realtimeSyncAvailable: syncData?.syncMechanism !== 'Manual refresh required'
    };
  }

  // 手動リフレッシュと確認
  async refreshAndCheck() {
    console.log('🔄 データをリフレッシュして確認中...');
    
    const { getCurrentAdapter } = await import('./core/storage/storageAdapter.ts');
    const adapter = getCurrentAdapter();
    
    try {
      const maps = await adapter.getAllMaps();
      
      console.log(`📊 ${maps.length}個のマップが見つかりました`);
      
      // sync-testカテゴリのマップを探す
      const syncTestMaps = maps.filter(m => m.category === 'sync-test' || m.title.includes('同期テスト'));
      
      if (syncTestMaps.length > 0) {
        console.log('\n🔍 同期テストマップ:');
        syncTestMaps.forEach(map => {
          console.log(`  ✅ ${map.title}`);
          console.log(`     ID: ${map.id}`);
          console.log(`     作成: ${new Date(map.createdAt).toLocaleString()}`);
          console.log(`     更新: ${new Date(map.updatedAt).toLocaleString()}`);
        });
        
        // 最新のマップの詳細を確認
        const latestMap = syncTestMaps[syncTestMaps.length - 1];
        const fullMap = await adapter.getMap(latestMap.id);
        
        if (fullMap.rootNode?.children?.length > 0) {
          console.log(`\n  📌 ノード数: ${fullMap.rootNode.children.length}`);
          fullMap.rootNode.children.forEach(child => {
            console.log(`     - ${child.text}`);
          });
        }
      } else {
        console.log('⚠️ 同期テストマップが見つかりません');
        console.log('別のブラウザでtestMapSyncOperations()を実行してください');
      }
      
      return {
        totalMaps: maps.length,
        syncTestMaps: syncTestMaps.length,
        latestUpdate: maps.length > 0 ? maps[maps.length - 1].updatedAt : null
      };
    } catch (error) {
      console.error('❌ リフレッシュエラー:', error);
      throw error;
    }
  }
}

// グローバルに公開
window.crossBrowserSyncTester = new CrossBrowserSyncTester();

console.log(`
🌐 ブラウザ間同期テスター準備完了！

使用方法:
1. 2つのブラウザウィンドウを開く
2. 両方で同じメールアドレスでログイン
3. 両方でクラウドモードを有効化
4. 一方のブラウザで実行:
   await crossBrowserSyncTester.runCrossBrowserSyncTest()
5. もう一方のブラウザで実行:
   await crossBrowserSyncTester.refreshAndCheck()

主要コマンド:
  await crossBrowserSyncTester.runCrossBrowserSyncTest() - 完全テスト
  await crossBrowserSyncTester.refreshAndCheck()         - データ確認
  await crossBrowserSyncTester.testDatabaseSave()        - DB保存テスト
  await crossBrowserSyncTester.testMapSyncOperations()   - マップ同期テスト
`);

export { CrossBrowserSyncTester };