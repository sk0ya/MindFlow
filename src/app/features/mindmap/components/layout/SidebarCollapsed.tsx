import React from 'react';
import { ChevronRight } from 'lucide-react';

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
<ChevronRight size={16} />
      </button>
    </div>
  );
};

export default SidebarCollapsed;