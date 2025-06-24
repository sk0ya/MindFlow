import React, { useEffect, useRef } from 'react';
import { MindMapNode } from '../../../shared/types';

interface Position {
  x: number;
  y: number;
}

interface ContextMenuProps {
  visible: boolean;
  position: Position;
  selectedNode: MindMapNode | null;
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onCustomize: (node: MindMapNode) => void;
  onCopy: (node: MindMapNode) => void;
  onPaste: (parentId: string) => void;
  onChangeColor: (nodeId: string, color: string) => void;
  onClose: () => void;
}

interface MenuItemAction {
  icon: string;
  label: string;
  action: () => void;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
}

interface MenuItemSeparator {
  type: 'separator';
}

interface ColorOption {
  color: string;
  label: string;
}

interface MenuItemSubmenu {
  icon: string;
  label: string;
  submenu: ColorOption[];
}

type MenuItem = MenuItemAction | MenuItemSeparator | MenuItemSubmenu;

const ContextMenu: React.FC<ContextMenuProps> = ({
  visible,
  position,
  selectedNode,
  onAddChild,
  onAddSibling,
  onDelete,
  onCustomize,
  onCopy,
  onPaste,
  onChangeColor,
  onClose
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [visible, onClose]);

  // ESCキーで閉じる
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, onClose]);

  if (!visible || !selectedNode) return null;

  const menuItems: MenuItem[] = [
    {
      icon: '➕',
      label: '子ノードを追加',
      action: () => {
        onAddChild(selectedNode.id);
        onClose();
      },
      shortcut: 'Tab'
    },
    {
      icon: '↔️',
      label: '兄弟ノードを追加',
      action: () => {
        onAddSibling(selectedNode.id);
        onClose();
      },
      shortcut: 'Enter'
    },
    { type: 'separator' },
    {
      icon: '🎨',
      label: 'カスタマイズ',
      action: () => {
        onCustomize(selectedNode);
        onClose();
      }
    },
    {
      icon: '🎯',
      label: 'クイックカラー',
      submenu: [
        { color: '#4285f4', label: 'ブルー' },
        { color: '#ea4335', label: 'レッド' },
        { color: '#34a853', label: 'グリーン' },
        { color: '#fbbc04', label: 'イエロー' },
        { color: '#9c27b0', label: 'パープル' },
        { color: '#ff9800', label: 'オレンジ' }
      ]
    },
    { type: 'separator' },
    {
      icon: '📋',
      label: 'コピー',
      action: () => {
        onCopy(selectedNode);
        onClose();
      },
      shortcut: 'Ctrl+C'
    },
    {
      icon: '📄',
      label: '貼り付け',
      action: () => {
        onPaste(selectedNode.id);
        onClose();
      },
      shortcut: 'Ctrl+V',
      disabled: false // この値は実際のクリップボード状態に基づいて設定
    },
    { type: 'separator' },
    {
      icon: '🗑️',
      label: '削除',
      action: () => {
        if (selectedNode.id !== 'root') {
          onDelete(selectedNode.id);
        }
        onClose();
      },
      shortcut: 'Delete',
      disabled: selectedNode.id === 'root',
      danger: true
    }
  ];

  const handleColorSelect = (color: string): void => {
    onChangeColor(selectedNode.id, color);
    onClose();
  };

  const renderMenuItem = (item: MenuItem, index: number): React.ReactNode => {
    if (item.type === 'separator') {
      return <div key={index} className="menu-separator" />;
    }

    if ('submenu' in item) {
      return (
        <div key={index} className="menu-item submenu-parent">
          <div className="menu-item-content">
            <span className="menu-icon">{item.icon}</span>
            <span className="menu-label">{item.label}</span>
            <span className="submenu-arrow">▶</span>
          </div>
          <div className="submenu">
            {item.submenu.map((subItem, subIndex) => (
              <div
                key={subIndex}
                className="submenu-item"
                onClick={() => handleColorSelect(subItem.color)}
              >
                <div 
                  className="color-indicator" 
                  style={{ backgroundColor: subItem.color }}
                />
                <span>{subItem.label}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div
        key={index}
        className={`menu-item ${item.disabled ? 'disabled' : ''} ${item.danger ? 'danger' : ''}`}
        onClick={item.disabled ? undefined : item.action}
      >
        <div className="menu-item-content">
          <span className="menu-icon">{item.icon}</span>
          <span className="menu-label">{item.label}</span>
          {item.shortcut && (
            <span className="menu-shortcut">{item.shortcut}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 2000
      }}
    >
      <div className="menu-header">
        <span className="node-title">"{selectedNode.text}"</span>
      </div>
      <div className="menu-items">
        {menuItems.map(renderMenuItem)}
      </div>

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
    </div>
  );
};

export default ContextMenu;