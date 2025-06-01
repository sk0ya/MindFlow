# 🧠 MindFlow

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-4.3.0-646CFF.svg)](https://vitejs.dev/)

マインドマップツールです。

<!-- 🌐 **Live Demo**: [GitHub Pages](https://sk0ya.github.io/MindFlow/) -->
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
- **SVG**: 描画エンジン（React親和性重視）
- **CSS3**: スタイリングとアニメーション
- **React Hooks**: 状態管理（useState, useRef, useCallback）

### 主要なアーキテクチャ
- **カスタムフック**: `useMindMap.js`による集約的状態管理
- **SVGベース描画**: 高性能なベクター描画システム
- **イミュータブル更新**: 効率的なデータ管理パターン
- **最適化**: React.memo、useCallbackによるパフォーマンス最適化

## 📄 ライセンス

このプロジェクトはMITライセンスのもとで公開されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 🙏 謝辞

- **デザインインスピレーション**: MindMeister
- **アイコン**: 絵文字を使用
- **フォント**: システムフォントを使用

