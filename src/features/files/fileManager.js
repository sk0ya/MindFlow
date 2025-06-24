/**
 * R2対応ファイル管理ユーティリティ
 * フロントエンド側でのファイルアップロード・ダウンロード・管理機能
 */

import { validateFile, createFileAttachment } from './dataTypes.js';

export class FileManager {
  constructor(apiBaseUrl, authManager) {
    this.apiBaseUrl = apiBaseUrl;
    this.authManager = authManager;
    this.uploadCache = new Map(); // アップロード進行状況キャッシュ
  }

  /**
   * ファイルをアップロード
   * @param {File} file - アップロードするファイル
   * @param {string} mindmapId - マインドマップID
   * @param {string} nodeId - ノードID
   * @param {Function} onProgress - 進行状況コールバック
   * @returns {Promise<Object>} アップロード結果
   */
  async uploadFile(file, mindmapId, nodeId, onProgress = null) {
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
  async performUpload(formData, mindmapId, nodeId, headers, onProgress) {
    const xhr = new XMLHttpRequest();
    
    return new Promise((resolve, reject) => {
      // 進行状況監視
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
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
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error('レスポンスの解析に失敗しました'));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
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
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      xhr.send(formData);
    });
  }

  /**
   * ファイル情報取得
   * @param {string} mindmapId - マインドマップID
   * @param {string} nodeId - ノードID
   * @param {string} fileId - ファイルID
   * @returns {Promise<Object>} ファイル情報
   */
  async getFileInfo(mindmapId, nodeId, fileId) {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.apiBaseUrl}/api/files/${mindmapId}/${nodeId}/${fileId}`, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `ファイル情報の取得に失敗しました (${response.status})`);
    }

    return await response.json();
  }

  /**
   * ファイルダウンロードURL取得
   * @param {string} mindmapId - マインドマップID
   * @param {string} nodeId - ノードID
   * @param {string} fileId - ファイルID
   * @returns {Promise<string>} ダウンロードURL
   */
  async getDownloadUrl(mindmapId, nodeId, fileId) {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.apiBaseUrl}/api/files/${mindmapId}/${nodeId}/${fileId}?type=download`, {
      method: 'GET',
      headers: headers,
      redirect: 'manual' // リダイレクトを手動処理
    });

    if (response.status === 302) {
      return response.headers.get('Location');
    }

    throw new Error('ダウンロードURLの取得に失敗しました');
  }

  /**
   * サムネイルURL取得
   * @param {string} mindmapId - マインドマップID
   * @param {string} nodeId - ノードID
   * @param {string} fileId - ファイルID
   * @returns {Promise<string>} サムネイルURL
   */
  async getThumbnailUrl(mindmapId, nodeId, fileId) {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.apiBaseUrl}/api/files/${mindmapId}/${nodeId}/${fileId}?type=thumbnail`, {
      method: 'GET',
      headers: headers,
      redirect: 'manual'
    });

    if (response.status === 302) {
      return response.headers.get('Location');
    }

    throw new Error('サムネイルの取得に失敗しました');
  }

  /**
   * ノードの全ファイル取得
   * @param {string} mindmapId - マインドマップID
   * @param {string} nodeId - ノードID
   * @returns {Promise<Array>} ファイル一覧
   */
  async getNodeFiles(mindmapId, nodeId) {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.apiBaseUrl}/api/files/${mindmapId}/${nodeId}`, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `ファイル一覧の取得に失敗しました (${response.status})`);
    }

    return await response.json();
  }

  /**
   * ファイル削除
   * @param {string} mindmapId - マインドマップID
   * @param {string} nodeId - ノードID
   * @param {string} fileId - ファイルID
   * @returns {Promise<Object>} 削除結果
   */
  async deleteFile(mindmapId, nodeId, fileId) {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.apiBaseUrl}/api/files/${mindmapId}/${nodeId}/${fileId}`, {
      method: 'DELETE',
      headers: headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `ファイルの削除に失敗しました (${response.status})`);
    }

    return await response.json();
  }

  /**
   * ファイル名更新
   * @param {string} mindmapId - マインドマップID
   * @param {string} nodeId - ノードID
   * @param {string} fileId - ファイルID
   * @param {string} newName - 新しいファイル名
   * @returns {Promise<Object>} 更新結果
   */
  async updateFileName(mindmapId, nodeId, fileId, newName) {
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
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `ファイル名の更新に失敗しました (${response.status})`);
    }

    return await response.json();
  }

  /**
   * 複数ファイル同時アップロード
   * @param {FileList} files - アップロードするファイル一覧
   * @param {string} mindmapId - マインドマップID
   * @param {string} nodeId - ノードID
   * @param {Function} onProgress - 進行状況コールバック
   * @returns {Promise<Array>} アップロード結果一覧
   */
  async uploadMultipleFiles(files, mindmapId, nodeId, onProgress = null) {
    const fileArray = Array.from(files);
    const results = [];
    const errors = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      
      try {
        const result = await this.uploadFile(file, mindmapId, nodeId, (progress) => {
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
        errors.push({ file: file.name, error: error.message });
      }
    }

    return { results, errors };
  }

  /**
   * アップロード進行状況確認
   * @param {string} mindmapId - マインドマップID
   * @param {string} nodeId - ノードID
   * @param {string} fileName - ファイル名
   * @returns {Object|null} 進行状況
   */
  getUploadProgress(mindmapId, nodeId, fileName) {
    const cacheKey = `${mindmapId}-${nodeId}-${fileName}`;
    return this.uploadCache.get(cacheKey) || null;
  }

  /**
   * レガシーデータからファイル添付オブジェクト作成
   * @param {Object} legacyAttachment - レガシー添付ファイル
   * @returns {Object} 新しいファイル添付オブジェクト
   */
  createAttachmentFromLegacy(legacyAttachment) {
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
      downloadUrl: null, // 後で動的に取得
      storagePath: legacyAttachment.storagePath,
      thumbnailUrl: null // 後で動的に取得
    };
  }

  /**
   * ファイル表示用URLを取得（キャッシュ対応）
   * @param {Object} attachment - ファイル添付オブジェクト
   * @param {string} mindmapId - マインドマップID
   * @param {string} nodeId - ノードID
   * @param {string} type - 'download' | 'thumbnail'
   * @returns {Promise<string>} 表示用URL
   */
  async getDisplayUrl(attachment, mindmapId, nodeId, type = 'download') {
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
  async getAuthHeaders() {
    const headers = {
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
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * ファイルタイプアイコン取得
   */
  getFileIcon(attachment) {
    if (attachment.isImage) return '🖼️';
    
    switch (attachment.type) {
      case 'text/plain': return '📄';
      case 'application/pdf': return '📕';
      case 'application/json': return '📋';
      default: return '📎';
    }
  }
}

// グローバルインスタンス
let fileManagerInstance = null;

export const getFileManager = (apiBaseUrl, authManager) => {
  if (!fileManagerInstance) {
    fileManagerInstance = new FileManager(apiBaseUrl, authManager);
  }
  return fileManagerInstance;
};

export default FileManager;