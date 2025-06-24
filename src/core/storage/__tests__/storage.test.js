/**
 * シンプルなストレージサービスのテスト
 */

import { StorageService, storageService } from '../storageService.js';

// モック設定
jest.mock('../api.js', () => ({
  apiClient: {
    getMaps: jest.fn(),
    getMap: jest.fn(),
    createMap: jest.fn(),
    updateMap: jest.fn(),
    deleteMap: jest.fn(),
    setAuth: jest.fn(),
  }
}));

// localStorage のモック
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

describe('StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Local Storage', () => {
    beforeEach(() => {
      // ローカルモードに設定
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'mindflow_settings') {
          return JSON.stringify({ storageMode: 'local' });
        }
        return null;
      });
      storageService.settings = { storageMode: 'local' };
    });

    test('getMaps should return local maps', async () => {
      const mockMaps = [{ id: '1', title: 'Test Map' }];
      
      // モックをクリアしてから設定
      jest.clearAllMocks();
      localStorageMock.getItem.mockImplementation((key) => {
        console.log('localStorage.getItem called with key:', key);
        if (key === 'mindflow_settings') {
          return JSON.stringify({ storageMode: 'local' });
        }
        if (key === 'mindflow_maps') {
          return JSON.stringify(mockMaps);
        }
        return null;
      });

      // 新しいインスタンスを作成
      const testStorageService = new StorageService();
      console.log('StorageService settings:', testStorageService.settings);
      console.log('getLocalMaps call result:', testStorageService.getLocalMaps());

      const maps = await testStorageService.getMaps();
      console.log('Returned maps:', maps);
      expect(maps).toEqual(mockMaps);
    });

    test('saveMap should save to localStorage', async () => {
      const mapData = { id: '1', title: 'Test Map', rootNode: {} };
      
      // 既存のマップがない場合の設定
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'mindflow_settings') {
          return JSON.stringify({ storageMode: 'local' });
        }
        if (key === 'mindflow_maps') {
          return '[]';
        }
        return null;
      });
      
      const testStorageService = new StorageService();
      await testStorageService.saveMap(mapData);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'mindflow_maps',
        JSON.stringify([mapData])
      );
    });
  });

  describe('Cloud Storage', () => {
    beforeEach(() => {
      // クラウドモードに設定
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'mindflow_settings') {
          return JSON.stringify({ storageMode: 'cloud' });
        }
        return null;
      });
      storageService.settings = { storageMode: 'cloud' };
    });

    test('getMaps should fallback to local on cloud failure', async () => {
      const { apiClient } = require('../api.js');
      const mockLocalMaps = [{ id: '1', title: 'Test Map', rootNode: {} }];
      
      // API エラーをシミュレート
      apiClient.getMaps.mockRejectedValue(new Error('Network error'));
      
      // ローカルデータをセット
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'mindflow_settings') {
          return JSON.stringify({ storageMode: 'cloud' });
        }
        if (key === 'mindflow_maps') {
          return JSON.stringify(mockLocalMaps);
        }
        return null;
      });

      const testStorageService = new StorageService();
      const maps = await testStorageService.getMaps();
      expect(maps).toEqual(mockLocalMaps);
    });
  });
});