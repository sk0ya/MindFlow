// ファイル添付機能専用のカスタムフック
import { createFileAttachment } from '../../shared/types/dataTypes.js';

// ===== Type Definitions =====

/**
 * File operation types
 */
export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * File optimization result
 */
export interface FileOptimizationResult {
  file: File;
  compressionRatio: number;
  originalSize: number;
  optimizedSize: number;
}

/**
 * File attachment metadata
 */
export interface FileAttachmentMetadata {
  isR2Storage?: boolean;
  nodeId?: string;
  storagePath?: string;
  thumbnailPath?: string;
  downloadUrl?: string;
  securityValidated?: boolean;
  validationTimestamp?: string;
  warnings?: string[];
  optimization?: FileOptimizationResult;
}

/**
 * File attachment with R2 storage info
 */
export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data?: string; // Base64 encoded - optional for compatibility
  dataURL?: string;
  downloadUrl?: string;
  isR2Storage?: boolean;
  r2FileId?: string;
  nodeId?: string;
  metadata?: FileAttachmentMetadata;
}

/**
 * R2 upload result
 */
export interface R2UploadResult {
  id: string;
  downloadUrl: string;
  storagePath: string;
  thumbnailPath?: string;
}

/**
 * Node with attachments
 */
export interface NodeWithAttachments {
  id: string;
  text: string;
  attachments?: FileAttachment[];
  [key: string]: any;
}

/**
 * File management utilities
 */
export interface FileManagementUtils {
  attachFileToNode: (nodeId: string, file: File) => Promise<string>;
  removeFileFromNode: (nodeId: string, fileId: string) => Promise<void>;
  renameFileInNode: (nodeId: string, fileId: string, newName: string) => void;
  downloadFile: (file: FileAttachment, nodeId?: string) => Promise<void>;
  reattachFile: (nodeId: string, fileId: string) => Promise<string | false>;
  isAppInitializing: () => boolean;
}

/**
 * Find node function type
 */
export type FindNodeFn = (nodeId: string) => NodeWithAttachments | null;

/**
 * Update node function type
 */
export type UpdateNodeFn = (nodeId: string, updates: Partial<NodeWithAttachments>, syncToCloud?: boolean, options?: any) => Promise<void>;
import { optimizeFile, formatFileSize } from './fileOptimization.js';
import { validateFile } from './fileValidation.js';
import { logger } from '../../shared/utils/logger.js';
import { isCloudStorageEnabled, getCurrentMindMap } from '../../core/storage/StorageManager.js';
import { getAppSettings } from '../../core/storage/storageUtils.js';
import { authManager } from '../auth/authManager.js';
// cloudStorageは新しいStorageManagerで統合

export const useMindMapFiles = (
  findNode: FindNodeFn, 
  updateNode: UpdateNodeFn, 
  currentMapId: string | null = null
): FileManagementUtils => {
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

  // ファイル添付機能（R2ストレージ対応）
  const attachFileToNode = async (nodeId: string, file: File): Promise<string> => {
    // アプリ初期化中はファイルアップロードを無効化（ユーザー向けメッセージを改善）
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
      const validationResult: FileValidationResult = await validateFile(file);
      
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
      
      // 2. ストレージモードに応じたファイル保存
      
      // デバッグ: ストレージモード確認
      const settings = getAppSettings();
      const isCloudMode = isCloudStorageEnabled();
      console.log('📂 ストレージモード確認:', {
        storageMode: settings.storageMode,
        isCloudMode,
        settings
      });
      
      if (isCloudMode) {
        // クラウドモード: R2ストレージにアップロード
        console.log('☁️ クラウドモード: R2ストレージにアップロード');
        
        const authHeader = authManager.getAuthHeader();
        
        console.log('🔐 認証情報確認:', {
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
        
        console.log('📎 R2アップロード情報:', {
          mapId: currentMapId,
          nodeId,
          fileName: file.name
        });

        // デバッグ: APIエンドポイントと認証ヘッダーを詳細ログ出力
        const apiUrl = `https://mindflow-api-production.shigekazukoya.workers.dev/api/files/${currentMapId}/${nodeId}`;
        console.log('🔗 API URL:', apiUrl);
        console.log('🔐 認証ヘッダー:', authHeader ? `${authHeader.substring(0, 20)}...` : 'なし');
        
        // ユーザー情報も確認
        const user = authManager.getCurrentUser();
        console.log('👤 現在のユーザー:', user);
        
        // デバッグ: ノード情報も確認
        const node = findNode(nodeId);
        console.log('📍 対象ノード情報:', {
          nodeId,
          nodeExists: !!node,
          nodeText: node?.text,
          mapId: currentMapId
        });

        // ファイルアップロード前にマップの最新状態を確認
        console.log('🔄 ファイルアップロード処理を開始します');

        // FormDataでファイルをアップロード
        const formData = new FormData();
        formData.append('file', file);

        console.log('📤 ファイルアップロードリクエスト送信中...');
        const uploadResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader
          },
          body: formData
        });

        console.log('📡 ファイルアップロードレスポンス受信:', {
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
          
          console.error('R2アップロードエラー詳細:', {
            status: uploadResponse.status,
            statusText: uploadResponse.statusText,
            url: `https://mindflow-api-production.shigekazukoya.workers.dev/api/files/${currentMapId}/${nodeId}`,
            mapId: currentMapId,
            nodeId,
            errorDetail
          });
          
          throw new Error(`R2アップロードに失敗しました: ${errorDetail}`);
        }

        const uploadResult: R2UploadResult = await uploadResponse.json();
        
        logger.info(`☁️ R2アップロード完了: ${file.name}`, {
          nodeId,
          fileId: uploadResult.id,
          downloadUrl: uploadResult.downloadUrl
        });
        
        // 3. R2ストレージの結果でファイル添付情報を作成
        const fileAttachment = createFileAttachment(file, uploadResult.downloadUrl, uploadResult, {
          isR2Storage: true,
          nodeId: nodeId,
          validationTimestamp: new Date().toISOString(),
          warnings: validationResult.warnings
        } as any);

        // 4. ノードにファイル添付情報を追加（クラウドモード）
        const targetNode = findNode(nodeId);
        if (targetNode) {
          const updatedAttachments = [...(targetNode.attachments || []), fileAttachment as any];
          await updateNode(nodeId, { attachments: updatedAttachments });
          
          logger.info(`✅ ファイル添付完了 (クラウド): ${file.name}`, {
            nodeId,
            attachmentId: fileAttachment.id,
            r2FileId: uploadResult.id
          });
          
          return fileAttachment.id;
        } else {
          throw new Error('対象ノードが見つかりません');
        }
        
      } else {
        // ローカルモード: Base64でローカルストレージに保存
        console.log('🏠 ローカルモード: Base64でローカル保存');
        
        // ファイルをBase64に変換
        const optimizationResult = await optimizeFile(file);
        const dataURL = optimizationResult.dataURL;
        
        logger.info(`💾 ローカル保存完了: ${file.name}`, {
          nodeId,
          originalSize: file.size,
          optimizedSize: optimizationResult.optimizedSize,
          compressionRatio: Math.round(optimizationResult.compressionRatio * 100)
        });
        
        // 3. ローカルストレージ用のファイル添付情報を作成
        const fileAttachment = createFileAttachment(file, dataURL, null, {
          isR2Storage: false,
          validationTimestamp: new Date().toISOString(),
          warnings: validationResult.warnings,
          optimization: {
            file: file,
            compressionRatio: optimizationResult.compressionRatio,
            originalSize: optimizationResult.originalSize,
            optimizedSize: optimizationResult.optimizedSize
          }
        } as any);

        // 4. ノードにファイル添付情報を追加（ローカルモード）
        const node = findNode(nodeId);
        if (node) {
          const updatedAttachments = [...(node.attachments || []), fileAttachment as any];
          await updateNode(nodeId, { attachments: updatedAttachments });
          
          logger.info(`✅ ファイル添付完了 (ローカル): ${file.name}`, {
            nodeId,
            attachmentId: fileAttachment.id
          });
          
          return fileAttachment.id;
        } else {
          throw new Error('対象ノードが見つかりません');
        }
      }
      
    } catch (error) {
      logger.error('❌ ファイル添付エラー', {
        nodeId,
        fileName: file.name,
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    }
  };
  
  const removeFileFromNode = async (nodeId: string, fileId: string): Promise<void> => {
    const node = findNode(nodeId);
    if (node && node.attachments) {
      const fileToRemove = node.attachments.find(file => file.id === fileId);
      
      // R2ストレージのファイルの場合、サーバーからも削除
      if (fileToRemove && fileToRemove.isR2Storage && fileToRemove.r2FileId) {
        try {
          const authHeader = authManager.getAuthHeader();
          
          if (authHeader) {
            
            let mapId = null;
            if (isCloudStorageEnabled()) {
              // クラウドモードの場合は親フックから渡されたIDを使用
              if (!currentMapId) {
                console.warn('クラウドモードでマップIDが未指定、ファイル削除をスキップ');
                return;
              }
              mapId = currentMapId;
            } else {
              const currentMap = await getCurrentMindMap();
              if (!currentMap) {
                console.warn('現在のマップが見つかりません、ファイル削除をスキップ');
                return;
              }
              mapId = currentMap.id;
            }
            
            await fetch(
              `https://mindflow-api-production.shigekazukoya.workers.dev/api/files/${mapId}/${nodeId}/${fileToRemove.r2FileId}`,
              {
                method: 'DELETE',
                headers: {
                  'Authorization': authHeader
                }
              }
            );
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
  const renameFileInNode = (nodeId: string, fileId: string, newName: string): void => {
    const node = findNode(nodeId);
    if (node && node.attachments) {
      const updatedAttachments = node.attachments.map(file => 
        file.id === fileId ? { ...file, name: newName } : file
      );
      updateNode(nodeId, { attachments: updatedAttachments });
    }
  };

  // ファイルをダウンロード（R2ストレージ対応）
  const downloadFile = async (file: FileAttachment, nodeId: string | null = null): Promise<void> => {
    // アプリ初期化中はファイルダウンロードを無効化（ユーザー向けメッセージを改善）
    if (isAppInitializing()) {
      throw new Error('アプリケーションを初期化中です。数秒お待ちいただいてからもう一度お試しください。');
    }
    try {
      // R2ストレージのファイルの場合
      if (file.isR2Storage && file.r2FileId) {
        
        // 現在のマインドマップIDを取得（クラウドモード対応）
        
        let mapId = null;
        if (isCloudStorageEnabled()) {
          // クラウドモードの場合は親フックから渡されたIDを使用
          if (!currentMapId) {
            throw new Error('クラウドモードではマップIDが必要です');
          }
          mapId = currentMapId;
        } else {
          const currentMap = await getCurrentMindMap();
          if (!currentMap) {
            throw new Error('現在のマインドマップが見つかりません');
          }
          mapId = currentMap.id;
        }
        
        // ファイルのdownloadUrlを直接使用（修正なし）
        if (file.downloadUrl) {
          console.log('downloadURL使用:', file.downloadUrl);
          
          // 認証ヘッダーを準備
          let headers: Record<string, string> = {};
          
          const authHeader = authManager.getAuthHeader();
          if (authHeader) {
            headers['Authorization'] = authHeader;
          } else {
            const user = authManager.getCurrentUser();
            const userId = user?.email || 'unknown';
            headers['X-User-ID'] = userId;
          }
          
          const downloadResponse = await fetch(`https://mindflow-api-production.shigekazukoya.workers.dev${file.downloadUrl}`, {
            headers
          });
          
          if (downloadResponse.ok) {
            // ダウンロード処理
            const blob = await downloadResponse.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = file.name;
            link.click();
            URL.revokeObjectURL(url);
            return;
          } else {
            console.log('downloadUrl失敗、動的URL構築に切り替え:', downloadResponse.status);
          }
        }
        // 認証ヘッダーを準備
        let headers: Record<string, string> = {};
        
        console.log('認証状態確認:', {
          isAuthenticated: authManager.isAuthenticated(),
          hasToken: !!authManager.getAuthToken(),
          currentUser: authManager.getCurrentUser()
        });
        
        const authHeader = authManager.getAuthHeader();
        if (authHeader) {
          headers['Authorization'] = authHeader;
          console.log('JWT認証ヘッダー使用:', authHeader.substring(0, 20) + '...');
        } else {
          // 認証が無効な環境の場合のフォールバック
          const user = authManager.getCurrentUser();
          const userId = user?.email || 'unknown';
          headers['X-User-ID'] = userId;
          console.log('X-User-IDフォールバック:', userId);
        }
        
        console.log('ダウンロード対象情報:', {
          mapId: mapId,
          fileId: file.r2FileId,
          fileName: file.name,
          nodeId: nodeId,
          fileNodeId: file.nodeId,
          fileObject: file,
          isR2Storage: file.isR2Storage
        });

        // nodeIdを特定（優先順位: 引数 > file.nodeId > ファイル検索）
        let actualNodeId = nodeId || file.nodeId;
        
        if (!actualNodeId) {
          // マインドマップ内でファイルを検索してnodeIdを特定
          // ファイル検索はクラウドモードでは行わない（nodeIdが必須）
          if (!isCloudStorageEnabled()) {
            const localCurrentMap = await getCurrentMindMap();
            if (localCurrentMap) {
              const findFileInNodes = (node: any): string | null => {
                if (node.attachments && node.attachments.some((att: any) => att.id === file.id || att.r2FileId === file.r2FileId)) {
                  return node.id;
                }
                if (node.children) {
                  for (const child of node.children) {
                    const foundNodeId = findFileInNodes(child);
                    if (foundNodeId) return foundNodeId;
                  }
                }
                return null;
              };
              
              actualNodeId = findFileInNodes(localCurrentMap.rootNode) || undefined;
            }
          }
        }
        
        if (!actualNodeId) {
          throw new Error('ファイルが関連付けられているノードが見つかりません');
        }

        // ダウンロード用の署名付きURLを取得（マップID修正なし）
        const downloadResponse = await fetch(
          `https://mindflow-api-production.shigekazukoya.workers.dev/api/files/${mapId}/${actualNodeId}/${file.r2FileId}?type=download`,
          { headers }
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
      if ((window as any).showSaveFilePicker) {
        try {
          // ファイル拡張子を取得
          const extension = file.name.split('.').pop() || 'file';
          const mimeType = file.type || 'application/octet-stream';

          // ファイル保存ダイアログを表示
          const fileHandle = await (window as any).showSaveFilePicker({
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
          if ((saveError as Error).name === 'AbortError') {
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
  const reattachFile = async (nodeId: string, fileId: string): Promise<string | false> => {
    try {
      const node = findNode(nodeId);
      if (!node || !node.attachments) return false;
      
      const file = node.attachments.find(f => f.id === fileId);
      if (!file) return false;
      
      // ファイル再選択ダイアログを表示
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = file.type ? `${file.type}` : '*/*';
      
      return new Promise<string | false>((resolve) => {
        input.onchange = async (e: Event) => {
          const target = e.target as HTMLInputElement;
          const newFile = target.files?.[0];
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
    reattachFile,
    isAppInitializing
  };
};