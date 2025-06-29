// オフライン検知とバックグラウンド同期管理

import React, { useState, useEffect, useCallback } from 'react';

interface OfflineState {
  isOnline: boolean;
  hasUnsyncedData: boolean;
  lastSyncAttempt: Date | null;
  syncRetryCount: number;
}

export const useOfflineSync = () => {
  const [offlineState, setOfflineState] = useState<OfflineState>({
    isOnline: navigator.onLine,
    hasUnsyncedData: false,
    lastSyncAttempt: null,
    syncRetryCount: 0
  });

  // オンライン/オフライン状態の監視
  useEffect(() => {
    const handleOnline = () => {
      setOfflineState(prev => ({
        ...prev,
        isOnline: true,
        syncRetryCount: 0
      }));
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🌐 オンライン復旧 - 自動同期開始');
      }
    };

    const handleOffline = () => {
      setOfflineState(prev => ({
        ...prev,
        isOnline: false
      }));
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📡 オフライン検知 - ローカル保存モード');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 未同期データフラグの更新
  const markUnsyncedData = useCallback((hasData: boolean) => {
    setOfflineState(prev => ({
      ...prev,
      hasUnsyncedData: hasData
    }));
  }, []);

  // 同期試行の記録
  const recordSyncAttempt = useCallback((success: boolean) => {
    setOfflineState(prev => ({
      ...prev,
      lastSyncAttempt: new Date(),
      syncRetryCount: success ? 0 : prev.syncRetryCount + 1,
      hasUnsyncedData: success ? false : prev.hasUnsyncedData
    }));
  }, []);

  // ネットワーク状態のチェック
  const checkNetworkHealth = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) return false;

    try {
      // シンプルなネットワークテスト
      const response = await fetch('https://httpbin.org/get', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    offlineState,
    markUnsyncedData,
    recordSyncAttempt,
    checkNetworkHealth
  };
};

// オフライン時のユーザー通知コンポーネント
export const OfflineIndicator: React.FC<{ 
  isOnline: boolean; 
  hasUnsyncedData: boolean;
  syncRetryCount: number;
}> = ({ isOnline, hasUnsyncedData, syncRetryCount }) => {
  if (isOnline && !hasUnsyncedData) return null;

  const getStatusMessage = () => {
    if (!isOnline) {
      return '📡 オフライン - 変更はローカルに保存されます';
    }
    if (hasUnsyncedData) {
      return syncRetryCount > 0 
        ? `🔄 同期中... (試行: ${syncRetryCount})`
        : '🔄 未同期データを同期中...';
    }
    return '';
  };

  const getStatusColor = () => {
    if (!isOnline) return '#ff9800'; // オレンジ
    if (hasUnsyncedData) return '#2196f3'; // ブルー
    return '#4caf50'; // グリーン
  };

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: getStatusColor(),
      color: 'white',
      padding: '8px 16px',
      borderRadius: '6px',
      fontSize: '14px',
      zIndex: 1000,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      opacity: 0.9
    }}>
      {getStatusMessage()}
    </div>
  );
};

export default useOfflineSync;