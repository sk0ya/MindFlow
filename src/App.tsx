import React from 'react';
import { useAppInitialization } from './StorageSelection/core/hooks/useAppInitialization';
import { StorageModeSelector } from './StorageSelection/ui/components/storage/StorageModeSelector';
import { AuthProvider } from './Cloud/hooks/useAuth';

// Dynamic imports for both Local and Cloud modes
const LocalMindMapApp = React.lazy(() => import('./Local/features/mindmap/components/MindMapApp'));
const CloudMindMapApp = React.lazy(() => import('./Cloud/components/MindMapApp'));

const App: React.FC = () => {
  const { storageMode, isInitialized, changeStorageMode } = useAppInitialization();

  if (!isInitialized) {
    return <div>Loading...</div>;
  }

  // Show storage mode selector if no mode is set
  if (!storageMode) {
    return (
      <StorageModeSelector
        currentMode={'local'} // デフォルト選択
        onModeChange={changeStorageMode}
      />
    );
  }

  // Support both local and cloud storage modes
  if (storageMode === 'cloud') {
    return (
      <AuthProvider>
        <React.Suspense fallback={<div>Loading...</div>}>
          <CloudMindMapApp onModeChange={changeStorageMode} />
        </React.Suspense>
      </AuthProvider>
    );
  }

  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <LocalMindMapApp />
    </React.Suspense>
  );
};

export default App;