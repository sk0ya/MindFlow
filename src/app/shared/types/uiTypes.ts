import type { Position, FileAttachment, MindMapNode } from '@shared/types';
import type { ImageFile } from './dataTypes';

// UI State types
export interface UIState {
  // Basic UI state
  zoom: number;
  pan: Position;
  
  // Panel visibility
  showCustomizationPanel: boolean;
  customizationPosition: Position;
  showContextMenu: boolean;
  contextMenuPosition: Position;
  showShortcutHelper: boolean;
  showMapList: boolean;
  sidebarCollapsed: boolean;
  showLocalStoragePanel: boolean;
  showTutorial: boolean;
  showNotesPanel: boolean;
  showOutlineEditor: boolean;
  viewMode: 'mindmap' | 'outline';
  
  // File and image states
  selectedImage: ImageFile | null;
  selectedFile: FileAttachment | null;
  fileMenuPosition: Position;
  showImageModal: boolean;
  showFileActionMenu: boolean;
  
  // Other UI states
  clipboard: MindMapNode | null;
  
  // Icon-triggered displays
  showAttachmentListForNode: string | null;
  showLinkListForNode: string | null;
}

// Context menu state
export interface ContextMenuState {
  visible: boolean;
  position: Position;
  nodeId: string | null;
}

// Modal states
export interface ModalStates {
  showExportModal: boolean;
  showImportModal: boolean;
  showLoginModal: boolean;
  showLinkModal: boolean;
  showLinkActionMenu: boolean;
  showImageModal: boolean;
  showFileActionMenu: boolean;
  showCustomizationPanel: boolean;
  showContextMenu: boolean;
}

// UI Actions interface
export interface UIActions {
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
  setSidebarCollapsed: (collapsed: boolean) => void;
  setShowLocalStoragePanel: (show: boolean) => void;
  setShowTutorial: (show: boolean) => void;
  setShowNotesPanel: (show: boolean) => void;
  toggleNotesPanel: () => void;
  setShowOutlineEditor: (show: boolean) => void;
  toggleOutlineEditor: () => void;
  setViewMode: (mode: 'mindmap' | 'outline') => void;
  toggleViewMode: () => void;
  
  // File and Image Management
  setSelectedImage: (image: ImageFile | null) => void;
  setSelectedFile: (file: FileAttachment | null) => void;
  setFileMenuPosition: (position: Position) => void;
  setShowImageModal: (show: boolean) => void;
  setShowFileActionMenu: (show: boolean) => void;
  
  // Other UI States
  setClipboard: (node: MindMapNode | null) => void;
  
  // Icon-triggered displays
  setShowAttachmentListForNode: (nodeId: string | null) => void;
  setShowLinkListForNode: (nodeId: string | null) => void;
  toggleAttachmentListForNode: (nodeId: string) => void;
  toggleLinkListForNode: (nodeId: string) => void;
  closeAttachmentAndLinkLists: () => void;
  
  // Composite Actions
  closeAllPanels: () => void;
  toggleSidebar: () => void;
  showCustomization: (position?: Position) => void;
}

// Combined UI interface
export interface UISlice extends UIActions {
  ui: UIState;
}