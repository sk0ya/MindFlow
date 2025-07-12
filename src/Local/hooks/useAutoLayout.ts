import { useCallback } from 'react';
import { MindMapNode } from '../shared/types';
import { autoSelectLayout } from '../shared/utils/autoLayout';

export const useAutoLayout = () => {
  const applyLayoutToTree = useCallback((node: MindMapNode): MindMapNode => {
    return autoSelectLayout(node);
  }, []);

  return {
    applyLayoutToTree
  };
};
