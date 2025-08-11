// Cloud authentication adapter for Local architecture
import type { AuthAdapter, AuthUser, AuthState, AuthConfig, LoginResponse } from './types';
import { logger } from '../../shared/utils/logger';

const DEFAULT_CONFIG: AuthConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://mindflow-api-production.shigekazukoya.workers.dev',
  tokenKey: 'mindflow_auth_token',
  refreshTokenKey: 'mindflow_refresh_token'
};

/**
 * クラウド認証アダプター
 * Magic link認証とJWT管理を提供
 */
export class CloudAuthAdapter implements AuthAdapter {
  private _authState: AuthState = {
    isAuthenticated: false,
    user: null,
    isLoading: false,
    error: null
  };
  
  private _isInitialized = false;
  private authChangeCallbacks: ((user: AuthUser | null) => void)[] = [];
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(private config: AuthConfig = DEFAULT_CONFIG) {}

  get isAuthenticated(): boolean {
    return this._authState.isAuthenticated;
  }

  get user(): AuthUser | null {
    return this._authState.user;
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  get authState(): AuthState {
    return { ...this._authState };
  }

  /**
   * 認証システムを初期化
   */
  async initialize(): Promise<void> {
    try {
      // 保存されたトークンをチェック
      const token = this.getStoredToken();
      if (token) {
        try {
          await this.validateToken(token);
          logger.debug('✅ CloudAuthAdapter: Stored token validated');
        } catch (validationError) {
          logger.warn('⚠️ CloudAuthAdapter: Stored token invalid, clearing:', validationError);
          this.clearStoredTokens();
          this.clearAuthState();
        }
      }
      
      this._isInitialized = true;
      this.startTokenRefreshTimer();
      logger.debug('✅ CloudAuthAdapter: Initialized');
    } catch (error) {
      logger.error('❌ CloudAuthAdapter: Initialization failed:', error);
      this.clearAuthState();
      this._isInitialized = true;
    }
  }

  /**
   * Magic linkでログイン
   */
  async login(email: string): Promise<LoginResponse> {
    this.setLoading(true);
    
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result: LoginResponse = await response.json();

      logger.debug('📧 Server response:', {
        status: response.status,
        success: result.success,
        emailSent: result.emailSent,
        message: result.message,
        hasToken: !!result.magicLink
      });

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Login failed');
      }

      if (result.emailSent) {
        logger.debug('✅ Magic link email sent to:', email);
      } else {
        logger.debug('⚠️ Email not sent (dev mode), magic link:', result.magicLink);
        
        // 開発モードの場合、Magic Linkを自動的に開く
        // eslint-disable-next-line no-alert
        if (result.magicLink && confirm('メールが送信されませんでした。Magic Linkを直接開きますか？')) {
          window.location.href = result.magicLink;
        }
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      this.setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Magic linkトークンを検証
   */
  async verifyMagicLink(token: string): Promise<{ success: boolean; error?: string }> {
    this.setLoading(true);
    
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const result: LoginResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Token verification failed');
      }

      if (result.token && result.user) {
        this.setAuthenticatedUser(result.user, result.token);
        logger.debug('✅ Magic link verified for:', result.user.email);
        return { success: true };
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      this.setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * ログアウト
   */
  logout(): void {
    this.clearAuthState();
    this.clearStoredTokens();
    this.notifyAuthChange(null);
    logger.debug('👋 User logged out');
  }

  /**
   * 認証ヘッダーを取得
   */
  getAuthHeaders(): Record<string, string> {
    const token = this.getStoredToken();
    if (!token) {
      return {
        'Content-Type': 'application/json',
      };
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  /**
   * トークンをリフレッシュ
   */
  async refreshToken(): Promise<boolean> {
    const refreshToken = this.getStoredRefreshToken();
    if (!refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.apiBaseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const result: LoginResponse = await response.json();

      if (response.ok && result.success && result.token && result.user) {
        this.setAuthenticatedUser(result.user, result.token);
        logger.debug('🔄 Token refreshed');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('❌ Token refresh failed:', error);
      return false;
    }
  }

  /**
   * 認証状態変更のリスナーを登録
   */
  onAuthChange(callback: (user: AuthUser | null) => void): () => void {
    this.authChangeCallbacks.push(callback);
    
    // 現在の状態で即座にコールバック実行
    callback(this.user);
    
    // アンサブスクライブ関数を返す
    return () => {
      const index = this.authChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.authChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.authChangeCallbacks = [];
    logger.debug('🧹 CloudAuthAdapter: Cleanup completed');
  }

  /**
   * 認証済みユーザーを設定
   */
  private setAuthenticatedUser(user: AuthUser, token: string): void {
    this._authState = {
      isAuthenticated: true,
      user,
      isLoading: false,
      error: null
    };
    
    this.storeToken(token);
    this.notifyAuthChange(user);
  }

  /**
   * 認証状態をクリア
   */
  private clearAuthState(): void {
    this._authState = {
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null
    };
  }

  /**
   * ローディング状態を設定
   */
  private setLoading(loading: boolean): void {
    this._authState = {
      ...this._authState,
      isLoading: loading,
      error: loading ? null : this._authState.error
    };
  }

  /**
   * エラー状態を設定
   */
  private setError(error: string): void {
    this._authState = {
      ...this._authState,
      error,
      isLoading: false
    };
  }

  /**
   * 認証変更を通知
   */
  private notifyAuthChange(user: AuthUser | null): void {
    this.authChangeCallbacks.forEach(callback => callback(user));
  }

  /**
   * トークンを保存
   */
  private storeToken(token: string): void {
    localStorage.setItem(this.config.tokenKey, token);
  }

  /**
   * 保存されたトークンを取得
   */
  private getStoredToken(): string | null {
    return localStorage.getItem(this.config.tokenKey);
  }

  /**
   * リフレッシュトークンを取得
   */
  private getStoredRefreshToken(): string | null {
    return localStorage.getItem(this.config.refreshTokenKey);
  }

  /**
   * 保存されたトークンをクリア
   */
  private clearStoredTokens(): void {
    localStorage.removeItem(this.config.tokenKey);
    localStorage.removeItem(this.config.refreshTokenKey);
  }

  /**
   * トークンを検証
   */
  private async validateToken(token: string): Promise<void> {
    const response = await fetch(`${this.config.apiBaseUrl}/api/auth/validate`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const result = await response.json();
      if (result.user) {
        this.setAuthenticatedUser(result.user, token);
      }
    } else {
      throw new Error('Token validation failed');
    }
  }

  /**
   * トークンリフレッシュタイマーを開始
   */
  private startTokenRefreshTimer(): void {
    // 45分間隔でトークンリフレッシュを試行
    this.refreshTimer = setInterval(async () => {
      if (this.isAuthenticated) {
        const success = await this.refreshToken();
        if (!success) {
          logger.warn('⚠️ Token refresh failed, user may need to login again');
        }
      }
    }, 45 * 60 * 1000); // 45 minutes
  }
}