/**
 * Memoization utilities for React components and functions
 */

import React from 'react';

// Deep comparison function for complex objects
export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  
  if (a == null || b == null) return a === b;
  
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
  }
  
  return true;
};

// Shallow comparison function for simple objects
export const shallowEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  
  if (a == null || b == null) return a === b;
  
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) return false;
  }
  
  return true;
};

// Array comparison for dependency arrays
export const arrayEqual = (a: unknown[], b: unknown[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
};

// Memoize a React component with custom comparison
export const memoComponent = <P extends object>(
  Component: React.ComponentType<P>,
  propsAreEqual?: (prevProps: P, nextProps: P) => boolean
) => {
  return React.memo(Component, propsAreEqual);
};

// Memoize a React component with deep comparison
export const deepMemoComponent = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return React.memo(Component, (prevProps, nextProps) => 
    deepEqual(prevProps, nextProps)
  );
};

// Memoize a React component with shallow comparison
export const shallowMemoComponent = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return React.memo(Component, (prevProps, nextProps) => 
    shallowEqual(prevProps, nextProps)
  );
};

// Function memoization with LRU cache
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Memoize function with LRU cache
export const memoizeFunction = <Args extends unknown[], Return>(
  fn: (...args: Args) => Return,
  options?: {
    cacheSize?: number;
    keyGenerator?: (...args: Args) => string;
    equalityCheck?: (a: Args, b: Args) => boolean;
  }
) => {
  const { 
    cacheSize = 50, 
    keyGenerator = (...args: Args) => JSON.stringify(args),
    equalityCheck: _equalityCheck = arrayEqual
  } = options || {};
  
  const cache = new LRUCache<string, Return>(cacheSize);
  
  return (...args: Args): Return => {
    const key = keyGenerator(...args);
    
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    
    return result;
  };
};

// Memoize async function
export const memoizeAsync = <Args extends unknown[], Return>(
  fn: (...args: Args) => Promise<Return>,
  options?: {
    cacheSize?: number;
    keyGenerator?: (...args: Args) => string;
    ttl?: number; // Time to live in milliseconds
  }
) => {
  const { 
    cacheSize = 50, 
    keyGenerator = (...args: Args) => JSON.stringify(args),
    ttl = 5 * 60 * 1000 // 5 minutes default
  } = options || {};
  
  const cache = new Map<string, { 
    promise: Promise<Return>; 
    timestamp: number; 
  }>();
  
  return async (...args: Args): Promise<Return> => {
    const key = keyGenerator(...args);
    const now = Date.now();
    
    const cached = cache.get(key);
    if (cached && (now - cached.timestamp) < ttl) {
      return cached.promise;
    }
    
    const promise = fn(...args);
    cache.set(key, { promise, timestamp: now });
    
    // Clean up expired entries
    if (cache.size > cacheSize) {
      for (const [cacheKey, entry] of cache.entries()) {
        if ((now - entry.timestamp) >= ttl) {
          cache.delete(cacheKey);
        }
      }
    }
    
    try {
      const result = await promise;
      return result;
    } catch (error) {
      // Remove failed promises from cache
      cache.delete(key);
      throw error;
    }
  };
};

// Selector memoization for derived state
export const createSelector = <State, Result>(
  selector: (state: State) => Result,
  equalityFn: (a: Result, b: Result) => boolean = Object.is
) => {
  let lastState: State;
  let lastResult: Result;
  let hasRun = false;
  
  return (state: State): Result => {
    if (!hasRun || state !== lastState) {
      const newResult = selector(state);
      
      if (!hasRun || !equalityFn(lastResult, newResult)) {
        lastResult = newResult;
      }
      
      lastState = state;
      hasRun = true;
    }
    
    return lastResult;
  };
};

// Create multiple selectors with shared memoization
export const createStructuredSelector = <State, Selectors extends Record<string, (state: State) => unknown>>(
  selectors: Selectors
): (state: State) => { [K in keyof Selectors]: ReturnType<Selectors[K]> } => {
  const selectorKeys = Object.keys(selectors) as Array<keyof Selectors>;
  const memoizedSelectors = selectorKeys.reduce((acc, key) => {
    acc[key] = createSelector(selectors[key]) as (state: State) => ReturnType<Selectors[typeof key]>;
    return acc;
  }, {} as { [K in keyof Selectors]: (state: State) => ReturnType<Selectors[K]> });
  
  return createSelector((state: State) => {
    const result = {} as { [K in keyof Selectors]: ReturnType<Selectors[K]> };
    
    for (const key of selectorKeys) {
      result[key] = memoizedSelectors[key](state);
    }
    
    return result;
  }, shallowEqual);
};