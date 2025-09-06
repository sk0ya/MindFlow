import React from 'react';
import { MindMapNode } from '../../../types';
import { useMindMapStore } from '../../../../core/store/mindMapStore';

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

export type MenuItem = MenuItemAction | MenuItemSeparator;

interface MenuItemsProps {
  selectedNode: MindMapNode;
  onDelete: (nodeId: string) => void;
  onCustomize: (node: MindMapNode) => void;
  onCopy: (node: MindMapNode) => void;
  onPaste: (parentId: string) => void;
  onAIGenerate?: (node: MindMapNode) => void;
  onClose: () => void;
}

const MenuItems: React.FC<MenuItemsProps> = ({
  selectedNode,
  onDelete,
  onCustomize,
  onCopy,
  onPaste,
  onAIGenerate,
  onClose
}) => {
  const store = useMindMapStore();
  const aiEnabled = store.aiSettings?.enabled || false;
  const isGenerating = store.isGenerating || false;
  const menuItems: MenuItem[] = [
    ...(aiEnabled && onAIGenerate ? [{
      icon: isGenerating ? '⏳' : '🤖',
      label: isGenerating ? 'AI生成中...' : 'AI子ノード生成',
      action: () => {
        if (!isGenerating) {
          onAIGenerate(selectedNode);
          onClose();
        }
      },
      disabled: isGenerating
    }] : []),
    ...(aiEnabled && onAIGenerate ? [{ type: 'separator' as const }] : []),
    {
      icon: '🎨',
      label: 'カスタマイズ',
      action: () => {
        onCustomize(selectedNode);
        onClose();
      }
    },
    { type: 'separator' as const },
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
      disabled: !store.ui?.clipboard
    },
    { type: 'separator' as const },
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

  const renderMenuItem = (item: MenuItem, index: number): React.ReactNode => {
    if ('type' in item && item.type === 'separator') {
      return <div key={index} className="menu-separator" />;
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
