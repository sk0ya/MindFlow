import { cloneDeep } from '../utils/lodash-utils';
import { COORDINATES, LAYOUT, TYPOGRAPHY, COLORS as COLOR_CONSTANTS, DEFAULTS, STORAGE, VALIDATION } from '../constants/index';
import { logger } from '../utils/logger';

// Import shared types to ensure compatibility
import type { 
  MindMapNode as SharedMindMapNode, 
  MindMapData as SharedMindMapData,
  MindMapSettings as SharedMindMapSettings,
  FileAttachment as SharedFileAttachment,
  NodeMapLink as SharedNodeMapLink
} from '@shared/types';

// Re-export shared types for compatibility
export type MindMapNode = SharedMindMapNode;
export type FileAttachment = SharedFileAttachment;
export type NodeMapLink = SharedNodeMapLink;
export type MindMapSettings = SharedMindMapSettings;
export type MindMapData = SharedMindMapData;
// Position type definition
export interface Position {
  x: number;
  y: number;
}

export interface Theme {
  name: string;
  background: string;
  connectionColor: string;
  textColor: string;
}

// Service Dependency Interfaces
export interface MindMapHookDependency {
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  addChildNode: (parentId: string, text: string, options?: Partial<MindMapNode>) => string | undefined;
  deleteNode: (nodeId: string) => void;
  changeParent: (nodeId: string, newParentId: string) => void;
  findNode: (nodeId: string) => MindMapNode | undefined;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export interface FileHandlersDependency {
  handleFileUpload: (nodeId: string, file: File) => Promise<void>;
  handleRemoveFile: (nodeId: string, fileId: string) => Promise<void>;
  handleFileDownload: (nodeId: string, fileId: string) => Promise<void>;
  handleFileRename: (nodeId: string, fileId: string, newName: string) => Promise<void>;
  handleShowImageModal: (image: { url: string; alt: string }) => void;
  handleShowFileActionMenu: (file: FileAttachment, position: Position) => void;
}

export interface MapHandlersDependency {
  handleNavigateToMap: (mapId: string) => Promise<void>;
  handleCreateMap: (title: string) => Promise<string>;
  handleDeleteMap: (mapId: string) => Promise<void>;
  handleRenameMap: (mapId: string, newTitle: string) => Promise<void>;
  handleChangeCategory: (mapId: string, category: string) => Promise<void>;
  handleSelectMap: (mapId: string) => Promise<void>;
}

export interface UIStateDependency {
  handleCloseNodeMapLinksPanel: () => void;
  handleShowNodeMapLinks: (node: MindMapNode, position: Position) => void;
}

// Image and File Types for UI state - simplified to use FileAttachment
export type ImageFile = FileAttachment;

// ファイル関連の定数（定数ファイルから参照）
export const MAX_FILE_SIZE = STORAGE.MAX_FILE_SIZE;
export const ALLOWED_FILE_TYPES = VALIDATION.ALLOWED_FILE_TYPES;

// カラーパレット（定数ファイルから参照）
export const COLORS = COLOR_CONSTANTS.NODE_COLORS;

export const THEMES: Record<string, Theme> = {
  default: {
    name: 'デフォルト',
    background: 'white',
    connectionColor: 'black',
    textColor: 'black'
  }
};

// ID生成でタイムスタンプの重複を防ぐためのカウンター
let idCounter = 0;
let lastTimestamp = 0;

export const generateId = () => {
  const now = Date.now();
  
  // 同じタイムスタンプの場合はカウンターを増加
  if (now === lastTimestamp) {
    idCounter++;
  } else {
    idCounter = 0;
    lastTimestamp = now;
  }
  
  // より強固なランダム文字列を生成
  const randomPart1 = Math.random().toString(36).substr(2, 9);
  const randomPart2 = Math.random().toString(36).substr(2, 9);
  
  return `node_${now}_${idCounter}_${randomPart1}${randomPart2}`;
};

export const generateMapId = () => {
  const now = Date.now();
  
  // 同じタイムスタンプの場合はカウンターを増加
  if (now === lastTimestamp) {
    idCounter++;
  } else {
    idCounter = 0;
    lastTimestamp = now;
  }
  
  // より強固なランダム文字列を生成
  const randomPart1 = Math.random().toString(36).substr(2, 9);
  const randomPart2 = Math.random().toString(36).substr(2, 9);
  
  return `map_${now}_${idCounter}_${randomPart1}${randomPart2}`;
};

export const createInitialData = (): MindMapData => ({
  id: generateMapId(),
  title: DEFAULTS.NEW_MAP_TITLE,
  category: '未分類',
  theme: 'default',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  rootNode: {
    id: 'root',
    text: DEFAULTS.ROOT_NODE_TEXT,
    x: COORDINATES.ROOT_NODE_X,
    y: COORDINATES.ROOT_NODE_Y,
    fontSize: TYPOGRAPHY.DEFAULT_FONT_SIZE,
    fontWeight: TYPOGRAPHY.DEFAULT_FONT_WEIGHT,
    children: [],
    attachments: [],
    mapLinks: []
  },
  settings: {
    autoSave: DEFAULTS.AUTO_SAVE,
    autoLayout: DEFAULTS.AUTO_LAYOUT,
    snapToGrid: DEFAULTS.SNAP_TO_GRID,
    showGrid: DEFAULTS.SHOW_GRID,
    animationEnabled: DEFAULTS.ANIMATION_ENABLED
  }
});

export const createNewNode = (text: string = '', parentNode: MindMapNode | null = null): MindMapNode => {
  return {
    id: generateId(),
    text,
    x: parentNode ? parentNode.x + LAYOUT.RADIAL_BASE_RADIUS : COORDINATES.DEFAULT_CENTER_X,
    y: parentNode ? parentNode.y : COORDINATES.DEFAULT_CENTER_Y,
    fontSize: TYPOGRAPHY.DEFAULT_FONT_SIZE - 2, // 子ノードは少し小さく
    fontWeight: TYPOGRAPHY.DEFAULT_FONT_WEIGHT,
    children: [],
    attachments: [], // ファイル添付用
    mapLinks: [] // 他のマインドマップへのリンク
  };
};

export const calculateNodePosition = (parentNode: MindMapNode | null, childIndex: number, totalChildren: number): Position => {
  if (!parentNode) return { 
    x: COORDINATES.DEFAULT_CENTER_X, 
    y: COORDINATES.DEFAULT_CENTER_Y 
  };
  
  const distance = LAYOUT.RADIAL_BASE_RADIUS;
  
  // 初回の子ノードの場合（子ノードが1つの場合）
  if (totalChildren === 1) {
    return {
      x: parentNode.x + distance,
      y: parentNode.y
    };
  }
  
  // 複数の子ノードがある場合の放射状配置
  const startAngle = -90;
  const angleStep = totalChildren > 1 ? 180 / (totalChildren - 1) : 0;
  const angle = startAngle + (angleStep * childIndex);
  
  const radian = (angle * Math.PI) / 180;
  const x = parentNode.x + Math.cos(radian) * distance;
  const y = parentNode.y + Math.sin(radian) * distance;
  
  return { x, y };
};

export const deepClone = <T>(obj: T): T => {
  return cloneDeep(obj);
};

export const STORAGE_KEYS = {
  MINDMAPS: 'mindmaps',
  CURRENT_MAP: 'currentMap',
  SETTINGS: 'appSettings',
  SYNC_QUEUE: 'mindflow_sync_queue',
  LAST_SYNC_TIME: 'mindflow_last_sync_time'
};

// ファイル関連のユーティリティ
export const isImageFile = (file: File): boolean => {
  return Boolean(file && file.type && file.type.startsWith('image/'));
};

export const getFileIcon = (file: File): string => {
  if (isImageFile(file)) {
    return '🖼️';
  }
  
  switch (file.type) {
    case 'text/plain':
      return '📄';
    case 'application/pdf':
      return '📕';
    case 'application/json':
      return '📋';
    default:
      return '📎';
  }
};

export const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
};

// ファイルアップロード関連の型定義
export interface UploadedFileInfo {
  id?: string;
  downloadUrl?: string;
  storagePath?: string;
  thumbnailUrl?: string;
  uploadedAt?: string;
}

export interface FileOptimizationInfo {
  isR2Storage?: boolean;
  nodeId?: string;
  isOptimized?: boolean;
  originalSize?: number;
  optimizedSize?: number;
  compressionRatio?: string;
  optimizedType?: string;
}

export const createFileAttachment = (
  file: File, 
  dataURL: string | null = null, 
  uploadedFileInfo: UploadedFileInfo | null = null, 
  optimizationInfo: FileOptimizationInfo | null = null
): FileAttachment => {
  return {
    id: uploadedFileInfo?.id || generateId(),
    name: file.name,
    type: file.type,
    size: file.size,
    dataURL: dataURL || undefined, // レガシー対応
    downloadUrl: uploadedFileInfo?.downloadUrl, // R2からのダウンロードURL
    storagePath: uploadedFileInfo?.storagePath, // R2のストレージパス
    thumbnailUrl: uploadedFileInfo?.thumbnailUrl, // サムネイルURL
    r2FileId: uploadedFileInfo?.id, // R2ファイルID（ダウンロード用）
    isR2Storage: optimizationInfo?.isR2Storage || false,
    nodeId: optimizationInfo?.nodeId, // ファイルが添付されているノードID
    isImage: isImageFile(file),
    createdAt: uploadedFileInfo?.uploadedAt || new Date().toISOString(),
    // 最適化情報
    isOptimized: optimizationInfo?.isOptimized || false,
    originalSize: optimizationInfo?.originalSize || file.size,
    optimizedSize: optimizationInfo?.optimizedSize || file.size,
    compressionRatio: optimizationInfo?.compressionRatio || '0',
    optimizedType: optimizationInfo?.optimizedType || file.type
  };
};

// 既存のノードに色を自動割り当てする
export const assignColorsToExistingNodes = (mindMapData: MindMapData): MindMapData => {
  // rootNodeが存在しない場合の対応
  if (!mindMapData || !mindMapData.rootNode) {
    logger.warn('Invalid mindmap data or missing rootNode:', mindMapData);
    return mindMapData || createInitialData();
  }
  
  // 🔧 重要: 完全なディープクローンを作成してオブジェクト参照の共有を防止
  const clonedData = deepClone(mindMapData);
  
  const assignColors = (node: MindMapNode, parentColor: string | null = null, isRootChild: boolean = false, childIndex: number = 0): void => {
    if (node.id === 'root') {
      // ルートノードには色を設定しない
      node.color = undefined;
    } else if (isRootChild) {
      // ルートノードの子要素の場合、色が未設定なら順番に割り当て
      if (!node.color) {
        node.color = COLORS[childIndex % COLORS.length];
      }
    } else if (!node.color && parentColor) {
      // 他の場合は親の色を継承
      node.color = parentColor;
    }
    
    // 子ノードも再帰的に処理（インプレース変更）
    if (node.children) {
      node.children.forEach((child: MindMapNode, index: number) =>
        assignColors(child, node.color, node.id === 'root', index)
      );
    }
  };
  
  // クローンされたデータに対して色の割り当てを実行
  assignColors(clonedData.rootNode);
  
  return clonedData;
};

export const validateFile = (file: File): string[] => {
  const errors: string[] = [];
  
  if (!file) {
    errors.push('ファイルが選択されていません');
    return errors;
  }
  
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`ファイルサイズが大きすぎます (${Math.round(file.size / 1024 / 1024)}MB > 10MB)`);
  }
  
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    errors.push(`サポートされていないファイル形式です: ${file.type}`);
  }
  
  return errors;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ノード用マインドマップリンクを作成
export const createNodeMapLink = (targetMapId: string, targetMapTitle: string, description: string = ''): NodeMapLink => ({
  id: generateId(),
  targetMapId,
  targetMapTitle,
  description,
  createdAt: new Date().toISOString()
});