-- セッション管理テーブルの作成
-- デバイス識別とセキュリティ強化のための永続セッション

-- ユーザーセッションテーブル
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    device_hash TEXT NOT NULL,
    device_info TEXT, -- JSON形式でデバイス情報を保存
    expires_at TEXT NOT NULL, -- ISO8601形式
    created_at TEXT NOT NULL, -- ISO8601形式
    last_accessed_at TEXT NOT NULL, -- ISO8601形式
    access_count INTEGER DEFAULT 0,
    revoked_at TEXT, -- セッション無効化時刻
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_device ON user_sessions (user_id, device_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_accessed ON user_sessions (last_accessed_at);

-- 既存の認証トークンテーブルに有効期限インデックスを追加（最適化）
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires ON auth_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens (user_id);

-- セッションの統計情報を保存するテーブル（オプション）
CREATE TABLE IF NOT EXISTS session_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- login, logout, session_extend, device_change
    device_hash TEXT,
    timestamp TEXT NOT NULL,
    metadata TEXT, -- JSON形式で追加情報
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- セッション統計のインデックス
CREATE INDEX IF NOT EXISTS idx_session_stats_user_timestamp ON session_stats (user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_session_stats_event_type ON session_stats (event_type);

-- ビューを作成：アクティブセッション
CREATE VIEW IF NOT EXISTS active_sessions AS
SELECT 
    s.*,
    u.id as user_email,
    julianday('now') - julianday(s.last_accessed_at) as days_since_last_access
FROM user_sessions s
JOIN users u ON s.user_id = u.id
WHERE s.expires_at > datetime('now') 
  AND s.revoked_at IS NULL;

-- ビューを作成：セッション統計サマリー
CREATE VIEW IF NOT EXISTS session_summary AS
SELECT 
    user_id,
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN expires_at > datetime('now') AND revoked_at IS NULL THEN 1 END) as active_sessions,
    MAX(last_accessed_at) as last_activity,
    MIN(created_at) as first_session
FROM user_sessions
GROUP BY user_id;