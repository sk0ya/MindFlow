import { useState, useCallback, useEffect } from 'react';
import { useMindMapData } from '../../features/mindmap/useMindMapData.js';
import { useMindMapNodes } from '../../features/mindmap/useMindMapNodes.js';
import { useMindMapFiles } from '../../features/files/useMindMapFiles.js';
import { useMindMapMulti } from '../../features/mindmap/useMindMapMulti.js';
import type { MindMapData, MindMapNode, User } from '../../shared/types/index.js';

type NavigationDirection = 'up' | 'down' | 'left' | 'right';

interface UseMindMapResult {
  // データ
  data: MindMapData | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  
  // 状態更新
  setSelectedNodeId: (id: string | null) => void;
  setEditingNodeId: (id: string | null) => void;
  setEditText: (text: string) => void;
  
  // ノード操作
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  addChildNode: (parentId: string, text?: string, startEditing?: boolean) => Promise<void>;
  addSiblingNode: (siblingId: string, text?: string, startEditing?: boolean) => Promise<void>;
  deleteNode: (nodeId: string) => void;
  dragNode: (nodeId: string, x: number, y: number) => void;
  changeParent: (nodeId: string, newParentId: string) => void;
  findNode: (nodeId: string) => MindMapNode | null;
  findParentNode: (nodeId: string) => MindMapNode | null;
  flattenNodes: (rootNode: MindMapNode) => MindMapNode[];
  applyAutoLayout: (algorithm?: string) => void;
  navigateToDirection: (direction: NavigationDirection) => void;
  
  // 編集
  startEdit: (nodeId: string) => void;
  finishEdit: (nodeId: string, text: string) => void;
  
  // 折りたたみ
  toggleCollapse: (nodeId: string) => void;
  
  // ナビゲーション
  zoom: number;
  setZoom: (zoom: number) => void;
  pan: { x: number; y: number };
  setPan: (pan: { x: number; y: number }) => void;
  resetView: () => void;
  
  // ファイル添付
  attachFileToNode: (nodeId: string, file: File) => Promise<void>;
  removeFileFromNode: (nodeId: string, fileId: string) => void;
  renameFileInNode: (nodeId: string, fileId: string, newName: string) => void;
  downloadFile: (file: File) => void;
  isAppInitializing: boolean;
  
  // 履歴
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  
  // その他
  updateTitle: (title: string) => void;
  changeTheme: (theme: string) => void;
  updateSettings: (settings: any) => void;
  saveMindMap: () => Promise<void>;
  triggerCloudSync: () => void;
  
  // マルチマップ管理
  allMindMaps: any[];
  currentMapId: string | null;
  createMindMap: (title?: string) => Promise<void>;
  renameMindMap: (mapId: string, newTitle: string) => Promise<void>;
  deleteMindMapById: (mapId: string) => Promise<void>;
  switchToMap: (mapId: string, selectRoot?: boolean) => Promise<void>;
  refreshAllMindMaps: () => Promise<void>;
  
  // カテゴリー管理
  changeMapCategory: (mapId: string, category: string) => Promise<void>;
  getAvailableCategories: () => string[];
  
  // 初期化管理
  reinitializeAfterModeSelection: () => Promise<void>;
}

// 緊急復旧: 完全に簡略化されたuseMindMap（常に同じフック数）
export const useMindMap = (isAppReady: boolean = false): UseMindMapResult => {
  // デバッグログを制限（初回のみ）
  const [debugLogged, setDebugLogged] = useState(false);
  
  // 🚨 重要: isAppReadyに関係なく、常に同じ順序でフックを呼び出す
  const dataHook = useMindMapData(isAppReady);
  
  // デバッグログ（初回または状態変化時のみ）
  useEffect(() => {
    if (!debugLogged || (dataHook.data?.id && !debugLogged)) {
      console.log('🔧 useMindMap called with isAppReady:', isAppReady);
      console.log('📊 Data hook result:', { hasData: !!dataHook.data, title: dataHook.data?.title });
      setDebugLogged(true);
    }
  }, [isAppReady, dataHook.data?.id, debugLogged]);
  
  // ノード操作（dataがある場合のみ）
  const nodeHook = useMindMapNodes(dataHook.data, dataHook.updateData, dataHook.blockRealtimeSyncTemporarily);
  
  // ナビゲーション（簡略化版）
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  const navigateToDirection = useCallback((direction: NavigationDirection): void => {
    console.log('🧭 Navigate to direction:', direction, { selectedNodeId: nodeHook.selectedNodeId });
    
    if (!nodeHook.selectedNodeId || !dataHook.data?.rootNode) {
      console.log('⚠️ Navigation cancelled: no selected node or data');
      return;
    }
    
    const allNodes = nodeHook.flattenNodes(dataHook.data.rootNode);
    const currentNode = nodeHook.findNode(nodeHook.selectedNodeId);
    if (!currentNode) {
      console.log('⚠️ Navigation cancelled: current node not found');
      return;
    }
    
    let targetNode: MindMapNode | null = null;
    let minDistance = Infinity;
    
    // 座標ベースで方向にあるノードを探す
    allNodes.forEach(node => {
      if (node.id === nodeHook.selectedNodeId) return;
      
      const dx = node.x - currentNode.x;
      const dy = node.y - currentNode.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      let isInDirection = false;
      
      switch (direction) {
        case 'up':
          isInDirection = dy < -20 && Math.abs(dx) < Math.abs(dy);
          break;
        case 'down':
          isInDirection = dy > 20 && Math.abs(dx) < Math.abs(dy);
          break;
        case 'left':
          isInDirection = dx < -20 && Math.abs(dy) < Math.abs(dx);
          break;
        case 'right':
          isInDirection = dx > 20 && Math.abs(dy) < Math.abs(dx);
          break;
      }
      
      if (isInDirection && distance < minDistance) {
        minDistance = distance;
        targetNode = node;
      }
    });
    
    // 方向にノードが見つからない場合は階層関係で代替
    if (!targetNode) {
      console.log('🔄 No node found in direction, trying hierarchical fallback');
      
      switch (direction) {
        case 'up':
          // 上方向: 親ノードを選択
          targetNode = nodeHook.findParentNode(nodeHook.selectedNodeId);
          break;
        case 'down':
          // 下方向: 最初の子ノードを選択
          targetNode = currentNode.children && currentNode.children.length > 0 
            ? currentNode.children[0] : null;
          break;
        case 'left':
          // 左方向: 前の兄弟ノードを選択
          const leftParent = nodeHook.findParentNode(nodeHook.selectedNodeId);
          if (leftParent && leftParent.children) {
            const currentIndex = leftParent.children.findIndex(child => child.id === nodeHook.selectedNodeId);
            targetNode = currentIndex > 0 ? leftParent.children[currentIndex - 1] : null;
          }
          break;
        case 'right':
          // 右方向: 次の兄弟ノードを選択
          const rightParent = nodeHook.findParentNode(nodeHook.selectedNodeId);
          if (rightParent && rightParent.children) {
            const currentIndex = rightParent.children.findIndex(child => child.id === nodeHook.selectedNodeId);
            targetNode = currentIndex < rightParent.children.length - 1 
              ? rightParent.children[currentIndex + 1] : null;
          }
          break;
      }
    }
    
    if (targetNode) {
      console.log('✅ Navigation successful:', { from: nodeHook.selectedNodeId, to: targetNode.id, direction });
      nodeHook.setSelectedNodeId(targetNode.id);
    } else {
      console.log('⚠️ No target node found for direction:', direction);
    }
  }, [nodeHook.selectedNodeId, dataHook.data, nodeHook.flattenNodes, nodeHook.findNode, nodeHook.findParentNode, nodeHook.setSelectedNodeId]);

  // マルチマップ管理
  const multiHook = useMindMapMulti(dataHook.data, dataHook.setData, dataHook.updateData);
  
  // ファイル添付
  const fileHook = useMindMapFiles(nodeHook.findNode, nodeHook.updateNode, multiHook.currentMapId);

  return {
    // データ
    data: dataHook.data,
    selectedNodeId: nodeHook.selectedNodeId,
    editingNodeId: nodeHook.editingNodeId,
    editText: nodeHook.editText,
    
    // 状態更新
    setSelectedNodeId: nodeHook.setSelectedNodeId,
    setEditingNodeId: nodeHook.setEditingNodeId,
    setEditText: nodeHook.setEditText,
    
    // ノード操作
    updateNode: nodeHook.updateNode,
    addChildNode: nodeHook.addChildNode,
    addSiblingNode: nodeHook.addSiblingNode,
    deleteNode: nodeHook.deleteNode,
    dragNode: nodeHook.dragNode,
    changeParent: nodeHook.changeParent,
    findNode: nodeHook.findNode,
    findParentNode: nodeHook.findParentNode,
    flattenNodes: nodeHook.flattenNodes,
    applyAutoLayout: nodeHook.applyAutoLayout,
    navigateToDirection,
    
    // 編集
    startEdit: nodeHook.startEdit,
    finishEdit: nodeHook.finishEdit,
    
    // 折りたたみ
    toggleCollapse: nodeHook.toggleCollapse,
    
    // ナビゲーション (簡略化)
    zoom,
    setZoom,
    pan,
    setPan,
    resetView: () => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    },
    
    // ファイル添付
    attachFileToNode: fileHook.attachFileToNode,
    removeFileFromNode: fileHook.removeFileFromNode,
    renameFileInNode: fileHook.renameFileInNode,
    downloadFile: fileHook.downloadFile,
    isAppInitializing: fileHook.isAppInitializing,
    
    // 履歴
    undo: dataHook.undo,
    redo: dataHook.redo,
    canUndo: dataHook.canUndo,
    canRedo: dataHook.canRedo,
    
    // その他
    updateTitle: dataHook.updateTitle,
    changeTheme: dataHook.changeTheme,
    updateSettings: dataHook.updateSettings,
    saveMindMap: dataHook.saveMindMap,
    triggerCloudSync: dataHook.triggerCloudSync,
    
    // マルチマップ管理
    allMindMaps: multiHook.allMindMaps,
    currentMapId: multiHook.currentMapId,
    createMindMap: multiHook.createMindMap,
    renameMindMap: multiHook.renameMindMap,
    deleteMindMapById: multiHook.deleteMindMapById,
    switchToMap: (mapId, selectRoot = false) => {
      return multiHook.switchToMap(
        mapId, 
        selectRoot, 
        nodeHook.setSelectedNodeId, 
        nodeHook.setEditingNodeId, 
        nodeHook.setEditText, 
        dataHook.setHistory, 
        dataHook.setHistoryIndex,
        nodeHook.finishEdit  // finishEditを渡す
      );
    },
    refreshAllMindMaps: multiHook.refreshAllMindMaps,
    
    // カテゴリー管理
    changeMapCategory: multiHook.changeMapCategory,
    getAvailableCategories: multiHook.getAvailableCategories,
    
    // 初期化管理
    reinitializeAfterModeSelection: multiHook.reinitializeAfterModeSelection
  };
};