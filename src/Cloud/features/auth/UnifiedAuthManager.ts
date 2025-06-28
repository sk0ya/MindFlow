/**
 * 統一認証マネージャー
 * 全ての認証機能を統合し、型安全なAPIを提供
 */

import { 
  IUnifiedAuthManager, 
  AuthState, 
  AuthResult, 
  AuthEventType, 
  AuthEventHandler, 
  AuthEvent,
  User,
  MagicLinkOptions,
  GoogleOAuthOptions,
  GitHubOAuthOptions,
  UnifiedAuthConfig,
  DEFAULT_AUTH_CONFIG,
  AuthError
} from './types/authTypes.js';

// レガシーマネージャーのインポート（段階的移行用）
import { authManager as legacyAuthManager } from './authManager.js';

export class UnifiedAuthManager implements IUnifiedAuthManager {
  private _state: AuthState;
  private eventListeners: Map<AuthEventType, Set<AuthEventHandler>>;
  private config: UnifiedAuthConfig;
  private tokenRefreshInterval: number | null = null;

  constructor(config: Partial<UnifiedAuthConfig> = {}) {
    this.config = { ...DEFAULT_AUTH_CONFIG, ...config };
    this._state = {
      isAuthenticated: false,
      user: null,
      token: null,
      provider: null,
      expiresAt: null,
      isLoading: false,
      error: null
    };
    this.eventListeners = new Map();
    
    // 自動初期化
    this.initialize();
  }

  // ===== 状態プロパティ =====
  
  get state(): AuthState {
    return { ...this._state };
  }

  get isAuthenticated(): boolean {
    return this._state.isAuthenticated && this.isTokenValid();
  }

  get user(): User | null {
    return this._state.user;
  }

  get token(): string | null {
    return this._state.token;
  }

  /**
   * 認証状態を取得
   * @returns 現在の認証状態
   */
  getAuthState(): AuthState {
    return { ...this._state };
  }

  // ===== 認証メソッド =====

  async login(method: 'email', options: MagicLinkOptions): Promise<AuthResult>;
  async login(method: 'google', options?: GoogleOAuthOptions): Promise<AuthResult>;
  async login(method: 'github', options?: GitHubOAuthOptions): Promise<AuthResult>;
  async login(method: string, options?: any): Promise<AuthResult> {
    this.setState({ isLoading: true, error: null });

    try {
      let result: AuthResult;

      switch (method) {
        case 'email':
          result = await this.loginWithEmail(options);
          break;
        case 'google':
          result = await this.loginWithGoogle(options);
          break;
        case 'github':
          result = await this.loginWithGitHub(options);
          break;
        default:
          throw new AuthError(`Unsupported login method: ${method}`, 'INVALID_METHOD');
      }

      if (result.success && result.user && result.token) {
        await this.setAuthData(result.user, result.token);
        this.emit('login', { user: result.user, method });
      }

      return result;
    } catch (error) {
      const authError = error instanceof AuthError ? error : 
        new AuthError((error as Error).message || 'Login failed', 'UNKNOWN_ERROR');
      
      this.setState({ error: authError.message });
      this.emit('error', { error: authError, method });
      
      return { success: false, error: authError.message };
    } finally {
      this.setState({ isLoading: false });
    }
  }

  async verifyToken(token: string): Promise<AuthResult> {
    this.setState({ isLoading: true, error: null });

    try {
      // レガシーマネージャーを使用（段階的移行）
      const result = await legacyAuthManager.handleAuthCallback(token);
      
      if (result.success && result.user) {
        const userWithProvider = { ...result.user, provider: 'email' as const };
        await this.setAuthData(userWithProvider, token);
        this.emit('login', { user: userWithProvider, method: 'token_verification' });
      }

      return {
        ...result,
        user: result.user ? { ...result.user, provider: 'email' as const } : undefined
      };
    } catch (error) {
      const authError = new AuthError((error as Error).message || 'Token verification failed', 'INVALID_TOKEN');
      this.setState({ error: authError.message });
      this.emit('error', { error: authError });
      
      return { success: false, error: authError.message };
    } finally {
      this.setState({ isLoading: false });
    }
  }

  async verifyMagicLink(token: string): Promise<AuthResult> {
    try {
      // レガシーマネージャーを使用
      const result = await legacyAuthManager.verifyMagicLink(token);
      
      if (result.success && result.user) {
        const userWithProvider = { ...result.user, provider: 'email' as const };
        await this.setAuthData(userWithProvider, result.token || token);
        this.emit('login', { user: userWithProvider, method: 'magic_link' });
      }

      return {
        ...result,
        user: result.user ? { ...result.user, provider: 'email' as const } : undefined
      };
    } catch (error) {
      const authError = new AuthError((error as Error).message || 'Magic link verification failed', 'INVALID_TOKEN');
      this.setState({ error: authError.message });
      return { success: false, error: authError.message };
    }
  }

  async logout(): Promise<void> {
    try {
      // レガシーマネージャーでログアウト
      await legacyAuthManager.logout();
      
      // 状態をクリア
      this.clearAuthData();
      this.emit('logout');
    } catch (error) {
      console.error('Logout error:', error);
      // エラーがあってもローカル状態はクリア
      this.clearAuthData();
      this.emit('logout');
    }
  }

  // ===== トークン管理 =====

  async refreshToken(): Promise<boolean> {
    if (!this._state.token) return false;

    try {
      // レガシーマネージャーでリフレッシュ
      const success = await legacyAuthManager.refreshToken();
      
      if (success) {
        // 新しいトークンを取得
        const newToken = legacyAuthManager.getAuthToken();
        if (newToken) {
          this.setState({ token: newToken });
          this.emit('token_refresh', { token: newToken });
        }
      }

      return success;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  getAuthHeader(): string | null {
    return this._state.token ? `Bearer ${this._state.token}` : null;
  }

  isTokenValid(): boolean {
    if (!this._state.token || !this._state.expiresAt) return false;
    return Date.now() < this._state.expiresAt;
  }

  getTokenExpiration(): number | null {
    return this._state.expiresAt;
  }

  // ===== イベント管理 =====

  addEventListener(event: AuthEventType, handler: AuthEventHandler): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    this.eventListeners.get(event)!.add(handler);
    
    // アンサブスクライブ関数を返す
    return () => {
      this.removeEventListener(event, handler);
    };
  }

  removeEventListener(event: AuthEventType, handler: AuthEventHandler): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  emit(event: AuthEventType, data?: any): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      const eventObject: AuthEvent = {
        type: event,
        data,
        timestamp: Date.now(),
        source: 'UnifiedAuthManager'
      };

      handlers.forEach(handler => {
        try {
          handler(eventObject);
        } catch (error) {
          console.error(`Error in auth event handler for ${event}:`, error);
        }
      });
    }
  }

  // ===== 便利メソッド =====

  /**
   * 認証状態変更時のリスナーを追加（簡易API）
   * @param callback - 認証状態変更時のコールバック
   * @returns アンサブスクライブ関数
   */
  onAuthStateChange(callback: (authState: AuthState) => void): () => void {
    return this.addEventListener('state_change', (event) => {
      callback(this._state);
    });
  }

  /**
   * ログインイベントのリスナーを追加
   * @param callback - ログイン時のコールバック
   * @returns アンサブスクライブ関数
   */
  onLogin(callback: (user: User) => void): () => void {
    return this.addEventListener('login', (event) => {
      if (event.data?.user) {
        callback(event.data.user);
      }
    });
  }

  /**
   * ログアウトイベントのリスナーを追加
   * @param callback - ログアウト時のコールバック
   * @returns アンサブスクライブ関数
   */
  onLogout(callback: () => void): () => void {
    return this.addEventListener('logout', () => {
      callback();
    });
  }

  // ===== ユーティリティ =====

  async healthCheck(): Promise<boolean> {
    try {
      // 簡単なヘルスチェック
      const response = await fetch(`${this.config.api.baseUrl}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  clearError(): void {
    this.setState({ error: null });
  }

  // ===== ライフサイクル =====

  async initialize(): Promise<void> {
    try {
      // レガシーマネージャーから現在の状態を読み込み
      const isAuth = legacyAuthManager.isAuthenticated();
      const user = legacyAuthManager.getCurrentUser();
      const token = legacyAuthManager.getAuthToken();

      if (isAuth && user && token) {
        await this.setAuthData(user, token);
      }

      // 自動トークンリフレッシュを開始
      if (this.config.token.autoRefresh) {
        this.setupTokenRefresh();
      }

      this.emit('state_change', { initialized: true });
    } catch (error) {
      console.error('Auth initialization error:', error);
    }
  }

  cleanup(): void {
    // タイマーをクリア
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }

    // イベントリスナーをクリア
    this.eventListeners.clear();
  }

  // ===== プライベートメソッド =====

  private async loginWithEmail(options: MagicLinkOptions): Promise<AuthResult> {
    // レガシーマネージャーを使用
    return await legacyAuthManager.sendMagicLink(options.email);
  }

  private async loginWithGoogle(_options?: GoogleOAuthOptions): Promise<AuthResult> {
    // レガシーマネージャーを使用
    return await legacyAuthManager.loginWithGoogle();
  }

  private async loginWithGitHub(_options?: GitHubOAuthOptions): Promise<AuthResult> {
    // CloudAuthManagerの機能が必要な場合は別途実装
    throw new AuthError('GitHub login not yet implemented in unified manager', 'NOT_IMPLEMENTED');
  }

  private async setAuthData(user: import('./types/authTypes').User, token: string): Promise<void> {
    // JWTからexpを取得（簡易実装）
    let expiresAt: number | null = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      expiresAt = payload.exp ? payload.exp * 1000 : null;
    } catch (error) {
      console.warn('Failed to parse token expiration:', error);
    }

    this.setState({
      isAuthenticated: true,
      user,
      token,
      provider: user.provider,
      expiresAt,
      error: null
    });

    // レガシーマネージャーにも設定
    const legacyUser = {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      avatar: user.avatar
    };
    await legacyAuthManager.setAuthData(token, legacyUser);
    
    // ログインイベントを発火
    this.emit('login', { user, token });
  }

  private clearAuthData(): void {
    this.setState({
      isAuthenticated: false,
      user: null,
      token: null,
      provider: null,
      expiresAt: null,
      error: null
    });
  }

  private setState(updates: Partial<AuthState>): void {
    this._state = { ...this._state, ...updates };
    this.emit('state_change', updates);
  }

  private setupTokenRefresh(): void {
    // 1分ごとにトークンの有効期限をチェック
    this.tokenRefreshInterval = window.setInterval(() => {
      if (this._state.token && this._state.expiresAt) {
        const timeUntilExpiry = this._state.expiresAt - Date.now();
        
        // しきい値に達したらリフレッシュ
        if (timeUntilExpiry < this.config.token.refreshThreshold) {
          this.refreshToken();
        }
      }
    }, 60000);
  }
}

// シングルトンインスタンス
export const unifiedAuthManager = new UnifiedAuthManager();