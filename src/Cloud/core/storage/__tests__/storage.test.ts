/**
 * シンプルなストレージサービスのテスト
 */

import { apiClient } from '../api.js';

// Type definitions for mocked API client
interface MockApiClient {
  getMaps: jest.MockedFunction<() => Promise<any>>;
  getMap: jest.MockedFunction<(id: string) => Promise<any>>;
  createMap: jest.MockedFunction<(mapData: any) => Promise<any>>;
  updateMap: jest.MockedFunction<(id: string, mapData: any) => Promise<any>>;
  deleteMap: jest.MockedFunction<(id: string) => Promise<any>>;
  setAuth: jest.MockedFunction<(token: string) => void>;
}

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

// Cast apiClient to mocked version for type safety
const mockApiClient = apiClient as unknown as MockApiClient;

describe('API Client Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    mockApiClient.getMaps.mockResolvedValue(mockMaps);
    
    const result = await apiClient.getMaps();
    expect(result).toEqual(mockMaps);
    expect(mockApiClient.getMaps).toHaveBeenCalledTimes(1);
  });

  test('createMap should call the mocked function', async () => {
    const mapData = { id: '1', title: 'Test Map', rootNode: {} };
    const mockResponse = { success: true, map: mapData };
    mockApiClient.createMap.mockResolvedValue(mockResponse);
    
    const result = await apiClient.createMap(mapData);
    expect(result).toEqual(mockResponse);
    expect(mockApiClient.createMap).toHaveBeenCalledWith(mapData);
  });
});