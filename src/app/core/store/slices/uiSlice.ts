import type { StateCreator } from 'zustand';
import type { Position, FileAttachment, MindMapNode } from '@shared/types';
import type { ImageFile } from '../../../shared/types';
import type { MindMapStore } from './types';
import type { UIState, UIActions } from '../../../shared/types/uiTypes';

export interface UISlice extends UIActions {
  ui: UIState;
}

export const createUISlice: StateCreator<
  MindMapStore,
  [["zustand/immer", never]],
  [],
  UISlice
> = (set) => ({
  // Initial UI state
  ui: {
    zoom: 1,
    pan: { x: 0, y: 0 },
    showCustomizationPanel: false,
    customizationPosition: { x: 0, y: 0 },
    showContextMenu: false,
    contextMenuPosition: { x: 0, y: 0 },
    showShortcutHelper: false,
    showMapList: false,
    sidebarCollapsed: false,
    showLocalStoragePanel: false,
    showTutorial: false,
    showNotesPanel: false,
    showOutlineEditor: false,
    viewMode: 'mindmap',
    selectedImage: null,
    selectedFile: null,
    fileMenuPosition: { x: 0, y: 0 },
    showImageModal: false,
    showFileActionMenu: false,
    clipboard: null,
    showAttachmentListForNode: null,
    showLinkListForNode: null,
  },

  // Zoom and Pan Actions
  setZoom: (zoom: number) => {
    set((state) => {
      state.ui.zoom = Math.max(0.1, Math.min(3, zoom));
    });
  },

  setPan: (pan: Position) => {
    set((state) => {
      state.ui.pan = pan;
    });
  },

  resetZoom: () => {
    set((state) => {
      state.ui.zoom = 1;
      state.ui.pan = { x: 0, y: 0 };
    });
  },

  // Panel Management Actions
  setShowCustomizationPanel: (show: boolean) => {
    set((state) => {
      state.ui.showCustomizationPanel = show;
    });
  },

  setCustomizationPosition: (position: Position) => {
    set((state) => {
      state.ui.customizationPosition = position;
    });
  },

  setShowContextMenu: (show: boolean) => {
    set((state) => {
      state.ui.showContextMenu = show;
    });
  },

  setContextMenuPosition: (position: Position) => {
    set((state) => {
      state.ui.contextMenuPosition = position;
    });
  },

  setShowShortcutHelper: (show: boolean) => {
    set((state) => {
      state.ui.showShortcutHelper = show;
    });
  },

  setShowMapList: (show: boolean) => {
    set((state) => {
      state.ui.showMapList = show;
    });
  },


  setSidebarCollapsed: (collapsed: boolean) => {
    set((state) => {
      state.ui.sidebarCollapsed = collapsed;
    });
  },

  setShowLocalStoragePanel: (show: boolean) => {
    set((state) => {
      state.ui.showLocalStoragePanel = show;
    });
  },

  setShowTutorial: (show: boolean) => {
    set((state) => {
      state.ui.showTutorial = show;
    });
  },

  setShowNotesPanel: (show: boolean) => {
    set((state) => {
      state.ui.showNotesPanel = show;
    });
  },

  toggleNotesPanel: () => {
    set((state) => {
      state.ui.showNotesPanel = !state.ui.showNotesPanel;
    });
  },

  setShowOutlineEditor: (show: boolean) => {
    set((state) => {
      state.ui.showOutlineEditor = show;
    });
  },

  toggleOutlineEditor: () => {
    set((state) => {
      state.ui.showOutlineEditor = !state.ui.showOutlineEditor;
    });
  },

  setViewMode: (mode: 'mindmap' | 'outline') => {
    set((state) => {
      state.ui.viewMode = mode;
    });
  },

  toggleViewMode: () => {
    set((state) => {
      state.ui.viewMode = state.ui.viewMode === 'mindmap' ? 'outline' : 'mindmap';
      // アウトラインモードに切り替える際は、ノートパネルを一時的に閉じる
      if (state.ui.viewMode === 'outline') {
        state.ui.showNotesPanel = false;
      }
    });
  },

  // File and Image Management Actions
  setSelectedImage: (image: ImageFile | null) => {
    set((state) => {
      state.ui.selectedImage = image;
    });
  },

  setSelectedFile: (file: FileAttachment | null) => {
    set((state) => {
      state.ui.selectedFile = file;
    });
  },

  setFileMenuPosition: (position: Position) => {
    set((state) => {
      state.ui.fileMenuPosition = position;
    });
  },

  setShowImageModal: (show: boolean) => {
    set((state) => {
      state.ui.showImageModal = show;
    });
  },

  setShowFileActionMenu: (show: boolean) => {
    set((state) => {
      state.ui.showFileActionMenu = show;
    });
  },

  // Other UI State Actions
  setClipboard: (node: MindMapNode | null) => {
    set((state) => {
      state.ui.clipboard = node;
    });
  },

  // Icon-triggered display actions
  setShowAttachmentListForNode: (nodeId: string | null) => {
    set((state) => {
      state.ui.showAttachmentListForNode = nodeId;
    });
  },

  setShowLinkListForNode: (nodeId: string | null) => {
    set((state) => {
      state.ui.showLinkListForNode = nodeId;
    });
  },

  toggleAttachmentListForNode: (nodeId: string) => {
    set((state) => {
      state.ui.showAttachmentListForNode = 
        state.ui.showAttachmentListForNode === nodeId ? null : nodeId;
      // リンクリストを閉じる
      state.ui.showLinkListForNode = null;
    });
  },

  toggleLinkListForNode: (nodeId: string) => {
    set((state) => {
      state.ui.showLinkListForNode = 
        state.ui.showLinkListForNode === nodeId ? null : nodeId;
      // 添付ファイルリストを閉じる
      state.ui.showAttachmentListForNode = null;
    });
  },

  closeAttachmentAndLinkLists: () => {
    set((state) => {
      state.ui.showAttachmentListForNode = null;
      state.ui.showLinkListForNode = null;
    });
  },

  // Composite Actions
  closeAllPanels: () => {
    set((state) => {
      state.ui.showCustomizationPanel = false;
      state.ui.showContextMenu = false;
      state.ui.showShortcutHelper = false;
      state.ui.showMapList = false;
      state.ui.showLocalStoragePanel = false;
      state.ui.showImageModal = false;
      state.ui.showFileActionMenu = false;
      state.ui.showTutorial = false;
      state.ui.showAttachmentListForNode = null;
      state.ui.showLinkListForNode = null;
      // Note: showNotesPanel は意図的に closeAllPanels から除外
    });
  },

  toggleSidebar: () => {
    set((state) => {
      state.ui.sidebarCollapsed = !state.ui.sidebarCollapsed;
    });
  },

  showCustomization: (position?: Position) => {
    set((state) => {
      state.ui.showCustomizationPanel = true;
      if (position) {
        state.ui.customizationPosition = position;
      }
      // Close other panels
      state.ui.showContextMenu = false;
    });
  },

});