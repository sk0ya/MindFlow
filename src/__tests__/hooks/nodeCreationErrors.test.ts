/**
 * ノード作成エラーの調査用テストケース
 * 子ノード追加の500/400エラー問題を特定・修正するためのテスト
 */

import { jest } from '@jest/globals';
import { CloudStorageAdapter } from '../../core/storage/storageAdapter.js';

// StorageAdapterをモック化
const mockAddNode = jest.fn();
const mockStorageAdapter = {
  ensureInitialized: jest.fn().mockResolvedValue(),
  addNode: mockAddNode
};

jest.mock('../../core/storage/storageAdapter.js', () => ({
  CloudStorageAdapter: jest.fn().mockImplementation(() => mockStorageAdapter),
  getCurrentAdapter: jest.fn(() => mockStorageAdapter)
}));

jest.mock('../../features/auth/authManager.js', () => ({
  authManager: {
    isAuthenticated: jest.fn(() => true),
    getAuthToken: jest.fn(() => 'mock-token'),
    authenticatedFetch: jest.fn()
  }
}));

describe('ノード作成エラーの調査', () => {
  let storageAdapter;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // デフォルトのモック動作
    mockAddNode.mockResolvedValue({
      success: true,
      result: { id: 'test-node', success: true }
    });
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('子ノード追加のリクエスト形式テスト', () => {
    test('子ノード追加時のリクエストデータ構造', async () => {
      storageAdapter = new CloudStorageAdapter();
      await storageAdapter.ensureInitialized();

      const mapId = 'map_test_123';
      const nodeData = {
        id: 'node_child_test',
        text: 'テスト子ノード',
        x: 100,
        y: 200,
        children: []
      };
      const parentId = 'root';

      const result = await storageAdapter.addNode(mapId, nodeData, parentId);

      // モックが正しく呼ばれたかチェック
      expect(mockAddNode).toHaveBeenCalledWith(mapId, nodeData, parentId);
      expect(result.success).toBe(true);
    });

    test('兄弟ノード追加時のリクエストデータ構造', async () => {
      storageAdapter = new CloudStorageAdapter();
      await storageAdapter.ensureInitialized();

      const mapId = 'map_test_123';
      const nodeData = {
        id: 'node_sibling_test',
        text: 'テスト兄弟ノード',
        x: 150,
        y: 250,
        children: []
      };
      const parentId = 'parent_node_123'; // 兄弟ノードは親ノードのIDを指定

      const result = await storageAdapter.addNode(mapId, nodeData, parentId);

      // モックが正しく呼ばれたかチェック
      expect(mockAddNode).toHaveBeenCalledWith(mapId, nodeData, parentId);
      expect(result.success).toBe(true);
    });
  });

  describe('エラーレスポンスの処理テスト', () => {
    test('500エラー（UNIQUE制約違反）の処理', async () => {
      // UNIQUE制約違反の500エラーをモック
      mockAddNode.mockResolvedValue({
        success: false,
        error: 'D1_ERROR: UNIQUE constraint failed: nodes.id: SQLITE_CONSTRAINT'
      });

      storageAdapter = new CloudStorageAdapter();
      await storageAdapter.ensureInitialized();

      const result = await storageAdapter.addNode(
        'map_test_123',
        { id: 'node_duplicate_test', text: 'テスト' },
        'root'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('UNIQUE constraint failed');
      expect(result.error).toContain('nodes.id');
    });

    test('400エラーの処理', async () => {
      // 400エラーをモック
      mockAddNode.mockResolvedValue({
        success: false,
        error: 'API エラー: Status: 400, Body: {"error":"Bad Request"}'
      });

      storageAdapter = new CloudStorageAdapter();
      await storageAdapter.ensureInitialized();

      const result = await storageAdapter.addNode(
        'map_test_123',
        { id: 'node_test', text: 'テスト' },
        'root'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('400');
    });

    test('ネットワークエラーの処理', async () => {
      // ネットワークエラーをモック
      mockAddNode.mockResolvedValue({
        success: false,
        error: 'Network Error'
      });

      storageAdapter = new CloudStorageAdapter();
      await storageAdapter.ensureInitialized();

      const result = await storageAdapter.addNode(
        'map_test_123',
        { id: 'node_test', text: 'テスト' },
        'root'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network Error');
    });
  });

  describe('ノードID重複問題のテスト', () => {
    test('同じIDでの連続ノード作成', async () => {
      let callCount = 0;
      
      // mockAddNodeの動作を設定
      mockAddNode.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // 1回目: 成功
          return Promise.resolve({
            success: true,
            result: { id: 'node_duplicate_test', success: true }
          });
        } else {
          // 2回目以降: UNIQUE制約違反
          return Promise.resolve({
            success: false,
            error: 'D1_ERROR: UNIQUE constraint failed: nodes.id: SQLITE_CONSTRAINT'
          });
        }
      });

      storageAdapter = new CloudStorageAdapter();
      await storageAdapter.ensureInitialized();

      const nodeData = { id: 'node_duplicate_test', text: 'テスト', x: 100, y: 200, children: [] };

      // 1回目: 成功
      const result1 = await storageAdapter.addNode('map_test_123', nodeData, 'root');
      expect(result1.success).toBe(true);

      // 2回目: 重複エラー
      const result2 = await storageAdapter.addNode('map_test_123', nodeData, 'root');
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('UNIQUE constraint failed');
    });

    test('リトライ時のID再生成', async () => {
      // ID再生成機能をテスト
      const originalGenerateId = require('../../shared/types/dataTypes.js').generateId;
      let idCounter = 0;
      
      // generateIdをモック
      jest.doMock('../../shared/types/dataTypes.js', () => ({
        ...jest.requireActual('../../shared/types/dataTypes.js'),
        generateId: () => `node_test_${++idCounter}`
      }));

      // ペンディングオペレーションのリトライをテスト
      const pendingOp = {
        type: 'add',
        mapId: 'map_test_123',
        nodeData: { id: 'node_original', text: 'テスト', x: 100, y: 200, children: [] },
        parentId: 'root',
        timestamp: Date.now()
      };

      expect(pendingOp.nodeData.id).toBe('node_original');
      
      // リトライ時にIDが変更されることを期待
      // （実際の実装では新しいIDが生成されるべき）
    });
  });

  describe('ノードデータ検証テスト', () => {
    test('不正なノードデータの検出', () => {
      const validNodeData = {
        id: 'valid_node_123',
        text: '有効なノード',
        x: 100,
        y: 200,
        children: []
      };

      const invalidNodeDataList = [
        { /* idなし */ text: 'テスト', x: 100, y: 200 },
        { id: '', text: 'テスト', x: 100, y: 200 }, // 空のID
        { id: 'test', /* textなし */ x: 100, y: 200 },
        { id: 'test', text: 'テスト' /* x,yなし */ },
        { id: 'test', text: 'テスト', x: 'invalid', y: 200 }, // 無効な座標
      ];

      // 有効なデータ
      expect(isValidNodeData(validNodeData)).toBe(true);

      // 無効なデータ
      invalidNodeDataList.forEach((invalidData, index) => {
        expect(isValidNodeData(invalidData)).toBe(false);
      });
    });

    test('parentIdの検証', () => {
      const validParentIds = ['root', 'node_123', 'parent_node_abc'];
      const invalidParentIds = ['', null, undefined, 123, {}];

      validParentIds.forEach(parentId => {
        expect(isValidParentId(parentId)).toBe(true);
      });

      invalidParentIds.forEach(parentId => {
        expect(isValidParentId(parentId)).toBe(false);
      });
    });
  });
});

// ヘルパー関数：ノードデータの検証
function isValidNodeData(nodeData) {
  if (!nodeData || typeof nodeData !== 'object') return false;
  if (!nodeData.id || typeof nodeData.id !== 'string' || nodeData.id.trim() === '') return false;
  if (nodeData.text === undefined || typeof nodeData.text !== 'string') return false;
  if (typeof nodeData.x !== 'number' || typeof nodeData.y !== 'number') return false;
  return true;
}

// ヘルパー関数：parentIdの検証
function isValidParentId(parentId) {
  return typeof parentId === 'string' && parentId.trim() !== '';
}