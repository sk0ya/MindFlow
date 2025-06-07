import React, { useState } from 'react';
import { layoutPresets } from '../utils/autoLayout';

const LayoutPanel = ({ onApplyLayout, onClose, visible, position, data, onToggleAutoLayout }) => {
  const [selectedLayout, setSelectedLayout] = useState('auto');
  const [isAnimating, setIsAnimating] = useState(false);

  const handleApplyLayout = async (layoutKey) => {
    setIsAnimating(true);
    setSelectedLayout(layoutKey);
    
    try {
      await onApplyLayout(layoutKey);
      
      // アニメーション効果のための短い遅延
      setTimeout(() => {
        setIsAnimating(false);
      }, 800);
    } catch (error) {
      console.error('レイアウト適用エラー:', error);
      setIsAnimating(false);
    }
  };

  const handleQuickApply = (layoutKey) => {
    handleApplyLayout(layoutKey);
    // 素早い操作の場合はパネルを閉じない
  };

  if (!visible) return null;

  return (
    <div 
      className="layout-panel"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1500
      }}
    >
      <div className="panel-header">
        <h3>🎨 自動レイアウト</h3>
        <button onClick={onClose} className="close-btn">×</button>
      </div>

      <div className="panel-content">
        {isAnimating && (
          <div className="animation-overlay">
            <div className="loading-spinner"></div>
            <p>レイアウトを適用中...</p>
          </div>
        )}

        {/* オートレイアウト設定 */}
        <div className="auto-layout-setting">
          <h4>自動レイアウト設定</h4>
          <div className="toggle-setting">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={data?.settings?.autoLayout !== false}
                onChange={(e) => onToggleAutoLayout && onToggleAutoLayout(e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-text">
                子要素追加時に自動整列
              </span>
            </label>
            <p className="setting-description">
              新しい子ノードを追加した際に、親の全ての子要素を自動的に美しく配置します。
            </p>
          </div>
        </div>

        {/* クイックレイアウトボタン */}
        <div className="quick-actions">
          <h4>クイックアクション</h4>
          <div className="quick-buttons">
            <button
              className="quick-btn auto"
              onClick={() => handleQuickApply('auto')}
              title="ノード数に応じて最適なレイアウトを自動選択"
            >
              🤖 自動最適化
            </button>
            <button
              className="quick-btn mindmap"
              onClick={() => handleQuickApply('mindmap')}
              title="MindMeisterスタイルの左右分散レイアウト"
            >
              🧠 マインドマップ
            </button>
          </div>
        </div>

        {/* レイアウトプリセット */}
        <div className="layout-presets">
          <h4>レイアウトプリセット</h4>
          <div className="preset-grid">
            {Object.entries(layoutPresets).map(([key, preset]) => (
              <div
                key={key}
                className={`preset-card ${selectedLayout === key ? 'selected' : ''}`}
                onClick={() => setSelectedLayout(key)}
              >
                <div className="preset-icon">{preset.icon}</div>
                <div className="preset-info">
                  <h5>{preset.name}</h5>
                  <p>{preset.description}</p>
                </div>
                <button
                  className="apply-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApplyLayout(key);
                  }}
                  disabled={isAnimating}
                >
                  適用
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 選択されたレイアウトの詳細設定 */}
        {selectedLayout && layoutPresets[selectedLayout] && (
          <div className="layout-settings">
            <h4>詳細設定</h4>
            <div className="settings-content">
              <p>
                <strong>{layoutPresets[selectedLayout].name}</strong>レイアウトが選択されています。
              </p>
              <p className="description">
                {layoutPresets[selectedLayout].description}
              </p>
              
              {/* レイアウト固有の設定オプション */}
              {selectedLayout === 'radial' && (
                <div className="setting-group">
                  <label>基本半径: 150px</label>
                  <label>層間隔: 120px</label>
                </div>
              )}
              
              {selectedLayout === 'hierarchical' && (
                <div className="setting-group">
                  <label>レベル間隔: 200px</label>
                  <label>ノード間隔: 80px</label>
                </div>
              )}
              
              {selectedLayout === 'mindmap' && (
                <div className="setting-group">
                  <label>基本半径: 180px</label>
                  <label>レベル間隔: 200px</label>
                  <label>最小縦間隔: 60px</label>
                  <label>最大縦間隔: 120px</label>
                  <label>衝突検出: 有効</label>
                </div>
              )}
              
              {selectedLayout === 'grid' && (
                <div className="setting-group">
                  <label>グリッド間隔: 120px</label>
                  <label>列数: 5</label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* アクションボタン */}
        <div className="action-buttons">
          <button
            className="btn-primary"
            onClick={() => handleApplyLayout(selectedLayout)}
            disabled={isAnimating || !selectedLayout}
          >
            {isAnimating ? '適用中...' : '選択したレイアウトを適用'}
          </button>
          <button
            className="btn-secondary"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
      </div>

      <style jsx>{`
        .layout-panel {
          background: white;
          border-radius: 16px;
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.3);
          width: 380px;
          max-height: 600px;
          overflow-y: auto;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          position: relative;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e1e5e9;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 16px 16px 0 0;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .close-btn {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .panel-content {
          padding: 24px;
          position: relative;
        }

        .animation-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.95);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 10;
          border-radius: 0 0 16px 16px;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e1e5e9;
          border-top: 4px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .animation-overlay p {
          color: #666;
          font-weight: 500;
        }

        .auto-layout-setting {
          margin-bottom: 24px;
          padding: 16px;
          background: #f0f8ff;
          border-radius: 12px;
          border-left: 4px solid #667eea;
        }

        .auto-layout-setting h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .toggle-setting {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          cursor: pointer;
          gap: 12px;
          position: relative;
        }

        .toggle-label input[type="checkbox"] {
          display: none;
        }

        .toggle-slider {
          width: 44px;
          height: 24px;
          background: #ccc;
          border-radius: 24px;
          position: relative;
          transition: background 0.3s;
        }

        .toggle-slider::before {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          transition: transform 0.3s;
        }

        .toggle-label input[type="checkbox"]:checked + .toggle-slider {
          background: #667eea;
        }

        .toggle-label input[type="checkbox"]:checked + .toggle-slider::before {
          transform: translateX(20px);
        }

        .toggle-text {
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }

        .setting-description {
          font-size: 12px;
          color: #666;
          margin: 0;
          padding-left: 56px;
          line-height: 1.4;
        }

        .quick-actions {
          margin-bottom: 24px;
        }

        .quick-actions h4,
        .layout-presets h4,
        .layout-settings h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .quick-buttons {
          display: flex;
          gap: 8px;
        }

        .quick-btn {
          flex: 1;
          padding: 12px 16px;
          border: 2px solid #e1e5e9;
          border-radius: 12px;
          background: white;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          text-align: center;
        }

        .quick-btn:hover {
          border-color: #667eea;
          background: #f8f9ff;
          transform: translateY(-2px);
        }

        .quick-btn.auto {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-color: transparent;
        }

        .quick-btn.auto:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .quick-btn.mindmap {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
          border-color: transparent;
        }

        .quick-btn.mindmap:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(245, 87, 108, 0.4);
        }

        .layout-presets {
          margin-bottom: 24px;
        }

        .preset-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .preset-card {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border: 2px solid #e1e5e9;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          gap: 12px;
        }

        .preset-card:hover {
          border-color: #667eea;
          background: #f8f9ff;
        }

        .preset-card.selected {
          border-color: #667eea;
          background: #e3f2fd;
        }

        .preset-icon {
          font-size: 24px;
          width: 40px;
          text-align: center;
        }

        .preset-info {
          flex: 1;
        }

        .preset-info h5 {
          margin: 0 0 4px 0;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .preset-info p {
          margin: 0;
          font-size: 12px;
          color: #666;
          line-height: 1.4;
        }

        .apply-btn {
          padding: 6px 12px;
          border: 1px solid #667eea;
          border-radius: 6px;
          background: white;
          color: #667eea;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .apply-btn:hover {
          background: #667eea;
          color: white;
        }

        .apply-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .layout-settings {
          margin-bottom: 24px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 12px;
        }

        .settings-content p {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #333;
        }

        .description {
          color: #666 !important;
          font-style: italic;
        }

        .setting-group {
          margin-top: 12px;
        }

        .setting-group label {
          display: block;
          font-size: 12px;
          color: #666;
          margin-bottom: 4px;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
        }

        .btn-primary,
        .btn-secondary {
          flex: 1;
          padding: 12px 16px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-secondary:hover {
          background: #545b62;
          transform: translateY(-1px);
        }

        /* スクロールバーのスタイル */
        .layout-panel::-webkit-scrollbar {
          width: 6px;
        }

        .layout-panel::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }

        .layout-panel::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 3px;
        }

        .layout-panel::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }

        /* レスポンシブ対応 */
        @media (max-width: 768px) {
          .layout-panel {
            width: 320px;
            max-height: 500px;
          }

          .panel-content {
            padding: 16px;
          }

          .quick-buttons {
            flex-direction: column;
          }

          .action-buttons {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default LayoutPanel;
