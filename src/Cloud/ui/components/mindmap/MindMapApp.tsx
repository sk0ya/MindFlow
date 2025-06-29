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
import { storageManager } from '../../../core/storage/StorageManager.ts';
import { getAppSettings } from '../../../core/storage/storageUtils';
import './MindMapApp.css';

import AuthModal from '../auth/AuthModal.jsx';
import TutorialOverlay from '../common/TutorialOverlay.jsx';
import KeyboardShortcutHelper from '../common/KeyboardShortcutHelper.jsx';
import StorageModeSelector from '../storage/StorageModeSelector.jsx';
import { useAppInitialization } from '../../../core/hooks/useAppInitialization.js';
import { useKeyboardShortcuts } from '../../../core/hooks/useKeyboardShortcuts.js';
import { useUnifiedAuth, useMagicLinkVerification } from '../../../features/auth/useUnifiedAuth.js';

// 認証関連のカスタムフックは統一システムで置き換え
import { useFileHandlers } from './hooks/useFileHandlers.js';
import { useMapHandlers } from './hooks/useMapHandlers.js';
import { useUIState } from './hooks/useUIState.js';
import { useNodeHandlers } from './hooks/useNodeHandlers.js';
import { useAppActions } from './hooks/useAppActions.js';
import { useRealtimeHandlers } from './hooks/useRealtimeHandlers.js';

// Types
import type { MindMapNode, MindMapData } from '../../../shared/types';

const MindMapApp: React.FC = () => {
  // アプリ初期化
  const initState = useAppInitialization();
  const settings = getAppSettings();
  
  // 統一認証システムを使用
  const auth = useUnifiedAuth();
  const magicLinkVerification = useMagicLinkVerification();
  
  // Magic Link検証中の表示
  if (magicLinkVerification.isVerifying) {
    return (
      <div className="mindmap-app loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>認証処理中...</h2>
          <p>Magic Linkを検証しています...</p>
        </div>
      </div>
    );
  }
  
  // Magic Link検証エラーの表示
  if (magicLinkVerification.verificationError) {
    return (
      <div className="mindmap-app loading-screen">
        <div className="loading-content">
          <h2>認証エラー</h2>
          <p>{magicLinkVerification.verificationError}</p>
          <button onClick={() => {
            magicLinkVerification.clearVerificationError();
            window.location.href = window.location.pathname;
          }}>トップページに戻る</button>
        </div>
      </div>
    );
  }
  
  // クラウドモードで未認証の場合は認証モーダル表示
  if (settings.storageMode === 'cloud' && !auth.state.isAuthenticated) {
    return (
      <AuthModal
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {
          console.log('🎉 認証成功');
          // モーダルは自動的に閉じられる
        }}
      />
    );
  }
  
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
    reinitializeAfterModeSelection,
    triggerCloudSync: _triggerCloudSync
  } = useMindMap(initState.isReady);
  
  // 認証状態は統一システムで管理済み

  // ストレージモード選択ハンドラー
  const handleStorageModeSelectWithReinit = async (mode: 'local' | 'cloud') => {
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

  // 認証ハンドラーは統一システムで置き換え済み
  
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
  
  const appActions = useAppActions(data as any, ((data: any) => {
    if (data) saveMindMap(data);
  }) as any, storageManager.exportMindMapAsJSON as any, storageManager.importMindMapFromJSON as any);
  
  const realtimeHandlers = useRealtimeHandlers(initializeRealtime, isRealtimeConnected);

  // キーボードショートカットの統合
  useKeyboardShortcuts({
    selectedNodeId,
    editingNodeId,
    setEditingNodeId,
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

  // 認証状態の監視とログ出力
  useEffect(() => {
    console.log('🔍 認証状態:', {
      isAuthenticated: auth.state.isAuthenticated,
      user: auth.state.user?.email,
      storageMode: settings.storageMode,
      isLoading: auth.isLoading,
      error: auth.error
    });
  }, [auth.state.isAuthenticated, auth.state.user, auth.isLoading, auth.error, settings.storageMode]);

  // ファイルアクションメニューのハンドラーを拡張
  const _handleCloseAllPanels = () => {
    uiState.handleCloseAllPanels();
    fileHandlers.handleCloseAllPanels();
  };

  // コンテキストメニューのハンドラー
  const handleRightClick = (e: React.MouseEvent<HTMLElement>, nodeId: string) => {
    nodeHandlers.handleRightClick(e as any, nodeId);
    uiState.handleCloseAllPanels();
  };

  const handleCopyNode = (node: MindMapNode) => {
    const clipboard = nodeHandlers.handleCopyNode(node);
    uiState.setClipboard(clipboard as any);
  };

  const handlePasteNode = (parentId: string) => {
    nodeHandlers.handlePasteNode(parentId, uiState.clipboard as any);
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

  // 認証フローは統一システムで処理済み

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
              authState={{
                isAuthenticated: auth.state.isAuthenticated,
                user: auth.state.user,
                isLoading: auth.isLoading
              }}
              onShowAuthModal={auth.openModal}
              onLogout={auth.logout}
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
            {auth.state.isAuthenticated && (
              <>
                <UserPresence
                  connectedUsers={connectedUsers}
                  currentUserId={auth.state.user?.id}
                  realtimeStatus={realtimeStatus}
                  onUserClick={realtimeHandlers.handleUserClick}
                />
                
                <UserCursors
                  userCursors={userCursors}
                  currentUserId={auth.state.user?.id}
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
              currentUserId={auth.state.user?.id}
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

      {/* 重複の認証モーダルは削除済み */}
    </div>
  );
};

export default MindMapApp;