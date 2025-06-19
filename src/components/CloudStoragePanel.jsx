import React, { useState, useEffect } from 'react';
import { getAppSettings, saveAppSettings, loadFromStorage, saveToStorage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/dataTypes.js';
import SyncStatusIndicator from './SyncStatusIndicator.jsx';
import AuthModal from './AuthModal.jsx';
import { authManager } from '../utils/authManager.js';

const CloudStoragePanel = ({ isVisible, onClose, refreshAllMindMaps }) => {
  const [settings, setSettings] = useState(getAppSettings());
  const [connectionStatus, setConnectionStatus] = useState('unknown');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(authManager.getCurrentUser());

  useEffect(() => {
    if (isVisible) {
      setSettings(getAppSettings());
    }
  }, [isVisible]);

  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveAppSettings(newSettings);
  };

  // 認証済み接続テスト
  const handleTestConnection = async () => {
    setIsConnecting(true);
    try {
      if (!authManager.isAuthenticated()) {
        setConnectionStatus('not_authenticated');
        return;
      }
      
      const response = await authManager.authenticatedFetch(
        'https://mindflow-api-production.shigekazukoya.workers.dev/api/mindmaps'
      );
      setConnectionStatus(response.ok ? 'connected' : 'failed');
    } catch (error) {
      console.error('Connection test error:', error);
      setConnectionStatus('failed');
    } finally {
      setIsConnecting(false);
    }
  };

  // リアルタイム同期の有効化/無効化
  const handleRealtimeToggle = (enabled) => {
    handleSettingChange('realtimeSync', enabled);
    if (enabled && !authManager.isAuthenticated()) {
      alert('リアルタイム同期には認証が必要です。先にログインしてください。');
      setShowAuthModal(true);
    }
  };


  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setShowAuthModal(false);
  };

  const handleLogout = async () => {
    await authManager.logout();
    setCurrentUser(null);
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        minWidth: '400px',
        maxWidth: '500px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: 0, color: '#333' }}>クラウドストレージ設定</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ×
          </button>
        </div>


        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: 'bold',
            color: '#333'
          }}>
            ストレージモード
          </label>
          <select
            value={settings.storageMode}
            onChange={(e) => handleSettingChange('storageMode', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="local">ローカルストレージのみ</option>
            <option value="cloud">クラウドストレージ</option>
          </select>
          <small style={{ color: '#666', fontSize: '12px' }}>
            クラウドモードでは Cloudflare にデータが保存されます
          </small>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={settings.cloudSync}
              onChange={(e) => handleSettingChange('cloudSync', e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            <span style={{ color: '#333' }}>自動同期</span>
          </label>
          <small style={{ color: '#666', fontSize: '12px' }}>
            ローカルストレージとクラウドの両方に保存します
          </small>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px'
          }}>
            <button
              onClick={handleTestConnection}
              disabled={isConnecting}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isConnecting ? 'not-allowed' : 'pointer',
                opacity: isConnecting ? 0.6 : 1
              }}
            >
              {isConnecting ? '接続中...' : '接続テスト'}
            </button>
            
            {connectionStatus !== 'unknown' && (
              <span style={{
                color: connectionStatus === 'connected' ? '#28a745' : '#dc3545',
                fontSize: '14px'
              }}>
                {connectionStatus === 'connected' ? '✓ 接続成功' : '✗ 接続失敗'}
              </span>
            )}
          </div>
          <small style={{ color: '#666', fontSize: '12px' }}>
            Cloudflare Workers APIへの接続をテストします
          </small>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <input
              type="checkbox"
              checked={settings.realtimeSync || false}
              onChange={(e) => handleRealtimeToggle(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            <span style={{ color: '#333' }}>リアルタイム同期</span>
          </label>
          <small style={{ color: '#666', fontSize: '12px' }}>
            他のデバイスとの変更をリアルタイムで同期します（要認証）
          </small>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px'
          }}>
            <SyncStatusIndicator />
          </div>
          <small style={{ color: '#666', fontSize: '12px' }}>
            自動同期は変更から1秒後に実行されます
          </small>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#333' }}>アカウント</h4>
          {currentUser ? (
            <div style={{
              padding: '12px',
              backgroundColor: '#e8f5e8',
              borderRadius: '6px',
              border: '1px solid #c3e6c3'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{ fontWeight: 'bold', color: '#2d5a2d' }}>
                  ✓ ログイン済み
                </span>
                <button
                  onClick={handleLogout}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'transparent',
                    color: '#666',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  ログアウト
                </button>
              </div>
              <div style={{ fontSize: '14px', color: '#555' }}>
                {currentUser.email}
              </div>
            </div>
          ) : (
            <div style={{
              padding: '12px',
              backgroundColor: '#fff3cd',
              borderRadius: '6px',
              border: '1px solid #ffeaa7'
            }}>
              <div style={{ marginBottom: '8px', color: '#856404' }}>
                クラウド同期にはログインが必要です
              </div>
              <button
                onClick={() => setShowAuthModal(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ログイン
              </button>
            </div>
          )}
        </div>

        <div style={{
          padding: '12px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#666'
        }}>
          <strong>注意:</strong> クラウドストレージを使用するには、Cloudflare Workers APIがデプロイされている必要があります。
          cloudflare-worker ディレクトリの README を参照してください。
        </div>
      </div>

      <AuthModal
        isVisible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
};

export default CloudStoragePanel;