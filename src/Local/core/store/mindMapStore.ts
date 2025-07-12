import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { MindMapData, MindMapNode, Position, FileAttachment } from '../../../shared/types';
import type { ImageFile } from '../../shared/types';

// UI State types
interface UIState {
  // Basic UI state
  zoom: number;
  pan: Position;
  
  // Panel visibility
  showCustomizationPanel: boolean;
  customizationPosition: Position;
  showContextMenu: boolean;
  contextMenuPosition: Position;
  showShortcutHelper: boolean;
  showMapList: boolean;
  showNodeMapLinksPanel: boolean;
  nodeMapLinksPanelPosition: Position;
  sidebarCollapsed: boolean;
  showLocalStoragePanel: boolean;
  showTutorial: boolean;
  
  // File and image states
  selectedImage: ImageFile | null;
  selectedFile: FileAttachment | null;
  fileMenuPosition: Position;
  showImageModal: boolean;
  showFileActionMenu: boolean;
  
  // Other UI states
  clipboard: MindMapNode | null;
  selectedNodeForLinks: MindMapNode | null;
}
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
import { autoSelectLayout } from '../../shared/utils/autoLayout';

interface MindMapStore {
  // State
  data: MindMapData | null;
  normalizedData: NormalizedData | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  history: MindMapData[];
  historyIndex: number;
  
  // UI State
  ui: UIState;
  
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
  applyAutoLayout: () => void;
  
  // UI Actions
  setZoom: (zoom: number) => void;
  setPan: (pan: Position) => void;
  resetZoom: () => void;
  setShowCustomizationPanel: (show: boolean) => void;
  setCustomizationPosition: (position: Position) => void;
  setShowContextMenu: (show: boolean) => void;
  setContextMenuPosition: (position: Position) => void;
  setShowShortcutHelper: (show: boolean) => void;
  setShowMapList: (show: boolean) => void;
  setShowNodeMapLinksPanel: (show: boolean) => void;
  setNodeMapLinksPanelPosition: (position: Position) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setShowLocalStoragePanel: (show: boolean) => void;
  setShowTutorial: (show: boolean) => void;
  setSelectedImage: (image: ImageFile | null) => void;
  setSelectedFile: (file: FileAttachment | null) => void;
  setFileMenuPosition: (position: Position) => void;
  setShowImageModal: (show: boolean) => void;
  setShowFileActionMenu: (show: boolean) => void;
  setClipboard: (node: MindMapNode | null) => void;
  setSelectedNodeForLinks: (node: MindMapNode | null) => void;
  closeAllPanels: () => void;
  toggleSidebar: () => void;
  showCustomization: (position?: Position) => void;
  showNodeMapLinks: (node: MindMapNode, position: Position) => void;
  closeNodeMapLinksPanel: () => void;
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
        
        // UI State
        ui: {
          zoom: 1,
          pan: { x: 0, y: 0 },
          showCustomizationPanel: false,
          customizationPosition: { x: 0, y: 0 },
          showContextMenu: false,
          contextMenuPosition: { x: 0, y: 0 },
          showShortcutHelper: false,
          showMapList: false,
          showNodeMapLinksPanel: false,
          nodeMapLinksPanelPosition: { x: 0, y: 0 },
          sidebarCollapsed: false,
          showLocalStoragePanel: false,
          showTutorial: false,
          selectedImage: null,
          selectedFile: null,
          fileMenuPosition: { x: 0, y: 0 },
          showImageModal: false,
          showFileActionMenu: false,
          clipboard: null,
          selectedNodeForLinks: null,
        },
        
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
        
        // Sync normalized data back to tree structure and add to history
        syncToMindMapData: () => {
          set((state) => {
            if (state.normalizedData && state.data) {
              const newRootNode = denormalizeTreeData(state.normalizedData);
              const newData = {
                ...state.data,
                rootNode: newRootNode,
                updatedAt: new Date().toISOString()
              };
              state.data = newData;
              
              // Add to history
              state.history = [...state.history.slice(0, state.historyIndex + 1), newData];
              state.historyIndex = state.history.length - 1;
            }
          });
        },
        
        applyAutoLayout: () => {
          const state = get();
          if (!state.data?.rootNode) {
            console.log('No root node found for auto layout');
            return;
          }
          
          try {
            console.log('Applying auto layout to root node:', state.data.rootNode);
            const layoutedRootNode = autoSelectLayout(state.data.rootNode);
            console.log('Auto layout result:', layoutedRootNode);
            
            set((draft) => {
              if (draft.data) {
                draft.data = {
                  ...draft.data,
                  rootNode: layoutedRootNode,
                  updatedAt: new Date().toISOString()
                };
                
                // Update normalized data
                draft.normalizedData = normalizeTreeData(layoutedRootNode);
                
                // Add to history
                draft.history = [...draft.history.slice(0, draft.historyIndex + 1), draft.data];
                draft.historyIndex = draft.history.length - 1;
              }
            });
            console.log('Auto layout applied successfully');
          } catch (error) {
            console.error('Auto layout failed:', error);
          }
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
              const childNodes = childIds.map(id => state.normalizedData?.nodes[id]).filter(Boolean);
              
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
          
          // Apply auto layout if enabled
          const { data } = get();
          if (data?.settings?.autoLayout) {
            get().applyAutoLayout();
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
          if (data?.settings?.autoLayout) {
            get().applyAutoLayout();
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
        
        // UI Actions
        setZoom: (zoom: number) => set((state) => { state.ui.zoom = zoom; }),
        setPan: (pan: Position) => set((state) => { state.ui.pan = pan; }),
        resetZoom: () => set((state) => { 
          state.ui.zoom = 1; 
          state.ui.pan = { x: 0, y: 0 }; 
        }),
        setShowCustomizationPanel: (show: boolean) => set((state) => { state.ui.showCustomizationPanel = show; }),
        setCustomizationPosition: (position: Position) => set((state) => { state.ui.customizationPosition = position; }),
        setShowContextMenu: (show: boolean) => set((state) => { state.ui.showContextMenu = show; }),
        setContextMenuPosition: (position: Position) => set((state) => { state.ui.contextMenuPosition = position; }),
        setShowShortcutHelper: (show: boolean) => set((state) => { state.ui.showShortcutHelper = show; }),
        setShowMapList: (show: boolean) => set((state) => { state.ui.showMapList = show; }),
        setShowNodeMapLinksPanel: (show: boolean) => set((state) => { state.ui.showNodeMapLinksPanel = show; }),
        setNodeMapLinksPanelPosition: (position: Position) => set((state) => { state.ui.nodeMapLinksPanelPosition = position; }),
        setSidebarCollapsed: (collapsed: boolean) => set((state) => { state.ui.sidebarCollapsed = collapsed; }),
        setShowLocalStoragePanel: (show: boolean) => set((state) => { state.ui.showLocalStoragePanel = show; }),
        setShowTutorial: (show: boolean) => set((state) => { state.ui.showTutorial = show; }),
        setSelectedImage: (image: ImageFile | null) => set((state) => { state.ui.selectedImage = image; }),
        setSelectedFile: (file: FileAttachment | null) => set((state) => { state.ui.selectedFile = file; }),
        setFileMenuPosition: (position: Position) => set((state) => { state.ui.fileMenuPosition = position; }),
        setShowImageModal: (show: boolean) => set((state) => { state.ui.showImageModal = show; }),
        setShowFileActionMenu: (show: boolean) => set((state) => { state.ui.showFileActionMenu = show; }),
        setClipboard: (node: MindMapNode | null) => set((state) => { state.ui.clipboard = node; }),
        setSelectedNodeForLinks: (node: MindMapNode | null) => set((state) => { state.ui.selectedNodeForLinks = node; }),
        
        closeAllPanels: () => set((state) => {
          state.ui.showCustomizationPanel = false;
          state.ui.showContextMenu = false;
          state.ui.showNodeMapLinksPanel = false;
          state.ui.showImageModal = false;
          state.ui.showFileActionMenu = false;
        }),
        
        toggleSidebar: () => set((state) => {
          state.ui.sidebarCollapsed = !state.ui.sidebarCollapsed;
        }),
        
        showCustomization: (position?: Position) => set((state) => {
          state.ui.customizationPosition = position || { x: 300, y: 200 };
          state.ui.showCustomizationPanel = true;
          state.ui.showContextMenu = false;
        }),
        
        showNodeMapLinks: (node: MindMapNode, position: Position) => set((state) => {
          state.ui.selectedNodeForLinks = node;
          state.ui.nodeMapLinksPanelPosition = position;
          state.ui.showNodeMapLinksPanel = true;
          // Close other panels first
          state.ui.showCustomizationPanel = false;
          state.ui.showContextMenu = false;
        }),
        
        closeNodeMapLinksPanel: () => set((state) => {
          state.ui.showNodeMapLinksPanel = false;
          state.ui.selectedNodeForLinks = null;
        }),
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

// UI Selectors
export const selectUI = (state: MindMapStore) => state.ui;
export const selectZoom = (state: MindMapStore) => state.ui.zoom;
export const selectPan = (state: MindMapStore) => state.ui.pan;
export const selectShowCustomizationPanel = (state: MindMapStore) => state.ui.showCustomizationPanel;
export const selectCustomizationPosition = (state: MindMapStore) => state.ui.customizationPosition;
export const selectShowContextMenu = (state: MindMapStore) => state.ui.showContextMenu;
export const selectContextMenuPosition = (state: MindMapStore) => state.ui.contextMenuPosition;
export const selectShowShortcutHelper = (state: MindMapStore) => state.ui.showShortcutHelper;
export const selectShowMapList = (state: MindMapStore) => state.ui.showMapList;
export const selectShowNodeMapLinksPanel = (state: MindMapStore) => state.ui.showNodeMapLinksPanel;
export const selectNodeMapLinksPanelPosition = (state: MindMapStore) => state.ui.nodeMapLinksPanelPosition;
export const selectSidebarCollapsed = (state: MindMapStore) => state.ui.sidebarCollapsed;
export const selectShowLocalStoragePanel = (state: MindMapStore) => state.ui.showLocalStoragePanel;
export const selectShowTutorial = (state: MindMapStore) => state.ui.showTutorial;
export const selectSelectedImage = (state: MindMapStore) => state.ui.selectedImage;
export const selectSelectedFile = (state: MindMapStore) => state.ui.selectedFile;
export const selectFileMenuPosition = (state: MindMapStore) => state.ui.fileMenuPosition;
export const selectShowImageModal = (state: MindMapStore) => state.ui.showImageModal;
export const selectShowFileActionMenu = (state: MindMapStore) => state.ui.showFileActionMenu;
export const selectClipboard = (state: MindMapStore) => state.ui.clipboard;
export const selectSelectedNodeForLinks = (state: MindMapStore) => state.ui.selectedNodeForLinks;