-- 0007_create_attachments_table.sql
-- attachmentsテーブルの作成（既存の場合はスキップ）

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    mindmap_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    thumbnail_path TEXT,
    attachment_type TEXT NOT NULL,
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成（IF NOT EXISTSで安全に）
CREATE INDEX IF NOT EXISTS idx_attachments_mindmap_id ON attachments(mindmap_id);
CREATE INDEX IF NOT EXISTS idx_attachments_node_id ON attachments(node_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_at ON attachments(uploaded_at);