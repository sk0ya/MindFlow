/**
 * シンプルなストレージサービスのテスト（簡略版）
 */

describe('StorageService Simple Tests', () => {
  test('basic functionality exists', () => {
    const { apiClient } = require('../api.js');
    
    expect(apiClient).toBeDefined();
    expect(typeof apiClient.getMaps).toBe('function');
    expect(typeof apiClient.createMap).toBe('function');
    expect(typeof apiClient.deleteMap).toBe('function');
    expect(typeof apiClient.setAuth).toBe('function');
  });

  test('api client should have all required methods', () => {
    const { apiClient } = require('../api.js');
    
    // 基本的なAPIメソッドが存在することを確認
    expect(typeof apiClient.getMaps).toBe('function');
    expect(typeof apiClient.getMap).toBe('function');
    expect(typeof apiClient.createMap).toBe('function');
    expect(typeof apiClient.updateMap).toBe('function');
    expect(typeof apiClient.deleteMap).toBe('function');
    expect(typeof apiClient.setAuth).toBe('function');
  });
});