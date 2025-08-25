// パスワードハッシュ化と検証ユーティリティ

/**
 * パスワードをハッシュ化（bcrypt風の実装）
 * @param {string} password - 平文パスワード
 * @param {number} rounds - ハッシュ化の強度（デフォルト12）
 * @returns {Promise<{hash: string, salt: string}>}
 */
export async function hashPassword(password, rounds = 12) {
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }

  // ソルト生成
  const salt = await generateSalt(16);
  
  // パスワード + ソルトをハッシュ化
  const hash = await pbkdf2Hash(password + salt, salt, rounds);
  
  return {
    hash: hash,
    salt: salt
  };
}

/**
 * パスワードを検証
 * @param {string} password - 平文パスワード
 * @param {string} hash - 保存されているハッシュ
 * @param {string} salt - 保存されているソルト
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, hash, salt) {
  if (!password || !hash || !salt) {
    return false;
  }

  try {
    // 同じ方法でハッシュ化して比較
    const testHash = await pbkdf2Hash(password + salt, salt, 12);
    return timingSafeEqual(hash, testHash);
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * パスワード強度チェック
 * @param {string} password - 平文パスワード
 * @returns {{valid: boolean, errors: string[], score: number}}
 */
export function validatePasswordStrength(password) {
  const errors = [];
  let score = 0;

  if (!password) {
    errors.push('パスワードが入力されていません');
    return { valid: false, errors, score: 0 };
  }

  if (password.length < 6) {
    errors.push('パスワードは6文字以上である必要があります');
  } else {
    score += 1;
  }

  if (password.length >= 8) {
    score += 1;
  }

  if (/[a-z]/.test(password)) {
    score += 1;
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  }

  if (/[0-9]/.test(password)) {
    score += 1;
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 1;
  }

  if (password.length < 8 && score < 3) {
    errors.push('パスワードが弱すぎます。8文字以上で英数字を組み合わせてください');
  }

  // よくあるパスワードパターンチェック
  const commonPatterns = [
    'password', '123456', 'qwerty', 'abc123', 
    'password123', '123456789', 'welcome', 'admin'
  ];
  
  if (commonPatterns.some(pattern => 
    password.toLowerCase().includes(pattern.toLowerCase())
  )) {
    errors.push('一般的すぎるパスワードは使用できません');
    score = Math.max(0, score - 2);
  }

  return {
    valid: errors.length === 0,
    errors,
    score: Math.min(score, 5)
  };
}

/**
 * ランダムソルト生成
 * @param {number} length - ソルトの長さ（バイト）
 * @returns {Promise<string>}
 */
async function generateSalt(length = 16) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * PBKDF2ハッシュ関数
 * @param {string} password - パスワード
 * @param {string} salt - ソルト
 * @param {number} iterations - 反復回数
 * @returns {Promise<string>}
 */
async function pbkdf2Hash(password, salt, iterations = 10000) {
  const encoder = new TextEncoder();
  
  // キーマテリアルを作成
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  // ハッシュ生成
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: iterations * 1000, // より強力なハッシュ化
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 32バイト
  );
  
  // Base64エンコード
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return btoa(String.fromCharCode.apply(null, hashArray));
}

/**
 * タイミング攻撃耐性のある文字列比較
 * @param {string} a - 文字列A
 * @param {string} b - 文字列B
 * @returns {boolean}
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * パスワードリセットトークン生成
 * @returns {Promise<string>}
 */
export async function generatePasswordResetToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * アカウントロック時間を計算
 * @param {number} failedAttempts - ログイン失敗回数
 * @returns {number} ロック時間（分）
 */
export function calculateLockoutDuration(failedAttempts) {
  if (failedAttempts < 3) return 0;
  if (failedAttempts < 5) return 5;   // 5分
  if (failedAttempts < 10) return 15; // 15分
  if (failedAttempts < 15) return 60; // 1時間
  return 1440; // 24時間
}