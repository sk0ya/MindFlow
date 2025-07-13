import React, { useState } from 'react';
import { useAppInitialization } from './StorageSelection/core/hooks/useAppInitialization';
import { StorageModeSelector } from './StorageSelection/ui/components/storage/StorageModeSelector';
import { AuthProvider } from './Local/components/auth';

// Dynamic import for Local mode with storage configuration
const LocalMindMapApp = React.lazy(() => import('./Local'));

const App: React.FC = () => {
  const { storageMode, isInitialized, changeStorageMode } = useAppInitialization();
  const [selectedStorageMode, setSelectedStorageMode] = useState<'local' | 'cloud' | 'hybrid'>('local');

  // Sync selectedStorageMode with the actual storageMode
  React.useEffect(() => {
    if (storageMode) {
      setSelectedStorageMode(storageMode as 'local' | 'cloud' | 'hybrid');
    }
  }, [storageMode]);

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Show storage mode selector if no mode is set
  if (!storageMode) {
    return (
      <StorageModeSelector
        currentMode={selectedStorageMode}
        onModeChange={(mode: string) => {
          const validModes = ['local', 'cloud', 'hybrid'];
          if (validModes.includes(mode)) {
            setSelectedStorageMode(mode as 'local' | 'cloud' | 'hybrid');
            changeStorageMode(mode as 'local' | 'cloud' | 'hybrid');
          } else {
            console.warn(`Storage mode "${mode}" is not supported. Using local mode.`);
            setSelectedStorageMode('local');
            changeStorageMode('local');
          }
        }}
      />
    );
  }

  // Use Local architecture with appropriate storage configuration
  // Wrap cloud/hybrid modes with AuthProvider
  const AppContent = (
    <React.Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading MindFlow...</div>
      </div>
    }>
      <LocalMindMapApp 
        storageMode={selectedStorageMode} 
        onModeChange={(mode: string) => {
          const validModes = ['local', 'cloud', 'hybrid'];
          if (validModes.includes(mode)) {
            setSelectedStorageMode(mode as 'local' | 'cloud' | 'hybrid');
            changeStorageMode(mode as any);
          }
        }}
      />
    </React.Suspense>
  );

  // Wrap with AuthProvider for cloud/hybrid modes
  if (selectedStorageMode === 'cloud' || selectedStorageMode === 'hybrid') {
    return (
      <AuthProvider>
        {AppContent}
      </AuthProvider>
    );
  }

  return AppContent;
};

export default App;