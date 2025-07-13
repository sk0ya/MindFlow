/**
 * Vite environment utilities
 * Provides compatibility between Vite (import.meta.env) and Node.js (process.env)
 */

export const isDevelopment = (): boolean => {
  // For Vite (browser environment)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.DEV || import.meta.env.MODE === 'development';
  }
  
  // For Node.js environment (tests, build scripts)
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV === 'development';
  }
  
  // Default to production for safety
  return false;
};

export const isProduction = (): boolean => {
  // For Vite (browser environment)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.PROD || import.meta.env.MODE === 'production';
  }
  
  // For Node.js environment (tests, build scripts)
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV === 'production';
  }
  
  // Default to production for safety
  return true;
};

export const getMode = (): string => {
  // For Vite (browser environment)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.MODE || 'production';
  }
  
  // For Node.js environment (tests, build scripts)
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV || 'production';
  }
  
  return 'production';
};