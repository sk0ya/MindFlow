# Cloudflare Workers + D1 セットアップガイド

## 1. 前提条件

- Cloudflareアカウント
- Node.js (v18+)
- npm または yarn

## 2. ローカル環境のセットアップ

### Wranglerのインストール
```bash
npm install -g wrangler@latest
# または
npm install --save-dev wrangler@latest
```

### Cloudflareにログイン
```bash
wrangler login
```

## 3. D1データベースの作成

### データベース作成
```bash
cd cloudflare-worker
wrangler d1 create mindflow-db
```

このコマンドを実行すると、以下のような出力が表示されます：

```
✅ Successfully created DB 'mindflow-db'

[[d1_databases]]
binding = "DB"
database_name = "mindflow-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### wrangler.tomlの更新

出力された`database_id`を`wrangler.toml`の該当箇所に追加：

```toml
[[d1_databases]]
binding = "DB"
database_name = "mindflow-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ここに実際のIDを入力
```

## 4. データベーススキーマの適用

### ローカル開発用（オプション）
```bash
wrangler d1 migrations apply mindflow-db --local
```

### 本番用
```bash
wrangler d1 migrations apply mindflow-db
```

## 5. 環境設定

### 開発環境
```bash
# .env.localファイル作成（オプション）
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
```

### 本番環境変数（オプション）
```bash
# Google OAuth用（オプション）
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET

# JWT Secret
wrangler secret put JWT_SECRET
```

## 6. デプロイ

### 開発環境
```bash
wrangler dev
```

### 本番環境
```bash
wrangler deploy
```

## 7. wrangler.toml完全版

\`\`\`toml
name = "mindflow-api"
main = "src/index.js"
compatibility_date = "2023-12-01"

[[d1_databases]]
binding = "DB"
database_name = "mindflow-db"
database_id = ""  # ここに実際のdatabase_idを入力

[vars]
CORS_ORIGIN = "http://localhost:3000"
ENABLE_AUTH = "false"
API_BASE_URL = "http://localhost:8787"
FRONTEND_URL = "http://localhost:3000"

[[env.production]]
name = "mindflow-api-prod"

[env.production.vars]
CORS_ORIGIN = "https://your-domain.com"
ENABLE_AUTH = "true"
API_BASE_URL = "https://mindflow-api-prod.your-domain.workers.dev"
FRONTEND_URL = "https://your-domain.com"

[[env.production.d1_databases]]
binding = "DB"
database_name = "mindflow-db"
database_id = ""  # 同じdatabase_idを使用
\`\`\`

## 8. フロントエンド設定

### API URLの更新
`src/utils/cloudStorage.js`で以下を更新：

\`\`\`javascript
const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://mindflow-api-prod.your-account.workers.dev'  // 実際のURLに変更
  : 'https://mindflow-api.your-account.workers.dev';     // 実際のURLに変更
\`\`\`

## 9. 動作確認

### データベース接続テスト
```bash
# ローカル
curl http://localhost:8787/api/mindmaps
```

### 本番環境
```bash
curl https://mindflow-api-prod.your-account.workers.dev/api/mindmaps
```

## トラブルシューティング

### よくある問題

1. **database_id未設定**
   - `wrangler d1 create`の出力からIDをコピー
   - wrangler.tomlに正しく設定

2. **CORS エラー**
   - `CORS_ORIGIN`が正しく設定されているか確認
   - フロントエンドのURLと一致するか確認

3. **認証エラー**
   - `ENABLE_AUTH`を"false"に設定してテスト
   - JWTシークレットが設定されているか確認

4. **マイグレーションエラー**
   - `migrations/`フォルダが存在するか確認
   - SQLファイルの構文をチェック

## 次のステップ

1. database_idを実際の値に更新
2. ドメインURLを実際の値に更新
3. 認証を有効にする場合はシークレットを設定
4. Google OAuthを使用する場合は追加設定