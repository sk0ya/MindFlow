import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { 
  type MindMapStore,
  createDataSlice,
  createHistorySlice,
  createUISlice,
  createNodeSlice
} from './slices';

export const useMindMapStore = create<MindMapStore>()(
  devtools(
    subscribeWithSelector(
      immer((...args) => ({
        ...createDataSlice(...args),
        ...createHistorySlice(...args),
        ...createUISlice(...args),
        ...createNodeSlice(...args),
      }))
    )
  )
);

// Export types for convenience
export type { MindMapStore } from './slices';