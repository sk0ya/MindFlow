import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMagicLink } from '../hooks/useMagicLink';
import { useMindMap } from '../hooks/useMindMap';
import AuthModal from './AuthModal';
import MindMapCanvas from './MindMapCanvas';
import './MindMapApp.css';

export default function MindMapApp() {
  const { isAuthenticated, user, logout, isLoading: authLoading, emailSent, clearEmailSent } = useAuth();
  const { isVerifying, verificationError, clearError } = useMagicLink();
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  const {
    data,
    selectedNodeId,
    editingNodeId,
    editText,
    setSelectedNodeId,
    setEditText,
    addChildNode,
    deleteNode,
    startEdit,
    finishEdit,
    updateTitle,
    cloudData,
    isDataLoading
  } = useMindMap(isAuthenticated);

  // Magic Link検証中
  if (isVerifying) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>認証処理中...</h2>
          <p>Magic Linkを検証しています...</p>
        </div>
      </div>
    );
  }

  // Magic Link検証エラー
  if (verificationError) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <h2>認証エラー</h2>
          <p>{verificationError}</p>
          <button onClick={clearError} className="retry-button">
            トップページに戻る
          </button>
        </div>
      </div>
    );
  }

  // 認証ローディング中
  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>MindFlow</h2>
          <p>アプリケーションを初期化中...</p>
        </div>
      </div>
    );
  }

  // データローディング中（ログイン後）
  if (isAuthenticated && isDataLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>データを同期中...</h2>
          <p>クラウドからマインドマップデータを読み込んでいます</p>
        </div>
      </div>
    );
  }

  // メール送信完了画面
  if (emailSent && !isAuthenticated) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <h2>✉️ メールを送信しました</h2>
          <p>入力されたメールアドレスに安全なログインリンクを送信しました。</p>
          <p>メール内のリンクをクリックしてログインしてください。</p>
          <button 
            onClick={() => {
              clearEmailSent();
              setShowAuthModal(true);
            }}
            className="back-button"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  // 未認証の場合
  if (!isAuthenticated) {
    return (
      <>
        <div className="loading-screen">
          <div className="loading-content">
            <h2>MindFlow</h2>
            <p>クラウドモードでのご利用には認証が必要です</p>
            <button 
              onClick={() => setShowAuthModal(true)}
              className="login-button"
            >
              ログイン
            </button>
          </div>
        </div>
        
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  const handleAddChild = (parentId: string) => {
    const newNodeId = addChildNode(parentId);
    setSelectedNodeId(newNodeId);
  };

  return (
    <div className="mindmap-app">
      {/* ヘッダー */}
      <header className="app-header">
        <div className="header-left">
          <h1>MindFlow</h1>
          <input
            type="text"
            value={data.title}
            onChange={(e) => updateTitle(e.target.value)}
            className="title-input"
          />
        </div>
        
        <div className="header-right">
          <span>こんにちは、{user?.email}</span>
          <button onClick={logout} className="logout-button">
            ログアウト
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="app-main">
        {cloudData.error && (
          <div className="error-banner">
            <span>⚠️ {cloudData.error}</span>
            <button onClick={cloudData.syncData} className="retry-button">
              再試行
            </button>
          </div>
        )}
        
        {data ? (
          <MindMapCanvas
            data={data}
            selectedNodeId={selectedNodeId}
            editingNodeId={editingNodeId}
            editText={editText}
            onSelectNode={setSelectedNodeId}
            onStartEdit={startEdit}
            onFinishEdit={finishEdit}
            onTextChange={setEditText}
            onAddChild={handleAddChild}
            onDeleteNode={deleteNode}
          />
        ) : (
          <div className="no-data-screen">
            <div className="no-data-content">
              <h3>マインドマップがありません</h3>
              <p>新しいマインドマップを作成してください</p>
              <button 
                onClick={() => cloudData.createNewMap('新しいマインドマップ')}
                className="create-map-button"
              >
                マップを作成
              </button>
            </div>
          </div>
        )}
      </main>

      {/* フッター */}
      <footer className="app-footer">
        <div className="footer-info">
          <span>最終更新: {data ? new Date(data.updatedAt).toLocaleString('ja-JP') : '-'}</span>
          <span>マップ数: {cloudData.maps.length}</span>
        </div>
        
        <div className="footer-controls">
          <span>Tab: 子ノード追加 | Space: 編集 | Delete: 削除</span>
        </div>
      </footer>
    </div>
  );
}