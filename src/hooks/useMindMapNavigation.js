// ナビゲーション機能専用のカスタムフック
export const useMindMapNavigation = (findNode, findParentNode, flattenNodes, selectedNodeId, setSelectedNodeId, data) => {
  // 方向キーによるノード選択
  const navigateToDirection = (direction) => {
    if (!selectedNodeId) return;
    
    const allNodes = flattenNodes(data.rootNode);
    const currentNode = findNode(selectedNodeId);
    if (!currentNode) return;
    
    let targetNode = null;
    let minDistance = Infinity;
    
    allNodes.forEach(node => {
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
    
    // 方向に適切なノードが見つからない場合は、関連ノードを選択
    if (!targetNode) {
      targetNode = getAlternativeNavigationTarget(direction);
    }
    
    if (targetNode) {
      setSelectedNodeId(targetNode.id);
    }
  };

  // 方向ナビゲーションの代替ターゲット
  const getAlternativeNavigationTarget = (direction) => {
    const currentNode = findNode(selectedNodeId);
    if (!currentNode) return null;
    
    switch (direction) {
      case 'up':
        // 上方向: 親ノードを選択
        const parent = findParentNode(selectedNodeId);
        return parent;
      case 'down':
        // 下方向: 最初の子ノードを選択
        return currentNode.children && currentNode.children.length > 0 
          ? currentNode.children[0] : null;
      case 'left':
        // 左方向: 前の兄弟ノードを選択
        const leftParent = findParentNode(selectedNodeId);
        if (leftParent && leftParent.children) {
          const currentIndex = leftParent.children.findIndex(child => child.id === selectedNodeId);
          return currentIndex > 0 ? leftParent.children[currentIndex - 1] : null;
        }
        return null;
      case 'right':
        // 右方向: 次の兄弟ノードを選択
        const rightParent = findParentNode(selectedNodeId);
        if (rightParent && rightParent.children) {
          const currentIndex = rightParent.children.findIndex(child => child.id === selectedNodeId);
          return currentIndex < rightParent.children.length - 1 
            ? rightParent.children[currentIndex + 1] : null;
        }
        return null;
      default:
        return null;
    }
  };

  return {
    navigateToDirection
  };
};