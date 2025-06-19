import { useMindMapData } from './useMindMapData.js';
import { useMindMapNodes } from './useMindMapNodes.js';
import { useMindMapNavigation } from './useMindMapNavigation.js';
import { useMindMapFiles } from './useMindMapFiles.js';
import { useMindMapMulti } from './useMindMapMulti.js';

// リファクタリング後のメインフック（元のuseMindMapの代替）
export const useMindMap = () => {
  // データ管理
  const {
    data,
    setData,
    updateData,
    undo,
    redo,
    canUndo,
    canRedo,
    updateSettings,
    updateTitle,
    changeTheme,
    saveMindMap
  } = useMindMapData();

  // ノード操作
  const {
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
    changeParent,
    findNode,
    findParentNode,
    flattenNodes,
    applyAutoLayout,
    startEdit,
    finishEdit,
    toggleCollapse
  } = useMindMapNodes(data, updateData);

  // ナビゲーション
  const { navigateToDirection } = useMindMapNavigation(
    findNode, 
    findParentNode, 
    flattenNodes, 
    selectedNodeId, 
    setSelectedNodeId, 
    data
  );

  // ファイル添付
  const {
    attachFileToNode,
    removeFileFromNode,
    renameFileInNode,
    downloadFile
  } = useMindMapFiles(findNode, updateNode);

  // マルチマップ管理
  const {
    allMindMaps,
    currentMapId,
    setCurrentMapId,
    refreshAllMindMaps,
    createMindMap,
    renameMindMap,
    deleteMindMapById,
    changeMapCategory,
    getAvailableCategories,
    switchToMap: switchToMapBase
  } = useMindMapMulti(data, setData, updateData);

  // switchToMapのラッパー（適切な引数を渡す）
  const switchToMap = (mapId, selectRoot = false) => {
    // 履歴管理は現在useMindMapDataで管理されているため、引数なしで呼び出し
    switchToMapBase(mapId, selectRoot);
  };

  // カーソル位置の更新（リアルタイム機能用 - 現在は無効化）
  const updateCursorPosition = (nodeId) => {
    // リアルタイム機能は一時的に無効化
    console.log('リアルタイム機能は無効化されています');
  };

  return {
    // データ
    data,
    selectedNodeId,
    editingNodeId,
    editText,
    
    // 状態更新
    setSelectedNodeId,
    setEditText,
    
    // ノード操作
    updateNode,
    addChildNode,
    addSiblingNode,
    deleteNode,
    dragNode,
    changeParent,
    findNode,
    findParentNode,
    flattenNodes,
    applyAutoLayout,
    navigateToDirection,
    
    // 編集
    startEdit,
    finishEdit,
    
    // 折りたたみ
    toggleCollapse,
    
    // ファイル添付
    attachFileToNode,
    removeFileFromNode,
    renameFileInNode,
    downloadFile,
    
    // 履歴
    undo,
    redo,
    canUndo,
    canRedo,
    
    // その他
    updateTitle,
    changeTheme,
    updateSettings,
    saveMindMap,
    
    // マルチマップ管理
    allMindMaps,
    currentMapId,
    createMindMap,
    renameMindMap,
    deleteMindMapById,
    switchToMap,
    refreshAllMindMaps,
    
    // カテゴリー管理
    changeMapCategory,
    getAvailableCategories,
    
    // ノード用マップリンク管理（簡略化）
    addNodeMapLink: () => console.warn('Node map links feature temporarily disabled'),
    removeNodeMapLink: () => console.warn('Node map links feature temporarily disabled'),
    updateNodeMapLinkTargetTitle: () => console.warn('Node map links feature temporarily disabled'),
    
    // リアルタイム同期（無効化）
    realtimeClient: null,
    isRealtimeConnected: false,
    realtimeStatus: 'disconnected',
    connectedUsers: [],
    userCursors: new Map(),
    initializeRealtime: () => console.warn('Realtime features temporarily disabled'),
    updateCursorPosition
  };
};