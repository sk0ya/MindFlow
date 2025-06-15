// 同期デバッグ用のテストコード
// ブラウザのコンソールで実行してください

async function debugSync() {
  console.log('=== 同期デバッグ開始 ===');
  
  // 1. 認証状態確認
  try {
    const { authManager } = await import('./src/utils/authManager.js');
    const isAuth = authManager.isAuthenticated();
    const currentUser = authManager.getCurrentUser();
    console.log('認証状態:', isAuth);
    console.log('現在のユーザー:', currentUser);
  } catch (e) {
    console.error('認証マネージャーエラー:', e);
  }
  
  // 2. ローカルデータ確認
  try {
    const { getAllMindMaps } = await import('./src/utils/storage.js');
    const localMaps = getAllMindMaps();
    console.log('ローカルマップ数:', localMaps.length);
    console.log('ローカルマップ:', localMaps.map(m => ({ id: m.id, title: m.title })));
  } catch (e) {
    console.error('ローカルデータエラー:', e);
  }
  
  // 3. API接続テスト
  try {
    const { cloudStorage } = await import('./src/utils/cloudStorage.js');
    console.log('API接続テスト開始...');
    const testResult = await cloudStorage.testConnection();
    console.log('API接続テスト結果:', testResult);
    
    // クラウドデータ取得テスト
    const cloudMaps = await cloudStorage.getAllMindMaps();
    console.log('クラウドマップ数:', cloudMaps.mindmaps ? cloudMaps.mindmaps.length : 0);
    console.log('クラウドマップ:', cloudMaps);
  } catch (e) {
    console.error('API接続エラー:', e);
  }
  
  // 4. 設定確認
  try {
    const { getAppSettings } = await import('./src/utils/storage.js');
    const settings = getAppSettings();
    console.log('アプリ設定:', settings);
  } catch (e) {
    console.error('設定エラー:', e);
  }
  
  console.log('=== 同期デバッグ終了 ===');
}

// 自動実行
debugSync();