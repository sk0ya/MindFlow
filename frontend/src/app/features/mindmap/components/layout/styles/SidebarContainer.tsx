import React from 'react';

const SidebarContainer: React.FC = () => (
  <style>{`
    .mindmap-sidebar {
      width: 280px;
      height: 100vh;
      background: #ffffff;
      border-right: 1px solid rgba(148, 163, 184, 0.2);
      display: flex;
      flex-direction: column;
      position: fixed;
      left: 0;
      top: 60px;
      z-index: 100;
      overflow: hidden;
      box-shadow: 4px 0 6px -1px rgba(0, 0, 0, 0.05);
    }

    [data-theme="dark"] .mindmap-sidebar {
      background: #1f2937;
      border-right: 1px solid rgba(75, 85, 99, 0.3);
      box-shadow: 4px 0 6px -1px rgba(0, 0, 0, 0.2);
    }

    .mindmap-sidebar.collapsed {
      width: 50px;
      height: calc(100vh - 60px);
      background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
      border-right: 2px solid #dee2e6;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 8px;
      position: fixed;
      left: 0;
      top: 60px;
      z-index: 100;
      overflow: hidden;
    }

    [data-theme="dark"] .mindmap-sidebar.collapsed {
      background: linear-gradient(to bottom, #374151, #4b5563);
      border-right: 2px solid #6b7280;
    }
  `}</style>
);

export default SidebarContainer;