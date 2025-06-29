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
  
  // UI State Management
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [contextMenu, setContextMenu] = useState<{visible: boolean, x: number, y: number, nodeId: string | null}>({
    visible: false, x: 0, y: 0, nodeId: null
  });
  const [showKeyboardHelper, setShowKeyboardHelper] = useState<boolean>(false);

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

  const createNewMindMap = async (title: string = 'New MindMap', category: string = 'general') => {
    const newMap = {
      ...createDefaultData(),
      title,
      category
    };
    setData(newMap);
    setCurrentMapId(null);
    setSelectedNodeId('root');
    await saveMindMap(newMap);
  };

  const deleteMindMap = async (mapId: string) => {
    const token = getAuthToken();
    if (!token || !auth.isAuthenticated) return;

    try {
      const response = await fetch(`https://mindflow-api.shigekazukoya.workers.dev/api/mindmaps/${mapId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to delete mindmap');

      await fetchMindMaps();
      
      if (currentMapId === mapId) {
        setCurrentMapId(null);
        setData(createDefaultData());
      }
    } catch (error) {
      console.error('Failed to delete mindmap:', error);
    }
  };

  const renameMindMap = async (mapId: string, newTitle: string) => {
    const mapToRename = cloudMaps.find(map => map.id === mapId);
    if (!mapToRename) return;

    const updatedMap = { ...mapToRename, title: newTitle };
    
    const token = getAuthToken();
    if (!token || !auth.isAuthenticated) return;

    try {
      const response = await fetch(`https://mindflow-api.shigekazukoya.workers.dev/api/mindmaps/${mapId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedMap)
      });

      if (!response.ok) throw new Error('Failed to rename mindmap');

      await fetchMindMaps();
      
      if (currentMapId === mapId) {
        setData(prev => ({ ...prev, title: newTitle }));
      }
    } catch (error) {
      console.error('Failed to rename mindmap:', error);
    }
  };

  // Get available categories
  const getAvailableCategories = () => {
    const categories = [...new Set(cloudMaps.map(map => map.category || 'general'))];
    return ['all', ...categories];
  };

  // Filter maps by search and category
  const filteredMaps = cloudMaps.filter(map => {
    const matchesSearch = map.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || map.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
    // Close modals/menus with Escape
    if (e.key === 'Escape') {
      e.preventDefault();
      if (editingNodeId) {
        setEditingNodeId(null);
        setEditText('');
      } else if (contextMenu.visible) {
        setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
      } else if (showKeyboardHelper) {
        setShowKeyboardHelper(false);
      }
      return;
    }

    // Global keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 's':
          e.preventDefault();
          if (data && currentMapId) {
            saveMindMap(data);
          }
          break;
        case 'n':
          e.preventDefault();
          createNewMindMap();
          break;
        case 'b':
          e.preventDefault();
          setShowSidebar(!showSidebar);
          break;
        case '?':
          e.preventDefault();
          setShowKeyboardHelper(!showKeyboardHelper);
          break;
      }
      return;
    }

    // Function keys
    if (e.key === 'F1') {
      e.preventDefault();
      setShowKeyboardHelper(!showKeyboardHelper);
      return;
    }

    // Editing mode shortcuts
    if (editingNodeId) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finishEdit();
      }
      return;
    }

    // Node navigation and editing shortcuts
    if (selectedNodeId) {
      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          addChild(selectedNodeId);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedNodeId === 'root') {
            addChild('root');
          } else {
            addSibling(selectedNodeId);
          }
          break;
        case ' ':
          e.preventDefault();
          startEdit(selectedNodeId);
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          deleteNode(selectedNodeId);
          break;
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          e.preventDefault();
          navigateNodes(e.key);
          break;
      }
    }
  };

  const addSibling = (nodeId: string) => {
    const parentNode = findParentNode(nodeId);
    if (parentNode) {
      addChild(parentNode.id);
    }
  };

  const findParentNode = (nodeId: string, node: Node = data.rootNode, parent: Node | null = null): Node | null => {
    if (node.id === nodeId) return parent;
    for (const child of node.children) {
      const found = findParentNode(nodeId, child, node);
      if (found) return found;
    }
    return null;
  };

  const navigateNodes = (direction: string) => {
    // Simple navigation - can be enhanced later
    const currentNode = findNode(selectedNodeId);
    if (!currentNode) return;

    switch (direction) {
      case 'ArrowUp':
        const parent = findParentNode(selectedNodeId);
        if (parent) setSelectedNodeId(parent.id);
        break;
      case 'ArrowDown':
        if (currentNode.children.length > 0) {
          setSelectedNodeId(currentNode.children[0].id);
        }
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        const siblings = findParentNode(selectedNodeId)?.children || [];
        const currentIndex = siblings.findIndex(s => s.id === selectedNodeId);
        if (direction === 'ArrowLeft' && currentIndex > 0) {
          setSelectedNodeId(siblings[currentIndex - 1].id);
        } else if (direction === 'ArrowRight' && currentIndex < siblings.length - 1) {
          setSelectedNodeId(siblings[currentIndex + 1].id);
        }
        break;
    }
  };

  const handleContextMenu = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      nodeId
    });
    setSelectedNodeId(nodeId);
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
        onContextMenu={(e) => handleContextMenu(e, node.id)}
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
          onContextMenu={(e) => handleContextMenu(e, node.id)}
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

  // Authenticated - show advanced mindmap app with sidebar
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '12px 16px', 
        background: '#fff', 
        borderBottom: '1px solid #eee',
        zIndex: 1000
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            style={{
              padding: '8px',
              background: 'none',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ☰
          </button>
          <h1 style={{ margin: 0, fontSize: '20px', color: '#2196f3' }}>MindFlow</h1>
          {currentMapId && (
            <input
              type="text"
              value={data.title}
              onChange={(e) => setData(prev => ({ ...prev, title: e.target.value }))}
              style={{
                padding: '6px 10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                minWidth: '200px'
              }}
            />
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => createNewMindMap()}
            disabled={isSyncing}
            style={{
              padding: '6px 12px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              opacity: isSyncing ? 0.6 : 1,
              fontSize: '14px'
            }}
          >
            + 新規
          </button>
          
          {isSyncing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2196f3' }}>
              <div style={{
                width: '12px',
                height: '12px',
                border: '2px solid #f3f3f3',
                borderTop: '2px solid #2196f3',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ fontSize: '12px' }}>同期中</span>
            </div>
          )}
          
          <button
            onClick={() => setShowKeyboardHelper(!showKeyboardHelper)}
            style={{
              padding: '6px 10px',
              background: 'none',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ?
          </button>
          
          <span style={{ color: '#666', fontSize: '12px' }}>
            {auth.user?.email}
          </span>
          
          <button
            onClick={() => onModeChange('local')}
            style={{
              padding: '6px 10px',
              background: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Local
          </button>
          
          <button
            onClick={auth.logout}
            style={{
              padding: '6px 10px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ログアウト
          </button>
        </div>
      </header>
      
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        {showSidebar && (
          <aside style={{
            width: '280px',
            background: '#f8f9fa',
            borderRight: '1px solid #eee',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Search and Filters */}
            <div style={{ padding: '16px', borderBottom: '1px solid #eee' }}>
              <input
                type="text"
                placeholder="マップを検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginBottom: '8px'
                }}
              />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              >
                {getAvailableCategories().map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'すべて' : category}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Maps List */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {filteredMaps.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
                  {cloudMaps.length === 0 ? 'マップがありません' : '該当するマップがありません'}
                </div>
              ) : (
                filteredMaps.map(map => (
                  <div
                    key={map.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #eee',
                      cursor: 'pointer',
                      background: currentMapId === map.id ? '#e3f2fd' : 'transparent'
                    }}
                    onClick={() => loadMindMap(map.id)}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                      {map.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      {new Date(map.updatedAt).toLocaleDateString('ja-JP')}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newTitle = prompt('新しいタイトル:', map.title);
                          if (newTitle && newTitle !== map.title) {
                            renameMindMap(map.id, newTitle);
                          }
                        }}
                        style={{
                          padding: '4px 8px',
                          background: '#2196f3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        名前変更
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`"${map.title}"を削除しますか？`)) {
                            deleteMindMap(map.id);
                          }
                        }}
                        style={{
                          padding: '4px 8px',
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
        
        {/* Main Canvas Area */}
        <main style={{ flex: 1, background: '#f8f9fa', overflow: 'hidden', position: 'relative' }}>
          {currentMapId ? (
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
                  setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
                }
              }}
            >
              {renderNode(data.rootNode)}
            </svg>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#666'
            }}>
              <div style={{ textAlign: 'center' }}>
                <h2>マインドマップを選択してください</h2>
                <p>左のサイドバーからマップを選択するか、新しいマップを作成してください。</p>
                <button
                  onClick={() => createNewMindMap()}
                  style={{
                    padding: '12px 24px',
                    background: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  新しいマップを作成
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
      
      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: '150px'
          }}
        >
          <button
            onClick={() => {
              startEdit(contextMenu.nodeId!);
              setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            編集
          </button>
          <button
            onClick={() => {
              addChild(contextMenu.nodeId!);
              setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            子ノード追加
          </button>
          {contextMenu.nodeId !== 'root' && (
            <button
              onClick={() => {
                deleteNode(contextMenu.nodeId!);
                setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: '#dc3545'
              }}
            >
              削除
            </button>
          )}
        </div>
      )}
      
      {/* Keyboard Helper Modal */}
      {showKeyboardHelper && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3>キーボードショートカット</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <h4>ノード操作</h4>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  <li><strong>Tab</strong> - 子ノード追加</li>
                  <li><strong>Enter</strong> - 兄弟ノード追加</li>
                  <li><strong>Space</strong> - ノード編集</li>
                  <li><strong>Delete</strong> - ノード削除</li>
                  <li><strong>矢印キー</strong> - ノード移動</li>
                </ul>
              </div>
              <div>
                <h4>アプリ操作</h4>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  <li><strong>Ctrl+S</strong> - 保存</li>
                  <li><strong>Ctrl+N</strong> - 新規作成</li>
                  <li><strong>Ctrl+B</strong> - サイドバー表示切替</li>
                  <li><strong>F1</strong> - このヘルプ</li>
                  <li><strong>Esc</strong> - モーダルを閉じる</li>
                </ul>
              </div>
            </div>
            <button
              onClick={() => setShowKeyboardHelper(false)}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                background: '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
      
      {/* Status Bar */}
      <footer style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        background: '#fff',
        borderTop: '1px solid #eee',
        fontSize: '12px',
        color: '#666'
      }}>
        <span>
          {currentMapId ? `マップ: ${data.title}` : 'マップが選択されていません'} | 
          最終更新: {new Date(data.updatedAt).toLocaleString('ja-JP')} (Cloud)
        </span>
        <span>
          総マップ数: {cloudMaps.length} | 
          Tab: 子ノード | Space: 編集 | Delete: 削除 | F1: ヘルプ
        </span>
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