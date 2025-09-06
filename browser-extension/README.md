# MindFlow Ollama Bridge 拡張機能

この Chrome 拡張機能は、デプロイされた MindFlow アプリからローカルの Ollama サーバーにアクセスできるようにします。

## 🎯 目的

- **問題**: デプロイされたWebアプリ (`https://sk0ya.github.io/MindFlow/`) からローカルOllama (`http://localhost:11434`) への直接アクセスはCORSポリシーによりブロックされる
- **解決**: ブラウザ拡張機能がCORSチェックをバイパスして通信を仲介

## 📋 前提条件

1. **Ollama の起動**
   ```bash
   # Dockerの場合
   docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
   
   # 直接インストールの場合
   ollama serve
   ```

2. **モデルのダウンロード**
   ```bash
   ollama pull llama2
   # または他のお好みのモデル
   ollama pull codellama
   ```

## 🚀 インストール方法

### 1. 拡張機能のビルド準備

アイコンファイルを準備します（PNG形式が必要）：

```bash
# SVGファイルからPNGに変換（オンラインツール推奨）
# - https://cloudconvert.com/svg-to-png
# - https://convertio.co/svg-png/
# 
# 必要なサイズ: 16x16, 48x48, 128x128 pixels
```

生成されたSVGファイルをオンラインツールでPNGに変換し、以下に配置：
- `icons/icon-16.png`
- `icons/icon-48.png`  
- `icons/icon-128.png`

### 2. Chrome への拡張機能の読み込み

1. **Chrome を開く**
2. **アドレスバーに入力**: `chrome://extensions/`
3. **デベロッパーモードを有効化** (右上のトグル)
4. **「パッケージ化されていない拡張機能を読み込む」** をクリック
5. **この `browser-extension` フォルダを選択**

### 3. 拡張機能の設定

1. **拡張機能アイコンをクリック** (ブラウザのツールバー)
2. **Ollama URL を確認/設定** (デフォルト: `http://localhost:11434`)
3. **「接続テスト」ボタンをクリック**
4. **✅ 接続成功** が表示されることを確認

## 💡 使用方法

### 1. MindFlow でAI機能を有効化

1. **MindFlow を開く**: https://sk0ya.github.io/MindFlow/
2. **サイドバーで AI機能タブを開く** 🤖
3. **「AI子ノード生成を有効にする」** をチェック
4. **接続テストを実行** → 拡張機能経由で成功するはず

### 2. AI子ノード生成の実行

1. **マインドマップでノードを右クリック**
2. **「AI子ノード生成」を選択**  
3. **AIが自動的に関連する子ノードを生成**

## 🔧 動作原理

```
MindFlow Web App (https://sk0ya.github.io)
        ↓
Content Script (注入されたAPI)
        ↓  
Background Script (拡張機能内)
        ↓ [CORSバイパス]
Local Ollama Server (http://localhost:11434)
```

1. **Content Script**: WebページにMindFlowOllamaBridge APIを注入
2. **Background Script**: 実際のOllama APIリクエストを処理（CORS制限なし）
3. **Message Passing**: WebページとBackground Script間でメッセージを交換

## 🐛 トラブルシューティング

### 接続失敗の場合

1. **Ollamaサーバーの確認**
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. **拡張機能の再読み込み**
   - `chrome://extensions/` で拡張機能を無効化→有効化

3. **コンソールログの確認**
   - F12 → Console で拡張機能のログを確認

### よくあるエラー

- **"Failed to fetch"**: Ollama が起動していない
- **"Connection timeout"**: Ollama のポート設定を確認  
- **"Extension not available"**: 拡張機能が正しく読み込まれていない

## 📝 開発者向け情報

### ファイル構成

```
browser-extension/
├── manifest.json          # 拡張機能の設定
├── scripts/
│   ├── background.js      # Background Script (Ollama通信)
│   ├── content.js         # Content Script (メッセージ中継)
│   └── injected.js        # Injected Script (API提供)
├── popup.html            # 設定UI
├── popup.js              # 設定UIの動作
└── icons/                # アイコンファイル
```

### デバッグ方法

1. **Background Script**: `chrome://extensions/` → 拡張機能の「background page」をクリック
2. **Content Script**: 通常のWeb開発者ツール (F12)
3. **Popup**: ポップアップを右クリック → 「検証」

## 🔒 セキュリティ

- 拡張機能は **localhost のみ** にアクセス許可を設定
- **最小限の権限** のみを要求
- **リクエストログ** でトラフィックを監視可能

## 📄 ライセンス

このプロジェクトと同様のライセンスで提供されます。