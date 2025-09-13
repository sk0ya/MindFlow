import React, { useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import type { NodeLink, MindMapNode, MindMapData } from '@shared/types';

interface MapOption {
  id: string;
  title: string;
}

interface NodeOption {
  id: string;
  text: string;
  mapId?: string;
}

interface NodeLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: MindMapNode;
  link?: NodeLink | null; // 編集時のみ
  onSave: (link: Partial<NodeLink>) => void;
  onDelete?: (linkId: string) => void;
  availableMaps?: MapOption[];
  currentMapData?: MindMapData;
  onLoadMapData?: (mapId: string) => Promise<MindMapData | null>;
}

const NodeLinkModal: React.FC<NodeLinkModalProps> = ({
  isOpen,
  onClose,
  node,
  link,
  onSave,
  onDelete,
  availableMaps = [],
  currentMapData,
  onLoadMapData
}) => {
  const [selectedMapId, setSelectedMapId] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [loadedMapData, setLoadedMapData] = useState<MindMapData | null>(null);
  const [isLoadingMapData, setIsLoadingMapData] = useState(false);
  
  // ノード一覧を生成するヘルパー関数
  const flattenNodes = useCallback((rootNode: MindMapNode, mapId?: string): NodeOption[] => {
    const result: NodeOption[] = [];
    
    const traverse = (node: MindMapNode) => {
      result.push({
        id: node.id,
        text: node.text,
        mapId
      });
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    
    traverse(rootNode);
    return result;
  }, []);
  
  // 選択されたマップのノード一覧
  const availableNodes = useCallback(() => {
    if (!selectedMapId) {
      // マップが選択されていない場合は空の配列を返す
      return [];
    }
    
    if (selectedMapId === currentMapData?.id) {
      // 現在のマップが選択された場合
      return currentMapData ? flattenNodes(currentMapData.rootNode, selectedMapId) : [];
    }
    
    // 他のマップが選択された場合
    if (loadedMapData && loadedMapData.id === selectedMapId) {
      return flattenNodes(loadedMapData.rootNode, selectedMapId);
    }
    
    return [];
  }, [selectedMapId, currentMapData, loadedMapData, flattenNodes]);

  // 編集時は既存データを読み込み
  useEffect(() => {
    if (link) {
      setSelectedMapId(link.targetMapId || '');
      setSelectedNodeId(link.targetNodeId || '');
    } else {
      // 新規作成時はフィールドをクリア
      setSelectedMapId('');
      setSelectedNodeId('');
    }
  }, [link, isOpen]);

  // マップが変更された時にノード選択をリセットし、データを読み込み
  useEffect(() => {
    setSelectedNodeId('');
    
    // 他のマップが選択された場合、そのデータを読み込む
    if (selectedMapId && selectedMapId !== currentMapData?.id && onLoadMapData) {
      setIsLoadingMapData(true);
      onLoadMapData(selectedMapId)
        .then(mapData => {
          setLoadedMapData(mapData);
        })
        .catch(error => {
          console.error('マップデータの読み込みに失敗:', error);
          setLoadedMapData(null);
        })
        .finally(() => {
          setIsLoadingMapData(false);
        });
    } else {
      // 現在のマップまたは未選択の場合はクリア
      setLoadedMapData(null);
      setIsLoadingMapData(false);
    }
  }, [selectedMapId, currentMapData?.id, onLoadMapData]);

  const handleSave = useCallback(() => {
    // マップが選択されていない場合は保存しない
    if (!selectedMapId) {
      return;
    }

    const linkData: Partial<NodeLink> = {
      ...(link?.id && { id: link.id }),
      targetMapId: selectedMapId,
      targetNodeId: selectedNodeId || undefined,
      createdAt: link?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(linkData);
    onClose();
  }, [selectedMapId, selectedNodeId, link, onSave, onClose]);

  const handleDelete = useCallback(() => {
    if (link?.id && onDelete) {
      if (confirm('このリンクを削除しますか？')) {
        onDelete(link.id);
        onClose();
      }
    }
  }, [link, onDelete, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [handleSave, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2>{link ? 'リンクの編集' : 'リンクの追加'}</h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="モーダルを閉じる"
          >
<X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="target-map">リンク先のマップ</label>
            <select
              id="target-map"
              value={selectedMapId}
              onChange={(e) => setSelectedMapId(e.target.value)}
            >
              <option value="">-- マップを選択 --</option>
              {availableMaps.map((map) => (
                <option key={map.id} value={map.id}>
                  {map.title}
                </option>
              ))}
            </select>
            <small className="field-help">
              リンク先のマインドマップを選択してください
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="target-node">リンク先のノード</label>
            <select
              id="target-node"
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              disabled={isLoadingMapData || !selectedMapId}
            >
              <option value="">-- ノードを選択 --</option>
              {availableNodes().map((node) => (
                <option key={node.id} value={node.id}>
                  {node.text}
                </option>
              ))}
            </select>
            <small className="field-help">
              {!selectedMapId
                ? 'まずマップを選択してください'
                : isLoadingMapData
                ? 'マップデータを読み込み中...'
                : selectedMapId && selectedMapId !== currentMapData?.id && !loadedMapData
                ? 'マップデータの読み込みに失敗しました'
                : 'リンク先のノードを選択してください'
              }
            </small>
          </div>

          <div className="current-node-info">
            <p>
              <strong>現在のノード:</strong> {node.text}
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <div className="footer-left">
            {link && onDelete && (
              <button
                className="btn btn-danger"
                onClick={handleDelete}
              >
                削除
              </button>
            )}
          </div>
          <div className="footer-right">
            <button
              className="btn btn-secondary"
              onClick={onClose}
            >
              キャンセル
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!selectedMapId}
            >
              {link ? '更新' : '作成'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
          box-sizing: border-box;
        }

        .modal-content {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px 16px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6b7280;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .modal-close:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .modal-body {
          padding: 20px 24px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-weight: 500;
          color: #374151;
          margin-bottom: 6px;
          font-size: 14px;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
          box-sizing: border-box;
          transition: border-color 0.2s ease;
        }

        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-group textarea {
          resize: vertical;
          min-height: 80px;
        }

        .form-group select {
          appearance: none;
          background-image: url('data:image/svg+xml;charset=US-ASCII,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 5"><path fill="%23666" d="m0 0 2 2 2-2z"/></svg>');
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 12px;
          padding-right: 36px;
        }

        .form-group select:disabled {
          background-color: #f9fafb;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .field-help {
          display: block;
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
          line-height: 1.4;
        }

        .current-node-info {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 12px;
          margin-top: 16px;
        }

        .current-node-info p {
          margin: 0 0 4px 0;
          font-size: 13px;
          color: #374151;
        }

        .current-node-info p:last-child {
          margin-bottom: 0;
        }

        .modal-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px 20px;
          border-top: 1px solid #e5e7eb;
        }

        .footer-left,
        .footer-right {
          display: flex;
          gap: 8px;
        }

        .btn {
          padding: 8px 16px;
          border: 1px solid;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          outline: none;
        }

        .btn:focus {
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .btn-primary {
          background: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
          border-color: #2563eb;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: white;
          border-color: #d1d5db;
          color: #374151;
        }

        .btn-secondary:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .btn-danger {
          background: #ef4444;
          border-color: #ef4444;
          color: white;
        }

        .btn-danger:hover {
          background: #dc2626;
          border-color: #dc2626;
        }
      `}</style>
    </div>
  );
};

export default NodeLinkModal;