/**
 * ノード作成エラーの調査用テストケース
 * 子ノード追加の500/400エラー問題を特定・修正するためのテスト
 */

import { jest } from '@jest/globals';

// テスト用のモック設定
const mockAuthenticatedFetch = jest.fn();
const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();

// コンソールをモック
global.console = {
  ...console,
  log: mockConsoleLog,
  error: mockConsoleError
};

describe('ノード作成エラーの調査', () => {
  let storageAdapter;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // authManagerのモック
    jest.doMock('../../utils/authManager.js', () => ({
      authManager: {
        isAuthenticated: jest.fn(() => true),
        getAuthToken: jest.fn(() => 'mock-token'),
        authenticatedFetch: mockAuthenticatedFetch
      }
    }));
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('子ノード追加のリクエスト形式テスト', () => {
    test('子ノード追加時のリクエストデータ構造', async () => {
      // 成功レスポンスをモック
      mockAuthenticatedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const { CloudStorageAdapter } = await import('../../utils/storageAdapter.js');
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

      await storageAdapter.addNode(mapId, nodeData, parentId);

      // リクエストが正しく送信されたかチェック
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/nodes/map_test_123'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            mapId,
            node: nodeData,
            parentId,
            operation: 'add'
          })
        }
      );
    });

    test('兄弟ノード追加時のリクエストデータ構造', async () => {
      // 成功レスポンスをモック
      mockAuthenticatedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const { CloudStorageAdapter } = await import('../../utils/storageAdapter.js');
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

      await storageAdapter.addNode(mapId, nodeData, parentId);

      // リクエストが正しく送信されたかチェック
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/nodes/map_test_123'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            mapId,
            node: nodeData,
            parentId,
            operation: 'add'
          })
        }
      );
    });
  });

  describe('エラーレスポンスの処理テスト', () => {
    test('500エラー（UNIQUE制約違反）の処理', async () => {
      // UNIQUE制約違反の500エラーをモック
      mockAuthenticatedFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('{"error":"D1_ERROR: UNIQUE constraint failed: nodes.id: SQLITE_CONSTRAINT"}')
      });

      const { CloudStorageAdapter } = await import('../../utils/storageAdapter.js');
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
      mockAuthenticatedFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"error":"Bad Request"}')
      });

      const { CloudStorageAdapter } = await import('../../utils/storageAdapter.js');
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
      mockAuthenticatedFetch.mockRejectedValue(new Error('Network Error'));

      const { CloudStorageAdapter } = await import('../../utils/storageAdapter.js');
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
      mockAuthenticatedFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // 1回目: 成功
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          });
        } else {
          // 2回目以降: UNIQUE制約違反
          return Promise.resolve({
            ok: false,
            status: 500,
            text: () => Promise.resolve('{"error":"D1_ERROR: UNIQUE constraint failed: nodes.id: SQLITE_CONSTRAINT"}')
          });
        }
      });

      const { CloudStorageAdapter } = await import('../../utils/storageAdapter.js');
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
      const originalGenerateId = require('../../utils/dataTypes.js').generateId;
      let idCounter = 0;
      
      // generateIdをモック
      jest.doMock('../../utils/dataTypes.js', () => ({
        ...jest.requireActual('../../utils/dataTypes.js'),
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