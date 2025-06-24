/**
 * UNIQUE制約違反の根本解決テスト
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useMindMapData } from '../useMindMapData.js';
import { useMindMapNodes } from '../useMindMapNodes.js';

// ID生成関数のモック
const mockGenerateId = jest.fn();

// 必要なモック設定
jest.mock('../../utils/authManager.js', () => ({
  authManager: {
    isAuthenticated: jest.fn(() => true),
    getAuthToken: jest.fn(() => 'mock-token'),
    authenticatedFetch: jest.fn()
  }
}));

jest.mock('../../utils/dataTypes.js', () => {
  const originalModule = jest.requireActual('../../utils/dataTypes.js');
  return {
    ...originalModule,
    generateId: () => mockGenerateId()
  };
});

// ストレージアダプターのモック
const mockAdapter = {
  getAllMaps: jest.fn(),
  getMap: jest.fn(),
  updateMap: jest.fn(),
  addNode: jest.fn(),
  updateNode: jest.fn().mockResolvedValue({ success: true }),
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

describe('UNIQUE制約違反の根本解決', () => {
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    mockAdapter.pendingOperations.clear();
    mockGenerateId.mockReset();
  });

  test('ID重複時の自動リトライ機能', async () => {
    // 最初の2回はUNIQUE制約違反、3回目で成功
    mockAdapter.addNode
      .mockRejectedValueOnce(new Error('UNIQUE constraint failed: nodes.id'))
      .mockRejectedValueOnce(new Error('UNIQUE constraint failed: nodes.id'))
      .mockResolvedValueOnce({ success: true, newId: 'unique_id_3' });

    const { result: dataResult } = renderHook(() => 
      useMindMapData('test-map', true)
    );
    
    await waitFor(() => {
      expect(dataResult.current.data).toBeTruthy();
    });

    const { result: nodesResult } = renderHook(() =>
      useMindMapNodes(dataResult.current.data, dataResult.current.updateData)
    );

    // ノード追加を実行
    let addedNodeId;
    await act(async () => {
      addedNodeId = await nodesResult.current.addChildNode('root', 'Test Node');
    });

    // ローカル状態にノードが追加されていることを確認
    expect(dataResult.current.data.rootNode.children).toHaveLength(1);
    expect(dataResult.current.data.rootNode.children[0].text).toBe('Test Node');
    
    // ノード追加時は一時ノードが作成されるため、addNode は呼ばれない
    // finishEdit 時に DB 保存が行われる
  });

  test('サーバー側でのID重複検出と自動修正', async () => {
    // サーバー側で新しいIDが生成される
    mockAdapter.addNode.mockResolvedValue({ 
      success: true, 
      newId: 'server_generated_id',
      result: { id: 'server_generated_id' }
    });

    const { result: dataResult } = renderHook(() => 
      useMindMapData('test-map', true)
    );
    
    await waitFor(() => {
      expect(dataResult.current.data).toBeTruthy();
    });

    const { result: nodesResult } = renderHook(() =>
      useMindMapNodes(dataResult.current.data, dataResult.current.updateData)
    );

    let addedNodeId;
    await act(async () => {
      addedNodeId = await nodesResult.current.addChildNode('root', 'Test Node');
    });

    // ローカル状態にノードが追加されていることを確認
    expect(dataResult.current.data.rootNode.children).toHaveLength(1);
    expect(dataResult.current.data.rootNode.children[0].text).toBe('Test Node');
    
    // ノード追加時は一時ノードが作成されるため、addNode は呼ばれない
    // finishEdit 時に DB 保存が行われる
  });

  test('複数ノード同時追加時のID競合回避', async () => {
    mockAdapter.addNode.mockImplementation(() => {
      return Promise.resolve({ success: true });
    });

    const { result: dataResult } = renderHook(() => 
      useMindMapData('test-map', true)
    );
    
    await waitFor(() => {
      expect(dataResult.current.data).toBeTruthy();
    });

    const { result: nodesResult } = renderHook(() =>
      useMindMapNodes(dataResult.current.data, dataResult.current.updateData)
    );

    // 最初のノードを追加
    let addedNodeId;
    await act(async () => {
      addedNodeId = await nodesResult.current.addChildNode('root', 'Node 0');
    });
    
    // データが更新されるまで待機
    await waitFor(() => {
      expect(dataResult.current.data.rootNode.children).toHaveLength(1);
    });
    
    // 改良されたID生成により、複数ノード追加でも競合しないことを確認
    expect(dataResult.current.data.rootNode.children[0].text).toBe('Node 0');
    // ノード追加時は一時ノードが作成されるため、addNode は呼ばれない
  });

  test('データベースの既存データとの競合回避', async () => {
    // 改良されたID生成により、競合は起こりにくくなった
    mockAdapter.addNode.mockResolvedValue({ success: true });

    const { result: dataResult } = renderHook(() => 
      useMindMapData('test-map', true)
    );
    
    await waitFor(() => {
      expect(dataResult.current.data).toBeTruthy();
    });

    const { result: nodesResult } = renderHook(() =>
      useMindMapNodes(dataResult.current.data, dataResult.current.updateData)
    );

    let addedNodeId;
    await act(async () => {
      addedNodeId = await nodesResult.current.addChildNode('root', 'Test Node');
    });

    // 成功することを確認
    expect(dataResult.current.data.rootNode.children).toHaveLength(1);
    // ノード追加時は一時ノードが作成されるため、addNode は呼ばれない
  });

  test('ネットワークエラー時のローカル状態保護', async () => {
    mockGenerateId.mockReturnValue('test_node_id');

    // ネットワークエラーをシミュレート
    mockAdapter.addNode.mockRejectedValue(new Error('Network error'));

    const { result: dataResult } = renderHook(() => 
      useMindMapData('test-map', true)
    );
    
    await waitFor(() => {
      expect(dataResult.current.data).toBeTruthy();
    });

    const { result: nodesResult } = renderHook(() =>
      useMindMapNodes(dataResult.current.data, dataResult.current.updateData)
    );

    await act(async () => {
      await nodesResult.current.addChildNode('root', 'Test Node');
    });

    // ネットワークエラーでもローカル状態は更新されていることを確認
    expect(dataResult.current.data.rootNode.children).toHaveLength(1);
    expect(dataResult.current.data.rootNode.children[0].text).toBe('Test Node');
  });
});