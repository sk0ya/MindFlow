// ナビゲーション機能専用のカスタムフック（V2: 自己完結型）
import { useState, useCallback } from 'react';

// ナビゲーション関連の型定義
export type NavigationDirection = 'up' | 'down' | 'left' | 'right';

export interface Position {
  x: number;
  y: number;
}

export interface NavigationState {
  zoom: number;
  pan: Position;
}

// ノード型定義（簡略版 - 必要な部分のみ）
export interface NavigationNode {
  id: string;
  text: string;
  x: number;
  y: number;
  children?: NavigationNode[];
}

// マインドマップデータ型定義（ナビゲーション用）
export interface NavigationMindMapData {
  rootNode: NavigationNode;
}

// ナビゲーション関数の型定義
export type FindNodeFunction = (nodeId: string) => NavigationNode | null;
export type FindParentNodeFunction = (nodeId: string) => NavigationNode | null;
export type FlattenNodesFunction = (rootNode: NavigationNode) => NavigationNode[];
export type SetSelectedNodeIdFunction = (nodeId: string) => void;

// ナビゲーション機能のパラメータ型
export interface NavigationParams {
  findNode: FindNodeFunction;
  findParentNode: FindParentNodeFunction;
  flattenNodes: FlattenNodesFunction;
  selectedNodeId: string | null;
  setSelectedNodeId: SetSelectedNodeIdFunction;
  data: NavigationMindMapData | null;
}

// ナビゲーション関数の型
export type NavigationFunction = (direction: NavigationDirection) => void;

// ナビゲーションファクトリー関数の型
export type CreateNavigateToDirectionFunction = (
  findNode: FindNodeFunction,
  findParentNode: FindParentNodeFunction,
  flattenNodes: FlattenNodesFunction,
  selectedNodeId: string | null,
  setSelectedNodeId: SetSelectedNodeIdFunction,
  data: NavigationMindMapData | null
) => NavigationFunction;

// フック戻り値の型
export interface UseMindMapNavigationReturn {
  // Zoom & Pan状態
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  pan: Position;
  setPan: React.Dispatch<React.SetStateAction<Position>>;
  resetView: () => void;
  
  // Navigation (ファクトリー関数)
  createNavigateToDirection: CreateNavigateToDirectionFunction;
}

// 距離計算の結果型
interface DistanceCalculation {
  dx: number;
  dy: number;
  distance: number;
}

// 方向判定の閾値定数
const DIRECTION_THRESHOLD = 20;

export const useMindMapNavigation = (): UseMindMapNavigationReturn => {
  // Zoom & Pan状態
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 });

  // Zoom/Panリセット
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // 方向キーによるノード選択（引数で必要な値を受け取る）
  const createNavigateToDirection = useCallback<CreateNavigateToDirectionFunction>(
    (findNode: FindNodeFunction, findParentNode: FindParentNodeFunction, flattenNodes: FlattenNodesFunction, selectedNodeId: string | null, setSelectedNodeId: SetSelectedNodeIdFunction, data: NavigationMindMapData | null) => {
    return (direction: NavigationDirection): void => {
      if (!selectedNodeId || !data?.rootNode) return;
      
      const allNodes: NavigationNode[] = flattenNodes(data.rootNode);
      const currentNode: NavigationNode | null = findNode(selectedNodeId);
      if (!currentNode) return;
      
      let targetNode: NavigationNode | null = null;
      let minDistance: number = Infinity;
      
      allNodes.forEach((node: NavigationNode) => {
        if (node.id === selectedNodeId) return;
        
        const dx: number = node.x - currentNode.x;
        const dy: number = node.y - currentNode.y;
        const distance: number = Math.sqrt(dx * dx + dy * dy);
        
        let isInDirection: boolean = false;
        
        switch (direction) {
          case 'up':
            isInDirection = dy < -DIRECTION_THRESHOLD && Math.abs(dx) < Math.abs(dy);
            break;
          case 'down':
            isInDirection = dy > DIRECTION_THRESHOLD && Math.abs(dx) < Math.abs(dy);
            break;
          case 'left':
            isInDirection = dx < -DIRECTION_THRESHOLD && Math.abs(dy) < Math.abs(dx);
            break;
          case 'right':
            isInDirection = dx > DIRECTION_THRESHOLD && Math.abs(dy) < Math.abs(dx);
            break;
        }
        
        if (isInDirection && distance < minDistance) {
          minDistance = distance;
          targetNode = node;
        }
      });
      
      // 方向に適切なノードが見つからない場合は、関連ノードを選択
      if (!targetNode) {
        const currentNode: NavigationNode | null = findNode(selectedNodeId);
        if (!currentNode) return;
        
        switch (direction) {
          case 'up':
            // 上方向: 親ノードを選択
            targetNode = findParentNode(selectedNodeId);
            break;
          case 'down':
            // 下方向: 最初の子ノードを選択
            targetNode = currentNode.children && currentNode.children.length > 0 
              ? currentNode.children[0] ?? null : null;
            break;
          case 'left':
            // 左方向: 前の兄弟ノードを選択
            const leftParent: NavigationNode | null = findParentNode(selectedNodeId);
            if (leftParent && leftParent.children) {
              const currentIndex: number = leftParent.children.findIndex((child: NavigationNode) => child.id === selectedNodeId);
              targetNode = currentIndex > 0 ? leftParent.children[currentIndex - 1] ?? null : null;
            }
            break;
          case 'right':
            // 右方向: 次の兄弟ノードを選択
            const rightParent: NavigationNode | null = findParentNode(selectedNodeId);
            if (rightParent && rightParent.children) {
              const currentIndex: number = rightParent.children.findIndex((child: NavigationNode) => child.id === selectedNodeId);
              targetNode = currentIndex < rightParent.children.length - 1 
                ? rightParent.children[currentIndex + 1] ?? null : null;
            }
            break;
        }
      }
      
      if (targetNode) {
        setSelectedNodeId(targetNode.id);
      }
    };
  }, []);

  return {
    // Zoom & Pan
    zoom,
    setZoom,
    pan,
    setPan,
    resetView,
    
    // Navigation (ファクトリー関数)
    createNavigateToDirection
  };
};