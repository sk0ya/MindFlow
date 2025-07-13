import React, { useState } from 'react';
import { useMindMap, useKeyboardShortcuts, useMindMapStore } from '@local/core';
import MindMapSidebar from './MindMapSidebar';
import MindMapHeader from './MindMapHeader';
import MindMapWorkspace from './MindMapWorkspace';
import MindMapModals from '../modals/MindMapModals';
import MindMapFooter from './MindMapFooter';
import './MindMapApp.css';

// Types
import type { MindMapNode, FileAttachment } from '@local/shared';
import type { StorageConfig } from '@local/core/storage/types';
import { useAuth, LoginModal } from '../../../../components/auth';

interface MindMapAppProps {
  storageMode?: 'local' | 'cloud' | 'hybrid';
  onModeChange?: (mode: string) => void;
}

const MindMapApp: React.FC<MindMapAppProps> = ({ 
  storageMode = 'local', 
  onModeChange: _ // Mark as unused but keep for future use
}) => {
  const [isAppReady] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const store = useMindMapStore();
  
  // Get auth adapter for cloud/hybrid modes
  let auth;
  let authAdapter;
  try {
    auth = useAuth();
    authAdapter = auth.authAdapter;
  } catch {
    // useAuth throws if not within AuthProvider (local mode)
    auth = undefined;
    authAdapter = undefined;
  }
  
  // For cloud/hybrid modes, check if user is authenticated
  const isCloudMode = storageMode === 'cloud' || storageMode === 'hybrid';
  const needsAuth = isCloudMode && auth && !auth.authState.isAuthenticated;
  
  // Show login modal when cloud mode requires auth
  React.useEffect(() => {
    if (needsAuth && auth?.isReady) {
      setShowLoginModal(true);
    }
  }, [needsAuth, auth?.isReady]);

  // Close login modal when user becomes authenticated
  React.useEffect(() => {
    if (auth?.authState.isAuthenticated) {
      setShowLoginModal(false);
    }
  }, [auth?.authState.isAuthenticated]);
  
  // Create storage configuration based on selected mode
  const storageConfig: StorageConfig = {
    mode: storageMode,
    autoSave: true,
    authAdapter: authAdapter || undefined
  };
  
  const mindMap = useMindMap(isAppReady, storageConfig);
  const { 
    data, 
    selectedNodeId, 
    editingNodeId, 
    editText, 
    ui, 
    canUndo, 
    canRedo, 
    allMindMaps, 
    currentMapId,
    
    // 統合されたハンドラー
    addNode,
    updateNode, 
    deleteNode,
    moveNode,
    selectNode,
    startEditing,
    finishEditing,
    
    // UI操作
    showImageModal,
    showFileActionMenu,
    showNodeMapLinks,
    closeAllPanels,
    setZoom,
    setPan,
    toggleSidebar,
    setEditText,
    changeSiblingOrder,
    
    // マップ操作
    createAndSelectMap,
    selectMapById,
    deleteMap,
    updateMapMetadata,
    
    // ファイル操作
    exportCurrentMap,
    importMap,
    
    // 履歴操作
    undo,
    redo
  } = mindMap;

  // キーボードショートカット設定
  useKeyboardShortcuts({
    selectedNodeId,
    editingNodeId,
    setEditText,
    startEdit: startEditing,
    finishEdit: async (nodeId: string, text?: string) => {
      if (text !== undefined) {
        finishEditing(nodeId, text);
      }
    },
    editText,
    updateNode,
    addChildNode: async (parentId: string, text?: string) => {
      addNode(parentId, text);
      return null;
    },
    addSiblingNode: async (nodeId: string, text?: string) => {
      addNode(nodeId, text);
      return null;
    },
    deleteNode,
    undo,
    redo,
    canUndo,
    canRedo,
    navigateToDirection: () => {},
    showMapList: ui.showMapList,
    setShowMapList: (show: boolean) => store.setShowMapList(show),
    showLocalStorage: ui.showLocalStoragePanel,
    setShowLocalStorage: (show: boolean) => store.setShowLocalStoragePanel(show),
    showTutorial: ui.showTutorial,
    setShowTutorial: (show: boolean) => store.setShowTutorial(show),
    showKeyboardHelper: ui.showShortcutHelper,
    setShowKeyboardHelper: (show: boolean) => store.setShowShortcutHelper(show)
  });

  // ファイルハンドラー（簡素化）
  const handleFileUpload = async (nodeId: string, file: File): Promise<void> => {
    const fileAttachment: FileAttachment = {
      id: `file_${Date.now()}`,
      name: file.name,
      type: file.type,
      size: file.size,
      isImage: file.type.startsWith('image/'),
      createdAt: new Date().toISOString()
    };
    
    // ノードにファイルを添付
    const node = data?.rootNode && findNodeById(data.rootNode, nodeId);
    if (node) {
      const updatedNode = {
        ...node,
        attachments: [...(node.attachments || []), fileAttachment]
      };
      updateNode(nodeId, updatedNode);
    }
  };

  // ユーティリティ関数
  const findNodeById = (rootNode: MindMapNode, nodeId: string): MindMapNode | null => {
    if (rootNode.id === nodeId) return rootNode;
    
    for (const child of rootNode.children || []) {
      const result = findNodeById(child, nodeId);
      if (result) return result;
    }
    
    return null;
  };

  // UI用のハンドラー
  const handleTitleChange = (title: string) => {
    if (data) {
      updateMapMetadata(data.id, { title });
    }
  };

  const handleExport = () => {
    const jsonData = exportCurrentMap();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data?.title || 'mindmap'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File): Promise<void> => {
    const text = await file.text();
    const success = importMap(text);
    if (!success) {
      console.error('Failed to import file');
    }
  };

  // Show loading while auth is initializing in cloud mode
  if (isCloudMode && auth && !auth.isReady) {
    return <div>Initializing authentication...</div>;
  }

  // Show login modal if authentication is required
  if (needsAuth && authAdapter) {
    return (
      <>
        <div>Please log in to access cloud features.</div>
        <LoginModal 
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          authAdapter={authAdapter}
        />
      </>
    );
  }

  if (!data) {
    return <div>Loading...</div>;
  }

  return (
    <div className="mindmap-app">
      <MindMapHeader 
        data={data}
        onTitleChange={handleTitleChange}
        onExport={handleExport}
        onImport={handleImport}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        zoom={ui.zoom}
        onZoomReset={() => {}}
        onShowLocalStoragePanel={() => {}}
        onShowShortcutHelper={() => {}}
      />
      
      <div className="mindmap-content">
        <MindMapSidebar 
          mindMaps={allMindMaps}
          currentMapId={currentMapId}
          onSelectMap={(mapId) => { selectMapById(mapId); }}
          onCreateMap={createAndSelectMap}
          onDeleteMap={deleteMap}
          onRenameMap={(mapId, title) => updateMapMetadata(mapId, { title })}
          onChangeCategory={(mapId, category) => updateMapMetadata(mapId, { category })}
          availableCategories={['仕事', 'プライベート', '学習', '未分類']}
          isCollapsed={ui.sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
        
        <MindMapWorkspace 
          data={data}
          selectedNodeId={selectedNodeId}
          editingNodeId={editingNodeId}
          editText={editText}
          setEditText={setEditText}
          onSelectNode={selectNode}
          onStartEdit={startEditing}
          onFinishEdit={finishEditing}
          onMoveNode={moveNode}
          onChangeSiblingOrder={changeSiblingOrder}
          onAddChild={addNode}
          onAddSibling={(nodeId) => addNode(nodeId)}
          onDeleteNode={deleteNode}
          onRightClick={() => {}}
          onToggleCollapse={() => {}}
          onFileUpload={(nodeId, files) => {
            if (files.length > 0) {
              handleFileUpload(nodeId, files[0]);
            }
          }}
          onRemoveFile={() => {}}
          onShowImageModal={showImageModal}
          onShowFileActionMenu={(file, _nodeId, position) => showFileActionMenu(file, position)}
          onShowNodeMapLinks={showNodeMapLinks}
          zoom={ui.zoom}
          setZoom={setZoom}
          pan={ui.pan}
          setPan={setPan}
        />
      </div>
      
      <MindMapFooter 
        data={data}
      />
      
      <MindMapModals 
        ui={ui}
        selectedNodeId={selectedNodeId}
        findNode={(nodeId) => findNodeById(data?.rootNode, nodeId)}
        onAddChild={addNode}
        onAddSibling={addNode}
        onDeleteNode={deleteNode}
        onUpdateNode={updateNode}
        onCopyNode={() => {}}
        onPasteNode={() => {}}
        onShowCustomization={() => {}}
        onFileDownload={() => {}}
        onFileRename={() => {}}
        onFileDelete={() => {}}
        onAddNodeMapLink={() => {}}
        onRemoveNodeMapLink={() => {}}
        onNavigateToMap={() => {}}
        onCloseContextMenu={closeAllPanels}
        onCloseCustomizationPanel={closeAllPanels}
        onCloseImageModal={closeAllPanels}
        onCloseFileActionMenu={closeAllPanels}
        onCloseNodeMapLinksPanel={closeAllPanels}
        onShowImageModal={showImageModal}
      />
    </div>
  );
};

export default MindMapApp;