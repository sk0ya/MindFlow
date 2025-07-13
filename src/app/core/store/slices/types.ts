import type { MindMapData, MindMapNode, Position, FileAttachment } from '@shared/types';
import type { ImageFile } from '../../../shared/types';
import type { NormalizedData } from '../../data/normalizedStore';

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
  showNodeMapLinksPanel: boolean;
  nodeMapLinksPanelPosition: Position;
  sidebarCollapsed: boolean;
  showLocalStoragePanel: boolean;
  showTutorial: boolean;
  
  // File and image states
  selectedImage: ImageFile | null;
  selectedFile: FileAttachment | null;
  fileMenuPosition: Position;
  showImageModal: boolean;
  showFileActionMenu: boolean;
  
  // Other UI states
  clipboard: MindMapNode | null;
  selectedNodeForLinks: MindMapNode | null;
}

// Data State types
export interface DataState {
  data: MindMapData | null;
  normalizedData: NormalizedData | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
}

// History State types
export interface HistoryState {
  history: MindMapData[];
  historyIndex: number;
}

// Combined Store Interface
export interface MindMapStore extends DataState, HistoryState {
  ui: UIState;
  
  // Data Actions
  setData: (data: MindMapData) => void;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  addChildNode: (parentId: string, text?: string) => string | undefined;
  addSiblingNode: (nodeId: string, text?: string) => string | undefined;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string) => void;
  changeSiblingOrder: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;
  
  // Node operations (O(1) with normalized data)
  findNode: (nodeId: string) => MindMapNode | null;
  getChildNodes: (nodeId: string) => MindMapNode[];
  
  // Selection & Editing
  selectNode: (nodeId: string | null) => void;
  startEditing: (nodeId: string) => void;
  finishEditing: (nodeId: string, text: string) => void;
  cancelEditing: () => void;
  setEditText: (text: string) => void;
  
  // History Actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  
  // Utility
  updateNormalizedData: () => void;
  syncToMindMapData: () => void;
  applyAutoLayout: () => void;
  
  // UI Actions
  setZoom: (zoom: number) => void;
  setPan: (pan: Position) => void;
  resetZoom: () => void;
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
  setSelectedImage: (image: ImageFile | null) => void;
  setSelectedFile: (file: FileAttachment | null) => void;
  setFileMenuPosition: (position: Position) => void;
  setShowImageModal: (show: boolean) => void;
  setShowFileActionMenu: (show: boolean) => void;
  setClipboard: (node: MindMapNode | null) => void;
  setSelectedNodeForLinks: (node: MindMapNode | null) => void;
  closeAllPanels: () => void;
  toggleSidebar: () => void;
  showCustomization: (position?: Position) => void;
  showNodeMapLinks: (node: MindMapNode, position: Position) => void;
  closeNodeMapLinksPanel: () => void;
}