/**
 * UnifiedSyncService統合テスト
 * クラウドモード同期処理の最適化結果を検証
 */

import { unifiedSyncService } from '../UnifiedSyncService.js';

describe('UnifiedSyncService - 最適化されたクラウド同期', () => {
  let originalConsoleLog;
  let originalConsoleError;

  beforeEach(() => {
    // ログをモック
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    // ログを復元
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('編集保護システム', () => {
    test('編集中のノードは自動保存から保護される', async () => {
      // 編集セッション開始
      const session = unifiedSyncService.startEdit('test-node-1', 'Original Text');
      
      expect(session.nodeId).toBe('test-node-1');
      expect(session.originalValue).toBe('Original Text');
      expect(unifiedSyncService.isEditing('test-node-1')).toBe(true);

      // 編集中にデータ保存を試行
      const testData = { id: 'test-map', title: 'Test Map' };
      await unifiedSyncService.saveData(testData);

      // 編集中はキューに追加されることを確認
      const stats = unifiedSyncService.getStats();
      expect(stats.queuedSaves).toBeGreaterThan(0);

      // 編集終了
      unifiedSyncService.finishEdit('test-node-1', 'Updated Text');
      expect(unifiedSyncService.isEditing('test-node-1')).toBe(false);
    });

    test('複数ノード同時編集の管理', () => {
      // 複数ノードで編集開始
      unifiedSyncService.startEdit('node-1', 'Text 1');
      unifiedSyncService.startEdit('node-2', 'Text 2');
      unifiedSyncService.startEdit('node-3', 'Text 3');

      expect(unifiedSyncService.isEditing()).toBe(true);
      expect(unifiedSyncService.isEditing('node-1')).toBe(true);
      expect(unifiedSyncService.isEditing('node-2')).toBe(true);
      expect(unifiedSyncService.isEditing('node-3')).toBe(true);

      // 個別に編集終了
      unifiedSyncService.finishEdit('node-1', 'Updated Text 1');
      expect(unifiedSyncService.isEditing('node-1')).toBe(false);
      expect(unifiedSyncService.isEditing()).toBe(true); // 他はまだ編集中

      unifiedSyncService.finishEdit('node-2', 'Updated Text 2');
      unifiedSyncService.finishEdit('node-3', 'Updated Text 3');
      expect(unifiedSyncService.isEditing()).toBe(false);
    });
  });

  describe('バッチ操作API', () => {
    test('ローカルモードでのバッチ操作', async () => {
      // ローカルモードに設定
      await unifiedSyncService.initialize('local');

      const operations = [
        {
          type: 'create',
          data: {
            id: 'batch-node-1',
            text: 'Batch Created Node 1',
            x: 100,
            y: 100
          }
        },
        {
          type: 'create',
          data: {
            id: 'batch-node-2',
            text: 'Batch Created Node 2',
            x: 200,
            y: 200
          }
        },
        {
          type: 'update',
          nodeId: 'batch-node-1',
          data: {
            text: 'Updated Batch Node 1'
          }
        }
      ];

      const result = await unifiedSyncService.batchExecute(operations);

      expect(result.success).toBe(true);
      expect(result.total).toBe(3);
      expect(result.processed).toBe(3);
      expect(result.errors).toBe(0);
      expect(result.results).toHaveLength(3);

      // 各操作の結果を検証
      expect(result.results[0].operation).toBe('create');
      expect(result.results[0].nodeId).toBe('batch-node-1');
      expect(result.results[1].operation).toBe('create');
      expect(result.results[1].nodeId).toBe('batch-node-2');
      expect(result.results[2].operation).toBe('update');
      expect(result.results[2].nodeId).toBe('batch-node-1');
    });

    test('バッチ操作でのエラーハンドリング', async () => {
      await unifiedSyncService.initialize('local');

      const operations = [
        {
          type: 'create',
          data: {
            id: 'valid-node',
            text: 'Valid Node'
          }
        },
        {
          type: 'invalid-operation', // 無効な操作
          data: {}
        },
        {
          type: 'update',
          nodeId: 'non-existent-node', // 存在しないノード
          data: {
            text: 'Updated Text'
          }
        }
      ];

      const result = await unifiedSyncService.batchExecute(operations, {
        stopOnError: false // エラーがあっても継続
      });

      expect(result.success).toBe(false);
      expect(result.total).toBe(3);
      expect(result.processed).toBe(1); // 最初の有効な操作のみ成功
      expect(result.errors).toBe(2);
      expect(result.errorDetails).toHaveLength(2);
    });

    test('ストップオンエラー機能', async () => {
      await unifiedSyncService.initialize('local');

      const operations = [
        {
          type: 'create',
          data: {
            id: 'valid-node-1',
            text: 'Valid Node 1'
          }
        },
        {
          type: 'invalid-operation', // エラー操作
          data: {}
        },
        {
          type: 'create',
          data: {
            id: 'valid-node-2',
            text: 'Valid Node 2'
          }
        }
      ];

      const result = await unifiedSyncService.batchExecute(operations, {
        stopOnError: true // エラー時に停止
      });

      expect(result.success).toBe(false);
      expect(result.processed).toBe(1); // エラー前の1つだけ処理
      expect(result.errors).toBe(1);
    });
  });

  describe('モード切り替え', () => {
    test('ローカルからクラウドモードへの切り替え', async () => {
      // ローカルモードで開始
      await unifiedSyncService.initialize('local');
      expect(unifiedSyncService.mode).toBe('local');

      // 編集中の状態を作成
      unifiedSyncService.startEdit('test-node', 'Test Text');

      // クラウドモードに切り替え
      await unifiedSyncService.switchToCloudMode({
        apiBaseUrl: 'https://test-api.example.com'
      });

      expect(unifiedSyncService.mode).toBe('cloud');
      // 編集状態は保持される
      expect(unifiedSyncService.isEditing('test-node')).toBe(true);
    });

    test('クラウドからローカルモードへの切り替え', async () => {
      // クラウドモードで開始
      await unifiedSyncService.initialize('cloud', {
        apiBaseUrl: 'https://test-api.example.com'
      });
      expect(unifiedSyncService.mode).toBe('cloud');

      // ローカルモードに切り替え
      await unifiedSyncService.switchToLocalMode();
      expect(unifiedSyncService.mode).toBe('local');
    });
  });

  describe('統計情報', () => {
    test('基本統計情報の取得', () => {
      const stats = unifiedSyncService.getStats();

      expect(stats).toHaveProperty('mode');
      expect(stats).toHaveProperty('isSyncing');
      expect(stats).toHaveProperty('lastSyncTime');
      expect(stats).toHaveProperty('queuedSaves');
      expect(stats).toHaveProperty('editProtection');

      expect(stats.editProtection).toHaveProperty('activeEdits');
      expect(stats.editProtection).toHaveProperty('queuedUpdates');
    });

    test('編集保護統計の詳細確認', () => {
      // 編集セッション作成
      unifiedSyncService.startEdit('node-1', 'Text 1');
      unifiedSyncService.startEdit('node-2', 'Text 2');

      const stats = unifiedSyncService.getStats();
      expect(stats.editProtection.activeEdits).toBe(2);
      expect(stats.editProtection.editingSessions).toHaveLength(2);

      // セッション詳細の確認
      const session1 = stats.editProtection.editingSessions.find(s => s.nodeId === 'node-1');
      expect(session1).toBeDefined();
      expect(session1.hasChanges).toBe(false);
      expect(session1.duration).toBeGreaterThan(0);

      // 編集終了
      unifiedSyncService.finishEdit('node-1', 'Updated Text 1');
      unifiedSyncService.finishEdit('node-2', 'Updated Text 2');

      const finalStats = unifiedSyncService.getStats();
      expect(finalStats.editProtection.activeEdits).toBe(0);
    });
  });

  describe('エラー耐性', () => {
    test('APIクライアント未初期化時のフォールバック', async () => {
      // ローカルモードで初期化
      await unifiedSyncService.initialize('local');

      const operations = [
        {
          type: 'create',
          data: {
            id: 'fallback-node',
            text: 'Fallback Node'
          }
        }
      ];

      // バッチ操作実行（クラウドAPIが無いためローカルで実行される）
      const result = await unifiedSyncService.batchExecute(operations);
      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
    });

    test('無効なデータに対するエラーハンドリング', async () => {
      await unifiedSyncService.initialize('local');

      const invalidOperations = [
        {
          // type フィールドが無い
          data: { id: 'invalid-node' }
        },
        {
          type: 'create'
          // data フィールドが無い
        }
      ];

      const result = await unifiedSyncService.batchExecute(invalidOperations);
      expect(result.success).toBe(false);
      expect(result.errors).toBe(2);
      expect(result.processed).toBe(0);
    });
  });

  describe('パフォーマンス', () => {
    test('大量バッチ操作の処理時間', async () => {
      await unifiedSyncService.initialize('local');

      // 100個のノード作成操作
      const operations = Array.from({ length: 100 }, (_, i) => ({
        type: 'create',
        data: {
          id: `perf-node-${i}`,
          text: `Performance Test Node ${i}`,
          x: i * 10,
          y: i * 10
        }
      }));

      const startTime = Date.now();
      const result = await unifiedSyncService.batchExecute(operations);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.processed).toBe(100);

      // パフォーマンス要件: 100操作を2秒以内で処理
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(2000);

      console.log(`100 batch operations completed in ${executionTime}ms`);
    });

    test('同期頻度の最適化確認', async () => {
      await unifiedSyncService.initialize('local');

      const testData = { id: 'test-map', title: 'Sync Test' };

      // 連続保存要求
      const savePromises = Array.from({ length: 5 }, () => 
        unifiedSyncService.saveData(testData)
      );

      await Promise.all(savePromises);

      // キューが適切に管理されていることを確認
      const stats = unifiedSyncService.getStats();
      expect(stats.queuedSaves).toBeLessThanOrEqual(1); // 最新の1つだけキューされる
    });
  });
});

// 統合テスト用のモックヘルパー
export const mockCloudAPI = {
  responses: new Map(),
  
  setResponse(endpoint, response) {
    this.responses.set(endpoint, response);
  },
  
  clearResponses() {
    this.responses.clear();
  }
};

// パフォーマンス測定ヘルパー
export const performanceMeasure = {
  async measureBatchOperation(operations) {
    const startTime = performance.now();
    const result = await unifiedSyncService.batchExecute(operations);
    const endTime = performance.now();
    
    return {
      result,
      executionTime: endTime - startTime,
      operationsPerSecond: operations.length / ((endTime - startTime) / 1000)
    };
  }
};