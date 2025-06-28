/**
 * OperationTransformer - 操作変換エンジン
 * 並行操作の変換によって競合を自動解決
 */
export class OperationTransformer {
  
  /**
   * 2つの並行操作を変換
   * @param {Object} op1 - 第1の操作
   * @param {Object} op2 - 第2の操作
   * @returns {Object} - 変換後の操作 { op1Prime, op2Prime }
   */
  transform(op1, op2) {
    // 同じターゲットに対する操作でない場合は変換不要
    if (!this.areOperationsRelated(op1, op2)) {
      return { op1Prime: op1, op2Prime: op2 };
    }

    const transformKey = `${op1.operation_type}_${op2.operation_type}`;

    switch (transformKey) {
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
        return this.transformUpdateMove(op1, op2);
      case 'move_update':
        return this.transformMoveUpdate(op1, op2);
      case 'create_create':
        return this.transformCreateCreate(op1, op2);
      case 'create_delete':
        return this.transformCreateDelete(op1, op2);
      case 'delete_create':
        return this.transformDeleteCreate(op1, op2);
      default:
        // 変換不要な組み合わせ
        return { op1Prime: op1, op2Prime: op2 };
    }
  }

  /**
   * 操作の関連性判定
   * @param {Object} op1 - 第1の操作
   * @param {Object} op2 - 第2の操作
   * @returns {boolean} - 関連があるかどうか
   */
  areOperationsRelated(op1, op2) {
    // 直接的な関連（同じターゲット）
    if (op1.target_id === op2.target_id) {
      return true;
    }

    // ノード操作の場合の親子関係チェック
    if (op1.target_type === 'node' && op2.target_type === 'node') {
      return this.areNodesRelated(op1, op2);
    }

    return false;
  }

  /**
   * ノード間の関連性チェック
   * @param {Object} op1 - 第1のノード操作
   * @param {Object} op2 - 第2のノード操作
   * @returns {boolean} - 関連があるかどうか
   */
  areNodesRelated(op1, op2) {
    // 親子関係のチェック
    if (op1.data?.parent_id === op2.target_id || op2.data?.parent_id === op1.target_id) {
      return true;
    }

    // 兄弟関係のチェック
    if (op1.data?.parent_id && op2.data?.parent_id && 
        op1.data.parent_id === op2.data.parent_id) {
      return true;
    }

    return false;
  }

  // ===== 具体的な変換処理 =====

  /**
   * Update vs Update の変換
   * @param {Object} op1 - 第1の更新操作
   * @param {Object} op2 - 第2の更新操作
   * @returns {Object} - 変換後の操作
   */
  transformUpdateUpdate(op1, op2) {
    // フィールドレベルでの最後の更新者勝利
    const merged1 = { ...op1 };
    const merged2 = { ...op2 };

    // タイムスタンプとユーザーIDで優先順位決定
    const priority = this.determinePriority(op1, op2);

    if (priority === 'op1') {
      // op1が優先される場合
      merged2.data = this.mergeFieldUpdates(op2.data, op1.data, 'op1_wins');
      merged2.transformNote = `Merged with ${op1.id}`;
    } else {
      // op2が優先される場合
      merged1.data = this.mergeFieldUpdates(op1.data, op2.data, 'op2_wins');
      merged1.transformNote = `Merged with ${op2.id}`;
    }

    return { op1Prime: merged1, op2Prime: merged2 };
  }

  /**
   * Update vs Delete の変換
   * @param {Object} updateOp - 更新操作
   * @param {Object} deleteOp - 削除操作
   * @returns {Object} - 変換後の操作
   */
  transformUpdateDelete(updateOp, deleteOp) {
    // 削除操作が優先される
    return {
      op1Prime: { 
        ...updateOp, 
        operation_type: 'noop',
        transformNote: `Cancelled due to delete operation ${deleteOp.id}`
      },
      op2Prime: deleteOp
    };
  }

  /**
   * Delete vs Update の変換
   * @param {Object} deleteOp - 削除操作
   * @param {Object} updateOp - 更新操作
   * @returns {Object} - 変換後の操作
   */
  transformDeleteUpdate(deleteOp, updateOp) {
    // 削除操作が優先される
    return {
      op1Prime: deleteOp,
      op2Prime: { 
        ...updateOp, 
        operation_type: 'noop',
        transformNote: `Cancelled due to delete operation ${deleteOp.id}`
      }
    };
  }

  /**
   * Delete vs Delete の変換
   * @param {Object} op1 - 第1の削除操作
   * @param {Object} op2 - 第2の削除操作
   * @returns {Object} - 変換後の操作
   */
  transformDeleteDelete(op1, op2) {
    // 早い操作のみ有効
    const priority = this.determinePriority(op1, op2);

    if (priority === 'op1') {
      return {
        op1Prime: op1,
        op2Prime: { 
          ...op2, 
          operation_type: 'noop',
          transformNote: `Already deleted by ${op1.id}`
        }
      };
    } else {
      return {
        op1Prime: { 
          ...op1, 
          operation_type: 'noop',
          transformNote: `Already deleted by ${op2.id}`
        },
        op2Prime: op2
      };
    }
  }

  /**
   * Move vs Move の変換
   * @param {Object} op1 - 第1の移動操作
   * @param {Object} op2 - 第2の移動操作
   * @returns {Object} - 変換後の操作
   */
  transformMoveMove(op1, op2) {
    // 最後の移動操作が勝利
    const priority = this.determinePriority(op1, op2);

    if (priority === 'op1') {
      return {
        op1Prime: op1,
        op2Prime: { 
          ...op2, 
          operation_type: 'noop',
          transformNote: `Overridden by move operation ${op1.id}`
        }
      };
    } else {
      return {
        op1Prime: { 
          ...op1, 
          operation_type: 'noop',
          transformNote: `Overridden by move operation ${op2.id}`
        },
        op2Prime: op2
      };
    }
  }

  /**
   * Update vs Move の変換
   * @param {Object} updateOp - 更新操作
   * @param {Object} moveOp - 移動操作
   * @returns {Object} - 変換後の操作
   */
  transformUpdateMove(updateOp, moveOp) {
    // 両方とも有効（異なる側面の変更）
    return { op1Prime: updateOp, op2Prime: moveOp };
  }

  /**
   * Move vs Update の変換
   * @param {Object} moveOp - 移動操作
   * @param {Object} updateOp - 更新操作
   * @returns {Object} - 変換後の操作
   */
  transformMoveUpdate(moveOp, updateOp) {
    // 両方とも有効（異なる側面の変更）
    return { op1Prime: moveOp, op2Prime: updateOp };
  }

  /**
   * Create vs Create の変換
   * @param {Object} op1 - 第1の作成操作
   * @param {Object} op2 - 第2の作成操作
   * @returns {Object} - 変換後の操作
   */
  transformCreateCreate(op1, op2) {
    // 同じIDでの作成の場合
    if (op1.target_id === op2.target_id) {
      const priority = this.determinePriority(op1, op2);
      
      if (priority === 'op1') {
        return {
          op1Prime: op1,
          op2Prime: { 
            ...op2, 
            operation_type: 'noop',
            transformNote: `Node already created by ${op1.id}`
          }
        };
      } else {
        return {
          op1Prime: { 
            ...op1, 
            operation_type: 'noop',
            transformNote: `Node already created by ${op2.id}`
          },
          op2Prime: op2
        };
      }
    }

    // 異なるIDの場合は両方とも有効
    return { op1Prime: op1, op2Prime: op2 };
  }

  /**
   * Create vs Delete の変換
   * @param {Object} createOp - 作成操作
   * @param {Object} deleteOp - 削除操作
   * @returns {Object} - 変換後の操作
   */
  transformCreateDelete(createOp, deleteOp) {
    // 削除対象が存在しないため、削除操作をキャンセル
    return {
      op1Prime: createOp,
      op2Prime: { 
        ...deleteOp, 
        operation_type: 'noop',
        transformNote: `Node does not exist (being created by ${createOp.id})`
      }
    };
  }

  /**
   * Delete vs Create の変換
   * @param {Object} deleteOp - 削除操作
   * @param {Object} createOp - 作成操作
   * @returns {Object} - 変換後の操作
   */
  transformDeleteCreate(deleteOp, createOp) {
    // 削除後の作成は有効
    return { op1Prime: deleteOp, op2Prime: createOp };
  }

  // ===== ヘルパーメソッド =====

  /**
   * 2つの操作の優先順位を決定
   * @param {Object} op1 - 第1の操作
   * @param {Object} op2 - 第2の操作
   * @returns {string} - 'op1' | 'op2'
   */
  determinePriority(op1, op2) {
    const op1Time = new Date(op1.timestamp).getTime();
    const op2Time = new Date(op2.timestamp).getTime();

    if (op1Time > op2Time) {
      return 'op1';
    } else if (op2Time > op1Time) {
      return 'op2';
    } else {
      // 同じタイムスタンプの場合はユーザーIDの辞書順
      return op1.userId < op2.userId ? 'op1' : 'op2';
    }
  }

  /**
   * フィールドレベルでの更新マージ
   * @param {Object} baseData - ベースデータ
   * @param {Object} winningData - 勝利データ
   * @param {string} winner - 勝者 ('op1_wins' | 'op2_wins')
   * @returns {Object} - マージされたデータ
   */
  mergeFieldUpdates(baseData, winningData, winner) {
    const result = { ...baseData };
    
    // テキスト編集の場合
    if (baseData.text !== undefined && winningData.text !== undefined) {
      if (winner === 'op1_wins') {
        result.text = winningData.text;
      }
      // op2_winsの場合は元のテキストを保持
    }

    // 位置情報の場合
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

    // その他のフィールド
    const fieldsToMerge = ['fontSize', 'fontWeight', 'color', 'collapsed'];
    fieldsToMerge.forEach(field => {
      if (baseData[field] !== undefined && winningData[field] !== undefined) {
        if (winner === 'op1_wins') {
          result[field] = winningData[field];
        }
      }
    });

    return result;
  }

  /**
   * テキスト編集の詳細な変換（将来の拡張用）
   * @param {Object} textOp1 - 第1のテキスト操作
   * @param {Object} textOp2 - 第2のテキスト操作
   * @returns {Object} - 変換されたテキスト操作
   */
  transformTextOperations(textOp1, textOp2) {
    // 簡単なケース：全体テキスト置換
    if (textOp1.type === 'replace' && textOp2.type === 'replace') {
      const priority = this.determinePriority(textOp1, textOp2);
      return priority === 'op1' ? textOp1 : textOp2;
    }

    // 将来的にはより細かい文字レベルの変換を実装
    // 例：挿入位置の調整、削除範囲の調整など
    
    return textOp1; // 現在は簡単な実装
  }

  /**
   * 変換の妥当性検証
   * @param {Object} original1 - 元の操作1
   * @param {Object} original2 - 元の操作2
   * @param {Object} transformed1 - 変換後の操作1
   * @param {Object} transformed2 - 変換後の操作2
   * @returns {boolean} - 変換が妥当かどうか
   */
  validateTransformation(original1, original2, transformed1, transformed2) {
    // 基本的な妥当性チェック
    if (transformed1.id !== original1.id || transformed2.id !== original2.id) {
      return false;
    }

    // noopの場合はデータの整合性をチェックしない
    if (transformed1.operation_type === 'noop' || transformed2.operation_type === 'noop') {
      return true;
    }

    // その他の妥当性チェックは必要に応じて追加
    return true;
  }

  /**
   * 変換ログの生成
   * @param {Object} op1 - 第1の操作
   * @param {Object} op2 - 第2の操作
   * @param {Object} result - 変換結果
   * @returns {Object} - ログエントリ
   */
  createTransformLog(op1, op2, result) {
    return {
      timestamp: new Date().toISOString(),
      transformationType: `${op1.operation_type}_${op2.operation_type}`,
      originalOp1: { id: op1.id, type: op1.operation_type, target: op1.target_id },
      originalOp2: { id: op2.id, type: op2.operation_type, target: op2.target_id },
      transformedOp1: { 
        id: result.op1Prime.id, 
        type: result.op1Prime.operation_type, 
        note: result.op1Prime.transformNote 
      },
      transformedOp2: { 
        id: result.op2Prime.id, 
        type: result.op2Prime.operation_type, 
        note: result.op2Prime.transformNote 
      }
    };
  }
}