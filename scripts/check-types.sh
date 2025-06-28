#!/bin/bash

echo "🔍 TypeScript型チェック開始..."

# 型チェック実行
npm run type-check

if [ $? -eq 0 ]; then
    echo "✅ 全ての型チェックが成功しました"
    exit 0
else
    echo "❌ 型エラーが検出されました"
    echo ""
    echo "📝 修正が必要な項目:"
    echo "1. 未定義変数の参照"
    echo "2. 型の不整合"
    echo "3. 未使用の変数・パラメータ"
    echo "4. null/undefinedの安全でない操作"
    echo ""
    echo "🛠️ 修正後、再度このスクリプトを実行してください:"
    echo "   bash scripts/check-types.sh"
    exit 1
fi