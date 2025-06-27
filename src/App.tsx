import React from 'react';
import { useAppInitialization } from './StorageSelection/core/hooks/useAppInitialization';
import { StorageModeSelector } from './StorageSelection/ui/components/storage/StorageModeSelector';

// Dynamic import for Local MindMapApp only
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

  // Only support local storage mode now
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <LocalMindMapApp />
    </React.Suspense>
  );
};

export default App;
