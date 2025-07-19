import type { 
  Environment, 
  WorkerRequest, 
  ExecutionContext,
  FileAttachment,
  RequestContext,
} from '@/types';
import { requireAuth } from '@/utils/auth';
import { corsHeaders, addCORSHeaders } from '@/utils/cors';
import { validateFile, validateSQLParam, generateSecureId } from '@/utils/validation';

/**
 * セキュアなファイルハンドラー
 * - 厳密なバリデーション
 * - 適切なアクセス制御
 * - セキュアなファイル処理
 */

const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
];

const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.pdf', '.txt', '.md', '.json',
  '.mp4', '.webm', '.mp3', '.wav', '.ogg'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function handleFilesRequest(
  request: WorkerRequest,
  env: Environment,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;
  const origin = request.headers.get('Origin');

  try {
    // 認証チェック
    let authResult;
    if (env.ENABLE_AUTH === 'true') {
      authResult = await requireAuth(request, env);
      if (!authResult.authenticated) {
        return addCORSHeaders(
          new Response(
            JSON.stringify({ 
              success: false, 
              error: authResult.error 
            }),
            { 
              status: authResult.status || 401,
              headers: { 'Content-Type': 'application/json' }
            }
          ),
          env,
          origin
        );
      }
    }

    const userId = authResult?.user?.userId || 'default-user';
    const userEmail = authResult?.user?.email || 'default@example.com';

    // リクエストコンテキストを構築
    const context: RequestContext = {
      userId,
      userEmail,
      isAuthenticated: !!authResult?.authenticated,
      method: method as any,
      url,
      headers: request.headers,
    };

    // パスパラメータを解析
    const pathParts = url.pathname.split('/');
    const mindmapId = pathParts[3]; // /api/files/{mindmapId}
    const nodeId = pathParts[4];    // /api/files/{mindmapId}/{nodeId}
    const fileId = pathParts[5];    // /api/files/{mindmapId}/{nodeId}/{fileId}

    // パスパラメータのバリデーション
    if (!mindmapId) {
      return addCORSHeaders(
        new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Mindmap ID is required' 
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
        env,
        origin
      );
    }

    let response: Response;

    switch (method) {
      case 'GET':
        if (fileId && nodeId) {
          response = await handleGetFile(env, context, mindmapId, nodeId, fileId, url.searchParams);
        } else if (nodeId) {
          response = await handleGetNodeFiles(env, context, mindmapId, nodeId);
        } else {
          response = await handleGetMindmapFiles(env, context, mindmapId);
        }
        break;
      
      case 'POST':
        if (!nodeId) {
          return addCORSHeaders(
            new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Node ID is required for file upload' 
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            ),
            env,
            origin
          );
        }
        response = await handleUploadFile(env, context, mindmapId, nodeId, request);
        break;
      
      case 'PUT':
        if (!fileId || !nodeId) {
          return addCORSHeaders(
            new Response(
              JSON.stringify({ 
                success: false, 
                error: 'File ID and Node ID are required for update' 
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            ),
            env,
            origin
          );
        }
        response = await handleUpdateFile(env, context, mindmapId, nodeId, fileId, request);
        break;
      
      case 'DELETE':
        if (!fileId || !nodeId) {
          return addCORSHeaders(
            new Response(
              JSON.stringify({ 
                success: false, 
                error: 'File ID and Node ID are required for deletion' 
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            ),
            env,
            origin
          );
        }
        response = await handleDeleteFile(env, context, mindmapId, nodeId, fileId);
        break;
      
      case 'OPTIONS':
        response = new Response(null, {
          status: 204,
          headers: corsHeaders(env, origin),
        });
        break;
      
      default:
        response = new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Method not allowed' 
          }),
          { status: 405, headers: { 'Content-Type': 'application/json' } }
        );
    }

    return addCORSHeaders(response, env, origin);

  } catch (error) {
    console.error('Files handler error:', error);
    const errorResponse = new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        message: 'File operation failed'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
    return addCORSHeaders(errorResponse, env, origin);
  }
}

/**
 * ファイルアップロード処理
 */
async function handleUploadFile(
  env: Environment,
  context: RequestContext,
  mindmapId: string,
  nodeId: string,
  request: WorkerRequest
): Promise<Response> {
  try {
    // アクセス権限の確認
    await verifyMindmapOwnership(env.DB, context.userId, mindmapId);

    // フォームデータの解析
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No file provided' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ファイルバリデーション
    validateFile(file, {
      maxSize: MAX_FILE_SIZE,
      allowedTypes: ALLOWED_FILE_TYPES,
      allowedExtensions: ALLOWED_EXTENSIONS,
    });

    // セキュアなファイルIDとパスを生成
    const fileId = generateSecureId();
    const sanitizedNodeId = validateSQLParam(nodeId);
    const sanitizedMindmapId = validateSQLParam(mindmapId);
    const storagePath = `${context.userId}/${sanitizedMindmapId}/${sanitizedNodeId}/${fileId}`;

    // ファイルタイプの判定
    const attachmentType = getAttachmentType(file.type);

    // R2にファイルをアップロード
    const fileBuffer = await file.arrayBuffer();
    await env.FILES.put(storagePath, fileBuffer, {
      httpMetadata: {
        contentType: file.type,
        contentDisposition: `attachment; filename="${encodeURIComponent(file.name)}"`,
      },
      customMetadata: {
        originalName: file.name,
        uploadedBy: context.userId,
        nodeId: sanitizedNodeId,
        mindmapId: sanitizedMindmapId,
        uploadTimestamp: new Date().toISOString(),
      },
    });

    // サムネイル生成（画像の場合）
    let thumbnailPath: string | null = null;
    if (attachmentType === 'image' && isImageProcessable(file.type)) {
      thumbnailPath = await generateThumbnail(env.FILES, fileBuffer, storagePath, file.type);
    }

    // データベースに記録
    const now = new Date().toISOString();
    await env.DB.prepare(`
      INSERT INTO attachments 
      (id, mindmap_id, node_id, file_name, original_name, file_size, mime_type, 
       storage_path, thumbnail_path, attachment_type, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      fileId, 
      sanitizedMindmapId, 
      sanitizedNodeId, 
      file.name, 
      file.name, 
      file.size, 
      file.type,
      storagePath, 
      thumbnailPath, 
      attachmentType, 
      now
    ).run();

    // マインドマップの更新日時を更新
    await env.DB.prepare(
      'UPDATE mindmaps SET updated_at = ? WHERE id = ? AND user_id = ?'
    ).bind(now, sanitizedMindmapId, context.userId).run();

    const result = {
      success: true,
      data: {
        id: fileId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        attachmentType,
        hasThumbnail: !!thumbnailPath,
        uploadedAt: now,
        downloadUrl: `/api/files/${encodeURIComponent(sanitizedMindmapId)}/${encodeURIComponent(sanitizedNodeId)}/${encodeURIComponent(fileId)}?type=download`,
      },
    };

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('File upload error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'File upload failed',
        message: error instanceof Error ? error.message : 'Unknown upload error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * ファイル取得処理
 */
async function handleGetFile(
  env: Environment,
  context: RequestContext,
  mindmapId: string,
  nodeId: string,
  fileId: string,
  searchParams: URLSearchParams
): Promise<Response> {
  try {
    // アクセス権限の確認
    await verifyMindmapOwnership(env.DB, context.userId, mindmapId);

    // パラメータのバリデーション
    const sanitizedMindmapId = validateSQLParam(mindmapId);
    const sanitizedNodeId = validateSQLParam(nodeId);
    const sanitizedFileId = validateSQLParam(fileId);

    // ファイル情報取得
    const attachment = await env.DB.prepare(`
      SELECT * FROM attachments 
      WHERE id = ? AND mindmap_id = ? AND node_id = ?
    `).bind(sanitizedFileId, sanitizedMindmapId, sanitizedNodeId).first() as FileAttachment | null;

    if (!attachment) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'File not found' 
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const downloadType = searchParams.get('type') || 'info';
    
    switch (downloadType) {
      case 'download':
        return await handleFileDownload(env, attachment);
      
      case 'thumbnail':
        return await handleThumbnailDownload(env, attachment);
      
      case 'info':
      default:
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: attachment.id,
              fileName: attachment.file_name,
              originalName: attachment.original_name,
              fileSize: attachment.file_size,
              mimeType: attachment.mime_type,
              attachmentType: attachment.attachment_type,
              hasThumbnail: !!attachment.thumbnail_path,
              uploadedAt: attachment.uploaded_at,
              downloadUrl: `/api/files/${encodeURIComponent(attachment.mindmap_id)}/${encodeURIComponent(attachment.node_id)}/${encodeURIComponent(attachment.id)}?type=download`,
            },
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('File get error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to retrieve file' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * ファイルダウンロード処理
 */
async function handleFileDownload(
  env: Environment,
  attachment: FileAttachment
): Promise<Response> {
  try {
    const fileObject = await env.FILES.get(attachment.storage_path);
    if (!fileObject) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'File not found in storage' 
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(fileObject.body, {
      headers: {
        'Content-Type': attachment.mime_type,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.original_name)}"`,
        'Content-Length': attachment.file_size.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });

  } catch (error) {
    console.error('File download error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Download failed' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * サムネイルダウンロード処理
 */
async function handleThumbnailDownload(
  env: Environment,
  attachment: FileAttachment
): Promise<Response> {
  if (!attachment.thumbnail_path) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Thumbnail not available' 
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const thumbnailObject = await env.FILES.get(attachment.thumbnail_path);
    if (!thumbnailObject) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Thumbnail not found in storage' 
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(thumbnailObject.body, {
      headers: {
        'Content-Type': attachment.mime_type,
        'Cache-Control': 'public, max-age=86400', // 24時間キャッシュ
      },
    });

  } catch (error) {
    console.error('Thumbnail download error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Thumbnail download failed' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * ノードのファイル一覧取得
 */
async function handleGetNodeFiles(
  env: Environment,
  context: RequestContext,
  mindmapId: string,
  nodeId: string
): Promise<Response> {
  try {
    await verifyMindmapOwnership(env.DB, context.userId, mindmapId);

    const sanitizedMindmapId = validateSQLParam(mindmapId);
    const sanitizedNodeId = validateSQLParam(nodeId);

    const { results: attachments } = await env.DB.prepare(`
      SELECT * FROM attachments 
      WHERE mindmap_id = ? AND node_id = ? 
      ORDER BY uploaded_at DESC
    `).bind(sanitizedMindmapId, sanitizedNodeId).all() as { results: FileAttachment[] };

    const files = attachments.map(att => ({
      id: att.id,
      fileName: att.file_name,
      originalName: att.original_name,
      fileSize: att.file_size,
      mimeType: att.mime_type,
      attachmentType: att.attachment_type,
      hasThumbnail: !!att.thumbnail_path,
      uploadedAt: att.uploaded_at,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        data: files,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Get node files error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to retrieve node files' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * マインドマップのファイル一覧取得
 */
async function handleGetMindmapFiles(
  env: Environment,
  context: RequestContext,
  mindmapId: string
): Promise<Response> {
  try {
    await verifyMindmapOwnership(env.DB, context.userId, mindmapId);

    const sanitizedMindmapId = validateSQLParam(mindmapId);

    const { results: attachments } = await env.DB.prepare(`
      SELECT * FROM attachments 
      WHERE mindmap_id = ? 
      ORDER BY uploaded_at DESC
    `).bind(sanitizedMindmapId).all() as { results: FileAttachment[] };

    const files = attachments.map(att => ({
      id: att.id,
      nodeId: att.node_id,
      fileName: att.file_name,
      originalName: att.original_name,
      fileSize: att.file_size,
      mimeType: att.mime_type,
      attachmentType: att.attachment_type,
      hasThumbnail: !!att.thumbnail_path,
      uploadedAt: att.uploaded_at,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        data: files,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Get mindmap files error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to retrieve mindmap files' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * ファイル更新処理
 */
async function handleUpdateFile(
  env: Environment,
  context: RequestContext,
  mindmapId: string,
  nodeId: string,
  fileId: string,
  request: WorkerRequest
): Promise<Response> {
  try {
    await verifyMindmapOwnership(env.DB, context.userId, mindmapId);

    const updateData = await request.json() as { fileName?: string };
    
    if (!updateData.fileName || updateData.fileName.trim() === '') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'File name is required' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sanitizedMindmapId = validateSQLParam(mindmapId);
    const sanitizedNodeId = validateSQLParam(nodeId);
    const sanitizedFileId = validateSQLParam(fileId);

    const now = new Date().toISOString();
    await env.DB.prepare(`
      UPDATE attachments 
      SET file_name = ?, updated_at = ? 
      WHERE id = ? AND mindmap_id = ? AND node_id = ?
    `).bind(updateData.fileName, now, sanitizedFileId, sanitizedMindmapId, sanitizedNodeId).run();

    return new Response(
      JSON.stringify({
        success: true,
        data: { updated_at: now },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('File update error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'File update failed' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * ファイル削除処理
 */
async function handleDeleteFile(
  env: Environment,
  context: RequestContext,
  mindmapId: string,
  nodeId: string,
  fileId: string
): Promise<Response> {
  try {
    await verifyMindmapOwnership(env.DB, context.userId, mindmapId);

    const sanitizedMindmapId = validateSQLParam(mindmapId);
    const sanitizedNodeId = validateSQLParam(nodeId);
    const sanitizedFileId = validateSQLParam(fileId);

    // ファイル情報取得
    const attachment = await env.DB.prepare(`
      SELECT * FROM attachments 
      WHERE id = ? AND mindmap_id = ? AND node_id = ?
    `).bind(sanitizedFileId, sanitizedMindmapId, sanitizedNodeId).first() as FileAttachment | null;

    if (!attachment) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'File not found' 
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // R2からファイル削除
    await env.FILES.delete(attachment.storage_path);
    
    // サムネイルも削除
    if (attachment.thumbnail_path) {
      await env.FILES.delete(attachment.thumbnail_path);
    }

    // データベースから削除
    await env.DB.prepare(`
      DELETE FROM attachments 
      WHERE id = ? AND mindmap_id = ? AND node_id = ?
    `).bind(sanitizedFileId, sanitizedMindmapId, sanitizedNodeId).run();

    const now = new Date().toISOString();
    await env.DB.prepare(
      'UPDATE mindmaps SET updated_at = ? WHERE id = ? AND user_id = ?'
    ).bind(now, sanitizedMindmapId, context.userId).run();

    return new Response(
      JSON.stringify({
        success: true,
        data: { deleted_at: now },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('File deletion error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'File deletion failed' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * ユーティリティ関数
 */

async function verifyMindmapOwnership(
  db: D1Database,
  userId: string,
  mindmapId: string
): Promise<void> {
  const sanitizedMindmapId = validateSQLParam(mindmapId);
  const sanitizedUserId = validateSQLParam(userId);
  
  const result = await db.prepare(`
    SELECT id FROM mindmaps 
    WHERE id = ? AND user_id = ?
  `).bind(sanitizedMindmapId, sanitizedUserId).first();
  
  if (!result) {
    throw new Error('Access denied: Mindmap not found or access not authorized');
  }
}

function getAttachmentType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('text/')) return 'text';
  return 'file';
}

function isImageProcessable(mimeType: string): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType);
}

async function generateThumbnail(
  r2Bucket: R2Bucket,
  fileBuffer: ArrayBuffer,
  originalPath: string,
  mimeType: string
): Promise<string | null> {
  try {
    // 簡易実装：元ファイルをサムネイルとして保存
    // 実際の実装では画像リサイズライブラリを使用
    const thumbnailPath = originalPath.replace(/(\.[^.]+)$/, '_thumb$1');
    
    await r2Bucket.put(thumbnailPath, fileBuffer, {
      httpMetadata: {
        contentType: mimeType,
      },
      customMetadata: {
        isThumbnail: 'true',
      },
    });
    
    return thumbnailPath;
  } catch (error) {
    console.error('Thumbnail generation failed:', error);
    return null;
  }
}