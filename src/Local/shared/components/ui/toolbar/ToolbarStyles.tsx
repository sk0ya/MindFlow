import React from 'react';

const ToolbarStyles: React.FC = () => (
  <style>{`
    .toolbar {
      height: 60px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      position: relative;
      z-index: 1000;
    }

    .logo-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .sidebar-toggle {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: all 0.2s ease;
    }

    .sidebar-toggle:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.05);
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      font-size: 28px;
      animation: float 3s ease-in-out infinite;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-4px); }
    }

    .logo-text {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .logo-title {
      font-size: 24px;
      font-weight: 700;
      background: linear-gradient(45deg, #ffffff, #f0f8ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .logo-subtitle {
      font-size: 12px;
      opacity: 0.8;
      font-weight: 500;
    }

    .title-section {
      flex: 1;
      display: flex;
      justify-content: center;
      max-width: 400px;
      margin: 0 20px;
    }

    .app-title {
      font-size: 20px;
      font-weight: 600;
      margin: 0;
      cursor: pointer;
      padding: 8px 16px;
      border-radius: 8px;
      transition: all 0.2s ease;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .app-title:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: scale(1.02);
    }

    .title-input {
      font-size: 20px;
      font-weight: 600;
      border: 2px solid #4CAF50;
      border-radius: 8px;
      padding: 8px 16px;
      background: white;
      color: #333;
      text-align: center;
      min-width: 200px;
      outline: none;
      box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
    }

    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .action-group {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 8px;
      border-left: 1px solid rgba(255, 255, 255, 0.2);
    }

    .action-group:first-child {
      border-left: none;
      padding-left: 0;
    }

    .toolbar-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 4px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    .toolbar-btn:hover:not(.disabled) {
      background: rgba(255, 255, 255, 0.3);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .toolbar-btn:active:not(.disabled) {
      transform: translateY(0);
    }

    .toolbar-btn.disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: rgba(255, 255, 255, 0.1);
    }

    .toolbar-btn.export {
      background: linear-gradient(135deg, #4CAF50, #45a049);
    }

    .toolbar-btn.export:hover {
      background: linear-gradient(135deg, #45a049, #3d8b40);
    }

    .toolbar-btn.import {
      background: linear-gradient(135deg, #2196F3, #1976D2);
    }

    .toolbar-btn.import:hover {
      background: linear-gradient(135deg, #1976D2, #1565C0);
    }

    .toolbar-btn.zoom-reset {
      min-width: 80px;
      font-family: monospace;
    }

    .toolbar-btn.shortcuts {
      font-size: 16px;
    }

    .toolbar-btn.storage {
      font-size: 16px;
      background: linear-gradient(135deg, #FF9800, #F57C00);
    }

    .toolbar-btn.storage:hover {
      background: linear-gradient(135deg, #F57C00, #E65100);
    }

    .tooltip {
      position: relative;
      display: inline-block;
    }

    @media (max-width: 768px) {
      .toolbar {
        padding: 0 12px;
        height: 56px;
      }

      .logo-text {
        display: none;
      }

      .title-section {
        margin: 0 12px;
      }

      .app-title {
        font-size: 16px;
        padding: 6px 12px;
      }

      .action-group {
        gap: 4px;
        padding: 0 4px;
      }

      .toolbar-btn {
        padding: 6px 8px;
        font-size: 12px;
      }

      .logo-subtitle {
        display: none;
      }
    }

    @media (max-width: 480px) {
      .action-group.help-actions .toolbar-btn.storage {
        display: none;
      }

      .toolbar-btn {
        padding: 4px 6px;
      }
    }
  `}</style>
);

export default ToolbarStyles;