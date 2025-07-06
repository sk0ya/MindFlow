import { useState, useCallback } from 'react';
import type { MindMapNode, MindMapData } from '../../shared/types';

interface NavigationHookParams {
  selectedNodeId: string | null;
  data: MindMapData | null;
  findNode: (nodeId: string) => MindMapNode | null;
  flattenNodes: (rootNode: MindMapNode) => MindMapNode[];
  findParentNode: (nodeId: string) => MindMapNode | null;
  setSelectedNodeId: (nodeId: string | null) => void;
}

export const useMindMapNavigation = ({
  selectedNodeId,
  data,
  findNode,
  flattenNodes,
  findParentNode,
  setSelectedNodeId
}: NavigationHookParams) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const navigateToDirection = useCallback((direction: string) => {
    if (!selectedNodeId || !data?.rootNode) {
      return;
    }
    
    const allNodes = flattenNodes(data.rootNode);
    const currentNode = findNode(selectedNodeId);
    if (!currentNode) {
      return;
    }
    
    let targetNode = null;
    let minDistance = Infinity;
    
    // 座標ベースで方向にあるノードを探す
    allNodes.forEach((node) => {
      if (node.id === selectedNodeId) return;
      
      const dx = node.x - currentNode.x;
      const dy = node.y - currentNode.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      let isInDirection = false;
      
      switch (direction) {
        case 'up':
          isInDirection = dy < -20 && Math.abs(dx) < Math.abs(dy);
          break;
        case 'down':
          isInDirection = dy > 20 && Math.abs(dx) < Math.abs(dy);
          break;
        case 'left':
          isInDirection = dx < -20 && Math.abs(dy) < Math.abs(dx);
          break;
        case 'right':
          isInDirection = dx > 20 && Math.abs(dy) < Math.abs(dx);
          break;
      }
      
      if (isInDirection && distance < minDistance) {
        minDistance = distance;
        targetNode = node;
      }
    });
    
    // 方向にノードが見つからない場合は階層関係で代替
    if (!targetNode) {
      switch (direction) {
        case 'up':
          // 上方向: 親ノードを選択
          targetNode = findParentNode(selectedNodeId);
          break;
        case 'down':
          // 下方向: 最初の子ノードを選択
          targetNode = currentNode.children && currentNode.children.length > 0 
            ? currentNode.children[0] : null;
          break;
        case 'left':
          // 左方向: 前の兄弟ノードを選択
          const leftParent = findParentNode(selectedNodeId);
          if (leftParent && leftParent.children) {
            const currentIndex = leftParent.children.findIndex((child) => child.id === selectedNodeId);
            targetNode = currentIndex > 0 ? leftParent.children[currentIndex - 1] : null;
          }
          break;
        case 'right':
          // 右方向: 次の兄弟ノードを選択
          const rightParent = findParentNode(selectedNodeId);
          if (rightParent && rightParent.children) {
            const currentIndex = rightParent.children.findIndex((child) => child.id === selectedNodeId);
            targetNode = currentIndex < rightParent.children.length - 1 
              ? rightParent.children[currentIndex + 1] : null;
          }
          break;
      }
    }
    
    if (targetNode) {
      setSelectedNodeId(targetNode.id);
    }
  }, [selectedNodeId, data, flattenNodes, findNode, findParentNode, setSelectedNodeId]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  return {
    zoom,
    setZoom,
    pan,
    setPan,
    navigateToDirection,
    resetView
  };
};