-- データベースパフォーマンス最適化のためのインデックス追加
-- 実行日: 2025-01-25

-- ===== パフォーマンス最適化インデックス =====

-- 1. ノード関連の最適化
-- 座標範囲での検索を高速化（ビューポート内ノード取得）
CREATE INDEX IF NOT EXISTS idx_nodes_position ON nodes(mindmap_id, position_x, position_y);

-- 親子関係の検索を高速化
CREATE INDEX IF NOT EXISTS idx_nodes_parent_created ON nodes(parent_id, created_at);

-- ノードタイプによる検索を高速化
CREATE INDEX IF NOT EXISTS idx_nodes_type_mindmap ON nodes(mindmap_id, type);

-- 2. マインドマップ関連の最適化
-- ユーザーのマインドマップ一覧取得を高速化（更新日順）
CREATE INDEX IF NOT EXISTS idx_mindmaps_user_updated ON mindmaps(user_id, updated_at DESC);

-- アクティブなマインドマップの検索を高速化
CREATE INDEX IF NOT EXISTS idx_mindmaps_user_active ON mindmaps(user_id, is_deleted) 
WHERE is_deleted = 0;

-- 3. 接続関連の最適化
-- ソースノードからの接続検索を高速化
CREATE INDEX IF NOT EXISTS idx_connections_source ON node_connections(source_node_id, created_at);

-- ターゲットノードへの接続検索を高速化
CREATE INDEX IF NOT EXISTS idx_connections_target ON node_connections(target_node_id, created_at);

-- 4. 添付ファイル関連の最適化
-- ノードの添付ファイル検索を高速化
CREATE INDEX IF NOT EXISTS idx_attachments_node ON attachments(node_id, created_at);

-- ファイルタイプによる検索を高速化
CREATE INDEX IF NOT EXISTS idx_attachments_type ON attachments(file_type, created_at);

-- 5. リンク関連の最適化
-- ノードのリンク検索を高速化
CREATE INDEX IF NOT EXISTS idx_links_node ON node_links(node_id, created_at);

-- ドメインによる検索を高速化
CREATE INDEX IF NOT EXISTS idx_links_domain ON node_links(domain, created_at);

-- 6. 認証関連の最適化
-- トークンの有効性検証を高速化
CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token, expires_at);

-- ユーザーの有効トークン検索を高速化
CREATE INDEX IF NOT EXISTS idx_auth_tokens_email_expires ON auth_tokens(email, expires_at);

-- ===== 統計情報テーブル =====

-- マインドマップ統計テーブル（集計データキャッシュ用）
CREATE TABLE IF NOT EXISTS mindmap_stats (
  mindmap_id TEXT PRIMARY KEY,
  node_count INTEGER DEFAULT 0,
  connection_count INTEGER DEFAULT 0,
  attachment_count INTEGER DEFAULT 0,
  link_count INTEGER DEFAULT 0,
  last_activity DATETIME,
  avg_response_time REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mindmap_id) REFERENCES mindmaps(id) ON DELETE CASCADE
);

-- API使用統計テーブル（パフォーマンス監視用）
CREATE TABLE IF NOT EXISTS api_metrics (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  user_id TEXT,
  response_time_ms INTEGER,
  status_code INTEGER,
  error_message TEXT,
  request_size INTEGER,
  response_size INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API統計用インデックス
CREATE INDEX IF NOT EXISTS idx_api_metrics_endpoint_time ON api_metrics(endpoint, timestamp);
CREATE INDEX IF NOT EXISTS idx_api_metrics_user_time ON api_metrics(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_api_metrics_status_time ON api_metrics(status_code, timestamp);

-- ===== トリガー: 統計情報の自動更新 =====

-- ノード追加時の統計更新
CREATE TRIGGER IF NOT EXISTS update_stats_on_node_insert
AFTER INSERT ON nodes
BEGIN
  INSERT OR REPLACE INTO mindmap_stats (
    mindmap_id, node_count, last_activity, updated_at
  ) VALUES (
    NEW.mindmap_id,
    COALESCE((SELECT node_count FROM mindmap_stats WHERE mindmap_id = NEW.mindmap_id), 0) + 1,
    NEW.created_at,
    CURRENT_TIMESTAMP
  );
END;

-- ノード削除時の統計更新
CREATE TRIGGER IF NOT EXISTS update_stats_on_node_delete
AFTER DELETE ON nodes
BEGIN
  UPDATE mindmap_stats 
  SET 
    node_count = GREATEST(0, node_count - 1),
    updated_at = CURRENT_TIMESTAMP
  WHERE mindmap_id = OLD.mindmap_id;
END;

-- 接続追加時の統計更新
CREATE TRIGGER IF NOT EXISTS update_stats_on_connection_insert
AFTER INSERT ON node_connections
BEGIN
  UPDATE mindmap_stats 
  SET 
    connection_count = connection_count + 1,
    last_activity = NEW.created_at,
    updated_at = CURRENT_TIMESTAMP
  WHERE mindmap_id = (
    SELECT mindmap_id FROM nodes WHERE id = NEW.source_node_id
  );
END;

-- 接続削除時の統計更新
CREATE TRIGGER IF NOT EXISTS update_stats_on_connection_delete
AFTER DELETE ON node_connections
BEGIN
  UPDATE mindmap_stats 
  SET 
    connection_count = GREATEST(0, connection_count - 1),
    updated_at = CURRENT_TIMESTAMP
  WHERE mindmap_id = (
    SELECT mindmap_id FROM nodes WHERE id = OLD.source_node_id
  );
END;

-- ===== パフォーマンス監視ビュー =====

-- 最近のアクティビティビュー
CREATE VIEW IF NOT EXISTS recent_activity AS
SELECT 
  m.id as mindmap_id,
  m.title,
  m.user_id,
  ms.node_count,
  ms.connection_count,
  ms.last_activity,
  ms.avg_response_time,
  CASE 
    WHEN ms.last_activity > datetime('now', '-1 hour') THEN 'active'
    WHEN ms.last_activity > datetime('now', '-1 day') THEN 'recent'
    ELSE 'inactive'
  END as activity_status
FROM mindmaps m
LEFT JOIN mindmap_stats ms ON m.id = ms.mindmap_id
WHERE m.is_deleted = 0
ORDER BY ms.last_activity DESC;

-- API パフォーマンスサマリービュー
CREATE VIEW IF NOT EXISTS api_performance_summary AS
SELECT 
  endpoint,
  method,
  COUNT(*) as request_count,
  AVG(response_time_ms) as avg_response_time,
  MIN(response_time_ms) as min_response_time,
  MAX(response_time_ms) as max_response_time,
  COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
  (COUNT(CASE WHEN status_code >= 400 THEN 1 END) * 100.0 / COUNT(*)) as error_rate
FROM api_metrics
WHERE timestamp > datetime('now', '-24 hours')
GROUP BY endpoint, method
ORDER BY avg_response_time DESC;

-- ===== 設定の最適化 =====

-- SQLite最適化設定（D1で有効なもの）
PRAGMA optimize;

-- ===== 実行完了ログ =====
INSERT INTO api_metrics (
  id, endpoint, method, response_time_ms, status_code, timestamp
) VALUES (
  'db_optimization_' || strftime('%Y%m%d_%H%M%S', 'now'),
  '/migration/optimize_database',
  'EXECUTE',
  0,
  200,
  CURRENT_TIMESTAMP
);