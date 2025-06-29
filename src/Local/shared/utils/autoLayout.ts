// 自動レイアウト機能のユーティリティ
import { cloneDeep } from 'lodash-es';
import { COORDINATES, LAYOUT } from '../constants/index.js';
import type { MindMapNode } from '../types/dataTypes';

// ========================================
// Type Definitions for Layout System
// ========================================

/**
 * Position coordinates for a node
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Node bounds for collision detection
 */
export interface NodeBounds {
  width: number;
  height: number;
}

/**
 * Layout side enumeration
 */
export type LayoutSide = 'center' | 'left' | 'right';

/**
 * Layout direction enumeration
 */
export type LayoutDirection = 'horizontal' | 'vertical';

/**
 * Base layout options common to all algorithms
 */
export interface BaseLayoutOptions {
  centerX?: number;
  centerY?: number;
  preserveRootPosition?: boolean;
}

/**
 * Options for radial layout algorithm
 */
export interface RadialLayoutOptions extends BaseLayoutOptions {
  baseRadius?: number;
  radiusIncrement?: number;
  angleOffset?: number;
}

/**
 * Options for hierarchical layout algorithm
 */
export interface HierarchicalLayoutOptions extends BaseLayoutOptions {
  levelSpacing?: number;
  nodeSpacing?: number;
  direction?: LayoutDirection;
}

/**
 * Options for mindmap layout algorithm
 */
export interface MindMapLayoutOptions extends BaseLayoutOptions {
  baseRadius?: number;
  levelSpacing?: number;
  minVerticalSpacing?: number;
  maxVerticalSpacing?: number;
}

/**
 * Options for organic layout algorithm
 */
export interface OrganicLayoutOptions extends BaseLayoutOptions {
  baseRadius?: number;
  radiusVariation?: number;
  angleVariation?: number;
  repulsionForce?: number;
  iterations?: number;
}

/**
 * Options for grid layout algorithm
 */
export interface GridLayoutOptions extends BaseLayoutOptions {
  gridSpacing?: number;
  columns?: number;
}

/**
 * Options for circular layout algorithm
 */
export interface CircularLayoutOptions extends BaseLayoutOptions {
  radius?: number;
}

/**
 * Enhanced node with temporary layout properties
 */
export interface LayoutNode extends MindMapNode {
  _depth?: number;
  _parent?: LayoutNode | null;
}

/**
 * Layout function type definition
 */
export type LayoutFunction<T extends BaseLayoutOptions = BaseLayoutOptions> = (
  rootNode: MindMapNode,
  options?: T
) => MindMapNode;

/**
 * Layout preset definition
 */
export interface LayoutPreset {
  name: string;
  description: string;
  icon: string;
  func: LayoutFunction;
}

/**
 * Force vector for physics-based layouts
 */
export interface ForceVector {
  x: number;
  y: number;
}

/**
 * Tree structure analysis result
 */
export interface TreeMetrics {
  totalNodes: number;
  maxDepth: number;
  subtreeHeight: number;
  subtreeSize: number;
}

/**
 * 放射状レイアウト - ルートノードを中心に子ノードを円形に配置
 */
export const radialLayout: LayoutFunction<RadialLayoutOptions> = (rootNode: MindMapNode, options: RadialLayoutOptions = {}) => {
  const {
    centerX = COORDINATES.DEFAULT_CENTER_X,
    centerY = COORDINATES.DEFAULT_CENTER_Y,
    baseRadius = LAYOUT.RADIAL_BASE_RADIUS,
    radiusIncrement = LAYOUT.RADIAL_RADIUS_INCREMENT,
    angleOffset = 0
  } = options;

  const updateNodePositions = (node: MindMapNode, depth: number = 0, parentAngle: number = 0, angleSpan: number = 2 * Math.PI): void => {
    if (depth === 0) {
      // ルートノードは中心に配置
      node.x = centerX;
      node.y = centerY;
    }

    if (node.children && node.children.length > 0) {
      const radius = baseRadius + (depth * radiusIncrement);
      const angleStep = angleSpan / node.children.length;
      const startAngle = parentAngle - angleSpan / 2 + angleStep / 2;

      node.children.forEach((child: MindMapNode, index: number) => {
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

  const newRootNode = cloneDeep(rootNode); // ディープコピー
  updateNodePositions(newRootNode);
  return newRootNode;
};

/**
 * 階層レイアウト - ツリー構造に基づいて左右に配置
 */
export const hierarchicalLayout: LayoutFunction<HierarchicalLayoutOptions> = (rootNode: MindMapNode, options: HierarchicalLayoutOptions = {}) => {
  const {
    centerX = COORDINATES.DEFAULT_CENTER_X,
    centerY = COORDINATES.DEFAULT_CENTER_Y,
    levelSpacing = LAYOUT.LEVEL_SPACING,
    nodeSpacing = LAYOUT.VERTICAL_SPACING_MIN,
    direction = 'horizontal' // 'horizontal' or 'vertical'
  } = options;

  const calculateSubtreeSize = (node: MindMapNode): number => {
    if (!node.children || node.children.length === 0) {
      return 1;
    }
    return node.children.reduce((sum: number, child: MindMapNode) => sum + calculateSubtreeSize(child), 0);
  };

  const updateNodePositions = (node: MindMapNode, depth: number = 0, offset: number = 0, totalSiblings: number = 1): void => {
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
      const totalChildren = node.children.reduce((sum: number, child: MindMapNode) => sum + calculateSubtreeSize(child), 0);

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
export const improvedMindMapLayout: LayoutFunction<MindMapLayoutOptions> = (rootNode: MindMapNode, options: MindMapLayoutOptions = {}) => {
  const {
    centerX = COORDINATES.DEFAULT_CENTER_X,
    centerY = COORDINATES.DEFAULT_CENTER_Y,
    baseRadius = LAYOUT.RADIAL_BASE_RADIUS + 30, // 少し大きめ
    levelSpacing = LAYOUT.LEVEL_SPACING,
    minVerticalSpacing = LAYOUT.VERTICAL_SPACING_MIN - 20,
    maxVerticalSpacing: _maxVerticalSpacing = LAYOUT.VERTICAL_SPACING_MIN + 40,
    preserveRootPosition = false
  } = options;

  const calculateSubtreeHeight = (node: MindMapNode): number => {
    if (!node.children || node.children.length === 0) {
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

  const updateNodePositions = (node: MindMapNode, depth: number = 0, side: LayoutSide = 'center', yOffset: number = 0, _availableHeight: number = 0): void => {
    if (depth === 0) {
      if (!preserveRootPosition) {
        node.x = centerX;
        node.y = centerY;
      }

      if (node.children && node.children.length > 0) {
        const leftChildren: MindMapNode[] = [];
        const rightChildren: MindMapNode[] = [];

        // 子ノードを左右に振り分け（偶数インデックスは右、奇数は左）
        node.children.forEach((child: MindMapNode, index: number) => {
          if (index % 2 === 0) {
            rightChildren.push(child);
          } else {
            leftChildren.push(child);
          }
        });

        // 右側の子ノード配置
        if (rightChildren.length > 0) {
          const rightTotalHeight = rightChildren.reduce((sum: number, child: MindMapNode) => 
            sum + calculateSubtreeHeight(child), 0);
          
          let currentOffset = 0;
          rightChildren.forEach((child: MindMapNode) => {
            const childHeight = calculateSubtreeHeight(child);
            const childYOffset = (currentOffset + childHeight / 2 - rightTotalHeight / 2) * minVerticalSpacing;
            updateNodePositions(child, 1, 'right', childYOffset, childHeight);
            currentOffset += childHeight;
          });
        }

        // 左側の子ノード配置
        if (leftChildren.length > 0) {
          const leftTotalHeight = leftChildren.reduce((sum: number, child: MindMapNode) => 
            sum + calculateSubtreeHeight(child), 0);
          
          let currentOffset = 0;
          leftChildren.forEach((child: MindMapNode) => {
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
        const totalChildHeight = node.children.reduce((sum: number, child: MindMapNode) => 
          sum + calculateSubtreeHeight(child), 0);
        
        const spacing = minVerticalSpacing;
        
        let currentOffset = 0;
        node.children.forEach((child: MindMapNode) => {
          const childHeight = calculateSubtreeHeight(child);
          const childYOffset = yOffset + (currentOffset + childHeight / 2 - totalChildHeight / 2) * spacing;
          updateNodePositions(child, depth + 1, side, childYOffset, childHeight);
          currentOffset += childHeight;
        });
      }
    }
  };

  // 衝突検出と調整
  const adjustForCollisions = (rootNode: MindMapNode): void => {
    const allNodes: LayoutNode[] = [];
    
    const collectNodes = (node: LayoutNode): void => {
      allNodes.push(node);
      if (node.children) {
        node.children.forEach((child: MindMapNode) => collectNodes(child as LayoutNode));
      }
    };
    
    collectNodes(rootNode);
    
    // 同じ深度のノード同士の衝突をチェック
    const nodesByDepth: Record<number, LayoutNode[]> = {};
    const calculateDepth = (node: LayoutNode, depth: number = 0, parent: LayoutNode | null = null): void => {
      node._depth = depth;
      node._parent = parent;
      if (!nodesByDepth[depth]) nodesByDepth[depth] = [];
      nodesByDepth[depth].push(node);
      
      if (node.children) {
        node.children.forEach((child: MindMapNode) => calculateDepth(child as LayoutNode, depth + 1, node));
      }
    };
    
    calculateDepth(rootNode);
    
    // 各深度で衝突調整
    Object.values(nodesByDepth).forEach((nodesAtDepth: LayoutNode[]) => {
      if (nodesAtDepth.length <= 1) return;
      
      // Y座標でソート
      nodesAtDepth.sort((a: LayoutNode, b: LayoutNode) => a.y - b.y);
      
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
    allNodes.forEach((node: LayoutNode) => {
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

export const mindMapLayoutPreserveRoot: LayoutFunction<MindMapLayoutOptions> = (rootNode: MindMapNode, options: MindMapLayoutOptions = {}) => {
  return improvedMindMapLayout(rootNode, { ...options, preserveRootPosition: true });
};

/**
 * 有機的レイアウト - 自然な形状での配置
 */
export const organicLayout: LayoutFunction<OrganicLayoutOptions> = (rootNode: MindMapNode, options: OrganicLayoutOptions = {}) => {
  const {
    centerX = 400,
    centerY = 300,
    baseRadius = 120,
    radiusVariation = 40,
    angleVariation: _angleVariation = 30,
    repulsionForce = 1000,
    iterations = 50
  } = options;

  // 初期配置：放射状に配置
  let layoutNode = radialLayout(rootNode, { centerX, centerY, baseRadius: baseRadius + Math.random() * radiusVariation });

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
  for (let iter: number = 0; iter < iterations; iter++) {
    allNodes.forEach((node: MindMapNode) => {
      if (node.id === 'root') return; // ルートは固定

      let forceX: number = 0;
      let forceY: number = 0;

      // 他のノードからの反発力
      allNodes.forEach((otherNode: MindMapNode) => {
        if (node.id === otherNode.id) return;

        const dx: number = node.x - otherNode.x;
        const dy: number = node.y - otherNode.y;
        const distance: number = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0 && distance < 200) {
          const force: number = repulsionForce / (distance * distance);
          forceX += (dx / distance) * force;
          forceY += (dy / distance) * force;
        }
      });

      // 少しランダムな力を加えて自然さを演出
      forceX += (Math.random() - 0.5) * 10;
      forceY += (Math.random() - 0.5) * 10;

      // 力を適用（減衰させる）
      const damping: number = 0.1;
      node.x += forceX * damping;
      node.y += forceY * damping;
    });
  }

  return layoutNode;
};

/**
 * グリッドレイアウト - 規則正しい格子状配置
 */
export const gridLayout: LayoutFunction<GridLayoutOptions> = (rootNode: MindMapNode, options: GridLayoutOptions = {}) => {
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
    const row: number = Math.floor(index / columns);
    const col: number = index % columns;
    
    const startX: number = centerX - (columns - 1) * gridSpacing / 2;
    const startY: number = centerY + gridSpacing; // ルートノードより下から開始
    
    node.x = startX + col * gridSpacing;
    node.y = startY + row * gridSpacing;
  });

  return newRootNode;
};

/**
 * 円形レイアウト - 全ノードを円形に配置
 */
export const circularLayout: LayoutFunction<CircularLayoutOptions> = (rootNode: MindMapNode, options: CircularLayoutOptions = {}) => {
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
    const angleStep: number = (2 * Math.PI) / (allNodes.length - 1);
    
    allNodes.slice(1).forEach((node: MindMapNode, index: number) => {
      const angle: number = index * angleStep;
      node.x = centerX + Math.cos(angle) * radius;
      node.y = centerY + Math.sin(angle) * radius;
    });
  }

  return newRootNode;
};

/**
 * 自動レイアウト選択 - ノード数に基づいて最適なレイアウトを選択
 */
export const autoSelectLayout: LayoutFunction = (rootNode: MindMapNode, options: BaseLayoutOptions = {}) => {
  const flattenNodes = (node: MindMapNode, nodes: MindMapNode[] = []): MindMapNode[] => {
    nodes.push(node);
    if (node.children) {
      node.children.forEach((child: MindMapNode) => flattenNodes(child, nodes));
    }
    return nodes;
  };

  const allNodes = flattenNodes(rootNode);
  const nodeCount: number = allNodes.length;

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
export const layoutPresets: Record<string, LayoutPreset> = {
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
