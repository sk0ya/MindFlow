import { renderHook, act } from '@testing-library/react';
import { useMindMapNodes } from '../../Local/features/mindmap/useMindMapNodes';

describe('useMindMapNodes', () => {
  const mockData = {
    id: 'test-map',
    title: 'Test Map',
    rootNode: {
      id: 'root',
      text: 'Root',
      x: 400,
      y: 300,
      children: [
        {
          id: 'child1',
          text: 'Child 1',
          x: 200,
          y: 200,
          children: []
        }
      ]
    }
  };

  const mockSetData = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should add node correctly', () => {
    const { result } = renderHook(() => 
      useMindMapNodes(mockData, mockSetData, mockOnError)
    );

    act(() => {
      result.current.addNode('root', 'New Child');
    });

    expect(mockSetData).toHaveBeenCalledWith(expect.objectContaining({
      rootNode: expect.objectContaining({
        children: expect.arrayContaining([
          expect.objectContaining({
            text: 'New Child',
            children: []
          })
        ])
      })
    }));
  });

  test('should update node text correctly', () => {
    const { result } = renderHook(() => 
      useMindMapNodes(mockData, mockSetData, mockOnError)
    );

    act(() => {
      result.current.updateNodeText('child1', 'Updated Child');
    });

    expect(mockSetData).toHaveBeenCalledWith(expect.objectContaining({
      rootNode: expect.objectContaining({
        children: expect.arrayContaining([
          expect.objectContaining({
            id: 'child1',
            text: 'Updated Child'
          })
        ])
      })
    }));
  });

  test('should delete node correctly', () => {
    const { result } = renderHook(() => 
      useMindMapNodes(mockData, mockSetData, mockOnError)
    );

    act(() => {
      result.current.deleteNode('child1');
    });

    expect(mockSetData).toHaveBeenCalledWith(expect.objectContaining({
      rootNode: expect.objectContaining({
        children: []
      })
    }));
  });

  test('should find node correctly', () => {
    const { result } = renderHook(() => 
      useMindMapNodes(mockData, mockSetData, mockOnError)
    );

    const foundNode = result.current.findNode('child1');
    expect(foundNode).toEqual(expect.objectContaining({
      id: 'child1',
      text: 'Child 1'
    }));
  });

  test('should move node correctly', () => {
    const extendedData = {
      ...mockData,
      rootNode: {
        ...mockData.rootNode,
        children: [
          ...mockData.rootNode.children,
          {
            id: 'child2',
            text: 'Child 2',
            x: 600,
            y: 200,
            children: []
          }
        ]
      }
    };

    const { result } = renderHook(() => 
      useMindMapNodes(extendedData, mockSetData, mockOnError)
    );

    act(() => {
      result.current.moveNode('child1', 'child2');
    });

    expect(mockSetData).toHaveBeenCalledWith(expect.objectContaining({
      rootNode: expect.objectContaining({
        children: expect.arrayContaining([
          expect.objectContaining({
            id: 'child2',
            children: expect.arrayContaining([
              expect.objectContaining({
                id: 'child1',
                text: 'Child 1'
              })
            ])
          })
        ])
      })
    }));
  });

  test('should handle error on invalid operations', () => {
    const { result } = renderHook(() => 
      useMindMapNodes(mockData, mockSetData, mockOnError)
    );

    act(() => {
      result.current.deleteNode('nonexistent');
    });

    expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
  });
});