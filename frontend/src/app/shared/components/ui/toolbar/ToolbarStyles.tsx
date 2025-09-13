import React from 'react';

const ToolbarStyles: React.FC = () => (
  <style>{`
    .toolbar {
      height: 60px;
      background: #ffffff;
      color: #333333;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      position: relative;
      z-index: 900;
      border-bottom: 1px solid #e5e5e5;
    }

    [data-theme="dark"] .toolbar {
      background: #1a1a1a;
      color: #ffffff;
      border-bottom: 1px solid #333333;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    .logo-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .sidebar-toggle {
      background: #f5f5f5;
      border: 1px solid #cccccc;
      color: #666666;
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
      background: #eeeeee;
      color: #333333;
    }

    [data-theme="dark"] .sidebar-toggle {
      background: #333333;
      border: 1px solid #555555;
      color: #cccccc;
    }

    [data-theme="dark"] .sidebar-toggle:hover {
      background: #444444;
      color: #ffffff;
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
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .logo-subtitle {
      font-size: 12px;
      color: #999999;
      font-weight: 500;
    }

    [data-theme="dark"] .logo-subtitle {
      color: #cccccc;
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
      background: #f5f5f5;
      border: 1px solid #dddddd;
      color: #333333;
    }

    .app-title:hover {
      background: #eeeeee;
      border-color: #cccccc;
    }

    [data-theme="dark"] .app-title {
      background: #333333;
      border: 1px solid #555555;
      color: #ffffff;
    }

    [data-theme="dark"] .app-title:hover {
      background: #444444;
      border-color: #666666;
    }

    .title-input {
      font-size: 20px;
      font-weight: 600;
      border: 2px solid #666666;
      border-radius: 6px;
      padding: 8px 16px;
      background: #ffffff;
      color: #333333;
      text-align: center;
      min-width: 200px;
      outline: none;
    }

    [data-theme="dark"] .title-input {
      background: #333333;
      color: #ffffff;
      border: 2px solid #cccccc;
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
      border-left: 1px solid #dddddd;
    }

    .action-group:first-child {
      border-left: none;
      padding-left: 0;
    }

    [data-theme="dark"] .action-group {
      border-left: 1px solid #555555;
    }

    .toolbar-btn {
      background: #f5f5f5;
      border: 1px solid #cccccc;
      color: #666666;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .toolbar-btn:hover:not(.disabled) {
      background: #eeeeee;
      color: #333333;
      border-color: #aaaaaa;
    }

    .toolbar-btn:active:not(.disabled) {
      background: #e5e5e5;
    }

    .toolbar-btn.disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: #f9f9f9;
    }

    [data-theme="dark"] .toolbar-btn {
      background: #333333;
      border: 1px solid #555555;
      color: #cccccc;
    }

    [data-theme="dark"] .toolbar-btn:hover:not(.disabled) {
      background: #444444;
      color: #ffffff;
      border-color: #777777;
    }

    [data-theme="dark"] .toolbar-btn.disabled {
      background: #2a2a2a;
    }

    .toolbar-btn.export {
      background: #888888;
      color: white;
      border-color: #777777;
    }

    .toolbar-btn.export:hover {
      background: #777777;
      border-color: #666666;
    }

    [data-theme="dark"] .toolbar-btn.export {
      background: #555555;
      color: white;
      border-color: #666666;
    }

    [data-theme="dark"] .toolbar-btn.export:hover {
      background: #666666;
      border-color: #777777;
    }

    .toolbar-btn.import {
      background: #888888;
      color: white;
      border-color: #777777;
    }

    .toolbar-btn.import:hover {
      background: #777777;
      border-color: #666666;
    }

    [data-theme="dark"] .toolbar-btn.import {
      background: #555555;
      color: white;
      border-color: #666666;
    }

    [data-theme="dark"] .toolbar-btn.import:hover {
      background: #666666;
      border-color: #777777;
    }

    .toolbar-btn.zoom-reset {
      min-width: 80px;
      font-family: monospace;
    }

    .toolbar-btn.shortcuts {
      font-size: 16px;
    }

    .toolbar-btn.notes {
      font-size: 16px;
      background: #f5f5f5;
      color: #666666;
      border-color: #cccccc;
    }

    .toolbar-btn.notes:hover {
      background: #eeeeee;
      color: #333333;
      border-color: #aaaaaa;
    }

    .toolbar-btn.notes.active {
      background: #333333;
      color: white;
      border-color: #222222;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .toolbar-btn.notes.active:hover {
      background: #444444;
      border-color: #333333;
    }

    [data-theme="dark"] .toolbar-btn.notes {
      background: #333333;
      color: #cccccc;
      border-color: #555555;
    }

    [data-theme="dark"] .toolbar-btn.notes:hover {
      background: #444444;
      color: #ffffff;
      border-color: #777777;
    }

    [data-theme="dark"] .toolbar-btn.notes.active {
      background: #ffffff;
      color: #333333;
      border-color: #cccccc;
      box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.1);
    }

    [data-theme="dark"] .toolbar-btn.notes.active:hover {
      background: #f5f5f5;
      border-color: #aaaaaa;
    }

    .toolbar-btn.storage {
      font-size: 16px;
      background: #888888;
      color: white;
      border-color: #777777;
    }

    .toolbar-btn.storage:hover {
      background: #777777;
      border-color: #666666;
    }

    [data-theme="dark"] .toolbar-btn.storage {
      background: #555555;
      color: white;
      border-color: #666666;
    }

    [data-theme="dark"] .toolbar-btn.storage:hover {
      background: #666666;
      border-color: #777777;
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