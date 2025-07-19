import type { Environment } from '@/types';

/**
 * セキュアなメール送信ユーティリティ
 * - Resend APIを使用
 * - 適切なエラーハンドリング
 * - セキュアなテンプレート
 */

interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Magic Linkメールを送信
 */
export async function sendMagicLinkEmail(
  env: Environment,
  toEmail: string,
  magicLink: string
): Promise<EmailResponse> {
  try {
    // Resend APIキーの確認
    if (!env.RESEND_KEY) {
      console.error('RESEND_KEY is not configured');
      // 開発環境でもAPIキーがない場合のみコンソール出力
      if (env.NODE_ENV === 'development') {
        console.log(`[DEV] Magic link for ${toEmail}: ${magicLink}`);
        return {
          success: true,
          messageId: 'dev-mode-no-api-key',
        };
      }
      return {
        success: false,
        error: 'Email service not configured',
      };
    }

    // メールテンプレートの生成
    const emailContent = generateMagicLinkEmailTemplate(magicLink, env.FRONTEND_URL);

    // Resend APIにリクエスト送信
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: [toEmail],
        subject: 'MindFlow - ログインリンクをお送りします',
        html: emailContent.html,
        text: emailContent.text,
        headers: {
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Resend API error:', response.status, errorData);
      return {
        success: false,
        error: 'Failed to send email',
      };
    }

    const result = await response.json() as { id: string };
    return {
      success: true,
      messageId: result.id,
    };

  } catch (error) {
    console.error('Email sending error:', error);
    return {
      success: false,
      error: 'Email service error',
    };
  }
}

/**
 * Magic Linkメールテンプレートを生成
 */
function generateMagicLinkEmailTemplate(
  magicLink: string,
  frontendUrl: string
): { html: string; text: string } {
  // セキュリティのため、リンクを短時間で無効化することを明記
  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MindFlow ログイン</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background-color: #ffffff;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #2563eb;
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            margin: 20px 0;
        }
        .button:hover {
            background-color: #1d4ed8;
        }
        .warning {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 4px;
            padding: 12px;
            margin: 20px 0;
            font-size: 14px;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 12px;
            color: #6b7280;
        }
        .link {
            word-break: break-all;
            color: #2563eb;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🧠 MindFlow</div>
            <h1>ログインリンクをお送りします</h1>
        </div>
        
        <p>MindFlowへのログインリクエストを受け付けました。</p>
        
        <p>以下のボタンをクリックしてログインしてください：</p>
        
        <div style="text-align: center;">
            <a href="${magicLink}" class="button">MindFlowにログイン</a>
        </div>
        
        <div class="warning">
            <strong>⚠️ セキュリティに関する重要な情報</strong><br>
            • このリンクは10分間のみ有効です<br>
            • 一度使用すると無効になります<br>
            • ログインしない場合はこのメールを無視してください
        </div>
        
        <p>ボタンが機能しない場合は、以下のリンクをコピーしてブラウザに貼り付けてください：</p>
        <p class="link">${magicLink}</p>
        
        <div class="footer">
            <p>このメールに心当たりがない場合は、無視してください。</p>
            <p>© MindFlow - セキュアなマインドマップツール</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
MindFlow - ログインリンクをお送りします

MindFlowへのログインリクエストを受け付けました。

以下のリンクをクリックしてログインしてください：
${magicLink}

【重要】セキュリティに関する情報：
- このリンクは10分間のみ有効です
- 一度使用すると無効になります
- ログインしない場合はこのメールを無視してください

このメールに心当たりがない場合は、無視してください。

© MindFlow - セキュアなマインドマップツール
`;

  return { html, text };
}

/**
 * システム通知メールを送信
 */
export async function sendSystemNotification(
  env: Environment,
  subject: string,
  message: string,
  severity: 'info' | 'warning' | 'error' = 'info'
): Promise<EmailResponse> {
  try {
    if (env.NODE_ENV === 'development') {
      console.log(`[SYSTEM NOTIFICATION] ${severity.toUpperCase()}: ${subject}\n${message}`);
      return { success: true, messageId: 'dev-notification' };
    }

    if (!env.RESEND_KEY) {
      return { success: false, error: 'Email service not configured' };
    }

    const adminEmails = env.ALLOWED_EMAILS.split(',').map(email => email.trim());

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: adminEmails,
        subject: `[MindFlow ${severity.toUpperCase()}] ${subject}`,
        text: message,
        headers: {
          'X-Priority': severity === 'error' ? '1' : '3',
        },
      }),
    });

    if (!response.ok) {
      console.error('Failed to send system notification:', response.status);
      return { success: false, error: 'Failed to send notification' };
    }

    const result = await response.json() as { id: string };
    return { success: true, messageId: result.id };

  } catch (error) {
    console.error('System notification error:', error);
    return { success: false, error: 'Notification service error' };
  }
}