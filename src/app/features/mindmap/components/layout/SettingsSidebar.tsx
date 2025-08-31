import React from 'react';

interface SettingsSidebarProps {
  storageMode?: 'local' | 'cloud';
  onStorageModeChange?: (mode: 'local' | 'cloud') => void;
  onShowKeyboardHelper?: () => void;
  onAutoLayout?: () => void;
  onExport?: () => void;
  onImport?: () => void;
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  storageMode,
  onStorageModeChange,
  onShowKeyboardHelper,
  onAutoLayout,
  onExport,
  onImport
}) => {
  return (
    <div className="settings-sidebar">
      <div className="settings-section">
        <h3 className="settings-section-title">ストレージモード</h3>
        <div className="settings-section-content">
          <div className="storage-mode-selector">
            <label className="storage-mode-option">
              <input
                type="radio"
                name="storageMode"
                value="local"
                checked={storageMode === 'local'}
                onChange={() => onStorageModeChange?.('local')}
              />
              <span className="storage-mode-label">
                <span className="storage-mode-icon">💾</span>
                ローカル
              </span>
            </label>
            <label className="storage-mode-option">
              <input
                type="radio"
                name="storageMode"
                value="cloud"
                checked={storageMode === 'cloud'}
                onChange={() => onStorageModeChange?.('cloud')}
              />
              <span className="storage-mode-label">
                <span className="storage-mode-icon">☁️</span>
                クラウド
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">レイアウト</h3>
        <div className="settings-section-content">
          <button 
            className="settings-button"
            onClick={onAutoLayout}
            title="マインドマップのレイアウトを自動調整します"
          >
            <span className="settings-button-icon">🎯</span>
            自動整列
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">インポート・エクスポート</h3>
        <div className="settings-section-content">
          <button 
            className="settings-button"
            onClick={onImport}
            title="Markdownファイルからマインドマップをインポート"
          >
            <span className="settings-button-icon">📥</span>
            インポート
          </button>
          <button 
            className="settings-button"
            onClick={onExport}
            title="マインドマップをエクスポート"
          >
            <span className="settings-button-icon">📤</span>
            エクスポート
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">ヘルプ</h3>
        <div className="settings-section-content">
          <button 
            className="settings-button"
            onClick={onShowKeyboardHelper}
            title="キーボードショートカットを表示"
          >
            <span className="settings-button-icon">⌨️</span>
            ショートカット一覧
          </button>
        </div>
      </div>

      <style>{`
        .settings-sidebar {
          padding: 16px;
          overflow-y: auto;
        }

        .settings-section {
          margin-bottom: 24px;
        }

        .settings-section-title {
          font-size: 12px;
          font-weight: 600;
          color: #cccccc;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 12px 0;
          padding-bottom: 8px;
          border-bottom: 1px solid #3e3e42;
        }

        .settings-section-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .storage-mode-selector {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .storage-mode-option {
          display: flex;
          align-items: center;
          padding: 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .storage-mode-option:hover {
          background-color: #2d2d30;
        }

        .storage-mode-option input[type="radio"] {
          margin-right: 8px;
          accent-color: #007acc;
        }

        .storage-mode-label {
          display: flex;
          align-items: center;
          color: #cccccc;
          font-size: 14px;
        }

        .storage-mode-icon {
          margin-right: 8px;
        }

        .settings-button {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background: none;
          border: 1px solid #464647;
          border-radius: 4px;
          color: #cccccc;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }

        .settings-button:hover {
          background-color: #2d2d30;
          border-color: #007acc;
          color: #ffffff;
        }

        .settings-button-icon {
          margin-right: 8px;
        }

        @media (prefers-color-scheme: light) {
          .settings-section-title {
            color: #333333;
            border-bottom: 1px solid #e5e5e5;
          }

          .storage-mode-option:hover {
            background-color: #f0f0f0;
          }

          .storage-mode-label {
            color: #333333;
          }

          .settings-button {
            color: #333333;
            border-color: #d1d1d1;
          }

          .settings-button:hover {
            background-color: #f0f0f0;
            border-color: #007acc;
          }
        }
      `}</style>
    </div>
  );
};

export default SettingsSidebar;