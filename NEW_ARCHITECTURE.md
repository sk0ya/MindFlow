# 新しいデータ管理アーキテクチャ（V2）

## 概要

新しいDataManagerベースのアーキテクチャは、従来の複雑で混在していた保存・同期システムを統一し、データ整合性を保証する設計です。

## 主要コンポーネント

### 1. DataManager (`utils/dataManager.js`)
**責任**: 全ての保存・同期操作の統括管理

#### 特徴
- **Single Source of Truth**: 全てのデータ操作が一つの場所を通る
- **楽観的更新**: UI更新を即座に行い、バックエンド同期を並行実行
- **操作ベースの設計**: 各操作タイプに応じた保存戦略を適用
- **オフライン対応**: ネットワーク断絶時の操作キューイング
- **緊急保存**: ページ離脱時の未保存データ保護

#### 操作タイプと保存戦略

| 操作タイプ | 遅延時間 | バッチ化 | 用途 |
|------------|----------|----------|------|
| TEXT_EDIT | 1000ms | ✓ | テキスト編集 |
| NODE_ADD | 0ms | ✗ | ノード追加 |
| NODE_DELETE | 0ms | ✗ | ノード削除 |
| NODE_MOVE | 100ms | ✓ | ドラッグ移動 |
| FILE_ATTACH | 0ms | ✗ | ファイル添付 |
| FILE_REMOVE | 0ms | ✗ | ファイル削除 |
| LAYOUT_CHANGE | 500ms | ✓ | レイアウト変更 |
| METADATA_UPDATE | 300ms | ✓ | メタデータ更新 |

#### データフロー
```
USER_ACTION → OPTIMISTIC_UPDATE → UI_NOTIFICATION → SCHEDULED_SAVE → DB_SYNC
                                      ↓
                                  IMMEDIATE_UI_UPDATE
```

### 2. 統合フック群

#### useMindMapDataV2 (`hooks/useMindMapDataV2.js`)
- DataManagerとの統合
- 初期化とクラウド同期
- 履歴管理（Undo/Redo）
- 同期状態監視

#### useMindMapNodesV2 (`hooks/useMindMapNodesV2.js`)
- ノード操作のDataManager連携
- 楽観的更新
- オートレイアウト統合

#### useMindMapFilesV2 (`hooks/useMindMapFilesV2.js`)
- ファイル操作の統一処理
- R2ストレージとローカルストレージの透明な切り替え
- セキュリティ検証統合

#### useMindMapV2 (`hooks/useMindMapV2.js`)
- 全機能の統合API
- 既存コードとの互換性維持

## 利点

### 1. **データ整合性の保証**
- 全ての操作がDataManagerを通るため、データの整合性が保証される
- 楽観的更新により、UIの応答性を保ちながら確実な保存を実現

### 2. **保存の確実性**
- 重要な操作（ノード追加/削除、ファイル添付）は即座保存
- テキスト編集は適切なデバウンス付き
- ページ離脱時の緊急保存機能

### 3. **オフライン対応**
- ネットワーク断絶時の操作キューイング
- オンライン復帰時の自動同期

### 4. **パフォーマンス最適化**
- 操作タイプに応じた最適な保存戦略
- バッチ化可能な操作の効率的処理

### 5. **デバッグ性の向上**
- 全ての操作がログ出力される
- 同期状態の可視化
- 操作の追跡可能性

## 移行戦略

### フェーズ1: 既存システムとの並行運用
1. 新しいV2フックを作成（完了）
2. テスト環境での動作確認
3. 段階的な機能移行

### フェーズ2: 完全移行
1. MindMapApp.jsxでuseMindMapV2に切り替え
2. 旧フックの段階的削除
3. パフォーマンステスト

### フェーズ3: 最適化
1. DataManagerの機能拡張
2. リアルタイム同期の統合
3. パフォーマンス最適化

## 使用方法

### 基本的な使用
```javascript
import { useMindMapV2 } from './hooks/useMindMapV2.js';

const MyComponent = () => {
  const {
    data,
    syncStatus,
    updateNodeText,
    addNode,
    deleteNode,
    attachFile,
    forceSync
  } = useMindMapV2(isAppReady, currentMapId);
  
  // ノードテキスト更新
  const handleTextEdit = async (nodeId, text) => {
    await updateNodeText(nodeId, text);
  };
  
  // ノード追加
  const handleAddNode = async (parentId) => {
    await addNode(parentId, { text: '新しいノード' });
  };
  
  return <div>...</div>;
};
```

### 同期状態の監視
```javascript
const { syncStatus } = useMindMapV2();

console.log('同期状態:', {
  isOnline: syncStatus.isOnline,
  syncInProgress: syncStatus.syncInProgress,
  pendingOperations: syncStatus.pendingOperations,
  lastSaveTime: syncStatus.lastSaveTime
});
```

## 今後の拡張

### 1. リアルタイム同期の統合
- WebSocket接続の管理
- 競合解決アルゴリズム
- マルチユーザー対応

### 2. オフライン機能の強化
- ServiceWorker統合
- バックグラウンド同期
- 競合解決の改善

### 3. パフォーマンス最適化
- 部分更新の実装
- インクリメンタル同期
- メモリ使用量の最適化

## 注意事項

### 旧システムとの互換性
- 既存のupdateData、setData等のメソッドは非推奨だが互換性維持
- 段階的移行のため、一時的に両システムが並存

### デバッグ情報
- 全ての操作は詳細なログを出力
- ブラウザの開発者ツールで同期状態を確認可能
- syncStatusで現在の状態を監視

### エラーハンドリング
- 全ての操作は成功/失敗の結果を返す
- 失敗時の自動リトライ機能
- ユーザーへの適切なエラー通知