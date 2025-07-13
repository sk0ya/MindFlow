// シークレットの値を確認するスクリプト
// 注意: これは開発環境でのみ使用してください

const checkSecret = async () => {
  console.log('Checking RESEND_KEY secret value...');
  
  // wrangler.tomlに設定されているデフォルト値を確認
  import { readFileSync } from 'fs';
  const toml = readFileSync('wrangler.toml', 'utf8');
  
  console.log('wrangler.toml content (secrets section):');
  const lines = toml.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('RESEND') || line.includes('secret')) {
      console.log(`Line ${i + 1}: ${line}`);
    }
  });
  
  console.log('\nTo check if secret is properly set, run:');
  console.log('npx wrangler secret list --env production');
  
  console.log('\nTo set a new secret value, run:');
  console.log('npx wrangler secret put RESEND_KEY --env production');
  console.log('Then paste your Resend API key (starting with re_)');
};

checkSecret();