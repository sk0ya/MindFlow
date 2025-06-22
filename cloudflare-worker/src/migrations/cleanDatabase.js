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