// 自動レイアウト機能のユーティリティ
import { cloneDeep } from './lodash-utils';
import { COORDINATES, LAYOUT } from '../constants/index';
import { calculateNodeSize, getToggleButtonPosition } from './nodeUtils';
import type { MindMapNode } from '../types';

// Layout options interfaces
interface LayoutOptions {
  centerX?: number;
  centerY?: number;
  levelSpacing?: number;
  nodeSpacing?: number;
}

/**
 * トグルボタンの位置を基準にした子ノードのX座標を計算
 */
const getChildNodeXFromToggle = (parentNode: MindMapNode, rootNode: MindMapNode): number => {
  const parentNodeSize = calculateNodeSize(parentNode);
  const togglePosition = getToggleButtonPosition(parentNode, rootNode, parentNodeSize);
  
  // トグルボタンから子ノードまでの距離
  return togglePosition.x + LAYOUT.TOGGLE_TO_CHILD_DISTANCE;
};

/**
 * ルートノードの右端から子ノードのX座標を計算
 */
const getChildNodeXFromRootEdge = (rootNode: MindMapNode): number => {
  const rootNodeSize = calculateNodeSize(rootNode);
  const rootRightEdge = rootNode.x + rootNodeSize.width / 2;
  
  // ルートノードの右端から子ノードまでの距離
  return rootRightEdge + LAYOUT.ROOT_TO_CHILD_DISTANCE;
};


/**
 * シンプルな右側階層レイアウト - 標準的なマインドマップスタイル
 * 実際のノードサイズを考慮して衝突を回避
 */
export const simpleHierarchicalLayout = (rootNode: MindMapNode, options: LayoutOptions = {}): MindMapNode => {
  const {
    centerX = COORDINATES.DEFAULT_CENTER_X,
    centerY = COORDINATES.DEFAULT_CENTER_Y,
    levelSpacing = LAYOUT.LEVEL_SPACING,
    nodeSpacing = LAYOUT.VERTICAL_SPACING_MIN // 最小間隔を使用
  } = options;

  const newRootNode = cloneDeep(rootNode);
  
  // ルートノードを配置
  newRootNode.x = centerX;
  newRootNode.y = centerY;

  // サブツリーの実際の高さを計算（最小間隔で密に配置）
  const calculateSubtreeActualHeight = (node: MindMapNode): number => {
    if (node.collapsed || !node.children || node.children.length === 0) {
      const nodeSize = calculateNodeSize(node);
      return nodeSize.height;
    }
    
    // 子ノードの合計高さ + 最小間隔のみ
    const childrenTotalHeight = node.children.reduce((sum, child, index) => {
      const childHeight = calculateSubtreeActualHeight(child);
      const spacing = index > 0 ? nodeSpacing : 0; // 最小間隔のみ
      return sum + childHeight + spacing;
    }, 0);
    
    // 現在のノードの高さと子ノード群の高さの最大値
    const nodeSize = calculateNodeSize(node);
    return Math.max(nodeSize.height, childrenTotalHeight);
  };

  // サブツリーのノード数を計算（レイアウト調整用）
  const calculateSubtreeNodeCount = (node: MindMapNode): number => {
    if (node.collapsed || !node.children || node.children.length === 0) {
      return 1;
    }
    return node.children.reduce((sum, child) => sum + calculateSubtreeNodeCount(child), 0);
  };

  // 再帰的にノードを配置
  const positionNode = (node: MindMapNode, parent: MindMapNode | null, depth: number, yOffset: number): void => {
    if (depth === 0) return; // ルートは既に配置済み
    
    // X座標の計算
    if (parent) {
      const nodeSize = calculateNodeSize(node);
      
      if (depth === 1) {
        // ルートノードの直接の子要素: ルートノードの右端から120px
        const childXFromRootEdge = getChildNodeXFromRootEdge(newRootNode);
        node.x = childXFromRootEdge + nodeSize.width / 2;
      } else {
        // それ以外: トグルボタンを基準とした配置
        const childXFromToggle = getChildNodeXFromToggle(parent, newRootNode);
        node.x = childXFromToggle + nodeSize.width / 2;
      }
    } else {
      // フォールバック: 従来の深度ベースの配置
      node.x = centerX + (depth * levelSpacing);
    }
    node.y = centerY + yOffset;
    
    if (!node.collapsed && node.children && node.children.length > 0) {
      // 子ノードの実際の高さを考慮した配置
      const childrenWithHeights = node.children.map(child => ({
        node: child,
        actualHeight: calculateSubtreeActualHeight(child),
        nodeCount: calculateSubtreeNodeCount(child)
      }));
      
      // 全子ノードの合計高さ + 最小間隔を計算
      const totalActualHeight = childrenWithHeights.reduce((sum, child, index) => {
        const spacing = index > 0 ? nodeSpacing : 0;
        return sum + child.actualHeight + spacing;
      }, 0);
      
      // 子ノードの開始位置を計算（親ノードを中心とする）
      let currentOffset = -totalActualHeight / 2;
      
      childrenWithHeights.forEach((childInfo, index) => {
        // 各子ノードの中心位置を計算
        const childCenterOffset = currentOffset + childInfo.actualHeight / 2;
        
        positionNode(childInfo.node, node, depth + 1, yOffset + childCenterOffset);
        
        // 次の子ノードのためのオフセット更新（最小間隔のみ）
        currentOffset += childInfo.actualHeight;
        if (index < childrenWithHeights.length - 1) {
          currentOffset += nodeSpacing; // 最小間隔のみ追加
        }
      });
    }
  };

  if (!newRootNode.collapsed && newRootNode.children && newRootNode.children.length > 0) {
    // ルートの子ノードの実際の高さを考慮した配置
    const childrenWithHeights = newRootNode.children.map(child => ({
      node: child,
      actualHeight: calculateSubtreeActualHeight(child),
      nodeCount: calculateSubtreeNodeCount(child)
    }));
    
    // 全子ノードの合計高さ + 最小間隔を計算
    const totalActualHeight = childrenWithHeights.reduce((sum, child, index) => {
      const spacing = index > 0 ? nodeSpacing : 0;
      return sum + child.actualHeight + spacing;
    }, 0);
    
    // 子ノードの開始位置を計算（ルートノードを中心とする）
    let currentOffset = -totalActualHeight / 2;
    
    childrenWithHeights.forEach((childInfo, index) => {
      // 各子ノードの中心位置を計算
      const childCenterOffset = currentOffset + childInfo.actualHeight / 2;
      
      positionNode(childInfo.node, newRootNode, 1, childCenterOffset);
      
      // 次の子ノードのためのオフセット更新（最小間隔のみ）
      currentOffset += childInfo.actualHeight;
      if (index < childrenWithHeights.length - 1) {
        currentOffset += nodeSpacing; // 最小間隔のみ追加
      }
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

