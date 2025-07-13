import type { StateCreator } from 'zustand';
import type { Position, FileAttachment, MindMapNode } from '../../../../shared/types';
import type { ImageFile } from '../../../shared/types';
import type { MindMapStore, UIState } from './types';

export interface UISlice {
  ui: UIState;
  
  // Zoom and Pan
  setZoom: (zoom: number) => void;
  setPan: (pan: Position) => void;
  resetZoom: () => void;
  
  // Panel Management
  setShowCustomizationPanel: (show: boolean) => void;
  setCustomizationPosition: (position: Position) => void;
  setShowContextMenu: (show: boolean) => void;
  setContextMenuPosition: (position: Position) => void;
  setShowShortcutHelper: (show: boolean) => void;
  setShowMapList: (show: boolean) => void;
  setShowNodeMapLinksPanel: (show: boolean) => void;
  setNodeMapLinksPanelPosition: (position: Position) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setShowLocalStoragePanel: (show: boolean) => void;
  setShowTutorial: (show: boolean) => void;
  
  // File and Image Management
  setSelectedImage: (image: ImageFile | null) => void;
  setSelectedFile: (file: FileAttachment | null) => void;
  setFileMenuPosition: (position: Position) => void;
  setShowImageModal: (show: boolean) => void;
  setShowFileActionMenu: (show: boolean) => void;
  
  // Other UI States
  setClipboard: (node: MindMapNode | null) => void;
  setSelectedNodeForLinks: (node: MindMapNode | null) => void;
  
  // Composite Actions
  closeAllPanels: () => void;
  toggleSidebar: () => void;
  showCustomization: (position?: Position) => void;
  showNodeMapLinks: (node: MindMapNode, position: Position) => void;
  closeNodeMapLinksPanel: () => void;
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
    showNodeMapLinksPanel: false,
    nodeMapLinksPanelPosition: { x: 0, y: 0 },
    sidebarCollapsed: false,
    showLocalStoragePanel: false,
    showTutorial: false,
    selectedImage: null,
    selectedFile: null,
    fileMenuPosition: { x: 0, y: 0 },
    showImageModal: false,
    showFileActionMenu: false,
    clipboard: null,
    selectedNodeForLinks: null,
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

  setShowNodeMapLinksPanel: (show: boolean) => {
    set((state) => {
      state.ui.showNodeMapLinksPanel = show;
    });
  },

  setNodeMapLinksPanelPosition: (position: Position) => {
    set((state) => {
      state.ui.nodeMapLinksPanelPosition = position;
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

  setSelectedNodeForLinks: (node: MindMapNode | null) => {
    set((state) => {
      state.ui.selectedNodeForLinks = node;
    });
  },

  // Composite Actions
  closeAllPanels: () => {
    set((state) => {
      state.ui.showCustomizationPanel = false;
      state.ui.showContextMenu = false;
      state.ui.showShortcutHelper = false;
      state.ui.showMapList = false;
      state.ui.showNodeMapLinksPanel = false;
      state.ui.showLocalStoragePanel = false;
      state.ui.showImageModal = false;
      state.ui.showFileActionMenu = false;
      state.ui.showTutorial = false;
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
      state.ui.showNodeMapLinksPanel = false;
    });
  },

  showNodeMapLinks: (node: MindMapNode, position: Position) => {
    set((state) => {
      state.ui.selectedNodeForLinks = node;
      state.ui.showNodeMapLinksPanel = true;
      state.ui.nodeMapLinksPanelPosition = position;
      // Close other panels
      state.ui.showCustomizationPanel = false;
      state.ui.showContextMenu = false;
    });
  },

  closeNodeMapLinksPanel: () => {
    set((state) => {
      state.ui.showNodeMapLinksPanel = false;
      state.ui.selectedNodeForLinks = null;
    });
  },
});