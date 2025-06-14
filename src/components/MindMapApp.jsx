import React, { useState, useEffect } from 'react';
import { useMindMap } from '../hooks/useMindMap';
import Toolbar from './Toolbar';
import MindMapCanvas from './MindMapCanvas';
import NodeCustomizationPanel from './NodeCustomizationPanel';
import ContextMenu from './ContextMenu';
import LayoutPanel from './LayoutPanel';
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
    toggleCollapse
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
    const newNodeId = addChildNode(parentId);
    if (newNodeId) {
      setSelectedNodeId(newNodeId);
      startEdit(newNodeId);
    }
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
    const newNodeId = addSiblingNode(nodeId);
    if (newNodeId) {
      setSelectedNodeId(newNodeId);
      startEdit(newNodeId);
    }
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
        text: clipboard.text || '新しいノード',
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
      <div className="container">
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
          onAddChild={handleAddChild}
          onAddSibling={handleAddSibling}
          onDeleteNode={deleteNode}
          onRightClick={handleRightClick}
          onToggleCollapse={toggleCollapse}
          zoom={zoom}
          setZoom={setZoom}
          pan={pan}
          setPan={setPan}
        />

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
