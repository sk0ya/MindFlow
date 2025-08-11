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
  const handleCreateCategory = () => {
    // eslint-disable-next-line no-alert
    const newCategory = prompt('新しいカテゴリー名を入力してください:', '');
    if (newCategory && newCategory.trim()) {
      // eslint-disable-next-line no-alert
      const mapName = prompt('新しいマインドマップの名前を入力してください:', '新しいマインドマップ');
      if (mapName && mapName.trim()) {
        onCreateMap(mapName.trim(), newCategory.trim());
      }
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
          onClick={() => {
            // eslint-disable-next-line no-alert
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