import React, { useState } from 'react';
import { useMindMap } from '../../../core/hooks/useMindMap';
import Toolbar from '../common/Toolbar';
import MindMapCanvas from './MindMapCanvas';
import NodeCustomizationPanel from './NodeCustomizationPanel';
import ContextMenu from '../common/ContextMenu';
import { ErrorBoundary } from '../../../../shared/components';
import ImageModal from '../files/ImageModal';
import FileActionMenu from '../files/FileActionMenu';
import MindMapSidebar from './MindMapSidebar';
import NodeMapLinksPanel from '../../panels/MapLinksPanel';
import './MindMapApp.css';

import KeyboardShortcutHelper from '../common/KeyboardShortcutHelper';
import { useKeyboardShortcuts } from '../../../core/hooks/useKeyboardShortcuts';

// カスタムフックのインポート
import { useFileHandlers } from './hooks/useFileHandlers';
import { useMapHandlers } from './hooks/useMapHandlers';
import { useUIState } from './hooks/useUIState';
import { useNodeHandlers } from './hooks/useNodeHandlers';
import { useAppActions } from './hooks/useAppActions';

// Types
import type { MindMapNode, Position } from '../../../shared/types';

const MindMapApp: React.FC = () => {
  // ローカルモードでは認証不要
  
  // ローカルモードでは単純な初期化（認証やモード選択は不要）
  const [isAppReady] = useState(true);
  
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
    changeMapCategory,
    getAvailableCategories
  } = useMindMap(isAppReady);
  
  

  // ローカルモードでは既にモード選択済みなので不要

  // ローカルモードでは認証不要

  // カスタムフックで機能を分離（ローカルモードでは認証ハンドラーは上で定義済み）
  
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
    (position: Position | null) => uiState.setContextMenuPosition(position || { x: 0, y: 0 }),
    uiState.setShowContextMenu,
    uiState.setShowCustomizationPanel,
    addChildNode,
    addSiblingNode,
    updateNode,
    () => Promise.resolve(), // Placeholder for addNodeMapLink
    () => Promise.resolve(), // Placeholder for removeNodeMapLink  
    () => {} // No cursor update in local mode
  );
  
  const appActions = useAppActions(data, saveMindMap);
  

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
    showLocalStorage: uiState.showLocalStoragePanel,
    setShowLocalStorage: uiState.setShowLocalStoragePanel,
    showTutorial: uiState.showTutorial,
    setShowTutorial: uiState.setShowTutorial,
    showKeyboardHelper: uiState.showShortcutHelper,
    setShowKeyboardHelper: uiState.setShowShortcutHelper
  });
  
  // ローカルモードでは初期化完了（認証不要）

  // ローカルモードでは認証チェック不要

  // ファイルアクションメニューのハンドラーを拡張

  // コンテキストメニューのハンドラー
  const handleRightClick = (e: React.MouseEvent, nodeId: string): void => {
    nodeHandlers.handleRightClick(e, nodeId);
    uiState.handleCloseAllPanels();
  };

  const handleCopyNode = (node: MindMapNode): void => {
    const clipboard = nodeHandlers.handleCopyNode(node);
    uiState.setClipboard(clipboard);
  };

  const handlePasteNode = (parentId: string): void => {
    nodeHandlers.handlePasteNode(parentId, uiState.clipboard);
  };

  // ノードマップリンクのハンドラー
  const handleShowNodeMapLinks = (node: MindMapNode, position: { x: number; y: number }): void => {
    uiState.handleShowNodeMapLinks(node, position);
  };

  const handleNavigateToMap = async (mapId: string): Promise<void> => {
    try {
      await mapHandlers.handleNavigateToMap(mapId);
      uiState.handleCloseNodeMapLinksPanel();
    } catch (error) {
      console.error('マップナビゲーションエラー:', error);
      alert('マップの切り替えに失敗しました: ' + (error as Error).message);
    }
  };

  // ローカルモードでは認証検証は不要（スキップ）

  // ローカルモードでは初期化処理不要

  // ローカルモードではデータが無い場合のみローディング表示
  if (!data) {
    return (
      <div className="mindmap-app loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>MindFlow</h2>
          <p>ローカルデータを読み込み中...</p>
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
              onShowLocalStoragePanel={() => uiState.setShowLocalStoragePanel(true)}
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

            {/* ローカルモードではリアルタイム機能UI不要 */}

            {/* ローカルモード専用機能 */}

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
                onChangeColor={(nodeId: string, color: string) => updateNode(nodeId, { color })}
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
                currentMapId={currentMapId || ''}
                allMaps={allMindMaps}
                onClose={uiState.handleCloseNodeMapLinksPanel}
                onAddLink={nodeHandlers.handleAddNodeMapLink}
                onRemoveLink={nodeHandlers.handleRemoveNodeMapLink}
                onNavigateToMap={handleNavigateToMap}
              />
            )}

            {/* ローカルモードではストレージパネルは不要 */}

            <footer className="footer">
              <div>
                <span className="footer-brand">© 2024 MindFlow</span>
                <span className="stats">
                  ノード数: {data?.rootNode ? flattenNodes(data.rootNode).length : 0} | 
                  最終更新: {data?.updatedAt ? new Date(data.updatedAt).toLocaleString('ja-JP') : 'N/A'}
                </span>
                {/* ローカルモードでは同期ステータス不要 */}
              </div>
            </footer>
          </div>
        </>
      ) : null}

      {/* キーボードショートカットヘルパー（ローカルモード用） */}
      <KeyboardShortcutHelper
        isVisible={uiState.showShortcutHelper}
        onClose={() => uiState.setShowShortcutHelper(false)}
      />
    </div>
  );
};

export default MindMapApp;