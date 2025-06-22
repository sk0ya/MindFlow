// ユーザーID統一化マイグレーション
// レガシーユーザーIDをemail形式に統一する

export async function unifyUserIds(env) {
  console.log('ユーザーID統一化マイグレーション開始');
  
  try {
    // 1. 現在のユーザー情報を確認
    const { results: users } = await env.DB.prepare(
      'SELECT id, email FROM users WHERE id NOT LIKE "%@%"'
    ).all();
    
    console.log(`変換対象のレガシーユーザー: ${users.length}件`);
    
    if (users.length === 0) {
      console.log('変換対象のユーザーが見つかりません');
      return { migrated: 0, message: '変換不要' };
    }
    
    let migrated = 0;
    const statements = [];
    
    for (const user of users) {
      const oldUserId = user.id;
      const email = user.email;
      
      // emailが有効な場合のみ処理
      if (email && email.includes('@') && email !== `${oldUserId}@temp.com`) {
        console.log(`ユーザー移行: ${oldUserId} -> ${email}`);
        
        // 新しいemailベースのユーザーが既に存在するかチェック
        const existingUser = await env.DB.prepare(
          'SELECT id FROM users WHERE id = ?'
        ).bind(email).first();
        
        if (!existingUser) {
          // 新しいユーザーレコードを作成
          statements.push(
            env.DB.prepare(
              'INSERT INTO users (id, email, created_at, updated_at) SELECT ?, email, created_at, ? FROM users WHERE id = ?'
            ).bind(email, new Date().toISOString(), oldUserId)
          );
        }
        
        // マインドマップの所有者を更新
        statements.push(
          env.DB.prepare(
            'UPDATE mindmaps SET user_id = ? WHERE user_id = ?'
          ).bind(email, oldUserId)
        );
        
        // 古いユーザーレコードを削除
        statements.push(
          env.DB.prepare(
            'DELETE FROM users WHERE id = ?'
          ).bind(oldUserId)
        );
        
        migrated++;
      } else {
        console.log(`スキップ: ${oldUserId} (有効なemail無し: ${email})`);
      }
    }
    
    if (statements.length > 0) {
      // バッチで実行
      await env.DB.batch(statements);
      console.log(`${migrated}件のユーザーIDを統一化しました`);
    }
    
    return { 
      migrated, 
      total: users.length,
      message: `${migrated}/${users.length}件のユーザーIDを統一化` 
    };
    
  } catch (error) {
    console.error('マイグレーションエラー:', error);
    throw error;
  }
}

// マイグレーション確認（ドライラン）
export async function checkMigrationNeeded(env) {
  try {
    const { results: legacyUsers } = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM users WHERE id NOT LIKE "%@%"'
    ).all();
    
    const { results: emailUsers } = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM users WHERE id LIKE "%@%"'
    ).all();
    
    return {
      legacyUsers: legacyUsers[0].count,
      emailUsers: emailUsers[0].count,
      migrationNeeded: legacyUsers[0].count > 0
    };
  } catch (error) {
    console.error('マイグレーション確認エラー:', error);
    throw error;
  }
}