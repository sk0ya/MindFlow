import React, { useEffect, useRef, memo } from 'react';
import { MindMapNode } from '../../types';
import MenuItems from './contextmenu/MenuItems';
import ContextMenuStyles from './contextmenu/ContextMenuStyles';

interface Position {
  x: number;
  y: number;
}

interface ContextMenuProps {
  visible: boolean;
  position: Position;
  selectedNode: MindMapNode | null;
  onDelete: (nodeId: string) => void;
  onCustomize: (node: MindMapNode) => void;
  onCopy: (node: MindMapNode) => void;
  onPaste: (parentId: string) => void;
  onAIGenerate?: (node: MindMapNode) => void;
  onFileUpload?: (nodeId: string, files: FileList) => void;
  onAddLink?: (nodeId: string) => void;
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  visible,
  position,
  selectedNode,
  onDelete,
  onCustomize,
  onCopy,
  onPaste,
  onAIGenerate,
  onFileUpload,
  onAddLink,
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
    
    return undefined;
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
    
    return undefined;
  }, [visible, onClose]);

  if (!visible || !selectedNode) return null;

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
      <MenuItems
        selectedNode={selectedNode}
        onDelete={onDelete}
        onCustomize={onCustomize}
        onCopy={onCopy}
        onPaste={onPaste}
        onAIGenerate={onAIGenerate}
        onFileUpload={onFileUpload}
        onAddLink={onAddLink}
        onClose={onClose}
      />
      
      <ContextMenuStyles />
    </div>
  );
};

export default memo(ContextMenu);