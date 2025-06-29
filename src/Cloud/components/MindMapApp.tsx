import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMagicLink } from '../hooks/useMagicLink';
import { useMindMap } from '../hooks/useMindMap';
import AuthModal from './AuthModal';
import MindMapCanvas from './MindMapCanvas';
import './MindMapApp.css';

export default function MindMapApp() {
  const { isAuthenticated, user, logout, isLoading: authLoading } = useAuth();
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
    updateTitle
  } = useMindMap();

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
      </main>

      {/* フッター */}
      <footer className="app-footer">
        <div className="footer-info">
          <span>最終更新: {new Date(data.updatedAt).toLocaleString('ja-JP')}</span>
        </div>
        
        <div className="footer-controls">
          <span>Tab: 子ノード追加 | Space: 編集 | Delete: 削除</span>
        </div>
      </footer>
    </div>
  );
}