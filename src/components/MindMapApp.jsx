import React, { useState, useEffect } from 'react';
import { useMindMap } from '../hooks/useMindMap';
import Toolbar from './Toolbar';
import MindMapCanvas from './MindMapCanvas';
import NodeCustomizationPanel from './NodeCustomizationPanel';
import ContextMenu from './ContextMenu';
import ErrorBoundary from './ErrorBoundary';
import ImageModal from './ImageModal';
import FileActionMenu from './FileActionMenu';
import MindMapSidebar from './MindMapSidebar';
import SimpleMindMapSidebar from './SimpleMindMapSidebar';
import NodeMapLinksPanel from './MapLinksPanel';
import CloudStoragePanelEnhanced from './CloudStoragePanelEnhanced';
import SyncStatusIndicator from './SyncStatusIndicator';
import UserPresence from './UserPresence';
import UserCursors from './UserCursors';
import ConnectionStatus from './ConnectionStatus';
import ConflictNotification from './ConflictNotification';
import CollaborativeFeatures from './CollaborativeFeatures';
import PerformanceDashboard from './PerformanceDashboard';
import { exportMindMapAsJSON, importMindMapFromJSON, isFirstTimeSetup, setStorageMode } from '../utils/storageRouter';
import { getAppSettings } from '../utils/storage';
import { hasLocalData } from '../utils/localStorage';
import './MindMapApp.css';

import AuthVerification from './AuthVerification.jsx';
import AuthModal from './AuthModal.jsx';
import { authManager } from '../utils/authManager.js';
import TutorialOverlay from './TutorialOverlay.jsx';
import KeyboardShortcutHelper from './KeyboardShortcutHelper.jsx';
import StorageModeSelector from './StorageModeSelector.jsx';
import { useOnboarding } from '../hooks/useOnboarding.js';
import { useAppInitialization } from '../hooks/useAppInitialization.js';

const MindMapApp = () => {
  // 🚨 PHASE 1: すべてのフックを最初に呼び出し（React Hook順序を固定）
  
  // URL パラメータで認証トークンをチェック
  const urlParams = new URLSearchParams(window.location.search);
  const authToken = urlParams.get('token');
  const isAuthVerification = authToken && authToken.length > 20;
  
  // 認証状態を管理
  const [authState, setAuthState] = useState({
    isAuthenticated: authManager.isAuthenticated(),
    user: authManager.getCurrentUser(),
    isLoading: false
  });
  
  // 認証モーダル状態
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // アプリ初期化状態とストレージモード選択フック
  const initializationState = useAppInitialization();
  const {
    isInitializing,
    showStorageModeSelector,
    showAuthModal: showInitAuthModal,
    showOnboarding: showInitOnboarding,
    storageMode,
    isReady,
    handleStorageModeSelect,
    handleAuthSuccess: handleInitAuthSuccess,
    handleAuthClose,
    handleOnboardingComplete
  } = initializationState;

  // ローカルオンボーディング状態
  const { showOnboarding: showLocalOnboarding, completeOnboarding, setShowOnboarding } = useOnboarding();
  
  // 実際のオンボーディング表示判定
  const showOnboarding = showInitOnboarding || showLocalOnboarding;
  
  // UI状態管理
  const [contextMenu, setContextMenu] = useState(null);
  const [nodeCustomization, setNodeCustomization] = useState({ isOpen: false, nodeId: null });
  const [imageModal, setImageModal] = useState(null);
  const [fileActionMenu, setFileActionMenu] = useState(null);
  const [mapLinksPanel, setMapLinksPanel] = useState({ isOpen: false, node: null, position: null });
  const [showSidebar, setShowSidebar] = useState(true); // デフォルトで表示
  const [showCloudPanel, setShowCloudPanel] = useState(false);
  const [currentTool, setCurrentTool] = useState('select');
  const [showPerformanceDash, setShowPerformanceDash] = useState(false);
  const [showShortcutHelper, setShowShortcutHelper] = useState(false);

  // ストレージモード取得
  const appSettings = getAppSettings();
  const isLocalMode = appSettings.storageMode === 'local';
  const isCloudMode = appSettings.storageMode === 'cloud';

  // 🚨 重要: メインのマインドマップフック（常に呼び出し）
  const mindMap = useMindMap(isReady);

  // 認証状態変更の監視（クラウドモード専用）
  useEffect(() => {
    if (!isCloudMode) return;

    const handleAuthChange = () => {
      setAuthState({
        isAuthenticated: authManager.isAuthenticated(),
        user: authManager.getCurrentUser(),
        isLoading: false
      });
    };

    // 認証成功時のクラウド同期
    if (authState.isAuthenticated && mindMap.triggerCloudSync) {
      mindMap.triggerCloudSync();
    }

    window.addEventListener('authStateChange', handleAuthChange);
    return () => window.removeEventListener('authStateChange', handleAuthChange);
  }, [isCloudMode, authState.isAuthenticated, mindMap.triggerCloudSync]);

  // デバッグ情報（初回のみ）
  useEffect(() => {
    console.log('🔍 MindMapApp Debug:', {
      isReady,
      hasData: !!mindMap.data,
      dataTitle: mindMap.data?.title,
      isPlaceholder: mindMap.data?.isPlaceholder
    });
  }, [isReady, mindMap.data?.id]); // データIDが変わった時のみログ

  // データ読み込みタイムアウト処理
  useEffect(() => {
    if (!mindMap.data || mindMap.data.isPlaceholder) {
      const timeoutId = setTimeout(() => {
        if (!mindMap.data) {
          console.warn('⚠️ 5秒経過: ダミーデータで強制表示');
          // 緊急時はページリロード
          window.location.reload();
        }
      }, 5000);

      return () => clearTimeout(timeoutId);
    }
  }, [mindMap.data]);

  // 🚨 PHASE 2: 条件分岐によるレンダリング（フック呼び出し後）

  // 認証トークン検証時は専用コンポーネントを表示
  if (isAuthVerification) {
    return <AuthVerification token={authToken} />;
  }

  // 初期化中は読み込み画面を表示
  if (isInitializing) {
    return (
      <div className="mindmap-app">
        <div className="loading-screen">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <h2>アプリケーションを初期化中...</h2>
            <p>設定を読み込んでいます</p>
          </div>
        </div>
      </div>
    );
  }

  // ストレージモード選択画面
  if (showStorageModeSelector) {
    return (
      <div className="mindmap-app">
        <StorageModeSelector onModeSelect={handleStorageModeSelect} />
      </div>
    );
  }

  // 初期化段階での認証モーダル
  if (showInitAuthModal) {
    return (
      <div className="mindmap-app">
        <AuthModal
          isOpen={true}
          onClose={handleAuthClose}
          onAuthSuccess={handleInitAuthSuccess}
        />
      </div>
    );
  }

  // オンボーディング表示
  if (showOnboarding) {
    return (
      <div className="mindmap-app">
        <TutorialOverlay
          isVisible={true}
          onComplete={() => {
            if (showInitOnboarding) {
              handleOnboardingComplete();
            } else {
              completeOnboarding();
            }
          }}
          onSkip={() => {
            if (showInitOnboarding) {
              handleOnboardingComplete();
            } else {
              setShowOnboarding(false);
            }
          }}
        />
      </div>
    );
  }

  // データが読み込まれていない場合は読み込み画面
  if (!mindMap.data || mindMap.data.isPlaceholder) {
    
    return (
      <div className="mindmap-app">
        <div className="loading-screen">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <h2>データを読み込み中...</h2>
            <p>マインドマップデータを準備しています</p>
            <button 
              onClick={() => window.location.reload()}
              style={{ marginTop: '20px', padding: '10px 20px' }}
            >
              リロードして再試行
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 🚨 PHASE 3: イベントハンドラー定義

  const handleNodeSelect = (nodeId) => {
    mindMap.setSelectedNodeId(nodeId);
    setContextMenu(null);
  };

  const handleNodeEdit = (nodeId, text) => {
    mindMap.startEdit(nodeId);
  };

  const handleNodeUpdate = async (nodeId, text) => {
    await mindMap.updateNode(nodeId, { text });
    // finishEditは既にupdateNodeで処理されているため不要
  };

  const handleAddChild = async (parentId) => {
    await mindMap.addChildNode(parentId, '', true);
  };

  const handleAddSibling = async (nodeId) => {
    await mindMap.addSiblingNode(nodeId, '', true);
  };

  const handleDeleteNode = async (nodeId) => {
    await mindMap.deleteNode(nodeId);
  };

  const handleNodeDrag = async (nodeId, x, y) => {
    await mindMap.dragNode(nodeId, x, y);
  };

  const handleFileUpload = async (nodeId, files) => {
    try {
      for (const file of files) {
        await mindMap.attachFileToNode(nodeId, file);
      }
    } catch (error) {
      console.error('ファイルアップロードエラー:', error);
      alert(`ファイルアップロードエラー: ${error.message}`);
    }
  };

  const handleFileRemove = async (nodeId, fileId) => {
    try {
      await mindMap.removeFileFromNode(nodeId, fileId);
    } catch (error) {
      console.error('ファイル削除エラー:', error);
      alert(`ファイル削除エラー: ${error.message}`);
    }
  };

  const handleFileDownload = async (file, nodeId) => {
    try {
      await mindMap.downloadFile(file, nodeId);
    } catch (error) {
      console.error('ファイルダウンロードエラー:', error);
      alert(`ファイルダウンロードエラー: ${error.message}`);
    }
  };

  const handleRightClick = (e, nodeId) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      nodeId: nodeId
    });
  };

  const handleContextMenuAction = async (action, nodeId) => {
    setContextMenu(null);
    
    switch (action) {
      case 'addChild':
        await handleAddChild(nodeId);
        break;
      case 'addSibling':
        await handleAddSibling(nodeId);
        break;
      case 'delete':
        await handleDeleteNode(nodeId);
        break;
      case 'edit':
        mindMap.startEdit(nodeId);
        break;
      case 'customize':
        setNodeCustomization({ isOpen: true, nodeId });
        break;
    }
  };

  const handleAuthSuccess = (user) => {
    setAuthState({ isAuthenticated: true, user, isLoading: false });
    setShowAuthModal(false);
    window.dispatchEvent(new CustomEvent('authStateChange'));
  };

  // 🚨 PHASE 4: メインアプリレンダリング

  return (
    <ErrorBoundary>
      <div className="mindmap-app">
        {/* ヘッダー部分 */}
        <div className="mindmap-header">
          <Toolbar
            title={mindMap.data?.title || '無題'}
            onTitleChange={mindMap.updateTitle}
            onUndo={mindMap.undo}
            onRedo={mindMap.redo}
            canUndo={mindMap.canUndo}
            canRedo={mindMap.canRedo}
            onExport={() => exportMindMapAsJSON(mindMap.data)}
            onImport={importMindMapFromJSON}
            zoom={mindMap.zoom || 1}
            onZoomReset={mindMap.resetView}
            onShowCloudStoragePanel={isCloudMode ? () => setShowCloudPanel(true) : undefined}
            authState={isCloudMode ? authState : undefined}
            onShowAuthModal={isCloudMode ? () => setShowAuthModal(true) : undefined}
            onLogout={isCloudMode ? () => {
              authManager.logout();
              setAuthState({ isAuthenticated: false, user: null, isLoading: false });
              window.dispatchEvent(new CustomEvent('authStateChange'));
            } : undefined}
            isLocalMode={isLocalMode}
            onShowShortcutHelper={() => setShowShortcutHelper(true)}
            onToggleSidebar={() => setShowSidebar(!showSidebar)}
            showSidebar={showSidebar}
          />
          
          {/* ローカルモード表示 */}
          {isLocalMode && (
            <div className="local-mode-status">
              <span className="mode-indicator">📁 ローカルモード</span>
            </div>
          )}

          {/* クラウドモード専用コンポーネント */}
          {isCloudMode && (
            <>
              <SyncStatusIndicator 
                syncStatus={{}} // 簡略化: sync状態は後で修正
                onForceSync={mindMap.saveMindMap}
              />
              
              <div className="connection-info">
                <ConnectionStatus />
                {/* 一時的に無効化: UserPresence */}
              </div>
            </>
          )}
        </div>

        {/* メインコンテンツ（サイドバーと並行表示） */}
        <div className="main-layout">
          {/* サイドバー（モード別） */}
          {showSidebar && (
            <div className="sidebar-container">
              {isLocalMode ? (
                <SimpleMindMapSidebar
                  mindMaps={mindMap.allMindMaps || []}
                  currentMapId={mindMap.currentMapId}
                  onCreateMap={mindMap.createMindMap}
                  onRenameMap={mindMap.renameMindMap}
                  onDeleteMap={mindMap.deleteMindMapById}
                  onSelectMap={(mapId) => mindMap.switchToMap(mapId, false)}
                  onToggleCollapse={() => setShowSidebar(!showSidebar)}
                />
              ) : (
                <MindMapSidebar
                  mindMaps={mindMap.allMindMaps || []}
                  currentMapId={mindMap.currentMapId}
                  onCreateMap={mindMap.createMindMap}
                  onRenameMap={mindMap.renameMindMap}
                  onDeleteMap={mindMap.deleteMindMapById}
                  onSelectMap={(mapId) => mindMap.switchToMap(mapId, false)}
                  onChangeCategory={mindMap.changeMapCategory}
                  availableCategories={mindMap.getAvailableCategories() || []}
                  isCollapsed={false}
                  onToggleCollapse={() => setShowSidebar(!showSidebar)}
                />
              )}
            </div>
          )}

          {/* メインコンテンツエリア */}
          <div className={`mindmap-content ${showSidebar ? 'with-sidebar' : ''}`}>
            <MindMapCanvas
              data={mindMap.data}
              selectedNodeId={mindMap.selectedNodeId}
              editingNodeId={mindMap.editingNodeId}
              editText={mindMap.editText}
              setEditText={mindMap.setEditText}
              onSelectNode={handleNodeSelect}
              onStartEdit={handleNodeEdit}
              onFinishEdit={handleNodeUpdate}
              onDragNode={handleNodeDrag}
              onChangeParent={mindMap.changeParent}
              onAddChild={handleAddChild}
              onAddSibling={handleAddSibling}
              onDeleteNode={handleDeleteNode}
              onRightClick={handleRightClick}
              onToggleCollapse={mindMap.toggleCollapse}
              onNavigateToDirection={mindMap.navigateToDirection}
              onFileUpload={handleFileUpload}
              onRemoveFile={handleFileRemove}
              onShowImageModal={setImageModal}
              onShowFileActionMenu={setFileActionMenu}
              onShowNodeMapLinks={setMapLinksPanel}
              zoom={mindMap.zoom || 1}
              setZoom={mindMap.setZoom}
              pan={mindMap.pan || { x: 0, y: 0 }}
              setPan={mindMap.setPan}
            />

            {/* 一時的に無効化: UserCursors */}
          </div>
        </div>

        {/* クラウドストレージパネル（クラウドモード専用） */}
        {isCloudMode && showCloudPanel && (
          <CloudStoragePanelEnhanced
            isOpen={showCloudPanel}
            onClose={() => setShowCloudPanel(false)}
            authState={authState}
            setAuthState={setAuthState}
            onShowAuthModal={() => setShowAuthModal(true)}
          />
        )}

        {/* モーダルとメニュー */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onAction={(action) => handleContextMenuAction(action, contextMenu.nodeId)}
            onClose={() => setContextMenu(null)}
            nodeId={contextMenu.nodeId}
            isRoot={contextMenu.nodeId === 'root'}
          />
        )}

        {nodeCustomization.isOpen && (
          <NodeCustomizationPanel
            nodeId={nodeCustomization.nodeId}
            node={mindMap.findNode(nodeCustomization.nodeId)}
            onUpdate={(updates) => mindMap.updateNode(nodeCustomization.nodeId, updates)}
            onClose={() => setNodeCustomization({ isOpen: false, nodeId: null })}
          />
        )}

        {imageModal && (
          <ImageModal
            file={imageModal}
            onClose={() => setImageModal(null)}
          />
        )}

        {fileActionMenu && (
          <FileActionMenu
            file={fileActionMenu.file}
            nodeId={fileActionMenu.nodeId}
            position={fileActionMenu.position}
            onDownload={() => handleFileDownload(fileActionMenu.file, fileActionMenu.nodeId)}
            onRemove={() => handleFileRemove(fileActionMenu.nodeId, fileActionMenu.file.id)}
            onRename={(newName) => mindMap.renameFileInNode(fileActionMenu.nodeId, fileActionMenu.file.id, newName)}
            onClose={() => setFileActionMenu(null)}
          />
        )}

        {mapLinksPanel.isOpen && (
          <NodeMapLinksPanel
            node={mapLinksPanel.node}
            position={mapLinksPanel.position}
            allMindMaps={mindMap.allMindMaps}
            onAddLink={(targetMapId) => {
              console.log('🔗 マップリンク追加:', { nodeId: mapLinksPanel.node.id, targetMapId });
            }}
            onRemoveLink={(linkId) => {
              console.log('🔗 マップリンク削除:', { nodeId: mapLinksPanel.node.id, linkId });
            }}
            onNavigateToMap={(mapId) => mindMap.switchToMap(mapId)}
            onClose={() => setMapLinksPanel({ isOpen: false, node: null, position: null })}
          />
        )}

        {/* 認証モーダル（クラウドモード専用） */}
        {isCloudMode && showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onAuthSuccess={handleAuthSuccess}
          />
        )}

        {showShortcutHelper && (
          <KeyboardShortcutHelper
            onClose={() => setShowShortcutHelper(false)}
          />
        )}

        {showPerformanceDash && (
          <PerformanceDashboard
            onClose={() => setShowPerformanceDash(false)}
            syncStatus={{}} // 簡略化
          />
        )}

        {/* コラボレーション機能（クラウドモード専用） */}
        {isCloudMode && (
          <>
            <CollaborativeFeatures />
            <ConflictNotification />
          </>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default MindMapApp;