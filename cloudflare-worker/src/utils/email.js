// メール送信ユーティリティ
// Resend.com APIを使用してメール送信

export async function sendMagicLinkEmail(email, magicLink, env, token = null) {
  console.log('📧 メール送信開始:', { 
    email, 
    hasResendKey: !!env.RESEND_KEY,
    hasResendApiKey: !!env.RESEND_API_KEY,
    resendKeyLength: env.RESEND_KEY?.length,
    resendApiKeyLength: env.RESEND_API_KEY?.length,
    fromEmail: env.FROM_EMAIL,
    allEnvKeys: Object.keys(env), // 全ての環境変数名を表示
    envValues: Object.entries(env).reduce((acc, [key, value]) => {
      acc[key] = key.includes('KEY') || key.includes('SECRET') ? 
        (value ? `SET(${value.length})` : 'NOT_SET') : value;
      return acc;
    }, {})
  });
  
  // RESEND_KEY を使用（正しいAPIキー）
  const resendKey = env.RESEND_KEY;
  
  console.log('🔑 APIキーチェック:', {
    hasResendKey: !!env.RESEND_KEY,
    hasResendApiKey: !!env.RESEND_API_KEY,
    resendKeyLength: env.RESEND_KEY?.length || 0,
    resendApiKeyLength: env.RESEND_API_KEY?.length || 0,
    keyValue: resendKey ? 'SET' : 'NOT SET',
    isPlaceholder: resendKey === 're_placeholder_key',
    keyPrefix: resendKey ? resendKey.substring(0, 15) : 'none',
    keyType: resendKey ? (resendKey.startsWith('re_') ? 'VALID_FORMAT' : 'INVALID_FORMAT') : 'NO_KEY'
  });
  
  if (!resendKey || resendKey.trim() === '') {
    const debugInfo = {
      keyExists: !!resendKey,
      keyLength: resendKey?.length || 0,
      keyIsPlaceholder: resendKey === 're_placeholder_key',
      keyIsEmpty: resendKey === '',
      keyIsWhitespace: resendKey?.trim() === '',
      actualKey: resendKey ? `${resendKey.substring(0, 10)}...` : 'NONE'
    };
    console.log('⚠️ RESEND_KEY が無効なため開発モードで動作:', debugInfo);
    console.log(`
=== Magic Link Email (Development Mode) ===
To: ${email}
Subject: MindFlow - ログインリンク
Magic Link: ${magicLink}
${token ? `Token: ${token}` : 'Token: Not provided'}
Debug: ${JSON.stringify(debugInfo)}
==========================================
    `);
    return { 
      success: true, 
      messageId: 'dev-mode',
      debugInfo: debugInfo // 一時的にデバッグ情報を含める
    };
  }

  try {
    // メール送信データを準備
    const emailData = {
      from: `MindFlow <${env.FROM_EMAIL}>`,
      to: [email],
      subject: 'MindFlow - ログインリンク',
      html: createMagicLinkEmailHTML(magicLink, token),
      text: createMagicLinkEmailText(magicLink, token)
    };
    
    console.log('📮 Resend API呼び出し:', {
      url: 'https://api.resend.com/emails',
      fromEmail: emailData.from,
      toEmail: emailData.to,
      hasApiKey: !!resendKey,
      apiKeyPrefix: resendKey ? resendKey.substring(0, 10) + '...' : 'none'
    });
    
    // Resend API を使用してメール送信
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData)
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Resend API error:', {
        status: response.status,
        statusText: response.statusText,
        error: result,
        name: result.name,
        message: result.message
      });
      throw new Error(`Email API error: ${result.message || result.name || 'Unknown error'}`);
    }

    console.log('✅ Email sent successfully:', { 
      messageId: result.id,
      response: result 
    });
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error('❌ Email sending failed:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // フォールバック: 開発モードとして処理
    console.log(`
=== Magic Link Email (Fallback Mode) ===
To: ${email}
Subject: MindFlow - ログインリンク
Magic Link: ${magicLink}
${token ? `Token: ${token}` : 'Token: Not provided'}
Error: ${error.message}
==========================================
    `);
    return { 
      success: true, 
      messageId: 'fallback-mode',
      error: error.message,
      errorName: error.name,
      errorStack: error.stack
    };
  }
}

function createMagicLinkEmailHTML(magicLink, token = null) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MindFlow ログイン</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
    .content { padding: 40px 20px; }
    .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
    .footer { padding: 20px; font-size: 14px; color: #666; text-align: center; border-top: 1px solid #e9ecef; }
    .security-note { background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 28px;">🧠 MindFlow</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">ログインリンクをお送りしました</p>
    </div>
    
    <div class="content">
      <h2>こんにちは！</h2>
      <p>MindFlowにログインするためのリンクをお送りしました。下のボタンをクリックしてログインしてください。</p>
      
      <div style="text-align: center;">
        <a href="${magicLink}" class="button">MindFlowにログイン</a>
      </div>
      
      ${token ? `
      <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 12px 0; color: #0c4a6e; font-size: 16px;">🔑 ログイントークン</h3>
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #0c4a6e;">
          リンクをクリックできない場合は、以下のトークンをコピーしてログイン画面に入力してください：
        </p>
        <div style="background-color: #dbeafe; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 14px; word-break: break-all; text-align: center; color: #1e40af; font-weight: bold;">
          ${token}
        </div>
      </div>
      ` : ''}
      
      <div class="security-note">
        <strong>🔒 セキュリティについて</strong><br>
        • このリンクは10分間有効です<br>
        • ログイン後、リンクは無効になります<br>
        • このメールは誰にも転送しないでください
      </div>
      
      <p style="font-size: 14px; color: #666;">
        このログイン試行に心当たりがない場合は、このメールを無視してください。
      </p>
    </div>
    
    <div class="footer">
      <p>© 2025 MindFlow. All rights reserved.</p>
      <p>このメールは自動送信されています。返信はできません。</p>
    </div>
  </div>
</body>
</html>
  `;
}

function createMagicLinkEmailText(magicLink, token = null) {
  return `
MindFlow - ログインリンク

こんにちは！

MindFlowにログインするためのリンクをお送りしました。
下のリンクをクリックしてログインしてください。

ログインリンク: ${magicLink}

${token ? `
🔑 ログイントークン:
リンクをクリックできない場合は、以下のトークンをコピーして
ログイン画面に入力してください：

${token}

` : ''}セキュリティについて:
• このリンクは10分間有効です
• ログイン後、リンクは無効になります  
• このメールは誰にも転送しないでください

このログイン試行に心当たりがない場合は、このメールを無視してください。

© 2025 MindFlow. All rights reserved.
このメールは自動送信されています。返信はできません。
  `;
}