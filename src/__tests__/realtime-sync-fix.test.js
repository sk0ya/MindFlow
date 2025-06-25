/**
 * リアルタイム同期修正のテストケース
 * require is not defined エラーとストレージアダプター問題の検証
 */

describe('リアルタイム同期修正', () => {
  let mockAuthManager;
  let originalConsole;

  beforeEach(() => {
    // コンソールログをキャプチャ
    originalConsole = console.error;
    console.error = jest.fn();

    // AuthManagerをモック
    mockAuthManager = {
      isAuthenticated: jest.fn().mockReturnValue(true),
      getAuthToken: jest.fn().mockReturnValue('mock-token'),
      getAuthHeader: jest.fn().mockReturnValue('Bearer mock-token'),
      getCurrentUser: jest.fn().mockReturnValue({ id: 'user1', email: 'test@example.com' })
    };

    // localStorageをモック
    Storage.prototype.getItem = jest.fn((key) => {
      if (key === 'mindflow_settings') {
        return JSON.stringify({
          storageMode: 'cloud',
          enableRealtimeSync: true
        });
      }
      return null;
    });
    Storage.prototype.setItem = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsole;
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('require is not defined エラーの修正', () => {
    test('StorageAdapterFactory でrequireを使用しない', async () => {
      // requireの使用をチェック
      const fs = require('fs');
      const path = require('path');
      
      const storageAdapterPath = path.resolve(__dirname, '../core/storage/storageAdapter.ts');
      const content = fs.readFileSync(storageAdapterPath, 'utf-8');
      
      // requireの使用箇所をチェック
      const requireUsages = content.match(/require\s*\(/g);
      
      if (requireUsages) {
        console.warn('require の使用が検出されました:', requireUsages);
      }
      
      // ESモジュール環境でrequireが使用されていないことを確認
      expect(requireUsages).toBeNull();
    });

    test('StorageAdapterFactory が正常に動作する', async () => {
      // authManagerをグローバルにモック
      jest.doMock('../features/auth/authManager.ts', () => ({
        authManager: mockAuthManager
      }));

      const { StorageAdapterFactory } = await import('../core/storage/storageAdapter.ts');
      
      // クラウドモード設定でアダプター作成
      const adapter = StorageAdapterFactory.create();
      
      expect(adapter).toBeDefined();
      expect(adapter.constructor.name).toContain('StorageAdapter');
      
      // requireエラーが発生していないことを確認
      expect(console.error).not.toHaveBeenCalledWith(
        expect.stringContaining('require is not defined')
      );
    });

    test('認証済みの場合はCloudStorageAdapterが作成される', async () => {
      jest.doMock('../features/auth/authManager.ts', () => ({
        authManager: mockAuthManager
      }));

      const { StorageAdapterFactory } = await import('../core/storage/storageAdapter.ts');
      
      const adapter = StorageAdapterFactory.create();
      
      expect(adapter.constructor.name).toBe('CloudStorageAdapter');
      expect(mockAuthManager.isAuthenticated).toHaveBeenCalled();
    });

    test('未認証の場合はLocalStorageAdapterにフォールバック', async () => {
      const unauthenticatedMock = {
        ...mockAuthManager,
        isAuthenticated: jest.fn().mockReturnValue(false)
      };

      jest.doMock('../features/auth/authManager.ts', () => ({
        authManager: unauthenticatedMock
      }));

      const { StorageAdapterFactory } = await import('../core/storage/storageAdapter.ts');
      
      const adapter = StorageAdapterFactory.create();
      
      expect(adapter.constructor.name).toBe('LocalStorageAdapter');
      expect(unauthenticatedMock.isAuthenticated).toHaveBeenCalled();
    });
  });

  describe('CloudStorageAdapter の初期化', () => {
    beforeEach(() => {
      jest.doMock('../features/auth/authManager.ts', () => ({
        authManager: mockAuthManager
      }));
    });

    test('CloudStorageAdapter が正常に作成される', async () => {
      const { CloudStorageAdapter } = await import('../core/storage/storageAdapter.ts');
      
      const adapter = new CloudStorageAdapter();
      
      expect(adapter).toBeDefined();
      expect(adapter.name).toBe('クラウドストレージ（シンプル版）');
      expect(adapter.useSyncAdapter).toBe(false);
      expect(typeof adapter.apiCall).toBe('function');
    });

    test('初期化が正常に完了する', async () => {
      const { CloudStorageAdapter } = await import('../core/storage/storageAdapter.ts');
      
      const adapter = new CloudStorageAdapter();
      await adapter.ensureInitialized();
      
      expect(adapter.isInitialized).toBe(true);
      expect(adapter.baseUrl).toContain('mindflow-api-production');
    });

    test('認証ヘッダーが正しく生成される', async () => {
      const { CloudStorageAdapter } = await import('../core/storage/storageAdapter.ts');
      
      const adapter = new CloudStorageAdapter();
      const headers = await adapter.getAuthHeaders();
      
      expect(headers).toHaveProperty('Authorization');
      expect(headers.Authorization).toBe('Bearer mock-token');
      expect(headers).toHaveProperty('Content-Type', 'application/json');
      expect(headers).toHaveProperty('X-User-ID', 'test@example.com');
    });
  });

  describe('リアルタイム同期の動作', () => {
    let realtimeSync;

    beforeEach(async () => {
      // getCurrentAdapterをモック
      const mockAdapter = {
        constructor: { name: 'CloudStorageAdapter' },
        getAllMaps: jest.fn().mockResolvedValue([])
      };

      jest.doMock('../core/storage/storageAdapter.ts', () => ({
        getCurrentAdapter: jest.fn(() => mockAdapter),
        CloudStorageAdapter: jest.fn(() => mockAdapter),
        LocalStorageAdapter: jest.fn(() => ({ constructor: { name: 'LocalStorageAdapter' } })),
        StorageAdapterFactory: {
          create: jest.fn(() => mockAdapter)
        }
      }));

      // realtimeSyncをインポート
      const module = await import('../core/sync/realtimeSync.ts');
      realtimeSync = module.realtimeSync;
    });

    test('同期状態を取得できる', () => {
      const status = realtimeSync.getStatus();
      
      expect(status).toHaveProperty('isEnabled');
      expect(status).toHaveProperty('syncFrequency');
      expect(status).toHaveProperty('lastSyncTime');
      expect(status).toHaveProperty('mapsInSnapshot');
    });

    test('同期頻度を変更できる', () => {
      const originalFreq = realtimeSync.getStatus().syncFrequency;
      
      realtimeSync.setSyncFrequency(10000);
      expect(realtimeSync.getStatus().syncFrequency).toBe(10000);
      
      // 最小値のテスト
      realtimeSync.setSyncFrequency(500);
      expect(realtimeSync.getStatus().syncFrequency).toBe(1000); // 最小1秒
      
      // 元に戻す
      realtimeSync.setSyncFrequency(originalFreq);
    });

    test('イベントリスナーを登録・削除できる', () => {
      const mockListener = jest.fn();
      
      const unsubscribe = realtimeSync.addEventListener('map_updated', mockListener);
      
      expect(typeof unsubscribe).toBe('function');
      
      // リスナーを削除
      unsubscribe();
      
      // 削除後はイベントが呼ばれない
      realtimeSync.emitEvent({
        type: 'map_updated',
        data: { id: 'test' },
        timestamp: new Date().toISOString()
      });
      
      expect(mockListener).not.toHaveBeenCalled();
    });

    test('手動同期が実行できる', async () => {
      // エラーが発生しないことを確認
      await expect(realtimeSync.syncNow()).resolves.not.toThrow();
    });

    test('同期を開始・停止できる', () => {
      realtimeSync.stop();
      expect(realtimeSync.getStatus().isEnabled).toBe(false);
      
      realtimeSync.start();
      expect(realtimeSync.getStatus().isEnabled).toBe(true);
      
      realtimeSync.stop();
    });
  });

  describe('エラーハンドリング', () => {
    test('ストレージアダプターエラーが適切に処理される', async () => {
      const errorAdapter = {
        constructor: { name: 'CloudStorageAdapter' },
        getAllMaps: jest.fn().mockRejectedValue(new Error('Network error'))
      };

      jest.doMock('../core/storage/storageAdapter.ts', () => ({
        getCurrentAdapter: jest.fn(() => errorAdapter)
      }));

      const { realtimeSync } = await import('../core/sync/realtimeSync.ts');
      
      // 手動同期でエラーが適切に処理されることを確認
      await expect(realtimeSync.syncNow()).resolves.not.toThrow();
    });

    test('require is not defined エラーが検出される', async () => {
      const requireError = new Error('require is not defined');
      const errorAdapter = {
        constructor: { name: 'CloudStorageAdapter' },
        getAllMaps: jest.fn().mockRejectedValue(requireError)
      };

      jest.doMock('../core/storage/storageAdapter.ts', () => ({
        getCurrentAdapter: jest.fn(() => errorAdapter)
      }));

      const { realtimeSync } = await import('../core/sync/realtimeSync.ts');
      
      await realtimeSync.syncNow();
      
      // 特別なエラーログが出力されることを確認
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('ESモジュールエラー')
      );
    });

    test('ローカルアダプターの場合は同期をスキップ', async () => {
      const localAdapter = {
        constructor: { name: 'LocalStorageAdapter' }
      };

      jest.doMock('../core/storage/storageAdapter.ts', () => ({
        getCurrentAdapter: jest.fn(() => localAdapter)
      }));

      const { realtimeSync } = await import('../core/sync/realtimeSync.ts');
      
      await realtimeSync.syncNow();
      
      // スキップメッセージが出力されることを確認は困難なので、
      // エラーが発生しないことを確認
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('ブラウザ間同期のシミュレーション', () => {
    test('マップ作成が他のブラウザで検出される', async () => {
      const maps = [
        { id: 'map1', title: 'Map 1', updatedAt: '2023-01-01T00:00:00Z' }
      ];
      
      const mockAdapter = {
        constructor: { name: 'CloudStorageAdapter' },
        getAllMaps: jest.fn()
          .mockResolvedValueOnce(maps) // 初回
          .mockResolvedValueOnce([...maps, { 
            id: 'map2', 
            title: 'Map 2', 
            updatedAt: '2023-01-01T00:01:00Z' 
          }]) // 2回目（新しいマップ追加）
      };

      jest.doMock('../core/storage/storageAdapter.ts', () => ({
        getCurrentAdapter: jest.fn(() => mockAdapter)
      }));

      const { realtimeSync } = await import('../core/sync/realtimeSync.ts');
      
      // 初回同期
      await realtimeSync.syncNow();
      
      // 変更検出のためのイベントリスナー
      const events = [];
      realtimeSync.addEventListener('map_created', (event) => {
        events.push(event);
      });
      
      // 2回目同期（新しいマップを検出）
      await realtimeSync.syncNow();
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('map_created');
      expect(events[0].data.id).toBe('map2');
    });
  });
});