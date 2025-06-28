// 統一データ管理システム - 全ての保存・同期操作を統括
import { getAppSettings } from '../../core/storage/LocalEngine';
import { storageManager } from '../../core/storage/LocalEngine';
import { deepClone, MindMapData, MindMapNode, FileAttachment } from '../types/dataTypes';

// ======= TYPE DEFINITIONS =======

// Operation Types
export type OperationType = 
  | 'text_edit'
  | 'node_add'
  | 'node_delete'
  | 'node_move'
  | 'file_attach'
  | 'file_remove'
  | 'layout_change'
  | 'metadata_update';

// Save Strategy Configuration
export interface SaveStrategy {
  delay: number;
  batch: boolean;
}

// Operation Payload Types
export interface TextEditPayload {
  nodeId: string;
  text: string;
}

export interface NodeAddPayload {
  parentId: string;
  nodeData: MindMapNode;
  position?: number;
}

export interface NodeDeletePayload {
  nodeId: string;
}

export interface NodeMovePayload {
  nodeId: string;
  newX: number;
  newY: number;
  newParentId?: string;
}

export interface FileAttachPayload {
  nodeId: string;
  fileData: FileAttachment;
}

export interface FileRemovePayload {
  nodeId: string;
  fileId: string;
}

export interface LayoutChangePayload {
  layout: MindMapNode;
}

export interface MetadataUpdatePayload {
  [key: string]: any;
}

// Union type for all payloads
export type OperationPayload = 
  | TextEditPayload
  | NodeAddPayload
  | NodeDeletePayload
  | NodeMovePayload
  | FileAttachPayload
  | FileRemovePayload
  | LayoutChangePayload
  | MetadataUpdatePayload;

// Operation Options
export interface OperationOptions {
  onLocalUpdate?: (data: MindMapData) => void;
  skipSave?: boolean;
  force?: boolean;
}

// Operation Result
export interface OperationResult {
  success: boolean;
  operationId: string;
  data: MindMapData;
  error?: string;
}

// Queue Operation
export interface QueuedOperation {
  operationId: string;
  operationType: OperationType;
  payload: OperationPayload;
  timestamp: number;
}

// Sync Status
export interface DataManagerSyncStatus {
  isOnline: boolean;
  syncInProgress: boolean;
  pendingOperations: number;
  scheduledSaves: number;
  lastSaveTime: number | null;
}

// Storage Result Type
export interface DataManagerStorageResult {
  success: boolean;
  data?: MindMapData;
  error?: string;
}

// Event Listener Handlers
export type OnlineEventHandler = () => void;
export type OfflineEventHandler = () => void;
export type BeforeUnloadEventHandler = (e: BeforeUnloadEvent) => void;

// Log Sanitization Types
export interface SanitizedPayload {
  [key: string]: any;
}

export interface FileDataForLog {
  name?: string;
  size?: number;
}

// Operation Type Registry
export interface OperationTypes {
  readonly TEXT_EDIT: 'text_edit';
  readonly NODE_ADD: 'node_add';
  readonly NODE_DELETE: 'node_delete';
  readonly NODE_MOVE: 'node_move';
  readonly FILE_ATTACH: 'file_attach';
  readonly FILE_REMOVE: 'file_remove';
  readonly LAYOUT_CHANGE: 'layout_change';
  readonly METADATA_UPDATE: 'metadata_update';
}

// Save Strategies Registry
export type SaveStrategies = Record<OperationType, SaveStrategy>;

/**
 * データ管理の責任:
 * 1. ローカル状態の管理
 * 2. 操作の永続化
 * 3. 同期状態の管理  
 * 4. データ整合性の保証
 */
export class DataManager {
  private currentData: MindMapData | null;
  private pendingOperations: Map<string, QueuedOperation>;
  private syncQueue: QueuedOperation[];
  private isOnline: boolean;
  private saveTimers: Map<OperationType, NodeJS.Timeout>;
  private lastSaveTime: number | null;
  private syncInProgress: boolean;
  private readonly OPERATION_TYPES: OperationTypes;
  private readonly SAVE_STRATEGIES: SaveStrategies;
  private handleOnline: OnlineEventHandler;
  private handleOffline: OfflineEventHandler;
  private handleBeforeUnload: BeforeUnloadEventHandler;

  constructor() {
    this.currentData = null;
    this.pendingOperations = new Map<string, QueuedOperation>();
    this.syncQueue = [];
    this.isOnline = navigator.onLine;
    this.saveTimers = new Map<OperationType, NodeJS.Timeout>();
    this.lastSaveTime = null;
    this.syncInProgress = false;
    
    // 操作タイプ定義
    this.OPERATION_TYPES = {
      TEXT_EDIT: 'text_edit' as const,           // テキスト編集（リアルタイム）
      NODE_ADD: 'node_add' as const,             // ノード追加（確定操作）
      NODE_DELETE: 'node_delete' as const,       // ノード削除（確定操作）
      NODE_MOVE: 'node_move' as const,           // ノード移動（確定操作）
      FILE_ATTACH: 'file_attach' as const,       // ファイル添付（確定操作）
      FILE_REMOVE: 'file_remove' as const,       // ファイル削除（確定操作）
      LAYOUT_CHANGE: 'layout_change' as const,   // レイアウト変更（バッチ操作）
      METADATA_UPDATE: 'metadata_update' as const // メタデータ更新（バッチ操作）
    };
    
    // 保存戦略定義
    this.SAVE_STRATEGIES = {
      [this.OPERATION_TYPES.TEXT_EDIT]: { delay: 1000, batch: true },
      [this.OPERATION_TYPES.NODE_ADD]: { delay: 0, batch: false },
      [this.OPERATION_TYPES.NODE_DELETE]: { delay: 0, batch: false },
      [this.OPERATION_TYPES.NODE_MOVE]: { delay: 100, batch: true },
      [this.OPERATION_TYPES.FILE_ATTACH]: { delay: 0, batch: false },
      [this.OPERATION_TYPES.FILE_REMOVE]: { delay: 0, batch: false },
      [this.OPERATION_TYPES.LAYOUT_CHANGE]: { delay: 500, batch: true },
      [this.OPERATION_TYPES.METADATA_UPDATE]: { delay: 300, batch: true }
    };
    
    // Event handler placeholders - will be initialized in setupEventListeners
    this.handleOnline = () => {};
    this.handleOffline = () => {};
    this.handleBeforeUnload = () => {};
    
    this.setupEventListeners();
  }
  
  // イベントリスナー設定
  private setupEventListeners(): void {
    // イベントハンドラーをバインドして参照を保持
    this.handleOnline = (): void => {
      this.isOnline = true;
      this.processPendingOperations();
    };
    
    this.handleOffline = (): void => {
      this.isOnline = false;
    };
    
    this.handleBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (this.hasPendingOperations()) {
        this.emergencySave();
        e.preventDefault();
        e.returnValue = '未保存の変更があります。ページを離れますか？';
      }
    };
    
    // オンライン状態監視
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }
  
  // データ初期化
  public async initializeData(data: MindMapData): Promise<void> {
    this.currentData = deepClone(data);
    console.log('📊 DataManager: データ初期化完了', {
      id: data?.id,
      title: data?.title,
      nodesCount: this.countNodes(data?.rootNode)
    });
  }
  
  // 操作実行のメインエントリーポイント
  public async executeOperation(
    operationType: OperationType, 
    payload: OperationPayload, 
    options: OperationOptions = {}
  ): Promise<OperationResult> {
    const operationId = this.generateOperationId();
    
    console.log('🔄 DataManager: 操作開始', {
      id: operationId,
      type: operationType,
      payload: this.sanitizePayloadForLog(payload)
    });
    
    // Store previous data for rollback
    const previousData = deepClone(this.currentData!);
    
    try {
      // 1. 楽観的更新（ローカル状態を即座に更新）
      this.currentData = this.applyOperation(this.currentData!, operationType, payload);
      
      // 2. UI通知（状態変更をリスナーに通知）
      if (options.onLocalUpdate) {
        options.onLocalUpdate(this.currentData);
      }
      
      // 3. 保存戦略に基づく永続化
      const strategy = this.SAVE_STRATEGIES[operationType];
      if (strategy.delay === 0) {
        // 即座保存
        await this.saveToStorage(operationId, operationType, payload);
      } else {
        // 遅延保存
        this.scheduleSave(operationId, operationType, payload, strategy.delay);
      }
      
      console.log('✅ DataManager: 操作完了', { id: operationId, type: operationType });
      return { success: true, operationId, data: this.currentData! };
      
    } catch (error) {
      console.error('❌ DataManager: 操作失敗', {
        id: operationId,
        type: operationType,
        error: (error as Error).message
      });
      
      // ロールバック
      this.currentData = previousData;
      if (options.onLocalUpdate && this.currentData) {
        options.onLocalUpdate(this.currentData);
      }
      
      return { success: false, operationId, data: this.currentData!, error: (error as Error).message };
    }
  }
  
  // 楽観的更新の適用
  private applyOperation(
    data: MindMapData, 
    operationType: OperationType, 
    payload: OperationPayload
  ): MindMapData {
    const newData = deepClone(data);
    
    switch (operationType) {
      case this.OPERATION_TYPES.TEXT_EDIT:
        return this.applyTextEdit(newData, payload as TextEditPayload);
      case this.OPERATION_TYPES.NODE_ADD:
        return this.applyNodeAdd(newData, payload as NodeAddPayload);
      case this.OPERATION_TYPES.NODE_DELETE:
        return this.applyNodeDelete(newData, payload as NodeDeletePayload);
      case this.OPERATION_TYPES.NODE_MOVE:
        return this.applyNodeMove(newData, payload as NodeMovePayload);
      case this.OPERATION_TYPES.FILE_ATTACH:
        return this.applyFileAttach(newData, payload as FileAttachPayload);
      case this.OPERATION_TYPES.FILE_REMOVE:
        return this.applyFileRemove(newData, payload as FileRemovePayload);
      case this.OPERATION_TYPES.LAYOUT_CHANGE:
        return this.applyLayoutChange(newData, payload as LayoutChangePayload);
      case this.OPERATION_TYPES.METADATA_UPDATE:
        return this.applyMetadataUpdate(newData, payload as MetadataUpdatePayload);
      default:
        throw new Error(`未知の操作タイプ: ${operationType}`);
    }
  }
  
  // テキスト編集の適用
  private applyTextEdit(data: MindMapData, payload: TextEditPayload): MindMapData {
    const { nodeId, text } = payload;
    const updateNode = (node: MindMapNode): MindMapNode => {
      if (node.id === nodeId) {
        return { ...node, text };
      }
      if (node.children) {
        return { ...node, children: node.children.map(updateNode) };
      }
      return node;
    };
    
    return {
      ...data,
      rootNode: updateNode(data.rootNode),
      updatedAt: new Date().toISOString()
    };
  }
  
  // ノード追加の適用
  private applyNodeAdd(data: MindMapData, payload: NodeAddPayload): MindMapData {
    const { parentId, nodeData, position } = payload;
    const addNode = (node: MindMapNode): MindMapNode => {
      if (node.id === parentId) {
        const children = node.children || [];
        const newChildren = [...children];
        if (typeof position === 'number') {
          newChildren.splice(position, 0, nodeData);
        } else {
          newChildren.push(nodeData);
        }
        return { ...node, children: newChildren };
      }
      if (node.children) {
        return { ...node, children: node.children.map(addNode) };
      }
      return node;
    };
    
    return {
      ...data,
      rootNode: addNode(data.rootNode),
      updatedAt: new Date().toISOString()
    };
  }
  
  // ノード削除の適用
  private applyNodeDelete(data: MindMapData, payload: NodeDeletePayload): MindMapData {
    const { nodeId } = payload;
    const deleteNode = (node: MindMapNode): MindMapNode => {
      if (node.children) {
        return {
          ...node,
          children: node.children
            .filter(child => child.id !== nodeId)
            .map(deleteNode)
        };
      }
      return node;
    };
    
    return {
      ...data,
      rootNode: deleteNode(data.rootNode),
      updatedAt: new Date().toISOString()
    };
  }
  
  // ノード移動の適用
  private applyNodeMove(data: MindMapData, payload: NodeMovePayload): MindMapData {
    const { nodeId, newX, newY, newParentId } = payload;
    // 実装詳細は既存のchangeParent関数を参考
    // ここでは簡略化
    const updateNode = (node: MindMapNode): MindMapNode => {
      if (node.id === nodeId) {
        return { ...node, x: newX, y: newY };
      }
      if (node.children) {
        return { ...node, children: node.children.map(updateNode) };
      }
      return node;
    };
    
    return {
      ...data,
      rootNode: updateNode(data.rootNode),
      updatedAt: new Date().toISOString()
    };
  }
  
  // ファイル添付の適用
  private applyFileAttach(data: MindMapData, payload: FileAttachPayload): MindMapData {
    const { nodeId, fileData } = payload;
    const updateNode = (node: MindMapNode): MindMapNode => {
      if (node.id === nodeId) {
        const attachments = node.attachments || [];
        return {
          ...node,
          attachments: [...attachments, fileData]
        };
      }
      if (node.children) {
        return { ...node, children: node.children.map(updateNode) };
      }
      return node;
    };
    
    return {
      ...data,
      rootNode: updateNode(data.rootNode),
      updatedAt: new Date().toISOString()
    };
  }
  
  // ファイル削除の適用
  private applyFileRemove(data: MindMapData, payload: FileRemovePayload): MindMapData {
    const { nodeId, fileId } = payload;
    const updateNode = (node: MindMapNode): MindMapNode => {
      if (node.id === nodeId && node.attachments) {
        return {
          ...node,
          attachments: node.attachments.filter(file => file.id !== fileId)
        };
      }
      if (node.children) {
        return { ...node, children: node.children.map(updateNode) };
      }
      return node;
    };
    
    return {
      ...data,
      rootNode: updateNode(data.rootNode),
      updatedAt: new Date().toISOString()
    };
  }
  
  // レイアウト変更の適用
  private applyLayoutChange(data: MindMapData, payload: LayoutChangePayload): MindMapData {
    const { layout } = payload;
    return {
      ...data,
      rootNode: layout,
      updatedAt: new Date().toISOString()
    };
  }
  
  // メタデータ更新の適用
  private applyMetadataUpdate(data: MindMapData, updates: MetadataUpdatePayload): MindMapData {
    return {
      ...data,
      ...updates,
      updatedAt: new Date().toISOString()
    };
  }
  
  // ストレージへの保存
  private async saveToStorage(
    operationId: string, 
    operationType: OperationType, 
    payload: OperationPayload
  ): Promise<void> {
    if (this.syncInProgress) {
      this.queueOperation(operationId, operationType, payload);
      return;
    }
    
    try {
      this.syncInProgress = true;
      // 確定操作はマップ全体を保存
      if (this.isCommitOperation(operationType)) {
        const result = await storageManager.updateMindMap(this.currentData!.id, this.currentData!);
        if (!result.success) {
          throw new Error(result.error || '保存に失敗しました');
        }
        console.log('💾 DataManager: マップ全体保存完了', {
          id: operationId,
          type: operationType,
          mapId: this.currentData!.id
        });
      } else {
        // リアルタイム操作は部分更新（将来の拡張用）
        console.log('📝 DataManager: 部分更新保存（現在はマップ全体保存）', {
          id: operationId,
          type: operationType
        });
        const result = await storageManager.updateMindMap(this.currentData!.id, this.currentData!);
        if (!result.success) {
          throw new Error(result.error || '保存に失敗しました');
        }
      }
      
      this.lastSaveTime = Date.now();
      
    } catch (error) {
      console.error('❌ DataManager: 保存失敗', {
        id: operationId,
        error: (error as Error).message
      });
      
      // オフライン時は保留キューに追加
      if (!this.isOnline) {
        this.queueOperation(operationId, operationType, payload);
      } else {
        throw error;
      }
    } finally {
      this.syncInProgress = false;
      this.processNextQueuedOperation();
    }
  }
  
  // 遅延保存のスケジューリング
  private scheduleSave(
    operationId: string, 
    operationType: OperationType, 
    payload: OperationPayload, 
    delay: number
  ): void {
    // 既存のタイマーをクリア
    if (this.saveTimers.has(operationType)) {
      clearTimeout(this.saveTimers.get(operationType)!);
    }
    
    // 新しいタイマーを設定
    const timer = setTimeout(async () => {
      try {
        await this.saveToStorage(operationId, operationType, payload);
        this.saveTimers.delete(operationType);
      } catch (error) {
        console.error('❌ DataManager: 遅延保存失敗', { operationType, error: (error as Error).message });
      }
    }, delay);
    
    this.saveTimers.set(operationType, timer);
  }
  
  // 確定操作かどうかの判定
  private isCommitOperation(operationType: OperationType): boolean {
    const commitOperations: OperationType[] = [
      this.OPERATION_TYPES.NODE_ADD,
      this.OPERATION_TYPES.NODE_DELETE,
      this.OPERATION_TYPES.FILE_ATTACH,
      this.OPERATION_TYPES.FILE_REMOVE
    ];
    return commitOperations.includes(operationType);
  }
  
  // 操作をキューに追加
  private queueOperation(
    operationId: string, 
    operationType: OperationType, 
    payload: OperationPayload
  ): void {
    this.syncQueue.push({ operationId, operationType, payload, timestamp: Date.now() });
    console.log('📋 DataManager: 操作をキューに追加', {
      id: operationId,
      queueLength: this.syncQueue.length
    });
  }
  
  // 次のキューされた操作を処理
  private async processNextQueuedOperation(): Promise<void> {
    if (this.syncQueue.length === 0 || this.syncInProgress) return;
    
    const operation = this.syncQueue.shift()!;
    try {
      await this.saveToStorage(operation.operationId, operation.operationType, operation.payload);
    } catch (error) {
      console.error('❌ DataManager: キュー操作失敗', { operation, error: (error as Error).message });
    }
  }
  
  // 保留中の操作を処理
  private async processPendingOperations(): Promise<void> {
    if (!this.isOnline) return;
    
    console.log('🔄 DataManager: 保留操作の処理開始', {
      queueLength: this.syncQueue.length
    });
    
    while (this.syncQueue.length > 0 && this.isOnline) {
      await this.processNextQueuedOperation();
    }
  }
  
  // 緊急保存（ページ離脱時）
  private emergencySave(): void {
    if (!this.hasPendingOperations()) return;
    
    console.log('🚨 DataManager: 緊急保存実行');
    
    // 同期的な保存（限定的）
    try {
      const settings = getAppSettings();
      
      if (settings.storageMode === 'local') {
        // ローカルモードは同期保存可能
        try {
          // 同期的importは使用できないため、localStorage APIを直接使用
          localStorage.setItem(`mindmap_${this.currentData!.id}`, JSON.stringify(this.currentData));
          console.log('✅ DataManager: 緊急ローカル保存完了');
        } catch (storageError) {
          console.error('❌ DataManager: 緊急ローカルストレージ保存失敗', (storageError as Error).message);
        }
      } else {
        console.warn('⚠️ DataManager: クラウドモードでは緊急保存制限あり');
      }
    } catch (error) {
      console.error('❌ DataManager: 緊急保存失敗', (error as Error).message);
    }
  }
  
  // 保留中の操作があるかチェック
  public hasPendingOperations(): boolean {
    return this.syncQueue.length > 0 || this.saveTimers.size > 0;
  }
  
  // 現在のデータを取得
  public getCurrentData(): MindMapData | null {
    return this.currentData;
  }
  
  // 同期状態を取得
  public getSyncStatus(): DataManagerSyncStatus {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      pendingOperations: this.syncQueue.length,
      scheduledSaves: this.saveTimers.size,
      lastSaveTime: this.lastSaveTime
    };
  }
  
  // ユーティリティメソッド
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private sanitizePayloadForLog(payload: OperationPayload): SanitizedPayload {
    // ログ用にペイロードをサニタイズ（大きなデータを除去）
    if (typeof payload === 'object' && payload !== null) {
      const sanitized: SanitizedPayload = {};
      for (const [key, value] of Object.entries(payload)) {
        if (key === 'fileData' && (value as FileDataForLog)?.size && (value as FileDataForLog).size! > 1000) {
          const fileData = value as FileDataForLog;
          sanitized[key] = `[File: ${fileData.name}, ${fileData.size} bytes]`;
        } else if (typeof value === 'string' && value.length > 100) {
          sanitized[key] = value.substring(0, 100) + '...';
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }
    return payload as SanitizedPayload;
  }
  
  private countNodes(node: MindMapNode | undefined): number {
    if (!node) return 0;
    let count = 1;
    if (node.children) {
      count += node.children.reduce((sum, child) => sum + this.countNodes(child), 0);
    }
    return count;
  }
  
  // クリーンアップ
  public destroy(): void {
    // タイマーをクリア
    this.saveTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.saveTimers.clear();
    
    // イベントリスナーを削除
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    
    console.log('🧹 DataManager: クリーンアップ完了');
  }
}

// シングルトンインスタンス
export const dataManager = new DataManager();