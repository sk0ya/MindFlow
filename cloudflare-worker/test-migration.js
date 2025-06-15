/**
 * データ移行テストスクリプト
 * 本番実行前にローカルまたはテスト環境で動作確認を行う
 */

import { runMigration, testMigration, MigrationScript } from './migration-scripts/migrate-to-relational.js';

/**
 * テスト用のサンプルデータ
 */
const sampleMindmapData = {
  id: 'test-mindmap-1',
  title: 'テスト用マインドマップ',
  category: 'test',
  theme: 'default',
  user_id: 'test-user',
  settings: {
    autoSave: true,
    autoLayout: true
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  rootNode: {
    id: 'root',
    text: 'メイントピック',
    x: 400,
    y: 300,
    fontSize: 16,
    fontWeight: 'bold',
    children: [
      {
        id: 'node-1',
        text: '子ノード1',
        x: 200,
        y: 200,
        fontSize: 14,
        attachments: [
          {
            id: 'att-1',
            name: 'test-image.png',
            type: 'image/png',
            size: 1024,
            isImage: true,
            dataURL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
          }
        ],
        mapLinks: [
          {
            id: 'link-1',
            url: 'https://example.com',
            title: 'Example Link',
            description: 'Test link'
          }
        ],
        children: [
          {
            id: 'node-1-1',
            text: '孫ノード',
            x: 100,
            y: 150,
            fontSize: 12,
            children: []
          }
        ]
      },
      {
        id: 'node-2',
        text: '子ノード2',
        x: 600,
        y: 200,
        fontSize: 14,
        collapsed: true,
        notes: 'これはノートです',
        tags: ['重要', 'テスト'],
        children: []
      }
    ]
  }
};

/**
 * メイン関数
 */
async function main() {
  console.log('=== データ移行テスト開始 ===');
  
  try {
    // テスト環境のセットアップ（実際の環境では適切なDB接続に置き換え）
    const mockDB = createMockDatabase();
    
    // サンプルデータの投入
    await setupTestData(mockDB);
    
    // 移行テスト実行
    await runMigrationTest(mockDB);
    
    // 結果検証
    await verifyMigrationResults(mockDB);
    
    console.log('=== すべてのテストが成功しました ===');
    
  } catch (error) {
    console.error('=== テスト失敗 ===');
    console.error(error);
    process.exit(1);
  }
}

/**
 * モックデータベースの作成（テスト用）
 */
function createMockDatabase() {
  const data = {
    mindmaps: [],
    nodes: [],
    attachments: [],
    node_links: [],
    node_connections: []
  };
  
  return {
    prepare: (sql) => ({
      bind: (...params) => ({
        first: () => {
          // SELECT文の簡単な実装
          if (sql.includes('SELECT') && sql.includes('mindmaps')) {
            if (sql.includes('migrated_to_relational = 0')) {
              return data.mindmaps.find(m => !m.migrated_to_relational);
            }
            return data.mindmaps[0];
          }
          return null;
        },
        all: () => {
          if (sql.includes('FROM mindmaps')) {
            if (sql.includes('migrated_to_relational = 0')) {
              return { results: data.mindmaps.filter(m => !m.migrated_to_relational) };
            }
            return { results: data.mindmaps };
          }
          if (sql.includes('FROM nodes')) {
            return { results: data.nodes };
          }
          return { results: [] };
        },
        run: () => {
          // INSERT/UPDATE文の簡単な実装
          console.log(`Mock SQL executed: ${sql.substring(0, 50)}...`);
        }
      })
    }),
    batch: async (statements) => {
      console.log(`Mock batch executed: ${statements.length} statements`);
    }
  };
}

/**
 * テストデータのセットアップ
 */
async function setupTestData(db) {
  console.log('テストデータセットアップ中...');
  
  // モックデータベースにサンプルデータを追加
  db.data = db.data || { mindmaps: [], nodes: [], attachments: [], node_links: [] };
  db.data.mindmaps.push({
    id: sampleMindmapData.id,
    title: sampleMindmapData.title,
    category: sampleMindmapData.category,
    theme: sampleMindmapData.theme,
    data: JSON.stringify(sampleMindmapData),
    user_id: sampleMindmapData.user_id,
    created_at: sampleMindmapData.createdAt,
    updated_at: sampleMindmapData.updatedAt,
    migrated_to_relational: false
  });
  
  console.log('テストデータセットアップ完了');
}

/**
 * 移行テストの実行
 */
async function runMigrationTest(db) {
  console.log('移行処理テスト実行中...');
  
  const migration = new MigrationScript(db);
  const stats = await migration.migrateAllData();
  
  console.log('移行統計:', stats);
  
  if (stats.failed > 0) {
    throw new Error(`移行に失敗したデータがあります: ${stats.failed}件`);
  }
}

/**
 * 移行結果の検証
 */
async function verifyMigrationResults(db) {
  console.log('移行結果検証中...');
  
  // データ変換ユーティリティのテスト
  const { DataConverter } = await import('../src/utils/dataConverter.js');
  
  // 階層型→リレーショナル型変換テスト
  const converted = DataConverter.hierarchicalToRelational(sampleMindmapData);
  
  // 必須フィールドの存在確認
  if (!converted.mindmap.id) {
    throw new Error('mindmap.id が変換されていません');
  }
  
  if (converted.nodes.length === 0) {
    throw new Error('ノードが変換されていません');
  }
  
  // rootノードの存在確認
  const rootNode = converted.nodes.find(n => n.type === 'root');
  if (!rootNode) {
    throw new Error('rootノードが見つかりません');
  }
  
  // 親子関係の確認
  const childNodes = converted.nodes.filter(n => n.parent_id === 'root');
  if (childNodes.length !== 2) {
    throw new Error(`rootノードの子ノード数が不正です: 期待値2, 実際${childNodes.length}`);
  }
  
  // 添付ファイルの確認
  const attachments = converted.attachments;
  if (attachments.length !== 1) {
    throw new Error(`添付ファイル数が不正です: 期待値1, 実際${attachments.length}`);
  }
  
  // リンクの確認
  const links = converted.links;
  if (links.length !== 1) {
    throw new Error(`リンク数が不正です: 期待値1, 実際${links.length}`);
  }
  
  // 逆変換テスト（リレーショナル型→階層型）
  const reconverted = DataConverter.relationalToHierarchical(
    converted.mindmap,
    converted.nodes,
    converted.connections,
    converted.attachments,
    converted.links
  );
  
  // 逆変換結果の検証
  if (!reconverted.rootNode) {
    throw new Error('逆変換でrootNodeが失われました');
  }
  
  if (reconverted.rootNode.children.length !== 2) {
    throw new Error('逆変換で子ノードが正しく復元されませんでした');
  }
  
  // データ統計情報の確認
  const stats = DataConverter.getDataStats(converted);
  console.log('データ統計:', stats);
  
  if (stats.totalNodes !== 4) { // root + 2子 + 1孫
    throw new Error(`ノード数が不正です: 期待値4, 実際${stats.totalNodes}`);
  }
  
  console.log('✓ すべての検証が成功しました');
}

/**
 * パフォーマンステスト
 */
async function performanceTest() {
  console.log('=== パフォーマンステスト開始 ===');
  
  const { DataConverter } = await import('../src/utils/dataConverter.js');
  
  // 大きなマインドマップデータの生成
  const largeMindmap = generateLargeMindmap(1000); // 1000ノード
  
  const startTime = Date.now();
  const converted = DataConverter.hierarchicalToRelational(largeMindmap);
  const endTime = Date.now();
  
  const conversionTime = endTime - startTime;
  console.log(`1000ノードの変換時間: ${conversionTime}ms`);
  
  if (conversionTime > 5000) { // 5秒以上かかる場合は警告
    console.warn('⚠️ 変換時間が長すぎます。最適化が必要かもしれません。');
  }
  
  console.log(`変換後ノード数: ${converted.nodes.length}`);
  console.log('=== パフォーマンステスト完了 ===');
}

/**
 * 大きなマインドマップの生成
 */
function generateLargeMindmap(nodeCount) {
  const mindmap = {
    id: 'large-test-mindmap',
    title: 'パフォーマンステスト用マインドマップ',
    category: 'test',
    theme: 'default',
    user_id: 'test-user',
    settings: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rootNode: {
      id: 'root',
      text: 'ルートノード',
      x: 400,
      y: 300,
      children: []
    }
  };
  
  // 階層的にノードを生成
  let nodeId = 1;
  const createNodes = (parent, depth, remaining) => {
    if (depth > 10 || remaining <= 0) return 0;
    
    const childrenCount = Math.min(remaining, Math.ceil(Math.random() * 5) + 1);
    let created = 0;
    
    for (let i = 0; i < childrenCount && created < remaining; i++) {
      const child = {
        id: `node-${nodeId++}`,
        text: `ノード ${nodeId}`,
        x: Math.random() * 800,
        y: Math.random() * 600,
        children: []
      };
      
      parent.children.push(child);
      created++;
      
      const subCreated = createNodes(child, depth + 1, remaining - created);
      created += subCreated;
    }
    
    return created;
  };
  
  createNodes(mindmap.rootNode, 0, nodeCount - 1);
  return mindmap;
}

// スクリプト実行
if (import.meta.main) {
  main().then(() => {
    performanceTest().catch(console.error);
  }).catch(console.error);
}

export { main, performanceTest };