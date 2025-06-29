// Comprehensive TypeScript type definitions for MindMapApp components

// =============================================================================
// Core Domain Types
// =============================================================================

export interface Position {
  x: number;
  y: number;
}

export interface PanState {
  x: number;
  y: number;
}

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data?: string; // Base64 encoded - optional for compatibility
  dataURL?: string;
  downloadUrl?: string;
  storagePath?: string;
  thumbnailUrl?: string;
  thumbnail?: string;
  r2FileId?: string;
  isR2Storage?: boolean;
  nodeId?: string;
  isImage?: boolean;
  optimized?: boolean;
  originalSize?: number;
  createdAt?: string;
  isOptimized?: boolean;
  optimizedSize?: number;
  compressionRatio?: string;
  optimizedType?: string;
}

export interface MapLink {
  id: string;
  targetMapId: string;
  title: string;
  targetMapTitle?: string;
  targetNodeId?: string;
  description?: string;
}

export interface Node {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  children?: Node[];
  attachments?: FileAttachment[];
  mapLinks?: MapLink[];
  color?: string;
  collapsed?: boolean;
  isTemporary?: boolean;
}

export interface MindMapData {
  id: string;
  title: string;
  rootNode: Node;
  settings?: {
    autoSave?: boolean;
    autoLayout?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface MindMapListItem {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  category?: string;
}

// =============================================================================
// Authentication & User Types
// =============================================================================

export interface User {
  id: string;
  name?: string; // Optional to match auth types
  email?: string;
  avatar?: string;
  githubId?: string;
  provider?: string; // Add provider field for compatibility
  createdAt?: string;
  lastLoginAt?: string;
  [key: string]: any;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
}

// =============================================================================
// UI State Types
// =============================================================================

export interface Conflict {
  id: string;
  timestamp: number;
  type: string;
  message: string;
  [key: string]: any;
}

export interface ConnectedUser {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
  lastSeen?: number;
  lastActivity?: number;
  isOnline?: boolean;
}

export interface UserCursor {
  userId: string;
  nodeId: string;
  position: Position;
  timestamp: number;
}

export type RealtimeStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

// =============================================================================
// Event Handler Types
// =============================================================================

export type VoidFunction = () => void;
export type AsyncVoidFunction = () => Promise<void>;

export interface FileUploadHandler {
  (nodeId: string, files: FileList | File[]): Promise<void>;
}

export interface NodeEventHandlers {
  onSelectNode: (nodeId: string) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: () => void;
  onDragNode: (nodeId: string, x: number, y: number) => void;
  onChangeParent: (nodeId: string, newParentId: string) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRightClick: (e: React.MouseEvent, nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onNavigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

export interface FileEventHandlers {
  onFileUpload: FileUploadHandler;
  onRemoveFile: (nodeId: string, fileId: string) => void;
  onShowImageModal: (image: FileAttachment) => void;
  onShowFileActionMenu: (file: FileAttachment, nodeId: string, position: Position) => void;
}

export interface MapLinkEventHandlers {
  onShowNodeMapLinks: (node: Node, position: Position) => void;
  onAddNodeMapLink: (nodeId: string, targetMapId: string, targetMapTitle: string, description?: string) => void;
  onRemoveNodeMapLink: (nodeId: string, linkId: string) => void;
  onNavigateToMap: (mapId: string) => Promise<void>;
}

export interface ContextMenuEventHandlers {
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onCustomize: (node: Node, position?: Position) => void;
  onCopy: (node: Node) => void;
  onPaste: (parentId: string) => void;
  onClose: VoidFunction;
}

export interface AuthEventHandlers {
  onShowAuthModal: VoidFunction;
  onCloseAuthModal: VoidFunction;
  onAuthSuccess: (user: User) => Promise<void>;
  onLogout: AsyncVoidFunction;
}

export interface MapManagementHandlers {
  onSelectMap: (mapId: string) => Promise<void>;
  onCreateMap: (name?: string | null, category?: string | null) => Promise<string | null>;
  onDeleteMap: (mapId: string) => boolean;
  onRenameMap: (mapId: string, newTitle: string) => void;
  onChangeCategory: (mapId: string, newCategory: string) => void;
}

export interface RealtimeEventHandlers {
  onRealtimeReconnect: VoidFunction;
  onRealtimeDisconnect: VoidFunction;
  onToggleRealtime: VoidFunction;
  onUserClick: (user: ConnectedUser) => void;
  onConflictResolved: (conflict: Conflict) => void;
  onDismissConflict: (conflictId: string) => void;
}

// =============================================================================
// Hook Return Types
// =============================================================================

export interface UseMindMapReturn {
  // Core data
  data: MindMapData | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  
  // State setters
  setSelectedNodeId: (id: string | null) => void;
  setEditingNodeId: (id: string | null) => void;
  setEditText: (text: string) => void;
  
  // Node operations
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  addChildNode: (parentId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
  addSiblingNode: (nodeId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
  deleteNode: (nodeId: string) => void;
  dragNode: (nodeId: string, x: number, y: number) => void;
  changeParent: (nodeId: string, newParentId: string) => void;
  
  // Utility functions
  findNode: (nodeId: string) => Node | null;
  flattenNodes: (node: Node) => Node[];
  
  // Edit operations
  startEdit: (nodeId: string) => void;
  finishEdit: () => void;
  
  // History operations
  undo: VoidFunction;
  redo: VoidFunction;
  canUndo: boolean;
  canRedo: boolean;
  
  // Map operations
  updateTitle: (title: string) => void;
  saveMindMap: AsyncVoidFunction;
  toggleCollapse: (nodeId: string) => void;
  navigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;
  
  // File operations
  attachFileToNode: (nodeId: string, file: File) => Promise<void>;
  removeFileFromNode: (nodeId: string, fileId: string) => void;
  renameFileInNode: (nodeId: string, fileId: string, newName: string) => void;
  downloadFile: (file: FileAttachment) => Promise<void>;
  
  // Multi-map operations
  allMindMaps: MindMapListItem[];
  currentMapId: string | null;
  createMindMap: (title: string, category?: string) => Promise<string>;
  renameMindMap: (mapId: string, newTitle: string) => void;
  deleteMindMapById: (mapId: string) => boolean;
  switchToMap: (mapId: string) => Promise<void>;
  refreshAllMindMaps: AsyncVoidFunction;
  changeMapCategory: (mapId: string, newCategory: string) => void;
  getAvailableCategories: () => string[];
  
  // Map link operations
  addNodeMapLink: (nodeId: string, targetMapId: string, targetMapTitle: string, description?: string) => void;
  removeNodeMapLink: (nodeId: string, linkId: string) => void;
  
  // Realtime operations
  realtimeClient: any;
  isRealtimeConnected: boolean;
  realtimeStatus: RealtimeStatus;
  connectedUsers: ConnectedUser[];
  userCursors: UserCursor[];
  initializeRealtime?: VoidFunction;
  updateCursorPosition?: (nodeId: string) => void;
  triggerCloudSync?: AsyncVoidFunction;
}

export interface UseAppInitializationReturn {
  isReady: boolean;
  isInitializing: boolean;
  showStorageModeSelector: boolean;
  showAuthModal: boolean;
  showOnboarding: boolean;
  hasExistingLocalData: boolean;
  handleStorageModeSelect: (mode: 'local' | 'cloud') => void;
  handleAuthSuccess: VoidFunction;
  handleAuthClose: VoidFunction;
  handleOnboardingComplete: VoidFunction;
}

export interface UseKeyboardShortcutsProps {
  selectedNodeId: string | null;
  editingNodeId: string | null;
  setEditingNodeId: (id: string | null) => void;
  setEditText: (text: string) => void;
  startEdit: (nodeId: string) => void;
  finishEdit: VoidFunction;
  editText: string;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  addChildNode: (parentId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
  addSiblingNode: (nodeId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
  deleteNode: (nodeId: string) => void;
  undo: VoidFunction;
  redo: VoidFunction;
  canUndo: boolean;
  canRedo: boolean;
  navigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;
  saveMindMap: AsyncVoidFunction;
  showMapList: boolean;
  setShowMapList: (show: boolean) => void;
  showCloudStorage: boolean;
  setShowCloudStorage: (show: boolean) => void;
  showTutorial: boolean;
  setShowTutorial: (show: boolean) => void;
  showKeyboardHelper: boolean;
  setShowKeyboardHelper: (show: boolean) => void;
}

// =============================================================================
// Component Props Types
// =============================================================================

export interface ToolbarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onExport: VoidFunction;
  onImport: (file: File) => Promise<void>;
  onUndo: VoidFunction;
  onRedo: VoidFunction;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomReset: VoidFunction;
  onShowCloudStoragePanel: VoidFunction;
  authState: AuthState;
  onShowAuthModal: VoidFunction;
  onLogout: AsyncVoidFunction;
  onShowShortcutHelper: VoidFunction;
}

export interface MindMapCanvasProps {
  data: MindMapData;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  setEditText: (text: string) => void;
  onSelectNode: (nodeId: string) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: VoidFunction;
  onDragNode: (nodeId: string, x: number, y: number) => void;
  onChangeParent: (nodeId: string, newParentId: string) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRightClick: (e: React.MouseEvent, nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onNavigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onFileUpload: FileUploadHandler;
  onRemoveFile: (nodeId: string, fileId: string) => void;
  onShowImageModal: (image: FileAttachment) => void;
  onShowFileActionMenu: (file: FileAttachment, nodeId: string, position: Position) => void;
  onShowNodeMapLinks: (node: Node, position: Position) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  pan: PanState;
  setPan: (pan: PanState) => void;
}

export interface MindMapSidebarProps {
  mindMaps: MindMapListItem[];
  currentMapId: string | null;
  onSelectMap: (mapId: string) => Promise<void>;
  onCreateMap: (name?: string | null, category?: string | null) => Promise<string | null>;
  onDeleteMap: (mapId: string) => boolean;
  onRenameMap: (mapId: string, newTitle: string) => void;
  onChangeCategory: (mapId: string, newCategory: string) => void;
  availableCategories: string[];
  isCollapsed: boolean;
  onToggleCollapse: VoidFunction;
}

export interface NodeCustomizationPanelProps {
  selectedNode: Node | null;
  onUpdateNode: (nodeId: string, updates: Partial<Node>) => void;
  onClose: VoidFunction;
  position: Position;
}

export interface ContextMenuProps {
  visible: boolean;
  position: Position;
  selectedNode: Node | null;
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onCustomize: (node: Node, position?: Position) => void;
  onCopy: (node: Node) => void;
  onPaste: (parentId: string) => void;
  onClose: VoidFunction;
}

export interface ImageModalProps {
  isOpen: boolean;
  image: FileAttachment | null;
  onClose: VoidFunction;
}

export interface FileActionMenuProps {
  isOpen: boolean;
  file: FileAttachment | null;
  position: Position;
  onClose: VoidFunction;
  onDownload: (file: FileAttachment) => Promise<void>;
  onRename: (fileId: string, newName: string) => void;
  onDelete: (fileId: string) => void;
  onView: (image: FileAttachment) => void;
}

export interface NodeMapLinksPanelProps {
  isOpen: boolean;
  position: Position;
  selectedNode: Node | null;
  currentMapId: string | null;
  allMaps: MindMapListItem[];
  onClose: VoidFunction;
  onAddLink: (nodeId: string, targetMapId: string, targetMapTitle: string, description?: string) => void;
  onRemoveLink: (nodeId: string, linkId: string) => void;
  onNavigateToMap: (mapId: string) => Promise<void>;
}

export interface CloudStoragePanelEnhancedProps {
  isVisible: boolean;
  onClose: VoidFunction;
  allMindMaps: MindMapListItem[];
  refreshAllMindMaps: AsyncVoidFunction;
  currentMapId: string | null;
  switchToMap: (mapId: string) => Promise<void>;
  deleteMindMapById: (mapId: string) => boolean;
  renameMindMap: (mapId: string, newTitle: string) => void;
  createMindMap: (title: string, category?: string) => Promise<string>;
}

export interface UserPresenceProps {
  connectedUsers: ConnectedUser[];
  currentUserId?: string;
  realtimeStatus: RealtimeStatus;
  onUserClick: (user: ConnectedUser) => void;
}

export interface UserCursorsProps {
  userCursors: UserCursor[];
  currentUserId?: string;
  zoom: number;
  pan: PanState;
  findNode: (nodeId: string) => Node | null;
}

export interface ConnectionStatusProps {
  realtimeStatus: RealtimeStatus;
  isRealtimeConnected: boolean;
  connectedUsers: ConnectedUser[];
  pendingOperations: number;
  reconnectAttempts: number;
  lastError: string | null;
  onReconnect: VoidFunction;
  onDisconnect: VoidFunction;
  onToggleRealtime: VoidFunction;
  onShowCollaborativeFeatures: VoidFunction;
}

export interface ConflictNotificationProps {
  conflicts: Conflict[];
  onDismiss: (conflictId: string) => void;
  position: 'top-center' | 'top-right' | 'bottom-center' | 'bottom-right';
}

export interface CollaborativeFeaturesProps {
  isVisible: boolean;
  onClose: VoidFunction;
  selectedNodeId: string | null;
  findNode: (nodeId: string) => Node | null;
  currentUserId?: string;
  connectedUsers: ConnectedUser[];
  realtimeClient: any;
}

export interface PerformanceDashboardProps {
  isVisible: boolean;
  onClose: VoidFunction;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export interface AuthModalProps {
  isVisible: boolean;
  onClose: VoidFunction;
  onAuthSuccess: (user: User) => Promise<void>;
}

export interface AuthVerificationProps {
  onAuthSuccess: (user: User) => void;
  onAuthError: (error: Error) => void;
}

export interface TutorialOverlayProps {
  isVisible: boolean;
  onComplete: VoidFunction;
  onSkip: VoidFunction;
}

export interface KeyboardShortcutHelperProps {
  isVisible: boolean;
  onClose: VoidFunction;
}

export interface StorageModeSelectorProps {
  onModeSelect: (mode: 'local' | 'cloud') => void;
  hasLocalData: boolean;
}

// =============================================================================
// Error & Event Types
// =============================================================================

export interface AppError {
  message: string;
  code?: string;
  stack?: string;
  details?: any;
}

export interface KeyboardEvent extends Event {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  preventDefault: VoidFunction;
  stopPropagation: VoidFunction;
}

export interface MouseEventWithNodeId extends React.MouseEvent {
  nodeId?: string;
}

// =============================================================================
// Utility Types
// =============================================================================

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Export commonly used union types
export type Direction = 'up' | 'down' | 'left' | 'right';
export type StorageMode = 'local' | 'cloud';
export type PanelPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';