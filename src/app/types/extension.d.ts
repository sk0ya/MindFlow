/**
 * MindFlow Ollama Bridge Extension Type Definitions
 */

declare global {
  interface Window {
    MindFlowOllamaBridge?: {
      version: string;
      available: boolean;
      
      /**
       * Ollamaリクエストを送信
       */
      request(url: string, options: RequestInit): Promise<{
        success: boolean;
        data?: any;
        error?: string;
        status?: number;
      }>;
      
      /**
       * Ollama接続をテスト
       */
      testConnection(baseUrl: string): Promise<{
        success: boolean;
        error?: string;
        message?: string;
      }>;
      
      /**
       * 利用可能なモデル一覧を取得
       */
      getModels(baseUrl: string): Promise<string[]>;
    };
  }
}

export {};