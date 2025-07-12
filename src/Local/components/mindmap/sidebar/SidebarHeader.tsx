import React from 'react';

interface SidebarHeaderProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onCreateMap: (title: string, category?: string) => void;
  onToggleCollapse: () => void;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  searchTerm,
  onSearchChange,
  onCreateMap,
  onToggleCollapse
}) => {
  const handleCreateCategory = () => {
    const newCategory = prompt('新しいカテゴリー名を入力してください:', '');
    if (newCategory && newCategory.trim()) {
      const mapName = prompt('新しいマインドマップの名前を入力してください:', '新しいマインドマップ');
      if (mapName && mapName.trim()) {
        onCreateMap(mapName.trim(), newCategory.trim());
      }
    }
  };

  return (
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
          title="サイドバーを折りたたむ"
        >
          ◀
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