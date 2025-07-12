import React from 'react';

const ContextMenuStyles: React.FC = () => (
  <style>{`
    .context-menu {
      background: white;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      border: 1px solid #e1e5e9;
      min-width: 200px;
      overflow: hidden;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      animation: menuSlideIn 0.15s ease-out;
    }

    @keyframes menuSlideIn {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(-5px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .menu-header {
      padding: 12px 16px;
      background: #f8f9fa;
      border-bottom: 1px solid #e1e5e9;
    }

    .node-title {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 180px;
    }

    .menu-items {
      padding: 4px 0;
    }

    .menu-item {
      position: relative;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .menu-item:hover:not(.disabled) {
      background: #f8f9ff;
    }

    .menu-item.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .menu-item.danger:hover:not(.disabled) {
      background: #fff5f5;
    }

    .menu-item.danger .menu-label {
      color: #ea4335;
    }

    .menu-item-content {
      display: flex;
      align-items: center;
      padding: 8px 16px;
      gap: 12px;
    }

    .menu-icon {
      font-size: 16px;
      width: 20px;
      text-align: center;
    }

    .menu-label {
      flex: 1;
      font-size: 14px;
      color: #333;
    }

    .menu-shortcut {
      font-size: 12px;
      color: #666;
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
    }

    .submenu-arrow {
      font-size: 10px;
      color: #666;
      margin-left: auto;
    }

    .menu-separator {
      height: 1px;
      background: #e1e5e9;
      margin: 4px 0;
    }

    .submenu-parent:hover .submenu {
      display: block;
    }

    .submenu {
      display: none;
      position: absolute;
      left: 100%;
      top: 0;
      background: white;
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      border: 1px solid #e1e5e9;
      min-width: 120px;
      z-index: 3000;
    }

    .submenu-item {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      gap: 8px;
      transition: background 0.15s ease;
    }

    .submenu-item:hover {
      background: #f8f9ff;
    }

    .submenu-item:first-child {
      border-radius: 6px 6px 0 0;
    }

    .submenu-item:last-child {
      border-radius: 0 0 6px 6px;
    }

    .color-indicator {
      width: 16px;
      height: 16px;
      border-radius: 3px;
      border: 1px solid rgba(0, 0, 0, 0.1);
    }

    .submenu-item span {
      font-size: 13px;
      color: #333;
    }

    /* レスポンシブ対応 */
    @media (max-width: 768px) {
      .context-menu {
        min-width: 180px;
      }

      .menu-item-content {
        padding: 10px 16px;
      }

      .menu-label {
        font-size: 15px;
      }

      .menu-shortcut {
        font-size: 11px;
      }
    }
  `}</style>
);

export default ContextMenuStyles;
