/**
 * Base64ファイルデータをCloudflare R2に移行するスクリプト
 * 
 * 機能:
 * 1. 既存のBase64データをR2にアップロード
 * 2. データベースのattachmentsテーブルを更新
 * 3. 移行統計とエラー報告
 * 4. 段階的移行によるサービス継続
 */

export class FileMigrationScript {
  constructor(db, r2Bucket) {
    this.db = db;
    this.r2Bucket = r2Bucket;
    this.migrationStats = {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      totalSize: 0,
      errors: []
    };
  }

  /**
   * 全ファイルの移行を実行
   */
  async migrateAllFiles() {
    console.log('=== ファイルR2移行開始 ===');
    console.log(`開始時刻: ${new Date().toISOString()}`);
    
    try {
      // 移行対象ファイル取得
      const { results: attachments } = await this.db.prepare(`
        SELECT a.*, n.mindmap_id, m.user_id
        FROM attachments a
        JOIN nodes n ON a.node_id = n.id  
        JOIN mindmaps m ON n.mindmap_id = m.id
        WHERE a.legacy_data_url IS NOT NULL 
        AND a.storage_path LIKE 'legacy/%'
        ORDER BY a.uploaded_at
      `).all();

      this.migrationStats.total = attachments.length;
      console.log(`移行対象: ${attachments.length}個のファイル`);

      if (attachments.length === 0) {
        console.log('移行対象のファイルが見つかりませんでした。');
        return this.migrationStats;
      }

      // バッチ処理で移行実行
      const batchSize = 5; // 並行処理数を制限
      for (let i = 0; i < attachments.length; i += batchSize) {
        const batch = attachments.slice(i, i + batchSize);
        await this.processBatch(batch);
        
        console.log(`進捗: ${Math.min(i + batchSize, attachments.length)}/${attachments.length}`);
        
        // レート制限対策
        if (i + batchSize < attachments.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log('=== 移行完了 ===');
      console.log(`成功: ${this.migrationStats.success}件`);
      console.log(`失敗: ${this.migrationStats.failed}件`);
      console.log(`スキップ: ${this.migrationStats.skipped}件`);
      console.log(`総サイズ: ${this.formatFileSize(this.migrationStats.totalSize)}`);
      console.log(`完了時刻: ${new Date().toISOString()}`);

      if (this.migrationStats.errors.length > 0) {
        console.log('\n=== エラー詳細 ===');
        this.migrationStats.errors.forEach((error, index) => {
          console.log(`${index + 1}. ${error}`);
        });
      }

    } catch (error) {
      console.error('ファイル移行処理中にエラーが発生しました:', error);
      throw error;
    }

    return this.migrationStats;
  }

  /**
   * バッチ処理
   */
  async processBatch(attachments) {
    const promises = attachments.map(attachment => 
      this.migrateSingleFile(attachment).catch(error => {
        this.migrationStats.failed++;
        const errorMessage = `${attachment.file_name} (${attachment.id}): ${error.message}`;
        this.migrationStats.errors.push(errorMessage);
        console.error(`✗ 移行失敗: ${errorMessage}`);
      })
    );

    await Promise.allSettled(promises);
  }

  /**
   * 単一ファイルの移行
   */
  async migrateSingleFile(attachment) {
    const { id, file_name, legacy_data_url, node_id, mindmap_id, user_id, mime_type } = attachment;

    // データURL検証
    if (!legacy_data_url || !legacy_data_url.startsWith('data:')) {
      this.migrationStats.skipped++;
      console.log(`⚠ スキップ (無効なデータURL): ${file_name} (${id})`);
      return;
    }

    try {
      // Base64データをデコード
      const { buffer, actualMimeType } = this.decodeDataUrl(legacy_data_url);
      
      // ファイルサイズチェック
      if (buffer.byteLength > 50 * 1024 * 1024) { // 50MB制限
        throw new Error(`ファイルサイズが大きすぎます: ${this.formatFileSize(buffer.byteLength)}`);
      }

      // 新しいストレージパス生成
      const newStoragePath = this.generateStoragePath(user_id, mindmap_id, node_id, file_name);
      
      // R2にアップロード
      await this.uploadToR2(buffer, newStoragePath, actualMimeType || mime_type, attachment);
      
      // サムネイル生成（画像の場合）
      let thumbnailPath = null;
      if (this.isImageType(actualMimeType || mime_type)) {
        thumbnailPath = await this.generateThumbnail(buffer, newStoragePath, actualMimeType || mime_type);
      }

      // データベース更新
      await this.updateAttachmentRecord(id, newStoragePath, thumbnailPath);
      
      this.migrationStats.success++;
      this.migrationStats.totalSize += buffer.byteLength;
      console.log(`✓ 移行完了: ${file_name} (${this.formatFileSize(buffer.byteLength)})`);

    } catch (error) {
      throw new Error(`移行失敗: ${error.message}`);
    }
  }

  /**
   * データURLをデコード
   */
  decodeDataUrl(dataUrl) {
    try {
      const [header, base64Data] = dataUrl.split(',');
      const mimeMatch = header.match(/data:([^;]+)/);
      const actualMimeType = mimeMatch ? mimeMatch[1] : null;
      
      // Base64デコード
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return {
        buffer: bytes.buffer,
        actualMimeType: actualMimeType
      };
    } catch (error) {
      throw new Error(`データURLデコード失敗: ${error.message}`);
    }
  }

  /**
   * ストレージパス生成
   */
  generateStoragePath(userId, mindmapId, nodeId, fileName) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const sanitizedName = this.sanitizeFileName(fileName);
    return `${userId}/${mindmapId}/${nodeId}/${timestamp}_${random}_${sanitizedName}`;
  }

  /**
   * R2にアップロード
   */
  async uploadToR2(buffer, storagePath, mimeType, originalAttachment) {
    const metadata = {
      httpMetadata: {
        contentType: mimeType,
        contentDisposition: `attachment; filename="${originalAttachment.file_name}"`
      },
      customMetadata: {
        originalName: originalAttachment.original_name,
        originalId: originalAttachment.id,
        migratedAt: new Date().toISOString(),
        nodeId: originalAttachment.node_id,
        attachmentType: originalAttachment.attachment_type
      }
    };

    await this.r2Bucket.put(storagePath, buffer, metadata);
  }

  /**
   * サムネイル生成
   */
  async generateThumbnail(buffer, originalPath, mimeType) {
    if (!this.isImageProcessable(mimeType)) {
      return null;
    }

    try {
      // 簡易実装：元ファイルをそのままサムネイルとして保存
      // 実際の実装では画像リサイズライブラリを使用
      const thumbnailPath = originalPath.replace(/(\.[^.]+)$/, '_thumb$1');
      
      await this.r2Bucket.put(thumbnailPath, buffer, {
        httpMetadata: {
          contentType: mimeType
        },
        customMetadata: {
          isThumbnail: 'true',
          originalPath: originalPath
        }
      });

      return thumbnailPath;
    } catch (error) {
      console.warn(`サムネイル生成失敗: ${error.message}`);
      return null;
    }
  }

  /**
   * データベースレコード更新
   */
  async updateAttachmentRecord(attachmentId, newStoragePath, thumbnailPath) {
    const updateSql = `
      UPDATE attachments SET 
        storage_path = ?,
        thumbnail_path = ?,
        migrated_at = ?
      WHERE id = ?
    `;

    await this.db.prepare(updateSql).bind(
      newStoragePath,
      thumbnailPath,
      new Date().toISOString(),
      attachmentId
    ).run();
  }

  /**
   * 移行状況確認
   */
  async getMigrationStatus() {
    const total = await this.db.prepare(`
      SELECT COUNT(*) as count FROM attachments 
      WHERE legacy_data_url IS NOT NULL
    `).first();
    
    const migrated = await this.db.prepare(`
      SELECT COUNT(*) as count FROM attachments 
      WHERE storage_path NOT LIKE 'legacy/%' AND legacy_data_url IS NOT NULL
    `).first();

    const totalSize = await this.db.prepare(`
      SELECT SUM(file_size) as size FROM attachments 
      WHERE storage_path NOT LIKE 'legacy/%'
    `).first();

    return {
      total: total.count,
      migrated: migrated.count,
      remaining: total.count - migrated.count,
      percentage: total.count > 0 ? Math.round((migrated.count / total.count) * 100) : 0,
      totalSize: totalSize.size || 0
    };
  }

  /**
   * 移行の巻き戻し（特定ファイル）
   */
  async rollbackFilemigration(attachmentId) {
    console.log(`ファイル移行巻き戻し開始: ${attachmentId}`);
    
    const attachment = await this.db.prepare(
      'SELECT * FROM attachments WHERE id = ?'
    ).bind(attachmentId).first();

    if (!attachment) {
      throw new Error('添付ファイルが見つかりません');
    }

    // R2からファイル削除
    if (attachment.storage_path && !attachment.storage_path.startsWith('legacy/')) {
      try {
        await this.r2Bucket.delete(attachment.storage_path);
        if (attachment.thumbnail_path) {
          await this.r2Bucket.delete(attachment.thumbnail_path);
        }
      } catch (error) {
        console.warn('R2削除失敗:', error);
      }
    }

    // データベース巻き戻し
    await this.db.prepare(`
      UPDATE attachments SET 
        storage_path = ?,
        thumbnail_path = NULL,
        migrated_at = NULL
      WHERE id = ?
    `).bind(`legacy/${attachmentId}`, attachmentId).run();

    console.log(`ファイル移行巻き戻し完了: ${attachmentId}`);
  }

  /**
   * 孤立ファイルのクリーンアップ
   */
  async cleanupOrphanedFiles(dryRun = true) {
    console.log('=== 孤立ファイルクリーンアップ開始 ===');
    
    // データベースに存在するファイルパス一覧取得
    const { results: dbFiles } = await this.db.prepare(
      'SELECT DISTINCT storage_path FROM attachments WHERE storage_path IS NOT NULL'
    ).all();
    
    const dbFilePaths = new Set(dbFiles.map(f => f.storage_path));
    
    // R2の全ファイル一覧取得
    const orphanedFiles = [];
    let cursor = null;
    let hasMore = true;

    while (hasMore) {
      const result = await this.r2Bucket.list({
        limit: 1000,
        cursor: cursor
      });

      result.objects.forEach(obj => {
        if (!dbFilePaths.has(obj.key)) {
          orphanedFiles.push({
            key: obj.key,
            size: obj.size,
            uploaded: obj.uploaded
          });
        }
      });

      hasMore = result.truncated;
      cursor = result.cursor;
    }

    console.log(`孤立ファイル発見: ${orphanedFiles.length}個`);
    
    if (orphanedFiles.length === 0) {
      return { deleted: 0, totalSize: 0 };
    }

    let totalSize = 0;
    orphanedFiles.forEach(file => totalSize += file.size);
    
    console.log(`総サイズ: ${this.formatFileSize(totalSize)}`);

    if (dryRun) {
      console.log('ドライラン: 実際の削除は行いません');
      orphanedFiles.slice(0, 10).forEach(file => {
        console.log(`- ${file.key} (${this.formatFileSize(file.size)})`);
      });
      if (orphanedFiles.length > 10) {
        console.log(`... その他 ${orphanedFiles.length - 10} ファイル`);
      }
      return { deleted: 0, totalSize: 0, orphaned: orphanedFiles.length };
    }

    // 実際の削除実行
    const deletedFiles = [];
    for (const file of orphanedFiles) {
      try {
        await this.r2Bucket.delete(file.key);
        deletedFiles.push(file);
        console.log(`削除: ${file.key}`);
      } catch (error) {
        console.error(`削除失敗: ${file.key} - ${error.message}`);
      }
    }

    console.log(`=== クリーンアップ完了: ${deletedFiles.length}ファイル削除 ===`);
    return { 
      deleted: deletedFiles.length, 
      totalSize: deletedFiles.reduce((sum, f) => sum + f.size, 0) 
    };
  }

  /**
   * ユーティリティメソッド
   */
  
  isImageType(mimeType) {
    return mimeType && mimeType.startsWith('image/');
  }

  isImageProcessable(mimeType) {
    return ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType);
  }

  sanitizeFileName(fileName) {
    return fileName
      .replace(/[^\w\s.-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 255);
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

/**
 * スクリプト実行用ヘルパー関数
 */
export async function runFileMigration(env) {
  const migration = new FileMigrationScript(env.DB, env.FILES);
  
  console.log('移行前状況確認...');
  const statusBefore = await migration.getMigrationStatus();
  console.log(`移行前: ${statusBefore.migrated}/${statusBefore.total} (${statusBefore.percentage}%)`);
  
  const result = await migration.migrateAllFiles();
  
  console.log('移行後状況確認...');
  const statusAfter = await migration.getMigrationStatus();
  console.log(`移行後: ${statusAfter.migrated}/${statusAfter.total} (${statusAfter.percentage}%)`);
  
  return {
    migration: result,
    status: statusAfter
  };
}

/**
 * 移行状況チェック用関数
 */
export async function checkMigrationStatus(env) {
  const migration = new FileMigrationScript(env.DB, env.FILES);
  return await migration.getMigrationStatus();
}

/**
 * テスト移行用関数
 */
export async function testFileMigration(env, attachmentId) {
  const migration = new FileMigrationScript(env.DB, env.FILES);
  
  const { results: attachments } = await env.DB.prepare(`
    SELECT a.*, n.mindmap_id, m.user_id
    FROM attachments a
    JOIN nodes n ON a.node_id = n.id  
    JOIN mindmaps m ON n.mindmap_id = m.id
    WHERE a.id = ? AND a.legacy_data_url IS NOT NULL
  `).bind(attachmentId).all();
  
  if (attachments.length === 0) {
    throw new Error(`テスト対象が見つかりません: ${attachmentId}`);
  }
  
  await migration.migrateSingleFile(attachments[0]);
  console.log(`テスト移行完了: ${attachmentId}`);
  
  return true;
}