import React, { useState, useEffect } from 'react';
import AdvancedMindMapApp from '../ui/components/mindmap/MindMapApp';

type StorageMode = 'local' | 'cloud';

interface Props {
  onModeChange: (mode: StorageMode) => void;
}

const LocalApp: React.FC<Props> = ({ onModeChange }) => {
  const [useAdvanced, setUseAdvanced] = useState(false);

  // Check if user wants to use the advanced implementation
  useEffect(() => {
    const savedPreference = localStorage.getItem('mindflow_use_advanced');
    setUseAdvanced(savedPreference === 'true');
  }, []);

  // If advanced mode is enabled, use the new implementation
  if (useAdvanced) {
    return <AdvancedMindMapApp onModeChange={onModeChange} />;
  }

  // Advanced implementation with commit 21d9f81 UI features and IndexedDB storage
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
        request.onsuccess = () => resolve(request.result);
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

  // State management
  const [data, setData] = useState<MindMapData | null>(null);
  const [allMindMaps, setAllMindMaps] = useState<MindMapData[]>([]);
  const [currentMapId, setCurrentMapId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('root');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  
  // UI State
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
      saveMindMapToDB(data);
      // Update the map in allMindMaps
      setAllMindMaps(prev => 
        prev.map(map => map.id === currentMapId ? data : map)
      );
    }
  }, [data, currentMapId]);

  // History management
  const addToHistory = (mapData: MindMapData) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(mapData)));
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevData = history[historyIndex - 1];
      setData(prevData);
      setHistoryIndex(prev => prev - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextData = history[historyIndex + 1];
      setData(nextData);
      setHistoryIndex(prev => prev + 1);
    }
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Node operations
  const findNode = (id: string, node?: Node): Node | null => {
    if (!data) return null;
    const searchRoot = node || data.rootNode;
    if (searchRoot.id === id) return searchRoot;
    for (const child of searchRoot.children) {
      const found = findNode(id, child);
      if (found) return found;
    }
    return null;
  };

  const findParentNode = (nodeId: string, node?: Node, parent?: Node): Node | null => {
    if (!data) return null;
    const searchRoot = node || data.rootNode;
    if (searchRoot.id === nodeId) return parent || null;
    for (const child of searchRoot.children) {
      const found = findParentNode(nodeId, child, searchRoot);
      if (found) return found;
    }
    return null;
  };

  const flattenNodes = (node: Node): Node[] => {
    const result = [node];
    for (const child of node.children) {
      result.push(...flattenNodes(child));
    }
    return result;
  };

  const updateNodeInTree = (nodeId: string, updates: Partial<Node>, tree: Node): Node => {
    if (tree.id === nodeId) {
      return { ...tree, ...updates };
    }
    return {
      ...tree,
      children: tree.children.map(child => updateNodeInTree(nodeId, updates, child))
    };
  };

  const updateNode = (id: string, updates: Partial<Node>) => {
    if (!data) return;
    const newData = {
      ...data,
      rootNode: updateNodeInTree(id, updates, data.rootNode),
      updatedAt: new Date().toISOString()
    };
    setData(newData);
    addToHistory(newData);
  };

  const addChildNode = (parentId: string, text?: string, autoEdit = false) => {
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
      startEdit(newNode.id);
    }
  };

  const addSiblingNode = (nodeId: string, text?: string, autoEdit = false) => {
    const parentNode = findParentNode(nodeId);
    if (parentNode) {
      addChildNode(parentNode.id, text, autoEdit);
    } else if (nodeId === 'root') {
      addChildNode('root', text, autoEdit);
    }
  };

  const deleteNode = (id: string) => {
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
  };

  const toggleCollapse = (nodeId: string) => {
    const node = findNode(nodeId);
    if (node) {
      updateNode(nodeId, { collapsed: !node.collapsed });
    }
  };

  const addChild = (parentId: string) => {
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
    if (id === 'root') return;

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
        <div style={{ display: 'flex', gap: '12px' }}>
          <span style={{ color: '#666', fontSize: '14px' }}>Local Mode (Simple)</span>
          <button
            onClick={() => {
              localStorage.setItem('mindflow_use_advanced', 'true');
              setUseAdvanced(true);
            }}
            style={{
              padding: '8px 16px',
              background: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '8px'
            }}
          >
            Enable Advanced Mode
          </button>
          <button
            onClick={() => onModeChange('cloud')}
            style={{
              padding: '8px 16px',
              background: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Switch to Cloud
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
        <span>最終更新: {new Date(data.updatedAt).toLocaleString('ja-JP')}</span>
        <span>Tab: 子ノード追加 | Space: 編集 | Delete: 削除 | "Enable Advanced Mode" for full features</span>
      </footer>
    </div>
  );
};

export default LocalApp;