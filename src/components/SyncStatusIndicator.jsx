import React, { useState, useEffect } from 'react';
import { getSyncStatus } from '../utils/storage.js';
import { syncManager } from '../utils/syncManager.js';
import { authManager } from '../utils/authManager.js';

const SyncStatusIndicator = () => {
  const [syncStatus, setSyncStatus] = useState({
    isOnline: navigator.onLine,
    queueLength: 0,
    lastSyncTime: null,
    needsSync: false
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncText, setLastSyncText] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(authManager.isAuthenticated());

  useEffect(() => {
    const updateStatus = async () => {
      try {
        // 認証状態を更新
        const authStatus = authManager.isAuthenticated();
        setIsAuthenticated(authStatus);
        
        // 認証されていない場合は同期状態をリセット
        if (!authStatus) {
          setSyncStatus({
            isOnline: navigator.onLine,
            queueLength: 0,
            lastSyncTime: null,
            needsSync: false
          });
          setLastSyncText('ローカルのみ');
          return;
        }
        
        const status = getSyncStatus();
        setSyncStatus(status);
        
        if (status.lastSyncTime) {
          const lastSync = new Date(status.lastSyncTime);
          const now = new Date();
          const diffMinutes = Math.floor((now - lastSync) / (1000 * 60));
          
          if (diffMinutes < 1) {
            setLastSyncText('今');
          } else if (diffMinutes < 60) {
            setLastSyncText(`${diffMinutes}分前`);
          } else {
            setLastSyncText(lastSync.toLocaleTimeString('ja-JP', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }));
          }
        } else {
          setLastSyncText('未同期');
        }
      } catch (error) {
        console.error('Failed to update sync status:', error);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 30000); // 30秒ごとに更新

    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    if (isSyncing || !isAuthenticated) return;
    
    setIsSyncing(true);
    try {
      const result = await syncManager.forcSync();
      console.log('Manual sync completed:', result);
      setSyncStatus(getSyncStatus());
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusIcon = () => {
    if (!isAuthenticated) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#6c757d">
          <circle cx="12" cy="12" r="10"/>
          <path d="M16 8v4a4 4 0 01-8 0V8a4 4 0 018 0z" fill="white"/>
          <path d="M12 14v2" stroke="white" strokeWidth="2"/>
        </svg>
      );
    }
    
    if (isSyncing) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="sync-spinning">
          <path d="M23 12c0 6.075-4.925 11-11 11S1 18.075 1 12 5.925 1 12 1s11 4.925 11 11z" stroke="#007bff" strokeWidth="2"/>
          <path d="M8 12l2 2 4-4" stroke="#007bff" strokeWidth="2" fill="none"/>
        </svg>
      );
    }

    if (!syncStatus.isOnline) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#dc3545">
          <circle cx="12" cy="12" r="10"/>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="white" strokeWidth="2"/>
        </svg>
      );
    }

    if (syncStatus.needsSync) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffc107">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12" stroke="white" strokeWidth="2"/>
          <line x1="12" y1="16" x2="12.01" y2="16" stroke="white" strokeWidth="2"/>
        </svg>
      );
    }

    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#28a745">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="9,12 11,14 15,10" stroke="white" strokeWidth="2" fill="none"/>
      </svg>
    );
  };

  const getStatusText = () => {
    if (!isAuthenticated) return 'ローカルモード';
    if (isSyncing) return '同期中...';
    if (!syncStatus.isOnline) return 'オフライン';
    if (syncStatus.needsSync) return `待機中 (${syncStatus.queueLength})`;
    return '同期済み';
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 8px',
      fontSize: '12px',
      color: '#666',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      border: '1px solid #e9ecef',
      cursor: syncStatus.needsSync ? 'pointer' : 'default'
    }} onClick={syncStatus.needsSync && isAuthenticated ? handleManualSync : undefined}>
      {getStatusIcon()}
      <span>{getStatusText()}</span>
      {lastSyncText && (
        <span style={{ color: '#999', fontSize: '11px' }}>
          ({lastSyncText})
        </span>
      )}
      
      <style jsx>{`
        .sync-spinning {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SyncStatusIndicator;