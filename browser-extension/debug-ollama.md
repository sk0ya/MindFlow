# Ollama HTTP 403 エラーのデバッグ手順

## 1. Ollamaサーバーの基本確認

```bash
# Ollamaサーバーが起動していることを確認
curl http://localhost:11434/api/tags

# もしくは
curl http://127.0.0.1:11434/api/tags
```

## 2. 手動でのPOSTリクエストテスト

```bash
# 基本的なテキスト生成リクエストをテスト
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama2",
    "prompt": "Hello, world!",
    "stream": false
  }'
```

## 3. 拡張機能でのデバッグ

1. Chrome拡張機能管理画面 (`chrome://extensions/`) を開く
2. MindFlow Ollama Bridge拡張機能の「service worker」をクリック
3. デベロッパーツールが開くので、Consoleタブでログを確認
4. MindFlowでAI機能を実行して、詳細なログを確認

## 4. 考えられる解決策

### A. Ollamaサーバーの再起動
```bash
# Dockerの場合
docker restart ollama

# 直接起動の場合  
pkill ollama
ollama serve
```

### B. Ollamaの環境変数設定
```bash
# CORSを許可する設定
export OLLAMA_ORIGINS="*"
export OLLAMA_HOST="0.0.0.0:11434"
ollama serve
```

### C. DockerでのOllama起動（推奨）
```bash
docker run -d \
  -v ollama:/root/.ollama \
  -p 11434:11434 \
  -e OLLAMA_ORIGINS="*" \
  -e OLLAMA_HOST="0.0.0.0" \
  --name ollama \
  ollama/ollama
```

## 5. エラーログの確認

拡張機能のConsoleで以下の情報を確認：
- 🔄 Making Ollama request to: [URL]  
- 📤 Final request options: [詳細なリクエスト]
- 📥 Response status: [ステータスコード]
- ❌ エラーメッセージの詳細

これらの情報をもとに問題の原因を特定します。