import React from 'react';
import { useVimMode } from '../../../core/hooks/useVimMode';

const VimStatusBar: React.FC = () => {
  const vim = useVimMode();

  if (!vim.isEnabled) {
    return null;
  }

  const getModeColor = () => {
    switch (vim.mode) {
      case 'normal':
        return '#6366f1'; // Indigo
      case 'insert':
        return '#10b981'; // Green
      case 'visual':
        return '#f59e0b'; // Amber
      case 'command':
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  const getModeText = () => {
    switch (vim.mode) {
      case 'normal':
        return '-- NORMAL --';
      case 'insert':
        return '-- INSERT --';
      case 'visual':
        return '-- VISUAL --';
      case 'command':
        return '-- COMMAND --';
      default:
        return '-- VIM --';
    }
  };

  return (
    <div className="vim-status-bar">
      <div 
        className="vim-mode-indicator"
        style={{ backgroundColor: getModeColor() }}
      >
        {getModeText()}
      </div>
      {vim.commandBuffer && (
        <div className="vim-command-buffer">
          :{vim.commandBuffer}
        </div>
      )}
      {vim.lastCommand && (
        <div className="vim-last-command">
          Last: {vim.lastCommand}
        </div>
      )}
      
      <style>{`
        .vim-status-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 24px;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          padding: 0 12px;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 12px;
          z-index: 1000;
          gap: 12px;
        }

        .vim-mode-indicator {
          color: white;
          padding: 2px 8px;
          border-radius: 3px;
          font-weight: bold;
          font-size: 11px;
          text-transform: uppercase;
        }

        .vim-command-buffer {
          color: var(--text-primary);
          background: var(--bg-tertiary);
          padding: 2px 6px;
          border-radius: 3px;
          border: 1px solid var(--border-color);
        }

        .vim-last-command {
          color: var(--text-secondary);
          font-size: 10px;
          opacity: 0.7;
        }

        /* Add padding to body when vim status bar is shown */
        body:has(.vim-status-bar) {
          padding-bottom: 24px;
        }
      `}</style>
    </div>
  );
};

export default VimStatusBar;