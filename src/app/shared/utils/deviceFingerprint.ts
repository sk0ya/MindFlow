// デバイス・ブラウザフィンガープリンティング機能
// セキュリティと利便性のバランスを考慮した実装

export interface DeviceFingerprint {
  deviceId: string;
  fingerprint: string;
  confidence: number;
  components: {
    screen: string;
    timezone: string;
    language: string;
    platform: string;
    cookieEnabled: boolean;
    doNotTrack: string;
    colorDepth: number;
    pixelRatio: number;
    hardwareConcurrency: number;
    maxTouchPoints: number;
  };
}

/**
 * デバイスフィンガープリントを生成
 */
export async function generateDeviceFingerprint(): Promise<DeviceFingerprint> {
  const components = {
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack || 'unspecified',
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    maxTouchPoints: navigator.maxTouchPoints || 0
  };

  // フィンガープリント文字列を生成
  const fingerprintString = JSON.stringify(components);
  const fingerprint = await hashString(fingerprintString);
  
  // デバイスIDを生成（より安定した要素のみを使用）
  const stableComponents = {
    screen: components.screen,
    timezone: components.timezone,
    language: components.language,
    platform: components.platform
  };
  const deviceId = await hashString(JSON.stringify(stableComponents));
  
  // 信頼度を計算（より多くの要素があるほど高い）
  const confidence = calculateConfidence(components);

  return {
    deviceId,
    fingerprint,
    confidence,
    components
  };
}

/**
 * 既存のデバイスフィンガープリントと比較
 */
export function compareFingerprints(
  current: DeviceFingerprint, 
  stored: DeviceFingerprint
): { 
  isMatch: boolean; 
  similarity: number; 
  riskLevel: 'low' | 'medium' | 'high' 
} {
  // デバイスIDが完全一致する場合
  if (current.deviceId === stored.deviceId) {
    return {
      isMatch: true,
      similarity: 1.0,
      riskLevel: 'low'
    };
  }

  // 部分的な一致度を計算
  let matchCount = 0;
  let totalCount = 0;

  for (const [key, value] of Object.entries(current.components)) {
    totalCount++;
    if (stored.components[key as keyof typeof stored.components] === value) {
      matchCount++;
    }
  }

  const similarity = matchCount / totalCount;
  
  // リスクレベルを判定
  let riskLevel: 'low' | 'medium' | 'high';
  if (similarity >= 0.8) {
    riskLevel = 'low';
  } else if (similarity >= 0.6) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'high';
  }

  return {
    isMatch: similarity >= 0.7, // 70%以上の類似度で一致と判定
    similarity,
    riskLevel
  };
}

/**
 * ローカルストレージにフィンガープリントを保存
 */
export function saveDeviceFingerprint(fingerprint: DeviceFingerprint): void {
  // Dynamically import to avoid circular dependencies
  import('./localStorage').then(({ setLocalStorage, STORAGE_KEYS }) => {
    setLocalStorage(STORAGE_KEYS.DEVICE_FINGERPRINT, {
      ...fingerprint,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    });
  }).catch(error => {
    console.warn('Failed to save device fingerprint:', error);
  });
}

/**
 * ローカルストレージからフィンガープリントを取得
 */
export async function getStoredDeviceFingerprint(): Promise<DeviceFingerprint | null> {
  try {
    // Lazy load to avoid circular dependencies
    const { getLocalStorage, STORAGE_KEYS } = await import('./localStorage');
    const result = getLocalStorage<DeviceFingerprint>(STORAGE_KEYS.DEVICE_FINGERPRINT);
    const stored = result.success && result.data ? JSON.stringify(result.data) : null;
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    
    // 30日より古い場合は無効とする
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (new Date(parsed.createdAt) < thirtyDaysAgo) {
      const { removeLocalStorage, STORAGE_KEYS } = await import('./localStorage');
      removeLocalStorage(STORAGE_KEYS.DEVICE_FINGERPRINT);
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.warn('Failed to retrieve stored fingerprint:', error);
    return null;
  }
}

/**
 * 文字列をハッシュ化
 */
async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * フィンガープリントの信頼度を計算
 */
function calculateConfidence(components: DeviceFingerprint['components']): number {
  let score = 0;
  let maxScore = 0;

  // 各要素の重要度を設定
  const weights = {
    screen: 0.2,
    timezone: 0.15,
    language: 0.1,
    platform: 0.15,
    cookieEnabled: 0.05,
    doNotTrack: 0.05,
    colorDepth: 0.1,
    pixelRatio: 0.1,
    hardwareConcurrency: 0.05,
    maxTouchPoints: 0.05
  };

  for (const [key, weight] of Object.entries(weights)) {
    maxScore += weight;
    if (components[key as keyof typeof components] !== undefined && 
        components[key as keyof typeof components] !== null &&
        components[key as keyof typeof components] !== 0) {
      score += weight;
    }
  }

  return Math.min(score / maxScore, 1.0);
}

/**
 * デバイス情報の変更を検出
 */
export async function detectDeviceChanges(): Promise<{
  hasChanges: boolean;
  changes: string[];
  recommendation: 'allow' | 'challenge' | 'deny';
}> {
  const current = await generateDeviceFingerprint();
  const stored = getStoredDeviceFingerprint();
  
  if (!stored) {
    // 初回の場合は保存して許可
    saveDeviceFingerprint(current);
    return {
      hasChanges: false,
      changes: [],
      recommendation: 'allow'
    };
  }

  const storedFingerprint = await stored;
  if (!storedFingerprint) {
    return {
      hasChanges: false,
      changes: [],
      recommendation: 'allow'
    };
  }

  const comparison = compareFingerprints(current, storedFingerprint);
  const changes: string[] = [];

  // 変更点を特定
  for (const [key, value] of Object.entries(current.components)) {
    if (storedFingerprint.components[key as keyof typeof storedFingerprint.components] !== value) {
      changes.push(key);
    }
  }

  // 推奨アクションを決定
  let recommendation: 'allow' | 'challenge' | 'deny';
  
  if (comparison.riskLevel === 'low') {
    recommendation = 'allow';
    // フィンガープリントを更新
    saveDeviceFingerprint(current);
  } else if (comparison.riskLevel === 'medium') {
    recommendation = 'challenge';
  } else {
    recommendation = 'deny';
  }

  return {
    hasChanges: changes.length > 0,
    changes,
    recommendation
  };
}