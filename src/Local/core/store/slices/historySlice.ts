import type { StateCreator } from 'zustand';
import { normalizeTreeData } from '../../data';
import type { MindMapStore, HistoryState } from './types';

export interface HistorySlice extends HistoryState {
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const createHistorySlice: StateCreator<
  MindMapStore,
  [["zustand/immer", never]],
  [],
  HistorySlice
> = (set, get) => ({
  // Initial state
  history: [],
  historyIndex: -1,

  // History operations
  undo: () => {
    const state = get();
    if (state.canUndo()) {
      const newIndex = state.historyIndex - 1;
      const previousData = state.history[newIndex];
      
      set((draft) => {
        draft.historyIndex = newIndex;
        draft.data = previousData;
        draft.normalizedData = normalizeTreeData(previousData.rootNode);
        
        // Clear editing state when undoing
        draft.editingNodeId = null;
        draft.editText = '';
      });
    }
  },

  redo: () => {
    const state = get();
    if (state.canRedo()) {
      const newIndex = state.historyIndex + 1;
      const nextData = state.history[newIndex];
      
      set((draft) => {
        draft.historyIndex = newIndex;
        draft.data = nextData;
        draft.normalizedData = normalizeTreeData(nextData.rootNode);
        
        // Clear editing state when redoing
        draft.editingNodeId = null;
        draft.editText = '';
      });
    }
  },

  canUndo: () => {
    const { historyIndex } = get();
    return historyIndex > 0;
  },

  canRedo: () => {
    const { history, historyIndex } = get();
    return historyIndex < history.length - 1;
  },
});