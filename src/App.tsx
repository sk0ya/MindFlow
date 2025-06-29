import React from 'react';
import { useAppInitialization } from './StorageSelection/core/hooks/useAppInitialization';
import { StorageModeSelector } from './StorageSelection/ui/components/storage/StorageModeSelector';

// Dynamic imports for both Local and Cloud modes
const LocalMindMapApp = React.lazy(() => import('./Local/ui/components/mindmap/MindMapApp'));
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
      <React.Suspense fallback={<div>Loading...</div>}>
        <CloudMindMapApp onModeChange={changeStorageMode} />
      </React.Suspense>
    );
  }

  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <LocalMindMapApp />
    </React.Suspense>
  );
};

export default App;