-- 0003_relational_structure.sql
-- リレーショナル構造への移行
-- 既存の階層型データと並行してリレーショナル型データを管理

-- ノード管理テーブル
CREATE TABLE nodes (
    id TEXT PRIMARY KEY,
    mindmap_id TEXT NOT NULL,
    text TEXT NOT NULL,
    type TEXT DEFAULT 'branch',
    parent_id TEXT,
    position_x REAL DEFAULT 0,
    position_y REAL DEFAULT 0,
    style_settings TEXT DEFAULT '{}',
    notes TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'active',
    collapsed BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mindmap_id) REFERENCES mindmaps (id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES nodes (id) ON DELETE CASCADE
);

-- 添付ファイル管理
CREATE TABLE attachments (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    thumbnail_path TEXT,
    attachment_type TEXT NOT NULL,
    legacy_data_url TEXT, -- 移行期間中のBase64データ保存用
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (node_id) REFERENCES nodes (id) ON DELETE CASCADE
);

-- ノード間接続（マインドマップ以外の関連性）
CREATE TABLE node_connections (
    id TEXT PRIMARY KEY,
    mindmap_id TEXT NOT NULL,
    from_node_id TEXT NOT NULL,
    to_node_id TEXT NOT NULL,
    connection_type TEXT DEFAULT 'association',
    label TEXT DEFAULT '',
    style_settings TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mindmap_id) REFERENCES mindmaps (id) ON DELETE CASCADE,
    FOREIGN KEY (from_node_id) REFERENCES nodes (id) ON DELETE CASCADE,
    FOREIGN KEY (to_node_id) REFERENCES nodes (id) ON DELETE CASCADE
);

-- リンク管理（外部URL）
CREATE TABLE node_links (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT DEFAULT '',
    description TEXT DEFAULT '',
    domain TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (node_id) REFERENCES nodes (id) ON DELETE CASCADE
);

-- パフォーマンス用インデックス
CREATE INDEX idx_nodes_mindmap ON nodes(mindmap_id);
CREATE INDEX idx_nodes_parent ON nodes(parent_id);
CREATE INDEX idx_nodes_updated ON nodes(updated_at);
CREATE INDEX idx_attachments_node ON attachments(node_id);
CREATE INDEX idx_connections_mindmap ON node_connections(mindmap_id);
CREATE INDEX idx_connections_from ON node_connections(from_node_id);
CREATE INDEX idx_connections_to ON node_connections(to_node_id);
CREATE INDEX idx_links_node ON node_links(node_id);

-- 移行フラグ（マインドマップがリレーショナル構造に移行済みかどうか）
ALTER TABLE mindmaps ADD COLUMN migrated_to_relational BOOLEAN DEFAULT FALSE;
ALTER TABLE mindmaps ADD COLUMN migration_date DATETIME DEFAULT NULL;