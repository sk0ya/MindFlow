import type { StateCreator } from 'zustand';
import type { MindMapNode, Position } from '@shared/types';
import { 
  updateNormalizedNode,
  deleteNormalizedNode,
  addNormalizedNode,
  moveNormalizedNode,
  changeSiblingOrderNormalized,
  denormalizeTreeData
} from '../../data';
import { createNewNode } from '../../../shared/types/dataTypes';
import { COLORS } from '../../../shared';
import { LAYOUT } from '../../../shared';
import type { MindMapStore } from './types';

export interface NodeSlice {
  // Node operations (O(1) with normalized data)
  findNode: (nodeId: string) => MindMapNode | null;
  getChildNodes: (nodeId: string) => MindMapNode[];
  
  // CRUD operations
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  addChildNode: (parentId: string, text?: string) => string | undefined;
  addSiblingNode: (nodeId: string, text?: string) => string | undefined;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string) => void;
  changeSiblingOrder: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;
  toggleNodeCollapse: (nodeId: string) => void;
  
  // Selection & Editing
  selectNode: (nodeId: string | null) => void;
  startEditing: (nodeId: string) => void;
  finishEditing: (nodeId: string, text: string) => void;
  cancelEditing: () => void;
  setEditText: (text: string) => void;
}

export const createNodeSlice: StateCreator<
  MindMapStore,
  [["zustand/immer", never]],
  [],
  NodeSlice
> = (set, get) => ({
  // Node operations
  findNode: (nodeId: string) => {
    const { normalizedData } = get();
    if (!normalizedData || !nodeId) return null;
    return normalizedData.nodes[nodeId] || null;
  },

  getChildNodes: (nodeId: string) => {
    const { normalizedData } = get();
    if (!normalizedData || !nodeId) return [];
    const childIds = normalizedData.childrenMap[nodeId] || [];
    return childIds.map(childId => normalizedData.nodes[childId]).filter(Boolean);
  },

  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => {
    set((state) => {
      if (!state.normalizedData) return;
      
      try {
        state.normalizedData = updateNormalizedNode(state.normalizedData, nodeId, updates);
        
        // Sync back to tree structure
        const newRootNode = denormalizeTreeData(state.normalizedData);
        if (state.data) {
          state.data = {
            ...state.data,
            rootNode: newRootNode,
            updatedAt: new Date().toISOString()
          };
        }
      } catch (error) {
        console.error('updateNode error:', error);
      }
    });
  },

  addChildNode: (parentId: string, text: string = 'New Node') => {
    let newNodeId: string | undefined;
    
    set((state) => {
      if (!state.normalizedData) return;
      
      try {
        const parentNode = state.normalizedData.nodes[parentId];
        if (!parentNode) return;
        
        const childIds = state.normalizedData.childrenMap[parentId] || [];
        const childNodes = childIds.map(id => state.normalizedData?.nodes[id]).filter(Boolean);
        
        // New node position calculation
        let newPosition: Position;
        if (childNodes.length === 0) {
          // First child node case
          newPosition = {
            x: parentNode.x + LAYOUT.RADIAL_BASE_RADIUS,
            y: parentNode.y
          };
        } else {
          // When existing child nodes exist, place below the last child
          const lastChild = childNodes[childNodes.length - 1];
          if (lastChild) {
            newPosition = {
              x: lastChild.x,
              y: lastChild.y + LAYOUT.RADIAL_BASE_RADIUS * 0.8
            };
          } else {
            // Fallback position
            newPosition = {
              x: parentNode.x + LAYOUT.RADIAL_BASE_RADIUS,
              y: parentNode.y
            };
          }
        }
        
        const color = parentNode.id === 'root' 
          ? COLORS.NODE_COLORS[childNodes.length % COLORS.NODE_COLORS.length] 
          : parentNode.color || '#666';
        
        const newNode = createNewNode(text, parentNode);
        newNode.x = newPosition.x;
        newNode.y = newPosition.y;
        newNode.color = color;
        newNodeId = newNode.id;
        
        state.normalizedData = addNormalizedNode(state.normalizedData, parentId, newNode);
        
        // Select the new node
        state.selectedNodeId = newNode.id;
        
        // Sync back to tree structure
        const newRootNode = denormalizeTreeData(state.normalizedData);
        if (state.data) {
          state.data = {
            ...state.data,
            rootNode: newRootNode,
            updatedAt: new Date().toISOString()
          };
        }
      } catch (error) {
        console.error('addChildNode error:', error);
      }
    });
    
    // Apply auto layout if enabled
    const { data } = get();
    console.log('🔍 Auto layout check (addChildNode):', {
      hasData: !!data,
      hasSettings: !!data?.settings,
      autoLayoutEnabled: data?.settings?.autoLayout,
      settingsObject: data?.settings
    });
    if (data?.settings?.autoLayout) {
      console.log('✅ Applying auto layout after addChildNode');
      const applyAutoLayout = get().applyAutoLayout;
      if (typeof applyAutoLayout === 'function') {
        applyAutoLayout();
      } else {
        console.error('❌ applyAutoLayout function not found');
      }
    } else {
      console.log('❌ Auto layout disabled or settings missing');
    }
    
    return newNodeId;
  },

  addSiblingNode: (nodeId: string, text: string = 'New Node') => {
    const { normalizedData } = get();
    if (!normalizedData) return;
    
    const parentId = normalizedData.parentMap[nodeId];
    if (!parentId) return;
    
    return get().addChildNode(parentId, text);
  },

  deleteNode: (nodeId: string) => {
    set((state) => {
      if (!state.normalizedData) return;
      
      try {
        state.normalizedData = deleteNormalizedNode(state.normalizedData, nodeId);
        
        // Clear selection if deleted node was selected
        if (state.selectedNodeId === nodeId) {
          state.selectedNodeId = null;
        }
        if (state.editingNodeId === nodeId) {
          state.editingNodeId = null;
          state.editText = '';
        }
        
        // Sync back to tree structure
        const newRootNode = denormalizeTreeData(state.normalizedData);
        if (state.data) {
          state.data = {
            ...state.data,
            rootNode: newRootNode,
            updatedAt: new Date().toISOString()
          };
        }
      } catch (error) {
        console.error('deleteNode error:', error);
      }
    });
    
    // Apply auto layout if enabled
    const { data } = get();
    console.log('🔍 Auto layout check (deleteNode):', {
      hasData: !!data,
      hasSettings: !!data?.settings,
      autoLayoutEnabled: data?.settings?.autoLayout
    });
    if (data?.settings?.autoLayout) {
      console.log('✅ Applying auto layout after deleteNode');
      get().applyAutoLayout();
    } else {
      console.log('❌ Auto layout disabled or settings missing');
    }
  },

  moveNode: (nodeId: string, newParentId: string) => {
    set((state) => {
      if (!state.normalizedData) return;
      
      try {
        state.normalizedData = moveNormalizedNode(state.normalizedData, nodeId, newParentId);
        
        // Sync back to tree structure
        const newRootNode = denormalizeTreeData(state.normalizedData);
        if (state.data) {
          state.data = {
            ...state.data,
            rootNode: newRootNode,
            updatedAt: new Date().toISOString()
          };
        }
      } catch (error) {
        console.error('moveNode error:', error);
      }
    });
    
    // Apply auto layout if enabled
    const { data } = get();
    if (data?.settings?.autoLayout) {
      get().applyAutoLayout();
    }
  },

  changeSiblingOrder: (draggedNodeId: string, targetNodeId: string, insertBefore: boolean = true) => {
    console.log('🏪 Store changeSiblingOrder開始:', { draggedNodeId, targetNodeId, insertBefore });
    set((state) => {
      if (!state.normalizedData) {
        console.error('❌ normalizedDataが存在しません');
        return;
      }
      
      try {
        console.log('🔄 changeSiblingOrder実行:', { draggedNodeId, targetNodeId, insertBefore });
        const originalData = state.normalizedData;
        state.normalizedData = changeSiblingOrderNormalized(state.normalizedData, draggedNodeId, targetNodeId, insertBefore);
        
        // Check if there were changes
        const hasChanged = JSON.stringify(originalData.childrenMap) !== JSON.stringify(state.normalizedData.childrenMap);
        console.log('🔄 変更チェック:', { hasChanged });
        
        // Sync back to tree structure
        const newRootNode = denormalizeTreeData(state.normalizedData);
        if (state.data) {
          state.data = {
            ...state.data,
            rootNode: newRootNode,
            updatedAt: new Date().toISOString()
          };
          console.log('🔄 データ更新完了');
        }
        console.log('✅ changeSiblingOrder完了');
      } catch (error) {
        console.error('❌ changeSiblingOrder error:', error);
      }
    });
    
    // Apply auto layout if enabled
    const { data } = get();
    if (data?.settings?.autoLayout) {
      console.log('🔄 自動レイアウト適用中...');
      get().applyAutoLayout();
    }
  },

  // Selection & Editing
  selectNode: (nodeId: string | null) => {
    set((state) => {
      state.selectedNodeId = nodeId;
    });
  },

  startEditing: (nodeId: string) => {
    set((state) => {
      const node = state.normalizedData?.nodes[nodeId];
      if (node) {
        state.editingNodeId = nodeId;
        state.editText = node.text;
      }
    });
  },

  finishEditing: (nodeId: string, text: string) => {
    set((state) => {
      state.editingNodeId = null;
      state.editText = '';
      // Keep node selected after editing
      state.selectedNodeId = nodeId;
    });
    
    // Update the node text
    if (text.trim()) {
      get().updateNode(nodeId, { text: text.trim() });
    }
  },

  cancelEditing: () => {
    set((state) => {
      state.editingNodeId = null;
      state.editText = '';
    });
  },

  setEditText: (text: string) => {
    set((state) => {
      state.editText = text;
    });
  },

  toggleNodeCollapse: (nodeId: string) => {
    set((state) => {
      if (!state.normalizedData) return;
      
      try {
        const node = state.normalizedData.nodes[nodeId];
        if (!node) return;
        
        // Toggle collapsed state
        const newCollapsedState = !node.collapsed;
        state.normalizedData = updateNormalizedNode(state.normalizedData, nodeId, { 
          collapsed: newCollapsedState 
        });
        
        // Sync back to tree structure
        const newRootNode = denormalizeTreeData(state.normalizedData);
        if (state.data) {
          state.data = {
            ...state.data,
            rootNode: newRootNode,
            updatedAt: new Date().toISOString()
          };
        }
      } catch (error) {
        console.error('toggleNodeCollapse error:', error);
      }
    });
    
    // Apply auto layout if enabled
    const { data } = get();
    if (data?.settings?.autoLayout) {
      get().applyAutoLayout();
    }
  },
});