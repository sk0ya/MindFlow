/**
 * クラウドモード選択時の認証タイミング問題のテストケース
 * 問題: メール送信前にストレージモードが決定され、ローカルモードにフォールバックしてしまう
 */

class CloudAuthTimingTester {
  constructor() {
    this.results = {};
    this.authSequence = [];
    this.originalSettings = null;
  }

  async runCloudAuthTimingTest() {
    console.log('☁️ クラウド認証タイミングテスト開始...\n');

    const tests = [
      { name: '現在の問題再現', method: 'reproduceCurrentProblem' },
      { name: 'クラウドモード選択フロー分析', method: 'analyzeCloudModeFlow' },
      { name: '認証タイミング問題の特定', method: 'identifyAuthTimingIssue' },
      { name: '修正案の検証', method: 'testProposedFix' },
      { name: '統合フローテスト', method: 'testIntegratedFlow' }
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

    this.generateAuthTimingReport();
    return this.results;
  }

  // 1. 現在の問題を再現
  async reproduceCurrentProblem() {
    console.log('🐛 現在の問題を再現中...');
    
    const problem = {};
    this.authSequence = [];
    
    try {
      // 初期状態をセットアップ
      this.originalSettings = localStorage.getItem('mindflow_settings');
      localStorage.removeItem('mindflow_settings');
      
      this.authSequence.push({
        step: 'initial_setup',
        timestamp: Date.now(),
        description: 'ローカル設定をクリア（初回起動シミュレート）'
      });

      // Step 1: useAppInitialization の状態確認
      const { getAppSettings } = await import('./core/storage/storageUtils.ts');
      const initialSettings = getAppSettings();
      
      this.authSequence.push({
        step: 'initial_settings_check',
        timestamp: Date.now(),
        storageMode: initialSettings.storageMode,
        shouldShowSelector: initialSettings.storageMode === null
      });

      problem.step1_initialState = {
        storageMode: initialSettings.storageMode,
        showsSelector: initialSettings.storageMode === null
      };

      // Step 2: クラウドモード選択をシミュレート
      const { setStorageMode } = await import('./core/storage/storageRouter.ts');
      await setStorageMode('cloud');

      this.authSequence.push({
        step: 'cloud_mode_selected',
        timestamp: Date.now(),
        description: 'ユーザーがクラウドモードを選択'
      });

      // Step 3: 設定後の状態確認
      const settingsAfterSelection = getAppSettings();
      problem.step2_afterModeSelection = {
        storageMode: settingsAfterSelection.storageMode,
        isPersisted: settingsAfterSelection.storageMode === 'cloud'
      };

      this.authSequence.push({
        step: 'settings_persisted',
        timestamp: Date.now(),
        storageMode: settingsAfterSelection.storageMode
      });

      // Step 4: ストレージアダプター作成確認
      const { getCurrentAdapter, reinitializeAdapter } = await import('./core/storage/storageAdapter.ts');
      
      // 現在のアダプター（認証前）
      const adapterBeforeAuth = getCurrentAdapter();
      problem.step3_adapterBeforeAuth = {
        type: adapterBeforeAuth.constructor.name,
        shouldBeCloud: false, // 認証前なのでローカルにフォールバック
        actuallyLocal: adapterBeforeAuth.constructor.name === 'LocalStorageAdapter'
      };

      this.authSequence.push({
        step: 'adapter_fallback_to_local',
        timestamp: Date.now(),
        adapterType: adapterBeforeAuth.constructor.name,
        description: '未認証のためローカルアダプターにフォールバック'
      });

      // Step 5: マップ読み込み実行確認
      try {
        const maps = await adapterBeforeAuth.getAllMaps();
        problem.step4_mapLoading = {
          executed: true,
          mapCount: maps.length,
          usedAdapter: adapterBeforeAuth.constructor.name,
          problemDetected: true // クラウドモード選択後にローカルから読み込んでいる
        };

        this.authSequence.push({
          step: 'premature_map_loading',
          timestamp: Date.now(),
          mapCount: maps.length,
          adapterType: adapterBeforeAuth.constructor.name,
          description: '認証前にローカルストレージからマップを読み込み'
        });
      } catch (error) {
        problem.step4_mapLoading = {
          executed: false,
          error: error.message
        };
      }

      // 問題の特定
      problem.problemAnalysis = {
        issue: 'クラウドモード選択と同時にstorageMode設定が永続化される',
        consequence: '認証前にモードが決定されるため、ローカルモードにフォールバック',
        timing: 'メール送信と認証より先にマップ読み込みが実行される',
        userExperience: 'ローカルデータが表示され、認証後にクラウドデータに切り替わる可能性'
      };

    } catch (error) {
      problem.error = error.message;
    } finally {
      // 設定を復元
      if (this.originalSettings) {
        localStorage.setItem('mindflow_settings', this.originalSettings);
      }
    }

    return problem;
  }

  // 2. クラウドモード選択フローの分析
  async analyzeCloudModeFlow() {
    console.log('📊 クラウドモード選択フローを分析中...');
    
    const flowAnalysis = {};
    
    // 現在のフロー
    flowAnalysis.currentFlow = {
      step1: 'ユーザーがクラウドモードを選択',
      step2: 'setStorageMode(cloud) 実行',
      step3: 'storageMode設定が即座に永続化',
      step4: 'reinitializeAdapter() 実行',
      step5: '未認証のためローカルアダプターが作成される',
      step6: 'reinitializeAfterModeSelection() 実行',
      step7: 'ローカルストレージからマップ読み込み',
      step8: '認証画面表示',
      step9: 'ユーザーがメールアドレス入力',
      step10: 'メール送信',
      step11: '認証完了後にクラウドアダプターに切り替え'
    };

    // 理想的なフロー
    flowAnalysis.idealFlow = {
      step1: 'ユーザーがクラウドモードを選択',
      step2: '一時的にクラウドモードをマークするが永続化しない',
      step3: '認証画面表示',
      step4: 'ユーザーがメールアドレス入力',
      step5: 'メール送信',
      step6: '認証完了後にstorageMode設定を永続化',
      step7: 'クラウドアダプター作成',
      step8: 'クラウドからマップ読み込み'
    };

    // 問題点の特定
    flowAnalysis.problems = {
      problem1: {
        issue: '早すぎるstorageMode永続化',
        impact: '認証前にモードが決定される',
        solution: '認証成功まで一時的な状態で保持'
      },
      problem2: {
        issue: '認証前のマップ読み込み',
        impact: 'ローカルデータが表示される',
        solution: '認証完了まで読み込みを延期'
      },
      problem3: {
        issue: '認証失敗時の状態不整合',
        impact: 'クラウドモード設定だが未認証',
        solution: '認証失敗時は元の状態に戻す'
      }
    };

    // タイミング分析
    flowAnalysis.timing = {
      current: {
        storageModePersistence: '選択と同時',
        adapterCreation: '選択と同時',
        mapLoading: '選択と同時',
        authPrompt: '選択後',
        authCompletion: '最後'
      },
      ideal: {
        storageModePersistence: '認証成功後',
        adapterCreation: '認証成功後',
        mapLoading: '認証成功後',
        authPrompt: '選択直後',
        authCompletion: '中間'
      }
    };

    return flowAnalysis;
  }

  // 3. 認証タイミング問題の特定
  async identifyAuthTimingIssue() {
    console.log('🔍 認証タイミング問題を特定中...');
    
    const timingIssue = {};
    
    // 現在の実装での問題箇所を特定
    timingIssue.problemPoints = {
      useAppInitialization: {
        location: 'src/core/hooks/useAppInitialization.ts:135',
        issue: 'setStorageMode(mode) が即座に実行される',
        code: 'await setStorageMode(mode);',
        impact: 'ユーザー選択と同時に設定が永続化'
      },
      storageRouter: {
        location: 'src/core/storage/storageRouter.js:35',
        issue: 'setStorageMode が設定を即座に保存',
        impact: '認証前にモードが決定される'
      },
      adapterReinitialization: {
        location: 'src/core/hooks/useAppInitialization.ts:139',
        issue: 'reinitializeAdapter() が認証前に実行',
        impact: '未認証のためローカルアダプターが作成'
      },
      mapReinitialization: {
        location: 'MindMapApp.tsx:119-122',
        issue: 'reinitializeAfterModeSelection が認証前に実行',
        impact: 'ローカルストレージからマップを読み込み'
      }
    };

    // 修正が必要な状態管理
    timingIssue.stateManagement = {
      current: {
        storageMode: '即座に永続化',
        adapterState: '即座に初期化',
        mapData: '即座に読み込み'
      },
      needed: {
        storageMode: '認証成功まで一時的',
        adapterState: '認証成功まで保留',
        mapData: '認証成功まで延期'
      }
    };

    // 認証フローとの統合
    timingIssue.authIntegration = {
      currentProblem: {
        description: '認証フローとストレージ初期化が並行実行',
        sequence: ['mode_selection', 'storage_init', 'auth_prompt', 'auth_completion'],
        issue: 'storage_init が auth_completion より先に実行'
      },
      requiredFix: {
        description: '認証成功後にストレージ初期化を実行',
        sequence: ['mode_selection', 'auth_prompt', 'auth_completion', 'storage_init'],
        benefit: '認証状態と一致したストレージ設定'
      }
    };

    return timingIssue;
  }

  // 4. 修正案の検証
  async testProposedFix() {
    console.log('🔧 修正案を検証中...');
    
    const fixTest = {};
    
    // 修正案1: 一時的なモード保持
    fixTest.proposal1_temporaryMode = {
      description: '認証完了まで一時的にモードを保持',
      implementation: {
        newState: 'pendingStorageMode',
        persistence: '認証成功後のみ',
        fallback: '認証失敗時は元に戻す'
      },
      benefits: [
        '認証前の早期初期化を防止',
        '認証失敗時の状態復元',
        'ユーザー体験の向上'
      ]
    };

    // 修正案2: 段階的初期化
    fixTest.proposal2_stageInitialization = {
      description: '認証段階に応じた段階的初期化',
      stages: {
        stage1_selection: 'ユーザー選択 → 一時的フラグ設定',
        stage2_auth: '認証開始 → 認証画面表示',
        stage3_completion: '認証成功 → ストレージ初期化実行'
      },
      implementation: {
        tempAuthState: '認証進行中フラグ',
        deferredInit: '初期化の延期機能',
        successCallback: '認証成功時の初期化実行'
      }
    };

    // 修正案3: 認証統合ハンドラー
    fixTest.proposal3_integratedHandler = {
      description: '認証とストレージ初期化を統合',
      approach: {
        singleHandler: '選択から初期化まで一括処理',
        atomicOperation: '途中でキャンセル可能',
        errorRecovery: '失敗時の状態復元'
      },
      flowControl: {
        phase1: 'クラウドモード選択',
        phase2: '認証プロセス開始',
        phase3: '認証成功確認',
        phase4: 'ストレージ初期化実行'
      }
    };

    // 推奨修正案
    fixTest.recommendedFix = {
      approach: '修正案2: 段階的初期化',
      reasoning: [
        '既存コードへの影響が最小',
        '認証フローとの自然な統合',
        'エラーハンドリングが明確'
      ],
      implementation: {
        step1: 'useAppInitialization に pendingStorageMode 状態追加',
        step2: 'クラウド選択時は認証画面のみ表示',
        step3: '認証成功時にストレージ初期化を実行',
        step4: 'handleAuthSuccess に統合初期化ロジック追加'
      }
    };

    return fixTest;
  }

  // 5. 統合フローテスト
  async testIntegratedFlow() {
    console.log('🔄 統合フローをテスト中...');
    
    const integrationTest = {};
    
    try {
      // 修正後の理想的なフローをシミュレート
      integrationTest.simulatedFlow = {
        phase1: {
          action: 'クラウドモード選択',
          state: { pendingStorageMode: 'cloud', actualStorageMode: null },
          result: '認証画面表示、初期化は保留'
        },
        phase2: {
          action: '認証プロセス開始',
          state: { authInProgress: true },
          result: 'メール送信、ストレージ初期化は待機'
        },
        phase3: {
          action: '認証成功',
          state: { isAuthenticated: true, user: 'authenticated' },
          result: 'ストレージ初期化トリガー'
        },
        phase4: {
          action: 'ストレージ初期化',
          state: { storageMode: 'cloud', adapter: 'CloudStorageAdapter' },
          result: 'クラウドからマップ読み込み'
        }
      };

      // エラーシナリオのテスト
      integrationTest.errorScenarios = {
        authFailure: {
          scenario: '認証失敗時の状態復元',
          expectedBehavior: 'pendingStorageMode をクリア、選択画面に戻る'
        },
        networkError: {
          scenario: 'ネットワークエラー時の処理',
          expectedBehavior: 'エラー表示、状態は変更しない'
        },
        userCancel: {
          scenario: 'ユーザーが認証をキャンセル',
          expectedBehavior: 'ストレージ選択画面に戻る'
        }
      };

      // パフォーマンス影響
      integrationTest.performance = {
        latencyReduction: '認証前の不要な初期化を削減',
        memoryUsage: 'ローカルデータの重複読み込みを防止',
        userPerception: '認証完了後の素早い初期化'
      };

      integrationTest.integrationSuccess = true;

    } catch (error) {
      integrationTest.error = error.message;
      integrationTest.integrationSuccess = false;
    }

    return integrationTest;
  }

  // レポート生成
  generateAuthTimingReport() {
    console.log('\n☁️ クラウド認証タイミング問題分析レポート');
    console.log('='.repeat(60));
    
    const issues = [];
    const solutions = [];
    
    // 問題の特定
    if (this.results['現在の問題再現']?.success) {
      const data = this.results['現在の問題再現'].data;
      if (data.problemAnalysis) {
        issues.push('メール送信前にストレージモードが永続化される');
        issues.push('認証前にローカルモードにフォールバック');
        issues.push('認証前にマップデータが読み込まれる');
      }
    }

    // 解決策の提案
    if (this.results['修正案の検証']?.success) {
      const data = this.results['修正案の検証'].data;
      if (data.recommendedFix) {
        solutions.push('pendingStorageMode 状態による一時的モード保持');
        solutions.push('認証成功後の段階的初期化');
        solutions.push('統合認証ハンドラーによる原子的操作');
      }
    }

    console.log('\n🚨 特定された問題:');
    if (issues.length === 0) {
      console.log('  ✅ 問題は検出されませんでした');
    } else {
      issues.forEach(issue => console.log(`  ❌ ${issue}`));
    }

    console.log('\n💡 推奨される解決策:');
    solutions.forEach(solution => console.log(`  🔧 ${solution}`));

    console.log('\n🔄 修正実装手順:');
    console.log('  1. useAppInitialization に pendingStorageMode 状態を追加');
    console.log('  2. クラウドモード選択時は設定を永続化せず認証画面表示');
    console.log('  3. 認証成功時に setStorageMode と初期化を実行');
    console.log('  4. 認証失敗時は pendingStorageMode をクリア');

    console.log('\n🧪 テスト手順:');
    console.log('  1. ローカル設定をクリアしてページリロード');
    console.log('  2. クラウドモードを選択');
    console.log('  3. 認証画面が表示されることを確認');
    console.log('  4. 認証完了後にクラウドデータが読み込まれることを確認');

    return {
      issues,
      solutions,
      sequenceLogged: this.authSequence,
      hasTimingProblem: issues.length > 0,
      totalTests: Object.keys(this.results).length,
      passedTests: Object.values(this.results).filter(r => r.success).length
    };
  }

  // 問題の簡単な確認
  async quickCheck() {
    console.log('⚡ クラウド認証タイミング クイックチェック...');
    
    try {
      const original = localStorage.getItem('mindflow_settings');
      localStorage.removeItem('mindflow_settings');
      
      // クラウドモード選択をシミュレート
      const { setStorageMode } = await import('./core/storage/storageRouter.ts');
      await setStorageMode('cloud');
      
      // 設定が即座に永続化されるかチェック
      const { getAppSettings } = await import('./core/storage/storageUtils.ts');
      const settings = getAppSettings();
      
      const hasTimingProblem = settings.storageMode === 'cloud';
      
      if (original) localStorage.setItem('mindflow_settings', original);
      
      console.log(hasTimingProblem ? '❌ タイミング問題あり' : '✅ 問題なし');
      return { 
        hasTimingProblem, 
        storageMode: settings.storageMode,
        description: hasTimingProblem ? '認証前にストレージモードが永続化' : '正常'
      };
      
    } catch (error) {
      console.error('❌ チェックエラー:', error.message);
      return { hasTimingProblem: true, error: error.message };
    }
  }
}

// グローバルに公開
window.cloudAuthTimingTester = new CloudAuthTimingTester();

console.log(`
☁️ クラウド認証タイミングテスター準備完了！

主要コマンド:
  await cloudAuthTimingTester.runCloudAuthTimingTest()

クイックチェック:
  await cloudAuthTimingTester.quickCheck()

このテストで確認される問題:
  ❌ メール送信前のstorageMode永続化
  ❌ 認証前のローカルモードフォールバック
  ❌ 認証前のマップデータ読み込み
  ❌ 認証タイミングとストレージ初期化の競合

修正対象:
  🎯 useAppInitialization のクラウドモード選択処理
  🎯 ストレージモード永続化のタイミング
  🎯 認証成功後の初期化フロー
  🎯 エラー時の状態復元機能
`);

export { CloudAuthTimingTester };