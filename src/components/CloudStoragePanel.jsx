import React, { useState, useEffect } from 'react';
import { getAppSettings, saveAppSettings, testCloudConnection, syncWithCloud, getSyncStatus } from '../utils/storage.js';
import SyncStatusIndicator from './SyncStatusIndicator.jsx';
import AuthModal from './AuthModal.jsx';
import { authManager } from '../utils/authManager.js';

const CloudStoragePanel = ({ isVisible, onClose }) => {
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

  const handleTestConnection = async () => {
    setIsConnecting(true);
    try {
      const isConnected = await testCloudConnection();
      setConnectionStatus(isConnected ? 'connected' : 'failed');
    } catch (error) {
      setConnectionStatus('failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleFullSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncWithCloud();
      alert(`同期完了: ${result.conflicts > 0 ? `${result.conflicts}件の競合を解決` : '競合なし'}`);
    } catch (error) {
      alert(`同期失敗: ${error.message}`);
    } finally {
      setIsSyncing(false);
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
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px'
          }}>
            <button
              onClick={handleFullSync}
              disabled={isSyncing || settings.storageMode !== 'cloud'}
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (isSyncing || settings.storageMode !== 'cloud') ? 'not-allowed' : 'pointer',
                opacity: (isSyncing || settings.storageMode !== 'cloud') ? 0.6 : 1
              }}
            >
              {isSyncing ? '同期中...' : '手動同期'}
            </button>
            
            <SyncStatusIndicator />
          </div>
          <small style={{ color: '#666', fontSize: '12px' }}>
            ローカルとクラウドのデータを双方向同期します
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