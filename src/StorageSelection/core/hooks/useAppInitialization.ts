import { useState, useEffect } from 'react';
import { StorageManager } from '../storage/StorageManager';
import type { StorageMode } from '../storage/types';

export function useAppInitialization() {
  const [storageMode, setStorageMode] = useState<StorageMode | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const mode = StorageManager.getStorageMode() as StorageMode | null;
    setStorageMode(mode);
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