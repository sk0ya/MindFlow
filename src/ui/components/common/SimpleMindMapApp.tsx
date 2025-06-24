/**
 * シンプルなメインアプリケーションコンポーネント
 */

import React, { useState, useEffect } from 'react';
import { useMapList } from '../../../features/mindmap/useMapList.js';
import { useCurrentMap } from '../../../features/mindmap/useCurrentMap.js';
import { apiClient, storageService } from '../../../core/storage/api.js';

// Types
interface NodeData {
  id: string;
  text: string;
  x: number;
  y: number;
  children?: NodeData[];
  fontSize?: number;
  fontWeight?: string;
  collapsed?: boolean;
  attachments?: any[];
  mapLinks?: any[];
  color?: string;
}

interface MapData {
  id: string;
  title: string;
  rootNode: NodeData;
  settings?: {
    autoSave?: boolean;
    autoLayout?: boolean;
  };
}

export const SimpleMindMapApp: React.FC = () => {
  const [currentMapId, setCurrentMapId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('root');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  
  const { maps, loadMaps, deleteMap } = useMapList();
  const { mapData, updateMap, createNewMap, saving } = useCurrentMap(currentMapId);
  // ノード操作のシンプルな実装
  const nodeOps = {
    addChild: (parentId: string, text?: string) => console.log('addChild:', parentId, text),
    addSibling: (nodeId: string, text?: string) => console.log('addSibling:', nodeId, text),
    update: (nodeId: string, updates: Partial<NodeData>) => console.log('update:', nodeId, updates),
    remove: (nodeId: string) => console.log('remove:', nodeId),
    find: (nodeId: string): NodeData | undefined => mapData?.rootNode
  };

  // 初期マップの設定
  useEffect(() => {
    if (maps.length > 0 && !currentMapId) {
      setCurrentMapId(maps[0].id);
    }
  }, [maps, currentMapId]);

  // 新しいマップを作成
  const handleCreateMap = async () => {
    try {
      const newMapId = await createNewMap();
      setCurrentMapId(newMapId);
      await loadMaps();
    } catch (error) {
      console.error('Failed to create map:', error);
    }
  };

  // マップを切り替え
  const handleSwitchMap = (mapId: string) => {
    setCurrentMapId(mapId);
    setSelectedNodeId('root');
    setEditingNodeId(null);
  };

  // ノード編集開始
  const startEditing = (nodeId: string) => {
    const node = nodeOps.find(nodeId);
    if (node) {
      setEditingNodeId(nodeId);
      setEditText(node.text);
    }
  };

  // ノード編集完了
  const finishEditing = () => {
    if (editingNodeId) {
      nodeOps.update(editingNodeId, { text: editText });
      setEditingNodeId(null);
      setEditText('');
    }
  };

  // キーボード操作
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editingNodeId) {
      if (e.key === 'Enter') {
        finishEditing();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setEditingNodeId(null);
        setEditText('');
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'Tab') {
      // 子ノード追加
      nodeOps.addChild(selectedNodeId);
      // Note: This is a placeholder implementation
      // In a real implementation, you would get the actual new node ID
      e.preventDefault();
    } else if (e.key === 'Enter') {
      // 兄弟ノード追加
      nodeOps.addSibling(selectedNodeId);
      // Note: This is a placeholder implementation
      // In a real implementation, you would get the actual new node ID
      e.preventDefault();
    } else if (e.key === ' ') {
      // 編集開始
      startEditing(selectedNodeId);
      e.preventDefault();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      // ノード削除
      if (selectedNodeId !== 'root') {
        nodeOps.remove(selectedNodeId);
        setSelectedNodeId('root');
      }
      e.preventDefault();
    }
  };

  // ストレージモード切り替え
  const toggleStorageMode = () => {
    const settings = storageService.getSettings();
    const newMode = settings.storageMode === 'local' ? 'cloud' : 'local';
    storageService.setSettings({ storageMode: newMode });
    loadMaps();
  };

  const settings = storageService.getSettings();

  return (
    <div 
      className="simple-mindmap-app" 
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{ outline: 'none', height: '100vh', display: 'flex' }}
    >
      {/* サイドバー */}
      <div style={{ width: '300px', borderRight: '1px solid #ccc', padding: '20px' }}>
        <h2>MindFlow</h2>
        
        {/* ストレージモード */}
        <div style={{ marginBottom: '20px' }}>
          <button onClick={toggleStorageMode}>
            {settings.storageMode === 'cloud' ? '☁️ クラウド' : '💾 ローカル'}
          </button>
          {saving && <span style={{ color: 'blue', marginLeft: '10px' }}>保存中...</span>}
        </div>

        {/* 新規マップ */}
        <button onClick={handleCreateMap} style={{ marginBottom: '20px', width: '100%' }}>
          新しいマップ
        </button>

        {/* マップ一覧 */}
        <div>
          <h3>マップ一覧</h3>
          {maps.map(map => (
            <div 
              key={map.id}
              style={{
                padding: '10px',
                cursor: 'pointer',
                backgroundColor: map.id === currentMapId ? '#e3f2fd' : 'transparent',
                border: map.id === currentMapId ? '1px solid #2196f3' : '1px solid transparent',
                marginBottom: '5px',
                borderRadius: '4px',
              }}
              onClick={() => handleSwitchMap(map.id)}
            >
              {map.title}
            </div>
          ))}
        </div>

        {/* 使い方 */}
        <div style={{ marginTop: '30px', fontSize: '12px', color: '#666' }}>
          <h4>操作方法:</h4>
          <ul style={{ paddingLeft: '20px' }}>
            <li>Tab: 子ノード追加</li>
            <li>Enter: 兄弟ノード追加</li>
            <li>Space: 編集開始</li>
            <li>Delete: ノード削除</li>
          </ul>
        </div>
      </div>

      {/* メインエリア */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {mapData ? (
          <SimpleCanvas
            mapData={mapData}
            selectedNodeId={selectedNodeId}
            editingNodeId={editingNodeId}
            editText={editText}
            onSelectNode={setSelectedNodeId}
            onEditTextChange={setEditText}
            onStartEditing={startEditing}
            onFinishEditing={finishEditing}
          />
        ) : (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%' 
          }}>
            マップを選択してください
          </div>
        )}
      </div>
    </div>
  );
}

// シンプルなキャンバスコンポーネント
interface SimpleCanvasProps {
  mapData: MapData;
  selectedNodeId: string;
  editingNodeId: string | null;
  editText: string;
  onSelectNode: (nodeId: string) => void;
  onEditTextChange: (text: string) => void;
  onStartEditing: (nodeId: string) => void;
  onFinishEditing: () => void;
}

const SimpleCanvas: React.FC<SimpleCanvasProps> = ({ 
  mapData, 
  selectedNodeId, 
  editingNodeId, 
  editText,
  onSelectNode,
  onEditTextChange,
  onStartEditing,
  onFinishEditing 
}) => {
  const renderNode = (node: NodeData, level = 0): React.ReactNode => {
    const isSelected = node.id === selectedNodeId;
    const isEditing = node.id === editingNodeId;

    return (
      <div key={node.id}>
        <div
          style={{
            position: 'absolute',
            left: node.x,
            top: node.y,
            padding: '8px 12px',
            border: isSelected ? '2px solid #2196f3' : '1px solid #ccc',
            backgroundColor: isEditing ? '#fff9c4' : '#ffffff',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: node.fontSize || 14,
            fontWeight: node.fontWeight || 'normal',
            color: node.color || '#333',
            minWidth: '60px',
            textAlign: 'center',
          }}
          onClick={() => onSelectNode(node.id)}
          onDoubleClick={() => onStartEditing(node.id)}
        >
          {isEditing ? (
            <input
              type="text"
              value={editText}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onEditTextChange(e.target.value)}
              onBlur={onFinishEditing}
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 'inherit',
                fontWeight: 'inherit',
                color: 'inherit',
                textAlign: 'center',
                width: '100%',
              }}
              autoFocus
            />
          ) : (
            node.text || '(空)'
          )}
        </div>

        {/* 子ノードをレンダリング */}
        {node.children && node.children.map(child => renderNode(child, level + 1))}

        {/* 親と子の線を描画 */}
        {node.children && node.children.map(child => (
          <svg
            key={`line-${node.id}-${child.id}`}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
            }}
          >
            <line
              x1={node.x + 50}
              y1={node.y + 20}
              x2={child.x}
              y2={child.y + 20}
              stroke="#999"
              strokeWidth="1"
            />
          </svg>
        ))}
      </div>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {renderNode(mapData.rootNode)}
    </div>
  );
};