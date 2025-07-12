import React, { useState, useCallback } from 'react';
import type { MindMapData, MindMapNode } from '../../../../shared/types';

interface MindMapSidebarProps {
  mindMaps: MindMapData[];
  currentMapId: string | null;
  onSelectMap: (mapId: string) => void;
  onCreateMap: (title: string, category?: string) => void;
  onDeleteMap: (mapId: string) => void;
  onRenameMap: (mapId: string, newTitle: string) => void;
  onChangeCategory: (mapId: string, category: string) => void;
  availableCategories: string[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const MindMapSidebar: React.FC<MindMapSidebarProps> = ({ 
  mindMaps, 
  currentMapId, 
  onSelectMap, 
  onCreateMap, 
  onDeleteMap,
  onRenameMap,
  onChangeCategory,
  isCollapsed,
  onToggleCollapse 
}) => {
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState(new Set<string>());
  const [draggedMap, setDraggedMap] = useState<MindMapData | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

  const handleStartRename = useCallback((mapId: string, currentTitle: string) => {
    setEditingMapId(mapId);
    setEditingTitle(currentTitle);
  }, []);

  const handleFinishRename = useCallback((mapId: string) => {
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, mapId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFinishRename(mapId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelRename();
    }
  }, [handleFinishRename, handleCancelRename]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getNodeCount = (rootNode: MindMapNode): number => {
    if (!rootNode) return 0;
    const count = (node: MindMapNode): number => {
      let total = 1;
      if (node.children) {
        node.children.forEach((child: MindMapNode) => {
          total += count(child);
        });
      }
      return total;
    };
    return count(rootNode);
  };

  // フィルター機能
  const filteredMindMaps = mindMaps.filter(map => {
    const searchLower = searchTerm.toLowerCase();
    const titleMatch = map.title.toLowerCase().includes(searchLower);
    const categoryMatch = (map.category || '未分類').toLowerCase().includes(searchLower);
    return titleMatch || categoryMatch;
  });

  // カテゴリー別にグループ化
  const groupedMaps = filteredMindMaps.reduce((groups: Record<string, MindMapData[]>, map) => {
    const category = map.category || '未分類';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(map);
    return groups;
  }, {});

  // カテゴリー折りたたみトグル
  const toggleCategoryCollapse = (category: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category);
    } else {
      newCollapsed.add(category);
    }
    setCollapsedCategories(newCollapsed);
  };

  // ドラッグ&ドロップ機能
  const handleDragStart = (e: React.DragEvent, map: MindMapData) => {
    setDraggedMap(map);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCategory(category);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverCategory(null);
    }
  };

  const handleDrop = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    if (draggedMap && draggedMap.category !== category) {
      onChangeCategory(draggedMap.id, category);
    }
    setDraggedMap(null);
    setDragOverCategory(null);
  };

  // 新しいカテゴリー作成
  const handleCreateCategory = () => {
    const newCategory = prompt('新しいカテゴリー名を入力してください:', '');
    if (newCategory && newCategory.trim()) {
      const mapName = prompt('新しいマインドマップの名前を入力してください:', '新しいマインドマップ');
      if (mapName && mapName.trim()) {
        onCreateMap(mapName.trim(), newCategory.trim());
      }
    }
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
          <button 
            className="action-button category"
            onClick={handleCreateCategory}
            title="新しいカテゴリー"
          >
            📁
          </button>
        </div>

        <style>{`
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

          .action-button.category {
            background: #ff9800;
          }

          .action-button.category:hover {
            background: #f57c00;
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
            className="action-button category"
            onClick={handleCreateCategory}
            title="新しいカテゴリー"
          >
            📁
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

      <div className="search-container">
        <div className="search-input-wrapper">
          <input
            type="text"
            placeholder="マップ・カテゴリーで検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchTerm('')}
              title="検索をクリア"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="maps-list">
        {Object.keys(groupedMaps).length === 0 ? (
          <div className="empty-state">
            {searchTerm ? (
              <p>「{searchTerm}」に一致するマップが見つかりません</p>
            ) : (
              <>
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
              </>
            )}
          </div>
        ) : (
          Object.entries(groupedMaps).map(([category, maps]) => (
            <div key={category} className="category-group">
              <div 
                className={`category-header ${dragOverCategory === category ? 'drag-over' : ''}`}
                onClick={() => toggleCategoryCollapse(category)}
                onDragOver={(e) => handleDragOver(e, category)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, category)}
              >
                <span className="category-toggle">
                  {collapsedCategories.has(category) ? '▶' : '▼'}
                </span>
                <span className="category-name">{category}</span>
                <span className="category-count">({maps.length})</span>
              </div>
              
              {!collapsedCategories.has(category) && (
                <div className="category-maps">
                  {maps.map(map => (
                    <div 
                      key={map.id}
                      className={`map-item ${currentMapId === map.id ? 'active' : ''} ${draggedMap?.id === map.id ? 'dragging' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, map)}
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
                              {map.title.length > 18 ? map.title.substring(0, 18) + '...' : map.title}
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
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <style>{`
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
          gap: 6px;
          align-items: center;
        }

        .action-button.category {
          background: #ff9800;
        }

        .action-button.category:hover {
          background: #f57c00;
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

        .search-container {
          padding: 12px;
          border-bottom: 1px solid #e1e5e9;
        }

        .search-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-input {
          width: 100%;
          border: 1px solid #e1e5e9;
          border-radius: 6px;
          padding: 8px 12px;
          padding-right: 36px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s ease;
        }

        .search-input:focus {
          border-color: #4285f4;
        }

        .search-clear-btn {
          position: absolute;
          right: 8px;
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          font-size: 14px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .search-clear-btn:hover {
          background: #f0f0f0;
          color: #333;
        }

        .maps-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .category-group {
          margin-bottom: 8px;
        }

        .category-header {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background: #f5f5f5;
          border: 1px solid #e1e5e9;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 4px;
        }

        .category-header:hover {
          background: #e8f4f8;
          border-color: #4285f4;
        }

        .category-header.drag-over {
          background: #fff3cd;
          border-color: #ffc107;
          box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3);
        }

        .category-toggle {
          margin-right: 8px;
          font-size: 12px;
          color: #666;
        }

        .category-name {
          flex: 1;
          font-weight: 500;
          color: #333;
          font-size: 14px;
        }

        .category-count {
          color: #666;
          font-size: 12px;
        }

        .category-maps {
          margin-left: 16px;
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

        .map-item.dragging {
          opacity: 0.5;
          transform: scale(0.95);
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


export default MindMapSidebar;