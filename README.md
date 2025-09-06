# 🧠 MindFlow

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-4.3.0-646CFF.svg)](https://vitejs.dev/)

マインドマップツールです。

🌐 **Live Demo**: [GitHub Pages](https://sk0ya.github.io/MindFlow/)
📦 **Repository**: [GitHub](https://github.com/sk0ya/MindFlow)
## 🚀 セットアップ

### 必要な環境
- Node.js 16.0.0 以上
- npm または yarn

### インストール
```bash
# リポジトリをクローン
git clone https://github.com/sk0ya/MindFlow.git
cd MindFlow

# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# ビルド
npm run build

# プレビュー
npm run preview
```

## ✨ 主要機能

### 🎯 基本機能
- **ノード作成・編集**: ダブルクリックで簡単編集、Enter/Escでの操作確定・キャンセル
- **階層構造**: 無制限の子ノード・兄弟ノード作成（Tab/Enterキー）
- **ドラッグ&ドロップ**: ノードを自由に移動・配置
- **ビジュアル表現**: 美しいノードデザイン（角丸、影効果）と滑らかなカーブ接続線

### 🤖 AI機能
- **AI子ノード生成**: ローカルOllama連携による自動的な関連ノード生成
- **Chrome拡張機能**: CORS制限を回避してデプロイ版からローカルOllamaにアクセス
- **右クリックメニュー**: ノードから簡単にAI子ノード生成を実行

### 💾 データ管理
- **自動保存**: リアルタイムでの変更保存（ローカルストレージ）
- **履歴管理**: Undo/Redo機能（最大50件）
- **インポート/エクスポート**: JSON形式でのデータ交換
- **複数マップ管理**: 複数のマインドマップを管理

### ⌨️ キーボードショートカット
- `Tab`: 子ノード追加
- `Enter`: 兄弟ノード追加
- `Space`: ノード編集
- `Delete`: ノード削除
- `Escape`: 選択解除/パネル閉じる
- `Ctrl+S`: 保存
- `Ctrl+Z`: Undo
- `Ctrl+Y` / `Ctrl+Shift+Z`: Redo

## 🛠️ 技術スタック

### フロントエンド
- **React 18.2.0**: コンポーネントベース開発
- **Vite 4.3.0**: 高速ビルドツール
- **TypeScript**: 型安全な開発
- **SVG**: 描画エンジン（React親和性重視）
- **CSS3**: スタイリングとアニメーション
- **Zustand**: 軽量状態管理ライブラリ

### AI機能
- **Ollama**: ローカルLLM実行環境
- **Chrome Extension**: CORS制限回避のためのブラウザ拡張機能
- **Content Scripts**: WebページへのAPI注入

### 主要なアーキテクチャ
- **フック化アーキテクチャ**: 機能別に分離されたカスタムフック
  - `useMindMapData`: データ・ノード操作
  - `useMindMapUI`: UI状態管理
  - `useMindMapActions`: アクション・履歴管理
  - `useMindMapPersistence`: ストレージ・永続化
- **モジュラー設計**: 機能ベースの組織化
- **SVGベース描画**: 高性能なベクター描画システム
- **自動レイアウト**: ノード配置の自動計算
- **ストレージモード**: ローカル・クラウドの動的切り替え

## 🤖 AI機能の使い方

### 1. ローカル環境での利用
```bash
# Ollamaの起動
ollama serve

# モデルのダウンロード
ollama pull llama2
```

### 2. デプロイ版でのAI機能利用
Chrome拡張機能を使用してCORS制限を回避：

1. **拡張機能のインストール**
   - `browser-extension/` フォルダをChrome拡張として読み込む
   
2. **Ollamaの設定**
   ```bash
   # Windows (PowerShell)
   $env:OLLAMA_ORIGINS="chrome-extension://*,moz-extension://*"
   ollama serve
   
   # macOS/Linux
   export OLLAMA_ORIGINS="chrome-extension://*,moz-extension://*"
   ollama serve
   ```

3. **使用方法**
   - [GitHub Pages](https://sk0ya.github.io/MindFlow/)でMindFlowを開く
   - サイドバーでAI機能を有効化
   - ノードを右クリックして「AI子ノード生成」を実行

## 📄 ライセンス

このプロジェクトはMITライセンスのもとで公開されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 🙏 謝辞

- **デザインインスピレーション**: MindMeister
- **アイコン**: 絵文字を使用
- **フォント**: システムフォントを使用

