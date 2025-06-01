import { useState, useCallback, useEffect, useRef } from 'react';
import { getCurrentMindMap, saveMindMap } from '../utils/storage.js';
import { createNewNode, calculateNodePosition, deepClone } from '../utils/dataTypes.js';
import { mindMapLayoutPreserveRoot } from '../utils/autoLayout.js';

export const useMindMap = () => {
  const [data, setData] = useState(() => getCurrentMindMap());
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editText, setEditText] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const autoSaveTimeoutRef = useRef(null);

  // 履歴に追加
  const addToHistory = useCallback((newData) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(deepClone(newData));
      return newHistory.slice(-50); // 最大50件保持
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  // 自動保存
  const autoSave = useCallback((newData) => {
    if (!data.settings?.autoSave) return;
    
    // 前回のタイムアウトをクリア
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // 1秒後に保存
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveMindMap(newData);
    }, 1000);
  }, [data.settings?.autoSave]);

  // データ更新の共通処理
  const updateData = useCallback((newData) => {
    setData(newData);
    addToHistory(newData);
    autoSave(newData);
  }, [addToHistory, autoSave]);

  // 全ノードを平坦化
  const flattenNodes = useCallback((node, result = []) => {
    result.push(node);
    node.children?.forEach(child => flattenNodes(child, result));
    return result;
  }, []);

  // ノードを検索
  const findNode = useCallback((nodeId, rootNode = data.rootNode) => {
    if (rootNode.id === nodeId) return rootNode;
    
    for (const child of rootNode.children || []) {
      const found = findNode(nodeId, child);
      if (found) return found;
    }
    
    return null;
  }, [data.rootNode]);

  // ノードの親を検索
  const findParentNode = useCallback((nodeId, rootNode = data.rootNode, parent = null) => {
    if (rootNode.id === nodeId) return parent;
    
    for (const child of rootNode.children || []) {
      const found = findParentNode(nodeId, child, rootNode);
      if (found !== null) return found;
    }
    
    return null;
  }, [data.rootNode]);

  // ノードを更新
  const updateNode = useCallback((nodeId, updates) => {
    const updateNodeRecursive = (node) => {
      if (node.id === nodeId) {
        return { ...node, ...updates };
      }
      return {
        ...node,
        children: node.children?.map(updateNodeRecursive) || []
      };
    };
    
    const newData = {
      ...data,
      rootNode: updateNodeRecursive(data.rootNode)
    };
    
    updateData(newData);
  }, [data, updateData]);

  // 設定を更新
  const updateSettings = useCallback((newSettings) => {
    const newData = {
      ...data,
      settings: {
        ...data.settings,
        ...newSettings
      }
    };
    updateData(newData);
  }, [data, updateData]);

  const applyAutoLayout = useCallback((rootNode) => {
    const svgElement = document.querySelector('.mindmap-canvas-container svg');
    const centerX = rootNode.x || (svgElement ? svgElement.clientWidth / 2 : 400);
    const centerY = rootNode.y || (svgElement ? svgElement.clientHeight / 2 : 300);
    
    return mindMapLayoutPreserveRoot(rootNode, {
      centerX,
      centerY,
      baseRadius: 180,
      levelSpacing: 200,
      minVerticalSpacing: 60,
      maxVerticalSpacing: 120
    });
  }, []);

  // 子ノードを追加
  const addChildNode = useCallback((parentId, nodeText = '新しいアイデア') => {
    const parentNode = findNode(parentId);
    if (!parentNode) return null;
    
    const newChild = createNewNode(nodeText, parentNode);
    const childrenCount = parentNode.children?.length || 0;

    const position = calculateNodePosition(parentNode, childrenCount, childrenCount + 1);
    newChild.x = position.x;
    newChild.y = position.y;
    
    const addChildRecursive = (node) => {
      if (node.id === parentId) {
        return {
          ...node,
          children: [...(node.children || []), newChild]
        };
      }
      return {
        ...node,
        children: node.children?.map(addChildRecursive) || []
      };
    };
    
    let newRootNode = addChildRecursive(data.rootNode);
    
    if (data.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData = {
      ...data,
      rootNode: newRootNode
    };
    
    updateData(newData);
    return newChild.id;
  }, [data, findNode, updateData, applyAutoLayout]);

  // 兄弟ノードを追加
  const addSiblingNode = useCallback((nodeId, nodeText = '新しいアイデア') => {
    if (nodeId === 'root') {
      return addChildNode('root', nodeText);
    }
    
    const parentNode = findParentNode(nodeId);
    if (!parentNode) return null;
    
    const newSibling = createNewNode(nodeText, parentNode);
    
    const addSiblingRecursive = (node) => {
      if (node.id === parentNode.id) {
        const currentIndex = node.children?.findIndex(child => child.id === nodeId) ?? -1;
        if (currentIndex === -1) return node;
        
        const newChildren = [...(node.children || [])];
        newChildren.splice(currentIndex + 1, 0, newSibling);
        
        return {
          ...node,
          children: newChildren
        };
      }
      return {
        ...node,
        children: node.children?.map(addSiblingRecursive) || []
      };
    };
    
    let newRootNode = addSiblingRecursive(data.rootNode);
    
    if (data.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData = {
      ...data,
      rootNode: newRootNode
    };
    
    updateData(newData);
    return newSibling.id;
  }, [data, findNode, findParentNode, addChildNode, updateData, applyAutoLayout]);

  // ノードを削除
  const deleteNode = useCallback((nodeId) => {
    if (nodeId === 'root') return false;
    
    const deleteNodeRecursive = (node) => {
      return {
        ...node,
        children: (node.children || [])
          .filter(child => child.id !== nodeId)
          .map(deleteNodeRecursive)
      };
    };
    
    let newRootNode = deleteNodeRecursive(data.rootNode);
    
    if (data.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData = {
      ...data,
      rootNode: newRootNode
    };
    
    updateData(newData);
    
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
    if (editingNodeId === nodeId) {
      setEditingNodeId(null);
    }
    
    return true;
  }, [data, selectedNodeId, editingNodeId, updateData, applyAutoLayout]);

  // ノードをドラッグで移動
  const dragNode = useCallback((nodeId, x, y) => {
    updateNode(nodeId, { x, y });
  }, [updateNode]);

  // 編集開始
  const startEdit = useCallback((nodeId) => {
    const node = findNode(nodeId);
    if (node) {
      setEditingNodeId(nodeId);
      setEditText(node.text);
      setSelectedNodeId(nodeId);
    }
  }, [findNode]);

  // 編集終了
  const finishEdit = useCallback((nodeId, newText) => {
    if (newText.trim() === '') {
      setEditingNodeId(null);
      setEditText('');
      return;
    }
    
    updateNode(nodeId, { text: newText.trim() });
    setEditingNodeId(null);
    setEditText('');
  }, [updateNode]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const previousData = history[historyIndex - 1];
      setData(previousData);
      setHistoryIndex(prev => prev - 1);
      saveMindMap(previousData);
    }
  }, [history, historyIndex]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextData = history[historyIndex + 1];
      setData(nextData);
      setHistoryIndex(prev => prev + 1);
      saveMindMap(nextData);
    }
  }, [history, historyIndex]);

  // 折りたたみ状態をトグル
  const toggleCollapse = useCallback((nodeId) => {
    const toggleNodeRecursive = (node) => {
      if (node.id === nodeId) {
        return { ...node, collapsed: !node.collapsed };
      }
      return {
        ...node,
        children: node.children?.map(toggleNodeRecursive) || []
      };
    };
    
    const newData = {
      ...data,
      rootNode: toggleNodeRecursive(data.rootNode)
    };
    
    updateData(newData);
  }, [data, updateData]);

  // マップタイトルを更新
  const updateTitle = useCallback((newTitle) => {
    const newData = { ...data, title: newTitle };
    updateData(newData);
  }, [data, updateData]);

  // テーマを変更
  const changeTheme = useCallback((themeName) => {
    const newData = { ...data, theme: themeName };
    updateData(newData);
  }, [data, updateData]);

  // 初期化時に履歴を設定
  useEffect(() => {
    if (history.length === 0) {
      setHistory([deepClone(data)]);
      setHistoryIndex(0);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

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
    findNode,
    findParentNode,
    flattenNodes,
    applyAutoLayout,
    
    // 編集
    startEdit,
    finishEdit,
    
    // 折りたたみ
    toggleCollapse,
    
    // 履歴
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    
    // その他
    updateTitle,
    changeTheme,
    updateSettings,
    saveMindMap: () => saveMindMap(data)
  };
};
