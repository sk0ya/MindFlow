// 統一データ管理システム - 全ての保存・同期操作を統括
import { getAppSettings } from '../../core/storage/LocalEngine';
import { storageManager } from '../../core/storage/LocalEngine';
import { deepClone } from '../types/dataTypes';

/**
 * データ管理の責任:
 * 1. ローカル状態の管理
 * 2. 操作の永続化
 * 3. 同期状態の管理  
 * 4. データ整合性の保証
 */
class DataManager {
  constructor() {
    this.currentData = null;
    this.pendingOperations = new Map();
    this.syncQueue = [];
    this.isOnline = navigator.onLine;
    this.saveTimers = new Map();
    this.lastSaveTime = null;
    this.syncInProgress = false;
    
    // 操作タイプ定義
    this.OPERATION_TYPES = {
      TEXT_EDIT: 'text_edit',           // テキスト編集（リアルタイム）
      NODE_ADD: 'node_add',             // ノード追加（確定操作）
      NODE_DELETE: 'node_delete',       // ノード削除（確定操作）
      NODE_MOVE: 'node_move',           // ノード移動（確定操作）
      FILE_ATTACH: 'file_attach',       // ファイル添付（確定操作）
      FILE_REMOVE: 'file_remove',       // ファイル削除（確定操作）
      LAYOUT_CHANGE: 'layout_change',   // レイアウト変更（バッチ操作）
      METADATA_UPDATE: 'metadata_update' // メタデータ更新（バッチ操作）
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
    
    this.setupEventListeners();
  }
  
  // イベントリスナー設定
  setupEventListeners() {
    // オンライン状態監視
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processPendingOperations();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
    
    // ページ離脱時の緊急保存
    window.addEventListener('beforeunload', (e) => {
      if (this.hasPendingOperations()) {
        this.emergencySave();
        e.preventDefault();
        e.returnValue = '未保存の変更があります。ページを離れますか？';
      }
    });
  }
  
  // データ初期化
  async initializeData(data) {
    this.currentData = deepClone(data);
    console.log('📊 DataManager: データ初期化完了', {
      id: data?.id,
      title: data?.title,
      nodesCount: this.countNodes(data?.rootNode)
    });
  }
  
  // 操作実行のメインエントリーポイント
  async executeOperation(operationType, payload, options = {}) {
    const operationId = this.generateOperationId();
    
    console.log('🔄 DataManager: 操作開始', {
      id: operationId,
      type: operationType,
      payload: this.sanitizePayloadForLog(payload)
    });
    
    try {
      // 1. 楽観的更新（ローカル状態を即座に更新）
      const previousData = deepClone(this.currentData);
      this.currentData = this.applyOperation(this.currentData, operationType, payload);
      
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
      return { success: true, operationId, data: this.currentData };
      
    } catch (error) {
      console.error('❌ DataManager: 操作失敗', {
        id: operationId,
        type: operationType,
        error: error.message
      });
      
      // ロールバック
      this.currentData = previousData;
      if (options.onLocalUpdate) {
        options.onLocalUpdate(this.currentData);
      }
      
      return { success: false, error: error.message };
    }
  }
  
  // 楽観的更新の適用
  applyOperation(data, operationType, payload) {
    const newData = deepClone(data);
    
    switch (operationType) {
      case this.OPERATION_TYPES.TEXT_EDIT:
        return this.applyTextEdit(newData, payload);
      case this.OPERATION_TYPES.NODE_ADD:
        return this.applyNodeAdd(newData, payload);
      case this.OPERATION_TYPES.NODE_DELETE:
        return this.applyNodeDelete(newData, payload);
      case this.OPERATION_TYPES.NODE_MOVE:
        return this.applyNodeMove(newData, payload);
      case this.OPERATION_TYPES.FILE_ATTACH:
        return this.applyFileAttach(newData, payload);
      case this.OPERATION_TYPES.FILE_REMOVE:
        return this.applyFileRemove(newData, payload);
      case this.OPERATION_TYPES.LAYOUT_CHANGE:
        return this.applyLayoutChange(newData, payload);
      case this.OPERATION_TYPES.METADATA_UPDATE:
        return this.applyMetadataUpdate(newData, payload);
      default:
        throw new Error(`未知の操作タイプ: ${operationType}`);
    }
  }
  
  // テキスト編集の適用
  applyTextEdit(data, { nodeId, text }) {
    const updateNode = (node) => {
      if (node.id === nodeId) {
        return { ...node, text, updatedAt: new Date().toISOString() };
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
  applyNodeAdd(data, { parentId, nodeData, position }) {
    const addNode = (node) => {
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
  applyNodeDelete(data, { nodeId }) {
    const deleteNode = (node) => {
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
  applyNodeMove(data, { nodeId, newX, newY, newParentId }) {
    // 実装詳細は既存のchangeParent関数を参考
    // ここでは簡略化
    const updateNode = (node) => {
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
  applyFileAttach(data, { nodeId, fileData }) {
    const updateNode = (node) => {
      if (node.id === nodeId) {
        const attachments = node.attachments || [];
        return {
          ...node,
          attachments: [...attachments, fileData],
          updatedAt: new Date().toISOString()
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
  applyFileRemove(data, { nodeId, fileId }) {
    const updateNode = (node) => {
      if (node.id === nodeId && node.attachments) {
        return {
          ...node,
          attachments: node.attachments.filter(file => file.id !== fileId),
          updatedAt: new Date().toISOString()
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
  applyLayoutChange(data, { layout }) {
    return {
      ...data,
      rootNode: layout,
      updatedAt: new Date().toISOString()
    };
  }
  
  // メタデータ更新の適用
  applyMetadataUpdate(data, updates) {
    return {
      ...data,
      ...updates,
      updatedAt: new Date().toISOString()
    };
  }
  
  // ストレージへの保存
  async saveToStorage(operationId, operationType, payload) {
    if (this.syncInProgress) {
      this.queueOperation(operationId, operationType, payload);
      return;
    }
    
    try {
      this.syncInProgress = true;
      // 確定操作はマップ全体を保存
      if (this.isCommitOperation(operationType)) {
        const result = await storageManager.updateMap(this.currentData.id, this.currentData);
        if (!result.success) {
          throw new Error(result.error || '保存に失敗しました');
        }
        console.log('💾 DataManager: マップ全体保存完了', {
          id: operationId,
          type: operationType,
          mapId: this.currentData.id
        });
      } else {
        // リアルタイム操作は部分更新（将来の拡張用）
        console.log('📝 DataManager: 部分更新保存（現在はマップ全体保存）', {
          id: operationId,
          type: operationType
        });
        const result = await storageManager.updateMap(this.currentData.id, this.currentData);
        if (!result.success) {
          throw new Error(result.error || '保存に失敗しました');
        }
      }
      
      this.lastSaveTime = Date.now();
      
    } catch (error) {
      console.error('❌ DataManager: 保存失敗', {
        id: operationId,
        error: error.message
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
  scheduleSave(operationId, operationType, payload, delay) {
    // 既存のタイマーをクリア
    if (this.saveTimers.has(operationType)) {
      clearTimeout(this.saveTimers.get(operationType));
    }
    
    // 新しいタイマーを設定
    const timer = setTimeout(async () => {
      try {
        await this.saveToStorage(operationId, operationType, payload);
        this.saveTimers.delete(operationType);
      } catch (error) {
        console.error('❌ DataManager: 遅延保存失敗', { operationType, error });
      }
    }, delay);
    
    this.saveTimers.set(operationType, timer);
  }
  
  // 確定操作かどうかの判定
  isCommitOperation(operationType) {
    return [
      this.OPERATION_TYPES.NODE_ADD,
      this.OPERATION_TYPES.NODE_DELETE,
      this.OPERATION_TYPES.FILE_ATTACH,
      this.OPERATION_TYPES.FILE_REMOVE
    ].includes(operationType);
  }
  
  // 操作をキューに追加
  queueOperation(operationId, operationType, payload) {
    this.syncQueue.push({ operationId, operationType, payload, timestamp: Date.now() });
    console.log('📋 DataManager: 操作をキューに追加', {
      id: operationId,
      queueLength: this.syncQueue.length
    });
  }
  
  // 次のキューされた操作を処理
  async processNextQueuedOperation() {
    if (this.syncQueue.length === 0 || this.syncInProgress) return;
    
    const operation = this.syncQueue.shift();
    try {
      await this.saveToStorage(operation.operationId, operation.operationType, operation.payload);
    } catch (error) {
      console.error('❌ DataManager: キュー操作失敗', { operation, error });
    }
  }
  
  // 保留中の操作を処理
  async processPendingOperations() {
    if (!this.isOnline) return;
    
    console.log('🔄 DataManager: 保留操作の処理開始', {
      queueLength: this.syncQueue.length
    });
    
    while (this.syncQueue.length > 0 && this.isOnline) {
      await this.processNextQueuedOperation();
    }
  }
  
  // 緊急保存（ページ離脱時）
  emergencySave() {
    if (!this.hasPendingOperations()) return;
    
    console.log('🚨 DataManager: 緊急保存実行');
    
    // 同期的な保存（限定的）
    try {
      const settings = getAppSettings();
      
      if (settings.storageMode === 'local') {
        // ローカルモードは同期保存可能
        try {
          // 同期的importは使用できないため、localStorage APIを直接使用
          localStorage.setItem(`mindmap_${this.currentData.id}`, JSON.stringify(this.currentData));
          console.log('✅ DataManager: 緊急ローカル保存完了');
        } catch (storageError) {
          console.error('❌ DataManager: 緊急ローカルストレージ保存失敗', storageError);
        }
      } else {
        console.warn('⚠️ DataManager: クラウドモードでは緊急保存制限あり');
      }
    } catch (error) {
      console.error('❌ DataManager: 緊急保存失敗', error);
    }
  }
  
  // 保留中の操作があるかチェック
  hasPendingOperations() {
    return this.syncQueue.length > 0 || this.saveTimers.size > 0;
  }
  
  // 現在のデータを取得
  getCurrentData() {
    return this.currentData;
  }
  
  // 同期状態を取得
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      pendingOperations: this.syncQueue.length,
      scheduledSaves: this.saveTimers.size,
      lastSaveTime: this.lastSaveTime
    };
  }
  
  // ユーティリティメソッド
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  sanitizePayloadForLog(payload) {
    // ログ用にペイロードをサニタイズ（大きなデータを除去）
    if (typeof payload === 'object' && payload !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(payload)) {
        if (key === 'fileData' && value?.size > 1000) {
          sanitized[key] = `[File: ${value.name}, ${value.size} bytes]`;
        } else if (typeof value === 'string' && value.length > 100) {
          sanitized[key] = value.substring(0, 100) + '...';
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }
    return payload;
  }
  
  countNodes(node) {
    if (!node) return 0;
    let count = 1;
    if (node.children) {
      count += node.children.reduce((sum, child) => sum + this.countNodes(child), 0);
    }
    return count;
  }
  
  // クリーンアップ
  destroy() {
    // タイマーをクリア
    for (const timer of this.saveTimers.values()) {
      clearTimeout(timer);
    }
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
export { DataManager };