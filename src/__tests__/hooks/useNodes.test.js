/**
 * useNodes フックのテスト
 */

import { renderHook, act } from '@testing-library/react';
import { useNodes } from '../../core/hooks/useNodes.js';
import { createInitialMapData } from '../../shared/utils/mapUtils.js';

describe('useNodes', () => {
  let mockUpdateMap;
  let initialMapData;

  beforeEach(() => {
    mockUpdateMap = jest.fn();
    initialMapData = createInitialMapData();
  });

  test('addChild should add a child node', () => {
    const { result } = renderHook(() => useNodes(initialMapData, mockUpdateMap));

    act(() => {
      const nodeId = result.current.addChild('root', 'Test Child');
      expect(nodeId).toBeDefined();
      expect(typeof nodeId).toBe('string');
    });

    expect(mockUpdateMap).toHaveBeenCalled();
    const updatedMapData = mockUpdateMap.mock.calls[0][0];
    expect(updatedMapData.rootNode.children).toHaveLength(1);
    expect(updatedMapData.rootNode.children[0].text).toBe('Test Child');
  });

  test('update should modify node properties', () => {
    const { result } = renderHook(() => useNodes(initialMapData, mockUpdateMap));

    act(() => {
      result.current.update('root', { text: 'Updated Root' });
    });

    expect(mockUpdateMap).toHaveBeenCalled();
    const updatedMapData = mockUpdateMap.mock.calls[0][0];
    expect(updatedMapData.rootNode.text).toBe('Updated Root');
  });

  test('remove should delete a node', () => {
    // 子ノードを追加したマップデータを準備
    const mapWithChild = {
      ...initialMapData,
      rootNode: {
        ...initialMapData.rootNode,
        children: [
          {
            id: 'child1',
            text: 'Child to Delete',
            x: 600,
            y: 300,
            children: [],
          }
        ]
      }
    };

    const { result } = renderHook(() => useNodes(mapWithChild, mockUpdateMap));

    act(() => {
      result.current.remove('child1');
    });

    expect(mockUpdateMap).toHaveBeenCalled();
    const updatedMapData = mockUpdateMap.mock.calls[0][0];
    expect(updatedMapData.rootNode.children).toHaveLength(0);
  });

  test('find should locate nodes', () => {
    const { result } = renderHook(() => useNodes(initialMapData, mockUpdateMap));

    const rootNode = result.current.find('root');
    expect(rootNode).toBe(initialMapData.rootNode);

    const nonExistent = result.current.find('nonexistent');
    expect(nonExistent).toBeNull();
  });

  test('should handle null mapData gracefully', () => {
    const { result } = renderHook(() => useNodes(null, mockUpdateMap));

    expect(result.current.find('root')).toBeNull();
    
    act(() => {
      const nodeId = result.current.addChild('root', 'Test');
      expect(nodeId).toBeNull();
    });

    expect(mockUpdateMap).not.toHaveBeenCalled();
  });
});