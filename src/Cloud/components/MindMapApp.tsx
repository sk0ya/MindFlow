import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMagicLink } from '../hooks/useMagicLink';
import { useMindMap } from '../hooks/useMindMap';
import { AuthModal } from './AuthModal';
import type { StorageMode } from '../types';
import MindMapCanvas from './MindMapCanvas';
import Toolbar from './Toolbar';
import { ErrorBoundary } from '../../shared/components';
import './MindMapApp.css';

interface Props {
  onModeChange: (mode: StorageMode) => void;
}

const CloudMindMapApp: React.FC<Props> = ({ onModeChange }) => {
  const { authState } = useAuth();
  const { isProcessing } = useMagicLink();
  const { 
    data, 
    selectedNodeId, 
    editingNodeId, 
    editText, 
    isLoading,
    error,
    setSelectedNodeId,
    setEditText,
    findNode,
    addChildNode,
    deleteNode,
    startEdit,
    finishEdit,
    updateTitle
  } = useMindMap();

  // 認証状態の変化をログ出力
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔐 認証状態変化 - MindMapApp:', {
        isAuthenticated: authState.isAuthenticated,
        hasUser: !!authState.user,
        isLoading: authState.isLoading,
        error: authState.error,
        userEmail: authState.user?.email
      });
    }
  }, [authState]);

  // データとローディング状態の変化をログ出力
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('📋 データ状態変化 - MindMapApp:', {
        hasData: !!data,
        dataTitle: data?.title,
        isLoading,
        error,
        isProcessing
      });
    }
  }, [data, isLoading, error, isProcessing]);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // ローカルモードと同等の操作性のためのダミー関数
  const dragNode = (nodeId: string, x: number, y: number) => {
    // クラウドモード用のドラッグ実装が必要
    console.log('Drag node:', nodeId, x, y);
  };

  const handleNodeSelect = (nodeId: string | null) => {
    setSelectedNodeId(nodeId || 'root');
  };

  const handleAddChild = React.useCallback((parentId: string, text: string = '', autoEdit: boolean = false) => {
    addChildNode(parentId, text, autoEdit);
  }, [addChildNode]);

  const handleAddSibling = React.useCallback((nodeId: string, text: string = '', autoEdit: boolean = false) => {
    // 兄弟ノードを追加する場合は、同じ親の下に追加
    const node = findNode(nodeId);
    if (!node || nodeId === 'root') return;
    
    // 親ノードを見つける
    const findParent = (searchNode: any, targetId: string): any => {
      if (!searchNode.children) return null;
      for (const child of searchNode.children) {
        if (child.id === targetId) return searchNode;
        const found = findParent(child, targetId);
        if (found) return found;
      }
      return null;
    };
    
    const parentNode = findParent(data?.rootNode, nodeId);
    if (parentNode) {
      addChildNode(parentNode.id, text, autoEdit);
    }
  }, [findNode, data?.rootNode, addChildNode]);

  // キーボードショートカット
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('⌨️ キー入力:', {
          key: e.key,
          selectedNodeId,
          hasSelectedNode: !!selectedNodeId,
          editingNodeId,
          isEditing: !!editingNodeId
        });
      }

      if (!selectedNodeId) return;

      // 編集中の場合の特殊処理
      if (editingNodeId) {
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          if (process.env.NODE_ENV === 'development') {
            console.log('🔄 編集完了 + 新規ノード追加');
          }
          finishEdit(editingNodeId, editText);
          setTimeout(() => {
            if (e.key === 'Tab') {
              if (process.env.NODE_ENV === 'development') {
                console.log('🔄 編集完了後 Tab: 子ノード追加');
              }
              handleAddChild(selectedNodeId, '', true);
            } else {
              if (process.env.NODE_ENV === 'development') {
                console.log('🔄 編集完了後 Enter: 兄弟ノード追加');
              }
              handleAddSibling(selectedNodeId, '', true);
            }
          }, 50);
        }
        return; // 編集中は他のキーを処理しない
      }

      // 編集中でない場合の通常処理
      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          if (process.env.NODE_ENV === 'development') {
            console.log('🔄 Tab: 子ノード追加 (autoEdit=true)');
          }
          handleAddChild(selectedNodeId, '', true);
          break;
        case 'Enter':
          e.preventDefault();
          if (process.env.NODE_ENV === 'development') {
            console.log('🔄 Enter: 兄弟ノード追加 (autoEdit=true)');
          }
          handleAddSibling(selectedNodeId, '', true);
          break;
        case ' ': // スペースキー
          e.preventDefault();
          if (process.env.NODE_ENV === 'development') {
            console.log('🔄 Space: 編集開始');
          }
          startEdit(selectedNodeId);
          break;
        case 'Delete':
          e.preventDefault();
          if (process.env.NODE_ENV === 'development') {
            console.log('🔄 Delete: ノード削除');
          }
          deleteNode(selectedNodeId);
          break;
        case 'Escape':
          e.preventDefault();
          if (process.env.NODE_ENV === 'development') {
            console.log('🔄 Escape: 選択解除');
          }
          setSelectedNodeId('root');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, editingNodeId, editText, handleAddChild, handleAddSibling, startEdit, deleteNode, finishEdit, setSelectedNodeId]);

  const handleRightClick = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    // 右クリックメニューの実装が必要
    console.log('Right click on node:', nodeId);
  };

  const toggleCollapse = (nodeId: string) => {
    // 折りたたみ機能の実装が必要
    console.log('Toggle collapse:', nodeId);
  };

  const navigateToDirection = (direction: string) => {
    // キーボードナビゲーションの実装が必要
    console.log('Navigate to direction:', direction);
  };

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

  return (
    <div className="mindmap-app">
      <ErrorBoundary>
        <Toolbar
          title={data?.title || 'クラウドマップ'}
          onTitleChange={updateTitle}
          onExport={() => console.log('Export not implemented')}
          onImport={() => console.log('Import not implemented')}
          onUndo={() => console.log('Undo not implemented')}
          onRedo={() => console.log('Redo not implemented')}
          canUndo={false}
          canRedo={false}
          zoom={zoom}
          onZoomReset={() => setZoom(1)}
          onShowLocalStoragePanel={() => console.log('Local storage panel not needed')}
          onToggleSidebar={() => console.log('Sidebar toggle not implemented')}
          showSidebar={true}
          authState={authState}
          onShowAuthModal={() => setShowAuthModal(true)}
          onLogout={() => console.log('Logout not implemented')}
          onShowShortcutHelper={() => console.log('Shortcut helper not implemented')}
        />

        <div className="app-content">
          {(() => {
            if (process.env.NODE_ENV === 'development') {
              console.log('🔍 レンダリング条件チェック:', {
                hasData: !!data,
                dataId: data?.id,
                dataTitle: data?.title,
                hasRootNode: !!data?.rootNode,
                rootNodeId: data?.rootNode?.id,
                condition: !!(data && data.rootNode)
              });
            }
            return data && data.rootNode;
          })() ? (
            <MindMapCanvas
              data={data}
              selectedNodeId={selectedNodeId}
              editingNodeId={editingNodeId}
              editText={editText}
              setEditText={setEditText}
              onSelectNode={handleNodeSelect}
              onStartEdit={startEdit}
              onFinishEdit={finishEdit}
              onDragNode={dragNode}
              onChangeParent={(nodeId, newParentId) => console.log('Change parent:', nodeId, newParentId)}
              onAddChild={handleAddChild}
              onAddSibling={handleAddSibling}
              onDeleteNode={deleteNode}
              onRightClick={handleRightClick}
              onToggleCollapse={toggleCollapse}
              onNavigateToDirection={navigateToDirection}
              onFileUpload={(nodeId, file) => console.log('File upload:', nodeId, file)}
              onRemoveFile={(nodeId, fileId) => console.log('Remove file:', nodeId, fileId)}
              onShowImageModal={(file) => console.log('Show image modal:', file)}
              onShowFileActionMenu={(file, position) => console.log('Show file action menu:', file, position)}
              onShowNodeMapLinks={(node, position) => console.log('Show node map links:', node, position)}
              zoom={zoom}
              setZoom={setZoom}
              pan={pan}
              setPan={setPan}
            />
          ) : (
            <div className="loading-message">
              <p>マップデータを読み込み中...</p>
            </div>
          )}
          
          <div className="mode-switch-container">
            <button
              onClick={() => onModeChange('local')}
              className="mode-switch-button"
            >
              ローカルモードに切り替え
            </button>
          </div>
        </div>
      </ErrorBoundary>

      <AuthModal 
        isVisible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
};

export default CloudMindMapApp;