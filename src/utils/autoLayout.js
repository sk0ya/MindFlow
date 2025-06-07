// 自動レイアウト機能のユーティリティ

/**
 * 放射状レイアウト - ルートノードを中心に子ノードを円形に配置
 */
export const radialLayout = (rootNode, options = {}) => {
  const {
    centerX = 400,
    centerY = 300,
    baseRadius = 150,
    radiusIncrement = 120,
    angleOffset = 0
  } = options;

  const updateNodePositions = (node, depth = 0, parentAngle = 0, angleSpan = 2 * Math.PI) => {
    if (depth === 0) {
      // ルートノードは中心に配置
      node.x = centerX;
      node.y = centerY;
    }

    if (node.children && node.children.length > 0) {
      const radius = baseRadius + (depth * radiusIncrement);
      const angleStep = angleSpan / node.children.length;
      const startAngle = parentAngle - angleSpan / 2 + angleStep / 2;

      node.children.forEach((child, index) => {
        const angle = startAngle + (index * angleStep) + angleOffset;
        child.x = node.x + Math.cos(angle) * radius;
        child.y = node.y + Math.sin(angle) * radius;

        // 子ノードが存在する場合は再帰的に処理
        if (child.children && child.children.length > 0) {
          const childAngleSpan = angleStep * 0.8; // 子の角度範囲を少し狭める
          updateNodePositions(child, depth + 1, angle, childAngleSpan);
        }
      });
    }
  };

  const newRootNode = JSON.parse(JSON.stringify(rootNode)); // ディープコピー
  updateNodePositions(newRootNode);
  return newRootNode;
};

/**
 * 階層レイアウト - ツリー構造に基づいて左右に配置
 */
export const hierarchicalLayout = (rootNode, options = {}) => {
  const {
    centerX = 400,
    centerY = 300,
    levelSpacing = 200,
    nodeSpacing = 80,
    direction = 'horizontal' // 'horizontal' or 'vertical'
  } = options;

  const calculateSubtreeSize = (node) => {
    if (!node.children || node.children.length === 0) {
      return 1;
    }
    return node.children.reduce((sum, child) => sum + calculateSubtreeSize(child), 0);
  };

  const updateNodePositions = (node, depth = 0, offset = 0, totalSiblings = 1) => {
    if (depth === 0) {
      node.x = centerX;
      node.y = centerY;
    } else {
      if (direction === 'horizontal') {
        node.x = centerX + (depth * levelSpacing * (depth % 2 === 1 ? 1 : -1));
        node.y = centerY + (offset - totalSiblings / 2) * nodeSpacing;
      } else {
        node.x = centerX + (offset - totalSiblings / 2) * nodeSpacing;
        node.y = centerY + (depth * levelSpacing);
      }
    }

    if (node.children && node.children.length > 0) {
      let currentOffset = 0;
      const totalChildren = node.children.reduce((sum, child) => sum + calculateSubtreeSize(child), 0);

      node.children.forEach(child => {
        const childSubtreeSize = calculateSubtreeSize(child);
        const childOffset = currentOffset + childSubtreeSize / 2;
        updateNodePositions(child, depth + 1, childOffset, totalChildren);
        currentOffset += childSubtreeSize;
      });
    }
  };

  const newRootNode = JSON.parse(JSON.stringify(rootNode));
  updateNodePositions(newRootNode);
  return newRootNode;
};

/**
 * マインドマップレイアウト - MindMeisterスタイルの左右分散配置
 */
export const improvedMindMapLayout = (rootNode, options = {}) => {
  const {
    centerX = 400,
    centerY = 300,
    baseRadius = 180,
    levelSpacing = 200,
    minVerticalSpacing = 60,
    maxVerticalSpacing = 120,
    preserveRootPosition = false
  } = options;

  const calculateSubtreeHeight = (node) => {
    if (!node.children || node.children.length === 0) {
      return 1;
    }
    
    let totalHeight = 0;
    node.children.forEach(child => {
      totalHeight += calculateSubtreeHeight(child);
    });
    
    return totalHeight;
  };

  const calculateNodeBounds = (text) => {
    const width = Math.max(120, text.length * 8);
    const height = 40;
    return { width, height };
  };

  const updateNodePositions = (node, depth = 0, side = 'center', yOffset = 0, availableHeight = 0) => {
    if (depth === 0) {
      if (!preserveRootPosition) {
        node.x = centerX;
        node.y = centerY;
      }

      if (node.children && node.children.length > 0) {
        const leftChildren = [];
        const rightChildren = [];

        // 子ノードを左右に振り分け（偶数インデックスは右、奇数は左）
        node.children.forEach((child, index) => {
          if (index % 2 === 0) {
            rightChildren.push(child);
          } else {
            leftChildren.push(child);
          }
        });

        // 右側の子ノード配置
        if (rightChildren.length > 0) {
          const rightTotalHeight = rightChildren.reduce((sum, child) => 
            sum + calculateSubtreeHeight(child), 0);
          
          let currentOffset = 0;
          rightChildren.forEach(child => {
            const childHeight = calculateSubtreeHeight(child);
            const childYOffset = (currentOffset + childHeight / 2 - rightTotalHeight / 2) * minVerticalSpacing;
            updateNodePositions(child, 1, 'right', childYOffset, childHeight);
            currentOffset += childHeight;
          });
        }

        // 左側の子ノード配置
        if (leftChildren.length > 0) {
          const leftTotalHeight = leftChildren.reduce((sum, child) => 
            sum + calculateSubtreeHeight(child), 0);
          
          let currentOffset = 0;
          leftChildren.forEach(child => {
            const childHeight = calculateSubtreeHeight(child);
            const childYOffset = (currentOffset + childHeight / 2 - leftTotalHeight / 2) * minVerticalSpacing;
            updateNodePositions(child, 1, 'left', childYOffset, childHeight);
            currentOffset += childHeight;
          });
        }
      }
    } else {
      // 第1レベル以降の配置
      const sideMultiplier = side === 'right' ? 1 : -1;
      const xDistance = baseRadius + ((depth - 1) * levelSpacing);
      
      node.x = centerX + (xDistance * sideMultiplier);
      node.y = centerY + yOffset;

      // 子ノードがある場合の再帰処理
      if (node.children && node.children.length > 0) {
        const totalChildHeight = node.children.reduce((sum, child) => 
          sum + calculateSubtreeHeight(child), 0);
        
        const spacing = Math.min(
          maxVerticalSpacing, 
          Math.max(minVerticalSpacing, 300 / Math.max(totalChildHeight, 1))
        );
        
        let currentOffset = 0;
        node.children.forEach(child => {
          const childHeight = calculateSubtreeHeight(child);
          const childYOffset = yOffset + (currentOffset + childHeight / 2 - totalChildHeight / 2) * spacing;
          updateNodePositions(child, depth + 1, side, childYOffset, childHeight);
          currentOffset += childHeight;
        });
      }
    }
  };

  // 衝突検出と調整
  const adjustForCollisions = (rootNode) => {
    const allNodes = [];
    
    const collectNodes = (node) => {
      allNodes.push(node);
      if (node.children) {
        node.children.forEach(collectNodes);
      }
    };
    
    collectNodes(rootNode);
    
    // 同じ深度のノード同士の衝突をチェック
    const nodesByDepth = {};
    const calculateDepth = (node, depth = 0, parent = null) => {
      node._depth = depth;
      node._parent = parent;
      if (!nodesByDepth[depth]) nodesByDepth[depth] = [];
      nodesByDepth[depth].push(node);
      
      if (node.children) {
        node.children.forEach(child => calculateDepth(child, depth + 1, node));
      }
    };
    
    calculateDepth(rootNode);
    
    // 各深度で衝突調整
    Object.values(nodesByDepth).forEach(nodesAtDepth => {
      if (nodesAtDepth.length <= 1) return;
      
      // Y座標でソート
      nodesAtDepth.sort((a, b) => a.y - b.y);
      
      // 最小間隔を確保
      for (let i = 1; i < nodesAtDepth.length; i++) {
        const prevNode = nodesAtDepth[i - 1];
        const currentNode = nodesAtDepth[i];
        const bounds1 = calculateNodeBounds(prevNode.text);
        const bounds2 = calculateNodeBounds(currentNode.text);
        
        const minDistance = (bounds1.height + bounds2.height) / 2 + 20;
        const currentDistance = currentNode.y - prevNode.y;
        
        if (currentDistance < minDistance) {
          const adjustment = minDistance - currentDistance;
          currentNode.y += adjustment;
          
          // 子ノードも一緒に移動
          const moveSubtree = (node, deltaY) => {
            node.y += deltaY;
            if (node.children) {
              node.children.forEach(child => moveSubtree(child, deltaY));
            }
          };
          
          if (currentNode.children) {
            currentNode.children.forEach(child => moveSubtree(child, adjustment));
          }
        }
      }
    });
    
    // 一時的なプロパティを削除
    allNodes.forEach(node => {
      delete node._depth;
      delete node._parent;
    });
  };

  const newRootNode = JSON.parse(JSON.stringify(rootNode));
  updateNodePositions(newRootNode);
  adjustForCollisions(newRootNode);
  
  return newRootNode;
};

export const mindMapLayout = improvedMindMapLayout;

export const mindMapLayoutPreserveRoot = (rootNode, options = {}) => {
  return improvedMindMapLayout(rootNode, { ...options, preserveRootPosition: true });
};

/**
 * 有機的レイアウト - 自然な形状での配置
 */
export const organicLayout = (rootNode, options = {}) => {
  const {
    centerX = 400,
    centerY = 300,
    baseRadius = 120,
    radiusVariation = 40,
    angleVariation = 30,
    repulsionForce = 1000,
    iterations = 50
  } = options;

  // 初期配置：放射状に配置
  let layoutNode = radialLayout(rootNode, { centerX, centerY, baseRadius: baseRadius + Math.random() * radiusVariation });

  // 全ノードを平坦化
  const flattenNodes = (node, nodes = []) => {
    nodes.push(node);
    if (node.children) {
      node.children.forEach(child => flattenNodes(child, nodes));
    }
    return nodes;
  };

  const allNodes = flattenNodes(layoutNode);

  // 力学系シミュレーションで自然な配置に調整
  for (let iter = 0; iter < iterations; iter++) {
    allNodes.forEach(node => {
      if (node.id === 'root') return; // ルートは固定

      let forceX = 0;
      let forceY = 0;

      // 他のノードからの反発力
      allNodes.forEach(otherNode => {
        if (node.id === otherNode.id) return;

        const dx = node.x - otherNode.x;
        const dy = node.y - otherNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0 && distance < 200) {
          const force = repulsionForce / (distance * distance);
          forceX += (dx / distance) * force;
          forceY += (dy / distance) * force;
        }
      });

      // 少しランダムな力を加えて自然さを演出
      forceX += (Math.random() - 0.5) * 10;
      forceY += (Math.random() - 0.5) * 10;

      // 力を適用（減衰させる）
      const damping = 0.1;
      node.x += forceX * damping;
      node.y += forceY * damping;
    });
  }

  return layoutNode;
};

/**
 * グリッドレイアウト - 規則正しい格子状配置
 */
export const gridLayout = (rootNode, options = {}) => {
  const {
    centerX = 400,
    centerY = 300,
    gridSpacing = 120,
    columns = 5
  } = options;

  const flattenNodes = (node, nodes = []) => {
    nodes.push(node);
    if (node.children) {
      node.children.forEach(child => flattenNodes(child, nodes));
    }
    return nodes;
  };

  const newRootNode = JSON.parse(JSON.stringify(rootNode));
  const allNodes = flattenNodes(newRootNode);

  // ルートノードは中心に配置
  allNodes[0].x = centerX;
  allNodes[0].y = centerY;

  // 他のノードをグリッド状に配置
  allNodes.slice(1).forEach((node, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    
    const startX = centerX - (columns - 1) * gridSpacing / 2;
    const startY = centerY + gridSpacing; // ルートノードより下から開始
    
    node.x = startX + col * gridSpacing;
    node.y = startY + row * gridSpacing;
  });

  return newRootNode;
};

/**
 * 円形レイアウト - 全ノードを円形に配置
 */
export const circularLayout = (rootNode, options = {}) => {
  const {
    centerX = 400,
    centerY = 300,
    radius = 200
  } = options;

  const flattenNodes = (node, nodes = []) => {
    nodes.push(node);
    if (node.children) {
      node.children.forEach(child => flattenNodes(child, nodes));
    }
    return nodes;
  };

  const newRootNode = JSON.parse(JSON.stringify(rootNode));
  const allNodes = flattenNodes(newRootNode);

  // ルートノードは中心に配置
  allNodes[0].x = centerX;
  allNodes[0].y = centerY;

  // 他のノードを円周上に配置
  if (allNodes.length > 1) {
    const angleStep = (2 * Math.PI) / (allNodes.length - 1);
    
    allNodes.slice(1).forEach((node, index) => {
      const angle = index * angleStep;
      node.x = centerX + Math.cos(angle) * radius;
      node.y = centerY + Math.sin(angle) * radius;
    });
  }

  return newRootNode;
};

/**
 * 自動レイアウト選択 - ノード数に基づいて最適なレイアウトを選択
 */
export const autoSelectLayout = (rootNode, options = {}) => {
  const flattenNodes = (node, nodes = []) => {
    nodes.push(node);
    if (node.children) {
      node.children.forEach(child => flattenNodes(child, nodes));
    }
    return nodes;
  };

  const allNodes = flattenNodes(rootNode);
  const nodeCount = allNodes.length;

  if (nodeCount <= 5) {
    return radialLayout(rootNode, options);
  } else if (nodeCount <= 15) {
    return improvedMindMapLayout(rootNode, options);
  } else if (nodeCount <= 30) {
    return hierarchicalLayout(rootNode, options);
  } else {
    return organicLayout(rootNode, options);
  }
};

/**
 * レイアウトプリセット
 */
export const layoutPresets = {
  radial: {
    name: '放射状',
    description: 'ルートを中心とした円形配置',
    icon: '🎯',
    func: radialLayout
  },
  mindmap: {
    name: 'マインドマップ',
    description: '改良されたMindMeisterスタイルの左右分散',
    icon: '🧠',
    func: improvedMindMapLayout
  },
  mindmapPreserve: {
    name: 'マインドマップ(位置保持)',
    description: 'ルート位置を保持する左右分散レイアウト',
    icon: '📍',
    func: mindMapLayoutPreserveRoot
  },
  hierarchical: {
    name: '階層',
    description: 'ツリー構造での整列',
    icon: '🌳',
    func: hierarchicalLayout
  },
  organic: {
    name: '有機的',
    description: '自然な形状での配置',
    icon: '🌿',
    func: organicLayout
  },
  grid: {
    name: 'グリッド',
    description: '規則正しい格子状配置',
    icon: '📐',
    func: gridLayout
  },
  circular: {
    name: '円形',
    description: '全ノードを円周上に配置',
    icon: '⭕',
    func: circularLayout
  },
  auto: {
    name: '自動選択',
    description: 'ノード数に応じて最適化',
    icon: '🤖',
    func: autoSelectLayout
  }
};
