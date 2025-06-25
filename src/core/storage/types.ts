// ストレージアダプターの型定義

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

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataURL?: string;
  downloadUrl?: string;
  storagePath?: string;
  thumbnailUrl?: string;
  r2FileId?: string;
  isR2Storage?: boolean;
  nodeId?: string;
  isImage?: boolean;
}

export interface MapLink {
  id: string;
  targetMapId: string;
  title?: string;
}

export interface Node {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  fontWeight?: string;
  children?: Node[];
  attachments?: FileAttachment[];
  mapLinks?: MapLink[];
  color?: string;
  collapsed?: boolean;
  isTemporary?: boolean;
}

export interface UpdateResult {
  success: boolean;
  error?: string;
  newId?: string;
  finalId?: string;
}

export interface AddNodeResult extends UpdateResult {
  node?: Node;
}

export interface StorageAdapter {
  readonly name: string;
  readonly storageMode: 'local' | 'cloud';
  
  // マップ操作
  getAllMaps(): Promise<MindMapData[]>;
  getMap(mapId: string): Promise<MindMapData>;
  createMap(mapData: MindMapData): Promise<MindMapData>;
  updateMap(mapId: string, mapData: MindMapData): Promise<MindMapData>;
  deleteMap(mapId: string): Promise<boolean>;
  
  // ノード操作（クラウドのみ）
  addNode?(mapId: string, nodeData: Node, parentId: string): Promise<AddNodeResult>;
  updateNode?(mapId: string, nodeId: string, updates: Partial<Node>): Promise<UpdateResult>;
  deleteNode?(mapId: string, nodeId: string): Promise<UpdateResult>;
  
  // 初期化
  initialize?(): Promise<void>;
  isInitialized?: boolean;
}

export interface LocalStorageAdapter extends StorageAdapter {
  readonly storageMode: 'local';
}

export interface CloudStorageAdapter extends StorageAdapter {
  readonly storageMode: 'cloud';
  baseUrl: string;
  
  // クラウド必須メソッド
  addNode(mapId: string, nodeData: Node, parentId: string): Promise<AddNodeResult>;
  updateNode(mapId: string, nodeId: string, updates: Partial<Node>): Promise<UpdateResult>;
  deleteNode(mapId: string, nodeId: string): Promise<UpdateResult>;
}