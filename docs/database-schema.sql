-- MindFlow Cloud Sync Database Schema
-- リアルタイム同期とバージョン管理に対応したスキーマ設計

-- ユーザー管理
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  github_id INTEGER UNIQUE NOT NULL,
  username TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- マインドマップメタデータ
CREATE TABLE mindmaps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  settings JSON NOT NULL DEFAULT '{}', -- autoSave, autoLayout等の設定
  version INTEGER NOT NULL DEFAULT 1, -- バージョン管理
  last_modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ノードデータ（フラット構造で高速クエリ対応）
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  mindmap_id TEXT NOT NULL,
  parent_id TEXT, -- NULL = root node
  text TEXT NOT NULL,
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  font_size INTEGER,
  font_weight TEXT,
  color TEXT,
  collapsed BOOLEAN DEFAULT FALSE,
  order_index INTEGER NOT NULL DEFAULT 0, -- 兄弟ノード間の順序
  version INTEGER NOT NULL DEFAULT 1, -- ノード単位のバージョン管理
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (mindmap_id) REFERENCES mindmaps(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- ファイル添付
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  file_data TEXT NOT NULL, -- Base64エンコードされたファイルデータ
  optimization_metadata JSON, -- 圧縮率、元サイズ等
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- マップ間リンク
CREATE TABLE map_links (
  id TEXT PRIMARY KEY,
  source_node_id TEXT NOT NULL,
  target_mindmap_id TEXT NOT NULL,
  target_node_id TEXT,
  link_type TEXT DEFAULT 'reference', -- reference, bookmark等
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_mindmap_id) REFERENCES mindmaps(id) ON DELETE CASCADE
);

-- リアルタイム同期のための操作ログ
CREATE TABLE operations (
  id TEXT PRIMARY KEY,
  mindmap_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  operation_type TEXT NOT NULL, -- create, update, delete, move
  target_type TEXT NOT NULL, -- mindmap, node, attachment
  target_id TEXT NOT NULL,
  data JSON NOT NULL, -- 操作内容の詳細データ
  vector_clock JSON NOT NULL, -- 分散システム用ベクタークロック
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  applied_at DATETIME, -- サーバー適用時刻
  FOREIGN KEY (mindmap_id) REFERENCES mindmaps(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- アクティブセッション管理（リアルタイム協調編集用）
CREATE TABLE active_sessions (
  id TEXT PRIMARY KEY,
  mindmap_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  socket_id TEXT NOT NULL,
  cursor_position JSON, -- 現在のカーソル/選択位置
  editing_node_id TEXT, -- 現在編集中のノードID
  last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mindmap_id) REFERENCES mindmaps(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 共有設定
CREATE TABLE mindmap_sharing (
  id TEXT PRIMARY KEY,
  mindmap_id TEXT NOT NULL,
  shared_with_user_id TEXT NOT NULL,
  permission_level TEXT NOT NULL, -- read, write, admin
  shared_by_user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mindmap_id) REFERENCES mindmaps(id) ON DELETE CASCADE,
  FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shared_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(mindmap_id, shared_with_user_id)
);

-- インデックス設計（パフォーマンス最適化）
CREATE INDEX idx_mindmaps_user_id ON mindmaps(user_id);
CREATE INDEX idx_mindmaps_last_modified ON mindmaps(last_modified_at DESC);
CREATE INDEX idx_nodes_mindmap_id ON nodes(mindmap_id);
CREATE INDEX idx_nodes_parent_id ON nodes(parent_id);
CREATE INDEX idx_nodes_updated_at ON nodes(updated_at DESC);
CREATE INDEX idx_operations_mindmap_id_timestamp ON operations(mindmap_id, timestamp DESC);
CREATE INDEX idx_operations_user_id ON operations(user_id);
CREATE INDEX idx_active_sessions_mindmap_id ON active_sessions(mindmap_id);
CREATE INDEX idx_active_sessions_last_heartbeat ON active_sessions(last_heartbeat);
CREATE INDEX idx_attachments_node_id ON attachments(node_id);

-- バージョン管理トリガー
CREATE TRIGGER update_mindmap_version 
AFTER UPDATE ON mindmaps
BEGIN
  UPDATE mindmaps SET version = version + 1, last_modified_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;

CREATE TRIGGER update_node_version 
AFTER UPDATE ON nodes
BEGIN
  UPDATE nodes SET version = version + 1, updated_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;

-- 操作ログ自動挿入トリガー（デバッグ用）
CREATE TRIGGER log_node_operations 
AFTER INSERT ON nodes
BEGIN
  INSERT INTO operations (id, mindmap_id, user_id, operation_type, target_type, target_id, data, vector_clock)
  VALUES (
    hex(randomblob(16)),
    NEW.mindmap_id,
    (SELECT user_id FROM mindmaps WHERE id = NEW.mindmap_id),
    'create',
    'node',
    NEW.id,
    json_object('text', NEW.text, 'x', NEW.x, 'y', NEW.y, 'parent_id', NEW.parent_id),
    json_object('user_' || (SELECT user_id FROM mindmaps WHERE id = NEW.mindmap_id), 1)
  );
END;