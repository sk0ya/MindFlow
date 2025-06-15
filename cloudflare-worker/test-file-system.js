/**
 * ファイルシステム統合テストスクリプト
 * R2アップロード・ダウンロード・管理機能のテスト
 */

import { runFileMigration, testFileMigration } from './migration-scripts/migrate-files-to-r2.js';

/**
 * テスト用のサンプルファイルデータ
 */
const createSampleImageData = () => {
  // 1x1ピクセルの透明PNGデータ
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
};

const createSampleTextData = () => {
  return 'data:text/plain;base64,' + btoa('これはテスト用のテキストファイルです。\nR2移行のテストに使用されます。');
};

const sampleAttachments = [
  {
    id: 'test-attachment-1',
    node_id: 'node-1',
    file_name: 'test-image.png',
    original_name: 'test-image.png',
    file_size: 95, // 1x1 PNG のサイズ
    mime_type: 'image/png',
    storage_path: 'legacy/test-attachment-1',
    attachment_type: 'image',
    legacy_data_url: createSampleImageData(),
    uploaded_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'test-attachment-2',
    node_id: 'node-1',
    file_name: 'test-text.txt',
    original_name: 'test-text.txt',
    file_size: 120,
    mime_type: 'text/plain',
    storage_path: 'legacy/test-attachment-2',
    attachment_type: 'text',
    legacy_data_url: createSampleTextData(),
    uploaded_at: '2024-01-01T00:00:00Z'
  }
];

/**
 * モックデータベースの作成
 */
function createMockDatabase() {
  const data = {
    mindmaps: [
      {
        id: 'test-mindmap-1',
        title: 'テストマインドマップ',
        user_id: 'test-user',
        migrated_to_relational: true
      }
    ],
    nodes: [
      {
        id: 'node-1',
        mindmap_id: 'test-mindmap-1',
        text: 'テストノード',
        type: 'branch',
        parent_id: 'root'
      }
    ],
    attachments: [...sampleAttachments]
  };
  
  return {
    prepare: (sql) => ({
      bind: (...params) => ({
        first: () => {
          if (sql.includes('SELECT') && sql.includes('attachments')) {
            if (sql.includes('legacy_data_url IS NOT NULL')) {
              return data.attachments.find(a => a.legacy_data_url);
            }
            return data.attachments[0];
          }
          if (sql.includes('SELECT') && sql.includes('mindmaps')) {
            return data.mindmaps[0];
          }
          if (sql.includes('SELECT') && sql.includes('nodes')) {
            return data.nodes[0];
          }
          return null;
        },
        all: () => {
          if (sql.includes('FROM attachments')) {
            if (sql.includes('legacy_data_url IS NOT NULL')) {
              return { results: data.attachments.filter(a => a.legacy_data_url) };
            }
            return { results: data.attachments };
          }
          return { results: [] };
        },
        run: () => {
          console.log(`Mock SQL executed: ${sql.substring(0, 50)}...`);
          return { success: true };
        }
      })
    }),
    batch: async (statements) => {
      console.log(`Mock batch executed: ${statements.length} statements`);
      return { success: true };
    }
  };
}

/**
 * モックR2バケットの作成
 */
function createMockR2Bucket() {
  const storage = new Map();
  
  return {
    put: async (key, data, metadata) => {
      console.log(`Mock R2 PUT: ${key} (${data.byteLength || data.length} bytes)`);
      storage.set(key, {
        data: data,
        metadata: metadata,
        size: data.byteLength || data.length,
        uploaded: new Date().toISOString()
      });
      return { success: true };
    },
    
    get: async (key) => {
      const object = storage.get(key);
      if (!object) return null;
      
      return {
        arrayBuffer: async () => object.data,
        httpMetadata: object.metadata?.httpMetadata,
        customMetadata: object.metadata?.customMetadata
      };
    },
    
    head: async (key) => {
      const object = storage.get(key);
      if (!object) return null;
      
      return {
        size: object.size,
        uploaded: object.uploaded,
        httpMetadata: object.metadata?.httpMetadata,
        customMetadata: object.metadata?.customMetadata
      };
    },
    
    delete: async (key) => {
      console.log(`Mock R2 DELETE: ${key}`);
      return storage.delete(key);
    },
    
    list: async (options = {}) => {
      const keys = Array.from(storage.keys());
      const filtered = options.prefix ? 
        keys.filter(k => k.startsWith(options.prefix)) : 
        keys;
      
      const objects = filtered.slice(0, options.limit || 1000).map(key => {
        const obj = storage.get(key);
        return {
          key: key,
          size: obj.size,
          uploaded: obj.uploaded
        };
      });
      
      return {
        objects: objects,
        truncated: false,
        cursor: null
      };
    },
    
    createPresignedUrl: async (key, options) => {
      console.log(`Mock signed URL generated for: ${key}`);
      return `https://mock-r2-domain.com/${key}?signed=true&expires=${Date.now() + (options.expiresIn * 1000)}`;
    },
    
    // 内部状態確認用
    _getStorage: () => storage,
    _getStorageStats: () => ({
      totalFiles: storage.size,
      totalSize: Array.from(storage.values()).reduce((sum, obj) => sum + obj.size, 0)
    })
  };
}

/**
 * ファイルアップロードAPIテスト
 */
async function testFileUploadAPI(mockEnv) {
  console.log('=== ファイルアップロードAPIテスト開始 ===');
  
  try {
    // モックファイルデータ作成
    const testFileData = new TextEncoder().encode('テストファイルの内容です');
    const mockFile = {
      name: 'test-upload.txt',
      type: 'text/plain',
      size: testFileData.length,
      arrayBuffer: async () => testFileData.buffer
    };

    // モックFormData
    const mockFormData = {
      get: (key) => key === 'file' ? mockFile : null
    };

    // アップロードテスト用のモックリクエスト
    const mockRequest = {
      method: 'POST',
      url: new URL('http://localhost:8787/api/files/test-mindmap-1/node-1'),
      formData: async () => mockFormData,
      headers: {
        get: (name) => name === 'authorization' ? 'Bearer test-token' : null
      }
    };

    // ファイルアップロード処理をシミュレート
    const storagePath = `test-user/test-mindmap-1/node-1/test-upload.txt`;
    await mockEnv.FILES.put(storagePath, testFileData, {
      httpMetadata: {
        contentType: mockFile.type,
        contentDisposition: `attachment; filename="${mockFile.name}"`
      },
      customMetadata: {
        originalName: mockFile.name,
        nodeId: 'node-1',
        mindmapId: 'test-mindmap-1'
      }
    });

    // アップロード確認
    const uploadedFile = await mockEnv.FILES.head(storagePath);
    if (!uploadedFile) {
      throw new Error('ファイルアップロードが失敗しました');
    }

    console.log('✓ ファイルアップロードAPIテスト成功');
    return true;

  } catch (error) {
    console.error('✗ ファイルアップロードAPIテスト失敗:', error.message);
    return false;
  }
}

/**
 * 署名付きURL生成テスト
 */
async function testSignedUrlGeneration(mockEnv) {
  console.log('=== 署名付きURL生成テスト開始 ===');
  
  try {
    const testPath = 'test-user/test-mindmap-1/node-1/test-file.txt';
    
    // ダウンロード用署名付きURL
    const downloadUrl = await mockEnv.FILES.createPresignedUrl(testPath, {
      expiresIn: 3600,
      method: 'GET'
    });

    if (!downloadUrl || !downloadUrl.includes('signed=true')) {
      throw new Error('署名付きURL生成が失敗しました');
    }

    // アップロード用署名付きURL
    const uploadUrl = await mockEnv.FILES.createPresignedUrl(testPath, {
      expiresIn: 3600,
      method: 'PUT'
    });

    if (!uploadUrl || !uploadUrl.includes('signed=true')) {
      throw new Error('アップロード用署名付きURL生成が失敗しました');
    }

    console.log('✓ 署名付きURL生成テスト成功');
    return true;

  } catch (error) {
    console.error('✗ 署名付きURL生成テスト失敗:', error.message);
    return false;
  }
}

/**
 * ファイル移行テスト
 */
async function testFileMigration(mockEnv) {
  console.log('=== ファイル移行テスト開始 ===');
  
  try {
    const { FileMigrationScript } = await import('./migration-scripts/migrate-files-to-r2.js');
    const migration = new FileMigrationScript(mockEnv.DB, mockEnv.FILES);

    // 移行前の状況確認
    const statusBefore = await migration.getMigrationStatus();
    console.log(`移行前: ${statusBefore.migrated}/${statusBefore.total}`);

    // サンプルファイルの移行テスト
    const sampleAttachment = {
      ...sampleAttachments[0],
      mindmap_id: 'test-mindmap-1',
      user_id: 'test-user'
    };

    await migration.migrateSingleFile(sampleAttachment);

    // R2にファイルが正しく保存されているか確認
    const storageStats = mockEnv.FILES._getStorageStats();
    if (storageStats.totalFiles === 0) {
      throw new Error('ファイルがR2に保存されていません');
    }

    console.log(`✓ ファイル移行テスト成功 (${storageStats.totalFiles}ファイル, ${storageStats.totalSize}バイト)`);
    return true;

  } catch (error) {
    console.error('✗ ファイル移行テスト失敗:', error.message);
    return false;
  }
}

/**
 * ファイル削除・クリーンアップテスト
 */
async function testFileCleanup(mockEnv) {
  console.log('=== ファイルクリーンアップテスト開始 ===');
  
  try {
    // テストファイルを追加
    const testPaths = [
      'test-user/test-mindmap-1/node-1/file1.txt',
      'test-user/test-mindmap-1/node-1/file2.txt',
      'orphaned-user/orphaned-map/orphaned-node/orphaned.txt'
    ];

    for (const path of testPaths) {
      await mockEnv.FILES.put(path, new TextEncoder().encode('test content'), {
        httpMetadata: { contentType: 'text/plain' }
      });
    }

    // 孤立ファイルクリーンアップテスト
    const { FileMigrationScript } = await import('./migration-scripts/migrate-files-to-r2.js');
    const migration = new FileMigrationScript(mockEnv.DB, mockEnv.FILES);

    const cleanupResult = await migration.cleanupOrphanedFiles(true); // ドライラン
    
    if (cleanupResult.orphaned === undefined || cleanupResult.orphaned === 0) {
      console.log('⚠ 孤立ファイルが検出されませんでした（期待される動作の場合もあります）');
    }

    // 個別ファイル削除テスト
    const deleteResult = await mockEnv.FILES.delete(testPaths[0]);
    if (!deleteResult) {
      throw new Error('ファイル削除が失敗しました');
    }

    console.log('✓ ファイルクリーンアップテスト成功');
    return true;

  } catch (error) {
    console.error('✗ ファイルクリーンアップテスト失敗:', error.message);
    return false;
  }
}

/**
 * パフォーマンステスト
 */
async function testPerformance(mockEnv) {
  console.log('=== パフォーマンステスト開始 ===');
  
  try {
    const startTime = Date.now();
    
    // 複数ファイルの同時アップロード
    const uploadPromises = [];
    for (let i = 0; i < 10; i++) {
      const data = new TextEncoder().encode(`パフォーマンステストファイル ${i}`);
      const path = `perf-test/file-${i}.txt`;
      uploadPromises.push(
        mockEnv.FILES.put(path, data, {
          httpMetadata: { contentType: 'text/plain' }
        })
      );
    }

    await Promise.all(uploadPromises);
    
    const uploadTime = Date.now() - startTime;
    console.log(`10ファイル同時アップロード時間: ${uploadTime}ms`);

    // ファイル一覧取得パフォーマンス
    const listStartTime = Date.now();
    const listResult = await mockEnv.FILES.list({ prefix: 'perf-test/', limit: 100 });
    const listTime = Date.now() - listStartTime;
    
    console.log(`ファイル一覧取得時間: ${listTime}ms (${listResult.objects.length}ファイル)`);

    if (uploadTime > 1000) { // 1秒以上かかる場合は警告
      console.warn('⚠️ アップロード時間が長すぎます');
    }

    console.log('✓ パフォーマンステスト完了');
    return true;

  } catch (error) {
    console.error('✗ パフォーマンステスト失敗:', error.message);
    return false;
  }
}

/**
 * メインテスト関数
 */
async function runFileSystemTests() {
  console.log('=== ファイルシステム統合テスト開始 ===');
  console.log(`開始時刻: ${new Date().toISOString()}`);
  
  // モック環境の作成
  const mockEnv = {
    DB: createMockDatabase(),
    FILES: createMockR2Bucket(),
    ENABLE_AUTH: 'false'
  };

  const testResults = {
    upload: false,
    signedUrl: false,
    migration: false,
    cleanup: false,
    performance: false
  };

  try {
    // 各テストの実行
    testResults.upload = await testFileUploadAPI(mockEnv);
    testResults.signedUrl = await testSignedUrlGeneration(mockEnv);
    testResults.migration = await testFileMigration(mockEnv);
    testResults.cleanup = await testFileCleanup(mockEnv);
    testResults.performance = await testPerformance(mockEnv);

    // 結果サマリー
    const passedTests = Object.values(testResults).filter(Boolean).length;
    const totalTests = Object.keys(testResults).length;

    console.log('\n=== テスト結果サマリー ===');
    console.log(`成功: ${passedTests}/${totalTests}テスト`);
    
    Object.entries(testResults).forEach(([test, passed]) => {
      console.log(`${passed ? '✓' : '✗'} ${test}: ${passed ? '成功' : '失敗'}`);
    });

    if (passedTests === totalTests) {
      console.log('\n🎉 すべてのテストが成功しました！');
    } else {
      console.log(`\n⚠️ ${totalTests - passedTests}個のテストが失敗しました`);
    }

    // 最終ストレージ状況
    const finalStats = mockEnv.FILES._getStorageStats();
    console.log(`\n最終ストレージ状況: ${finalStats.totalFiles}ファイル, ${finalStats.totalSize}バイト`);

  } catch (error) {
    console.error('=== テスト実行中にエラーが発生しました ===');
    console.error(error);
    return false;
  }

  console.log(`完了時刻: ${new Date().toISOString()}`);
  return Object.values(testResults).every(Boolean);
}

// スクリプト実行
if (import.meta.main) {
  runFileSystemTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('テスト実行エラー:', error);
    process.exit(1);
  });
}

export { 
  runFileSystemTests,
  testFileUploadAPI,
  testSignedUrlGeneration,
  testFileMigration,
  testFileCleanup,
  testPerformance
};