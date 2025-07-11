import React, { useCallback, useEffect, useState } from 'react';
import type { MindMapNode } from '../../../../shared/types';

interface MousePosition {
  x: number;
  y: number;
}

interface NodeDragHandlerProps {
  node: MindMapNode;
  zoom: number;
  svgRef: React.RefObject<SVGSVGElement>;
  onDragStart?: (nodeId: string) => void;
  onDragMove?: (x: number, y: number) => void;
  onDragEnd?: (nodeId: string, x: number, y: number) => void;
}

export const useNodeDragHandler = ({
  node,
  zoom,
  svgRef,
  onDragStart,
  onDragMove,
  onDragEnd
}: NodeDragHandlerProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mouseDownPos, setMouseDownPos] = useState<MousePosition | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // パン機能との競合を避けるため、stopPropagationを削除
    e.preventDefault();
    
    if (svgRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const svgX = (e.clientX - svgRect.left) / zoom;
      const svgY = (e.clientY - svgRect.top) / zoom;
      
      // マウスダウン位置を記録（ドラッグ判定用）
      setMouseDownPos({ x: e.clientX, y: e.clientY });
      setDragStart({
        x: svgX - node.x,
        y: svgY - node.y
      });
    }
  }, [node.x, node.y, zoom, svgRef]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (mouseDownPos && !isDragging) {
      // ドラッグ開始判定（5px以上移動でドラッグとみなす）
      const distance = Math.sqrt(
        Math.pow(e.clientX - mouseDownPos.x, 2) + 
        Math.pow(e.clientY - mouseDownPos.y, 2)
      );
      
      if (distance > 5) {
        console.log('📱 Node ドラッグ開始:', { nodeId: node.id, distance });
        setIsDragging(true);
        // ドラッグ開始を通知
        if (onDragStart) {
          onDragStart(node.id);
        }
      }
    } else if (isDragging) {
      // ドラッグ中の位置を通知（ドロップターゲット検出用）
      console.log('📱 Node ドラッグ中:', { nodeId: node.id, clientX: e.clientX, clientY: e.clientY, hasOnDragMove: !!onDragMove });
      if (onDragMove) {
        console.log('📱 Node: onDragMove呼び出し');
        onDragMove(e.clientX, e.clientY);
      } else {
        console.log('❌ Node: onDragMoveが未定義');
      }
    }
  }, [isDragging, mouseDownPos, onDragMove, onDragStart, node.id]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    console.log('📱 Node マウスアップ:', { nodeId: node.id, isDragging });
    if (isDragging && svgRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const svgX = (e.clientX - svgRect.left) / zoom;
      const svgY = (e.clientY - svgRect.top) / zoom;
      
      const newX = svgX - dragStart.x;
      const newY = svgY - dragStart.y;
      
      console.log('📱 Node ドラッグ終了通知:', { nodeId: node.id, newX, newY, clientX: e.clientX, clientY: e.clientY });
      // ドラッグ終了を通知（親要素変更またはノード移動）
      if (onDragEnd) {
        onDragEnd(node.id, newX, newY);
      }
    }
    
    // 状態をリセット
    setIsDragging(false);
    setMouseDownPos(null);
  }, [isDragging, dragStart, node.id, onDragEnd, zoom, svgRef]);

  useEffect(() => {
    if (isDragging || mouseDownPos) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isDragging, mouseDownPos, handleMouseMove, handleMouseUp]);

  return {
    isDragging,
    handleMouseDown
  };
};