import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMagicLink } from '../hooks/useMagicLink';
import { useMindMap } from '../hooks/useMindMap';
import { AuthModal } from './AuthModal';
import type { StorageMode } from '../types';
import './MindMapApp.css';

interface Props {
  onModeChange: (mode: StorageMode) => void;
}

const CloudMindMapApp: React.FC<Props> = ({ onModeChange }) => {
  const { authState } = useAuth();
  const { isProcessing } = useMagicLink();

  // 認証状態の変化をログ出力
  React.useEffect(() => {
    console.log('🔐 認証状態変化 - MindMapApp:', {
      isAuthenticated: authState.isAuthenticated,
      hasUser: !!authState.user,
      isLoading: authState.isLoading,
      error: authState.error,
      userEmail: authState.user?.email
    });
  }, [authState]);

  // データとローディング状態の変化をログ出力
  React.useEffect(() => {
    console.log('📋 データ状態変化 - MindMapApp:', {
      hasData: !!data,
      dataTitle: data?.title,
      isLoading,
      error,
      isProcessing
    });
  }, [data, isLoading, error, isProcessing]);
  const { 
    data, 
    selectedNodeId, 
    editingNodeId, 
    editText, 
    isLoading,
    error,
    setSelectedNodeId,
    setEditingNodeId,
    setEditText,
    findNode,
    updateNode,
    addChildNode,
    deleteNode,
    startEdit,
    finishEdit,
    updateTitle
  } = useMindMap();

  const [showAuthModal, setShowAuthModal] = useState(false);

  // Magic Link処理中の表示
  if (isProcessing) {
    return (
      <div className="mindmap-app loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>認証中...</h2>
          <p>Magic Linkを処理しています</p>
        </div>
      </div>
    );
  }

  // 未認証の場合は認証モーダルを表示
  // ただし、認証状態の更新中（isLoading中）は待機
  if (!authState.isAuthenticated && !authState.isLoading) {
    return (
      <div className="mindmap-app">
        <div className="auth-container">
          <div className="auth-header">
            <h1>MindFlow - クラウドモード</h1>
            <p>クラウド同期機能をお使いいただくには、ログインが必要です。</p>
            <button 
              className="auth-button primary"
              onClick={() => setShowAuthModal(true)}
            >
              ログイン
            </button>
            <button 
              className="auth-button secondary"
              onClick={() => onModeChange('local')}
            >
              ローカルモードに戻る
            </button>
          </div>
        </div>

        <AuthModal 
          isVisible={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </div>
    );
  }

  // 認証状態が更新中の場合は待機画面を表示
  if (authState.isLoading) {
    return (
      <div className="mindmap-app loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>認証確認中...</h2>
          <p>認証状態を確認しています</p>
        </div>
      </div>
    );
  }

  // データロード中
  if (isLoading || !data) {
    return (
      <div className="mindmap-app loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>MindFlow</h2>
          <p>クラウドデータを読み込み中...</p>
        </div>
      </div>
    );
  }

  // エラー表示
  if (error) {
    return (
      <div className="mindmap-app error-screen">
        <div className="error-content">
          <h2>エラーが発生しました</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  // キーボードイベント処理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingNodeId) {
      if (e.key === 'Enter') {
        finishEdit();
      } else if (e.key === 'Escape') {
        setEditingNodeId(null);
        setEditText('');
      }
      return;
    }

    if (selectedNodeId) {
      if (e.key === 'Tab') {
        e.preventDefault();
        addChildNode(selectedNodeId);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteNode(selectedNodeId);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        startEdit(selectedNodeId);
      }
    }
  };

  // ノードレンダリング
  const renderNode = (node: any): React.ReactElement => (
    <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
      <rect
        x={-50}
        y={-20}
        width={100}
        height={40}
        rx={8}
        fill={selectedNodeId === node.id ? '#e3f2fd' : '#ffffff'}
        stroke={selectedNodeId === node.id ? '#2196f3' : '#cccccc'}
        strokeWidth={selectedNodeId === node.id ? 2 : 1}
        style={{ cursor: 'pointer' }}
        onClick={() => setSelectedNodeId(node.id)}
        onDoubleClick={() => startEdit(node.id)}
      />
      {editingNodeId === node.id ? (
        <foreignObject x={-45} y={-15} width={90} height={30}>
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={finishEdit}
            onKeyDown={(e) => {
              e.stopPropagation();
              handleKeyDown(e);
            }}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              textAlign: 'center',
              fontSize: '14px'
            }}
            autoFocus
          />
        </foreignObject>
      ) : (
        <text
          x={0}
          y={5}
          textAnchor="middle"
          fontSize="14"
          fill="#333"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setSelectedNodeId(node.id)}
          onDoubleClick={() => startEdit(node.id)}
        >
          {node.text}
        </text>
      )}
      {node.children?.map((child: any) => (
        <line
          key={`line-${child.id}`}
          x1={0}
          y1={0}
          x2={child.x - node.x}
          y2={child.y - node.y}
          stroke="#999"
          strokeWidth="2"
        />
      ))}
      {node.children?.map(renderNode)}
    </g>
  );

  return (
    <div className="mindmap-app">
      <header className="app-header">
        <div className="header-left">
          <h1>MindFlow - クラウド</h1>
          <input
            type="text"
            value={data.title}
            onChange={(e) => updateTitle(e.target.value)}
            className="title-input"
            placeholder="マップタイトル"
          />
        </div>
        <div className="header-right">
          <span className="user-info">
            👤 {authState.user?.email}
          </span>
          <button
            onClick={() => onModeChange('local')}
            className="mode-switch-button"
          >
            ローカルモード
          </button>
        </div>
      </header>

      <main className="app-main">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 800 600"
          style={{ outline: 'none' }}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedNodeId('root');
            }
          }}
        >
          {data.rootNode && renderNode(data.rootNode)}
        </svg>
      </main>

      <footer className="app-footer">
        <div className="footer-left">
          <span>クラウド同期: 自動保存中</span>
        </div>
        <div className="footer-right">
          <span>最終更新: {new Date(data.updatedAt).toLocaleString('ja-JP')}</span>
        </div>
      </footer>
    </div>
  );
};

export default CloudMindMapApp;