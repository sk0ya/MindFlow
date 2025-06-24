/**
 * API接続テストスクリプト
 * Cloudflare Workers APIの動作確認
 */

const API_BASE = 'https://mindflow-api-production.shigekazukoya.workers.dev';

async function testAPI() {
  console.log('🔍 API接続テスト開始...');
  console.log('API Base URL:', API_BASE);

  // 1. マインドマップエンドポイントテスト（認証不要）
  try {
    console.log('\n1. マインドマップエンドポイントテスト...');
    const response = await fetch(`${API_BASE}/api/mindmaps`);
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.text();
      console.log('✅ マインドマップエンドポイント成功');
    } else {
      console.log('❌ マインドマップエンドポイント失敗 (認証が必要)');
    }
  } catch (error) {
    console.error('❌ マインドマップエンドポイントエラー:', error.message);
  }

  // 2. 認証ログインエンドポイント
  try {
    console.log('\n2. 認証ログインエンドポイントテスト...');
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: 'test@example.com' })
    });
    console.log('Status:', response.status);
    
    if (response.ok) {
      const data = await response.text();
      console.log('✅ 認証ログインエンドポイント成功');
    } else {
      console.log('❌ 認証ログインエンドポイント失敗:', response.status);
    }
  } catch (error) {
    console.error('❌ 認証ログインエンドポイントエラー:', error.message);
  }

  // 3. 健全性チェックエンドポイント
  try {
    console.log('\n3. 健全性チェックエンドポイント...');
    const response = await fetch(`${API_BASE}/api/auth/health`);
    console.log('Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ 健全性チェック成功:', data);
    } else {
      console.log('❌ 健全性チェック失敗');
    }
  } catch (error) {
    console.error('❌ 健全性チェックエラー:', error.message);
  }

  // 4. CORS確認
  try {
    console.log('\n4. CORS確認...');
    const response = await fetch(`${API_BASE}/api/auth/health`, {
      method: 'OPTIONS'
    });
    console.log('OPTIONS Status:', response.status);
    console.log('CORS Headers:', {
      'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
    });
  } catch (error) {
    console.error('❌ CORS確認エラー:', error.message);
  }

  console.log('\n✅ APIテスト完了');
}

// Node.js環境用のfetch polyfill
if (typeof fetch === 'undefined') {
  const { fetch: nodeFetch } = require('node-fetch');
  global.fetch = nodeFetch;
}

testAPI().catch(console.error);