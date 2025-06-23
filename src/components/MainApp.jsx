import React, { useState } from 'react';
import ErrorBoundary from './ErrorBoundary';
import Toolbar from './Toolbar';
import MindMapCanvas from './MindMapCanvas';
import NodeCustomizationPanel from './NodeCustomizationPanel';
import ContextMenu from './ContextMenu';
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
import AuthModal from './AuthModal.jsx';
import TutorialOverlay from './TutorialOverlay.jsx';
import KeyboardShortcutHelper from './KeyboardShortcutHelper.jsx';
import { exportMindMapAsJSON, importMindMapFromJSON } from '../utils/storageRouter';

const MainApp = ({
  mindMap,
  multiMapOps,
  authState,
  setAuthState,
  showAuthModal,
  setShowAuthModal,
  showOnboarding,
  completeOnboarding,
  setShowOnboarding
}) => {
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
  const [showShortcutHelper, setShowShortcutHelper] = useState(false);

  // イベントハンドラー
  const handleNodeSelect = (nodeId) => {
    mindMap.setSelectedNodeId(nodeId);
    setContextMenu(null);
  };

  const handleNodeEdit = (nodeId, text) => {
    mindMap.startEdit(nodeId);
  };

  const handleNodeUpdate = async (nodeId, text) => {
    await mindMap.updateNodeText(nodeId, text);
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

  return (
    <ErrorBoundary>
      <div className="mindmap-app">
        {/* ヘッダー部分 */}
        <div className="mindmap-header">
          <Toolbar
            onAddNode={() => handleAddChild('root')}
            onUndo={mindMap.undo}
            onRedo={mindMap.redo}
            onSave={mindMap.forceSync}
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
            authState={authState}
            setAuthState={setAuthState}
          />
          
          <SyncStatusIndicator 
            syncStatus={mindMap.syncStatus}
            onForceSync={mindMap.forceSync}
          />
          
          <div className="connection-info">
            <ConnectionStatus />
            <UserPresence />
          </div>
        </div>

        {/* メインコンテンツエリア */}
        <div className="mindmap-content">
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
            zoom={mindMap.zoom}
            setZoom={mindMap.setZoom}
            pan={mindMap.pan}
            setPan={mindMap.setPan}
          />

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
            onSwitchMap={async (mapId) => {
              try {
                await multiMapOps.switchToMap(
                  mapId, 
                  false, 
                  mindMap.setSelectedNodeId, 
                  mindMap.setEditingNodeId, 
                  mindMap.setEditText
                );
              } catch (error) {
                console.error('マップ切り替えエラー:', error);
                alert('マップの切り替えに失敗しました: ' + error.message);
              }
            }}
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
            }}
            onRemoveLink={(linkId) => {
              console.log('🔗 マップリンク削除:', { nodeId: mapLinksPanel.node.id, linkId });
            }}
            onNavigateToMap={async (mapId) => {
              try {
                await multiMapOps.switchToMap(mapId);
              } catch (error) {
                console.error('マップナビゲーションエラー:', error);
                alert('マップの切り替えに失敗しました: ' + error.message);
              }
            }}
            onClose={() => setMapLinksPanel({ isOpen: false, node: null, position: null })}
          />
        )}

        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onAuthSuccess={(user) => {
              setAuthState({ isAuthenticated: true, user, isLoading: false });
              setShowAuthModal(false);
              window.dispatchEvent(new CustomEvent('authStateChange'));
            }}
          />
        )}

        {showShortcutHelper && (
          <KeyboardShortcutHelper
            onClose={() => setShowShortcutHelper(false)}
          />
        )}

        {showOnboarding && (
          <TutorialOverlay
            isVisible={true}
            onComplete={completeOnboarding}
            onSkip={() => setShowOnboarding(false)}
          />
        )}

        {showPerformanceDash && (
          <PerformanceDashboard
            onClose={() => setShowPerformanceDash(false)}
            syncStatus={mindMap.syncStatus}
          />
        )}

        <CollaborativeFeatures />
        <ConflictNotification />
      </div>
    </ErrorBoundary>
  );
};

export default MainApp;