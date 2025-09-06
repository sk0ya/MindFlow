# MindFlow Ollama Bridge 拡張機能

この Chrome 拡張機能は、デプロイされた MindFlow アプリからローカルの Ollama サーバーにアクセスできるようにします。

## 🎯 目的

- **問題**: デプロイされたWebアプリ (`https://sk0ya.github.io/MindFlow/`) からローカルOllama (`http://localhost:11434`) への直接アクセスはCORSポリシーによりブロックされる
- **解決**: ブラウザ拡張機能がCORSチェックをバイパスして通信を仲介

## 📋 前提条件

1. **Ollama の起動と設定**
   
   **重要**: Ollamaサーバーを起動する前に、ブラウザ拡張機能からのアクセスを許可する環境変数を設定する必要があります：
   
   **Windows (PowerShell):**
   ```powershell
   $env:OLLAMA_ORIGINS="chrome-extension://*,moz-extension://*"
   ollama serve
   ```
   
   **macOS/Linux:**
   ```bash
   export OLLAMA_ORIGINS="chrome-extension://*,moz-extension://*"
   ollama serve
   ```
   
   **Docker の場合:**
   ```bash
   docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama \
     -e OLLAMA_ORIGINS="chrome-extension://*,moz-extension://*" \
     ollama/ollama
   ```

2. **モデルのダウンロード**
   ```bash
   ollama pull llama2
   # または他のお好みのモデル
   ollama pull codellama
   ```

## 🚀 インストール方法

### 1. Chrome への拡張機能の読み込み

1. **Chrome を開く**
2. **アドレスバーに入力**: `chrome://extensions/`
3. **デベロッパーモードを有効化** (右上のトグル)
4. **「パッケージ化されていない拡張機能を読み込む」** をクリック
5. **この `browser-extension` フォルダを選択**

### 2. 拡張機能の設定

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
