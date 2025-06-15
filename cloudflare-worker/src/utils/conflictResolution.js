/**
 * 競合解決アルゴリズム
 * リアルタイム共同編集での競合解決メカニズム
 * 
 * アプローチ:
 * 1. Last Writer Wins (LWW) - タイムスタンプベース
 * 2. Operational Transformation (OT) - 操作変換
 * 3. Conflict-free Replicated Data Type (CRDT) - 一部対応
 */

export class ConflictResolver {
  constructor() {
    this.conflictStrategies = {
      'node_update': this.resolveNodeUpdateConflict.bind(this),
      'node_create': this.resolveNodeCreateConflict.bind(this),
      'node_delete': this.resolveNodeDeleteConflict.bind(this),
      'node_move': this.resolveNodeMoveConflict.bind(this)
    };
  }

  /**
   * 競合解決のメインメソッド
   * @param {Object} operation - 適用しようとする操作
   * @param {Array} conflictingOps - 競合する操作群
   * @param {Object} currentState - 現在の状態
   * @returns {Object} 解決された操作と結果
   */
  resolveConflict(operation, conflictingOps, currentState) {
    const strategy = this.conflictStrategies[operation.type];
    
    if (!strategy) {
      // 未対応の操作タイプの場合はLast Writer Winsを適用
      return this.applyLastWriterWins(operation, conflictingOps);
    }

    try {
      const result = strategy(operation, conflictingOps, currentState);
      
      return {
        success: true,
        resolvedOperation: result.operation,
        resolutionType: result.type,
        metadata: result.metadata || {}
      };
    } catch (error) {
      console.error('Conflict resolution error:', error);
      
      // エラー時はLast Writer Winsにフォールバック
      return this.applyLastWriterWins(operation, conflictingOps);
    }
  }

  /**
   * ノード更新の競合解決
   */
  resolveNodeUpdateConflict(operation, conflictingOps, currentState) {
    const conflicts = conflictingOps.filter(op => 
      op.type === 'node_update' && op.data.nodeId === operation.data.nodeId
    );

    if (conflicts.length === 0) {
      return { operation, type: 'no_conflict' };
    }

    // フィールドレベルでの競合解決
    const mergedUpdates = this.mergeNodeUpdates(operation, conflicts);
    
    return {
      operation: {
        ...operation,
        data: {
          ...operation.data,
          updates: mergedUpdates
        }
      },
      type: 'field_merge',
      metadata: {
        conflictCount: conflicts.length,
        mergedFields: Object.keys(mergedUpdates)
      }
    };
  }

  /**
   * ノード作成の競合解決
   */
  resolveNodeCreateConflict(operation, conflictingOps, currentState) {
    const conflicts = conflictingOps.filter(op => 
      op.type === 'node_create' && 
      (op.data.nodeId === operation.data.nodeId || 
       (op.data.parentId === operation.data.parentId && 
        Math.abs(op.data.position?.x - operation.data.position?.x) < 50 &&
        Math.abs(op.data.position?.y - operation.data.position?.y) < 50))
    );

    if (conflicts.length === 0) {
      return { operation, type: 'no_conflict' };
    }

    // 同じIDの場合は最新のものを採用
    const sameIdConflicts = conflicts.filter(op => op.data.nodeId === operation.data.nodeId);
    if (sameIdConflicts.length > 0) {
      const latestOp = this.getLatestOperation([operation, ...sameIdConflicts]);
      return {
        operation: latestOp,
        type: 'latest_wins',
        metadata: { duplicateIds: sameIdConflicts.length + 1 }
      };
    }

    // 位置の競合の場合は位置を調整
    const adjustedPosition = this.adjustNodePosition(
      operation.data.position, 
      conflicts.map(op => op.data.position)
    );

    return {
      operation: {
        ...operation,
        data: {
          ...operation.data,
          position: adjustedPosition
        }
      },
      type: 'position_adjustment',
      metadata: { adjustedBy: adjustedPosition.adjustmentDistance }
    };
  }

  /**
   * ノード削除の競合解決
   */
  resolveNodeDeleteConflict(operation, conflictingOps, currentState) {
    const nodeId = operation.data.nodeId;
    
    // 同じノードの削除競合
    const deleteConflicts = conflictingOps.filter(op => 
      op.type === 'node_delete' && op.data.nodeId === nodeId
    );

    if (deleteConflicts.length > 0) {
      // 最初の削除操作を優先
      const firstDelete = this.getEarliestOperation([operation, ...deleteConflicts]);
      return {
        operation: firstDelete,
        type: 'first_delete_wins',
        metadata: { duplicateDeletes: deleteConflicts.length + 1 }
      };
    }

    // 削除対象ノードの子ノードに対する操作との競合
    const childOperations = conflictingOps.filter(op => 
      this.isChildOfNode(op.data.nodeId || op.data.parentId, nodeId, currentState)
    );

    if (childOperations.length > 0) {
      // 子ノードの操作がある場合は、子ノードを保持して削除を実行
      return {
        operation: {
          ...operation,
          data: {
            ...operation.data,
            preserveChildren: true
          }
        },
        type: 'preserve_children',
        metadata: { 
          childOperations: childOperations.length,
          preservedChildren: true 
        }
      };
    }

    return { operation, type: 'no_conflict' };
  }

  /**
   * ノード移動の競合解決
   */
  resolveNodeMoveConflict(operation, conflictingOps, currentState) {
    const nodeId = operation.data.nodeId;
    
    const moveConflicts = conflictingOps.filter(op => 
      op.type === 'node_move' && op.data.nodeId === nodeId
    );

    if (moveConflicts.length === 0) {
      return { operation, type: 'no_conflict' };
    }

    // 複数の移動操作がある場合は最新のものを採用
    const latestMove = this.getLatestOperation([operation, ...moveConflicts]);
    
    // ただし、位置の微調整は平均化
    const allMoves = [operation, ...moveConflicts];
    const averagePosition = this.calculateAveragePosition(
      allMoves.map(op => op.data.newPosition).filter(Boolean)
    );

    return {
      operation: {
        ...latestMove,
        data: {
          ...latestMove.data,
          newPosition: averagePosition
        }
      },
      type: 'averaged_position',
      metadata: { 
        operationCount: allMoves.length,
        averagedPosition: true 
      }
    };
  }

  /**
   * ノード更新のマージ
   */
  mergeNodeUpdates(operation, conflicts) {
    const allUpdates = [operation, ...conflicts];
    const mergedUpdates = {};

    // フィールドごとに最新の値を選択
    for (const op of allUpdates) {
      if (op.data.updates) {
        for (const [field, value] of Object.entries(op.data.updates)) {
          if (!mergedUpdates[field] || op.timestamp > mergedUpdates[field].timestamp) {
            mergedUpdates[field] = {
              value: value,
              timestamp: op.timestamp,
              sessionId: op.sessionId
            };
          }
        }
      }
    }

    // 値のみを抽出
    const result = {};
    for (const [field, data] of Object.entries(mergedUpdates)) {
      result[field] = data.value;
    }

    return result;
  }

  /**
   * ノード位置の調整
   */
  adjustNodePosition(targetPosition, conflictingPositions) {
    if (!targetPosition) return { x: 0, y: 0 };

    const minDistance = 100; // 最小距離
    let adjustedPosition = { ...targetPosition };
    let adjustmentDistance = 0;

    for (const conflictPos of conflictingPositions) {
      if (!conflictPos) continue;

      const distance = Math.sqrt(
        Math.pow(adjustedPosition.x - conflictPos.x, 2) + 
        Math.pow(adjustedPosition.y - conflictPos.y, 2)
      );

      if (distance < minDistance) {
        // 競合位置から離す
        const angle = Math.atan2(
          adjustedPosition.y - conflictPos.y,
          adjustedPosition.x - conflictPos.x
        );
        
        adjustedPosition.x = conflictPos.x + Math.cos(angle) * minDistance;
        adjustedPosition.y = conflictPos.y + Math.sin(angle) * minDistance;
        adjustmentDistance = minDistance - distance;
      }
    }

    return {
      ...adjustedPosition,
      adjustmentDistance: adjustmentDistance
    };
  }

  /**
   * 位置の平均化
   */
  calculateAveragePosition(positions) {
    if (positions.length === 0) return { x: 0, y: 0 };

    const sum = positions.reduce(
      (acc, pos) => ({
        x: acc.x + (pos.x || 0),
        y: acc.y + (pos.y || 0)
      }),
      { x: 0, y: 0 }
    );

    return {
      x: Math.round(sum.x / positions.length),
      y: Math.round(sum.y / positions.length)
    };
  }

  /**
   * Last Writer Wins戦略
   */
  applyLastWriterWins(operation, conflictingOps) {
    const latestOp = this.getLatestOperation([operation, ...conflictingOps]);
    
    return {
      success: true,
      resolvedOperation: latestOp,
      resolutionType: 'last_writer_wins',
      metadata: {
        discardedOperations: conflictingOps.length
      }
    };
  }

  /**
   * 最新の操作を取得
   */
  getLatestOperation(operations) {
    return operations.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
  }

  /**
   * 最古の操作を取得
   */
  getEarliestOperation(operations) {
    return operations.reduce((earliest, current) => 
      current.timestamp < earliest.timestamp ? current : earliest
    );
  }

  /**
   * ノードが指定ノードの子かどうか判定
   */
  isChildOfNode(childId, parentId, state) {
    if (!childId || !parentId || !state) return false;

    const findNode = (node, targetId) => {
      if (node.id === targetId) return node;
      
      if (node.children) {
        for (const child of node.children) {
          const found = findNode(child, targetId);
          if (found) return found;
        }
      }
      
      return null;
    };

    const findParent = (node, targetId) => {
      if (node.children) {
        for (const child of node.children) {
          if (child.id === targetId) return node.id;
          
          const parentId = findParent(child, targetId);
          if (parentId) return parentId;
        }
      }
      
      return null;
    };

    const actualParentId = findParent(state, childId);
    return actualParentId === parentId;
  }

  /**
   * 操作の適用可能性チェック
   */
  canApplyOperation(operation, currentState) {
    switch (operation.type) {
      case 'node_update':
        return this.nodeExists(operation.data.nodeId, currentState);
      
      case 'node_create':
        return this.nodeExists(operation.data.parentId, currentState) && 
               !this.nodeExists(operation.data.nodeId, currentState);
      
      case 'node_delete':
        return this.nodeExists(operation.data.nodeId, currentState);
      
      case 'node_move':
        return this.nodeExists(operation.data.nodeId, currentState) &&
               (!operation.data.newParentId || this.nodeExists(operation.data.newParentId, currentState));
      
      default:
        return true;
    }
  }

  /**
   * ノードの存在チェック
   */
  nodeExists(nodeId, state) {
    if (!nodeId || !state) return false;

    const findNode = (node) => {
      if (node.id === nodeId) return true;
      
      if (node.children) {
        return node.children.some(child => findNode(child));
      }
      
      return false;
    };

    return findNode(state);
  }

  /**
   * 競合統計の生成
   */
  generateConflictStats(operations) {
    const stats = {
      totalOperations: operations.length,
      conflictsByType: {},
      conflictsByUser: {},
      resolutionMethods: {},
      timeRange: {
        start: null,
        end: null
      }
    };

    if (operations.length === 0) return stats;

    // 時間範囲の計算
    const timestamps = operations.map(op => op.timestamp).sort();
    stats.timeRange.start = timestamps[0];
    stats.timeRange.end = timestamps[timestamps.length - 1];

    // 統計の集計
    operations.forEach(op => {
      // タイプ別統計
      stats.conflictsByType[op.type] = (stats.conflictsByType[op.type] || 0) + 1;
      
      // ユーザー別統計
      stats.conflictsByUser[op.sessionId] = (stats.conflictsByUser[op.sessionId] || 0) + 1;
    });

    return stats;
  }
}

/**
 * 操作変換（Operational Transformation）ユーティリティ
 */
export class OperationalTransform {
  /**
   * 2つの操作を変換
   * @param {Object} op1 - 操作1
   * @param {Object} op2 - 操作2
   * @returns {Object} 変換された操作ペア
   */
  static transform(op1, op2) {
    if (op1.type === 'node_update' && op2.type === 'node_update') {
      return this.transformNodeUpdates(op1, op2);
    }
    
    if (op1.type === 'node_create' && op2.type === 'node_create') {
      return this.transformNodeCreates(op1, op2);
    }
    
    // その他の組み合わせは変換不要
    return { op1: op1, op2: op2 };
  }

  /**
   * ノード更新操作の変換
   */
  static transformNodeUpdates(op1, op2) {
    if (op1.data.nodeId !== op2.data.nodeId) {
      // 異なるノードなら変換不要
      return { op1: op1, op2: op2 };
    }

    // 同じノードの異なるフィールドなら両方適用
    const fields1 = Object.keys(op1.data.updates || {});
    const fields2 = Object.keys(op2.data.updates || {});
    
    const overlappingFields = fields1.filter(field => fields2.includes(field));
    
    if (overlappingFields.length === 0) {
      // フィールドの重複なし
      return { op1: op1, op2: op2 };
    }

    // 重複フィールドは新しい方を優先
    const transformedOp1 = { ...op1 };
    const transformedOp2 = { ...op2 };

    if (op1.timestamp < op2.timestamp) {
      // op2を優先、op1から重複フィールドを削除
      const filteredUpdates = {};
      for (const [field, value] of Object.entries(op1.data.updates || {})) {
        if (!overlappingFields.includes(field)) {
          filteredUpdates[field] = value;
        }
      }
      transformedOp1.data.updates = filteredUpdates;
    } else {
      // op1を優先、op2から重複フィールドを削除
      const filteredUpdates = {};
      for (const [field, value] of Object.entries(op2.data.updates || {})) {
        if (!overlappingFields.includes(field)) {
          filteredUpdates[field] = value;
        }
      }
      transformedOp2.data.updates = filteredUpdates;
    }

    return { op1: transformedOp1, op2: transformedOp2 };
  }

  /**
   * ノード作成操作の変換
   */
  static transformNodeCreates(op1, op2) {
    if (op1.data.nodeId === op2.data.nodeId) {
      // 同じIDの場合は新しい方のみ
      return op1.timestamp > op2.timestamp 
        ? { op1: op1, op2: null }
        : { op1: null, op2: op2 };
    }

    // 位置が近い場合は調整
    const pos1 = op1.data.position;
    const pos2 = op2.data.position;
    
    if (pos1 && pos2) {
      const distance = Math.sqrt(
        Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
      );
      
      if (distance < 50) {
        // 位置を調整
        const transformedOp2 = { ...op2 };
        transformedOp2.data.position = {
          x: pos2.x + 60,
          y: pos2.y + 30
        };
        return { op1: op1, op2: transformedOp2 };
      }
    }

    return { op1: op1, op2: op2 };
  }
}

export default ConflictResolver;