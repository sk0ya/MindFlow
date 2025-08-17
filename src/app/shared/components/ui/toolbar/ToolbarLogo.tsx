import React from 'react';

interface ToolbarLogoProps {
  onToggleSidebar?: () => void;
  showSidebar?: boolean;
}

const ToolbarLogo: React.FC<ToolbarLogoProps> = ({
  onToggleSidebar: _onToggleSidebar,
  showSidebar: _showSidebar = true
}) => {
  return (
    <div className="logo-section">
      <div className="logo">
        <div className="logo-text">
          <span className="logo-title">MindFlow</span>
        </div>
      </div>
    </div>
  );
};

export default ToolbarLogo;