# MindFlow Cloudflare Worker API

MindFlow アプリケーション用の Cloudflare Workers API です。D1 データベースを使用してマインドマップデータをクラウドに保存します。

## セットアップ

### 1. 依存関係のインストール

```bash
cd backend
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

### 5. R2ストレージの設定（ファイル機能用）

```bash
npx wrangler r2 bucket create mindflow-files
```

### 6. 環境変数の設定

`wrangler.toml` で以下を設定：

**開発環境:**
- `CORS_ORIGIN`: フロントエンドのオリジン（`http://localhost:3000`）
- `ENABLE_AUTH`: 認証の有効/無効（`"false"`）
- `database_id`: 手順3で取得したデータベースID
- R2バケット設定（`FILES`バインディング）

**本番環境:**
- `CORS_ORIGIN`: 本番フロントエンドのオリジン（`https://sk0ya.github.io`）
- `ENABLE_AUTH`: 認証を有効化（`"true"`）
- `ALLOWED_EMAILS`: 許可されたメールアドレス

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

### 認証エンドポイント
```
POST /api/auth/magic-link - マジックリンク送信
GET /api/auth/verify?token=xxx - トークン検証
GET /api/auth/user - ユーザー情報取得
POST /api/auth/logout - ログアウト
```

### マインドマップエンドポイント
認証が有効な場合、認証トークンが必要です。

```
GET /api/mindmaps - マインドマップ一覧取得
GET /api/mindmaps/{id} - 特定マインドマップ取得
POST /api/mindmaps - マインドマップ作成
PUT /api/mindmaps/{id} - マインドマップ更新
DELETE /api/mindmaps/{id} - マインドマップ削除
```

### ファイルエンドポイント
R2ストレージを使用したファイル管理：

```
POST /api/files/upload - ファイルアップロード
GET /api/files/{fileId} - ファイル取得
DELETE /api/files/{fileId} - ファイル削除
GET /api/files/mindmap/{mindmapId} - マインドマップ関連ファイル一覧
```

### ヘルスチェック
```
GET /api/health - APIの動作確認
```

## フロントエンド側の設定

MindFlowアプリでは以下のように動作します：

1. **マジックリンク認証**: URLに `?token=xxx` が含まれている場合、自動的にクラウドモードに切り替わります
2. **ストレージモード**: ローカル設定でストレージモードが永続化されます
3. **動的切り替え**: `src/App.tsx` で環境に応じて適切なコンポーネントが読み込まれます

## セキュリティ

本番環境では以下のセキュリティ機能が実装されています：

- **マジックリンク認証**: メール認証による安全なログイン
- **トークンベース認証**: JWTトークンによるセッション管理
- **メールアドレス制限**: `ALLOWED_EMAILS` による許可リスト
- **CORS設定**: 適切なオリジン制限
- **ファイルストレージ**: R2による安全なファイル管理

## 利用可能なコマンド

```bash
npm run dev              # 開発サーバー起動
npm run deploy           # 本番デプロイ
npm run db:create        # D1データベース作成
npm run db:migrate       # ローカル環境でマイグレーション実行
npm run db:migrate:prod  # 本番環境でマイグレーション実行
```

## トラブルシューティング

### データベース接続エラー
- `wrangler.toml` の `database_id` が正しく設定されているか確認
- マイグレーションが適用されているか確認
- D1データベースが作成されているか確認

### 認証エラー
- メール送信機能が正しく設定されているか確認
- `ALLOWED_EMAILS` に利用者のメールアドレスが含まれているか確認
- トークンの有効期限が切れていないか確認

### ファイルアップロードエラー
- R2バケット（`mindflow-files`）が作成されているか確認
- R2バインディングが正しく設定されているか確認

### CORS エラー
- `wrangler.toml` の `CORS_ORIGIN` がフロントエンドのオリジンと一致しているか確認

### デプロイエラー
- Cloudflare アカウントにログインしているか確認
- Workers プランが有効になっているか確認
- R2ストレージが利用可能か確認