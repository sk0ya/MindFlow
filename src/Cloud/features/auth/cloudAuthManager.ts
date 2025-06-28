import { authManager } from './authManager.js';

/**
 * CloudAuthManager - クラウド同期用認証拡張
 * 既存のAuthManagerを拡張してクラウド同期機能に対応
 */
class CloudAuthManager {
  private readonly GITHUB_CLIENT_ID = undefined; // Remove Vite env dependency
  private readonly GITHUB_REDIRECT_URI = undefined; // Remove Vite env dependency
  private readonly API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:8787' 
    : 'https://mindflow-api-production.shigekazukoya.workers.dev';
  
  private authEventListeners: Set<(event: AuthEvent) => void> = new Set();
  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  
  constructor() {
    this.setupAuthEventHandling();
    this.startTokenMonitoring();
  }

  /**
   * 認証イベントハンドリングを設定
   */
  private setupAuthEventHandling() {
    // 既存のAuthManagerの状態変化を監視
    const originalLogin = authManager.login;
    const originalLogout = authManager.logout;

    // ログイン成功時の処理を拡張
    authManager.login = async (email: string) => {
      const result = await originalLogin.call(authManager, email);
      this.notifyAuthEvent('login_success', authManager.getCurrentUser());
      return result;
    };

    // ログアウト時の処理を拡張
    authManager.logout = () => {
      const result = originalLogout.call(authManager);
      this.notifyAuthEvent('logout', null);
      return result;
    };
  }

  /**
   * トークン監視を開始
   */
  private startTokenMonitoring() {
    this.tokenRefreshTimer = setInterval(() => {
      this.checkTokenValidity();
    }, 60000); // 1分ごとにチェック
  }

  /**
   * トークンの有効性をチェック
   */
  private checkTokenValidity() {
    if (!authManager.isAuthenticated()) return;

    const token = authManager.getAuthToken();
    if (!token) return;

    try {
      const payload = this.decodeJWT(token);
      const expiresAt = payload.exp * 1000;
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      // 5分以内に期限切れの場合はリフレッシュを試行
      if (timeUntilExpiry < 5 * 60 * 1000) {
        this.refreshToken();
      }

      // 期限切れの場合は強制ログアウト
      if (timeUntilExpiry <= 0) {
        this.handleTokenExpired();
      }
    } catch (error) {
      console.error('Token validation error:', error);
      this.handleTokenExpired();
    }
  }

  /**
   * GitHub OAuth ログインを開始
   * @param options - ログインオプション
   */
  async startGitHubOAuth(options: { 
    scope?: string[], 
    state?: string,
    redirectUri?: string 
  } = {}) {
    if (!this.GITHUB_CLIENT_ID) {
      throw new Error('GitHub Client ID is not configured');
    }

    const scope = options.scope?.join(' ') || 'user:email';
    const state = options.state || this.generateState();
    const redirectUri = options.redirectUri || this.GITHUB_REDIRECT_URI;

    // 状態を一時保存
    sessionStorage.setItem('github_oauth_state', state);
    sessionStorage.setItem('github_oauth_started', Date.now().toString());

    // GitHub OAuth URLを構築
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', this.GITHUB_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri || window.location.origin);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('allow_signup', 'true');

    // OAuth フローを開始
    window.location.href = authUrl.toString();
  }

  /**
   * GitHub OAuth コールバックを処理
   * @param code - 認証コード
   * @param state - 状態パラメータ
   * @param error - エラー情報
   */
  async handleGitHubCallback(code: string, state: string, error?: string) {
    try {
      // エラーチェック
      if (error) {
        throw new Error(`GitHub OAuth error: ${error}`);
      }

      // 状態検証
      const savedState = sessionStorage.getItem('github_oauth_state');
      if (!savedState || savedState !== state) {
        throw new Error('Invalid OAuth state parameter');
      }

      // 一時データをクリア
      sessionStorage.removeItem('github_oauth_state');
      sessionStorage.removeItem('github_oauth_started');

      // 認証コードをトークンに交換
      const tokenData = await this.exchangeCodeForToken(code);
      
      // ユーザー情報を取得
      const userData = await this.fetchGitHubUserData(tokenData.access_token);
      
      // 内部トークンを生成（API経由）
      const authResult = await this.authenticateWithBackend(tokenData, userData);

      // 既存のAuthManagerにデータを設定
      await authManager.setAuthData(authResult.token, authResult.user);

      this.notifyAuthEvent('oauth_success', authResult.user);

      return authResult;

    } catch (error) {
      console.error('GitHub OAuth callback error:', error);
      this.notifyAuthEvent('oauth_error', error);
      throw error;
    }
  }

  /**
   * 認証コードをアクセストークンに交換
   * @param code - 認証コード
   */
  private async exchangeCodeForToken(code: string) {
    const response = await fetch(`${this.API_BASE_URL}/auth/github/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        client_id: this.GITHUB_CLIENT_ID,
        redirect_uri: this.GITHUB_REDIRECT_URI
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Token exchange failed');
    }

    return await response.json();
  }

  /**
   * GitHub ユーザーデータを取得
   * @param accessToken - GitHub アクセストークン
   */
  private async fetchGitHubUserData(accessToken: string) {
    const [userResponse, emailResponse] = await Promise.all([
      fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }),
      fetch('https://api.github.com/user/emails', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
    ]);

    if (!userResponse.ok) {
      throw new Error('Failed to fetch GitHub user data');
    }

    const userData = await userResponse.json();
    
    if (emailResponse.ok) {
      const emails = await emailResponse.json();
      const primaryEmail = emails.find((email: any) => email.primary)?.email;
      if (primaryEmail) {
        userData.email = primaryEmail;
      }
    }

    return userData;
  }

  /**
   * バックエンドで認証処理
   * @param tokenData - GitHub トークンデータ
   * @param userData - GitHub ユーザーデータ
   */
  private async authenticateWithBackend(tokenData: any, userData: any) {
    const response = await fetch(`${this.API_BASE_URL}/auth/github/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        github_token: tokenData.access_token,
        user_data: userData
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Backend authentication failed');
    }

    return await response.json();
  }

  /**
   * トークンをリフレッシュ
   */
  private async refreshToken() {
    try {
      const currentToken = authManager.getAuthToken();
      if (!currentToken) return;

      const response = await fetch(`${this.API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const { token, user } = await response.json();
        await authManager.setAuthData(token, user);
        this.notifyAuthEvent('token_refreshed', user);
      } else {
        // リフレッシュ失敗時は強制ログアウト
        this.handleTokenExpired();
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      this.handleTokenExpired();
    }
  }

  /**
   * トークン期限切れ時の処理
   */
  private handleTokenExpired() {
    console.warn('Token expired, logging out user');
    authManager.logout();
    this.notifyAuthEvent('token_expired', null);
  }

  /**
   * JWT トークンをデコード
   * @param token - JWT トークン
   */
  private decodeJWT(token: string) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = parts[1];
      const decoded = atob(payload || '');
      return JSON.parse(decoded);
    } catch (error) {
      return null;
    }
  }

  /**
   * ランダムな状態文字列を生成
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 認証イベントを通知
   * @param event - イベント名
   * @param data - イベントデータ
   */
  private notifyAuthEvent(event: string, data: any) {
    this.authEventListeners.forEach(listener => {
      try {
        listener({ event, data, timestamp: new Date().toISOString() });
      } catch (error) {
        console.error('Auth event listener error:', error);
      }
    });
  }

  // ===== パブリック API =====

  /**
   * クラウド認証が有効かチェック
   */
  isCloudAuthEnabled(): boolean {
    return authManager.isAuthenticated() && this.hasValidCloudToken();
  }

  /**
   * 有効なクラウドトークンを持っているかチェック
   */
  hasValidCloudToken(): boolean {
    const token = authManager.getAuthToken();
    if (!token) return false;

    try {
      const payload = this.decodeJWT(token);
      return payload && payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  /**
   * クラウド同期用のアクセストークンを取得
   */
  getCloudSyncToken(): string | null {
    if (!this.isCloudAuthEnabled()) return null;
    return authManager.getAuthToken();
  }

  /**
   * 現在のクラウドユーザー情報を取得
   */
  getCloudUser(): any {
    if (!this.isCloudAuthEnabled()) return null;
    return authManager.getCurrentUser();
  }

  /**
   * 認証イベントリスナーを追加
   * @param listener - イベントリスナー
   */
  addEventListener(listener: (event: AuthEvent) => void): () => void {
    this.authEventListeners.add(listener);
    return () => this.authEventListeners.delete(listener);
  }

  /**
   * クラウドログアウト
   */
  async cloudLogout() {
    try {
      const token = this.getCloudSyncToken();
      if (token) {
        // サーバーサイドでトークンを無効化
        await fetch(`${this.API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Cloud logout error:', error);
    } finally {
      // ローカルの認証データをクリア
      authManager.logout();
      this.notifyAuthEvent('cloud_logout', null);
    }
  }

  /**
   * 認証状態のヘルスチェック
   */
  async healthCheck(): Promise<boolean> {
    try {
      // まず基本的な API 接続をテスト
      const response = await fetch(`${this.API_BASE_URL}/api/auth/health`, {
        method: 'GET'
      });

      if (!response.ok) {
        console.warn('Basic API health check failed:', response.status);
        return false;
      }

      // 認証トークンがある場合は認証済みエンドポイントもテスト
      const token = this.getCloudSyncToken();
      if (token) {
        const authResponse = await fetch(`${this.API_BASE_URL}/api/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        return authResponse.ok;
      }

      return true; // 基本接続が成功していればOK
    } catch (error) {
      console.error('Auth health check error:', error);
      return false;
    }
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
    this.authEventListeners.clear();
  }
}

/**
 * 認証イベントの型定義
 */
interface AuthEvent {
  event: string;
  data: any;
  timestamp: string;
}

// シングルトンインスタンス
export const cloudAuthManager = new CloudAuthManager();

/**
 * クラウド認証用 React フック
 */
export function useCloudAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(cloudAuthManager.isCloudAuthEnabled());
  const [user, setUser] = useState(cloudAuthManager.getCloudUser());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 認証状態の変化を監視
    const unsubscribe = cloudAuthManager.addEventListener((event) => {
      switch (event.event) {
        case 'login_success':
        case 'oauth_success':
        case 'token_refreshed':
          setIsAuthenticated(true);
          setUser(event.data);
          setError(null);
          break;
        case 'logout':
        case 'cloud_logout':
        case 'token_expired':
          setIsAuthenticated(false);
          setUser(null);
          setError(null);
          break;
        case 'oauth_error':
          setIsAuthenticated(false);
          setUser(null);
          setError(event.data.message || 'Authentication failed');
          break;
      }
    });

    return unsubscribe;
  }, []);

  const startGitHubLogin = useCallback(async (options?: any) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await cloudAuthManager.startGitHubOAuth(options);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleOAuthCallback = useCallback(async (code: string, state: string, error?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await cloudAuthManager.handleGitHubCallback(code, state, error);
    } catch (err: any) {
      setError(err.message || 'OAuth callback failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    
    try {
      await cloudAuthManager.cloudLogout();
    } catch (err: any) {
      setError(err.message || 'Logout failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isAuthenticated,
    user,
    isLoading,
    error,
    startGitHubLogin,
    handleOAuthCallback,
    logout,
    getToken: () => cloudAuthManager.getCloudSyncToken(),
    healthCheck: () => cloudAuthManager.healthCheck()
  };
}

// useState をインポート
import { useState, useEffect, useCallback } from 'react';