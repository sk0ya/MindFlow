import React from 'react';
import { ChevronLeft } from 'lucide-react';
import MapControlButtons from './MapControlButtons';

interface SidebarHeaderProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onToggleCollapse?: () => void;
  onAddMap: () => void;
  onAddFolder: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  searchTerm,
  onSearchChange,
  onToggleCollapse,
  onAddMap,
  onAddFolder,
  onExpandAll,
  onCollapseAll
}) => {

  return (
    <div className="sidebar-header">
      <div className="header-top">
        {onToggleCollapse && (
          <button
            className="sidebar-collapse-toggle"
            onClick={onToggleCollapse}
            title="サイドバーを隠す"
          >
<ChevronLeft size={16} />
          </button>
        )}
        <MapControlButtons
          onAddMap={onAddMap}
          onAddFolder={onAddFolder}
          onExpandAll={onExpandAll}
          onCollapseAll={onCollapseAll}
        />
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