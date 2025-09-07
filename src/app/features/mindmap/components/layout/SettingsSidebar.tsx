import React, { useEffect } from 'react';
import { useMindMapStore } from '../../../../core/store/mindMapStore';

interface SettingsSidebarProps {
  // 既存のprops（後方互換性のため保持）
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
  const { settings, updateSetting, loadSettingsFromStorage } = useMindMapStore();

  // 初回ロード時に設定をlocalStorageから読み込み
  useEffect(() => {
    loadSettingsFromStorage();
  }, [loadSettingsFromStorage]);

  const handleSettingChange = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    updateSetting(key, value);
  };

  return (
    <div className="settings-sidebar">


      <div className="settings-section">
        <h3 className="settings-section-title">テーマ</h3>
        <div className="settings-section-content">
          <div className="settings-radio-group">
            <label className="settings-radio-option">
              <input
                type="radio"
                name="theme"
                value="dark"
                checked={settings.theme === 'dark'}
                onChange={() => handleSettingChange('theme', 'dark')}
              />
              <span className="settings-radio-label">
                <span className="settings-icon">🌙</span>
                ダーク
              </span>
            </label>
            <label className="settings-radio-option">
              <input
                type="radio"
                name="theme"
                value="light"
                checked={settings.theme === 'light'}
                onChange={() => handleSettingChange('theme', 'light')}
              />
              <span className="settings-radio-label">
                <span className="settings-icon">☀️</span>
                ライト
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">フォント設定</h3>
        <div className="settings-section-content">
          <div className="settings-input-group">
            <label className="settings-input-label">フォントサイズ</label>
            <input
              type="number"
              min="10"
              max="24"
              value={settings.fontSize}
              onChange={(e) => handleSettingChange('fontSize', parseInt(e.target.value))}
              className="settings-input"
            />
          </div>
          <div className="settings-input-group">
            <label className="settings-input-label">フォントファミリー</label>
            <select
              value={settings.fontFamily}
              onChange={(e) => handleSettingChange('fontFamily', e.target.value)}
              className="settings-select"
            >
              <option value="system-ui">System UI</option>
              <option value="Arial">Arial</option>
              <option value="Helvetica">Helvetica</option>
              <option value="sans-serif">Sans Serif</option>
              <option value="serif">Serif</option>
            </select>
          </div>
        </div>
      </div>


      <div className="settings-section">
        <h3 className="settings-section-title">ストレージモード</h3>
        <div className="settings-section-content">
          <div className="settings-radio-group">
            <label className="settings-radio-option">
              <input
                type="radio"
                name="storageMode"
                value="local"
                checked={storageMode === 'local'}
                onChange={() => onStorageModeChange?.('local')}
              />
              <span className="settings-radio-label">
                <span className="settings-icon">💾</span>
                ローカル
              </span>
            </label>
            <label className="settings-radio-option">
              <input
                type="radio"
                name="storageMode"
                value="cloud"
                checked={storageMode === 'cloud'}
                onChange={() => onStorageModeChange?.('cloud')}
              />
              <span className="settings-radio-label">
                <span className="settings-icon">☁️</span>
                クラウド
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">その他</h3>
        <div className="settings-section-content">
          <div className="settings-action-group">
            {onAutoLayout && (
              <button 
                className="settings-button"
                onClick={onAutoLayout}
              >
                <span className="settings-button-icon">📐</span>
                自動整列
              </button>
            )}
            {onShowKeyboardHelper && (
              <button 
                className="settings-button"
                onClick={onShowKeyboardHelper}
              >
                <span className="settings-button-icon">⌨️</span>
                キーボードショートカット
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .settings-sidebar {
          padding: 16px;
          overflow-y: auto;
          background-color: var(--bg-primary);
        }

        .settings-section {
          margin-bottom: 24px;
        }

        .settings-section-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 12px 0;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border-color);
        }

        .settings-section-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .settings-toggle {
          display: flex;
          align-items: center;
          cursor: pointer;
          padding: 4px 0;
        }

        .settings-toggle input[type="checkbox"] {
          margin-right: 8px;
          accent-color: #007acc;
        }

        .settings-toggle-label {
          color: var(--text-primary);
          font-size: 14px;
        }

        .settings-input-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .settings-input-label {
          font-size: 12px;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .settings-input,
        .settings-select {
          padding: 6px 8px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 14px;
        }

        .settings-input:focus,
        .settings-select:focus {
          outline: none;
          border-color: var(--accent-color);
        }

        .settings-color-input {
          padding: 4px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-primary);
          cursor: pointer;
          width: 60px;
          height: 32px;
        }

        .settings-radio-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .settings-radio-option {
          display: flex;
          align-items: center;
          padding: 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .settings-radio-option:hover {
          background-color: var(--hover-color);
        }

        .settings-radio-option input[type="radio"] {
          margin-right: 8px;
          accent-color: var(--accent-color);
        }

        .settings-radio-label {
          display: flex;
          align-items: center;
          color: var(--text-primary);
          font-size: 14px;
        }

        .settings-icon {
          margin-right: 8px;
        }

        .settings-button {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background: none;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }

        .settings-button:hover {
          background-color: var(--hover-color);
          border-color: var(--accent-color);
          color: var(--text-primary);
        }

        .settings-button-icon {
          margin-right: 8px;
        }

        .settings-action-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
      `}</style>
    </div>
  );
};

export default SettingsSidebar;