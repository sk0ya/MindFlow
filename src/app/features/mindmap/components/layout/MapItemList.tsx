import React, { useCallback } from 'react';
import type { MindMapData, MindMapNode } from '@shared/types';

interface MapItemListProps {
  maps: MindMapData[];
  categoryPath: string;
  currentMapId: string | null;
  editingMapId: string | null;
  editingTitle: string;
  onSelectMap: (mapId: string) => void;
  onFinishRename: (mapId: string) => void;
  onCancelRename: () => void;
  onEditingTitleChange: (title: string) => void;
  onDragStart: (e: React.DragEvent, map: MindMapData) => void;
  onContextMenu?: (e: React.MouseEvent, targetPath: string | null, targetType: 'folder' | 'empty' | 'map', mapData?: MindMapData) => void;
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
  categoryPath,
  currentMapId,
  editingMapId,
  editingTitle,
  onSelectMap,
  onFinishRename,
  onCancelRename,
  onEditingTitleChange,
  onDragStart,
  onContextMenu
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
          onContextMenu={(e) => onContextMenu && onContextMenu(e, categoryPath, 'map', map)}
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
              <span className="map-file-icon">🗺️</span>
              <div className="map-details">
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
            </div>
          )}
        </div>
      ))}
    </>
  );
};

export default MapItemList;