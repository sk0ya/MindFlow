// Cloudflare Worker環境の型定義

export interface Environment {
  // Bindings
  DB: D1Database;
  FILES: R2Bucket;
  
  // Environment Variables
  CORS_ORIGIN: string;
  ENABLE_AUTH: string;
  API_BASE_URL: string;
  FRONTEND_URL: string;
  ALLOWED_EMAILS: string;
  NODE_ENV: string;
  FROM_EMAIL: string;
  
  // Secrets (環境変数として設定される)
  RESEND_KEY: string;
  ADMIN_KEY: string;
  JWT_SECRET: string;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export interface WorkerRequest extends Request {
  cf?: IncomingRequestCfProperties;
}

export interface WorkerResponse extends Response {
  webSocket?: WebSocket;
}