# MindFlow テストガイド

## テスト環境のセットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. テストの実行

```bash
# 全テストを実行
npm test

# ファイル変更を監視してテストを実行
npm run test:watch

# カバレッジレポート付きでテストを実行
npm run test:coverage

# クラウド同期関連のテストのみ実行
npm run test:cloud-sync
```

## テストの構成

### 📁 テストファイルの場所
- `src/hooks/__tests__/` - カスタムフックのテスト
- `src/setupTests.js` - テスト環境の設定
- `jest.config.js` - Jest設定

### 🧪 テストカテゴリ

#### 1. **useMindMapData.test.js** - クラウドデータ管理テスト
- ✅ 編集中データ保護機能
- ✅ 自動保存のスキップ機能
- ✅ 同時保存処理の防止
- ✅ データ更新時の競合保護
- ✅ クラウド同期初期化
- ✅ エラーハンドリング
- ✅ 履歴管理とクラウド同期の連携

#### 2. **useMindMapNodes.test.js** - ノード操作テスト
- ✅ 編集完了時のデータ保護
- ✅ マップ切り替え時の削除保護
- ✅ ノード更新のクラウド同期制御
- ✅ ノード追加/削除のクラウド同期
- ✅ 編集状態管理
- ✅ データ整合性チェック

#### 3. **useMindMapMulti.test.js** - マップ管理テスト
- ✅ マップ切り替え時の編集保護
- ✅ マップデータの整合性チェック
- ✅ マップ一覧管理
- ✅ カテゴリー管理
- ✅ エラーハンドリング

## 重要なテストケース

### 🛡️ データ保護機能

```javascript
test('編集中は自動保存をスキップする', async () => {
  // 編集中の状態をシミュレート
  const mockInput = createMockInput('test-node', 'editing text');
  document.body.appendChild(mockInput);
  mockInput.focus();

  // 自動保存を実行
  await result.current.saveImmediately();

  // 保存がスキップされることを確認
  expect(mockStorageRouter.saveMindMap).not.toHaveBeenCalled();
});
```

### 🔄 マップ切り替え保護

```javascript
test('編集中のノードがある場合、切り替え前に保存される', async () => {
  // 編集中の状態を模擬
  const mockInput = createMockInput('node1', 'edited text');
  document.body.appendChild(mockInput);

  // マップ切り替えを実行
  await result.current.switchToMap('map2', false, /* ... */, mockFinishEdit);

  // 削除保護付きでfinishEditが呼ばれることを確認
  expect(mockFinishEdit).toHaveBeenCalledWith(
    'node1',
    'edited text',
    expect.objectContaining({
      skipMapSwitchDelete: true,
      allowDuringEdit: true,
      source: 'mapSwitch'
    })
  );
});
```

### 🔄 競合状態の処理

```javascript
test('編集中は外部更新をスキップする', async () => {
  // 編集中状態をシミュレート
  const mockInput = createMockInput('test-node', 'editing text');
  mockInput.focus();

  // 外部更新を試行
  await result.current.updateData(newData, { source: 'external' });

  // データが更新されていないことを確認
  expect(result.current.data.title).toBe(originalData.title);
});
```

## モック戦略

### 🎭 外部依存関係のモック

```javascript
jest.mock('../utils/storageRouter.js', () => ({
  getCurrentMindMap: jest.fn(),
  saveMindMap: jest.fn(),
  isCloudStorageEnabled: jest.fn(),
}));
```

### 🌐 DOM環境の模擬

```javascript
const createMockInput = (nodeId, value = '') => {
  const input = document.createElement('input');
  input.classList.add('node-input');
  input.dataset.nodeId = nodeId;
  input.value = value;
  return input;
};
```

## カバレッジ目標

| カテゴリ | 目標カバレッジ |
|----------|----------------|
| Statements | > 90% |
| Branches | > 85% |
| Functions | > 90% |
| Lines | > 90% |

## CI/CD統合

### GitHub Actions

```yaml
- name: Run Tests
  run: npm test -- --coverage --watchAll=false

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage/lcov.info
```

## トラブルシューティング

### よくある問題

1. **DOM関連エラー**: `setupTests.js`でjsdom環境が正しく設定されているか確認
2. **モックエラー**: モジュールパスが正しいか、適切にモックされているか確認
3. **非同期テストのタイムアウト**: `waitFor`や`act`を適切に使用しているか確認

### デバッグ方法

```bash
# 特定のテストファイルのみ実行
npm test -- useMindMapData.test.js

# デバッグモードで実行
npm test -- --verbose

# 失敗したテストのみ再実行
npm test -- --onlyFailures
```

## 新しいテストの追加

1. `src/hooks/__tests__/` ディレクトリに `*.test.js` ファイルを作成
2. 必要なモックを設定
3. テストケースを記述
4. `npm test` で動作確認

## 参考資料

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Hooks](https://react-hooks-testing-library.com/)