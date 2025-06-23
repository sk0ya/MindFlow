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
    test('500エラーの処理', async () => {
      // 500エラーをモック
      mockAuthenticatedFetch.mockResolvedValue({
        ok: false,
        status: 500
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
      expect(result.error).toBe('API エラー: 500');
    });

    test('400エラーの処理', async () => {
      // 400エラーをモック
      mockAuthenticatedFetch.mockResolvedValue({
        ok: false,
        status: 400
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
      expect(result.error).toBe('API エラー: 400');
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