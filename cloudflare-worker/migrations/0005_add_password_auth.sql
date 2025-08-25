-- 0005_add_password_auth.sql
-- ID・パスワード認証のためのスキーマ変更

-- usersテーブルにパスワード関連フィールドを追加
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN salt TEXT;
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN account_locked_until TEXT;
ALTER TABLE users ADD COLUMN password_updated_at TEXT;

-- パスワード履歴テーブル（パスワード再利用防止）
CREATE TABLE IF NOT EXISTS password_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- パスワードリセットトークンテーブル
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history (user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens (token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens (user_id);

-- コメント
-- パスワード認証機能の追加:
-- - password_hash: bcryptハッシュ化されたパスワード
-- - salt: パスワードソルト（bcryptに含まれるが明示的に保存）
-- - failed_login_attempts: ログイン失敗回数
-- - account_locked_until: アカウントロックの解除時刻
-- - password_updated_at: パスワード最終更新日時
-- - password_history: パスワード履歴（再利用防止）
-- - password_reset_tokens: パスワードリセットトークン