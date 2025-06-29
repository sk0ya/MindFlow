import React, { useState, useEffect } from 'react';

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

type StorageMode = 'local' | 'cloud';

interface Props {
  onModeChange: (mode: StorageMode) => void;
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
  updatedAt: new Date().toISOString()
});

const LocalApp: React.FC<Props> = ({ onModeChange }) => {
  const [data, setData] = useState<MindMapData>(createDefaultData());
  const [selectedNodeId, setSelectedNodeId] = useState<string>('root');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');

  useEffect(() => {
    const saved = localStorage.getItem('mindmap_data');
    if (saved) {
      try {
        setData(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load saved data:', error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('mindmap_data', JSON.stringify(data));
  }, [data]);

  const findNode = (id: string, node: Node = data.rootNode): Node | null => {
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = findNode(id, child);
      if (found) return found;
    }
    return null;
  };

  const updateNode = (id: string, updates: Partial<Node>) => {
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
          <span style={{ color: '#666', fontSize: '14px' }}>Local Mode</span>
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
        <span>Tab: 子ノード追加 | Space: 編集 | Delete: 削除</span>
      </footer>
    </div>
  );
};

export default LocalApp;