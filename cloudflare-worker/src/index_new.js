/**
 * 新しいIndexedDBベース同期API - メインエントリーポイント
 */

import { handleAuthRequest } from './handlers/auth.js';
import { handleSyncRequest } from './handlers/sync.js';
import { handleMindMapsRequest } from './handlers/mindmaps_new.js';
import { corsHeaders } from './utils/cors.js';

export { MindMapRoom } from './durable-objects/MindMapRoom.js';

export default {
  async fetch(request, env, ctx) {
    // CORS プリフライトリクエストへの対応
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    console.log(`📡 API Request: ${request.method} ${path}`);

    try {
      // ルーティング（新しいシンプル構造）
      if (path.startsWith('/api/auth')) {
        return await handleAuthRequest(request, env);
      }

      if (path.startsWith('/api/sync')) {
        return await handleSyncRequest(request, env);
      }

      if (path.startsWith('/api/mindmaps')) {
        return await handleMindMapsRequest(request, env);
      }

      // ヘルスチェック
      if (path === '/api/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '2.0.0-indexeddb'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // データベース初期化（開発用）
      if (path === '/api/init-db' && env.ENVIRONMENT === 'development') {
        return await initializeDatabase(env);
      }

      // データベース クリア（開発用）
      if (path === '/api/clear-db' && env.ENVIRONMENT === 'development') {
        return await clearDatabase(env);
      }

      // 404 レスポンス
      return new Response(JSON.stringify({
        error: 'Endpoint not found',
        path: path
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (error) {
      console.error('❌ API Error:', error);
      
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};

/**
 * データベース初期化（開発用）
 */
async function initializeDatabase(env) {
  try {
    console.log('🔄 データベース初期化開始...');

    // 新しいスキーマで初期化
    const schemaSQL = `
      -- 既存テーブルを全て削除
      DROP TABLE IF EXISTS sync_metadata;
      DROP TABLE IF EXISTS sync_operations;
      DROP TABLE IF EXISTS mindmaps;
      DROP TABLE IF EXISTS auth_tokens;
      DROP TABLE IF EXISTS users;

      -- ユーザーテーブル
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_login_at TEXT
      );

      -- 認証トークンテーブル
      CREATE TABLE auth_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );

      -- マインドマップテーブル
      CREATE TABLE mindmaps (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        data TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );

      -- 同期オペレーションテーブル
      CREATE TABLE sync_operations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        mindmap_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        retry_count INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );

      -- 同期メタデータテーブル
      CREATE TABLE sync_metadata (
        user_id TEXT NOT NULL,
        mindmap_id TEXT NOT NULL,
        last_sync_at TEXT NOT NULL DEFAULT (datetime('now')),
        local_version INTEGER NOT NULL DEFAULT 1,
        server_version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT NOT NULL DEFAULT 'synced',
        conflict_data TEXT,
        PRIMARY KEY (user_id, mindmap_id),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (mindmap_id) REFERENCES mindmaps (id) ON DELETE CASCADE
      );

      -- インデックス作成
      CREATE INDEX idx_auth_tokens_user_id ON auth_tokens (user_id);
      CREATE INDEX idx_auth_tokens_expires_at ON auth_tokens (expires_at);
      CREATE INDEX idx_mindmaps_user_id ON mindmaps (user_id);
      CREATE INDEX idx_mindmaps_updated_at ON mindmaps (updated_at);
      CREATE INDEX idx_sync_operations_user_id ON sync_operations (user_id);
      CREATE INDEX idx_sync_operations_status ON sync_operations (status);
      CREATE INDEX idx_sync_metadata_user_id ON sync_metadata (user_id);
    `;

    // スキーマを分割して実行
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (const statement of statements) {
      if (statement) {
        await env.DB.prepare(statement).run();
      }
    }

    console.log('✅ データベース初期化完了');

    return new Response(JSON.stringify({
      message: 'Database initialized successfully',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('❌ データベース初期化エラー:', error);
    
    return new Response(JSON.stringify({
      error: 'Database initialization failed',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * データベースクリア（開発用）
 */
async function clearDatabase(env) {
  try {
    console.log('🧹 データベースクリア開始...');

    // 全データを削除
    await env.DB.prepare('DELETE FROM sync_metadata').run();
    await env.DB.prepare('DELETE FROM sync_operations').run();
    await env.DB.prepare('DELETE FROM mindmaps').run();
    await env.DB.prepare('DELETE FROM auth_tokens').run();
    await env.DB.prepare('DELETE FROM users').run();

    console.log('✅ データベースクリア完了');

    return new Response(JSON.stringify({
      message: 'Database cleared successfully',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('❌ データベースクリアエラー:', error);
    
    return new Response(JSON.stringify({
      error: 'Database clear failed',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}