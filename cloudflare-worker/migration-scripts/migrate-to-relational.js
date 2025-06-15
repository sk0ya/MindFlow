/**
 * 階層型データからリレーショナル型データへの移行スクリプト
 * 
 * 使用方法:
 * 1. Cloudflare Workers環境で実行
 * 2. 既存データを新しいリレーショナル構造に変換
 * 3. 後方互換性を維持しながら段階的移行
 */

// データ変換ユーティリティをインポート（実際の環境では適切なパスに変更）
class DataConverter {
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
        created_at: mindmapData.createdAt || new Date().toISOString(),
        updated_at: mindmapData.updatedAt || new Date().toISOString(),
        migrated_to_relational: true,
        migration_date: new Date().toISOString()
      },
      nodes,
      connections,
      attachments,
      links
    };
  }

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
          storage_path: `legacy/${attachmentId}`,
          attachment_type: attachment.isImage ? 'image' : 'file',
          legacy_data_url: attachment.dataURL,
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
}

export class MigrationScript {
  constructor(db) {
    this.db = db;
    this.migrationStats = {
      total: 0,
      success: 0,
      failed: 0,
      errors: []
    };
  }

  /**
   * 全データの移行を実行
   */
  async migrateAllData() {
    console.log('=== リレーショナル構造への移行開始 ===');
    console.log(`開始時刻: ${new Date().toISOString()}`);
    
    try {
      // 既存のマインドマップを取得
      const { results: mindmaps } = await this.db.prepare(`
        SELECT id, title, category, theme, data, user_id, created_at, updated_at, migrated_to_relational
        FROM mindmaps 
        WHERE migrated_to_relational = 0 OR migrated_to_relational IS NULL
        ORDER BY created_at
      `).all();

      this.migrationStats.total = mindmaps.length;
      console.log(`移行対象: ${mindmaps.length}個のマインドマップ`);

      if (mindmaps.length === 0) {
        console.log('移行対象のマインドマップが見つかりませんでした。');
        return this.migrationStats;
      }

      // バッチサイズで処理（大量データ対応）
      const batchSize = 10;
      for (let i = 0; i < mindmaps.length; i += batchSize) {
        const batch = mindmaps.slice(i, i + batchSize);
        await this.processBatch(batch);
        
        // 進捗表示
        console.log(`進捗: ${Math.min(i + batchSize, mindmaps.length)}/${mindmaps.length}`);
      }
      
      console.log('=== 移行完了 ===');
      console.log(`成功: ${this.migrationStats.success}件`);
      console.log(`失敗: ${this.migrationStats.failed}件`);
      console.log(`完了時刻: ${new Date().toISOString()}`);

      if (this.migrationStats.errors.length > 0) {
        console.log('\n=== エラー詳細 ===');
        this.migrationStats.errors.forEach((error, index) => {
          console.log(`${index + 1}. ${error}`);
        });
      }

    } catch (error) {
      console.error('移行処理中にエラーが発生しました:', error);
      throw error;
    }

    return this.migrationStats;
  }

  /**
   * バッチ処理
   */
  async processBatch(mindmaps) {
    for (const mindmapRow of mindmaps) {
      try {
        await this.migrateSingleMindmap(mindmapRow);
        this.migrationStats.success++;
        console.log(`✓ 移行完了: ${mindmapRow.title} (${mindmapRow.id})`);
      } catch (error) {
        this.migrationStats.failed++;
        const errorMessage = `${mindmapRow.title} (${mindmapRow.id}): ${error.message}`;
        this.migrationStats.errors.push(errorMessage);
        console.error(`✗ 移行失敗: ${errorMessage}`);
      }
    }
  }

  /**
   * 単一マインドマップの移行
   */
  async migrateSingleMindmap(mindmapRow) {
    let mindmapData;
    
    try {
      mindmapData = JSON.parse(mindmapRow.data);
    } catch (error) {
      throw new Error(`JSONパース失敗: ${error.message}`);
    }

    // 必須フィールドチェック
    if (!mindmapData.rootNode) {
      throw new Error('rootNodeが見つかりません');
    }

    // メタデータ補完
    mindmapData.id = mindmapRow.id;
    mindmapData.title = mindmapRow.title;
    mindmapData.category = mindmapRow.category;
    mindmapData.theme = mindmapRow.theme;
    mindmapData.user_id = mindmapRow.user_id;
    mindmapData.createdAt = mindmapRow.created_at;
    mindmapData.updatedAt = mindmapRow.updated_at;

    // リレーショナル形式に変換
    const converted = DataConverter.hierarchicalToRelational(mindmapData);
    
    // データ整合性チェック
    const validation = this.validateConvertedData(converted);
    if (!validation.isValid) {
      throw new Error(`データ検証失敗: ${validation.errors.join(', ')}`);
    }

    // データベースに保存
    await this.saveMindmapRelational(converted);
  }

  /**
   * 変換されたデータの検証
   */
  validateConvertedData(data) {
    const errors = [];

    if (!data.mindmap?.id) {
      errors.push('mindmap.id が必要です');
    }

    if (!data.nodes || !Array.isArray(data.nodes)) {
      errors.push('nodes配列が必要です');
    } else {
      const rootNodes = data.nodes.filter(n => n.type === 'root');
      if (rootNodes.length !== 1) {
        errors.push(`rootノードは1個である必要があります（現在: ${rootNodes.length}個）`);
      }

      // ノードIDの重複チェック
      const nodeIds = data.nodes.map(n => n.id);
      const duplicates = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index);
      if (duplicates.length > 0) {
        errors.push(`重複するノードID: ${duplicates.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * リレーショナルデータをデータベースに保存
   */
  async saveMindmapRelational(data) {
    const statements = [];

    // マインドマップ更新
    statements.push(
      this.db.prepare(`
        UPDATE mindmaps SET 
          migrated_to_relational = 1,
          migration_date = ?,
          updated_at = ?
        WHERE id = ?
      `).bind(
        data.mindmap.migration_date,
        data.mindmap.updated_at,
        data.mindmap.id
      )
    );

    // ノード保存
    data.nodes.forEach(node => {
      statements.push(
        this.db.prepare(`
          INSERT OR REPLACE INTO nodes 
          (id, mindmap_id, text, type, parent_id, position_x, position_y, 
           style_settings, notes, tags, collapsed, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          node.id, node.mindmap_id, node.text, node.type, node.parent_id,
          node.position_x, node.position_y, node.style_settings,
          node.notes, node.tags, node.collapsed, node.created_at, node.updated_at
        )
      );
    });

    // 添付ファイル保存
    data.attachments.forEach(att => {
      statements.push(
        this.db.prepare(`
          INSERT OR REPLACE INTO attachments 
          (id, node_id, file_name, original_name, file_size, mime_type, 
           storage_path, attachment_type, legacy_data_url, uploaded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          att.id, att.node_id, att.file_name, att.original_name,
          att.file_size, att.mime_type, att.storage_path, att.attachment_type,
          att.legacy_data_url, att.uploaded_at
        )
      );
    });

    // リンク保存
    data.links.forEach(link => {
      statements.push(
        this.db.prepare(`
          INSERT OR REPLACE INTO node_links 
          (id, node_id, url, title, description, domain, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          link.id, link.node_id, link.url, link.title,
          link.description, link.domain, link.created_at
        )
      );
    });

    // 接続保存（現在は空だが将来の拡張用）
    data.connections.forEach(conn => {
      statements.push(
        this.db.prepare(`
          INSERT OR REPLACE INTO node_connections 
          (id, mindmap_id, from_node_id, to_node_id, connection_type, label, style_settings, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          conn.id, conn.mindmap_id, conn.from_node_id, conn.to_node_id,
          conn.connection_type, conn.label, conn.style_settings, conn.created_at
        )
      );
    });

    // トランザクション実行
    await this.db.batch(statements);
  }

  /**
   * 移行の巻き戻し（緊急時用）
   */
  async rollbackMigration(mindmapId) {
    console.log(`移行巻き戻し開始: ${mindmapId}`);
    
    await this.db.batch([
      this.db.prepare('DELETE FROM nodes WHERE mindmap_id = ?').bind(mindmapId),
      this.db.prepare('DELETE FROM attachments WHERE node_id IN (SELECT id FROM nodes WHERE mindmap_id = ?)').bind(mindmapId),
      this.db.prepare('DELETE FROM node_links WHERE node_id IN (SELECT id FROM nodes WHERE mindmap_id = ?)').bind(mindmapId),
      this.db.prepare('DELETE FROM node_connections WHERE mindmap_id = ?').bind(mindmapId),
      this.db.prepare('UPDATE mindmaps SET migrated_to_relational = 0, migration_date = NULL WHERE id = ?').bind(mindmapId)
    ]);

    console.log(`移行巻き戻し完了: ${mindmapId}`);
  }

  /**
   * 移行状況の確認
   */
  async getMigrationStatus() {
    const total = await this.db.prepare('SELECT COUNT(*) as count FROM mindmaps').first();
    const migrated = await this.db.prepare('SELECT COUNT(*) as count FROM mindmaps WHERE migrated_to_relational = 1').first();
    
    return {
      total: total.count,
      migrated: migrated.count,
      remaining: total.count - migrated.count,
      percentage: total.count > 0 ? Math.round((migrated.count / total.count) * 100) : 0
    };
  }
}

/**
 * スクリプト実行用ヘルパー関数
 */
export async function runMigration(env) {
  const migration = new MigrationScript(env.DB);
  
  console.log('移行前状況確認...');
  const statusBefore = await migration.getMigrationStatus();
  console.log(`移行前: ${statusBefore.migrated}/${statusBefore.total} (${statusBefore.percentage}%)`);
  
  const result = await migration.migrateAllData();
  
  console.log('移行後状況確認...');
  const statusAfter = await migration.getMigrationStatus();
  console.log(`移行後: ${statusAfter.migrated}/${statusAfter.total} (${statusAfter.percentage}%)`);
  
  return {
    migration: result,
    status: statusAfter
  };
}

// テスト用関数
export async function testMigration(env, mindmapId) {
  const migration = new MigrationScript(env.DB);
  
  // 特定のマインドマップのみ移行テスト
  const { results: mindmaps } = await env.DB.prepare(
    'SELECT * FROM mindmaps WHERE id = ? AND (migrated_to_relational = 0 OR migrated_to_relational IS NULL)'
  ).bind(mindmapId).all();
  
  if (mindmaps.length === 0) {
    throw new Error(`テスト対象が見つかりません: ${mindmapId}`);
  }
  
  await migration.migrateSingleMindmap(mindmaps[0]);
  console.log(`テスト移行完了: ${mindmapId}`);
  
  return true;
}