// データベースクリーンアップユーティリティ
// 開発・テスト用：全データを削除して初期状態に戻す

export async function cleanAllData(env) {
  console.log('データベース全クリーンアップ開始');
  
  try {
    const statements = [];
    
    // 1. 添付ファイルを削除
    statements.push(
      env.DB.prepare('DELETE FROM attachments')
    );
    
    // 2. ノードリンクを削除
    statements.push(
      env.DB.prepare('DELETE FROM node_links')
    );
    
    // 3. ノードを削除
    statements.push(
      env.DB.prepare('DELETE FROM nodes')
    );
    
    // 4. マインドマップを削除
    statements.push(
      env.DB.prepare('DELETE FROM mindmaps')
    );
    
    // 5. ユーザーを削除（認証系以外）
    statements.push(
      env.DB.prepare('DELETE FROM users WHERE id NOT LIKE "%@%"')
    );
    
    // バッチ実行
    await env.DB.batch(statements);
    
    // R2ストレージのクリーンアップ（オプション）
    console.log('R2ストレージクリーンアップをスキップ（手動実行推奨）');
    
    console.log('データベースクリーンアップ完了');
    
    return {
      success: true,
      message: 'データベースを初期状態にリセットしました',
      deletedTables: ['attachments', 'node_links', 'nodes', 'mindmaps', 'legacy_users']
    };
    
  } catch (error) {
    console.error('クリーンアップエラー:', error);
    throw error;
  }
}

export async function cleanR2Storage(env) {
  console.log('R2ストレージクリーンアップ開始');
  
  try {
    // R2の全オブジェクトを取得
    const list = await env.FILES.list();
    const deletePromises = [];
    
    for (const object of list.objects) {
      deletePromises.push(env.FILES.delete(object.key));
    }
    
    await Promise.all(deletePromises);
    
    console.log(`R2ストレージクリーンアップ完了: ${list.objects.length}個のファイルを削除`);
    
    return {
      success: true,
      deletedFiles: list.objects.length,
      message: 'R2ストレージを完全にクリーンアップしました'
    };
    
  } catch (error) {
    console.error('R2クリーンアップエラー:', error);
    throw error;
  }
}

export async function getDataSummary(env) {
  try {
    const results = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as count FROM users').first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM mindmaps').first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM nodes').first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM attachments').first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM node_links').first()
    ]);
    
    const r2List = await env.FILES.list();
    
    return {
      users: results[0].count,
      mindmaps: results[1].count,
      nodes: results[2].count,
      attachments: results[3].count,
      nodeLinks: results[4].count,
      r2Files: r2List.objects.length
    };
  } catch (error) {
    console.error('データサマリー取得エラー:', error);
    throw error;
  }
}

export async function getDetailedData(env) {
  try {
    // 詳細なデータを取得
    const { results: mindmaps } = await env.DB.prepare('SELECT * FROM mindmaps').all();
    const { results: nodes } = await env.DB.prepare('SELECT * FROM nodes').all();
    const { results: attachments } = await env.DB.prepare('SELECT * FROM attachments').all();
    const r2List = await env.FILES.list();
    
    return {
      mindmaps: mindmaps,
      nodes: nodes,
      attachments: attachments,
      r2Files: r2List.objects.map(obj => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded
      }))
    };
  } catch (error) {
    console.error('詳細データ取得エラー:', error);
    throw error;
  }
}

export async function fixStoragePaths(env) {
  console.log('storage_pathの修正開始');
  
  try {
    // すべてのattachmentを取得
    const { results: attachments } = await env.DB.prepare('SELECT * FROM attachments').all();
    
    let fixed = 0;
    for (const attachment of attachments) {
      // legacy/プレフィックスがある場合は修正
      if (attachment.storage_path.startsWith('legacy/')) {
        // R2ファイルの実際のキーを検索（attachment.idはnode_で始まるが、R2のfile_IDとは異なる）
        const r2List = await env.FILES.list();
        console.log('探索中のattachment:', attachment);
        console.log('利用可能なR2ファイル:', r2List.objects.map(obj => obj.key));
        
        // ファイルサイズで一致するものを探す
        const matchingR2File = r2List.objects.find(obj => 
          obj.size === attachment.file_size
        );
        
        if (matchingR2File) {
          console.log(`修正: ${attachment.id} - ${attachment.storage_path} -> ${matchingR2File.key}`);
          
          await env.DB.prepare(
            'UPDATE attachments SET storage_path = ? WHERE id = ?'
          ).bind(matchingR2File.key, attachment.id).run();
          
          fixed++;
        }
      }
    }
    
    return {
      success: true,
      fixed: fixed,
      message: `${fixed}件のstorage_pathを修正しました`
    };
    
  } catch (error) {
    console.error('storage_path修正エラー:', error);
    throw error;
  }
}