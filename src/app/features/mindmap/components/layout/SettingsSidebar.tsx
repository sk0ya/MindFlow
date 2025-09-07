import React, { useState, useEffect } from 'react';
import { useMindMapStore } from '../../../../core/store/mindMapStore';
import { useDataCleanup, type DataCleanupStats } from '../../../../core/hooks/useDataCleanup';

interface SettingsSidebarProps {
  // 既存のprops（後方互換性のため保持）
  storageMode?: 'local' | 'cloud';
  onStorageModeChange?: (mode: 'local' | 'cloud') => void;
  onShowKeyboardHelper?: () => void;
  onAutoLayout?: () => void;
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  storageMode,
  onStorageModeChange,
  onShowKeyboardHelper,
  onAutoLayout
}) => {
  const { settings, updateSetting } = useMindMapStore();
  const { clearAllData, getDataStats, isClearing, error } = useDataCleanup();
  const [dataStats, setDataStats] = useState<DataCleanupStats | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleSettingChange = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    updateSetting(key, value);
  };

  // データ統計の取得
  useEffect(() => {
    getDataStats().then(setDataStats);
  }, [getDataStats]);

  // データクリーンアップの実行
  const handleClearData = async () => {
    if (!showConfirmDialog) {
      setShowConfirmDialog(true);
      return;
    }

    try {
      await clearAllData();
      setShowConfirmDialog(false);
      // 統計を更新
      const newStats = await getDataStats();
      setDataStats(newStats);
    } catch (err) {
      // エラーはhookで管理される
    }
  };

  // データサイズのフォーマット
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
        <h3 className="settings-section-title">データ管理</h3>
        <div className="settings-section-content">
          {dataStats && (
            <div className="data-stats">
              <div className="data-stats-item">
                <span className="data-stats-label">ローカルストレージ項目:</span>
                <span className="data-stats-value">{dataStats.localStorageItems}</span>
              </div>
              <div className="data-stats-item">
                <span className="data-stats-label">使用容量:</span>
                <span className="data-stats-value">{formatBytes(dataStats.indexedDBSize)}</span>
              </div>
            </div>
          )}
          
          {error && (
            <div className="cleanup-error">
              <span className="cleanup-error-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="cleanup-actions">
            {!showConfirmDialog ? (
              <button 
                className="cleanup-button"
                onClick={handleClearData}
                disabled={isClearing}
              >
                <span className="settings-button-icon">🗑️</span>
                {isClearing ? 'クリア中...' : 'すべてのデータを削除'}
              </button>
            ) : (
              <div className="cleanup-confirm">
                <p className="cleanup-confirm-text">
                  すべてのローカルデータ（マインドマップ、設定など）が削除されます。この操作は元に戻せません。
                </p>
                <div className="cleanup-confirm-buttons">
                  <button 
                    className="cleanup-button cleanup-button-danger"
                    onClick={handleClearData}
                    disabled={isClearing}
                  >
                    {isClearing ? '削除中...' : '削除する'}
                  </button>
                  <button 
                    className="cleanup-button cleanup-button-cancel"
                    onClick={() => setShowConfirmDialog(false)}
                    disabled={isClearing}
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
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

        .data-stats {
          padding: 12px;
          background: var(--bg-secondary);
          border-radius: 6px;
          margin-bottom: 16px;
        }

        .data-stats-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .data-stats-item:last-child {
          margin-bottom: 0;
        }

        .data-stats-label {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .data-stats-value {
          font-size: 12px;
          color: var(--text-primary);
          font-weight: 500;
        }

        .cleanup-error {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background: rgba(255, 107, 107, 0.1);
          border: 1px solid rgba(255, 107, 107, 0.3);
          border-radius: 4px;
          margin-bottom: 12px;
          font-size: 12px;
          color: #ff6b6b;
        }

        .cleanup-error-icon {
          margin-right: 6px;
        }

        .cleanup-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .cleanup-button {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px 16px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: none;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
          min-height: 40px;
        }

        .cleanup-button:hover:not(:disabled) {
          background-color: var(--hover-color);
          border-color: var(--accent-color);
        }

        .cleanup-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .cleanup-button-danger {
          border-color: #ff6b6b;
          color: #ff6b6b;
        }

        .cleanup-button-danger:hover:not(:disabled) {
          background-color: rgba(255, 107, 107, 0.1);
          border-color: #ff5252;
        }

        .cleanup-button-cancel {
          border-color: var(--border-color);
          color: var(--text-secondary);
        }

        .cleanup-confirm {
          padding: 16px;
          background: var(--bg-secondary);
          border: 1px solid rgba(255, 107, 107, 0.3);
          border-radius: 6px;
        }

        .cleanup-confirm-text {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0 0 16px 0;
          line-height: 1.4;
        }

        .cleanup-confirm-buttons {
          display: flex;
          gap: 8px;
        }

        .cleanup-confirm-buttons .cleanup-button {
          flex: 1;
          padding: 8px 12px;
          min-height: 36px;
        }
      `}</style>
    </div>
  );
};

export default SettingsSidebar;