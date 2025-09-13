import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Eye, Download, Edit3, Trash2, Image, FileText, File, BarChart3, Archive, Paperclip } from 'lucide-react';
import type { FileAttachment } from '@shared/types';

interface Position {
  x: number;
  y: number;
}

interface FileActionMenuProps {
  isOpen: boolean;
  file: FileAttachment | null;
  position: Position;
  onClose: () => void;
  onDownload: (_file: FileAttachment) => void;
  onRename: (_fileId: string, _newName: string) => void;
  onDelete: (_fileId: string) => void;
  onView: (_file: FileAttachment) => void;
}

const FileActionMenu: React.FC<FileActionMenuProps> = ({ 
  isOpen, 
  file, 
  position, 
  onClose, 
  onDownload, 
  onRename, 
  onDelete, 
  onView 
}) => {
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && file) {
      setNewFileName(file.name);
    }
  }, [isOpen, file]);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      // ファイル名の拡張子前までを選択
      const dotIndex = newFileName.lastIndexOf('.');
      if (dotIndex > 0) {
        inputRef.current.setSelectionRange(0, dotIndex);
      } else {
        inputRef.current.select();
      }
    }
  }, [isRenaming, newFileName]);

  const handleClose = useCallback(() => {
    setIsRenaming(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
    
    return undefined;
  }, [isOpen, handleClose]);

  const handleRenameStart = () => {
    setIsRenaming(true);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newFileName.trim();
    if (file && trimmedName && trimmedName !== file.name) {
      onRename(file.id, trimmedName);
    }
    setIsRenaming(false);
    handleClose();
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(e);
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  const handleRenameCancel = () => {
    setNewFileName(file?.name || '');
    setIsRenaming(false);
  };

  const handleDownload = () => {
    if (file) {
      onDownload(file);
      handleClose();
    }
  };

  const handleDelete = () => {
    // eslint-disable-next-line no-alert
    if (file && window.confirm(`「${file.name}」を削除しますか？`)) {
      onDelete(file.id);
      handleClose();
    }
  };

  const handleView = () => {
    if (file) {
      // 先にメニューを閉じてからプレビューを開く
      handleClose();
      // 少し遅延してからプレビューを開く
      setTimeout(() => {
        onView(file);
      }, 50);
    }
  };

  if (!isOpen || !file) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="file-action-menu"
      style={{
        left: position.x,
        top: position.y
      }}
    >
      <div className="file-action-header">
        <span className="file-icon">{getFileIcon(file.type)}</span>
        {isRenaming ? (
          <form onSubmit={handleRenameSubmit} className="rename-form">
            <input
              ref={inputRef}
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              className="rename-input"
              onBlur={handleRenameCancel}
            />
          </form>
        ) : (
          <span className="file-name" title={file.name}>
            {file.name.length > 25 ? file.name.substring(0, 25) + '...' : file.name}
          </span>
        )}
      </div>
      
      <div className="file-action-separator"></div>
      
      <div className="file-action-list">
        {file.isImage && (
          <button
            className="file-action-item"
            onClick={handleView}
          >
            <span className="action-icon"><Eye size={14} /></span>
            <span className="action-text">プレビュー</span>
          </button>
        )}
        
        <button
          className="file-action-item"
          onClick={handleDownload}
        >
          <span className="action-icon"><Download size={14} /></span>
          <span className="action-text">ダウンロード</span>
        </button>
        
        <button
          className="file-action-item"
          onClick={handleRenameStart}
        >
          <span className="action-icon"><Edit3 size={14} /></span>
          <span className="action-text">名前を変更</span>
        </button>
        
        <div className="file-action-separator"></div>
        
        <button
          className="file-action-item danger"
          onClick={handleDelete}
        >
          <span className="action-icon"><Trash2 size={14} /></span>
          <span className="action-text">削除</span>
        </button>
      </div>

      <style>{`
        .file-action-menu {
          position: fixed;
          background: white;
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          border: 1px solid #e1e5e9;
          min-width: 200px;
          z-index: 1000;
          overflow: hidden;
          animation: menuSlideIn 0.15s ease-out;
        }

        @keyframes menuSlideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-5px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .file-action-header {
          padding: 12px 16px;
          background: #f8f9fa;
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 1px solid #e1e5e9;
        }

        .file-icon {
          font-size: 16px;
          flex-shrink: 0;
        }

        .file-name {
          font-weight: 500;
          color: #333;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rename-form {
          flex: 1;
        }

        .rename-input {
          width: 100%;
          border: 1px solid #4285f4;
          border-radius: 4px;
          padding: 4px 6px;
          font-size: 13px;
          outline: none;
          background: white;
        }

        .file-action-separator {
          height: 1px;
          background: #e1e5e9;
          margin: 0;
        }

        .file-action-list {
          padding: 4px 0;
        }

        .file-action-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 16px;
          border: none;
          background: none;
          text-align: left;
          cursor: pointer;
          transition: background-color 0.1s ease;
          font-size: 14px;
        }

        .file-action-item:hover {
          background: #f5f5f5;
        }

        .file-action-item.danger:hover {
          background: #fef2f2;
          color: #dc2626;
        }

        .action-icon {
          font-size: 14px;
          width: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .action-text {
          color: #333;
        }

        .file-action-item.danger .action-text {
          color: #dc2626;
        }

        @media (max-width: 768px) {
          .file-action-menu {
            min-width: 180px;
          }

          .file-action-header {
            padding: 10px 14px;
          }

          .file-action-item {
            padding: 10px 14px;
            font-size: 15px;
          }

          .action-icon {
            font-size: 16px;
            width: 18px;
          }
        }
      `}</style>
    </div>
  );
};

// ファイルタイプに基づいたアイコンを取得
const getFileIcon = (fileType: string): React.ReactNode => {
  if (fileType.startsWith('image/')) {
    return <Image size={16} />;
  }
  
  switch (fileType) {
    case 'text/plain':
      return <FileText size={16} />;
    case 'application/pdf':
      return <FileText size={16} />;
    case 'application/json':
      return <File size={16} />;
    case 'application/vnd.ms-excel':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return <BarChart3 size={16} />;
    default:
      if (fileType.includes('zip') || fileType.includes('rar')) {
        return <Archive size={16} />;
      }
      return <Paperclip size={16} />;
  }
};


export default FileActionMenu;