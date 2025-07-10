import { 
  findNodeById, 
  updateNodeInTree, 
  deleteNodeFromTree, 
  addNodeToTree,
  validateMindMapData,
  generateUniqueId
} from '../../Local/utils/dataUtils';

describe('dataUtils', () => {
  const mockTree = {
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
        children: [
          {
            id: 'grandchild1',
            text: 'Grandchild 1',
            x: 100,
            y: 150,
            children: []
          }
        ]
      },
      {
        id: 'child2',
        text: 'Child 2',
        x: 600,
        y: 200,
        children: []
      }
    ]
  };

  describe('findNodeById', () => {
    test('should find root node', () => {
      const result = findNodeById(mockTree, 'root');
      expect(result).toEqual(mockTree);
    });

    test('should find child node', () => {
      const result = findNodeById(mockTree, 'child1');
      expect(result).toEqual(expect.objectContaining({
        id: 'child1',
        text: 'Child 1'
      }));
    });

    test('should find grandchild node', () => {
      const result = findNodeById(mockTree, 'grandchild1');
      expect(result).toEqual(expect.objectContaining({
        id: 'grandchild1',
        text: 'Grandchild 1'
      }));
    });

    test('should return null for non-existent node', () => {
      const result = findNodeById(mockTree, 'nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('updateNodeInTree', () => {
    test('should update node text', () => {
      const result = updateNodeInTree(mockTree, 'child1', { text: 'Updated Child 1' });
      const updatedNode = findNodeById(result, 'child1');
      expect(updatedNode.text).toBe('Updated Child 1');
    });

    test('should update node position', () => {
      const result = updateNodeInTree(mockTree, 'child1', { x: 250, y: 250 });
      const updatedNode = findNodeById(result, 'child1');
      expect(updatedNode.x).toBe(250);
      expect(updatedNode.y).toBe(250);
    });

    test('should preserve other properties', () => {
      const result = updateNodeInTree(mockTree, 'child1', { text: 'Updated' });
      const updatedNode = findNodeById(result, 'child1');
      expect(updatedNode.children).toHaveLength(1);
      expect(updatedNode.id).toBe('child1');
    });
  });

  describe('deleteNodeFromTree', () => {
    test('should delete child node', () => {
      const result = deleteNodeFromTree(mockTree, 'child1');
      expect(findNodeById(result, 'child1')).toBeNull();
      expect(result.children).toHaveLength(1);
    });

    test('should delete grandchild node', () => {
      const result = deleteNodeFromTree(mockTree, 'grandchild1');
      expect(findNodeById(result, 'grandchild1')).toBeNull();
      const child1 = findNodeById(result, 'child1');
      expect(child1.children).toHaveLength(0);
    });

    test('should not delete root node', () => {
      const result = deleteNodeFromTree(mockTree, 'root');
      expect(result).toEqual(mockTree);
    });
  });

  describe('addNodeToTree', () => {
    test('should add node to parent', () => {
      const newNode = {
        id: 'new-child',
        text: 'New Child',
        x: 300,
        y: 400,
        children: []
      };

      const result = addNodeToTree(mockTree, 'root', newNode);
      expect(result.children).toHaveLength(3);
      expect(findNodeById(result, 'new-child')).toEqual(newNode);
    });

    test('should add node to child', () => {
      const newNode = {
        id: 'new-grandchild',
        text: 'New Grandchild',
        x: 150,
        y: 100,
        children: []
      };

      const result = addNodeToTree(mockTree, 'child2', newNode);
      const child2 = findNodeById(result, 'child2');
      expect(child2.children).toHaveLength(1);
      expect(child2.children[0]).toEqual(newNode);
    });
  });

  describe('validateMindMapData', () => {
    test('should validate valid data', () => {
      const validData = {
        id: 'map-1',
        title: 'Test Map',
        rootNode: mockTree
      };

      expect(validateMindMapData(validData)).toBe(true);
    });

    test('should reject data without id', () => {
      const invalidData = {
        title: 'Test Map',
        rootNode: mockTree
      };

      expect(validateMindMapData(invalidData)).toBe(false);
    });

    test('should reject data without title', () => {
      const invalidData = {
        id: 'map-1',
        rootNode: mockTree
      };

      expect(validateMindMapData(invalidData)).toBe(false);
    });

    test('should reject data without rootNode', () => {
      const invalidData = {
        id: 'map-1',
        title: 'Test Map'
      };

      expect(validateMindMapData(invalidData)).toBe(false);
    });
  });

  describe('generateUniqueId', () => {
    test('should generate unique IDs', () => {
      const id1 = generateUniqueId();
      const id2 = generateUniqueId();
      
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    test('should generate IDs with prefix', () => {
      const id = generateUniqueId('test');
      expect(id).toMatch(/^test-/);
    });
  });
});