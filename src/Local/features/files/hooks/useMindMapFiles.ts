// ファイル添付機能専用のカスタムフック (ローカルモード専用)
import { createFileAttachment, FileAttachment } from '../../../shared/types/dataTypes';
import { optimizeFile, formatFileSize } from '../utils/fileOptimization';
import { validateFile } from '../utils/fileValidation';
import { logger } from '../../../shared/utils/logger';
import { getCurrentMindMap } from '../../../core/storage/LocalEngine';
import { MindMapNode } from '../../../../shared/types';

interface NodeUpdates {
  attachments?: FileAttachment[];
  [key: string]: unknown;
}

export const useMindMapFiles = (findNode: (_nodeId: string) => MindMapNode | null, updateNode: (_nodeId: string, _updates: NodeUpdates) => void, currentMapId: string | null = null) => {
  // アプリ初期化状態をチェック
  const isAppInitializing = () => {
    const initializing = !currentMapId;
    
    if (initializing) {
      console.log('🔄 アプリ初期化状態:', {
        currentMapId,
        isInitializing: initializing
      });
    }
    
    return initializing;
  };

  // ファイル添付機能（ローカルストレージ専用）
  const attachFileToNode = async (nodeId: string, file: File): Promise<FileAttachment> => {
    // アプリ初期化中はファイルアップロードを無効化
    if (isAppInitializing()) {
      throw new Error('アプリケーションを初期化中です。数秒お待ちいただいてからもう一度お試しください。');
    }
    
    try {
      logger.info(`📎 ファイル添付開始: ${file.name} (${formatFileSize(file.size)})`, {
        nodeId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });
      
      // 1. セキュリティ検証
      const validationResult = await validateFile(file);
      
      if (!validationResult.isValid) {
        const errorMessage = `ファイル検証エラー: ${validationResult.errors.join(', ')}`;
        logger.error(errorMessage, {
          nodeId,
          fileName: file.name,
          errors: validationResult.errors
        });
        throw new Error(errorMessage);
      }
      
      logger.info(`🔒 ファイルセキュリティ検証完了: ${file.name}`, {
        nodeId,
        validationPassed: true
      });
      
      // 2. ローカルモード: Base64エンコードで保存
      console.log('💾 ローカルモード: Base64エンコードで保存');
      
      // ファイル最適化
      const optimizationResult = await optimizeFile(file) as {
        file: File;
        dataURL: string;
        originalSize: number;
        optimizedSize: number;
        compressionRatio: string;
        optimizationApplied: boolean;
        type: string;
        dimensions?: { width: number; height: number };
      };
      
      // Base64エンコード
      const reader = new FileReader();
      const base64Data = await new Promise((resolve, reject) => {
        reader.onload = e => {
          if (!e.target?.result) {
            reject(new Error('Failed to read file'));
            return;
          }
          resolve(e.target.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(optimizationResult.file);
      });
      
      // ファイル添付データ作成
      const fileAttachment = createFileAttachment(
        optimizationResult.file,
        base64Data as string,
        null,
        null
      );
      
      // 最適化情報をファイル添付に追加（後から設定）
      fileAttachment.isOptimized = optimizationResult.optimizationApplied;
      fileAttachment.originalSize = file.size;
      fileAttachment.optimizedSize = optimizationResult.optimizedSize;
      fileAttachment.compressionRatio = optimizationResult.compressionRatio;
      fileAttachment.optimizedType = optimizationResult.type;
      
      // ノードに添付
      const node = findNode(nodeId);
      if (!node) {
        throw new Error('ノードが見つかりません');
      }
      
      const updatedAttachments = [...(node.attachments || []), fileAttachment];
      await updateNode(nodeId, { attachments: updatedAttachments });
      
      logger.info(`✅ ファイル添付完了: ${file.name}`, {
        nodeId,
        fileName: file.name,
        fileSize: formatFileSize(optimizationResult.file.size),
        originalSize: formatFileSize(file.size),
        optimized: optimizationResult.optimizationApplied
      });
      
      return fileAttachment;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ ファイル添付失敗: ${errorMessage}`, {
        nodeId,
        fileName: file.name,
        error: errorMessage
      });
      throw error;
    }
  };

  // ファイル削除
  const removeFileFromNode = async (nodeId: string, fileId: string): Promise<void> => {
    const node = findNode(nodeId);
    if (!node) return;
    
    const updatedAttachments = (node.attachments || []).filter(
      (attachment: FileAttachment) => attachment.id !== fileId
    );
    
    await updateNode(nodeId, { attachments: updatedAttachments });
    
    logger.info('🗑️ ファイル削除完了', {
      nodeId,
      fileId
    });
  };

  // 画像プレビュー取得（ローカルモード）
  const getImagePreview = (attachment: FileAttachment) => {
    if (!attachment || !attachment.type?.startsWith('image/')) {
      return null;
    }
    
    // Base64データがある場合はそのまま返す
    if (attachment.dataURL) {
      return attachment.dataURL;
    }
    
    return null;
  };

  // ストレージ使用量計算
  const calculateStorageUsage = () => {
    const mindMap = getCurrentMindMap();
    if (!mindMap) return { used: 0, percentage: 0 };
    
    let totalSize = 0;
    const countFiles = (node: MindMapNode) => {
      if (node.attachments) {
        node.attachments.forEach((attachment: FileAttachment) => {
          totalSize += attachment.size || 0;
        });
      }
      if (node.children) {
        node.children.forEach(countFiles);
      }
    };
    
    countFiles(mindMap.rootNode);
    
    const maxSize = 10 * 1024 * 1024; // 10MB制限
    const percentage = (totalSize / maxSize) * 100;
    
    return {
      used: totalSize,
      percentage: Math.min(percentage, 100)
    };
  };

  // ファイル名変更（現在は未実装）
  const renameFileInNode = async (nodeId: string, fileId: string, newName: string): Promise<void> => {
    const node = findNode(nodeId);
    if (!node) return;
    
    const updatedAttachments = (node.attachments || []).map((attachment: FileAttachment) => {
      if (attachment.id === fileId) {
        return { ...attachment, name: newName };
      }
      return attachment;
    });
    
    await updateNode(nodeId, { attachments: updatedAttachments });
    
    logger.info('✏️ ファイル名変更完了', {
      nodeId,
      fileId,
      newName
    });
  };

  // ファイルダウンロード（ローカルモード）
  const downloadFile = (attachment: FileAttachment): void => {
    if (!attachment || !attachment.dataURL) return;
    
    try {
      const link = document.createElement('a');
      link.href = attachment.dataURL;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      logger.info('📥 ファイルダウンロード開始', {
        fileName: attachment.name,
        fileSize: attachment.size
      });
    } catch (error) {
      logger.error('❌ ファイルダウンロード失敗', {
        fileName: attachment.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  return {
    attachFileToNode,
    removeFileFromNode,
    renameFileInNode,
    downloadFile,
    getImagePreview,
    calculateStorageUsage,
    isAppInitializing
  };
};