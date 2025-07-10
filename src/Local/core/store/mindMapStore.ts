import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { MindMapData, MindMapNode, Position } from '../../shared/types';
import { 
  normalizeTreeData, 
  denormalizeTreeData,
  updateNormalizedNode,
  deleteNormalizedNode,
  addNormalizedNode,
  moveNormalizedNode,
  type NormalizedData
} from '../data/normalizedStore';
import { createNewNode, COLORS } from '../../shared/types/dataTypes';
import { LAYOUT } from '../../shared/constants';

interface MindMapStore {
  // State
  data: MindMapData | null;
  normalizedData: NormalizedData | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  history: MindMapData[];
  historyIndex: number;
  
  // Actions
  setData: (data: MindMapData) => void;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  addChildNode: (parentId: string, text?: string) => string | undefined;
  addSiblingNode: (nodeId: string, text?: string) => string | undefined;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string) => void;
  
  // Node operations (O(1) with normalized data)
  findNode: (nodeId: string) => MindMapNode | null;
  getChildNodes: (nodeId: string) => MindMapNode[];
  
  // Selection & Editing
  selectNode: (nodeId: string | null) => void;
  startEditing: (nodeId: string) => void;
  finishEditing: (nodeId: string, text: string) => void;
  cancelEditing: () => void;
  setEditText: (text: string) => void;
  
  // History
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  
  // Utility
  updateNormalizedData: () => void;
  syncToMindMapData: () => void;
}

export const useMindMapStore = create<MindMapStore>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial state
        data: null,
        normalizedData: null,
        selectedNodeId: null,
        editingNodeId: null,
        editText: '',
        history: [],
        historyIndex: -1,
        
        // Set data and normalize
        setData: (data: MindMapData) => {
          set((state) => {
            state.data = data;
            state.normalizedData = normalizeTreeData(data.rootNode);
            
            // Add to history if not already there
            if (state.history.length === 0 || state.history[state.historyIndex] !== data) {
              state.history = [...state.history.slice(0, state.historyIndex + 1), data];
              state.historyIndex = state.history.length - 1;
            }
          });
        },
        
        // Update normalized data from current tree
        updateNormalizedData: () => {
          set((state) => {
            if (state.data?.rootNode) {
              state.normalizedData = normalizeTreeData(state.data.rootNode);
            }
          });
        },
        
        // Sync normalized data back to tree structure
        syncToMindMapData: () => {
          set((state) => {
            if (state.normalizedData && state.data) {
              const newRootNode = denormalizeTreeData(state.normalizedData);
              state.data = {
                ...state.data,
                rootNode: newRootNode,
                updatedAt: new Date().toISOString()
              };
              
              // Add to history
              state.history = [...state.history.slice(0, state.historyIndex + 1), state.data];
              state.historyIndex = state.history.length - 1;
            }
          });
        },
        
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
              const childNodes = childIds.map(id => state.normalizedData!.nodes[id]).filter(Boolean);
              
              // 新しいノードの位置を計算
              let newPosition: Position;
              if (childNodes.length === 0) {
                // 最初の子ノードの場合
                newPosition = {
                  x: parentNode.x + LAYOUT.RADIAL_BASE_RADIUS,
                  y: parentNode.y
                };
              } else {
                // 既存の子ノードがある場合、最後の子ノードの下に配置
                const lastChild = childNodes[childNodes.length - 1];
                newPosition = {
                  x: lastChild.x,
                  y: lastChild.y + LAYOUT.RADIAL_BASE_RADIUS * 0.8
                };
              }
              const color = parentNode.id === 'root' 
                ? COLORS[childNodes.length % COLORS.length] 
                : parentNode.color || '#666';
              
              const newNode = createNewNode(text, parentNode);
              newNode.x = newPosition.x;
              newNode.y = newPosition.y;
              newNode.color = color;
              newNodeId = newNode.id;
              
              state.normalizedData = addNormalizedNode(state.normalizedData, parentId, newNode);
              
              // 新しいノードを選択状態にする
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
            // 編集終了後もノードを選択状態に保つ
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
        
        // History
        undo: () => {
          set((state) => {
            if (state.historyIndex > 0) {
              state.historyIndex--;
              const previousData = state.history[state.historyIndex];
              state.data = previousData;
              state.normalizedData = normalizeTreeData(previousData.rootNode);
            }
          });
        },
        
        redo: () => {
          set((state) => {
            if (state.historyIndex < state.history.length - 1) {
              state.historyIndex++;
              const nextData = state.history[state.historyIndex];
              state.data = nextData;
              state.normalizedData = normalizeTreeData(nextData.rootNode);
            }
          });
        },
        
        canUndo: () => {
          const { historyIndex } = get();
          return historyIndex > 0;
        },
        
        canRedo: () => {
          const { historyIndex, history } = get();
          return historyIndex < history.length - 1;
        },
      }))
    ),
    {
      name: 'mindmap-store',
      enabled: process.env.NODE_ENV === 'development'
    }
  )
);

// Selectors for better performance
export const selectData = (state: MindMapStore) => state.data;
export const selectNormalizedData = (state: MindMapStore) => state.normalizedData;
export const selectSelectedNodeId = (state: MindMapStore) => state.selectedNodeId;
export const selectEditingNodeId = (state: MindMapStore) => state.editingNodeId;
export const selectEditText = (state: MindMapStore) => state.editText;
export const selectCanUndo = (state: MindMapStore) => state.canUndo();
export const selectCanRedo = (state: MindMapStore) => state.canRedo();