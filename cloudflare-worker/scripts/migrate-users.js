/**
 * ユーザーIDをハッシュ値からメールアドレスに移行するスクリプト
 */

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      console.log('ユーザーID移行開始...');

      // 1. 全ユーザーを取得
      const { results: users } = await env.DB.prepare(
        'SELECT id, email FROM users'
      ).all();

      console.log(`移行対象ユーザー数: ${users.length}`);

      const migrationResults = [];

      for (const user of users) {
        const oldUserId = user.id;
        const newUserId = user.email;

        // 既にメールアドレスがIDの場合はスキップ
        if (oldUserId === newUserId) {
          console.log(`スキップ: ${user.email} (既に移行済み)`);
          continue;
        }

        console.log(`移行開始: ${oldUserId} → ${newUserId}`);

        try {
          // 2. 新しいユーザーレコードを作成
          await env.DB.prepare(
            'INSERT OR REPLACE INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)'
          ).bind(
            newUserId,
            user.email,
            new Date().toISOString(),
            new Date().toISOString()
          ).run();

          // 3. マインドマップを新しいユーザーIDに移行
          const mindmapResult = await env.DB.prepare(
            'UPDATE mindmaps SET user_id = ? WHERE user_id = ?'
          ).bind(newUserId, oldUserId).run();

          console.log(`マインドマップ移行: ${mindmapResult.changes}件`);

          // 4. 古いユーザーレコードを削除
          await env.DB.prepare(
            'DELETE FROM users WHERE id = ? AND id != ?'
          ).bind(oldUserId, newUserId).run();

          migrationResults.push({
            oldUserId,
            newUserId,
            email: user.email,
            mindmapsCount: mindmapResult.changes,
            status: 'success'
          });

          console.log(`移行完了: ${user.email}`);

        } catch (error) {
          console.error(`移行失敗: ${user.email}`, error);
          migrationResults.push({
            oldUserId,
            newUserId,
            email: user.email,
            status: 'failed',
            error: error.message
          });
        }
      }

      const summary = {
        total: users.length,
        migrated: migrationResults.filter(r => r.status === 'success').length,
        failed: migrationResults.filter(r => r.status === 'failed').length,
        results: migrationResults
      };

      console.log('移行完了:', summary);

      return new Response(JSON.stringify(summary, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('移行エラー:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};