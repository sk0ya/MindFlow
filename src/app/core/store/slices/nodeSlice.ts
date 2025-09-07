import type { StateCreator } from 'zustand';
import type { MindMapNode, Position } from '@shared/types';
import { logger } from '../../../shared/utils/logger';
import { 
  updateNormalizedNode,
  deleteNormalizedNode,
  addNormalizedNode,
  addSiblingNormalizedNode,
  moveNormalizedNode,
  changeSiblingOrderNormalized,
  denormalizeTreeData
} from '../../data';
import { createNewNode } from '../../../shared/types/dataTypes';
import { COLORS, LAYOUT } from '../../../shared';
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
        logger.error('updateNode error:', error);
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
        
        // 設定を取得してノード作成時に適用
        const settings = state.settings;
        const newNode = createNewNode(text, parentNode, settings);
        newNodeId = newNode.id;
        
        const childIds = state.normalizedData.childrenMap[parentId] || [];
        const childNodes = childIds.map(id => state.normalizedData?.nodes[id]).filter(Boolean);
        
        // New node position calculation
        let newPosition: Position;
        if (childNodes.length === 0) {
          // First child node case
          newPosition = {
            x: parentNode.x + LAYOUT.LEVEL_SPACING,
            y: parentNode.y
          };
        } else {
          // When existing child nodes exist, place below the last child
          const lastChild = childNodes[childNodes.length - 1];
          if (lastChild) {
            newPosition = {
              x: lastChild.x,
              y: lastChild.y + LAYOUT.LEVEL_SPACING * 0.6
            };
          } else {
            // Fallback position
            newPosition = {
              x: parentNode.x + LAYOUT.LEVEL_SPACING,
              y: parentNode.y
            };
          }
        }
        
        // Color assignment - ルートノードの子は設定色、それ以外は親色継承
        const color = parentNode.id === 'root' 
          ? COLORS.NODE_COLORS[childNodes.length % COLORS.NODE_COLORS.length]
          : parentNode.color || '#666';
        
        // Update position and color
        newNode.x = newPosition.x;
        newNode.y = newPosition.y;
        newNode.color = color;
        
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
        logger.error('addChildNode error:', error);
      }
    });
    
    // Apply auto layout if enabled
    const { data } = get();
    logger.debug('🔍 Auto layout check (addChildNode):', {
      hasData: !!data,
      hasSettings: !!data?.settings,
      autoLayoutEnabled: data?.settings?.autoLayout,
      settingsObject: data?.settings
    });
    if (data?.settings?.autoLayout) {
      logger.debug('✅ Applying auto layout after addChildNode');
      const applyAutoLayout = get().applyAutoLayout;
      if (typeof applyAutoLayout === 'function') {
        applyAutoLayout();
      } else {
        logger.error('❌ applyAutoLayout function not found');
      }
    } else {
      logger.debug('❌ Auto layout disabled or settings missing');
    }
    
    return newNodeId;
  },

  addSiblingNode: (nodeId: string, text: string = 'New Node') => {
    let newNodeId: string | undefined;
    
    set((state) => {
      if (!state.normalizedData) return;
      
      try {
        const currentNode = state.normalizedData.nodes[nodeId];
        if (!currentNode) return;
        
        const parentId = state.normalizedData.parentMap[nodeId];
        if (!parentId) return; // ルートノードには兄弟を追加できない
        
        const parentNode = state.normalizedData.nodes[parentId];
        if (!parentNode) return;
        
        // 設定を取得してノード作成時に適用
        const settings = state.settings;
        const newNode = createNewNode(text, parentNode, settings);
        newNodeId = newNode.id;
        
        // 兄弟ノードは同じ階層レベルに配置
        const position: Position = {
          x: currentNode.x + 200, // 兄弟ノードは横に配置
          y: currentNode.y + 80   // 少し下にずらす
        };
        
        // 兄弟ノードは親の色を継承
        const color = currentNode.color || parentNode.color || '#666';
        
        // 位置と色を更新
        newNode.x = position.x;
        newNode.y = position.y;
        newNode.color = color;
        
        state.normalizedData = addSiblingNormalizedNode(state.normalizedData, nodeId, newNode, true);
        
        // 新しいノードを選択
        state.selectedNodeId = newNode.id;
        
        // ツリー構造と同期
        const newRootNode = denormalizeTreeData(state.normalizedData);
        if (state.data) {
          state.data = {
            ...state.data,
            rootNode: newRootNode,
            updatedAt: new Date().toISOString()
          };
        }
      } catch (error) {
        logger.error('addSiblingNode error:', error);
      }
    });
    
    // Apply auto layout if enabled
    const { data } = get();
    logger.debug('🔍 Auto layout check (addSiblingNode):', {
      hasData: !!data,
      hasSettings: !!data?.settings,
      autoLayoutEnabled: data?.settings?.autoLayout,
      settingsObject: data?.settings
    });
    if (data?.settings?.autoLayout) {
      logger.debug('✅ Applying auto layout after addSiblingNode');
      const applyAutoLayout = get().applyAutoLayout;
      if (typeof applyAutoLayout === 'function') {
        applyAutoLayout();
      } else {
        logger.error('❌ applyAutoLayout function not found');
      }
    } else {
      logger.debug('❌ Auto layout disabled or settings missing');
    }
    
    return newNodeId;
  },

  deleteNode: (nodeId: string) => {
    let nextNodeToSelect: string | null = null;
    
    set((state) => {
      if (!state.normalizedData) return;
      
      try {
        // Before deleting, find the next node to select
        if (state.selectedNodeId === nodeId) {
          const parentId = state.normalizedData.parentMap[nodeId];
          if (parentId) {
            const siblings = state.normalizedData.childrenMap[parentId] || [];
            const currentIndex = siblings.indexOf(nodeId);
            
            if (currentIndex !== -1) {
              // Try next sibling first
              if (currentIndex < siblings.length - 1) {
                nextNodeToSelect = siblings[currentIndex + 1];
              }
              // If no next sibling, try previous sibling
              else if (currentIndex > 0) {
                nextNodeToSelect = siblings[currentIndex - 1];
              }
              // If no siblings, select parent (unless it's root)
              else if (parentId !== 'root') {
                nextNodeToSelect = parentId;
              }
              // If parent is root and no siblings, keep null
            }
          }
        }
        
        state.normalizedData = deleteNormalizedNode(state.normalizedData, nodeId);
        
        // Set new selection
        if (state.selectedNodeId === nodeId) {
          state.selectedNodeId = nextNodeToSelect;
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
        logger.error('deleteNode error:', error);
      }
    });
    
    // Apply auto layout if enabled
    const { data } = get();
    logger.debug('🔍 Auto layout check (deleteNode):', {
      hasData: !!data,
      hasSettings: !!data?.settings,
      autoLayoutEnabled: data?.settings?.autoLayout
    });
    if (data?.settings?.autoLayout) {
      logger.debug('✅ Applying auto layout after deleteNode');
      get().applyAutoLayout();
    } else {
      logger.debug('❌ Auto layout disabled or settings missing');
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
        logger.error('moveNode error:', error);
      }
    });
    
    // Apply auto layout if enabled
    const { data } = get();
    if (data?.settings?.autoLayout) {
      get().applyAutoLayout();
    }
  },

  changeSiblingOrder: (draggedNodeId: string, targetNodeId: string, insertBefore: boolean = true) => {
    logger.debug('🏪 Store changeSiblingOrder開始:', { draggedNodeId, targetNodeId, insertBefore });
    set((state) => {
      if (!state.normalizedData) {
        logger.error('❌ normalizedDataが存在しません');
        return;
      }
      
      try {
        logger.debug('🔄 changeSiblingOrder実行:', { draggedNodeId, targetNodeId, insertBefore });
        const originalData = state.normalizedData;
        state.normalizedData = changeSiblingOrderNormalized(state.normalizedData, draggedNodeId, targetNodeId, insertBefore);
        
        // Check if there were changes
        const hasChanged = JSON.stringify(originalData.childrenMap) !== JSON.stringify(state.normalizedData.childrenMap);
        logger.debug('🔄 変更チェック:', { hasChanged });
        
        // Sync back to tree structure
        const newRootNode = denormalizeTreeData(state.normalizedData);
        if (state.data) {
          state.data = {
            ...state.data,
            rootNode: newRootNode,
            updatedAt: new Date().toISOString()
          };
          logger.debug('🔄 データ更新完了');
        }
        logger.debug('✅ changeSiblingOrder完了');
      } catch (error) {
        logger.error('❌ changeSiblingOrder error:', error);
      }
    });
    
    // Apply auto layout if enabled
    const { data } = get();
    if (data?.settings?.autoLayout) {
      logger.debug('🔄 自動レイアウト適用中...');
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
    
    // Apply auto layout if enabled
    const { data } = get();
    logger.debug('🔍 Auto layout check (finishEditing):', {
      hasData: !!data,
      hasSettings: !!data?.settings,
      autoLayoutEnabled: data?.settings?.autoLayout,
      settingsObject: data?.settings
    });
    if (data?.settings?.autoLayout) {
      logger.debug('✅ Applying auto layout after finishEditing');
      const applyAutoLayout = get().applyAutoLayout;
      if (typeof applyAutoLayout === 'function') {
        applyAutoLayout();
      } else {
        logger.error('❌ applyAutoLayout function not found');
      }
    } else {
      logger.debug('❌ Auto layout disabled or settings missing');
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
        logger.error('toggleNodeCollapse error:', error);
      }
    });
    
    // Apply auto layout if enabled
    const { data } = get();
    if (data?.settings?.autoLayout) {
      get().applyAutoLayout();
    }
  },
});