import React from 'react';

interface ToolbarLogoProps {
  onToggleSidebar?: () => void;
  showSidebar?: boolean;
}

const ToolbarLogo: React.FC<ToolbarLogoProps> = ({
  onToggleSidebar,
  showSidebar = true
}) => {
  return (
    <div className="logo-section">
      {onToggleSidebar && (
        <button
          className="sidebar-toggle"
          onClick={onToggleSidebar}
          title={showSidebar ? "サイドバーを隠す" : "サイドバーを表示"}
        >
          {showSidebar ? '◀' : '▶'}
        </button>
      )}
      
      <div className="logo">
        <div className="logo-icon">
          🗺️
        </div>
        <div className="logo-text">
          <span className="logo-title">MindFlow</span>
          <span className="logo-subtitle">Local</span>
        </div>
      </div>
    </div>
  );
};

export default ToolbarLogo;