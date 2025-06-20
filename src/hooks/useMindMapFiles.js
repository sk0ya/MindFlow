// ファイル添付機能専用のカスタムフック
import { createFileAttachment } from '../utils/dataTypes.js';
import { optimizeFile, formatFileSize } from '../utils/fileOptimization.js';
import { validateFile } from '../utils/fileValidation.js';
import { logger } from '../utils/logger.js';

export const useMindMapFiles = (findNode, updateNode) => {
  // ファイル添付機能（R2ストレージ対応）
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
      
      // 2. R2ストレージにアップロード
      const { authManager } = await import('../utils/authManager.js');
      const authHeader = authManager.getAuthHeader();
      
      if (!authHeader) {
        throw new Error('認証が必要です');
      }

      // 現在のマインドマップIDを取得
      const { getCurrentMindMap } = await import('../utils/storage.js');
      const currentMap = getCurrentMindMap();
      if (!currentMap) {
        throw new Error('現在のマインドマップが見つかりません');
      }

      // FormDataでファイルをアップロード
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch(`https://mindflow-api-production.shigekazukoya.workers.dev/api/files/${currentMap.id}/${nodeId}`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader
        },
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error(`ファイルアップロードに失敗しました: ${uploadResponse.statusText}`);
      }

      const uploadResult = await uploadResponse.json();
      
      logger.info(`☁️ R2アップロード完了: ${file.name}`, {
        nodeId,
        fileId: uploadResult.id,
        downloadUrl: uploadResult.downloadUrl
      });
      
      // 3. ローカルのノードに添付情報を追加
      const fileAttachment = createFileAttachment(file, uploadResult.downloadUrl, uploadResult.id, {
        isR2Storage: true,
        storagePath: uploadResult.storagePath,
        thumbnailPath: uploadResult.thumbnailPath,
        downloadUrl: uploadResult.downloadUrl,
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
          r2FileId: uploadResult.id
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
  
  const removeFileFromNode = async (nodeId, fileId) => {
    const node = findNode(nodeId);
    if (node && node.attachments) {
      const fileToRemove = node.attachments.find(file => file.id === fileId);
      
      // R2ストレージのファイルの場合、サーバーからも削除
      if (fileToRemove && fileToRemove.isR2Storage && fileToRemove.r2FileId) {
        try {
          const { authManager } = await import('../utils/authManager.js');
          const authHeader = authManager.getAuthHeader();
          
          if (authHeader) {
            const { getCurrentMindMap } = await import('../utils/storage.js');
            const currentMap = getCurrentMindMap();
            
            if (currentMap) {
              await fetch(
                `https://mindflow-api-production.shigekazukoya.workers.dev/api/files/${currentMap.id}/${nodeId}/${fileToRemove.r2FileId}`,
                {
                  method: 'DELETE',
                  headers: {
                    'Authorization': authHeader
                  }
                }
              );
            }
          }
        } catch (error) {
          console.warn('R2ファイル削除に失敗しましたが、ローカルからは削除します:', error);
        }
      }
      
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

  // ファイルをダウンロード（R2ストレージ対応）
  const downloadFile = async (file) => {
    try {
      // R2ストレージのファイルの場合
      if (file.isR2Storage && file.r2FileId) {
        // R2からダウンロードURLを取得
        const { authManager } = await import('../utils/authManager.js');
        const authHeader = authManager.getAuthHeader();
        
        if (!authHeader) {
          throw new Error('認証が必要です');
        }

        const { getCurrentMindMap } = await import('../utils/storage.js');
        const currentMap = getCurrentMindMap();
        if (!currentMap) {
          throw new Error('現在のマインドマップが見つかりません');
        }

        // ダウンロード用の署名付きURLを取得
        const downloadResponse = await fetch(
          `https://mindflow-api-production.shigekazukoya.workers.dev/api/files/${currentMap.id}/${file.nodeId || 'unknown'}/${file.r2FileId}?type=download`,
          {
            headers: {
              'Authorization': authHeader
            }
          }
        );

        if (!downloadResponse.ok) {
          throw new Error(`ダウンロードURLの取得に失敗しました: ${downloadResponse.statusText}`);
        }

        // リダイレクト先のURLでダウンロード
        const downloadUrl = downloadResponse.url;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = file.name;
        link.click();
        
        return;
      }

      // 従来のdataURL方式（後方互換性）
      if (!file.dataURL) {
        console.warn('ファイルのダウンロードデータが見つかりません', file);
        // ユーザーに分かりやすいエラーメッセージを表示
        alert(`ファイル「${file.name}」のダウンロードデータが見つかりません。\nこのファイルは古いバージョンで添付されたため、ダウンロードできない可能性があります。\n再度ファイルを添付し直してください。`);
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

  // ファイルの再添付（dataURLが欠損している場合の修復用）
  const reattachFile = async (nodeId, fileId) => {
    try {
      const node = findNode(nodeId);
      if (!node || !node.attachments) return false;
      
      const file = node.attachments.find(f => f.id === fileId);
      if (!file) return false;
      
      // ファイル再選択ダイアログを表示
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = file.type ? `${file.type}` : '*/*';
      
      return new Promise((resolve) => {
        input.onchange = async (e) => {
          const newFile = e.target.files[0];
          if (newFile && newFile.name === file.name) {
            try {
              // 既存ファイルを削除して新しいファイルを添付
              removeFileFromNode(nodeId, fileId);
              const newFileId = await attachFileToNode(nodeId, newFile);
              resolve(newFileId);
            } catch (error) {
              console.error('ファイル再添付エラー:', error);
              resolve(false);
            }
          } else {
            resolve(false);
          }
        };
        input.click();
      });
    } catch (error) {
      console.error('ファイル再添付処理エラー:', error);
      return false;
    }
  };

  return {
    attachFileToNode,
    removeFileFromNode,
    renameFileInNode,
    downloadFile,
    reattachFile
  };
};