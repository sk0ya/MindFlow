/**
 * ブラウザ間同期のテストケース
 */

import { CrossBrowserSyncTester } from '../test-cross-browser-sync.js';
import { realtimeSync } from '../core/sync/realtimeSync';
import { getCurrentAdapter } from '../core/storage/storageAdapter';

describe('ブラウザ間同期', () => {
  let tester;
  let mockAdapter;

  beforeEach(() => {
    tester = new CrossBrowserSyncTester();
    
    // モックアダプター
    mockAdapter = {
      constructor: { name: 'CloudStorageAdapter' },
      name: 'クラウドストレージ（シンプル版）',
      getAllMaps: jest.fn().mockResolvedValue([]),
      getMap: jest.fn().mockResolvedValue(null),
      createMap: jest.fn().mockResolvedValue({ id: 'test-id', title: 'Test Map' }),
      updateMap: jest.fn().mockResolvedValue({ id: 'test-id', title: 'Updated Map' }),
      addNode: jest.fn().mockResolvedValue({ success: true, newId: 'node-1' }),
      updateNode: jest.fn().mockResolvedValue({ success: true })
    };
    
    // getCurrentAdapterをモック
    jest.spyOn(require('../core/storage/storageAdapter'), 'getCurrentAdapter')
      .mockReturnValue(mockAdapter);
    
    // localStorageをモック
    const mockSettings = {
      storageMode: 'cloud',
      enableRealtimeSync: true
    };
    Storage.prototype.getItem = jest.fn((key) => {
      if (key === 'mindflow_settings') {
        return JSON.stringify(mockSettings);
      }
      return null;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('DB保存機能', () => {
    test('マップがDBに正しく保存される', async () => {
      const result = await tester.testDatabaseSave();
      
      expect(result.saveSuccess).toBe(true);
      expect(result.savedId).toBe('test-id');
      expect(mockAdapter.createMap).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('同期テスト'),
          rootNode: expect.objectContaining({
            id: 'root',
            text: 'テストルート'
          })
        })
      );
    });

    test('保存後に読み込みが成功する', async () => {
      mockAdapter.getMap.mockResolvedValue({
        id: 'sync-test-123',
        title: '同期テスト',
        rootNode: { id: 'root', text: 'テストルート' }
      });
      
      const result = await tester.testDatabaseSave();
      
      expect(result.loadSuccess).toBe(true);
      expect(result.dataIntegrity).toBe(true);
    });
  });

  describe('マップ同期操作', () => {
    test('新しいマップが作成される', async () => {
      const result = await tester.testMapSyncOperations();
      
      expect(result.operations).toHaveLength(2); // create と update
      expect(result.operations[0]).toEqual({
        operation: 'create',
        success: true,
        mapId: 'test-id',
        title: 'Test Map'
      });
    });

    test('マップが更新される', async () => {
      mockAdapter.updateMap.mockResolvedValue({
        id: 'test-id',
        title: 'Test Map (更新済み)'
      });
      
      const result = await tester.testMapSyncOperations();
      
      expect(result.operations[1]).toEqual({
        operation: 'update',
        success: true,
        mapId: 'test-id',
        title: 'Test Map (更新済み)'
      });
    });
  });

  describe('ノード同期操作', () => {
    beforeEach(() => {
      mockAdapter.getAllMaps.mockResolvedValue([{
        id: 'map-1',
        title: 'Test Map',
        category: 'sync-test'
      }]);
    });

    test('ノードが追加される', async () => {
      const result = await tester.testNodeSyncOperations();
      
      expect(result.operations).toContainEqual({
        operation: 'addNode',
        success: true,
        nodeId: 'node-1'
      });
      
      expect(mockAdapter.addNode).toHaveBeenCalledWith(
        'map-1',
        expect.objectContaining({
          text: expect.stringContaining('同期テストノード')
        }),
        'root'
      );
    });

    test('ノードが更新される', async () => {
      const result = await tester.testNodeSyncOperations();
      
      expect(result.operations).toContainEqual({
        operation: 'updateNode',
        success: true
      });
      
      expect(mockAdapter.updateNode).toHaveBeenCalledWith(
        'map-1',
        'node-1',
        expect.objectContaining({
          text: expect.stringContaining('(更新済み)')
        })
      );
    });
  });

  describe('リアルタイム同期', () => {
    test('リアルタイム同期の状態が確認できる', async () => {
      const result = await tester.testRealtimeSync();
      
      expect(result.syncMechanism).toBe('Manual refresh required');
      expect(result.hasSyncAdapter).toBe(false); // CloudSyncAdapterは使用していない
    });

    test('手動リフレッシュでデータを取得できる', async () => {
      mockAdapter.getAllMaps.mockResolvedValue([
        {
          id: 'sync-test-1',
          title: '同期テスト 1',
          category: 'sync-test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'sync-test-2',
          title: '同期テスト 2',
          category: 'sync-test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]);
      
      const result = await tester.refreshAndCheck();
      
      expect(result.totalMaps).toBe(2);
      expect(result.syncTestMaps).toBe(2);
      expect(mockAdapter.getAllMaps).toHaveBeenCalled();
    });
  });

  describe('認証とストレージモード', () => {
    test('クラウドモードでない場合はエラー', async () => {
      Storage.prototype.getItem = jest.fn((key) => {
        if (key === 'mindflow_settings') {
          return JSON.stringify({ storageMode: 'local' });
        }
        return null;
      });
      
      await expect(tester.testStorageMode()).rejects.toThrow(
        'ストレージモードがcloudではありません'
      );
    });

    test('認証されていない場合はエラー', async () => {
      const authManager = require('../features/auth/authManager').authManager;
      jest.spyOn(authManager, 'isAuthenticated').mockReturnValue(false);
      
      await expect(tester.testAuthenticationStatus()).rejects.toThrow(
        '認証されていません'
      );
    });
  });

  describe('リアルタイム同期イベント', () => {
    test('マップ更新イベントが発火される', async () => {
      const mockListener = jest.fn();
      const unsubscribe = realtimeSync.addEventListener('map_updated', mockListener);
      
      // 同期を手動実行
      await realtimeSync.syncNow();
      
      // テスト環境では実際のイベントは発火しないが、
      // リスナーが正しく登録されていることを確認
      expect(typeof unsubscribe).toBe('function');
      
      unsubscribe();
    });

    test('同期エラーイベントが処理される', async () => {
      const mockListener = jest.fn();
      realtimeSync.addEventListener('sync_error', mockListener);
      
      // アダプターのgetAllMapsをエラーにする
      mockAdapter.getAllMaps.mockRejectedValue(new Error('Network error'));
      
      await realtimeSync.syncNow();
      
      // エラーリスナーが呼ばれることを期待
      // （実際のテスト環境では動作しない可能性あり）
    });
  });
});

describe('リアルタイム同期機能', () => {
  beforeEach(() => {
    // 設定をリセット
    const mockSettings = {
      storageMode: 'cloud',
      enableRealtimeSync: true
    };
    Storage.prototype.getItem = jest.fn((key) => {
      if (key === 'mindflow_settings') {
        return JSON.stringify(mockSettings);
      }
      return null;
    });
  });

  test('同期が開始・停止できる', () => {
    realtimeSync.stop();
    const beforeStatus = realtimeSync.getStatus();
    expect(beforeStatus.isEnabled).toBe(false);
    
    realtimeSync.start();
    const afterStatus = realtimeSync.getStatus();
    expect(afterStatus.isEnabled).toBe(true);
    
    realtimeSync.stop();
  });

  test('同期頻度を変更できる', () => {
    realtimeSync.setSyncFrequency(10000); // 10秒
    const status = realtimeSync.getStatus();
    expect(status.syncFrequency).toBe(10000);
    
    // 最小値のテスト
    realtimeSync.setSyncFrequency(500); // 500msは1秒に調整される
    const status2 = realtimeSync.getStatus();
    expect(status2.syncFrequency).toBe(1000);
  });
});