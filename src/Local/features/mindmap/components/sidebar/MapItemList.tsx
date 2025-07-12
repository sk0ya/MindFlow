import React, { useCallback } from 'react';
import type { MindMapData, MindMapNode } from '../../../../shared/types';

interface MapItemListProps {
  maps: MindMapData[];
  currentMapId: string | null;
  editingMapId: string | null;
  editingTitle: string;
  onSelectMap: (mapId: string) => void;
  onStartRename: (mapId: string, title: string) => void;
  onFinishRename: (mapId: string) => void;
  onCancelRename: () => void;
  onDeleteMap: (mapId: string) => void;
  onEditingTitleChange: (title: string) => void;
  onDragStart: (e: React.DragEvent, map: MindMapData) => void;
}

// ユーティリティ関数
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '無効な日付';
  }
};

const getNodeCount = (rootNode?: MindMapNode): number => {
  if (!rootNode) return 0;
  
  const countNodes = (node: MindMapNode): number => {
    let count = 1;
    if (node.children) {
      count += node.children.reduce((sum, child) => sum + countNodes(child), 0);
    }
    return count;
  };
  
  return countNodes(rootNode);
};

const MapItemList: React.FC<MapItemListProps> = ({
  maps,
  currentMapId,
  editingMapId,
  editingTitle,
  onSelectMap,
  onStartRename,
  onFinishRename,
  onCancelRename,
  onDeleteMap,
  onEditingTitleChange,
  onDragStart
}) => {
  const handleKeyPress = useCallback((e: React.KeyboardEvent, mapId: string) => {
    if (e.key === 'Enter') {
      onFinishRename(mapId);
    } else if (e.key === 'Escape') {
      onCancelRename();
    }
  }, [onFinishRename, onCancelRename]);

  return (
    <>
      {maps.map((map) => (
        <div
          key={map.id}
          className={`map-item ${currentMapId === map.id ? 'active' : ''}`}
          onClick={() => onSelectMap(map.id)}
          draggable
          onDragStart={(e) => onDragStart(e, map)}
        >
          {editingMapId === map.id ? (
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => onEditingTitleChange(e.target.value)}
              onBlur={() => onFinishRename(map.id)}
              onKeyDown={(e) => handleKeyPress(e, map.id)}
              autoFocus
              className="title-input"
            />
          ) : (
            <div className="map-info">
              <div className="map-title">{map.title}</div>
              <div className="map-meta">
                <span className="node-count">
                  {getNodeCount(map.rootNode)} ノード
                </span>
                <span className="update-date">
                  {formatDate(map.updatedAt)}
                </span>
              </div>
            </div>
          )}
          
          <div className="map-actions">
            <button
              className="action-btn rename"
              onClick={(e) => {
                e.stopPropagation();
                onStartRename(map.id, map.title);
              }}
              title="名前を変更"
            >
              ✏️
            </button>
            
            <button
              className="action-btn delete"
              onClick={(e) => {
                e.stopPropagation();
                // eslint-disable-next-line no-alert
                if (window.confirm(`「${map.title}」を削除しますか？`)) {
                  onDeleteMap(map.id);
                }
              }}
              title="削除"
            >
              🗑️
            </button>
          </div>
        </div>
      ))}
    </>
  );
};

export default MapItemList;