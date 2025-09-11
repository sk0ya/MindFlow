/**
 * Keyboard shortcuts hook for MindMap application
 * Handles all keyboard interactions for efficient mindmap navigation and editing
 */

import { useEffect } from 'react';
import type { MindMapNode } from '@shared/types';

interface KeyboardShortcutHandlers {
  selectedNodeId: string | null;
  editingNodeId: string | null;
  setEditText: (_text: string) => void;
  startEdit: (_nodeId: string) => void;
  startEditWithCursorAtEnd: (_nodeId: string) => void;
  finishEdit: (_nodeId: string, _newText?: string, _options?: Partial<MindMapNode>) => Promise<void>;
  editText: string;
  updateNode: (_id: string, _updates: Partial<MindMapNode>) => void;
  addChildNode: (_parentId: string, _text?: string, _startEditing?: boolean) => Promise<string | null>;
  addSiblingNode: (_nodeId: string, _text?: string, _startEditing?: boolean) => Promise<string | null>;
  deleteNode: (_id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  navigateToDirection: (_direction: 'up' | 'down' | 'left' | 'right') => void;
  showMapList: boolean;
  setShowMapList: (_show: boolean) => void;
  showLocalStorage: boolean;
  setShowLocalStorage: (_show: boolean) => void;
  showTutorial: boolean;
  setShowTutorial: (_show: boolean) => void;
  showKeyboardHelper: boolean;
  setShowKeyboardHelper: (_show: boolean) => void;
  copyNode: (_nodeId: string) => void;
  pasteNode: (_parentId: string) => Promise<void>;
  pasteImageFromClipboard: (_nodeId: string) => Promise<void>;
  findNodeById: (_nodeId: string) => MindMapNode | null;
}

export const useKeyboardShortcuts = (handlers: KeyboardShortcutHandlers) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle shortcuts when editing text
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        // Special handling for editing mode
        if (handlers.editingNodeId) {
          if (event.key === 'Enter') {
            event.preventDefault();
            handlers.finishEdit(handlers.editingNodeId, handlers.editText);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            handlers.finishEdit(handlers.editingNodeId, '');
          }
        }
        return;
      }

      const { key, ctrlKey, metaKey, shiftKey } = event;
      const isModifier = ctrlKey || metaKey;

      // Navigation shortcuts
      if (!isModifier && handlers.selectedNodeId) {
        switch (key) {
          case 'ArrowUp':
            event.preventDefault();
            handlers.navigateToDirection('up');
            break;
          case 'ArrowDown':
            event.preventDefault();
            handlers.navigateToDirection('down');
            break;
          case 'ArrowLeft':
            event.preventDefault();
            handlers.navigateToDirection('left');
            break;
          case 'ArrowRight':
            event.preventDefault();
            handlers.navigateToDirection('right');
            break;
          case ' ': // Space
            event.preventDefault();
            if (handlers.selectedNodeId) {
              handlers.startEdit(handlers.selectedNodeId);
            }
            break;
          case 'F2': // F2
            event.preventDefault();
            if (handlers.selectedNodeId) {
              handlers.startEditWithCursorAtEnd(handlers.selectedNodeId);
            }
            break;
          case 'Tab':
            event.preventDefault();
            if (handlers.selectedNodeId) {
              handlers.addChildNode(handlers.selectedNodeId, '', true);
            }
            break;
          case 'Enter':
            event.preventDefault();
            if (handlers.selectedNodeId) {
              handlers.addSiblingNode(handlers.selectedNodeId, '', true);
            }
            break;
          case 'Delete':
          case 'Backspace':
            event.preventDefault();
            if (handlers.selectedNodeId) {
              handlers.deleteNode(handlers.selectedNodeId);
            }
            break;
        }
      }

      // Application shortcuts with modifiers
      if (isModifier) {
        switch (key.toLowerCase()) {
          case 's':
            event.preventDefault();
            // Auto-save is handled by the system
            break;
          case 'z':
            event.preventDefault();
            if (shiftKey && handlers.canRedo) {
              handlers.redo();
            } else if (!shiftKey && handlers.canUndo) {
              handlers.undo();
            }
            break;
          case 'y':
            event.preventDefault();
            if (handlers.canRedo) {
              handlers.redo();
            }
            break;
          case 'c':
            event.preventDefault();
            if (handlers.selectedNodeId) {
              handlers.copyNode(handlers.selectedNodeId);
            }
            break;
          case 'v':
            event.preventDefault();
            if (handlers.selectedNodeId) {
              // まずシステムクリップボードから画像を確認
              handlers.pasteImageFromClipboard(handlers.selectedNodeId).catch(async () => {
                // 画像がない場合は通常のノードペースト（MindMeister形式も含む）
                if (handlers.selectedNodeId) {
                  await handlers.pasteNode(handlers.selectedNodeId);
                }
              });
            }
            break;
        }
      }

      // Function keys and special shortcuts
      switch (key) {
        case 'F1':
          event.preventDefault();
          handlers.setShowKeyboardHelper(!handlers.showKeyboardHelper);
          break;
        case 'Escape':
          event.preventDefault();
          // Close any open panels
          if (handlers.showMapList) handlers.setShowMapList(false);
          if (handlers.showLocalStorage) handlers.setShowLocalStorage(false);
          if (handlers.showTutorial) handlers.setShowTutorial(false);
          if (handlers.showKeyboardHelper) handlers.setShowKeyboardHelper(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlers]);
};

export default useKeyboardShortcuts;