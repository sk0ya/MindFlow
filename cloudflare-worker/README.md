# MindFlow Cloudflare Worker API

MindFlow アプリケーション用の Cloudflare Workers API です。D1 データベースを使用してマインドマップデータをクラウドに保存します。

## セットアップ

### 1. 依存関係のインストール

```bash
cd cloudflare-worker
npm install
```

### 2. Cloudflare アカウントの設定

Wrangler CLI にログインします：

```bash
npx wrangler login
```

### 3. D1 データベースの作成

```bash
npx wrangler d1 create mindflow-db
```

コマンド実行後に表示される `database_id` を `wrangler.toml` の `database_id` フィールドに設定してください。

### 4. データベースのマイグレーション

```bash
# ローカル開発用
npx wrangler d1 migrations apply mindflow-db --local

# 本番環境用
npx wrangler d1 migrations apply mindflow-db
```

### 5. 環境変数の設定

`wrangler.toml` で以下を設定：

- `CORS_ORIGIN`: フロントエンドのオリジン（開発時は `http://localhost:3000`）
- `database_id`: 手順3で取得したデータベースID

## 開発

### ローカル開発サーバーの起動

```bash
npm run dev
```

API は `http://localhost:8787` で利用可能になります。

### デプロイ

```bash
npm run deploy
```

## API エンドポイント

すべてのリクエストには `X-User-ID` ヘッダーが必要です。

### マインドマップ一覧取得
```
GET /api/mindmaps
```

### 特定マインドマップ取得
```
GET /api/mindmaps/{id}
```

### マインドマップ作成
```
POST /api/mindmaps
Content-Type: application/json

{
  "title": "新しいマインドマップ",
  "rootNode": { ... },
  ...
}
```

### マインドマップ更新
```
PUT /api/mindmaps/{id}
Content-Type: application/json

{
  "title": "更新されたタイトル",
  "rootNode": { ... },
  ...
}
```

### マインドマップ削除
```
DELETE /api/mindmaps/{id}
```

## フロントエンド側の設定

フロントエンド側で以下を設定してください：

1. `src/utils/cloudStorage.js` の `API_BASE` をデプロイ先URLに更新
2. MindFlow アプリで「クラウド」ボタンから設定画面を開き、ストレージモードを変更

## セキュリティ

現在の実装は基本的な機能に焦点を当てており、簡易的なユーザーID システムを使用しています。本番環境では以下の追加を検討してください：

- 適切な認証システム（OAuth、JWT など）
- CORS 設定の厳密化
- レート制限
- データ暗号化

## トラブルシューティング

### データベース接続エラー
- `wrangler.toml` の `database_id` が正しく設定されているか確認
- マイグレーションが適用されているか確認

### CORS エラー
- `wrangler.toml` の `CORS_ORIGIN` がフロントエンドのオリジンと一致しているか確認

### デプロイエラー
- Cloudflare アカウントにログインしているか確認
- Workers プランが有効になっているか確認