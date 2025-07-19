// Authentication types for cloud mode
export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: AuthUser;
  emailSent?: boolean;
  magicLink?: string;
}

export type TokenStorageType = 'localStorage' | 'sessionStorage' | 'memory';

export interface AuthConfig {
  apiBaseUrl: string;
  tokenKey: string;
  refreshTokenKey: string;
  storageType?: TokenStorageType;
}

export interface AuthAdapter {
  readonly isAuthenticated: boolean;
  readonly user: AuthUser | null;
  readonly isInitialized: boolean;
  readonly authState: AuthState;
  
  // Authentication operations
  login(email: string): Promise<LoginResponse>;
  verifyMagicLink(token: string): Promise<{ success: boolean; error?: string }>;
  logout(): void;
  
  // Token management
  getAuthHeaders(): Record<string, string>;
  refreshToken(): Promise<boolean>;
  
  // Storage management
  setStorageType?(storageType: TokenStorageType): void;
  getStorageType?(): TokenStorageType;
  
  // Event handlers
  onAuthChange(callback: (user: AuthUser | null) => void): () => void;
  
  // Lifecycle
  initialize(): Promise<void>;
  cleanup(): void;
}