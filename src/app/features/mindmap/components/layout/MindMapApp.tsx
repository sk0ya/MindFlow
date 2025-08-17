import React, { useState } from 'react';
import { useMindMap, useKeyboardShortcuts, useMindMapStore } from '../../../../core';
import MindMapSidebar from './MindMapSidebar';
import MindMapHeader from './MindMapHeader';
import MindMapWorkspace from './MindMapWorkspace';
import MindMapModals from '../modals/MindMapModals';
import NodeNotesPanel from '../panels/NodeNotesPanel';
import KeyboardShortcutHelper from '../../../../shared/components/ui/KeyboardShortcutHelper';
import { NotificationProvider, useNotification } from '../../../../shared/hooks/useNotification';
import { ErrorHandlerProvider, useErrorHandler, setupGlobalErrorHandlers } from '../../../../shared/hooks/useErrorHandler';
import { FileUploadProvider } from '../../../../shared/hooks/useFileUpload';
import { useRetryableUpload } from '../../../../shared/hooks/useRetryableUpload';
import { logger } from '../../../../shared/utils/logger';
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
  
  logger.debug('MindMapApp: Rendering with resetKey:', resetKey, 'storageMode:', storageMode);
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
    logger.debug('Auth check:', {
      isCloudMode,
      hasAuth: !!auth,
      authIsReady: auth?.isReady,
      isAuthenticated: auth?.authState.isAuthenticated,
      needsAuth,
      showLoginModal
    });

    if (needsAuth && auth?.isReady) {
      logger.info('Showing login modal');
      setShowLoginModal(true);
    } else if (isCloudMode && auth?.authState.isAuthenticated) {
      logger.info('User authenticated, hiding login modal');
      setShowLoginModal(false);
    }
  }, [needsAuth, auth?.isReady, auth?.authState.isAuthenticated, isCloudMode, showLoginModal]);

  // Handle mode changes - reset modal state when switching to cloud mode
  React.useEffect(() => {
    if (isCloudMode && auth && !auth.authState.isAuthenticated && auth.isReady) {
      logger.info('Mode switched to cloud, user not authenticated');
      setShowLoginModal(true);
    } else if (!isCloudMode) {
      logger.info('Mode switched to local, hiding login modal');
      setShowLoginModal(false);
    }
  }, [storageMode, isCloudMode, auth?.authState.isAuthenticated, auth?.isReady]);
  
  // Create storage configuration based on selected mode
  const storageConfig: StorageConfig = React.useMemo(() => {
    logger.debug('MindMapApp: Creating storageConfig', {
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
    
    logger.debug('MindMapApp: StorageConfig created', {
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
    navigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!selectedNodeId || !data?.rootNode) return;
      
      const findNextNode = (currentNodeId: string, direction: 'up' | 'down' | 'left' | 'right'): string | null => {
        const currentNode = findNodeById(data.rootNode, currentNodeId);
        if (!currentNode) return null;
        
        // Get all nodes in a flat list for easier distance calculation
        const allNodes: MindMapNode[] = [];
        const collectNodes = (node: MindMapNode) => {
          allNodes.push(node);
          if (node.children) {
            node.children.forEach(collectNodes);
          }
        };
        collectNodes(data.rootNode);
        
        // Filter out the current node
        const otherNodes = allNodes.filter(node => node.id !== currentNodeId);
        if (otherNodes.length === 0) return null;
        
        // Find the best node in the specified direction
        let bestNode: MindMapNode | null = null;
        let bestScore = Infinity;
        
        for (const node of otherNodes) {
          const deltaX = node.x - currentNode.x;
          const deltaY = node.y - currentNode.y;
          
          // Check if the node is in the correct direction
          let isInDirection = false;
          let directionalScore = 0;
          
          switch (direction) {
            case 'right':
              isInDirection = deltaX > 20; // Must be significantly to the right
              directionalScore = deltaX + Math.abs(deltaY) * 0.5; // Prefer more to the right, penalize vertical distance
              break;
            case 'left':
              isInDirection = deltaX < -20; // Must be significantly to the left
              directionalScore = -deltaX + Math.abs(deltaY) * 0.5; // Prefer more to the left, penalize vertical distance
              break;
            case 'down':
              isInDirection = deltaY > 20; // Must be significantly down
              directionalScore = deltaY + Math.abs(deltaX) * 0.5; // Prefer more down, penalize horizontal distance
              break;
            case 'up':
              isInDirection = deltaY < -20; // Must be significantly up
              directionalScore = -deltaY + Math.abs(deltaX) * 0.5; // Prefer more up, penalize horizontal distance
              break;
          }
          
          if (isInDirection && directionalScore < bestScore) {
            bestScore = directionalScore;
            bestNode = node;
          }
        }
        
        return bestNode?.id || null;
      };
      
      const nextNodeId = findNextNode(selectedNodeId, direction);
      if (nextNodeId) {
        selectNode(nextNodeId);
      }
    },
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
              logger.info('Uploading file to cloud storage...', { 
                fileName: file.name, 
                fileSize: file.size, 
                fileType: file.type,
                nodeId,
                mapId: data.id
              });
              
              // CloudStorageAdapterを直接使用
              const { CloudStorageAdapter } = await import('../../../../core/storage/adapters/CloudStorageAdapter');
              logger.debug('CloudStorageAdapter imported successfully');
              
              if (!auth) {
                logger.error('Authentication not available for cloud upload');
                throw new Error('クラウドファイルアップロードには認証が必要です');
              }
              
              logger.debug('Auth state:', {
                hasAuth: !!auth,
                hasAuthAdapter: !!auth.authAdapter,
                isAuthenticated: auth.authAdapter?.isAuthenticated,
                userId: auth.authAdapter?.user?.id
              });
              
              const storageAdapter = new CloudStorageAdapter(auth.authAdapter);
              logger.debug('CloudStorageAdapter created, initializing...');
              
              await storageAdapter.initialize();
              logger.debug('CloudStorageAdapter initialized');
              
              if (typeof storageAdapter.uploadFile === 'function') {
                logger.debug('Calling uploadFile method...');
                const uploadResult = await storageAdapter.uploadFile(data.id, nodeId, file);
                logger.debug('Upload result received:', uploadResult);
                
                const fileAttachment = {
                  id: uploadResult.id,
                  name: uploadResult.fileName,
                  type: uploadResult.mimeType,
                  size: uploadResult.fileSize,
                  isImage: uploadResult.attachmentType === 'image',
                  createdAt: uploadResult.uploadedAt,
                  downloadUrl: uploadResult.downloadUrl,
                  storagePath: uploadResult.storagePath,
                  r2FileId: uploadResult.id,
                  nodeId: nodeId // nodeIdも保存
                };
                logger.info('File uploaded to cloud successfully:', fileAttachment);
                logger.info('Upload result details:', {
                  uploadResultId: uploadResult.id,
                  fileName: uploadResult.fileName,
                  mapId: data.id,
                  nodeId: nodeId,
                  fullUploadResult: uploadResult
                });
                return fileAttachment;
              } else {
                logger.error('uploadFile method not available on storage adapter');
                throw new Error('Cloud storage adapter not available or uploadFile method missing');
              }
            } else {
              // ローカルモード: Base64エンコードしてローカル保存
              logger.debug('Processing file for local storage...');
              
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
              logger.debug('File processed for local storage:', fileAttachment.name);
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
          logger.debug('File attached to node:', nodeId);
        } else {
          throw new Error(`ノードが見つかりません: ${nodeId}`);
        }
      })(), 'ファイルアップロード', `${file.name}のアップロード`);
      
      // 成功時は自動削除に任せる（useFileUploadで1秒後に削除される）
      logger.debug('Upload completed successfully, waiting for auto-cleanup');
    } catch (error) {
      // エラー時のみ即座にクリア
      clearUploadState(uploadKey);
      logger.debug('Upload state cleared due to error:', uploadKey);
      throw error;
    }
  };

  // ファイルダウンロードハンドラー
  const handleFileDownload = async (file: FileAttachment): Promise<void> => {
    try {
      let downloadUrl: string;
      const fileName = file.name;

      if (storageMode === 'cloud' && (file.r2FileId || file.id)) {
        // クラウドモード: APIを使用してファイルをダウンロード
        const fileId = file.r2FileId || file.id; // 古いファイルとの互換性
        logger.info('Downloading file from cloud storage...', { 
          fileName: file.name, 
          fileId: fileId,
          r2FileId: file.r2FileId,
          originalId: file.id,
          nodeId: file.nodeId,
          mapId: data?.id,
          fullFile: file
        });

        if (!data) {
          throw new Error('マインドマップデータが利用できません');
        }

        if (!auth || !auth.authAdapter) {
          throw new Error('クラウドファイルダウンロードには認証が必要です');
        }

        // CloudStorageAdapterを直接使用してファイルをダウンロード
        const { CloudStorageAdapter } = await import('../../../../core/storage/adapters/CloudStorageAdapter');
        const storageAdapter = new CloudStorageAdapter(auth.authAdapter);
        
        await storageAdapter.initialize();
        
        if (typeof storageAdapter.downloadFile === 'function') {
          logger.debug('Calling downloadFile method...');
          const blob = await storageAdapter.downloadFile(data.id, file.nodeId || '', fileId);
          logger.debug('Download blob received:', { size: blob.size, type: blob.type });
          
          // BlobからダウンロードURLを作成
          downloadUrl = URL.createObjectURL(blob);
          logger.info('File downloaded from cloud successfully');
        } else {
          logger.error('downloadFile method not available on storage adapter');
          throw new Error('Cloud storage adapter downloadFile method not available');
        }
      } else if (file.data) {
        // ローカルモード: Base64データから直接使用
        downloadUrl = `data:${file.type};base64,${file.data}`;
      } else if (file.dataURL) {
        // 後方互換性: dataURLを使用
        downloadUrl = file.dataURL;
      } else if (storageMode === 'cloud' && file.downloadUrl) {
        // 古いクラウドファイル: downloadUrlを直接使用（認証なし、古い形式）
        logger.info('Using legacy downloadUrl for old cloud file');
        downloadUrl = file.downloadUrl;
      } else {
        logger.error('No download data found in file:', file);
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

      // BlobURLを使用した場合はメモリを解放
      if (downloadUrl.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
      }

      logger.info('File download completed successfully:', fileName);
    } catch (error) {
      logger.error('File download failed:', error);
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
          logger.info('Manual auto layout triggered');
          if (typeof mindMap.applyAutoLayout === 'function') {
            mindMap.applyAutoLayout();
          } else {
            logger.error('applyAutoLayout function not available');
          }
        }}
        storageMode={storageMode}
        onStorageModeChange={onModeChange}
        onToggleNotesPanel={() => store.toggleNotesPanel()}
        showNotesPanel={ui.showNotesPanel}
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
        
        <div className="workspace-container">
          <MindMapWorkspace 
            data={data}
            selectedNodeId={selectedNodeId}
            editingNodeId={editingNodeId}
            editText={editText}
            setEditText={setEditText}
            onSelectNode={(nodeId) => {
              selectNode(nodeId);
              // ノート表示フラグが有効な場合のみノートパネルを表示
              // ノートフラグが無効な場合はノード選択してもノートパネルを表示しない
            }}
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
          
          {ui.showNotesPanel && (
            <NodeNotesPanel
              selectedNode={selectedNodeId ? findNodeById(data?.rootNode, selectedNodeId) : null}
              onUpdateNode={updateNode}
              onClose={() => store.setShowNotesPanel(false)}
            />
          )}
        </div>
      </div>
      
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
            logger.info('Login modal closed, switching to local mode');
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