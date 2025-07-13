import React, { useState } from 'react';
import { useMindMapSimplified, useKeyboardShortcuts } from '@local/core';
import MindMapSidebar from '../MindMapSidebar';
import MindMapHeader from './MindMapHeader';
import MindMapWorkspace from './MindMapWorkspace';
import MindMapModals from '../MindMapModals';
import MindMapFooter from '../MindMapFooter';
import './MindMapApp.css';

// カスタムフックのインポート
import { useFileHandlers, useMapHandlers, useNodeHandlers } from '../../hooks';

// Types
import type { MindMapNode, Position, FileAttachment } from '@local/shared';

const MindMapApp: React.FC = () => {
  const [isAppReady] = useState(true);
  const mindMap = useMindMapSimplified(isAppReady);
  const { data, selectedNodeId, editingNodeId, editText, ui, canUndo, canRedo, allMindMaps, currentMapId } = mindMap;
  
  const fileHandlers = useFileHandlers(
    async (_nodeId: string, file: File): Promise<FileAttachment> => {
      return {
        id: `file_${Date.now()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        isImage: file.type.startsWith('image/'),
        createdAt: new Date().toISOString(),
        data: ''
      };
    },
    async () => {},
    async () => {},
    async () => {}
  );
  
  const mapHandlers = useMapHandlers(
    allMindMaps,
    async (mapId: string) => {
      mindMap.selectMap(mapId);
    },
    async (name: string, category: string): Promise<string> => {
      mindMap.createMap(name, category);
      return 'new-map-id';
    },
    async (mapId: string): Promise<boolean> => {
      mindMap.deleteMap(mapId);
      return true;
    },
    async (mapId: string, newTitle: string) => {
      mindMap.renameMap(mapId, newTitle);
    },
    async (mapId: string, category: string) => {
      mindMap.changeCategory(mapId, category);
    }
  );
  
  const nodeHandlers = useNodeHandlers(
    mindMap.setSelectedNodeId,
    (position: Position | null) => mindMap.setContextMenuPosition(position || { x: 0, y: 0 }),
    mindMap.setShowContextMenu,
    mindMap.setShowCustomizationPanel,
    async (parentId: string, text?: string, startEditing?: boolean): Promise<string> => {
      const newNodeId = await mindMap.addChildNode(parentId, text || '');
      if (startEditing && newNodeId) {
        mindMap.startEditingNode(newNodeId);
      }
      return newNodeId || '';
    },
    mindMap.addSiblingNode,
    (nodeId: string, updates: Partial<MindMapNode>) => mindMap.updateNode(nodeId, updates),
    (_nodeId: string, _targetMapId: string) => {},
    (_nodeId: string, _linkId: string) => {},
    () => {}
  );
  
  useKeyboardShortcuts({
    selectedNodeId,
    editingNodeId,
    setEditText: mindMap.setEditText,
    startEdit: mindMap.startEditingNode,
    finishEdit: async (nodeId: string, newText?: string) => {
      mindMap.finishEditingNode(nodeId, newText || '');
    },
    editText,
    updateNode: (nodeId: string, updates: Partial<MindMapNode>) => mindMap.updateNode(nodeId, updates),
    addChildNode: async (parentId: string, text = '', startEditingAfter = false) => {
      const newNodeId = await mindMap.addChildNode(parentId, text);
      if (startEditingAfter && newNodeId) {
        mindMap.startEditingNode(newNodeId);
      }
      return Promise.resolve(null);
    },
    addSiblingNode: async (nodeId: string, text = '', startEditingAfter = false) => {
      const newNodeId = await mindMap.addSiblingNode(nodeId, text);
      if (startEditingAfter && newNodeId) {
        mindMap.startEditingNode(newNodeId);
      }
      return Promise.resolve(null);
    },
    deleteNode: (nodeId: string) => mindMap.deleteNode(nodeId),
    undo: () => mindMap.undo(),
    redo: () => mindMap.redo(),
    canUndo: canUndo,
    canRedo: canRedo,
    navigateToDirection: (_direction: string) => {},
    showMapList: ui.showMapList,
    setShowMapList: mindMap.setShowMapList,
    showLocalStorage: ui.showLocalStoragePanel,
    setShowLocalStorage: mindMap.setShowLocalStoragePanel,
    showTutorial: ui.showTutorial,
    setShowTutorial: mindMap.setShowTutorial,
    showKeyboardHelper: ui.showShortcutHelper,
    setShowKeyboardHelper: mindMap.setShowShortcutHelper
  });

  const handleRightClick = (e: React.MouseEvent, nodeId: string): void => {
    nodeHandlers.handleRightClick(e, nodeId);
    mindMap.closeAllPanels();
  };

  const handleCopyNode = (node: MindMapNode): void => {
    mindMap.setClipboard(node);
  };

  const handlePasteNode = async (parentId: string): Promise<void> => {
    if (ui.clipboard) {
      const newNodeId = await mindMap.addChildNode(parentId, ui.clipboard.text || '');
      if (newNodeId) {
        mindMap.updateNode(newNodeId, { 
          color: ui.clipboard.color,
          fontSize: ui.clipboard.fontSize,
          fontWeight: ui.clipboard.fontWeight
        });
      }
    }
  };

  const handleShowNodeMapLinks = (node: MindMapNode, position: { x: number; y: number }): void => {
    mindMap.showNodeMapLinks(node, position);
  };

  const handleNavigateToMap = async (mapId: string): Promise<void> => {
    mindMap.selectMap(mapId);
    mindMap.closeAllPanels();
  };

  // mindMapオブジェクトの状態をログ出力
  console.log('🚀 MindMapApp mindMapオブジェクト確認:', {
    hasMindMap: !!mindMap,
    hasChangeSiblingOrder: !!mindMap?.changeSiblingOrder,
    changeSiblingOrderType: typeof mindMap?.changeSiblingOrder,
    hasChangeParent: !!mindMap?.moveNode,
    hasMoveNode: !!mindMap?.moveNode
  });

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
            availableCategories={[...new Set(allMindMaps.map(map => map.category || '未分類'))]}
            isCollapsed={ui.sidebarCollapsed}
            onToggleCollapse={mindMap.toggleSidebar}
          />
          
          <div className={`container ${ui.sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
            <MindMapHeader
              data={data}
              onTitleChange={(title: string) => mindMap.updateNode('root', { text: title })}
              onExport={() => {}} // TODO: implement export functionality
              onImport={async () => {}} // TODO: implement import functionality
              onUndo={async () => { mindMap.undo(); }}
              onRedo={async () => { mindMap.redo(); }}
              canUndo={canUndo}
              canRedo={canRedo}
              zoom={ui.zoom}
              onZoomReset={mindMap.resetZoom}
              onShowLocalStoragePanel={() => mindMap.setShowLocalStoragePanel(true)}
              onShowShortcutHelper={() => mindMap.setShowShortcutHelper(true)}
              onAutoLayout={() => mindMap.applyAutoLayout()}
              onToggleSidebar={mindMap.toggleSidebar}
              showSidebar={!ui.sidebarCollapsed}
            />

            <MindMapWorkspace
              data={data}
              selectedNodeId={selectedNodeId}
              editingNodeId={editingNodeId}
              editText={editText}
              setEditText={mindMap.setEditText}
              onSelectNode={nodeHandlers.handleNodeSelect}
              onStartEdit={mindMap.startEditingNode}
              onFinishEdit={mindMap.finishEditingNode}
              onMoveNode={mindMap.moveNode}
              onChangeSiblingOrder={mindMap.changeSiblingOrder}
              onAddChild={nodeHandlers.handleAddChild}
              onAddSibling={nodeHandlers.handleAddSibling}
              onDeleteNode={mindMap.deleteNode}
              onRightClick={handleRightClick}
              onToggleCollapse={(nodeId: string) => {
                const node = mindMap.findNode(nodeId);
                if (node) {
                  mindMap.updateNode(nodeId, { collapsed: !node.collapsed });
                }
              }}
              onFileUpload={fileHandlers.handleFileUpload}
              onRemoveFile={fileHandlers.handleRemoveFile}
              onShowImageModal={fileHandlers.handleShowImageModal}
              onShowFileActionMenu={fileHandlers.handleShowFileActionMenu}
              onShowNodeMapLinks={handleShowNodeMapLinks}
              zoom={ui.zoom}
              setZoom={mindMap.setZoom}
              pan={ui.pan}
              setPan={(pan: Position | ((_prev: Position) => Position)) => {
                if (typeof pan === 'function') {
                  const currentPan = ui.pan;
                  mindMap.setPan(pan(currentPan));
                } else {
                  mindMap.setPan(pan);
                }
              }}
            />

            <MindMapModals
              ui={ui}
              selectedNodeId={selectedNodeId}
              findNode={mindMap.findNode}
              onAddChild={nodeHandlers.handleAddChild}
              onAddSibling={nodeHandlers.handleAddSibling}
              onDeleteNode={mindMap.deleteNode}
              onUpdateNode={mindMap.updateNode}
              onCopyNode={handleCopyNode}
              onPasteNode={handlePasteNode}
              onShowCustomization={(node: MindMapNode) => {
                mindMap.showCustomization(node, ui.contextMenuPosition);
              }}
              onFileDownload={fileHandlers.handleFileDownload}
              onFileRename={(_fileId: string, _newName: string) => {}}
              onFileDelete={(_fileId: string) => {}}
              onAddNodeMapLink={(_nodeId: string, _targetMapId: string) => {}}
              onRemoveNodeMapLink={(_nodeId: string, _linkId: string) => {}}
              onNavigateToMap={handleNavigateToMap}
              onCloseCustomizationPanel={() => mindMap.setShowCustomizationPanel(false)}
              onCloseContextMenu={() => mindMap.setShowContextMenu(false)}
              onCloseImageModal={() => mindMap.setShowImageModal(false)}
              onCloseFileActionMenu={() => mindMap.setShowFileActionMenu(false)}
              onCloseNodeMapLinksPanel={mindMap.closeNodeMapLinksPanel}
              onShowImageModal={(file: FileAttachment) => {
                mindMap.setSelectedImage(file);
                mindMap.setShowImageModal(true);
              }}
            />

            <MindMapFooter data={data} />
          </div>
        </>
      ) : null}

    </div>
  );
};

export default MindMapApp;