import React from 'react';

const NodeCustomizationStyles: React.FC = React.memo(() => {
  return (
    <style>{`
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
  );
});

NodeCustomizationStyles.displayName = 'NodeCustomizationStyles';

export default NodeCustomizationStyles;