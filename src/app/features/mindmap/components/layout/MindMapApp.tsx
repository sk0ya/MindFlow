import React, { useState } from 'react';
import { useMindMap, useKeyboardShortcuts, useMindMapStore } from '../../../../core';
import MindMapSidebar from './MindMapSidebar';
import MindMapHeader from './MindMapHeader';
import MindMapWorkspace from './MindMapWorkspace';
import MindMapModals from '../modals/MindMapModals';
import MindMapFooter from './MindMapFooter';
import KeyboardShortcutHelper from '../../../../shared/components/ui/KeyboardShortcutHelper';
import { NotificationProvider, useNotification } from '../../../../shared/hooks/useNotification';
import { ErrorHandlerProvider, useErrorHandler, setupGlobalErrorHandlers } from '../../../../shared/hooks/useErrorHandler';
import { FileUploadProvider } from '../../../../shared/hooks/useFileUpload';
import { useRetryableUpload } from '../../../../shared/hooks/useRetryableUpload';
import './MindMapApp.css';

// Types
import type { MindMapNode, FileAttachment } from '../../../../shared';
import type { StorageConfig } from '../../../../core/storage/types';
import { 
  localModeConfig, 
  createCloudModeConfig, 
 
} from '../../../../examples/StorageConfigExamples';
import { useAuth, LoginModal } from '../../../../components/auth';
import { validateFile } from '../../../../shared/types/dataTypes';

interface MindMapAppProps {
  storageMode?: 'local' | 'cloud';
  onModeChange?: (mode: 'local' | 'cloud') => void;
  resetKey?: number;
}

const MindMapAppContent: React.FC<MindMapAppProps> = ({ 
  storageMode = 'local', 
  onModeChange,
  resetKey = 0
}) => {
  
  console.log('🔑 MindMapApp: Rendering with resetKey:', resetKey, 'storageMode:', storageMode);
  const { showNotification } = useNotification();
  const { handleError, handleAsyncError } = useErrorHandler();
  const { retryableUpload, clearUploadState } = useRetryableUpload({
    maxRetries: 3,
    retryDelay: 2000, // 2秒
    backoffMultiplier: 1.5, // 1.5倍ずつ増加
  });
  
  // グローバルエラーハンドラーの設定
  React.useEffect(() => {
    setupGlobalErrorHandlers(handleError);
  }, [handleError]);
  const [isAppReady] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const store = useMindMapStore();
  
  // Get auth adapter for cloud mode
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
  
  // For cloud mode, check if user is authenticated
  const isCloudMode = storageMode === 'cloud';
  const needsAuth = isCloudMode && auth && !auth.authState.isAuthenticated;
  
  // Show login modal when cloud mode requires auth
  React.useEffect(() => {
    console.log('🔍 Auth check:', {
      isCloudMode,
      hasAuth: !!auth,
      authIsReady: auth?.isReady,
      isAuthenticated: auth?.authState.isAuthenticated,
      needsAuth,
      showLoginModal
    });

    if (needsAuth && auth?.isReady) {
      console.log('🚪 Showing login modal');
      setShowLoginModal(true);
    } else if (isCloudMode && auth?.authState.isAuthenticated) {
      console.log('✅ User authenticated, hiding login modal');
      setShowLoginModal(false);
    }
  }, [needsAuth, auth?.isReady, auth?.authState.isAuthenticated, isCloudMode, showLoginModal]);

  // Handle mode changes - reset modal state when switching to cloud mode
  React.useEffect(() => {
    if (isCloudMode && auth && !auth.authState.isAuthenticated && auth.isReady) {
      console.log('🔄 Mode switched to cloud, user not authenticated');
      setShowLoginModal(true);
    } else if (!isCloudMode) {
      console.log('🔄 Mode switched to local, hiding login modal');
      setShowLoginModal(false);
    }
  }, [storageMode, isCloudMode, auth?.authState.isAuthenticated, auth?.isReady]);
  
  // Create storage configuration based on selected mode
  const storageConfig: StorageConfig = React.useMemo(() => {
    console.log('🔧 MindMapApp: Creating storageConfig', {
      storageMode,
      hasAuthAdapter: !!authAdapter,
      authAdapterRef: authAdapter ? authAdapter.constructor.name : 'none'
    });
    
    let config: StorageConfig;
    switch (storageMode) {
      case 'local':
        config = localModeConfig;
        break;
      case 'cloud':
        config = authAdapter ? createCloudModeConfig(authAdapter) : localModeConfig;
        break;
      default:
        config = localModeConfig;
        break;
    }
    
    console.log('🔧 MindMapApp: StorageConfig created', {
      mode: config.mode,
      hasAuthAdapter: !!config.authAdapter,
      configHash: JSON.stringify(config).slice(0, 50) + '...'
    });
    
    return config;
  }, [storageMode, authAdapter]);
  
  // リセットキーでuseMindMapを強制リセット
  const mindMap = useMindMap(isAppReady, storageConfig, resetKey);
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
    toggleNodeCollapse,
    
    // マップ操作
    createAndSelectMap,
    selectMapById,
    deleteMap,
    updateMapMetadata,
    
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
    addChildNode: async (parentId: string, text?: string, autoEdit?: boolean) => {
      const newNodeId = store.addChildNode(parentId, text);
      if (autoEdit && newNodeId) {
        startEditing(newNodeId);
      }
      return newNodeId || null;
    },
    addSiblingNode: async (nodeId: string, text?: string, autoEdit?: boolean) => {
      const newNodeId = store.addSiblingNode(nodeId, text);
      if (autoEdit && newNodeId) {
        startEditing(newNodeId);
      }
      return newNodeId || null;
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

  // UI state から個別に取得
  const { showKeyboardHelper, setShowKeyboardHelper } = {
    showKeyboardHelper: ui.showShortcutHelper,
    setShowKeyboardHelper: (show: boolean) => store.setShowShortcutHelper(show)
  };

  // ファイルハンドラー（クラウド対応）
  const handleFileUpload = async (nodeId: string, file: File): Promise<void> => {
    if (!data) {
      handleError(new Error('マインドマップデータが利用できません'), 'ファイルアップロード', 'データチェック');
      return;
    }

    // ファイルバリデーション
    const validationErrors = validateFile(file);
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => showNotification('error', error));
      return;
    }

    const uploadKey = `${nodeId}_${file.name}_${Date.now()}`;
    
    try {
      await handleAsyncError((async () => {
        const fileAttachment = await retryableUpload(
          uploadKey,
          file.name,
          async (): Promise<FileAttachment> => {
            if (storageMode === 'cloud') {
              // クラウドモード: APIにアップロードしてCloudflareに保存
              console.log('🌐 Uploading file to cloud storage...');
              
              // CloudStorageAdapterを直接使用
              const { CloudStorageAdapter } = await import('../../../../core/storage/adapters/CloudStorageAdapter');
              
              if (!auth) {
                throw new Error('クラウドファイルアップロードには認証が必要です');
              }
              
              const storageAdapter = new CloudStorageAdapter(auth.authAdapter);
              await storageAdapter.initialize();
              
              if (typeof storageAdapter.uploadFile === 'function') {
                const uploadResult = await storageAdapter.uploadFile(data.id, nodeId, file);
                
                const fileAttachment = {
                  id: uploadResult.id,
                  name: uploadResult.fileName,
                  type: uploadResult.mimeType,
                  size: uploadResult.fileSize,
                  isImage: uploadResult.attachmentType === 'image',
                  createdAt: uploadResult.uploadedAt,
                  downloadUrl: uploadResult.downloadUrl,
                  storagePath: uploadResult.storagePath,
                  r2FileId: uploadResult.id
                };
                console.log('✅ File uploaded to cloud:', fileAttachment);
                return fileAttachment;
              } else {
                throw new Error('Cloud storage adapter not available or uploadFile method missing');
              }
            } else {
              // ローカルモード: Base64エンコードしてローカル保存
              console.log('💾 Processing file for local storage...');
              
              const reader = new FileReader();
              const dataURL = await new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });

              const fileAttachment = {
                id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: file.name,
                type: file.type,
                size: file.size,
                isImage: file.type.startsWith('image/'),
                createdAt: new Date().toISOString(),
                dataURL: dataURL,
                data: dataURL.split(',')[1] // Base64 part only
              };
              console.log('✅ File processed for local storage:', fileAttachment.name);
              return fileAttachment;
            }
          }
        );
        
        // ノードにファイルを添付
        const node = data?.rootNode && findNodeById(data.rootNode, nodeId);
        if (node) {
          const updatedNode = {
            ...node,
            attachments: [...(node.attachments || []), fileAttachment]
          };
          updateNode(nodeId, updatedNode);
          console.log('📎 File attached to node:', nodeId);
        } else {
          throw new Error(`ノードが見つかりません: ${nodeId}`);
        }
      })(), 'ファイルアップロード', `${file.name}のアップロード`);
      
      // 成功時は自動削除に任せる（useFileUploadで1秒後に削除される）
      console.log('✅ Upload completed successfully, waiting for auto-cleanup');
    } catch (error) {
      // エラー時のみ即座にクリア
      clearUploadState(uploadKey);
      console.log('🧹 Upload state cleared due to error:', uploadKey);
      throw error;
    }
  };

  // ファイルダウンロードハンドラー
  const handleFileDownload = async (file: FileAttachment): Promise<void> => {
    try {
      console.log('🔍 Downloading file:', file);
      let downloadUrl: string;
      let fileName = file.name;

      if (storageMode === 'cloud' && file.downloadUrl) {
        // クラウドモード: downloadUrlを直接使用
        downloadUrl = file.downloadUrl;
      } else if (file.data) {
        // ローカルモード: Base64データから直接使用
        downloadUrl = file.data;
      } else if (file.dataURL) {
        // 後方互換性: dataURLを使用
        downloadUrl = file.dataURL;
      } else if (file.storagePath) {
        // storagePath がある場合
        downloadUrl = file.storagePath;
      } else {
        console.error('❌ No download data found in file:', file);
        throw new Error('ダウンロード可能なファイルデータが見つかりません');
      }

      // ダウンロードを実行
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // ローカルモードでBlobURLを使用した場合はメモリを解放
      if (storageMode !== 'cloud' && downloadUrl.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
      }

      showNotification('success', `${fileName} をダウンロードしました`);
    } catch (error) {
      console.error('File download failed:', error);
      showNotification('error', `${file.name} のダウンロードに失敗しました`);
      handleError(error as Error, 'ファイルダウンロード', file.name);
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


  // Show loading while auth is initializing in cloud mode
  if (isCloudMode && auth && !auth.isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">認証システムを初期化中...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mindmap-app">
      <MindMapHeader 
        data={data}
        onTitleChange={handleTitleChange}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        zoom={ui.zoom}
        onZoomReset={() => {}}
        onShowShortcutHelper={() => setShowKeyboardHelper(!showKeyboardHelper)}
        onAutoLayout={() => {
          console.log('🎯 Manual auto layout triggered');
          if (typeof mindMap.applyAutoLayout === 'function') {
            mindMap.applyAutoLayout();
          } else {
            console.error('❌ applyAutoLayout function not available');
          }
        }}
        onToggleSidebar={toggleSidebar}
        showSidebar={!ui.sidebarCollapsed}
        storageMode={storageMode}
        onStorageModeChange={onModeChange}
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
          onToggleCollapse={toggleNodeCollapse}
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
        onFileDownload={handleFileDownload}
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
      
      {/* Keyboard Shortcut Helper */}
      <KeyboardShortcutHelper
        isVisible={showKeyboardHelper}
        onClose={() => setShowKeyboardHelper(false)}
      />
      
      {/* Authentication Modal - Shows when cloud mode requires login */}
      {isCloudMode && authAdapter && (
        <LoginModal 
          isOpen={showLoginModal}
          onClose={() => {
            console.log('🔙 Login modal closed, switching to local mode');
            setShowLoginModal(false);
            // Switch back to local mode when user cancels login
            if (onModeChange) {
              onModeChange('local');
            }
          }}
          authAdapter={authAdapter}
        />
      )}
    </div>
  );
};

const MindMapApp: React.FC<MindMapAppProps> = (props) => {
  return (
    <NotificationProvider>
      <ErrorHandlerProvider>
        <FileUploadProvider>
          <MindMapAppContent {...props} />
        </FileUploadProvider>
      </ErrorHandlerProvider>
    </NotificationProvider>
  );
};

export default MindMapApp;