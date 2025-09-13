import React, { createContext, useContext, useCallback, useState, ReactNode } from 'react';
import { X } from 'lucide-react';
import { useNotification } from './useNotification';
import { logger } from '../utils/logger';

export interface UploadProgress {
  id: string;
  fileName: string;
  progress: number; // 0-100
  status: 'uploading' | 'completed' | 'error' | 'cancelled';
  error?: string;
  startTime: number;
  endTime?: number;
}

export interface FileUploadContextType {
  uploads: UploadProgress[];
  startUpload: (id: string, fileName: string) => void;
  updateProgress: (id: string, progress: number) => void;
  completeUpload: (id: string) => void;
  errorUpload: (id: string, error: string) => void;
  cancelUpload: (id: string) => void;
  clearCompletedUploads: () => void;
}

const FileUploadContext = createContext<FileUploadContextType | undefined>(undefined);

interface FileUploadProviderProps {
  children: ReactNode;
}

// プログレスバーのスタイル
const ProgressBarComponent: React.FC<{ upload: UploadProgress; onCancel: () => void }> = ({ upload, onCancel }) => {
  const progressBarStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '300px',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: 9998,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  };

  const fileNameStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '200px',
  };

  const cancelButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#666',
    cursor: 'pointer',
    fontSize: '18px',
    padding: '0',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const progressContainerStyle: React.CSSProperties = {
    width: '100%',
    height: '6px',
    backgroundColor: '#f0f0f0',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '8px',
  };

  const progressBarInnerStyle: React.CSSProperties = {
    height: '100%',
    backgroundColor: upload.status === 'error' ? '#f44336' : 
                     upload.status === 'completed' ? '#4CAF50' : '#2196F3',
    width: `${upload.progress}%`,
    transition: 'width 0.3s ease',
  };

  const statusStyle: React.CSSProperties = {
    fontSize: '12px',
    color: upload.status === 'error' ? '#f44336' : 
           upload.status === 'completed' ? '#4CAF50' : '#666',
  };

  const getStatusText = () => {
    switch (upload.status) {
      case 'uploading':
        return `アップロード中... ${upload.progress}%`;
      case 'completed':
        return 'アップロード完了';
      case 'error':
        return `エラー: ${upload.error}`;
      case 'cancelled':
        return 'キャンセルされました';
      default:
        return '';
    }
  };

  return (
    <div style={progressBarStyle}>
      <div style={headerStyle}>
        <div style={fileNameStyle} title={upload.fileName}>
          {upload.fileName}
        </div>
        {upload.status === 'uploading' && (
          <button style={cancelButtonStyle} onClick={onCancel} title="キャンセル">
<X size={16} />
          </button>
        )}
      </div>
      <div style={progressContainerStyle}>
        <div style={progressBarInnerStyle} />
      </div>
      <div style={statusStyle}>
        {getStatusText()}
      </div>
    </div>
  );
};

export const FileUploadProvider: React.FC<FileUploadProviderProps> = ({ children }) => {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const { showNotification } = useNotification();

  const startUpload = useCallback((id: string, fileName: string) => {
    const newUpload: UploadProgress = {
      id,
      fileName,
      progress: 0,
      status: 'uploading',
      startTime: Date.now(),
    };

    setUploads(prev => [...prev.filter(u => u.id !== id), newUpload]);
    logger.info('Upload started:', { id, fileName });
  }, []);

  const updateProgress = useCallback((id: string, progress: number) => {
    setUploads(prev => prev.map(upload =>
      upload.id === id
        ? { ...upload, progress: Math.min(100, Math.max(0, progress)) }
        : upload
    ));
  }, []);

  const completeUpload = useCallback((id: string) => {
    setUploads(prev => {
      const updatedUploads = prev.map(upload =>
        upload.id === id
          ? { ...upload, progress: 100, status: 'completed' as const, endTime: Date.now() }
          : upload
      );
      
      const upload = updatedUploads.find(u => u.id === id);
      if (upload) {
        logger.info('Upload completed:', { id, fileName: upload.fileName });
        
        // 1秒後に完了したアップロードを自動で削除
        setTimeout(() => {
          setUploads(current => current.filter(u => u.id !== id));
        }, 1000);
      }
      
      return updatedUploads;
    });
  }, []);

  const errorUpload = useCallback((id: string, error: string) => {
    setUploads(prev => prev.map(upload =>
      upload.id === id
        ? { ...upload, status: 'error', error, endTime: Date.now() }
        : upload
    ));

    const upload = uploads.find(u => u.id === id);
    if (upload) {
      logger.error('Upload failed:', { id, fileName: upload.fileName, error });
      
      // 5秒後にエラーしたアップロードを自動で削除
      setTimeout(() => {
        setUploads(prev => prev.filter(u => u.id !== id));
      }, 5000);
    }
  }, [uploads]);

  const cancelUpload = useCallback((id: string) => {
    setUploads(prev => prev.map(upload =>
      upload.id === id
        ? { ...upload, status: 'cancelled', endTime: Date.now() }
        : upload
    ));

    const upload = uploads.find(u => u.id === id);
    if (upload) {
      showNotification('info', `${upload.fileName} のアップロードをキャンセルしました`);
      logger.info('Upload cancelled:', { id, fileName: upload.fileName });
      
      // 2秒後にキャンセルしたアップロードを削除
      setTimeout(() => {
        setUploads(prev => prev.filter(u => u.id !== id));
      }, 2000);
    }
  }, [uploads, showNotification]);

  const clearCompletedUploads = useCallback(() => {
    setUploads(prev => prev.filter(upload => 
      upload.status === 'uploading'
    ));
  }, []);

  // 現在進行中のアップロードのプログレスバーを表示
  const activeUploads = uploads.filter(upload => 
    upload.status === 'uploading' || 
    (upload.status === 'completed' && (Date.now() - (upload.endTime || 0)) < 3000) ||
    (upload.status === 'error' && (Date.now() - (upload.endTime || 0)) < 5000) ||
    (upload.status === 'cancelled' && (Date.now() - (upload.endTime || 0)) < 2000)
  );

  return (
    <FileUploadContext.Provider value={{
      uploads,
      startUpload,
      updateProgress,
      completeUpload,
      errorUpload,
      cancelUpload,
      clearCompletedUploads,
    }}>
      {children}
      {activeUploads.map((upload, index) => (
        <div key={upload.id} style={{ bottom: `${20 + index * 120}px`, position: 'fixed' }}>
          <ProgressBarComponent
            upload={upload}
            onCancel={() => cancelUpload(upload.id)}
          />
        </div>
      ))}
    </FileUploadContext.Provider>
  );
};

export const useFileUpload = (): FileUploadContextType => {
  const context = useContext(FileUploadContext);
  if (!context) {
    throw new Error('useFileUpload must be used within a FileUploadProvider');
  }
  return context;
};

// ファイルアップロード用のヘルパー関数
export const createUploadId = (fileName: string): string => {
  return `upload_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}`;
};

// プログレス計算用のヘルパー関数
export const calculateUploadProgress = (loaded: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((loaded / total) * 100);
};