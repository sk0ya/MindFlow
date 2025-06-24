# MindFlow シンプル版アーキテクチャ

## 作成したファイル

### 🎯 サービス層 (API通信とストレージ)
```
src/services/
├── api.js                      # シンプルなRESTful APIクライアント  
├── storage.js                  # ローカル/クラウド統一ストレージサービス
└── __tests__/
    └── storage.simple.test.js  # ストレージサービステスト
```

### 🪝 フック層 (React状態管理)
```
src/hooks/
├── useMapList.js               # マップ一覧管理
├── useCurrentMap.js            # 現在のマップ管理  
├── useNodes.js                 # ノード操作
└── __tests__/
    └── useNodes.test.js        # ノード操作テスト
```

### 🛠️ ユーティリティ層
```
src/utils/
├── mapUtils.js                 # マップとノードの操作関数
└── __tests__/
    └── mapUtils.test.js        # ユーティリティテスト
```

### 🎨 コンポーネント層
```
src/components/
└── SimpleMindMapApp.jsx        # メインアプリケーションコンポーネント
```

### 📄 エントリーポイント
```
src/
├── SimpleApp.jsx               # シンプル版アプリのエントリー
└── main-simple.jsx             # 開発用メインファイル
```

## データフロー

```
User Input
    ↓
SimpleMindMapApp (UI Component)
    ↓
useNodes/useCurrentMap/useMapList (React Hooks)
    ↓
mapUtils (Pure Functions)
    ↓
storageService (Local/Cloud Abstraction)
    ↓
apiClient (HTTP) | localStorage (Browser Storage)
```

## 主要な改善点

### ✅ シンプル化
- **単一責任**: 各ファイルが1つの明確な責任を持つ
- **フラットな構造**: 深いネストを避けて理解しやすくした
- **最小限のAPI**: 必要最小限の機能のみを提供

### ✅ エラー処理
- **フォールバック**: クラウドエラー時は自動的にローカルにフォールバック
- **シンプルな再試行**: 複雑なリトライロジックを排除

### ✅ テスタビリティ
- **Pure Functions**: mapUtils は純粋関数で副作用なし
- **モック可能**: 各レイヤーが独立してテスト可能
- **最小依存**: 外部依存を最小限に抑制

### ✅ パフォーマンス
- **楽観的更新**: ローカルで即座に更新、バックグラウンドで同期
- **デバウンス保存**: 自動保存は1秒のデバウンスで実行
- **メモリ効率**: 不要なデータの保持を避ける

## 旧システムとの比較

| 項目 | 旧システム | 新システム |
|------|------------|------------|
| ファイル数 | 30+ | 8個 |
| 複雑度 | 高 (多層) | 低 (シンプル) |
| エラー処理 | 複雑なリトライ | シンプルなフォールバック |
| テスト容易性 | 困難 | 容易 |
| バグの発生率 | 高 | 低 |
| 保守性 | 困難 | 容易 |

## 使用方法

### 開発時
```bash
# シンプル版を起動（開発時）
cp src/main-simple.jsx src/main.jsx
npm run dev
```

### テスト
```bash
# 新しいテストのみ実行
npm test -- src/utils/__tests__/mapUtils.test.js
npm test -- src/services/__tests__/storage.simple.test.js  
npm test -- src/hooks/__tests__/useNodes.test.js
```

## 今後の展開

1. **段階的移行**: 既存のコンポーネントをシンプル版に置き換え
2. **機能追加**: 必要に応じて機能を追加（ただしシンプルさを保つ）
3. **バックエンド対応**: 新しいシンプルなAPIエンドポイントの実装
4. **パフォーマンス最適化**: より効率的なデータ構造の採用