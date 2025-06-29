/**
 * Optimized Magic Link hook with race condition prevention
 * Handles URL parsing and token verification with proper state management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuthOptimized';
import { safeAsync, errorHandler } from '../utils/errorHandling';

interface MagicLinkState {
  isProcessing: boolean;
  hasProcessed: boolean;
  error: string | null;
  token: string | null;
}

export const useMagicLinkOptimized = () => {
  const { verifyToken } = useAuth();
  const [state, setState] = useState<MagicLinkState>({
    isProcessing: false,
    hasProcessed: false,
    error: null,
    token: null
  });

  const processingRef = useRef(false);
  const processedTokens = useRef(new Set<string>());

  // Extract and validate token from URL
  const extractTokenFromUrl = useCallback((): { token: string; type: string } | null => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const type = urlParams.get('type');

      // Validate token format
      if (!token || token.length < 10) {
        return null;
      }

      // Only process authentication tokens
      if (type !== 'auth' && type !== null) {
        return null;
      }

      return { token, type: type || 'auth' };
    } catch (error) {
      console.warn('Failed to parse URL parameters:', error);
      return null;
    }
  }, []);

  // Clean URL after processing
  const cleanUrl = useCallback(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      url.searchParams.delete('type');
      
      // Only update if URL actually changed
      if (url.href !== window.location.href) {
        window.history.replaceState({}, document.title, url.href);
      }
    } catch (error) {
      console.warn('Failed to clean URL:', error);
    }
  }, []);

  // Process magic link token
  const processToken = useCallback(async (token: string): Promise<boolean> => {
    // Prevent duplicate processing
    if (processingRef.current || processedTokens.current.has(token)) {
      return false;
    }

    processingRef.current = true;
    processedTokens.current.add(token);

    setState(prev => ({
      ...prev,
      isProcessing: true,
      error: null,
      token
    }));

    const result = await safeAsync(
      async () => {
        const verifyResult = await verifyToken(token);
        
        if (!verifyResult.success) {
          throw new Error(verifyResult.error || 'Token verification failed');
        }

        return verifyResult;
      },
      { operation: 'magic_link_verify', token: token.substring(0, 10) + '...' }
    );

    processingRef.current = false;

    if (result.success) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        hasProcessed: true,
        error: null
      }));

      // Clean URL after successful verification
      cleanUrl();
      return true;
    } else {
      const errorMessage = result.error?.message || 'Magic Link verification failed';
      
      setState(prev => ({
        ...prev,
        isProcessing: false,
        hasProcessed: true,
        error: errorMessage
      }));

      errorHandler.handle(result.error || new Error(errorMessage), {
        operation: 'magic_link_verify',
        token: token.substring(0, 10) + '...'
      });

      // Clean URL even on error to prevent retry loops
      cleanUrl();
      return false;
    }
  }, [verifyToken, cleanUrl]);

  // Retry mechanism for failed attempts
  const retry = useCallback(async (): Promise<void> => {
    if (!state.token) return;

    // Remove from processed tokens to allow retry
    processedTokens.current.delete(state.token);
    
    setState(prev => ({
      ...prev,
      error: null,
      hasProcessed: false
    }));

    await processToken(state.token);
  }, [state.token, processToken]);

  // Clear error state
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Reset state
  const reset = useCallback(() => {
    processingRef.current = false;
    processedTokens.current.clear();
    setState({
      isProcessing: false,
      hasProcessed: false,
      error: null,
      token: null
    });
  }, []);

  // Main effect - process magic link on mount and URL changes
  useEffect(() => {
    const tokenData = extractTokenFromUrl();
    
    if (!tokenData) {
      // No token found, mark as processed to avoid loading states
      if (!state.hasProcessed) {
        setState(prev => ({ ...prev, hasProcessed: true }));
      }
      return;
    }

    const { token } = tokenData;

    // Skip if already processing or processed this token
    if (processingRef.current || processedTokens.current.has(token)) {
      return;
    }

    // Process the token
    processToken(token);
  }, [extractTokenFromUrl, processToken, state.hasProcessed]);

  // Listen for popstate events to handle browser navigation
  useEffect(() => {
    const handlePopState = () => {
      const tokenData = extractTokenFromUrl();
      if (tokenData && !processedTokens.current.has(tokenData.token)) {
        processToken(tokenData.token);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [extractTokenFromUrl, processToken]);

  // Auto-cleanup processed tokens after 5 minutes to prevent memory leaks
  useEffect(() => {
    const cleanup = setInterval(() => {
      if (processedTokens.current.size > 10) {
        // Keep only the 5 most recent tokens
        const tokens = Array.from(processedTokens.current);
        processedTokens.current.clear();
        tokens.slice(-5).forEach(token => processedTokens.current.add(token));
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(cleanup);
  }, []);

  return {
    isProcessing: state.isProcessing,
    hasProcessed: state.hasProcessed,
    error: state.error,
    token: state.token,
    retry,
    clearError,
    reset
  };
};

export default useMagicLinkOptimized;