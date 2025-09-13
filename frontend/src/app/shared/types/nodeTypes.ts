import type { MindMapNode, MindMapData, NodeLink } from '@shared/types';

// Data State types
export interface DataState {
  data: MindMapData | null;
  normalizedData: any | null; // NormalizedData type from normalizedStore
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  editingMode: 'select-all' | 'cursor-at-end' | 'cursor-at-start' | null;
}

// Node Operations interface
export interface NodeOperations {
  // Basic node operations
  addNode: (parentId: string, text?: string) => void;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string) => void;
  changeSiblingOrder: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;
  toggleNodeCollapse: (nodeId: string) => void;
  
  // Node queries
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
}

// Link Operations interface
export interface LinkOperations {
  addNodeLink: (nodeId: string, linkData: Partial<NodeLink>) => void;
  updateNodeLink: (nodeId: string, linkId: string, updates: Partial<NodeLink>) => void;
  deleteNodeLink: (nodeId: string, linkId: string) => void;
}

// Node Actions interface combining all node-related operations
export interface NodeActions extends NodeOperations, LinkOperations {
  // Data management
  setData: (data: MindMapData) => void;
  
  // Layout
  applyAutoLayout: () => void;
  
  // Utility
  updateNormalizedData: () => void;
  syncToMindMapData: () => void;
}

// Combined Node Slice interface
export interface NodeSlice extends NodeActions {
  // State
  data: MindMapData | null;
  normalizedData: any | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  editingMode: 'select-all' | 'cursor-at-end' | 'cursor-at-start' | null;
}