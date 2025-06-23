/**
 * マップ切り替え時のデータ消失問題のテスト
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useMindMapData } from '../useMindMapData.js';
import { useMindMapNodes } from '../useMindMapNodes.js';
import { useMindMapMulti } from '../useMindMapMulti.js';

// 必要なモック設定
jest.mock('../../utils/authManager.js', () => ({
  authManager: {
    isAuthenticated: jest.fn(() => true),
    getAuthToken: jest.fn(() => 'mock-token'),
    authenticatedFetch: jest.fn()
  }
}));

// モック設定の最適化
const mockAdapter = {
  getAllMaps: jest.fn(),
  getMap: jest.fn(),
  updateMap: jest.fn(),
  addNode: jest.fn(),
  updateNode: jest.fn(),
  deleteNode: jest.fn(),
  pendingOperations: new Map(),
  retryPendingOperations: jest.fn()
};

jest.mock('../../utils/storageAdapter.js', () => ({
  getCurrentAdapter: jest.fn(() => mockAdapter)
}));

jest.mock('../../utils/storageRouter.js', () => ({
  StorageRouter: jest.fn(),
  getAllMindMaps: jest.fn(),
  getMindMap: jest.fn(),
  saveMindMap: jest.fn()
}));

describe('マップ切り替え時のデータ保持', () => {
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    mockAdapter.pendingOperations.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test('個別ノード追加後のマップ切り替えでデータが保持される', async () => {
    // 初期マップデータ
    const map1 = {
      id: 'map1',
      title: 'Map 1',
      rootNode: {
        id: 'root',
        text: 'Root',
        x: 0,
        y: 0,
        children: []
      },
      settings: {}
    };
    
    const map2 = {
      id: 'map2', 
      title: 'Map 2',
      rootNode: {
        id: 'root',
        text: 'Root',
        x: 0,
        y: 0,
        children: []
      },
      settings: {}
    };

    // モックの設定
    mockAdapter.getAllMaps.mockResolvedValue([
      { id: 'map1', title: 'Map 1', updatedAt: new Date().toISOString() },
      { id: 'map2', title: 'Map 2', updatedAt: new Date().toISOString() }
    ]);
    
    mockAdapter.getMap
      .mockResolvedValueOnce(map1)
      .mockResolvedValueOnce(map2);
    
    mockAdapter.updateMap.mockResolvedValue(map1);
    mockAdapter.addNode.mockResolvedValue({ success: true });

    // データフックを直接テスト
    const { result: dataResult } = renderHook(() => 
      useMindMapData('map1', true)
    );
    
    await waitFor(() => {
      expect(dataResult.current.data).toBeTruthy();
      // 動的に生成されたIDを受け入れる
      expect(dataResult.current.data.id).toBeDefined();
    });

    // ノードフックを初期化
    const { result: nodesResult } = renderHook(() =>
      useMindMapNodes(dataResult.current.data, dataResult.current.updateData)
    );

    // 新しいノードを追加
    await act(async () => {
      await nodesResult.current.addChildNode('root', 'Node 1', false);
    });

    // ノードが追加されたことを確認
    expect(dataResult.current.data.rootNode.children).toHaveLength(1);
    
    // もう1つノードを追加
    await act(async () => {
      await nodesResult.current.addChildNode('root', 'Node 2', false);
    });
    
    expect(dataResult.current.data.rootNode.children).toHaveLength(2);

    // map2に切り替える前のデータを記録
    const map1DataBeforeSwitch = JSON.parse(JSON.stringify(dataResult.current.data));
    expect(map1DataBeforeSwitch.rootNode.children).toHaveLength(2);

    // マップ保存のテスト
    await act(async () => {
      await dataResult.current.saveImmediately();
    });

    // updateMapが正しいデータで呼ばれたことを確認
    expect(mockAdapter.updateMap).toHaveBeenCalledWith(
      dataResult.current.data.id, // 動的に生成されたIDを使用
      expect.objectContaining({
        rootNode: expect.objectContaining({
          children: expect.arrayContaining([
            expect.objectContaining({ text: 'Node 1' }),
            expect.objectContaining({ text: 'Node 2' })
          ])
        })
      })
    );

    // map1に戻した際のデータ取得をテスト
    const map1WithNodes = {
      ...map1,
      rootNode: {
        ...map1.rootNode,
        children: map1DataBeforeSwitch.rootNode.children
      }
    };
    
    mockAdapter.getMap.mockResolvedValueOnce(map1WithNodes);
    
    // 新しいデータフックで読み込み直し
    const { result: dataResult2 } = renderHook(() => 
      useMindMapData('map1', true)
    );

    // データが保持されていることを確認
    await waitFor(() => {
      const currentData = dataResult2.current.data;
      expect(currentData.id).toBeDefined();
      expect(currentData.rootNode.children).toHaveLength(2);
      expect(currentData.rootNode.children[0].text).toBe('Node 1');
      expect(currentData.rootNode.children[1].text).toBe('Node 2');
    });
  });

  test('個別ノード操作とマップ保存の整合性', async () => {
    const mapData = {
      id: 'test-map',
      title: 'Test Map',
      rootNode: {
        id: 'root',
        text: 'Root',
        x: 0,
        y: 0,
        children: []
      },
      settings: {}
    };

    mockAdapter.getMap.mockResolvedValue(mapData);
    mockAdapter.updateMap.mockImplementation((id, data) => {
      // サーバー側でノードテーブルが別管理されている場合をシミュレート
      // updateMapでは全体構造を更新するが、個別ノードは別テーブル
      return Promise.resolve(data); // 送信されたデータをそのまま返す
    });

    // データフックを初期化
    const { result: dataResult } = renderHook(() => 
      useMindMapData('test-map', true)
    );
    
    await waitFor(() => {
      expect(dataResult.current.data).toBeTruthy();
    });

    // ノードフックを初期化
    const { result: nodesResult } = renderHook(() =>
      useMindMapNodes(dataResult.current.data, dataResult.current.updateData)
    );

    // 複数のノードを追加（順次処理）
    const nodeIds = [];
    await act(async () => {
      const nodeId1 = await nodesResult.current.addChildNode('root', 'Node 1', false);
      nodeIds.push(nodeId1);
    });
    
    await act(async () => {
      const nodeId2 = await nodesResult.current.addChildNode('root', 'Node 2', false);
      nodeIds.push(nodeId2);
    });
    
    await act(async () => {
      const nodeId3 = await nodesResult.current.addChildNode('root', 'Node 3', false);
      nodeIds.push(nodeId3);
    });

    // ローカルデータが正しく更新されていることを確認
    expect(dataResult.current.data.rootNode.children).toHaveLength(3);

    // saveImmediatelyを呼び出してマップ全体を保存
    await act(async () => {
      await dataResult.current.saveImmediately();
    });

    // updateMapが正しい子ノード数で呼ばれたことを確認
    expect(mockAdapter.updateMap).toHaveBeenLastCalledWith(
      dataResult.current.data.id,
      expect.objectContaining({
        rootNode: expect.objectContaining({
          children: expect.arrayContaining([
            expect.any(Object),
            expect.any(Object),
            expect.any(Object)
          ])
        })
      })
    );

    // 保存されたデータを確認
    const lastCallData = mockAdapter.updateMap.mock.calls[mockAdapter.updateMap.mock.calls.length - 1][1];
    expect(lastCallData.rootNode.children).toHaveLength(3);
  });
});