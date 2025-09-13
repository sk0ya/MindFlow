import React from 'react';
import { logger } from '../../../../shared/utils/logger';
import type { StorageConfig } from '../../../../core/storage/types';

interface AuthenticationManagerProps {
  storageMode: 'local' | 'cloud';
  auth: any;
  setShowLoginModal: (show: boolean) => void;
  setResetKey: (key: number | ((prev: number) => number)) => void;
  onModeChange?: (mode: 'local' | 'cloud') => void;
}

export const useAuthenticationManager = ({
  storageMode,
  auth,
  setShowLoginModal,
  setResetKey,
  onModeChange,
}: AuthenticationManagerProps) => {
  
  // For cloud mode, check if user is authenticated
  const isCloudMode = storageMode === 'cloud';
  const needsAuth = isCloudMode && auth && !auth.authState.isAuthenticated;
  
  // Show login modal when cloud mode requires auth
  React.useEffect(() => {
    logger.debug('Auth check:', {
      isCloudMode,
      hasAuth: !!auth,
      authIsReady: auth?.isReady,
      isAuthenticated: auth?.authState.isAuthenticated,
      needsAuth
    });

    if (needsAuth && auth?.isReady) {
      logger.info('Showing login modal');
      setShowLoginModal(true);
    } else if (isCloudMode && auth?.authState.isAuthenticated) {
      logger.info('User authenticated, hiding login modal');
      setShowLoginModal(false);
    }
  }, [needsAuth, auth?.isReady, auth?.authState.isAuthenticated, isCloudMode, setShowLoginModal, auth]);

  // Force data reload when authentication status changes in cloud mode
  React.useEffect(() => {
    if (isCloudMode && auth?.authState.isAuthenticated && auth?.isReady) {
      logger.info('🔄 Authentication successful in cloud mode, forcing data reload');
      // Increment reset key to force useMindMap to reinitialize with new auth context
      setResetKey(prev => prev + 1);
    }
  }, [isCloudMode, auth?.authState.isAuthenticated, auth?.isReady, setResetKey]);

  // Handle mode changes - reset modal state when switching to cloud mode
  React.useEffect(() => {
    if (isCloudMode && auth && !auth.authState.isAuthenticated && auth.isReady) {
      logger.info('Mode switched to cloud, user not authenticated');
      setShowLoginModal(true);
    } else if (!isCloudMode) {
      logger.info('Mode switched to local, hiding login modal');
      setShowLoginModal(false);
    }
  }, [storageMode, isCloudMode, auth?.authState.isAuthenticated, auth?.isReady, auth, setShowLoginModal]);

  // Create storage configuration based on selected mode
  const storageConfig: StorageConfig = React.useMemo(() => {
    const authAdapter = auth?.authAdapter;
    
    let config: StorageConfig;
    switch (storageMode) {
      case 'local':
        config = { mode: 'local' };
        break;
      case 'cloud':
        if (authAdapter) {
          config = { mode: 'cloud', authAdapter };
        } else {
          // Auth adapter not available, fall back to local mode
          logger.warn('Cloud mode requested but auth adapter not available, falling back to local mode');
          config = { mode: 'local' };
        }
        break;
      default:
        config = { mode: 'local' };
        break;
    }
    
    return config;
  }, [storageMode, auth?.authAdapter]);

  const handleLoginModalClose = React.useCallback(() => {
    logger.info('Login modal closed, switching to local mode');
    setShowLoginModal(false);
    // Switch back to local mode when user cancels login
    if (onModeChange) {
      onModeChange('local');
    }
  }, [setShowLoginModal, onModeChange]);

  // Loading states
  const isAuthInitializing = isCloudMode && auth && !auth.isReady;
  
  return {
    isCloudMode,
    needsAuth,
    isAuthInitializing,
    storageConfig,
    authAdapter: auth?.authAdapter,
    handleLoginModalClose,
  };
};