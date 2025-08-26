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
      // 子ノード全体の高さを計算
      const totalHeight = node.children.reduce((sum, child) => 
        sum + calculateSubtreeHeight(child), 0
      );
      
      // 子ノードの開始位置を計算（親ノードを中心とする）
      let currentOffset = -(totalHeight - 1) * nodeSpacing / 2;
      
      node.children.forEach((child: MindMapNode) => {
        const childHeight = calculateSubtreeHeight(child);
        const childCenterOffset = currentOffset + (childHeight - 1) * nodeSpacing / 2;
        
        positionNode(child, node, depth + 1, yOffset + childCenterOffset);
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
      
      positionNode(child, newRootNode, 1, childCenterOffset);
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

