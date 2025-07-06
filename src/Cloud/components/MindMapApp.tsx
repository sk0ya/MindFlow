import React, { useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMagicLink } from '../hooks/useMagicLink';
import { useMindMap } from '../hooks/useMindMap';
import { useOfflineSync, OfflineIndicator } from '../hooks/useOfflineSync';
import { AuthModal } from './AuthModal';
import type { StorageMode, MindMapNode } from '../types';
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
  const { offlineState } = useOfflineSync();
  const { 
    data, 
    allMaps,
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
    updateTitle,
    updateNode,
    switchToMap,
    createNewMap
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
        hasRootNode: !!(data?.rootNode),
        selectedNodeId,
        isLoading,
        error,
        isProcessing
      });
    }
  }, [data, isLoading, error, isProcessing, selectedNodeId]);

  // 選択ノード変化のログ
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🎯 選択ノード変化:', {
        selectedNodeId,
        hasSelectedNode: !!selectedNodeId,
        isRoot: selectedNodeId === 'root'
      });
    }
  }, [selectedNodeId]);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showMapList, setShowMapList] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // クラウドモード用のドラッグ実装
  const dragNode = useCallback((nodeId: string, x: number, y: number) => {
    updateNode(nodeId, { x, y });
  }, [updateNode]);

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
    const findParent = (searchNode: MindMapNode, targetId: string): MindMapNode | null => {
      if (!searchNode.children) return null;
      for (const child of searchNode.children) {
        if (child.id === targetId) return searchNode;
        const found = findParent(child, targetId);
        if (found) return found;
      }
      return null;
    };
    
    const parentNode = data?.rootNode ? findParent(data.rootNode, nodeId) : null;
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
          finishEdit(editingNodeId, editText, { userInitiated: true });
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

  const toggleCollapse = useCallback((nodeId: string) => {
    const node = findNode(nodeId);
    if (node) {
      updateNode(nodeId, { collapsed: !node.collapsed });
    }
  }, [findNode, updateNode]);

  const navigateToDirection = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!data || !selectedNodeId) return;
    
    const allNodes = flattenNodes(data.rootNode);
    const currentIndex = allNodes.findIndex(node => node.id === selectedNodeId);
    
    if (currentIndex === -1) return;
    
    let newIndex = currentIndex;
    switch (direction) {
      case 'up':
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case 'down':
        newIndex = Math.min(allNodes.length - 1, currentIndex + 1);
        break;
      case 'left':
        // 親ノードに移動
        const currentNode = allNodes[currentIndex];
        const parentNode = findParentNode(data.rootNode, currentNode.id);
        if (parentNode) {
          setSelectedNodeId(parentNode.id);
          return;
        }
        break;
      case 'right':
        // 最初の子ノードに移動
        const firstChild = allNodes[currentIndex].children?.[0];
        if (firstChild) {
          setSelectedNodeId(firstChild.id);
          return;
        }
        break;
    }
    
    if (newIndex !== currentIndex) {
      setSelectedNodeId(allNodes[newIndex].id);
    }
  }, [data, selectedNodeId, setSelectedNodeId]);

  const flattenNodes = (node: MindMapNode): MindMapNode[] => {
    const result = [node];
    if (node.children) {
      node.children.forEach((child: MindMapNode) => result.push(...flattenNodes(child)));
    }
    return result;
  };

  const findParentNode = (root: MindMapNode, targetId: string): MindMapNode | null => {
    if (root.children) {
      for (const child of root.children) {
        if (child.id === targetId) return root;
        const found = findParentNode(child, targetId);
        if (found) return found;
      }
    }
    return null;
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
        {/* オフライン状態インジケーター */}
        <OfflineIndicator 
          isOnline={offlineState.isOnline}
          hasUnsyncedData={offlineState.hasUnsyncedData}
          syncRetryCount={offlineState.syncRetryCount}
        />
        
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
          onShowCloudStoragePanel={() => console.log('Cloud storage panel not needed')}
          onToggleSidebar={() => console.log('Sidebar toggle not implemented')}
          showSidebar={true}
          authState={authState}
          onShowAuthModal={() => setShowAuthModal(true)}
          onLogout={() => console.log('Logout not implemented')}
          onShowShortcutHelper={() => console.log('Shortcut helper not implemented')}
          onShowMapList={() => setShowMapList(true)}
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
              onAddChild={(parentId) => handleAddChild(parentId, '', true)}
              onAddSibling={(nodeId) => handleAddSibling(nodeId, '', true)}
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

      {/* マップ一覧モーダル */}
      {showMapList && (
        <div className="modal-overlay" onClick={() => setShowMapList(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>マップ一覧</h3>
              <button 
                className="modal-close-btn"
                onClick={() => setShowMapList(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="map-list">
                {allMaps.length === 0 ? (
                  <p className="no-maps">マップがありません</p>
                ) : (
                  allMaps.map((map) => (
                    <div 
                      key={map.id} 
                      className={`map-item ${data?.id === map.id ? 'active' : ''}`}
                      onClick={() => {
                        switchToMap(map.id);
                        setShowMapList(false);
                      }}
                    >
                      <div className="map-title">{map.title}</div>
                      <div className="map-meta">
                        更新: {new Date(map.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="modal-actions">
                <button 
                  className="btn btn-primary"
                  onClick={async () => {
                    const newMap = await createNewMap();
                    if (newMap) {
                      setShowMapList(false);
                    }
                  }}
                >
                  新規マップ作成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
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
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          max-height: 80vh;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e9ecef;
        }

        .modal-header h3 {
          margin: 0;
          color: #333;
        }

        .modal-close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-close-btn:hover {
          color: #333;
        }

        .modal-body {
          padding: 20px;
          max-height: 60vh;
          overflow-y: auto;
        }

        .map-list {
          margin-bottom: 20px;
        }

        .map-item {
          padding: 12px;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .map-item:hover {
          background: #f8f9fa;
          border-color: #667eea;
        }

        .map-item.active {
          background: #e3f2fd;
          border-color: #667eea;
        }

        .map-title {
          font-weight: 500;
          color: #333;
          margin-bottom: 4px;
        }

        .map-meta {
          font-size: 12px;
          color: #666;
        }

        .no-maps {
          text-align: center;
          color: #666;
          padding: 40px 20px;
        }

        .modal-actions {
          border-top: 1px solid #e9ecef;
          padding-top: 20px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }
      `}</style>
    </div>
  );
};

export default CloudMindMapApp;