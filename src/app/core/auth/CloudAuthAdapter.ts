// Cloud authentication adapter for Local architecture
import type { AuthAdapter, AuthUser, AuthState, AuthConfig, LoginResponse, TokenStorageType } from './types';

const DEFAULT_CONFIG: AuthConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://mindflow-api-production.shigekazukoya.workers.dev',
  tokenKey: 'mindflow_auth_token',
  refreshTokenKey: 'mindflow_refresh_token',
  storageType: 'localStorage'
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
  private memoryToken: string | null = null;

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
          console.log('✅ CloudAuthAdapter: Stored token validated');
        } catch (validationError) {
          console.warn('⚠️ CloudAuthAdapter: Stored token invalid, clearing:', validationError);
          this.clearStoredTokens();
          this.clearAuthState();
        }
      }
      
      this._isInitialized = true;
      this.startTokenRefreshTimer();
      console.log('✅ CloudAuthAdapter: Initialized');
    } catch (error) {
      console.error('❌ CloudAuthAdapter: Initialization failed:', error);
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

      console.log('📧 Server response:', {
        status: response.status,
        success: result.success,
        emailSent: result.emailSent,
        message: result.message,
        hasToken: !!result.magicLink
      });

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Login failed');
      }

      // emailSentフィールドが存在しない場合は、メッセージの内容で判断
      const isEmailSent = result.emailSent !== false && 
        !result.message?.includes('開発環境') && 
        !result.message?.includes('development') &&
        !result.magicLink; // magicLinkが直接返される場合は開発モード

      if (isEmailSent) {
        console.log('✅ Magic link email sent to:', email);
      } else {
        console.log('⚠️ Email not sent (dev mode or server issue), magic link:', result.magicLink);
        
        // 開発モードまたはメール送信失敗の場合
        if (result.magicLink) {
          // eslint-disable-next-line no-alert
          if (confirm('メールが送信されませんでした。Magic Linkを直接開きますか？')) {
            window.location.href = result.magicLink;
          }
        } else {
          // メール送信が期待されているが、サーバー側の問題で送信されていない可能性
          console.warn('⚠️ メールが送信されていない可能性があります。サーバー設定を確認してください。');
          // eslint-disable-next-line no-alert
          alert('メールの送信に問題がある可能性があります。\nメールが届かない場合は、管理者にお問い合わせください。');
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
        console.log('✅ Magic link verified for:', result.user.email);
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
    console.log('👋 User logged out');
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
        console.log('🔄 Token refreshed');
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
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
    console.log('🧹 CloudAuthAdapter: Cleanup completed');
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
    
    console.log('🔐 CloudAuthAdapter: Storing token for user:', user.email);
    this.storeToken(token);
    console.log('🔐 CloudAuthAdapter: Token stored, storage type:', this.getStorageType());
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
   * ストレージタイプを設定/取得
   */
  setStorageType(storageType: TokenStorageType): void {
    // 現在のトークンを退避
    const currentToken = this.getStoredToken();
    
    // 古いストレージタイプから削除
    this.clearStoredTokens();
    
    // 新しいストレージタイプを設定
    this.config.storageType = storageType;
    
    // トークンが存在する場合は新しいストレージに移行
    if (currentToken) {
      this.storeToken(currentToken);
      console.log(`🔐 認証ストレージを${storageType}に変更し、トークンを移行しました`);
    } else {
      console.log(`🔐 認証ストレージを${storageType}に変更しました`);
    }
  }

  getStorageType(): TokenStorageType {
    return this.config.storageType || 'localStorage';
  }

  /**
   * トークンを保存
   */
  private storeToken(token: string): void {
    switch (this.config.storageType) {
      case 'localStorage':
        localStorage.setItem(this.config.tokenKey, token);
        break;
      case 'sessionStorage':
        sessionStorage.setItem(this.config.tokenKey, token);
        break;
      case 'memory':
        this.memoryToken = token;
        break;
      default:
        localStorage.setItem(this.config.tokenKey, token);
    }
  }

  /**
   * 保存されたトークンを取得
   */
  private getStoredToken(): string | null {
    switch (this.config.storageType) {
      case 'localStorage':
        return localStorage.getItem(this.config.tokenKey);
      case 'sessionStorage':
        return sessionStorage.getItem(this.config.tokenKey);
      case 'memory':
        return this.memoryToken;
      default:
        return localStorage.getItem(this.config.tokenKey);
    }
  }

  /**
   * リフレッシュトークンを取得
   */
  private getStoredRefreshToken(): string | null {
    switch (this.config.storageType) {
      case 'localStorage':
        return localStorage.getItem(this.config.refreshTokenKey);
      case 'sessionStorage':
        return sessionStorage.getItem(this.config.refreshTokenKey);
      case 'memory':
        return null; // メモリモードではリフレッシュトークンなし
      default:
        return localStorage.getItem(this.config.refreshTokenKey);
    }
  }

  /**
   * 保存されたトークンをクリア
   */
  private clearStoredTokens(): void {
    // 全てのストレージから削除
    localStorage.removeItem(this.config.tokenKey);
    localStorage.removeItem(this.config.refreshTokenKey);
    sessionStorage.removeItem(this.config.tokenKey);
    sessionStorage.removeItem(this.config.refreshTokenKey);
    this.memoryToken = null;
  }

  /**
   * トークンを検証
   */
  private async validateToken(token: string): Promise<void> {
    try {
      // まずAPIサーバーの健康状態をチェック
      const healthResponse = await fetch(`${this.config.apiBaseUrl}/api/health`);
      if (!healthResponse.ok) {
        throw new Error('API server unhealthy');
      }
      
      const healthResult = await healthResponse.json();
      if (healthResult.status === 'unhealthy') {
        throw new Error('API server reports unhealthy status');
      }

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
        throw new Error(`Token validation failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.warn('⚠️ CloudAuthAdapter: Token validation error:', error);
      throw error;
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
          console.warn('⚠️ Token refresh failed, user may need to login again');
        }
      }
    }, 45 * 60 * 1000); // 45 minutes
  }
}