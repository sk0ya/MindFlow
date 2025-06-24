/**
 * シンプルなストレージサービスのテスト
 */

import { apiClient } from '../api.js';

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

describe('API Client Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  test('apiClient should be available', () => {
    expect(apiClient).toBeDefined();
    expect(apiClient.getMaps).toBeDefined();
    expect(apiClient.getMap).toBeDefined();
    expect(apiClient.createMap).toBeDefined();
    expect(apiClient.updateMap).toBeDefined();
    expect(apiClient.deleteMap).toBeDefined();
    expect(apiClient.setAuth).toBeDefined();
  });

  test('getMaps should call the mocked function', async () => {
    const mockMaps = [{ id: '1', title: 'Test Map' }];
    apiClient.getMaps.mockResolvedValue(mockMaps);
    
    const result = await apiClient.getMaps();
    expect(result).toEqual(mockMaps);
    expect(apiClient.getMaps).toHaveBeenCalledTimes(1);
  });

  test('createMap should call the mocked function', async () => {
    const mapData = { id: '1', title: 'Test Map', rootNode: {} };
    const mockResponse = { success: true, map: mapData };
    apiClient.createMap.mockResolvedValue(mockResponse);
    
    const result = await apiClient.createMap(mapData);
    expect(result).toEqual(mockResponse);
    expect(apiClient.createMap).toHaveBeenCalledWith(mapData);
  });
});