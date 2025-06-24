# MindFlow Cloud Sync Architecture Overview

## システム概要

MindFlowのクラウドストレージモードは、リアルタイム協調編集、自動競合解決、オフライン対応を備えた包括的な同期システムです。

### 主要機能
- ✅ **リアルタイム同期** - WebSocketベースの即座な変更反映
- ✅ **協調編集** - 複数ユーザーによる同時編集サポート
- ✅ **自動競合解決** - 操作変換(OT)による透明な競合処理
- ✅ **オフライン対応** - ネットワーク切断時の操作キューイング
- ✅ **認証統合** - GitHub OAuth による安全なアクセス制御

## アーキテクチャ構成

### 1. データベース層 (Cloudflare D1)
```sql
-- 主要テーブル
users              -- ユーザー管理
mindmaps           -- マインドマップメタデータ
nodes              -- ノードデータ（フラット構造）
attachments        -- ファイル添付
operations         -- 操作ログ（同期用）
active_sessions    -- アクティブセッション管理
```

**特徴:**
- SQLiteベースの高速クエリ
- バージョン管理による楽観的同期
- ベクタークロックを用いた分散タイムスタンプ

### 2. バックエンド層 (Cloudflare Workers)
```javascript
// 主要コンポーネント
AuthMiddleware     -- GitHub OAuth認証
DatabaseService    -- D1データベース操作
SyncService        -- 操作ベース同期処理
WebSocketManager   -- リアルタイム通信管理
```

**API エンドポイント:**
- `GET /api/mindmaps` - マインドマップ一覧
- `GET /api/mindmaps/:id` - 特定マップ取得
- `POST /api/mindmaps` - マップ保存
- `POST /api/sync/operation` - 操作同期
- `WebSocket /ws` - リアルタイム通信

### 3. フロントエンド層 (React + WebSocket)
```javascript
// 同期システムコンポーネント
CloudSyncService      -- 統合同期サービス
SyncStateManager      -- 同期状態管理
OperationQueue        -- 操作キューイング
WebSocketManager      -- リアルタイム通信
ConflictResolver      -- 競合解決エンジン
```

**Reactフック統合:**
```javascript
const { 
  syncState,
  createNode,
  updateNode,
  forceSync
} = useCloudSync(mindmapId);
```

## 同期メカニズム

### 操作ベース同期 (Operation-Based Sync)
```javascript
// 操作の定義
{
  id: "op_123456789",
  operation_type: "create|update|delete|move",
  target_type: "node|attachment",
  target_id: "node_abc123",
  data: { /* 操作データ */ },
  vector_clock: { "user_1": 5, "user_2": 3 },
  timestamp: "2025-01-24T10:30:00.000Z"
}
```

### 競合解決戦略
1. **ベクタークロック比較** による並行性検出
2. **操作変換(OT)** による自動マージ
3. **ラスト・ライター・ウィンズ** によるフォールバック
4. **フィールドレベル競合解決** による細粒度制御

### 典型的な競合シナリオ
```javascript
// シナリオ1: 同時テキスト編集
User A: text "Hello" → "Hello World"
User B: text "Hello" → "Hello Japan"
解決策: タイムスタンプ + ユーザーID順による勝者決定

// シナリオ2: 削除 vs 更新
User A: ノード削除
User B: 同ノード更新
解決策: 削除操作を優先

// シナリオ3: 同時移動
User A: ノードを (100, 200) に移動
User B: 同ノードを (150, 250) に移動
解決策: 最後の操作が勝利
```

## リアルタイム協調編集

### WebSocketイベント
```javascript
// 協調編集イベント
'collab:cursor_update'    -- カーソル位置共有
'collab:editing_start'    -- 編集開始通知
'collab:editing_end'      -- 編集終了通知
'collab:user_join'        -- ユーザー参加
'collab:user_leave'       -- ユーザー離脱

// 同期イベント
'sync:operation'          -- 操作同期
'sync:operation_ack'      -- 同期確認
'sync:conflict'           -- 競合通知
```

### プレゼンス管理
```javascript
// ユーザープレゼンス情報
{
  userId: "user_123",
  username: "john_doe",
  avatarUrl: "https://...",
  cursorPosition: { x: 100, y: 200 },
  editingNodeId: "node_abc",
  connectionStatus: "online",
  lastActivity: "2025-01-24T10:30:00.000Z"
}
```

## オフライン対応

### 操作キューイング
```javascript
// オフライン時の操作蓄積
pendingOperations = [
  { type: "create", nodeId: "temp_1", ... },
  { type: "update", nodeId: "node_123", ... },
  { type: "delete", nodeId: "node_456", ... }
];

// オンライン復帰時の一括同期
await processOperationQueue();
```

### 競合防止策
- **編集状態保護** - 編集中は自動保存を停止
- **一意ID生成** - タイムスタンプ+ランダム値によるID重複回避
- **リトライ機構** - 失敗操作の自動再試行（最大3回）

## パフォーマンス最適化

### 効率的なデータ構造
```sql
-- ノードのフラット構造（高速クエリ）
CREATE INDEX idx_nodes_mindmap_id ON nodes(mindmap_id);
CREATE INDEX idx_nodes_parent_id ON nodes(parent_id);
CREATE INDEX idx_operations_mindmap_timestamp ON operations(mindmap_id, timestamp DESC);
```

### ネットワーク最適化
- **操作バッチング** - 複数操作の一括送信
- **レート制限** - メッセージ頻度制御
- **圧縮** - WebSocket メッセージ圧縮
- **ハートビート** - 30秒間隔での接続維持

### メモリ管理
- **操作履歴制限** - 最新100操作のみ保持
- **ガベージコレクション** - 古いセッション情報の自動削除
- **弱参照使用** - メモリリークの防止

## セキュリティ

### 認証・認可
```javascript
// GitHub OAuth フロー
1. フロントエンド → GitHub認証
2. アクセストークン取得
3. バックエンドでトークン検証
4. ユーザー情報をD1に保存/更新
```

### データ保護
- **HTTPS強制** - 全通信の暗号化
- **トークン検証** - 各API呼び出しで認証確認
- **CORS制御** - クロスオリginリクエスト制限
- **レート制限** - DoS攻撃防止

## 監視・ログ

### パフォーマンス指標
```javascript
{
  connectionQuality: "excellent|good|poor|bad",
  averageLatency: 45, // ms
  messageRate: 12,    // messages/minute
  errorRate: 0.02,    // 2%
  bandwidthUsage: 1024 // bytes/minute
}
```

### エラー追跡
- **操作失敗ログ** - 同期エラーの詳細記録
- **競合解決ログ** - 競合発生と解決履歴
- **パフォーマンスログ** - レイテンシとスループット
- **ユーザー行動ログ** - 編集パターン分析

## 今後の拡張性

### 水平スケーリング
- **シャーディング** - マインドマップID基準の分散
- **レプリケーション** - 読み取り専用レプリカ
- **CDN統合** - 静的アセットの配信最適化

### 機能拡張
- **音声・動画添付** - マルチメディア対応
- **リアルタイム音声** - ボイスチャット統合
- **AI支援** - 自動レイアウト・内容提案
- **バージョン履歴** - 変更履歴の可視化

## 実装優先度

### Phase 1 (必須)
- [x] データベーススキーマ
- [x] 基本API実装
- [x] 認証システム
- [x] 基本同期機能

### Phase 2 (重要)
- [ ] リアルタイム通信
- [ ] 競合解決
- [ ] オフライン対応
- [ ] パフォーマンス最適化

### Phase 3 (拡張)
- [ ] 協調編集UI
- [ ] 詳細ログ・監視
- [ ] 管理ダッシュボード
- [ ] API公開・拡張

この設計により、MindFlowは堅牢で高性能なクラウド同期機能を提供し、複数ユーザーによる快適な協調編集体験を実現します。