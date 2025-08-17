import React from 'react';

interface SidebarHeaderProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onCreateMap: (title: string, category?: string) => void;
  onToggleCollapse?: () => void;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  searchTerm,
  onSearchChange,
  onCreateMap,
  onToggleCollapse
}) => {
  const handleCreateCategory = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      // eslint-disable-next-line no-alert
      const newCategory = window.prompt('新しいカテゴリー名を入力してください:', '');
      if (newCategory && newCategory.trim()) {
        // eslint-disable-next-line no-alert
        const mapName = window.prompt('新しいマインドマップの名前を入力してください:', '新しいマインドマップ');
        if (mapName && mapName.trim()) {
          onCreateMap(mapName.trim(), newCategory.trim());
        }
      }
    } catch (error) {
      console.error('フォルダ作成エラー:', error);
    }
  };

  return (
    <div className="sidebar-header">
      <div className="header-actions">
        {onToggleCollapse && (
          <button
            className="sidebar-collapse-toggle"
            onClick={onToggleCollapse}
            title="サイドバーを隠す"
          >
            ◀
          </button>
        )}
        <button 
          className="action-button create"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            
            try {
              // eslint-disable-next-line no-alert
              const mapName = window.prompt('新しいマインドマップの名前を入力してください:', '新しいマインドマップ');
              if (mapName && mapName.trim()) {
                onCreateMap(mapName.trim());
              }
            } catch (error) {
              console.error('マップ作成エラー:', error);
            }
          }}
          title="新しいマインドマップ"
          type="button"
        >
          +
        </button>
        
        <button 
          className="action-button category"
          onClick={handleCreateCategory}
          title="新しいカテゴリー"
          type="button"
        >
          📁
        </button>
        
      </div>
      
      <div className="search-container">
        <input
          type="text"
          placeholder="マインドマップを検索..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
      </div>
    </div>
  );
};

export default SidebarHeader;