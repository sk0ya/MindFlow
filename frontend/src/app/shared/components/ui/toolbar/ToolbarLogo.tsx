import React from 'react';

interface ToolbarLogoProps {}

const ToolbarLogo: React.FC<ToolbarLogoProps> = () => {
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