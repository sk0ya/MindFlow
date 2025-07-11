import React, { useState } from 'react';
import { useMindMapSimplified } from '../../core/hooks/useMindMapSimplified';
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts';
import MindMapSidebar from './MindMapSidebar';
import MindMapHeader from './MindMapHeader';
import MindMapWorkspace from './MindMapWorkspace';
import MindMapModals from './MindMapModals';
import MindMapFooter from './MindMapFooter';
import './MindMapApp.css';

// カスタムフックのインポート
import { useFileHandlers } from './hooks/useFileHandlers';
import { useMapHandlers } from './hooks/useMapHandlers';
import { useNodeHandlers } from './hooks/useNodeHandlers';

// Types
import type { MindMapNode, Position, FileAttachment } from '../../shared/types';

const MindMapApp: React.FC = () => {
  const [isAppReady] = useState(true);
  console.log('MindMapApp render, isAppReady:', isAppReady);
  
  // 簡素化されたフックを使用
  const mindMap = useMindMapSimplified(isAppReady);
  
  // 状態を取得
  const { data, selectedNodeId, editingNodeId, editText, ui, canUndo, canRedo, allMindMaps, currentMapId } = mindMap;
  
  console.log('MindMapApp state:', { data, selectedNodeId, editingNodeId, editText, ui });
  
  // 下記フック群は一時的にダミーデータで対応
  const fileHandlers = useFileHandlers(
    async (nodeId: string, file: File): Promise<FileAttachment> => {
      console.log('attachFileToNode called:', { nodeId, file });
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
    async () => {}, // removeFileFromNode
    async () => {}, // renameFileInNode
    async () => {}  // downloadFile
  );
  
  const mapHandlers = useMapHandlers(
    allMindMaps,
    async (mapId: string) => {
      mindMap.selectMap(mapId);
    },
    async (name: string, category: string): Promise<string> => {
      console.log('createMindMap called:', { name, category });
      mindMap.createMap(name, category);
      return 'new-map-id';
    },
    async (mapId: string): Promise<boolean> => {
      console.log('deleteMindMapById called:', mapId);
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
    (nodeId: string, targetMapId: string) => {
      // TODO: implement addNodeMapLink
      console.log('addNodeMapLink:', nodeId, targetMapId);
    },
    (nodeId: string, linkId: string) => {
      // TODO: implement removeNodeMapLink
      console.log('removeNodeMapLink:', nodeId, linkId);
    },
    () => {} // No cursor update in local mode
  );
  
  // キーボードショートカットの統合を復元
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
    addSiblingNode: mindMap.addSiblingNode,
    deleteNode: (nodeId: string) => mindMap.deleteNode(nodeId),
    undo: () => mindMap.undo(),
    redo: () => mindMap.redo(),
    canUndo: canUndo,
    canRedo: canRedo,
    navigateToDirection: (direction: string) => {
      // TODO: implement navigation
      console.log('Navigate to:', direction);
    },
    showMapList: ui.showMapList,
    setShowMapList: mindMap.setShowMapList,
    showLocalStorage: ui.showLocalStoragePanel,
    setShowLocalStorage: mindMap.setShowLocalStoragePanel,
    showTutorial: ui.showTutorial,
    setShowTutorial: mindMap.setShowTutorial,
    showKeyboardHelper: ui.showShortcutHelper,
    setShowKeyboardHelper: mindMap.setShowShortcutHelper
  });

  // ビジネスロジックハンドラー
  const handleRightClick = (e: React.MouseEvent, nodeId: string): void => {
    nodeHandlers.handleRightClick(e, nodeId);
    mindMap.closeAllPanels();
  };

  const handleCopyNode = (node: MindMapNode): void => {
    // Simple clipboard copy (JSON serialization)
    mindMap.setClipboard(node);
  };

  const handlePasteNode = async (parentId: string): Promise<void> => {
    try {
      if (ui.clipboard) {
        // Create a copy of the node with new ID
        const newNodeId = await mindMap.addChildNode(parentId, ui.clipboard.text || '');
        // TODO: Copy other properties like color, position, etc.
        if (newNodeId) {
          mindMap.updateNode(newNodeId, { 
            color: ui.clipboard.color,
            fontSize: ui.clipboard.fontSize,
            fontWeight: ui.clipboard.fontWeight
          });
        }
      }
    } catch (error) {
      console.error('ノードの貼り付けエラー:', error);
      alert('ノードの貼り付けに失敗しました: ' + (error as Error).message);
    }
  };

  const handleShowNodeMapLinks = (node: MindMapNode, position: { x: number; y: number }): void => {
    mindMap.showNodeMapLinks(node, position);
  };

  const handleNavigateToMap = async (mapId: string): Promise<void> => {
    try {
      // TODO: implement map navigation
      console.log('Navigate to map:', mapId);
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
              setPan={(pan: Position | ((prev: Position) => Position)) => {
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
              onFileRename={(fileId: string, newName: string) => {
                // TODO: implement file rename
                console.log('File rename:', fileId, newName);
              }}
              onFileDelete={(fileId: string) => {
                // TODO: implement file delete
                console.log('File delete:', fileId);
              }}
              onAddNodeMapLink={(nodeId: string, targetMapId: string) => {
                // TODO: implement add node map link
                console.log('Add node map link:', nodeId, targetMapId);
              }}
              onRemoveNodeMapLink={(nodeId: string, linkId: string) => {
                // TODO: implement remove node map link
                console.log('Remove node map link:', nodeId, linkId);
              }}
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

      {/* キーボードショートカットヘルパー - 現在未実装 */}
    </div>
  );
};

export default MindMapApp;