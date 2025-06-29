import React, { useState, useEffect, useCallback } from 'react';
import { useMindMap } from '../../core/hooks/useMindMap';
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
import { LocalEngine } from '../../core/storage/local/LocalEngine';

// ローカルエンジンのインスタンスを作成
const _localEngine = new LocalEngine();
import { getAppSettings } from '../../core/storage/storageUtils';
// import { hasLocalData } from '../../core/storage/localStorage';
import './MindMapApp.css';

import AuthVerification from '../auth/AuthVerification.jsx';
import AuthModal from '../auth/AuthModal.jsx';
import { authManager } from '../../features/auth/authManager.js';
import TutorialOverlay from '../common/TutorialOverlay.jsx';
import KeyboardShortcutHelper from '../common/KeyboardShortcutHelper.jsx';
import StorageModeSelector from '../storage/StorageModeSelector.jsx';
// import { useOnboarding } from '../../core/hooks/useOnboarding.js';
import { useAppInitialization } from '../../core/hooks/useAppInitialization.js';
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts.js';

// TypeScript type imports
import type {
  AuthState,
  User,
  Node,
  FileAttachment,
  Position,
  PanState,
  Conflict,
  ConnectedUser,
  MindMapListItem,
  UseMindMapReturn,
  UseAppInitializationReturn
} from '../../../shared/types/app';
// リアルタイム同期はクラウドエンジンに統合

const MindMapApp: React.FC = () => {
  // URL パラメータで認証トークンをチェック
  const urlParams = new URLSearchParams(window.location.search);
  const authToken = urlParams.get('token');
  const isAuthVerification = authToken && authToken.length > 20; // 有効なトークンっぽい場合
  
  // 認証状態を管理
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: authManager.isAuthenticated(),
    user: authManager.getCurrentUser(),
    isLoading: false
  });
  
  // 認証モーダル状態
  const [_showAuthModal, _setShowAuthModal] = useState(false);
  
  
  // キーボードショートカットヘルパー状態
  const [showShortcutHelper, setShowShortcutHelper] = useState(false);
  
  // マップリスト状態
  const [showMapList, setShowMapList] = useState(false);
  
  // アプリ初期化（統一フロー）
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
    // リアルタイム機能
    realtimeClient,
    isRealtimeConnected,
    realtimeStatus,
    connectedUsers,
    userCursors,
    initializeRealtime,
    updateCursorPosition,
    triggerCloudSync
  }: UseMindMapReturn = useMindMap(initState.isReady);

  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0 });
  const [showCustomizationPanel, setShowCustomizationPanel] = useState<boolean>(false);
  const [customizationPosition, setCustomizationPosition] = useState<Position>({ x: 0, y: 0 });
  const [showContextMenu, setShowContextMenu] = useState<boolean>(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<Position>({ x: 0, y: 0 });
  const [clipboard, setClipboard] = useState<Node | null>(null);
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [modalImage, setModalImage] = useState<FileAttachment | null>(null);
  const [showFileActionMenu, setShowFileActionMenu] = useState<boolean>(false);
  const [fileActionMenuPosition, setFileActionMenuPosition] = useState<Position>({ x: 0, y: 0 });
  const [actionMenuFile, setActionMenuFile] = useState<FileAttachment | null>(null);
  const [actionMenuNodeId, setActionMenuNodeId] = useState<string | null>(null);
  
  // ノードマップリンクパネル状態
  const [showNodeMapLinksPanel, setShowNodeMapLinksPanel] = useState<boolean>(false);
  const [nodeMapLinksPanelPosition, setNodeMapLinksPanelPosition] = useState<Position>({ x: 0, y: 0 });
  const [selectedNodeForLinks, setSelectedNodeForLinks] = useState<Node | null>(null);
  
  // サイドバー状態
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  
  // クラウドストレージパネル状態
  const [showCloudStoragePanel, setShowCloudStoragePanel] = useState<boolean>(false);
  
  // 競合通知状態
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  
  // 共同編集機能パネル状態
  const [showCollaborativeFeatures, setShowCollaborativeFeatures] = useState<boolean>(false);
  
  // パフォーマンスダッシュボード状態（開発環境のみ）
  const [showPerformanceDashboard, setShowPerformanceDashboard] = useState<boolean>(false);
  
  // チュートリアル状態
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  
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
    showMapList,
    setShowMapList,
    showCloudStorage: showCloudStoragePanel,
    setShowCloudStorage: setShowCloudStoragePanel,
    showTutorial,
    setShowTutorial,
    showKeyboardHelper: showShortcutHelper,
    setShowKeyboardHelper: setShowShortcutHelper
  });
  
  // 初期化完了時の処理
  useEffect(() => {
    if (initState.isReady) {
      console.log('✅ アプリ初期化完了');
    }
  }, [initState.isReady]);

  // 認証状態を監視して更新
  useEffect(() => {
    // 認証状態の変更を監視
    const checkAuthStatus = (): void => {
      const isAuth = authManager.isAuthenticated();
      const user = authManager.getCurrentUser();
      
      setAuthState((prev: AuthState) => {
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

  const handleZoomReset = useCallback((): void => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleExport = useCallback((): void => {
    exportMindMapAsJSON(data);
  }, [data]);

  const handleImport = useCallback(async (file: File): Promise<void> => {
    try {
      await importMindMapFromJSON(file);
      window.location.reload();
    } catch (error: any) {
      alert('ファイルの読み込みに失敗しました: ' + error.message);
    }
  }, []);

  const showSaveMessage = useCallback((): void => {
    const saveMessage = document.createElement('div');
    saveMessage.textContent = '保存完了！';
    saveMessage.className = 'save-message';
    document.body.appendChild(saveMessage);
    setTimeout(() => saveMessage.remove(), 3000);
  }, []);

  const handleSave = useCallback(async (): Promise<void> => {
    await saveMindMap();
    showSaveMessage();
  }, [saveMindMap, showSaveMessage]);


  // 既存のキーボードハンドラーは useKeyboardShortcuts に統合済み

  const handleAddChild = useCallback((parentId: string): void => {
    addChildNode(parentId, '', true); // startEditing = true で即座に編集開始
  }, [addChildNode]);

  const handleShowCustomization = useCallback((node: Node, position?: Position): void => {
    setCustomizationPosition(position || { x: 300, y: 200 });
    setShowCustomizationPanel(true);
    setShowContextMenu(false);
  }, []);

  const handleRightClick = useCallback((e: React.MouseEvent, nodeId: string): void => {
    e.preventDefault();
    e.stopPropagation();
    
    if (nodeId) {
      setSelectedNodeId(nodeId);
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setShowContextMenu(true);
      setShowCustomizationPanel(false);
    }
  }, [setSelectedNodeId]);

  const handleAddSibling = useCallback((nodeId: string): void => {
    addSiblingNode(nodeId, '', true); // startEditing = true で即座に編集開始
  }, [addSiblingNode]);

  const handleCopyNode = useCallback((node: Node): void => {
    const nodeCopy = JSON.parse(JSON.stringify(node));
    const removeIds = (n: any): void => {
      delete n.id;
      if (n.children) n.children.forEach(removeIds);
    };
    removeIds(nodeCopy);
    setClipboard(nodeCopy);
  }, []);

  const handlePasteNode = useCallback((parentId: string): void => {
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
  }, [clipboard, addChildNode, updateNode, setSelectedNodeId]);



  const handleCloseAllPanels = useCallback((): void => {
    setShowCustomizationPanel(false);
    setShowContextMenu(false);
    setShowImageModal(false);
    setShowFileActionMenu(false);
    setShowNodeMapLinksPanel(false);
  }, []);

  const handleShowImageModal = useCallback((image: FileAttachment): void => {
    setModalImage(image);
    setShowImageModal(true);
    handleCloseAllPanels();
    setShowImageModal(true); // 再度trueにして画像モーダルだけ表示
  }, [handleCloseAllPanels]);

  const handleCloseImageModal = useCallback((): void => {
    setShowImageModal(false);
    setModalImage(null);
  }, []);

  const handleShowFileActionMenu = useCallback((file: FileAttachment, nodeId: string, position: Position): void => {
    setActionMenuFile(file);
    setActionMenuNodeId(nodeId);
    setFileActionMenuPosition(position);
    setShowFileActionMenu(true);
    handleCloseAllPanels();
    setShowFileActionMenu(true); // 再度trueにしてファイルアクションメニューだけ表示
  }, [handleCloseAllPanels]);

  const handleCloseFileActionMenu = () => {
    setShowFileActionMenu(false);
    setActionMenuFile(null);
    setActionMenuNodeId(null);
  };

  const handleFileDownload = async (file: any) => {
    try {
      await downloadFile(file);
    } catch (error) {
      console.error('ファイルダウンロードエラー:', error);
      alert('ファイルのダウンロードに失敗しました: ' + error.message);
    }
  };

  const handleFileRename = (fileId: string, newName: string) => {
    try {
      renameFileInNode(actionMenuNodeId, fileId, newName);
    } catch (error) {
      console.error('ファイル名変更エラー:', error);
      alert('ファイル名の変更に失敗しました: ' + error.message);
    }
  };

  const handleFileDelete = (fileId: string) => {
    try {
      removeFileFromNode(actionMenuNodeId, fileId);
    } catch (error) {
      console.error('ファイル削除エラー:', error);
      alert('ファイルの削除に失敗しました: ' + error.message);
    }
  };

  const handleFileUpload = useCallback(async (nodeId: string, files: FileList | File[]): Promise<void> => {
    if (!files || files.length === 0) return;
    
    try {
      const file = files[0]; // 最初のファイルのみ処理
      await attachFileToNode(nodeId, file);
    } catch (error: any) {
      console.error('ファイルアップロードエラー:', error);
      alert('ファイルのアップロードに失敗しました: ' + error.message);
    }
  }, [attachFileToNode]);
  
  const handleRemoveFile = (nodeId: string, fileId: string) => {
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

  const handleSelectMap = async (mapId: string) => {
    try {
      await switchToMap(mapId);
    } catch (error) {
      console.error('マップ切り替えエラー:', error);
      alert('マップの切り替えに失敗しました: ' + error.message);
    }
  };

  const handleCreateMap = async (providedName: string | null = null, providedCategory: string | null = null) => {
    let mapName = providedName;
    if (!mapName) {
      mapName = prompt('新しいマインドマップの名前を入力してください:', '新しいマインドマップ');
    }
    
    if (mapName && typeof mapName === 'string' && mapName.trim()) {
      try {
        const category = providedCategory || '未分類';
        const mapId = await createMindMap(mapName.trim(), category);
        return mapId;
      } catch (error) {
        console.error('マップ作成エラー:', error);
        alert('マップの作成に失敗しました: ' + error.message);
        return null;
      }
    }
    return null;
  };

  const handleDeleteMap = (mapId: string) => {
    if (allMindMaps.length <= 1) {
      alert('最後のマインドマップは削除できません');
      return false;
    }
    return deleteMindMapById(mapId);
  };

  const handleRenameMap = (mapId: string, newTitle: string) => {
    renameMindMap(mapId, newTitle);
  };

  const handleChangeCategory = (mapId: string, newCategory: string) => {
    changeMapCategory(mapId, newCategory);
  };

  // ノードマップリンク関連のハンドラー
  const handleShowNodeMapLinks = (node: any, position: any) => {
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

  const handleAddNodeMapLink = (nodeId: string, targetMapId: string, targetMapTitle: string, description: string) => {
    addNodeMapLink(nodeId, targetMapId, targetMapTitle, description);
  };

  const handleRemoveNodeMapLink = (nodeId: string, linkId: string) => {
    removeNodeMapLink(nodeId, linkId);
  };

  const handleNavigateToMap = async (mapId: string) => {
    try {
      await switchToMap(mapId);
      setShowNodeMapLinksPanel(false);
    } catch (error) {
      console.error('マップナビゲーションエラー:', error);
      alert('マップの切り替えに失敗しました: ' + error.message);
    }
  };
  
  // 認証関連ハンドラー
  const handleShowAuthModal = () => {
    setShowAuthModal(true);
  };
  
  const handleCloseAuthModal = () => {
    setShowAuthModal(false);
  };
  
  const handleAuthSuccess = useCallback(async (user: User): Promise<void> => {
    setAuthState({
      isAuthenticated: true,
      user: user,
      isLoading: false
    });
    
    // 初期化フローの認証成功を通知
    initState.handleAuthSuccess();
    
    // リアルタイム同期を再初期化
    try {
      // リアルタイム同期の再初期化はクラウドエンジンで自動処理
      console.log('🔄 認証成功後のリアルタイム同期再初期化完了');
    } catch (initError: any) {
      console.warn('⚠️ リアルタイム同期再初期化失敗:', initError);
    }
    
    // マップ一覧をリフレッシュ
    try {
      await refreshAllMindMaps();
      console.log('🔄 認証成功後にマップ一覧をリフレッシュしました');
    } catch (refreshError: any) {
      console.warn('⚠️ 認証後のマップ一覧リフレッシュに失敗:', refreshError);
    }
    
    // クラウド同期をトリガー
    if (triggerCloudSync) {
      try {
        await triggerCloudSync();
        console.log('🔄 認証成功後のクラウド同期完了');
      } catch (syncError: any) {
        console.warn('⚠️ クラウド同期に失敗:', syncError);
      }
    }
  }, [initState, refreshAllMindMaps, triggerCloudSync]);
  
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

  const handleUserClick = useCallback((user: ConnectedUser): void => {
    // ユーザークリック時の処理（必要に応じて実装）
  }, []);

  // カーソル更新（ノード選択時）
  const handleNodeSelect = useCallback((nodeId: string): void => {
    setSelectedNodeId(nodeId);
    if (updateCursorPosition && nodeId) {
      updateCursorPosition(nodeId);
    }
  }, [setSelectedNodeId, updateCursorPosition]);

  // 競合処理関連
  const handleConflictResolved = useCallback((conflict: Omit<Conflict, 'id' | 'timestamp'>): void => {
    setConflicts(prev => [...prev, {
      ...conflict,
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }]);
  }, []);

  const handleDismissConflict = (conflictId: string) => {
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
    const handleKeyDown = (e: KeyboardEvent) => {
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
        onAuthSuccess={(user: User) => {
          // 認証状態を更新
          setAuthState({
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
