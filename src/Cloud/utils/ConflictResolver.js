import { VectorClock } from './VectorClock.js';
import { OperationTransformer } from './OperationTransformer.js';

/**
 * ConflictResolver - 競合解決器
 * ベクタークロックによる競合検出と操作変換による自動解決
 */
export class ConflictResolver {
  constructor(syncStateManager) {
    this.syncStateManager = syncStateManager;
    this.transformer = new OperationTransformer();
    this.operationHistory = new Map(); // mindmapId -> operations[]
    this.pendingConflicts = new Map(); // conflictId -> ConflictData
    this.resolutionStrategies = new Map(); // operationType -> strategy
    this.conflictStats = {
      totalConflicts: 0,
      resolvedConflicts: 0,
      manualResolutions: 0,
      averageResolutionTime: 0
    };

    this.setupDefaultStrategies();
  }

  /**
   * デフォルトの競合解決戦略を設定
   */
  setupDefaultStrategies() {
    this.resolutionStrategies.set('text_edit', 'last_writer_wins');
    this.resolutionStrategies.set('position_move', 'last_writer_wins');
    this.resolutionStrategies.set('node_delete', 'delete_wins');
    this.resolutionStrategies.set('node_create', 'both_valid');
    this.resolutionStrategies.set('property_update', 'field_merge');
  }

  /**
   * 競合検出
   * @param {Object} incomingVectorClock - 受信した操作のベクタークロック
   * @param {Object} localVectorClock - ローカルのベクタークロック
   * @returns {boolean} - 競合があるかどうか
   */
  detectConflict(incomingVectorClock, localVectorClock) {
    const comparison = new VectorClock(localVectorClock).compare(incomingVectorClock);
    return comparison === 'concurrent';
  }

  /**
   * 競合解決のメインロジック
   * @param {Object} incomingOperation - 受信した操作
   * @param {Array} localOperations - ローカルの操作リスト
   * @returns {Object} - 解決結果
   */
  async resolveConflict(incomingOperation, localOperations = []) {
    const conflictStartTime = Date.now();
    this.conflictStats.totalConflicts++;

    try {
      const mindmapId = incomingOperation.mindmap_id;
      
      // 操作履歴から競合する操作を特定
      const history = this.operationHistory.get(mindmapId) || [];
      const conflictingOps = this.findConflictingOperations(incomingOperation, history);

      if (conflictingOps.length === 0) {
        // 競合なし
        this.addToHistory(mindmapId, incomingOperation);
        return {
          resolvedOperation: incomingOperation,
          shouldApply: true,
          conflictInfo: null,
          resolutionTime: Date.now() - conflictStartTime
        };
      }

      // 操作変換を適用
      const resolutionResult = await this.performOperationTransformation(
        incomingOperation, 
        conflictingOps
      );

      // 統計更新
      this.updateConflictStats(conflictStartTime);

      // 操作履歴に追加
      if (resolutionResult.shouldApply) {
        this.addToHistory(mindmapId, resolutionResult.resolvedOperation);
      }

      return resolutionResult;

    } catch (error) {
      console.error('Conflict resolution failed:', error);
      this.syncStateManager.addError(error, 'conflict_resolution');
      
      // エラー時は手動解決キューに追加
      await this.addToManualResolutionQueue(incomingOperation, localOperations, error);
      
      return {
        resolvedOperation: null,
        shouldApply: false,
        conflictInfo: {
          error: error.message,
          requiresManualResolution: true
        },
        resolutionTime: Date.now() - conflictStartTime
      };
    }
  }

  /**
   * 操作変換を実行
   * @param {Object} incomingOperation - 受信した操作
   * @param {Array} conflictingOps - 競合する操作のリスト
   * @returns {Object} - 変換結果
   */
  async performOperationTransformation(incomingOperation, conflictingOps) {
    let resolvedOp = { ...incomingOperation };
    const transformLog = [];
    let hasSignificantConflict = false;

    for (const localOp of conflictingOps) {
      const { op1Prime, op2Prime } = this.transformer.transform(resolvedOp, localOp);
      
      // 変換ログを記録
      const logEntry = this.transformer.createTransformLog(resolvedOp, localOp, {
        op1Prime, op2Prime
      });
      transformLog.push(logEntry);

      // 重要な変更があったかチェック
      if (op1Prime.operation_type === 'noop' || 
          JSON.stringify(op1Prime.data) !== JSON.stringify(resolvedOp.data)) {
        hasSignificantConflict = true;
      }

      resolvedOp = op1Prime;

      // ローカル操作も必要に応じて更新
      if (op2Prime.operation_type !== localOp.operation_type || 
          JSON.stringify(op2Prime.data) !== JSON.stringify(localOp.data)) {
        await this.updateLocalOperation(localOp.id, op2Prime);
      }
    }

    return {
      resolvedOperation: resolvedOp,
      shouldApply: resolvedOp.operation_type !== 'noop',
      conflictInfo: {
        conflictCount: conflictingOps.length,
        transformations: transformLog,
        resolutionStrategy: 'operational_transformation',
        hasSignificantConflict,
        autoResolved: true
      }
    };
  }

  /**
   * 競合する操作を特定
   * @param {Object} incomingOp - 受信した操作
   * @param {Array} history - 操作履歴
   * @returns {Array} - 競合する操作のリスト
   */
  findConflictingOperations(incomingOp, history) {
    const incomingVC = new VectorClock(incomingOp.vector_clock);
    
    return history.filter(historyOp => {
      // 関連する操作のみチェック
      if (!this.transformer.areOperationsRelated(incomingOp, historyOp)) {
        return false;
      }

      // ベクタークロックで並行性チェック
      const historyVC = new VectorClock(historyOp.vector_clock);
      const comparison = incomingVC.compare(historyVC.clock);
      
      return comparison === 'concurrent';
    });
  }

  /**
   * ベクタークロックの統合
   * @param {Object} clock1 - 第1のクロック
   * @param {Object} clock2 - 第2のクロック
   * @returns {Object} - 統合されたクロック
   */
  mergeVectorClocks(clock1, clock2) {
    return VectorClock.merge(clock1, clock2);
  }

  /**
   * 操作履歴に追加
   * @param {string} mindmapId - マインドマップID
   * @param {Object} operation - 操作
   */
  addToHistory(mindmapId, operation) {
    if (!this.operationHistory.has(mindmapId)) {
      this.operationHistory.set(mindmapId, []);
    }
    
    const history = this.operationHistory.get(mindmapId);
    history.push({
      ...operation,
      processedAt: new Date().toISOString()
    });

    // 履歴サイズ制限（最新100操作まで）
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  /**
   * ローカル操作を更新
   * @param {string} operationId - 操作ID
   * @param {Object} updatedOperation - 更新された操作
   */
  async updateLocalOperation(operationId, updatedOperation) {
    // ローカル状態の更新イベントを発行
    const event = new CustomEvent('local_operation_update', {
      detail: { operationId, updatedOperation }
    });
    document.dispatchEvent(event);

    // 操作キューの該当操作も更新
    this.syncStateManager.state.pendingOperations.forEach(op => {
      if (op.id === operationId) {
        Object.assign(op, updatedOperation);
      }
    });
  }

  /**
   * 手動解決キューに追加
   * @param {Object} incomingOperation - 受信した操作
   * @param {Array} localOperations - ローカル操作
   * @param {Error} error - エラー
   */
  async addToManualResolutionQueue(incomingOperation, localOperations, error) {
    const conflictId = `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const conflictData = {
      id: conflictId,
      incomingOperation,
      localOperations,
      error: error.message,
      timestamp: new Date().toISOString(),
      status: 'pending',
      attempts: 0
    };

    this.pendingConflicts.set(conflictId, conflictData);
    
    // UI通知
    this.syncStateManager.notifyListeners('manual_resolution_required', conflictData);
  }

  /**
   * 手動競合解決
   * @param {string} conflictId - 競合ID
   * @param {Object} userChoice - ユーザーの選択
   * @returns {Object} - 解決結果
   */
  async resolveManually(conflictId, userChoice) {
    const conflict = this.pendingConflicts.get(conflictId);
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    this.conflictStats.manualResolutions++;

    let resolvedOperation;
    switch (userChoice.strategy) {
      case 'accept_local':
        resolvedOperation = this.selectLocalOperation(conflict, userChoice.operationId);
        break;
      case 'accept_remote':
        resolvedOperation = conflict.incomingOperation;
        break;
      case 'merge_custom':
        resolvedOperation = this.createCustomMerge(conflict, userChoice.mergedData);
        break;
      case 'reject_all':
        resolvedOperation = null;
        break;
      default:
        throw new Error('Invalid resolution strategy');
    }

    // 解決済み操作を適用
    if (resolvedOperation) {
      await this.applyResolvedOperation(resolvedOperation);
      this.addToHistory(conflict.incomingOperation.mindmap_id, resolvedOperation);
    }

    // 競合を完了マーク
    conflict.status = 'resolved';
    conflict.resolvedAt = new Date().toISOString();
    conflict.resolutionStrategy = userChoice.strategy;

    this.pendingConflicts.delete(conflictId);

    return {
      resolvedOperation,
      resolutionStrategy: userChoice.strategy,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * ローカル操作を選択
   * @param {Object} conflict - 競合データ
   * @param {string} operationId - 選択された操作ID
   * @returns {Object} - 選択された操作
   */
  selectLocalOperation(conflict, operationId) {
    return conflict.localOperations.find(op => op.id === operationId) || null;
  }

  /**
   * カスタムマージを作成
   * @param {Object} conflict - 競合データ
   * @param {Object} mergedData - マージされたデータ
   * @returns {Object} - カスタムマージ操作
   */
  createCustomMerge(conflict, mergedData) {
    return {
      ...conflict.incomingOperation,
      data: mergedData,
      id: `merged_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operation_type: 'update',
      timestamp: new Date().toISOString(),
      mergedFrom: {
        remote: conflict.incomingOperation.id,
        local: conflict.localOperations.map(op => op.id)
      }
    };
  }

  /**
   * 解決済み操作を適用
   * @param {Object} operation - 操作
   */
  async applyResolvedOperation(operation) {
    const event = new CustomEvent('apply_resolved_operation', {
      detail: operation
    });
    document.dispatchEvent(event);
  }

  /**
   * 競合統計を更新
   * @param {number} startTime - 開始時刻
   */
  updateConflictStats(startTime) {
    this.conflictStats.resolvedConflicts++;
    const resolutionTime = Date.now() - startTime;
    
    // 平均解決時間を更新
    const totalResolutions = this.conflictStats.resolvedConflicts;
    const currentAvg = this.conflictStats.averageResolutionTime;
    this.conflictStats.averageResolutionTime = 
      (currentAvg * (totalResolutions - 1) + resolutionTime) / totalResolutions;
  }

  /**
   * 競合統計の取得
   * @param {string} mindmapId - マインドマップID
   * @returns {Object} - 統計データ
   */
  getConflictStats(mindmapId) {
    const history = this.operationHistory.get(mindmapId) || [];
    const conflicts = history.filter(op => op.conflictInfo?.conflictCount > 0);
    
    return {
      ...this.conflictStats,
      mindmapSpecific: {
        totalOperations: history.length,
        conflictOperations: conflicts.length,
        conflictRate: conflicts.length / Math.max(history.length, 1),
        lastConflict: conflicts.length > 0 ? 
          conflicts[conflicts.length - 1].timestamp : null
      },
      pendingManualResolutions: this.pendingConflicts.size
    };
  }

  /**
   * 競合解決戦略を設定
   * @param {string} operationType - 操作タイプ
   * @param {string} strategy - 戦略
   */
  setResolutionStrategy(operationType, strategy) {
    this.resolutionStrategies.set(operationType, strategy);
  }

  /**
   * 競合解決戦略を取得
   * @param {string} operationType - 操作タイプ
   * @returns {string} - 戦略
   */
  getResolutionStrategy(operationType) {
    return this.resolutionStrategies.get(operationType) || 'last_writer_wins';
  }

  /**
   * 操作履歴をクリア
   * @param {string} mindmapId - マインドマップID
   */
  clearHistory(mindmapId) {
    if (mindmapId) {
      this.operationHistory.delete(mindmapId);
    } else {
      this.operationHistory.clear();
    }
  }

  /**
   * ペンディング競合を取得
   * @returns {Array} - ペンディング競合のリスト
   */
  getPendingConflicts() {
    return Array.from(this.pendingConflicts.values());
  }

  /**
   * 競合の詳細分析
   * @param {Object} operation1 - 第1の操作
   * @param {Object} operation2 - 第2の操作
   * @returns {Object} - 分析結果
   */
  analyzeConflict(operation1, operation2) {
    const analysis = {
      conflictType: `${operation1.operation_type}_${operation2.operation_type}`,
      severity: 'low',
      fields: [],
      recommendation: 'auto_resolve'
    };

    // データの比較
    if (operation1.data && operation2.data) {
      for (const field of Object.keys(operation1.data)) {
        if (operation2.data[field] !== undefined && 
            operation1.data[field] !== operation2.data[field]) {
          analysis.fields.push({
            field,
            value1: operation1.data[field],
            value2: operation2.data[field]
          });
        }
      }
    }

    // 重要度評価
    if (analysis.fields.some(f => f.field === 'text')) {
      analysis.severity = 'high';
      analysis.recommendation = 'manual_review';
    } else if (analysis.fields.length > 3) {
      analysis.severity = 'medium';
    }

    return analysis;
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    this.operationHistory.clear();
    this.pendingConflicts.clear();
    this.resolutionStrategies.clear();
  }
}