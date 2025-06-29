/**
 * Optimized callback hooks to prevent unnecessary re-renders
 * Provides memoized callbacks with dependency tracking
 */

import { useCallback, useMemo, useRef, useEffect } from 'react';

// Hook to create stable callbacks that only change when dependencies change
export const useStableCallback = <T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T => {
  const callbackRef = useRef<T>(callback);
  const depsRef = useRef<React.DependencyList>(deps);

  // Update callback if dependencies changed
  const depsChanged = useMemo(() => {
    if (depsRef.current.length !== deps.length) return true;
    return deps.some((dep, index) => dep !== depsRef.current[index]);
  }, deps);

  if (depsChanged) {
    callbackRef.current = callback;
    depsRef.current = deps;
  }

  return useCallback((...args: Parameters<T>) => {
    return callbackRef.current(...args);
  }, []) as T;
};

// Hook for memoized event handlers
export const useEventHandler = <T extends Event>(
  handler: (event: T) => void,
  deps: React.DependencyList = []
) => {
  return useCallback(
    (event: T) => {
      event.preventDefault();
      handler(event);
    },
    deps
  );
};

// Hook for debounced callbacks
export const useDebouncedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay, ...deps]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback as T;
};

// Hook for throttled callbacks
export const useThrottledCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T => {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;
      
      if (timeSinceLastCall >= delay) {
        lastCallRef.current = now;
        callback(...args);
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          callback(...args);
        }, delay - timeSinceLastCall);
      }
    },
    [callback, delay, ...deps]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback as T;
};

// Hook for memoized objects
export const useStableObject = <T extends Record<string, any>>(
  factory: () => T,
  deps: React.DependencyList
): T => {
  return useMemo(factory, deps);
};

// Hook for memoized arrays
export const useStableArray = <T>(
  factory: () => T[],
  deps: React.DependencyList
): T[] => {
  return useMemo(factory, deps);
};

// Hook for expensive computations with caching
export const useExpensiveValue = <T>(
  computeValue: () => T,
  deps: React.DependencyList,
  options?: {
    enableCache?: boolean;
    cacheKey?: string;
    maxCacheSize?: number;
  }
): T => {
  const { enableCache = true, cacheKey, maxCacheSize = 10 } = options || {};
  const cacheRef = useRef<Map<string, { value: T; deps: React.DependencyList }>>(new Map());
  
  return useMemo(() => {
    if (!enableCache || !cacheKey) {
      return computeValue();
    }

    const cached = cacheRef.current.get(cacheKey);
    
    // Check if cached value is still valid
    if (cached && cached.deps.length === deps.length) {
      const depsEqual = deps.every((dep, index) => dep === cached.deps[index]);
      if (depsEqual) {
        return cached.value;
      }
    }

    // Compute new value
    const newValue = computeValue();
    
    // Update cache
    cacheRef.current.set(cacheKey, { value: newValue, deps: [...deps] });
    
    // Limit cache size
    if (cacheRef.current.size > maxCacheSize) {
      const firstKey = cacheRef.current.keys().next().value;
      cacheRef.current.delete(firstKey);
    }
    
    return newValue;
  }, deps);
};

// Hook for preventing unnecessary re-renders of child components
export const useChildrenMemo = (
  children: React.ReactNode,
  deps: React.DependencyList
): React.ReactNode => {
  return useMemo(() => children, deps);
};

// Hook for optimized state updates
export const useOptimizedState = <T>(
  initialState: T,
  compareFn?: (prev: T, next: T) => boolean
) => {
  const [state, setState] = React.useState<T>(initialState);
  const stateRef = useRef<T>(initialState);
  
  const optimizedSetState = useCallback((newState: T | ((prev: T) => T)) => {
    const nextState = typeof newState === 'function' 
      ? (newState as (prev: T) => T)(stateRef.current)
      : newState;
    
    const shouldUpdate = compareFn 
      ? !compareFn(stateRef.current, nextState)
      : stateRef.current !== nextState;
    
    if (shouldUpdate) {
      stateRef.current = nextState;
      setState(nextState);
    }
  }, [compareFn]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  
  return [state, optimizedSetState] as const;
};

// Hook for managing multiple callbacks efficiently
export const useCallbackGroup = <T extends Record<string, (...args: any[]) => any>>(
  callbacks: T,
  deps: React.DependencyList
): T => {
  return useMemo(() => {
    const memoizedCallbacks = {} as T;
    
    for (const [key, callback] of Object.entries(callbacks)) {
      memoizedCallbacks[key as keyof T] = callback;
    }
    
    return memoizedCallbacks;
  }, deps);
};

// Hook for ref callbacks that don't cause re-renders
export const useRefCallback = <T>(
  callback: (node: T | null) => void
) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  
  return useCallback((node: T | null) => {
    callbackRef.current(node);
  }, []);
};

// Hook for intersection observer with performance optimization
export const useIntersectionObserver = (
  options?: IntersectionObserverInit,
  threshold: number = 0.1
) => {
  const [isIntersecting, setIsIntersecting] = React.useState(false);
  const [entry, setEntry] = React.useState<IntersectionObserverEntry | null>(null);
  
  const ref = useRefCallback<Element>((node) => {
    if (!node) return;
    
    const observer = new IntersectionObserver(
      ([observerEntry]) => {
        setIsIntersecting(observerEntry.isIntersecting);
        setEntry(observerEntry);
      },
      { threshold, ...options }
    );
    
    observer.observe(node);
    
    return () => {
      observer.disconnect();
    };
  });
  
  return { ref, isIntersecting, entry };
};

// Hook for window resize with performance optimization
export const useOptimizedResize = (
  handler: (size: { width: number; height: number }) => void,
  delay: number = 250
) => {
  const throttledHandler = useThrottledCallback(
    () => {
      handler({
        width: window.innerWidth,
        height: window.innerHeight
      });
    },
    delay
  );

  useEffect(() => {
    window.addEventListener('resize', throttledHandler);
    
    // Call once initially
    throttledHandler();
    
    return () => {
      window.removeEventListener('resize', throttledHandler);
    };
  }, [throttledHandler]);
};