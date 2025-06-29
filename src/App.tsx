import React, { useState, useEffect } from 'react';
import CloudApp from './Cloud/components/MindMapApp';
import LocalApp from './Local/components/MindMapApp';

type StorageMode = 'local' | 'cloud';

const App: React.FC = () => {
  const [storageMode, setStorageMode] = useState<StorageMode | null>(null);

  useEffect(() => {
    const savedMode = localStorage.getItem('storage_mode') as StorageMode;
    setStorageMode(savedMode || 'local');
  }, []);

  const handleModeChange = (mode: StorageMode) => {
    localStorage.setItem('storage_mode', mode);
    setStorageMode(mode);
  };

  if (!storageMode) {
    return <div>Loading...</div>;
  }

  if (storageMode === 'cloud') {
    return <CloudApp onModeChange={handleModeChange} />;
  }

  return <LocalApp onModeChange={handleModeChange} />;
};

export default App;