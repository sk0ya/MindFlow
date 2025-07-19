import type { 
  Environment, 
  WorkerRequest, 
  ExecutionContext,
  RequestContext,
  MindMapData,
  MindMapCreateRequest,
  MindMapUpdateRequest,
} from '@/types';
import { MindMapCreateRequestSchema, MindMapUpdateRequestSchema } from '@/types';
import { requireAuth } from '@/utils/auth';
import { corsHeaders, addCORSHeaders } from '@/utils/cors';
import { validateRequestBody, validateSQLParam, generateSecureId, sanitizeString } from '@/utils/validation';

/**
 * セキュアなマインドマップハンドラー
 * - 厳密なバリデーション
 * - 適切なアクセス制御
 * - セキュアなデータ処理
 */

export async function handleMindmapsRequest(
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
    const mindmapId = pathParts[3]; // /api/mindmaps/{mindmapId}

    let response: Response;

    switch (method) {
      case 'GET':
        if (mindmapId) {
          response = await handleGetMindmap(env, context, mindmapId);
        } else {
          response = await handleGetMindmaps(env, context, url.searchParams);
        }
        break;
      
      case 'POST':
        if (mindmapId) {
          return addCORSHeaders(
            new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Cannot POST to specific mindmap ID' 
              }),
              { status: 405, headers: { 'Content-Type': 'application/json' } }
            ),
            env,
            origin
          );
        }
        response = await handleCreateMindmap(env, context, request);
        break;
      
      case 'PUT':
        if (!mindmapId) {
          return addCORSHeaders(
            new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Mindmap ID is required for update' 
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            ),
            env,
            origin
          );
        }
        response = await handleUpdateMindmap(env, context, mindmapId, request);
        break;
      
      case 'DELETE':
        if (!mindmapId) {
          return addCORSHeaders(
            new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Mindmap ID is required for deletion' 
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            ),
            env,
            origin
          );
        }
        response = await handleDeleteMindmap(env, context, mindmapId);
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
    console.error('Mindmaps handler error:', error);
    const errorResponse = new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        message: 'Mindmap operation failed'
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
 * マインドマップ作成
 */
async function handleCreateMindmap(
  env: Environment,
  context: RequestContext,
  request: WorkerRequest
): Promise<Response> {
  try {
    // リクエストボディのバリデーション
    const createData = await validateRequestBody(request, MindMapCreateRequestSchema);
    
    // タイトルのサニタイゼーション
    const sanitizedTitle = sanitizeString(createData.title);
    if (!sanitizedTitle || sanitizedTitle.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Valid title is required' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // セキュアなIDを生成
    const mindmapId = generateSecureId();
    const now = new Date().toISOString();

    // デフォルトのマインドマップデータを作成
    const defaultData: MindMapData = createData.data || {
      id: mindmapId,
      title: sanitizedTitle,
      rootNode: {
        id: generateSecureId(),
        text: sanitizedTitle,
        x: 0,
        y: 0,
        children: [],
      },
      settings: {
        autoSave: true,
        autoLayout: true,
      },
      metadata: {
        created_at: now,
        updated_at: now,
        version: 1,
      },
    };

    // データのセキュリティチェック
    validateMindmapData(defaultData);

    // データベースに保存
    await env.DB.prepare(`
      INSERT INTO mindmaps (id, user_id, title, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      mindmapId,
      context.userId,
      sanitizedTitle,
      JSON.stringify(defaultData),
      now,
      now
    ).run();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: mindmapId,
          title: sanitizedTitle,
          created_at: now,
          updated_at: now,
          data: defaultData,
        },
      }),
      { 
        status: 201,
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Create mindmap error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to create mindmap',
        message: error instanceof Error ? error.message : 'Unknown creation error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * マインドマップ取得（単体）
 */
async function handleGetMindmap(
  env: Environment,
  context: RequestContext,
  mindmapId: string
): Promise<Response> {
  try {
    const sanitizedMindmapId = validateSQLParam(mindmapId);
    
    // アクセス権限の確認とデータ取得
    const mindmap = await env.DB.prepare(`
      SELECT * FROM mindmaps 
      WHERE id = ? AND user_id = ?
    `).bind(sanitizedMindmapId, context.userId).first() as {
      id: string;
      user_id: string;
      title: string;
      data: string;
      created_at: string;
      updated_at: string;
    } | null;

    if (!mindmap) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Mindmap not found' 
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // JSONデータを安全にパース
    let parsedData: MindMapData;
    try {
      parsedData = JSON.parse(mindmap.data) as MindMapData;
      validateMindmapData(parsedData);
    } catch (parseError) {
      console.error('Failed to parse mindmap data:', parseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Corrupted mindmap data' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: mindmap.id,
          title: mindmap.title,
          created_at: mindmap.created_at,
          updated_at: mindmap.updated_at,
          data: parsedData,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Get mindmap error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to retrieve mindmap' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * マインドマップ一覧取得
 */
async function handleGetMindmaps(
  env: Environment,
  context: RequestContext,
  searchParams: URLSearchParams
): Promise<Response> {
  try {
    // ページネーションパラメータ
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    // 検索パラメータ
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sort') || 'updated_at';
    const sortOrder = searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';

    // 許可されたソート項目
    const allowedSortColumns = ['title', 'created_at', 'updated_at'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'updated_at';

    // クエリ構築
    let query = 'SELECT id, title, created_at, updated_at FROM mindmaps WHERE user_id = ?';
    const params = [context.userId];

    if (search && search.trim()) {
      const sanitizedSearch = sanitizeString(search.trim());
      query += ' AND title LIKE ?';
      params.push(`%${sanitizedSearch}%`);
    }

    // 総数取得
    const countQuery = query.replace('SELECT id, title, created_at, updated_at', 'SELECT COUNT(*) as count');
    const { count } = await env.DB.prepare(countQuery).bind(...params).first() as { count: number };

    // データ取得
    query += ` ORDER BY ${safeSortBy} ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(limit.toString(), offset.toString());

    const { results: mindmaps } = await env.DB.prepare(query).bind(...params).all() as { 
      results: Array<{
        id: string;
        title: string;
        created_at: string;
        updated_at: string;
      }>
    };

    const totalPages = Math.ceil(count / limit);

    return new Response(
      JSON.stringify({
        success: true,
        data: mindmaps,
        pagination: {
          page,
          limit,
          total: count,
          totalPages,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Get mindmaps error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to retrieve mindmaps' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * マインドマップ更新
 */
async function handleUpdateMindmap(
  env: Environment,
  context: RequestContext,
  mindmapId: string,
  request: WorkerRequest
): Promise<Response> {
  try {
    const sanitizedMindmapId = validateSQLParam(mindmapId);
    
    // アクセス権限の確認
    const existing = await env.DB.prepare(`
      SELECT id FROM mindmaps 
      WHERE id = ? AND user_id = ?
    `).bind(sanitizedMindmapId, context.userId).first();

    if (!existing) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Mindmap not found' 
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // リクエストボディのバリデーション
    const updateData = await validateRequestBody(request, MindMapUpdateRequestSchema);
    
    const now = new Date().toISOString();
    const updateFields: string[] = [];
    const params: string[] = [];

    if (updateData.title !== undefined) {
      const sanitizedTitle = sanitizeString(updateData.title);
      if (!sanitizedTitle || sanitizedTitle.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Valid title is required' 
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      updateFields.push('title = ?');
      params.push(sanitizedTitle);
    }

    if (updateData.data !== undefined) {
      validateMindmapData(updateData.data);
      updateFields.push('data = ?');
      params.push(JSON.stringify(updateData.data));
    }

    if (updateFields.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No valid fields to update' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 更新実行
    updateFields.push('updated_at = ?');
    params.push(now, sanitizedMindmapId, context.userId);

    await env.DB.prepare(`
      UPDATE mindmaps 
      SET ${updateFields.join(', ')} 
      WHERE id = ? AND user_id = ?
    `).bind(...params).run();

    return new Response(
      JSON.stringify({
        success: true,
        data: { updated_at: now },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Update mindmap error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to update mindmap',
        message: error instanceof Error ? error.message : 'Unknown update error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * マインドマップ削除
 */
async function handleDeleteMindmap(
  env: Environment,
  context: RequestContext,
  mindmapId: string
): Promise<Response> {
  try {
    const sanitizedMindmapId = validateSQLParam(mindmapId);
    
    // アクセス権限の確認
    const existing = await env.DB.prepare(`
      SELECT id FROM mindmaps 
      WHERE id = ? AND user_id = ?
    `).bind(sanitizedMindmapId, context.userId).first();

    if (!existing) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Mindmap not found' 
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 関連するファイルも削除
    const { results: attachments } = await env.DB.prepare(`
      SELECT storage_path, thumbnail_path FROM attachments 
      WHERE mindmap_id = ?
    `).bind(sanitizedMindmapId).all() as { 
      results: Array<{
        storage_path: string;
        thumbnail_path: string | null;
      }>
    };

    // R2からファイルを削除（バックグラウンドで実行）
    // ctx.waitUntil() は上位の関数で使用する必要があるため、ここでは直接実行
    try {
      for (const attachment of attachments) {
        if (attachment.storage_path) {
          await env.FILES.delete(attachment.storage_path);
        }
        if (attachment.thumbnail_path) {
          await env.FILES.delete(attachment.thumbnail_path);
        }
      }
    } catch (fileDeleteError) {
      console.error('Failed to delete some files:', fileDeleteError);
      // ファイル削除失敗はログのみで続行
    }

    // データベースから削除（外部キー制約により関連データも削除される）
    await env.DB.prepare(`
      DELETE FROM mindmaps 
      WHERE id = ? AND user_id = ?
    `).bind(sanitizedMindmapId, context.userId).run();

    const now = new Date().toISOString();
    return new Response(
      JSON.stringify({
        success: true,
        data: { deleted_at: now },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Delete mindmap error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to delete mindmap' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * マインドマップデータのセキュリティバリデーション
 */
function validateMindmapData(data: MindMapData): void {
  // 基本構造チェック
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid mindmap data structure');
  }

  if (!data.id || !data.title || !data.rootNode) {
    throw new Error('Missing required mindmap fields');
  }

  // ノード数の制限（DoS攻撃対策）
  const nodeCount = countNodes(data.rootNode);
  if (nodeCount > 10000) { // 最大10,000ノード
    throw new Error('Mindmap exceeds maximum node limit');
  }

  // データサイズの制限
  const dataSize = JSON.stringify(data).length;
  if (dataSize > 10 * 1024 * 1024) { // 10MB
    throw new Error('Mindmap data exceeds size limit');
  }

  // 危険なコンテンツのチェック
  validateNodeSecurity(data.rootNode);
}

/**
 * ノード数をカウント
 */
function countNodes(node: any): number {
  let count = 1;
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}

/**
 * ノードのセキュリティチェック
 */
function validateNodeSecurity(node: any): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  // テキストの危険なコンテンツチェック
  if (node.text && typeof node.text === 'string') {
    // スクリプトタグやjavascript:URLの検出
    const dangerousPatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /data:text\/html/i,
      /vbscript:/i,
      /on\w+\s*=/i, // イベントハンドラー
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(node.text)) {
        throw new Error('Node contains potentially dangerous content');
      }
    }
  }

  // 子ノードも再帰的にチェック
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      validateNodeSecurity(child);
    }
  }
}