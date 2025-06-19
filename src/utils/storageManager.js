// LocalStorage管理と制限チェック専用ユーティリティ

// LocalStorageの制限値（Chrome: 10MB, Firefox: 10MB, Safari: 5MB）
const STORAGE_LIMIT = {
  WARNING_THRESHOLD: 5 * 1024 * 1024, // 5MB で警告
  CRITICAL_THRESHOLD: 8 * 1024 * 1024, // 8MB で制限
  MAX_SINGLE_ITEM: 2 * 1024 * 1024    // 単一アイテム最大2MB
};

// LocalStorageの使用量を計算
export const getStorageSize = () => {
  let totalSize = 0;
  const itemSizes = {};
  
  try {
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        const itemSize = new Blob([localStorage.getItem(key)]).size;
        itemSizes[key] = itemSize;
        totalSize += itemSize;
      }
    }
  } catch (error) {
    console.error('Failed to calculate storage size:', error);
  }
  
  return {
    totalSize,
    itemSizes,
    percentageUsed: (totalSize / STORAGE_LIMIT.CRITICAL_THRESHOLD) * 100
  };
};

// ストレージ容量チェック
export const checkStorageSpace = (dataSize = 0) => {
  const currentUsage = getStorageSize();
  const projectedSize = currentUsage.totalSize + dataSize;
  
  if (projectedSize > STORAGE_LIMIT.CRITICAL_THRESHOLD) {
    return {
      canStore: false,
      level: 'critical',
      message: `ストレージ容量が不足しています。現在: ${(currentUsage.totalSize / 1024 / 1024).toFixed(1)}MB, 上限: ${(STORAGE_LIMIT.CRITICAL_THRESHOLD / 1024 / 1024).toFixed(1)}MB`
    };
  }
  
  if (projectedSize > STORAGE_LIMIT.WARNING_THRESHOLD) {
    return {
      canStore: true,
      level: 'warning',
      message: `ストレージ容量が少なくなっています。現在: ${(currentUsage.totalSize / 1024 / 1024).toFixed(1)}MB`
    };
  }
  
  return {
    canStore: true,
    level: 'normal',
    message: null
  };
};

// 単一アイテムのサイズチェック
export const checkItemSize = (data) => {
  const itemSize = new Blob([JSON.stringify(data)]).size;
  
  if (itemSize > STORAGE_LIMIT.MAX_SINGLE_ITEM) {
    return {
      canStore: false,
      size: itemSize,
      message: `アイテムが大きすぎます。サイズ: ${(itemSize / 1024 / 1024).toFixed(1)}MB, 上限: ${(STORAGE_LIMIT.MAX_SINGLE_ITEM / 1024 / 1024).toFixed(1)}MB`
    };
  }
  
  return {
    canStore: true,
    size: itemSize,
    message: null
  };
};

// 安全なLocalStorage保存
export const safeSetItem = async (key, data) => {
  try {
    // データサイズチェック
    const sizeCheck = checkItemSize(data);
    if (!sizeCheck.canStore) {
      throw new Error(sizeCheck.message);
    }
    
    // ストレージ容量チェック
    const spaceCheck = checkStorageSpace(sizeCheck.size);
    if (!spaceCheck.canStore) {
      // 容量不足の場合、古いデータを削除を試行
      await cleanupOldData();
      
      // 再度チェック
      const recheckSpace = checkStorageSpace(sizeCheck.size);
      if (!recheckSpace.canStore) {
        throw new Error(spaceCheck.message);
      }
    }
    
    // 実際の保存
    localStorage.setItem(key, JSON.stringify(data));
    
    // 警告レベルの場合はコンソールに出力
    if (spaceCheck.level === 'warning') {
      console.warn(spaceCheck.message);
    }
    
    return {
      success: true,
      size: sizeCheck.size,
      warning: spaceCheck.level === 'warning' ? spaceCheck.message : null
    };
    
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 安全なLocalStorage取得
export const safeGetItem = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Failed to load from localStorage (key: ${key}):`, error);
    return defaultValue;
  }
};

// 古いデータのクリーンアップ
export const cleanupOldData = async () => {
  try {
    console.log('🧹 ストレージクリーンアップ開始...');
    
    // 古いマインドマップを削除（30日以上アクセスなし）
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    
    const allMaps = safeGetItem('mindmaps', []);
    const recentMaps = allMaps.filter(map => {
      const lastAccessed = new Date(map.updatedAt || map.createdAt || 0);
      return lastAccessed > cutoffDate;
    });
    
    if (recentMaps.length < allMaps.length) {
      localStorage.setItem('mindmaps', JSON.stringify(recentMaps));
      console.log(`🧹 ${allMaps.length - recentMaps.length} 個の古いマインドマップを削除しました`);
    }
    
    // 一時的なキャッシュデータを削除
    const keysToCheck = Object.keys(localStorage);
    keysToCheck.forEach(key => {
      if (key.startsWith('temp_') || key.startsWith('cache_')) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('✅ ストレージクリーンアップ完了');
    
  } catch (error) {
    console.error('❌ ストレージクリーンアップ失敗:', error);
  }
};

// ストレージ情報の取得
export const getStorageInfo = () => {
  const usage = getStorageSize();
  const spaceCheck = checkStorageSpace();
  
  return {
    totalSize: usage.totalSize,
    totalSizeMB: (usage.totalSize / 1024 / 1024).toFixed(2),
    percentageUsed: usage.percentageUsed.toFixed(1),
    itemCount: Object.keys(usage.itemSizes).length,
    largestItems: Object.entries(usage.itemSizes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([key, size]) => ({
        key,
        size,
        sizeMB: (size / 1024 / 1024).toFixed(2)
      })),
    status: spaceCheck.level,
    canStore: spaceCheck.canStore,
    message: spaceCheck.message
  };
};

// ストレージの完全リセット（開発用）
export const resetStorage = () => {
  if (process.env.NODE_ENV === 'development') {
    const confirmReset = confirm('ストレージを完全にリセットしますか？この操作は元に戻せません。');
    if (confirmReset) {
      localStorage.clear();
      console.log('🔄 ストレージをリセットしました');
      window.location.reload();
    }
  } else {
    console.warn('ストレージリセットは開発環境でのみ利用可能です');
  }
};