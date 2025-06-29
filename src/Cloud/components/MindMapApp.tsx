import { useState, useEffect } from 'react';

interface Node {
  id: string;
  text: string;
  x: number;
  y: number;
  children: Node[];
}

interface MindMapData {
  id: string;
  title: string;
  rootNode: Node;
  updatedAt: string;
}

interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
}

type StorageMode = 'local' | 'cloud';

interface Props {
  onModeChange: (mode: StorageMode) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

const createDefaultData = (): MindMapData => ({
  id: generateId(),
  title: 'クラウドマインドマップ',
  rootNode: {
    id: 'root',
    text: 'メイントピック',
    x: 400,
    y: 300,
    children: []
  },
  updatedAt: new Date().toISOString()
});

// Simple auth hook
const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null
  });
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const token = sessionStorage.getItem('auth_token');
      const userStr = sessionStorage.getItem('auth_user');
      
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          setAuthState({
            isAuthenticated: true,
            user,
            isLoading: false,
            error: null
          });
        } catch (error) {
          console.error('Auth parse error:', error);
          sessionStorage.removeItem('auth_token');
          sessionStorage.removeItem('auth_user');
          setAuthState({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            error: null
          });
        }
      } else {
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: null
        });
      }
    };

    const timeoutId = setTimeout(checkAuth, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  const login = async (email: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch('https://mindflow-api.shigekazukoya.workers.dev/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) throw new Error('Login failed');

      setEmailSent(true);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed'
      }));
    }
  };

  const verifyToken = async (token: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch(`https://mindflow-api.shigekazukoya.workers.dev/api/auth/verify?token=${encodeURIComponent(token)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Token verification failed');

      const result = await response.json();
      
      let authToken, authUser;
      if (result.token && result.user) {
        authToken = result.token;
        authUser = result.user;
      } else if (result.token && result.email) {
        authToken = result.token;
        authUser = { id: result.email, email: result.email };
      } else {
        throw new Error('Invalid response format');
      }
      
      sessionStorage.setItem('auth_token', authToken);
      sessionStorage.setItem('auth_user', JSON.stringify(authUser));
      
      setAuthState({
        isAuthenticated: true,
        user: authUser,
        isLoading: false,
        error: null
      });
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Token verification failed'
      }));
    }
  };

  const logout = () => {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    setAuthState({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null
    });
  };

  return {
    ...authState,
    emailSent,
    login,
    verifyToken,
    logout,
    clearEmailSent: () => setEmailSent(false)
  };
};

// Simple magic link hook
const useMagicLink = (verifyToken: (token: string) => Promise<void>) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      setIsVerifying(true);
      window.history.replaceState({}, document.title, window.location.pathname);
      
      verifyToken(token)
        .catch((err) => setError(err.message))
        .finally(() => setIsVerifying(false));
    }
  }, [verifyToken]);

  return { isVerifying, error, clearError: () => setError(null) };
};

export default function MindMapApp({ onModeChange }: Props) {
  const auth = useAuth();
  const magicLink = useMagicLink(auth.verifyToken);
  const [email, setEmail] = useState('');
  const [data, setData] = useState<MindMapData>(createDefaultData());

  // Loading states
  if (auth.isLoading || magicLink.isVerifying) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #2196f3',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <h2>{magicLink.isVerifying ? '認証処理中...' : 'MindFlow'}</h2>
          <p>{magicLink.isVerifying ? 'Magic Linkを検証しています...' : 'アプリケーションを初期化中...'}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (magicLink.error) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2>認証エラー</h2>
          <p>{magicLink.error}</p>
          <button onClick={magicLink.clearError}>トップページに戻る</button>
        </div>
      </div>
    );
  }

  // Email sent state
  if (auth.emailSent && !auth.isAuthenticated) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2>✉️ メールを送信しました</h2>
          <p>入力されたメールアドレスに安全なログインリンクを送信しました。</p>
          <p>メール内のリンクをクリックしてログインしてください。</p>
          <button onClick={() => { auth.clearEmailSent(); }}>戻る</button>
        </div>
      </div>
    );
  }

  // Login form
  if (!auth.isAuthenticated) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5f5f5'
      }}>
        <div style={{ 
          background: '#fff', 
          padding: '40px', 
          borderRadius: '8px', 
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          maxWidth: '400px',
          width: '90%'
        }}>
          <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>MindFlow にログイン</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) auth.login(email.trim());
          }}>
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="email" style={{ display: 'block', marginBottom: '8px' }}>メールアドレス</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '16px'
                }}
              />
            </div>
            {auth.error && (
              <div style={{
                background: '#fee',
                color: '#c33',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '16px'
              }}>
                {auth.error}
              </div>
            )}
            <button
              type="submit"
              disabled={auth.isLoading || !email.trim()}
              style={{
                width: '100%',
                padding: '12px',
                background: auth.isLoading ? '#ccc' : '#2196f3',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                cursor: auth.isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {auth.isLoading ? '送信中...' : '🔐 ログインリンクを送信'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button
              onClick={() => onModeChange('local')}
              style={{
                background: 'none',
                border: '1px solid #ddd',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              ローカルモードに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated - show mindmap app (simplified version)
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '16px 24px', 
        background: '#fff', 
        borderBottom: '1px solid #eee' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#2196f3' }}>MindFlow</h1>
          <input
            type="text"
            value={data.title}
            onChange={(e) => setData(prev => ({ ...prev, title: e.target.value }))}
            style={{
              padding: '8px 12px',
              border: '2px solid #ddd',
              borderRadius: '6px',
              fontSize: '16px',
              minWidth: '200px'
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: '#666', fontSize: '14px' }}>
            こんにちは、{auth.user?.email}
          </span>
          <button
            onClick={() => onModeChange('local')}
            style={{
              padding: '8px 16px',
              background: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Local Mode
          </button>
          <button
            onClick={auth.logout}
            style={{
              padding: '8px 16px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ログアウト
          </button>
        </div>
      </header>
      
      <main style={{ flex: 1, background: '#f8f9fa', overflow: 'hidden' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%',
          color: '#666'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h2>🎉 認証成功！</h2>
            <p>クラウドモードで接続されました</p>
            <p>マインドマップ機能は実装中です</p>
          </div>
        </div>
      </main>
      
      <footer style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '12px 24px',
        background: '#fff',
        borderTop: '1px solid #eee',
        fontSize: '14px',
        color: '#666'
      }}>
        <span>Cloud Mode - {new Date().toLocaleString('ja-JP')}</span>
      </footer>
    </div>
  );
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);