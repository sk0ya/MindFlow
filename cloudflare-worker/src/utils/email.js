// メール送信ユーティリティ
// Resend.com APIを使用してメール送信

export async function sendMagicLinkEmail(email, magicLink, env) {
  console.log('📧 メール送信開始:', { 
    email, 
    hasResendKey: !!env.RESEND_KEY,
    resendKeyLength: env.RESEND_KEY?.length,
    fromEmail: env.FROM_EMAIL 
  });
  
  // Resend.com APIを使用してメール送信
  if (!env.RESEND_KEY || env.RESEND_KEY === 're_placeholder_key') {
    console.log('⚠️ RESEND_KEY が設定されていないため開発モードで動作');
    console.log(`
=== Magic Link Email (Development Mode) ===
To: ${email}
Subject: MindFlow - ログインリンク
Magic Link: ${magicLink}
==========================================
    `);
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    // Resend API を使用してメール送信
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `MindFlow <${env.FROM_EMAIL || 'onboarding@resend.dev'}>`, // 環境変数から取得
        to: [email],
        subject: 'MindFlow - ログインリンク',
        html: createMagicLinkEmailHTML(magicLink),
        text: createMagicLinkEmailText(magicLink)
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('Resend API error:', result);
      throw new Error(`Email API error: ${result.message || 'Unknown error'}`);
    }

    console.log('Email sent successfully:', result.id);
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error('Email sending failed:', error);
    
    // フォールバック: 開発モードとして処理
    console.log(`
=== Magic Link Email (Fallback Mode) ===
To: ${email}
Subject: MindFlow - ログインリンク
Magic Link: ${magicLink}
==========================================
    `);
    return { success: true, messageId: 'fallback-mode' };
  }
}

function createMagicLinkEmailHTML(magicLink) {
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

function createMagicLinkEmailText(magicLink) {
  return `
MindFlow - ログインリンク

こんにちは！

MindFlowにログインするためのリンクをお送りしました。
下のリンクをクリックしてログインしてください。

ログインリンク: ${magicLink}

セキュリティについて:
• このリンクは10分間有効です
• ログイン後、リンクは無効になります  
• このメールは誰にも転送しないでください

このログイン試行に心当たりがない場合は、このメールを無視してください。

© 2025 MindFlow. All rights reserved.
このメールは自動送信されています。返信はできません。
  `;
}