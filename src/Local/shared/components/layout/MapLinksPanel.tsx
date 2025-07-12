import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { MindMapNode, MindMapData, MapLink } from '../../types';

// Type definitions
interface Position {
  x: number;
  y: number;
}

interface NodeMapLinksPanelProps {
  isOpen: boolean;
  position: Position;
  selectedNode: MindMapNode | null;
  currentMapId: string;
  allMaps: MindMapData[];
  onClose: () => void;
  onAddLink: (nodeId: string, targetMapId: string, targetMapTitle: string, description: string) => void;
  onRemoveLink: (nodeId: string, linkId: string) => void;
  onNavigateToMap: (mapId: string) => void;
}

const NodeMapLinksPanel: React.FC<NodeMapLinksPanelProps> = ({
  isOpen,
  position,
  selectedNode,
  currentMapId,
  allMaps,
  onClose,
  onAddLink,
  onRemoveLink,
  onNavigateToMap
}) => {
  const [selectedMapId, setSelectedMapId] = useState<string>('');
  const [linkDescription, setLinkDescription] = useState<string>('');
  const panelRef = useRef<HTMLDivElement>(null);

  const handleAddLink = useCallback(() => {
    if (selectedMapId && selectedMapId !== currentMapId) {
      const targetMap = allMaps.find(map => map.id === selectedMapId);
      if (targetMap) {
        onAddLink(selectedNode!.id, selectedMapId, targetMap.title, linkDescription.trim());
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

  const availableMaps = allMaps.filter((map: MindMapData) => 
    map.id !== currentMapId && 
    !selectedNode!.mapLinks?.some((link: MapLink) => link.targetMapId === map.id)
  );

  // クリック外し検出でパネルを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      // パネルにフォーカスを当てる
      if (panelRef.current) {
        panelRef.current.focus();
      }

      // 少し遅延してイベントリスナーを追加（パネルが開いた直後のクリックを避けるため）
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscapeKey);
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
    
    return undefined;
  }, [isOpen, onClose]);

  if (!isOpen || !selectedNode) return null;

  return (
    <div 
      ref={panelRef}
      className="node-map-links-panel" 
      style={{ left: position.x, top: position.y }}
      tabIndex={-1}
    >
      <div className="panel-header">
        <h3>ノードマップリンク</h3>
        <p className="node-info">ノード: {selectedNode.text}</p>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="panel-content">
        {/* 既存のリンク一覧 */}
        <div className="existing-links">
          <h4>既存のリンク</h4>
          {selectedNode.mapLinks && selectedNode.mapLinks.length > 0 ? (
            <div className="links-list">
              {selectedNode.mapLinks.map((link: MapLink) => (
                <div key={link.id} className="link-item">
                  <div 
                    className="link-info"
                    onDoubleClick={() => onNavigateToMap(link.targetMapId)}
                    style={{ cursor: 'pointer' }}
                    title="ダブルクリックでマップに移動"
                  >
                    <div className="link-title">{link.targetMapTitle}</div>
                    {link.description && (
                      <div className="link-description">{link.description}</div>
                    )}
                  </div>
                  <div className="link-actions">
                    <button
                      className="navigate-btn"
                      onClick={() => onNavigateToMap(link.targetMapId)}
                      title="このマップに移動"
                    >
                      🔗
                    </button>
                    <button
                      className="remove-btn"
                      onClick={() => onRemoveLink(selectedNode.id, link.id)}
                      title="リンクを削除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-links">リンクがありません</div>
          )}
        </div>

        {/* 新しいリンク追加 */}
        <div className="add-link-section">
          <h4>新しいリンクを追加</h4>
          {availableMaps.length > 0 ? (
            <div className="add-link-form">
              <select
                value={selectedMapId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMapId(e.target.value)}
                className="map-select"
              >
                <option value="">リンク先マップを選択...</option>
                {availableMaps.map((map: MindMapData) => (
                  <option key={map.id} value={map.id}>
                    {map.title} ({map.category})
                  </option>
                ))}
              </select>
              
              <input
                type="text"
                placeholder="リンクの説明（省略可）"
                value={linkDescription}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLinkDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                className="description-input"
                maxLength={100}
              />
              
              <button
                className="add-btn"
                onClick={handleAddLink}
                disabled={!selectedMapId}
              >
                リンクを追加
              </button>
            </div>
          ) : (
            <div className="no-available-maps">
              リンク可能なマップがありません
            </div>
          )}
        </div>
      </div>

      <style>{`
        .node-map-links-panel {
          position: fixed;
          width: 400px;
          max-height: 500px;
          background: white;
          border: 1px solid #e1e5e9;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          overflow: hidden;
          outline: none;
        }

        .node-map-links-panel:focus {
          border-color: #4285f4;
          box-shadow: 0 8px 32px rgba(66, 133, 244, 0.25);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e1e5e9;
        }

        .panel-header h3 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .node-info {
          margin: 0;
          font-size: 12px;
          color: #666;
          font-style: italic;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          color: #666;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .close-btn:hover {
          background: #e9ecef;
          color: #333;
        }

        .panel-content {
          padding: 20px;
          max-height: 400px;
          overflow-y: auto;
        }

        .existing-links {
          margin-bottom: 24px;
        }

        .existing-links h4,
        .add-link-section h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .help-text {
          margin: 0 0 8px 0;
          font-size: 12px;
          color: #666;
          font-style: italic;
        }

        .links-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .link-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #f8f9ff;
          border: 1px solid #e1e5e9;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .link-item:hover {
          border-color: #e1e5e9;
        }

        .link-info {
          flex: 1;
          min-width: 0;
          padding: 4px;
          border-radius: 4px;
          transition: background-color 0.2s ease;
        }

        .link-info:hover {
          background-color: #f0f8ff;
        }

        .link-title {
          font-weight: 500;
          color: #333;
          margin-bottom: 2px;
        }

        .link-description {
          font-size: 12px;
          color: #666;
          font-style: italic;
        }

        .link-actions {
          display: flex;
          gap: 4px;
        }

        .navigate-btn,
        .remove-btn {
          background: none;
          border: 1px solid #ddd;
          border-radius: 4px;
          width: 28px;
          height: 28px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          transition: all 0.2s ease;
        }

        .navigate-btn:hover {
          background: #e3f2fd;
          border-color: #4285f4;
        }

        .remove-btn:hover {
          background: #ffebee;
          border-color: #f44336;
        }

        .no-links,
        .no-available-maps {
          text-align: center;
          color: #666;
          font-size: 14px;
          padding: 20px;
          font-style: italic;
        }

        .add-link-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .map-select,
        .description-input {
          padding: 8px 12px;
          border: 1px solid #e1e5e9;
          border-radius: 6px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s ease;
        }

        .map-select:focus,
        .description-input:focus {
          border-color: #4285f4;
        }

        .add-btn {
          background: #4285f4;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .add-btn:hover:not(:disabled) {
          background: #3367d6;
          transform: translateY(-1px);
        }

        .add-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        /* スクロールバーのスタイル */
        .panel-content::-webkit-scrollbar {
          width: 6px;
        }

        .panel-content::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }

        .panel-content::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 3px;
        }

        .panel-content::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
      `}</style>
    </div>
  );
};


export default NodeMapLinksPanel;