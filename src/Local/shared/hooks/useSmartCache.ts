import { useRef, useCallback } from 'react';
import type { MindMapNode } from '../types';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hitCount: number;
  computeTime: number;
}

interface CacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  avgComputeTime: number;
}

interface SmartCacheConfig {
  maxSize: number;
  ttl: number; // Time to live in milliseconds
  computeTimeThreshold: number; // Cache items that take longer than this to compute
}

const DEFAULT_CONFIG: SmartCacheConfig = {
  maxSize: 1000,
  ttl: 5 * 60 * 1000, // 5 minutes
  computeTimeThreshold: 10 // 10ms
};

export class SmartCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private stats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    hitRate: 0,
    avgComputeTime: 0
  };
  private config: SmartCacheConfig;

  constructor(config: Partial<SmartCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // キャッシュキーの生成
  private generateKey(keyParts: (string | number | boolean | object)[]): string {
    return keyParts.map(part => 
      typeof part === 'object' ? JSON.stringify(part) : String(part)
    ).join('|');
  }

  // キャッシュエントリの有効性チェック
  private isValid(entry: CacheEntry<T>): boolean {
    const now = Date.now();
    return (now - entry.timestamp) < this.config.ttl;
  }

  // LRU + 計算時間を考慮したキャッシュ削除
  private evictIfNeeded(): void {
    if (this.cache.size <= this.config.maxSize) return;

    // 削除候補のスコアリング（使用頻度、経過時間、計算時間を考慮）
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => {
      const age = Date.now() - entry.timestamp;
      const score = (entry.hitCount / Math.max(1, age / 1000)) * entry.computeTime;
      return { key, score };
    });

    // スコアの低い順にソート
    entries.sort((a, b) => a.score - b.score);

    // 下位25%を削除
    const toDelete = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < toDelete; i++) {
      this.cache.delete(entries[i].key);
    }
  }

  // 統計情報の更新
  private updateStats(isHit: boolean, computeTime: number): void {
    this.stats.totalRequests++;
    if (isHit) {
      this.stats.cacheHits++;
    } else {
      this.stats.cacheMisses++;
    }
    this.stats.hitRate = this.stats.cacheHits / this.stats.totalRequests;
    this.stats.avgComputeTime = (this.stats.avgComputeTime + computeTime) / 2;
  }

  // キャッシュからの取得または計算
  get(
    keyParts: (string | number | boolean | object)[],
    computeFn: () => T,
    forceRefresh = false
  ): T {
    const key = this.generateKey(keyParts);
    const startTime = performance.now();

    // キャッシュヒットチェック
    if (!forceRefresh && this.cache.has(key)) {
      const entry = this.cache.get(key);
      if (entry && this.isValid(entry)) {
        entry.hitCount++;
        this.updateStats(true, 0);
        return entry.value;
      } else if (entry) {
        this.cache.delete(key);
      }
    }

    // 計算実行
    const value = computeFn();
    const computeTime = performance.now() - startTime;

    // 計算時間が閾値以上の場合のみキャッシュ
    if (computeTime >= this.config.computeTimeThreshold) {
      this.evictIfNeeded();
      this.cache.set(key, {
        value,
        timestamp: Date.now(),
        hitCount: 1,
        computeTime
      });
    }

    this.updateStats(false, computeTime);
    return value;
  }

  // キャッシュクリア
  clear(): void {
    this.cache.clear();
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      avgComputeTime: 0
    };
  }

  // 統計情報の取得
  getStats(): CacheStats {
    return { ...this.stats };
  }

  // キャッシュサイズの取得
  size(): number {
    return this.cache.size;
  }
}

// MindMap 専用のキャッシュフック
export const useSmartCache = (config?: Partial<SmartCacheConfig>) => {
  const layoutCacheRef = useRef(new SmartCache<unknown>(config));
  const geometryCacheRef = useRef(new SmartCache<unknown>(config));
  const connectionCacheRef = useRef(new SmartCache<unknown>(config));

  // レイアウト計算のキャッシュ
  const getCachedLayout = useCallback(<T>(
    nodeId: string,
    nodeData: MindMapNode,
    computeFn: (nodeId: string, nodeData: MindMapNode) => T,
    forceRefresh = false
  ): T => {
    return layoutCacheRef.current.get(
      [nodeId, nodeData.children?.length || 0, nodeData.collapsed || false],
      () => computeFn(nodeId, nodeData),
      forceRefresh
    ) as T;
  }, []);

  // 幾何計算のキャッシュ
  const getCachedGeometry = useCallback(<T>(
    nodeId: string,
    position: { x: number; y: number },
    size: { width: number; height: number },
    computeFn: (nodeId: string, position: { x: number; y: number }, size: { width: number; height: number }) => T,
    forceRefresh = false
  ): T => {
    return geometryCacheRef.current.get(
      [nodeId, position.x, position.y, size.width, size.height],
      () => computeFn(nodeId, position, size),
      forceRefresh
    ) as T;
  }, []);

  // 接続線計算のキャッシュ
  const getCachedConnections = useCallback(<T>(
    parentId: string,
    childIds: string[],
    parentPos: { x: number; y: number },
    childPositions: { x: number; y: number }[],
    computeFn: (parentId: string, childIds: string[], parentPos: { x: number; y: number }, childPositions: { x: number; y: number }[]) => T,
    forceRefresh = false
  ): T => {
    return connectionCacheRef.current.get(
      [parentId, childIds, parentPos, childPositions],
      () => computeFn(parentId, childIds, parentPos, childPositions),
      forceRefresh
    ) as T;
  }, []);

  // 全キャッシュクリア
  const clearAllCaches = useCallback(() => {
    layoutCacheRef.current.clear();
    geometryCacheRef.current.clear();
    connectionCacheRef.current.clear();
  }, []);

  // 統計情報の取得
  const getCacheStats = useCallback(() => {
    return {
      layout: layoutCacheRef.current.getStats(),
      geometry: geometryCacheRef.current.getStats(),
      connections: connectionCacheRef.current.getStats()
    };
  }, []);

  // キャッシュサイズの取得
  const getCacheSizes = useCallback(() => {
    return {
      layout: layoutCacheRef.current.size(),
      geometry: geometryCacheRef.current.size(),
      connections: connectionCacheRef.current.size()
    };
  }, []);

  return {
    getCachedLayout,
    getCachedGeometry,
    getCachedConnections,
    clearAllCaches,
    getCacheStats,
    getCacheSizes
  };
};