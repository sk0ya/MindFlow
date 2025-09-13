// デバイスセキュリティとセッション管理
// レートリミット、デバイス識別、セキュリティ機能

/**
 * デバイス情報を抽出してハッシュ化
 */
export function extractDeviceInfo(request) {
  const headers = request.headers;
  
  return {
    userAgent: headers.get('User-Agent') || 'unknown',
    acceptLanguage: headers.get('Accept-Language') || 'unknown',
    acceptEncoding: headers.get('Accept-Encoding') || 'unknown',
    ipAddress: headers.get('CF-Connecting-IP') || headers.get('X-Forwarded-For') || 'unknown',
    cfRay: headers.get('CF-Ray') || 'unknown',
    cfCountry: headers.get('CF-IPCountry') || 'unknown'
  };
}

/**
 * デバイスフィンガープリントを生成
 */
export async function generateDeviceHash(deviceInfo, clientFingerprint = null) {
  // サーバーサイドの情報でベースハッシュを生成
  const serverInfo = {
    userAgent: normalizeUserAgent(deviceInfo.userAgent),
    acceptLanguage: deviceInfo.acceptLanguage,
    ipAddress: deviceInfo.ipAddress,
    country: deviceInfo.cfCountry
  };
  
  const baseString = JSON.stringify(serverInfo);
  
  // クライアントフィンガープリントがある場合は結合
  let finalString = baseString;
  if (clientFingerprint) {
    finalString = baseString + '|' + clientFingerprint;
  }
  
  return await hashString(finalString);
}

/**
 * セッショントークンを生成（永続的）
 */
export async function createPersistentSession(email, deviceInfo, clientFingerprint, env) {
  console.log('🔐 永続セッション生成開始:', { email });
  
  const deviceHash = await generateDeviceHash(deviceInfo, clientFingerprint);
  const sessionId = generateSecureId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30日後
  
  // 既存のアクティブセッションを取得
  const existingSessions = await env.DB.prepare(`
    SELECT * FROM user_sessions 
    WHERE user_id = ? AND device_hash = ? AND expires_at > datetime('now') AND revoked_at IS NULL
    ORDER BY last_accessed_at DESC
  `).bind(email, deviceHash).all();
  
  // デバイスごとに1つのセッションのみ許可
  if (existingSessions.results.length > 0) {
    const existingSession = existingSessions.results[0];
    
    // 最後のアクセス時間を更新
    await env.DB.prepare(`
      UPDATE user_sessions 
      SET last_accessed_at = datetime('now'),
          access_count = access_count + 1
      WHERE id = ?
    `).bind(existingSession.id).run();
    
    console.log('🔄 既存セッションを延長:', { sessionId: existingSession.id });
    
    return {
      sessionId: existingSession.id,
      token: existingSession.session_token,
      expiresAt: existingSession.expires_at,
      isNewSession: false
    };
  }
  
  // 新しいセッションを作成
  const sessionToken = generateSecureToken();
  
  await env.DB.prepare(`
    INSERT INTO user_sessions (
      id, user_id, session_token, device_hash, device_info,
      expires_at, created_at, last_accessed_at, access_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).bind(
    sessionId,
    email,
    sessionToken,
    deviceHash,
    JSON.stringify({
      ...deviceInfo,
      clientFingerprint: clientFingerprint ? 'present' : 'none',
      timestamp: now.toISOString()
    }),
    expiresAt.toISOString(),
    now.toISOString(),
    now.toISOString()
  ).run();
  
  console.log('✅ 新セッション作成完了:', { sessionId });
  
  return {
    sessionId,
    token: sessionToken,
    expiresAt: expiresAt.toISOString(),
    isNewSession: true
  };
}

/**
 * セッションを検証
 */
export async function validateSession(sessionToken, request, env) {
  const deviceInfo = extractDeviceInfo(request);
  
  const session = await env.DB.prepare(`
    SELECT * FROM user_sessions 
    WHERE session_token = ? AND expires_at > datetime('now') AND revoked_at IS NULL
  `).bind(sessionToken).first();
  
  if (!session) {
    return { valid: false, reason: 'session_not_found' };
  }
  
  // デバイス情報の検証
  const currentDeviceHash = await generateDeviceHash(deviceInfo);
  const storedDeviceInfo = JSON.parse(session.device_info);
  
  // より緩やかなデバイス検証（IPアドレス変更を許可）
  const isDeviceMatch = await validateDeviceCompatibility(
    deviceInfo, 
    storedDeviceInfo, 
    currentDeviceHash, 
    session.device_hash
  );
  
  if (!isDeviceMatch.valid) {
    console.warn('🚨 デバイス不一致検出:', {
      sessionId: session.id,
      reason: isDeviceMatch.reason,
      riskLevel: isDeviceMatch.riskLevel
    });
    
    if (isDeviceMatch.riskLevel === 'high') {
      return { valid: false, reason: 'device_mismatch', riskLevel: 'high' };
    }
  }
  
  // 1ヶ月以上アクセスなしかチェック
  const lastAccessed = new Date(session.last_accessed_at);
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  
  if (lastAccessed < oneMonthAgo) {
    // セッションを無効化
    await env.DB.prepare(`
      UPDATE user_sessions SET revoked_at = datetime('now') WHERE id = ?
    `).bind(session.id).run();
    
    return { valid: false, reason: 'session_expired_inactive' };
  }
  
  // アクセス情報を更新
  await env.DB.prepare(`
    UPDATE user_sessions 
    SET last_accessed_at = datetime('now'),
        access_count = access_count + 1
    WHERE id = ?
  `).bind(session.id).run();
  
  return {
    valid: true,
    session,
    user: {
      id: session.user_id,
      email: session.user_id
    }
  };
}

/**
 * デバイス互換性を検証
 */
async function validateDeviceCompatibility(current, stored, currentHash, storedHash) {
  // 完全一致の場合
  if (currentHash === storedHash) {
    return { valid: true, reason: 'exact_match', riskLevel: 'low' };
  }
  
  // User-Agentの主要部分が一致するかチェック
  const currentUA = normalizeUserAgent(current.userAgent);
  const storedUA = normalizeUserAgent(stored.userAgent);
  
  if (currentUA === storedUA && current.acceptLanguage === stored.acceptLanguage) {
    // 同じブラウザ・言語設定で、IPアドレスのみ変更の場合は許可
    return { valid: true, reason: 'browser_match', riskLevel: 'low' };
  }
  
  // 国が変更された場合はリスクが高い
  if (current.cfCountry !== stored.country && stored.country !== 'unknown') {
    return { valid: false, reason: 'country_mismatch', riskLevel: 'high' };
  }
  
  // その他の場合は中程度のリスク
  return { valid: true, reason: 'partial_match', riskLevel: 'medium' };
}

/**
 * User-Agentを正規化（バージョン番号を除去）
 */
function normalizeUserAgent(userAgent) {
  if (!userAgent || userAgent === 'unknown') return 'unknown';
  
  // バージョン番号を除去して主要なブラウザ識別子のみ残す
  return userAgent
    .replace(/\b\d+\.\d+(\.\d+)*\b/g, 'X.X') // バージョン番号をX.Xに置換
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, 'DATE') // 日付を置換
    .toLowerCase();
}

/**
 * レートリミッティング
 */
export async function checkRateLimit(email, action, env) {
  const key = `rate_limit:${action}:${email}`;
  const now = Math.floor(Date.now() / 1000);
  const window = getRateLimitWindow(action);
  const limit = getRateLimitCount(action);
  
  // 現在の時間窓でのアクセス数を取得
  const current = await env.RATE_LIMIT.get(key);
  const count = current ? parseInt(current, 10) : 0;
  
  if (count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: now + window
    };
  }
  
  // カウントを増加
  await env.RATE_LIMIT.put(key, (count + 1).toString(), {
    expirationTtl: window
  });
  
  return {
    allowed: true,
    remaining: limit - count - 1,
    resetTime: now + window
  };
}

/**
 * レートリミット設定
 */
function getRateLimitWindow(action) {
  const limits = {
    'login': 300, // 5分
    'auth_verify': 60, // 1分
    'session_create': 300 // 5分
  };
  return limits[action] || 300;
}

function getRateLimitCount(action) {
  const counts = {
    'login': 5, // 5回/5分
    'auth_verify': 10, // 10回/1分
    'session_create': 3 // 3回/5分
  };
  return counts[action] || 5;
}

/**
 * セキュアなIDを生成
 */
function generateSecureId() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * セキュアなトークンを生成
 */
function generateSecureToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 文字列をハッシュ化
 */
async function hashString(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 期限切れセッションのクリーンアップ
 */
export async function cleanupExpiredSessions(env) {
  const result = await env.DB.prepare(`
    DELETE FROM user_sessions 
    WHERE expires_at < datetime('now') OR revoked_at IS NOT NULL
  `).run();
  
  console.log('🧹 期限切れセッションクリーンアップ:', { deleted: result.changes || 0 });
  return result.changes || 0;
}