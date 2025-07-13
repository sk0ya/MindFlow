// メール送信のテストスクリプト
const testEmail = async () => {
  const email = 'shigekazukoya@gmail.com'; // ALLOWED_EMAILSに設定されているメール
  
  console.log('Testing email sending to:', email);
  
  try {
    const response = await fetch('https://mindflow-api-production.shigekazukoya.workers.dev/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3001'
      },
      body: JSON.stringify({ email })
    });
    
    console.log('Response status:', response.status);
    const result = await response.json();
    console.log('Response:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
};

testEmail();