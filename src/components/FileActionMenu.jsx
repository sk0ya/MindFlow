import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

const FileActionMenu = ({ 
  isOpen, 
  file, 
  position, 
  onClose, 
  onDownload, 
  onRename, 
  onDelete, 
  onView 
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const menuRef = useRef(null);
  const inputRef = useRef(null);

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        handleClose();
      }
    };

    const handleKeyDown = (event) => {
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
  }, [isOpen]);

  const handleClose = () => {
    setIsRenaming(false);
    onClose();
  };

  const handleRenameStart = () => {
    setIsRenaming(true);
  };

  const handleRenameSubmit = (e) => {
    e.preventDefault();
    const trimmedName = newFileName.trim();
    if (trimmedName && trimmedName !== file.name) {
      onRename(file.id, trimmedName);
    }
    setIsRenaming(false);
    handleClose();
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(e);
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  const handleRenameCancel = () => {
    setNewFileName(file.name);
    setIsRenaming(false);
  };

  const handleDownload = () => {
    onDownload(file);
    handleClose();
  };

  const handleDelete = () => {
    if (window.confirm(`「${file.name}」を削除しますか？`)) {
      onDelete(file.id);
      handleClose();
    }
  };

  const handleView = () => {
    onView(file);
    handleClose();
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
            <span className="action-icon">👁️</span>
            <span className="action-text">プレビュー</span>
          </button>
        )}
        
        <button
          className="file-action-item"
          onClick={handleDownload}
        >
          <span className="action-icon">💾</span>
          <span className="action-text">ダウンロード</span>
        </button>
        
        <button
          className="file-action-item"
          onClick={handleRenameStart}
        >
          <span className="action-icon">✏️</span>
          <span className="action-text">名前を変更</span>
        </button>
        
        <div className="file-action-separator"></div>
        
        <button
          className="file-action-item danger"
          onClick={handleDelete}
        >
          <span className="action-icon">🗑️</span>
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
const getFileIcon = (fileType) => {
  if (fileType.startsWith('image/')) {
    return '🖼️';
  }
  
  switch (fileType) {
    case 'text/plain':
      return '📄';
    case 'application/pdf':
      return '📕';
    case 'application/json':
      return '📋';
    default:
      return '📎';
  }
};

FileActionMenu.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  file: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    size: PropTypes.number.isRequired,
    dataURL: PropTypes.string,
    isImage: PropTypes.bool.isRequired
  }),
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onView: PropTypes.func.isRequired
};

export default FileActionMenu;