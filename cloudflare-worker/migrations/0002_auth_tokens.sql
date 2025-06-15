-- Magic Link認証用のトークンテーブル
CREATE TABLE auth_tokens (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT
);

-- 期限切れトークンの効率的な削除用インデックス
CREATE INDEX idx_auth_tokens_expires_at ON auth_tokens(expires_at);
CREATE INDEX idx_auth_tokens_email ON auth_tokens(email);
CREATE INDEX idx_auth_tokens_token ON auth_tokens(token);