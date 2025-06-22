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
import NodeMapLinksPanel from './MapLinksPanel';
import CloudStoragePanelEnhanced from './CloudStoragePanelEnhanced';
import SyncStatusIndicator from './SyncStatusIndicator';
import UserPresence from './UserPresence';
import UserCursors from './UserCursors';
import ConnectionStatus from './ConnectionStatus';
import ConflictNotification from './ConflictNotification';
import CollaborativeFeatures from './CollaborativeFeatures';
import PerformanceDashboard from './PerformanceDashboard';
import { exportMindMapAsJSON, importMindMapFromJSON, getAppSettings, hasLocalData, isFirstTimeSetup, setStorageMode } from '../utils/storage';
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
  // URL パラメータで認証トークンをチェック
  const urlParams = new URLSearchParams(window.location.search);
  const authToken = urlParams.get('token');
  const isAuthVerification = authToken && authToken.length > 20; // 有効なトークンっぽい場合
  
  // 認証状態を管理
  const [authState, setAuthState] = useState({
    isAuthenticated: authManager.isAuthenticated(),
    user: authManager.getCurrentUser(),
    isLoading: false
  });
  
  // 認証モーダル状態
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  
  // キーボードショートカットヘルパー状態
  const [showShortcutHelper, setShowShortcutHelper] = useState(false);
  
  // アプリ初期化（統一フロー）
  const initState = useAppInitialization();

  const {
    data,
    selectedNodeId,
    editingNodeId,
    editText,
    setSelectedNodeId,
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

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showCustomizationPanel, setShowCustomizationPanel] = useState(false);
  const [customizationPosition, setCustomizationPosition] = useState({ x: 0, y: 0 });
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [clipboard, setClipboard] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState(null);
  const [showFileActionMenu, setShowFileActionMenu] = useState(false);
  const [fileActionMenuPosition, setFileActionMenuPosition] = useState({ x: 0, y: 0 });
  const [actionMenuFile, setActionMenuFile] = useState(null);
  const [actionMenuNodeId, setActionMenuNodeId] = useState(null);
  
  // ノードマップリンクパネル状態
  const [showNodeMapLinksPanel, setShowNodeMapLinksPanel] = useState(false);
  const [nodeMapLinksPanelPosition, setNodeMapLinksPanelPosition] = useState({ x: 0, y: 0 });
  const [selectedNodeForLinks, setSelectedNodeForLinks] = useState(null);
  
  // サイドバー状態
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // クラウドストレージパネル状態
  const [showCloudStoragePanel, setShowCloudStoragePanel] = useState(false);
  
  // 競合通知状態
  const [conflicts, setConflicts] = useState([]);
  
  // 共同編集機能パネル状態
  const [showCollaborativeFeatures, setShowCollaborativeFeatures] = useState(false);
  
  // パフォーマンスダッシュボード状態（開発環境のみ）
  const [showPerformanceDashboard, setShowPerformanceDashboard] = useState(false);
  
  // 初期化完了時の処理
  useEffect(() => {
    if (initState.isReady) {
      console.log('✅ アプリ初期化完了');
    }
  }, [initState.isReady]);

  // 認証状態を監視して更新
  useEffect(() => {
    // 認証状態の変更を監視
    const checkAuthStatus = () => {
      const isAuth = authManager.isAuthenticated();
      const user = authManager.getCurrentUser();
      
      setAuthState(prev => {
        if (prev.isAuthenticated !== isAuth || prev.user !== user) {
          return {
            isAuthenticated: isAuth,
            user: user,
            isLoading: false
          };
        }
        return prev;
      });
    };
    
    // 初回チェック
    checkAuthStatus();
    
    // 定期的にチェック
    const interval = setInterval(checkAuthStatus, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleExport = () => {
    exportMindMapAsJSON(data);
  };

  const handleImport = async (file) => {
    try {
      await importMindMapFromJSON(file);
      window.location.reload();
    } catch (error) {
      alert('ファイルの読み込みに失敗しました: ' + error.message);
    }
  };

  const showSaveMessage = () => {
    const saveMessage = document.createElement('div');
    saveMessage.textContent = '保存完了！';
    saveMessage.className = 'save-message';
    document.body.appendChild(saveMessage);
    setTimeout(() => saveMessage.remove(), 3000);
  };

  const handleSave = async () => {
    await saveMindMap();
    showSaveMessage();
  };


  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            handleSave().catch(console.error);
            break;
          case 'z':
            if (e.shiftKey) {
              e.preventDefault();
              redo().catch(console.error);
            } else {
              e.preventDefault();
              undo().catch(console.error);
            }
            break;
          case 'y':
            e.preventDefault();
            redo().catch(console.error);
            break;
          default:
            break;
        }
      }
      
      // ショートカットヘルプの表示/非表示
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcutHelper(!showShortcutHelper);
      }
      
      if (e.key === 'F1') {
        e.preventDefault();
        setShowShortcutHelper(!showShortcutHelper);
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleSave, undo, redo, showShortcutHelper]);

  const handleAddChild = (parentId) => {
    addChildNode(parentId, '', true); // startEditing = true で即座に編集開始
  };

  const handleShowCustomization = (node, position) => {
    setCustomizationPosition(position || { x: 300, y: 200 });
    setShowCustomizationPanel(true);
    setShowContextMenu(false);
  };

  const handleRightClick = (e, nodeId) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (nodeId) {
      setSelectedNodeId(nodeId);
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setShowContextMenu(true);
      setShowCustomizationPanel(false);
    }
  };

  const handleAddSibling = (nodeId) => {
    addSiblingNode(nodeId, '', true); // startEditing = true で即座に編集開始
  };

  const handleCopyNode = (node) => {
    const nodeCopy = JSON.parse(JSON.stringify(node));
    const removeIds = (n) => {
      delete n.id;
      if (n.children) n.children.forEach(removeIds);
    };
    removeIds(nodeCopy);
    setClipboard(nodeCopy);
  };

  const handlePasteNode = (parentId) => {
    if (!clipboard) return;
    
    const newNodeId = addChildNode(parentId);
    if (newNodeId) {
      updateNode(newNodeId, {
        text: clipboard.text || '',
        fontSize: clipboard.fontSize,
        fontWeight: clipboard.fontWeight,
        fontStyle: clipboard.fontStyle
      });
      setSelectedNodeId(newNodeId);
    }
  };



  const handleCloseAllPanels = () => {
    setShowCustomizationPanel(false);
    setShowContextMenu(false);
    setShowImageModal(false);
    setShowFileActionMenu(false);
    setShowNodeMapLinksPanel(false);
  };

  const handleShowImageModal = (image) => {
    setModalImage(image);
    setShowImageModal(true);
    handleCloseAllPanels();
    setShowImageModal(true); // 再度trueにして画像モーダルだけ表示
  };

  const handleCloseImageModal = () => {
    setShowImageModal(false);
    setModalImage(null);
  };

  const handleShowFileActionMenu = (file, nodeId, position) => {
    setActionMenuFile(file);
    setActionMenuNodeId(nodeId);
    setFileActionMenuPosition(position);
    setShowFileActionMenu(true);
    handleCloseAllPanels();
    setShowFileActionMenu(true); // 再度trueにしてファイルアクションメニューだけ表示
  };

  const handleCloseFileActionMenu = () => {
    setShowFileActionMenu(false);
    setActionMenuFile(null);
    setActionMenuNodeId(null);
  };

  const handleFileDownload = async (file) => {
    try {
      await downloadFile(file);
    } catch (error) {
      console.error('ファイルダウンロードエラー:', error);
      alert('ファイルのダウンロードに失敗しました: ' + error.message);
    }
  };

  const handleFileRename = (fileId, newName) => {
    try {
      renameFileInNode(actionMenuNodeId, fileId, newName);
    } catch (error) {
      console.error('ファイル名変更エラー:', error);
      alert('ファイル名の変更に失敗しました: ' + error.message);
    }
  };

  const handleFileDelete = (fileId) => {
    try {
      removeFileFromNode(actionMenuNodeId, fileId);
    } catch (error) {
      console.error('ファイル削除エラー:', error);
      alert('ファイルの削除に失敗しました: ' + error.message);
    }
  };

  const handleFileUpload = async (nodeId, files) => {
    if (!files || files.length === 0) return;
    
    try {
      const file = files[0]; // 最初のファイルのみ処理
      await attachFileToNode(nodeId, file);
    } catch (error) {
      console.error('ファイルアップロードエラー:', error);
      alert('ファイルのアップロードに失敗しました: ' + error.message);
    }
  };
  
  const handleRemoveFile = (nodeId, fileId) => {
    try {
      removeFileFromNode(nodeId, fileId);
    } catch (error) {
      console.error('ファイル削除エラー:', error);
      alert('ファイルの削除に失敗しました: ' + error.message);
    }
  };

  // サイドバー関連のハンドラ
  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleSelectMap = (mapId) => {
    switchToMap(mapId);
  };

  const handleCreateMap = (providedName = null, providedCategory = null) => {
    let mapName = providedName;
    if (!mapName) {
      mapName = prompt('新しいマインドマップの名前を入力してください:', '新しいマインドマップ');
    }
    
    if (mapName && mapName.trim()) {
      const category = providedCategory || '未分類';
      const mapId = createMindMap(mapName.trim(), category);
      return mapId;
    }
    return null;
  };

  const handleDeleteMap = (mapId) => {
    if (allMindMaps.length <= 1) {
      alert('最後のマインドマップは削除できません');
      return false;
    }
    return deleteMindMapById(mapId);
  };

  const handleRenameMap = (mapId, newTitle) => {
    renameMindMap(mapId, newTitle);
  };

  const handleChangeCategory = (mapId, newCategory) => {
    changeMapCategory(mapId, newCategory);
  };

  // ノードマップリンク関連のハンドラー
  const handleShowNodeMapLinks = (node, position) => {
    setSelectedNodeForLinks(node);
    setNodeMapLinksPanelPosition(position);
    setShowNodeMapLinksPanel(true);
    handleCloseAllPanels();
    setShowNodeMapLinksPanel(true);
  };

  const handleCloseNodeMapLinksPanel = () => {
    setShowNodeMapLinksPanel(false);
    setSelectedNodeForLinks(null);
  };

  const handleAddNodeMapLink = (nodeId, targetMapId, targetMapTitle, description) => {
    addNodeMapLink(nodeId, targetMapId, targetMapTitle, description);
  };

  const handleRemoveNodeMapLink = (nodeId, linkId) => {
    removeNodeMapLink(nodeId, linkId);
  };

  const handleNavigateToMap = (mapId) => {
    switchToMap(mapId);
    setShowNodeMapLinksPanel(false);
  };
  
  // 認証関連ハンドラー
  const handleShowAuthModal = () => {
    setShowAuthModal(true);
  };
  
  const handleCloseAuthModal = () => {
    setShowAuthModal(false);
  };
  
  const handleAuthSuccess = async (user) => {
    setAuthState({
      isAuthenticated: true,
      user: user,
      isLoading: false
    });
    
    // 初期化フローの認証成功を通知
    initState.handleAuthSuccess();
    
    // クラウド同期をトリガー
    if (triggerCloudSync) {
      await triggerCloudSync();
    }
    
    // 認証後にマインドマップをリフレッシュ
    refreshAllMindMaps();
  };
  
  const handleLogout = async () => {
    try {
      await authManager.logout();
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false
      });
      // ログアウト後にページをリロードしてローカルデータを表示
      window.location.reload();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // リアルタイム機能関連ハンドラー
  const handleRealtimeReconnect = () => {
    if (initializeRealtime) {
      initializeRealtime();
    }
  };

  const handleRealtimeDisconnect = () => {
    // リアルタイムクライアントがあれば切断
    // この機能は必要に応じて useMindMap hook に追加
  };

  const handleToggleRealtime = () => {
    if (isRealtimeConnected) {
      handleRealtimeDisconnect();
    } else {
      handleRealtimeReconnect();
    }
  };

  const handleUserClick = (user) => {
    // ユーザークリック時の処理（必要に応じて実装）
  };

  // カーソル更新（ノード選択時）
  const handleNodeSelect = (nodeId) => {
    setSelectedNodeId(nodeId);
    if (updateCursorPosition && nodeId) {
      updateCursorPosition(nodeId);
    }
  };

  // 競合処理関連
  const handleConflictResolved = (conflict) => {
    setConflicts(prev => [...prev, {
      ...conflict,
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }]);
  };

  const handleDismissConflict = (conflictId) => {
    setConflicts(prev => prev.filter(c => c.id !== conflictId));
  };


  // 共同編集機能の表示切り替え
  const handleToggleCollaborativeFeatures = () => {
    setShowCollaborativeFeatures(!showCollaborativeFeatures);
  };

  // パフォーマンスダッシュボードの表示切り替え（開発環境のみ）
  const handleTogglePerformanceDashboard = () => {
    if (process.env.NODE_ENV === 'development') {
      setShowPerformanceDashboard(!showPerformanceDashboard);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseAllPanels();
      }
      
      // パフォーマンスダッシュボードのトグル（開発環境のみ、Ctrl+Shift+P）
      if (e.ctrlKey && e.shiftKey && e.key === 'P' && process.env.NODE_ENV === 'development') {
        e.preventDefault();
        handleTogglePerformanceDashboard();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleCloseAllPanels, handleTogglePerformanceDashboard]);

  // 認証検証中の場合は専用画面を表示（まだ認証していない場合のみ）
  if (isAuthVerification && !authState.isAuthenticated) {
    return (
      <AuthVerification 
        onAuthSuccess={(user) => {
          // 認証状態を更新
          setAuthState({
            isAuthenticated: true,
            user: user,
            isLoading: false
          });
          // URLからトークンを除去
          window.history.replaceState({}, document.title, window.location.pathname);
        }}
        onAuthError={(error) => {
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
            onSelectMap={handleSelectMap}
            onCreateMap={handleCreateMap}
            onDeleteMap={handleDeleteMap}
            onRenameMap={handleRenameMap}
            onChangeCategory={handleChangeCategory}
            availableCategories={getAvailableCategories()}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={handleToggleSidebar}
          />
          
          <div className={`container ${sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
            <Toolbar
              title={data.title}
              onTitleChange={updateTitle}
              onExport={handleExport}
              onImport={handleImport}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              zoom={zoom}
              onZoomReset={handleZoomReset}
              onShowCloudStoragePanel={() => setShowCloudStoragePanel(true)}
              authState={authState}
              onShowAuthModal={handleShowAuthModal}
              onLogout={handleLogout}
              onShowShortcutHelper={() => setShowShortcutHelper(true)}
            />

            <ErrorBoundary>
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
                onChangeParent={changeParent}
                onAddChild={handleAddChild}
                onAddSibling={handleAddSibling}
                onDeleteNode={deleteNode}
                onRightClick={handleRightClick}
            onToggleCollapse={toggleCollapse}
            onNavigateToDirection={navigateToDirection}
            onFileUpload={handleFileUpload}
            onRemoveFile={handleRemoveFile}
            onShowImageModal={handleShowImageModal}
            onShowFileActionMenu={handleShowFileActionMenu}
            onShowNodeMapLinks={handleShowNodeMapLinks}
            zoom={zoom}
            setZoom={setZoom}
            pan={pan}
            setPan={setPan}
          />
        </ErrorBoundary>

        {/* リアルタイム機能UI */}
        {authState.isAuthenticated && (
          <>
            <UserPresence
              connectedUsers={connectedUsers}
              currentUserId={authState.user?.id}
              realtimeStatus={realtimeStatus}
              onUserClick={handleUserClick}
            />
            
            <UserCursors
              userCursors={userCursors}
              currentUserId={authState.user?.id}
              zoom={zoom}
              pan={pan}
              findNode={findNode}
            />
            
            <ConnectionStatus
              realtimeStatus={realtimeStatus}
              isRealtimeConnected={isRealtimeConnected}
              connectedUsers={connectedUsers}
              pendingOperations={0} // TODO: get from hook if available
              reconnectAttempts={0} // TODO: get from hook if available
              lastError={null} // TODO: get from hook if available
              onReconnect={handleRealtimeReconnect}
              onDisconnect={handleRealtimeDisconnect}
              onToggleRealtime={handleToggleRealtime}
              onShowCollaborativeFeatures={handleToggleCollaborativeFeatures}
            />
          </>
        )}

        {/* 競合解決通知 */}
        <ConflictNotification
          conflicts={conflicts}
          onDismiss={handleDismissConflict}
          position="top-center"
        />

        {/* 共同編集機能パネル */}
        <CollaborativeFeatures
          isVisible={showCollaborativeFeatures}
          onClose={() => setShowCollaborativeFeatures(false)}
          selectedNodeId={selectedNodeId}
          findNode={findNode}
          currentUserId={authState.user?.id}
          connectedUsers={connectedUsers}
          realtimeClient={realtimeClient}
        />

        {/* パフォーマンスダッシュボード（開発環境のみ） */}
        {process.env.NODE_ENV === 'development' && (
          <PerformanceDashboard
            isVisible={showPerformanceDashboard}
            onClose={() => setShowPerformanceDashboard(false)}
            position="bottom-left"
          />
        )}

        {showCustomizationPanel && (
          <NodeCustomizationPanel
            selectedNode={selectedNodeId ? findNode(selectedNodeId) : null}
            onUpdateNode={updateNode}
            onClose={() => setShowCustomizationPanel(false)}
            position={customizationPosition}
          />
        )}

        {showContextMenu && (
          <ContextMenu
            visible={true}
            position={contextMenuPosition}
            selectedNode={selectedNodeId ? findNode(selectedNodeId) : null}
            onAddChild={handleAddChild}
            onAddSibling={handleAddSibling}
            onDelete={deleteNode}
            onCustomize={handleShowCustomization}
            onCopy={handleCopyNode}
            onPaste={handlePasteNode}
            onClose={() => setShowContextMenu(false)}
          />
        )}


        <ImageModal
          isOpen={showImageModal}
          image={modalImage}
          onClose={handleCloseImageModal}
        />

        <FileActionMenu
          isOpen={showFileActionMenu}
          file={actionMenuFile}
          position={fileActionMenuPosition}
          onClose={handleCloseFileActionMenu}
          onDownload={handleFileDownload}
          onRename={handleFileRename}
          onDelete={handleFileDelete}
          onView={handleShowImageModal}
        />

        {selectedNodeForLinks && (
          <NodeMapLinksPanel
            isOpen={showNodeMapLinksPanel}
            position={nodeMapLinksPanelPosition}
            selectedNode={selectedNodeForLinks}
            currentMapId={currentMapId}
            allMaps={allMindMaps}
            onClose={handleCloseNodeMapLinksPanel}
            onAddLink={handleAddNodeMapLink}
            onRemoveLink={handleRemoveNodeMapLink}
            onNavigateToMap={handleNavigateToMap}
          />
        )}

            <CloudStoragePanelEnhanced
              isVisible={showCloudStoragePanel}
              onClose={() => setShowCloudStoragePanel(false)}
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
                    <SyncStatusIndicator refreshAllMindMaps={refreshAllMindMaps} />
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
        onAuthSuccess={handleAuthSuccess}
      />

      {/* チュートリアルオーバーレイ */}
      <TutorialOverlay
        isVisible={initState.showOnboarding}
        onComplete={initState.handleOnboardingComplete}
        onSkip={initState.handleOnboardingComplete}
      />

      {/* キーボードショートカットヘルパー */}
      <KeyboardShortcutHelper
        isVisible={showShortcutHelper}
        onClose={() => setShowShortcutHelper(false)}
      />

      {/* ストレージモード選択画面 */}
      {initState.showStorageModeSelector && (
        <StorageModeSelector
          onModeSelect={initState.handleStorageModeSelect}
          hasLocalData={initState.hasExistingLocalData}
        />
      )}
    </div>
  );
};

export default MindMapApp;
