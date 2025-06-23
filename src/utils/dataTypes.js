import { cloneDeep } from 'lodash-es';

// ファイル関連の定数
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'application/pdf',
  'application/json'
];

export const COLORS = [
  '#4285f4',
  '#34a853',
  '#ea4335',
  '#fbbc04',
  '#9c27b0',
  '#ff9800',
  '#795548',
  '#607d8b',
];

export const THEMES = {
  default: {
    name: 'デフォルト',
    background: 'white',
    connectionColor: 'black',
    textColor: 'black'
  }
};

export const generateId = () => {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const generateMapId = () => {
  return `map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const createInitialData = () => ({
  id: generateMapId(),
  title: '新しいマインドマップ',
  category: '未分類',
  theme: 'default',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  rootNode: {
    id: 'root',
    text: 'メイントピック',
    x: 400,
    y: 300,
    fontSize: 16,
    fontWeight: 'normal',
    children: [],
    attachments: [],
    mapLinks: []
  },
  settings: {
    autoSave: true,
    autoLayout: true,
    snapToGrid: false,
    showGrid: false,
    animationEnabled: true
  }
});

export const createNewNode = (text = '', parentNode = null) => {
  return {
    id: generateId(),
    text,
    x: parentNode ? parentNode.x + 150 : 400,
    y: parentNode ? parentNode.y : 300,
    fontSize: 14,
    fontWeight: 'normal',
    children: [],
    attachments: [], // ファイル添付用
    mapLinks: [] // 他のマインドマップへのリンク
  };
};

export const calculateNodePosition = (parentNode, childIndex, totalChildren) => {
  if (!parentNode) return { x: 400, y: 300 };
  
  const distance = 180;
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
