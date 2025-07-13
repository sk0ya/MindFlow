import React, { useState, useEffect } from 'react';
import { AuthProvider } from './Local/components/auth';

// Dynamic import for Local mode with storage configuration
const LocalMindMapApp = React.lazy(() => import('./Local'));

type StorageMode = 'local' | 'cloud' | 'hybrid';

const App: React.FC = () => {
  const [storageMode, setStorageMode] = useState<StorageMode>('local');

  // Check for magic link token to switch to cloud mode
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const magicLinkToken = urlParams.get('token');
    
    if (magicLinkToken) {
      console.log('🔗 Magic link detected, switching to cloud mode');
      setStorageMode('cloud');
    } else {
      // Load saved mode from localStorage, default to local
      const savedMode = localStorage.getItem('mindflow_storage_mode') as StorageMode;
      if (savedMode && ['local', 'cloud', 'hybrid'].includes(savedMode)) {
        setStorageMode(savedMode);
      }
    }
  }, []);

  // Save mode changes to localStorage
  const handleModeChange = (mode: StorageMode) => {
    setStorageMode(mode);
    localStorage.setItem('mindflow_storage_mode', mode);
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
      />
    </React.Suspense>
  );

  // Wrap with AuthProvider for cloud/hybrid modes
  if (storageMode === 'cloud' || storageMode === 'hybrid') {
    return (
      <AuthProvider>
        {AppContent}
      </AuthProvider>
    );
  }

  return AppContent;
};

export default App;