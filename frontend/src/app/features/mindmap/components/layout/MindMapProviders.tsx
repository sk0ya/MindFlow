import React from 'react';
import { NotificationProvider } from '../../../../shared/hooks/useNotification';
import { ErrorHandlerProvider } from '../../../../shared/hooks/useErrorHandler';
import { FileUploadProvider } from '../../../../shared/hooks/useFileUpload';

interface MindMapProvidersProps {
  children: React.ReactNode;
}

const MindMapProviders: React.FC<MindMapProvidersProps> = ({ children }) => {
  return (
    <NotificationProvider>
      <ErrorHandlerProvider>
        <FileUploadProvider>
          {children}
        </FileUploadProvider>
      </ErrorHandlerProvider>
    </NotificationProvider>
  );
};

export default MindMapProviders;