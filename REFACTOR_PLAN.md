# MindFlow リファクタリング計画

## 現在の問題

1. **複雑なストレージレイヤー**: 複数のストレージアダプター、ルーター、マネージャーが絡み合っている
2. **マップ同期問題**: マップ切り替え時に404エラーやParent node not foundエラーが発生
3. **ID重複問題**: ノードIDの重複でUNIQUE制約違反が発生
4. **複雑なリトライロジック**: エラー処理が複雑すぎて新たなバグを生む

## 新しいシンプル設計

### データベース設計

```sql
-- マップテーブル（JSONでノード構造を保存）
CREATE TABLE maps (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  data TEXT NOT NULL,  -- JSON形式でrootNodeと設定を保存
  owner_email TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX idx_maps_owner ON maps(owner_email);
```

### API設計（RESTful）

```
GET    /api/maps           - マップ一覧取得
POST   /api/maps           - 新しいマップ作成
GET    /api/maps/:id       - 特定マップ取得
PUT    /api/maps/:id       - マップ全体更新
DELETE /api/maps/:id       - マップ削除
```

### フロントエンド構造

```
src/
├── services/              # API通信層
│   ├── api.js            # 単一のAPI client
│   └── storage.js        # ローカル/クラウド切り替え
├── stores/               # 状態管理
│   ├── mapStore.js       # マップ一覧管理  
│   └── currentMap.js     # 現在のマップデータ
├── hooks/                # React hooks
│   ├── useMapList.js     # マップ一覧操作
│   ├── useCurrentMap.js  # 現在マップ操作
│   └── useNode.js        # ノード操作
├── components/           # UI components
│   ├── MapList.jsx
│   ├── Canvas.jsx
│   └── Node.jsx
└── utils/                # ヘルパー
    ├── mapUtils.js
    └── nodeUtils.js
```

## 実装方針

1. **単一責任**: 各ファイルは1つの責任のみを持つ
2. **シンプルAPI**: ノード単位ではなくマップ単位でのみ同期
3. **楽観的更新**: ローカルで即座に更新、バックグラウンドで同期
4. **エラー処理**: シンプルな再試行（最大3回）のみ
5. **IDの単純化**: タイムスタンプベースのシンプルなID生成

## 移行計画

1. 新しいAPIを実装
2. 新しいフロントエンド服務を実装
3. 古いファイルを段階的に削除
4. テストを更新