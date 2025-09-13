# Resend.com メール送信設定ガイド

MindFlowで実際にメールを送信するために、Resend.comのAPIキーを設定する手順です。

## 1. Resend.comアカウント作成

1. [Resend.com](https://resend.com) にアクセス
2. 「Sign up」でアカウント作成（GitHubアカウントでも可）
3. メールアドレスの確認

## 2. APIキーの取得

1. Resendダッシュボードにログイン
2. 左メニューの「API Keys」をクリック
3. 「Create API Key」ボタンをクリック
4. 名前を入力（例: MindFlow Production）
5. 権限を「Sending access」に設定
6. 「Add」をクリック
7. 表示されたAPIキーをコピー（**re_xxxxxxxxx** の形式）

## 3. Cloudflare WorkersでAPIキーを設定

### 方法1: Wrangler CLIで設定（推奨）

```bash
# 本番環境用
wrangler secret put RESEND_API_KEY --env production

# 開発環境用
wrangler secret put RESEND_API_KEY
```

### 方法2: Cloudflare Dashboardで設定

1. [Cloudflare Dashboard](https://dash.cloudflare.com) にログイン
2. 「Workers & Pages」→「mindflow-api」を選択
3. 「Settings」→「Environment variables」
4. 「Add variable」をクリック
5. Variable name: `RESEND_API_KEY`
6. Value: コピーしたAPIキー
7. 「Encrypt」をチェック
8. 「Save」をクリック

## 4. 送信者メールアドレスの設定

Resendでは送信者メールアドレスの検証が必要です：

### 無料プランの場合
- `onboarding@resend.dev` が使用可能（制限あり）
- 月100通まで送信可能

### 独自ドメインを使用する場合
1. Resendダッシュボードで「Domains」をクリック
2. 「Add Domain」で独自ドメインを追加
3. DNS設定でSPF、DKIM、DMARCレコードを追加
4. 検証完了後、独自ドメインから送信可能

## 5. テスト

APIキー設定後、以下のコマンドでテスト：

```bash
curl -X POST https://mindflow-api.shigekazukoya.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com"}'
```

成功すると実際にメールが送信されます。

## 6. 料金プラン

- **無料プラン**: 月100通まで
- **Pro プラン**: 月$20から、月50,000通まで
- 詳細: [Resend Pricing](https://resend.com/pricing)

## 7. トラブルシューティング

### メールが届かない場合
1. スパムフォルダを確認
2. Resendダッシュボードで送信ログを確認
3. APIキーが正しく設定されているか確認

### エラーが発生する場合
1. APIキーの形式を確認（`re_`で始まる）
2. Cloudflare Workersの環境変数を確認
3. Resendの送信制限を確認

## 8. セキュリティ注意事項

- APIキーは秘密情報として管理
- GitHubなどのリポジトリにコミットしない
- 定期的にAPIキーを更新
- 不要になったAPIキーは削除