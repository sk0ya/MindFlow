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
  const addToHistory = (newData) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(deepClone(newData));
      return newHistory.slice(-50);
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  };

  // データ更新の共通処理
  const updateData = (newData) => {
    setData(newData);
    addToHistory(newData);
    
    // 自動保存
    if (data.settings?.autoSave) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveMindMap(newData);
      }, 1000);
    }
  };

  // 全ノードを平坦化
  const flattenNodes = (node, result = []) => {
    result.push(node);
    node.children?.forEach(child => flattenNodes(child, result));
    return result;
  };

  // ノードを検索
  const findNode = (nodeId, rootNode = data.rootNode) => {
    if (rootNode.id === nodeId) return rootNode;
    
    for (const child of rootNode.children || []) {
      const found = findNode(nodeId, child);
      if (found) return found;
    }
    return null;
  };

  // ノードの親を検索
  const findParentNode = (nodeId, rootNode = data.rootNode, parent = null) => {
    if (rootNode.id === nodeId) return parent;
    
    for (const child of rootNode.children || []) {
      const found = findParentNode(nodeId, child, rootNode);
      if (found) return found;
    }
    return null;
  };

  // ノードを更新
  const updateNode = (nodeId, updates) => {
    const updateNodeRecursive = (node) => {
      if (node.id === nodeId) return { ...node, ...updates };
      return { ...node, children: node.children?.map(updateNodeRecursive) || [] };
    };
    
    updateData({ ...data, rootNode: updateNodeRecursive(data.rootNode) });
  };

  // 設定を更新
  const updateSettings = (newSettings) => {
    updateData({
      ...data,
      settings: { ...data.settings, ...newSettings }
    });
  };

  const applyAutoLayout = (rootNode) => {
    const svg = document.querySelector('.mindmap-canvas-container svg');
    const centerX = rootNode.x || (svg?.clientWidth / 2) || 400;
    const centerY = rootNode.y || (svg?.clientHeight / 2) || 300;
    
    return mindMapLayoutPreserveRoot(rootNode, {
      centerX, centerY, baseRadius: 180, levelSpacing: 200,
      minVerticalSpacing: 60, maxVerticalSpacing: 120
    });
  };

  // 子ノードを追加
  const addChildNode = (parentId, nodeText = '新しいアイデア') => {
    const parentNode = findNode(parentId);
    if (!parentNode) return null;
    
    const newChild = createNewNode(nodeText, parentNode);
    const childrenCount = parentNode.children?.length || 0;
    const position = calculateNodePosition(parentNode, childrenCount, childrenCount + 1);
    newChild.x = position.x;
    newChild.y = position.y;
    
    const addChildRecursive = (node) => {
      if (node.id === parentId) {
        return { ...node, children: [...(node.children || []), newChild] };
      }
      return { ...node, children: node.children?.map(addChildRecursive) || [] };
    };
    
    let newRootNode = addChildRecursive(data.rootNode);
    if (data.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    updateData({ ...data, rootNode: newRootNode });
    return newChild.id;
  };

  // 兄弟ノードを追加
  const addSiblingNode = (nodeId, nodeText = '新しいアイデア') => {
    if (nodeId === 'root') return addChildNode('root', nodeText);
    
    const parentNode = findParentNode(nodeId);
    if (!parentNode) return null;
    
    const newSibling = createNewNode(nodeText, parentNode);
    
    const addSiblingRecursive = (node) => {
      if (node.id === parentNode.id) {
        const currentIndex = node.children?.findIndex(child => child.id === nodeId) ?? -1;
        if (currentIndex === -1) return node;
        
        const newChildren = [...(node.children || [])];
        newChildren.splice(currentIndex + 1, 0, newSibling);
        return { ...node, children: newChildren };
      }
      return { ...node, children: node.children?.map(addSiblingRecursive) || [] };
    };
    
    let newRootNode = addSiblingRecursive(data.rootNode);
    if (data.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    updateData({ ...data, rootNode: newRootNode });
    return newSibling.id;
  };

  // ノードを削除
  const deleteNode = (nodeId) => {
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
    
    updateData({ ...data, rootNode: newRootNode });
    
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    if (editingNodeId === nodeId) setEditingNodeId(null);
    
    return true;
  };

  // ノードをドラッグで移動
  const dragNode = (nodeId, x, y) => {
    updateNode(nodeId, { x, y });
  };

  // 編集開始
  const startEdit = (nodeId) => {
    const node = findNode(nodeId);
    if (node) {
      setEditingNodeId(nodeId);
      setEditText(node.text);
      setSelectedNodeId(nodeId);
    }
  };

  // 編集終了
  const finishEdit = (nodeId, newText) => {
    if (newText.trim() === '') {
      setEditingNodeId(null);
      setEditText('');
      return;
    }
    
    updateNode(nodeId, { text: newText.trim() });
    setEditingNodeId(null);
    setEditText('');
  };

  // Undo
  const undo = () => {
    if (historyIndex > 0) {
      const previousData = history[historyIndex - 1];
      setData(previousData);
      setHistoryIndex(prev => prev - 1);
      saveMindMap(previousData);
    }
  };

  // Redo
  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextData = history[historyIndex + 1];
      setData(nextData);
      setHistoryIndex(prev => prev + 1);
      saveMindMap(nextData);
    }
  };

  // 折りたたみ状態をトグル
  const toggleCollapse = (nodeId) => {
    const toggleNodeRecursive = (node) => {
      if (node.id === nodeId) return { ...node, collapsed: !node.collapsed };
      return { ...node, children: node.children?.map(toggleNodeRecursive) || [] };
    };
    
    updateData({ ...data, rootNode: toggleNodeRecursive(data.rootNode) });
  };

  // マップタイトルを更新
  const updateTitle = (newTitle) => {
    updateData({ ...data, title: newTitle });
  };

  // テーマを変更
  const changeTheme = (themeName) => {
    updateData({ ...data, theme: themeName });
  };

  // 初期化時に履歴を設定
  useEffect(() => {
    if (history.length === 0) {
      setHistory([deepClone(data)]);
      setHistoryIndex(0);
    }
    
    // クリーンアップ
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
