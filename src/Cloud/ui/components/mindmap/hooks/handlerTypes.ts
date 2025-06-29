import { MindMapNode, MindMapData, FileAttachment, Position } from '../../../../shared/types/dataTypes';

// React event types
export type MouseEventHandler = React.MouseEventHandler<HTMLElement>;
export type ChangeEventHandler = React.ChangeEventHandler<HTMLInputElement>;
export type DragEventHandler = React.DragEventHandler<HTMLElement>;
export type KeyboardEventHandler = React.KeyboardEventHandler<HTMLElement>;

// Node handler types
export interface NodeHandlerParams {
  setSelectedNodeId: (nodeId: string | null) => void;
  setContextMenuPosition: (position: Position) => void;
  setShowContextMenu: (show: boolean) => void;
  setShowCustomizationPanel: (show: boolean) => void;
  addChildNode: (parentId: string, text?: string, startEditing?: boolean) => string | null;
  addSiblingNode: (nodeId: string, text?: string, startEditing?: boolean) => string | null;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  addNodeMapLink: (nodeId: string, targetMapId: string, targetMapTitle: string, description: string) => void;
  removeNodeMapLink: (nodeId: string, linkId: string) => void;
  updateCursorPosition?: (nodeId: string) => void;
}

export interface NodeHandlers {
  handleAddChild: (parentId: string) => void;
  handleRightClick: (e: React.MouseEvent<HTMLElement>, nodeId: string) => void;
  handleAddSibling: (nodeId: string) => void;
  handleCopyNode: (node: MindMapNode) => Partial<MindMapNode>;
  handlePasteNode: (parentId: string, clipboard: Partial<MindMapNode> | null) => void;
  handleNodeSelect: (nodeId: string) => void;
  handleAddNodeMapLink: (nodeId: string, targetMapId: string, targetMapTitle: string, description: string) => void;
  handleRemoveNodeMapLink: (nodeId: string, linkId: string) => void;
}

// File handler types
export interface FileHandlerParams {
  attachFileToNode: (nodeId: string, file: File) => Promise<void>;
  removeFileFromNode: (nodeId: string, fileId: string) => void;
  renameFileInNode: (nodeId: string, fileId: string, newName: string) => void;
  downloadFile: (file: FileAttachment) => Promise<void>;
}

export interface FileActionMenuState {
  file: FileAttachment | null;
  nodeId: string | null;
  position: Position;
}

export interface FileHandlers {
  // State
  showImageModal: boolean;
  modalImage: FileAttachment | null;
  showFileActionMenu: boolean;
  fileActionMenuPosition: Position;
  actionMenuFile: FileAttachment | null;
  actionMenuNodeId: string | null;
  
  // Handlers
  handleShowImageModal: (image: FileAttachment) => void;
  handleCloseImageModal: () => void;
  handleShowFileActionMenu: (file: FileAttachment, nodeId: string, position: Position) => void;
  handleCloseFileActionMenu: () => void;
  handleFileDownload: (file: FileAttachment) => Promise<void>;
  handleFileRename: (fileId: string, newName: string) => void;
  handleFileDelete: (fileId: string) => void;
  handleFileUpload: (nodeId: string, files: FileList) => Promise<void>;
  handleRemoveFile: (nodeId: string, fileId: string) => void;
  
  // Utility
  handleCloseAllPanels: () => void;
}

// Map handler types
export interface MapHandlerParams {
  allMindMaps: MindMapData[];
  switchToMap: (mapId: string) => Promise<void>;
  createMindMap: (title: string, category: string) => Promise<string | null>;
  deleteMindMapById: (mapId: string) => boolean;
  renameMindMap: (mapId: string, newTitle: string) => void;
  changeMapCategory: (mapId: string, newCategory: string) => void;
}

export interface MapHandlers {
  handleSelectMap: (mapId: string) => Promise<void>;
  handleCreateMap: (providedName?: string | null, providedCategory?: string | null) => Promise<string | null>;
  handleDeleteMap: (mapId: string) => boolean;
  handleRenameMap: (mapId: string, newTitle: string) => void;
  handleChangeCategory: (mapId: string, newCategory: string) => void;
  handleNavigateToMap: (mapId: string) => Promise<void>;
}

// Error types
export interface ErrorWithMessage {
  message: string;
  code?: string;
  details?: unknown;
}