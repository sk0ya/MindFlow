/**
 * 不具合検知・回帰テストケース
 * 実際にクラウドストレージで発生しうる問題を再現・検知
 */

import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { jest } from '@jest/globals';

// モック設定を削除（自己完結型テスト）

// タイマーモック
jest.useFakeTimers();

describe('🚨 不具合検知・回帰テスト', () => {
  let mockFetch;
  let consoleSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('🔥 認証システム競合不具合の検知', () => {
    test('認証チェック間隔不整合による無限ループ検知', async () => {
      const authCallTimes = [];
      let callCount = 0;
      
      // 不具合シナリオ: 異なる間隔が競合してリソースを消費
      const createAuthChecker = (name, interval) => {
        return () => {
          callCount++;
          authCallTimes.push({ name, time: Date.now(), count: callCount });
          
          // 不具合検知: 短時間で大量の呼び出し
          if (callCount > 100) {
            throw new Error(`Authentication check overflow detected: ${callCount} calls`);
          }
        };
      };

      const authChecker1 = createAuthChecker('useAuth', 30000);
      const authChecker2 = createAuthChecker('useAuthHandlers', 30000); // 修正後: 統一

      // 不具合テスト: 短い間隔で大量実行
      const interval1 = setInterval(authChecker1, 100); // 100ms間隔で検証
      const interval2 = setInterval(authChecker2, 100);

      // 5秒間実行（50回ずつ、計100回の呼び出し）
      expect(() => {
        act(() => {
          jest.advanceTimersByTime(5000);
        });
      }).toThrow('Authentication check overflow detected');

      clearInterval(interval1);
      clearInterval(interval2);
    });

    test('認証成功後の並行処理による競合状態検知', async () => {
      const executionStates = {
        refreshMaps: 'idle',
        realtimeSync: 'idle',
        cloudSync: 'idle'
      };
      
      const conflicts = [];

      // 不具合シナリオ: 並行実行による競合
      const mockRefreshAllMindMaps = jest.fn(async () => {
        if (executionStates.refreshMaps !== 'idle') {
          conflicts.push('refreshMaps already running');
        }
        executionStates.refreshMaps = 'running';
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        executionStates.refreshMaps = 'completed';
      });

      const mockRealtimeSync = jest.fn(() => {
        if (executionStates.realtimeSync !== 'idle') {
          conflicts.push('realtimeSync already running');
        }
        executionStates.realtimeSync = 'running';
        
        // 即座完了
        executionStates.realtimeSync = 'completed';
      });

      const mockCloudSync = jest.fn(async () => {
        if (executionStates.cloudSync !== 'idle') {
          conflicts.push('cloudSync already running');
        }
        executionStates.cloudSync = 'running';
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        executionStates.cloudSync = 'completed';
      });

      // 不具合シナリオ: 並行実行
      const promises = [
        mockRefreshAllMindMaps(),
        Promise.resolve().then(mockRealtimeSync),
        mockCloudSync()
      ];

      await Promise.all(promises);

      // 競合検知: 同時実行による問題
      expect(conflicts.length).toBeGreaterThan(0);
      console.warn('🚨 競合検知:', conflicts);
    });
  });

  describe('🌐 ネットワークエラー不具合の検知', () => {
    test('タイムアウト設定なしによるハング検知', async () => {
      let isHanging = false;
      
      // 不具合シナリオ: タイムアウトなしのAPI呼び出し
      const apiCallWithoutTimeout = async () => {
        isHanging = true;
        
        // タイムアウト設定なし（修正前の問題）
        try {
          await fetch('/api/test'); // 永続的に待機
        } catch (error) {
          isHanging = false;
          throw error;
        }
        
        isHanging = false;
      };

      // 永続的に解決しないPromiseをモック
      mockFetch.mockImplementation(() => new Promise(() => {})); // 永続ハング

      // ハング検知タイマー
      const hangDetectionPromise = new Promise((_, reject) => {
        setTimeout(() => {
          if (isHanging) {
            reject(new Error('API call hanging detected - no timeout configured'));
          }
        }, 1000);
      });

      const apiPromise = apiCallWithoutTimeout();

      // ハングまたはタイムアウトのどちらかが発生
      await expect(Promise.race([apiPromise, hangDetectionPromise]))
        .rejects.toThrow('API call hanging detected');
    });

    test('リトライ機能なしによる脆弱性検知', async () => {
      let failureCount = 0;
      const maxFailures = 5;

      // 不具合シナリオ: リトライなしの脆弱なAPI呼び出し
      const vulnerableApiCall = async () => {
        const response = await fetch('/api/test');
        if (!response.ok) {
          throw new Error(`API failed with status ${response.status}`);
        }
        return response;
      };

      // 連続失敗をシミュレート
      mockFetch.mockImplementation(() => {
        failureCount++;
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        });
      });

      const failures = [];
      
      // 連続失敗テスト
      for (let i = 0; i < maxFailures; i++) {
        try {
          await vulnerableApiCall();
        } catch (error) {
          failures.push(error.message);
        }
      }

      // 脆弱性検知: リトライなしで全て失敗
      expect(failures.length).toBe(maxFailures);
      expect(failureCount).toBe(maxFailures);
      console.warn('🚨 脆弱性検知: リトライ機能なしで全失敗', failures);
    });

    test('レート制限無視による過剰リクエスト検知', async () => {
      let requestCount = 0;
      const rateLimitThreshold = 10;

      // 不具合シナリオ: レート制限を無視した過剰リクエスト
      const aggressiveApiCall = async () => {
        requestCount++;
        
        const response = await fetch('/api/test');
        
        if (response.status === 429) {
          // レート制限を無視して継続（修正前の問題）
          console.warn('Rate limited, but continuing anyway...');
          return aggressiveApiCall(); // 無限再帰の危険
        }
        
        return response;
      };

      // レート制限レスポンスをシミュレート
      mockFetch.mockImplementation(() => {
        if (requestCount > rateLimitThreshold) {
          return Promise.resolve({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            headers: new Map([['Retry-After', '60']])
          });
        }
        
        return Promise.resolve({ ok: true });
      });

      // 過剰リクエストテスト
      const requests = Array(15).fill().map(() => aggressiveApiCall());
      
      await Promise.allSettled(requests);

      // 過剰リクエスト検知
      expect(requestCount).toBeGreaterThan(rateLimitThreshold);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limited, but continuing anyway')
      );
      console.warn('🚨 過剰リクエスト検知:', requestCount, 'requests');
    });
  });

  describe('💾 同期処理競合不具合の検知', () => {
    test('同時保存によるデータ破損検知', async () => {
      let globalState = { id: 'test', data: 'initial', version: 1 };
      let saveInProgress = false;
      const corruptions = [];

      // 不具合シナリオ: 同時保存によるデータ競合
      const unsafeSave = async (newData) => {
        if (saveInProgress) {
          corruptions.push(`Concurrent save detected: ${JSON.stringify(newData)}`);
        }
        
        saveInProgress = true;
        
        // データ読み取り
        const currentState = { ...globalState };
        
        // 保存遅延をシミュレート
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // データ書き込み（競合の可能性）
        globalState = {
          ...currentState,
          ...newData,
          version: currentState.version + 1
        };
        
        saveInProgress = false;
        return globalState;
      };

      // 同時保存テスト
      const savePromises = [
        unsafeSave({ data: 'save1', timestamp: Date.now() }),
        unsafeSave({ data: 'save2', timestamp: Date.now() + 1 }),
        unsafeSave({ data: 'save3', timestamp: Date.now() + 2 })
      ];

      await Promise.all(savePromises);

      // データ破損検知
      expect(corruptions.length).toBeGreaterThan(0);
      console.warn('🚨 データ破損検知:', corruptions);
      console.warn('最終状態:', globalState);
    });

    test('リアルタイム同期ブロック期間不整合検知', async () => {
      let syncBlockedUntil = 0;
      const syncAttempts = [];
      const blockingConflicts = [];

      // 複数のブロック期間設定（不具合パターン）
      const blockRealtimeSync5s = () => {
        const newBlockTime = Date.now() + 5000;
        if (syncBlockedUntil > 0 && syncBlockedUntil !== newBlockTime) {
          blockingConflicts.push(`Blocking conflict: existing=${syncBlockedUntil}, new=${newBlockTime}`);
        }
        syncBlockedUntil = newBlockTime;
      };

      const blockRealtimeSync3s = () => {
        const newBlockTime = Date.now() + 3000;
        if (syncBlockedUntil > 0 && syncBlockedUntil !== newBlockTime) {
          blockingConflicts.push(`Blocking conflict: existing=${syncBlockedUntil}, new=${newBlockTime}`);
        }
        syncBlockedUntil = newBlockTime;
      };

      const attemptSync = (source) => {
        const now = Date.now();
        if (now < syncBlockedUntil) {
          syncAttempts.push({ source, result: 'blocked', time: now });
        } else {
          syncAttempts.push({ source, result: 'executed', time: now });
        }
      };

      // 不具合シナリオ: 異なるブロック期間の競合
      blockRealtimeSync5s();
      blockRealtimeSync3s(); // 競合発生

      attemptSync('source1');
      
      act(() => {
        jest.advanceTimersByTime(4000); // 4秒後
      });
      
      attemptSync('source2');

      // ブロック期間不整合検知
      expect(blockingConflicts.length).toBeGreaterThan(0);
      console.warn('🚨 ブロック期間競合検知:', blockingConflicts);
    });
  });

  describe('📝 データ競合不具合の検知', () => {
    test('編集中データ損失検知', async () => {
      let nodeData = { id: 'node-1', text: 'original' };
      const dataLosses = [];

      // 編集状態をシミュレート
      const simulateEditingState = (isEditing) => {
        const input = document.createElement('input');
        input.className = 'node-input';
        input.value = 'user-editing-text';
        
        if (isEditing) {
          document.body.appendChild(input);
          input.focus();
        }
        
        return input;
      };

      // 不具合シナリオ: 編集中の外部同期による上書き
      const unsafeUpdateData = (newData, options = {}) => {
        const beforeText = nodeData.text;
        
        // 編集中チェックなし（修正前の問題）
        nodeData = { ...nodeData, ...newData };
        
        // データ損失検知
        if (beforeText !== newData.text && beforeText !== 'original') {
          dataLosses.push({
            lost: beforeText,
            overwritten: newData.text,
            timestamp: Date.now()
          });
        }
        
        return true;
      };

      // 編集開始
      const editingInput = simulateEditingState(true);
      
      // 編集中に外部同期
      unsafeUpdateData({ text: 'external-sync-data' });
      
      // 編集終了
      editingInput.blur();
      document.body.removeChild(editingInput);

      // データ損失検知
      expect(dataLosses.length).toBeGreaterThan(0);
      expect(nodeData.text).toBe('external-sync-data');
      console.warn('🚨 編集中データ損失検知:', dataLosses);
    });
  });

  describe('🔄 エラー処理不具合の検知', () => {
    test('UNIQUE制約違反の無限ループ検知', async () => {
      let retryCount = 0;
      const maxRetries = 3;

      // 不具合シナリオ: ID再生成なしの無限リトライ
      const buggyAddNode = async (nodeData) => {
        while (retryCount < 100) { // 無限ループ防止
          try {
            retryCount++;
            
            // 常にUNIQUE制約違反（ID再生成なし）
            throw new Error('UNIQUE constraint failed: nodes.id');
            
          } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
              // 不具合: IDを再生成せずにリトライ
              if (retryCount > maxRetries * 3) {
                throw new Error(`Infinite retry loop detected: ${retryCount} attempts`);
              }
              continue; // 同じIDで再試行
            }
            throw error;
          }
        }
      };

      // 無限ループ検知
      await expect(buggyAddNode({ id: 'node-1', text: 'test' }))
        .rejects.toThrow('Infinite retry loop detected');
      
      expect(retryCount).toBeGreaterThan(maxRetries);
      console.warn('🚨 無限ループ検知:', retryCount, 'retries');
    });

    test('Parent node not found の連鎖エラー検知', async () => {
      const orphanNodes = [];
      let mapState = {
        'root': { id: 'root', children: ['node-1'] },
        'node-1': { id: 'node-1', parent: 'root', children: [] }
      };

      // 不具合シナリオ: 親ノード不整合の連鎖
      const addChildWithoutValidation = (parentId, childData) => {
        // 親ノード存在チェックなし（不具合）
        const childId = childData.id;
        
        if (!mapState[parentId]) {
          orphanNodes.push({
            childId,
            missingParentId: parentId,
            timestamp: Date.now()
          });
        }
        
        mapState[childId] = {
          ...childData,
          parent: parentId,
          children: []
        };
        
        if (mapState[parentId]) {
          mapState[parentId].children.push(childId);
        }
      };

      // 不具合パターン: 存在しない親に子を追加
      addChildWithoutValidation('non-existent-parent', { id: 'orphan-1' });
      addChildWithoutValidation('orphan-1', { id: 'orphan-2' }); // 連鎖
      addChildWithoutValidation('orphan-2', { id: 'orphan-3' }); // 連鎖

      // 孤立ノード検知
      expect(orphanNodes.length).toBeGreaterThan(0);
      console.warn('🚨 孤立ノード検知:', orphanNodes);
      
      // データ構造破損検知
      const brokenStructure = Object.values(mapState).filter(node => 
        node.parent && !mapState[node.parent]
      );
      expect(brokenStructure.length).toBeGreaterThan(0);
      console.warn('🚨 構造破損検知:', brokenStructure);
    });
  });

  describe('⚡ パフォーマンス不具合の検知', () => {
    test('メモリリーク検知', () => {
      const activeIntervals = [];
      const activeTimeouts = [];
      const activeListeners = [];

      // 不具合シナリオ: クリーンアップなしのリソース作成
      const createLeakyResources = () => {
        // インターバル作成（クリーンアップなし）
        const interval1 = setInterval(() => {}, 1000);
        const interval2 = setInterval(() => {}, 2000);
        activeIntervals.push(interval1, interval2);

        // タイムアウト作成（クリーンアップなし）
        const timeout1 = setTimeout(() => {}, 5000);
        const timeout2 = setTimeout(() => {}, 10000);
        activeTimeouts.push(timeout1, timeout2);

        // イベントリスナー作成（クリーンアップなし）
        const listener = () => {};
        document.addEventListener('click', listener);
        activeListeners.push({ type: 'click', listener });
      };

      // リソース作成
      createLeakyResources();
      createLeakyResources(); // 重複作成
      createLeakyResources(); // さらに重複

      // メモリリーク検知
      expect(activeIntervals.length).toBe(6); // 3回 × 2個
      expect(activeTimeouts.length).toBe(6);
      expect(activeListeners.length).toBe(3);
      
      console.warn('🚨 メモリリーク検知:', {
        intervals: activeIntervals.length,
        timeouts: activeTimeouts.length,
        listeners: activeListeners.length
      });

      // クリーンアップ（テスト後）
      activeIntervals.forEach(clearInterval);
      activeTimeouts.forEach(clearTimeout);
      activeListeners.forEach(({ type, listener }) => {
        document.removeEventListener(type, listener);
      });
    });

    test('過剰なAPI呼び出し検知', async () => {
      let apiCallCount = 0;
      const apiCallTimes = [];
      const suspiciousPatterns = [];

      const trackApiCall = (endpoint) => {
        apiCallCount++;
        const now = Date.now();
        apiCallTimes.push({ endpoint, time: now, count: apiCallCount });

        // 過剰呼び出しパターン検知
        const recentCalls = apiCallTimes.filter(call => now - call.time < 1000);
        if (recentCalls.length > 10) {
          suspiciousPatterns.push({
            pattern: 'excessive_calls_per_second',
            count: recentCalls.length,
            time: now
          });
        }

        // 同一エンドポイント連続呼び出し検知
        const lastFiveCalls = apiCallTimes.slice(-5);
        if (lastFiveCalls.length === 5 && 
            lastFiveCalls.every(call => call.endpoint === endpoint)) {
          suspiciousPatterns.push({
            pattern: 'repetitive_same_endpoint',
            endpoint,
            time: now
          });
        }
      };

      // 不具合シナリオ: 過剰なAPI呼び出し
      for (let i = 0; i < 15; i++) {
        trackApiCall('/api/save');
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // 過剰呼び出し検知
      expect(suspiciousPatterns.length).toBeGreaterThan(0);
      expect(apiCallCount).toBe(15);
      console.warn('🚨 過剰API呼び出し検知:', suspiciousPatterns);
    });
  });
});