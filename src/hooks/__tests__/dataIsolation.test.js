import { renderHook, act } from '@testing-library/react';
import { useMindMapMulti } from '../useMindMapMulti';
import { assignColorsToExistingNodes } from '../../utils/dataTypes';

// Mock the storage modules
jest.mock('../../utils/storageRouter', () => ({
  getCurrentMindMap: jest.fn(),
  getAllMindMaps: jest.fn().mockResolvedValue([]),
  createNewMindMap: jest.fn(),
  deleteMindMap: jest.fn(),
  saveMindMap: jest.fn().mockResolvedValue(true),
  isCloudStorageEnabled: jest.fn().mockReturnValue(false)
}));

jest.mock('../../utils/storageAdapter', () => ({
  getCurrentAdapter: jest.fn(() => ({
    getAllMaps: jest.fn().mockResolvedValue([]),
    getMap: jest.fn(),
    createMap: jest.fn(),
    deleteMap: jest.fn(),
    updateMap: jest.fn().mockResolvedValue(true)
  }))
}));

jest.mock('../../utils/dataTypes', () => {
  const original = jest.requireActual('../../utils/dataTypes');
  return {
    ...original,
    assignColorsToExistingNodes: jest.fn(data => original.assignColorsToExistingNodes(data))
  };
});

describe('Data Isolation Tests', () => {
  let mockData1, mockData2, mockSetData, mockUpdateData, mockAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Create distinct test data
    mockData1 = {
      id: 'map1',
      title: 'Map1',
      rootNode: {
        id: 'root1',
        text: 'Map1 Root',
        x: 400,
        y: 300,
        children: [{
          id: 'node1',
          text: 'Original Map1 Content',
          x: 500,
          y: 200,
          children: []
        }]
      }
    };

    mockData2 = {
      id: 'map2',
      title: 'Map2',
      rootNode: {
        id: 'root2',
        text: 'Map2 Root',
        x: 400,
        y: 300,
        children: [{
          id: 'node2',
          text: 'Original Map2 Content',
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
      getAllMaps: jest.fn().mockResolvedValue([mockData1, mockData2]),
      getMap: jest.fn().mockImplementation((id) => {
        if (id === 'map1') return Promise.resolve(mockData1);
        if (id === 'map2') return Promise.resolve(mockData2);
        return Promise.reject(new Error('Map not found'));
      }),
      createMap: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      deleteMap: jest.fn().mockResolvedValue(true),
      updateMap: jest.fn().mockResolvedValue(true)
    };

    const { getCurrentAdapter } = require('../../utils/storageAdapter');
    getCurrentAdapter.mockReturnValue(mockAdapter);
  });

  test('assignColorsToExistingNodes should create completely independent data', () => {
    // Test the color assignment function for data isolation
    const result1 = assignColorsToExistingNodes(mockData1);
    const result2 = assignColorsToExistingNodes(mockData2);

    // Verify that the data structures are completely independent
    expect(result1).not.toBe(mockData1); // Should be different object
    expect(result2).not.toBe(mockData2); // Should be different object
    expect(result1.rootNode).not.toBe(mockData1.rootNode); // Deep clone
    expect(result2.rootNode).not.toBe(mockData2.rootNode); // Deep clone
    expect(result1.rootNode.children).not.toBe(mockData1.rootNode.children); // Children array cloned
    expect(result2.rootNode.children).not.toBe(mockData2.rootNode.children); // Children array cloned

    // Verify no cross-contamination
    expect(result1.rootNode.children).not.toBe(result2.rootNode.children);
    expect(result1.rootNode.children[0]).not.toBe(result2.rootNode.children[0]);

    // Verify content integrity
    expect(result1.rootNode.children[0].text).toBe('Original Map1 Content');
    expect(result2.rootNode.children[0].text).toBe('Original Map2 Content');
  });

  test('map switching should maintain data isolation', async () => {
    const { result } = renderHook(() => useMindMapMulti(mockData1, mockSetData, mockUpdateData));

    // Wait for initial load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Modify mockData1 to simulate editing
    const modifiedMockData1 = {
      ...mockData1,
      rootNode: {
        ...mockData1.rootNode,
        children: [{
          ...mockData1.rootNode.children[0],
          text: 'Modified Map1 Content'
        }]
      }
    };

    // Update the mock to return modified data for map1
    mockAdapter.getMap.mockImplementation((id) => {
      if (id === 'map1') return Promise.resolve(modifiedMockData1);
      if (id === 'map2') return Promise.resolve(mockData2);
      return Promise.reject(new Error('Map not found'));
    });

    // Switch to Map2
    await act(async () => {
      await result.current.switchToMap('map2');
    });

    // Verify Map2 was loaded with original content
    const map2Call = mockSetData.mock.calls.find(call => 
      call[0].id === 'map2'
    );
    expect(map2Call).toBeTruthy();
    expect(map2Call[0].rootNode.children[0].text).toBe('Original Map2 Content');

    // Switch back to Map1
    await act(async () => {
      await result.current.switchToMap('map1');
    });

    // Verify Map1 maintains its modified content
    const map1Call = mockSetData.mock.calls.find(call => 
      call[0].id === 'map1' && call[0].rootNode.children[0].text === 'Modified Map1 Content'
    );
    expect(map1Call).toBeTruthy();
    expect(map1Call[0].rootNode.children[0].text).toBe('Modified Map1 Content');
  });

  test('data references should be completely independent', async () => {
    const { result } = renderHook(() => useMindMapMulti(mockData1, mockSetData, mockUpdateData));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Switch to Map2
    await act(async () => {
      await result.current.switchToMap('map2');
    });

    // Switch back to Map1
    await act(async () => {
      await result.current.switchToMap('map1');
    });

    // Verify all setData calls used independent data objects
    const allCalls = mockSetData.mock.calls;
    for (let i = 0; i < allCalls.length - 1; i++) {
      for (let j = i + 1; j < allCalls.length; j++) {
        const call1 = allCalls[i][0];
        const call2 = allCalls[j][0];
        
        if (call1.rootNode && call2.rootNode) {
          // Verify no shared object references
          expect(call1.rootNode).not.toBe(call2.rootNode);
          if (call1.rootNode.children && call2.rootNode.children) {
            expect(call1.rootNode.children).not.toBe(call2.rootNode.children);
          }
        }
      }
    }
  });

  test('deep modifications should not affect other maps', () => {
    const map1Copy = assignColorsToExistingNodes(mockData1);
    const map2Copy = assignColorsToExistingNodes(mockData2);

    // Deeply modify map1Copy
    map1Copy.rootNode.children[0].text = 'Deeply modified content';
    map1Copy.rootNode.children[0].newProperty = 'new value';
    map1Copy.rootNode.children.push({
      id: 'new-node',
      text: 'New node in map1',
      children: []
    });

    // Verify map2Copy is unaffected
    expect(map2Copy.rootNode.children[0].text).toBe('Original Map2 Content');
    expect(map2Copy.rootNode.children[0].newProperty).toBeUndefined();
    expect(map2Copy.rootNode.children.length).toBe(1);

    // Verify original data is unaffected
    expect(mockData1.rootNode.children[0].text).toBe('Original Map1 Content');
    expect(mockData2.rootNode.children[0].text).toBe('Original Map2 Content');
  });
});