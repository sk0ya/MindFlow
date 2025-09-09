// Cloud authentication adapter for Local architecture
import type { AuthAdapter, AuthUser, AuthState, AuthConfig, LoginResponse } from './types';
import { logger } from '../../shared/utils/logger';
import { generateDeviceFingerprint, saveDeviceFingerprint } from '../../shared/utils/deviceFingerprint';
import { STORAGE_KEYS, getLocalStorage, setLocalStorage, removeLocalStorageItems } from '../../shared/utils/localStorage';

const DEFAULT_CONFIG: AuthConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://mindflow-api-production.shigekazukoya.workers.dev',
  tokenKey: 'mindflow_session_token',
  refreshTokenKey: 'mindflow_refresh_token'
};

/**
 * クラウド認証アダプター
 * ID・パスワード認証とJWT管理を提供
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
   * ID・パスワードでログイン
   */
  async loginWithPassword(email: string, password: string): Promise<LoginResponse> {
    this.setLoading(true);
    
    try {
      // デバイスフィンガープリントを生成
      const deviceFingerprint = await generateDeviceFingerprint();
      logger.debug('🔍 Device fingerprint generated for login:', {
        deviceId: deviceFingerprint.deviceId,
        confidence: deviceFingerprint.confidence
      });

      const response = await fetch(`${this.config.apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          password,
          deviceFingerprint: deviceFingerprint.fingerprint
        }),
      });

      let result: LoginResponse;
      
      try {
        result = await response.json();
      } catch (jsonError) {
        logger.error('❌ Failed to parse JSON response:', jsonError);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      logger.debug('🔐 Login response:', {
        status: response.status,
        success: result.success,
        message: result.message,
        hasToken: !!result.token,
        hasUser: !!result.user
      });

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Login failed');
      }

      if (result.token && result.user) {
        // デバイスフィンガープリントを保存
        saveDeviceFingerprint(deviceFingerprint);
        
        this.setAuthenticatedUser(result.user, result.token);
        logger.debug('✅ Login successful for:', result.user.email);
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
   * 既存のloginメソッド（後方互換性のため残す）
   * @deprecated Use loginWithPassword instead
   */
  async login(_email: string): Promise<LoginResponse> {
    // パスワードなしのログインは無効にする
    return { 
      success: false, 
      message: 'パスワードが必要です。loginWithPasswordメソッドを使用してください。' 
    };
  }

  /**
   * Magic linkトークンを検証（デバイスフィンガープリンティング対応）
   * @deprecated Magic link authentication is deprecated
   */
  async verifyMagicLink(_token: string): Promise<{ success: boolean; error?: string }> {
    logger.warn('verifyMagicLink is deprecated. Use loginWithPassword instead.');
    return { 
      success: false, 
      error: 'Magic link認証は無効になりました。ID・パスワードでログインしてください。' 
    };
  }

  /**
   * ログアウト（サーバーサイドセッション無効化対応）
   */
  async logout(): Promise<void> {
    const token = this.getStoredToken();
    
    // サーバーにログアウトを通知してセッションを無効化
    if (token) {
      try {
        await fetch(`${this.config.apiBaseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        logger.debug('📤 Server logout request sent');
      } catch (error) {
        logger.warn('⚠️ Server logout request failed:', error);
        // サーバーエラーがあってもローカルログアウトは続行
      }
    }
    
    this.clearAuthState();
    this.clearStoredTokens();
    
    // デバイスフィンガープリントは保持（次回ログイン時の利便性のため）
    
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
    setLocalStorage(STORAGE_KEYS.AUTH_TOKEN, token);
  }

  /**
   * 保存されたトークンを取得
   */
  private getStoredToken(): string | null {
    const result = getLocalStorage<string>(STORAGE_KEYS.AUTH_TOKEN);
    return result.success ? result.data || null : null;
  }

  /**
   * リフレッシュトークンを取得
   */
  private getStoredRefreshToken(): string | null {
    const result = getLocalStorage<string>(STORAGE_KEYS.REFRESH_TOKEN);
    return result.success ? result.data || null : null;
  }

  /**
   * 保存されたトークンをクリア
   */
  private clearStoredTokens(): void {
    removeLocalStorageItems([STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.REFRESH_TOKEN]);
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
   * セッション検証タイマーを開始（永続セッション対応）
   */
  private startTokenRefreshTimer(): void {
    // 1時間間隔でセッション検証を実行
    this.refreshTimer = setInterval(async () => {
      if (this.isAuthenticated) {
        const token = this.getStoredToken();
        if (token) {
          try {
            const response = await fetch(`${this.config.apiBaseUrl}/api/auth/validate`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            
            if (!response.ok) {
              logger.warn('⚠️ Session validation failed, user may need to login again');
              if (response.status === 401) {
                // セッションが無効化されている場合はログアウト
                this.clearAuthState();
                this.clearStoredTokens();
                this.notifyAuthChange(null);
              }
            } else {
              logger.debug('✅ Session validated successfully');
            }
          } catch (error) {
            logger.warn('⚠️ Session validation error:', error);
          }
        }
      }
    }, 60 * 60 * 1000); // 1 hour
  }
}