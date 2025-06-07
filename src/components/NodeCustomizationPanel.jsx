import React, { useState, useEffect } from 'react';

const NodeCustomizationPanel = ({
  selectedNode,
  onUpdateNode,
  onClose,
  position
}) => {
  const [customizations, setCustomizations] = useState({
    fontSize: '14px',
    fontWeight: 'bold',
    fontStyle: 'normal',
    borderStyle: 'solid',
    borderWidth: '2px'
  });

  // 選択されたノードの現在の設定を反映
  useEffect(() => {
    if (selectedNode) {
      setCustomizations({
        fontSize: selectedNode.fontSize || '14px',
        fontWeight: selectedNode.fontWeight || 'bold',
        fontStyle: selectedNode.fontStyle || 'normal',
        borderStyle: selectedNode.borderStyle || 'solid',
        borderWidth: selectedNode.borderWidth || '2px'
      });
    }
  }, [selectedNode]);

  const handleChange = (property, value) => {
    const newCustomizations = { ...customizations, [property]: value };
    setCustomizations(newCustomizations);
    
    // リアルタイムで変更を適用
    if (selectedNode) {
      onUpdateNode(selectedNode.id, newCustomizations);
    }
  };

  if (!selectedNode) return null;

  return (
    <div 
      className="customization-panel"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 1000
      }}
    >
      <div className="panel-header">
        <h3>ノードのカスタマイズ</h3>
        <button onClick={onClose} className="close-btn">×</button>
      </div>

      <div className="panel-content">
        {/* フォントスタイル */}
        <div className="section">
          <label>フォント</label>
          <div className="font-controls">
            <select
              value={customizations.fontSize}
              onChange={(e) => handleChange('fontSize', e.target.value)}
              className="font-size-select"
            >
              <option value="12px">小 (12px)</option>
              <option value="14px">標準 (14px)</option>
              <option value="16px">大 (16px)</option>
              <option value="18px">特大 (18px)</option>
              <option value="20px">最大 (20px)</option>
            </select>

            <div className="font-style-buttons">
              <button
                className={`style-btn ${customizations.fontWeight === 'bold' ? 'active' : ''}`}
                onClick={() => handleChange('fontWeight', 
                  customizations.fontWeight === 'bold' ? 'normal' : 'bold'
                )}
                title="太字"
              >
                <strong>B</strong>
              </button>
              <button
                className={`style-btn ${customizations.fontStyle === 'italic' ? 'active' : ''}`}
                onClick={() => handleChange('fontStyle', 
                  customizations.fontStyle === 'italic' ? 'normal' : 'italic'
                )}
                title="斜体"
              >
                <em>I</em>
              </button>
            </div>
          </div>
        </div>

        {/* 境界線スタイル */}
        <div className="section">
          <label>境界線</label>
          <div className="border-controls">
            <select
              value={customizations.borderStyle}
              onChange={(e) => handleChange('borderStyle', e.target.value)}
              className="border-style-select"
            >
              <option value="solid">実線</option>
              <option value="dashed">破線</option>
              <option value="dotted">点線</option>
              <option value="none">なし</option>
            </select>
            <select
              value={customizations.borderWidth}
              onChange={(e) => handleChange('borderWidth', e.target.value)}
              className="border-width-select"
            >
              <option value="1px">細 (1px)</option>
              <option value="2px">標準 (2px)</option>
              <option value="3px">太 (3px)</option>
              <option value="4px">極太 (4px)</option>
            </select>
          </div>
        </div>

        {/* プリセットボタン */}
        <div className="section">
          <label>プリセット</label>
          <div className="preset-buttons">
            <button
              onClick={() => {
                const preset = {
                  fontSize: '14px',
                  fontWeight: 'bold',
                  fontStyle: 'normal',
                  borderStyle: 'solid',
                  borderWidth: '2px'
                };
                setCustomizations(preset);
                onUpdateNode(selectedNode.id, preset);
              }}
              className="preset-btn"
            >
              🎨 デフォルト
            </button>
            <button
              onClick={() => {
                const preset = {
                  fontSize: '16px',
                  fontWeight: 'bold',
                  fontStyle: 'normal',
                  borderStyle: 'solid',
                  borderWidth: '3px'
                };
                setCustomizations(preset);
                onUpdateNode(selectedNode.id, preset);
              }}
              className="preset-btn"
            >
              🔴 重要
            </button>
            <button
              onClick={() => {
                const preset = {
                  fontSize: '14px',
                  fontWeight: 'normal',
                  fontStyle: 'italic',
                  borderStyle: 'dashed',
                  borderWidth: '2px'
                };
                setCustomizations(preset);
                onUpdateNode(selectedNode.id, preset);
              }}
              className="preset-btn"
            >
              💭 アイデア
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .customization-panel {
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          width: 280px;
          max-height: 500px;
          overflow-y: auto;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e1e5e9;
          background: #f8f9fa;
          border-radius: 12px 12px 0 0;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #666;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }

        .close-btn:hover {
          background: #e9ecef;
          color: #333;
        }

        .panel-content {
          padding: 20px;
        }

        .section {
          margin-bottom: 20px;
        }

        .section:last-child {
          margin-bottom: 0;
        }

        label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #333;
          margin-bottom: 8px;
        }

        .font-controls {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .font-size-select {
          flex: 1;
          padding: 6px 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 13px;
        }

        .font-style-buttons {
          display: flex;
          gap: 4px;
        }

        .style-btn {
          width: 32px;
          height: 32px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          transition: all 0.2s;
        }

        .style-btn:hover {
          border-color: #4285f4;
          background: #f8f9ff;
        }

        .style-btn.active {
          border-color: #4285f4;
          background: #e3f2fd;
          color: #4285f4;
        }

        .border-controls {
          display: flex;
          gap: 8px;
        }

        .border-style-select,
        .border-width-select {
          flex: 1;
          padding: 6px 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 13px;
        }

        .preset-buttons {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .preset-btn {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          font-size: 13px;
          text-align: left;
          transition: all 0.2s;
        }

        .preset-btn:hover {
          border-color: #4285f4;
          background: #f8f9ff;
        }

        /* スクロールバーのスタイル */
        .customization-panel::-webkit-scrollbar {
          width: 6px;
        }

        .customization-panel::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }

        .customization-panel::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 3px;
        }

        .customization-panel::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
      `}</style>
    </div>
  );
};

export default NodeCustomizationPanel;
