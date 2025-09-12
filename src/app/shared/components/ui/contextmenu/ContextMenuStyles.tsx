import React from 'react';

const ContextMenuStyles: React.FC = () => (
  <style>{`
    .context-menu {
      background: var(--color-bg-secondary, white);
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      border: 1px solid var(--color-border, #e1e5e9);
      min-width: 180px;
      overflow: hidden;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      animation: menuSlideIn 0.15s ease-out;
    }

    [data-theme="dark"] .context-menu {
      background: #2a2a2a;
      border: 1px solid #444;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
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
      background: var(--color-bg-tertiary, #f8f9fa);
      border-bottom: 1px solid var(--color-border, #e1e5e9);
    }

    [data-theme="dark"] .menu-header {
      background: #333;
      border-bottom: 1px solid #555;
    }

    .node-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text-primary, #333);
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 180px;
    }

    [data-theme="dark"] .node-title {
      color: #e0e0e0;
    }

    .menu-items {
      padding: 2px 0;
    }

    .menu-item {
      position: relative;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .menu-item:hover:not(.disabled) {
      background: var(--color-bg-hover, #f8f9ff);
    }

    [data-theme="dark"] .menu-item:hover:not(.disabled) {
      background: #404040;
    }

    .menu-item.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .menu-item.danger:hover:not(.disabled) {
      background: #fff5f5;
    }

    [data-theme="dark"] .menu-item.danger:hover:not(.disabled) {
      background: #4a2c2c;
    }

    .menu-item.danger .menu-label {
      color: #ea4335;
    }

    [data-theme="dark"] .menu-item.danger .menu-label {
      color: #ff6b6b;
    }

    .menu-item-content {
      display: flex;
      align-items: center;
      padding: 6px 12px;
      gap: 8px;
    }

    .menu-icon {
      font-size: 16px;
      width: 20px;
      text-align: center;
    }

    .menu-label {
      flex: 1;
      font-size: 14px;
      color: var(--color-text-primary, #333);
    }

    [data-theme="dark"] .menu-label {
      color: #e0e0e0;
    }

    .menu-shortcut {
      font-size: 12px;
      color: var(--color-text-secondary, #666);
      background: var(--color-bg-tertiary, #f0f0f0);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
    }

    [data-theme="dark"] .menu-shortcut {
      color: #aaa;
      background: #444;
    }

    .submenu-arrow {
      font-size: 10px;
      color: var(--color-text-secondary, #666);
      margin-left: auto;
    }

    [data-theme="dark"] .submenu-arrow {
      color: #aaa;
    }

    .menu-separator {
      height: 1px;
      background: var(--color-border, #e1e5e9);
      margin: 2px 0;
    }

    [data-theme="dark"] .menu-separator {
      background: #555;
    }

    .submenu-parent:hover .submenu {
      display: block;
    }

    .submenu {
      display: none;
      position: absolute;
      left: 100%;
      top: 0;
      background: var(--color-bg-secondary, white);
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      border: 1px solid var(--color-border, #e1e5e9);
      min-width: 120px;
      z-index: 3000;
    }

    [data-theme="dark"] .submenu {
      background: #2a2a2a;
      border: 1px solid #444;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
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
      background: var(--color-bg-hover, #f8f9ff);
    }

    [data-theme="dark"] .submenu-item:hover {
      background: #404040;
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
      color: var(--color-text-primary, #333);
    }

    [data-theme="dark"] .submenu-item span {
      color: #e0e0e0;
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
