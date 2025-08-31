import React from 'react';

interface SidebarCollapsedProps {
  onToggleCollapse: () => void;
}

const SidebarCollapsed: React.FC<SidebarCollapsedProps> = ({
  onToggleCollapse
}) => {

  return (
    <div className="mindmap-sidebar collapsed">
      <button 
        className="sidebar-expand-toggle"
        onClick={onToggleCollapse}
        title="サイドバーを表示"
      >
        ▶
      </button>
    </div>
  );
};

export default SidebarCollapsed;