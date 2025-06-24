/**
 * クラウドモードデバッグ用関数
 * ブラウザのコンソールでクラウド機能をテスト
 */

// デバッグ関数をグローバルに公開
window.debugCloudMode = {
  
  // 1. API接続テスト
  async testAPIConnection() {
    console.log('🔍 API接続テスト開始...');
    
    try {
      const response = await fetch('https://mindflow-api-production.shigekazukoya.workers.dev/api/auth/health');
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API接続成功:', data);
        return true;
      } else {
        console.error('❌ API接続失敗:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ API接続エラー:', error);
      return false;
    }
  },

  // 2. 認証状態確認
  async checkAuthState() {
    console.log('🔐 認証状態確認...');
    
    try {
      const { authManager } = await import('./features/auth/authManager.ts');
      const { cloudAuthManager } = await import('./features/auth/cloudAuthManager.ts');
      
      console.log('AuthManager:', {
        isAuthenticated: authManager.isAuthenticated(),
        hasToken: !!authManager.getAuthToken(),
        user: authManager.getCurrentUser()
      });
      
      console.log('CloudAuthManager:', {
        isCloudAuthEnabled: cloudAuthManager.isCloudAuthEnabled(),
        hasValidToken: cloudAuthManager.hasValidCloudToken()
      });
      
      return {
        basic: authManager.isAuthenticated(),
        cloud: cloudAuthManager.isCloudAuthEnabled()
      };
    } catch (error) {
      console.error('❌ 認証状態確認エラー:', error);
      return false;
    }
  },

  // 3. ストレージモード確認
  checkStorageMode() {
    console.log('💾 ストレージモード確認...');
    
    try {
      const settings = JSON.parse(localStorage.getItem('mindflow_settings') || '{}');
      console.log('現在の設定:', settings);
      console.log('ストレージモード:', settings.storageMode || 'local');
      
      return settings.storageMode || 'local';
    } catch (error) {
      console.error('❌ ストレージモード確認エラー:', error);
      return 'local';
    }
  },

  // 4. クラウドモードに切り替え
  async switchToCloudMode() {
    console.log('☁️ クラウドモードに切り替え中...');
    
    try {
      const settings = JSON.parse(localStorage.getItem('mindflow_settings') || '{}');
      settings.storageMode = 'cloud';
      localStorage.setItem('mindflow_settings', JSON.stringify(settings));
      
      console.log('✅ クラウドモードに切り替え完了');
      console.log('ページをリロードして変更を適用してください');
      
      return true;
    } catch (error) {
      console.error('❌ クラウドモード切り替えエラー:', error);
      return false;
    }
  },

  // 5. ローカルモードに切り替え
  async switchToLocalMode() {
    console.log('🏠 ローカルモードに切り替え中...');
    
    try {
      const settings = JSON.parse(localStorage.getItem('mindflow_settings') || '{}');
      settings.storageMode = 'local';
      localStorage.setItem('mindflow_settings', JSON.stringify(settings));
      
      console.log('✅ ローカルモードに切り替え完了');
      console.log('ページをリロードして変更を適用してください');
      
      return true;
    } catch (error) {
      console.error('❌ ローカルモード切り替えエラー:', error);
      return false;
    }
  },

  // 6. 完全テスト実行
  async runFullTest() {
    console.log('🚀 完全テスト開始...');
    
    const results = {
      apiConnection: await this.testAPIConnection(),
      authState: await this.checkAuthState(),
      storageMode: this.checkStorageMode()
    };
    
    console.log('📊 テスト結果:', results);
    
    if (results.apiConnection) {
      console.log('✅ API接続: 正常');
    } else {
      console.log('❌ API接続: 失敗');
    }
    
    if (results.authState.basic) {
      console.log('✅ 基本認証: 有効');
    } else {
      console.log('⚠️ 基本認証: 無効');
    }
    
    if (results.authState.cloud) {
      console.log('✅ クラウド認証: 有効');
    } else {
      console.log('⚠️ クラウド認証: 無効');
    }
    
    console.log(`📍 現在のモード: ${results.storageMode}`);
    
    return results;
  },

  // ヘルプ
  help() {
    console.log(`
🛠️  クラウドモードデバッグコマンド:

debugCloudMode.testAPIConnection()     - API接続テスト
debugCloudMode.checkAuthState()        - 認証状態確認  
debugCloudMode.checkStorageMode()      - ストレージモード確認
debugCloudMode.switchToCloudMode()     - クラウドモードに切り替え
debugCloudMode.switchToLocalMode()     - ローカルモードに切り替え
debugCloudMode.runFullTest()           - 完全テスト実行
debugCloudMode.help()                  - このヘルプを表示

使用例:
await debugCloudMode.runFullTest()
    `);
  }
};

// 初期化時にヘルプを表示
if (typeof window !== 'undefined') {
  console.log('🐛 デバッグモード: debugCloudMode.help() でコマンド一覧を表示');
}

export { };