// 新しいDataManagerベースのファイル操作フック
import { createFileAttachment } from '../utils/dataTypes.js';
import { optimizeFile, formatFileSize } from '../utils/fileOptimization.js';
import { validateFile } from '../utils/fileValidation.js';
import { logger } from '../utils/logger.js';

export const useMindMapFiles = (findNode, dataOperations, currentMapId = null) => {
  // アプリ初期化状態をチェック
  const isAppInitializing = () => {
    const initializing = !currentMapId;
    
    if (initializing) {
      console.log('🔄 FilesV2: アプリ初期化状態:', {
        currentMapId,
        isInitializing: initializing
      });
    }
    
    return initializing;
  };

  // ファイル添付機能（統一処理）
  const attachFileToNode = async (nodeId, file) => {
    // アプリ初期化中はファイルアップロードを無効化
    if (isAppInitializing()) {
      throw new Error('アプリケーションの初期化が完了していません。少しお待ちください。');
    }
    
    try {
      logger.info(`📎 FilesV2: ファイル添付開始: ${file.name} (${formatFileSize(file.size)})`, {
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
      
      logger.info(`🔒 FilesV2: ファイルセキュリティ検証完了: ${file.name}`, {
        nodeId,
        validationPassed: true
      });
      
      // 2. ストレージモードに応じたファイル保存
      const { isCloudStorageEnabled } = await import('../utils/storageRouter.js');
      const { getAppSettings } = await import('../utils/storage.js');
      
      const settings = getAppSettings();
      const isCloudMode = isCloudStorageEnabled();
      
      console.log('📂 FilesV2: ストレージモード確認:', {
        storageMode: settings.storageMode,
        isCloudMode,
        settings
      });
      
      let fileAttachment;
      
      if (isCloudMode) {
        // クラウドモード: R2ストレージにアップロード
        console.log('☁️ FilesV2: クラウドモード - R2ストレージにアップロード');
        fileAttachment = await handleCloudFileUpload(nodeId, file, validationResult);
      } else {
        // ローカルモード: Base64でローカルストレージに保存
        console.log('🏠 FilesV2: ローカルモード - Base64でローカル保存');
        fileAttachment = await handleLocalFileUpload(nodeId, file, validationResult);
      }
      
      // 3. DataManager経由でファイル添付
      const result = await dataOperations.attachFile(nodeId, fileAttachment);
      
      if (result.success) {
        logger.info(`✅ FilesV2: ファイル添付完了: ${file.name}`, {
          nodeId,
          attachmentId: fileAttachment.id,
          storageMode: isCloudMode ? 'cloud' : 'local'
        });
        
        return fileAttachment.id;
      } else {
        throw new Error(result.error || 'ファイル添付に失敗しました');
      }
      
    } catch (error) {
      logger.error('❌ FilesV2: ファイル添付エラー', {
        nodeId,
        fileName: file.name,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  };
  
  // クラウドファイルアップロード処理
  const handleCloudFileUpload = async (nodeId, file, validationResult) => {
    const { authManager } = await import('../utils/authManager.js');
    const authHeader = authManager.getAuthHeader();
    
    console.log('🔐 FilesV2: 認証情報確認:', {
      isAuthenticated: authManager.isAuthenticated(),
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader ? authHeader.substring(0, 10) + '...' : 'なし'
    });
    
    if (!authHeader) {
      throw new Error('認証が必要です');
    }

    if (!currentMapId) {
      throw new Error('クラウドモードではマップIDが必要です');
    }
    
    console.log('📎 FilesV2: R2アップロード情報:', {
      mapId: currentMapId,
      nodeId,
      fileName: file.name
    });

    // FormDataでファイルをアップロード
    const formData = new FormData();
    formData.append('file', file);

    const apiUrl = `https://mindflow-api-production.shigekazukoya.workers.dev/api/files/${currentMapId}/${nodeId}`;
    console.log('📤 FilesV2: ファイルアップロードリクエスト送信中...', { apiUrl });
    
    const uploadResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader
      },
      body: formData
    });

    console.log('📡 FilesV2: ファイルアップロードレスポンス受信:', {
      status: uploadResponse.status,
      statusText: uploadResponse.statusText,
      ok: uploadResponse.ok
    });

    if (!uploadResponse.ok) {
      // エラーの詳細を取得
      let errorDetail = uploadResponse.statusText;
      try {
        const errorBody = await uploadResponse.text();
        errorDetail = errorBody || uploadResponse.statusText;
      } catch (e) {
        // エラーボディの取得に失敗した場合はステータステキストを使用
      }
      
      console.error('FilesV2: R2アップロードエラー詳細:', {
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        url: apiUrl,
        mapId: currentMapId,
        nodeId,
        errorDetail
      });
      
      throw new Error(`R2アップロードに失敗しました: ${errorDetail}`);
    }

    const uploadResult = await uploadResponse.json();
    
    logger.info(`☁️ FilesV2: R2アップロード完了: ${file.name}`, {
      nodeId,
      fileId: uploadResult.id,
      downloadUrl: uploadResult.downloadUrl
    });
    
    // R2ストレージの結果でファイル添付情報を作成
    return createFileAttachment(file, uploadResult.downloadUrl, uploadResult, {
      isR2Storage: true,
      nodeId: nodeId,
      storagePath: uploadResult.storagePath,
      thumbnailPath: uploadResult.thumbnailPath,
      downloadUrl: uploadResult.downloadUrl,
      securityValidated: true,
      validationTimestamp: new Date().toISOString(),
      warnings: validationResult.warnings
    });
  };
  
  // ローカルファイルアップロード処理
  const handleLocalFileUpload = async (nodeId, file, validationResult) => {
    // ファイルをBase64に変換
    const optimizedFile = await optimizeFile(file);
    const dataURL = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(optimizedFile.file);
    });
    
    logger.info(`💾 FilesV2: ローカル保存完了: ${file.name}`, {
      nodeId,
      originalSize: file.size,
      optimizedSize: optimizedFile.file.size,
      compressionRatio: Math.round((1 - optimizedFile.file.size / file.size) * 100)
    });
    
    // ローカルストレージ用のファイル添付情報を作成
    return createFileAttachment(optimizedFile.file, dataURL, null, {
      isR2Storage: false,
      nodeId: nodeId,
      securityValidated: true,
      validationTimestamp: new Date().toISOString(),
      warnings: validationResult.warnings,
      optimization: optimizedFile
    });
  };
  
  // ファイル削除
  const removeFileFromNode = async (nodeId, fileId) => {
    try {
      console.log('🗑️ FilesV2: ファイル削除開始', { nodeId, fileId });
      
      const node = findNode(nodeId);
      if (!node || !node.attachments) {
        console.warn('FilesV2: ファイルまたはノードが見つかりません');
        return;
      }
      
      const fileToRemove = node.attachments.find(file => file.id === fileId);
      
      // R2ストレージのファイルの場合、サーバーからも削除
      if (fileToRemove && fileToRemove.isR2Storage && fileToRemove.r2FileId) {
        try {
          await removeFileFromR2Storage(nodeId, fileToRemove);
        } catch (error) {
          console.warn('FilesV2: R2ファイル削除に失敗しましたが、ローカルからは削除します:', error);
        }
      }
      
      // DataManager経由でファイル削除
      const result = await dataOperations.removeFile(nodeId, fileId);
      
      if (result.success) {
        console.log('✅ FilesV2: ファイル削除完了', { nodeId, fileId });
      } else {
        throw new Error(result.error || 'ファイル削除に失敗しました');
      }
      
    } catch (error) {
      logger.error('❌ FilesV2: ファイル削除エラー', {
        nodeId,
        fileId,
        error: error.message
      });
      throw error;
    }
  };
  
  // R2ストレージからファイル削除
  const removeFileFromR2Storage = async (nodeId, fileToRemove) => {
    const { authManager } = await import('../utils/authManager.js');
    const authHeader = authManager.getAuthHeader();
    
    if (!authHeader) {
      throw new Error('認証が必要です');
    }
    
    if (!currentMapId) {
      throw new Error('クラウドモードではマップIDが必要です');
    }
    
    const deleteUrl = `https://mindflow-api-production.shigekazukoya.workers.dev/api/files/${currentMapId}/${nodeId}/${fileToRemove.r2FileId}`;
    
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader
      }
    });
    
    if (!deleteResponse.ok) {
      throw new Error(`R2ファイル削除失敗: ${deleteResponse.statusText}`);
    }
    
    console.log('☁️ FilesV2: R2ファイル削除完了', { 
      nodeId, 
      fileId: fileToRemove.r2FileId 
    });
  };

  // ファイル名を変更
  const renameFileInNode = async (nodeId, fileId, newName) => {
    try {
      console.log('✏️ FilesV2: ファイル名変更', { nodeId, fileId, newName });
      
      const node = findNode(nodeId);
      if (!node || !node.attachments) {
        throw new Error('ファイルまたはノードが見つかりません');
      }
      
      const updatedAttachments = node.attachments.map(file => 
        file.id === fileId ? { ...file, name: newName } : file
      );
      
      // DataManager経由でファイル情報更新（現在は直接的な部分更新未対応のため、レガシー方式使用）
      console.warn('⚠️ FilesV2: ファイル名変更はレガシー方式を使用');
      
      const updateNodeRecursive = (node) => {
        if (node.id === nodeId) {
          return { ...node, attachments: updatedAttachments };
        }
        if (node.children) {
          return { ...node, children: node.children.map(updateNodeRecursive) };
        }
        return node;
      };
      
      // この部分は将来的にDataManagerで対応予定
      // 現在はレガシーupdateDataを使用
      await dataOperations.updateData?.({
        ...dataOperations.data,
        rootNode: updateNodeRecursive(dataOperations.data.rootNode)
      }, { immediate: true });
      
      console.log('✅ FilesV2: ファイル名変更完了', { nodeId, fileId, newName });
      
    } catch (error) {
      logger.error('❌ FilesV2: ファイル名変更エラー', {
        nodeId,
        fileId,
        newName,
        error: error.message
      });
      throw error;
    }
  };

  // ファイルダウンロード（修正版）
  const downloadFile = async (file, nodeId = null) => {
    // アプリ初期化中はファイルダウンロードを無効化
    if (isAppInitializing()) {
      throw new Error('アプリケーションの初期化が完了していません。少しお待ちください。');
    }
    
    try {
      console.log('📥 FilesV2: ファイルダウンロード開始', {
        fileName: file.name,
        isR2Storage: file.isR2Storage,
        r2FileId: file.r2FileId,
        nodeId: nodeId || file.nodeId
      });
      
      // R2ストレージのファイルの場合
      if (file.isR2Storage && file.r2FileId) {
        await downloadFromR2Storage(file, nodeId);
        return;
      }

      // ローカルストレージのファイルの場合
      await downloadFromLocalStorage(file);
      
    } catch (error) {
      logger.error('❌ FilesV2: ファイルダウンロードエラー', {
        fileName: file.name,
        error: error.message
      });
      throw error;
    }
  };
  
  // R2ストレージからダウンロード
  const downloadFromR2Storage = async (file, nodeId) => {
    const { authManager } = await import('../utils/authManager.js');
    const authHeader = authManager.getAuthHeader();
    
    if (!authHeader) {
      throw new Error('認証が必要です');
    }
    
    if (!currentMapId) {
      throw new Error('クラウドモードではマップIDが必要です');
    }
    
    // nodeIdを特定（優先順位: 引数 > file.nodeId）
    const actualNodeId = nodeId || file.nodeId;
    
    if (!actualNodeId) {
      throw new Error('ファイルが関連付けられているノードが見つかりません');
    }
    
    console.log('📥 FilesV2: R2ダウンロード情報:', {
      mapId: currentMapId,
      nodeId: actualNodeId,
      fileId: file.r2FileId,
      fileName: file.name
    });
    
    // downloadUrlが利用可能な場合は直接使用
    if (file.downloadUrl) {
      console.log('FilesV2: downloadURL使用:', file.downloadUrl);
      
      const downloadResponse = await fetch(`https://mindflow-api-production.shigekazukoya.workers.dev${file.downloadUrl}`, {
        headers: { 'Authorization': authHeader }
      });
      
      if (downloadResponse.ok) {
        const blob = await downloadResponse.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(url);
        console.log('✅ FilesV2: downloadURL使用ダウンロード完了');
        return;
      } else {
        console.log('FilesV2: downloadUrl失敗、動的URL構築に切り替え:', downloadResponse.status);
      }
    }
    
    // 動的URL構築でダウンロード
    const downloadUrl = `https://mindflow-api-production.shigekazukoya.workers.dev/api/files/${currentMapId}/${actualNodeId}/${file.r2FileId}?type=download`;
    
    const downloadResponse = await fetch(downloadUrl, {
      headers: { 'Authorization': authHeader }
    });

    if (!downloadResponse.ok) {
      throw new Error(`ダウンロードURLの取得に失敗しました: ${downloadResponse.statusText}`);
    }

    // リダイレクト先のURLでダウンロード
    const finalDownloadUrl = downloadResponse.url;
    const link = document.createElement('a');
    link.href = finalDownloadUrl;
    link.download = file.name;
    link.click();
    
    console.log('✅ FilesV2: R2ダウンロード完了');
  };
  
  // ローカルストレージからダウンロード
  const downloadFromLocalStorage = async (file) => {
    if (!file.dataURL) {
      console.warn('FilesV2: ファイルのダウンロードデータが見つかりません', file);
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

        console.log('✅ FilesV2: File System Access APIダウンロード完了');
        return;
      } catch (saveError) {
        // ユーザーがキャンセルした場合やエラーが発生した場合
        if (saveError.name === 'AbortError') {
          return;
        }
        console.warn('FilesV2: File System Access API でのダウンロードに失敗:', saveError);
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

    console.log('✅ FilesV2: フォールバックダウンロード完了');
  };

  return {
    attachFileToNode,
    removeFileFromNode,
    renameFileInNode,
    downloadFile,
    isAppInitializing
  };
};