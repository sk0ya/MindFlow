import { renderHook, act } from '@testing-library/react';
import { useMindMapData } from '../../Local/features/mindmap/useMindMapData';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('useMindMapData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize with empty data when localStorage is empty', async () => {
    mockLocalStorage.getItem.mockReturnValue(null);

    const { result, waitForNextUpdate } = renderHook(() => useMindMapData(true));

    await waitForNextUpdate();

    expect(result.current.data).toEqual({
      id: expect.any(String),
      title: 'New Mind Map',
      rootNode: expect.objectContaining({
        id: expect.any(String),
        text: 'Central Topic',
        x: 400,
        y: 300,
        children: []
      })
    });
  });

  test('should load data from localStorage', async () => {
    const savedData = {
      id: 'saved-map',
      title: 'Saved Map',
      rootNode: {
        id: 'root',
        text: 'Root',
        x: 400,
        y: 300,
        children: []
      }
    };

    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedData));

    const { result, waitForNextUpdate } = renderHook(() => useMindMapData(true));

    await waitForNextUpdate();

    expect(result.current.data).toEqual(savedData);
  });

  test('should save data to localStorage', () => {
    mockLocalStorage.getItem.mockReturnValue(null);

    const { result } = renderHook(() => useMindMapData(true));

    const newData = {
      id: 'new-map',
      title: 'New Map',
      rootNode: {
        id: 'root',
        text: 'Root',
        x: 400,
        y: 300,
        children: []
      }
    };

    act(() => {
      result.current.setData(newData);
    });

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'mindMapData',
      JSON.stringify(newData)
    );
  });

  test('should handle corrupted localStorage data', () => {
    mockLocalStorage.getItem.mockReturnValue('invalid json');

    const { result } = renderHook(() => useMindMapData(true));

    // Should fallback to default data
    expect(result.current.data).toEqual({
      id: expect.any(String),
      title: 'New Mind Map',
      rootNode: expect.objectContaining({
        id: expect.any(String),
        text: 'Central Topic',
        x: 400,
        y: 300,
        children: []
      })
    });
  });

  test('should export data correctly', () => {
    const testData = {
      id: 'test-map',
      title: 'Test Map',
      rootNode: {
        id: 'root',
        text: 'Root',
        x: 400,
        y: 300,
        children: []
      }
    };

    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(testData));

    const { result } = renderHook(() => useMindMapData(true));

    const exportedData = result.current.exportData();
    expect(exportedData).toEqual(testData);
  });

  test('should import data correctly', () => {
    mockLocalStorage.getItem.mockReturnValue(null);

    const { result } = renderHook(() => useMindMapData(true));

    const importData = {
      id: 'imported-map',
      title: 'Imported Map',
      rootNode: {
        id: 'root',
        text: 'Imported Root',
        x: 400,
        y: 300,
        children: []
      }
    };

    act(() => {
      result.current.importData(importData);
    });

    expect(result.current.data).toEqual(importData);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'mindMapData',
      JSON.stringify(importData)
    );
  });
});