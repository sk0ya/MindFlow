// ファイル添付機能専用のカスタムフック
import { createFileAttachment } from '../utils/dataTypes.js';
import { optimizeFile, formatFileSize } from '../utils/fileOptimization.js';
import { validateFile } from '../utils/fileValidation.js';
import { logger } from '../utils/logger.js';

export const useMindMapFiles = (findNode, updateNode) => {
  // ファイル添付機能（セキュリティ強化・最適化対応）
  const attachFileToNode = async (nodeId, file) => {
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
      
      // 警告がある場合はログに記録
      if (validationResult.warnings.length > 0) {
        logger.warn(`ファイル添付の警告: ${validationResult.warnings.join(', ')}`, {
          nodeId,
          fileName: file.name,
          warnings: validationResult.warnings
        });
      }
      
      logger.info(`🔒 ファイルセキュリティ検証完了: ${file.name}`, {
        nodeId,
        validationPassed: true
      });
      
      // 2. ファイル最適化
      const optimizedFile = await optimizeFile(file);
      
      logger.info(`🔧 ファイル最適化完了: ${formatFileSize(optimizedFile.originalSize)} → ${formatFileSize(optimizedFile.optimizedSize)} (${optimizedFile.compressionRatio}% 削減)`, {
        nodeId,
        originalSize: optimizedFile.originalSize,
        optimizedSize: optimizedFile.optimizedSize,
        compressionRatio: optimizedFile.compressionRatio
      });
      
      // 3. ファイル添付作成
      const fileAttachment = createFileAttachment(file, optimizedFile.dataURL, null, {
        isOptimized: true,
        originalSize: optimizedFile.originalSize,
        optimizedSize: optimizedFile.optimizedSize,
        compressionRatio: optimizedFile.compressionRatio,
        optimizedType: optimizedFile.type,
        // セキュリティ情報を追加
        securityValidated: true,
        validationTimestamp: new Date().toISOString(),
        warnings: validationResult.warnings
      });
      
      const node = findNode(nodeId);
      
      if (node) {
        const updatedAttachments = [...(node.attachments || []), fileAttachment];
        updateNode(nodeId, { attachments: updatedAttachments });
        
        logger.info(`✅ ファイル添付完了: ${file.name}`, {
          nodeId,
          attachmentId: fileAttachment.id,
          finalSize: optimizedFile.optimizedSize
        });
        
        return fileAttachment.id;
      }
      
      throw new Error('対象ノードが見つかりません');
      
    } catch (error) {
      logger.error('❌ ファイル添付エラー', {
        nodeId,
        fileName: file.name,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  };
  
  const removeFileFromNode = (nodeId, fileId) => {
    const node = findNode(nodeId);
    if (node && node.attachments) {
      const updatedAttachments = node.attachments.filter(file => file.id !== fileId);
      updateNode(nodeId, { attachments: updatedAttachments });
    }
  };

  // ファイル名を変更
  const renameFileInNode = (nodeId, fileId, newName) => {
    const node = findNode(nodeId);
    if (node && node.attachments) {
      const updatedAttachments = node.attachments.map(file => 
        file.id === fileId ? { ...file, name: newName } : file
      );
      updateNode(nodeId, { attachments: updatedAttachments });
    }
  };

  // ファイルをダウンロード
  const downloadFile = async (file) => {
    try {
      if (!file.dataURL) {
        console.warn('ファイルのダウンロードデータが見つかりません', file);
        return;
      }

      // File System Access APIが利用可能かチェック
      if (window.showSaveFilePicker) {
        try {
          // ファイル拡張子を取得
          const extension = file.name.split('.').pop();
          const mimeType = file.type || 'application/octet-stream';

          // ファイル保存ダイアログを表示
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: file.name,
            types: [{
              description: `${extension.toUpperCase()} files`,
              accept: { [mimeType]: [`.${extension}`] }
            }]
          });

          // Base64データをBlobに変換
          const response = await fetch(file.dataURL);
          const blob = await response.blob();

          // ファイルに書き込み
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          return;
        } catch (saveError) {
          // ユーザーがキャンセルした場合やエラーが発生した場合
          if (saveError.name === 'AbortError') {
            return;
          }
          console.warn('File System Access API でのダウンロードに失敗:', saveError);
          // フォールバックに進む
        }
      }

      // フォールバック: 従来の方法（保存場所選択なし）
      const link = document.createElement('a');
      link.href = file.dataURL;
      link.download = file.name;
      
      // より確実にダウンロードを実行
      link.style.display = 'none';
      document.body.appendChild(link);
      
      // ダウンロード実行
      link.click();
      
      // クリーンアップ
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      }, 100);

    } catch (error) {
      console.error('ファイルダウンロードエラー:', error);
      throw error;
    }
  };

  return {
    attachFileToNode,
    removeFileFromNode,
    renameFileInNode,
    downloadFile
  };
};