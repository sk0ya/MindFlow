import { VectorClock } from './VectorClock';
import { OperationTransformer, Operation, TransformResult, TransformLogEntry } from './OperationTransformer';

// ===== Type Definitions =====

/**
 * Vector Clock comparison result
 */
export type VectorClockComparison = 'before' | 'after' | 'concurrent' | 'equal';

/**
 * Conflict detection result
 */
export interface ConflictDetectionResult {
  hasConflict: boolean;
  comparison: VectorClockComparison;
  conflictType?: ConflictType;
  severity?: ConflictSeverity;
}

/**
 * Types of conflicts that can occur
 */
export type ConflictType =
  | 'concurrent_edit'
  | 'simultaneous_delete'
  | 'update_delete_conflict'
  | 'position_conflict'
  | 'property_conflict'
  | 'structural_conflict'
  | 'version_mismatch'
  | 'causality_violation';

/**
 * Conflict severity levels
 */
export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Resolution strategy types
 */
export type ResolutionStrategy =
  | 'last_writer_wins'
  | 'first_writer_wins'
  | 'delete_wins'
  | 'both_valid'
  | 'field_merge'
  | 'manual_resolution'
  | 'operational_transformation'
  | 'three_way_merge'
  | 'semantic_merge'
  | 'conflict_free_replicated_data_type';

/**
 * Auto-resolution rule configuration
 */
export interface AutoResolutionRule {
  operationType: string;
  targetType: string;
  strategy: ResolutionStrategy;
  conditions?: Array<{
    field: string;
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
    value: any;
  }>;
  priority: number;
  isEnabled: boolean;
}

/**
 * Conflict classification and analysis
 */
export interface ConflictAnalysis {
  conflictId: string;
  type: ConflictType;
  severity: ConflictSeverity;
  operations: Operation[];
  affectedFields: string[];
  recommendation: 'auto_resolve' | 'manual_review' | 'defer_resolution';
  estimatedResolutionTime: number;
  riskLevel: 'safe' | 'moderate' | 'dangerous';
  semanticImpact: 'minimal' | 'moderate' | 'significant';
}

/**
 * Data merging strategy configuration
 */
export interface MergeStrategy {
  strategy: 'union' | 'intersection' | 'left_wins' | 'right_wins' | 'smart_merge' | 'custom';
  fieldPriorities?: Map<string, number>;
  customMerger?: (leftValue: any, rightValue: any, context: MergeContext) => any;
  conflictHandler?: (leftValue: any, rightValue: any, context: MergeContext) => MergeResult;
}

/**
 * Context for merging operations
 */
export interface MergeContext {
  fieldName: string;
  operationType: string;
  userId: string;
  timestamp: Date;
  parentOperation?: Operation;
  metadata?: Record<string, any>;
}

/**
 * Result of a merge operation
 */
export interface MergeResult {
  value: any;
  confidence: number; // 0-1, how confident we are in this merge
  isConflicting: boolean;
  requiresManualReview: boolean;
  metadata?: Record<string, any>;
}

/**
 * Version control and history management
 */
export interface VersionInfo {
  version: number;
  vectorClock: Record<string, number>;
  timestamp: Date;
  author: string;
  checksum?: string;
  parentVersions?: string[];
}

/**
 * Conflict resolution result
 */
export interface ConflictResolutionResult {
  resolvedOperation: Operation | null;
  shouldApply: boolean;
  conflictInfo: {
    conflictId?: string;
    conflictCount: number;
    transformations?: TransformLogEntry[];
    resolutionStrategy: ResolutionStrategy;
    hasSignificantConflict: boolean;
    autoResolved: boolean;
    requiresManualResolution?: boolean;
    error?: string;
    analysisResult?: ConflictAnalysis;
  } | null;
  resolutionTime: number;
  confidenceScore?: number;
  alternativeResolutions?: Operation[];
}

/**
 * Manual conflict resolution choice
 */
export interface ManualResolutionChoice {
  strategy: 'accept_local' | 'accept_remote' | 'merge_custom' | 'reject_all' | 'defer';
  operationId?: string;
  mergedData?: any;
  comment?: string;
  reviewerId: string;
  reviewTimestamp: Date;
}

/**
 * Conflict data for manual resolution
 */
export interface ConflictData {
  id: string;
  incomingOperation: Operation;
  localOperations: Operation[];
  error?: string;
  timestamp: string;
  status: 'pending' | 'in_review' | 'resolved' | 'escalated';
  attempts: number;
  analysis?: ConflictAnalysis;
  reviewers?: string[];
  deadline?: Date;
  escalationLevel?: number;
}

/**
 * State synchronization configuration
 */
export interface SyncConfiguration {
  enableRealTimeSync: boolean;
  conflictDetectionMode: 'strict' | 'loose' | 'adaptive';
  resolutionTimeout: number;
  maxPendingConflicts: number;
  batchSize: number;
  retryPolicy: {
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential' | 'fixed';
    initialDelay: number;
    maxDelay: number;
  };
}

/**
 * Performance optimization metrics
 */
export interface PerformanceMetrics {
  totalConflicts: number;
  resolvedConflicts: number;
  manualResolutions: number;
  averageResolutionTime: number;
  peakResolutionTime: number;
  conflictRate: number; // conflicts per minute
  autoResolutionSuccessRate: number;
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
}

/**
 * Conflict statistics for a specific mindmap
 */
export interface MindmapConflictStats {
  totalOperations: number;
  conflictOperations: number;
  conflictRate: number;
  lastConflict: string | null;
  mostCommonConflictType: ConflictType | null;
  averageResolutionTime: number;
  userInvolvement: Map<string, number>;
}

/**
 * Batch conflict resolution configuration
 */
export interface BatchResolutionConfig {
  maxBatchSize: number;
  prioritizeByTimestamp: boolean;
  groupBySimilarity: boolean;
  enableParallelProcessing: boolean;
  timeoutPerBatch: number;
}

/**
 * Sync state manager interface (for dependency injection)
 */
export interface ISyncStateManager {
  state: {
    pendingOperations: Operation[];
  };
  addError(error: Error, context: string): void;
  notifyListeners(event: string, data: any): void;
}

/**
 * ConflictResolver - 競合解決器
 * ベクタークロックによる競合検出と操作変換による自動解決
 */
export class ConflictResolver {
  private readonly syncStateManager: ISyncStateManager;
  private readonly transformer: OperationTransformer;
  private readonly operationHistory: Map<string, Operation[]>;
  private readonly pendingConflicts: Map<string, ConflictData>;
  private readonly resolutionStrategies: Map<string, ResolutionStrategy>;
  private readonly autoResolutionRules: Map<string, AutoResolutionRule[]>;
  private readonly conflictStats: PerformanceMetrics;
  private readonly syncConfig: SyncConfiguration;
  private readonly batchConfig: BatchResolutionConfig;
  private readonly mergeStrategies: Map<string, MergeStrategy>;
  private readonly performanceMonitor: PerformanceMonitor;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    syncStateManager: ISyncStateManager, 
    config?: Partial<SyncConfiguration & BatchResolutionConfig>
  ) {
    this.syncStateManager = syncStateManager;
    this.transformer = new OperationTransformer();
    this.operationHistory = new Map<string, Operation[]>();
    this.pendingConflicts = new Map<string, ConflictData>();
    this.resolutionStrategies = new Map<string, ResolutionStrategy>();
    this.autoResolutionRules = new Map<string, AutoResolutionRule[]>();
    this.mergeStrategies = new Map<string, MergeStrategy>();
    this.performanceMonitor = new PerformanceMonitor();
    
    this.conflictStats = {
      totalConflicts: 0,
      resolvedConflicts: 0,
      manualResolutions: 0,
      averageResolutionTime: 0,
      peakResolutionTime: 0,
      conflictRate: 0,
      autoResolutionSuccessRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      networkLatency: 0
    };

    this.syncConfig = {
      enableRealTimeSync: true,
      conflictDetectionMode: 'adaptive',
      resolutionTimeout: 30000,
      maxPendingConflicts: 100,
      batchSize: 50,
      retryPolicy: {
        maxRetries: 3,
        backoffStrategy: 'exponential',
        initialDelay: 1000,
        maxDelay: 30000
      },
      ...config
    };

    this.batchConfig = {
      maxBatchSize: 10,
      prioritizeByTimestamp: true,
      groupBySimilarity: true,
      enableParallelProcessing: false,
      timeoutPerBatch: 10000,
      ...config
    };

    this.setupDefaultStrategies();
    this.setupDefaultMergeStrategies();
    this.setupDefaultAutoResolutionRules();
    this.startCleanupTimer();
  }

  /**
   * デフォルトの競合解決戦略を設定
   */
  private setupDefaultStrategies(): void {
    this.resolutionStrategies.set('text_edit', 'last_writer_wins');
    this.resolutionStrategies.set('position_move', 'last_writer_wins');
    this.resolutionStrategies.set('node_delete', 'delete_wins');
    this.resolutionStrategies.set('node_create', 'both_valid');
    this.resolutionStrategies.set('property_update', 'field_merge');
    this.resolutionStrategies.set('structural_change', 'operational_transformation');
    this.resolutionStrategies.set('batch_operation', 'three_way_merge');
  }

  /**
   * デフォルトのマージ戦略を設定
   */
  private setupDefaultMergeStrategies(): void {
    this.mergeStrategies.set('text', {
      strategy: 'smart_merge',
      customMerger: this.smartTextMerge.bind(this)
    });
    
    this.mergeStrategies.set('position', {
      strategy: 'right_wins', // Latest position wins
      fieldPriorities: new Map([['timestamp', 1]])
    });
    
    this.mergeStrategies.set('properties', {
      strategy: 'union',
      conflictHandler: this.handlePropertyConflict.bind(this)
    });
  }

  /**
   * デフォルトの自動解決ルールを設定
   */
  private setupDefaultAutoResolutionRules(): void {
    // Simple edit conflicts
    this.autoResolutionRules.set('simple_edit', [{
      operationType: 'update',
      targetType: 'node',
      strategy: 'operational_transformation',
      priority: 1,
      isEnabled: true
    }]);
    
    // Position conflicts
    this.autoResolutionRules.set('position_conflict', [{
      operationType: 'move',
      targetType: 'node',
      strategy: 'last_writer_wins',
      priority: 2,
      isEnabled: true
    }]);
    
    // Delete conflicts
    this.autoResolutionRules.set('delete_conflict', [{
      operationType: 'delete',
      targetType: 'node',
      strategy: 'delete_wins',
      priority: 3,
      isEnabled: true
    }]);
  }

  /**
   * クリーンアップタイマーを開始
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performPeriodicCleanup();
    }, 300000); // 5 minutes
  }

  /**
   * 競合検出
   * @param incomingVectorClock - 受信した操作のベクタークロック
   * @param localVectorClock - ローカルのベクタークロック
   * @returns 競合検出結果
   */
  public detectConflict(
    incomingVectorClock: Record<string, number>, 
    localVectorClock: Record<string, number>
  ): ConflictDetectionResult {
    const comparison = new VectorClock(localVectorClock).compare(incomingVectorClock);
    const hasConflict = comparison === 'concurrent';
    
    return {
      hasConflict,
      comparison,
      conflictType: hasConflict ? this.classifyConflictType(incomingVectorClock, localVectorClock) : undefined,
      severity: hasConflict ? this.determineSeverity(incomingVectorClock, localVectorClock) : undefined
    };
  }

  /**
   * 競合の種類を分類
   */
  private classifyConflictType(
    incomingVectorClock: Record<string, number>, 
    localVectorClock: Record<string, number>
  ): ConflictType {
    // ベクタークロックの差分を分析して競合タイプを判定
    const localKeys = Object.keys(localVectorClock);
    const incomingKeys = Object.keys(incomingVectorClock);
    const allKeys = new Set([...localKeys, ...incomingKeys]);
    
    let divergenceCount = 0;
    for (const key of allKeys) {
      const localVal = localVectorClock[key] || 0;
      const incomingVal = incomingVectorClock[key] || 0;
      if (Math.abs(localVal - incomingVal) > 1) {
        divergenceCount++;
      }
    }
    
    if (divergenceCount > 3) return 'causality_violation';
    if (divergenceCount > 1) return 'concurrent_edit';
    return 'property_conflict';
  }

  /**
   * 競合の重要度を判定
   */
  private determineSeverity(
    incomingVectorClock: Record<string, number>, 
    localVectorClock: Record<string, number>
  ): ConflictSeverity {
    const maxDivergence = Math.max(
      ...Object.keys({...incomingVectorClock, ...localVectorClock}).map(key => 
        Math.abs((localVectorClock[key] || 0) - (incomingVectorClock[key] || 0))
      )
    );
    
    if (maxDivergence > 10) return 'critical';
    if (maxDivergence > 5) return 'high';
    if (maxDivergence > 2) return 'medium';
    return 'low';
  }

  /**
   * 競合解決のメインロジック
   * @param incomingOperation - 受信した操作
   * @param localOperations - ローカルの操作リスト
   * @returns 解決結果
   */
  public async resolveConflict(
    incomingOperation: Operation, 
    localOperations: Operation[] = []
  ): Promise<ConflictResolutionResult> {
    const conflictStartTime = Date.now();
    this.conflictStats.totalConflicts++;

    try {
      const mindmapId = (incomingOperation as any).mindmap_id || 'default';
      
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
   * @param operation - 操作
   */
  private async applyResolvedOperation(operation: Operation): Promise<void> {
    const event = new CustomEvent('apply_resolved_operation', {
      detail: operation
    });
    document.dispatchEvent(event);
  }

  /**
   * 競合統計を更新
   * @param startTime - 開始時刻
   */
  private updateConflictStats(startTime: number): void {
    this.updatePerformanceMetrics(Date.now() - startTime, true);
  }

  /**
   * 競合統計の取得
   * @param mindmapId - マインドマップID
   * @returns 統計データ
   */
  public getConflictStats(mindmapId?: string): PerformanceMetrics & { 
    mindmapSpecific?: MindmapConflictStats;
    pendingManualResolutions: number;
  } {
    if (mindmapId) {
      const history = this.operationHistory.get(mindmapId) || [];
      const conflicts = history.filter(op => this.hasConflictInfo(op));
      
      return {
        ...this.conflictStats,
        mindmapSpecific: {
          totalOperations: history.length,
          conflictOperations: conflicts.length,
          conflictRate: conflicts.length / Math.max(history.length, 1),
          lastConflict: conflicts.length > 0 ? 
            conflicts[conflicts.length - 1].timestamp : null,
          mostCommonConflictType: this.getMostCommonConflictType(conflicts),
          averageResolutionTime: this.conflictStats.averageResolutionTime,
          userInvolvement: this.calculateUserInvolvement(conflicts)
        },
        pendingManualResolutions: this.pendingConflicts.size
      };
    }
    
    return {
      ...this.conflictStats,
      pendingManualResolutions: this.pendingConflicts.size
    };
  }

  /**
   * 競合解決戦略を設定
   * @param operationType - 操作タイプ
   * @param strategy - 戦略
   */
  public setResolutionStrategy(operationType: string, strategy: ResolutionStrategy): void {
    this.resolutionStrategies.set(operationType, strategy);
  }

  /**
   * 競合解決戦略を取得
   * @param operationType - 操作タイプ
   * @returns 戦略
   */
  public getResolutionStrategy(operationType: string): ResolutionStrategy {
    return this.resolutionStrategies.get(operationType) || 'last_writer_wins';
  }

  /**
   * 操作履歴をクリア
   * @param mindmapId - マインドマップID
   */
  public clearHistory(mindmapId?: string): void {
    if (mindmapId) {
      this.operationHistory.delete(mindmapId);
    } else {
      this.operationHistory.clear();
    }
  }

  /**
   * ペンディング競合を取得
   * @returns ペンディング競合のリスト
   */
  public getPendingConflicts(): ConflictData[] {
    return Array.from(this.pendingConflicts.values());
  }

  /**
   * 競合の詳細分析
   * @param operation1 - 第1の操作
   * @param operation2 - 第2の操作
   * @returns 分析結果
   */
  public analyzeConflict(operation1: Operation, operation2: Operation): ConflictAnalysis {
    const conflictId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const analysis: ConflictAnalysis = {
      conflictId,
      type: this.determineConflictTypeFromOperations(operation1, operation2),
      severity: 'low',
      operations: [operation1, operation2],
      affectedFields: [],
      recommendation: 'auto_resolve',
      estimatedResolutionTime: 100,
      riskLevel: 'safe',
      semanticImpact: 'minimal'
    };

    // データの比較
    if (operation1.data && operation2.data) {
      for (const field of Object.keys(operation1.data)) {
        if (operation2.data[field] !== undefined && 
            operation1.data[field] !== operation2.data[field]) {
          analysis.affectedFields.push(field);
        }
      }
    }

    // 重要度評価
    if (analysis.affectedFields.some(f => f === 'text')) {
      analysis.severity = 'high';
      analysis.recommendation = 'manual_review';
      analysis.riskLevel = 'moderate';
      analysis.semanticImpact = 'significant';
      analysis.estimatedResolutionTime = 5000;
    } else if (analysis.affectedFields.length > 3) {
      analysis.severity = 'medium';
      analysis.estimatedResolutionTime = 1000;
    }

    return analysis;
  }

  // ===== Advanced Conflict Resolution Methods =====

  /**
   * スマートテキストマージ
   */
  private smartTextMerge(leftValue: string, rightValue: string, context: MergeContext): any {
    // 簡単な3-wayマージアルゴリズム
    if (leftValue === rightValue) return leftValue;
    
    // タイムスタンプで決定
    const leftTime = context.timestamp.getTime();
    const rightTime = new Date().getTime();
    
    return leftTime > rightTime ? leftValue : rightValue;
  }

  /**
   * プロパティ競合ハンドラー
   */
  private handlePropertyConflict(leftValue: any, rightValue: any, context: MergeContext): MergeResult {
    return {
      value: rightValue, // Latest wins
      confidence: 0.8,
      isConflicting: leftValue !== rightValue,
      requiresManualReview: false
    };
  }

  /**
   * 操作から競合タイプを判定
   */
  private determineConflictTypeFromOperations(op1: Operation, op2: Operation): ConflictType {
    const key = `${op1.operation_type}_${op2.operation_type}`;
    
    switch (key) {
      case 'update_update': return 'concurrent_edit';
      case 'delete_delete': return 'simultaneous_delete';
      case 'update_delete':
      case 'delete_update': return 'update_delete_conflict';
      case 'move_move': return 'position_conflict';
      default: return 'property_conflict';
    }
  }

  /**
   * 最も一般的な競合タイプを取得
   */
  private getMostCommonConflictType(conflicts: Operation[]): ConflictType | null {
    if (conflicts.length === 0) return null;
    
    const typeCount = new Map<ConflictType, number>();
    
    for (const conflict of conflicts) {
      const conflictInfo = (conflict as any).conflictInfo;
      if (conflictInfo?.type) {
        typeCount.set(conflictInfo.type, (typeCount.get(conflictInfo.type) || 0) + 1);
      }
    }
    
    let maxCount = 0;
    let mostCommon: ConflictType | null = null;
    
    for (const [type, count] of typeCount) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = type;
      }
    }
    
    return mostCommon;
  }

  /**
   * ユーザーの競合関与度を計算
   */
  private calculateUserInvolvement(conflicts: Operation[]): Map<string, number> {
    const involvement = new Map<string, number>();
    
    for (const conflict of conflicts) {
      const userId = conflict.userId;
      involvement.set(userId, (involvement.get(userId) || 0) + 1);
    }
    
    return involvement;
  }

  /**
   * 操作が競合情報を持つかチェック
   */
  private hasConflictInfo(operation: Operation): boolean {
    return (operation as any).conflictInfo?.conflictCount > 0;
  }

  /**
   * 定期クリーンアップ処理
   */
  private performPeriodicCleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    // 古い操作履歴を削除
    for (const [mindmapId, operations] of this.operationHistory) {
      const filtered = operations.filter(op => {
        const opTime = new Date(op.timestamp).getTime();
        return now - opTime < maxAge;
      });
      this.operationHistory.set(mindmapId, filtered);
    }
    
    // 古い競合を削除
    for (const [conflictId, conflict] of this.pendingConflicts) {
      const conflictTime = new Date(conflict.timestamp).getTime();
      if (now - conflictTime > maxAge) {
        this.pendingConflicts.delete(conflictId);
      }
    }
  }

  /**
   * バッチ競合解決
   */
  public async resolveBatchConflicts(operations: Operation[]): Promise<Operation[]> {
    if (operations.length <= 1) return operations;
    
    const resolvedOps: Operation[] = [];
    const batches = this.createBatches(operations);
    
    for (const batch of batches) {
      const batchResult = await this.resolveBatch(batch);
      resolvedOps.push(...batchResult);
    }
    
    return resolvedOps;
  }

  /**
   * 操作をバッチに分割
   */
  private createBatches(operations: Operation[]): Operation[][] {
    const batches: Operation[][] = [];
    const maxBatchSize = this.batchConfig.maxBatchSize;
    
    for (let i = 0; i < operations.length; i += maxBatchSize) {
      batches.push(operations.slice(i, i + maxBatchSize));
    }
    
    return batches;
  }

  /**
   * 単一バッチの解決
   */
  private async resolveBatch(batch: Operation[]): Promise<Operation[]> {
    const startTime = Date.now();
    const timeout = this.batchConfig.timeoutPerBatch;
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Batch resolution timeout'));
      }, timeout);
      
      this.processBatchOperations(batch)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * バッチ操作の処理
   */
  private async processBatchOperations(operations: Operation[]): Promise<Operation[]> {
    // タイムスタンプでソート
    const sortedOps = operations.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const resolvedOps: Operation[] = [];
    
    for (const op of sortedOps) {
      let resolvedOp = op;
      
      // 既に解決済みの操作との競合をチェック
      for (const existingOp of resolvedOps) {
        if (this.transformer.areOperationsRelated(resolvedOp, existingOp)) {
          const result = this.transformer.transform(resolvedOp, existingOp);
          resolvedOp = result.op1Prime;
        }
      }
      
      if (resolvedOp.operation_type !== 'noop') {
        resolvedOps.push(resolvedOp);
      }
    }
    
    return resolvedOps;
  }

  /**
   * 競合解決ルールの追加
   */
  public addAutoResolutionRule(category: string, rule: AutoResolutionRule): void {
    if (!this.autoResolutionRules.has(category)) {
      this.autoResolutionRules.set(category, []);
    }
    this.autoResolutionRules.get(category)!.push(rule);
  }

  /**
   * マージ戦略の設定
   */
  public setMergeStrategy(fieldType: string, strategy: MergeStrategy): void {
    this.mergeStrategies.set(fieldType, strategy);
  }

  /**
   * 競合統計の更新
   */
  private updatePerformanceMetrics(resolutionTime: number, wasAutoResolved: boolean): void {
    this.conflictStats.totalConflicts++;
    
    if (wasAutoResolved) {
      this.conflictStats.resolvedConflicts++;
      
      // 平均解決時闢の更新
      const totalResolutions = this.conflictStats.resolvedConflicts;
      const currentAvg = this.conflictStats.averageResolutionTime;
      this.conflictStats.averageResolutionTime = 
        (currentAvg * (totalResolutions - 1) + resolutionTime) / totalResolutions;
      
      // ピーク時闢の更新
      if (resolutionTime > this.conflictStats.peakResolutionTime) {
        this.conflictStats.peakResolutionTime = resolutionTime;
      }
      
      // 自動解決成功率の更新
      this.conflictStats.autoResolutionSuccessRate = 
        this.conflictStats.resolvedConflicts / this.conflictStats.totalConflicts;
    } else {
      this.conflictStats.manualResolutions++;
    }
    
    // 競合率の計算 (per minute)
    const now = Date.now();
    this.conflictStats.conflictRate = this.calculateConflictRate(now);
  }

  /**
   * 競合率の計算
   */
  private calculateConflictRate(currentTime: number): number {
    const oneMinuteAgo = currentTime - 60000;
    let recentConflicts = 0;
    
    for (const operations of this.operationHistory.values()) {
      recentConflicts += operations.filter(op => {
        const opTime = new Date(op.timestamp).getTime();
        return opTime > oneMinuteAgo && this.hasConflictInfo(op);
      }).length;
    }
    
    return recentConflicts;
  }

  /**
   * クリーンアップとリソース解放
   */
  public cleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.operationHistory.clear();
    this.pendingConflicts.clear();
    this.resolutionStrategies.clear();
    this.autoResolutionRules.clear();
    this.mergeStrategies.clear();
  }
}

// ===== Performance Monitor Class =====

/**
 * パフォーマンス監視クラス
 */
class PerformanceMonitor {
  private startTime: number;
  private operationCount: number;
  
  constructor() {
    this.startTime = Date.now();
    this.operationCount = 0;
  }
  
  /**
   * 操作の開始を記録
   */
  public startOperation(): number {
    this.operationCount++;
    return Date.now();
  }
  
  /**
   * 操作の終了を記録
   */
  public endOperation(startTime: number): number {
    return Date.now() - startTime;
  }
  
  /**
   * 統計情報を取得
   */
  public getStats(): { operationCount: number; uptime: number; averageOperationTime: number } {
    const uptime = Date.now() - this.startTime;
    return {
      operationCount: this.operationCount,
      uptime,
      averageOperationTime: uptime / Math.max(this.operationCount, 1)
    };
  }
}