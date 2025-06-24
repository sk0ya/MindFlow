import React, { useState } from 'react';
import './StorageModeSelector.css';

const StorageModeSelector = ({ onModeSelect, hasLocalData = false }) => {
  const [selectedMode, setSelectedMode] = useState(hasLocalData ? 'local' : null);

  const handleModeSelect = (mode) => {
    setSelectedMode(mode);
  };

  const handleConfirm = () => {
    if (selectedMode) {
      onModeSelect(selectedMode);
    }
  };

  return (
    <div className="storage-mode-overlay">
      <div className="storage-mode-modal">
        <div className="storage-mode-header">
          <h2>📁 ストレージモードを選択</h2>
          <p>マインドマップデータの保存方法を選択してください</p>
        </div>

        <div className="storage-mode-options">
          {hasLocalData && (
            <div className="storage-mode-notice">
              <div className="notice-icon">ℹ️</div>
              <p>既存のローカルデータが見つかりました。継続して利用できます。</p>
            </div>
          )}

          <div className="storage-mode-grid">
            <div 
              className={`storage-option ${selectedMode === 'local' ? 'selected' : ''}`}
              onClick={() => handleModeSelect('local')}
            >
              <div className="storage-icon">💾</div>
              <h3>ローカルストレージ</h3>
              <div className="storage-description">
                <p>✅ オフラインで利用可能</p>
                <p>✅ 高速アクセス</p>
                <p>⚠️ ブラウザデータに依存</p>
                <p>⚠️ 他デバイスとの共有不可</p>
              </div>
              {hasLocalData && (
                <div className="existing-data-badge">
                  既存データあり
                </div>
              )}
            </div>

            <div 
              className={`storage-option ${selectedMode === 'cloud' ? 'selected' : ''}`}
              onClick={() => handleModeSelect('cloud')}
            >
              <div className="storage-icon">☁️</div>
              <h3>クラウドストレージ</h3>
              <div className="storage-description">
                <p>✅ どこからでもアクセス</p>
                <p>✅ デバイス間で同期</p>
                <p>✅ ファイル添付に対応</p>
                <p>⚠️ インターネット接続が必要</p>
              </div>
              <div className="auth-required-badge">
                認証が必要
              </div>
            </div>
          </div>
        </div>

        <div className="storage-mode-actions">
          <button 
            className="confirm-button"
            onClick={handleConfirm}
            disabled={!selectedMode}
          >
            {selectedMode === 'cloud' ? '認証を開始' : '開始'}
          </button>
        </div>

        <div className="storage-mode-footer">
          <p>※ 後で設定から変更することができます</p>
        </div>
      </div>
    </div>
  );
};

export default StorageModeSelector;