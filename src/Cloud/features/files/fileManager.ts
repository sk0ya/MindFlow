/**
 * R2対応ファイル管理ユーティリティ
 * フロントエンド側でのファイルアップロード・ダウンロード・管理機能
 */

import { validateFile, FileAttachment } from '../../shared/types/dataTypes';

// ===== Type Definitions =====

// Authentication Manager Interface
export interface AuthManager {
  isAuthenticated(): boolean;
  getAuthToken(): string | null;
}

// Progress callback types
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface MultiUploadProgress {
  currentFile: number;
  totalFiles: number;
  fileName: string;
  fileProgress: UploadProgress;
  overallProgress: number;
}

export type ProgressCallback = (progress: UploadProgress) => void;
export type MultiProgressCallback = (progress: MultiUploadProgress) => void;

// File operation result types
export interface FileUploadResult {
  id: string;
  name: string;
  type: string;
  size: number;
  downloadUrl?: string;
  storagePath?: string;
  thumbnailUrl?: string;
  uploadedAt: string;
  success: boolean;
  message?: string;
}

export interface FileInfo {
  id: string;
  name: string;
  type: string;
  size: number;
  downloadUrl?: string;
  storagePath?: string;
  thumbnailUrl?: string;
  nodeId: string;
  mindmapId: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface FileListResponse {
  files: FileInfo[];
  totalCount: number;
  totalSize: number;
}

export interface FileDeleteResult {
  success: boolean;
  message: string;
  deletedFileId: string;
}

export interface FileUpdateResult {
  success: boolean;
  message: string;
  updatedFile: FileInfo;
}

// Multi-upload result types
export interface MultiUploadError {
  file: string;
  error: string;
}

export interface MultiUploadResult {
  results: FileUploadResult[];
  errors: MultiUploadError[];
}

// Upload cache types
export interface UploadCacheEntry {
  promise: Promise<FileUploadResult>;
  startTime: number;
  file: File;
}

// HTTP Headers type
export interface HttpHeaders {
  [key: string]: string;
}

// API Error Response
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

// File validation types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// Display URL types
export type DisplayUrlType = 'download' | 'thumbnail';

// Legacy attachment type for migration
export interface LegacyAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  isImage: boolean;
  createdAt: string;
  dataURL?: string;
  storagePath?: string;
}

// Browser compatibility checks
export interface BrowserCapabilities {
  supportsFileAPI: boolean;
  supportsFormData: boolean;
  supportsXMLHttpRequest: boolean;
  supportsFetch: boolean;
  supportsPromise: boolean;
}

// ===== End Type Definitions =====

export class FileManager {
  private apiBaseUrl: string;
  private authManager: AuthManager | null;
  private uploadCache: Map<string, UploadCacheEntry>;

  constructor(apiBaseUrl: string, authManager: AuthManager | null = null) {
    this.apiBaseUrl = apiBaseUrl;
    this.authManager = authManager;
    this.uploadCache = new Map<string, UploadCacheEntry>(); // アップロード進行状況キャッシュ
  }

  /**
   * ファイルをアップロード
   * @param file - アップロードするファイル
   * @param mindmapId - マインドマップID
   * @param nodeId - ノードID
   * @param onProgress - 進行状況コールバック
   * @returns アップロード結果
   */
  async uploadFile(
    file: File, 
    mindmapId: string, 
    nodeId: string, 
    onProgress: ProgressCallback | null = null
  ): Promise<FileUploadResult> {
    // ファイル検証
    const validationErrors = validateFile(file);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(', '));
    }

    // フォームデータ作成
    const formData = new FormData();
    formData.append('file', file);

    // 認証ヘッダー取得
    const headers = await this.getAuthHeaders();

    // アップロード実行
    const uploadPromise = this.performUpload(formData, mindmapId, nodeId, headers, onProgress);
    
    // キャッシュに保存
    const cacheKey = `${mindmapId}-${nodeId}-${file.name}`;
    this.uploadCache.set(cacheKey, {
      promise: uploadPromise,
      startTime: Date.now(),
      file: file
    });

    try {
      const result = await uploadPromise;
      this.uploadCache.delete(cacheKey);
      return result;
    } catch (error) {
      this.uploadCache.delete(cacheKey);
      throw error;
    }
  }

  /**
   * 実際のアップロード処理
   */
  private async performUpload(
    formData: FormData, 
    mindmapId: string, 
    nodeId: string, 
    headers: HttpHeaders, 
    onProgress: ProgressCallback | null
  ): Promise<FileUploadResult> {
    const xhr = new XMLHttpRequest();
    
    return new Promise<FileUploadResult>((resolve, reject) => {
      // 進行状況監視
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event: ProgressEvent) => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            onProgress({ loaded: event.loaded, total: event.total, percentage });
          }
        });
      }

      // 完了処理
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response: FileUploadResult = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error('レスポンスの解析に失敗しました'));
          }
        } else {
          try {
            const errorResponse: ApiErrorResponse = JSON.parse(xhr.responseText);
            reject(new Error(errorResponse.error || `アップロードに失敗しました (${xhr.status})`));
          } catch {
            reject(new Error(`アップロードに失敗しました (${xhr.status})`));
          }
        }
      });

      // エラー処理
      xhr.addEventListener('error', () => {
        reject(new Error('ネットワークエラーが発生しました'));
      });

      // タイムアウト処理
      xhr.addEventListener('timeout', () => {
        reject(new Error('アップロードがタイムアウトしました'));
      });

      // リクエスト送信
      xhr.open('POST', `${this.apiBaseUrl}/api/files/${mindmapId}/${nodeId}`);
      xhr.timeout = 300000; // 5分タイムアウト
      
      // ヘッダー設定
      Object.entries(headers).forEach(([key, value]: [string, string]) => {
        xhr.setRequestHeader(key, value);
      });

      xhr.send(formData);
    });
  }

  /**
   * ファイル情報取得
   * @param mindmapId - マインドマップID
   * @param nodeId - ノードID
   * @param fileId - ファイルID
   * @returns ファイル情報
   */
  async getFileInfo(mindmapId: string, nodeId: string, fileId: string): Promise<FileInfo> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.apiBaseUrl}/api/files/${mindmapId}/${nodeId}/${fileId}`, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      const errorData: Partial<ApiErrorResponse> = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `ファイル情報の取得に失敗しました (${response.status})`);
    }

    return await response.json() as FileInfo;
  }

  /**
   * ファイルダウンロードURL取得
   * @param mindmapId - マインドマップID
   * @param nodeId - ノードID
   * @param fileId - ファイルID
   * @returns ダウンロードURL
   */
  async getDownloadUrl(mindmapId: string, nodeId: string, fileId: string): Promise<string> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.apiBaseUrl}/api/files/${mindmapId}/${nodeId}/${fileId}?type=download`, {
      method: 'GET',
      headers: headers,
      redirect: 'manual' // リダイレクトを手動処理
    });

    if (response.status === 302) {
      const location = response.headers.get('Location');
      if (!location) {
        throw new Error('リダイレクト先URLが取得できませんでした');
      }
      return location;
    }

    throw new Error('ダウンロードURLの取得に失敗しました');
  }

  /**
   * サムネイルURL取得
   * @param mindmapId - マインドマップID
   * @param nodeId - ノードID
   * @param fileId - ファイルID
   * @returns サムネイルURL
   */
  async getThumbnailUrl(mindmapId: string, nodeId: string, fileId: string): Promise<string> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.apiBaseUrl}/api/files/${mindmapId}/${nodeId}/${fileId}?type=thumbnail`, {
      method: 'GET',
      headers: headers,
      redirect: 'manual'
    });

    if (response.status === 302) {
      const location = response.headers.get('Location');
      if (!location) {
        throw new Error('サムネイルURLが取得できませんでした');
      }
      return location;
    }

    throw new Error('サムネイルの取得に失敗しました');
  }

  /**
   * ノードの全ファイル取得
   * @param mindmapId - マインドマップID
   * @param nodeId - ノードID
   * @returns ファイル一覧
   */
  async getNodeFiles(mindmapId: string, nodeId: string): Promise<FileListResponse> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.apiBaseUrl}/api/files/${mindmapId}/${nodeId}`, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      const errorData: Partial<ApiErrorResponse> = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `ファイル一覧の取得に失敗しました (${response.status})`);
    }

    return await response.json() as FileListResponse;
  }

  /**
   * ファイル削除
   * @param mindmapId - マインドマップID
   * @param nodeId - ノードID
   * @param fileId - ファイルID
   * @returns 削除結果
   */
  async deleteFile(mindmapId: string, nodeId: string, fileId: string): Promise<FileDeleteResult> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.apiBaseUrl}/api/files/${mindmapId}/${nodeId}/${fileId}`, {
      method: 'DELETE',
      headers: headers
    });

    if (!response.ok) {
      const errorData: Partial<ApiErrorResponse> = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `ファイルの削除に失敗しました (${response.status})`);
    }

    return await response.json() as FileDeleteResult;
  }

  /**
   * ファイル名更新
   * @param mindmapId - マインドマップID
   * @param nodeId - ノードID
   * @param fileId - ファイルID
   * @param newName - 新しいファイル名
   * @returns 更新結果
   */
  async updateFileName(
    mindmapId: string, 
    nodeId: string, 
    fileId: string, 
    newName: string
  ): Promise<FileUpdateResult> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.apiBaseUrl}/api/files/${mindmapId}/${nodeId}/${fileId}`, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fileName: newName })
    });

    if (!response.ok) {
      const errorData: Partial<ApiErrorResponse> = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `ファイル名の更新に失敗しました (${response.status})`);
    }

    return await response.json() as FileUpdateResult;
  }

  /**
   * 複数ファイル同時アップロード
   * @param files - アップロードするファイル一覧
   * @param mindmapId - マインドマップID
   * @param nodeId - ノードID
   * @param onProgress - 進行状況コールバック
   * @returns アップロード結果一覧
   */
  async uploadMultipleFiles(
    files: FileList | File[], 
    mindmapId: string, 
    nodeId: string, 
    onProgress: MultiProgressCallback | null = null
  ): Promise<MultiUploadResult> {
    const fileArray = Array.from(files);
    const results: FileUploadResult[] = [];
    const errors: MultiUploadError[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      
      if (!file) {
        console.warn(`File at index ${i} is undefined, skipping`);
        continue;
      }
      
      try {
        const result = await this.uploadFile(file, mindmapId, nodeId, (progress: UploadProgress) => {
          if (onProgress) {
            onProgress({
              currentFile: i + 1,
              totalFiles: fileArray.length,
              fileName: file.name,
              fileProgress: progress,
              overallProgress: Math.round(((i + progress.percentage / 100) / fileArray.length) * 100)
            });
          }
        });
        
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ file: file.name, error: errorMessage });
      }
    }

    return { results, errors };
  }

  /**
   * アップロード進行状況確認
   * @param mindmapId - マインドマップID
   * @param nodeId - ノードID
   * @param fileName - ファイル名
   * @returns 進行状況
   */
  getUploadProgress(mindmapId: string, nodeId: string, fileName: string): UploadCacheEntry | null {
    const cacheKey = `${mindmapId}-${nodeId}-${fileName}`;
    return this.uploadCache.get(cacheKey) || null;
  }

  /**
   * レガシーデータからファイル添付オブジェクト作成
   * @param legacyAttachment - レガシー添付ファイル
   * @returns 新しいファイル添付オブジェクト
   */
  createAttachmentFromLegacy(legacyAttachment: LegacyAttachment): FileAttachment {
    return {
      id: legacyAttachment.id,
      name: legacyAttachment.name,
      type: legacyAttachment.type,
      size: legacyAttachment.size,
      isImage: legacyAttachment.isImage,
      createdAt: legacyAttachment.createdAt,
      // レガシー用データURL（移行期間中）
      dataURL: legacyAttachment.dataURL,
      // 新しいR2ベースの情報
      downloadUrl: undefined, // 後で動的に取得
      storagePath: legacyAttachment.storagePath,
      thumbnailUrl: undefined // 後で動的に取得
    };
  }

  /**
   * ファイル表示用URLを取得（キャッシュ対応）
   * @param attachment - ファイル添付オブジェクト
   * @param mindmapId - マインドマップID
   * @param nodeId - ノードID
   * @param type - 'download' | 'thumbnail'
   * @returns 表示用URL
   */
  async getDisplayUrl(
    attachment: FileAttachment, 
    mindmapId: string, 
    nodeId: string, 
    type: DisplayUrlType = 'download'
  ): Promise<string | null> {
    // レガシーデータURLがある場合はそれを使用
    if (attachment.dataURL && type === 'download') {
      return attachment.dataURL;
    }

    // R2から動的URL取得
    try {
      if (type === 'thumbnail' && attachment.isImage) {
        return await this.getThumbnailUrl(mindmapId, nodeId, attachment.id);
      } else {
        return await this.getDownloadUrl(mindmapId, nodeId, attachment.id);
      }
    } catch (error) {
      console.warn('ファイルURL取得失敗:', error);
      return attachment.dataURL || null; // フォールバック
    }
  }

  /**
   * 認証ヘッダー取得
   */
  private async getAuthHeaders(): Promise<HttpHeaders> {
    const headers: HttpHeaders = {
      'Accept': 'application/json'
    };

    if (this.authManager && this.authManager.isAuthenticated()) {
      const token = this.authManager.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * ファイルサイズフォーマット
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * ファイルタイプアイコン取得
   */
  getFileIcon(attachment: FileAttachment): string {
    if (attachment.isImage) return '🖼️';
    
    switch (attachment.type) {
      case 'text/plain': return '📄';
      case 'application/pdf': return '📕';
      case 'application/json': return '📋';
      default: return '📎';
    }
  }
}

// Browser compatibility check
export const checkBrowserCapabilities = (): BrowserCapabilities => {
  return {
    supportsFileAPI: typeof File !== 'undefined' && typeof FileReader !== 'undefined',
    supportsFormData: typeof FormData !== 'undefined',
    supportsXMLHttpRequest: typeof XMLHttpRequest !== 'undefined',
    supportsFetch: typeof fetch !== 'undefined',
    supportsPromise: typeof Promise !== 'undefined'
  };
};

// Utility functions for file validation
export const isValidFileType = (file: File, allowedTypes: string[]): boolean => {
  return allowedTypes.includes(file.type);
};

export const isFileSizeValid = (file: File, maxSize: number): boolean => {
  return file.size <= maxSize;
};

export const validateFileSecurely = (file: File): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  // Basic validation
  if (!file) {
    errors.push({
      field: 'file',
      message: 'ファイルが選択されていません',
      code: 'FILE_REQUIRED'
    });
    return errors;
  }
  
  // Size validation
  if (file.size > 10 * 1024 * 1024) { // 10MB
    errors.push({
      field: 'size',
      message: 'ファイルサイズが大きすぎます',
      code: 'FILE_TOO_LARGE'
    });
  }
  
  return errors;
};

// グローバルインスタンス
let fileManagerInstance: FileManager | null = null;

export const getFileManager = (apiBaseUrl: string, authManager: AuthManager | null = null): FileManager => {
  if (!fileManagerInstance) {
    fileManagerInstance = new FileManager(apiBaseUrl, authManager);
  }
  return fileManagerInstance;
};

export default FileManager;