import { useState, useEffect } from 'react';
import { StorageManager } from '../storage/StorageManager';
import type { StorageMode } from '../storage/types';

export function useAppInitialization() {
  const [storageMode, setStorageMode] = useState<StorageMode | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Check if there's a magic link token in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const magicLinkToken = urlParams.get('token');
    
    if (magicLinkToken) {
      // If there's a magic link token, force cloud mode
      console.log('🔗 Magic link detected, switching to cloud mode');
      StorageManager.setStorageMode('cloud');
      setStorageMode('cloud');
    } else {
      // Otherwise, use the saved storage mode
      const mode = StorageManager.getStorageMode() as StorageMode | null;
      setStorageMode(mode);
    }
    
    setIsInitialized(true);
  }, []);

  const changeStorageMode = (mode: StorageMode) => {
    StorageManager.setStorageMode(mode);
    setStorageMode(mode);
  };

  return {
    storageMode,
    isInitialized,
    changeStorageMode
  };
}