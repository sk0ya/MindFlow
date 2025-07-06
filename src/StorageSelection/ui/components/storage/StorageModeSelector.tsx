import { StorageMode } from '../../../core/storage/types';
import './StorageModeSelector.css';

interface StorageModeSelectorProps {
  currentMode: StorageMode | null;
  onModeChange: (mode: StorageMode) => void;
}

export function StorageModeSelector({ currentMode, onModeChange }: StorageModeSelectorProps) {
  return (
    <div className="storage-mode-selector">
      <h2>ストレージモードを選択</h2>
      <div className="mode-options">
        <button
          className={`mode-option ${currentMode === 'local' ? 'active' : ''}`}
          onClick={() => onModeChange('local')}
        >
          <h3>ローカルモード</h3>
          <p>データはこのデバイスにのみ保存されます</p>
        </button>
        <button
          className={`mode-option ${currentMode === 'cloud' ? 'active' : ''}`}
          onClick={() => onModeChange('cloud')}
        >
          <h3>クラウドモード</h3>
          <p>データはクラウドに保存され、複数デバイスで同期されます</p>
        </button>
      </div>
    </div>
  );
}