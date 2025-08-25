// 認証エンドポイントのハンドラー

import { corsHeaders } from '../utils/cors.js';
import { authenticateUser, generateJWT, verifyJWT } from '../utils/auth.js';
import { 
  hashPassword, 
  verifyPassword, 
  validatePasswordStrength, 
  calculateLockoutDuration 
} from '../utils/password.js';

export async function handleAuthRequest(request, env) {
  const requestOrigin = request.headers.get('Origin');
  const url = new URL(request.url);
  const method = request.method;
  const pathParts = url.pathname.split('/');
  const action = pathParts[3]; // /api/auth/{action}

  try {
    let response;
    
    switch (method) {
      case 'POST':
        if (action === 'login') {
          response = await handlePasswordLogin(request, env);
        } else if (action === 'register') {
          response = await handleUserRegistration(request, env);
        } else if (action === 'refresh') {
          response = await handleRefreshToken(request, env);
        } else if (action === 'logout') {
          response = await handleLogout(request, env);
        } else if (action === 'reset-password') {
          response = await handlePasswordReset(request, env);
        } else if (action === 'change-password') {
          response = await handlePasswordChange(request, env);
        } else {
          throw new Error(`Unknown auth action: ${action}`);
        }
        break;
      
      case 'GET':
        if (action === 'me') {
          response = await handleGetCurrentUser(request, env);
        } else if (action === 'validate') {
          response = await handleValidateToken(request, env);
        } else if (action === 'health') {
          response = await handleHealthCheck(request, env);
        } else if (action === 'logout') {
          response = await handleLogout(request, env);
        } else {
          throw new Error(`Unknown auth action: ${action}`);
        }
        break;
      
      default:
        throw new Error(`Method ${method} not allowed`);
    }

    // responseがすでにResponseオブジェクトの場合はそのまま返す
    if (response instanceof Response) {
      return response;
    }
    
    // そうでない場合はJSONレスポンスとして返す
    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.CORS_ORIGIN, requestOrigin)
      }
    });

  } catch (error) {
    console.error('Auth Error:', error);
    const errorResponse = { error: error.message };
    
    // デバッグ情報がある場合は含める（一時的）
    if (error.debugInfo) {
      errorResponse.debugInfo = error.debugInfo;
    }
    
    return new Response(JSON.stringify(errorResponse), {
      status: error.status || 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.CORS_ORIGIN, requestOrigin)
      }
    });
  }
}

// ID・パスワードログイン処理
async function handlePasswordLogin(request, env) {
  const { email, password, deviceFingerprint } = await request.json();
  
  console.log('🔍 Password login attempt:', { email, hasPassword: !!password, hasDeviceFingerprint: !!deviceFingerprint });
  
  if (!email || !password) {
    throw new Error('メールアドレスとパスワードが必要です');
  }

  // メールアドレスの形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('メールアドレスの形式が正しくありません');
  }


  try {
    // ユーザーの存在確認とアカウントロック状態チェック
    const { results } = await env.DB.prepare(`
      SELECT id, password_hash, salt, failed_login_attempts, account_locked_until, last_login_at
      FROM users 
      WHERE id = ?
    `).bind(email).all();

    if (results.length === 0) {
      // ユーザーが存在しない場合は登録を促す
      const error = new Error('アカウントが存在しません。新規登録を行ってください。');
      error.status = 404;
      throw error;
    }

    const user = results[0];

    // パスワードが設定されていない場合
    if (!user.password_hash || !user.salt) {
      const error = new Error('パスワードが設定されていません。管理者にお問い合わせください。');
      error.status = 400;
      throw error;
    }

    // アカウントロック状態チェック
    if (user.account_locked_until) {
      const lockUntil = new Date(user.account_locked_until);
      if (lockUntil > new Date()) {
        const remainingMinutes = Math.ceil((lockUntil - new Date()) / (1000 * 60));
        const error = new Error(`アカウントがロックされています。${remainingMinutes}分後に再度お試しください。`);
        error.status = 423; // Locked
        throw error;
      } else {
        // ロック期限切れの場合、ロックを解除
        await env.DB.prepare(`
          UPDATE users 
          SET account_locked_until = NULL, failed_login_attempts = 0 
          WHERE id = ?
        `).bind(email).run();
      }
    }

    // パスワード検証
    const isPasswordValid = await verifyPassword(password, user.password_hash, user.salt);
    
    if (!isPasswordValid) {
      // ログイン失敗回数を増加
      const failedAttempts = (user.failed_login_attempts || 0) + 1;
      const lockoutDuration = calculateLockoutDuration(failedAttempts);
      
      let lockUntil = null;
      if (lockoutDuration > 0) {
        lockUntil = new Date(Date.now() + lockoutDuration * 60 * 1000).toISOString();
      }

      await env.DB.prepare(`
        UPDATE users 
        SET failed_login_attempts = ?, account_locked_until = ?
        WHERE id = ?
      `).bind(failedAttempts, lockUntil, email).run();

      let errorMessage = 'メールアドレスまたはパスワードが間違っています。';
      if (lockUntil) {
        errorMessage += ` アカウントが${lockoutDuration}分間ロックされました。`;
      }
      
      const error = new Error(errorMessage);
      error.status = 401;
      throw error;
    }

    // ログイン成功 - 失敗カウンターをリセット
    await env.DB.prepare(`
      UPDATE users 
      SET failed_login_attempts = 0, account_locked_until = NULL, last_login_at = datetime('now')
      WHERE id = ?
    `).bind(email).run();

    console.log('✅ Password authentication successful for:', email);

    // JWT生成
    const authResult = await authenticateUser(email);
    


    return {
      success: true,
      message: 'ログインに成功しました',
      token: authResult.token,
      user: {
        id: email,
        email: email,
        lastLoginAt: new Date().toISOString()
      }
    };

  } catch (error) {
    if (error.status) {
      throw error;
    }
    console.error('❌ Password login error:', error);
    throw new Error('ログイン処理でエラーが発生しました');
  }
}

// ユーザー登録処理
async function handleUserRegistration(request, env) {
  const { email, password } = await request.json();
  
  console.log('🔍 User registration attempt:', { email, hasPassword: !!password });
  
  if (!email || !password) {
    throw new Error('メールアドレスとパスワードが必要です');
  }

  // メールアドレスの形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('メールアドレスの形式が正しくありません');
  }

  // パスワード強度チェック
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    const error = new Error(passwordValidation.errors.join('\n'));
    error.status = 400;
    throw error;
  }

  // 許可されたメールアドレスかチェック（環境変数で制御）
  const allowedEmails = env.ALLOWED_EMAILS ? env.ALLOWED_EMAILS.split(',').map(e => e.trim()) : [];
  if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
    const error = new Error('このメールアドレスでの登録は許可されていません。');
    error.status = 403;
    throw error;
  }

  try {
    // 既存ユーザーの確認
    const { results } = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(email).all();
    
    if (results.length > 0) {
      const error = new Error('このメールアドレスは既に登録されています。');
      error.status = 409; // Conflict
      throw error;
    }

    // パスワードハッシュ化
    const { hash, salt } = await hashPassword(password);
    
    // ユーザー作成
    const now = new Date().toISOString();
    await env.DB.prepare(`
      INSERT INTO users (
        id, password_hash, salt, created_at, updated_at, password_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(email, hash, salt, now, now, now).run();

    console.log('✅ User registration successful:', email);

    // 自動ログイン
    const authResult = await authenticateUser(email);
    
    return {
      success: true,
      message: 'アカウントの作成に成功しました',
      token: authResult.token,
      user: {
        id: email,
        email: email,
        createdAt: now
      }
    };

  } catch (error) {
    if (error.status) {
      throw error;
    }
    console.error('❌ User registration error:', error);
    throw new Error('アカウント作成でエラーが発生しました');
  }
}

// パスワードリセット処理
async function handlePasswordReset(request, env) {
  // 将来実装: パスワードリセット機能
  throw new Error('パスワードリセット機能は現在実装中です');
}

// パスワード変更処理
async function handlePasswordChange(request, env) {
  // 将来実装: パスワード変更機能
  throw new Error('パスワード変更機能は現在実装中です');
}





// トークン更新処理
async function handleRefreshToken(request, env) {
  const { token } = await request.json();
  
  if (!token) {
    throw new Error('Refresh token is required');
  }
  
  const verification = await verifyJWT(token);
  if (!verification.valid) {
    const error = new Error('Invalid refresh token');
    error.status = 401;
    throw error;
  }
  
  // 新しいトークンを生成
  const newToken = await generateJWT({
    userId: verification.payload.userId,
    email: verification.payload.email,
    iat: Math.floor(Date.now() / 1000)
  });
  
  return {
    success: true,
    token: newToken
  };
}

// トークン検証エンドポイント（シンプル版）
async function handleValidateToken(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const error = new Error('Authorization header required');
    error.status = 401;
    throw error;
  }
  
  const token = authHeader.substring(7);
  const verification = await verifyJWT(token);
  
  if (!verification.valid) {
    const error = new Error('Invalid token');
    error.status = 401;
    throw error;
  }
  
  const userId = verification.payload.userId;
  console.log('✅ Token validated for user:', userId);
  
  return {
    success: true,
    user: {
      id: userId,
      email: userId,
      validated: true
    }
  };
}

// 現在のユーザー情報取得
async function handleGetCurrentUser(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const error = new Error('Authorization header required');
    error.status = 401;
    throw error;
  }
  
  const token = authHeader.substring(7);
  const verification = await verifyJWT(token);
  
  if (!verification.valid) {
    const error = new Error('Invalid token');
    error.status = 401;
    throw error;
  }
  
  const userId = verification.payload.userId;
  const { results } = await env.DB.prepare(
    'SELECT id, created_at FROM users WHERE id = ?'
  ).bind(userId).all();
  
  if (results.length === 0) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }
  
  return {
    user: {
      id: results[0].id,
      email: results[0].id, // id = email in new schema
      created_at: results[0].created_at
    }
  };
}



// ログアウト処理
async function handleLogout(request, env) {
  // シンプルなログアウト処理
  return {
    success: true,
    message: 'Logged out successfully'
  };
}

// 健全性チェック
async function handleHealthCheck(request, env) {
  try {
    // データベース接続をテスト
    const testQuery = await env.DB.prepare('SELECT 1 as test').first();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: testQuery ? 'connected' : 'disconnected'
    };
  } catch (error) {
    console.error('Health check failed:', error);
    const errorResponse = new Error('Health check failed');
    errorResponse.status = 503;
    throw errorResponse;
  }
}

