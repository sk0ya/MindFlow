// MindFlow Conflict Resolution Algorithm
// 操作ベース変換(OT)とラスト・ライター・ウィンズ(LWW)の組み合わせによる競合解決

// ===== ベクタークロック実装 =====
class VectorClock {
  constructor(clock = {}) {
    this.clock = { ...clock };
  }

  increment(userId) {
    this.clock[`user_${userId}`] = (this.clock[`user_${userId}`] || 0) + 1;
    return this;
  }

  update(otherClock) {
    for (const [userId, timestamp] of Object.entries(otherClock)) {
      this.clock[userId] = Math.max(this.clock[userId] || 0, timestamp);
    }
    return this;
  }

  compare(otherClock) {
    const thisKeys = new Set(Object.keys(this.clock));
    const otherKeys = new Set(Object.keys(otherClock));
    const allKeys = new Set([...thisKeys, ...otherKeys]);

    let isLess = false;
    let isGreater = false;

    for (const key of allKeys) {
      const thisVal = this.clock[key] || 0;
      const otherVal = otherClock[key] || 0;

      if (thisVal < otherVal) isLess = true;
      if (thisVal > otherVal) isGreater = true;
    }

    if (isLess && isGreater) return 'concurrent';
    if (isLess) return 'before';
    if (isGreater) return 'after';
    return 'equal';
  }

  clone() {
    return new VectorClock(this.clock);
  }
}

// ===== 操作変換エンジン =====
class OperationTransformer {
  
  // 2つの並行操作を変換
  transform(op1, op2) {
    // 同じターゲットに対する操作の場合のみ変換が必要
    if (op1.target_id !== op2.target_id) {
      return { op1Prime: op1, op2Prime: op2 };
    }

    switch (`${op1.operation_type}_${op2.operation_type}`) {
      case 'update_update':
        return this.transformUpdateUpdate(op1, op2);
      case 'update_delete':
        return this.transformUpdateDelete(op1, op2);
      case 'delete_update':
        return this.transformDeleteUpdate(op1, op2);
      case 'delete_delete':
        return this.transformDeleteDelete(op1, op2);
      case 'move_move':
        return this.transformMoveMove(op1, op2);
      case 'update_move':
      case 'move_update':
        return this.transformUpdateMove(op1, op2);
      default:
        // 変換不要な組み合わせ
        return { op1Prime: op1, op2Prime: op2 };
    }
  }

  // Update vs Update の変換
  transformUpdateUpdate(op1, op2) {
    // フィールドレベルでの最後の更新者勝利
    const merged1 = { ...op1 };
    const merged2 = { ...op2 };

    // タイムスタンプ比較で優先順位決定
    const op1Time = new Date(op1.timestamp).getTime();
    const op2Time = new Date(op2.timestamp).getTime();

    if (op1Time > op2Time) {
      // op1が新しい場合、op1の変更を優先
      merged2.data = this.mergeFieldUpdates(op2.data, op1.data, 'op1_wins');
    } else if (op2Time > op1Time) {
      // op2が新しい場合、op2の変更を優先
      merged1.data = this.mergeFieldUpdates(op1.data, op2.data, 'op2_wins');
    } else {
      // 同時刻の場合、ユーザーIDの辞書順で決定
      const priorityUser = op1.user_id < op2.user_id ? 'op1' : 'op2';
      if (priorityUser === 'op1') {
        merged2.data = this.mergeFieldUpdates(op2.data, op1.data, 'op1_wins');
      } else {
        merged1.data = this.mergeFieldUpdates(op1.data, op2.data, 'op2_wins');
      }
    }

    return { op1Prime: merged1, op2Prime: merged2 };
  }

  mergeFieldUpdates(baseData, winningData, winner) {
    const result = { ...baseData };
    
    // テキスト編集の場合は特別処理
    if (baseData.text !== undefined && winningData.text !== undefined) {
      if (winner === 'op1_wins') {
        result.text = winningData.text;
      }
      // op2_winsの場合は元のテキストを保持
    }

    // 位置情報の場合は平均を取る
    if (baseData.x !== undefined && winningData.x !== undefined) {
      if (winner === 'op1_wins') {
        result.x = winningData.x;
      }
    }

    if (baseData.y !== undefined && winningData.y !== undefined) {
      if (winner === 'op1_wins') {
        result.y = winningData.y;
      }
    }

    return result;
  }

  // Update vs Delete の変換
  transformUpdateDelete(updateOp, deleteOp) {
    // 削除操作が優先される
    return {
      op1Prime: { ...updateOp, operation_type: 'noop' }, // 更新をキャンセル
      op2Prime: deleteOp
    };
  }

  transformDeleteUpdate(deleteOp, updateOp) {
    // 削除操作が優先される
    return {
      op1Prime: deleteOp,
      op2Prime: { ...updateOp, operation_type: 'noop' } // 更新をキャンセル
    };
  }

  // Delete vs Delete の変換
  transformDeleteDelete(op1, op2) {
    // 重複削除は最初の操作のみ有効
    const op1Time = new Date(op1.timestamp).getTime();
    const op2Time = new Date(op2.timestamp).getTime();

    if (op1Time <= op2Time) {
      return {
        op1Prime: op1,
        op2Prime: { ...op2, operation_type: 'noop' }
      };
    } else {
      return {
        op1Prime: { ...op1, operation_type: 'noop' },
        op2Prime: op2
      };
    }
  }

  // Move vs Move の変換
  transformMoveMove(op1, op2) {
    // 最後の移動操作が勝利
    const op1Time = new Date(op1.timestamp).getTime();
    const op2Time = new Date(op2.timestamp).getTime();

    if (op1Time > op2Time) {
      return {
        op1Prime: op1,
        op2Prime: { ...op2, operation_type: 'noop' }
      };
    } else if (op2Time > op1Time) {
      return {
        op1Prime: { ...op1, operation_type: 'noop' },
        op2Prime: op2
      };
    } else {
      // 同時刻の場合はユーザーID順
      const priorityUser = op1.user_id < op2.user_id ? 'op1' : 'op2';
      if (priorityUser === 'op1') {
        return {
          op1Prime: op1,
          op2Prime: { ...op2, operation_type: 'noop' }
        };
      } else {
        return {
          op1Prime: { ...op1, operation_type: 'noop' },
          op2Prime: op2
        };
      }
    }
  }

  // Update vs Move の変換
  transformUpdateMove(op1, op2) {
    // 両方とも有効（異なる側面の変更）
    return { op1Prime: op1, op2Prime: op2 };
  }
}

// ===== 競合解決器 =====
class ConflictResolver {
  constructor() {
    this.transformer = new OperationTransformer();
    this.operationHistory = new Map(); // mindmapId -> operations[]
  }

  // 競合検出
  detectConflict(incomingVectorClock, localVectorClock) {
    const comparison = new VectorClock(localVectorClock).compare(incomingVectorClock);
    return comparison === 'concurrent';
  }

  // 競合解決のメインロジック
  async resolveConflict(incomingOperation, localOperations = []) {
    const mindmapId = incomingOperation.mindmap_id;
    
    // 操作履歴から関連する操作を取得
    const history = this.operationHistory.get(mindmapId) || [];
    const conflictingOps = this.findConflictingOperations(incomingOperation, history);

    if (conflictingOps.length === 0) {
      // 競合なし、そのまま適用
      return {
        resolvedOperation: incomingOperation,
        shouldApply: true,
        conflictInfo: null
      };
    }

    // 操作変換を適用
    let resolvedOp = { ...incomingOperation };
    const transformLog = [];

    for (const localOp of conflictingOps) {
      const { op1Prime, op2Prime } = this.transformer.transform(resolvedOp, localOp);
      
      transformLog.push({
        originalIncoming: resolvedOp,
        originalLocal: localOp,
        transformedIncoming: op1Prime,
        transformedLocal: op2Prime,
        timestamp: new Date().toISOString()
      });

      resolvedOp = op1Prime;

      // ローカル操作も必要に応じて更新
      if (op2Prime.operation_type !== localOp.operation_type) {
        await this.updateLocalOperation(localOp.id, op2Prime);
      }
    }

    // 操作履歴に追加
    this.addToHistory(mindmapId, resolvedOp);

    return {
      resolvedOperation: resolvedOp,
      shouldApply: resolvedOp.operation_type !== 'noop',
      conflictInfo: {
        conflictCount: conflictingOps.length,
        transformations: transformLog,
        resolutionStrategy: 'operational_transformation'
      }
    };
  }

  // 競合する操作を特定
  findConflictingOperations(incomingOp, history) {
    const incomingVC = new VectorClock(incomingOp.vector_clock);
    
    return history.filter(historyOp => {
      // 同じターゲットまたは関連するターゲット
      if (!this.areOperationsRelated(incomingOp, historyOp)) {
        return false;
      }

      // ベクタークロックで並行性チェック
      const historyVC = new VectorClock(historyOp.vector_clock);
      return incomingVC.compare(historyVC.clock) === 'concurrent';
    });
  }

  // 操作の関連性判定
  areOperationsRelated(op1, op2) {
    // 直接的な関連
    if (op1.target_id === op2.target_id) {
      return true;
    }

    // 親子関係の確認（ノード操作の場合）
    if (op1.target_type === 'node' && op2.target_type === 'node') {
      return this.areNodesRelated(op1.target_id, op2.target_id, op1.mindmap_id);
    }

    return false;
  }

  // ノード間の関連性チェック
  areNodesRelated(nodeId1, nodeId2, mindmapId) {
    // 実装では実際のノード階層を確認
    // 簡略化版では直接の関連のみチェック
    return nodeId1 === nodeId2;
  }

  // ベクタークロックの統合
  mergeVectorClocks(clock1, clock2) {
    const merged = new VectorClock(clock1);
    merged.update(clock2);
    return merged.clock;
  }

  // 操作履歴管理
  addToHistory(mindmapId, operation) {
    if (!this.operationHistory.has(mindmapId)) {
      this.operationHistory.set(mindmapId, []);
    }
    
    const history = this.operationHistory.get(mindmapId);
    history.push(operation);

    // 履歴サイズ制限（最新100操作まで）
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  async updateLocalOperation(operationId, updatedOperation) {
    // ローカルストレージまたは状態管理の更新
    const event = new CustomEvent('local_operation_update', {
      detail: { operationId, updatedOperation }
    });
    document.dispatchEvent(event);
  }

  // 競合統計の取得
  getConflictStats(mindmapId) {
    const history = this.operationHistory.get(mindmapId) || [];
    const conflicts = history.filter(op => op.conflictInfo);
    
    return {
      totalOperations: history.length,
      conflictCount: conflicts.length,
      conflictRate: conflicts.length / Math.max(history.length, 1),
      lastConflict: conflicts.length > 0 ? conflicts[conflicts.length - 1].timestamp : null
    };
  }

  // 手動競合解決（ユーザー介入）
  async resolveManually(conflictId, userChoice) {
    const conflict = this.pendingConflicts.get(conflictId);
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    let resolvedOperation;
    switch (userChoice.strategy) {
      case 'accept_local':
        resolvedOperation = conflict.localOperation;
        break;
      case 'accept_remote':
        resolvedOperation = conflict.remoteOperation;
        break;
      case 'merge_custom':
        resolvedOperation = userChoice.mergedOperation;
        break;
      default:
        throw new Error('Invalid resolution strategy');
    }

    // 解決済み操作を適用
    await this.applyResolvedOperation(resolvedOperation);
    this.pendingConflicts.delete(conflictId);

    return {
      resolvedOperation,
      resolutionStrategy: userChoice.strategy,
      timestamp: new Date().toISOString()
    };
  }

  async applyResolvedOperation(operation) {
    const event = new CustomEvent('apply_resolved_operation', {
      detail: operation
    });
    document.dispatchEvent(event);
  }
}

// ===== テキスト編集の詳細な競合解決 =====
class TextOperationTransformer {
  
  // 文字レベルでの操作変換
  transformTextOperations(op1, op2) {
    if (op1.data.textOp && op2.data.textOp) {
      return this.transformTextDeltas(op1.data.textOp, op2.data.textOp);
    }
    
    // 簡単なケース：全体テキスト置換
    const op1Time = new Date(op1.timestamp).getTime();
    const op2Time = new Date(op2.timestamp).getTime();
    
    if (op1Time > op2Time) {
      return { text: op1.data.text };
    } else {
      return { text: op2.data.text };
    }
  }

  // Delta形式のテキスト変更変換
  transformTextDeltas(delta1, delta2) {
    // 実装では Quill Delta や similar library を使用
    // 簡略化版では基本的な変換のみ
    
    const result = {
      retain: Math.max(delta1.retain || 0, delta2.retain || 0),
      insert: (delta1.insert || '') + (delta2.insert || ''),
      delete: Math.max(delta1.delete || 0, delta2.delete || 0)
    };

    return result;
  }
}

export { 
  ConflictResolver, 
  VectorClock, 
  OperationTransformer, 
  TextOperationTransformer 
};