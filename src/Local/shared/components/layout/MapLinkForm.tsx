import React, { useState, useCallback } from 'react';
import type { MindMapData, MindMapNode } from '../../types';

interface MapLinkFormProps {
  selectedNode: MindMapNode | null;
  currentMapId: string;
  allMaps: MindMapData[];
  onAddLink: (nodeId: string, targetMapId: string, targetMapTitle: string, description: string) => void;
}

export const MapLinkForm: React.FC<MapLinkFormProps> = ({
  selectedNode,
  currentMapId,
  allMaps,
  onAddLink
}) => {
  const [selectedMapId, setSelectedMapId] = useState<string>('');
  const [linkDescription, setLinkDescription] = useState<string>('');

  const handleAddLink = useCallback(() => {
    if (selectedMapId && selectedMapId !== currentMapId && selectedNode) {
      const targetMap = allMaps.find(map => map.id === selectedMapId);
      if (targetMap) {
        onAddLink(selectedNode.id, selectedMapId, targetMap.title, linkDescription.trim());
        setSelectedMapId('');
        setLinkDescription('');
      }
    }
  }, [selectedMapId, currentMapId, allMaps, linkDescription, onAddLink, selectedNode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleAddLink();
    }
  }, [handleAddLink]);

  // フィルタリングされたマップ一覧（現在のマップを除外）
  const availableMaps = allMaps.filter(map => map.id !== currentMapId);

  if (!selectedNode) {
    return null;
  }

  return (
    <div className="add-link-section">
      <h4>新しいリンクを追加</h4>
      <div className="form-group">
        <label htmlFor="map-select">リンク先マップ:</label>
        <select
          id="map-select"
          value={selectedMapId}
          onChange={(e) => setSelectedMapId(e.target.value)}
          onKeyDown={handleKeyDown}
        >
          <option value="">マップを選択...</option>
          {availableMaps.map(map => (
            <option key={map.id} value={map.id}>
              {map.title} ({map.category || '未分類'})
            </option>
          ))}
        </select>
      </div>
      
      <div className="form-group">
        <label htmlFor="description-input">説明 (任意):</label>
        <input
          id="description-input"
          type="text"
          placeholder="リンクの説明を入力..."
          value={linkDescription}
          onChange={(e) => setLinkDescription(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      
      <div className="button-group">
        <button
          onClick={handleAddLink}
          disabled={!selectedMapId || selectedMapId === currentMapId}
          className="add-button"
        >
          リンクを追加
        </button>
        <small>Ctrl+Enter で追加</small>
      </div>
    </div>
  );
};