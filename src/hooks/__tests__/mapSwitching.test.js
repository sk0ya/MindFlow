import { renderHook, act } from '@testing-library/react';
import { useMindMapMulti } from '../useMindMapMulti.js';
import useMindMapNodes from '../useMindMapNodes.js';

// Mock the storage modules
jest.mock('../../utils/storageRouter.js', () => ({
  getCurrentMindMap: jest.fn(),
  getAllMindMaps: jest.fn().mockResolvedValue([]),
  createNewMindMap: jest.fn(),
  deleteMindMap: jest.fn(),
  saveMindMap: jest.fn().mockResolvedValue(true),
  isCloudStorageEnabled: jest.fn().mockReturnValue(false)
}));

jest.mock('../../utils/storageAdapter.js', () => ({
  getCurrentAdapter: jest.fn(() => ({
    getAllMaps: jest.fn().mockResolvedValue([]),
    getMap: jest.fn(),
    createMap: jest.fn(),
    deleteMap: jest.fn(),
    updateMap: jest.fn()
  }))
}));

jest.mock('../../utils/dataTypes.js', () => ({
  deepClone: jest.fn(data => JSON.parse(JSON.stringify(data))),
  assignColorsToExistingNodes: jest.fn(data => data),
  createInitialData: jest.fn(() => ({
    id: 'test-map-' + Math.random().toString(36).substr(2, 9),
    title: 'Test Map',
    rootNode: {
      id: 'root',
      text: 'Test Root',
      x: 400,
      y: 300,
      children: []
    }
  }))
}));

jest.mock('../../utils/realtimeSync.js', () => ({
  initialize: jest.fn(),
  cleanup: jest.fn(),
  onDataUpdate: jest.fn(),
  updateCursor: jest.fn()
}));

jest.mock('../../utils/storageUtils.js', () => ({
  getAppSettings: jest.fn(() => ({ storageMode: 'local' })),
  loadFromStorage: jest.fn(() => ({})),
  saveToStorage: jest.fn()
}));

// Mock useMindMapNodes
jest.mock('../useMindMapNodes.js', () => ({
  useMindMapNodes: jest.fn(() => ({
    updateNode: jest.fn(),
    editingNodeId: null,
    finishEdit: jest.fn()
  }))
}));

describe('Map Switching Data Loss Issue', () => {
  let mockData, mockSetData, mockUpdateData, mockAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Set up mock data
    mockData = {
      id: 'map1',
      title: 'Map1',
      rootNode: {
        id: 'root1',
        text: 'Map1 Root',
        x: 400,
        y: 300,
        children: [{
          id: 'node1',
          text: 'Original Content',
          x: 500,
          y: 200,
          children: []
        }]
      }
    };

    mockSetData = jest.fn();
    mockUpdateData = jest.fn();

    // Mock storage adapter
    mockAdapter = {
      getAllMaps: jest.fn().mockResolvedValue([mockData]),
      getMap: jest.fn().mockImplementation((id) => {
        if (id === 'map1') return Promise.resolve(mockData);
        if (id === 'map2') return Promise.resolve({
          id: 'map2',
          title: 'Map2',
          rootNode: {
            id: 'root2',
            text: 'Map2 Root',
            x: 400,
            y: 300,
            children: [{
              id: 'node2',
              text: 'Map2 Content',
              x: 500,
              y: 200,
              children: []
            }]
          }
        });
        return Promise.reject(new Error('Map not found'));
      }),
      createMap: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      deleteMap: jest.fn().mockResolvedValue(true),
      updateMap: jest.fn().mockResolvedValue(true)
    };

    const { getCurrentAdapter } = require('../../utils/storageAdapter');
    getCurrentAdapter.mockReturnValue(mockAdapter);
  });

  test('should preserve map content during map switching with editing', async () => {
    const { result } = renderHook(() => useMindMapMulti(mockData, mockSetData, mockUpdateData));

    // Wait for initial load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Simulate editing a node in Map1 - update the stored data
    const editedMap1Data = {
      ...mockData,
      rootNode: {
        ...mockData.rootNode,
        children: [{
          id: 'node1',
          text: 'Edited Node Content',
          x: 500,
          y: 200,
          children: []
        }]
      }
    };

    // Update the mock to return edited data
    mockAdapter.getMap.mockImplementation((id) => {
      if (id === 'map1') return Promise.resolve(editedMap1Data);
      if (id === 'map2') return Promise.resolve({
        id: 'map2',
        title: 'Map2',
        rootNode: {
          id: 'root2',
          text: 'Map2 Root',
          x: 400,
          y: 300,
          children: [{
            id: 'node2',
            text: 'Map2 Content',
            x: 500,
            y: 200,
            children: []
          }]
        }
      });
      return Promise.reject(new Error('Map not found'));
    });

    // Switch to Map2
    await act(async () => {
      await result.current.switchToMap('map2');
    });

    // Verify Map2 was loaded
    expect(mockSetData).toHaveBeenCalledWith(expect.objectContaining({
      id: 'map2',
      title: 'Map2'
    }));

    // Switch back to Map1 - this is where the bug occurs
    await act(async () => {
      await result.current.switchToMap('map1');
    });

    // The original Map1 content should still be preserved
    expect(mockSetData).toHaveBeenCalledWith(expect.objectContaining({
      id: 'map1',
      title: 'Map1',
      rootNode: expect.objectContaining({
        children: expect.arrayContaining([
          expect.objectContaining({
            id: 'node1',
            text: 'Edited Node Content'
          })
        ])
      })
    }));
  });

  test('should simulate editing state preservation during map switch', async () => {
    const { result } = renderHook(() => useMindMapMulti(mockData, mockSetData, mockUpdateData));

    // Wait for initial load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Create a mock DOM element to simulate editing
    const mockInput = document.createElement('input');
    mockInput.className = 'node-input';
    mockInput.dataset.nodeId = 'node1';
    mockInput.value = 'Being Edited';
    document.body.appendChild(mockInput);

    // Mock finishEdit function
    const mockFinishEdit = jest.fn().mockResolvedValue(true);

    // Switch to another map while simulating editing
    await act(async () => {
      await result.current.switchToMap('map2', false, null, null, null, null, null, mockFinishEdit);
    });

    // Verify finishEdit was called to preserve the edit
    expect(mockFinishEdit).toHaveBeenCalledWith(
      'node1',
      'Being Edited',
      expect.objectContaining({
        skipMapSwitchDelete: true,
        allowDuringEdit: true,
        source: 'mapSwitch'
      })
    );

    // Verify current map was saved before switching
    expect(mockAdapter.updateMap).toHaveBeenCalledWith('map1', mockData);

    // Clean up
    if (document.body.contains(mockInput)) {
      document.body.removeChild(mockInput);
    }
  });

  test('should handle map switching without editing state', async () => {
    const { result } = renderHook(() => useMindMapMulti(mockData, mockSetData, mockUpdateData));

    // Wait for initial load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Mock finishEdit function
    const mockFinishEdit = jest.fn().mockResolvedValue(true);

    // Switch to another map without editing
    await act(async () => {
      await result.current.switchToMap('map2', false, null, null, null, null, null, mockFinishEdit);
    });

    // Verify finishEdit was NOT called when no editing
    expect(mockFinishEdit).not.toHaveBeenCalled();

    // Verify current map was still saved before switching
    expect(mockAdapter.updateMap).toHaveBeenCalledWith('map1', mockData);
  });
});