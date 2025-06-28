# TypeScript型安全性ガイド

## 概要

MindFlowは段階的にTypeScript型安全性を強化し、ビルド時にエラーを検出できるようになっています。

## 型チェック設定

### 厳格な型チェック有効化

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "exactOptionalPropertyTypes": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noImplicitReturns": true,
  "noUncheckedIndexedAccess": true
}
```

## 型チェックコマンド

### 基本的な型チェック
```bash
npm run type-check
```

### 型安全ビルド
```bash
npm run build:safe  # 型チェック + ビルド
```

### 完全ビルド
```bash
npm run build:full  # 型チェック + Viteビルド
```

### スクリプト型チェック
```bash
bash scripts/check-types.sh
```

## 型定義済みコンポーネント

### ✅ 完了
- **AuthModal.tsx** - 完全型定義
- **useKeyboardShortcuts.ts** - インターフェース定義
- **authManager.ts** - 完全TypeScript化

### 🚧 進行中
- **MindMapApp.tsx** - 部分的型定義
- **統一認証システム** - 型定義強化中

### 📋 予定
- **MindMapCanvas.tsx**
- **Node.jsx → Node.tsx**
- **各種Hook類の型定義**

## 開発ガイドライン

### 1. 新しいコンポーネント作成時

```typescript
// ✅ 良い例
interface ComponentProps {
  title: string;
  onClose: () => void;
  isVisible: boolean;
}

const Component: React.FC<ComponentProps> = ({ title, onClose, isVisible }) => {
  // 実装
};

// ❌ 悪い例
const Component = ({ title, onClose, isVisible }) => {
  // 型定義なし
};
```

### 2. 関数の型定義

```typescript
// ✅ 良い例
const handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
  // 実装
};

// ❌ 悪い例
const handleClick = (event) => {
  // 型定義なし
};
```

### 3. useEffectの依存配列

```typescript
// ✅ 良い例
useEffect(() => {
  // 実装
}, [dependency1, dependency2]); // 全ての依存関係を明記

// ❌ 悪い例
useEffect(() => {
  // 実装
}, []); // 依存関係が不完全
```

### 4. nullチェック

```typescript
// ✅ 良い例
if (user?.email) {
  // user.emailが存在する場合のみ実行
}

// ❌ 悪い例
if (user.email) {
  // userがnullの場合エラー
}
```

## エラーの種類と対処法

### 1. `Property does not exist on type`
```typescript
// 解決法: インターフェースで型定義
interface User {
  id: string;
  email: string;
}
```

### 2. `Parameter implicitly has 'any' type`
```typescript
// 解決法: パラメータに型を指定
const handleChange = (value: string): void => {
  // 実装
};
```

### 3. `Variable is declared but never used`
```typescript
// 解決法: 未使用変数を削除または_で開始
const _unusedVariable = value; // 明示的に未使用
```

### 4. `Object is possibly 'null'`
```typescript
// 解決法: nullチェックを追加
if (element !== null) {
  element.style.color = 'red';
}
```

## 段階的移行計画

### フェーズ1 (完了)
- 基本設定と主要コンポーネント

### フェーズ2 (進行中)
- 認証システムとルーティング

### フェーズ3 (予定)
- データ管理とストレージ

### フェーズ4 (予定)
- UI コンポーネント全般

## トラブルシューティング

### TypeScript型エラーが多すぎる場合

1. **段階的に修正**
   ```bash
   # 特定のファイルのみチェック
   npx tsc --noEmit src/specific-file.tsx
   ```

2. **一時的に型チェックを緩く**
   ```json
   // tsconfig.json (開発時のみ)
   {
     "strict": false,
     "noImplicitAny": false
   }
   ```

3. **型定義ファイルの追加**
   ```bash
   npm install @types/library-name
   ```

## 参考リソース

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React TypeScript Guide](https://react-typescript-cheatsheet.netlify.app/)
- [TypeScript ESLint Rules](https://typescript-eslint.io/rules/)

---

型安全性の向上により、開発時のバグを大幅に削減し、保守性を向上させています。