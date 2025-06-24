/**
 * クラウド同期診断ツール
 * CloudStorageAdapter -> CloudSyncAdapter の初期化問題を特定
 */

class SyncDiagnosisTool {
  constructor() {
    this.results = {};
  }

  async diagnoseCloudSyncIssues() {
    console.log('🔬 クラウド同期診断開始...\n');

    // 1. CloudAuthManager 状態確認
    await this.testCloudAuthManager();
    
    // 2. CloudSyncAdapter 初期化テスト
    await this.testCloudSyncAdapter();
    
    // 3. CloudStorageAdapter 初期化テスト
    await this.testCloudStorageAdapter();
    
    // 4. ストレージアダプター工場テスト
    await this.testStorageAdapterFactory();

    this.generateDiagnosisReport();
    return this.results;
  }

  async testCloudAuthManager() {
    console.log('📋 CloudAuthManager 診断中...');
    
    try {
      const { cloudAuthManager } = await import('./features/auth/cloudAuthManager.ts');
      
      this.results.cloudAuthManager = {
        success: true,
        isCloudAuthEnabled: cloudAuthManager.isCloudAuthEnabled(),
        hasValidToken: cloudAuthManager.hasValidCloudToken(),
        methods: Object.getOwnPropertyNames(Object.getPrototypeOf(cloudAuthManager)),
        healthCheckResult: null
      };

      // ヘルスチェック実行
      try {
        const healthCheck = await cloudAuthManager.healthCheck();
        this.results.cloudAuthManager.healthCheckResult = healthCheck;
        console.log('✅ CloudAuthManager: 正常');
      } catch (error) {
        this.results.cloudAuthManager.healthCheckError = error.message;
        console.log('⚠️ CloudAuthManager: ヘルスチェック失敗', error.message);
      }

    } catch (error) {
      this.results.cloudAuthManager = {
        success: false,
        error: error.message
      };
      console.log('❌ CloudAuthManager: インポート失敗', error.message);
    }
  }

  async testCloudSyncAdapter() {
    console.log('📋 CloudSyncAdapter 診断中...');
    
    try {
      const { CloudSyncAdapter, cloudSyncAdapter } = await import('./core/storage/cloudSyncAdapter.ts');
      
      this.results.cloudSyncAdapter = {
        success: true,
        classImported: !!CloudSyncAdapter,
        instanceExists: !!cloudSyncAdapter,
        isInitialized: cloudSyncAdapter.getStats().isInitialized,
        queueLength: cloudSyncAdapter.getStats().queueLength,
        stats: cloudSyncAdapter.getStats()
      };

      // 初期化テスト
      try {
        if (!this.results.cloudAuthManager?.isCloudAuthEnabled) {
          console.log('⚠️ CloudSyncAdapter: 認証が無効のため初期化スキップ');
          this.results.cloudSyncAdapter.initializationSkipped = 'No cloud auth';
        } else {
          await cloudSyncAdapter.initialize();
          this.results.cloudSyncAdapter.initializationSuccess = true;
        }
      } catch (error) {
        this.results.cloudSyncAdapter.initializationError = error.message;
        console.log('⚠️ CloudSyncAdapter: 初期化失敗', error.message);
      }

      console.log('✅ CloudSyncAdapter: インポート成功');
    } catch (error) {
      this.results.cloudSyncAdapter = {
        success: false,
        error: error.message
      };
      console.log('❌ CloudSyncAdapter: インポート失敗', error.message);
    }
  }

  async testCloudStorageAdapter() {
    console.log('📋 CloudStorageAdapter 診断中...');
    
    try {
      const { CloudStorageAdapter } = await import('./core/storage/storageAdapter.ts');
      
      this.results.cloudStorageAdapter = {
        success: true,
        classImported: !!CloudStorageAdapter
      };

      // インスタンス作成テスト
      try {
        const adapter = new CloudStorageAdapter();
        this.results.cloudStorageAdapter.instanceCreated = true;
        this.results.cloudStorageAdapter.adapterType = adapter.constructor.name;
        this.results.cloudStorageAdapter.name = adapter.name;
        this.results.cloudStorageAdapter.useSyncAdapter = adapter.useSyncAdapter;
        
        // 初期化テスト
        try {
          await adapter.ensureInitialized();
          this.results.cloudStorageAdapter.initializationSuccess = true;
        } catch (error) {
          this.results.cloudStorageAdapter.initializationError = error.message;
        }

      } catch (error) {
        this.results.cloudStorageAdapter.instanceError = error.message;
      }

      console.log('✅ CloudStorageAdapter: インポート成功');
    } catch (error) {
      this.results.cloudStorageAdapter = {
        success: false,
        error: error.message
      };
      console.log('❌ CloudStorageAdapter: インポート失敗', error.message);
    }
  }

  async testStorageAdapterFactory() {
    console.log('📋 StorageAdapterFactory 診断中...');
    
    try {
      const { getCurrentAdapter, StorageAdapterFactory } = await import('./core/storage/storageAdapter.ts');
      
      this.results.storageAdapterFactory = {
        success: true,
        factoryExists: !!StorageAdapterFactory,
        getCurrentAdapterExists: !!getCurrentAdapter
      };

      // 現在のモードでアダプター取得テスト
      const originalSettings = JSON.parse(localStorage.getItem('mindflow_settings') || '{}');
      
      // ローカルモードテスト
      try {
        localStorage.setItem('mindflow_settings', JSON.stringify({ storageMode: 'local' }));
        const localAdapter = getCurrentAdapter();
        this.results.storageAdapterFactory.localMode = {
          success: true,
          adapterType: localAdapter.constructor.name,
          name: localAdapter.name
        };
      } catch (error) {
        this.results.storageAdapterFactory.localMode = {
          success: false,
          error: error.message
        };
      }

      // クラウドモードテスト
      try {
        localStorage.setItem('mindflow_settings', JSON.stringify({ storageMode: 'cloud' }));
        const cloudAdapter = getCurrentAdapter();
        this.results.storageAdapterFactory.cloudMode = {
          success: true,
          adapterType: cloudAdapter.constructor.name,
          name: cloudAdapter.name,
          fallbackToLocal: cloudAdapter.constructor.name.includes('Local')
        };
      } catch (error) {
        this.results.storageAdapterFactory.cloudMode = {
          success: false,
          error: error.message
        };
      }

      // 設定を元に戻す
      localStorage.setItem('mindflow_settings', JSON.stringify(originalSettings));

      console.log('✅ StorageAdapterFactory: テスト完了');
    } catch (error) {
      this.results.storageAdapterFactory = {
        success: false,
        error: error.message
      };
      console.log('❌ StorageAdapterFactory: インポート失敗', error.message);
    }
  }

  generateDiagnosisReport() {
    console.log('\n🩺 クラウド同期診断レポート');
    console.log('='.repeat(60));

    let criticalIssues = [];
    let warnings = [];
    let recommendations = [];

    // CloudAuthManager 診断
    if (!this.results.cloudAuthManager?.success) {
      criticalIssues.push('CloudAuthManager のインポートに失敗');
    } else if (!this.results.cloudAuthManager.isCloudAuthEnabled) {
      warnings.push('クラウド認証が無効');
      recommendations.push('認証設定または認証フローの実装が必要');
    }

    // CloudSyncAdapter 診断
    if (!this.results.cloudSyncAdapter?.success) {
      criticalIssues.push('CloudSyncAdapter のインポートに失敗');
    } else if (this.results.cloudSyncAdapter.initializationError) {
      criticalIssues.push(`CloudSyncAdapter 初期化失敗: ${this.results.cloudSyncAdapter.initializationError}`);
    }

    // CloudStorageAdapter 診断
    if (!this.results.cloudStorageAdapter?.success) {
      criticalIssues.push('CloudStorageAdapter のインポートに失敗');
    } else if (this.results.cloudStorageAdapter.initializationError) {
      criticalIssues.push(`CloudStorageAdapter 初期化失敗: ${this.results.cloudStorageAdapter.initializationError}`);
    }

    // StorageAdapterFactory 診断
    if (this.results.storageAdapterFactory?.cloudMode?.fallbackToLocal) {
      warnings.push('クラウドモードでもローカルアダプターにフォールバック');
      recommendations.push('認証状態またはクラウド機能の設定確認が必要');
    }

    // レポート出力
    console.log('\n🚨 クリティカルな問題:');
    if (criticalIssues.length === 0) {
      console.log('  ✅ クリティカルな問題はありません');
    } else {
      criticalIssues.forEach(issue => console.log(`  ❌ ${issue}`));
    }

    console.log('\n⚠️ 警告:');
    if (warnings.length === 0) {
      console.log('  ✅ 警告はありません');
    } else {
      warnings.forEach(warning => console.log(`  ⚠️ ${warning}`));
    }

    console.log('\n💡 推奨事項:');
    if (recommendations.length === 0) {
      console.log('  ✅ 追加の推奨事項はありません');
    } else {
      recommendations.forEach(rec => console.log(`  💡 ${rec}`));
    }

    // 根本原因分析
    console.log('\n🔍 根本原因分析:');
    if (criticalIssues.some(issue => issue.includes('CloudSyncAdapter'))) {
      console.log('  🎯 CloudSyncAdapter が複雑すぎて初期化に失敗している可能性があります');
      console.log('     - Vector clock システム');
      console.log('     - 競合解決メカニズム');
      console.log('     - リアルタイム同期');
      console.log('     → シンプルなクラウドストレージに簡素化を推奨');
    }

    if (!this.results.cloudAuthManager?.isCloudAuthEnabled) {
      console.log('  🎯 認証が設定されていないため、クラウド機能が無効です');
      console.log('     → 認証フローの実装またはテスト用トークン設定が必要');
    }

    return {
      criticalIssues,
      warnings, 
      recommendations,
      totalTests: Object.keys(this.results).length,
      passedTests: Object.values(this.results).filter(r => r.success).length
    };
  }
}

// グローバルに公開
window.syncDiagnosisTool = new SyncDiagnosisTool();

console.log(`
🔬 同期診断ツール準備完了！

主要コマンド:
  await syncDiagnosisTool.diagnoseCloudSyncIssues()

このツールで確認される項目:
  ✓ CloudAuthManager の状態と設定
  ✓ CloudSyncAdapter の初期化問題
  ✓ CloudStorageAdapter の依存関係
  ✓ StorageAdapterFactory のフォールバック動作

根本原因を特定して解決策を提案します。
`);

export { SyncDiagnosisTool };