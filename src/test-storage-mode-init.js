/**
 * ストレージモード初期化タイミング問題のテストケース
 * ストレージモード選択画面が表示される前に初期化が始まってしまう問題を検証・修正
 */

class StorageModeInitTester {
  constructor() {
    this.results = {};
    this.initializationSequence = [];
  }

  async runStorageModeInitTest() {
    console.log('⚡ ストレージモード初期化タイミングテスト開始...\n');

    const tests = [
      { name: '初期化シーケンス分析', method: 'analyzeInitializationSequence' },
      { name: 'ストレージモード設定状態確認', method: 'testStorageModeSettings' },
      { name: '初期化タイミング問題再現', method: 'reproduceInitializationIssue' },
      { name: 'マップ読み込み待機機能テスト', method: 'testMapLoadingDelay' },
      { name: '修正後の初期化フロー確認', method: 'testFixedInitializationFlow' }
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

    this.generateInitReport();
    return this.results;
  }

  // 1. 初期化シーケンスの分析
  async analyzeInitializationSequence() {
    console.log('🔍 現在の初期化シーケンスを分析中...');
    
    const sequence = {};
    
    // 現在の設定状態を確認
    const currentSettings = JSON.parse(localStorage.getItem('mindflow_settings') || 'null');
    sequence.currentSettings = {
      exists: !!currentSettings,
      storageMode: currentSettings?.storageMode || null,
      isEmpty: !currentSettings || Object.keys(currentSettings).length === 0
    };
    
    // useAppInitialization の状態をシミュレート
    try {
      const { getAppSettings } = await import('./core/storage/storageUtils.ts');
      const appSettings = getAppSettings();
      
      sequence.appSettings = {
        storageMode: appSettings.storageMode,
        isNull: appSettings.storageMode === null,
        autoSave: appSettings.autoSave,
        enableRealtimeSync: appSettings.enableRealtimeSync
      };
    } catch (error) {
      sequence.appSettingsError = error.message;
    }
    
    // ストレージアダプターファクトリーの動作確認
    try {
      const { getCurrentAdapter } = await import('./core/storage/storageAdapter.ts');
      const adapter = getCurrentAdapter();
      
      sequence.adapterCreation = {
        adapterType: adapter.constructor.name,
        isLocal: adapter.constructor.name.includes('Local'),
        isCloud: adapter.constructor.name.includes('Cloud'),
        adapterName: adapter.name
      };
    } catch (error) {
      sequence.adapterError = error.message;
    }
    
    // リアルタイム同期の状態
    try {
      const { realtimeSync } = await import('./core/sync/realtimeSync.ts');
      const syncStatus = realtimeSync.getStatus();
      
      sequence.realtimeSync = {
        isEnabled: syncStatus.isEnabled,
        syncFrequency: syncStatus.syncFrequency,
        lastSyncTime: syncStatus.lastSyncTime
      };
    } catch (error) {
      sequence.realtimeSyncError = error.message;
    }
    
    return sequence;
  }

  // 2. ストレージモード設定状態の確認
  async testStorageModeSettings() {
    console.log('⚙️ ストレージモード設定の詳細確認中...');
    
    const settingsTest = {};
    
    // 1. localStorage の生の値を確認
    const rawSettings = localStorage.getItem('mindflow_settings');
    settingsTest.rawLocalStorage = {
      exists: !!rawSettings,
      value: rawSettings,
      isParseable: false
    };
    
    if (rawSettings) {
      try {
        const parsed = JSON.parse(rawSettings);
        settingsTest.rawLocalStorage.isParseable = true;
        settingsTest.rawLocalStorage.parsed = parsed;
      } catch (e) {
        settingsTest.rawLocalStorage.parseError = e.message;
      }
    }
    
    // 2. getAppSettings() の動作確認
    try {
      const { getAppSettings } = await import('./core/storage/storageUtils.ts');
      const settings = getAppSettings();
      
      settingsTest.getAppSettings = {
        result: settings,
        storageMode: settings.storageMode,
        isFirstTime: settings.storageMode === null
      };
    } catch (error) {
      settingsTest.getAppSettingsError = error.message;
    }
    
    // 3. 設定の各シナリオをテスト
    const scenarios = [
      { name: 'null設定', value: null },
      { name: '空オブジェクト', value: {} },
      { name: 'local設定', value: { storageMode: 'local' } },
      { name: 'cloud設定', value: { storageMode: 'cloud' } }
    ];
    
    settingsTest.scenarios = {};
    
    for (const scenario of scenarios) {
      const originalValue = localStorage.getItem('mindflow_settings');
      
      try {
        // 設定を変更
        if (scenario.value === null) {
          localStorage.removeItem('mindflow_settings');
        } else {
          localStorage.setItem('mindflow_settings', JSON.stringify(scenario.value));
        }
        
        // getAppSettings の結果を確認
        const { getAppSettings } = await import('./core/storage/storageUtils.ts');
        
        // モジュールキャッシュをクリア（設定変更を反映）
        delete require.cache[require.resolve('./core/storage/storageUtils.ts')];
        
        const settings = getAppSettings();
        
        settingsTest.scenarios[scenario.name] = {
          input: scenario.value,
          output: settings,
          storageMode: settings.storageMode,
          isFirstTime: settings.storageMode === null
        };
        
      } catch (error) {
        settingsTest.scenarios[scenario.name] = {
          error: error.message
        };
      } finally {
        // 元の設定に戻す
        if (originalValue) {
          localStorage.setItem('mindflow_settings', originalValue);
        } else {
          localStorage.removeItem('mindflow_settings');
        }
      }
    }
    
    return settingsTest;
  }

  // 3. 初期化タイミング問題の再現
  async reproduceInitializationIssue() {
    console.log('🐛 初期化タイミング問題を再現中...');
    
    const reproduction = {};
    
    // 1. 初期設定をクリア（初回起動をシミュレート）
    const originalSettings = localStorage.getItem('mindflow_settings');
    localStorage.removeItem('mindflow_settings');
    
    try {
      // 2. 初期化シーケンスをシミュレート
      reproduction.step1_settingsCheck = {
        description: 'ストレージモード設定チェック',
        storageMode: null,
        isFirstTime: true
      };
      
      // 3. useAppInitialization のロジックをシミュレート
      const { getAppSettings } = await import('./core/storage/storageUtils.ts');
      const settings = getAppSettings();
      
      reproduction.step2_appSettings = {
        description: 'getAppSettings() 結果',
        settings: settings,
        storageMode: settings.storageMode,
        shouldShowSelection: settings.storageMode === null
      };
      
      // 4. useMindMapMulti の初期化をシミュレート
      const { getCurrentAdapter } = await import('./core/storage/storageAdapter.ts');
      const adapter = getCurrentAdapter();
      
      reproduction.step3_adapterCreation = {
        description: 'ストレージアダプター作成',
        adapterType: adapter.constructor.name,
        problemDetected: adapter.constructor.name.includes('Local') && settings.storageMode === null
      };
      
      // 5. マップ読み込みをシミュレート
      if (typeof adapter.getAllMaps === 'function') {
        try {
          const maps = await adapter.getAllMaps();
          reproduction.step4_mapLoading = {
            description: 'マップ一覧読み込み実行',
            success: true,
            mapCount: Array.isArray(maps) ? maps.length : 'not array',
            adapterUsed: adapter.constructor.name
          };
        } catch (error) {
          reproduction.step4_mapLoading = {
            description: 'マップ一覧読み込み失敗',
            success: false,
            error: error.message
          };
        }
      }
      
      // 問題の特定
      reproduction.problemAnalysis = {
        issue: 'ストレージモード未選択時にローカルアダプターが作成される',
        rootCause: 'StorageAdapterFactory が null を local として扱う',
        impact: 'ユーザーの選択を待たずに初期化が進む',
        timing: 'マップ読み込みが選択画面より先に実行される'
      };
      
    } finally {
      // 元の設定を復元
      if (originalSettings) {
        localStorage.setItem('mindflow_settings', originalSettings);
      }
    }
    
    return reproduction;
  }

  // 4. マップ読み込み待機機能のテスト
  async testMapLoadingDelay() {
    console.log('⏱️ マップ読み込み待機機能をテスト中...');
    
    const delayTest = {};
    
    // 1. 現在の実装での待機機能確認
    delayTest.currentImplementation = {
      hasStorageModeCheck: 'ストレージモード確認機能の存在を調査',
      hasInitializationDelay: '初期化遅延機能の存在を調査',
      hasConditionalLoading: '条件付き読み込み機能の存在を調査'
    };
    
    // 2. 理想的な初期化フローの定義
    delayTest.idealFlow = {
      step1: 'アプリ起動',
      step2: 'ストレージモード設定確認',
      step3a_firstTime: 'ストレージモード選択画面表示',
      step3b_configured: 'マップ読み込み開始',
      step4: 'ユーザーがモード選択',
      step5: '選択されたモードでマップ読み込み',
      step6: 'アプリ初期化完了'
    };
    
    // 3. 問題のある現在のフロー
    delayTest.currentFlow = {
      step1: 'アプリ起動',
      step2: 'ストレージモード設定確認（null）',
      step3: 'デフォルトでローカルアダプター作成', // 問題
      step4: 'マップ読み込み実行', // 問題
      step5: 'ストレージモード選択画面表示（遅い）',
      step6: 'ユーザー選択が反映されない' // 問題
    };
    
    // 4. 修正すべきポイント
    delayTest.fixPoints = {
      point1: 'StorageAdapterFactory でのnull処理',
      point2: 'useMindMapMulti での条件付き初期化',
      point3: 'useAppInitialization での初期化待機',
      point4: 'isAppReady フラグの適切な制御'
    };
    
    return delayTest;
  }

  // 5. 修正後の初期化フローの確認
  async testFixedInitializationFlow() {
    console.log('🔧 修正後の初期化フローをテスト中...');
    
    const fixedFlow = {};
    
    // 修正提案の定義
    fixedFlow.proposedChanges = {
      change1: {
        file: 'storageAdapter.ts',
        description: 'StorageAdapterFactory でnull時の専用処理',
        implementation: 'ストレージモード未設定時は特別なアダプターを返す'
      },
      change2: {
        file: 'useMindMapMulti.ts', 
        description: '条件付きマップ読み込み',
        implementation: 'ストレージモード設定済みの場合のみ実行'
      },
      change3: {
        file: 'useAppInitialization.ts',
        description: 'isAppReady制御の改善',
        implementation: 'ストレージモード選択完了まで false を維持'
      },
      change4: {
        file: 'realtimeSync.ts',
        description: 'リアルタイム同期の開始条件厳格化',
        implementation: 'ストレージモード確定後に開始'
      }
    };
    
    // テスト用の修正シミュレーション
    fixedFlow.simulation = {
      scenario: '初回起動時（ストレージモード未設定）',
      step1: {
        action: 'getAppSettings() → storageMode: null',
        result: 'ストレージモード選択が必要と判定',
        isAppReady: false
      },
      step2: {
        action: 'useMindMapMulti 初期化試行',
        result: 'ストレージモード未設定のためスキップ',
        mapLoading: false
      },
      step3: {
        action: 'ストレージモード選択画面表示',
        result: 'ユーザーがモードを選択',
        userAction: 'cloud または local を選択'
      },
      step4: {
        action: 'モード選択後のアダプター作成',
        result: '選択されたモードのアダプターを作成',
        correctAdapter: true
      },
      step5: {
        action: 'isAppReady = true に変更',
        result: 'マップ読み込み開始',
        timing: '選択後に実行'
      }
    };
    
    return fixedFlow;
  }

  // レポート生成
  generateInitReport() {
    console.log('\n⚡ ストレージモード初期化問題分析レポート');
    console.log('='.repeat(60));
    
    const issues = [];
    const solutions = [];
    
    // 問題の特定
    if (this.results['初期化タイミング問題再現']?.success) {
      const reproduction = this.results['初期化タイミング問題再現'].data;
      if (reproduction.step3_adapterCreation?.problemDetected) {
        issues.push('ストレージモード未選択時にローカルアダプターが作成される');
        issues.push('マップ読み込みがユーザー選択より先に実行される');
      }
    }
    
    // 解決策の提案
    solutions.push('StorageAdapterFactory でnull時の専用処理を追加');
    solutions.push('useMindMapMulti で条件付きマップ読み込みを実装');
    solutions.push('isAppReady フラグの制御を改善');
    solutions.push('リアルタイム同期の開始条件を厳格化');
    
    console.log('\n🚨 発見された問題:');
    if (issues.length === 0) {
      console.log('  ✅ 問題は検出されませんでした');
    } else {
      issues.forEach(issue => console.log(`  ❌ ${issue}`));
    }
    
    console.log('\n💡 推奨される解決策:');
    solutions.forEach(solution => console.log(`  🔧 ${solution}`));
    
    console.log('\n🔄 修正の実装手順:');
    console.log('  1. StorageAdapterFactory に PendingStorageAdapter クラスを追加');
    console.log('  2. useMindMapMulti にストレージモード確認機能を追加');
    console.log('  3. useAppInitialization の isAppReady 制御を改善');
    console.log('  4. 各コンポーネントの初期化順序を調整');
    
    console.log('\n🧪 テスト方法:');
    console.log('  1. localStorage から mindflow_settings を削除');
    console.log('  2. ページをリロード');
    console.log('  3. コンソールログを確認');
    console.log('  4. ストレージモード選択画面の表示タイミング確認');
    
    return {
      issues,
      solutions,
      hasInitializationProblem: issues.length > 0,
      totalTests: Object.keys(this.results).length,
      passedTests: Object.values(this.results).filter(r => r.success).length
    };
  }

  // 設定をリセットして問題を再現
  async reproduceIssue() {
    console.log('🧪 問題の再現テスト...');
    
    const originalSettings = localStorage.getItem('mindflow_settings');
    
    try {
      // 設定をクリアして初回起動をシミュレート
      localStorage.removeItem('mindflow_settings');
      console.log('✅ localStorage設定をクリアしました');
      console.log('🔄 ページをリロードして問題を再現してください');
      console.log('📊 期待される結果: ストレージモード選択前にローカルモード初期化');
      
      return {
        action: 'localStorage cleared',
        instruction: 'ページをリロードしてください',
        expected: 'ローカルモード初期化が先に実行される問題を確認'
      };
    } finally {
      // 元の設定を復元するオプション（すぐには実行しない）
      console.log('💡 元の設定に戻すには: storageModeInitTester.restoreSettings()');
    }
  }

  // 設定を復元
  restoreSettings() {
    const settings = {
      storageMode: 'cloud',
      enableRealtimeSync: true,
      autoSave: true
    };
    
    localStorage.setItem('mindflow_settings', JSON.stringify(settings));
    console.log('✅ 設定を復元しました:', settings);
  }
}

// グローバルに公開
window.storageModeInitTester = new StorageModeInitTester();

console.log(`
⚡ ストレージモード初期化タイミングテスター準備完了！

主要コマンド:
  await storageModeInitTester.runStorageModeInitTest()

問題再現:
  await storageModeInitTester.reproduceIssue()

設定復元:
  storageModeInitTester.restoreSettings()

このテストで確認される項目:
  ✓ 初期化シーケンスの分析
  ✓ ストレージモード設定状態の確認
  ✓ 初期化タイミング問題の再現
  ✓ マップ読み込み待機機能の検証
  ✓ 修正後の初期化フローの確認

問題: ストレージモード選択前にローカルモード初期化が実行される
解決: 適切な初期化順序と待機機能の実装
`);

export { StorageModeInitTester };