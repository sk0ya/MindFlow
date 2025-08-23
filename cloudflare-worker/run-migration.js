// データベースマイグレーション実行スクリプト
// セッション管理テーブルを作成

import fs from 'fs';
import path from 'path';

const MIGRATION_FILE = './migrations/add_session_management.sql';

async function runMigration() {
  try {
    // マイグレーションファイルを読み込み
    const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');
    
    console.log('📄 マイグレーションSQL:');
    console.log('='.repeat(50));
    console.log(migrationSQL);
    console.log('='.repeat(50));
    
    console.log('\n✅ マイグレーションファイルが正常に読み込まれました。');
    console.log('💡 このSQLを本番環境のCloudflare D1データベースで実行してください。');
    console.log('\n実行方法:');
    console.log('1. Cloudflare DashboardでD1データベースにアクセス');
    console.log('2. Console タブを選択');
    console.log('3. 上記のSQLを実行');
    console.log('\nまたは、wrangler CLIを使用:');
    console.log('wrangler d1 execute <DATABASE_NAME> --file=./migrations/add_session_management.sql');
    
  } catch (error) {
    console.error('❌ マイグレーション読み込みエラー:', error);
  }
}

runMigration();