import React, { useState, useMemo } from 'react';
import { useMindMap } from '../../core/hooks/useMindMap';
import Toolbar from '../common/Toolbar';
import MindMapCanvas from './MindMapCanvas';
import NodeCustomizationPanel from './NodeCustomizationPanel';
import ContextMenu from '../common/ContextMenu';
import { ErrorBoundary } from '../../../shared/components';
import ImageModal from '../files/ImageModal';
import FileActionMenu from '../files/FileActionMenu';
import MindMapSidebar from './MindMapSidebar';
import NodeMapLinksPanel from '../../panels/MapLinksPanel';
import './MindMapApp.css';

import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts';

// カスタムフックのインポート
import { useFileHandlers } from './hooks/useFileHandlers';
import { useMapHandlers } from './hooks/useMapHandlers';
import { useUIState } from './hooks/useUIState';
import { useNodeHandlers } from './hooks/useNodeHandlers';

// サービスのインポート
import { LocalMindMapService } from '../../core/services';
import { useCommandHistory } from '../../core/hooks/useCommandHistory';

// Types
import type { MindMapNode, Position } from '../../shared/types';

const MindMapApp: React.FC = () => {
  const [isAppReady] = useState(true);
  
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
    changeParent,
    changeSiblingOrder,
    findNode,
    flattenNodes,
    startEdit,
    finishEdit,
    updateTitle,
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
  const commandHistory = useCommandHistory();
  
  // サービスレイヤーの初期化
  const mindMapService = useMemo(() => new LocalMindMapService(
    { 
      addChildNode, 
      updateNode, 
      findNode,
      attachFileToNode,
      removeFileFromNode,
      downloadFile,
      renameFileInNode,
      changeParent,
      changeSiblingOrder,
      deleteNode
    },
    fileHandlers,
    mapHandlers,
    uiState,
    commandHistory
  ), [addChildNode, updateNode, findNode, attachFileToNode, removeFileFromNode, downloadFile, renameFileInNode, changeParent, changeSiblingOrder, deleteNode, fileHandlers, mapHandlers, uiState, commandHistory]);

  const nodeHandlers = useNodeHandlers(
    setSelectedNodeId,
    (position: Position | null) => uiState.setContextMenuPosition(position || { x: 0, y: 0 }),
    uiState.setShowContextMenu,
    uiState.setShowCustomizationPanel,
    (parentId: string, text?: string, startEditing?: boolean) => {
      mindMapService.addChildNodeWithCommand(parentId, text || '', { startEditing });
      return Promise.resolve(null);
    },
    addSiblingNode,
    (nodeId: string, updates: Partial<MindMapNode>) => mindMapService.updateNodeWithCommand(nodeId, updates),
    (nodeId: string, targetMapId: string) => mindMapService.addNodeMapLink(nodeId, targetMapId),
    (nodeId: string, linkId: string) => mindMapService.removeNodeMapLink(nodeId, linkId),
    () => {} // No cursor update in local mode
  );
  
  // キーボードショートカットの統合を復元
  useKeyboardShortcuts({
    selectedNodeId,
    editingNodeId,
    setEditText,
    startEdit,
    finishEdit,
    editText,
    updateNode: (nodeId: string, updates: Partial<MindMapNode>) => mindMapService.updateNodeWithCommand(nodeId, updates),
    addChildNode: async (parentId: string, text = '', startEditing = false) => {
      mindMapService.addChildNodeWithCommand(parentId, text, { startEditing });
      return Promise.resolve(null);
    },
    addSiblingNode,
    deleteNode: (nodeId: string) => mindMapService.deleteNodeWithCommand(nodeId),
    undo: () => mindMapService.undo(),
    redo: () => mindMapService.redo(),
    canUndo: mindMapService.canUndo(),
    canRedo: mindMapService.canRedo(),
    navigateToDirection,
    showMapList: uiState.showMapList,
    setShowMapList: uiState.setShowMapList,
    showLocalStorage: uiState.showLocalStoragePanel,
    setShowLocalStorage: uiState.setShowLocalStoragePanel,
    showTutorial: uiState.showTutorial,
    setShowTutorial: uiState.setShowTutorial,
    showKeyboardHelper: uiState.showShortcutHelper,
    setShowKeyboardHelper: uiState.setShowShortcutHelper
  });

  // ビジネスロジックハンドラー（サービス経由）
  const handleRightClick = (e: React.MouseEvent, nodeId: string): void => {
    nodeHandlers.handleRightClick(e, nodeId);
    uiState.handleCloseAllPanels();
  };

  const handleCopyNode = (node: MindMapNode): void => {
    const clipboard = mindMapService.copyNode(node);
    uiState.setClipboard(clipboard);
  };

  const handlePasteNode = async (parentId: string): Promise<void> => {
    try {
      await mindMapService.pasteNode(parentId, uiState.clipboard);
    } catch (error) {
      console.error('ノードの貼り付けエラー:', error);
      alert('ノードの貼り付けに失敗しました: ' + (error as Error).message);
    }
  };

  const handleShowNodeMapLinks = (node: MindMapNode, position: { x: number; y: number }): void => {
    mindMapService.showNodeMapLinks(node, position);
  };

  const handleNavigateToMap = async (mapId: string): Promise<void> => {
    try {
      await mindMapService.navigateToMap(mapId);
    } catch (error) {
      console.error('マップナビゲーションエラー:', error);
      alert((error as Error).message);
    }
  };

  // ローディング表示
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
              onExport={() => {}} // TODO: implement export functionality
              onImport={async () => {}} // TODO: implement import functionality
              onUndo={async () => { mindMapService.undo(); }}
              onRedo={async () => { mindMapService.redo(); }}
              canUndo={mindMapService.canUndo()}
              canRedo={mindMapService.canRedo()}
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
                onChangeParent={changeParent}
                onChangeSiblingOrder={changeSiblingOrder}
                onAddChild={nodeHandlers.handleAddChild}
                onAddSibling={nodeHandlers.handleAddSibling}
                onDeleteNode={(nodeId: string) => mindMapService.deleteNodeWithCommand(nodeId)}
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

            {uiState.showCustomizationPanel && (
              <NodeCustomizationPanel
                selectedNode={selectedNodeId ? findNode(selectedNodeId) : null}
                onUpdateNode={(nodeId: string, updates: Partial<MindMapNode>) => mindMapService.updateNodeWithCommand(nodeId, updates)}
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
                onDelete={(nodeId: string) => mindMapService.deleteNodeWithCommand(nodeId)}
                onCustomize={uiState.handleShowCustomization}
                onCopy={handleCopyNode}
                onPaste={(parentId: string) => handlePasteNode(parentId)}
                onChangeColor={(nodeId: string, color: string) => mindMapService.updateNodeWithCommand(nodeId, { color })}
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
                  ノード数: {data?.rootNode ? flattenNodes().length : 0} | 
                  最終更新: {data?.updatedAt ? new Date(data.updatedAt).toLocaleString('ja-JP') : 'N/A'}
                </span>
              </div>
            </footer>
          </div>
        </>
      ) : null}

      {/* キーボードショートカットヘルパー - 現在未実装 */}
    </div>
  );
};

export default MindMapApp;