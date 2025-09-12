/**
 * Keyboard shortcuts hook for MindMap application
 * Handles all keyboard interactions for efficient mindmap navigation and editing
 */

import { useEffect } from 'react';
import type { MindMapNode } from '@shared/types';
import type { VimModeHook } from './useVimMode';

interface KeyboardShortcutHandlers {
  selectedNodeId: string | null;
  editingNodeId: string | null;
  setEditText: (_text: string) => void;
  startEdit: (_nodeId: string) => void;
  startEditWithCursorAtEnd: (_nodeId: string) => void;
  startEditWithCursorAtStart: (_nodeId: string) => void;
  finishEdit: (_nodeId: string, _newText?: string, _options?: Partial<MindMapNode>) => Promise<void>;
  cancelEditing: () => void;
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
  closeAttachmentAndLinkLists: () => void;
}

export const useKeyboardShortcuts = (handlers: KeyboardShortcutHandlers, vim?: VimModeHook) => {
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Vimium対策: キーボードイベントを早期に捕獲
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
            if (vim && vim.isEnabled) vim.setMode('normal');
          } else if (event.key === 'Escape') {
            event.preventDefault();
            handlers.finishEdit(handlers.editingNodeId, handlers.editText);
            if (vim && vim.isEnabled) vim.setMode('normal');
          }
        }
        return;
      }

      const { key, ctrlKey, metaKey, shiftKey } = event;
      const isModifier = ctrlKey || metaKey;

      // Vimium競合対策: hjklキーの場合は即座に preventDefault
      if (vim && vim.isEnabled && vim.mode === 'normal' && !isModifier && handlers.selectedNodeId) {
        const vimKeys = ['h', 'j', 'k', 'l', 'i', 'a', 'o'];
        if (vimKeys.includes(key.toLowerCase())) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
      }

      // Vim mode handling
      if (vim && vim.isEnabled && vim.mode === 'normal' && !isModifier && handlers.selectedNodeId) {
        switch (key.toLowerCase()) {
          case 'h': // Left
            handlers.closeAttachmentAndLinkLists();
            handlers.navigateToDirection('left');
            return;
          case 'j': // Down
            handlers.closeAttachmentAndLinkLists();
            handlers.navigateToDirection('down');
            return;
          case 'k': // Up
            handlers.closeAttachmentAndLinkLists();
            handlers.navigateToDirection('up');
            return;
          case 'l': // Right
            handlers.closeAttachmentAndLinkLists();
            handlers.navigateToDirection('right');
            return;
          case 'i': // Insert mode (cursor at start)
            vim.setMode('insert');
            if (handlers.selectedNodeId) {
              handlers.startEditWithCursorAtStart(handlers.selectedNodeId);
            }
            return;
          case 'a': // Insert mode (cursor at end)
            vim.setMode('insert');
            if (handlers.selectedNodeId) {
              handlers.startEditWithCursorAtEnd(handlers.selectedNodeId);
            }
            return;
          case 'o': // New child node and edit
            vim.setMode('insert');
            if (handlers.selectedNodeId) {
              handlers.addChildNode(handlers.selectedNodeId, '', true);
            }
            return;
          case 'escape':
            event.preventDefault();
            vim.setMode('normal');
            return;
          case 'tab':
            event.preventDefault();
            if (handlers.selectedNodeId) {
              handlers.addChildNode(handlers.selectedNodeId, '', true);
            }
            return;
          case 'enter':
            event.preventDefault();
            if (handlers.selectedNodeId) {
              handlers.addSiblingNode(handlers.selectedNodeId, '', true);
            }
            return;
        }
      }


      // Arrow key navigation (works in both vim and normal mode)
      if (!isModifier && handlers.selectedNodeId) {
        switch (key) {
          case 'ArrowUp':
            event.preventDefault();
            handlers.closeAttachmentAndLinkLists();
            handlers.navigateToDirection('up');
            return;
          case 'ArrowDown':
            event.preventDefault();
            handlers.closeAttachmentAndLinkLists();
            handlers.navigateToDirection('down');
            return;
          case 'ArrowLeft':
            event.preventDefault();
            handlers.closeAttachmentAndLinkLists();
            handlers.navigateToDirection('left');
            return;
          case 'ArrowRight':
            event.preventDefault();
            handlers.closeAttachmentAndLinkLists();
            handlers.navigateToDirection('right');
            return;
        }
      }

      // Standard navigation shortcuts (when vim is disabled)
      if ((!vim || !vim.isEnabled) && !isModifier && handlers.selectedNodeId) {
        switch (key) {
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
          // 添付ファイル・リンク一覧を閉じる
          handlers.closeAttachmentAndLinkLists();
          break;
      }
    };

    // Vimium対策: captureフェーズでイベントを捕獲
    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handlers, vim]);
};

export default useKeyboardShortcuts;