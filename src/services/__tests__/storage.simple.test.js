/**
 * シンプルなストレージサービスのテスト（簡略版）
 */

describe('StorageService Simple Tests', () => {
  test('basic functionality exists', () => {
    const { storageService } = require('../storage.js');
    
    expect(storageService).toBeDefined();
    expect(typeof storageService.getMaps).toBe('function');
    expect(typeof storageService.saveMap).toBe('function');
    expect(typeof storageService.deleteMap).toBe('function');
    expect(typeof storageService.getSettings).toBe('function');
    expect(typeof storageService.setSettings).toBe('function');
  });

  test('default settings should be local mode', () => {
    // localStorage をクリアしてデフォルト設定をテスト
    const originalLocalStorage = global.localStorage;
    global.localStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };

    // 新しいインスタンスを作成
    delete require.cache[require.resolve('../storage.js')];
    const { StorageService } = require('../storage.js');
    const testService = new StorageService();

    const settings = testService.getSettings();
    expect(settings.storageMode).toBe('local');
    expect(settings.autoSave).toBe(true);

    global.localStorage = originalLocalStorage;
  });
});