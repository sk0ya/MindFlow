-- 新しいIndexedDBベース同期用データベーススキーマ
-- 既存の複雑なスキーマを削除し、シンプルな構造に置き換え

-- 既存テーブルを全て削除
DROP TABLE IF EXISTS node_connections;
DROP TABLE IF EXISTS node_links;
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS nodes;
DROP TABLE IF EXISTS mindmaps;
DROP TABLE IF EXISTS auth_tokens;
DROP TABLE IF EXISTS users;

-- ユーザーテーブル（シンプル化）
CREATE TABLE users (
  id TEXT PRIMARY KEY,           -- メールアドレス
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

-- 認証トークンテーブル（Magic Link用）
CREATE TABLE auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- マインドマップテーブル（JSON完全対応）
CREATE TABLE mindmaps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  data TEXT NOT NULL,             -- 完全なマインドマップデータ（JSON）
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 同期オペレーションテーブル（バックグラウンド同期用）
CREATE TABLE sync_operations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mindmap_id TEXT NOT NULL,
  operation TEXT NOT NULL,        -- 'create', 'update', 'delete', 'node_create', 'node_update', 'node_delete', 'node_move'
  data TEXT NOT NULL,             -- オペレーションデータ（JSON）
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 同期メタデータテーブル（同期状態管理）
CREATE TABLE sync_metadata (
  user_id TEXT NOT NULL,
  mindmap_id TEXT NOT NULL,
  last_sync_at TEXT NOT NULL DEFAULT (datetime('now')),
  local_version INTEGER NOT NULL DEFAULT 1,
  server_version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'synced', -- 'synced', 'pending', 'conflict', 'error'
  conflict_data TEXT,             -- 競合時のデータ（JSON）
  PRIMARY KEY (user_id, mindmap_id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (mindmap_id) REFERENCES mindmaps (id) ON DELETE CASCADE
);

-- インデックス作成（パフォーマンス最適化）
CREATE INDEX idx_auth_tokens_user_id ON auth_tokens (user_id);
CREATE INDEX idx_auth_tokens_expires_at ON auth_tokens (expires_at);

CREATE INDEX idx_mindmaps_user_id ON mindmaps (user_id);
CREATE INDEX idx_mindmaps_updated_at ON mindmaps (updated_at);

CREATE INDEX idx_sync_operations_user_id ON sync_operations (user_id);
CREATE INDEX idx_sync_operations_mindmap_id ON sync_operations (mindmap_id);
CREATE INDEX idx_sync_operations_status ON sync_operations (status);
CREATE INDEX idx_sync_operations_created_at ON sync_operations (created_at);

CREATE INDEX idx_sync_metadata_user_id ON sync_metadata (user_id);
CREATE INDEX idx_sync_metadata_sync_status ON sync_metadata (sync_status);
CREATE INDEX idx_sync_metadata_last_sync_at ON sync_metadata (last_sync_at);

-- 初期データ（テスト用ユーザー）
INSERT INTO users (id) VALUES ('test@example.com');

-- データベース情報表示
SELECT 
  'Schema migration completed. New IndexedDB-optimized structure ready.' as message,
  (SELECT COUNT(*) FROM sqlite_master WHERE type='table') as table_count,
  (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%') as index_count;