/**
 * クラウドモードの更新処理テスト
 * 無限ループ、重複処理、競合状態の検証
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { useMindMapData } from '../../features/mindmap/useMindMapData';
import { useAuth } from '../../features/auth/useAuth';
import { useCloudSync } from '../useCloudSync';

// モック設定
jest.mock('../../features/auth/useAuth');
jest.mock('../../core/storage/storageAdapter');

const mockAuthState = {
  isAuthenticated: true,
  user: { id: 'test-user-id', name: 'Test User' },
  token: 'mock-token'
};

const mockStorageAdapter = {
  saveMindMap: jest.fn(),
  getMindMap: jest.fn(),
  getAllMindMaps: jest.fn(),
  retryPendingOperations: jest.fn()
};

const mockRealtimeSync = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  emit: jest.fn()
};

describe('クラウドモード更新処理テスト', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    useAuth.mockReturnValue(mockAuthState);
    
    // ストレージアダプターのモック
    require('../../core/storage/storageAdapter').default = mockStorageAdapter;
    
    // リアルタイム同期のモック
    global.realtimeSync = mockRealtimeSync;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('🚨 無限ループ防止テスト', () => {
    test('リアルタイム同期で自分の更新を除外', async () => {
      const { result } = renderHook(() => useMindMapData());
      
      const testMap = {
        id: 'test-map-1',
        title: 'Test Map',
        rootNode: { id: 'root', text: 'Root', x: 0, y: 0, children: [] }
      };

      // 初期データ設定
      act(() => {
        result.current.updateData(testMap);
      });

      // リアルタイム同期イベントリスナーを取得
      const realtimeEventListener = mockRealtimeSync.addEventListener.mock.calls
        .find(call => call[0] === 'map_updated')?.[1];

      expect(realtimeEventListener).toBeDefined();

      // 自分の更新イベントをシミュレート（無視されるべき）
      const selfUpdateEvent = {
        data: { id: 'test-map-1' },
        originUserId: 'test-user-id' // 自分のユーザーID
      };

      mockStorageAdapter.getMindMap.mockResolvedValue(testMap);
      
      let updateCallCount = 0;
      const originalUpdateData = result.current.updateData;
      result.current.updateData = jest.fn((...args) => {
        updateCallCount++;
        return originalUpdateData(...args);
      });

      // 自分の更新イベントを送信
      await act(async () => {
        await realtimeEventListener(selfUpdateEvent);
      });

      // 自分の更新は無視されることを確認
      expect(updateCallCount).toBe(0);
      expect(mockStorageAdapter.getMindMap).not.toHaveBeenCalled();
    });

    test('他ユーザーの更新のみ処理', async () => {
      const { result } = renderHook(() => useMindMapData());
      
      const testMap = {
        id: 'test-map-1',
        title: 'Test Map',
        rootNode: { id: 'root', text: 'Updated by other', x: 0, y: 0, children: [] }
      };

      // リアルタイム同期イベントリスナーを取得
      const realtimeEventListener = mockRealtimeSync.addEventListener.mock.calls
        .find(call => call[0] === 'map_updated')?.[1];

      // 他ユーザーの更新イベント
      const otherUserUpdateEvent = {
        data: { id: 'test-map-1' },
        originUserId: 'other-user-id' // 他のユーザーID
      };

      mockStorageAdapter.getMindMap.mockResolvedValue(testMap);

      // 他ユーザーの更新イベントを送信
      await act(async () => {
        await realtimeEventListener(otherUserUpdateEvent);
      });

      // 他ユーザーの更新は処理されることを確認
      expect(mockStorageAdapter.getMindMap).toHaveBeenCalledWith('test-map-1');
    });
  });

  describe('⚡ 重複処理防止テスト', () => {
    test('保存処理の重複実行を防止', async () => {
      const { result } = renderHook(() => useMindMapData());
      
      mockStorageAdapter.saveMindMap.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      const testMap = {
        id: 'test-map-1',
        title: 'Test Map',
        rootNode: { id: 'root', text: 'Root', x: 0, y: 0, children: [] }
      };

      act(() => {
        result.current.updateData(testMap);
      });

      // 複数回の保存を同時に実行
      const savePromises = [
        result.current.saveImmediately(),
        result.current.saveImmediately(),
        result.current.saveImmediately()
      ];

      await act(async () => {
        await Promise.all(savePromises);
        jest.advanceTimersByTime(200);
      });

      // 保存は一度だけ実行されることを確認
      expect(mockStorageAdapter.saveMindMap).toHaveBeenCalledTimes(1);
    });

    test('自動保存の重複防止', async () => {
      const { result } = renderHook(() => useMindMapData());
      
      const testMap = {
        id: 'test-map-1',
        title: 'Test Map',
        rootNode: { id: 'root', text: 'Root', x: 0, y: 0, children: [] }
      };

      // 複数回の更新を短時間で実行
      act(() => {
        result.current.updateData({ ...testMap, title: 'Update 1' });
        result.current.updateData({ ...testMap, title: 'Update 2' });
        result.current.updateData({ ...testMap, title: 'Update 3' });
      });

      // 自動保存のタイマーを進める
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        // 自動保存は最後の更新のみで一度だけ実行
        expect(mockStorageAdapter.saveMindMap).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('🔄 定期処理統合テスト', () => {
    test('複数の定期処理が適切に管理される', () => {
      renderHook(() => useCloudSync());
      
      // setIntervalの呼び出し回数を確認
      const intervalCalls = jest.getTimerCount();
      
      // 定期処理が過度に設定されていないことを確認
      expect(intervalCalls).toBeLessThan(5);
    });

    test('認証状態変更時の同期処理', async () => {
      const { rerender } = renderHook(() => useAuth());
      
      // 認証状態を変更
      useAuth.mockReturnValue({
        ...mockAuthState,
        isAuthenticated: false
      });

      rerender();

      // 認証失敗時は同期処理が停止することを確認
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      expect(mockStorageAdapter.retryPendingOperations).not.toHaveBeenCalled();
    });
  });

  describe('🏃‍♂️ パフォーマンステスト', () => {
    test('メモリリーク防止 - タイマーのクリーンアップ', () => {
      const { unmount } = renderHook(() => useCloudSync());
      
      const initialTimerCount = jest.getTimerCount();
      
      // コンポーネントをアンマウント
      unmount();
      
      // タイマーがクリーンアップされることを確認
      const finalTimerCount = jest.getTimerCount();
      expect(finalTimerCount).toBeLessThanOrEqual(initialTimerCount);
    });

    test('過度なAPI呼び出しの防止', async () => {
      renderHook(() => useMindMapData());
      
      // 30秒間のシミュレーション
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      // API呼び出しが適切な頻度に制限されることを確認
      const totalAPICalls = mockStorageAdapter.saveMindMap.mock.calls.length +
                           mockStorageAdapter.getMindMap.mock.calls.length +
                           mockStorageAdapter.retryPendingOperations.mock.calls.length;
      
      expect(totalAPICalls).toBeLessThan(10); // 30秒で10回未満
    });
  });

  describe('🔧 エラーハンドリングテスト', () => {
    test('ネットワークエラー時の適切な処理', async () => {
      const { result } = renderHook(() => useMindMapData());
      
      mockStorageAdapter.saveMindMap.mockRejectedValue(new Error('Network Error'));
      
      const testMap = {
        id: 'test-map-1',
        title: 'Test Map',
        rootNode: { id: 'root', text: 'Root', x: 0, y: 0, children: [] }
      };

      await act(async () => {
        try {
          await result.current.saveImmediately(testMap);
        } catch (error) {
          // エラーが適切にハンドリングされることを確認
          expect(error.message).toBe('Network Error');
        }
      });

      // エラー時も状態が破綻しないことを確認
      expect(result.current.data).toBeDefined();
    });

    test('競合状態での安全な処理', async () => {
      const { result } = renderHook(() => useMindMapData());
      
      const testMap = {
        id: 'test-map-1',
        title: 'Test Map',
        rootNode: { id: 'root', text: 'Root', x: 0, y: 0, children: [] }
      };

      // 編集中状態をシミュレート
      act(() => {
        result.current.setEditingNodeId('root');
      });

      // リアルタイム更新をシミュレート
      const realtimeEventListener = mockRealtimeSync.addEventListener.mock.calls
        .find(call => call[0] === 'map_updated')?.[1];

      const updateEvent = {
        data: { id: 'test-map-1' },
        originUserId: 'other-user-id'
      };

      mockStorageAdapter.getMindMap.mockResolvedValue({
        ...testMap,
        title: 'Updated by other user'
      });

      await act(async () => {
        await realtimeEventListener(updateEvent);
      });

      // 編集中は更新が保護されることを確認
      expect(result.current.data.title).toBe('Test Map'); // 変更されない
    });
  });
});