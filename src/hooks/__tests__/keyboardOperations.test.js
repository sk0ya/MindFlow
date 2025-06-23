import { renderHook, act } from '@testing-library/react';
import { useMindMapNodes } from '../useMindMapNodes';

// Mock the storage modules
jest.mock('../../utils/storageAdapter', () => ({
  getCurrentAdapter: jest.fn(() => ({
    addNode: jest.fn().mockResolvedValue({ success: true }),
    updateNode: jest.fn().mockResolvedValue({ success: true }),
    deleteNode: jest.fn().mockResolvedValue({ success: true })
  }))
}));

jest.mock('../../utils/autoLayout', () => ({
  mindMapLayoutPreserveRoot: jest.fn(rootNode => rootNode)
}));

jest.mock('../../utils/dataTypes', () => {
  const original = jest.requireActual('../../utils/dataTypes');
  return {
    ...original,
    createNewNode: jest.fn((text, parent) => ({
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: text || '',
      x: 100,
      y: 100,
      children: []
    })),
    calculateNodePosition: jest.fn(() => ({ x: 100, y: 100 })),
    COLORS: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']
  };
});

describe('Keyboard Operations Tests', () => {
  let mockData, mockUpdateData;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create test data structure
    mockData = {
      id: 'test-map',
      title: 'Test Map',
      rootNode: {
        id: 'root',
        text: 'Root Node',
        x: 400,
        y: 300,
        children: [{
          id: 'child1',
          text: 'Child 1',
          x: 500,
          y: 200,
          children: []
        }]
      },
      settings: {
        autoLayout: true
      }
    };

    mockUpdateData = jest.fn().mockImplementation((newData) => {
      // Mock dataRef.current to reflect the updated data
      Object.assign(mockData, newData);
      return Promise.resolve(true);
    });
  });

  test('should add child node when Tab key is pressed', async () => {
    const { result } = renderHook(() => useMindMapNodes(mockData, mockUpdateData));

    // Set root as selected
    act(() => {
      result.current.setSelectedNodeId('root');
    });

    // Add child node (simulating Tab key action)
    await act(async () => {
      await result.current.addChildNode('root', '', true);
    });

    // Verify updateData was called
    expect(mockUpdateData).toHaveBeenCalled();
    
    // Verify the data structure contains a new child
    const updateCall = mockUpdateData.mock.calls[0][0];
    expect(updateCall.rootNode.children).toHaveLength(2); // Original + new child
    
    // Verify the new node has proper structure
    const newChild = updateCall.rootNode.children.find(child => child.id !== 'child1');
    expect(newChild).toBeDefined();
    expect(newChild.text).toBe('');
    expect(newChild.children).toEqual([]);
  });

  test('should add sibling node when Enter key is pressed', async () => {
    const { result } = renderHook(() => useMindMapNodes(mockData, mockUpdateData));

    // Set child1 as selected
    act(() => {
      result.current.setSelectedNodeId('child1');
    });

    // Add sibling node (simulating Enter key action)
    await act(async () => {
      await result.current.addSiblingNode('child1', '', true);
    });

    // Verify updateData was called
    expect(mockUpdateData).toHaveBeenCalled();
    
    // Verify the data structure contains a new sibling
    const updateCall = mockUpdateData.mock.calls[0][0];
    expect(updateCall.rootNode.children).toHaveLength(2); // Original child1 + new sibling
    
    // Verify both children exist
    const childIds = updateCall.rootNode.children.map(child => child.id);
    expect(childIds).toContain('child1');
    expect(childIds.some(id => id !== 'child1')).toBe(true);
  });

  test('should handle editing state correctly during node creation', async () => {
    const { result } = renderHook(() => useMindMapNodes(mockData, mockUpdateData));

    // Set root as selected
    act(() => {
      result.current.setSelectedNodeId('root');
    });

    // Add child node with editing enabled
    await act(async () => {
      await result.current.addChildNode('root', 'New Node Text', true);
    });

    // Verify editing state is set
    expect(result.current.editingNodeId).toBeTruthy();
    expect(result.current.editText).toBe('New Node Text');
    expect(result.current.selectedNodeId).toBeTruthy();
  });

  test('should handle node deletion correctly', async () => {
    const { result } = renderHook(() => useMindMapNodes(mockData, mockUpdateData));

    // Delete child1
    await act(async () => {
      await result.current.deleteNode('child1');
    });

    // Verify updateData was called
    expect(mockUpdateData).toHaveBeenCalled();
    
    // Verify the child was removed
    const updateCall = mockUpdateData.mock.calls[0][0];
    expect(updateCall.rootNode.children).toHaveLength(0);
    
    // Verify child1 is not in the data anymore
    const childIds = updateCall.rootNode.children.map(child => child.id);
    expect(childIds).not.toContain('child1');
  });

  test('should handle text updates during editing', async () => {
    const { result } = renderHook(() => useMindMapNodes(mockData, mockUpdateData));

    // Update node text
    await act(async () => {
      await result.current.updateNode('child1', { text: 'Updated Text' });
    });

    // Verify updateData was called
    expect(mockUpdateData).toHaveBeenCalled();
    
    // Verify the text was updated
    const updateCall = mockUpdateData.mock.calls[0][0];
    const updatedChild = updateCall.rootNode.children.find(child => child.id === 'child1');
    expect(updatedChild.text).toBe('Updated Text');
  });

  test('should maintain data independence during operations', async () => {
    const { result } = renderHook(() => useMindMapNodes(mockData, mockUpdateData));

    // Add first node
    await act(async () => {
      await result.current.addChildNode('root', 'Node 1', false);
    });

    // Verify first call
    expect(mockUpdateData).toHaveBeenCalledTimes(1);
    const firstCall = mockUpdateData.mock.calls[0][0];
    expect(firstCall.rootNode.children).toHaveLength(2); // original + 1 new

    // Add second node
    await act(async () => {
      await result.current.addChildNode('root', 'Node 2', false);
    });

    // Verify second call
    expect(mockUpdateData).toHaveBeenCalledTimes(2);
    const secondCall = mockUpdateData.mock.calls[1][0];
    
    // Verify data independence
    expect(firstCall).not.toBe(secondCall);
    expect(firstCall.rootNode).not.toBe(secondCall.rootNode);
    expect(firstCall.rootNode.children).not.toBe(secondCall.rootNode.children);
    
    // Since we're using the latest data each time and it accumulates properly
    expect(secondCall.rootNode.children).toHaveLength(3); // original + first new + second new
  });

  test('should handle finishEdit correctly', async () => {
    const { result } = renderHook(() => useMindMapNodes(mockData, mockUpdateData));

    // Start editing
    act(() => {
      result.current.startEdit('child1');
    });

    expect(result.current.editingNodeId).toBe('child1');
    expect(result.current.editText).toBe('Child 1');

    // Finish editing with new text
    await act(async () => {
      await result.current.finishEdit('child1', 'New Text');
    });

    // Verify editing state is cleared
    expect(result.current.editingNodeId).toBe(null);
    expect(result.current.editText).toBe('');

    // Verify the node was updated
    expect(mockUpdateData).toHaveBeenCalled();
  });

  test('should handle empty text deletion correctly', async () => {
    const { result } = renderHook(() => useMindMapNodes(mockData, mockUpdateData));

    // Add a new node with empty text
    await act(async () => {
      await result.current.addChildNode('root', '', false);
    });

    // Get the ID of the newly added node
    const addCall = mockUpdateData.mock.calls[0][0];
    const newNode = addCall.rootNode.children.find(child => child.id !== 'child1');
    const newNodeId = newNode.id;

    // Clear mock calls
    mockUpdateData.mockClear();

    // Try to finish edit with empty text on a new empty node (should trigger deletion)
    await act(async () => {
      await result.current.finishEdit(newNodeId, '', { forceDelete: true });
    });

    // Should have been called for deletion
    expect(mockUpdateData).toHaveBeenCalled();
  });
});