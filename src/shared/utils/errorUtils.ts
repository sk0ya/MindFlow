/**
 * Error handling utilities for safe operations
 * Provides consistent error handling patterns across the application
 */

import type { AppError } from '../types/core';

/**
 * Result type for safe operations
 */
export type Result<T, E = string> = 
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Create a standardized app error
 */
export const createAppError = (
  code: string,
  message: string,
  severity: AppError['severity'] = 'medium',
  context?: Record<string, unknown>
): AppError => ({
  code,
  message,
  severity,
  context,
  timestamp: new Date().toISOString()
});

/**
 * Safe wrapper for operations that might throw
 * Preserves existing functionality while adding error safety
 */
export const safeOperation = <T>(
  operation: () => T,
  errorMessage = 'Operation failed'
): Result<T> => {
  try {
    const result = operation();
    return { success: true, data: result };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : errorMessage;
    console.error(errorMessage, error);
    return { success: false, error: errorMsg };
  }
};

/**
 * Safe wrapper for async operations
 */
export const safeAsyncOperation = async <T>(
  operation: () => Promise<T>,
  errorMessage = 'Async operation failed'
): Promise<Result<T>> => {
  try {
    const result = await operation();
    return { success: true, data: result };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : errorMessage;
    console.error(errorMessage, error);
    return { success: false, error: errorMsg };
  }
};

/**
 * Log errors with context for debugging
 * Enhanced version of existing console.error usage
 */
export const logError = (
  message: string,
  error?: unknown,
  context?: Record<string, unknown>
): void => {
  const timestamp = new Date().toISOString();
  const logContext = {
    timestamp,
    ...context
  };
  
  console.error(`[${timestamp}] ${message}`, {
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error,
    context: logContext
  });
};

/**
 * Validate and sanitize user input
 * Enhanced version of existing validation logic
 */
export const validateInput = (
  value: unknown,
  type: 'string' | 'number' | 'boolean',
  options?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  }
): Result<unknown> => {
  const { required = true, minLength, maxLength, min, max } = options || {};
  
  if (required && (value === null || value === undefined)) {
    return { success: false, error: 'Value is required' };
  }
  
  if (!required && (value === null || value === undefined)) {
    return { success: true, data: value };
  }
  
  switch (type) {
    case 'string':
      if (typeof value !== 'string') {
        return { success: false, error: 'Value must be a string' };
      }
      if (minLength !== undefined && value.length < minLength) {
        return { success: false, error: `Value must be at least ${minLength} characters` };
      }
      if (maxLength !== undefined && value.length > maxLength) {
        return { success: false, error: `Value must be no more than ${maxLength} characters` };
      }
      break;
      
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return { success: false, error: 'Value must be a number' };
      }
      if (min !== undefined && value < min) {
        return { success: false, error: `Value must be at least ${min}` };
      }
      if (max !== undefined && value > max) {
        return { success: false, error: `Value must be no more than ${max}` };
      }
      break;
      
    case 'boolean':
      if (typeof value !== 'boolean') {
        return { success: false, error: 'Value must be a boolean' };
      }
      break;
      
    default:
      return { success: false, error: 'Invalid validation type' };
  }
  
  return { success: true, data: value };
};

/**
 * Debounce function to prevent excessive operations
 * Useful for auto-save and other frequent operations
 */
export const debounce = <T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
};

/**
 * Throttle function to limit operation frequency
 */
export const throttle = <T extends (...args: unknown[]) => void>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Create a safe localStorage wrapper
 * Handles quota exceeded and other storage errors gracefully
 */
export const safeLocalStorage = {
  getItem: (key: string): Result<string | null> => {
    return safeOperation(
      () => localStorage.getItem(key),
      `Failed to read from localStorage: ${key}`
    );
  },
  
  setItem: (key: string, value: string): Result<void> => {
    return safeOperation(
      () => localStorage.setItem(key, value),
      `Failed to write to localStorage: ${key}`
    );
  },
  
  removeItem: (key: string): Result<void> => {
    return safeOperation(
      () => localStorage.removeItem(key),
      `Failed to remove from localStorage: ${key}`
    );
  }
};

/**
 * Performance monitoring utilities
 */
export const performanceUtils = {
  /**
   * Measure execution time of a function
   */
  measureTime: <T>(operation: () => T, label?: string): { result: T; duration: number } => {
    const start = performance.now();
    const result = operation();
    const duration = performance.now() - start;
    
    if (label) {
      console.log(`${label}: ${duration.toFixed(2)}ms`);
    }
    
    return { result, duration };
  },
  
  /**
   * Measure async operation time
   */
  measureAsyncTime: async <T>(
    operation: () => Promise<T>, 
    label?: string
  ): Promise<{ result: T; duration: number }> => {
    const start = performance.now();
    const result = await operation();
    const duration = performance.now() - start;
    
    if (label) {
      console.log(`${label}: ${duration.toFixed(2)}ms`);
    }
    
    return { result, duration };
  }
};