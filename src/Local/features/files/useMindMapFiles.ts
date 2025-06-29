// ファイル添付機能専用のカスタムフック (ローカルモード専用)
import { createFileAttachment } from '../../shared/types/dataTypes';
import { optimizeFile, formatFileSize } from './fileOptimization';
import { validateFile } from './fileValidation';
import { logger } from '../../shared/utils/logger';
import { getCurrentMindMap } from '../../core/storage/LocalEngine';
import { getAppSettings } from '../../core/storage/LocalEngine';

export const useMindMapFiles = (findNode, updateNode, currentMapId = null) => {
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
  const attachFileToNode = async (nodeId, file) => {
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
      const optimizationResult = await optimizeFile(file);
      
      // Base64エンコード
      const reader = new FileReader();
      const base64Data = await new Promise((resolve, reject) => {
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(optimizationResult.file);
      });
      
      // ファイル添付データ作成
      const fileAttachment = createFileAttachment(
        optimizationResult.file.name,
        optimizationResult.file.type,
        optimizationResult.file.size,
        base64Data
      );
      
      // 最適化情報を追加
      fileAttachment.originalSize = file.size;
      fileAttachment.optimizationApplied = optimizationResult.optimizationApplied;
      fileAttachment.compressionRatio = optimizationResult.compressionRatio;
      
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
      logger.error(`❌ ファイル添付失敗: ${error.message}`, {
        nodeId,
        fileName: file.name,
        error: error.message
      });
      throw error;
    }
  };

  // ファイル削除
  const removeFileFromNode = async (nodeId, fileId) => {
    const node = findNode(nodeId);
    if (!node) return;
    
    const updatedAttachments = (node.attachments || []).filter(
      attachment => attachment.id !== fileId
    );
    
    await updateNode(nodeId, { attachments: updatedAttachments });
    
    logger.info('🗑️ ファイル削除完了', {
      nodeId,
      fileId
    });
  };

  // 画像プレビュー取得（ローカルモード）
  const getImagePreview = (attachment) => {
    if (!attachment || !attachment.type?.startsWith('image/')) {
      return null;
    }
    
    // Base64データがある場合はそのまま返す
    if (attachment.data) {
      return attachment.data;
    }
    
    return null;
  };

  // ストレージ使用量計算
  const calculateStorageUsage = () => {
    const mindMap = getCurrentMindMap();
    if (!mindMap) return { used: 0, percentage: 0 };
    
    let totalSize = 0;
    const countFiles = (node) => {
      if (node.attachments) {
        node.attachments.forEach(attachment => {
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

  return {
    attachFileToNode,
    removeFileFromNode,
    getImagePreview,
    calculateStorageUsage
  };
};