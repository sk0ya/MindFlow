// 認証管理システム

import { getAllMindMaps } from '../../core/storage/storageRouter.js';

const AUTH_STORAGE_KEY = 'mindflow_auth';
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5分前にリフレッシュ

class AuthManager {
  constructor() {
    this.token = null;
    this.user = null;
    // API base URL with environment detection
    this.apiBase = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
      ? 'http://localhost:8787' 
      : 'https://mindflow-api-production.shigekazukoya.workers.dev';
    
    this.loadAuthData();
    this.setupTokenRefresh();
  }

  // 認証データをローカルストレージから読み込み
  loadAuthData() {
    try {
      const item = localStorage.getItem(AUTH_STORAGE_KEY);
      const authData = item ? JSON.parse(item) : null;
      
      if (authData && authData.token) {
        // トークンの有効性をチェック
        const payload = this.decodeJWT(authData.token);
        if (payload && payload.exp * 1000 > Date.now()) {
          this.token = authData.token;
          this.user = authData.user;
          
          // 自動ログイン成功時にマップ一覧を同期（非同期で実行してブロックを避ける）
          setTimeout(async () => {
            try {
              console.log('🔄 自動ログイン時マップ一覧同期開始...');
              await getAllMindMaps();
              console.log('✅ 自動ログイン時マップ一覧同期完了');
            } catch (syncError) {
              console.warn('⚠️ 自動ログイン時マップ一覧同期失敗:', syncError);
            }
          }, 1000); // 1秒後に実行してアプリ初期化を優先
        } else {
          this.clearAuthData();
        }
      }
    } catch (error) {
      console.error('Auth data load error:', error);
      this.clearAuthData();
    }
  }

  // 認証データを保存
  saveAuthData() {
    try {
      const authData = {
        token: this.token,
        user: this.user,
        timestamp: Date.now()
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
    } catch (error) {
      console.error('Auth data save error:', error);
    }
  }

  // 認証データをクリア
  clearAuthData() {
    this.token = null;
    this.user = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  // JWTトークンをデコード（検証なし）
  decodeJWT(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(atob(parts[1]));
      return payload;
    } catch (error) {
      return null;
    }
  }

  // ログイン状態の確認
  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  // 現在のユーザー情報を取得
  getCurrentUser() {
    return this.user;
  }

  // 認証ヘッダーを取得
  getAuthHeader() {
    return this.token ? `Bearer ${this.token}` : null;
  }

  // 認証トークンを取得
  getAuthToken() {
    return this.token;
  }

  // Magic Linkを送信
  async sendMagicLink(email) {
    try {
      const response = await fetch(`${this.apiBase}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      
      console.log('Magic Link API response:', data); // デバッグログ
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send magic link');
      }

      return { 
        success: true, 
        message: data.message,
        expiresIn: data.expiresIn,
        magicLink: data.magicLink
      };
    } catch (error) {
      console.error('Magic link sending error:', error);
      throw error;
    }
  }

  // Magic Linkトークンを検証してログイン
  async verifyMagicLink(token) {
    try {
      const response = await fetch(`${this.apiBase}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Token verification failed');
      }

      // トークンとユーザー情報を保存
      this.token = data.token;
      this.user = data.user;
      this.saveAuthData();

      // ログイン成功時にマップ一覧を同期
      try {
        console.log('🔄 ログイン成功時マップ一覧同期開始...');
        await getAllMindMaps();
        console.log('✅ ログイン成功時マップ一覧同期完了');
      } catch (syncError) {
        console.warn('⚠️ ログイン成功時マップ一覧同期失敗:', syncError);
      }

      return { success: true, user: this.user };
    } catch (error) {
      console.error('Token verification error:', error);
      throw error;
    }
  }

  // Google OAuth ログイン
  async loginWithGoogle() {
    try {
      const response = await fetch(`${this.apiBase}/api/auth/google`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Google auth failed');
      }

      // Google認証ページにリダイレクト
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  }

  // OAuth コールバック処理
  async handleAuthCallback(token) {
    if (!token) {
      throw new Error('No token provided');
    }

    try {
      // トークンの有効性を確認
      const response = await fetch(`${this.apiBase}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid token');
      }

      this.token = token;
      this.user = data.user;
      this.saveAuthData();

      return { success: true, user: this.user };
    } catch (error) {
      console.error('Auth callback error:', error);
      throw error;
    }
  }

  // 認証データを設定（CloudAuthManager用）
  async setAuthData(token, user) {
    this.token = token;
    this.user = user;
    this.saveAuthData();
    return { success: true, user: this.user };
  }

  // 汎用ログインメソッド（CloudAuthManager拡張用）
  async login(...args) {
    // 既存の認証処理を呼び出し
    if (args.length === 1 && typeof args[0] === 'string') {
      // Email形式の場合はMagic Link
      return await this.sendMagicLink(args[0]);
    }
    // その他の形式はサポートなし
    throw new Error('Unsupported login method');
  }

  // ログアウト
  async logout() {
    this.clearAuthData();
    
    // 必要に応じてサーバーサイドでのトークン無効化
  }

  // トークンリフレッシュ
  async refreshToken() {
    if (!this.token) return false;

    try {
      const response = await fetch(`${this.apiBase}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: this.token })
      });

      const data = await response.json();

      if (!response.ok) {
        this.clearAuthData();
        return false;
      }

      this.token = data.token;
      this.saveAuthData();
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearAuthData();
      return false;
    }
  }

  // 自動トークンリフレッシュの設定
  setupTokenRefresh() {
    setInterval(() => {
      if (!this.token) return;

      const payload = this.decodeJWT(this.token);
      if (!payload) return;

      const expiresAt = payload.exp * 1000;
      const now = Date.now();

      // トークンの有効期限が近づいている場合はリフレッシュ
      if (expiresAt - now < TOKEN_REFRESH_THRESHOLD) {
        this.refreshToken();
      }
    }, 60 * 1000); // 1分ごとにチェック
  }

  // 認証が必要なAPIリクエスト用のfetchラッパー
  async authenticatedFetch(url, options = {}) {
    const authHeader = this.getAuthHeader();
    if (!authHeader) {
      throw new Error('Not authenticated');
    }

    const config = {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': authHeader
      }
    };

    const response = await fetch(url, config);

    // 401エラーの場合はトークンリフレッシュを試行
    if (response.status === 401) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        // リフレッシュ成功、リクエスト再試行
        config.headers['Authorization'] = this.getAuthHeader();
        return await fetch(url, config);
      } else {
        // リフレッシュ失敗、ログアウト
        this.clearAuthData();
        throw new Error('Authentication expired');
      }
    }

    return response;
  }
}

// シングルトンインスタンス
export const authManager = new AuthManager();