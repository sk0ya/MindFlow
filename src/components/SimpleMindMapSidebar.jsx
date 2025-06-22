import React, { useState } from 'react';

const SimpleMindMapSidebar = ({
  mindMaps = [],
  currentMapId,
  onCreateMap,
  onSelectMap,
  onRenameMap,
  onDeleteMap,
  onToggleCollapse
}) => {
  const [editingMapId, setEditingMapId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleStartRename = (mapId, currentTitle) => {
    setEditingMapId(mapId);
    setEditingTitle(currentTitle);
  };

  const handleFinishRename = (mapId) => {
    if (editingTitle.trim() && editingTitle.trim() !== '') {
      onRenameMap(mapId, editingTitle.trim());
    }
    setEditingMapId(null);
    setEditingTitle('');
  };

  const handleCancelRename = () => {
    setEditingMapId(null);
    setEditingTitle('');
  };

  const handleKeyDown = (e, mapId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFinishRename(mapId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelRename();
    }
  };

  const handleCreateNewMap = () => {
    onCreateMap('新しいマインドマップ');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="simple-mindmap-sidebar">
      {/* ヘッダー */}
      <div className="sidebar-header">
        <div className="header-title">
          <h3>マインドマップ</h3>
          <span className="map-count">({mindMaps.length})</span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="close-button"
          title="サイドバーを閉じる"
        >
          ×
        </button>
      </div>

      {/* 新規作成ボタン */}
      <div className="create-section">
        <button
          onClick={handleCreateNewMap}
          className="create-button"
        >
          <span className="plus-icon">+</span>
          新しいマップを作成
        </button>
      </div>

      {/* マップリスト */}
      <div className="maps-list">
        {mindMaps.length === 0 ? (
          <div className="empty-state">
            <p>マップがありません</p>
            <small>上のボタンから新しいマップを作成してください</small>
          </div>
        ) : (
          mindMaps.map(map => (
            <div
              key={map.id}
              className={`map-item ${map.id === currentMapId ? 'current' : ''}`}
            >
              <div
                className="map-content"
                onClick={() => map.id !== currentMapId && onSelectMap(map.id)}
              >
                <div className="map-title-section">
                  {editingMapId === map.id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleFinishRename(map.id)}
                      onKeyDown={(e) => handleKeyDown(e, map.id)}
                      className="edit-input"
                      autoFocus
                    />
                  ) : (
                    <h4 className="map-title">{map.title}</h4>
                  )}
                  {map.id === currentMapId && (
                    <span className="current-indicator">現在</span>
                  )}
                </div>
                
                <div className="map-meta">
                  <span className="update-time">
                    {formatDate(map.updatedAt || map.createdAt)}
                  </span>
                </div>
              </div>

              <div className="map-actions">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartRename(map.id, map.title);
                  }}
                  className="action-btn"
                  title="名前を変更"
                >
                  ✏️
                </button>
                
                {mindMaps.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`"${map.title}"を削除しますか？`)) {
                        onDeleteMap(map.id);
                      }
                    }}
                    className="action-btn delete"
                    title="削除"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .simple-mindmap-sidebar {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #f8f9fa;
          border-right: 1px solid #e1e5e9;
        }

        .sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #e1e5e9;
          background: white;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .header-title h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #333;
        }

        .map-count {
          font-size: 14px;
          color: #666;
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 12px;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #666;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .close-button:hover {
          background: #f0f0f0;
          color: #333;
        }

        .create-section {
          padding: 16px;
          border-bottom: 1px solid #e1e5e9;
        }

        .create-button {
          width: 100%;
          padding: 12px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background 0.2s;
        }

        .create-button:hover {
          background: #0056b3;
        }

        .plus-icon {
          font-size: 16px;
          font-weight: bold;
        }

        .maps-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #666;
        }

        .empty-state p {
          margin: 0 0 8px 0;
          font-size: 16px;
        }

        .empty-state small {
          font-size: 14px;
          opacity: 0.8;
        }

        .map-item {
          display: flex;
          align-items: center;
          margin-bottom: 4px;
          border-radius: 6px;
          background: white;
          border: 1px solid #e1e5e9;
          transition: all 0.2s;
        }

        .map-item:hover {
          border-color: #007bff;
          box-shadow: 0 2px 4px rgba(0,123,255,0.1);
        }

        .map-item.current {
          border-color: #007bff;
          background: #f8f9ff;
        }

        .map-content {
          flex: 1;
          padding: 12px;
          cursor: pointer;
        }

        .map-title-section {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .map-title {
          margin: 0;
          font-size: 14px;
          font-weight: 500;
          color: #333;
          flex: 1;
        }

        .current-indicator {
          background: #007bff;
          color: white;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 8px;
          font-weight: 500;
        }

        .edit-input {
          border: 1px solid #007bff;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 14px;
          width: 100%;
        }

        .map-meta {
          font-size: 12px;
          color: #666;
        }

        .map-actions {
          display: flex;
          padding: 8px;
          gap: 4px;
        }

        .action-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          font-size: 12px;
          transition: background 0.2s;
        }

        .action-btn:hover {
          background: #f0f0f0;
        }

        .action-btn.delete:hover {
          background: #fee;
        }
      `}</style>
    </div>
  );
};

export default SimpleMindMapSidebar;