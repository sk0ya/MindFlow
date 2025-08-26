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
          const fileResponse = await getFile(env, userId, mindmapId, nodeId, fileId, url.searchParams, requestOrigin);
          // Response オブジェクトの場合は直接返す
          if (fileResponse instanceof Response) {
            return fileResponse;
          }
          response = fileResponse;
        } else if (nodeId) {
          // 特定ノードの全ファイル取得
          response = await getNodeFiles(env.DB, userId, mindmapId, nodeId, env);
        } else {
          // マインドマップの全ファイル取得
          response = await getMindmapFiles(env.DB, userId, mindmapId, env);
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

    console.log('✅ File uploaded to R2 - no database record needed');

    const now = new Date().toISOString();
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
 * ファイル取得処理（R2のみ使用）
 */
async function getFile(env, userId, mindmapId, nodeId, fileId, searchParams, requestOrigin = null) {
  console.log('📥 getFile called with:', { userId, mindmapId, nodeId, fileId, searchParams: Object.fromEntries(searchParams) });
  
  // 所有権確認
  try {
    await verifyOwnership(env.DB, userId, mindmapId, nodeId);
    console.log('✅ Ownership verification passed');
  } catch (ownershipError) {
    console.error('❌ Ownership verification failed:', ownershipError);
    throw ownershipError;
  }

  // R2から直接取得を試行（複数のパスパターンを試す）
  const downloadType = searchParams.get('type') || 'download';
  const possiblePaths = [
    `${userId}/${mindmapId}/${nodeId}/${fileId}`, // 現在のパス
    `${userId}/${mindmapId}/${fileId}`, // ノードIDなしのパス
    `uploads/${userId}/${mindmapId}/${nodeId}/${fileId}`, // uploads プレフィックス付き
    `uploads/${userId}/${mindmapId}/${fileId}`, // uploads プレフィックス、ノードIDなし
    fileId // ファイルIDのみ（古い形式）
  ];

  for (const storagePath of possiblePaths) {
    console.log(`🔍 Trying R2 path: ${storagePath}`);
    try {
      const fileObject = await env.FILES.get(storagePath);
      if (fileObject) {
        console.log(`✅ Found file at path: ${storagePath}`);
        
        // メタデータから情報を取得
        const originalName = fileObject.customMetadata?.originalName || fileId;
        const contentType = fileObject.httpMetadata?.contentType || 'application/octet-stream';
        const attachmentType = fileObject.customMetadata?.attachmentType || getAttachmentType(contentType);
        
        if (downloadType === 'info') {
          // ファイル情報のみ返却
          return {
            id: fileId,
            fileName: originalName,
            originalName: originalName,
            fileSize: fileObject.size,
            mimeType: contentType,
            attachmentType: attachmentType,
            hasThumbnail: false, // TODO: サムネイル確認を実装
            uploadedAt: new Date().toISOString(), // R2にアップロード日時は保存されていないので現在時刻
            downloadUrl: `/api/files/${mindmapId}/${encodeURIComponent(nodeId)}/${encodeURIComponent(fileId)}?type=download`
          };
        } else {
          // ダウンロード用レスポンス
          const isImage = contentType && contentType.startsWith('image/');
          const headers = {
            'Content-Type': contentType,
            'Content-Length': fileObject.size?.toString() || '',
            'Cache-Control': isImage ? 'public, max-age=3600' : 'private, max-age=0',
            ...corsHeaders(env.CORS_ORIGIN, requestOrigin)
          };
          
          // 画像以外の場合のみContent-Dispositionを設定
          if (!isImage) {
            headers['Content-Disposition'] = `attachment; filename="${originalName}"`;
          }
          
          console.log('📤 Sending file with headers:', headers);
          
          return new Response(fileObject.body, { headers });
        }
      }
    } catch (r2Error) {
      console.log(`❌ Path ${storagePath} failed:`, r2Error.message);
    }
  }
  
  console.log('❌ File not found in any R2 location');
  const error = new Error('File not found');
  error.status = 404;
  throw error;
}

/**
 * ノードの全ファイル取得（R2から直接）
 */
async function getNodeFiles(db, userId, mindmapId, nodeId, env) {
  await verifyOwnership(db, userId, mindmapId, nodeId);

  // R2からファイル一覧を取得
  const prefix = `${userId}/${mindmapId}/${nodeId}/`;
  console.log('📁 Listing files with prefix:', prefix);
  
  try {
    const listResult = await env.FILES.list({ prefix });
    console.log('📋 R2 list result:', { 
      objectCount: listResult.objects.length,
      truncated: listResult.truncated 
    });

    const files = [];
    for (const obj of listResult.objects) {
      // オブジェクトの詳細を取得してメタデータを読む
      const fileObject = await env.FILES.get(obj.key);
      if (fileObject) {
        const fileName = fileObject.customMetadata?.originalName || obj.key.split('/').pop();
        const attachmentType = fileObject.customMetadata?.attachmentType || getAttachmentType(fileObject.httpMetadata?.contentType);
        
        files.push({
          id: obj.key.split('/').pop(), // ファイル名部分をIDとして使用
          fileName: fileName,
          originalName: fileName,
          fileSize: obj.size,
          mimeType: fileObject.httpMetadata?.contentType || 'application/octet-stream',
          attachmentType: attachmentType,
          hasThumbnail: false, // TODO: サムネイル確認を実装
          uploadedAt: obj.uploaded?.toISOString() || new Date().toISOString()
        });
      }
    }

    return files;
  } catch (error) {
    console.error('❌ Failed to list files from R2:', error);
    return [];
  }
}

/**
 * マインドマップの全ファイル取得（R2から直接）
 */
async function getMindmapFiles(db, userId, mindmapId, env) {
  // マインドマップの所有権確認
  const mindmap = await db.prepare(
    'SELECT id FROM mindmaps WHERE id = ? AND user_id = ?'
  ).bind(mindmapId, userId).first();
  
  if (!mindmap) {
    const error = new Error('Mindmap not found');
    error.status = 404;
    throw error;
  }

  // R2からファイル一覧を取得
  const prefix = `${userId}/${mindmapId}/`;
  console.log('📁 Listing all mindmap files with prefix:', prefix);
  
  try {
    const listResult = await env.FILES.list({ prefix });
    console.log('📋 R2 mindmap files result:', { 
      objectCount: listResult.objects.length,
      truncated: listResult.truncated 
    });

    const files = [];
    for (const obj of listResult.objects) {
      // オブジェクトの詳細を取得してメタデータを読む
      const fileObject = await env.FILES.get(obj.key);
      if (fileObject) {
        const pathParts = obj.key.split('/');
        const nodeId = pathParts[2]; // userId/mindmapId/nodeId/fileId
        const fileName = fileObject.customMetadata?.originalName || pathParts.pop();
        const attachmentType = fileObject.customMetadata?.attachmentType || getAttachmentType(fileObject.httpMetadata?.contentType);
        
        files.push({
          id: pathParts.pop(), // ファイル名部分をIDとして使用
          nodeId: nodeId,
          fileName: fileName,
          originalName: fileName,
          fileSize: obj.size,
          mimeType: fileObject.httpMetadata?.contentType || 'application/octet-stream',
          attachmentType: attachmentType,
          hasThumbnail: false,
          uploadedAt: obj.uploaded?.toISOString() || new Date().toISOString()
        });
      }
    }

    return files;
  } catch (error) {
    console.error('❌ Failed to list mindmap files from R2:', error);
    return [];
  }
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
 * ファイル削除（R2のみ）
 */
async function deleteFile(env, userId, mindmapId, nodeId, fileId) {
  await verifyOwnership(env.DB, userId, mindmapId, nodeId);

  // 複数のパスパターンで削除を試行
  const possiblePaths = [
    `${userId}/${mindmapId}/${nodeId}/${fileId}`,
    `${userId}/${mindmapId}/${fileId}`,
    `uploads/${userId}/${mindmapId}/${nodeId}/${fileId}`,
    `uploads/${userId}/${mindmapId}/${fileId}`,
    fileId
  ];

  let deleted = false;
  for (const storagePath of possiblePaths) {
    try {
      console.log('🗑️ Trying to delete from path:', storagePath);
      await env.FILES.delete(storagePath);
      console.log('✅ Successfully deleted from path:', storagePath);
      deleted = true;
      
      // サムネイルも削除を試行
      const thumbnailPath = storagePath.replace(/(\.[^.]+)$/, '_thumb$1');
      try {
        await env.FILES.delete(thumbnailPath);
        console.log('✅ Thumbnail also deleted:', thumbnailPath);
      } catch (thumbError) {
        console.log('ℹ️ No thumbnail found or failed to delete:', thumbnailPath);
      }
      
      break; // 削除が成功したらループを抜ける
    } catch (error) {
      console.log(`❌ Failed to delete from path ${storagePath}:`, error.message);
    }
  }

  if (!deleted) {
    const error = new Error('File not found or failed to delete');
    error.status = 404;
    throw error;
  }

  return { deleted_at: new Date().toISOString() };
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