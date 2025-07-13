// Cloudflare Workerのログをリアルタイムで監視しながらメール送信をテスト

const { spawn } = require('child_process');

console.log('Starting Cloudflare Worker log monitoring...');

// wrangler tailを開始
const tailProcess = spawn('npx', ['wrangler', 'tail', '--env', 'production', '--format', 'pretty'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

tailProcess.stdout.on('data', (data) => {
  console.log(`LOG: ${data}`);
});

tailProcess.stderr.on('data', (data) => {
  console.error(`ERROR: ${data}`);
});

// 3秒後にメール送信テストを実行
setTimeout(async () => {
  console.log('\n=== Testing email sending ===');
  
  try {
    const response = await fetch('https://mindflow-api-production.shigekazukoya.workers.dev/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3001'
      },
      body: JSON.stringify({ email: 'shigekazukoya@gmail.com' })
    });
    
    const result = await response.json();
    console.log('Response:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error);
  }
  
  // 5秒後にプロセスを終了
  setTimeout(() => {
    console.log('\nStopping log monitoring...');
    tailProcess.kill();
    process.exit(0);
  }, 5000);
  
}, 3000);