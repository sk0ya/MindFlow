import React, { useState, useEffect } from 'react';
import { useMindMap } from '../hooks/useMindMap';
import Toolbar from './Toolbar';
import MindMapCanvas from './MindMapCanvas';
import NodeCustomizationPanel from './NodeCustomizationPanel';
import ContextMenu from './ContextMenu';
import LayoutPanel from './LayoutPanel';
import ErrorBoundary from './ErrorBoundary';
import ImageModal from './ImageModal';
import FileActionMenu from './FileActionMenu';
import MindMapSidebar from './MindMapSidebar';
import NodeMapLinksPanel from './MapLinksPanel';
import { exportMindMapAsJSON, importMindMapFromJSON } from '../utils/storage';
import { layoutPresets } from '../utils/autoLayout';
import './MindMapApp.css';

const MindMapApp = () => {
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
    removeNodeMapLink
  } = useMindMap();

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showCustomizationPanel, setShowCustomizationPanel] = useState(false);
  const [customizationPosition, setCustomizationPosition] = useState({ x: 0, y: 0 });
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showLayoutPanel, setShowLayoutPanel] = useState(false);
  const [layoutPanelPosition, setLayoutPanelPosition] = useState({ x: 100, y: 100 });
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

  const handleSave = () => {
    saveMindMap();
    showSaveMessage();
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            handleSave();
            break;
          case 'z':
            if (e.shiftKey) {
              e.preventDefault();
              redo();
            } else {
              e.preventDefault();
              undo();
            }
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
          default:
            break;
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleSave, undo, redo]);

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

  const handleShowLayoutPanel = () => {
    setLayoutPanelPosition({ x: 100, y: 100 });
    setShowLayoutPanel(true);
    setShowCustomizationPanel(false);
    setShowContextMenu(false);
  };

  const handleApplyLayout = async (layoutKey) => {
    const preset = layoutPresets[layoutKey];
    if (!preset?.func) return;

    try {
      const newRootNode = preset.func(data.rootNode, {
        centerX: 400,
        centerY: 300
      });
      
      const updateNodePositions = (node) => {
        updateNode(node.id, { x: node.x, y: node.y });
        if (node.children) node.children.forEach(updateNodePositions);
      };
      
      updateNodePositions(newRootNode);
      setPan({ x: 0, y: 0 });
    } catch (error) {
      console.error('レイアウト適用エラー:', error);
      throw error;
    }
  };

  const handleCloseAllPanels = () => {
    setShowCustomizationPanel(false);
    setShowContextMenu(false);
    setShowLayoutPanel(false);
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseAllPanels();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleCloseAllPanels]);

  return (
    <div className="mindmap-app">
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
          onSave={handleSave}
          onExport={handleExport}
          onImport={handleImport}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          zoom={zoom}
          onZoomReset={handleZoomReset}
          onShowLayoutPanel={handleShowLayoutPanel}
        />

        <ErrorBoundary>
          <MindMapCanvas
            data={data}
            selectedNodeId={selectedNodeId}
            editingNodeId={editingNodeId}
            editText={editText}
            setEditText={setEditText}
            onSelectNode={setSelectedNodeId}
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

        {showLayoutPanel && (
          <LayoutPanel
            visible={true}
            position={layoutPanelPosition}
            data={data}
            onApplyLayout={handleApplyLayout}
            onClose={() => setShowLayoutPanel(false)}
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

        <footer className="footer">
          <p>
            <span className="footer-brand">© 2024 MindFlow</span>
            <span className="stats">
              ノード数: {flattenNodes(data.rootNode).length} | 
              最終更新: {new Date(data.updatedAt).toLocaleString('ja-JP')}
            </span>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default MindMapApp;
