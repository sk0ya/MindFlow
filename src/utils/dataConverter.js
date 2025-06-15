/**
 * データ変換ユーティリティ
 * 階層型データ構造 ⇔ リレーショナル型データ構造の変換
 */

export class DataConverter {
  /**
   * 階層型データをリレーショナル型に変換
   * @param {Object} mindmapData - 既存の階層型データ
   * @returns {Object} - リレーショナル型データ
   */
  static hierarchicalToRelational(mindmapData) {
    const nodes = [];
    const connections = [];
    const attachments = [];
    const links = [];

    // ルートノードから再帰的に変換
    this.convertNodeRecursively(
      mindmapData.rootNode, 
      mindmapData.id, 
      null, 
      nodes, 
      attachments,
      links
    );

    return {
      mindmap: {
        id: mindmapData.id,
        title: mindmapData.title,
        category: mindmapData.category || 'general',
        theme: mindmapData.theme || 'default', 
        settings: JSON.stringify(mindmapData.settings || {}),
        user_id: mindmapData.user_id || 'default-user',
        created_at: mindmapData.createdAt,
        updated_at: mindmapData.updatedAt,
        migrated_to_relational: true,
        migration_date: new Date().toISOString()
      },
      nodes,
      connections,
      attachments,
      links
    };
  }

  /**
   * ノードを再帰的に変換
   */
  static convertNodeRecursively(node, mindmapId, parentId, nodes, attachments, links) {
    // ノード変換
    const convertedNode = {
      id: node.id,
      mindmap_id: mindmapId,
      text: node.text || '',
      type: node.id === 'root' ? 'root' : 'branch',
      parent_id: parentId,
      position_x: node.x || 0,
      position_y: node.y || 0,
      style_settings: JSON.stringify({
        fontSize: node.fontSize || 14,
        fontWeight: node.fontWeight || 'normal',
        backgroundColor: node.backgroundColor,
        textColor: node.textColor,
        color: node.color
      }),
      notes: node.notes || '',
      tags: JSON.stringify(node.tags || []),
      collapsed: node.collapsed || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    nodes.push(convertedNode);

    // 添付ファイル変換
    if (node.attachments && Array.isArray(node.attachments)) {
      node.attachments.forEach(attachment => {
        const attachmentId = attachment.id || `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        attachments.push({
          id: attachmentId,
          node_id: node.id,
          file_name: attachment.name || 'untitled',
          original_name: attachment.name || 'untitled',
          file_size: attachment.size || 0,
          mime_type: attachment.type || 'application/octet-stream',
          storage_path: `legacy/${attachmentId}`, // 後でR2に移行
          attachment_type: attachment.isImage ? 'image' : 'file',
          legacy_data_url: attachment.dataURL, // 移行用
          uploaded_at: new Date().toISOString()
        });
      });
    }

    // リンク変換
    if (node.mapLinks && Array.isArray(node.mapLinks)) {
      node.mapLinks.forEach(link => {
        const linkId = link.id || `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        try {
          const url = new URL(link.url);
          links.push({
            id: linkId,
            node_id: node.id,
            url: link.url,
            title: link.title || link.url,
            description: link.description || '',
            domain: url.hostname,
            created_at: new Date().toISOString()
          });
        } catch (e) {
          // 無効なURLの場合はスキップ
          console.warn('Invalid URL in mapLinks:', link.url);
        }
      });
    }

    // 子ノード再帰処理
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => {
        this.convertNodeRecursively(child, mindmapId, node.id, nodes, attachments, links);
      });
    }
  }

  /**
   * リレーショナル型データを階層型に変換（後方互換性用）
   * @param {Object} mindmap - マインドマップ情報
   * @param {Array} nodes - ノード配列
   * @param {Array} connections - 接続配列
   * @param {Array} attachments - 添付ファイル配列
   * @param {Array} links - リンク配列
   * @returns {Object} - 階層型データ
   */
  static relationalToHierarchical(mindmap, nodes, connections, attachments, links) {
    const nodeMap = new Map();
    const attachmentMap = new Map();
    const linkMap = new Map();

    // 添付ファイルをノード別にグループ化
    attachments.forEach(att => {
      if (!attachmentMap.has(att.node_id)) {
        attachmentMap.set(att.node_id, []);
      }
      attachmentMap.get(att.node_id).push({
        id: att.id,
        name: att.file_name,
        type: att.mime_type,
        size: att.file_size,
        isImage: att.attachment_type === 'image',
        dataURL: att.legacy_data_url,
        downloadUrl: att.storage_path
      });
    });

    // リンクをノード別にグループ化
    links.forEach(link => {
      if (!linkMap.has(link.node_id)) {
        linkMap.set(link.node_id, []);
      }
      linkMap.get(link.node_id).push({
        id: link.id,
        url: link.url,
        title: link.title,
        description: link.description,
        domain: link.domain
      });
    });

    // ノードを階層構造に変換
    nodes.forEach(node => {
      const style = JSON.parse(node.style_settings || '{}');
      const convertedNode = {
        id: node.id,
        text: node.text,
        x: node.position_x,
        y: node.position_y,
        fontSize: style.fontSize || 14,
        fontWeight: style.fontWeight || 'normal',
        backgroundColor: style.backgroundColor,
        textColor: style.textColor,
        color: style.color,
        collapsed: node.collapsed || false,
        notes: node.notes || '',
        tags: JSON.parse(node.tags || '[]'),
        children: [],
        attachments: attachmentMap.get(node.id) || [],
        mapLinks: linkMap.get(node.id) || []
      };
      nodeMap.set(node.id, convertedNode);
    });

    // 親子関係構築
    const rootNode = nodeMap.get('root');
    nodes.forEach(node => {
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        const parent = nodeMap.get(node.parent_id);
        const child = nodeMap.get(node.id);
        if (parent && child) {
          parent.children.push(child);
        }
      }
    });

    // 設定の変換
    const settings = JSON.parse(mindmap.settings || '{}');

    return {
      id: mindmap.id,
      title: mindmap.title,
      category: mindmap.category,
      theme: mindmap.theme,
      settings: settings,
      user_id: mindmap.user_id,
      createdAt: mindmap.created_at,
      updatedAt: mindmap.updated_at,
      rootNode: rootNode || {
        id: 'root',
        text: 'メイントピック',
        x: 400,
        y: 300,
        fontSize: 16,
        fontWeight: 'bold',
        children: [],
        attachments: [],
        mapLinks: []
      }
    };
  }

  /**
   * データ整合性チェック
   * @param {Object} data - チェック対象データ
   * @returns {Object} - チェック結果
   */
  static validateData(data) {
    const errors = [];
    const warnings = [];

    // 必須フィールドチェック
    if (!data.mindmap?.id) {
      errors.push('mindmap.id is required');
    }
    if (!data.mindmap?.title) {
      warnings.push('mindmap.title is empty');
    }

    // ノードの整合性チェック
    if (!data.nodes || !Array.isArray(data.nodes)) {
      errors.push('nodes array is required');
    } else {
      const nodeIds = new Set();
      const rootNodes = data.nodes.filter(n => n.type === 'root');
      
      if (rootNodes.length !== 1) {
        errors.push(`Expected 1 root node, found ${rootNodes.length}`);
      }

      data.nodes.forEach(node => {
        if (!node.id) {
          errors.push('Node missing id');
        } else if (nodeIds.has(node.id)) {
          errors.push(`Duplicate node id: ${node.id}`);
        } else {
          nodeIds.add(node.id);
        }

        if (node.parent_id && !nodeIds.has(node.parent_id)) {
          warnings.push(`Node ${node.id} has invalid parent_id: ${node.parent_id}`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * データ統計情報の取得
   * @param {Object} data - 統計対象データ
   * @returns {Object} - 統計情報
   */
  static getDataStats(data) {
    const stats = {
      totalNodes: data.nodes?.length || 0,
      totalAttachments: data.attachments?.length || 0,
      totalLinks: data.links?.length || 0,
      totalConnections: data.connections?.length || 0,
      nodesByType: {},
      attachmentsByType: {},
      maxDepth: 0
    };

    // ノードタイプ別統計
    if (data.nodes) {
      data.nodes.forEach(node => {
        stats.nodesByType[node.type] = (stats.nodesByType[node.type] || 0) + 1;
      });
    }

    // 添付ファイルタイプ別統計
    if (data.attachments) {
      data.attachments.forEach(att => {
        stats.attachmentsByType[att.attachment_type] = (stats.attachmentsByType[att.attachment_type] || 0) + 1;
      });
    }

    // 最大深度計算
    if (data.nodes) {
      const calculateDepth = (nodeId, depth = 0) => {
        const children = data.nodes.filter(n => n.parent_id === nodeId);
        if (children.length === 0) return depth;
        return Math.max(...children.map(child => calculateDepth(child.id, depth + 1)));
      };
      
      const rootNode = data.nodes.find(n => n.type === 'root');
      if (rootNode) {
        stats.maxDepth = calculateDepth(rootNode.id);
      }
    }

    return stats;
  }
}

export default DataConverter;