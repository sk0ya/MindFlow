import React from 'react';

const ToolbarStyles: React.FC = () => (
  <style>{`
    .toolbar {
      height: 60px;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      color: #1e293b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
      position: relative;
      z-index: 1000;
      border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    }

    .logo-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .sidebar-toggle {
      background: rgba(51, 65, 85, 0.08);
      border: 1px solid rgba(51, 65, 85, 0.12);
      color: #475569;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: all 0.2s ease;
    }

    .sidebar-toggle:hover {
      background: rgba(51, 65, 85, 0.12);
      color: #1e293b;
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
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .logo-subtitle {
      font-size: 12px;
      color: #64748b;
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
      border-radius: 12px;
      transition: all 0.2s ease;
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.2);
      color: #1e293b;
    }

    .app-title:hover {
      background: rgba(59, 130, 246, 0.12);
      transform: scale(1.02);
      border-color: rgba(59, 130, 246, 0.3);
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
      border-left: 1px solid rgba(148, 163, 184, 0.2);
    }

    .action-group:first-child {
      border-left: none;
      padding-left: 0;
    }

    .toolbar-btn {
      background: rgba(51, 65, 85, 0.08);
      border: 1px solid rgba(51, 65, 85, 0.12);
      color: #475569;
      padding: 8px 12px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .toolbar-btn:hover:not(.disabled) {
      background: rgba(51, 65, 85, 0.12);
      color: #1e293b;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      border-color: rgba(51, 65, 85, 0.2);
    }

    .toolbar-btn:active:not(.disabled) {
      transform: translateY(0);
    }

    .toolbar-btn.disabled {
      opacity: 0.4;
      cursor: not-allowed;
      background: rgba(51, 65, 85, 0.04);
    }

    .toolbar-btn.export {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      border-color: transparent;
    }

    .toolbar-btn.export:hover {
      background: linear-gradient(135deg, #059669, #047857);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .toolbar-btn.import {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: white;
      border-color: transparent;
    }

    .toolbar-btn.import:hover {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
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
      background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      color: white;
      border-color: transparent;
    }

    .toolbar-btn.notes:hover {
      background: linear-gradient(135deg, #7c3aed, #6d28d9);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
    }

    .toolbar-btn.notes.active {
      background: linear-gradient(135deg, #6d28d9, #5b21b6);
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
    }

    .toolbar-btn.storage {
      font-size: 16px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      border-color: transparent;
    }

    .toolbar-btn.storage:hover {
      background: linear-gradient(135deg, #d97706, #b45309);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
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