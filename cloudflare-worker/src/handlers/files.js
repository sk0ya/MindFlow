import { corsHeaders } from '../utils/cors.js';
import { requireAuth } from '../utils/auth.js';

/**
 * ファイル管理APIハンドラー
 * Cloudflare R2を使用したファイルアップロード・ダウンロード・管理機能
 */
export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  const requestOrigin = request.headers.get('Origin');
  
  // 認証チェック（JWT認証またはX-User-IDを受け入れ）
  let userId = 'default-user';
  
  // 認証ヘッダーをデバッグ
  const authHeader = request.headers.get('Authorization');
  const xUserId = request.headers.get('X-User-ID');
  console.log('FILES - 受信認証ヘッダー:', {
    hasAuth: !!authHeader,
    authType: authHeader ? authHeader.substring(0, 10) + '...' : 'none',
    hasXUserId: !!xUserId,
    xUserId: xUserId
  });

  // JWT認証チェック
  if (env.ENABLE_AUTH === 'true') {
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      console.log('FILES - 認証失敗:', authResult.error);
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(env.CORS_ORIGIN, requestOrigin)
        }
      });
    }
    // JWTのuserIdは必ずemail（auth.jsで設定）
    userId = authResult.user.userId;
    console.log('FILES - JWT認証成功 - userId:', userId, 'email:', authResult.user.email);
  } else {
    // 認証が無効の場合はX-User-IDを使用
    userId = request.headers.get('X-User-ID') || 'default-user';
    console.log('FILES - 認証無効モード - userId:', userId);
  }

  const pathParts = url.pathname.split('/');
  const mindmapId = pathParts[3]; // /api/files/{mindmapId}
  const nodeId = pathParts[4];    // /api/files/{mindmapId}/{nodeId}
  const fileId = pathParts[5];    // /api/files/{mindmapId}/{nodeId}/{fileId}

  try {
    let response;
    
    switch (method) {
      case 'GET':
        if (fileId) {
          // 特定ファイルのダウンロード・情報取得
          const fileResponse = await getFile(env, userId, mindmapId, nodeId, fileId, url.searchParams);
          // Response オブジェクトの場合は直接返す
          if (fileResponse instanceof Response) {
            return fileResponse;
          }
          response = fileResponse;
        } else if (nodeId) {
          // 特定ノードの全ファイル取得
          response = await getNodeFiles(env.DB, userId, mindmapId, nodeId);
        } else {
          // マインドマップの全ファイル取得
          response = await getMindmapFiles(env.DB, userId, mindmapId);
        }
        break;
      
      case 'POST':
        if (nodeId) {
          // ファイルアップロード
          response = await uploadFile(env, userId, mindmapId, nodeId, request);
        } else {
          throw new Error('Node ID required for file upload');
        }
        break;
      
      case 'PUT':
        if (fileId) {
          // ファイル情報更新
          response = await updateFileInfo(env.DB, userId, mindmapId, nodeId, fileId, await request.json());
        } else {
          throw new Error('File ID required for update');
        }
        break;
      
      case 'DELETE':
        if (fileId) {
          // ファイル削除
          response = await deleteFile(env, userId, mindmapId, nodeId, fileId);
        } else {
          throw new Error('File ID required for deletion');
        }
        break;
      
      default:
        throw new Error(`Method ${method} not allowed`);
    }

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN, requestOrigin) }
    });

  } catch (error) {
    console.error('Files API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.status || 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN, requestOrigin) }
    });
  }
}

/**
 * ファイルアップロード処理
 */
async function uploadFile(env, userId, mindmapId, nodeId, request) {
  // マインドマップとノードの所有権確認
  await verifyOwnership(env.DB, userId, mindmapId, nodeId);

  // フォームデータの解析
  const formData = await request.formData();
  const file = formData.get('file');
  
  if (!file) {
    const error = new Error('No file provided');
    error.status = 400;
    throw error;
  }

  // ファイルサイズチェック（10MB制限）
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    const error = new Error(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
    error.status = 413;
    throw error;
  }

  // ファイルタイプの判定
  const attachmentType = getAttachmentType(file.type);
  const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const storagePath = `${userId}/${mindmapId}/${nodeId}/${fileId}`;

  try {
    // R2バインディングの確認
    if (!env.FILES) {
      console.error('❌ R2 bucket binding "FILES" is not configured');
      throw new Error('R2 storage is not properly configured. Please check the bucket binding.');
    }

    // R2にファイルアップロード
    console.log('📤 Uploading file to R2:', { storagePath, fileSize: file.size, fileType: file.type });
    const fileBuffer = await file.arrayBuffer();
    await env.FILES.put(storagePath, fileBuffer, {
      httpMetadata: {
        contentType: file.type,
        contentDisposition: `attachment; filename="${file.name}"`
      },
      customMetadata: {
        originalName: file.name,
        uploadedBy: userId,
        nodeId: nodeId,
        mindmapId: mindmapId
      }
    });
    console.log('✅ File uploaded to R2 successfully:', storagePath);

    // サムネイル生成（画像の場合）
    let thumbnailPath = null;
    if (attachmentType === 'image' && isImageProcessable(file.type)) {
      thumbnailPath = await generateThumbnail(env.FILES, fileBuffer, storagePath, file.type);
    }

    // データベースに記録
    if (!env.DB) {
      console.error('❌ D1 database binding "DB" is not configured');
      throw new Error('Database is not properly configured. Please check the D1 binding.');
    }

    const now = new Date().toISOString();
    console.log('💾 Saving file metadata to database...');
    await env.DB.prepare(`
      INSERT INTO attachments 
      (id, mindmap_id, node_id, file_name, original_name, file_size, mime_type, 
       storage_path, thumbnail_path, attachment_type, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      fileId, mindmapId, nodeId, file.name, file.name, file.size, file.type,
      storagePath, thumbnailPath, attachmentType, now
    ).run();

    // マインドマップの更新日時を更新
    await env.DB.prepare(
      'UPDATE mindmaps SET updated_at = ? WHERE id = ?'
    ).bind(now, mindmapId).run();

    return {
      id: fileId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      attachmentType: attachmentType,
      storagePath: storagePath,
      thumbnailPath: thumbnailPath,
      uploadedAt: now,
      downloadUrl: `/api/files/${mindmapId}/${nodeId}/${fileId}?type=download`
    };

  } catch (error) {
    // R2アップロード失敗時のクリーンアップ
    try {
      await env.FILES.delete(storagePath);
    } catch (cleanupError) {
      console.error('Failed to cleanup after upload error:', cleanupError);
    }
    throw error;
  }
}

/**
 * ファイル取得処理
 */
async function getFile(env, userId, mindmapId, nodeId, fileId, searchParams) {
  console.log('getFile called with:', { userId, mindmapId, nodeId, fileId });
  
  // 所有権確認
  try {
    await verifyOwnership(env.DB, userId, mindmapId, nodeId);
  } catch (ownershipError) {
    console.error('Ownership verification failed:', ownershipError);
    throw ownershipError;
  }

  // ファイル情報取得
  let attachment;
  try {
    console.log('Querying attachment:', { fileId, nodeId });
    attachment = await env.DB.prepare(
      'SELECT * FROM attachments WHERE id = ? AND mindmap_id = ? AND node_id = ?'
    ).bind(fileId, mindmapId, nodeId).first();
    console.log('Attachment query result:', attachment);
  } catch (dbError) {
    console.error('Database query failed:', dbError);
    attachment = null;
  }

  if (!attachment) {
    // データベースにファイル情報がない場合、R2から直接取得を試行（テスト用）
    const storagePath = `${userId}/${mindmapId}/${nodeId}/${fileId}`;
    const downloadType = searchParams.get('type') || 'info';
    
    if (downloadType === 'download') {
      try {
        const fileObject = await env.FILES.get(storagePath);
        if (fileObject) {
          return new Response(fileObject.body, {
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Disposition': `attachment; filename="${fileId}"`,
              ...corsHeaders(env.CORS_ORIGIN, requestOrigin)
            }
          });
        }
      } catch (r2Error) {
        console.error('R2 direct access failed:', r2Error);
      }
    }
    
    const error = new Error('File not found');
    error.status = 404;
    throw error;
  }

  // ダウンロードタイプの判定
  const downloadType = searchParams.get('type') || 'info';
  
  switch (downloadType) {
    case 'download':
      // R2から直接ファイルを読み取ってレスポンスとして返す
      const fileObject = await env.FILES.get(attachment.storage_path);
      if (!fileObject) {
        const error = new Error('File not found in storage');
        error.status = 404;
        throw error;
      }
      
      return new Response(fileObject.body, {
        headers: {
          'Content-Type': attachment.mime_type,
          'Content-Disposition': `attachment; filename="${attachment.original_name}"`,
          'Content-Length': attachment.file_size.toString(),
          ...corsHeaders(env.CORS_ORIGIN, requestOrigin)
        }
      });
    
    case 'thumbnail':
      if (attachment.thumbnail_path) {
        const thumbnailObject = await env.FILES.get(attachment.thumbnail_path);
        if (!thumbnailObject) {
          const error = new Error('Thumbnail not found in storage');
          error.status = 404;
          throw error;
        }
        
        return new Response(thumbnailObject.body, {
          headers: {
            'Content-Type': attachment.mime_type,
            'Cache-Control': 'public, max-age=3600',
            ...corsHeaders(env.CORS_ORIGIN, requestOrigin)
          }
        });
      } else {
        const error = new Error('Thumbnail not available');
        error.status = 404;
        throw error;
      }
    
    case 'info':
    default:
      // ファイル情報のみ返却
      return {
        id: attachment.id,
        fileName: attachment.file_name,
        originalName: attachment.original_name,
        fileSize: attachment.file_size,
        mimeType: attachment.mime_type,
        attachmentType: attachment.attachment_type,
        hasThumbnail: !!attachment.thumbnail_path,
        uploadedAt: attachment.uploaded_at,
        downloadUrl: `/api/files/${mindmapId}/${encodeURIComponent(attachment.node_id)}/${encodeURIComponent(attachment.id)}?type=download`
      };
  }
}

/**
 * ノードの全ファイル取得
 */
async function getNodeFiles(db, userId, mindmapId, nodeId) {
  await verifyOwnership(db, userId, mindmapId, nodeId);

  const { results: attachments } = await db.prepare(
    'SELECT * FROM attachments WHERE mindmap_id = ? AND node_id = ? ORDER BY uploaded_at DESC'
  ).bind(mindmapId, nodeId).all();

  return attachments.map(att => ({
    id: att.id,
    fileName: att.file_name,
    originalName: att.original_name,
    fileSize: att.file_size,
    mimeType: att.mime_type,
    attachmentType: att.attachment_type,
    hasThumbnail: !!att.thumbnail_path,
    uploadedAt: att.uploaded_at
  }));
}

/**
 * マインドマップの全ファイル取得
 */
async function getMindmapFiles(db, userId, mindmapId) {
  // マインドマップの所有権確認
  const mindmap = await db.prepare(
    'SELECT id FROM mindmaps WHERE id = ? AND user_id = ?'
  ).bind(mindmapId, userId).first();
  
  if (!mindmap) {
    const error = new Error('Mindmap not found');
    error.status = 404;
    throw error;
  }

  const { results: attachments } = await db.prepare(`
    SELECT * 
    FROM attachments 
    WHERE mindmap_id = ? 
    ORDER BY uploaded_at DESC
  `).bind(mindmapId).all();

  return attachments.map(att => ({
    id: att.id,
    nodeId: att.node_id,
    fileName: att.file_name,
    originalName: att.original_name,
    fileSize: att.file_size,
    mimeType: att.mime_type,
    attachmentType: att.attachment_type,
    hasThumbnail: !!att.thumbnail_path,
    uploadedAt: att.uploaded_at
  }));
}

/**
 * ファイル情報更新
 */
async function updateFileInfo(db, userId, mindmapId, nodeId, fileId, updateData) {
  await verifyOwnership(db, userId, mindmapId, nodeId);

  const now = new Date().toISOString();
  const updateFields = [];
  const values = [];

  if (updateData.fileName !== undefined) {
    updateFields.push('file_name = ?');
    values.push(updateData.fileName);
  }

  updateFields.push('updated_at = ?');
  values.push(now);
  values.push(fileId, mindmapId, nodeId);

  if (updateFields.length > 1) {
    await db.prepare(`
      UPDATE attachments SET ${updateFields.join(', ')} 
      WHERE id = ? AND mindmap_id = ? AND node_id = ?
    `).bind(...values).run();
  }

  return { updated_at: now };
}

/**
 * ファイル削除
 */
async function deleteFile(env, userId, mindmapId, nodeId, fileId) {
  await verifyOwnership(env.DB, userId, mindmapId, nodeId);

  // ファイル情報取得
  const attachment = await env.DB.prepare(
    'SELECT * FROM attachments WHERE id = ? AND mindmap_id = ? AND node_id = ?'
  ).bind(fileId, mindmapId, nodeId).first();

  if (!attachment) {
    const error = new Error('File not found');
    error.status = 404;
    throw error;
  }

  try {
    // R2からファイル削除
    await env.FILES.delete(attachment.storage_path);
    
    // サムネイルも削除
    if (attachment.thumbnail_path) {
      await env.FILES.delete(attachment.thumbnail_path);
    }

    // データベースから削除
    await env.DB.prepare(
      'DELETE FROM attachments WHERE id = ? AND mindmap_id = ? AND node_id = ?'
    ).bind(fileId, mindmapId, nodeId).run();

    const now = new Date().toISOString();
    await env.DB.prepare(
      'UPDATE mindmaps SET updated_at = ? WHERE id = ?'
    ).bind(now, mindmapId).run();

    return { deleted_at: now };

  } catch (error) {
    console.error('Failed to delete file from R2:', error);
    // R2削除失敗でもDB削除は実行する（孤立ファイル対策は別途実装）
    throw error;
  }
}

/**
 * ユーティリティ関数群
 */

async function verifyOwnership(db, userId, mindmapId, nodeId) {
  console.log('verifyOwnership check:', { userId, mindmapId, nodeId });
  
  // マインドマップの所有権のみをチェック（ノードはマインドマップデータ内で管理）
  const result = await db.prepare(`
    SELECT id 
    FROM mindmaps 
    WHERE id = ? AND user_id = ?
  `).bind(mindmapId, userId).first();
  
  console.log('verifyOwnership result:', result);
  
  if (!result) {
    console.error('Access denied for:', { userId, mindmapId, nodeId });
    const error = new Error('Access denied');
    error.status = 403;
    throw error;
  }
  
  console.log('verifyOwnership passed');
}

function getAttachmentType(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('text/')) return 'text';
  return 'file';
}

function isImageProcessable(mimeType) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType);
}

async function generateThumbnail(r2Bucket, fileBuffer, originalPath, mimeType) {
  // 簡単なサムネイル生成（実際の実装では画像処理ライブラリを使用）
  // ここでは元ファイルと同じものを保存（将来的に画像リサイズ機能を追加）
  const thumbnailPath = originalPath.replace(/(\.[^.]+)$/, '_thumb$1');
  
  try {
    await r2Bucket.put(thumbnailPath, fileBuffer, {
      httpMetadata: {
        contentType: mimeType
      },
      customMetadata: {
        isThumbnail: 'true'
      }
    });
    return thumbnailPath;
  } catch (error) {
    console.error('Thumbnail generation failed:', error);
    return null;
  }
}

async function generateDownloadUrl(r2Bucket, storagePath, expiresIn = 3600) {
  // R2の直接ダウンロードではなく、Workerを通じた配信URLを返す
  // 実際のファイル配信は getFile() 関数で処理される
  return `/api/files/download/${encodeURIComponent(storagePath)}`;
}