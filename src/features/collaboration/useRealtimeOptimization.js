import { useCallback, useRef, useMemo } from 'react';

/**
 * リアルタイム機能のパフォーマンス最適化フック
 * レンダリング最適化、バッチ処理、メモ化を提供
 */
export const useRealtimeOptimization = () => {
  // バッチ処理用の参照
  const batchTimerRef = useRef(null);
  const pendingUpdatesRef = useRef([]);
  const lastUpdateTimeRef = useRef(0);

  // バッチ処理設定
  const BATCH_DELAY = 16; // 60fps相当
  const MAX_BATCH_SIZE = 10;
  const MIN_UPDATE_INTERVAL = 50; // 最小更新間隔

  /**
   * 複数の更新をバッチ処理
   */
  const batchUpdates = useCallback((updateFn, priority = 'normal') => {
    const now = Date.now();
    
    // 高優先度の更新は即座に実行
    if (priority === 'high') {
      updateFn();
      return;
    }

    // 更新を保留リストに追加
    pendingUpdatesRef.current.push({
      updateFn,
      timestamp: now,
      priority
    });

    // バッチサイズが上限に達した場合は即座に実行
    if (pendingUpdatesRef.current.length >= MAX_BATCH_SIZE) {
      processPendingUpdates();
      return;
    }

    // 最小更新間隔チェック
    if (now - lastUpdateTimeRef.current < MIN_UPDATE_INTERVAL) {
      scheduleUpdate();
      return;
    }

    // 通常のバッチ処理
    scheduleUpdate();
  }, []);

  /**
   * 更新のスケジュール
   */
  const scheduleUpdate = useCallback(() => {
    if (batchTimerRef.current) {
      return; // 既にスケジュール済み
    }

    batchTimerRef.current = setTimeout(() => {
      processPendingUpdates();
    }, BATCH_DELAY);
  }, []);

  /**
   * 保留中の更新を処理
   */
  const processPendingUpdates = useCallback(() => {
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }

    const updates = [...pendingUpdatesRef.current];
    pendingUpdatesRef.current = [];
    lastUpdateTimeRef.current = Date.now();

    // 優先度順にソート
    updates.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // requestAnimationFrameで更新を実行
    requestAnimationFrame(() => {
      updates.forEach(({ updateFn }) => {
        try {
          updateFn();
        } catch (error) {
          console.error('Batch update error:', error);
        }
      });
    });
  }, []);

  /**
   * カーソル位置の最適化
   */
  const optimizeCursorUpdates = useCallback(() => {
    const cursorUpdateCache = new Map();
    const CURSOR_UPDATE_THROTTLE = 100; // 100ms間隔

    return (userId, cursorData) => {
      const now = Date.now();
      const lastUpdate = cursorUpdateCache.get(userId);

      if (lastUpdate && now - lastUpdate < CURSOR_UPDATE_THROTTLE) {
        return false; // スキップ
      }

      cursorUpdateCache.set(userId, now);
      return true; // 更新許可
    };
  }, []);

  /**
   * ユーザープレゼンス更新の最適化
   */
  const optimizePresenceUpdates = useCallback(() => {
    const presenceCache = new Map();
    
    return (users) => {
      const cacheKey = users.map(u => `${u.id}:${u.lastActivity}`).join(',');
      
      if (presenceCache.has(cacheKey)) {
        return presenceCache.get(cacheKey);
      }

      const optimizedUsers = users.map(user => ({
        id: user.id,
        name: user.name,
        color: user.color,
        isActive: user.lastActivity && (Date.now() - user.lastActivity < 300000), // 5分
        lastSeen: user.lastActivity
      }));

      presenceCache.set(cacheKey, optimizedUsers);
      
      // キャッシュサイズ制限
      if (presenceCache.size > 50) {
        const firstKey = presenceCache.keys().next().value;
        presenceCache.delete(firstKey);
      }

      return optimizedUsers;
    };
  }, []);

  /**
   * WebSocket メッセージの最適化
   */
  const optimizeWebSocketMessages = useCallback(() => {
    const messageQueue = [];
    const MESSAGE_BATCH_SIZE = 5;
    const MESSAGE_BATCH_DELAY = 50;
    let messageTimer = null;

    const sendBatch = (websocket) => {
      if (messageQueue.length === 0) return;

      const batch = messageQueue.splice(0, MESSAGE_BATCH_SIZE);
      
      if (batch.length === 1) {
        // 単一メッセージはそのまま送信
        websocket.send(JSON.stringify(batch[0]));
      } else {
        // 複数メッセージはバッチとして送信
        websocket.send(JSON.stringify({
          type: 'batch',
          messages: batch
        }));
      }
    };

    return {
      queueMessage: (message, websocket) => {
        messageQueue.push(message);

        // 高優先度メッセージは即座に送信
        if (message.priority === 'high' || messageQueue.length >= MESSAGE_BATCH_SIZE) {
          if (messageTimer) {
            clearTimeout(messageTimer);
            messageTimer = null;
          }
          sendBatch(websocket);
          return;
        }

        // バッチ送信をスケジュール
        if (!messageTimer) {
          messageTimer = setTimeout(() => {
            sendBatch(websocket);
            messageTimer = null;
          }, MESSAGE_BATCH_DELAY);
        }
      },
      
      flush: (websocket) => {
        if (messageTimer) {
          clearTimeout(messageTimer);
          messageTimer = null;
        }
        sendBatch(websocket);
      }
    };
  }, []);

  /**
   * 操作履歴の最適化
   */
  const optimizeOperationHistory = useCallback(() => {
    const MAX_HISTORY_SIZE = 100;
    const COMPRESSION_THRESHOLD = 200;

    return {
      addOperation: (history, operation) => {
        const newHistory = [...history, operation];
        
        // 履歴サイズ制限
        if (newHistory.length > MAX_HISTORY_SIZE) {
          return newHistory.slice(-MAX_HISTORY_SIZE);
        }
        
        // 圧縮が必要な場合
        if (newHistory.length > COMPRESSION_THRESHOLD) {
          return compressHistory(newHistory);
        }
        
        return newHistory;
      },
      
      compressHistory: (history) => {
        // 同じノードに対する連続的な更新をマージ
        const compressed = [];
        let lastOperation = null;
        
        history.forEach(op => {
          if (lastOperation &&
              lastOperation.type === op.type &&
              lastOperation.nodeId === op.nodeId &&
              op.timestamp - lastOperation.timestamp < 5000) {
            // 5秒以内の同じノードの操作はマージ
            lastOperation.data = { ...lastOperation.data, ...op.data };
            lastOperation.timestamp = op.timestamp;
          } else {
            compressed.push(op);
            lastOperation = op;
          }
        });
        
        return compressed;
      }
    };
  }, []);

  /**
   * メモリリークを防ぐクリーンアップ
   */
  const cleanup = useCallback(() => {
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    pendingUpdatesRef.current = [];
  }, []);

  // メモ化された最適化ユーティリティ
  const optimizationUtils = useMemo(() => ({
    batchUpdates,
    optimizeCursorUpdates: optimizeCursorUpdates(),
    optimizePresenceUpdates: optimizePresenceUpdates(),
    optimizeWebSocketMessages: optimizeWebSocketMessages(),
    optimizeOperationHistory: optimizeOperationHistory(),
    cleanup
  }), [
    batchUpdates,
    optimizeCursorUpdates,
    optimizePresenceUpdates,
    optimizeWebSocketMessages,
    optimizeOperationHistory,
    cleanup
  ]);

  return optimizationUtils;
};

/**
 * レンダリング最適化のためのメモ化ヘルパー
 */
export const useRenderOptimization = () => {
  // ノードの深い比較を避けるための浅い比較関数
  const shallowCompareNodes = useCallback((prev, current) => {
    if (prev.length !== current.length) return false;
    
    for (let i = 0; i < prev.length; i++) {
      const prevNode = prev[i];
      const currentNode = current[i];
      
      if (prevNode.id !== currentNode.id ||
          prevNode.x !== currentNode.x ||
          prevNode.y !== currentNode.y ||
          prevNode.text !== currentNode.text ||
          prevNode.color !== currentNode.color) {
        return false;
      }
    }
    
    return true;
  }, []);

  // ユーザーカーソルの最適化された比較
  const compareCursors = useCallback((prev, current) => {
    if (prev.size !== current.size) return false;
    
    for (const [userId, cursor] of current) {
      const prevCursor = prev.get(userId);
      if (!prevCursor ||
          prevCursor.nodeId !== cursor.nodeId ||
          prevCursor.timestamp !== cursor.timestamp) {
        return false;
      }
    }
    
    return true;
  }, []);

  // 接続ユーザーの最適化された比較
  const compareUsers = useCallback((prev, current) => {
    if (prev.length !== current.length) return false;
    
    return prev.every((prevUser, index) => {
      const currentUser = current[index];
      return prevUser.id === currentUser.id &&
             prevUser.name === currentUser.name &&
             prevUser.color === currentUser.color;
    });
  }, []);

  return {
    shallowCompareNodes,
    compareCursors,
    compareUsers
  };
};

/**
 * パフォーマンス測定用フック
 */
export const usePerformanceMonitor = () => {
  const metricsRef = useRef({
    renderCount: 0,
    averageRenderTime: 0,
    lastRenderTime: 0,
    wsMessageCount: 0,
    wsMessageRate: 0,
    memoryUsage: 0
  });

  const startRenderMeasure = useCallback(() => {
    return performance.now();
  }, []);

  const endRenderMeasure = useCallback((startTime) => {
    const renderTime = performance.now() - startTime;
    const metrics = metricsRef.current;
    
    metrics.renderCount++;
    metrics.lastRenderTime = renderTime;
    metrics.averageRenderTime = (metrics.averageRenderTime + renderTime) / 2;
    
    // パフォーマンス警告
    if (renderTime > 16) { // 60fps threshold
      console.warn(`Slow render detected: ${renderTime.toFixed(2)}ms`);
    }
  }, []);

  const recordWebSocketMessage = useCallback(() => {
    const metrics = metricsRef.current;
    metrics.wsMessageCount++;
    
    // 毎秒のメッセージレートを計算
    const now = Date.now();
    if (!metrics.lastMessageTime) {
      metrics.lastMessageTime = now;
    } else if (now - metrics.lastMessageTime >= 1000) {
      metrics.wsMessageRate = metrics.wsMessageCount;
      metrics.wsMessageCount = 0;
      metrics.lastMessageTime = now;
    }
  }, []);

  const getMetrics = useCallback(() => {
    const metrics = { ...metricsRef.current };
    
    // メモリ使用量（概算）
    if (performance.memory) {
      metrics.memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    
    return metrics;
  }, []);

  const logPerformanceSummary = useCallback(() => {
    const metrics = getMetrics();
    console.group('🔍 Real-time Performance Metrics');
    console.log(`Renders: ${metrics.renderCount}`);
    console.log(`Average render time: ${metrics.averageRenderTime.toFixed(2)}ms`);
    console.log(`WebSocket message rate: ${metrics.wsMessageRate}/sec`);
    console.log(`Memory usage: ${metrics.memoryUsage.toFixed(2)}MB`);
    console.groupEnd();
  }, [getMetrics]);

  return {
    startRenderMeasure,
    endRenderMeasure,
    recordWebSocketMessage,
    getMetrics,
    logPerformanceSummary
  };
};

export default useRealtimeOptimization;