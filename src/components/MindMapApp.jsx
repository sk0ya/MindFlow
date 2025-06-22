import React, { useState, useEffect } from 'react';
import { useMindMap } from '../hooks/useMindMap';
import { useMindMapMulti } from '../hooks/useMindMapMulti';
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
  
  // キーボードショートカットヘルパー状態
  const [showShortcutHelper, setShowShortcutHelper] = useState(false);
  
  // アプリ初期化（統一フロー）
  const initState = useAppInitialization();

  // DataManagerベースのメインフック
  const mindMap = useMindMap(initState.isReady);
  
  // マルチマップ管理（DataManagerシステムのデータを使用）
  const multiMapOps = useMindMapMulti(
    mindMap.data, 
    mindMap.setData, // 旧式互換のため一時的に使用
    mindMap.updateData // 旧式互換のため一時的に使用
  );

  console.log('🔄 MindMapApp: DataManagerシステム動作中', {
    hasData: !!mindMap.data,
    syncStatus: mindMap.syncStatus,
    isReady: initState.isReady
  });

  // UI状態管理
  const [contextMenu, setContextMenu] = useState(null);
  const [nodeCustomization, setNodeCustomization] = useState({ isOpen: false, nodeId: null });
  const [imageModal, setImageModal] = useState(null);
  const [fileActionMenu, setFileActionMenu] = useState(null);
  const [mapLinksPanel, setMapLinksPanel] = useState({ isOpen: false, node: null, position: null });
  const [showSidebar, setShowSidebar] = useState(false);
  const [showCloudPanel, setShowCloudPanel] = useState(false);
  const [currentTool, setCurrentTool] = useState('select');
  const [showPerformanceDash, setShowPerformanceDash] = useState(false);

  // オンボーディング
  const {
    onboardingState,
    completeOnboarding,
    showOnboarding,
    setShowOnboarding
  } = useOnboarding();

  // 認証状態の変更を監視
  useEffect(() => {
    const handleAuthChange = () => {
      setAuthState({
        isAuthenticated: authManager.isAuthenticated(),
        user: authManager.getCurrentUser(),
        isLoading: false
      });
    };

    // 認証状態が変わった時にクラウド同期をトリガー
    if (authState.isAuthenticated && mindMap.triggerCloudSync) {
      mindMap.triggerCloudSync();
    }

    window.addEventListener('authStateChange', handleAuthChange);
    return () => window.removeEventListener('authStateChange', handleAuthChange);
  }, [authState.isAuthenticated, mindMap.triggerCloudSync]);

  // 認証検証の処理
  useEffect(() => {
    if (isAuthVerification && authToken) {
      const verifyToken = async () => {
        setAuthState(prev => ({ ...prev, isLoading: true }));
        try {
          const result = await authManager.verifyMagicLink(authToken);
          if (result.success) {
            setAuthState({
              isAuthenticated: true,
              user: result.user,
              isLoading: false
            });
            
            // URLからトークンを削除
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // 認証成功をアプリ全体に通知
            window.dispatchEvent(new CustomEvent('authStateChange'));
          }
        } catch (error) {
          console.error('認証エラー:', error);
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      };
      
      verifyToken();
    }
  }, [isAuthVerification, authToken]);

  // イベントハンドラー（V2システム用に更新）
  const handleNodeSelect = (nodeId) => {
    mindMap.setSelectedNodeId(nodeId);
    setContextMenu(null);
  };

  const handleNodeEdit = (nodeId, text) => {
    mindMap.startEdit(nodeId);
  };

  const handleNodeUpdate = async (nodeId, text) => {
    console.log('📝 MindMapApp: ノードテキスト更新', { nodeId, text });
    await mindMap.updateNodeText(nodeId, text);
  };

  const handleAddChild = async (parentId) => {
    console.log('➕ MindMapApp: 子ノード追加', { parentId });
    await mindMap.addChildNode(parentId, '', true);
  };

  const handleAddSibling = async (nodeId) => {
    console.log('👥 MindMapApp: 兄弟ノード追加', { nodeId });
    await mindMap.addSiblingNode(nodeId, '', true);
  };

  const handleDeleteNode = async (nodeId) => {
    console.log('🗑️ MindMapApp: ノード削除', { nodeId });
    await mindMap.deleteNode(nodeId);
  };

  const handleNodeDrag = async (nodeId, x, y) => {
    await mindMap.dragNode(nodeId, x, y);
  };

  const handleFileUpload = async (nodeId, files) => {
    console.log('📎 MindMapApp: ファイルアップロード', { nodeId, fileCount: files.length });
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
    console.log('🗑️ MindMapApp: ファイル削除', { nodeId, fileId });
    try {
      await mindMap.removeFileFromNode(nodeId, fileId);
    } catch (error) {
      console.error('ファイル削除エラー:', error);
      alert(`ファイル削除エラー: ${error.message}`);
    }
  };

  const handleFileDownload = async (file, nodeId) => {
    console.log('📥 MindMapApp: ファイルダウンロード', { fileName: file.name, nodeId });
    try {
      await mindMap.downloadFile(file, nodeId);
    } catch (error) {
      console.error('ファイルダウンロードエラー:', error);
      alert(`ファイルダウンロードエラー: ${error.message}`);
    }
  };

  const handleTitleUpdate = async (newTitle) => {
    console.log('✏️ MindMapApp: タイトル更新', { newTitle });
    await mindMap.updateTitle(newTitle);
  };

  const handleUndo = async () => {
    console.log('↶ MindMapApp: Undo');
    await mindMap.undo();
  };

  const handleRedo = async () => {
    console.log('↷ MindMapApp: Redo');
    await mindMap.redo();
  };

  const handleSave = async () => {
    console.log('💾 MindMapApp: 強制保存');
    await mindMap.forceSync();
  };

  // コンテキストメニューのハンドラー
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

  // レンダリング条件
  if (isAuthVerification) {
    return <AuthVerification token={authToken} />;
  }

  if (!initState.isReady) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>アプリケーションを初期化中...</p>
        {authState.isLoading && <p>認証処理中...</p>}
      </div>
    );
  }

  if (!mindMap.data) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>データを読み込み中...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="mindmap-app">
        {/* ヘッダー部分 */}
        <div className="mindmap-header">
          <Toolbar
            onAddNode={() => handleAddChild('root')}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onSave={handleSave}
            canUndo={mindMap.canUndo}
            canRedo={mindMap.canRedo}
            onExport={() => exportMindMapAsJSON(mindMap.data)}
            onImport={importMindMapFromJSON}
            onShowSidebar={() => setShowSidebar(true)}
            onShowCloudPanel={() => setShowCloudPanel(true)}
            onShowShortcutHelper={() => setShowShortcutHelper(true)}
            onShowPerformanceDash={() => setShowPerformanceDash(!showPerformanceDash)}
            currentTool={currentTool}
            onToolChange={setCurrentTool}
          />
          
          {/* 同期状態インジケーター */}
          <SyncStatusIndicator 
            syncStatus={mindMap.syncStatus}
            onForceSync={mindMap.forceSync}
          />
          
          {/* 接続状態とユーザープレゼンス */}
          <div className="connection-info">
            <ConnectionStatus />
            <UserPresence />
          </div>
        </div>

        {/* メインコンテンツエリア */}
        <div className="mindmap-content">
          {/* キャンバス */}
          <MindMapCanvas
            data={mindMap.data}
            selectedNodeId={mindMap.selectedNodeId}
            editingNodeId={mindMap.editingNodeId}
            editText={mindMap.editText}
            onNodeSelect={handleNodeSelect}
            onNodeEdit={handleNodeEdit}
            onNodeUpdate={handleNodeUpdate}
            onNodeDrag={handleNodeDrag}
            onNodeRightClick={handleRightClick}
            onAddChild={handleAddChild}
            onDeleteNode={handleDeleteNode}
            onFileUpload={handleFileUpload}
            onFileRemove={handleFileRemove}
            onShowImageModal={setImageModal}
            onShowFileActionMenu={setFileActionMenu}
            onShowNodeMapLinks={setMapLinksPanel}
            setEditText={mindMap.setEditText}
            finishEdit={mindMap.finishEdit}
            findNode={mindMap.findNode}
            toggleCollapse={mindMap.toggleCollapse}
            currentTool={currentTool}
          />

          {/* ユーザーカーソル */}
          <UserCursors />
        </div>

        {/* サイドバー */}
        {showSidebar && (
          <MindMapSidebar
            allMindMaps={multiMapOps.allMindMaps}
            currentMapId={multiMapOps.currentMapId}
            onCreateMap={multiMapOps.createMindMap}
            onRenameMap={multiMapOps.renameMindMap}
            onDeleteMap={multiMapOps.deleteMindMapById}
            onSwitchMap={(mapId) => multiMapOps.switchToMap(
              mapId, 
              false, 
              mindMap.setSelectedNodeId, 
              mindMap.setEditingNodeId, 
              mindMap.setEditText
            )}
            onClose={() => setShowSidebar(false)}
            onRefresh={multiMapOps.refreshAllMindMaps}
            onChangeCategory={multiMapOps.changeMapCategory}
            availableCategories={multiMapOps.getAvailableCategories()}
          />
        )}

        {/* クラウドストレージパネル */}
        {showCloudPanel && (
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
            allMindMaps={multiMapOps.allMindMaps}
            onAddLink={(targetMapId) => {
              console.log('🔗 マップリンク追加:', { nodeId: mapLinksPanel.node.id, targetMapId });
              // 将来的にV2システムで実装
            }}
            onRemoveLink={(linkId) => {
              console.log('🔗 マップリンク削除:', { nodeId: mapLinksPanel.node.id, linkId });
              // 将来的にV2システムで実装
            }}
            onNavigateToMap={(mapId) => multiMapOps.switchToMap(mapId)}
            onClose={() => setMapLinksPanel({ isOpen: false, node: null, position: null })}
          />
        )}

        {(showAuthModal || initState.showAuthModal) && (
          <AuthModal
            isOpen={showAuthModal || initState.showAuthModal}
            onClose={initState.showAuthModal ? initState.handleAuthClose : () => setShowAuthModal(false)}
            onAuthSuccess={(user) => {
              setAuthState({ isAuthenticated: true, user, isLoading: false });
              if (initState.showAuthModal) {
                initState.handleAuthSuccess();
              } else {
                setShowAuthModal(false);
              }
              window.dispatchEvent(new CustomEvent('authStateChange'));
            }}
          />
        )}

        {showShortcutHelper && (
          <KeyboardShortcutHelper
            onClose={() => setShowShortcutHelper(false)}
          />
        )}

        {(showOnboarding || initState.showOnboarding) && (
          <TutorialOverlay
            onComplete={initState.showOnboarding ? initState.handleOnboardingComplete : completeOnboarding}
            onSkip={initState.showOnboarding ? initState.handleOnboardingComplete : () => setShowOnboarding(false)}
          />
        )}

        {showPerformanceDash && (
          <PerformanceDashboard
            onClose={() => setShowPerformanceDash(false)}
            syncStatus={mindMap.syncStatus}
          />
        )}

        {/* コラボレーション機能 */}
        <CollaborativeFeatures />
        <ConflictNotification />

        {/* 初回セットアップ */}
        {initState.showStorageModeSelector && (
          <StorageModeSelector
            onModeSelect={initState.handleStorageModeSelect}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default MindMapApp;