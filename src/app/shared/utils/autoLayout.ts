// 自動レイアウト機能のユーティリティ
import { cloneDeep } from './lodash-utils';
import { COORDINATES, LAYOUT } from '../constants/index';
import type { MindMapNode } from '../types';

// Layout options interfaces
interface LayoutOptions {
  centerX?: number;
  centerY?: number;
  baseRadius?: number;
  radiusIncrement?: number;
  angleOffset?: number;
  levelSpacing?: number;
  nodeSpacing?: number;
  direction?: 'horizontal' | 'vertical';
  minVerticalSpacing?: number;
  maxVerticalSpacing?: number;
  preserveRootPosition?: boolean;
  radiusVariation?: number;
  angleVariation?: number;
  repulsionForce?: number;
  iterations?: number;
  gridSpacing?: number;
  columns?: number;
  radius?: number;
}

interface NodeBounds {
  width: number;
  height: number;
}

interface NodeWithDepth extends MindMapNode {
  _depth?: number;
  _parent?: MindMapNode | null;
}

/**
 * 放射状レイアウト - ルートノードを中心に子ノードを円形に配置
 */
export const radialLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  const {
    centerX = COORDINATES.DEFAULT_CENTER_X,
    centerY = COORDINATES.DEFAULT_CENTER_Y,
    baseRadius = LAYOUT.RADIAL_BASE_RADIUS,
    radiusIncrement = LAYOUT.RADIAL_RADIUS_INCREMENT,
    angleOffset = 0
  } = options;

  const updateNodePositions = (node: MindMapNode, depth = 0, parentAngle = 0, angleSpan = 2 * Math.PI): void => {
    if (depth === 0) {
      // ルートノードは中心に配置
      node.x = centerX;
      node.y = centerY;
    }

    if (!node.collapsed && node.children && node.children.length > 0) {
      const radius = baseRadius + (depth * radiusIncrement);
      const angleStep = angleSpan / node.children.length;
      const startAngle = parentAngle - angleSpan / 2 + angleStep / 2;

      node.children.forEach((child: MindMapNode, index: number) => {
        const angle = startAngle + (index * angleStep) + angleOffset;
        child.x = node.x + Math.cos(angle) * radius;
        child.y = node.y + Math.sin(angle) * radius;

        // 子ノードが存在する場合は再帰的に処理（折りたたまれていない場合のみ）
        if (!child.collapsed && child.children && child.children.length > 0) {
          const childAngleSpan = angleStep * 0.8; // 子の角度範囲を少し狭める
          updateNodePositions(child, depth + 1, angle, childAngleSpan);
        }
      });
    }
  };

  const newRootNode = cloneDeep(rootNode); // ディープコピー
  updateNodePositions(newRootNode);
  return newRootNode;
};

/**
 * 階層レイアウト - ツリー構造に基づいて左右に配置
 */
export const hierarchicalLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  const {
    centerX = COORDINATES.DEFAULT_CENTER_X,
    centerY = COORDINATES.DEFAULT_CENTER_Y,
    levelSpacing = LAYOUT.LEVEL_SPACING,
    nodeSpacing = LAYOUT.VERTICAL_SPACING_MIN,
    direction = 'horizontal' // 'horizontal' or 'vertical'
  } = options;

  const calculateSubtreeSize = (node: MindMapNode): number => {
    if (node.collapsed || !node.children || node.children.length === 0) {
      return 1;
    }
    return node.children.reduce((sum, child) => sum + calculateSubtreeSize(child), 0);
  };

  const updateNodePositions = (node: MindMapNode, depth = 0, offset = 0, totalSiblings = 1): void => {
    if (depth === 0) {
      node.x = centerX;
      node.y = centerY;
    } else {
      if (direction === 'horizontal') {
        // 全ての子ノードを右側に配置（標準的なツリーレイアウト）
        node.x = centerX + (depth * levelSpacing);
        node.y = centerY + (offset - totalSiblings / 2) * nodeSpacing;
      } else {
        node.x = centerX + (offset - totalSiblings / 2) * nodeSpacing;
        node.y = centerY + (depth * levelSpacing);
      }
    }

    if (!node.collapsed && node.children && node.children.length > 0) {
      let currentOffset = 0;
      const totalChildren = node.children.reduce((sum, child) => sum + calculateSubtreeSize(child), 0);

      node.children.forEach((child: MindMapNode) => {
        const childSubtreeSize = calculateSubtreeSize(child);
        const childOffset = currentOffset + childSubtreeSize / 2;
        updateNodePositions(child, depth + 1, childOffset, totalChildren);
        currentOffset += childSubtreeSize;
      });
    }
  };

  const newRootNode = cloneDeep(rootNode);
  updateNodePositions(newRootNode);
  return newRootNode;
};

/**
 * マインドマップレイアウト - MindMeisterスタイルの左右分散配置
 */
export const improvedMindMapLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  const {
    centerX = COORDINATES.DEFAULT_CENTER_X,
    centerY = COORDINATES.DEFAULT_CENTER_Y,
    baseRadius = LAYOUT.RADIAL_BASE_RADIUS + 30, // 少し大きめ
    levelSpacing = LAYOUT.LEVEL_SPACING,
    minVerticalSpacing = LAYOUT.VERTICAL_SPACING_MIN,
    preserveRootPosition = false
  } = options;

  const calculateSubtreeHeight = (node: MindMapNode): number => {
    // 折りたたまれた場合は、そのノード自体の高さのみカウント
    if (node.collapsed || !node.children || node.children.length === 0) {
      return 1;
    }
    
    let totalHeight = 0;
    node.children.forEach((child: MindMapNode) => {
      totalHeight += calculateSubtreeHeight(child);
    });
    
    return totalHeight;
  };

  const calculateNodeBounds = (text: string): NodeBounds => {
    const width = Math.max(120, text.length * 8);
    const height = 40;
    return { width, height };
  };

  const updateNodePositions = (node: MindMapNode, depth = 0, side: 'center' | 'left' | 'right' = 'center', yOffset = 0): void => {
    if (depth === 0) {
      if (!preserveRootPosition) {
        node.x = centerX;
        node.y = centerY;
      }

      if (!node.collapsed && node.children && node.children.length > 0) {
        const leftChildren: MindMapNode[] = [];
        const rightChildren: MindMapNode[] = [];

        // すべての子ノードを右側に配置（標準的なマインドマップレイアウト）
        node.children.forEach((child: MindMapNode) => {
          rightChildren.push(child);
        });

        // 右側の子ノード配置
        if (rightChildren.length > 0) {
          const rightTotalHeight = rightChildren.reduce((sum, child) => 
            sum + calculateSubtreeHeight(child), 0);
          
          let currentOffset = -(rightTotalHeight - 1) * minVerticalSpacing / 2;
          
          rightChildren.forEach((child: MindMapNode) => {
            const childHeight = calculateSubtreeHeight(child);
            const childCenterOffset = currentOffset + (childHeight - 1) * minVerticalSpacing / 2;
            updateNodePositions(child, 1, 'right', childCenterOffset);
            currentOffset += childHeight * minVerticalSpacing;
          });
        }

        // 左側の子ノード配置
        if (leftChildren.length > 0) {
          const leftTotalHeight = leftChildren.reduce((sum, child) => 
            sum + calculateSubtreeHeight(child), 0);
          
          let currentOffset = -(leftTotalHeight - 1) * minVerticalSpacing / 2;
          
          leftChildren.forEach((child: MindMapNode) => {
            const childHeight = calculateSubtreeHeight(child);
            const childCenterOffset = currentOffset + (childHeight - 1) * minVerticalSpacing / 2;
            updateNodePositions(child, 1, 'left', childCenterOffset);
            currentOffset += childHeight * minVerticalSpacing;
          });
        }
      }
    } else {
      // 第1レベル以降の配置
      const sideMultiplier = side === 'right' ? 1 : -1;
      const xDistance = baseRadius + ((depth - 1) * levelSpacing);
      
      node.x = centerX + (xDistance * sideMultiplier);
      node.y = centerY + yOffset;

      // 子ノードがある場合の再帰処理（折りたたまれていない場合のみ）
      if (!node.collapsed && node.children && node.children.length > 0) {
        const totalChildHeight = node.children.reduce((sum, child) => 
          sum + calculateSubtreeHeight(child), 0);
        
        const spacing = minVerticalSpacing;
        
        // 子ノードの配置を親ノードを中心として計算
        let currentOffset = -(totalChildHeight - 1) * spacing / 2;
        
        node.children.forEach((child: MindMapNode) => {
          const childHeight = calculateSubtreeHeight(child);
          const childCenterOffset = currentOffset + (childHeight - 1) * spacing / 2;
          const childYOffset = yOffset + childCenterOffset;
          
          updateNodePositions(child, depth + 1, side, childYOffset);
          currentOffset += childHeight * spacing;
        });
      }
    }
  };

  // 衝突検出と調整
  const adjustForCollisions = (rootNode: MindMapNode): void => {
    const allNodes: NodeWithDepth[] = [];
    
    const collectNodes = (node: MindMapNode): void => {
      allNodes.push(node);
      if (node.children) {
        node.children.forEach((child: MindMapNode) => collectNodes(child));
      }
    };
    
    collectNodes(rootNode);
    
    // 同じ深度のノード同士の衝突をチェック
    const nodesByDepth: { [key: number]: NodeWithDepth[] } = {};
    const calculateDepth = (node: NodeWithDepth, depth = 0, parent: NodeWithDepth | null = null): void => {
      node._depth = depth;
      node._parent = parent;
      if (!nodesByDepth[depth]) nodesByDepth[depth] = [];
      nodesByDepth[depth].push(node);
      
      if (node.children) {
        node.children.forEach((child: MindMapNode) => calculateDepth(child as NodeWithDepth, depth + 1, node));
      }
    };
    
    calculateDepth(rootNode);
    
    // 各深度で衝突調整
    Object.values(nodesByDepth).forEach((nodesAtDepth: NodeWithDepth[]) => {
      if (nodesAtDepth.length <= 1) return;
      
      // Y座標でソート
      nodesAtDepth.sort((a: NodeWithDepth, b: NodeWithDepth) => a.y - b.y);
      
      // 最小間隔を確保
      for (let i = 1; i < nodesAtDepth.length; i++) {
        const prevNode = nodesAtDepth[i - 1];
        const currentNode = nodesAtDepth[i];
        const bounds1 = calculateNodeBounds(prevNode.text);
        const bounds2 = calculateNodeBounds(currentNode.text);
        
        const minDistance = (bounds1.height + bounds2.height) / 2 + 10;
        const currentDistance = currentNode.y - prevNode.y;
        
        if (currentDistance < minDistance) {
          const adjustment = minDistance - currentDistance;
          currentNode.y += adjustment;
          
          // 子ノードも一緒に移動
          const moveSubtree = (node: MindMapNode, deltaY: number): void => {
            node.y += deltaY;
            if (node.children) {
              node.children.forEach((child: MindMapNode) => moveSubtree(child, deltaY));
            }
          };
          
          if (currentNode.children) {
            currentNode.children.forEach((child: MindMapNode) => moveSubtree(child, adjustment));
          }
        }
      }
    });
    
    // 一時的なプロパティを削除
    allNodes.forEach((node: NodeWithDepth) => {
      delete node._depth;
      delete node._parent;
    });
  };

  const newRootNode = cloneDeep(rootNode);
  updateNodePositions(newRootNode);
  adjustForCollisions(newRootNode);
  
  return newRootNode;
};

export const mindMapLayout = improvedMindMapLayout;

export const mindMapLayoutPreserveRoot = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  return improvedMindMapLayout(rootNode, { ...options, preserveRootPosition: true });
};

/**
 * 有機的レイアウト - 自然な形状での配置
 */
export const organicLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  const {
    centerX = 400,
    centerY = 300,
    baseRadius = 120,
    radiusVariation = 40,
    repulsionForce = 1000,
    iterations = 50
  } = options;

  // 初期配置：放射状に配置
  const layoutNode = radialLayout(rootNode, { centerX, centerY, baseRadius: baseRadius + Math.random() * radiusVariation });

  // 全ノードを平坦化
  const flattenNodes = (node: MindMapNode, nodes: MindMapNode[] = []): MindMapNode[] => {
    nodes.push(node);
    if (node.children) {
      node.children.forEach((child: MindMapNode) => flattenNodes(child, nodes));
    }
    return nodes;
  };

  const allNodes = flattenNodes(layoutNode);

  // 力学系シミュレーションで自然な配置に調整
  for (let iter = 0; iter < iterations; iter++) {
    allNodes.forEach((node: MindMapNode) => {
      if (node.id === 'root') return; // ルートは固定

      let forceX = 0;
      let forceY = 0;

      // 他のノードからの反発力
      allNodes.forEach((otherNode: MindMapNode) => {
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
export const gridLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  const {
    centerX = 400,
    centerY = 300,
    gridSpacing = 120,
    columns = 5
  } = options;

  const flattenNodes = (node: MindMapNode, nodes: MindMapNode[] = []): MindMapNode[] => {
    nodes.push(node);
    if (node.children) {
      node.children.forEach((child: MindMapNode) => flattenNodes(child, nodes));
    }
    return nodes;
  };

  const newRootNode = cloneDeep(rootNode);
  const allNodes = flattenNodes(newRootNode);

  // ルートノードは中心に配置
  allNodes[0].x = centerX;
  allNodes[0].y = centerY;

  // 他のノードをグリッド状に配置
  allNodes.slice(1).forEach((node: MindMapNode, index: number) => {
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
export const circularLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  const {
    centerX = 400,
    centerY = 300,
    radius = 200
  } = options;

  const flattenNodes = (node: MindMapNode, nodes: MindMapNode[] = []): MindMapNode[] => {
    nodes.push(node);
    if (node.children) {
      node.children.forEach((child: MindMapNode) => flattenNodes(child, nodes));
    }
    return nodes;
  };

  const newRootNode = cloneDeep(rootNode);
  const allNodes = flattenNodes(newRootNode);

  // ルートノードは中心に配置
  allNodes[0].x = centerX;
  allNodes[0].y = centerY;

  // 他のノードを円周上に配置
  if (allNodes.length > 1) {
    const angleStep = (2 * Math.PI) / (allNodes.length - 1);
    
    allNodes.slice(1).forEach((node: MindMapNode, index: number) => {
      const angle = index * angleStep;
      node.x = centerX + Math.cos(angle) * radius;
      node.y = centerY + Math.sin(angle) * radius;
    });
  }

  return newRootNode;
};

/**
 * シンプルな右側階層レイアウト - 標準的なマインドマップスタイル
 */
export const simpleHierarchicalLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  const {
    centerX = COORDINATES.DEFAULT_CENTER_X,
    centerY = COORDINATES.DEFAULT_CENTER_Y,
    levelSpacing = LAYOUT.LEVEL_SPACING,
    nodeSpacing = LAYOUT.VERTICAL_SPACING_MIN + 10
  } = options;

  const newRootNode = cloneDeep(rootNode);
  
  // ルートノードを配置
  newRootNode.x = centerX;
  newRootNode.y = centerY;

  // サブツリーの高さを計算（ノード数ベース）
  const calculateSubtreeHeight = (node: MindMapNode): number => {
    if (node.collapsed || !node.children || node.children.length === 0) {
      return 1;
    }
    return node.children.reduce((sum, child) => sum + calculateSubtreeHeight(child), 0);
  };

  // 再帰的にノードを配置
  const positionNode = (node: MindMapNode, depth: number, yOffset: number): void => {
    if (depth === 0) return; // ルートは既に配置済み
    
    // X座標: 深度に応じて右側に配置
    node.x = centerX + (depth * levelSpacing);
    node.y = centerY + yOffset;
    
    if (!node.collapsed && node.children && node.children.length > 0) {
      // 子ノード全体の高さを計算
      const totalHeight = node.children.reduce((sum, child) => 
        sum + calculateSubtreeHeight(child), 0
      );
      
      // 子ノードの開始位置を計算（親ノードを中心とする）
      let currentOffset = -(totalHeight - 1) * nodeSpacing / 2;
      
      node.children.forEach((child: MindMapNode) => {
        const childHeight = calculateSubtreeHeight(child);
        const childCenterOffset = currentOffset + (childHeight - 1) * nodeSpacing / 2;
        
        positionNode(child, depth + 1, yOffset + childCenterOffset);
        currentOffset += childHeight * nodeSpacing;
      });
    }
  };

  if (!newRootNode.collapsed && newRootNode.children && newRootNode.children.length > 0) {
    // ルートの子ノード全体の高さを計算
    const totalHeight = newRootNode.children.reduce((sum, child) => 
      sum + calculateSubtreeHeight(child), 0
    );
    
    // 子ノードの開始位置を計算（ルートノードを中心とする）
    let currentOffset = -(totalHeight - 1) * nodeSpacing / 2;
    
    newRootNode.children.forEach((child: MindMapNode) => {
      const childHeight = calculateSubtreeHeight(child);
      const childCenterOffset = currentOffset + (childHeight - 1) * nodeSpacing / 2;
      
      positionNode(child, 1, childCenterOffset);
      currentOffset += childHeight * nodeSpacing;
    });
  }

  return newRootNode;
};

/**
 * 自動レイアウト選択 - 常にシンプルな右側階層レイアウトを使用
 */
export const autoSelectLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  return simpleHierarchicalLayout(rootNode, options);
};

/**
 * レイアウトプリセット
 */
interface LayoutPreset {
  name: string;
  description: string;
  icon: string;
  func: (_rootNode: MindMapNode, _options?: LayoutOptions) => MindMapNode;
}

export const layoutPresets: { [key: string]: LayoutPreset } = {
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
  simple: {
    name: 'シンプル階層',
    description: '右側一方向の標準レイアウト',
    icon: '➡️',
    func: simpleHierarchicalLayout
  },
  auto: {
    name: '自動選択',
    description: 'シンプルな右側階層レイアウト',
    icon: '🤖',
    func: autoSelectLayout
  }
};