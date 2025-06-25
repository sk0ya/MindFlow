/**
 * クラウドモード無限ループテスト
 * リアルタイム同期の循環参照問題を検証
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';

// 基本的なモック設定
const mockRealtimeSync = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  emit: jest.fn(),
  isConnected: true
};

const mockStorageRouter = {
  saveMindMap: jest.fn(),
  getMindMap: jest.fn(),
  getCurrentMindMap: jest.fn(),
  getAllMindMaps: jest.fn()
};

const mockAuthManager = {
  getAuthState: jest.fn(() => ({
    isAuthenticated: true,
    user: { id: 'test-user-123' }
  }))
};

// モジュールモック
jest.mock('../../core/sync/realtimeSync.js', () => ({
  realtimeSync: mockRealtimeSync
}));

jest.mock('../../core/storage/storageRouter.js', () => mockStorageRouter);

jest.mock('../../features/auth/authManager.js', () => ({
  authManager: mockAuthManager
}));

jest.mock('../../core/storage/storageUtils.js', () => ({
  getAppSettings: jest.fn(() => ({ autoSave: true }))
}));

jest.mock('../../shared/types/dataTypes.js', () => ({
  deepClone: jest.fn(obj => JSON.parse(JSON.stringify(obj))),
  assignColorsToExistingNodes: jest.fn(data => data),
  createInitialData: jest.fn(() => ({
    id: 'initial',
    title: 'New Map',
    rootNode: { id: 'root', text: 'Root', x: 0, y: 0, children: [] }
  }))
}));

describe('🚨 クラウドモード無限ループテスト', () => {
  let useMindMapData;
  
  beforeAll(async () => {
    // 動的インポートでuseMindMapDataを取得
    const module = await import('../../features/mindmap/useMindMapData.ts');
    useMindMapData = module.useMindMapData;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    // リアルタイム同期の初期化
    mockRealtimeSync.addEventListener.mockClear();
    mockRealtimeSync.removeEventListener.mockClear();
    mockRealtimeSync.emit.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('リアルタイム同期の一時ブロック機能による無限ループ防止', async () => {
    const { result } = renderHook(() => useMindMapData(true));
    
    // 初期データを設定
    const testMap = {
      id: 'test-map-1',
      title: 'Test Map',
      rootNode: { id: 'root', text: 'Root Node', x: 0, y: 0, children: [] }
    };

    await act(async () => {
      result.current.updateData(testMap);
    });

    // 保存処理を実行（一時ブロックがトリガーされる）
    await act(async () => {
      await result.current.saveImmediately();
    });

    // リアルタイム同期のイベントリスナーを取得
    const mapUpdatedListener = mockRealtimeSync.addEventListener.mock.calls
      .find(call => call[0] === 'map_updated');
    
    expect(mapUpdatedListener).toBeDefined();
    const realtimeHandler = mapUpdatedListener[1];

    // 保存直後の更新イベント（ブロックされるべき）
    const updateEvent = {
      data: { 
        id: 'test-map-1',
        title: 'Should be blocked',
        lastModified: Date.now()
      },
      timestamp: Date.now()
    };

    mockStorageRouter.getMindMap.mockResolvedValue(updateEvent.data);

    // 保存直後にリアルタイム更新を送信（ブロックされるべき）
    await act(async () => {
      await realtimeHandler(updateEvent);
    });

    // 一時ブロック中は更新が処理されないことを確認
    expect(mockStorageRouter.getMindMap).not.toHaveBeenCalled();
    expect(result.current.data.title).toBe('Test Map'); // 変更されない
  });

  test('ブロック期間終了後の更新処理', async () => {
    const { result } = renderHook(() => useMindMapData(true));
    
    const testMap = {
      id: 'test-map-1',
      title: 'Test Map',
      rootNode: { id: 'root', text: 'Root Node', x: 0, y: 0, children: [] }
    };

    await act(async () => {
      result.current.updateData(testMap);
    });

    const mapUpdatedListener = mockRealtimeSync.addEventListener.mock.calls
      .find(call => call[0] === 'map_updated');
    const realtimeHandler = mapUpdatedListener[1];

    // 更新イベント
    const updateEvent = {
      data: { 
        id: 'test-map-1',
        title: 'Updated after block period',
        rootNode: { id: 'root', text: 'Updated Root', x: 0, y: 0, children: [] }
      },
      timestamp: Date.now()
    };

    mockStorageRouter.getMindMap.mockResolvedValue(updateEvent.data);

    // ブロック期間終了後（6秒後）にリアルタイム更新を送信
    act(() => {
      jest.advanceTimersByTime(6000);
    });

    await act(async () => {
      await realtimeHandler(updateEvent);
    });

    // ブロック期間終了後は更新が処理されることを確認
    expect(mockStorageRouter.getMindMap).toHaveBeenCalledWith('test-map-1');
  });

  test('保存処理の重複実行防止', async () => {
    const { result } = renderHook(() => useMindMapData(true));
    
    const testMap = {
      id: 'test-map-1',
      title: 'Test Map',
      rootNode: { id: 'root', text: 'Root Node', x: 0, y: 0, children: [] }
    };

    // 保存処理に遅延を追加
    mockStorageRouter.saveMindMap.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );

    await act(async () => {
      result.current.updateData(testMap);
    });

    // 複数回の保存を同時実行
    const savePromises = [
      result.current.saveImmediately(),
      result.current.saveImmediately(),
      result.current.saveImmediately()
    ];

    await act(async () => {
      await Promise.all(savePromises);
      jest.advanceTimersByTime(200);
    });

    // 保存は1回のみ実行されることを確認
    expect(mockStorageRouter.saveMindMap).toHaveBeenCalledTimes(1);
  });

  test('編集中のリアルタイム更新ブロック', async () => {
    const { result } = renderHook(() => useMindMapData(true));
    
    const testMap = {
      id: 'test-map-1',
      title: 'Test Map',
      rootNode: { id: 'root', text: 'Root Node', x: 0, y: 0, children: [] }
    };

    await act(async () => {
      result.current.updateData(testMap);
    });

    // 編集中状態をシミュレート
    const mockInput = {
      value: 'editing...',
      tagName: 'INPUT'
    };
    
    // DOM要素をモック
    const mockQuerySelector = jest.spyOn(document, 'querySelector');
    mockQuerySelector.mockReturnValue(mockInput);
    
    Object.defineProperty(document, 'activeElement', {
      value: mockInput,
      configurable: true
    });

    const mapUpdatedListener = mockRealtimeSync.addEventListener.mock.calls
      .find(call => call[0] === 'map_updated');
    const realtimeHandler = mapUpdatedListener[1];

    const updateEvent = {
      data: { 
        id: 'test-map-1',
        title: 'Updated during edit'
      },
      originUserId: 'other-user-456',
      timestamp: Date.now()
    };

    mockStorageRouter.getMindMap.mockResolvedValue(updateEvent.data);

    await act(async () => {
      await realtimeHandler(updateEvent);
    });

    // 編集中は更新がブロックされることを確認
    expect(result.current.data.title).toBe('Test Map'); // 変更されない

    mockQuerySelector.mockRestore();
  });

  test('自動保存の重複防止とデバウンス', async () => {
    const { result } = renderHook(() => useMindMapData(true));
    
    const testMap = {
      id: 'test-map-1',
      title: 'Test Map',
      rootNode: { id: 'root', text: 'Root Node', x: 0, y: 0, children: [] }
    };

    // 短時間で複数回更新
    act(() => {
      result.current.updateData({ ...testMap, title: 'Update 1' });
      result.current.updateData({ ...testMap, title: 'Update 2' });
      result.current.updateData({ ...testMap, title: 'Update 3' });
    });

    // 自動保存タイマーを進める（2秒）
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      // 最後の更新のみで1回だけ保存されることを確認
      expect(mockStorageRouter.saveMindMap).toHaveBeenCalledTimes(1);
      expect(mockStorageRouter.saveMindMap).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: 'Update 3' })
      );
    });
  });

  test('定期処理の統合と最適化確認', () => {
    // 複数のsetIntervalが適切に管理されていることを確認
    const initialTimerCount = jest.getTimerCount();
    
    renderHook(() => useMindMapData(true));
    
    const finalTimerCount = jest.getTimerCount();
    
    // タイマーが過度に作成されていないことを確認
    expect(finalTimerCount - initialTimerCount).toBeLessThan(5);
  });
});