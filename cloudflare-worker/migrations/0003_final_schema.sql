-- 0003_final_schema.sql
-- 最終的な効率化されたスキーマ
-- 階層型JSONを完全にやめて、正規化されたリレーショナル構造に移行

-- マインドマップテーブルの効率化（dataカラム削除、メタデータのみ）
ALTER TABLE mindmaps ADD COLUMN category TEXT DEFAULT 'general';
ALTER TABLE mindmaps ADD COLUMN theme TEXT DEFAULT 'default';
ALTER TABLE mindmaps ADD COLUMN settings TEXT DEFAULT '{}';
ALTER TABLE mindmaps ADD COLUMN node_count INTEGER DEFAULT 1;

-- 不要なカラムを削除（data、移行関連フラグ）
-- 注意: ALTER TABLE DROP COLUMN は SQLite では制限があるため、
-- 実際の削除は手動でスキーマを再作成済み

-- ノード管理テーブル
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    mindmap_id TEXT NOT NULL,
    parent_id TEXT,
    text TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'branch',
    position_x REAL DEFAULT 0,
    position_y REAL DEFAULT 0,
    style_settings TEXT DEFAULT '{}',
    notes TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    collapsed BOOLEAN DEFAULT FALSE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mindmap_id) REFERENCES mindmaps(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- 添付ファイル管理
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    thumbnail_path TEXT,
    attachment_type TEXT NOT NULL,
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- リンク管理
CREATE TABLE IF NOT EXISTS node_links (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    domain TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- ノード間接続（将来用）
CREATE TABLE IF NOT EXISTS node_connections (
    id TEXT PRIMARY KEY,
    mindmap_id TEXT NOT NULL,
    from_node_id TEXT NOT NULL,
    to_node_id TEXT NOT NULL,
    connection_type TEXT DEFAULT 'link',
    label TEXT DEFAULT '',
    style_settings TEXT DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mindmap_id) REFERENCES mindmaps(id) ON DELETE CASCADE,
    FOREIGN KEY (from_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (to_node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_mindmaps_user_id ON mindmaps(user_id);
CREATE INDEX IF NOT EXISTS idx_mindmaps_updated_at ON mindmaps(updated_at);
CREATE INDEX IF NOT EXISTS idx_nodes_mindmap_id ON nodes(mindmap_id);
CREATE INDEX IF NOT EXISTS idx_nodes_parent_id ON nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_attachments_node_id ON attachments(node_id);
CREATE INDEX IF NOT EXISTS idx_node_links_node_id ON node_links(node_id);
CREATE INDEX IF NOT EXISTS idx_node_connections_mindmap_id ON node_connections(mindmap_id);