import React, { useEffect, useCallback } from 'react';
import type { FileAttachment } from '../../../../shared/types';

interface ImageModalProps {
  isOpen: boolean;
  image: FileAttachment | null;
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ isOpen, image, onClose }) => {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
      };
    }
    
    return undefined;
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !image) {
    return null;
  }

  return (
    <div className="image-modal-overlay" onClick={handleBackdropClick}>
      <div className="image-modal-content">
        <button 
          className="image-modal-close"
          onClick={onClose}
          aria-label="画像を閉じる"
        >
          ×
        </button>
        <img 
          src={image.dataURL || image.data} 
          alt={image.name}
          className="image-modal-image"
        />
        <div className="image-modal-info">
          <p className="image-filename">{image.name}</p>
          <p className="image-filesize">{formatFileSize(image.size)}</p>
        </div>
      </div>

      <style>{`
        .image-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .image-modal-content {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: scaleIn 0.2s ease-out;
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .image-modal-close {
          position: absolute;
          top: -40px;
          right: -40px;
          background: rgba(255, 255, 255, 0.9);
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          z-index: 1001;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          color: #333;
        }

        .image-modal-close:hover {
          background: white;
          transform: scale(1.1);
        }

        .image-modal-image {
          max-width: 100%;
          max-height: calc(90vh - 80px);
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .image-modal-info {
          margin-top: 16px;
          text-align: center;
          color: white;
          background: rgba(0, 0, 0, 0.7);
          padding: 8px 16px;
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }

        .image-filename {
          margin: 0 0 4px 0;
          font-size: 14px;
          font-weight: 500;
        }

        .image-filesize {
          margin: 0;
          font-size: 12px;
          opacity: 0.8;
        }

        @media (max-width: 768px) {
          .image-modal-overlay {
            padding: 10px;
          }

          .image-modal-close {
            top: -30px;
            right: -30px;
            width: 28px;
            height: 28px;
            font-size: 16px;
          }

          .image-modal-image {
            max-height: calc(90vh - 60px);
          }

          .image-modal-info {
            margin-top: 12px;
            padding: 6px 12px;
          }

          .image-filename {
            font-size: 13px;
          }

          .image-filesize {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
};

// ファイルサイズのフォーマット関数
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};


export default ImageModal;