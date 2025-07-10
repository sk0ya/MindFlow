/**
 * Keyboard shortcuts hook for MindMap application
 * Handles all keyboard interactions for efficient mindmap navigation and editing
 */

import { useEffect } from 'react';

interface KeyboardShortcutHandlers {
  selectedNodeId: string | null;
  editingNodeId: string | null;
  setEditText: (text: string) => void;
  startEdit: (nodeId: string) => void;
  finishEdit: (nodeId: string, newText?: string, options?: any) => Promise<void>;
  editText: string;
  updateNode: (id: string, updates: any) => void;
  addChildNode: (parentId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
  addSiblingNode: (nodeId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
  deleteNode: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  navigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;
  showMapList: boolean;
  setShowMapList: (show: boolean) => void;
  showLocalStorage: boolean;
  setShowLocalStorage: (show: boolean) => void;
  showTutorial: boolean;
  setShowTutorial: (show: boolean) => void;
  showKeyboardHelper: boolean;
  setShowKeyboardHelper: (show: boolean) => void;
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
            } else if (handlers.canUndo) {
              handlers.undo();
            }
            break;
          case 'y':
            event.preventDefault();
            if (handlers.canRedo) {
              handlers.redo();
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