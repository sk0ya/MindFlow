import type { StateCreator } from 'zustand';
import type { MindMapData } from '@shared/types';
import { normalizeTreeData, denormalizeTreeData } from '../../data';
import { autoSelectLayout } from '@local/shared';
import type { MindMapStore, DataState } from './types';

export interface DataSlice extends DataState {
  setData: (data: MindMapData) => void;
  updateNormalizedData: () => void;
  syncToMindMapData: () => void;
  applyAutoLayout: () => void;
}

export const createDataSlice: StateCreator<
  MindMapStore,
  [["zustand/immer", never]],
  [],
  DataSlice
> = (set, get) => ({
  // Initial state
  data: null,
  normalizedData: null,
  selectedNodeId: null,
  editingNodeId: null,
  editText: '',

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
});