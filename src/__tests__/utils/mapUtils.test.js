/**
 * マップユーティリティ関数のテスト
 */

import {
  generateId,
  createInitialMapData,
  createNode,
  findNode,
  findParent,
  addChildNode,
  updateNode,
  deleteNode,
} from '../../shared/utils/mapUtils.js';

describe('mapUtils', () => {
  test('generateId should create unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
  });

  test('createInitialMapData should create valid map structure', () => {
    const mapData = createInitialMapData();
    
    expect(mapData).toMatchObject({
      id: expect.any(String),
      title: '新しいマインドマップ',
      rootNode: {
        id: 'root',
        text: 'メインテーマ',
        x: 400,
        y: 300,
        children: [],
      },
      settings: {
        autoSave: true,
        autoLayout: true,
      },
    });
  });

  test('findNode should locate nodes correctly', () => {
    const mapData = createInitialMapData();
    
    // ルートノードを見つける
    const rootNode = findNode(mapData.rootNode, 'root');
    expect(rootNode).toBe(mapData.rootNode);
    
    // 存在しないノード
    const nonExistent = findNode(mapData.rootNode, 'nonexistent');
    expect(nonExistent).toBeNull();
  });

  test('addChildNode should add node correctly', () => {
    const mapData = createInitialMapData();
    const updatedMap = addChildNode(mapData, 'root', 'Child Node');
    
    expect(updatedMap.rootNode.children).toHaveLength(1);
    expect(updatedMap.rootNode.children[0]).toMatchObject({
      text: 'Child Node',
      id: expect.any(String),
      children: [],
    });
  });

  test('updateNode should modify node correctly', () => {
    const mapData = createInitialMapData();
    const updatedMap = updateNode(mapData, 'root', { text: 'Updated Root' });
    
    expect(updatedMap.rootNode.text).toBe('Updated Root');
  });

  test('deleteNode should remove node correctly', () => {
    let mapData = createInitialMapData();
    mapData = addChildNode(mapData, 'root', 'Child to Delete');
    
    const childId = mapData.rootNode.children[0].id;
    const updatedMap = deleteNode(mapData, childId);
    
    expect(updatedMap.rootNode.children).toHaveLength(0);
  });

  test('deleteNode should not allow root deletion', () => {
    const mapData = createInitialMapData();
    
    expect(() => {
      deleteNode(mapData, 'root');
    }).toThrow('Cannot delete root node');
  });
});