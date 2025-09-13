import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Check, HardDrive, Cloud } from 'lucide-react';
import { ShortcutTooltip } from '../KeyboardShortcutHelper';

interface StorageModeSwitchProps {
  currentMode: 'local' | 'cloud';
  onModeChange: (mode: 'local' | 'cloud') => void;
}

const STORAGE_MODES = [
  { id: 'local' as const, label: 'ローカル', icon: <HardDrive size={16} />, description: 'このデバイスのみ' },
  { id: 'cloud' as const, label: 'クラウド', icon: <Cloud size={16} />, description: 'デバイス間同期' }
];

const StorageModeSwitch: React.FC<StorageModeSwitchProps> = ({
  currentMode,
  onModeChange
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const currentModeInfo = STORAGE_MODES.find(mode => mode.id === currentMode);

  const handleModeSelect = (mode: 'local' | 'cloud') => {
    onModeChange(mode);
    setIsOpen(false);
  };

  return (
    <div className="storage-mode-switch">
      <ShortcutTooltip description={`現在のモード: ${currentModeInfo?.label} - ${currentModeInfo?.description}`}>
        <button
          className="storage-mode-button"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="storage-mode-icon">{currentModeInfo?.icon}</span>
          <span className="storage-mode-label">{currentModeInfo?.label}</span>
          <span className="storage-mode-arrow">{isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
        </button>
      </ShortcutTooltip>

      {isOpen && (
        <div className="storage-mode-dropdown">
          {STORAGE_MODES.map((mode) => (
            <button
              key={mode.id}
              className={`storage-mode-option ${currentMode === mode.id ? 'active' : ''}`}
              onClick={() => handleModeSelect(mode.id)}
            >
              <span className="mode-icon">{mode.icon}</span>
              <div className="mode-info">
                <div className="mode-label">{mode.label}</div>
                <div className="mode-description">{mode.description}</div>
              </div>
              {currentMode === mode.id && <span className="mode-check"><Check size={16} /></span>}
            </button>
          ))}
        </div>
      )}

      <style>{`
        .storage-mode-switch {
          position: relative;
          display: inline-block;
        }

        .storage-mode-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: #f5f5f5;
          border: 1px solid #cccccc;
          border-radius: 6px;
          color: #666666;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .storage-mode-button:hover {
          background: #eeeeee;
          border-color: #aaaaaa;
          color: #333333;
        }

        [data-theme="dark"] .storage-mode-button {
          background: #333333;
          border: 1px solid #555555;
          color: #cccccc;
        }

        [data-theme="dark"] .storage-mode-button:hover {
          background: #444444;
          border-color: #777777;
          color: #ffffff;
        }

        .storage-mode-icon {
          font-size: 1rem;
        }

        .storage-mode-label {
          font-weight: 500;
        }

        .storage-mode-arrow {
          font-size: 0.75rem;
          opacity: 0.7;
          margin-left: 0.25rem;
        }

        .storage-mode-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 0.5rem;
          background: #ffffff;
          border: 1px solid #cccccc;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          min-width: 200px;
          overflow: hidden;
        }

        [data-theme="dark"] .storage-mode-dropdown {
          background: #2a2a2a;
          border: 1px solid #555555;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .storage-mode-option {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          width: 100%;
          background: none;
          border: none;
          color: #333333;
          cursor: pointer;
          transition: background-color 0.2s ease;
          text-align: left;
        }

        [data-theme="dark"] .storage-mode-option {
          color: #ffffff;
        }

        .storage-mode-option:hover {
          background: #f0f0f0;
        }

        [data-theme="dark"] .storage-mode-option:hover {
          background: #444444;
        }

        .storage-mode-option.active {
          background: #e5e5e5;
        }

        [data-theme="dark"] .storage-mode-option.active {
          background: #555555;
        }

        .mode-icon {
          font-size: 1.25rem;
          min-width: 1.5rem;
        }

        .mode-info {
          flex: 1;
        }

        .mode-label {
          font-weight: 500;
          font-size: 0.875rem;
        }

        .mode-description {
          font-size: 0.75rem;
          opacity: 0.7;
          margin-top: 0.125rem;
        }

        .mode-check {
          color: #666666;
          font-weight: bold;
        }

        [data-theme="dark"] .mode-check {
          color: #cccccc;
        }
      `}</style>
    </div>
  );
};

export default StorageModeSwitch;