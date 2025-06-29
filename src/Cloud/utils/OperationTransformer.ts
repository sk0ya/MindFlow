/**
 * OperationTransformer - 操作変換エンジン
 * 並行操作の変換によって競合を自動解決
 */

// ===== Type Definitions =====

/**
 * 操作の種類を定義
 */
export type OperationType = 
  | 'create'
  | 'update' 
  | 'delete'
  | 'move'
  | 'noop';

/**
 * ターゲットの種類を定義
 */
export type TargetType = 
  | 'node'
  | 'mindmap'
  | 'attachment'
  | 'link';

/**
 * 優先順位の決定結果
 */
export type Priority = 'op1' | 'op2';

/**
 * マージの勝者を表す
 */
export type MergeWinner = 'op1_wins' | 'op2_wins';

/**
 * ノードデータの構造
 */
export interface NodeData {
  id?: string;
  text?: string;
  x?: number;
  y?: number;
  parent_id?: string | null;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  collapsed?: boolean;
  children?: string[];
  [key: string]: any;
}

/**
 * 位置情報
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * 基本操作の構造
 */
export interface BaseOperation {
  id: string;
  operation_type: OperationType;
  target_type: TargetType;
  target_id: string;
  timestamp: string | Date;
  userId: string;
  data?: NodeData | any;
  transformNote?: string;
  mindmap_id?: string;
}

/**
 * 作成操作
 */
export interface CreateOperation extends BaseOperation {
  operation_type: 'create';
  data: NodeData;
}

/**
 * 更新操作
 */
export interface UpdateOperation extends BaseOperation {
  operation_type: 'update';
  data: Partial<NodeData>;
}

/**
 * 削除操作
 */
export interface DeleteOperation extends BaseOperation {
  operation_type: 'delete';
}

/**
 * 移動操作
 */
export interface MoveOperation extends BaseOperation {
  operation_type: 'move';
  data: {
    parent_id?: string | null;
    x?: number;
    y?: number;
    [key: string]: any;
  };
}

/**
 * 無効化操作
 */
export interface NoopOperation extends BaseOperation {
  operation_type: 'noop';
  transformNote: string;
}

/**
 * すべての操作の統合型
 */
export type Operation = 
  | CreateOperation
  | UpdateOperation
  | DeleteOperation
  | MoveOperation
  | NoopOperation;

/**
 * 変換結果
 */
export interface TransformResult {
  op1Prime: Operation;
  op2Prime: Operation;
}

/**
 * テキスト操作の種類
 */
export type TextOperationType = 'replace' | 'insert' | 'delete' | 'retain';

/**
 * テキスト操作
 */
export interface TextOperation {
  type: TextOperationType;
  content?: string;
  position?: number;
  length?: number;
  timestamp?: string | Date;
  userId?: string;
}

/**
 * 変換ログエントリ
 */
export interface TransformLogEntry {
  timestamp: string;
  transformationType: string;
  originalOp1: {
    id: string;
    type: OperationType;
    target: string;
  };
  originalOp2: {
    id: string;
    type: OperationType;
    target: string;
  };
  transformedOp1: {
    id: string;
    type: OperationType;
    note?: string;
  };
  transformedOp2: {
    id: string;
    type: OperationType;
    note?: string;
  };
}

/**
 * 検証結果
 */
export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
}

/**
 * ドキュメント状態
 */
export interface DocumentState {
  nodes: Map<string, NodeData>;
  version: number;
  lastModified: Date;
}

/**
 * 操作変換の設定
 */
export interface TransformConfig {
  enableFieldMerging: boolean;
  enableTextOperations: boolean;
  maxRetries: number;
  validateResults: boolean;
}

// ===== OperationTransformer Class =====

export class OperationTransformer {
  
  // private readonly config: TransformConfig; // Reserved for future configuration

  constructor(_config: Partial<TransformConfig> = {}) {
    // Configuration setup reserved for future use
    // this.config = {
    //   enableFieldMerging: true,
    //   enableTextOperations: true,
    //   maxRetries: 3,
    //   validateResults: true,
    //   ...config
    // };
  }

  /**
   * 2つの並行操作を変換
   * @param op1 - 第1の操作
   * @param op2 - 第2の操作
   * @returns 変換後の操作 { op1Prime, op2Prime }
   */
  public transform(op1: Operation, op2: Operation): TransformResult {
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
   * @param op1 - 第1の操作
   * @param op2 - 第2の操作
   * @returns 関連があるかどうか
   */
  private areOperationsRelated(op1: Operation, op2: Operation): boolean {
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
   * @param op1 - 第1のノード操作
   * @param op2 - 第2のノード操作
   * @returns 関連があるかどうか
   */
  private areNodesRelated(op1: Operation, op2: Operation): boolean {
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
   * @param op1 - 第1の更新操作
   * @param op2 - 第2の更新操作
   * @returns 変換後の操作
   */
  private transformUpdateUpdate(op1: UpdateOperation, op2: UpdateOperation): TransformResult {
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
   * @param updateOp - 更新操作
   * @param deleteOp - 削除操作
   * @returns 変換後の操作
   */
  private transformUpdateDelete(updateOp: UpdateOperation, deleteOp: DeleteOperation): TransformResult {
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
   * @param deleteOp - 削除操作
   * @param updateOp - 更新操作
   * @returns 変換後の操作
   */
  private transformDeleteUpdate(deleteOp: DeleteOperation, updateOp: UpdateOperation): TransformResult {
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
   * @param op1 - 第1の削除操作
   * @param op2 - 第2の削除操作
   * @returns 変換後の操作
   */
  private transformDeleteDelete(op1: DeleteOperation, op2: DeleteOperation): TransformResult {
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
   * @param op1 - 第1の移動操作
   * @param op2 - 第2の移動操作
   * @returns 変換後の操作
   */
  private transformMoveMove(op1: MoveOperation, op2: MoveOperation): TransformResult {
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
   * @param updateOp - 更新操作
   * @param moveOp - 移動操作
   * @returns 変換後の操作
   */
  private transformUpdateMove(updateOp: UpdateOperation, moveOp: MoveOperation): TransformResult {
    // 両方とも有効（異なる側面の変更）
    return { op1Prime: updateOp, op2Prime: moveOp };
  }

  /**
   * Move vs Update の変換
   * @param moveOp - 移動操作
   * @param updateOp - 更新操作
   * @returns 変換後の操作
   */
  private transformMoveUpdate(moveOp: MoveOperation, updateOp: UpdateOperation): TransformResult {
    // 両方とも有効（異なる側面の変更）
    return { op1Prime: moveOp, op2Prime: updateOp };
  }

  /**
   * Create vs Create の変換
   * @param op1 - 第1の作成操作
   * @param op2 - 第2の作成操作
   * @returns 変換後の操作
   */
  private transformCreateCreate(op1: CreateOperation, op2: CreateOperation): TransformResult {
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
   * @param createOp - 作成操作
   * @param deleteOp - 削除操作
   * @returns 変換後の操作
   */
  private transformCreateDelete(createOp: CreateOperation, deleteOp: DeleteOperation): TransformResult {
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
   * @param deleteOp - 削除操作
   * @param createOp - 作成操作
   * @returns 変換後の操作
   */
  private transformDeleteCreate(deleteOp: DeleteOperation, createOp: CreateOperation): TransformResult {
    // 削除後の作成は有効
    return { op1Prime: deleteOp, op2Prime: createOp };
  }

  // ===== ヘルパーメソッド =====

  /**
   * 2つの操作の優先順位を決定
   * @param op1 - 第1の操作
   * @param op2 - 第2の操作
   * @returns 'op1' | 'op2'
   */
  private determinePriority(op1: Operation, op2: Operation): Priority {
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
   * @param baseData - ベースデータ
   * @param winningData - 勝利データ
   * @param winner - 勝者
   * @returns マージされたデータ
   */
  private mergeFieldUpdates(baseData: NodeData, winningData: NodeData, winner: MergeWinner): NodeData {
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
   * @param textOp1 - 第1のテキスト操作
   * @param textOp2 - 第2のテキスト操作
   * @returns 変換されたテキスト操作
   */
  public transformTextOperations(textOp1: TextOperation, textOp2: TextOperation): TextOperation {
    // 簡単なケース：全体テキスト置換
    if (textOp1.type === 'replace' && textOp2.type === 'replace') {
      const priority = this.determinePriority(textOp1 as any, textOp2 as any);
      return priority === 'op1' ? textOp1 : textOp2;
    }

    // 将来的にはより細かい文字レベルの変換を実装
    // 例：挿入位置の調整、削除範囲の調整など
    
    return textOp1; // 現在は簡単な実装
  }

  /**
   * 変換の妥当性検証
   * @param original1 - 元の操作1
   * @param original2 - 元の操作2
   * @param transformed1 - 変換後の操作1
   * @param transformed2 - 変換後の操作2
   * @returns 変換が妥当かどうか
   */
  public validateTransformation(
    original1: Operation, 
    original2: Operation, 
    transformed1: Operation, 
    transformed2: Operation
  ): boolean {
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
   * @param op1 - 第1の操作
   * @param op2 - 第2の操作
   * @param result - 変換結果
   * @returns ログエントリ
   */
  public createTransformLog(op1: Operation, op2: Operation, result: TransformResult): TransformLogEntry {
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

  // ===== Batch Operation Handling =====

  /**
   * 複数の操作を一括変換
   * @param operations - 変換対象の操作配列
   * @returns 変換後の操作配列
   */
  public transformBatch(operations: Operation[]): Operation[] {
    if (operations.length <= 1) {
      return operations;
    }

    // 操作をタイムスタンプ順にソート
    const sortedOps = [...operations].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    });

    const transformedOps: Operation[] = [];
    
    for (let i = 0; i < sortedOps.length; i++) {
      let currentOp = sortedOps[i];
      
      // 既に変換された操作との競合をチェック
      for (let j = 0; j < transformedOps.length; j++) {
        const transformedOp = transformedOps[j];
        if (currentOp && transformedOp && this.areOperationsRelated(currentOp, transformedOp)) {
          const result = this.transform(currentOp, transformedOp);
          currentOp = result.op1Prime || currentOp;
          transformedOps[j] = result.op2Prime || transformedOp;
        }
      }
      
      if (currentOp) {
        transformedOps.push(currentOp);
      }
    }

    return transformedOps.filter(op => op.operation_type !== 'noop');
  }

  /**
   * 操作の依存関係を解析
   * @param operations - 解析対象の操作配列
   * @returns 依存関係マップ
   */
  public analyzeDependencies(operations: Operation[]): Map<string, string[]> {
    const dependencies = new Map<string, string[]>();
    
    for (const op of operations) {
      dependencies.set(op.id, []);
      
      for (const otherOp of operations) {
        if (op.id !== otherOp.id && this.areOperationsRelated(op, otherOp)) {
          const deps = dependencies.get(op.id) || [];
          deps.push(otherOp.id);
          dependencies.set(op.id, deps);
        }
      }
    }
    
    return dependencies;
  }

  // ===== Position Tracking and Calculations =====

  /**
   * 位置座標の競合を検出
   * @param pos1 - 第1の位置
   * @param pos2 - 第2の位置
   * @param threshold - 競合判定の閾値
   * @returns 競合があるかどうか
   */
  public detectPositionConflict(pos1: Position, pos2: Position, threshold: number = 50): boolean {
    const distance = Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
    return distance < threshold;
  }

  /**
   * 位置競合の解決
   * @param op1 - 第1の移動操作
   * @param op2 - 第2の移動操作
   * @returns 競合解決後の位置
   */
  public resolvePositionConflict(op1: MoveOperation, op2: MoveOperation): { pos1: Position; pos2: Position } {
    const pos1 = { x: op1.data.x || 0, y: op1.data.y || 0 };
    const pos2 = { x: op2.data.x || 0, y: op2.data.y || 0 };
    
    if (!this.detectPositionConflict(pos1, pos2)) {
      return { pos1, pos2 };
    }

    // 競合がある場合、後の操作を少しずらす
    const priority = this.determinePriority(op1, op2);
    if (priority === 'op1') {
      pos2.x += 60; // 右にずらす
    } else {
      pos1.x += 60; // 右にずらす
    }

    return { pos1, pos2 };
  }

  /**
   * ノードの座標を正規化
   * @param position - 正規化する座標
   * @param bounds - 境界情報
   * @returns 正規化された座標
   */
  public normalizePosition(position: Position, bounds: { width: number; height: number }): Position {
    return {
      x: Math.max(0, Math.min(position.x, bounds.width)),
      y: Math.max(0, Math.min(position.y, bounds.height))
    };
  }

  // ===== Document State Management =====

  /**
   * ドキュメント状態への操作の適用
   * @param state - 現在のドキュメント状態
   * @param operation - 適用する操作
   * @returns 新しいドキュメント状態
   */
  public applyOperationToState(state: DocumentState, operation: Operation): DocumentState {
    const newState: DocumentState = {
      nodes: new Map(state.nodes),
      version: state.version + 1,
      lastModified: new Date()
    };

    switch (operation.operation_type) {
      case 'create':
        if (operation.data) {
          newState.nodes.set(operation.target_id, operation.data as NodeData);
        }
        break;
        
      case 'update':
        const existingNode = newState.nodes.get(operation.target_id);
        if (existingNode && operation.data) {
          newState.nodes.set(operation.target_id, { ...existingNode, ...operation.data });
        }
        break;
        
      case 'delete':
        newState.nodes.delete(operation.target_id);
        break;
        
      case 'move':
        const nodeToMove = newState.nodes.get(operation.target_id);
        if (nodeToMove && operation.data) {
          newState.nodes.set(operation.target_id, { ...nodeToMove, ...operation.data });
        }
        break;
        
      case 'noop':
        // 何もしない
        break;
    }

    return newState;
  }

  /**
   * ドキュメント状態の整合性チェック
   * @param state - チェック対象の状態
   * @returns 検証結果
   */
  public validateDocumentState(state: DocumentState): ValidationResult {
    const errors: string[] = [];
    
    // 親子関係の整合性チェック
    for (const [nodeId, nodeData] of state.nodes) {
      if (nodeData.parent_id && !state.nodes.has(nodeData.parent_id)) {
        errors.push(`Node ${nodeId} has invalid parent_id: ${nodeData.parent_id}`);
      }
      
      if (nodeData.children) {
        for (const childId of nodeData.children) {
          if (!state.nodes.has(childId)) {
            errors.push(`Node ${nodeId} references non-existent child: ${childId}`);
          }
        }
      }
    }
    
    // 重複IDチェック
    const ids = Array.from(state.nodes.keys());
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      errors.push('Duplicate node IDs detected');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * ドキュメント状態のマージ
   * @param state1 - 第1の状態
   * @param state2 - 第2の状態
   * @returns マージされた状態
   */
  public mergeDocumentStates(state1: DocumentState, state2: DocumentState): DocumentState {
    const mergedNodes = new Map<string, NodeData>();
    
    // state1のノードを追加
    for (const [id, node] of state1.nodes) {
      mergedNodes.set(id, { ...node });
    }
    
    // state2のノードを追加/マージ
    for (const [id, node] of state2.nodes) {
      const existing = mergedNodes.get(id);
      if (existing) {
        // 最新のタイムスタンプを基準にマージ
        const merged = this.mergeNodeData(existing, node);
        mergedNodes.set(id, merged);
      } else {
        mergedNodes.set(id, { ...node });
      }
    }
    
    return {
      nodes: mergedNodes,
      version: Math.max(state1.version, state2.version) + 1,
      lastModified: new Date()
    };
  }

  /**
   * ノードデータのマージ
   * @param node1 - 第1のノードデータ
   * @param node2 - 第2のノードデータ
   * @returns マージされたノードデータ
   */
  private mergeNodeData(node1: NodeData, node2: NodeData): NodeData {
    // 簡単な最新勝利ルール（実際の実装では更新時刻を比較）
    return { ...node1, ...node2 };
  }

  // ===== Conflict Detection and Resolution =====

  /**
   * 競合パターンの検出
   * @param operations - チェック対象の操作配列
   * @returns 検出された競合パターン
   */
  public detectConflictPatterns(operations: Operation[]): Array<{
    type: string;
    operations: Operation[];
    severity: 'low' | 'medium' | 'high';
  }> {
    const conflicts: Array<{
      type: string;
      operations: Operation[];
      severity: 'low' | 'medium' | 'high';
    }> = [];

    for (let i = 0; i < operations.length; i++) {
      for (let j = i + 1; j < operations.length; j++) {
        const op1 = operations[i];
        const op2 = operations[j];
        
        if (op1 && op2 && this.areOperationsRelated(op1, op2)) {
          const conflictType = this.classifyConflict(op1, op2);
          if (conflictType) {
            conflicts.push(conflictType);
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * 競合の分類
   * @param op1 - 第1の操作
   * @param op2 - 第2の操作
   * @returns 競合の分類結果
   */
  private classifyConflict(op1: Operation, op2: Operation): {
    type: string;
    operations: Operation[];
    severity: 'low' | 'medium' | 'high';
  } | null {
    const transformKey = `${op1.operation_type}_${op2.operation_type}`;
    
    switch (transformKey) {
      case 'delete_delete':
        return {
          type: 'concurrent_delete',
          operations: [op1, op2],
          severity: 'medium'
        };
        
      case 'update_delete':
      case 'delete_update':
        return {
          type: 'update_delete_conflict',
          operations: [op1, op2],
          severity: 'high'
        };
        
      case 'move_move':
        return {
          type: 'concurrent_move',
          operations: [op1, op2],
          severity: 'low'
        };
        
      case 'create_create':
        if (op1.target_id === op2.target_id) {
          return {
            type: 'duplicate_creation',
            operations: [op1, op2],
            severity: 'high'
          };
        }
        break;
        
      case 'update_update':
        return {
          type: 'concurrent_update',
          operations: [op1, op2],
          severity: 'medium'
        };
    }
    
    return null;
  }

  /**
   * 自動競合解決の試行
   * @param conflicts - 解決対象の競合配列
   * @returns 解決結果
   */
  public resolveConflictsAutomatically(conflicts: Array<{
    type: string;
    operations: Operation[];
    severity: 'low' | 'medium' | 'high';
  }>): Array<{ conflict: any; resolved: boolean; result?: TransformResult }> {
    return conflicts.map(conflict => {
      if (conflict.operations.length === 2) {
        const [op1, op2] = conflict.operations;
        const result = op1 && op2 ? this.transform(op1, op2) : { op1Prime: op1, op2Prime: op2 };
        
        return {
          conflict,
          resolved: true,
          result
        };
      }
      
      return {
        conflict,
        resolved: false
      };
    });
  }
}

// ===== Utility Functions and Factory Methods =====

/**
 * 操作の工場関数
 */
export class OperationFactory {
  /**
   * 作成操作を生成
   */
  static createOperation(targetId: string, data: NodeData, userId: string): CreateOperation {
    return {
      id: `create_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operation_type: 'create',
      target_type: 'node',
      target_id: targetId,
      timestamp: new Date().toISOString(),
      userId,
      data
    };
  }

  /**
   * 更新操作を生成
   */
  static updateOperation(targetId: string, data: Partial<NodeData>, userId: string): UpdateOperation {
    return {
      id: `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operation_type: 'update',
      target_type: 'node',
      target_id: targetId,
      timestamp: new Date().toISOString(),
      userId,
      data
    };
  }

  /**
   * 削除操作を生成
   */
  static deleteOperation(targetId: string, userId: string): DeleteOperation {
    return {
      id: `delete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operation_type: 'delete',
      target_type: 'node',
      target_id: targetId,
      timestamp: new Date().toISOString(),
      userId
    };
  }

  /**
   * 移動操作を生成
   */
  static moveOperation(targetId: string, data: { x?: number; y?: number; parent_id?: string | null }, userId: string): MoveOperation {
    return {
      id: `move_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operation_type: 'move',
      target_type: 'node',
      target_id: targetId,
      timestamp: new Date().toISOString(),
      userId,
      data
    };
  }

  /**
   * noop操作を生成
   */
  static noopOperation(originalOperation: Operation, reason: string): NoopOperation {
    return {
      id: originalOperation.id,
      operation_type: 'noop',
      target_type: originalOperation.target_type,
      target_id: originalOperation.target_id,
      timestamp: originalOperation.timestamp,
      userId: originalOperation.userId,
      transformNote: reason
    };
  }
}

/**
 * 変換結果のユーティリティ
 */
export class TransformResultUtils {
  /**
   * 変換結果が有効な操作のみを抽出
   */
  static getValidOperations(result: TransformResult): Operation[] {
    return [result.op1Prime, result.op2Prime].filter(op => op.operation_type !== 'noop');
  }

  /**
   * 変換結果に noop が含まれているかチェック
   */
  static hasNoopOperations(result: TransformResult): boolean {
    return result.op1Prime.operation_type === 'noop' || result.op2Prime.operation_type === 'noop';
  }

  /**
   * 変換ノートを収集
   */
  static collectTransformNotes(result: TransformResult): string[] {
    const notes: string[] = [];
    if (result.op1Prime.transformNote) notes.push(result.op1Prime.transformNote);
    if (result.op2Prime.transformNote) notes.push(result.op2Prime.transformNote);
    return notes;
  }
}

/**
 * 操作の型ガード関数
 */
export class OperationTypeGuards {
  static isCreateOperation(op: Operation): op is CreateOperation {
    return op.operation_type === 'create';
  }

  static isUpdateOperation(op: Operation): op is UpdateOperation {
    return op.operation_type === 'update';
  }

  static isDeleteOperation(op: Operation): op is DeleteOperation {
    return op.operation_type === 'delete';
  }

  static isMoveOperation(op: Operation): op is MoveOperation {
    return op.operation_type === 'move';
  }

  static isNoopOperation(op: Operation): op is NoopOperation {
    return op.operation_type === 'noop';
  }

  static isDataOperation(op: Operation): op is CreateOperation | UpdateOperation | MoveOperation {
    return op.operation_type === 'create' || op.operation_type === 'update' || op.operation_type === 'move';
  }
}

/**
 * デフォルトのトランスフォーマーインスタンスを作成
 */
export function createDefaultTransformer(): OperationTransformer {
  return new OperationTransformer({
    enableFieldMerging: true,
    enableTextOperations: true,
    maxRetries: 3,
    validateResults: true
  });
}

/**
 * 設定可能なトランスフォーマーインスタンスを作成
 */
export function createConfiguredTransformer(config: Partial<TransformConfig>): OperationTransformer {
  return new OperationTransformer(config);
}