# マップ切り替え時のノードデータ消失問題 調査報告書

## 問題の概要

**症状**: マップ切り替え時に追加したノードが消失し、ログに「rootNodeChildren: 0」と表示される

**報告されたシナリオ**:
1. ノードを追加・編集
2. マップを切り替える
3. 元のマップに戻ると、追加したノードが消えている

## 調査結果

### 1. クライアント側のクローン処理

**検証結果**: ✅ **正常動作**
- `deepClone()` 関数は正しく動作
- `assignColorsToExistingNodes()` でのディープクローンも正常
- 参照共有の問題なし

**検証方法**: `debug_map_switch.js`でのテスト実行
```javascript
// 参照独立性テスト結果
参照独立性: { 
  rootNode: true, 
  children: true, 
  firstChild: true 
}
```

### 2. サーバー側データ処理のシミュレーション

**検証結果**: ✅ **正常動作**
- JSON シリアライゼーション/デシリアライゼーション正常
- `buildHierarchicalStructure()` の親子関係構築正常
- リレーショナル→階層構造変換正常

**検証方法**: `debug_server_data.js`でのシミュレーション
```
データ整合性: ✅ 正常
元のデータ子ノード数: 2
最終データ子ノード数: 2
```

### 3. 実際の問題の可能性

シミュレーションでは問題が再現されないため、以下の実際の環境における問題が疑われます：

#### A. **サーバー側の保存タイミング問題**

**仮説**: `switchToMap`関数内の保存処理（248行目）で、編集中のデータが正しく保存されていない可能性

```javascript
// useMindMapMulti.js:248
const adapter = getCurrentAdapter();
await adapter.updateMap(data.id, data);
```

**問題点**:
- マップ切り替え前の編集状態が保護されているが、実際のデータ保存で失敗している可能性
- `data`オブジェクトが最新状態でない可能性

#### B. **サーバー側の認証・ユーザー判定問題**

**根拠**: `cloudflare-worker/src/handlers/mindmaps.js` の認証処理

```javascript
// JWT認証とX-User-ID認証の混在
if (env.ENABLE_AUTH === 'true') {
  userId = authResult.user.userId; // JWT: email
} else {
  userId = request.headers.get('X-User-ID') || 'default-user';
}
```

**問題点**:
- 保存時と取得時で異なるuserIdが使用される可能性
- 認証状態の変更によるデータアクセス権限の変化

#### C. **データベースレベルでの同期問題**

**仮説**: Cloudflare D1データベースでの読み書き整合性

**問題点**:
- 書き込み後の即座読み込みで、レプリケーションラグによるデータ不整合
- トランザクション内での複数ノード処理での部分失敗

### 4. 特定すべき調査ポイント

#### **最優先**: サーバー側のログ確認

1. **updateMindMapCloud の実際のリクエスト内容**
   ```javascript
   // cloudStorage.js:267 のログ強化が必要
   console.log('送信データ:', JSON.stringify(dataToSend, null, 2));
   ```

2. **Cloudflare Worker側の実際の保存結果**
   ```javascript
   // mindmaps.js:449 での実際のバッチ実行結果確認
   console.log('🚀 バッチ実行開始（総文数:', statements.length, '）');
   ```

3. **データベース内の実際のノード数確認**
   ```sql
   SELECT COUNT(*) FROM nodes WHERE mindmap_id = ? AND parent_id = 'root';
   ```

#### **中優先**: 認証状態の確認

1. **マップ保存時と取得時のuserIdの一致確認**
2. **JWT認証の有効性確認**
3. **認証ヘッダーの整合性確認**

#### **低優先**: クライアント側の状態管理

1. **マップ切り替え時の`data`オブジェクトの実際の内容**
2. **編集状態とデータ同期のタイミング**

## 推奨する修正方針

### 1. **即座対応**: ログ強化による問題特定

以下の箇所でログを強化し、実際の問題を特定：

```javascript
// useMindMapMulti.js switchToMap 関数内
console.log('💾 マップ切り替え前保存データ:', {
  mapId: data.id,
  title: data.title,
  rootNodeChildren: data.rootNode?.children?.length || 0,
  childrenIds: data.rootNode?.children?.map(c => c.id) || []
});

// cloudStorage.js updateMindMapCloud 関数内  
console.log('📤 実際の送信データ:', {
  rootNodeChildren: dataToSend.rootNode?.children?.length || 0,
  childrenIds: dataToSend.rootNode?.children?.map(c => c.id) || []
});
```

### 2. **中期対応**: データ整合性チェック機能

```javascript
// useMindMapMulti.js switchToMap 関数内
// 取得後のデータ検証
if (originalTargetMap.rootNode?.children?.length !== coloredMap.rootNode?.children?.length) {
  console.error('❌ データ不整合検出:', {
    original: originalTargetMap.rootNode?.children?.length,
    processed: coloredMap.rootNode?.children?.length
  });
  // 必要に応じてデータ復旧処理
}
```

### 3. **長期対応**: リアルタイム同期の改善

- WebSocket接続によるリアルタイムデータ同期
- クライアント側でのローカルキャッシュとサーバー同期の分離
- 楽観的更新（Optimistic Updates）の実装

## 結論

- **クライアント側の処理は正常**：クローン機能、データ構造変換に問題なし
- **問題はサーバー側またはネットワーク層**：保存・取得・認証のいずれかで発生
- **即座対応が必要**：詳細ログによる実際の問題特定が最優先

## 次のアクション

1. **ログ強化版をデプロイ**し、実際のユーザーデータでテスト
2. **Cloudflare Workers ログ**でサーバー側の実際の動作確認
3. **D1データベース**の直接確認による実データ検証
4. 問題特定後、適切な修正を実装

---

*調査日: 2025-01-22*  
*調査者: Claude Code Assistant*