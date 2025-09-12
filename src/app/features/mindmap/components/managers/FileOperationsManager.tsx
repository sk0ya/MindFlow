import React from 'react';
import { logger } from '../../../../shared/utils/logger';
import { validateFile } from '../../../../shared/types/dataTypes';
import { findNodeById } from '../../../../shared/utils/nodeTreeUtils';
import type { MindMapData, MindMapNode, FileAttachment } from '@shared/types';
import type { StorageConfig } from '../../../../core/storage/types';

interface FileOperationsManagerProps {
  data: MindMapData | null;
  storageMode: 'local' | 'cloud';
  storageConfig: StorageConfig;
  auth: any;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  applyAutoLayout: () => void;
  showNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  handleError: (error: Error, context: string, operation: string) => void;
  handleAsyncError: (asyncFn: () => Promise<void>, context: string, operation: string) => Promise<void>;
  retryableUpload: (key: string, fileName: string, uploadFn: () => Promise<FileAttachment>) => Promise<FileAttachment>;
  clearUploadState: (key: string) => void;
}

export const useFileOperationsManager = ({
  data,
  storageMode,
  storageConfig,
  auth,
  updateNode,
  applyAutoLayout,
  showNotification,
  handleError,
  handleAsyncError,
  retryableUpload,
  clearUploadState,
}: FileOperationsManagerProps) => {
  
  // ファイルアップロードハンドラー（クラウド対応）
  const handleFileUpload = React.useCallback(async (nodeId: string, file: File): Promise<void> => {
    if (!data) {
      handleError(new Error('マインドマップデータが利用できません'), 'ファイルアップロード', 'データチェック');
      return;
    }

    // ファイルバリデーション
    const validationErrors = validateFile(file);
    if (validationErrors.length > 0) {
      validationErrors.forEach((error: string) => showNotification('error', error));
      return;
    }

    const uploadKey = `${nodeId}_${file.name}_${Date.now()}`;
    
    try {
      await handleAsyncError(async () => {
        const fileAttachment = await retryableUpload(
          uploadKey,
          file.name,
          async (): Promise<FileAttachment> => {
            if (storageMode === 'cloud') {
              // クラウドモード: APIにアップロードしてCloudflareに保存
              logger.info('Uploading file to cloud storage...', { 
                fileName: file.name, 
                fileSize: file.size, 
                fileType: file.type,
                nodeId,
                mapId: data.id
              });
              
              // CloudStorageAdapterを直接使用
              const { CloudStorageAdapter } = await import('../../../../core/storage/adapters/CloudStorageAdapter');
              logger.debug('CloudStorageAdapter imported successfully');
              
              if (!auth) {
                logger.error('Authentication not available for cloud upload');
                throw new Error('クラウドファイルアップロードには認証が必要です');
              }
              
              logger.info('🚀 Cloud mode file upload starting...', {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                nodeId: nodeId,
                mapId: data?.id,
                hasAuth: !!auth,
                hasAuthAdapter: !!auth.authAdapter,
                isAuthenticated: auth.authAdapter?.isAuthenticated,
                userId: auth.authAdapter?.user?.id
              });
              
              const storageAdapter = new CloudStorageAdapter(auth.authAdapter);
              logger.debug('CloudStorageAdapter created, initializing...');
              
              await storageAdapter.initialize();
              logger.debug('CloudStorageAdapter initialized');
              
              if (typeof storageAdapter.uploadFile === 'function') {
                logger.debug('Calling uploadFile method...');
                const uploadResult = await storageAdapter.uploadFile(data.id, nodeId, file);
                logger.debug('Upload result received:', uploadResult);
                
                const fileAttachment = {
                  id: uploadResult.id,
                  name: uploadResult.fileName,
                  type: uploadResult.mimeType,
                  size: uploadResult.fileSize,
                  isImage: uploadResult.attachmentType === 'image',
                  createdAt: uploadResult.uploadedAt,
                  downloadUrl: uploadResult.downloadUrl,
                  storagePath: uploadResult.storagePath,
                  r2FileId: uploadResult.id,
                  nodeId: nodeId // nodeIdも保存
                };
                logger.info('File uploaded to cloud successfully:', fileAttachment);
                return fileAttachment;
              } else {
                logger.error('uploadFile method not available on storage adapter');
                throw new Error('Cloud storage adapter not available or uploadFile method missing');
              }
            } else {
              // ローカルモード: Base64エンコードしてローカル保存
              logger.debug('Processing file for local storage...');
              
              const reader = new FileReader();
              const dataURL = await new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });

              const fileAttachment = {
                id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: file.name,
                type: file.type,
                size: file.size,
                isImage: file.type.startsWith('image/'),
                createdAt: new Date().toISOString(),
                dataURL: dataURL,
                data: dataURL.split(',')[1] // Base64 part only
              };
              logger.debug('File processed for local storage:', fileAttachment.name);
              return fileAttachment;
            }
          }
        );
        
        // ノードにファイルを添付
        const node = data?.rootNode && findNodeById(data.rootNode, nodeId);
        if (node) {
          logger.info('📎 Attaching file to node...', {
            nodeId,
            fileName: fileAttachment.name,
            hasDownloadUrl: !!fileAttachment.downloadUrl,
            hasDataURL: !!fileAttachment.dataURL,
            existingAttachments: node.attachments?.length || 0
          });
          
          const updatedNode = {
            ...node,
            attachments: [...(node.attachments || []), fileAttachment]
          };
          updateNode(nodeId, updatedNode);
          logger.info('✅ File attached to node successfully:', {
            nodeId,
            fileName: fileAttachment.name,
            totalAttachments: updatedNode.attachments.length
          });
          
          // ファイル添付後に自動整列を実行
          if (typeof applyAutoLayout === 'function') {
            logger.debug('🎯 Applying auto layout after file attachment');
            requestAnimationFrame(() => {
              applyAutoLayout();
            });
          }
        } else {
          throw new Error(`ノードが見つかりません: ${nodeId}`);
        }
      }, 'ファイルアップロード', `${file.name}のアップロード`);
      
      // 成功時は自動削除に任せる（useFileUploadで1秒後に削除される）
      logger.debug('Upload completed successfully, waiting for auto-cleanup');
    } catch (error) {
      // エラー時のみ即座にクリア
      clearUploadState(uploadKey);
      logger.debug('Upload state cleared due to error:', uploadKey);
      throw error;
    }
  }, [data, storageMode, auth, updateNode, applyAutoLayout, showNotification, handleError, handleAsyncError, retryableUpload, clearUploadState]);

  // ファイルダウンロードハンドラー
  const handleFileDownload = React.useCallback(async (file: FileAttachment): Promise<void> => {
    try {
      let downloadUrl: string;
      const fileName = file.name;

      if (storageMode === 'cloud' && (file.r2FileId || file.id)) {
        // クラウドモード: APIを使用してファイルをダウンロード
        const fileId = file.r2FileId || file.id; // 古いファイルとの互換性
        logger.info('Downloading file from cloud storage...', { 
          fileName: file.name, 
          fileId: fileId,
          nodeId: file.nodeId,
          mapId: data?.id
        });

        if (!data) {
          throw new Error('マインドマップデータが利用できません');
        }

        if (!auth || !auth.authAdapter) {
          throw new Error('クラウドファイルダウンロードには認証が必要です');
        }

        // CloudStorageAdapterを直接使用してファイルをダウンロード
        const { CloudStorageAdapter } = await import('../../../../core/storage/adapters/CloudStorageAdapter');
        const storageAdapter = new CloudStorageAdapter(auth.authAdapter);
        
        await storageAdapter.initialize();
        
        if (typeof storageAdapter.downloadFile === 'function') {
          logger.debug('Calling downloadFile method...');
          const blob = await storageAdapter.downloadFile(data.id, file.nodeId || '', fileId);
          logger.debug('Download blob received:', { size: blob.size, type: blob.type });
          
          // BlobからダウンロードURLを作成
          downloadUrl = URL.createObjectURL(blob);
          logger.info('File downloaded from cloud successfully');
        } else {
          logger.error('downloadFile method not available on storage adapter');
          throw new Error('Cloud storage adapter downloadFile method not available');
        }
      } else if (file.data) {
        // ローカルモード: Base64データから直接使用
        downloadUrl = `data:${file.type};base64,${file.data}`;
      } else if (file.dataURL) {
        // 後方互換性: dataURLを使用
        downloadUrl = file.dataURL;
      } else if (storageMode === 'cloud' && file.downloadUrl) {
        // 古いクラウドファイル: downloadUrlを直接使用（認証なし、古い形式）
        logger.info('Using legacy downloadUrl for old cloud file');
        downloadUrl = file.downloadUrl;
      } else {
        logger.error('No download data found in file:', file);
        throw new Error('ダウンロード可能なファイルデータが見つかりません');
      }

      // ダウンロードを実行
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // BlobURLを使用した場合はメモリを解放
      if (downloadUrl.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
      }

      logger.info('File download completed successfully:', fileName);
    } catch (error) {
      logger.error('File download failed:', error);
      showNotification('error', `${file.name} のダウンロードに失敗しました`);
      handleError(error as Error, 'ファイルダウンロード', file.name);
    }
  }, [data, storageMode, auth, showNotification, handleError]);

  // ファイル削除ハンドラー
  const handleFileDelete = React.useCallback(async (nodeId: string, fileId: string): Promise<void> => {
    try {
      if (!data) {
        throw new Error('マインドマップデータが利用できません');
      }

      const node = findNodeById(data.rootNode, nodeId);
      if (!node || !node.attachments) {
        throw new Error('ノードまたは添付ファイルが見つかりません');
      }

      const fileToDelete = node.attachments.find(file => file.id === fileId);
      if (!fileToDelete) {
        throw new Error('削除するファイルが見つかりません');
      }

      // クラウドモードの場合はサーバーからも削除
      if (storageMode === 'cloud' && (fileToDelete.r2FileId || fileToDelete.id)) {
        const fileIdForDeletion = fileToDelete.r2FileId || fileToDelete.id;
        logger.info('Deleting file from cloud storage...', { 
          fileName: fileToDelete.name, 
          fileId: fileIdForDeletion,
          nodeId: nodeId,
          mapId: data.id
        });

        // ストレージアダプターを直接作成
        const { createStorageAdapter } = await import('../../../../core/storage/StorageAdapterFactory');
        const adapter = await createStorageAdapter(storageConfig);
        if (adapter && 'deleteFile' in adapter && typeof adapter.deleteFile === 'function') {
          await adapter.deleteFile(data.id, nodeId, fileIdForDeletion);
          logger.info('File deleted from cloud storage successfully');
        }
      }

      // ノードから添付ファイルを削除
      const updatedAttachments = node.attachments.filter(file => file.id !== fileId);
      const updatedNode = {
        ...node,
        attachments: updatedAttachments
      };

      updateNode(nodeId, updatedNode);
      showNotification('success', `${fileToDelete.name} を削除しました`);
      logger.debug('File deleted from node:', { nodeId, fileId, fileName: fileToDelete.name });
    } catch (error) {
      logger.error('File delete failed:', error);
      showNotification('error', 'ファイルの削除に失敗しました');
      handleError(error as Error, 'ファイル削除', fileId);
    }
  }, [data, storageMode, storageConfig, updateNode, showNotification, handleError]);

  return {
    handleFileUpload,
    handleFileDownload,
    handleFileDelete,
  };
};