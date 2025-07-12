import { useRef, useCallback } from 'react';
import type { MindMapNode } from '../types';

interface NodePosition {
  id: string;
  x: number;
  y: number;
}

interface LayoutBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

interface UseLayoutWorkerResult {
  calculateLayout: (rootNode: MindMapNode) => Promise<NodePosition[]>;
  optimizePositions: (positions: NodePosition[]) => Promise<NodePosition[]>;
  calculateBounds: (positions: NodePosition[]) => Promise<LayoutBounds>;
  isWorking: boolean;
  terminate: () => void;
}

export const useLayoutWorker = (): UseLayoutWorkerResult => {
  const workerRef = useRef<Worker | null>(null);
  const isWorkingRef = useRef(false);
  const pendingCallbacksRef = useRef<Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>>(new Map());

  // Worker の初期化
  const initializeWorker = useCallback(() => {
    if (workerRef.current) return;

    try {
      // Web Worker の作成
      workerRef.current = new Worker(
        new URL('../../core/layoutWorker.ts', import.meta.url),
        { type: 'module' }
      );

      // Worker からのメッセージを処理
      workerRef.current.onmessage = (event) => {
        const { type, payload } = event.data;
        isWorkingRef.current = false;

        // 対応するコールバックを実行
        const callbacks = Array.from(pendingCallbacksRef.current.values());
        pendingCallbacksRef.current.clear();

        if (type === 'ERROR') {
          callbacks.forEach(cb => cb.reject(new Error(payload.error)));
        } else {
          callbacks.forEach(cb => cb.resolve(payload));
        }
      };

      // Worker エラーハンドリング
      workerRef.current.onerror = (error) => {
        console.error('Layout Worker Error:', error);
        isWorkingRef.current = false;
        
        const callbacks = Array.from(pendingCallbacksRef.current.values());
        pendingCallbacksRef.current.clear();
        callbacks.forEach(cb => cb.reject(new Error('Worker error occurred')));
      };

    } catch (error) {
      console.error('Failed to initialize layout worker:', error);
      throw error;
    }
  }, []);

  // Worker メッセージ送信のヘルパー
  const sendMessage = useCallback((type: string, payload: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      try {
        initializeWorker();
        
        if (!workerRef.current) {
          reject(new Error('Failed to initialize worker'));
          return;
        }

        if (isWorkingRef.current) {
          reject(new Error('Worker is already processing another task'));
          return;
        }

        const requestId = `${type}-${Date.now()}-${Math.random()}`;
        pendingCallbacksRef.current.set(requestId, { resolve, reject });

        isWorkingRef.current = true;
        workerRef.current.postMessage({ type, payload });

        // タイムアウト設定（10秒）
        setTimeout(() => {
          if (pendingCallbacksRef.current.has(requestId)) {
            pendingCallbacksRef.current.delete(requestId);
            isWorkingRef.current = false;
            reject(new Error('Worker operation timed out'));
          }
        }, 10000);

      } catch (error) {
        isWorkingRef.current = false;
        reject(error);
      }
    });
  }, [initializeWorker]);

  // レイアウト計算
  const calculateLayout = useCallback(async (rootNode: MindMapNode): Promise<NodePosition[]> => {
    try {
      const result = await sendMessage('CALCULATE_LAYOUT', { rootNode });
      return result.positions;
    } catch (error) {
      console.error('Layout calculation failed:', error);
      throw error;
    }
  }, [sendMessage]);

  // 位置最適化
  const optimizePositions = useCallback(async (positions: NodePosition[]): Promise<NodePosition[]> => {
    try {
      const result = await sendMessage('OPTIMIZE_POSITIONS', { positions });
      return result.positions;
    } catch (error) {
      console.error('Position optimization failed:', error);
      throw error;
    }
  }, [sendMessage]);

  // 境界計算
  const calculateBounds = useCallback(async (positions: NodePosition[]): Promise<LayoutBounds> => {
    try {
      const result = await sendMessage('CALCULATE_BOUNDS', { positions });
      return result.bounds;
    } catch (error) {
      console.error('Bounds calculation failed:', error);
      throw error;
    }
  }, [sendMessage]);

  // Worker 終了
  const terminate = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    isWorkingRef.current = false;
    pendingCallbacksRef.current.clear();
  }, []);

  return {
    calculateLayout,
    optimizePositions,
    calculateBounds,
    isWorking: isWorkingRef.current,
    terminate
  };
};