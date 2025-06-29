import React, { useState, useEffect, useCallback } from 'react';

interface Node {
  id: string;
  text: string;
  x: number;
  y: number;
  children: Node[];
  collapsed?: boolean;
  color?: string;
  fontSize?: number;
}

interface MindMapData {
  id: string;
  title: string;
  rootNode: Node;
  updatedAt: string;
  category?: string;
}

interface Props {
  onModeChange: (mode: 'local' | 'cloud') => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

const createDefaultData = (): MindMapData => ({
  id: generateId(),
  title: 'マイマインドマップ',
  rootNode: {
    id: 'root',
    text: 'メイントピック',
    x: 400,
    y: 300,
    children: []
  },
  updatedAt: new Date().toISOString(),
  category: 'general'
});

// IndexedDB utilities
const DB_NAME = 'MindFlowDB';
const DB_VERSION = 1;
const STORE_NAME = 'mindmaps';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const saveMindMapToDB = async (data: MindMapData) => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await store.put(data);
  } catch (error) {
    console.error('Failed to save to IndexedDB:', error);
  }
};

const loadMindMapsFromDB = async (): Promise<MindMapData[]> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load from IndexedDB:', error);
    return [];
  }
};

const deleteMindMapFromDB = async (id: string) => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await store.delete(id);
  } catch (error) {
    console.error('Failed to delete from IndexedDB:', error);
  }
};

const LocalAppEnhanced: React.FC<Props> = ({ onModeChange }) => {
  // State management based on commit 21d9f81
  const [data, setData] = useState<MindMapData | null>(null);
  const [allMindMaps, setAllMindMaps] = useState<MindMapData[]>([]);
  const [currentMapId, setCurrentMapId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('root');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  
  // UI State from commit 21d9f81
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [contextMenu, setContextMenu] = useState<{visible: boolean, x: number, y: number, nodeId: string | null}>({
    visible: false, x: 0, y: 0, nodeId: null
  });
  const [showKeyboardHelper, setShowKeyboardHelper] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{x: number, y: number}>({ x: 0, y: 0 });
  const [history, setHistory] = useState<MindMapData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Load mindmaps from IndexedDB on mount
  useEffect(() => {
    const loadMindMaps = async () => {
      const maps = await loadMindMapsFromDB();
      setAllMindMaps(maps);
      
      if (maps.length > 0) {
        const firstMap = maps[0];
        setData(firstMap);
        setCurrentMapId(firstMap.id);
        addToHistory(firstMap);
      } else {
        // Create default map if none exist
        const defaultMap = createDefaultData();
        setData(defaultMap);
        setCurrentMapId(defaultMap.id);
        await saveMindMapToDB(defaultMap);
        setAllMindMaps([defaultMap]);
        addToHistory(defaultMap);
      }
    };
    
    loadMindMaps();
  }, []);

  // Auto-save when data changes
  useEffect(() => {
    if (data && currentMapId) {
      const timeoutId = setTimeout(() => {
        saveMindMapToDB(data);
        setAllMindMaps(prev => 
          prev.map(map => map.id === currentMapId ? data : map)
        );
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [data, currentMapId]);

  // History management
  const addToHistory = useCallback((mapData: MindMapData) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(mapData)));
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevData = history[historyIndex - 1];
      setData(prevData);
      setHistoryIndex(prev => prev - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextData = history[historyIndex + 1];
      setData(nextData);
      setHistoryIndex(prev => prev + 1);
    }
  }, [history, historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Node operations based on commit 21d9f81
  const findNode = useCallback((id: string, node?: Node): Node | null => {
    if (!data) return null;
    const searchRoot = node || data.rootNode;
    if (searchRoot.id === id) return searchRoot;
    for (const child of searchRoot.children) {
      const found = findNode(id, child);
      if (found) return found;
    }
    return null;
  }, [data]);

  const findParentNode = useCallback((nodeId: string, node?: Node, parent?: Node): Node | null => {
    if (!data) return null;
    const searchRoot = node || data.rootNode;
    if (searchRoot.id === nodeId) return parent || null;
    for (const child of searchRoot.children) {
      const found = findParentNode(nodeId, child, searchRoot);
      if (found) return found;
    }
    return null;
  }, [data]);

  const updateNodeInTree = useCallback((nodeId: string, updates: Partial<Node>, tree: Node): Node => {
    if (tree.id === nodeId) {
      return { ...tree, ...updates };
    }
    return {
      ...tree,
      children: tree.children.map(child => updateNodeInTree(nodeId, updates, child))
    };
  }, []);

  const updateNode = useCallback((id: string, updates: Partial<Node>) => {
    if (!data) return;
    const newData = {
      ...data,
      rootNode: updateNodeInTree(id, updates, data.rootNode),
      updatedAt: new Date().toISOString()
    };
    setData(newData);
    addToHistory(newData);
  }, [data, updateNodeInTree, addToHistory]);

  const addChildNode = useCallback((parentId: string, text?: string, autoEdit = false) => {
    if (!data) return;
    
    const parentNode = findNode(parentId);
    if (!parentNode) return;

    const newNode: Node = {
      id: generateId(),
      text: text || 'New Node',
      x: parentNode.x + (parentNode.children.length * 50) + 50,
      y: parentNode.y + 80,
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

    const newData = {
      ...data,
      rootNode: addToNode(data.rootNode),
      updatedAt: new Date().toISOString()
    };
    
    setData(newData);
    addToHistory(newData);
    setSelectedNodeId(newNode.id);
    
    if (autoEdit) {
      setTimeout(() => startEdit(newNode.id), 50);
    }
  }, [data, findNode, addToHistory]);

  const addSiblingNode = useCallback((nodeId: string, text?: string, autoEdit = false) => {
    const parentNode = findParentNode(nodeId);
    if (parentNode) {
      addChildNode(parentNode.id, text, autoEdit);
    } else if (nodeId === 'root') {
      addChildNode('root', text, autoEdit);
    }
  }, [findParentNode, addChildNode]);

  const deleteNode = useCallback((id: string) => {
    if (id === 'root' || !data) return;

    const removeFromNode = (node: Node): Node => ({
      ...node,
      children: node.children
        .filter(child => child.id !== id)
        .map(removeFromNode)
    });

    const newData = {
      ...data,
      rootNode: removeFromNode(data.rootNode),
      updatedAt: new Date().toISOString()
    };
    
    setData(newData);
    addToHistory(newData);

    if (selectedNodeId === id) {
      setSelectedNodeId('root');
    }
  }, [data, selectedNodeId, addToHistory]);

  const startEdit = useCallback((nodeId: string) => {
    const node = findNode(nodeId);
    if (node) {
      setEditingNodeId(nodeId);
      setEditText(node.text);
    }
  }, [findNode]);

  const finishEdit = useCallback(() => {
    if (editingNodeId && editText.trim()) {
      updateNode(editingNodeId, { text: editText.trim() });
    }
    setEditingNodeId(null);
    setEditText('');
  }, [editingNodeId, editText, updateNode]);

  // Map management functions
  const createNewMindMap = useCallback(async (title?: string, category?: string) => {
    const newMap = {
      ...createDefaultData(),
      title: title || 'New MindMap',
      category: category || 'general'
    };
    
    await saveMindMapToDB(newMap);
    setAllMindMaps(prev => [...prev, newMap]);
    setData(newMap);
    setCurrentMapId(newMap.id);
    setSelectedNodeId('root');
    addToHistory(newMap);
  }, [addToHistory]);

  const loadMindMap = useCallback((mapId: string) => {
    const map = allMindMaps.find(m => m.id === mapId);
    if (map) {
      setData(map);
      setCurrentMapId(mapId);
      setSelectedNodeId('root');
      addToHistory(map);
    }
  }, [allMindMaps, addToHistory]);

  const deleteMindMap = useCallback(async (mapId: string) => {
    await deleteMindMapFromDB(mapId);
    setAllMindMaps(prev => prev.filter(map => map.id !== mapId));
    
    if (currentMapId === mapId) {
      const remaining = allMindMaps.filter(map => map.id !== mapId);
      if (remaining.length > 0) {
        loadMindMap(remaining[0].id);
      } else {
        await createNewMindMap();
      }
    }
  }, [allMindMaps, currentMapId, loadMindMap, createNewMindMap]);

  const renameMindMap = useCallback(async (mapId: string, newTitle: string) => {
    const map = allMindMaps.find(m => m.id === mapId);
    if (map) {
      const updatedMap = { ...map, title: newTitle, updatedAt: new Date().toISOString() };
      await saveMindMapToDB(updatedMap);
      setAllMindMaps(prev => prev.map(m => m.id === mapId ? updatedMap : m));
      
      if (currentMapId === mapId) {
        setData(updatedMap);
      }
    }
  }, [allMindMaps, currentMapId]);

  // Get available categories
  const getAvailableCategories = useCallback(() => {
    const categories = [...new Set(allMindMaps.map(map => map.category || 'general'))];
    return ['all', ...categories];
  }, [allMindMaps]);

  // Filter maps by search and category
  const filteredMaps = allMindMaps.filter(map => {
    const matchesSearch = map.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || map.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Advanced keyboard handling from commit 21d9f81
  const navigateToDirection = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!data || !selectedNodeId) return;
    
    const currentNode = findNode(selectedNodeId);
    if (!currentNode) return;

    switch (direction) {
      case 'up':
        const parent = findParentNode(selectedNodeId);
        if (parent) setSelectedNodeId(parent.id);
        break;
      case 'down':
        if (currentNode.children.length > 0 && !currentNode.collapsed) {
          setSelectedNodeId(currentNode.children[0].id);
        }
        break;
      case 'left':
      case 'right':
        const siblings = findParentNode(selectedNodeId)?.children || [];
        const currentIndex = siblings.findIndex(s => s.id === selectedNodeId);
        if (direction === 'left' && currentIndex > 0) {
          setSelectedNodeId(siblings[currentIndex - 1].id);
        } else if (direction === 'right' && currentIndex < siblings.length - 1) {
          setSelectedNodeId(siblings[currentIndex + 1].id);
        }
        break;
    }
  }, [data, selectedNodeId, findNode, findParentNode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    console.log('🎹 Key pressed:', e.key, { editingNodeId, selectedNodeId });
    
    if (editingNodeId) {
      if (e.key === 'Enter') {
        finishEdit();
      } else if (e.key === 'Escape') {
        setEditingNodeId(null);
        setEditText('');
      }
      return;
    }

    // Global shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
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

    // Navigation shortcuts
    if (selectedNodeId) {
      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          addChildNode(selectedNodeId, undefined, true);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedNodeId === 'root') {
            addChildNode('root', undefined, true);
          } else {
            addSiblingNode(selectedNodeId, undefined, true);
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
          navigateToDirection(e.key.replace('Arrow', '').toLowerCase() as any);
          break;
        case 'Escape':
          e.preventDefault();
          if (contextMenu.visible) {
            setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
          } else if (showKeyboardHelper) {
            setShowKeyboardHelper(false);
          }
          break;
      }
    }
  }, [editingNodeId, selectedNodeId, finishEdit, undo, redo, createNewMindMap, showSidebar, showKeyboardHelper, addChildNode, addSiblingNode, startEdit, deleteNode, navigateToDirection, contextMenu.visible]);

  // Context menu handling
  const handleContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      nodeId
    });
    setSelectedNodeId(nodeId);
  }, []);

  // Node rendering based on commit 21d9f81 structure
  const renderNode = useCallback((node: Node): React.ReactElement => (
    <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
      <rect
        x={-50}
        y={-20}
        width={100}
        height={40}
        rx={8}
        fill={selectedNodeId === node.id ? '#e3f2fd' : (node.color || '#ffffff')}
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
              fontSize: (node.fontSize || 14) + 'px'
            }}
            autoFocus
          />
        </foreignObject>
      ) : (
        <text
          x={0}
          y={5}
          textAnchor="middle"
          fontSize={node.fontSize || 14}
          fill="#333"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setSelectedNodeId(node.id)}
          onDoubleClick={() => startEdit(node.id)}
          onContextMenu={(e) => handleContextMenu(e, node.id)}
        >
          {node.text}
        </text>
      )}
      {/* Collapse toggle */}
      {node.children.length > 0 && (
        <circle
          cx={50}
          cy={0}
          r={8}
          fill={node.collapsed ? '#f44336' : '#4caf50'}
          stroke="#333"
          strokeWidth={1}
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            updateNode(node.id, { collapsed: !node.collapsed });
          }}
        />
      )}
      {/* Connection lines */}
      {!node.collapsed && node.children.map(child => (
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
      {/* Child nodes */}
      {!node.collapsed && node.children.map(renderNode)}
    </g>
  ), [selectedNodeId, editingNodeId, editText, finishEdit, handleKeyDown, startEdit, handleContextMenu, updateNode]);

  // Loading state
  if (!data) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2>MindFlow</h2>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Main UI based on commit 21d9f81 structure
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
          <input
            type="text"
            value={data.title}
            onChange={(e) => {
              const newData = { ...data, title: e.target.value, updatedAt: new Date().toISOString() };
              setData(newData);
            }}
            style={{
              padding: '6px 10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              minWidth: '200px'
            }}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => createNewMindMap()}
            style={{
              padding: '6px 12px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            + 新規
          </button>
          
          <button
            onClick={undo}
            disabled={!canUndo}
            style={{
              padding: '6px 10px',
              background: canUndo ? '#2196f3' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: canUndo ? 'pointer' : 'not-allowed',
              fontSize: '12px'
            }}
          >
            ↶
          </button>
          
          <button
            onClick={redo}
            disabled={!canRedo}
            style={{
              padding: '6px 10px',
              background: canRedo ? '#2196f3' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: canRedo ? 'pointer' : 'not-allowed',
              fontSize: '12px'
            }}
          >
            ↷
          </button>
          
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
            Local Mode
          </span>
          
          <button
            onClick={() => onModeChange('cloud')}
            style={{
              padding: '6px 10px',
              background: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Cloud
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
                  {allMindMaps.length === 0 ? 'マップがありません' : '該当するマップがありません'}
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
              addChildNode(contextMenu.nodeId!);
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
                  <li><strong>Ctrl+Z</strong> - 元に戻す</li>
                  <li><strong>Ctrl+Shift+Z</strong> - やり直し</li>
                  <li><strong>Ctrl+N</strong> - 新規作成</li>
                  <li><strong>Ctrl+B</strong> - サイドバー表示切替</li>
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
          マップ: {data.title} | 最終更新: {new Date(data.updatedAt).toLocaleString('ja-JP')} (Local)
        </span>
        <span>
          総マップ数: {allMindMaps.length} | Tab: 子ノード | Space: 編集 | Delete: 削除 | ?: ヘルプ
        </span>
      </footer>
    </div>
  );
};

export default LocalAppEnhanced;