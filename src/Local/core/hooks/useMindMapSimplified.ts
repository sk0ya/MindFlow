import { useCallback, useEffect, useState } from 'react';
import { useMindMapStore } from '../store/mindMapStore';
import type { MindMapNode, MindMapData, Position } from '@shared/types';
import { createInitialData } from '@local/shared/types/dataTypes';
import type { ImageFile } from '@local/shared/types';

// 型検証関数
const isMindMapData = (data: unknown): data is MindMapData => {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'title' in data &&
    'rootNode' in data &&
    typeof (data as { id: unknown; title: unknown }).id === 'string' &&
    typeof (data as { id: unknown; title: unknown }).title === 'string'
  );
};

const isMindMapDataArray = (data: unknown): data is MindMapData[] => {
  return Array.isArray(data) && data.every(item => isMindMapData(item));
};

/**
 * 簡素化されたマインドマップフック
 * 責任を明確に分離し、パフォーマンスを最適化
 */
export const useMindMapSimplified = (isAppReady: boolean = true) => {
  // Zustandストアから直接状態を取得
  const store = useMindMapStore();

  // 初期データの読み込み
  useEffect(() => {
    if (isAppReady && !store.data) {
      // Loading initial data...
      const savedData = localStorage.getItem('mindMapData');
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          if (isMindMapData(parsedData)) {
            // Loaded saved data successfully
            store.setData(parsedData);
          } else {
            throw new Error('Invalid MindMapData format');
          }
        } catch (error) {
          console.error('Failed to load saved data:', error);
          // デフォルトデータを作成
          const initialData = createInitialData();
          console.log('Created initial data:', initialData);
          store.setData(initialData);
        }
      } else {
        // 初回起動時
        console.log('No saved data, creating initial data...');
        const initialData = createInitialData();
        console.log('Created initial data:', initialData);
        store.setData(initialData);
      }
    }
  }, [isAppReady, store]);

  // データの自動保存
  useEffect(() => {
    if (store.data) {
      const saveTimeout = setTimeout(() => {
        localStorage.setItem('mindMapData', JSON.stringify(store.data));
      }, 500); // 500msのデバウンス
      
      return () => clearTimeout(saveTimeout);
    }
    return undefined;
  }, [store.data]);

  // データ操作のアクション
  const dataActions = {
    // ノード操作
    updateNode: useCallback((nodeId: string, updates: Partial<MindMapNode>) => {
      store.updateNode(nodeId, updates);
    }, [store]),

    addChildNode: useCallback(async (parentId: string, text = ''): Promise<string | null> => {
      const newNodeId = store.addChildNode(parentId, text);
      return newNodeId || null;
    }, [store]),

    addSiblingNode: useCallback(async (nodeId: string, text = '', startEditing = false): Promise<string | null> => {
      const newNodeId = store.addSiblingNode(nodeId, text);
      if (startEditing && newNodeId) {
        store.startEditing(newNodeId);
      }
      return newNodeId || null;
    }, [store]),

    deleteNode: useCallback((nodeId: string) => {
      store.deleteNode(nodeId);
    }, [store]),

    moveNode: useCallback((nodeId: string, newParentId: string) => {
      store.moveNode(nodeId, newParentId);
    }, [store]),

    changeSiblingOrder: useCallback((draggedNodeId: string, targetNodeId: string, insertBefore: boolean = true) => {
      console.log('🎯 useMindMapSimplified changeSiblingOrder:', { draggedNodeId, targetNodeId, insertBefore });
      store.changeSiblingOrder(draggedNodeId, targetNodeId, insertBefore);
    }, [store]),

    findNode: useCallback((nodeId: string): MindMapNode | null => {
      return store.findNode(nodeId);
    }, [store]),

    // 編集操作
    startEditingNode: useCallback((nodeId: string) => {
      store.startEditing(nodeId);
    }, [store]),

    finishEditingNode: useCallback((nodeId: string, text: string) => {
      store.finishEditing(nodeId, text);
    }, [store]),

    setEditText: useCallback((text: string) => {
      store.setEditText(text);
    }, [store]),

    // 履歴操作
    undo: useCallback(() => {
      store.undo();
    }, [store]),

    redo: useCallback(() => {
      store.redo();
    }, [store])
  };

  // UI操作のアクション
  const uiActions = {
    // 選択操作
    setSelectedNodeId: useCallback((nodeId: string | null) => {
      store.selectNode(nodeId);
    }, [store]),

    // ズーム・パン操作
    setZoom: useCallback((zoom: number) => {
      store.setZoom(zoom);
    }, [store]),

    setPan: useCallback((pan: Position) => {
      store.setPan(pan);
    }, [store]),

    resetZoom: useCallback(() => {
      store.resetZoom();
    }, [store]),

    // パネル操作
    setShowCustomizationPanel: useCallback((show: boolean) => {
      store.setShowCustomizationPanel(show);
    }, [store]),

    setShowContextMenu: useCallback((show: boolean) => {
      store.setShowContextMenu(show);
    }, [store]),

    setContextMenuPosition: useCallback((position: Position) => {
      store.setContextMenuPosition(position);
    }, [store]),

    setShowShortcutHelper: useCallback((show: boolean) => {
      store.setShowShortcutHelper(show);
    }, [store]),

    setShowMapList: useCallback((show: boolean) => {
      store.setShowMapList(show);
    }, [store]),

    setShowLocalStoragePanel: useCallback((show: boolean) => {
      store.setShowLocalStoragePanel(show);
    }, [store]),

    setShowTutorial: useCallback((show: boolean) => {
      store.setShowTutorial(show);
    }, [store]),

    setClipboard: useCallback((node: MindMapNode) => {
      store.setClipboard(node);
    }, [store]),

    setShowImageModal: useCallback((show: boolean) => {
      store.setShowImageModal(show);
    }, [store]),

    setShowFileActionMenu: useCallback((show: boolean) => {
      store.setShowFileActionMenu(show);
    }, [store]),

    setSelectedImage: useCallback((file: ImageFile | null) => {
      store.setSelectedImage(file);
    }, [store]),

    closeAllPanels: useCallback(() => {
      store.closeAllPanels();
    }, [store]),

    toggleSidebar: useCallback(() => {
      store.toggleSidebar();
    }, [store]),

    applyAutoLayout: useCallback(() => {
      store.applyAutoLayout();
    }, [store]),

    showCustomization: useCallback((_node: MindMapNode, position: Position) => {
      store.showCustomization(position);
    }, [store]),

    showNodeMapLinks: useCallback((node: MindMapNode, position: Position) => {
      store.showNodeMapLinks(node, position);
    }, [store]),

    closeNodeMapLinksPanel: useCallback(() => {
      store.closeNodeMapLinksPanel();
    }, [store])
  };

  // マップ一覧を管理
  const [allMindMaps, setAllMindMaps] = useState<MindMapData[]>([]);

  // マップ管理アクション
  const mapActions = {
    createMap: useCallback((title: string, category?: string) => {
      const newMap = createInitialData();
      newMap.id = `map_${Date.now()}`;
      newMap.title = title;
      newMap.category = category || '未分類';
      newMap.createdAt = new Date().toISOString();
      newMap.updatedAt = new Date().toISOString();
      
      // 新しいマップを一覧に追加
      setAllMindMaps(prevMaps => [...prevMaps, newMap]);
      
      // 新しいマップに切り替え
      store.setData(newMap);
      
      console.log('Created new map:', newMap);
    }, [store]),

    selectMap: useCallback((mapId: string) => {
      const selectedMap = allMindMaps.find(map => map.id === mapId);
      if (selectedMap) {
        store.setData(selectedMap);
        console.log('Selected map:', selectedMap);
      }
    }, [allMindMaps, store]),

    deleteMap: useCallback((mapId: string) => {
      setAllMindMaps(prevMaps => prevMaps.filter(map => map.id !== mapId));
      
      // 削除されたマップが現在選択されている場合、別のマップに切り替え
      if (store.data?.id === mapId) {
        const remainingMaps = allMindMaps.filter(map => map.id !== mapId);
        if (remainingMaps.length > 0) {
          store.setData(remainingMaps[0]);
        } else {
          // 全てのマップが削除された場合、新しいマップを作成
          const newMap = createInitialData();
          newMap.id = `map_${Date.now()}`;
          newMap.title = '新しいマインドマップ';
          newMap.category = '未分類';
          store.setData(newMap);
          setAllMindMaps([newMap]);
        }
      }
      
      console.log('Deleted map:', mapId);
    }, [allMindMaps, store]),

    renameMap: useCallback((mapId: string, newTitle: string) => {
      setAllMindMaps(prevMaps => 
        prevMaps.map(map => 
          map.id === mapId 
            ? { ...map, title: newTitle, updatedAt: new Date().toISOString() }
            : map
        )
      );
      
      // 現在のマップの場合、ストアも更新
      if (store.data?.id === mapId) {
        const updatedMap = { ...store.data, title: newTitle, updatedAt: new Date().toISOString() };
        store.setData(updatedMap);
      }
      
      console.log('Renamed map:', mapId, 'to:', newTitle);
    }, [store]),

    changeCategory: useCallback((mapId: string, category: string) => {
      setAllMindMaps(prevMaps => 
        prevMaps.map(map => 
          map.id === mapId 
            ? { ...map, category, updatedAt: new Date().toISOString() }
            : map
        )
      );
      
      // 現在のマップの場合、ストアも更新
      if (store.data?.id === mapId) {
        const updatedMap = { ...store.data, category, updatedAt: new Date().toISOString() };
        store.setData(updatedMap);
      }
      
      console.log('Changed category for map:', mapId, 'to:', category);
    }, [store])
  };
  
  // 現在のマップをマップ一覧に追加/更新
  useEffect(() => {
    if (store.data) {
      setAllMindMaps(prevMaps => {
        const existingIndex = prevMaps.findIndex(map => map.id === store.data?.id);
        if (existingIndex >= 0 && store.data) {
          // 既存のマップを更新
          const newMaps = [...prevMaps];
          newMaps[existingIndex] = store.data;
          return newMaps;
        } else if (store.data) {
          // 新しいマップを追加
          return [...prevMaps, store.data];
        }
        return prevMaps;
      });
    }
  }, [store.data]);

  // LocalStorageから全マップを読み込み
  useEffect(() => {
    const loadAllMaps = () => {
      try {
        const savedMaps = localStorage.getItem('allMindMaps');
        if (savedMaps) {
          const parsedMaps = JSON.parse(savedMaps);
          if (isMindMapDataArray(parsedMaps)) {
            setAllMindMaps(parsedMaps);
          } else {
            console.error('Invalid MindMapData array format');
          }
        }
      } catch (error) {
        console.error('Failed to load all maps:', error);
      }
    };
    
    loadAllMaps();
  }, []);

  // 全マップをLocalStorageに保存
  useEffect(() => {
    if (allMindMaps.length > 0) {
      localStorage.setItem('allMindMaps', JSON.stringify(allMindMaps));
    }
  }, [allMindMaps]);

  // 現在の状態を取得
  const state = {
    // データ状態
    data: store.data,
    selectedNodeId: store.selectedNodeId,
    editingNodeId: store.editingNodeId,
    editText: store.editText,
    
    // UI状態
    ui: store.ui,
    
    // 履歴状態
    canUndo: store.canUndo(),
    canRedo: store.canRedo(),
    
    // マップ一覧
    allMindMaps: allMindMaps,
    currentMapId: store.data?.id || null
  };

  return {
    // 状態
    ...state,
    
    // アクション
    ...dataActions,
    ...uiActions,
    ...mapActions
  };
};