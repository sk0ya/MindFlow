import { corsHeaders } from '../utils/cors.js';
import { requireAuth } from '../utils/auth.js';

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  
  // 認証チェック（JWT認証またはX-User-IDを受け入れ）
  let userId = 'default-user';
  
  // JWT認証チェック
  if (env.ENABLE_AUTH === 'true') {
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      console.log('認証失敗:', authResult.error);
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(env.CORS_ORIGIN)
        }
      });
    }
    // JWTのuserIdは必ずemail（auth.jsで設定）
    userId = authResult.user.userId;
    console.log('JWT認証成功 - userId:', userId, 'email:', authResult.user.email);
  } else {
    // 認証が無効の場合はX-User-IDを使用
    userId = request.headers.get('X-User-ID') || 'default-user';
    console.log('認証無効モード - userId:', userId);
  }

  // Extract mindmap ID from path if present
  const pathParts = url.pathname.split('/');
  const mindmapId = pathParts[3]; // /api/mindmaps/{id}

  try {
    let response;
    
    switch (method) {
      case 'GET':
        if (mindmapId) {
          response = await getMindMap(env.DB, userId, mindmapId);
        } else {
          response = await getAllMindMaps(env.DB, userId);
        }
        break;
      
      case 'POST':
        response = await createMindMap(env.DB, userId, await request.json());
        break;
      
      case 'PUT':
        if (!mindmapId) {
          throw new Error('Mind map ID required for update');
        }
        response = await updateMindMap(env.DB, userId, mindmapId, await request.json());
        break;
      
      case 'DELETE':
        if (!mindmapId) {
          throw new Error('Mind map ID required for deletion');
        }
        response = await deleteMindMap(env.DB, userId, mindmapId);
        break;
      
      default:
        throw new Error(`Method ${method} not allowed`);
    }

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.CORS_ORIGIN)
      }
    });

  } catch (error) {
    console.error('=== API ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Request method:', method);
    console.error('Request URL:', url.pathname);
    console.error('User ID:', userId);
    console.error('Mindmap ID:', mindmapId);
    console.error('================');
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.status || 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.CORS_ORIGIN)
      }
    });
  }
}

async function getAllMindMaps(db, userId) {
  // Ensure user exists
  await ensureUser(db, userId);
  
  const { results } = await db.prepare(
    'SELECT id, title, category, theme, node_count, created_at, updated_at FROM mindmaps WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(userId).all();
  
  // 軽量な一覧形式で返す
  const mindmaps = results.map(row => ({
    id: row.id,
    title: row.title,
    category: row.category || '未分類',
    theme: row.theme || 'default',
    nodeCount: row.node_count || 1,
    updatedAt: row.updated_at,
    createdAt: row.created_at
  }));
  
  return { mindmaps };
}

// ノード数をカウントするヘルパー関数
function countNodesInData(data) {
  if (!data.rootNode) return 1;
  
  function countNodes(node) {
    let count = 1;
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => {
        count += countNodes(child);
      });
    }
    return count;
  }
  
  return countNodes(data.rootNode);
}

async function getMindMap(db, userId, mindmapId) {
  console.log('🔍 getMindMap 開始:', { userId, mindmapId });
  
  // マインドマップ基本情報取得（データ形式を判定するため）
  const mindmap = await db.prepare(
    'SELECT * FROM mindmaps WHERE user_id = ? AND id = ?'
  ).bind(userId, mindmapId).first();
  
  if (!mindmap) {
    console.error('❌ マインドマップが見つかりません:', { userId, mindmapId });
    const error = new Error('Mind map not found');
    error.status = 404;
    throw error;
  }
  
  console.log('📋 マインドマップ情報:', {
    id: mindmap.id,
    title: mindmap.title,
    hasDataColumn: mindmap.data !== undefined,
    hasNodeCount: mindmap.node_count !== undefined
  });
  
  // レガシー形式（dataカラム）が存在する場合の処理
  if (mindmap.data !== undefined && mindmap.data !== null) {
    console.log('🔄 レガシー形式検出 - 自動マイグレーション開始');
    
    try {
      // レガシーデータを解析
      const legacyData = JSON.parse(mindmap.data);
      console.log('📋 レガシーデータ解析完了:', {
        title: legacyData.title,
        hasRootNode: !!legacyData.rootNode,
        nodeCount: countNodesInData(legacyData)
      });
      
      // リレーショナル形式に自動マイグレーション
      const now = new Date().toISOString();
      await createMindMapRelationalFromLegacy(db, userId, mindmapId, legacyData, now);
      
      // レガシーdataカラムをクリア（マイグレーション完了フラグ）
      await db.prepare(
        'UPDATE mindmaps SET data = NULL WHERE id = ?'
      ).bind(mindmapId).run();
      
      console.log('✅ 自動マイグレーション完了 - リレーショナル形式で再読み込み');
      
      // マイグレーション後にリレーショナル形式で再読み込み
      return await getMindMapRelational(db, userId, mindmapId);
      
    } catch (error) {
      console.error('❌ レガシーデータマイグレーションエラー:', error);
      console.error('❌ レガシーデータ内容:', mindmap.data);
      
      // マイグレーションに失敗した場合は、レガシーデータをそのまま返す
      console.log('⚠️ マイグレーション失敗 - レガシー形式で返却');
      const legacyData = JSON.parse(mindmap.data);
      return {
        ...legacyData,
        id: mindmap.id,
        createdAt: mindmap.created_at,
        updatedAt: mindmap.updated_at
      };
    }
  }
  
  // リレーショナル形式として処理
  console.log('✅ リレーショナル形式として処理');
  return await getMindMapRelational(db, userId, mindmapId);
}

// リレーショナル形式からの読み込み（デバッグ強化）
async function getMindMapRelational(db, userId, mindmapId) {
  console.log('🔍 getMindMapRelational 開始:', { userId, mindmapId });
  
  // マインドマップ基本情報取得
  const mindmap = await db.prepare(
    'SELECT * FROM mindmaps WHERE user_id = ? AND id = ?'
  ).bind(userId, mindmapId).first();
  
  if (!mindmap) {
    console.error('❌ マインドマップが見つかりません:', { userId, mindmapId });
    const error = new Error('Mind map not found');
    error.status = 404;
    throw error;
  }
  
  console.log('📎 マインドマップ基本情報:', {
    id: mindmap.id,
    title: mindmap.title,
    nodeCount: mindmap.node_count
  });
  
  // ノード取得
  const { results: nodes } = await db.prepare(
    'SELECT * FROM nodes WHERE mindmap_id = ? ORDER BY created_at'
  ).bind(mindmapId).all();
  
  console.log('🌳 データベースから取得したノード数:', nodes.length);
  
  // 添付ファイル取得
  const { results: attachments } = await db.prepare(
    'SELECT * FROM attachments WHERE node_id IN (SELECT id FROM nodes WHERE mindmap_id = ?)'
  ).bind(mindmapId).all();
  
  console.log('📎 添付ファイル数:', attachments.length);
  
  // リンク取得
  const { results: links } = await db.prepare(
    'SELECT * FROM node_links WHERE node_id IN (SELECT id FROM nodes WHERE mindmap_id = ?)'
  ).bind(mindmapId).all();
  
  console.log('🔗 リンク数:', links.length);
  
  // 階層構造を再構築
  console.log('🔧 階層構造再構築開始');
  const rootNode = buildHierarchicalStructure(nodes, attachments, links, mindmapId);
  
  const result = {
    id: mindmap.id,
    title: mindmap.title,
    category: mindmap.category || '未分類',
    theme: mindmap.theme || 'default',
    rootNode: rootNode,
    settings: JSON.parse(mindmap.settings || '{}'),
    createdAt: mindmap.created_at,
    updatedAt: mindmap.updated_at,
  };
  
  console.log('✅ getMindMapRelational 完了:', {
    id: result.id,
    title: result.title,
    hasRootNode: !!result.rootNode,
    rootNodeId: result.rootNode?.id,
    rootNodeChildrenCount: result.rootNode?.children?.length || 0
  });
  
  return result;
}

// リレーショナルデータから階層構造を再構築（デバッグ強化版）
function buildHierarchicalStructure(nodes, attachments, links, mindmapId = null) {
  console.log('🔧 buildHierarchicalStructure 開始:', {
    nodesCount: nodes ? nodes.length : 0,
    attachmentsCount: attachments ? attachments.length : 0,
    linksCount: links ? links.length : 0,
    mindmapId,
    nodesSample: nodes && nodes.length > 0 ? nodes[0] : null
  });
  
  const nodeMap = new Map();
  const attachmentMap = new Map();
  const linkMap = new Map();
  
  // 添付ファイルをノードIDでグループ化
  attachments.forEach(att => {
    if (!attachmentMap.has(att.node_id)) {
      attachmentMap.set(att.node_id, []);
    }
    attachmentMap.get(att.node_id).push({
      id: att.id,
      name: att.file_name,
      type: att.mime_type,
      size: att.file_size,
      dataURL: null, // R2ストレージではdataURLは使用しない
      isImage: att.attachment_type === 'image',
      // R2ストレージのメタデータ
      isR2Storage: true,
      r2FileId: att.id,
      nodeId: att.node_id, // nodeIdを明示的に追加
      storagePath: att.storage_path,
      downloadUrl: `/api/files/${mindmapId}/${att.node_id}/${att.id}?type=download`
    });
  });
  
  // リンクをノードIDでグループ化
  links.forEach(link => {
    if (!linkMap.has(link.node_id)) {
      linkMap.set(link.node_id, []);
    }
    linkMap.get(link.node_id).push({
      id: link.id,
      url: link.url,
      title: link.title,
      description: link.description
    });
  });
  
  // ノードを階層構造に変換
  nodes.forEach(node => {
    const styleSettings = JSON.parse(node.style_settings || '{}');
    
    const hierarchicalNode = {
      id: node.id,
      text: node.text,
      x: node.position_x,
      y: node.position_y,
      fontSize: styleSettings.fontSize,
      fontWeight: styleSettings.fontWeight,
      backgroundColor: styleSettings.backgroundColor,
      textColor: styleSettings.textColor,
      color: styleSettings.color,
      notes: node.notes,
      tags: JSON.parse(node.tags || '[]'),
      collapsed: node.collapsed,
      children: [],
      attachments: attachmentMap.get(node.id) || [],
      mapLinks: linkMap.get(node.id) || []
    };
    
    nodeMap.set(node.id, hierarchicalNode);
  });
  
  // 親子関係を構築（デバッグ強化）
  let rootNode = null;
  const orphanNodes = [];
  
  console.log('🌳 親子関係構築開始');
  
  nodes.forEach(node => {
    const hierarchicalNode = nodeMap.get(node.id);
    
    console.log(`🔍 ノード処理: ${node.id}, parent_id: ${node.parent_id}, type: ${node.type}`);
    
    if (node.parent_id) {
      const parent = nodeMap.get(node.parent_id);
      if (parent) {
        parent.children.push(hierarchicalNode);
        console.log(`✅ 子ノード追加: ${node.id} -> ${node.parent_id}`);
      } else {
        console.warn(`⚠️ 親ノードが見つかりません: ${node.id} -> ${node.parent_id}`);
        orphanNodes.push(hierarchicalNode);
      }
    } else {
      if (rootNode) {
        console.warn(`⚠️ 複数のrootNodeが検出されました: 既存=${rootNode.id}, 新規=${node.id}`);
      }
      rootNode = hierarchicalNode;
      console.log(`🌱 rootNode設定: ${node.id}, テキスト: "${node.text}"`);
    }
  });
  
  // 孤立ノードがrootNodeの子ノードとして追加
  if (orphanNodes.length > 0 && rootNode) {
    console.log(`🔗 ${orphanNodes.length}個の孤立ノードをrootNodeに接続`);
    rootNode.children.push(...orphanNodes);
  }
  
  console.log('📋 構築結果:', {
    hasRootNode: !!rootNode,
    rootNodeId: rootNode ? rootNode.id : null,
    rootChildrenCount: rootNode ? rootNode.children.length : 0,
    orphanNodesCount: orphanNodes.length
  });
  
  // rootNodeが存在しない場合のフォールバック
  if (!rootNode) {
    console.warn('⚠️ rootNodeが見つからないため、デフォルトrootNodeを作成');
    rootNode = {
      id: 'root',
      text: 'メイントピック',
      x: 400,
      y: 300,
      fontSize: null,
      fontWeight: null,
      backgroundColor: null,
      textColor: null,
      color: null,
      notes: null,
      tags: [],
      collapsed: false,
      children: orphanNodes.length > 0 ? orphanNodes : [],
      attachments: [],
      mapLinks: []
    };
  }
  
  return rootNode;
}

// レガシーデータからリレーショナル形式への変換用関数
async function createMindMapRelationalFromLegacy(db, userId, mindmapId, legacyData, now) {
  console.log('🔄 createMindMapRelationalFromLegacy 開始:', {
    mindmapId,
    title: legacyData.title,
    hasRootNode: !!legacyData.rootNode
  });
  
  const statements = [];
  
  // マインドマップのメタデータを更新（dataカラムは残してNULLにはしない）
  statements.push(
    db.prepare(
      'UPDATE mindmaps SET category = ?, theme = ?, settings = ?, node_count = ?, updated_at = ? WHERE id = ?'
    ).bind(
      legacyData.category || 'general',
      legacyData.theme || 'default',
      JSON.stringify(legacyData.settings || {}),
      countNodesInData(legacyData),
      now,
      mindmapId
    )
  );
  
  // 既存のリレーショナルデータをクリア（外部キー制約を考慮して順序実行）
  // 1. 添付ファイルを削除
  statements.push(
    db.prepare('DELETE FROM attachments WHERE node_id IN (SELECT id FROM nodes WHERE mindmap_id = ?)').bind(mindmapId)
  );
  // 2. リンクを削除
  statements.push(
    db.prepare('DELETE FROM node_links WHERE node_id IN (SELECT id FROM nodes WHERE mindmap_id = ?)').bind(mindmapId)
  );
  // 3. ノードを削除
  statements.push(
    db.prepare('DELETE FROM nodes WHERE mindmap_id = ?').bind(mindmapId)
  );
  
  // ノード作成
  if (legacyData.rootNode) {
    console.log('🌳 レガシーrootNodeをリレーショナル形式に変換');
    // すべてのノードをフラットに処理
    const nodeDetails = new Map();
    
    function collectNodeIds(node, parentId = null) {
      nodeDetails.set(node.id, { node, parentId });
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => collectNodeIds(child, node.id));
      }
    }
    
    collectNodeIds(legacyData.rootNode);
    
    // 各ノードを作成
    for (const [nodeId, info] of nodeDetails.entries()) {
      const nodeStmts = createNodeStatements(db, info.node, mindmapId, info.parentId, now);
      statements.push(...nodeStmts);
    }
  }
  
  // 一括実行
  console.log('🚀 レガシーマイグレーション バッチ実行:', statements.length, '文');
  await db.batch(statements);
  console.log('✅ createMindMapRelationalFromLegacy 完了');
}

// リレーショナル形式での新規作成
async function createMindMapRelational(db, userId, mindmapId, mindmapData, now) {
  const statements = [];
  
  // マインドマップ作成（重複時は置換）
  statements.push(
    db.prepare(
      'INSERT OR REPLACE INTO mindmaps (id, user_id, title, category, theme, settings, node_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      mindmapId,
      userId,
      mindmapData.title || 'Untitled Mind Map',
      mindmapData.category || 'general',
      mindmapData.theme || 'default',
      JSON.stringify(mindmapData.settings || {}),
      countNodesInData(mindmapData),
      now,
      now
    )
  );
  
  // ノード作成
  if (mindmapData.rootNode) {
    // すべてのノードをフラットに処理
    const nodeDetails = new Map();
    
    function collectNodeIds(node, parentId = null) {
      nodeDetails.set(node.id, { node, parentId });
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => collectNodeIds(child, node.id));
      }
    }
    
    collectNodeIds(mindmapData.rootNode);
    
    // 各ノードを作成
    for (const [nodeId, info] of nodeDetails.entries()) {
      const nodeStmts = createNodeStatements(db, info.node, mindmapId, info.parentId, now);
      statements.push(...nodeStmts);
    }
  }
  
  // 一括実行
  try {
    const batchResult = await db.batch(statements);
    console.log('✅ createMindMapRelational バッチ実行結果:', {
      totalStatements: statements.length,
      results: batchResult ? batchResult.length : 'undefined'
    });
  } catch (batchError) {
    console.error('❌ createMindMapRelational バッチ実行エラー:', batchError);
    throw new Error(`バッチ処理失敗: ${batchError.message}`);
  }
}

// リレーショナル形式での安全な更新（データ損失防止）
async function updateMindMapRelational(db, userId, mindmapId, mindmapData, now) {
  console.log('✅ updateMindMapRelational 安全更新開始:', mindmapId);
  console.log('📋 更新データノード数:', countNodesInData(mindmapData));
  
  try {
    const statements = [];
    
    // マインドマップ更新
    statements.push(
      db.prepare(
        'UPDATE mindmaps SET title = ?, category = ?, theme = ?, settings = ?, node_count = ?, updated_at = ? WHERE id = ?'
      ).bind(
        mindmapData.title || 'Untitled Mind Map',
        mindmapData.category || 'general',
        mindmapData.theme || 'default',
        JSON.stringify(mindmapData.settings || {}),
        countNodesInData(mindmapData),
        now,
        mindmapId
      )
    );
    
    // ノードの安全な差分更新（全削除の代わり）
    if (mindmapData.rootNode) {
      console.log('🔄 ノード差分更新開始');
      
      // 既存ノードを取得
      const { results: existingNodes } = await db.prepare(
        'SELECT id, parent_id FROM nodes WHERE mindmap_id = ?'
      ).bind(mindmapId).all();
      
      const existingNodeIds = new Set(existingNodes.map(n => n.id));
      console.log('📋 既存ノード数:', existingNodeIds.size);
      
      // 新しいノード構造からすべてのノードIDを収集
      const newNodeIds = new Set();
      const nodeDetails = new Map(); // ノードの詳細情報を保持
      
      function collectNodeIds(node, parentId = null) {
        newNodeIds.add(node.id);
        nodeDetails.set(node.id, { node, parentId });
        if (node.children && Array.isArray(node.children)) {
          node.children.forEach(child => collectNodeIds(child, node.id));
        }
      }
      
      collectNodeIds(mindmapData.rootNode);
      console.log('🆕 新しいノード数:', newNodeIds.size);
      console.log('📋 ノード詳細:', Array.from(nodeDetails.entries()).map(([id, info]) => ({
        id,
        text: info.node.text,
        parentId: info.parentId,
        hasChildren: info.node.children?.length > 0
      })));
      
      // 削除すべきノード（既存にあるが新しい構造にない）
      const nodesToDelete = [...existingNodeIds].filter(id => !newNodeIds.has(id));
      console.log('🗑️ 削除対象ノード数:', nodesToDelete.length, nodesToDelete);
      
      // 不要ノードを個別に削除（安全な方法）
      for (const nodeId of nodesToDelete) {
        console.log('🗑️ ノード削除:', nodeId);
        statements.push(
          db.prepare('DELETE FROM nodes WHERE id = ? AND mindmap_id = ?').bind(nodeId, mindmapId)
        );
        // 関連データも整合性を保って削除
        statements.push(
          db.prepare('DELETE FROM attachments WHERE node_id = ?').bind(nodeId)
        );
        statements.push(
          db.prepare('DELETE FROM node_links WHERE node_id = ?').bind(nodeId)
        );
      }
      
      // 新しい／更新ノードを作成／更新
      // すべてのノードの親子関係を正しく設定するため、nodeDetailsから作成
      for (const [nodeId, info] of nodeDetails.entries()) {
        const nodeStmts = createNodeStatements(db, info.node, mindmapId, info.parentId, now);
        statements.push(...nodeStmts);
      }
      console.log('🔧 作成／更新するノード文の数:', statements.length - 1); // mindmap更新文を除く
    }
    
    // 一括実行（トランザクション保護）
    console.log('🚀 バッチ実行開始（総文数:', statements.length, '）');
    
    try {
      console.log('🔍 バッチ実行前のstatements詳細:');
      statements.forEach((stmt, index) => {
        console.log(`  Statement[${index}]:`, stmt.source || 'SQL準備文');
      });
      
      const batchResult = await db.batch(statements);
      console.log('✅ バッチ実行結果:', {
        totalStatements: statements.length,
        results: batchResult ? batchResult.length : 'undefined',
        firstResultSuccess: batchResult && batchResult[0] ? batchResult[0].success : 'N/A',
        allResultsDetails: batchResult ? batchResult.map((r, i) => ({ 
          index: i, 
          success: r.success, 
          error: r.error || null,
          changes: r.meta?.changes || 0
        })) : 'N/A'
      });
      
      // 失敗した操作があるかチェック
      if (batchResult) {
        const failures = batchResult.filter(r => !r.success);
        if (failures.length > 0) {
          console.error('❌ バッチ内で失敗した操作:', failures);
          throw new Error(`バッチ内で${failures.length}個の操作が失敗しました`);
        }
      }
      
      console.log('✅ updateMindMapRelational 安全更新完了');
    } catch (batchError) {
      console.error('❌ バッチ実行エラー:', batchError);
      console.error('❌ エラー詳細:', {
        name: batchError.name,
        message: batchError.message,
        cause: batchError.cause
      });
      console.error('❌ 失敗した文:', statements.length, '文中の一部');
      throw new Error(`バッチ処理失敗: ${batchError.message}`);
    }
  } catch (error) {
    console.error('❌ updateMindMapRelational エラー:', error);
    console.error('❌ エラースタック:', error.stack);
    throw error;
  }
}

// ノード作成文を再帰的に生成（デバッグ強化）
function createNodeStatements(db, node, mindmapId, parentId, now) {
  console.log('🔧 createNodeStatements:', {
    nodeId: node.id,
    text: node.text,
    parentId,
    hasChildren: !!(node.children && node.children.length > 0),
    childrenCount: node.children ? node.children.length : 0
  });
  
  const statements = [];
  
  // ノード作成（INSERT OR IGNOREで安全に作成、その後UPDATEで更新）
  // リレーショナル構造でのparent_id設定: rootノード自体のみparent_id = NULL
  const dbParentId = (parentId === null || parentId === undefined) ? null : parentId;
  
  // INSERT OR REPLACEで安全にノード作成/更新
  statements.push(
    db.prepare(
      'INSERT OR REPLACE INTO nodes (id, mindmap_id, parent_id, text, type, position_x, position_y, style_settings, notes, tags, collapsed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      node.id,
      mindmapId,
      dbParentId,
      node.text || '',
      dbParentId === null ? 'root' : 'branch',
      node.x || 0,
      node.y || 0,
      JSON.stringify({
        fontSize: node.fontSize,
        fontWeight: node.fontWeight,
        backgroundColor: node.backgroundColor,
        textColor: node.textColor,
        color: node.color
      }),
      node.notes || '',
      JSON.stringify(node.tags || []),
      node.collapsed || false,
      now,
      now
    )
  );
  
  console.log('✅ ノード文作成:', node.id, 'テキスト:', node.text || '（空）');
  
  // 添付ファイル
  if (node.attachments && Array.isArray(node.attachments)) {
    node.attachments.forEach(att => {
      const attachmentId = att.id || `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      statements.push(
        db.prepare(
          'INSERT OR REPLACE INTO attachments (id, node_id, file_name, original_name, file_size, mime_type, storage_path, attachment_type, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          attachmentId,
          node.id,
          att.name || 'untitled',
          att.name || 'untitled',
          att.size || 0,
          att.type || 'application/octet-stream',
          att.storagePath || `legacy/${attachmentId}`,
          att.isImage ? 'image' : 'file',
          now
        )
      );
    });
  }
  
  // リンク
  if (node.mapLinks && Array.isArray(node.mapLinks)) {
    node.mapLinks.forEach(link => {
      const linkId = link.id || `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      try {
        const url = new URL(link.url);
        statements.push(
          db.prepare(
            'INSERT OR REPLACE INTO node_links (id, node_id, url, title, description, domain, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            linkId,
            node.id,
            link.url,
            link.title || link.url,
            link.description || '',
            url.hostname,
            now
          )
        );
      } catch (e) {
        console.warn('Invalid URL in mapLinks:', link.url);
      }
    });
  }
  
  // 子ノード処理は親関数で既に処理されているため、ここでは処理しない
  // updateMindMapRelational内でnodeDetailsを使って全ノードをフラットに処理している
  
  console.log('📋 createNodeStatements 完了:', node.id, '総文数:', statements.length);
  return statements;
}

async function createMindMap(db, userId, mindmapData) {
  // Ensure user exists
  await ensureUser(db, userId);
  
  const id = mindmapData.id || crypto.randomUUID();
  const now = new Date().toISOString();
  
  // 直接リレーショナル形式で保存
  await createMindMapRelational(db, userId, id, mindmapData, now);
  
  // ローカル形式で返す
  return {
    ...mindmapData,
    id: id,
    createdAt: now,
    updatedAt: now
  };
}

async function updateMindMap(db, userId, mindmapId, mindmapData) {
  console.log('updateMindMap 開始 - 受信データ:', JSON.stringify({
    userId, 
    mindmapId, 
    title: mindmapData.title,
    hasRootNode: !!mindmapData.rootNode
  }, null, 2));
  
  console.log('=== ユーザーID確認 ===');
  console.log('使用中のuserId:', userId);
  console.log('mindmapId:', mindmapId);
  
  const now = new Date().toISOString();
  
  // 既存レコードを確認
  const existingRecord = await db.prepare(
    'SELECT id FROM mindmaps WHERE user_id = ? AND id = ?'
  ).bind(userId, mindmapId).first();
  
  console.log('既存レコード確認:', existingRecord ? 'あり' : 'なし');
  
  if (existingRecord) {
    // 既存レコードを更新
    await updateMindMapRelational(db, userId, mindmapId, mindmapData, now);
    console.log('UPDATE結果: リレーショナル形式で更新完了');
  } else {
    // 新規作成
    console.log('新規レコード作成:', mindmapId);
    await ensureUser(db, userId);
    await createMindMapRelational(db, userId, mindmapId, mindmapData, now);
    console.log('INSERT結果: リレーショナル形式で作成完了');
  }
  
  // 完全なマインドマップオブジェクトを返す
  const response = {
    ...mindmapData,
    updatedAt: now,
    ...(existingRecord ? {} : { createdAt: now })
  };
  
  console.log('updateMindMap 最終レスポンス:', JSON.stringify(response, null, 2));
  return response;
}


async function deleteMindMap(db, userId, mindmapId) {
  const result = await db.prepare(
    'DELETE FROM mindmaps WHERE user_id = ? AND id = ?'
  ).bind(userId, mindmapId).run();
  
  if (result.changes === 0) {
    const error = new Error('Mind map not found');
    error.status = 404;
    throw error;
  }
  
  return { success: true };
}

async function ensureUser(db, userId) {
  const { results } = await db.prepare(
    'SELECT id FROM users WHERE id = ?'
  ).bind(userId).all();
  
  if (results.length === 0) {
    await db.prepare(
      'INSERT INTO users (id, email) VALUES (?, ?)'
    ).bind(userId, `${userId}@temp.com`).run();
  }
}