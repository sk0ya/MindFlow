import React from 'react';
import { MindMapNode } from '../../../types';
import ColorSubmenu, { ColorOption } from './ColorSubmenu';

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

interface MenuItemSubmenu {
  icon: string;
  label: string;
  submenu: ColorOption[];
}

export type MenuItem = MenuItemAction | MenuItemSeparator | MenuItemSubmenu;

interface MenuItemsProps {
  selectedNode: MindMapNode;
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onCustomize: (node: MindMapNode) => void;
  onCopy: (node: MindMapNode) => void;
  onPaste: (parentId: string) => void;
  onChangeColor: (nodeId: string, color: string) => void;
  onClose: () => void;
}

const MenuItems: React.FC<MenuItemsProps> = ({
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
      disabled: false
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
    if ('type' in item && item.type === 'separator') {
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
          <ColorSubmenu 
            colors={item.submenu} 
            onColorSelect={handleColorSelect}
          />
        </div>
      );
    }

    const actionItem = item as MenuItemAction;
    
    return (
      <div
        key={index}
        className={`menu-item ${actionItem.disabled ? 'disabled' : ''} ${actionItem.danger ? 'danger' : ''}`}
        onClick={actionItem.disabled ? undefined : actionItem.action}
      >
        <div className="menu-item-content">
          <span className="menu-icon">{actionItem.icon}</span>
          <span className="menu-label">{actionItem.label}</span>
          {actionItem.shortcut && (
            <span className="menu-shortcut">{actionItem.shortcut}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="menu-items">
      {menuItems.map(renderMenuItem)}
    </div>
  );
};

export default MenuItems;
