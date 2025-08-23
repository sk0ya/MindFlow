// Authentication types for cloud mode
export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  createdAt?: string;
  lastLoginAt?: string;
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

export interface AuthConfig {
  apiBaseUrl: string;
  tokenKey: string;
  refreshTokenKey: string;
}

export interface DeviceInfo {
  userAgent: string;
  language: string;
  timezone: string;
  screenResolution: string;
  fingerprint?: string;
}

export interface AuthAdapter {
  readonly isAuthenticated: boolean;
  readonly user: AuthUser | null;
  readonly isInitialized: boolean;
  readonly authState: AuthState;
  
  // Authentication operations
  login(email: string): Promise<LoginResponse>;
  verifyMagicLink(token: string): Promise<{ success: boolean; error?: string }>;
  logout(): Promise<void>;
  
  // Token management
  getAuthHeaders(): Record<string, string>;
  refreshToken(): Promise<boolean>;
  
  // Event handlers
  onAuthChange(callback: (user: AuthUser | null) => void): () => void;
  
  // Lifecycle
  initialize(): Promise<void>;
  cleanup(): void;
}