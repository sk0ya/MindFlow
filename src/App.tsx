import React from 'react';
import { useAppInitialization } from './StorageSelection/core/hooks/useAppInitialization';
import { StorageModeSelector } from './StorageSelection/ui/components/storage/StorageModeSelector';

// Dynamic imports for Cloud and Local MindMapApp
const CloudMindMapApp = React.lazy(() => import('./Cloud/components/MindMapApp'));
const LocalMindMapApp = React.lazy(() => import('./Local/ui/components/mindmap/MindMapApp'));

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

  // Support both cloud and local storage modes
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      {storageMode === 'cloud' ? <CloudMindMapApp /> : <LocalMindMapApp />}
    </React.Suspense>
  );
};

export default App;
