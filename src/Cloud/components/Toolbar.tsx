import React, { useState } from 'react';
import { ShortcutTooltip } from './KeyboardShortcutHelper';
import { AuthState } from '../types';

interface ToolbarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomReset: () => void;
  onShowCloudStoragePanel?: () => void;
  authState?: AuthState;
  onShowAuthModal?: () => void;
  onLogout?: () => void;
  onShowShortcutHelper: () => void;
  onShowMapList?: () => void;
  isLocalMode?: boolean;
  onToggleSidebar: () => void;
  showSidebar?: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  title,
  onTitleChange,
  onExport,
  onImport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomReset,
  onShowCloudStoragePanel,
  authState,
  onShowAuthModal,
  onLogout,
  onShowShortcutHelper,
  onShowMapList,
  isLocalMode = false,
  onToggleSidebar,
  showSidebar = true
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [tempTitle, setTempTitle] = useState<string>(title);

  const handleTitleClick = (): void => {
    setIsEditingTitle(true);
    setTempTitle(title);
  };

  const handleTitleSave = (): void => {
    onTitleChange(tempTitle);
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setTempTitle(title);
      setIsEditingTitle(false);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = '';
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-content">
        <div className="toolbar-left">
          {/* マップ一覧ボタン */}
          {onShowMapList && (
            <button
              onClick={onShowMapList}
              className="btn btn-icon"
              title="マップ一覧を表示"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
          )}

          <div className="logo">
            <div className="logo-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"
                  fill="url(#gradient)"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#667eea" />
                    <stop offset="100%" stopColor="#764ba2" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="logo-text">MindFlow</span>
          </div>
          
          <div className="title-section">
            {isEditingTitle ? (
              <input
                type="text"
                value={tempTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyDown}
                className="title-input"
                autoFocus
              />
            ) : (
              <h1 className="title" onClick={handleTitleClick}>
                {title}
                <div className="edit-hint">編集するにはクリック</div>
              </h1>
            )}
          </div>
        </div>

        <div className="toolbar-center">
          <div className="action-group">
            <ShortcutTooltip shortcut="Ctrl+Z" description="元に戻す">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className="btn btn-action"
              >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 7v6h6" stroke="currentColor" strokeWidth="2" fill="none"/>
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" stroke="currentColor" strokeWidth="2" fill="none"/>
              </svg>
              </button>
            </ShortcutTooltip>
            <ShortcutTooltip shortcut="Ctrl+Y" description="やり直し">
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className="btn btn-action"
              >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 7v6h-6" stroke="currentColor" strokeWidth="2" fill="none"/>
                <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" stroke="currentColor" strokeWidth="2" fill="none"/>
              </svg>
              </button>
            </ShortcutTooltip>
          </div>

          {/* クラウドボタン（クラウドモード専用） */}
          {!isLocalMode && onShowCloudStoragePanel && (
            <div className="action-group">
              <button
                onClick={onShowCloudStoragePanel}
                className="btn btn-feature"
                title="クラウドストレージとマップ管理"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" stroke="currentColor" strokeWidth="2"/>
                </svg>
                クラウド
              </button>
            </div>
          )}

          <div className="action-group primary-actions">
            <button
              onClick={onExport}
              className="btn btn-secondary"
              title="エクスポート"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2"/>
              </svg>
              エクスポート
            </button>
            <label className="btn btn-secondary file-input-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2"/>
              </svg>
              インポート
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        <div className="toolbar-right">
          {/* 認証セクション（クラウドモード専用） */}
          {!isLocalMode && authState && (
            <div className="auth-section">
              {authState.isAuthenticated ? (
                <div className="auth-info">
                  <div className="user-info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2"/>
                      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    <span className="user-name">{authState.user?.email}</span>
                  </div>
                  <button
                    onClick={onLogout}
                    className="btn btn-auth"
                    title="ログアウト"
                  >
                    ログアウト
                  </button>
                </div>
              ) : (
                <button
                  onClick={onShowAuthModal}
                  className="btn btn-auth-login"
                  title="ログイン"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" stroke="currentColor" strokeWidth="2"/>
                    <polyline points="10,17 15,12 10,7" stroke="currentColor" strokeWidth="2"/>
                    <line x1="15" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  ログイン
                </button>
              )}
            </div>
          )}
          
          <div className="help-controls">
            <ShortcutTooltip shortcut="F1 or ?" description="ショートカット一覧を表示">
              <button
                onClick={onShowShortcutHelper}
                className="btn btn-help"
                title="ヘルプ"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="12" cy="17" r="1" stroke="currentColor" strokeWidth="2" fill="currentColor"/>
                </svg>
              </button>
            </ShortcutTooltip>
          </div>

          <div className="zoom-controls">
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            <button
              onClick={onZoomReset}
              className="btn btn-zoom"
              title="ズームリセット"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
          </div>

        </div>
      </div>

      <style>{`
        .toolbar {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 16px;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.08),
            0 4px 16px rgba(0, 0, 0, 0.04),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
          margin-bottom: 4px;
          position: relative;
          overflow: hidden;
        }

        .toolbar::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent);
        }

        .toolbar-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 10px;
          gap: 6px;
        }

        .toolbar-left, .toolbar-center, .toolbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .toolbar-center {
          flex: 1;
          justify-content: center;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .logo-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .logo-text {
          font-size: 14px;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .title-section {
          position: relative;
        }

        .title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
          cursor: pointer;
          padding: 6px 12px;
          border-radius: 12px;
          transition: all 0.3s ease;
          position: relative;
          line-height: 1.4;
        }

        .title:hover {
          background: rgba(139, 92, 246, 0.08);
          transform: translateY(-1px);
        }

        .edit-hint {
          font-size: 11px;
          color: #64748b;
          font-weight: 400;
          opacity: 0;
          transition: opacity 0.3s ease;
          position: absolute;
          top: 100%;
          left: 16px;
          white-space: nowrap;
        }

        .title:hover .edit-hint {
          opacity: 1;
        }

        .title-input {
          font-size: 20px;
          font-weight: 600;
          border: 2px solid #8b5cf6;
          border-radius: 12px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.9);
          color: #1e293b;
          outline: none;
          min-width: 250px;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
        }

        .action-group {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 4px;
          background: rgba(248, 250, 252, 0.7);
          border-radius: 12px;
          border: 1px solid rgba(226, 232, 240, 0.5);
        }

        .primary-actions {
          background: rgba(139, 92, 246, 0.08);
          border: 1px solid rgba(139, 92, 246, 0.2);
        }

        .btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s ease;
          position: relative;
          white-space: nowrap;
        }

        .btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          transform: none !important;
        }

        .btn-action {
          background: transparent;
          color: #64748b;
          padding: 6px;
        }

        .btn-action:hover:not(:disabled) {
          background: rgba(139, 92, 246, 0.1);
          color: #8b5cf6;
          transform: translateY(-1px);
        }

        .btn-feature {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .btn-feature:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }

        .btn-primary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
        }

        .btn-secondary {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .btn-secondary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
        }

        .file-input-label {
          cursor: pointer;
        }

        .zoom-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(248, 250, 252, 0.7);
          border-radius: 10px;
          border: 1px solid rgba(226, 232, 240, 0.5);
        }

        .zoom-label {
          font-size: 13px;
          color: #64748b;
          font-weight: 600;
          min-width: 40px;
          text-align: center;
        }

        .btn-zoom {
          background: transparent;
          color: #64748b;
          padding: 6px;
        }

        .btn-zoom:hover {
          background: rgba(139, 92, 246, 0.1);
          color: #8b5cf6;
          transform: scale(1.1);
        }

        
        .auth-section {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .auth-info {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: rgba(16, 185, 129, 0.1);
          border-radius: 10px;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        
        .user-info {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #10b981;
        }
        
        .user-name {
          font-size: 12px;
          font-weight: 500;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .btn-auth {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
          padding: 6px 10px;
          font-size: 11px;
        }
        
        .btn-auth:hover {
          background: rgba(239, 68, 68, 0.15);
          transform: translateY(-1px);
        }
        
        .btn-auth-login {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
          padding: 8px 16px;
        }
        
        .btn-auth-login:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
        }

        .help-controls {
          display: flex;
          align-items: center;
          margin-right: 12px;
        }

        .btn-help {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 8px;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }

        .btn-help:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
        }

        .zoom-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .zoom-label {
          font-size: 12px;
          font-weight: 500;
          color: #64748b;
          min-width: 40px;
          text-align: center;
        }

        .btn-zoom {
          background: transparent;
          color: #64748b;
          padding: 6px;
        }

        .btn-zoom:hover {
          background: rgba(99, 102, 241, 0.1);
          color: #6366f1;
          transform: translateY(-1px);
        }

        @media (max-width: 1024px) {
          .toolbar-content {
            flex-direction: column;
            gap: 8px;
          }

          .toolbar-left, .toolbar-center, .toolbar-right {
            width: 100%;
            justify-content: center;
          }

          .toolbar-center {
            flex-direction: column;
            gap: 6px;
          }
        }

        @media (max-width: 768px) {
          .toolbar-content {
            padding: 8px 12px;
          }

          .logo-text {
            display: none;
          }

          .btn {
            padding: 8px 12px;
            font-size: 13px;
          }

          .btn svg {
            width: 14px;
            height: 14px;
          }

          .title {
            font-size: 18px;
          }

          .action-group {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
};

export default Toolbar;