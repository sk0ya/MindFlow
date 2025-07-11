import React, { useState } from 'react';
import { useMindMapStore, selectUI } from '../../core/store/mindMapStore';
import { useMindMapZustand } from '../../core/hooks/useMindMapZustand';
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
import { useNodeHandlers } from './hooks/useNodeHandlers';

// Types
import type { MindMapNode, Position, FileAttachment } from '../../shared/types';

const MindMapApp: React.FC = () => {
  const [isAppReady] = useState(true);
  console.log('MindMapApp render, isAppReady:', isAppReady);
  
  // useMindMapZustandフックを使用して初期化処理を実行
  const mindMapZustand = useMindMapZustand(isAppReady);
  
  // useMindMapZustandからのデータを使用
  const data = mindMapZustand.data;
  const selectedNodeId = mindMapZustand.selectedNodeId;
  const editingNodeId = mindMapZustand.editingNodeId;
  const editText = mindMapZustand.editText;
  const ui = useMindMapStore(selectUI);
  
  console.log('MindMapApp state:', { data, selectedNodeId, editingNodeId, editText, ui });
  
  // アクション関数を取得（useMindMapZustandから）
  const {
    setEditText,
    updateNode,
    addChildNode,
    addSiblingNode,
    deleteNode,
    moveNode,
    findNode,
    startEditingNode,
    finishEditingNode,
    undo,
    redo,
    canUndo,
    canRedo,
  } = mindMapZustand;
  
  // UI actions（Zustandストアから）
  const {
    setZoom,
    setPan,
    resetZoom,
    setShowCustomizationPanel,
    setShowContextMenu,
    setContextMenuPosition,
    setShowShortcutHelper,
    setShowMapList,
    setShowLocalStoragePanel,
    setShowTutorial,
    setClipboard,
    setShowImageModal,
    setShowFileActionMenu,
    setSelectedImage,
    closeAllPanels,
    toggleSidebar,
    showCustomization,
    showNodeMapLinks,
    closeNodeMapLinksPanel
  } = useMindMapStore();
  
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
    [], // allMindMaps
    async () => {}, // switchToMap
    async (name: string, category: string): Promise<string> => {
      console.log('createMindMap called:', { name, category });
      return 'new-map-id';
    },
    async (): Promise<boolean> => {
      console.log('deleteMindMapById called');
      return true;
    },
    async () => {}, // renameMindMap
    async () => {}  // changeMapCategory
  );
  
  const nodeHandlers = useNodeHandlers(
    mindMapZustand.setSelectedNodeId,
    (position: Position | null) => setContextMenuPosition(position || { x: 0, y: 0 }),
    setShowContextMenu,
    setShowCustomizationPanel,
    async (parentId: string, text?: string, startEditing?: boolean): Promise<string> => {
      const newNodeId = await addChildNode(parentId, text || '');
      if (startEditing && newNodeId) {
        startEditingNode(newNodeId);
      }
      return newNodeId || '';
    },
    addSiblingNode,
    (nodeId: string, updates: Partial<MindMapNode>) => updateNode(nodeId, updates),
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
    setEditText,
    startEdit: startEditingNode,
    finishEdit: (nodeId: string, newText?: string) => finishEditingNode(nodeId, newText || ''),
    editText,
    updateNode: (nodeId: string, updates: Partial<MindMapNode>) => updateNode(nodeId, updates),
    addChildNode: async (parentId: string, text = '', startEditingAfter = false) => {
      const newNodeId = await addChildNode(parentId, text);
      if (startEditingAfter && newNodeId) {
        startEditingNode(newNodeId);
      }
      return Promise.resolve(null);
    },
    addSiblingNode,
    deleteNode: (nodeId: string) => deleteNode(nodeId),
    undo: () => undo(),
    redo: () => redo(),
    canUndo: canUndo,
    canRedo: canRedo,
    navigateToDirection: (direction: string) => {
      // TODO: implement navigation
      console.log('Navigate to:', direction);
    },
    showMapList: ui.showMapList,
    setShowMapList: setShowMapList,
    showLocalStorage: ui.showLocalStoragePanel,
    setShowLocalStorage: setShowLocalStoragePanel,
    showTutorial: ui.showTutorial,
    setShowTutorial: setShowTutorial,
    showKeyboardHelper: ui.showShortcutHelper,
    setShowKeyboardHelper: setShowShortcutHelper
  });

  // ビジネスロジックハンドラー
  const handleRightClick = (e: React.MouseEvent, nodeId: string): void => {
    nodeHandlers.handleRightClick(e, nodeId);
    closeAllPanels();
  };

  const handleCopyNode = (node: MindMapNode): void => {
    // Simple clipboard copy (JSON serialization)
    setClipboard(node);
  };

  const handlePasteNode = async (parentId: string): Promise<void> => {
    try {
      if (ui.clipboard) {
        // Create a copy of the node with new ID
        const newNodeId = await addChildNode(parentId, ui.clipboard.text || '');
        // TODO: Copy other properties like color, position, etc.
        if (newNodeId) {
          updateNode(newNodeId, { 
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
    showNodeMapLinks(node, position);
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
            mindMaps={[]}
            currentMapId={''}
            onSelectMap={mapHandlers.handleSelectMap}
            onCreateMap={mapHandlers.handleCreateMap}
            onDeleteMap={mapHandlers.handleDeleteMap}
            onRenameMap={mapHandlers.handleRenameMap}
            onChangeCategory={mapHandlers.handleChangeCategory}
            availableCategories={[]}
            isCollapsed={ui.sidebarCollapsed}
            onToggleCollapse={toggleSidebar}
          />
          
          <div className={`container ${ui.sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
            <Toolbar
              title={data.title}
              onTitleChange={(title: string) => updateNode('root', { text: title })}
              onExport={() => {}} // TODO: implement export functionality
              onImport={async () => {}} // TODO: implement import functionality
              onUndo={async () => { undo(); }}
              onRedo={async () => { redo(); }}
              canUndo={canUndo}
              canRedo={canRedo}
              zoom={ui.zoom}
              onZoomReset={resetZoom}
              onShowLocalStoragePanel={() => setShowLocalStoragePanel(true)}
              onShowShortcutHelper={() => setShowShortcutHelper(true)}
            />

            <ErrorBoundary>
              <MindMapCanvas
                data={data}
                selectedNodeId={selectedNodeId}
                editingNodeId={editingNodeId}
                editText={editText}
                setEditText={setEditText}
                onSelectNode={nodeHandlers.handleNodeSelect}
                onStartEdit={startEditingNode}
                onFinishEdit={finishEditingNode}
                onChangeParent={moveNode}
                onChangeSiblingOrder={(draggedNodeId: string, targetNodeId: string, insertBefore: boolean) => {
                  // TODO: implement sibling order change
                  console.log('Change sibling order:', draggedNodeId, targetNodeId, insertBefore);
                }}
                onAddChild={nodeHandlers.handleAddChild}
                onAddSibling={nodeHandlers.handleAddSibling}
                onDeleteNode={(nodeId: string) => deleteNode(nodeId)}
                onRightClick={handleRightClick}
                onToggleCollapse={(nodeId: string) => {
                  const node = findNode(nodeId);
                  if (node) {
                    updateNode(nodeId, { collapsed: !node.collapsed });
                  }
                }}
                onNavigateToDirection={(direction: string) => {
                  // TODO: implement navigation
                  console.log('Navigate to:', direction);
                }}
                onFileUpload={fileHandlers.handleFileUpload}
                onRemoveFile={fileHandlers.handleRemoveFile}
                onShowImageModal={fileHandlers.handleShowImageModal}
                onShowFileActionMenu={fileHandlers.handleShowFileActionMenu}
                onShowNodeMapLinks={handleShowNodeMapLinks}
                zoom={ui.zoom}
                setZoom={setZoom}
                pan={ui.pan}
                setPan={(pan: Position | ((prev: Position) => Position)) => {
                  if (typeof pan === 'function') {
                    const currentPan = ui.pan;
                    setPan(pan(currentPan));
                  } else {
                    setPan(pan);
                  }
                }}
              />
            </ErrorBoundary>

            {ui.showCustomizationPanel && (
              <NodeCustomizationPanel
                selectedNode={selectedNodeId ? findNode(selectedNodeId) : null}
                onUpdateNode={(nodeId: string, updates: Partial<MindMapNode>) => updateNode(nodeId, updates)}
                onClose={() => setShowCustomizationPanel(false)}
                position={ui.customizationPosition}
              />
            )}

            {ui.showContextMenu && (
              <ContextMenu
                visible={true}
                position={ui.contextMenuPosition}
                selectedNode={selectedNodeId ? findNode(selectedNodeId) : null}
                onAddChild={nodeHandlers.handleAddChild}
                onAddSibling={nodeHandlers.handleAddSibling}
                onDelete={(nodeId: string) => deleteNode(nodeId)}
                onCustomize={showCustomization}
                onCopy={handleCopyNode}
                onPaste={(parentId: string) => handlePasteNode(parentId)}
                onChangeColor={(nodeId: string, color: string) => updateNode(nodeId, { color })}
                onClose={() => setShowContextMenu(false)}
              />
            )}

            <ImageModal
              isOpen={ui.showImageModal}
              image={ui.selectedImage}
              onClose={() => setShowImageModal(false)}
            />

            <FileActionMenu
              isOpen={ui.showFileActionMenu}
              file={ui.selectedFile}
              position={ui.fileMenuPosition}
              onClose={() => setShowFileActionMenu(false)}
              onDownload={fileHandlers.handleFileDownload}
              onRename={fileHandlers.handleFileRename}
              onDelete={fileHandlers.handleFileDelete}
              onView={(file: any) => {
                setSelectedImage(file);
                setShowImageModal(true);
              }}
            />

            {ui.selectedNodeForLinks && (
              <NodeMapLinksPanel
                isOpen={ui.showNodeMapLinksPanel}
                position={ui.nodeMapLinksPanelPosition}
                selectedNode={ui.selectedNodeForLinks}
                currentMapId={''}
                allMaps={[]}
                onClose={closeNodeMapLinksPanel}
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
                  ノード数: {data?.rootNode ? 'N/A' : 0} | 
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