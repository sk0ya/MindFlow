import React from 'react';

interface SidebarHeaderProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onToggleCollapse?: () => void;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  searchTerm,
  onSearchChange,
  onToggleCollapse
}) => {

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