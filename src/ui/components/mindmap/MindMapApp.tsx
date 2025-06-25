import React, { useEffect } from 'react';
import { useMindMap } from '../../../core/hooks/useMindMap';
import Toolbar from '../common/Toolbar';
import MindMapCanvas from './MindMapCanvas';
import NodeCustomizationPanel from './NodeCustomizationPanel';
import ContextMenu from '../common/ContextMenu';
import ErrorBoundary from '../errors/ErrorBoundary';
import ImageModal from '../files/ImageModal';
import FileActionMenu from '../files/FileActionMenu';
import MindMapSidebar from './MindMapSidebar';
import NodeMapLinksPanel from '../../panels/MapLinksPanel';
import CloudStoragePanelEnhanced from '../storage/CloudStoragePanelEnhanced';
import SyncStatusIndicator from '../storage/SyncStatusIndicator';
import UserPresence from '../common/UserPresence';
import UserCursors from '../common/UserCursors';
import ConnectionStatus from '../common/ConnectionStatus';
import ConflictNotification from '../common/ConflictNotification';
import CollaborativeFeatures from '../common/CollaborativeFeatures';
import PerformanceDashboard from '../common/PerformanceDashboard';
import { exportMindMapAsJSON, importMindMapFromJSON } from '../../../core/storage/storageRouter';
import { getAppSettings } from '../../../core/storage/storageUtils';
import './MindMapApp.css';

import AuthVerification from '../auth/AuthVerification.jsx';
import AuthModal from '../auth/AuthModal.jsx';
import TutorialOverlay from '../common/TutorialOverlay.jsx';
import KeyboardShortcutHelper from '../common/KeyboardShortcutHelper.jsx';
import StorageModeSelector from '../storage/StorageModeSelector.jsx';
import { useAppInitialization } from '../../../core/hooks/useAppInitialization.js';
import { useKeyboardShortcuts } from '../../../core/hooks/useKeyboardShortcuts.js';
import { useCloudAuth } from '../../../features/auth/cloudAuthManager.js';

// カスタムフックのインポート
import { useAuthHandlers } from './hooks/useAuthHandlers.js';
import { useFileHandlers } from './hooks/useFileHandlers.js';
import { useMapHandlers } from './hooks/useMapHandlers.js';
import { useUIState } from './hooks/useUIState.js';
import { useNodeHandlers } from './hooks/useNodeHandlers.js';
import { useAppActions } from './hooks/useAppActions.js';
import { useRealtimeHandlers } from './hooks/useRealtimeHandlers.js';

// Types
import type { MindMapNode, MindMapData, User } from '../../../shared/types';

const MindMapApp: React.FC = () => {
  // URL パラメータで認証トークンをチェック
  const urlParams = new URLSearchParams(window.location.search);
  const authToken = urlParams.get('token');
  const isAuthVerification = authToken && authToken.length > 20; // 有効なトークンっぽい場合
  
  // アプリ初期化（統一フロー）- まず初期化状態を取得
  const initState = useAppInitialization();
  
  const {
    data,
    selectedNodeId,
    editingNodeId,
    editText,
    setSelectedNodeId,
    setEditingNodeId,
    setEditText,
    updateNode,
    addChildNode,
    addSiblingNode,
    deleteNode,
    dragNode,
    changeParent,
    findNode,
    flattenNodes,
    startEdit,
    finishEdit,
    undo,
    redo,
    canUndo,
    canRedo,
    updateTitle,
    saveMindMap,
    toggleCollapse,
    navigateToDirection,
    attachFileToNode,
    removeFileFromNode,
    renameFileInNode,
    downloadFile,
    allMindMaps,
    currentMapId,
    createMindMap,
    renameMindMap,
    deleteMindMapById,
    switchToMap,
    refreshAllMindMaps,
    changeMapCategory,
    getAvailableCategories,
    addNodeMapLink,
    removeNodeMapLink,
    reinitializeAfterModeSelection,
    // リアルタイム機能
    realtimeClient,
    isRealtimeConnected,
    realtimeStatus,
    connectedUsers,
    userCursors,
    initializeRealtime,
    updateCursorPosition,
    triggerCloudSync
  } = useMindMap(initState.isReady);
  
  // クラウド認証状態管理
  const cloudAuth = useCloudAuth();

  // ストレージモード選択ハンドラー
  const handleStorageModeSelectWithReinit = async (mode) => {
    try {
      console.log('📝 ストレージモード選択 (統合版):', mode);
      
      // useAppInitializationのhandleStorageModeSelectを実行
      await initState.handleStorageModeSelect(mode);
      
      // ローカルモードの場合のみマップデータの再初期化
      // （クラウドモードは認証成功後に実行）
      if (mode === 'local' && typeof reinitializeAfterModeSelection === 'function') {
        console.log('🔄 ローカルモード: マップデータ再初期化開始');
        await reinitializeAfterModeSelection();
        console.log('✅ ローカルモード: マップデータ再初期化完了');
      }
    } catch (error) {
      console.error('❌ ストレージモード選択エラー:', error);
    }
  };

  // 認証成功時の統合ハンドラー
  const handleAuthSuccessWithReinit = async () => {
    try {
      console.log('✅ 認証成功 (統合版)');
      
      // useAppInitializationのhandleAuthSuccessを実行（設定永続化とアダプター初期化を含む）
      await initState.handleAuthSuccess();
      
      // 認証成功後のマップデータ再初期化
      if (typeof reinitializeAfterModeSelection === 'function') {
        console.log('🔄 認証成功後のマップデータ再初期化開始');
        await reinitializeAfterModeSelection();
        console.log('✅ 認証成功後のマップデータ再初期化完了');
      }
    } catch (error) {
      console.error('❌ 認証成功とリニューアルエラー:', error);
    }
  };

  // カスタムフックで機能を分離
  const authHandlers = useAuthHandlers(initState, refreshAllMindMaps, triggerCloudSync);
  
  const fileHandlers = useFileHandlers(
    attachFileToNode,
    removeFileFromNode,
    renameFileInNode,
    downloadFile
  );
  
  const mapHandlers = useMapHandlers(
    allMindMaps,
    switchToMap,
    createMindMap,
    deleteMindMapById,
    renameMindMap,
    changeMapCategory
  );
  
  const uiState = useUIState();
  
  const nodeHandlers = useNodeHandlers(
    setSelectedNodeId,
    uiState.setContextMenuPosition,
    uiState.setShowContextMenu,
    uiState.setShowCustomizationPanel,
    addChildNode,
    addSiblingNode,
    updateNode,
    addNodeMapLink,
    removeNodeMapLink,
    updateCursorPosition
  );
  
  const appActions = useAppActions(data, saveMindMap, exportMindMapAsJSON, importMindMapFromJSON);
  
  const realtimeHandlers = useRealtimeHandlers(initializeRealtime, isRealtimeConnected);

  // キーボードショートカットの統合
  useKeyboardShortcuts({
    selectedNodeId,
    editingNodeId,
    setEditingNodeId,
    setEditText,
    startEdit,
    finishEdit,
    editText,
    updateNode,
    addChildNode,
    addSiblingNode,
    deleteNode,
    undo,
    redo,
    canUndo,
    canRedo,
    navigateToDirection,
    saveMindMap,
    showMapList: uiState.showMapList,
    setShowMapList: uiState.setShowMapList,
    showCloudStorage: uiState.showCloudStoragePanel,
    setShowCloudStorage: uiState.setShowCloudStoragePanel,
    showTutorial: uiState.showTutorial,
    setShowTutorial: uiState.setShowTutorial,
    showKeyboardHelper: uiState.showShortcutHelper,
    setShowKeyboardHelper: uiState.setShowShortcutHelper
  });
  
  // 初期化完了時の処理
  useEffect(() => {
    if (initState.isReady) {
      console.log('✅ アプリ初期化完了');
    }
  }, [initState.isReady]);

  // クラウドモード時の認証状態チェック
  useEffect(() => {
    const settings = getAppSettings();
    if (settings.storageMode === 'cloud' && !cloudAuth.isAuthenticated) {
      console.log('🔐 クラウドモードですが未認証のため、認証が必要です');
      // 認証モーダルを表示するか、または認証プロセスを開始
      if (cloudAuth.error) {
        console.error('認証エラー:', cloudAuth.error);
      }
    }
  }, [cloudAuth.isAuthenticated, cloudAuth.error]);

  // ファイルアクションメニューのハンドラーを拡張
  const handleCloseAllPanels = () => {
    uiState.handleCloseAllPanels();
    fileHandlers.handleCloseAllPanels();
  };

  // コンテキストメニューのハンドラー
  const handleRightClick = (e: React.MouseEvent, nodeId: string) => {
    nodeHandlers.handleRightClick(e, nodeId);
    uiState.handleCloseAllPanels();
  };

  const handleCopyNode = (node: MindMapNode) => {
    const clipboard = nodeHandlers.handleCopyNode(node);
    uiState.setClipboard(clipboard);
  };

  const handlePasteNode = (parentId: string) => {
    nodeHandlers.handlePasteNode(parentId, uiState.clipboard);
  };

  // ノードマップリンクのハンドラー
  const handleShowNodeMapLinks = (node: MindMapNode, position: { x: number; y: number }) => {
    uiState.handleShowNodeMapLinks(node, position);
  };

  const handleNavigateToMap = async (mapId: string) => {
    try {
      await mapHandlers.handleNavigateToMap(mapId);
      uiState.handleCloseNodeMapLinksPanel();
    } catch (error) {
      console.error('マップナビゲーションエラー:', error);
      alert('マップの切り替えに失敗しました: ' + (error as Error).message);
    }
  };

  // 認証検証中の場合は専用画面を表示（まだ認証していない場合のみ）
  if (isAuthVerification && !authHandlers.authState.isAuthenticated) {
    return (
      <AuthVerification 
        onAuthSuccess={(user: User) => {
          // 認証状態を更新
          authHandlers.setAuthState({
            isAuthenticated: true,
            user: user,
            isLoading: false
          });
          // URLからトークンを除去
          window.history.replaceState({}, document.title, window.location.pathname);
        }}
        onAuthError={(error: Error) => {
          console.error('Authentication failed:', error);
          // エラー時もホームに戻る
          setTimeout(() => {
            window.location.href = '/MindFlow/';
          }, 3000);
        }}
      />
    );
  }

  // 初期化中の場合の処理
  if (initState.isInitializing) {
    return (
      <div className="mindmap-app loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>MindFlow</h2>
          <p>アプリケーションを初期化中...</p>
        </div>
      </div>
    );
  }

  // データがなく、どの初期化UIも表示されていない場合（エラー状態）
  if (!data && !initState.showStorageModeSelector && !initState.showAuthModal && !initState.showOnboarding) {
    return (
      <div className="mindmap-app loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>MindFlow</h2>
          <p>初期化に問題が発生しました...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mindmap-app">
      {/* データが存在する場合のみメインアプリを表示 */}
      {data ? (
        <>
          <MindMapSidebar
            mindMaps={allMindMaps}
            currentMapId={currentMapId}
            onSelectMap={mapHandlers.handleSelectMap}
            onCreateMap={mapHandlers.handleCreateMap}
            onDeleteMap={mapHandlers.handleDeleteMap}
            onRenameMap={mapHandlers.handleRenameMap}
            onChangeCategory={mapHandlers.handleChangeCategory}
            availableCategories={getAvailableCategories()}
            isCollapsed={uiState.sidebarCollapsed}
            onToggleCollapse={uiState.handleToggleSidebar}
          />
          
          <div className={`container ${uiState.sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
            <Toolbar
              title={data.title}
              onTitleChange={updateTitle}
              onExport={appActions.handleExport}
              onImport={appActions.handleImport}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              zoom={uiState.zoom}
              onZoomReset={uiState.handleZoomReset}
              onShowCloudStoragePanel={() => uiState.setShowCloudStoragePanel(true)}
              authState={authHandlers.authState}
              onShowAuthModal={authHandlers.handleShowAuthModal}
              onLogout={authHandlers.handleLogout}
              onShowShortcutHelper={() => uiState.setShowShortcutHelper(true)}
            />

            <ErrorBoundary>
              <MindMapCanvas
                data={data}
                selectedNodeId={selectedNodeId}
                editingNodeId={editingNodeId}
                editText={editText}
                setEditText={setEditText}
                onSelectNode={nodeHandlers.handleNodeSelect}
                onStartEdit={startEdit}
                onFinishEdit={finishEdit}
                onDragNode={dragNode}
                onChangeParent={changeParent}
                onAddChild={nodeHandlers.handleAddChild}
                onAddSibling={nodeHandlers.handleAddSibling}
                onDeleteNode={deleteNode}
                onRightClick={handleRightClick}
                onToggleCollapse={toggleCollapse}
                onNavigateToDirection={navigateToDirection}
                onFileUpload={fileHandlers.handleFileUpload}
                onRemoveFile={fileHandlers.handleRemoveFile}
                onShowImageModal={fileHandlers.handleShowImageModal}
                onShowFileActionMenu={fileHandlers.handleShowFileActionMenu}
                onShowNodeMapLinks={handleShowNodeMapLinks}
                zoom={uiState.zoom}
                setZoom={uiState.setZoom}
                pan={uiState.pan}
                setPan={uiState.setPan}
              />
            </ErrorBoundary>

            {/* リアルタイム機能UI */}
            {authHandlers.authState.isAuthenticated && (
              <>
                <UserPresence
                  connectedUsers={connectedUsers}
                  currentUserId={authHandlers.authState.user?.id}
                  realtimeStatus={realtimeStatus}
                  onUserClick={realtimeHandlers.handleUserClick}
                />
                
                <UserCursors
                  userCursors={userCursors}
                  currentUserId={authHandlers.authState.user?.id}
                  zoom={uiState.zoom}
                  pan={uiState.pan}
                  findNode={findNode}
                />
                
                <ConnectionStatus
                  realtimeStatus={realtimeStatus}
                  isRealtimeConnected={isRealtimeConnected}
                  connectedUsers={connectedUsers}
                  pendingOperations={0} // TODO: get from hook if available
                  reconnectAttempts={0} // TODO: get from hook if available
                  lastError={null} // TODO: get from hook if available
                  onReconnect={realtimeHandlers.handleRealtimeReconnect}
                  onDisconnect={realtimeHandlers.handleRealtimeDisconnect}
                  onToggleRealtime={realtimeHandlers.handleToggleRealtime}
                  onShowCollaborativeFeatures={uiState.handleToggleCollaborativeFeatures}
                />
              </>
            )}

            {/* 競合解決通知 */}
            <ConflictNotification
              conflicts={uiState.conflicts}
              onDismiss={uiState.handleDismissConflict}
              position="top-center"
            />

            {/* 共同編集機能パネル */}
            <CollaborativeFeatures
              isVisible={uiState.showCollaborativeFeatures}
              onClose={() => uiState.setShowCollaborativeFeatures(false)}
              selectedNodeId={selectedNodeId}
              findNode={findNode}
              currentUserId={authHandlers.authState.user?.id}
              connectedUsers={connectedUsers}
              realtimeClient={realtimeClient}
            />

            {/* パフォーマンスダッシュボード（開発環境のみ） */}
            {process.env.NODE_ENV === 'development' && (
              <PerformanceDashboard
                isVisible={uiState.showPerformanceDashboard}
                onClose={() => uiState.setShowPerformanceDashboard(false)}
                position="bottom-left"
              />
            )}

            {uiState.showCustomizationPanel && (
              <NodeCustomizationPanel
                selectedNode={selectedNodeId ? findNode(selectedNodeId) : null}
                onUpdateNode={updateNode}
                onClose={() => uiState.setShowCustomizationPanel(false)}
                position={uiState.customizationPosition}
              />
            )}

            {uiState.showContextMenu && (
              <ContextMenu
                visible={true}
                position={uiState.contextMenuPosition}
                selectedNode={selectedNodeId ? findNode(selectedNodeId) : null}
                onAddChild={nodeHandlers.handleAddChild}
                onAddSibling={nodeHandlers.handleAddSibling}
                onDelete={deleteNode}
                onCustomize={uiState.handleShowCustomization}
                onCopy={handleCopyNode}
                onPaste={handlePasteNode}
                onClose={() => uiState.setShowContextMenu(false)}
              />
            )}

            <ImageModal
              isOpen={fileHandlers.showImageModal}
              image={fileHandlers.modalImage}
              onClose={fileHandlers.handleCloseImageModal}
            />

            <FileActionMenu
              isOpen={fileHandlers.showFileActionMenu}
              file={fileHandlers.actionMenuFile}
              position={fileHandlers.fileActionMenuPosition}
              onClose={fileHandlers.handleCloseFileActionMenu}
              onDownload={fileHandlers.handleFileDownload}
              onRename={fileHandlers.handleFileRename}
              onDelete={fileHandlers.handleFileDelete}
              onView={fileHandlers.handleShowImageModal}
            />

            {uiState.selectedNodeForLinks && (
              <NodeMapLinksPanel
                isOpen={uiState.showNodeMapLinksPanel}
                position={uiState.nodeMapLinksPanelPosition}
                selectedNode={uiState.selectedNodeForLinks}
                currentMapId={currentMapId}
                allMaps={allMindMaps}
                onClose={uiState.handleCloseNodeMapLinksPanel}
                onAddLink={nodeHandlers.handleAddNodeMapLink}
                onRemoveLink={nodeHandlers.handleRemoveNodeMapLink}
                onNavigateToMap={handleNavigateToMap}
              />
            )}

            <CloudStoragePanelEnhanced
              isVisible={uiState.showCloudStoragePanel}
              onClose={() => uiState.setShowCloudStoragePanel(false)}
              allMindMaps={allMindMaps}
              refreshAllMindMaps={refreshAllMindMaps}
              currentMapId={currentMapId}
              switchToMap={switchToMap}
              deleteMindMapById={deleteMindMapById}
              renameMindMap={renameMindMap}
              createMindMap={createMindMap}
            />

            <footer className="footer">
              <div>
                <span className="footer-brand">© 2024 MindFlow</span>
                <span className="stats">
                  ノード数: {flattenNodes && data?.rootNode ? flattenNodes(data.rootNode).length : 0} | 
                  最終更新: {data?.updatedAt ? new Date(data.updatedAt).toLocaleString('ja-JP') : 'N/A'}
                </span>
                {(getAppSettings().storageMode === 'cloud' || getAppSettings().cloudSync) && (
                  <span className="sync-status">
                    <SyncStatusIndicator />
                  </span>
                )}
              </div>
            </footer>
          </div>
        </>
      ) : null}

      {/* 初期化UI - データの有無に関係なく表示 */}
      <AuthModal
        isVisible={initState.showAuthModal}
        onClose={initState.handleAuthClose}
        onAuthSuccess={handleAuthSuccessWithReinit}
      />

      {/* チュートリアルオーバーレイ */}
      <TutorialOverlay
        isVisible={initState.showOnboarding}
        onComplete={initState.handleOnboardingComplete}
        onSkip={initState.handleOnboardingComplete}
      />

      {/* キーボードショートカットヘルパー */}
      <KeyboardShortcutHelper
        isVisible={uiState.showShortcutHelper}
        onClose={() => uiState.setShowShortcutHelper(false)}
      />

      {/* ストレージモード選択画面 */}
      {initState.showStorageModeSelector && (
        <StorageModeSelector
          onModeSelect={handleStorageModeSelectWithReinit}
          hasLocalData={initState.hasExistingLocalData}
        />
      )}
    </div>
  );
};

export default MindMapApp;