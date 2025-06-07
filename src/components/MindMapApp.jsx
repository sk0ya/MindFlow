import React, { useState, useCallback, useEffect } from 'react';
import { useMindMap } from '../hooks/useMindMap';
import Toolbar from './Toolbar';
import MindMapCanvas from './MindMapCanvas';
import NodeCustomizationPanel from './NodeCustomizationPanel';
import ContextMenu from './ContextMenu';
import LayoutPanel from './LayoutPanel';
import { exportMindMapAsJSON, importMindMapFromJSON } from '../utils/storage';
import { layoutPresets } from '../utils/autoLayout';

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

  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleExport = useCallback(() => {
    exportMindMapAsJSON(data);
  }, [data]);

  const handleImport = useCallback(async (file) => {
    try {
      await importMindMapFromJSON(file);
      window.location.reload();
    } catch (error) {
      alert('ファイルの読み込みに失敗しました: ' + error.message);
    }
  }, []);

  const handleSave = useCallback(() => {
    saveMindMap();
    const saveMessage = document.createElement('div');
    saveMessage.textContent = '保存完了！';
    saveMessage.style.cssText = `
      position: fixed;
      top: 32px;
      right: 32px;
      background: #10b981;
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      z-index: 1000;
      font-weight: 600;
      font-size: 14px;
    `;
    document.body.appendChild(saveMessage);
    
    setTimeout(() => {
      if (document.body.contains(saveMessage)) {
        document.body.removeChild(saveMessage);
      }
    }, 3000);
  }, [saveMindMap]);

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

  const handleAddChild = useCallback((parentId) => {
    const newNodeId = addChildNode(parentId);
    if (newNodeId) {
      setSelectedNodeId(newNodeId);
      startEdit(newNodeId);
    }
  }, [addChildNode, setSelectedNodeId, startEdit]);

  const handleShowCustomization = useCallback((node, position) => {
    setCustomizationPosition(position || { x: 300, y: 200 });
    setShowCustomizationPanel(true);
    setShowContextMenu(false);
  }, []);

  const handleUpdateNodeCustomization = useCallback((nodeId, customizations) => {
    updateNode(nodeId, customizations);
  }, [updateNode]);

  const handleRightClick = useCallback((e, nodeId) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (nodeId) {
      setSelectedNodeId(nodeId);
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setShowContextMenu(true);
      setShowCustomizationPanel(false);
    }
  }, [setSelectedNodeId]);

  const handleAddSibling = useCallback((nodeId) => {
    const newNodeId = addSiblingNode(nodeId);
    if (newNodeId) {
      setSelectedNodeId(newNodeId);
      startEdit(newNodeId);
    }
  }, [addSiblingNode, setSelectedNodeId, startEdit]);

  const handleCopyNode = useCallback((node) => {
    const nodeCopy = JSON.parse(JSON.stringify(node));
    const removeIds = (n) => {
      delete n.id;
      if (n.children) {
        n.children.forEach(removeIds);
      }
    };
    removeIds(nodeCopy);
    setClipboard(nodeCopy);
  }, []);

  const handlePasteNode = useCallback((parentId) => {
    if (clipboard) {
      const newNodeId = addChildNode(parentId);
      if (newNodeId) {
        const newNode = findNode(newNodeId);
        if (newNode) {
          updateNode(newNodeId, {
            text: clipboard.text || '新しいノード',
            fontSize: clipboard.fontSize,
            fontWeight: clipboard.fontWeight,
            fontStyle: clipboard.fontStyle
          });
          setSelectedNodeId(newNodeId);
        }
      }
    }
  }, [clipboard, addChildNode, findNode, updateNode, setSelectedNodeId]);

  const handleShowLayoutPanel = useCallback(() => {
    setLayoutPanelPosition({ x: 100, y: 100 });
    setShowLayoutPanel(true);
    setShowCustomizationPanel(false);
    setShowContextMenu(false);
  }, []);

  const handleApplyLayout = useCallback(async (layoutKey) => {
    const preset = layoutPresets[layoutKey];
    if (preset && preset.func) {
      try {
        const newRootNode = preset.func(data.rootNode, {
          centerX: 400,
          centerY: 300
        });
        
        const updateNodePositions = (node) => {
          updateNode(node.id, { x: node.x, y: node.y });
          if (node.children) {
            node.children.forEach(updateNodePositions);
          }
        };
        
        updateNodePositions(newRootNode);
        setPan({ x: 0, y: 0 });
        
        return Promise.resolve();
      } catch (error) {
        console.error('レイアウト適用エラー:', error);
        return Promise.reject(error);
      }
    }
  }, [data.rootNode, updateNode, setPan]);

  const handleCloseAllPanels = useCallback(() => {
    setShowCustomizationPanel(false);
    setShowContextMenu(false);
    setShowLayoutPanel(false);
  }, []);

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

        <NodeCustomizationPanel
          selectedNode={selectedNodeId ? findNode(selectedNodeId) : null}
          onUpdateNode={handleUpdateNodeCustomization}
          onClose={() => setShowCustomizationPanel(false)}
          position={customizationPosition}
        />

        <ContextMenu
          visible={showContextMenu}
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

        <LayoutPanel
          visible={showLayoutPanel}
          position={layoutPanelPosition}
          data={data}
          onApplyLayout={handleApplyLayout}
          onClose={() => setShowLayoutPanel(false)}
        />

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

      <style jsx>{`
        .mindmap-app {
          min-height: 100vh;
          background: white;
          position: relative;
          padding: 2px;
          overflow-x: hidden;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        .footer {
          margin-top: 2px;
          padding: 6px;
          text-align: center;
          background: #f8f9fa;
          border: 1px solid #e1e5e9;
          border-radius: 16px;
          position: relative;
          overflow: hidden;
        }

        .footer p {
          margin: 0;
          font-size: 10px;
          color: #64748b;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .footer-brand {
          color: #374151;
          font-weight: 600;
        }

        .stats {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 6px 12px;
          background: #e1e5e9;
          border-radius: 8px;
          font-weight: 600;
          color: #374151;
          position: relative;
        }

        @media (max-width: 1024px) {
          .mindmap-app {
            padding: 6px;
          }

          .footer {
            margin-top: 6px;
            padding: 8px;
          }

          .footer p {
            flex-direction: column;
            gap: 12px;
          }

          .stats {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 768px) {
          .mindmap-app {
            padding: 4px;
          }

          .footer {
            margin-top: 4px;
            padding: 6px;
          }

          .footer p {
            font-size: 11px;
          }

          .stats {
            font-size: 13px;
          }
        }

        :global(body) {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Inter', 'Oxygen',
            'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
            sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          background: white;
          overflow-x: hidden;
        }

        :global(*) {
          box-sizing: border-box;
        }

        :global(button) {
          font-family: inherit;
          outline: none;
        }

        :global(input) {
          font-family: inherit;
          outline: none;
        }

        :global(select) {
          font-family: inherit;
          outline: none;
        }
      `}</style>
    </div>
  );
};

export default MindMapApp;
