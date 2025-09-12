import type { MindMapData, MindMapNode, Position, FileAttachment, NodeLink } from '@shared/types';
import type { NormalizedData } from '../../data/normalizedStore';
import type { AISlice } from './aiSlice';
import type { SettingsSlice } from './settingsSlice';
import type { UISlice } from './uiSlice';
import type { UIState } from '../../../shared/types/uiTypes';
import type { DataState as NodeDataState } from '../../../shared/types/nodeTypes';
import type { ImageFile } from '../../../shared/types';

// Re-export for backward compatibility
export type { UIState };
export interface DataState extends NodeDataState {
  normalizedData: NormalizedData | null;
}

// History State types
export interface HistoryState {
  history: MindMapData[];
  historyIndex: number;
}

// Combined Store Interface
export interface MindMapStore extends DataState, HistoryState, AISlice, SettingsSlice, UISlice {
  ui: UIState;
  
  // Data Actions
  setData: (data: MindMapData) => void;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  addChildNode: (parentId: string, text?: string) => string | undefined;
  addSiblingNode: (nodeId: string, text?: string) => string | undefined;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string) => void;
  changeSiblingOrder: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;
  toggleNodeCollapse: (nodeId: string) => void;
  
  // Link operations
  addNodeLink: (nodeId: string, linkData: Partial<NodeLink>) => void;
  updateNodeLink: (nodeId: string, linkId: string, updates: Partial<NodeLink>) => void;
  deleteNodeLink: (nodeId: string, linkId: string) => void;
  
  // Node operations (O(1) with normalized data)
  findNode: (nodeId: string) => MindMapNode | null;
  getChildNodes: (nodeId: string) => MindMapNode[];
  
  // Selection & Editing
  selectNode: (nodeId: string | null) => void;
  startEditing: (nodeId: string) => void;
  startEditingWithCursorAtEnd: (nodeId: string) => void;
  startEditingWithCursorAtStart: (nodeId: string) => void;
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
  setSidebarCollapsed: (collapsed: boolean) => void;
  setShowLocalStoragePanel: (show: boolean) => void;
  setShowTutorial: (show: boolean) => void;
  setShowNotesPanel: (show: boolean) => void;
  toggleNotesPanel: () => void;
  setShowOutlineEditor: (show: boolean) => void;
  toggleOutlineEditor: () => void;
  setViewMode: (mode: 'mindmap' | 'outline') => void;
  toggleViewMode: () => void;
  setSelectedImage: (image: ImageFile | null) => void;
  setSelectedFile: (file: FileAttachment | null) => void;
  setFileMenuPosition: (position: Position) => void;
  setShowImageModal: (show: boolean) => void;
  setShowFileActionMenu: (show: boolean) => void;
  setClipboard: (node: MindMapNode | null) => void;
  
  // Icon-triggered displays
  setShowAttachmentListForNode: (nodeId: string | null) => void;
  setShowLinkListForNode: (nodeId: string | null) => void;
  toggleAttachmentListForNode: (nodeId: string) => void;
  toggleLinkListForNode: (nodeId: string) => void;
  
  closeAllPanels: () => void;
  toggleSidebar: () => void;
  showCustomization: (position?: Position) => void;
}