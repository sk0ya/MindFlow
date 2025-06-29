/**
 * 統一認証システム型定義
 * 全ての認証関連機能の型安全性を確保
 */

// ===== コア型定義 =====

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  provider: AuthProvider;
  createdAt?: string;
  lastLoginAt?: string;
}

export type AuthProvider = 'email' | 'google' | 'github';

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  provider: AuthProvider | null;
  expiresAt: number | null;
  isLoading: boolean;
  error: string | null;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
  redirectUrl?: string;
}

// ===== イベント型定義 =====

export type AuthEventType = 
  | 'login' 
  | 'logout' 
  | 'token_refresh' 
  | 'error'
  | 'state_change';

export interface AuthEvent {
  type: AuthEventType;
  data: any;
  timestamp: number;
  source?: string;
}

export type AuthEventHandler = (event: AuthEvent) => void;

// ===== OAuth設定型定義 =====

export interface OAuthOptions {
  scope?: string[];
  redirectUrl?: string;
  state?: string;
}

export interface GitHubOAuthOptions extends OAuthOptions {
  scope?: Array<'user' | 'user:email' | 'read:user'>;
}

export interface GoogleOAuthOptions extends OAuthOptions {
  scope?: Array<'profile' | 'email' | 'openid'>;
}

// ===== API型定義 =====

export interface AuthConfig {
  apiBaseUrl: string;
  tokenStorageKey: string;
  tokenRefreshThreshold: number;
  autoRefreshEnabled: boolean;
}

export interface MagicLinkOptions {
  email: string;
  redirectUrl?: string;
  expirationMinutes?: number;
}

// ===== 統一認証マネージャーインターフェース =====

export interface IUnifiedAuthManager {
  // ===== 状態プロパティ =====
  readonly state: AuthState;
  readonly isAuthenticated: boolean;
  readonly user: User | null;
  readonly token: string | null;

  // ===== 認証メソッド =====
  login(method: 'email', options: MagicLinkOptions): Promise<AuthResult>;
  login(method: 'google', options?: GoogleOAuthOptions): Promise<AuthResult>;
  login(method: 'github', options?: GitHubOAuthOptions): Promise<AuthResult>;
  
  verifyToken(token: string): Promise<AuthResult>;
  verifyMagicLink(token: string): Promise<AuthResult>;
  logout(): Promise<void>;

  // ===== トークン管理 =====
  refreshToken(): Promise<boolean>;
  getAuthHeader(): string | null;
  isTokenValid(): boolean;
  getTokenExpiration(): number | null;

  // ===== イベント管理 =====
  addEventListener(event: AuthEventType, handler: AuthEventHandler): () => void;
  removeEventListener(event: AuthEventType, handler: AuthEventHandler): void;
  emit(event: AuthEventType, data?: any): void;

  // ===== ユーティリティ =====
  healthCheck(): Promise<boolean>;
  clearError(): void;
  
  // ===== ライフサイクル =====
  initialize(): Promise<void>;
  cleanup(): void;
}

// ===== React フック型定義 =====

export interface UseUnifiedAuthResult {
  // 状態
  state: AuthState;
  isLoading: boolean;
  error: string | null;
  
  // 認証操作
  loginWithEmail: (email: string, options?: Omit<MagicLinkOptions, 'email'>) => Promise<void>;
  loginWithGoogle: (options?: GoogleOAuthOptions) => Promise<void>;
  loginWithGitHub: (options?: GitHubOAuthOptions) => Promise<void>;
  verifyToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  
  // UI状態
  showModal: boolean;
  openModal: () => void;
  closeModal: () => void;
  
  // ユーティリティ
  clearError: () => void;
  healthCheck: () => Promise<boolean>;
  refreshToken: () => Promise<boolean>;
}

// ===== レガシー互換性型定義 =====

export interface LegacyAuthManagerAPI {
  // AuthManager互換
  isAuthenticated(): boolean;
  getCurrentUser(): User | null;
  getAuthToken(): string | null;
  getAuthHeader(): string | null;
  
  // CloudAuthManager互換
  isCloudAuthEnabled(): boolean;
  hasValidCloudToken(): boolean;
  getCloudSyncToken(): string | null;
  
  // useAuth互換
  authState: AuthState;
  updateAuthState: (updates: Partial<AuthState>) => void;
}

// ===== エラー型定義 =====

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export type AuthErrorCode = 
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'INVALID_CREDENTIALS'
  | 'OAUTH_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

// ===== 設定型定義 =====

export interface UnifiedAuthConfig {
  providers: {
    email: {
      enabled: boolean;
      magicLinkExpiration: number;
    };
    google: {
      enabled: boolean;
      clientId?: string;
      redirectUri?: string;
    };
    github: {
      enabled: boolean;
      clientId?: string;
      redirectUri?: string;
    };
  };
  token: {
    storageKey: string;
    refreshThreshold: number;
    autoRefresh: boolean;
  };
  api: {
    baseUrl: string;
    timeout: number;
  };
}

// ===== デフォルト設定 =====

export const DEFAULT_AUTH_CONFIG: UnifiedAuthConfig = {
  providers: {
    email: {
      enabled: true,
      magicLinkExpiration: 15 // 15分
    },
    google: {
      enabled: true,
      redirectUri: '/auth/google/callback'
    },
    github: {
      enabled: true,
      redirectUri: '/auth/github/callback'
    }
  },
  token: {
    storageKey: 'mindflow_auth',
    refreshThreshold: 5 * 60 * 1000, // 5分
    autoRefresh: true
  },
  api: {
    baseUrl: process.env.NODE_ENV === 'development' 
      ? 'http://localhost:8787'
      : 'https://mindflow-api.shigekazukoya.workers.dev',
    timeout: 30000 // 30秒
  }
};