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

  // シンプルな手動同期
  const handleFullSync = async () => {
    setIsSyncing(true);
    try {
      console.log('手動同期開始...');
      
      // 1. ローカルデータを取得
      const localMaps = loadFromStorage(STORAGE_KEYS.MINDMAPS, []).filter(map => 
        map && map.id && map.rootNode
      );
      console.log('ローカルマップ:', localMaps.length);

      // 2. 認証されたユーザーIDを取得
      let userId;
      if (authManager.isAuthenticated() && authManager.getCurrentUser()) {
        // 認証済みの場合は認証ユーザーのIDを使用
        const user = authManager.getCurrentUser();
        userId = user.userId || user.email || user.id;
        console.log('認証済みユーザーID:', userId);
      } else {
        // 認証されていない場合はエラー
        throw new Error('クラウド同期には認証が必要です。先にログインしてください。');
      }
      
      if (!userId) {
        throw new Error('ユーザーIDを取得できませんでした');
      }

      // 3. ローカルマップをクラウドに送信（認証済みリクエスト）
      for (const map of localMaps) {
        const response = await authManager.authenticatedFetch(
          `https://mindflow-api-production.shigekazukoya.workers.dev/api/mindmaps/${map.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(map)
        });
        console.log(`${map.title}: ${response.ok ? '成功' : '失敗'}`);
      }

      // 4. クラウドからデータを取得（認証済みリクエスト）
      const cloudResponse = await authManager.authenticatedFetch(
        'https://mindflow-api-production.shigekazukoya.workers.dev/api/mindmaps'
      );
      const cloudData = await cloudResponse.json();
      const cloudMaps = cloudData.mindmaps || [];
      console.log('クラウドマップ:', cloudMaps.length, 'マップ一覧は更新されてません');

      // 5. 詳細データを取得してローカルに保存
      const detailedMaps = [];
      for (const map of cloudMaps) {
        try {
          console.log('📄 マップ詳細取得:', map.id, map.title);
          const detailResponse = await authManager.authenticatedFetch(
            `https://mindflow-api-production.shigekazukoya.workers.dev/api/mindmaps/${map.id}`
          );
          const detailed = await detailResponse.json();
          if (detailed && detailed.rootNode) {
            detailedMaps.push(detailed);
          }
        } catch (detailError) {
          console.warn('📄 マップ詳細取得失敗:', map.id, detailError);
        }
      }
      
      console.log('📄 詳細データ取得完了、件数:', detailedMaps.length);
      
      if (detailedMaps.length > 0) {
        saveToStorage(STORAGE_KEYS.MINDMAPS, detailedMaps);
        console.log('💾 ローカルキャッシュ保存完了');
      }

      alert(`同期完了!\nローカル: ${localMaps.length}件 → クラウド: ${cloudMaps.length}件`);
      
      // UI更新
      if (refreshAllMindMaps) {
        refreshAllMindMaps();
      }
      
    } catch (error) {
      console.error('手動同期エラー:', error);
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
              disabled={isSyncing || (settings.storageMode !== 'cloud' && !settings.cloudSync)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (isSyncing || (settings.storageMode !== 'cloud' && !settings.cloudSync)) ? 'not-allowed' : 'pointer',
                opacity: (isSyncing || (settings.storageMode !== 'cloud' && !settings.cloudSync)) ? 0.6 : 1
              }}
            >
              {isSyncing ? '同期中...' : '手動同期'}
            </button>
            
            <SyncStatusIndicator />
          </div>
          <small style={{ color: '#666', fontSize: '12px' }}>
            ローカルとクラウドのデータを双方向同期します{(settings.storageMode !== 'cloud' && !settings.cloudSync) ? ' (クラウド同期を有効にしてください)' : ''}
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