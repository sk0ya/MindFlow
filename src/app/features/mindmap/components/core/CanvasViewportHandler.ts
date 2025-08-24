import { useRef, useCallback, useEffect } from 'react';

interface ViewportState {
  zoom: number;
  pan: { x: number; y: number };
}

interface CanvasViewportHandlerProps {
  zoom: number;
  setZoom: (zoom: number) => void;
  pan: { x: number; y: number };
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  svgRef: React.RefObject<SVGSVGElement>;
  isDragging?: boolean;
}

export const useCanvasViewportHandler = ({
  zoom,
  setZoom,
  pan: _pan,
  setPan,
  svgRef,
  isDragging = false
}: CanvasViewportHandlerProps) => {
  const isPanningRef = useRef(false);
  const isPanReadyRef = useRef(false); // パン準備状態（マウスダウン済み）
  const lastPanPointRef = useRef({ x: 0, y: 0 });

  // ズーム処理
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    if (svgRef.current) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(zoom * delta, 0.3), 5);
      setZoom(newZoom);
    }
  }, [zoom, setZoom, svgRef]);

  // パン開始処理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // ノード要素（rect, circle, foreignObject）以外をクリックした場合にパンを開始
    const target = e.target as Element;
    const isNodeElement = target.tagName === 'rect' || 
                         target.tagName === 'circle' || 
                         target.tagName === 'foreignObject' ||
                         target.closest('foreignObject');
    
    if (!isNodeElement) {
      isPanReadyRef.current = true;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }, []);

  // パン移動処理
  const handleMouseMove = useCallback((e: MouseEvent) => {
    // パン準備状態で、ドラッグ中でない場合にパン開始
    if (isPanReadyRef.current && !isDragging) {
      const deltaX = e.clientX - lastPanPointRef.current.x;
      const deltaY = e.clientY - lastPanPointRef.current.y;
      
      // 小さな移動は無視してパフォーマンスを改善
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        return;
      }
      
      // 実際に動いた時点でパン状態をtrueに
      if (!isPanningRef.current) {
        isPanningRef.current = true;
      }
      
      setPan(prev => ({
        x: prev.x + deltaX / (zoom * 1.5),
        y: prev.y + deltaY / (zoom * 1.5)
      }));
      
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [isDragging, zoom, setPan]);

  // パン終了処理
  const handleMouseUp = useCallback(() => {
    // ドラッグ中でない場合のみパン終了
    if (!isDragging) {
      isPanningRef.current = false;
      isPanReadyRef.current = false;
    }
  }, [isDragging]);

  // マウスイベントの登録・解除
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // カーソル状態を取得
  const getCursor = useCallback(() => {
    if (isPanningRef.current) return 'grabbing';
    if (isDragging) return 'grabbing';
    return 'grab';
  }, [isDragging]);

  // isPanningの現在値を取得する関数
  const getIsPanning = useCallback(() => {
    return isPanningRef.current;
  }, []);

  return {
    handleWheel,
    handleMouseDown,
    getCursor,
    getIsPanning
  };
};

export type { ViewportState, CanvasViewportHandlerProps };