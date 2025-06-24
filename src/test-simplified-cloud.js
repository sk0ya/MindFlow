/**
 * シンプル化されたクラウドストレージのテスト
 * CloudSyncAdapterの複雑性を除去した後の動作確認
 */

class SimplifiedCloudTester {
  constructor() {
    this.results = {};
  }

  async runSimplifiedCloudTest() {
    console.log('🌤️ シンプル化クラウドストレージテスト開始...\n');

    // 1. CloudStorageAdapter の初期化テスト
    await this.testCloudStorageAdapterInit();

    // 2. API通信の基本テスト
    await this.testBasicAPICall();

    // 3. ストレージアダプター工場の動作確認
    await this.testStorageFactory();

    // 4. 認証状態の確認
    await this.testAuthenticationState();

    // 5. エラーハンドリングテスト
    await this.testErrorHandling();

    this.generateSimplifiedReport();
    return this.results;
  }

  async testCloudStorageAdapterInit() {
    console.log('📋 CloudStorageAdapter 初期化テスト...');
    
    try {
      const { CloudStorageAdapter } = await import('./core/storage/storageAdapter.ts');
      
      // インスタンス作成
      const adapter = new CloudStorageAdapter();
      
      this.results.cloudStorageAdapter = {
        success: true,
        name: adapter.name,
        useSyncAdapter: adapter.useSyncAdapter,
        isInitialized: adapter.isInitialized,
        hasPendingOperations: adapter.pendingOperations.size,
        hasApiCallMethod: typeof adapter.apiCall === 'function'
      };

      // 初期化テスト
      try {
        await adapter.ensureInitialized();
        this.results.cloudStorageAdapter.initializationSuccess = true;
        this.results.cloudStorageAdapter.baseUrl = adapter.baseUrl;
      } catch (error) {
        this.results.cloudStorageAdapter.initializationError = error.message;
      }

      console.log('✅ CloudStorageAdapter: テスト完了');
    } catch (error) {
      this.results.cloudStorageAdapter = {
        success: false,
        error: error.message
      };
      console.log('❌ CloudStorageAdapter: テスト失敗', error.message);
    }
  }

  async testBasicAPICall() {
    console.log('📋 基本API通信テスト...');
    
    try {
      const { CloudStorageAdapter } = await import('./core/storage/storageAdapter.ts');
      const adapter = new CloudStorageAdapter();
      
      this.results.apiCall = {
        success: true,
        hasApiCallMethod: typeof adapter.apiCall === 'function'
      };

      // 認証が必要なテストなので、認証チェック
      const { authManager } = await import('./features/auth/authManager.ts');
      
      if (authManager.isAuthenticated()) {
        try {
          // ヘルスチェック的なAPIコール
          const healthResponse = await fetch('https://mindflow-api-production.shigekazukoya.workers.dev/api/auth/health');
          this.results.apiCall.healthCheckStatus = healthResponse.status;
          this.results.apiCall.healthCheckOk = healthResponse.ok;
          
          if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            this.results.apiCall.healthData = healthData;
          }
        } catch (error) {
          this.results.apiCall.healthCheckError = error.message;
        }

        // 認証済みの場合は実際のAPICallをテスト
        try {
          await adapter.ensureInitialized();
          const maps = await adapter.getAllMaps();
          this.results.apiCall.getAllMapsSuccess = true;
          this.results.apiCall.mapsCount = Array.isArray(maps) ? maps.length : 'not array';
        } catch (error) {
          this.results.apiCall.getAllMapsError = error.message;
        }
      } else {
        this.results.apiCall.skipped = 'Not authenticated';
      }

      console.log('✅ 基本API通信: テスト完了');
    } catch (error) {
      this.results.apiCall = {
        success: false,
        error: error.message
      };
      console.log('❌ 基本API通信: テスト失敗', error.message);
    }
  }

  async testStorageFactory() {
    console.log('📋 ストレージアダプター工場テスト...');
    
    try {
      const { getCurrentAdapter, reinitializeAdapter } = await import('./core/storage/storageAdapter.ts');
      
      this.results.storageFactory = {
        success: true,
        hasGetCurrentAdapter: typeof getCurrentAdapter === 'function',
        hasReinitializeAdapter: typeof reinitializeAdapter === 'function'
      };

      // 現在のアダプター取得
      const currentAdapter = getCurrentAdapter();
      this.results.storageFactory.currentAdapterType = currentAdapter.constructor.name;
      this.results.storageFactory.currentAdapterName = currentAdapter.name;

      // 再初期化テスト
      const reinitializedAdapter = reinitializeAdapter();
      this.results.storageFactory.reinitializeSuccess = !!reinitializedAdapter;
      this.results.storageFactory.reinitializedAdapterType = reinitializedAdapter.constructor.name;

      console.log('✅ ストレージアダプター工場: テスト完了');
    } catch (error) {
      this.results.storageFactory = {
        success: false,
        error: error.message
      };
      console.log('❌ ストレージアダプター工場: テスト失敗', error.message);
    }
  }

  async testAuthenticationState() {
    console.log('📋 認証状態テスト...');
    
    try {
      const { authManager } = await import('./features/auth/authManager.ts');
      
      this.results.authentication = {
        success: true,
        isAuthenticated: authManager.isAuthenticated(),
        hasToken: !!authManager.getAuthToken(),
        user: authManager.getCurrentUser(),
        hasGetAuthHeader: typeof authManager.getAuthHeader === 'function'
      };

      // 認証ヘッダー取得テスト
      if (authManager.isAuthenticated()) {
        try {
          const authHeader = authManager.getAuthHeader();
          this.results.authentication.authHeaderExists = !!authHeader;
          this.results.authentication.authHeaderFormat = authHeader ? authHeader.substring(0, 20) + '...' : null;
        } catch (error) {
          this.results.authentication.authHeaderError = error.message;
        }
      }

      console.log('✅ 認証状態: テスト完了');
    } catch (error) {
      this.results.authentication = {
        success: false,
        error: error.message
      };
      console.log('❌ 認証状態: テスト失敗', error.message);
    }
  }

  async testErrorHandling() {
    console.log('📋 エラーハンドリングテスト...');
    
    try {
      const { CloudStorageAdapter } = await import('./core/storage/storageAdapter.ts');
      const adapter = new CloudStorageAdapter();
      
      this.results.errorHandling = {
        success: true
      };

      // 認証が利用可能な場合のみテスト
      const { authManager } = await import('./features/auth/authManager.ts');
      
      if (authManager.isAuthenticated()) {
        // 存在しないエンドポイントへのアクセステスト
        try {
          await adapter.apiCall('/api/nonexistent', 'GET');
          this.results.errorHandling.nonexistentEndpoint = 'Should have failed';
        } catch (error) {
          this.results.errorHandling.nonexistentEndpoint = {
            caught: true,
            status: error.status,
            message: error.message.substring(0, 100) + '...'
          };
        }

        // 不正なデータでのPOSTテスト
        try {
          await adapter.apiCall('/api/mindmaps', 'POST', { invalid: 'data' });
          this.results.errorHandling.invalidPost = 'Should have failed';
        } catch (error) {
          this.results.errorHandling.invalidPost = {
            caught: true,
            status: error.status,
            message: error.message.substring(0, 100) + '...'
          };
        }
      } else {
        this.results.errorHandling.skipped = 'Not authenticated';
      }

      console.log('✅ エラーハンドリング: テスト完了');
    } catch (error) {
      this.results.errorHandling = {
        success: false,
        error: error.message
      };
      console.log('❌ エラーハンドリング: テスト失敗', error.message);
    }
  }

  generateSimplifiedReport() {
    console.log('\n🌤️ シンプル化クラウドストレージテスト結果');
    console.log('='.repeat(60));

    let criticalIssues = [];
    let improvements = [];
    let successes = [];

    // CloudStorageAdapter 評価
    if (this.results.cloudStorageAdapter?.success) {
      if (!this.results.cloudStorageAdapter.useSyncAdapter) {
        successes.push('CloudSyncAdapterの依存関係が正常に除去されています');
      }
      if (this.results.cloudStorageAdapter.hasApiCallMethod) {
        successes.push('新しいapiCallメソッドが正常に実装されています');
      }
      if (this.results.cloudStorageAdapter.initializationSuccess) {
        successes.push('CloudStorageAdapterの初期化が成功しています');
      } else if (this.results.cloudStorageAdapter.initializationError) {
        criticalIssues.push(`CloudStorageAdapter初期化失敗: ${this.results.cloudStorageAdapter.initializationError}`);
      }
    } else {
      criticalIssues.push('CloudStorageAdapterの基本動作に問題があります');
    }

    // API通信評価
    if (this.results.apiCall?.success) {
      if (this.results.apiCall.healthCheckOk) {
        successes.push('APIサーバーとの基本通信が正常です');
      }
      if (this.results.apiCall.getAllMapsSuccess) {
        successes.push('getAllMaps APIが正常に動作しています');
      } else if (this.results.apiCall.getAllMapsError) {
        improvements.push(`getAllMaps API改善必要: ${this.results.apiCall.getAllMapsError}`);
      }
    }

    // 認証評価
    if (this.results.authentication?.success) {
      if (this.results.authentication.isAuthenticated) {
        successes.push('認証が正常に機能しています');
      } else {
        improvements.push('認証設定が必要です（テスト用トークンまたは実際の認証フロー）');
      }
    }

    // レポート出力
    console.log('\n✅ 成功項目:');
    if (successes.length === 0) {
      console.log('  (成功項目なし)');
    } else {
      successes.forEach(success => console.log(`  ✅ ${success}`));
    }

    console.log('\n🚨 クリティカルな問題:');
    if (criticalIssues.length === 0) {
      console.log('  ✅ クリティカルな問題はありません');
    } else {
      criticalIssues.forEach(issue => console.log(`  ❌ ${issue}`));
    }

    console.log('\n💡 改善提案:');
    if (improvements.length === 0) {
      console.log('  ✅ 追加の改善提案はありません');
    } else {
      improvements.forEach(improvement => console.log(`  💡 ${improvement}`));
    }

    // 総評
    console.log('\n📊 シンプル化の効果:');
    if (this.results.cloudStorageAdapter?.useSyncAdapter === false) {
      console.log('  🎯 CloudSyncAdapterの複雑性が正常に除去されました');
      console.log('  🎯 直接的なAPI通信による明確な動作フローを実現');
      console.log('  🎯 デバッグとメンテナンスが容易になりました');
    }

    if (!this.results.authentication?.isAuthenticated) {
      console.log('\n🔑 次のステップ: 認証設定');
      console.log('  1. テスト用認証トークンの設定');
      console.log('  2. または実際の認証フロー(Magic Link/GitHub OAuth)の実装');
    }

    return {
      criticalIssues,
      improvements,
      successes,
      isSimplified: this.results.cloudStorageAdapter?.useSyncAdapter === false,
      isAuthenticated: this.results.authentication?.isAuthenticated || false
    };
  }
}

// グローバルに公開
window.simplifiedCloudTester = new SimplifiedCloudTester();

console.log(`
🌤️ シンプル化クラウドストレージテスター準備完了！

主要コマンド:
  await simplifiedCloudTester.runSimplifiedCloudTest()

このテストで確認される項目:
  ✓ CloudSyncAdapterの依存関係除去確認
  ✓ 新しいapiCallメソッドの動作
  ✓ シンプルなAPI通信フロー
  ✓ 認証状態の確認
  ✓ エラーハンドリングの改善

シンプル化の効果を測定します。
`);

export { SimplifiedCloudTester };