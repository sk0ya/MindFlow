// ファイル添付機能専用のカスタムフック (ローカルモード専用)
import { createFileAttachment } from '../../shared/types/dataTypes';
import { optimizeFile, formatFileSize } from './fileOptimization';
import { validateFile } from './fileValidation';
import { logger } from '../../shared/utils/logger';
import { getCurrentMindMap } from '../../core/storage/LocalEngine';
// getAppSettings is imported for potential future settings-based file handling

// ===== Type Definitions =====

// Extend Window interface for File System Access API
declare global {
  interface Window {
    showSaveFilePicker?: (options?: any) => Promise<FileSystemFileHandle>;
  }
}

/**
 * File operation types (Local Mode)
 */
export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Type for FileOptimizationResult to match OptimizationResult
interface FileOptimizationResult {
  dataURL: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: string | number;
  isCompressed: boolean;
  type: string;
  file: File;
  optimizationApplied: boolean;
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
  securityValidated?: boolean;
  validationTimestamp?: string;
  warnings?: string[];
  optimization?: FileOptimizationResult;
}

/**
 * File attachment with local storage info
 */
export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataURL?: string;
  isR2Storage?: boolean;
  metadata?: FileAttachmentMetadata;
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
 * File management utilities (Local Mode)
 */
export interface FileManagementUtils {
  attachFileToNode: (nodeId: string, file: File) => Promise<string>;
  removeFileFromNode: (nodeId: string, fileId: string) => Promise<void>;
  renameFileInNode: (nodeId: string, fileId: string, newName: string) => void;
  downloadFile: (file: FileAttachment) => Promise<void>;
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
export type UpdateNodeFn = (nodeId: string, updates: Partial<NodeWithAttachments>) => Promise<void>;

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

  // ファイル添付機能（ローカルストレージ専用）
  const attachFileToNode = async (nodeId: string, file: File): Promise<string> => {
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
      
      logger.info(`🔒 ファイルセキュリティ検証完了: ${file.name}`, {
        nodeId,
        validationPassed: true
      });
      
      // 2. ローカルモード: Base64エンコードで保存
      console.log('💾 ローカルモード: Base64エンコードで保存');
      
      // ファイル最適化
      const optimizationResult = await optimizeFile(file as any);
      
      // ファイル添付データ作成
      const fileAttachment = createFileAttachment(
        file as any,
        file?.type || '',
        optimizationResult.optimizedSize,
        optimizationResult.dataURL
      );
      
      // 最適化情報を追加
      fileAttachment.originalSize = file?.size || 0;
      fileAttachment.isOptimized = optimizationResult.isCompressed;
      fileAttachment.compressionRatio = String(optimizationResult.compressionRatio);
      
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
        fileSize: formatFileSize(optimizationResult.optimizedSize),
        originalSize: formatFileSize(file.size),
        optimized: optimizationResult.isCompressed
      });
      
      return fileAttachment.id;
      
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
  const removeFileFromNode = async (nodeId: string, fileId: string): Promise<void> => {
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

  // ファイルをダウンロード（ローカルストレージ専用）
  const downloadFile = async (file: FileAttachment): Promise<void> => {
    try {
      // 従来のdataURL方式
      if (!file.dataURL) {
        console.warn('ファイルのダウンロードデータが見つかりません', file);
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
              description: `${extension?.toUpperCase()} files`,
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
        } catch (saveError: any) {
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
              await removeFileFromNode(nodeId, fileId);
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

  // 画像プレビュー取得（ローカルモード）
  const getImagePreview = (attachment: FileAttachment): string | null => {
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
  const calculateStorageUsage = (): { used: number; percentage: number } => {
    const mindMap = getCurrentMindMap();
    if (!mindMap) return { used: 0, percentage: 0 };
    
    let totalSize = 0;
    const countFiles = (node: any): void => {
      if (node.attachments) {
        node.attachments.forEach((attachment: any) => {
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
    renameFileInNode,
    downloadFile,
    reattachFile,
    isAppInitializing,
    getImagePreview,
    calculateStorageUsage
  };
};