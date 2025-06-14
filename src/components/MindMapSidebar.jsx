import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';

const MindMapSidebar = ({ 
  mindMaps, 
  currentMapId, 
  onSelectMap, 
  onCreateMap, 
  onDeleteMap,
  onRenameMap,
  isCollapsed,
  onToggleCollapse 
}) => {
  const [editingMapId, setEditingMapId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleStartRename = useCallback((mapId, currentTitle) => {
    setEditingMapId(mapId);
    setEditingTitle(currentTitle);
  }, []);

  const handleFinishRename = useCallback((mapId) => {
    if (editingTitle.trim() && editingTitle.trim() !== '') {
      onRenameMap(mapId, editingTitle.trim());
    }
    setEditingMapId(null);
    setEditingTitle('');
  }, [editingTitle, onRenameMap]);

  const handleCancelRename = useCallback(() => {
    setEditingMapId(null);
    setEditingTitle('');
  }, []);

  const handleKeyDown = useCallback((e, mapId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFinishRename(mapId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelRename();
    }
  }, [handleFinishRename, handleCancelRename]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getNodeCount = (rootNode) => {
    const count = (node) => {
      let total = 1;
      if (node.children) {
        node.children.forEach(child => {
          total += count(child);
        });
      }
      return total;
    };
    return count(rootNode);
  };

  if (isCollapsed) {
    return (
      <div className="mindmap-sidebar collapsed">
        <button 
          className="toggle-button"
          onClick={onToggleCollapse}
          aria-label="サイドバーを展開"
        >
          ▶
        </button>
        
        <div className="collapsed-actions">
          <button 
            className="action-button create"
            onClick={() => {
              const mapName = prompt('新しいマインドマップの名前を入力してください:', '新しいマインドマップ');
              if (mapName && mapName.trim()) {
                onCreateMap(mapName.trim());
              }
            }}
            title="新しいマインドマップ"
          >
            +
          </button>
        </div>

        <style jsx>{`
          .mindmap-sidebar.collapsed {
            width: 50px;
            height: 100vh;
            background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
            border-right: 2px solid #dee2e6;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 16px 8px;
            position: fixed;
            left: 0;
            top: 0;
            z-index: 100;
          }

          .toggle-button {
            background: #4285f4;
            color: white;
            border: none;
            border-radius: 6px;
            width: 32px;
            height: 32px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            margin-bottom: 16px;
            transition: all 0.2s ease;
          }

          .toggle-button:hover {
            background: #3367d6;
            transform: scale(1.05);
          }

          .collapsed-actions {
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: 100%;
          }

          .action-button {
            background: #34a853;
            color: white;
            border: none;
            border-radius: 6px;
            width: 32px;
            height: 32px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: bold;
            transition: all 0.2s ease;
          }

          .action-button:hover {
            background: #2d8a47;
            transform: scale(1.05);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="mindmap-sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">マインドマップ</h2>
        <div className="header-actions">
          <button 
            className="action-button create"
            onClick={() => {
              const mapName = prompt('新しいマインドマップの名前を入力してください:', '新しいマインドマップ');
              if (mapName && mapName.trim()) {
                onCreateMap(mapName.trim());
              }
            }}
            title="新しいマインドマップ"
          >
            +
          </button>
          <button 
            className="toggle-button"
            onClick={onToggleCollapse}
            aria-label="サイドバーを折りたたむ"
          >
            ◀
          </button>
        </div>
      </div>

      <div className="maps-list">
        {mindMaps.map(map => (
          <div 
            key={map.id}
            className={`map-item ${currentMapId === map.id ? 'active' : ''}`}
          >
            <div 
              className="map-content"
              onClick={() => onSelectMap(map.id)}
            >
              <div className="map-main">
                {editingMapId === map.id ? (
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => handleFinishRename(map.id)}
                    onKeyDown={(e) => handleKeyDown(e, map.id)}
                    className="title-input"
                    autoFocus
                  />
                ) : (
                  <h3 className="map-title" title={map.title}>
                    {map.title.length > 20 ? map.title.substring(0, 20) + '...' : map.title}
                  </h3>
                )}
                
                <div className="map-info">
                  <span className="node-count">{getNodeCount(map.rootNode)} ノード</span>
                  <span className="update-date">{formatDate(map.updatedAt)}</span>
                </div>
              </div>

              {currentMapId === map.id && (
                <div className="active-indicator">●</div>
              )}
            </div>

            <div className="map-actions">
              <button
                className="action-btn rename"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartRename(map.id, map.title);
                }}
                title="名前を変更"
              >
                ✏️
              </button>
              
              <button
                className="action-btn delete"
                onClick={(e) => {
                  e.stopPropagation();
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

        {mindMaps.length === 0 && (
          <div className="empty-state">
            <p>マインドマップがありません</p>
            <button 
              className="create-first-button"
              onClick={() => {
                const mapName = prompt('新しいマインドマップの名前を入力してください:', '新しいマインドマップ');
                if (mapName && mapName.trim()) {
                  onCreateMap(mapName.trim());
                }
              }}
            >
              最初のマップを作成
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .mindmap-sidebar {
          width: 280px;
          height: 100vh;
          background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
          border-right: 2px solid #dee2e6;
          display: flex;
          flex-direction: column;
          position: fixed;
          left: 0;
          top: 0;
          z-index: 100;
          overflow: hidden;
        }

        .sidebar-header {
          padding: 20px;
          border-bottom: 1px solid #dee2e6;
          background: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .sidebar-title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #333;
        }

        .header-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .action-button {
          background: #34a853;
          color: white;
          border: none;
          border-radius: 6px;
          width: 32px;
          height: 32px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: bold;
          transition: all 0.2s ease;
        }

        .action-button:hover {
          background: #2d8a47;
          transform: scale(1.05);
        }

        .toggle-button {
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 6px;
          width: 32px;
          height: 32px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          transition: all 0.2s ease;
        }

        .toggle-button:hover {
          background: #5a6268;
          transform: scale(1.05);
        }

        .maps-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        .map-item {
          background: white;
          border: 1px solid #e1e5e9;
          border-radius: 8px;
          margin-bottom: 8px;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .map-item:hover {
          border-color: #4285f4;
          box-shadow: 0 2px 8px rgba(66, 133, 244, 0.1);
        }

        .map-item.active {
          border-color: #4285f4;
          background: #f8f9ff;
          box-shadow: 0 2px 12px rgba(66, 133, 244, 0.15);
        }

        .map-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          cursor: pointer;
        }

        .map-main {
          flex: 1;
          min-width: 0;
        }

        .map-title {
          margin: 0 0 4px 0;
          font-size: 14px;
          font-weight: 500;
          color: #333;
          word-break: break-word;
        }

        .title-input {
          width: 100%;
          border: 1px solid #4285f4;
          border-radius: 4px;
          padding: 4px 6px;
          font-size: 14px;
          font-weight: 500;
          background: white;
          outline: none;
        }

        .map-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .node-count {
          font-size: 12px;
          color: #666;
          font-weight: 500;
        }

        .update-date {
          font-size: 11px;
          color: #999;
        }

        .active-indicator {
          color: #4285f4;
          font-size: 12px;
          margin-left: 8px;
        }

        .map-actions {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .map-item:hover .map-actions {
          opacity: 1;
        }

        .action-btn {
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid #ddd;
          border-radius: 4px;
          width: 24px;
          height: 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          transition: all 0.2s ease;
        }

        .action-btn:hover {
          background: white;
          transform: scale(1.1);
        }

        .action-btn.delete:hover {
          background: #fef2f2;
          border-color: #fecaca;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #666;
        }

        .empty-state p {
          margin: 0 0 16px 0;
          font-size: 14px;
        }

        .create-first-button {
          background: #4285f4;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .create-first-button:hover {
          background: #3367d6;
          transform: translateY(-1px);
        }

        /* スクロールバーのスタイル */
        .maps-list::-webkit-scrollbar {
          width: 6px;
        }

        .maps-list::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }

        .maps-list::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 3px;
        }

        .maps-list::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }

        @media (max-width: 768px) {
          .mindmap-sidebar {
            width: 250px;
          }
          
          .sidebar-header {
            padding: 16px;
          }
          
          .sidebar-title {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
};

MindMapSidebar.propTypes = {
  mindMaps: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    rootNode: PropTypes.object.isRequired,
    updatedAt: PropTypes.string.isRequired
  })).isRequired,
  currentMapId: PropTypes.string,
  onSelectMap: PropTypes.func.isRequired,
  onCreateMap: PropTypes.func.isRequired,
  onDeleteMap: PropTypes.func.isRequired,
  onRenameMap: PropTypes.func.isRequired,
  isCollapsed: PropTypes.bool.isRequired,
  onToggleCollapse: PropTypes.func.isRequired
};

export default MindMapSidebar;