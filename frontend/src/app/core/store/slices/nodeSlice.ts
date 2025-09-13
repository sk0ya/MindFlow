import type { StateCreator } from 'zustand';
import type { MindMapNode, Position, NodeLink } from '@shared/types';
import { logger } from '../../../shared/utils/logger';
import { 
  addLinkToNodeInTree, 
  updateLinkInNodeTree, 
  removeLinkFromNodeTree 
} from '../../../shared/utils/linkUtils';
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
import { getBranchColor } from '../../../shared/utils/nodeUtils';
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
  startEditingWithCursorAtEnd: (nodeId: string) => void;
  startEditingWithCursorAtStart: (nodeId: string) => void;
  finishEditing: (nodeId: string, text: string) => void;
  cancelEditing: () => void;
  setEditText: (text: string) => void;

  // Link operations
  addNodeLink: (nodeId: string, linkData: Partial<NodeLink>) => void;
  updateNodeLink: (nodeId: string, linkId: string, updates: Partial<NodeLink>) => void;
  deleteNodeLink: (nodeId: string, linkId: string) => void;
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
        
        // Update position first
        newNode.x = newPosition.x;
        newNode.y = newPosition.y;
        
        // Add node to normalized data first to establish parent-child relationship
        state.normalizedData = addNormalizedNode(state.normalizedData, parentId, newNode);
        
        // Color assignment - ブランチベースの色割り当て
        const color = parentNode.id === 'root' 
          ? COLORS.NODE_COLORS[childNodes.length % COLORS.NODE_COLORS.length]
          : getBranchColor(newNode.id, state.normalizedData);
        
        // Update color after establishing relationship
        newNode.color = color;
        state.normalizedData.nodes[newNode.id] = { ...newNode };
        
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
        
        // 位置を更新
        newNode.x = position.x;
        newNode.y = position.y;
        
        // Add sibling node first to establish parent-child relationship
        state.normalizedData = addSiblingNormalizedNode(state.normalizedData, nodeId, newNode, true);
        
        // 兄弟ノードはブランチベースの色割り当て
        const color = getBranchColor(newNode.id, state.normalizedData);
        
        // Update color after establishing relationship
        newNode.color = color;
        state.normalizedData.nodes[newNode.id] = { ...newNode };
        
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
        state.editingMode = 'select-all'; // テキスト選択モード
      }
    });
  },

  startEditingWithCursorAtEnd: (nodeId: string) => {
    set((state) => {
      const node = state.normalizedData?.nodes[nodeId];
      if (node) {
        state.editingNodeId = nodeId;
        state.editText = node.text;
        state.editingMode = 'cursor-at-end'; // カーソル末尾モード
      }
    });
  },

  startEditingWithCursorAtStart: (nodeId: string) => {
    set((state) => {
      const node = state.normalizedData?.nodes[nodeId];
      if (node) {
        state.editingNodeId = nodeId;
        state.editText = node.text;
        state.editingMode = 'cursor-at-start'; // カーソル先頭モード
      }
    });
  },

  finishEditing: (nodeId: string, text: string) => {
    const trimmedText = text.trim();
    
    // If text is empty, delete the node and select parent
    if (!trimmedText) {
      // Get parent info before deleting
      let parentId: string | null = null;
      const { normalizedData } = get();
      if (normalizedData) {
        parentId = normalizedData.parentMap[nodeId] || null;
      }
      
      // Delete the empty node
      get().deleteNode(nodeId);
      
      // Select parent node if it exists and is not root
      if (parentId && parentId !== 'root') {
        set((state) => {
          state.selectedNodeId = parentId;
        });
      } else if (parentId === 'root') {
        // If parent is root, select root
        set((state) => {
          state.selectedNodeId = 'root';
        });
      }
      
      // Clear editing state
      set((state) => {
        state.editingNodeId = null;
        state.editText = '';
        state.editingMode = null;
      });
      
      return;
    }
    
    // Normal text update flow
    set((state) => {
      state.editingNodeId = null;
      state.editText = '';
      state.editingMode = null;
      // Keep node selected after editing
      state.selectedNodeId = nodeId;
    });
    
    // Update the node text
    get().updateNode(nodeId, { text: trimmedText });
    
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
      state.editingMode = null;
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

  // Link operations
  addNodeLink: (nodeId: string, linkData: Partial<NodeLink>) => {
    set((state) => {
      if (!state.data) return;
      
      try {
        // Update tree structure with new link
        const updatedRootNode = addLinkToNodeInTree(state.data.rootNode, nodeId, linkData);
        state.data = {
          ...state.data,
          rootNode: updatedRootNode,
          updatedAt: new Date().toISOString()
        };

        // Update normalized data if it exists
        if (state.normalizedData) {
          const node = state.normalizedData.nodes[nodeId];
          if (node) {
            const updatedNode = addLinkToNodeInTree(node, nodeId, linkData);
            state.normalizedData.nodes[nodeId] = updatedNode;
          }
        }

        logger.debug('Link added to node:', nodeId, linkData);
      } catch (error) {
        logger.error('addNodeLink error:', error);
      }
    });
  },

  updateNodeLink: (nodeId: string, linkId: string, updates: Partial<NodeLink>) => {
    set((state) => {
      if (!state.data) return;
      
      try {
        // Update tree structure
        const updatedRootNode = updateLinkInNodeTree(state.data.rootNode, nodeId, linkId, updates);
        state.data = {
          ...state.data,
          rootNode: updatedRootNode,
          updatedAt: new Date().toISOString()
        };

        // Update normalized data if it exists
        if (state.normalizedData) {
          const node = state.normalizedData.nodes[nodeId];
          if (node && node.links) {
            const updatedLinks = node.links.map(link =>
              link.id === linkId ? { ...link, ...updates, updatedAt: new Date().toISOString() } : link
            );
            state.normalizedData.nodes[nodeId] = { ...node, links: updatedLinks };
          }
        }

        logger.debug('Link updated:', nodeId, linkId, updates);
      } catch (error) {
        logger.error('updateNodeLink error:', error);
      }
    });
  },

  deleteNodeLink: (nodeId: string, linkId: string) => {
    set((state) => {
      if (!state.data) return;
      
      try {
        // Update tree structure
        const updatedRootNode = removeLinkFromNodeTree(state.data.rootNode, nodeId, linkId);
        state.data = {
          ...state.data,
          rootNode: updatedRootNode,
          updatedAt: new Date().toISOString()
        };

        // Update normalized data if it exists
        if (state.normalizedData) {
          const node = state.normalizedData.nodes[nodeId];
          if (node && node.links) {
            const filteredLinks = node.links.filter(link => link.id !== linkId);
            state.normalizedData.nodes[nodeId] = { ...node, links: filteredLinks };
          }
        }

        logger.debug('Link deleted from node:', nodeId, linkId);
      } catch (error) {
        logger.error('deleteNodeLink error:', error);
      }
    });
  },
});