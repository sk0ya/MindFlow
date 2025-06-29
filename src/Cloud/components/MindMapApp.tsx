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
  const [selectedNodeId, setSelectedNodeId] = useState<string>('root');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [cloudMaps, setCloudMaps] = useState<MindMapData[]>([]);
  const [currentMapId, setCurrentMapId] = useState<string | null>(null);

  // Cloud API functions
  const getAuthToken = () => sessionStorage.getItem('auth_token');

  const fetchMindMaps = async () => {
    const token = getAuthToken();
    if (!token || !auth.isAuthenticated) return;

    try {
      const response = await fetch('https://mindflow-api.shigekazukoya.workers.dev/api/mindmaps', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch mindmaps');

      const result = await response.json();
      setCloudMaps(result.mindmaps || []);
      
      if (result.mindmaps?.length > 0 && !currentMapId) {
        const firstMap = result.mindmaps[0];
        await loadMindMap(firstMap.id);
      }
    } catch (error) {
      console.error('Failed to fetch mindmaps:', error);
    }
  };

  const loadMindMap = async (mapId: string) => {
    const token = getAuthToken();
    if (!token || !auth.isAuthenticated) return;

    try {
      setIsSyncing(true);
      const response = await fetch(`https://mindflow-api.shigekazukoya.workers.dev/api/mindmaps/${mapId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to load mindmap');

      const mapData = await response.json();
      setData(mapData);
      setCurrentMapId(mapId);
    } catch (error) {
      console.error('Failed to load mindmap:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const saveMindMap = async (mapData: MindMapData) => {
    const token = getAuthToken();
    if (!token || !auth.isAuthenticated) return;

    try {
      setIsSyncing(true);
      
      let response;
      if (currentMapId) {
        response = await fetch(`https://mindflow-api.shigekazukoya.workers.dev/api/mindmaps/${currentMapId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(mapData)
        });
      } else {
        response = await fetch('https://mindflow-api.shigekazukoya.workers.dev/api/mindmaps', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(mapData)
        });
      }

      if (!response.ok) throw new Error('Failed to save mindmap');

      const savedMap = await response.json();
      setCurrentMapId(savedMap.id);
      
      fetchMindMaps();
    } catch (error) {
      console.error('Failed to save mindmap:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const createNewMindMap = async () => {
    const newMap = createDefaultData();
    setData(newMap);
    setCurrentMapId(null);
    setSelectedNodeId('root');
    await saveMindMap(newMap);
  };

  // Auto-save functionality
  useEffect(() => {
    if (auth.isAuthenticated && data && currentMapId) {
      const timeoutId = setTimeout(() => {
        saveMindMap(data);
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
  }, [data, auth.isAuthenticated, currentMapId]);

  // Load mindmaps on authentication
  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchMindMaps();
    }
  }, [auth.isAuthenticated]);

  // MindMap functions
  const findNode = (id: string, node: Node = data.rootNode): Node | null => {
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = findNode(id, child);
      if (found) return found;
    }
    return null;
  };

  const updateNode = (id: string, updates: Partial<Node>) => {
    if (!auth.isAuthenticated) return;
    
    const updateInNode = (node: Node): Node => {
      if (node.id === id) {
        return { ...node, ...updates };
      }
      return {
        ...node,
        children: node.children.map(updateInNode)
      };
    };
    
    setData(prev => ({
      ...prev,
      rootNode: updateInNode(prev.rootNode),
      updatedAt: new Date().toISOString()
    }));
  };

  const addChild = (parentId: string) => {
    if (!auth.isAuthenticated) return;
    
    const newNode: Node = {
      id: generateId(),
      text: 'New Node',
      x: 0,
      y: 0,
      children: []
    };

    const addToNode = (node: Node): Node => {
      if (node.id === parentId) {
        return {
          ...node,
          children: [...node.children, newNode]
        };
      }
      return {
        ...node,
        children: node.children.map(addToNode)
      };
    };

    setData(prev => ({
      ...prev,
      rootNode: addToNode(prev.rootNode),
      updatedAt: new Date().toISOString()
    }));

    setSelectedNodeId(newNode.id);
    startEdit(newNode.id);
  };

  const deleteNode = (id: string) => {
    if (id === 'root' || !auth.isAuthenticated) return;

    const removeFromNode = (node: Node): Node => ({
      ...node,
      children: node.children
        .filter(child => child.id !== id)
        .map(removeFromNode)
    });

    setData(prev => ({
      ...prev,
      rootNode: removeFromNode(prev.rootNode),
      updatedAt: new Date().toISOString()
    }));

    if (selectedNodeId === id) {
      setSelectedNodeId('root');
    }
  };

  const startEdit = (nodeId: string) => {
    if (!auth.isAuthenticated) return;
    
    const node = findNode(nodeId);
    if (node) {
      setEditingNodeId(nodeId);
      setEditText(node.text);
    }
  };

  const finishEdit = () => {
    if (editingNodeId && editText.trim()) {
      updateNode(editingNodeId, { text: editText.trim() });
    }
    setEditingNodeId(null);
    setEditText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingNodeId) {
      if (e.key === 'Enter') {
        finishEdit();
      } else if (e.key === 'Escape') {
        setEditingNodeId(null);
        setEditText('');
      }
      return;
    }

    if (selectedNodeId) {
      if (e.key === 'Tab') {
        e.preventDefault();
        addChild(selectedNodeId);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteNode(selectedNodeId);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        startEdit(selectedNodeId);
      }
    }
  };

  const renderNode = (node: Node): React.ReactElement => (
    <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
      <rect
        x={-50}
        y={-20}
        width={100}
        height={40}
        rx={8}
        fill={selectedNodeId === node.id ? '#e3f2fd' : '#ffffff'}
        stroke={selectedNodeId === node.id ? '#2196f3' : '#cccccc'}
        strokeWidth={selectedNodeId === node.id ? 2 : 1}
        style={{ cursor: 'pointer' }}
        onClick={() => setSelectedNodeId(node.id)}
        onDoubleClick={() => startEdit(node.id)}
      />
      {editingNodeId === node.id ? (
        <foreignObject x={-45} y={-15} width={90} height={30}>
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={finishEdit}
            onKeyDown={(e) => {
              e.stopPropagation();
              handleKeyDown(e);
            }}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              textAlign: 'center',
              fontSize: '14px'
            }}
            autoFocus
          />
        </foreignObject>
      ) : (
        <text
          x={0}
          y={5}
          textAnchor="middle"
          fontSize="14"
          fill="#333"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setSelectedNodeId(node.id)}
          onDoubleClick={() => startEdit(node.id)}
        >
          {node.text}
        </text>
      )}
      {node.children.map(child => (
        <line
          key={`line-${child.id}`}
          x1={0}
          y1={0}
          x2={child.x - node.x}
          y2={child.y - node.y}
          stroke="#999"
          strokeWidth="2"
        />
      ))}
      {node.children.map(renderNode)}
    </g>
  );

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
          {cloudMaps.length > 0 && (
            <select
              value={currentMapId || ''}
              onChange={(e) => {
                if (e.target.value) {
                  loadMindMap(e.target.value);
                }
              }}
              style={{
                padding: '8px 12px',
                border: '2px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                minWidth: '150px'
              }}
            >
              <option value="">マップを選択</option>
              {cloudMaps.map(map => (
                <option key={map.id} value={map.id}>
                  {map.title || 'Untitled'}
                </option>
              ))}
            </select>
          )}
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
          <button
            onClick={createNewMindMap}
            disabled={isSyncing}
            style={{
              padding: '8px 16px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              opacity: isSyncing ? 0.6 : 1
            }}
          >
            新規作成
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {isSyncing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2196f3' }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid #f3f3f3',
                borderTop: '2px solid #2196f3',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ fontSize: '14px' }}>同期中...</span>
            </div>
          )}
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
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 800 600"
          style={{ outline: 'none' }}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedNodeId('root');
            }
          }}
        >
          {renderNode(data.rootNode)}
        </svg>
      </main>
      
      <footer style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        background: '#fff',
        borderTop: '1px solid #eee',
        fontSize: '14px',
        color: '#666'
      }}>
        <span>最終更新: {new Date(data.updatedAt).toLocaleString('ja-JP')} (Cloud)</span>
        <span>Tab: 子ノード追加 | Space: 編集 | Delete: 削除</span>
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