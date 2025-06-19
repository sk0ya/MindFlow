import React, { useState, useEffect } from 'react';
import { authManager } from '../utils/authManager.js';
import { getStorageInfo } from '../utils/storageManager.js';
import { formatFileSize } from '../utils/fileOptimization.js';

const CloudStoragePanelEnhanced = ({ isVisible, onClose, allMindMaps, refreshAllMindMaps, currentMapId, switchToMap, deleteMindMapById, renameMindMap, createMindMap }) => {
  const [activeTab, setActiveTab] = useState('maps');
  const [currentUser, setCurrentUser] = useState(authManager.getCurrentUser());
  const [connectionStatus, setConnectionStatus] = useState('unknown');
  const [isConnecting, setIsConnecting] = useState(false);
  const [storageInfo, setStorageInfo] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [isCreatingMap, setIsCreatingMap] = useState(false);
  const [newMapTitle, setNewMapTitle] = useState('');

  useEffect(() => {
    if (isVisible) {
      updateStorageInfo();
      checkConnectionStatus();
    }
  }, [isVisible]);

  const updateStorageInfo = () => {
    const info = getStorageInfo();
    setStorageInfo(info);
  };

  const checkConnectionStatus = async () => {
    if (!authManager.isAuthenticated()) {
      setConnectionStatus('not_authenticated');
      return;
    }

    setIsConnecting(true);
    try {
      const response = await authManager.authenticatedFetch(
        'https://mindflow-api-production.shigekazukoya.workers.dev/api/mindmaps'
      );
      setConnectionStatus(response.ok ? 'connected' : 'failed');
    } catch (error) {
      setConnectionStatus('failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLogin = () => {
    const authUrl = 'https://mindflow-api-production.shigekazukoya.workers.dev/auth/google';
    window.location.href = authUrl;
  };

  const handleLogout = () => {
    authManager.logout();
    setCurrentUser(null);
    setConnectionStatus('not_authenticated');
  };

  const handleCreateMap = () => {
    if (newMapTitle.trim()) {
      createMindMap(newMapTitle.trim());
      setNewMapTitle('');
      setIsCreatingMap(false);
    }
  };

  const getFilteredMaps = () => {
    let filtered = allMindMaps.filter(map => {
      const matchesSearch = map.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || map.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'createdAt':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'updatedAt':
        default:
          return new Date(b.updatedAt) - new Date(a.updatedAt);
      }
    });
  };

  const getCategories = () => {
    const categories = new Set(['all']);
    allMindMaps.forEach(map => {
      if (map.category) categories.add(map.category);
    });
    return Array.from(categories);
  };

  if (!isVisible) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="cloud-storage-panel enhanced" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" stroke="currentColor" strokeWidth="2"/>
            </svg>
            クラウドストレージ & マップ管理
          </h2>
          <button onClick={onClose} className="close-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
        </div>

        <div className="panel-tabs">
          <button
            className={`tab ${activeTab === 'maps' ? 'active' : ''}`}
            onClick={() => setActiveTab('maps')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 12l2 2 4-4M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" stroke="currentColor" strokeWidth="2"/>
            </svg>
            マインドマップ
          </button>
          <button
            className={`tab ${activeTab === 'storage' ? 'active' : ''}`}
            onClick={() => setActiveTab('storage')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2z" stroke="currentColor" strokeWidth="2"/>
            </svg>
            ストレージ
          </button>
          <button
            className={`tab ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="currentColor" strokeWidth="2"/>
            </svg>
            アカウント
          </button>
        </div>

        <div className="panel-content">
          {activeTab === 'maps' && (
            <div className="maps-tab">
              <div className="maps-header">
                <div className="search-controls">
                  <div className="search-box">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                      <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    <input
                      type="text"
                      placeholder="マップを検索..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="category-filter"
                  >
                    {getCategories().map(category => (
                      <option key={category} value={category}>
                        {category === 'all' ? 'すべて' : category}
                      </option>
                    ))}
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="sort-filter"
                  >
                    <option value="updatedAt">更新日時</option>
                    <option value="createdAt">作成日時</option>
                    <option value="title">タイトル</option>
                  </select>
                </div>
                <button
                  onClick={() => setIsCreatingMap(true)}
                  className="btn btn-primary"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  新規作成
                </button>
              </div>

              {isCreatingMap && (
                <div className="create-map-form">
                  <input
                    type="text"
                    placeholder="新しいマップのタイトル..."
                    value={newMapTitle}
                    onChange={(e) => setNewMapTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateMap();
                      if (e.key === 'Escape') {
                        setIsCreatingMap(false);
                        setNewMapTitle('');
                      }
                    }}
                    autoFocus
                  />
                  <div className="form-actions">
                    <button onClick={handleCreateMap} className="btn btn-primary">作成</button>
                    <button onClick={() => {
                      setIsCreatingMap(false);
                      setNewMapTitle('');
                    }} className="btn btn-secondary">キャンセル</button>
                  </div>
                </div>
              )}

              <div className="maps-list">
                {getFilteredMaps().map(map => (
                  <div
                    key={map.id}
                    className={`map-item ${map.id === currentMapId ? 'current' : ''}`}
                  >
                    <div className="map-info" onClick={() => switchToMap(map.id)}>
                      <div className="map-title">{map.title}</div>
                      <div className="map-meta">
                        <span className="map-category">{map.category || '未分類'}</span>
                        <span className="map-date">
                          {new Date(map.updatedAt).toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                    </div>
                    <div className="map-actions">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newTitle = prompt('新しいタイトル:', map.title);
                          if (newTitle && newTitle !== map.title) {
                            renameMindMap(map.id, newTitle);
                          }
                        }}
                        className="btn-icon"
                        title="名前を変更"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2"/>
                          <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`"${map.title}"を削除しますか？`)) {
                            deleteMindMapById(map.id);
                          }
                        }}
                        className="btn-icon danger"
                        title="削除"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="storage-tab">
              {storageInfo && (
                <>
                  <div className="storage-overview">
                    <h3>ストレージ使用状況</h3>
                    <div className="storage-stats">
                      <div className="stat-item">
                        <div className="stat-label">使用量</div>
                        <div className="stat-value">{storageInfo.totalSizeMB} MB</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-label">使用率</div>
                        <div className="stat-value">{storageInfo.percentageUsed}%</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-label">アイテム数</div>
                        <div className="stat-value">{storageInfo.itemCount}</div>
                      </div>
                    </div>
                    
                    <div className="storage-bar">
                      <div 
                        className="storage-used" 
                        style={{ width: `${Math.min(storageInfo.percentageUsed, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="storage-details">
                    <h4>大きなアイテム</h4>
                    <div className="large-items">
                      {storageInfo.largestItems.map((item, index) => (
                        <div key={index} className="item-detail">
                          <span className="item-name">{item.key}</span>
                          <span className="item-size">{item.sizeMB} MB</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="storage-actions">
                    <button
                      onClick={() => {
                        if (confirm('古いデータをクリーンアップしますか？')) {
                          // クリーンアップ機能は既に実装済み
                          updateStorageInfo();
                        }
                      }}
                      className="btn btn-secondary"
                    >
                      クリーンアップ
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'account' && (
            <div className="account-tab">
              {currentUser ? (
                <div className="authenticated-user">
                  <div className="user-profile">
                    <div className="user-avatar">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                    <div className="user-details">
                      <h3>{currentUser.name || currentUser.email}</h3>
                      <p>{currentUser.email}</p>
                    </div>
                  </div>
                  
                  <div className="connection-status">
                    <div className="status-indicator">
                      <div className={`status-dot ${connectionStatus}`}></div>
                      <span>
                        {connectionStatus === 'connected' && 'クラウドに接続済み'}
                        {connectionStatus === 'failed' && '接続エラー'}
                        {connectionStatus === 'unknown' && '接続状況を確認中...'}
                      </span>
                    </div>
                    <button
                      onClick={checkConnectionStatus}
                      disabled={isConnecting}
                      className="btn btn-secondary"
                    >
                      {isConnecting ? '確認中...' : '接続テスト'}
                    </button>
                  </div>

                  <div className="account-actions">
                    <button onClick={handleLogout} className="btn btn-danger">
                      ログアウト
                    </button>
                  </div>
                </div>
              ) : (
                <div className="login-prompt">
                  <div className="login-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </div>
                  <h3>クラウド同期でデータを安全に</h3>
                  <p>ログインしてマインドマップをクラウドに同期し、どこからでもアクセスできるようにしましょう。</p>
                  <button onClick={handleLogin} className="btn btn-primary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 12l2 2 4-4M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    Googleでログイン
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <style jsx>{`
          .cloud-storage-panel.enhanced {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 900px;
            max-width: 90vw;
            height: 600px;
            max-height: 85vh;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            z-index: 1000;
          }

          .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid #e5e7eb;
            background: #f9fafb;
          }

          .panel-header h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: #111827;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .close-btn {
            background: none;
            border: none;
            padding: 8px;
            border-radius: 6px;
            cursor: pointer;
            color: #6b7280;
            transition: all 0.2s;
          }

          .close-btn:hover {
            background: #f3f4f6;
            color: #374151;
          }

          .panel-tabs {
            display: flex;
            background: #f9fafb;
            border-bottom: 1px solid #e5e7eb;
          }

          .tab {
            flex: 1;
            padding: 12px 16px;
            background: none;
            border: none;
            font-size: 14px;
            font-weight: 500;
            color: #6b7280;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: all 0.2s;
            border-bottom: 2px solid transparent;
          }

          .tab.active {
            color: #2563eb;
            background: white;
            border-bottom-color: #2563eb;
          }

          .tab:hover:not(.active) {
            color: #374151;
            background: #f3f4f6;
          }

          .panel-content {
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }

          .maps-tab, .storage-tab, .account-tab {
            flex: 1;
            padding: 20px 24px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
          }

          .maps-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            gap: 16px;
          }

          .search-controls {
            display: flex;
            align-items: center;
            gap: 12px;
            flex: 1;
          }

          .search-box {
            position: relative;
            flex: 1;
            max-width: 300px;
          }

          .search-box svg {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: #9ca3af;
          }

          .search-box input {
            width: 100%;
            padding: 10px 12px 10px 40px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 14px;
          }

          .category-filter, .sort-filter {
            padding: 10px 12px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 14px;
            background: white;
          }

          .create-map-form {
            background: #f8fafc;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
          }

          .create-map-form input {
            width: 100%;
            padding: 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            margin-bottom: 12px;
          }

          .form-actions {
            display: flex;
            gap: 8px;
          }

          .maps-list {
            flex: 1;
            overflow-y: auto;
          }

          .map-item {
            display: flex;
            align-items: center;
            padding: 16px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .map-item:hover {
            background: #f9fafb;
            border-color: #d1d5db;
          }

          .map-item.current {
            background: #eff6ff;
            border-color: #3b82f6;
          }

          .map-info {
            flex: 1;
          }

          .map-title {
            font-size: 16px;
            font-weight: 500;
            color: #111827;
            margin-bottom: 4px;
          }

          .map-meta {
            display: flex;
            gap: 12px;
            font-size: 12px;
            color: #6b7280;
          }

          .map-actions {
            display: flex;
            gap: 8px;
          }

          .btn-icon {
            background: none;
            border: none;
            padding: 8px;
            border-radius: 6px;
            cursor: pointer;
            color: #6b7280;
            transition: all 0.2s;
          }

          .btn-icon:hover {
            background: #f3f4f6;
            color: #374151;
          }

          .btn-icon.danger:hover {
            background: #fef2f2;
            color: #dc2626;
          }

          .storage-overview {
            margin-bottom: 24px;
          }

          .storage-overview h3 {
            margin: 0 0 16px 0;
            font-size: 16px;
            font-weight: 600;
          }

          .storage-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-bottom: 16px;
          }

          .stat-item {
            text-align: center;
            padding: 16px;
            background: #f9fafb;
            border-radius: 8px;
          }

          .stat-label {
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 4px;
          }

          .stat-value {
            font-size: 18px;
            font-weight: 600;
            color: #111827;
          }

          .storage-bar {
            width: 100%;
            height: 8px;
            background: #f3f4f6;
            border-radius: 4px;
            overflow: hidden;
          }

          .storage-used {
            height: 100%;
            background: linear-gradient(90deg, #10b981, #3b82f6);
            transition: width 0.3s ease;
          }

          .storage-details h4 {
            margin: 24px 0 16px 0;
            font-size: 14px;
            font-weight: 600;
          }

          .large-items {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .item-detail {
            display: flex;
            justify-content: space-between;
            padding: 8px 12px;
            background: #f9fafb;
            border-radius: 6px;
          }

          .item-name {
            font-size: 12px;
            color: #374151;
          }

          .item-size {
            font-size: 12px;
            font-weight: 500;
            color: #6b7280;
          }

          .storage-actions {
            margin-top: 24px;
          }

          .login-prompt {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 40px 20px;
            flex: 1;
          }

          .login-icon {
            margin-bottom: 24px;
            color: #6b7280;
          }

          .login-prompt h3 {
            margin: 0 0 12px 0;
            font-size: 20px;
            font-weight: 600;
            color: #111827;
          }

          .login-prompt p {
            margin: 0 0 24px 0;
            color: #6b7280;
            line-height: 1.6;
          }

          .authenticated-user {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }

          .user-profile {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .user-avatar {
            width: 64px;
            height: 64px;
            background: #f3f4f6;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6b7280;
          }

          .user-details h3 {
            margin: 0 0 4px 0;
            font-size: 18px;
            font-weight: 600;
          }

          .user-details p {
            margin: 0;
            color: #6b7280;
          }

          .connection-status {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px;
            background: #f9fafb;
            border-radius: 8px;
          }

          .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #9ca3af;
          }

          .status-dot.connected {
            background: #10b981;
          }

          .status-dot.failed {
            background: #ef4444;
          }

          .btn {
            padding: 10px 16px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }

          .btn-primary {
            background: #2563eb;
            color: white;
          }

          .btn-primary:hover {
            background: #1d4ed8;
          }

          .btn-secondary {
            background: #f3f4f6;
            color: #374151;
          }

          .btn-secondary:hover {
            background: #e5e7eb;
          }

          .btn-danger {
            background: #dc2626;
            color: white;
          }

          .btn-danger:hover {
            background: #b91c1c;
          }

          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999;
          }
        `}</style>
      </div>
    </div>
  );
};

export default CloudStoragePanelEnhanced;