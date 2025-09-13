/**
 * Cloudflare R2 ユーティリティ関数
 * 署名付きURL生成、ファイル操作、メタデータ管理
 */

/**
 * 署名付きURL生成
 * @param {R2Bucket} r2Bucket - R2バケットインスタンス
 * @param {string} key - オブジェクトキー
 * @param {number} expiresIn - 有効期限（秒）
 * @param {string} method - HTTPメソッド (GET, PUT, DELETE)
 * @returns {Promise<string>} 署名付きURL
 */
export async function generateSignedUrl(r2Bucket, key, expiresIn = 3600, method = 'GET') {
  try {
    // Cloudflare R2では直接的な署名付きURL生成はサポートされていないため
    // オブジェクトの存在確認を行い、一時的なアクセス用の代替手段を提供
    const object = await r2Bucket.head(key);
    if (!object && method === 'GET') {
      throw new Error('File not found');
    }
    
    // 簡易的な実装: バケット名とキーから直接URLを構築
    // 実際のプロダクション環境では適切な署名機能を実装する必要があります
    return `https://pub-${getBucketId()}.r2.dev/${key}`;
  } catch (error) {
    console.error('Failed to generate signed URL:', error);
    throw new Error('Failed to generate download URL');
  }
}

// バケットIDを取得するヘルパー関数（環境に応じて調整が必要）
function getBucketId() {
  // 実際のバケットの公開URLドメインに応じて調整
  return 'your-bucket-id';
}

/**
 * アップロード用署名付きURL生成
 * @param {R2Bucket} r2Bucket - R2バケットインスタンス  
 * @param {string} key - オブジェクトキー
 * @param {string} contentType - MIMEタイプ
 * @param {number} maxSize - 最大ファイルサイズ
 * @param {number} expiresIn - 有効期限（秒）
 * @returns {Promise<Object>} アップロード情報
 */
export async function generateUploadUrl(r2Bucket, key, contentType, maxSize = 10485760, expiresIn = 3600) {
  try {
    const uploadUrl = await r2Bucket.createPresignedUrl(key, {
      expiresIn: expiresIn,
      method: 'PUT',
      conditions: [
        ['content-length-range', 0, maxSize],
        ['eq', '$Content-Type', contentType]
      ]
    });

    return {
      uploadUrl: uploadUrl,
      key: key,
      contentType: contentType,
      maxSize: maxSize,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
    };
  } catch (error) {
    console.error('Failed to generate upload URL:', error);
    throw new Error('Failed to generate upload URL');
  }
}

/**
 * ダウンロード用署名付きURL生成
 * @param {R2Bucket} r2Bucket - R2バケットインスタンス
 * @param {string} key - オブジェクトキー
 * @param {string} filename - ダウンロード時のファイル名
 * @param {number} expiresIn - 有効期限（秒）
 * @returns {Promise<string>} ダウンロードURL
 */
export async function generateDownloadUrl(r2Bucket, key, filename = null, expiresIn = 3600) {
  try {
    const downloadUrl = await r2Bucket.createPresignedUrl(key, {
      expiresIn: expiresIn,
      method: 'GET',
      responseContentDisposition: filename ? `attachment; filename="${filename}"` : undefined
    });
    return downloadUrl;
  } catch (error) {
    console.error('Failed to generate download URL:', error);
    throw new Error('Failed to generate download URL');
  }
}

/**
 * ファイルの存在確認
 * @param {R2Bucket} r2Bucket - R2バケットインスタンス
 * @param {string} key - オブジェクトキー
 * @returns {Promise<boolean>} ファイルの存在
 */
export async function fileExists(r2Bucket, key) {
  try {
    const object = await r2Bucket.head(key);
    return object !== null;
  } catch (error) {
    return false;
  }
}

/**
 * ファイルメタデータ取得
 * @param {R2Bucket} r2Bucket - R2バケットインスタンス
 * @param {string} key - オブジェクトキー
 * @returns {Promise<Object|null>} ファイルメタデータ
 */
export async function getFileMetadata(r2Bucket, key) {
  try {
    const object = await r2Bucket.head(key);
    if (!object) return null;

    return {
      key: key,
      size: object.size,
      etag: object.etag,
      lastModified: object.uploaded,
      contentType: object.httpMetadata?.contentType,
      customMetadata: object.customMetadata || {}
    };
  } catch (error) {
    console.error('Failed to get file metadata:', error);
    return null;
  }
}

/**
 * ファイル削除
 * @param {R2Bucket} r2Bucket - R2バケットインスタンス
 * @param {string} key - オブジェクトキー
 * @returns {Promise<boolean>} 削除成功可否
 */
export async function deleteFile(r2Bucket, key) {
  try {
    await r2Bucket.delete(key);
    return true;
  } catch (error) {
    console.error('Failed to delete file:', error);
    return false;
  }
}

/**
 * 複数ファイル削除
 * @param {R2Bucket} r2Bucket - R2バケットインスタンス
 * @param {string[]} keys - オブジェクトキー配列
 * @returns {Promise<Object>} 削除結果
 */
export async function deleteFiles(r2Bucket, keys) {
  const results = {
    deleted: [],
    failed: []
  };

  for (const key of keys) {
    try {
      await r2Bucket.delete(key);
      results.deleted.push(key);
    } catch (error) {
      console.error(`Failed to delete file ${key}:`, error);
      results.failed.push({ key, error: error.message });
    }
  }

  return results;
}

/**
 * ファイル一覧取得
 * @param {R2Bucket} r2Bucket - R2バケットインスタンス
 * @param {string} prefix - プレフィックス（フォルダパス）
 * @param {number} limit - 取得件数制限
 * @param {string} cursor - 継続トークン
 * @returns {Promise<Object>} ファイル一覧
 */
export async function listFiles(r2Bucket, prefix = '', limit = 1000, cursor = null) {
  try {
    const options = {
      prefix: prefix,
      limit: limit
    };
    
    if (cursor) {
      options.cursor = cursor;
    }

    const result = await r2Bucket.list(options);
    
    return {
      objects: result.objects.map(obj => ({
        key: obj.key,
        size: obj.size,
        lastModified: obj.uploaded,
        etag: obj.etag
      })),
      truncated: result.truncated,
      cursor: result.cursor
    };
  } catch (error) {
    console.error('Failed to list files:', error);
    throw error;
  }
}

/**
 * ファイルコピー
 * @param {R2Bucket} r2Bucket - R2バケットインスタンス
 * @param {string} sourceKey - コピー元キー
 * @param {string} destKey - コピー先キー  
 * @param {Object} metadata - 新しいメタデータ
 * @returns {Promise<boolean>} コピー成功可否
 */
export async function copyFile(r2Bucket, sourceKey, destKey, metadata = {}) {
  try {
    // R2にはネイティブなコピー機能がないため、ダウンロード→アップロードで実現
    const sourceObject = await r2Bucket.get(sourceKey);
    if (!sourceObject) {
      throw new Error('Source file not found');
    }

    const sourceData = await sourceObject.arrayBuffer();
    
    await r2Bucket.put(destKey, sourceData, {
      httpMetadata: sourceObject.httpMetadata,
      customMetadata: {
        ...sourceObject.customMetadata,
        ...metadata.customMetadata
      }
    });

    return true;
  } catch (error) {
    console.error('Failed to copy file:', error);
    return false;
  }
}

/**
 * ストレージ使用量統計
 * @param {R2Bucket} r2Bucket - R2バケットインスタンス
 * @param {string} userPrefix - ユーザープレフィックス
 * @returns {Promise<Object>} 使用量統計
 */
export async function getStorageStats(r2Bucket, userPrefix) {
  try {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      fileTypes: {},
      lastModified: null
    };

    let cursor = null;
    let hasMore = true;

    while (hasMore) {
      const result = await listFiles(r2Bucket, userPrefix, 1000, cursor);
      
      result.objects.forEach(obj => {
        stats.totalFiles++;
        stats.totalSize += obj.size;
        
        // ファイル拡張子別統計
        const ext = obj.key.split('.').pop().toLowerCase();
        stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
        
        // 最新更新日時
        if (!stats.lastModified || obj.lastModified > stats.lastModified) {
          stats.lastModified = obj.lastModified;
        }
      });

      hasMore = result.truncated;
      cursor = result.cursor;
    }

    return stats;
  } catch (error) {
    console.error('Failed to get storage stats:', error);
    throw error;
  }
}

/**
 * ファイルサイズの人間readable形式変換
 * @param {number} bytes - バイト数
 * @returns {string} 人間readable形式
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * MIMEタイプからファイルカテゴリを判定
 * @param {string} mimeType - MIMEタイプ
 * @returns {string} ファイルカテゴリ
 */
export function getFileCategory(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('text/') || mimeType === 'application/json') return 'text';
  if (mimeType.includes('document') || mimeType.includes('sheet') || mimeType.includes('presentation')) return 'document';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return 'archive';
  return 'other';
}

/**
 * 安全なファイル名生成
 * @param {string} originalName - 元のファイル名
 * @returns {string} 安全なファイル名
 */
export function sanitizeFileName(originalName) {
  // 危険な文字を除去・置換
  return originalName
    .replace(/[^\w\s.-]/g, '') // 英数字、スペース、ドット、ハイフンのみ許可
    .replace(/\s+/g, '_') // スペースをアンダースコアに
    .substring(0, 255); // 長さ制限
}

/**
 * ユニークなファイルキー生成
 * @param {string} userId - ユーザーID
 * @param {string} mindmapId - マインドマップID
 * @param {string} nodeId - ノードID
 * @param {string} fileName - ファイル名
 * @returns {string} ユニークなキー
 */
export function generateFileKey(userId, mindmapId, nodeId, fileName) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const sanitizedName = sanitizeFileName(fileName);
  
  return `${userId}/${mindmapId}/${nodeId}/${timestamp}_${random}_${sanitizedName}`;
}