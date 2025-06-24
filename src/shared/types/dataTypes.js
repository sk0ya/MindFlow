import { cloneDeep } from 'lodash-es';
import { COORDINATES, TYPOGRAPHY, COLORS as COLOR_CONSTANTS, DEFAULTS, STORAGE, VALIDATION } from '../constants/index.js';

// ファイル関連の定数（定数ファイルから参照）
export const MAX_FILE_SIZE = STORAGE.MAX_FILE_SIZE;
export const ALLOWED_FILE_TYPES = VALIDATION.ALLOWED_FILE_TYPES;

// カラーパレット（定数ファイルから参照）
export const COLORS = COLOR_CONSTANTS.NODE_COLORS;

export const THEMES = {
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

export const createInitialData = () => ({
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

export const createNewNode = (text = '', parentNode = null) => {
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

export const calculateNodePosition = (parentNode, childIndex, totalChildren) => {
  if (!parentNode) return { 
    x: COORDINATES.DEFAULT_CENTER_X, 
    y: COORDINATES.DEFAULT_CENTER_Y 
  };
  
  const distance = LAYOUT.RADIAL_BASE_RADIUS;
  const startAngle = -90;
  const angleStep = totalChildren > 1 ? 180 / (totalChildren - 1) : 0;
  const angle = startAngle + (angleStep * childIndex);
  
  const radian = (angle * Math.PI) / 180;
  const x = parentNode.x + Math.cos(radian) * distance;
  const y = parentNode.y + Math.sin(radian) * distance;
  
  return { x, y };
};

export const deepClone = (obj) => {
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
export const isImageFile = (file) => {
  return file && file.type && file.type.startsWith('image/');
};

export const getFileIcon = (file) => {
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

export const readFileAsDataURL = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
};

export const createFileAttachment = (file, dataURL = null, uploadedFileInfo = null, optimizationInfo = null) => {
  return {
    id: uploadedFileInfo?.id || generateId(),
    name: file.name,
    type: file.type,
    size: file.size,
    dataURL: dataURL, // レガシー対応
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
export const assignColorsToExistingNodes = (mindMapData) => {
  // rootNodeが存在しない場合の対応
  if (!mindMapData || !mindMapData.rootNode) {
    console.warn('Invalid mindmap data or missing rootNode:', mindMapData);
    return mindMapData || createInitialData();
  }
  
  // 🔧 重要: 完全なディープクローンを作成してオブジェクト参照の共有を防止
  console.log('🎨 assignColorsToExistingNodes: ディープクローンを実行中...');
  const clonedData = deepClone(mindMapData);
  
  const assignColors = (node, parentColor = null, isRootChild = false, childIndex = 0) => {
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
      node.children.forEach((child, index) =>
        assignColors(child, node.color, node.id === 'root', index)
      );
    }
  };
  
  // クローンされたデータに対して色の割り当てを実行
  assignColors(clonedData.rootNode);
  
  console.log('🎨 assignColorsToExistingNodes: 色の割り当て完了');
  return clonedData;
};

export const validateFile = (file) => {
  const errors = [];
  
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

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ノード用マインドマップリンクを作成
export const createNodeMapLink = (targetMapId, targetMapTitle, description = '') => ({
  id: generateId(),
  targetMapId,
  targetMapTitle,
  description,
  createdAt: new Date().toISOString()
});
