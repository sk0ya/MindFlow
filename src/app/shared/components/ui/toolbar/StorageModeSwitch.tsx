import React, { useState } from 'react';

interface StorageModeSwitchProps {
  currentMode: 'local' | 'cloud';
  onModeChange: (mode: 'local' | 'cloud') => void;
}

const STORAGE_MODES = [
  { id: 'local' as const, label: 'ローカル', icon: '💾', description: 'このデバイスのみ' },
  { id: 'cloud' as const, label: 'クラウド', icon: '☁️', description: 'デバイス間同期' }
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
      <button
        className="storage-mode-button"
        onClick={() => setIsOpen(!isOpen)}
        title={`現在のモード: ${currentModeInfo?.label} - ${currentModeInfo?.description}`}
      >
        <span className="storage-mode-icon">{currentModeInfo?.icon}</span>
        <span className="storage-mode-label">{currentModeInfo?.label}</span>
        <span className="storage-mode-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

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
              {currentMode === mode.id && <span className="mode-check">✓</span>}
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
          background: rgba(51, 65, 85, 0.08);
          border: 1px solid rgba(51, 65, 85, 0.12);
          border-radius: 8px;
          color: #374151;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .storage-mode-button:hover {
          background: rgba(51, 65, 85, 0.12);
          border-color: rgba(51, 65, 85, 0.2);
          color: #1f2937;
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
          background: rgba(30, 41, 59, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          backdrop-filter: blur(20px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          z-index: 1000;
          min-width: 200px;
          overflow: hidden;
        }

        .storage-mode-option {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          width: 100%;
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          transition: background-color 0.2s ease;
          text-align: left;
        }

        .storage-mode-option:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .storage-mode-option.active {
          background: rgba(59, 130, 246, 0.2);
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
          color: #10b981;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default StorageModeSwitch;