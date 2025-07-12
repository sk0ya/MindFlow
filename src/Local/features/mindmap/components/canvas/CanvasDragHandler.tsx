import React, { useCallback, useState } from 'react';
import type { MindMapNode } from '../../../../shared/types';

interface DragState {
  isDragging: boolean;
  draggedNodeId: string | null;
  dropTargetId: string | null;
  dropPosition: 'child' | 'before' | 'after' | null;
  dragOffset: { x: number; y: number };
}

interface CanvasDragHandlerProps {
  allNodes: MindMapNode[];
  zoom: number;
  pan: { x: number; y: number };
  svgRef: React.RefObject<SVGSVGElement>;
  onChangeParent?: (nodeId: string, newParentId: string) => void;
  onChangeSiblingOrder?: (draggedNodeId: string, targetNodeId: string, insertBefore: boolean) => void;
  rootNode: MindMapNode;
}

export const useCanvasDragHandler = ({
  allNodes,
  zoom,
  pan,
  svgRef,
  onChangeParent,
  onChangeSiblingOrder,
  rootNode
}: CanvasDragHandlerProps) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedNodeId: null,
    dropTargetId: null,
    dropPosition: null,
    dragOffset: { x: 0, y: 0 }
  });

  // ドロップターゲット検出のためのヘルパー関数
  const getNodeAtPosition = useCallback((x: number, y: number): MindMapNode | null => {
    // SVG座標系での位置を取得
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return null;
    
    // マウス座標をSVG内座標に変換（zoom, panを考慮）
    const svgX = (x - svgRect.left) / zoom - pan.x;
    const svgY = (y - svgRect.top) / zoom - pan.y;
    
    console.log('🎯 座標変換:', { 
      clientX: x, clientY: y, 
      svgLeft: svgRect.left, svgTop: svgRect.top,
      zoom, panX: pan.x, panY: pan.y,
      svgX, svgY 
    });
    
    // 各ノードとの距離を計算して最も近いものを見つける
    let closestNode: MindMapNode | null = null;
    let minDistance = Infinity;
    const maxDropDistance = 120; // ドロップ可能な最大距離
    
    allNodes.forEach(node => {
      if (node.id === dragState.draggedNodeId) return; // 自分自身は除外
      
      const distance = Math.sqrt(
        Math.pow(node.x - svgX, 2) + Math.pow(node.y - svgY, 2)
      );
      
      if (distance < maxDropDistance && distance < minDistance) {
        minDistance = distance;
        closestNode = node;
      }
    });
    
    console.log('🎯 最終結果:', { closestNodeId: (closestNode as MindMapNode | null)?.id, minDistance });
    return closestNode;
  }, [allNodes, zoom, pan, dragState.draggedNodeId, svgRef]);

  // ドラッグ開始時の処理
  const handleDragStart = useCallback((nodeId: string, _e: React.MouseEvent | React.TouchEvent) => {
    console.log('🔥 ドラッグ開始:', { nodeId });
    setDragState({
      isDragging: true,
      draggedNodeId: nodeId,
      dropTargetId: null,
      dropPosition: null,
      dragOffset: { x: 0, y: 0 }
    });
  }, []);

  // ドラッグ中の処理
  const handleDragMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'clientX' in e ? e.clientX : e.touches[0].clientX;
    const clientY = 'clientY' in e ? e.clientY : e.touches[0].clientY;
    console.log('🎯 handleDragMove 呼び出し:', { x: clientX, y: clientY });
    setDragState(prev => {
      if (!prev.isDragging) {
        console.log('🚫 ドラッグ中でないため処理をスキップ');
        return prev;
      }
      
      const targetNode = getNodeAtPosition(clientX, clientY);
      console.log('🎯 ドラッグ移動:', { x: clientX, y: clientY, targetNodeId: targetNode?.id });
      return {
        ...prev,
        dropTargetId: targetNode?.id || null
      };
    });
  }, [getNodeAtPosition]);

  // ドラッグ終了時の処理
  const handleDragEnd = useCallback(() => {
    setDragState(prevState => {
      console.log('🎯 handleDragEnd 実行:', { 
        draggedNodeId: prevState.draggedNodeId, 
        dropTargetId: prevState.dropTargetId, 
        hasOnChangeParent: !!onChangeParent,
        hasOnChangeSiblingOrder: !!onChangeSiblingOrder
      });
      
      if (prevState.dropTargetId && prevState.dropTargetId !== prevState.draggedNodeId) {
        // ドラッグしたノードと対象ノードの親を確認
        const draggedNode = allNodes.find(n => n.id === prevState.draggedNodeId);
        const targetNode = allNodes.find(n => n.id === prevState.dropTargetId);
        
        if (draggedNode && targetNode) {
          // 親を特定するためのヘルパー関数
          const findParent = (childId: string): MindMapNode | null => {
            const findParentRecursive = (node: MindMapNode): MindMapNode | null => {
              if (node.children) {
                for (const child of node.children) {
                  if (child.id === childId) return node;
                  const found = findParentRecursive(child);
                  if (found) return found;
                }
              }
              return null;
            };
            return findParentRecursive(rootNode);
          };
          
          const draggedParent = prevState.draggedNodeId ? findParent(prevState.draggedNodeId) : null;
          const targetParent = findParent(prevState.dropTargetId);
          
          console.log('🔍 親要素確認:', {
            draggedParentId: draggedParent?.id,
            targetParentId: targetParent?.id,
            areSameParent: draggedParent?.id === targetParent?.id
          });
          
          if (draggedParent && targetParent && draggedParent.id === targetParent.id) {
            // 同じ親を持つ場合は兄弟順序変更
            console.log('🔄 兄弟順序変更実行:', { nodeId: prevState.draggedNodeId, dropTargetId: prevState.dropTargetId });
            if (onChangeSiblingOrder && prevState.draggedNodeId) {
              onChangeSiblingOrder(prevState.draggedNodeId, prevState.dropTargetId, true);
            }
          } else {
            // 異なる親を持つ場合は親変更
            console.log('🔄 親変更実行:', { nodeId: prevState.draggedNodeId, dropTargetId: prevState.dropTargetId });
            if (onChangeParent && prevState.draggedNodeId) {
              onChangeParent(prevState.draggedNodeId, prevState.dropTargetId);
            }
          }
        }
      }
      
      return {
        isDragging: false,
        draggedNodeId: null,
        dropTargetId: null,
        dropPosition: null,
        dragOffset: { x: 0, y: 0 }
      };
    });
  }, [onChangeParent, onChangeSiblingOrder, allNodes, rootNode]);

  return {
    dragState,
    handleDragStart,
    handleDragMove,
    handleDragEnd
  };
};