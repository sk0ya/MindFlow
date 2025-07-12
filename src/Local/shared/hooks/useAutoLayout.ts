import { useCallback } from 'react';
import { MindMapNode } from '../types';
import { autoSelectLayout } from '../utils/autoLayout';

export const useAutoLayout = () => {
  const applyLayoutToTree = useCallback((node: MindMapNode): MindMapNode => {
    return autoSelectLayout(node);
  }, []);

  return {
    applyLayoutToTree
  };
};
