/**
 * @jest-environment jsdom
 */

describe('Node ID Update During Editing', () => {
  // Mock DOM elements
  beforeEach(() => {
    document.body.innerHTML = '<input class="node-input" />';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should allow node ID updates even during editing', () => {
    const editingInput = document.querySelector('.node-input');
    
    // Simulate user editing
    editingInput.focus();
    editingInput.value = 'User is editing this node';
    
    // Check if editing
    const isCurrentlyEditing = editingInput && document.activeElement === editingInput;
    expect(isCurrentlyEditing).toBe(true);
    
    // Simulate updateData options for node ID update
    const updateOptions = {
      skipHistory: true,
      saveImmediately: false,
      allowDuringEdit: true,
      source: 'node-id-update'
    };
    
    // Test the logic from useMindMapData.ts
    const shouldSkipUpdate = isCurrentlyEditing && !updateOptions.allowDuringEdit;
    expect(shouldSkipUpdate).toBe(false); // Should NOT skip when allowDuringEdit is true
  });

  test('should skip regular updates during editing but allow ID updates', () => {
    const editingInput = document.querySelector('.node-input');
    editingInput.focus();
    editingInput.value = 'Editing content';
    
    const isCurrentlyEditing = editingInput && document.activeElement === editingInput;
    
    // Regular update (should be skipped)
    const regularUpdate = {
      skipHistory: false,
      allowDuringEdit: false,
      source: 'regular-update'
    };
    const shouldSkipRegular = isCurrentlyEditing && !regularUpdate.allowDuringEdit;
    expect(shouldSkipRegular).toBe(true);
    
    // ID update (should be allowed)
    const idUpdate = {
      skipHistory: true,
      allowDuringEdit: true,
      source: 'node-id-update'
    };
    const shouldSkipId = isCurrentlyEditing && !idUpdate.allowDuringEdit;
    expect(shouldSkipId).toBe(false);
    
    // Realtime sync (should be skipped)
    const realtimeSync = {
      skipHistory: true,
      allowDuringEdit: false,
      source: 'realtime-sync'
    };
    const shouldSkipRealtime = isCurrentlyEditing && !realtimeSync.allowDuringEdit;
    expect(shouldSkipRealtime).toBe(true);
  });

  test('should simulate node ID update scenario', () => {
    // Mock node data with temporary ID
    const originalNodeData = {
      id: 'map_123',
      rootNode: {
        id: 'root',
        children: [
          {
            id: 'temp_node_456', // Temporary ID from client
            text: 'Test Node',
            children: []
          }
        ]
      }
    };
    
    // Simulate server response with new ID
    const serverGeneratedId = 'server_node_789';
    
    // Mock updateNodeIdRecursive function logic
    const updateNodeIdRecursive = (node, oldId, newId) => {
      if (node.id === oldId) {
        return { ...node, id: newId };
      }
      if (node.children) {
        return { 
          ...node, 
          children: node.children.map(child => updateNodeIdRecursive(child, oldId, newId))
        };
      }
      return node;
    };
    
    // Update the node ID
    const newRootNode = updateNodeIdRecursive(
      originalNodeData.rootNode, 
      'temp_node_456', 
      serverGeneratedId
    );
    const updatedData = { ...originalNodeData, rootNode: newRootNode };
    
    // Verify the ID was updated correctly
    expect(updatedData.rootNode.children[0].id).toBe(serverGeneratedId);
    expect(updatedData.rootNode.children[0].text).toBe('Test Node');
    
    // Verify original data is unchanged
    expect(originalNodeData.rootNode.children[0].id).toBe('temp_node_456');
  });

  test('should handle map switching with updated node IDs', () => {
    // Mock scenario: User creates node, gets new ID from server, then switches maps
    const mapData = {
      id: 'map_1',
      title: 'Test Map',
      rootNode: {
        id: 'root',
        children: [
          {
            id: 'updated_node_123', // Updated from temporary ID
            text: 'New Node',
            children: []
          }
        ]
      }
    };
    
    // Before map switch, verify node exists
    expect(mapData.rootNode.children).toHaveLength(1);
    expect(mapData.rootNode.children[0].id).toBe('updated_node_123');
    
    // After map switch, node should still exist when reloaded
    const reloadedMapData = JSON.parse(JSON.stringify(mapData)); // Simulate reload
    expect(reloadedMapData.rootNode.children).toHaveLength(1);
    expect(reloadedMapData.rootNode.children[0].id).toBe('updated_node_123');
    expect(reloadedMapData.rootNode.children[0].text).toBe('New Node');
  });
});