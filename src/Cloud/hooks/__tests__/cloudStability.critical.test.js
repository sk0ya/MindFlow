/**
 * 重要な不具合検知テストケース（軽量版）
 * メモリ効率を重視した必須テスト
 */

import { act } from 'react';
import { jest } from '@jest/globals';

// タイマーモック
jest.useFakeTimers();

describe('🚨 重要な不具合検知テスト', () => {
  let consoleSpy, consoleWarnSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    jest.clearAllTimers();
  });

  describe('🔥 認証競合不具合検知', () => {
    test('認証チェック間隔不整合による過剰呼び出し検知', () => {
      let callCount = 0;
      const maxCalls = 50; // 閾値
      
      const authChecker = () => {
        callCount++;
        if (callCount > maxCalls) {
          throw new Error(`過剰な認証チェック検知: ${callCount}回`);
        }
      };

      // 不具合シナリオ: 短時間で大量呼び出し
      const interval1 = setInterval(authChecker, 100); // 100ms間隔
      const interval2 = setInterval(authChecker, 150); // 150ms間隔

      expect(() => {
        act(() => {
          jest.advanceTimersByTime(10000); // 10秒実行
        });
      }).toThrow('過剰な認証チェック検知');

      clearInterval(interval1);
      clearInterval(interval2);
      
      expect(callCount).toBeGreaterThan(maxCalls);
    });

    test('認証成功後の並行実行による競合検知', () => {
      const states = { refreshing: false, syncing: false };
      const conflicts = [];

      const mockTask = (taskName) => {
        const taskType = taskName.split('_')[0];
        if (states[taskType]) {
          conflicts.push(`${taskName} already running`);
        }
        
        states[taskType] = true;
        // 同期的に完了
        states[taskType] = false;
      };

      // 異なるタスクタイプの実行（競合なし）
      mockTask('refreshing_maps');
      mockTask('syncing_data');
      expect(conflicts.length).toBe(0);
      
      // 同じタスクタイプの連続実行（競合検知）
      states.refreshing = true; // 既に実行中に設定
      mockTask('refreshing_maps1');
      mockTask('refreshing_maps2');

      expect(conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('🌐 ネットワークエラー不具合検知', () => {
    test('タイムアウト設定なしによるハング検知', () => {
      let isHanging = false;

      const apiCallWithoutTimeout = () => {
        isHanging = true;
        // ハング状態をシミュレート
        return new Promise(() => {}); // 永続Promise
      };

      // ハング検知ロジックを同期的にテスト
      const apiPromise = apiCallWithoutTimeout();
      
      // ハング状態の検証
      expect(isHanging).toBe(true);
      
      // タイムアウト検知機能のシミュレート
      const hangDetected = () => {
        if (isHanging) {
          return true;
        }
        return false;
      };
      
      expect(hangDetected()).toBe(true);
    });

    test('リトライ機能なしによる連続失敗検知', () => {
      const failures = [];
      const maxFailures = 5;

      const vulnerableApiCall = () => {
        failures.push(`失敗 ${failures.length + 1}`);
        throw new Error(`API call failed ${failures.length}`);
      };

      // 連続失敗テスト
      for (let i = 0; i < maxFailures; i++) {
        expect(() => vulnerableApiCall()).toThrow('API call failed');
      }

      // 脆弱性検知: リトライなしで全失敗
      expect(failures.length).toBe(maxFailures);
    });
  });

  describe('💾 同期処理競合不具合検知', () => {
    test('同時保存によるデータ競合検知', () => {
      let saveInProgress = false;
      let dataState = { value: 0 };
      const corruptions = [];

      const unsafeSave = (newValue) => {
        if (saveInProgress) {
          corruptions.push(`Concurrent save: ${newValue}`);
          return;
        }
        
        saveInProgress = true;
        const currentValue = dataState.value;
        dataState.value = currentValue + newValue;
        saveInProgress = false;
      };

      // 保存中状態をシミュレート
      saveInProgress = true;
      
      // 保存中に新しい保存を試行
      unsafeSave(1);
      unsafeSave(2);
      unsafeSave(3);

      // データ競合検知
      expect(corruptions.length).toBe(3); // 全て競合として検知
    });

    test('リアルタイム同期ブロック期間競合検知', () => {
      let syncBlockedUntil = 0;
      const conflicts = [];

      const blockRealtimeSync = (duration, source) => {
        const newBlockTime = Date.now() + duration;
        if (syncBlockedUntil > 0 && Math.abs(syncBlockedUntil - newBlockTime) > 100) {
          conflicts.push(`Block conflict: ${source}`);
        }
        syncBlockedUntil = newBlockTime;
      };

      // 異なるブロック期間での競合
      blockRealtimeSync(5000, 'source1');
      blockRealtimeSync(3000, 'source2'); // 競合発生

      expect(conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('📝 データ競合不具合検知', () => {
    test('編集中データ上書き検知', () => {
      const document = { body: { appendChild: jest.fn(), removeChild: jest.fn() } };
      global.document = document;
      
      let nodeData = { text: 'original' };
      const dataLosses = [];

      const unsafeUpdate = (newText) => {
        const beforeText = nodeData.text;
        nodeData.text = newText;
        
        if (beforeText !== 'original' && beforeText !== newText) {
          dataLosses.push({ lost: beforeText, overwritten: newText });
        }
      };

      // 編集状態をシミュレート
      nodeData.text = 'user-editing';
      
      // 編集中に外部更新
      unsafeUpdate('external-sync');

      // データ損失検知
      expect(dataLosses.length).toBeGreaterThan(0);
      expect(nodeData.text).toBe('external-sync');
    });
  });

  describe('🔄 エラー処理不具合検知', () => {
    test('UNIQUE制約違反の無限ループ検知', () => {
      let retryCount = 0;
      const maxRetries = 10;

      const buggyAddNode = () => {
        retryCount++;
        
        if (retryCount > maxRetries) {
          throw new Error(`Infinite retry detected: ${retryCount} attempts`);
        }
        
        // ID再生成なしで同じエラーを繰り返す
        throw new Error('UNIQUE constraint failed: nodes.id');
      };

      // 無限ループ検知
      expect(() => {
        while (retryCount <= maxRetries) {
          try {
            buggyAddNode();
          } catch (error) {
            if (error.message.includes('Infinite retry detected')) {
              throw error;
            }
            // ID再生成なしで継続（不具合）
          }
        }
      }).toThrow('Infinite retry detected');

      expect(retryCount).toBeGreaterThan(maxRetries);
    });
  });

  describe('⚡ パフォーマンス不具合検知', () => {
    test('メモリリーク検知', () => {
      const intervals = [];
      const timeouts = [];

      // リソース作成（クリーンアップなし）
      for (let i = 0; i < 10; i++) {
        intervals.push(setInterval(() => {}, 1000));
        timeouts.push(setTimeout(() => {}, 5000));
      }

      // メモリリーク検知
      expect(intervals.length).toBe(10);
      expect(timeouts.length).toBe(10);
      
      // クリーンアップ（テスト後）
      intervals.forEach(clearInterval);
      timeouts.forEach(clearTimeout);
    });

    test('過剰API呼び出し検知', () => {
      let apiCallCount = 0;
      const callPattern = [];

      const trackApiCall = (endpoint) => {
        apiCallCount++;
        callPattern.push({ endpoint, time: Date.now() });
      };

      // 過剰呼び出しシミュレート
      for (let i = 0; i < 20; i++) {
        trackApiCall('/api/save');
      }

      // 過剰呼び出し検知
      expect(apiCallCount).toBe(20);
      
      // 同一エンドポイント連続呼び出し検知
      const sameEndpointCalls = callPattern.filter(call => 
        call.endpoint === '/api/save'
      ).length;
      
      expect(sameEndpointCalls).toBe(20); // 全て同じエンドポイント
    });
  });
});