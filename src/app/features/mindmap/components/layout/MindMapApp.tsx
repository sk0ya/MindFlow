import React, { useState, useCallback } from 'react';
import { useMindMap, useKeyboardShortcuts, useMindMapStore, useMindMapPersistence } from '../../../../core';
import { findNodeById, findParentNode, getSiblingNodes, getFirstVisibleChild } from '../../../../shared/utils/nodeTreeUtils';
import ActivityBar from './ActivityBar';
import PrimarySidebar from './PrimarySidebar';
import MindMapHeader from './MindMapHeader';
import MindMapWorkspace from './MindMapWorkspace';
import MindMapModals from '../modals/MindMapModals';
import ExportModal from '../modals/ExportModal';
import ImportModal from '../modals/ImportModal';
import NodeLinkModal from '../modals/NodeLinkModal';
import LinkActionMenu from '../modals/LinkActionMenu';
import NodeNotesPanel from '../panels/NodeNotesPanel';
import OutlineWorkspace from '../outline/OutlineWorkspace';
import '../outline/OutlineWorkspace.css';
import KeyboardShortcutHelper from '../../../../shared/components/ui/KeyboardShortcutHelper';
import ContextMenu from '../../../../shared/components/ui/ContextMenu';
import { useNotification } from '../../../../shared/hooks/useNotification';
import { useErrorHandler, setupGlobalErrorHandlers } from '../../../../shared/hooks/useErrorHandler';
import { useRetryableUpload } from '../../../../shared/hooks/useRetryableUpload';
import { useAI } from '../../../../core/hooks/useAI';
import { useTheme } from '../../../../shared/hooks/useTheme';
import { useModalState } from '../../../../shared/hooks/useModalState';
import { useVimMode } from '../../../../core/hooks/useVimMode';
import MindMapProviders from './MindMapProviders';
import { logger } from '../../../../shared/utils/logger';
import VimStatusBar from '../../../../shared/components/ui/VimStatusBar';
import './MindMapApp.css';

// Types
import type { MindMapNode, FileAttachment, MindMapData, NodeLink } from '@shared/types';
import type { StorageConfig } from '../../../../core/storage/types';
// Storage configurations
const localModeConfig: StorageConfig = {
  mode: 'local'
};

const createCloudModeConfig = (authAdapter: any): StorageConfig => ({
  mode: 'cloud',
  authAdapter
});
import { useOptionalAuth, LoginModal } from '../../../../components/auth';
import { validateFile } from '../../../../shared/types/dataTypes';

// Helper function for spatial navigation fallback
const findNodeBySpatialDirection = (
  currentNodeId: string,
  direction: 'up' | 'down' | 'left' | 'right',
  rootNode: MindMapNode
): string | null => {
  const currentNode = findNodeById(rootNode, currentNodeId);
  if (!currentNode) return null;
  
  // Get all nodes in a flat list for distance calculation
  const allNodes: MindMapNode[] = [];
  const collectNodes = (node: MindMapNode) => {
    allNodes.push(node);
    if (node.children && !node.collapsed) {
      node.children.forEach(collectNodes);
    }
  };
  collectNodes(rootNode);
  
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
        isInDirection = deltaX > 20;
        directionalScore = deltaX + Math.abs(deltaY) * 0.5;
        break;
      case 'left':
        isInDirection = deltaX < -20;
        directionalScore = -deltaX + Math.abs(deltaY) * 0.5;
        break;
      case 'down':
        isInDirection = deltaY > 20;
        directionalScore = deltaY + Math.abs(deltaX) * 0.5;
        break;
      case 'up':
        isInDirection = deltaY < -20;
        directionalScore = -deltaY + Math.abs(deltaX) * 0.5;
        break;
    }
    
    if (isInDirection && directionalScore < bestScore) {
      bestScore = directionalScore;
      bestNode = node;
    }
  }
  
  return bestNode?.id || null;
};

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
  
  const { showNotification } = useNotification();
  const { handleError, handleAsyncError } = useErrorHandler();
  const { retryableUpload, clearUploadState } = useRetryableUpload({
    maxRetries: 3,
    retryDelay: 2000, // 2秒
    backoffMultiplier: 1.5, // 1.5倍ずつ増加
  });
  
  // Settings store for initialization
  const { loadSettingsFromStorage } = useMindMapStore();
  
  // Initialize settings on mount
  React.useEffect(() => {
    loadSettingsFromStorage();
  }, [loadSettingsFromStorage]);
  
  // Vim mode hook
  const vim = useVimMode();
  
  // VSCode風サイドバーの状態
  const [activeView, setActiveView] = useState<string | null>('maps');
  
  // グローバルエラーハンドラーの設定
  React.useEffect(() => {
    setupGlobalErrorHandlers(handleError);
  }, [handleError]);
  const [isAppReady] = useState(true);
  const [internalResetKey, setResetKey] = useState(resetKey);
  // モーダル状態管理
  const {
    showExportModal, setShowExportModal,
    showImportModal, setShowImportModal,
    showLoginModal, setShowLoginModal,
    showLinkModal, setShowLinkModal,
    editingLink, setEditingLink,
    linkModalNodeId, setLinkModalNodeId,
    showLinkActionMenu, setShowLinkActionMenu,
    linkActionMenuData, setLinkActionMenuData,
    contextMenu, setContextMenu
  } = useModalState();
  
  const store = useMindMapStore();
  
  // AI functionality
  const ai = useAI();
  
  // テーマ管理
  useTheme();
  
  // Get auth adapter for cloud mode (using optional hook)
  const auth = useOptionalAuth();
  const authAdapter = auth?.authAdapter;
  
  // 永続化フックを適切なauth adapterで使用
  const persistenceHook = useMindMapPersistence({
    mode: storageMode,
    authAdapter: authAdapter // 適切なauth adapterを設定
  });
  
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
  }, [needsAuth, auth?.isReady, auth?.authState.isAuthenticated, isCloudMode, showLoginModal, auth, setShowLoginModal]);

  // Force data reload when authentication status changes in cloud mode
  React.useEffect(() => {
    if (isCloudMode && auth?.authState.isAuthenticated && auth?.isReady) {
      logger.info('🔄 Authentication successful in cloud mode, forcing data reload');
      // Increment reset key to force useMindMap to reinitialize with new auth context
      setResetKey(prev => prev + 1);
    }
  }, [isCloudMode, auth?.authState.isAuthenticated, auth?.isReady]);

  // Sync external resetKey with internal resetKey
  React.useEffect(() => {
    setResetKey(resetKey);
  }, [resetKey]);

  // Handle mode changes - reset modal state when switching to cloud mode
  React.useEffect(() => {
    if (isCloudMode && auth && !auth.authState.isAuthenticated && auth.isReady) {
      logger.info('Mode switched to cloud, user not authenticated');
      setShowLoginModal(true);
    } else if (!isCloudMode) {
      logger.info('Mode switched to local, hiding login modal');
      setShowLoginModal(false);
    }
  }, [storageMode, isCloudMode, auth?.authState.isAuthenticated, auth?.isReady, auth, setShowLoginModal]);
  
  // Create storage configuration based on selected mode
  const storageConfig: StorageConfig = React.useMemo(() => {
    
    let config: StorageConfig;
    switch (storageMode) {
      case 'local':
        config = localModeConfig;
        break;
      case 'cloud':
        if (authAdapter) {
          config = createCloudModeConfig(authAdapter);
        } else {
          // Auth adapter not available, fall back to local mode
          logger.warn('Cloud mode requested but auth adapter not available, falling back to local mode');
          config = localModeConfig;
        }
        break;
      default:
        config = localModeConfig;
        break;
    }
    
    
    return config;
  }, [storageMode, authAdapter]);
  
  // リセットキーでuseMindMapを強制リセット
  const mindMap = useMindMap(isAppReady, storageConfig, Math.max(resetKey, internalResetKey));
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
    startEditingWithCursorAtEnd,
    startEditingWithCursorAtStart,
    finishEditing,
    
    // UI操作
    showImageModal,
    showFileActionMenu,
    closeAllPanels,
    setZoom,
    setPan,
    setEditText,
    changeSiblingOrder,
    toggleNodeCollapse,
    
    // マップ操作
    createAndSelectMap,
    selectMapById,
    deleteMap,
    updateMapMetadata,
    addImportedMapToList,
    applyAutoLayout,
    
    // 履歴操作
    undo,
    redo
  } = mindMap;

  // フォルダ移動用の一括カテゴリ更新関数
  const updateMultipleMapCategories = React.useCallback(async (mapUpdates: Array<{id: string, category: string}>) => {
    console.log('Updating multiple map categories:', mapUpdates);
    
    if (mapUpdates.length === 0) return;
    
    try {
      // 一括でマップ情報を更新
      const updatedMaps = mapUpdates.map(update => {
        const mapToUpdate = allMindMaps.find(map => map.id === update.id);
        if (!mapToUpdate) return null;
        
        return {
          ...mapToUpdate,
          category: update.category,
          updatedAt: new Date().toISOString()
        };
      }).filter(Boolean);
      
      console.log(`Batch updating ${updatedMaps.length} maps`);
      
      // 各マップを並列更新（非同期処理を並列実行）
      await Promise.all(
        updatedMaps.map(async (updatedMap) => {
          if (updatedMap) {
            console.log(`Updating map "${updatedMap.title}" to "${updatedMap.category}"`);
            await persistenceHook.updateMapInList(updatedMap);
          }
        })
      );
      
      // 成功後にマップリストを強制更新してUIを即座に反映
      await persistenceHook.refreshMapList();
      
      console.log(`Successfully batch updated ${updatedMaps.length} maps`);
    } catch (error) {
      console.error('Failed to batch update map categories:', error);
      // エラーが発生した場合も、可能な限り状態を同期
      await persistenceHook.refreshMapList();
    }
  }, [allMindMaps, persistenceHook]);

  // キーボードショートカット設定
  useKeyboardShortcuts({
    selectedNodeId,
    editingNodeId,
    setEditText,
    startEdit: startEditing,
    startEditWithCursorAtEnd: startEditingWithCursorAtEnd,
    startEditWithCursorAtStart: startEditingWithCursorAtStart,
    finishEdit: async (nodeId: string, text?: string) => {
      if (text !== undefined) {
        finishEditing(nodeId, text);
      }
    },
    editText,
    updateNode,
    addChildNode: async (parentId: string, text?: string, autoEdit?: boolean) => {
      try {
        const newNodeId = store.addChildNode(parentId, text);
        if (autoEdit && newNodeId) {
          // 編集モードを開始する前に、少し待機してDOMが更新されるのを待つ
          setTimeout(() => {
            startEditing(newNodeId);
          }, 50);
        }
        return newNodeId || null;
      } catch (error) {
        logger.error('子ノード追加に失敗:', error);
        return null;
      }
    },
    addSiblingNode: async (nodeId: string, text?: string, autoEdit?: boolean) => {
      try {
        const newNodeId = store.addSiblingNode(nodeId, text);
        if (autoEdit && newNodeId) {
          // 編集モードを開始する前に、少し待機してDOMが更新されるのを待つ
          setTimeout(() => {
            startEditing(newNodeId);
          }, 50);
        }
        return newNodeId || null;
      } catch (error) {
        logger.error('兄弟ノード追加に失敗:', error);
        return null;
      }
    },
    deleteNode,
    undo,
    redo,
    canUndo,
    canRedo,
    navigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!selectedNodeId || !data?.rootNode) return;
      
      const currentNode = findNodeById(data.rootNode, selectedNodeId);
      if (!currentNode) return;
      
      let nextNodeId: string | null = null;
      
      switch (direction) {
        case 'left': // h - Move to parent node
          const parent = findParentNode(data.rootNode, selectedNodeId);
          if (parent) {
            nextNodeId = parent.id;
          }
          break;
          
        case 'right': // l - Move to first child (expand if collapsed)
          const firstChild = getFirstVisibleChild(currentNode);
          if (firstChild) {
            nextNodeId = firstChild.id;
          } else if (currentNode.children && currentNode.children.length > 0 && currentNode.collapsed) {
            // Expand collapsed node and move to first child
            updateNode(selectedNodeId, { collapsed: false });
            nextNodeId = currentNode.children[0].id;
          }
          break;
          
        case 'up': // k - Move to previous sibling
        case 'down': // j - Move to next sibling
          const { siblings, currentIndex } = getSiblingNodes(data.rootNode, selectedNodeId);
          if (siblings.length > 1 && currentIndex !== -1) {
            let targetIndex = -1;
            if (direction === 'up' && currentIndex > 0) {
              targetIndex = currentIndex - 1;
            } else if (direction === 'down' && currentIndex < siblings.length - 1) {
              targetIndex = currentIndex + 1;
            }
            if (targetIndex !== -1) {
              nextNodeId = siblings[targetIndex].id;
            }
          }
          break;
      }
      
      // Fallback to spatial navigation if hierarchical navigation doesn't work
      if (!nextNodeId) {
        nextNodeId = findNodeBySpatialDirection(selectedNodeId, direction, data.rootNode);
      }
      
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
    setShowKeyboardHelper: (show: boolean) => store.setShowShortcutHelper(show),
    copyNode: (nodeId: string) => {
      const node = data?.rootNode ? findNodeById(data.rootNode, nodeId) : null;
      if (node) {
        // 内部クリップボードに保存
        store.setClipboard(node);
        
        // システムクリップボードにマークダウン形式で保存
        const convertNodeToMarkdown = (node: MindMapNode, level: number = 0): string => {
          const prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
          let markdown = `${prefix}${node.text}\n`;
          
          // ノートがあれば追加
          if (node.note && node.note.trim()) {
            markdown += `${node.note}\n`;
          }
          
          // 子ノードを再帰的に処理
          if (node.children && node.children.length > 0) {
            node.children.forEach(child => {
              markdown += convertNodeToMarkdown(child, level + 1);
            });
          }
          
          return markdown;
        };
        
        const markdownText = convertNodeToMarkdown(node);
        
        // システムクリップボードに書き込み
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(markdownText).catch((error) => {
            console.warn('システムクリップボードへの書き込みに失敗:', error);
          });
        }
        
        showNotification('success', `「${node.text}」をコピーしました`);
      }
    },
    pasteNode: async (parentId: string) => {
      // まずシステムクリップボードからMindMeisterのマークダウンを確認
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const clipboardText = await navigator.clipboard.readText();
          
          // MindMeisterのマークダウン形式かチェック
          const { isMindMeisterFormat, parseMindMeisterMarkdown } = await import('../../../../shared/utils/mindMeisterParser');
          
          if (clipboardText && isMindMeisterFormat(clipboardText)) {
            const parsedNode = parseMindMeisterMarkdown(clipboardText);
            
            if (parsedNode) {
              // パースされたノード構造を貼り付け
              const pasteNodeRecursively = (nodeToAdd: MindMapNode, parentId: string): string | undefined => {
                const newNodeId = store.addChildNode(parentId, nodeToAdd.text);
                
                if (newNodeId) {
                  updateNode(newNodeId, {
                    fontSize: nodeToAdd.fontSize,
                    fontWeight: nodeToAdd.fontWeight,
                    color: nodeToAdd.color,
                    collapsed: false,
                    attachments: nodeToAdd.attachments || [],
                    note: nodeToAdd.note
                  });
                  
                  if (nodeToAdd.children && nodeToAdd.children.length > 0) {
                    nodeToAdd.children.forEach(child => {
                      pasteNodeRecursively(child, newNodeId);
                    });
                  }
                }
                
                return newNodeId;
              };
              
              const newNodeId = pasteNodeRecursively(parsedNode, parentId);
              if (newNodeId) {
                showNotification('success', `「${parsedNode.text}」をMindMeisterから貼り付けました`);
                selectNode(newNodeId);
                return;
              }
            }
          }
        }
      } catch (error) {
        console.warn('システムクリップボードからの読み取りに失敗:', error);
      }
      
      // フォールバック: 内部クリップボードから貼り付け
      const clipboardNode = ui.clipboard;
      if (!clipboardNode) {
        showNotification('warning', 'コピーされたノードがありません');
        return;
      }
      
      const pasteNodeRecursively = (nodeToAdd: MindMapNode, parentId: string): string | undefined => {
        const newNodeId = store.addChildNode(parentId, nodeToAdd.text);
        
        if (newNodeId) {
          updateNode(newNodeId, {
            fontSize: nodeToAdd.fontSize,
            fontWeight: nodeToAdd.fontWeight,
            color: nodeToAdd.color,
            collapsed: false,
            attachments: nodeToAdd.attachments || []
          });
          
          if (nodeToAdd.children && nodeToAdd.children.length > 0) {
            nodeToAdd.children.forEach(child => {
              pasteNodeRecursively(child, newNodeId);
            });
          }
        }
        
        return newNodeId;
      };
      
      const newNodeId = pasteNodeRecursively(clipboardNode, parentId);
      if (newNodeId) {
        showNotification('success', `「${clipboardNode.text}」を貼り付けました`);
        selectNode(newNodeId);
      }
    },
    pasteImageFromClipboard: async (nodeId: string) => {
      try {
        // システムクリップボードアクセスの権限確認
        if (!navigator.clipboard || !navigator.clipboard.read) {
          throw new Error('クリップボードAPIが利用できません');
        }

        const clipboardItems = await navigator.clipboard.read();
        let imageFound = false;

        for (const clipboardItem of clipboardItems) {
          for (const type of clipboardItem.types) {
            if (type.startsWith('image/')) {
              imageFound = true;
              const blob = await clipboardItem.getType(type);
              
              // Blob を File に変換
              const timestamp = Date.now();
              const extension = type.split('/')[1] || 'png';
              const fileName = `pasted-image-${timestamp}.${extension}`;
              const file = new File([blob], fileName, { type });

              // 既存のファイルアップロード処理を使用
              await handleFileUpload(nodeId, file);
              showNotification('success', '画像を貼り付けました');
              return;
            }
          }
        }

        if (!imageFound) {
          throw new Error('クリップボードに画像がありません');
        }
      } catch (error) {
        // エラーは上位でキャッチされて通常のペーストにフォールバック
        throw error;
      }
    },
    findNodeById: (nodeId: string) => data?.rootNode ? findNodeById(data.rootNode, nodeId) : null,
    closeAttachmentAndLinkLists: store.closeAttachmentAndLinkLists,
    cancelEditing: store.cancelEditing
  }, vim);

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
      validationErrors.forEach((error: string) => showNotification('error', error));
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
              
              logger.info('🚀 Cloud mode file upload starting...', {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                nodeId: nodeId,
                mapId: data?.id,
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
          logger.info('📎 Attaching file to node...', {
            nodeId,
            fileName: fileAttachment.name,
            hasDownloadUrl: !!fileAttachment.downloadUrl,
            hasDataURL: !!fileAttachment.dataURL,
            downloadUrl: fileAttachment.downloadUrl ? fileAttachment.downloadUrl.substring(0, 100) + '...' : 'none',
            existingAttachments: node.attachments?.length || 0
          });
          
          const updatedNode = {
            ...node,
            attachments: [...(node.attachments || []), fileAttachment]
          };
          updateNode(nodeId, updatedNode);
          logger.info('✅ File attached to node successfully:', {
            nodeId,
            fileName: fileAttachment.name,
            totalAttachments: updatedNode.attachments.length
          });
          
          // ファイル添付後に自動整列を実行
          if (typeof applyAutoLayout === 'function') {
            logger.debug('🎯 Applying auto layout after file attachment');
            requestAnimationFrame(() => {
              applyAutoLayout();
            });
          }
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

  // ファイル削除ハンドラー
  const handleFileDelete = async (nodeId: string, fileId: string): Promise<void> => {
    try {
      if (!data) {
        throw new Error('マインドマップデータが利用できません');
      }

      const node = findNodeById(data.rootNode, nodeId);
      if (!node || !node.attachments) {
        throw new Error('ノードまたは添付ファイルが見つかりません');
      }

      const fileToDelete = node.attachments.find(file => file.id === fileId);
      if (!fileToDelete) {
        throw new Error('削除するファイルが見つかりません');
      }

      // クラウドモードの場合はサーバーからも削除
      if (storageMode === 'cloud' && (fileToDelete.r2FileId || fileToDelete.id)) {
        const fileIdForDeletion = fileToDelete.r2FileId || fileToDelete.id;
        logger.info('Deleting file from cloud storage...', { 
          fileName: fileToDelete.name, 
          fileId: fileIdForDeletion,
          nodeId: nodeId,
          mapId: data.id
        });

        // ストレージアダプターを直接作成
        const { createStorageAdapter } = await import('../../../../core/storage/StorageAdapterFactory');
        const adapter = await createStorageAdapter(storageConfig);
        if (adapter && 'deleteFile' in adapter && typeof adapter.deleteFile === 'function') {
          await adapter.deleteFile(data.id, nodeId, fileIdForDeletion);
          logger.info('File deleted from cloud storage successfully');
        }
      }

      // ノードから添付ファイルを削除
      const updatedAttachments = node.attachments.filter(file => file.id !== fileId);
      const updatedNode = {
        ...node,
        attachments: updatedAttachments
      };

      updateNode(nodeId, updatedNode);
      showNotification('success', `${fileToDelete.name} を削除しました`);
      logger.debug('File deleted from node:', { nodeId, fileId, fileName: fileToDelete.name });
    } catch (error) {
      logger.error('File delete failed:', error);
      showNotification('error', 'ファイルの削除に失敗しました');
      handleError(error as Error, 'ファイル削除', fileId);
    }
  };

  // ユーティリティ関数

  // Context menu handlers
  const handleRightClick = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    
    // リンクリストまたは添付ファイルリスト表示中は右クリックコンテキストメニューを無効化
    if (ui.showLinkListForNode || ui.showAttachmentListForNode) {
      return;
    }
    
    setContextMenu({
      visible: true,
      position: { x: e.clientX, y: e.clientY },
      nodeId: nodeId
    });
    selectNode(nodeId); // Select the node when right-clicking
  };

  const handleContextMenuClose = () => {
    setContextMenu({
      visible: false,
      position: { x: 0, y: 0 },
      nodeId: null
    });
  };

  const handleAIGenerate = async (node: MindMapNode) => {
    // 生成開始の通知
    showNotification('info', 'AI子ノード生成中... 🤖');
    
    try {
      const childTexts = await ai.generateChildNodes(node);
      
      // Generate child nodes based on AI suggestions
      childTexts.forEach(text => {
        addNode(node.id, text.trim());
      });
      
      showNotification('success', `✅ ${childTexts.length}個の子ノードを生成しました`);
    } catch (error) {
      logger.error('AI child node generation failed:', error);
      showNotification('error', '❌ AI子ノード生成に失敗しました');
    } finally {
      handleContextMenuClose();
    }
  };

  // 他のマップのデータを取得する関数
  const loadMapData = useCallback(async (mapId: string): Promise<MindMapData | null> => {
    try {
      if (data && mapId === data.id) {
        // 現在のマップの場合はそのまま返す
        return data;
      }
      
      // 他のマップのデータを読み込む
      // 永続化フックから適切なメソッドを使用
      const targetMap = allMindMaps.find(map => map.id === mapId);
      if (targetMap) {
        // 既に読み込み済みのマップデータがある場合はそれを返す
        return targetMap;
      }
      
      // マップが見つからない場合
      logger.warn('指定されたマップが見つかりません:', mapId);
      showNotification('warning', '指定されたマップが見つかりません');
      return null;
    } catch (error) {
      logger.error('マップデータの読み込みに失敗:', error);
      showNotification('error', 'マップデータの読み込みに失敗しました');
      return null;
    }
  }, [data, allMindMaps, showNotification]);

  // UI用のハンドラー
  const handleTitleChange = (title: string) => {
    if (data) {
      updateMapMetadata(data.id, { title });
    }
  };

  // エクスポートハンドラー
  const handleExport = () => {
    setShowExportModal(true);
  };

  // マークダウンインポートハンドラー
  const handleImport = () => {
    setShowImportModal(true);
  };

  // インポート成功時のハンドラー
  const handleImportSuccess = async (importedData: MindMapData, warnings?: string[]) => {
    try {
      logger.info('マークダウンインポートが成功しました', {
        title: importedData.title,
        nodeCount: countNodes(importedData.rootNode),
        warnings,
        rootNode: importedData.rootNode,
        rootNodeChildren: importedData.rootNode?.children?.length || 0
      });

      // インポートされたデータを直接ストアに設定
      logger.info('ストアにデータを設定中...', { 
        hasData: !!importedData, 
        hasRootNode: !!importedData?.rootNode,
        rootNodeText: importedData?.rootNode?.text 
      });
      store.setData(importedData);

      // マップをマップリストに追加（永続化）
      logger.info('マップリストに追加中...', { mapId: importedData.id, title: importedData.title });
      if (typeof addImportedMapToList === 'function') {
        await addImportedMapToList(importedData);
        logger.info('✅ マップリストに追加完了');
      } else {
        logger.warn('⚠️ addImportedMapToList関数が利用できません');
      }
      
      // 設定後の確認
      const currentData = store.data;
      logger.info('ストア設定後の確認', {
        currentTitle: currentData?.title,
        currentRootText: currentData?.rootNode?.text,
        currentChildrenCount: currentData?.rootNode?.children?.length || 0
      });

      // インポート後に自動整列を適用
      logger.info('インポート後の自動整列を適用中...');
      if (typeof applyAutoLayout === 'function') {
        applyAutoLayout();
        logger.info('✅ 自動整列が完了しました');
      } else {
        logger.warn('⚠️ applyAutoLayout関数が利用できません');
      }

      // 成功通知
      showNotification('success', `「${importedData.title}」をインポートしました`);
      
      // 警告がある場合は表示
      if (warnings && warnings.length > 0) {
        warnings.forEach(warning => {
          showNotification('warning', warning);
        });
      }
    } catch (error) {
      logger.error('インポート後の処理でエラーが発生しました:', error);
      handleError(error as Error, 'インポート処理', 'データ作成');
    }
  };

  // ノード数を数える補助関数
  const countNodes = (node: MindMapNode): number => {
    let count = 1; // 現在のノード
    if (node.children) {
      count += node.children.reduce((sum, child) => sum + countNodes(child), 0);
    }
    return count;
  };

  // Link-related handlers
  const handleAddLink = (nodeId: string) => {
    console.log('📝 handleAddLink called:', nodeId);
    setEditingLink(null);
    setLinkModalNodeId(nodeId);
    setShowLinkModal(true);
  };

  const handleEditLink = (link: NodeLink, nodeId: string) => {
    console.log('🔥 handleEditLink called:', { link, nodeId });
    console.trace('Call stack:');
    setEditingLink(link);
    setLinkModalNodeId(nodeId);
    setShowLinkModal(true);
  };


  const handleSaveLink = async (linkData: Partial<NodeLink>) => {
    if (!linkModalNodeId) return;

    try {
      if (editingLink) {
        // Update existing link
        store.updateNodeLink(linkModalNodeId, editingLink.id, linkData);
        showNotification('success', 'リンクを更新しました');
      } else {
        // Add new link
        store.addNodeLink(linkModalNodeId, linkData);
        showNotification('success', 'リンクを追加しました');
      }
    } catch (error) {
      logger.error('Link save error:', error);
      handleError(error as Error, 'リンク操作', 'リンクの保存');
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!linkModalNodeId) return;

    try {
      store.deleteNodeLink(linkModalNodeId, linkId);
      showNotification('success', 'リンクを削除しました');
    } catch (error) {
      logger.error('Link delete error:', error);
      handleError(error as Error, 'リンク操作', 'リンクの削除');
    }
  };

  // ノードを画面中央に移動する関数
  const centerNodeInView = useCallback((nodeId: string, animate = true) => {
    if (!data) return;
    
    const targetNode = findNodeById(data.rootNode, nodeId);
    if (!targetNode) return;

    // ビューポートの中心座標を計算
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const viewportCenterX = viewportWidth / 2;
    const viewportCenterY = viewportHeight / 2;

    // ノードの現在の座標
    const nodeX = targetNode.x || 0;
    const nodeY = targetNode.y || 0;

    // 現在のズーム率を取得（SVGでは1.5倍されている）
    const currentZoom = ui.zoom * 1.5;

    // SVGの transform="scale(s) translate(tx, ty)" の場合、
    // 最終座標は s * (x + tx) となるため、中央に配置するには：
    // centerX = currentZoom * (nodeX + panX) → panX = centerX/currentZoom - nodeX
    const newPanX = viewportCenterX / currentZoom - nodeX;
    const newPanY = viewportCenterY / currentZoom - nodeY;

    if (animate) {
      // アニメーション付きでパンを更新
      const currentPan = ui.pan;
      // const duration = 300; // 300ms (未使用)
      const steps = 20;
      
      const deltaX = (newPanX - currentPan.x) / steps;
      const deltaY = (newPanY - currentPan.y) / steps;
      
      let step = 0;
      const animateStep = () => {
        if (step < steps) {
          step++;
          const currentX = currentPan.x + (deltaX * step);
          const currentY = currentPan.y + (deltaY * step);
          setPan({ x: currentX, y: currentY });
          
          requestAnimationFrame(animateStep);
        }
      };
      
      requestAnimationFrame(animateStep);
    } else {
      // 即座にパンを更新
      setPan({ x: newPanX, y: newPanY });
    }
  }, [data, ui.zoom, ui.pan, setPan]);

  // ルートノードを中央に表示するハンドラー
  const handleCenterRootNode = useCallback(() => {
    if (data?.rootNode) {
      centerNodeInView(data.rootNode.id, true);
    }
  }, [data?.rootNode, centerNodeInView]);

  const handleLinkNavigate = async (link: NodeLink) => {
    try {
      // If targetMapId is specified and different from current map
      if (link.targetMapId && link.targetMapId !== currentMapId) {
        // Navigate to different map
        try {
          await selectMapById(link.targetMapId);
          showNotification('success', `マップ "${link.targetMapId}" に移動しました`);
          
          // If targetNodeId is specified, select that node after map loads
          if (link.targetNodeId) {
            setTimeout(() => {
              selectNode(link.targetNodeId!);
              // マップロード後にノードを中央に移動
              setTimeout(() => {
                centerNodeInView(link.targetNodeId!);
              }, 100);
            }, 500); // Wait for map to load
          }
        } catch (error) {
          showNotification('error', `マップ "${link.targetMapId}" が見つかりません`);
          return;
        }
      } else if (link.targetNodeId) {
        // Navigate to node in current map
        if (data) {
          const targetNode = findNodeById(data.rootNode, link.targetNodeId);
          if (targetNode) {
            selectNode(link.targetNodeId);
            // ノードを画面中央に移動
            setTimeout(() => {
              if (link.targetNodeId) {
                centerNodeInView(link.targetNodeId);
              }
            }, 50); // DOM更新を待つ
            showNotification('success', `ノード "${targetNode.text}" に移動しました`);
          } else {
            showNotification('error', `ノード "${link.targetNodeId}" が見つかりません`);
          }
        }
      } else {
        showNotification('info', 'リンク先が指定されていません');
      }
    } catch (error) {
      logger.error('Link navigation error:', error);
      handleError(error as Error, 'リンク操作', 'リンク先への移動');
    }
  };

  const handleShowLinkActionMenu = (link: NodeLink, position: { x: number; y: number }) => {
    setLinkActionMenuData({ link, position });
    setShowLinkActionMenu(true);
  };

  const handleCloseLinkActionMenu = () => {
    setShowLinkActionMenu(false);
    setLinkActionMenuData(null);
  };

  const handleOutlineSave = async (updatedData: MindMapData) => {
    try {
      store.setData(updatedData);
      
      if (typeof applyAutoLayout === 'function') {
        applyAutoLayout();
      }
      
      showNotification('success', 'アウトラインをマインドマップに反映しました');
      store.setShowOutlineEditor(false);
    } catch (error) {
      logger.error('Outline save failed:', error);
      showNotification('error', 'アウトラインの保存に失敗しました');
      handleError(error as Error, 'アウトライン保存', 'データ変換');
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
    <div 
      className="mindmap-app"
      tabIndex={0}
      onFocus={() => {
        // Vimium対策: アプリケーションにフォーカス時にフォーカス状態を維持
      }}
      style={{ outline: 'none' }}
    >
      <ActivityBar
        activeView={activeView}
        onViewChange={setActiveView}
        onShowKeyboardHelper={() => setShowKeyboardHelper(!showKeyboardHelper)}
      />
      
      <PrimarySidebar
        activeView={activeView}
        isVisible={activeView !== null}
        mindMaps={allMindMaps}
        currentMapId={currentMapId}
        onSelectMap={(mapId) => { selectMapById(mapId); }}
        onCreateMap={createAndSelectMap}
        onDeleteMap={deleteMap}
        onRenameMap={(mapId, title) => updateMapMetadata(mapId, { title })}
        onChangeCategory={(mapId, category) => updateMapMetadata(mapId, { category })}
        onChangeCategoryBulk={updateMultipleMapCategories}
        availableCategories={['仕事', 'プライベート', '学習', '未分類']}
        storageMode={storageMode}
        onStorageModeChange={onModeChange}
        onShowKeyboardHelper={() => setShowKeyboardHelper(!showKeyboardHelper)}
        onAutoLayout={() => {
          logger.info('Manual auto layout triggered');
          if (typeof mindMap.applyAutoLayout === 'function') {
            mindMap.applyAutoLayout();
          } else {
            logger.error('applyAutoLayout function not available');
          }
        }}
        onExport={handleExport}
        onImport={handleImport}
        currentMapData={data}
        onNodeSelect={(nodeId) => {
          selectNode(nodeId);
          centerNodeInView(nodeId);
        }}
        onMapSwitch={(mapId) => {
          selectMapById(mapId);
        }}
      />

      <div className={`mindmap-main-content ${activeView ? 'with-sidebar' : ''}`}>
        <MindMapHeader 
          data={data}
          onTitleChange={handleTitleChange}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          zoom={ui.zoom}
          onZoomReset={() => setZoom(1.0)}
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
          onToggleViewMode={() => store.toggleViewMode()}
          viewMode={ui.viewMode}
          onCenterRootNode={handleCenterRootNode}
        />
        
        <div className="workspace-container">
          {ui.viewMode === 'mindmap' ? (
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
              onAddSibling={(nodeId) => store.addSiblingNode(nodeId)}
              onDeleteNode={deleteNode}
              onRightClick={handleRightClick}
              onToggleCollapse={toggleNodeCollapse}
              onFileUpload={(nodeId, files) => {
                if (files.length > 0) {
                  handleFileUpload(nodeId, files[0]);
                }
              }}
              onRemoveFile={handleFileDelete}
              onShowImageModal={showImageModal}
              onShowFileActionMenu={(file, _nodeId, position) => showFileActionMenu(file, position)}
              onShowLinkActionMenu={handleShowLinkActionMenu}
              onAddLink={handleAddLink}
              onUpdateNode={updateNode}
              onAutoLayout={applyAutoLayout}
              availableMaps={allMindMaps.map(map => ({ id: map.id, title: map.title }))}
              currentMapData={data}
              onLinkNavigate={handleLinkNavigate}
              zoom={ui.zoom}
              setZoom={setZoom}
              pan={ui.pan}
              setPan={setPan}
              onToggleAttachmentList={store.toggleAttachmentListForNode}
              onToggleLinkList={store.toggleLinkListForNode}
            />
          ) : (
            <OutlineWorkspace
              data={data}
              onSave={(updatedData) => {
                store.setData(updatedData);
                if (typeof applyAutoLayout === 'function') {
                  applyAutoLayout();
                }
              }}
              hasSidebar={activeView !== null}
            />
          )}
          
          {ui.showNotesPanel && ui.viewMode === 'mindmap' && (
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
        nodeOperations={{
          findNode: (nodeId: string) => findNodeById(data?.rootNode, nodeId),
          onDeleteNode: deleteNode,
          onUpdateNode: updateNode,
          onCopyNode: () => {},
          onPasteNode: () => {},
          onShowCustomization: () => {},
          onAddChild: (parentId: string, text?: string) => {
            return store.addChildNode(parentId, text || 'New Node');
          }
        }}
        fileOperations={{
          onFileDownload: handleFileDownload,
          onFileRename: () => {},
          onFileDelete: (fileId: string) => {
            // selectedFileとselectedNodeIdから適切なnodeIdを取得する必要があります
            if (ui.selectedFile && ui.selectedFile.nodeId) {
              handleFileDelete(ui.selectedFile.nodeId, fileId);
            } else if (ui.selectedFile && selectedNodeId) {
              // fallbackとしてselectedNodeIdを使用
              handleFileDelete(selectedNodeId, fileId);
            }
          },
          onShowImageModal: showImageModal
        }}
        uiOperations={{
          onCloseContextMenu: closeAllPanels,
          onCloseCustomizationPanel: closeAllPanels,
          onCloseImageModal: closeAllPanels,
          onCloseFileActionMenu: closeAllPanels
        }}
      />
      
      {/* Keyboard Shortcut Helper */}
      <KeyboardShortcutHelper
        isVisible={showKeyboardHelper}
        onClose={() => setShowKeyboardHelper(false)}
      />
      
      {/* Vim status bar */}
      <VimStatusBar />
      
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
        />
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        mindMapData={data}
      />

      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={handleImportSuccess}
      />

      {/* Node Link Modal */}
      {showLinkModal && linkModalNodeId && (
        <NodeLinkModal
          isOpen={showLinkModal}
          onClose={() => {
            setShowLinkModal(false);
            setEditingLink(null);
            setLinkModalNodeId(null);
          }}
          node={findNodeById(data.rootNode, linkModalNodeId)!}
          link={editingLink}
          onSave={handleSaveLink}
          onDelete={handleDeleteLink}
          availableMaps={allMindMaps.map(map => ({ id: map.id, title: map.title }))}
          currentMapData={data}
          onLoadMapData={loadMapData}
        />
      )}

      {/* Link Action Menu */}
      {showLinkActionMenu && linkActionMenuData && (
        <LinkActionMenu
          isOpen={showLinkActionMenu}
          position={linkActionMenuData.position}
          link={linkActionMenuData.link}
          onClose={handleCloseLinkActionMenu}
          onNavigate={handleLinkNavigate}
          onEdit={(link) => {
            handleCloseLinkActionMenu();
            handleEditLink(link, linkModalNodeId!);
          }}
          onDelete={(linkId) => {
            handleCloseLinkActionMenu();
            handleDeleteLink(linkId);
          }}
          availableMaps={allMindMaps.map(map => ({ id: map.id, title: map.title }))}
          currentMapData={data}
        />
      )}
      
      {/* Outline Editor */}
      {ui.showOutlineEditor && (
        <OutlineWorkspace
          data={data}
          onSave={handleOutlineSave}
          onClose={() => store.setShowOutlineEditor(false)}
          hasSidebar={activeView !== null}
        />
      )}

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.nodeId && (
        <ContextMenu
          visible={contextMenu.visible}
          position={contextMenu.position}
          selectedNode={data?.rootNode ? findNodeById(data.rootNode, contextMenu.nodeId) : null}
          onDelete={deleteNode}
          onCustomize={(node) => {
            selectNode(node.id);
            store.showCustomization({ x: contextMenu.position.x, y: contextMenu.position.y });
            handleContextMenuClose();
          }}
          onFileUpload={(nodeId, files) => {
            if (files.length > 0) {
              handleFileUpload(nodeId, files[0]);
            }
          }}
          onAddLink={(nodeId) => {
            setLinkModalNodeId(nodeId);
            setShowLinkModal(true);
          }}
          onCopy={(node) => {
            // ショートカットキーと同じcopyNode関数を使用
            const copyNode = (nodeId: string) => {
              const nodeToFind = data?.rootNode ? findNodeById(data.rootNode, nodeId) : null;
              if (nodeToFind) {
                // 内部クリップボードに保存
                store.setClipboard(nodeToFind);
                
                // システムクリップボードにマークダウン形式で保存
                const convertNodeToMarkdown = (node: MindMapNode, level: number = 0): string => {
                  const prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
                  let markdown = `${prefix}${node.text}\n`;
                  
                  // ノートがあれば追加
                  if (node.note && node.note.trim()) {
                    markdown += `${node.note}\n`;
                  }
                  
                  // 子ノードを再帰的に処理
                  if (node.children && node.children.length > 0) {
                    node.children.forEach(child => {
                      markdown += convertNodeToMarkdown(child, level + 1);
                    });
                  }
                  
                  return markdown;
                };
                
                const markdownText = convertNodeToMarkdown(nodeToFind);
                
                // システムクリップボードに書き込み
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(markdownText).catch((error) => {
                    console.warn('システムクリップボードへの書き込みに失敗:', error);
                  });
                }
                
                showNotification('success', `「${nodeToFind.text}」をコピーしました`);
              }
            };
            
            copyNode(node.id);
            handleContextMenuClose();
          }}
          onPaste={async (parentId) => {
            // ショートカットキーと同じpasteNode関数を使用
            const pasteNode = async (parentId: string) => {
              // まずシステムクリップボードからMindMeisterのマークダウンを確認
              try {
                if (navigator.clipboard && navigator.clipboard.readText) {
                  const clipboardText = await navigator.clipboard.readText();
                  
                  // MindMeisterのマークダウン形式かチェック
                  const { isMindMeisterFormat, parseMindMeisterMarkdown } = await import('../../../../shared/utils/mindMeisterParser');
                  
                  if (clipboardText && isMindMeisterFormat(clipboardText)) {
                    const parsedNode = parseMindMeisterMarkdown(clipboardText);
                    
                    if (parsedNode) {
                      // パースされたノード構造を貼り付け
                      const pasteNodeRecursively = (nodeToAdd: MindMapNode, parentId: string): string | undefined => {
                        const newNodeId = store.addChildNode(parentId, nodeToAdd.text);
                        
                        if (newNodeId) {
                          updateNode(newNodeId, {
                            fontSize: nodeToAdd.fontSize,
                            fontWeight: nodeToAdd.fontWeight,
                            color: nodeToAdd.color,
                            collapsed: false,
                            attachments: nodeToAdd.attachments || [],
                            note: nodeToAdd.note
                          });
                          
                          if (nodeToAdd.children && nodeToAdd.children.length > 0) {
                            nodeToAdd.children.forEach(child => {
                              pasteNodeRecursively(child, newNodeId);
                            });
                          }
                        }
                        
                        return newNodeId;
                      };
                      
                      const newNodeId = pasteNodeRecursively(parsedNode, parentId);
                      if (newNodeId) {
                        showNotification('success', `「${parsedNode.text}」をMindMeisterから貼り付けました`);
                        selectNode(newNodeId);
                        return;
                      }
                    }
                  }
                }
              } catch (error) {
                console.warn('システムクリップボードからの読み取りに失敗:', error);
              }
              
              // フォールバック: 内部クリップボードから貼り付け
              const clipboardNode = ui.clipboard;
              if (!clipboardNode) {
                showNotification('warning', 'コピーされたノードがありません');
                return;
              }
              
              const pasteNodeRecursively = (nodeToAdd: MindMapNode, parentId: string): string | undefined => {
                const newNodeId = store.addChildNode(parentId, nodeToAdd.text);
                
                if (newNodeId) {
                  updateNode(newNodeId, {
                    fontSize: nodeToAdd.fontSize,
                    fontWeight: nodeToAdd.fontWeight,
                    color: nodeToAdd.color,
                    collapsed: false,
                    attachments: nodeToAdd.attachments || []
                  });
                  
                  if (nodeToAdd.children && nodeToAdd.children.length > 0) {
                    nodeToAdd.children.forEach(child => {
                      pasteNodeRecursively(child, newNodeId);
                    });
                  }
                }
                
                return newNodeId;
              };
              
              const newNodeId = pasteNodeRecursively(clipboardNode, parentId);
              if (newNodeId) {
                showNotification('success', `「${clipboardNode.text}」を貼り付けました`);
                selectNode(newNodeId);
              }
            };
            
            await pasteNode(parentId);
            handleContextMenuClose();
          }}
          onAIGenerate={ai.aiSettings.enabled ? handleAIGenerate : undefined}
          onClose={handleContextMenuClose}
        />
      )}
    </div>
  );
};

const MindMapApp: React.FC<MindMapAppProps> = (props) => {
  return (
    <MindMapProviders>
      <MindMapAppContent {...props} />
    </MindMapProviders>
  );
};

export default MindMapApp;