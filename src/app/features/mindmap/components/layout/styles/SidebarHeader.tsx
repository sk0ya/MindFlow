import React from 'react';

const SidebarHeaderStyles: React.FC = () => (
  <style>{`
    .sidebar-header {
      padding: 12px !important;
      border-bottom: 1px solid rgba(148, 163, 184, 0.12);
      background: rgba(248, 250, 252, 0.5);
      backdrop-filter: blur(10px);
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
      position: relative !important;
      z-index: 100 !important;
      width: 100% !important;
      overflow: visible !important;
    }

    [data-theme="dark"] .sidebar-header {
      border-bottom: 1px solid rgba(75, 85, 99, 0.2);
      background: rgba(31, 41, 55, 0.8);
    }

    .sidebar-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    [data-theme="dark"] .sidebar-title {
      color: #e5e7eb;
    }

    .header-actions {
      display: flex !important;
      gap: 6px;
      align-items: center;
      flex-wrap: nowrap;
      justify-content: flex-start;
      width: 100%;
      margin: 0;
      overflow: visible !important;
    }

    .sidebar-collapse-toggle {
      background: rgba(51, 65, 85, 0.08);
      border: 1px solid rgba(51, 65, 85, 0.12);
      color: #475569;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: all 0.2s ease;
    }

    .sidebar-collapse-toggle:hover {
      background: rgba(51, 65, 85, 0.12);
      color: #1e293b;
      transform: scale(1.05);
    }

    .sidebar-expand-toggle {
      background: rgba(51, 65, 85, 0.08);
      border: 1px solid rgba(51, 65, 85, 0.12);
      color: #475569;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: all 0.2s ease;
      margin-bottom: 12px;
    }

    .sidebar-expand-toggle:hover {
      background: rgba(51, 65, 85, 0.12);
      color: #1e293b;
      transform: scale(1.05);
    }

    .selected-folder-info {
      background: rgba(0, 120, 212, 0.1);
      border: 1px solid rgba(0, 120, 212, 0.3);
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
      color: #0078d4;
      text-align: center;
    }

    .search-container {
      display: flex;
      gap: 8px;
      align-items: center;
      width: 100%;
    }
  `}</style>
);

export default SidebarHeaderStyles;