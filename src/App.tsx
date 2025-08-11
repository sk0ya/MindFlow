import React, { useState, useEffect } from 'react';
import { AuthProvider } from './app/components/auth';
import { logger } from './app/shared/utils/logger';

// Dynamic import for Local mode with storage configuration
const LocalMindMapApp = React.lazy(() => import('./app'));

type StorageMode = 'local' | 'cloud';

const App: React.FC = () => {
  const [storageMode, setStorageMode] = useState<StorageMode>('local');
  const [resetKey, setResetKey] = useState(0);

  // Check for magic link token to switch to cloud mode
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const magicLinkToken = urlParams.get('token');
    
    if (magicLinkToken) {
      setStorageMode('cloud');
    } else {
      // Load saved mode from localStorage, default to local
      const savedMode = localStorage.getItem('mindflow_storage_mode');
      if (savedMode && ['local', 'cloud'].includes(savedMode)) {
        setStorageMode(savedMode as StorageMode);
      }
    }
  }, []);

  // Save mode changes to localStorage
  const handleModeChange = (mode: StorageMode) => {
    logger.info('🔄 App: Storage mode change requested', {
      from: storageMode,
      to: mode
    });
    
    if (storageMode !== mode) {
      setStorageMode(mode);
      setResetKey(prev => prev + 1);
      localStorage.setItem('mindflow_storage_mode', mode);
      logger.info('✅ App: Storage mode changed and saved to localStorage, resetKey incremented');
    }
  };

  // App content with storage mode configuration
  const AppContent = (
    <React.Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading MindFlow...</div>
      </div>
    }>
      <LocalMindMapApp 
        storageMode={storageMode} 
        onModeChange={handleModeChange}
        resetKey={resetKey}
      />
    </React.Suspense>
  );

  // Wrap with AuthProvider for cloud mode
  if (storageMode === 'cloud') {
    return (
      <AuthProvider>
        {AppContent}
      </AuthProvider>
    );
  }

  return AppContent;
};

export default App;