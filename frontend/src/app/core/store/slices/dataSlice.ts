import type { StateCreator } from 'zustand';
import type { MindMapData } from '@shared/types';
import { logger } from '../../../shared/utils/logger';
import { normalizeTreeData, denormalizeTreeData } from '../../data';
import { autoSelectLayout } from '../../../shared';
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
  editingMode: null,

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
      logger.warn('⚠️ Auto layout: No root node found');
      return;
    }
    
    // Validate autoSelectLayout function exists
    if (typeof autoSelectLayout !== 'function') {
      logger.error('❌ Auto layout: autoSelectLayout function not found');
      return;
    }
    
    try {
      logger.debug('🎯 Applying auto layout to root node:', {
        nodeId: state.data.rootNode.id,
        hasChildren: state.data.rootNode.children && state.data.rootNode.children.length > 0,
        childrenCount: state.data.rootNode.children?.length || 0
      });
      
      const layoutedRootNode = autoSelectLayout(state.data.rootNode, {
        globalFontSize: state.settings.fontSize
      });
      
      if (!layoutedRootNode) {
        logger.error('❌ Auto layout: layoutedRootNode is null or undefined');
        return;
      }
      
      logger.debug('✅ Auto layout result:', {
        nodeId: layoutedRootNode.id,
        childrenCount: layoutedRootNode.children?.length || 0,
        rootPosition: { x: layoutedRootNode.x, y: layoutedRootNode.y }
      });
      
      set((draft) => {
        if (draft.data) {
          draft.data = {
            ...draft.data,
            rootNode: layoutedRootNode,
            updatedAt: new Date().toISOString()
          };
          
          // Update normalized data
          try {
            draft.normalizedData = normalizeTreeData(layoutedRootNode);
          } catch (normalizeError) {
            logger.error('❌ Auto layout: Failed to normalize data:', normalizeError);
          }
          
          // Add to history
          try {
            draft.history = [...draft.history.slice(0, draft.historyIndex + 1), draft.data];
            draft.historyIndex = draft.history.length - 1;
          } catch (historyError) {
            logger.error('❌ Auto layout: Failed to update history:', historyError);
          }
        }
      });
      logger.debug('🎉 Auto layout applied successfully');
    } catch (error) {
      logger.error('❌ Auto layout failed:', error);
      logger.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      logger.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    }
  },
});