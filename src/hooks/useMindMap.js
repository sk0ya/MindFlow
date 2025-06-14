import { useState, useCallback, useEffect, useRef } from 'react';
import { getCurrentMindMap, saveMindMap } from '../utils/storage.js';
import { createNewNode, calculateNodePosition, deepClone, COLORS, readFileAsDataURL, createFileAttachment, isImageFile } from '../utils/dataTypes.js';
import { mindMapLayoutPreserveRoot } from '../utils/autoLayout.js';

// 既存のノードに色を自動割り当てする
const assignColorsToExistingNodes = (mindMapData) => {
  const assignColors = (node, parentColor = null, isRootChild = false, childIndex = 0) => {
    const updatedNode = { ...node };
    
    if (node.id === 'root') {
      // ルートノードには色を設定しない
      updatedNode.color = undefined;
    } else if (isRootChild) {
      // ルートノードの子要素の場合、色が未設定なら順番に割り当て
      if (!node.color) {
        updatedNode.color = COLORS[childIndex % COLORS.length];
      }
    } else if (!node.color && parentColor) {
      // 他の場合は親の色を継承
      updatedNode.color = parentColor;
    }
    
    // 子ノードも再帰的に処理
    if (node.children) {
      updatedNode.children = node.children.map((child, index) =>
        assignColors(child, updatedNode.color, node.id === 'root', index)
      );
    }
    
    return updatedNode;
  };
  
  return {
    ...mindMapData,
    rootNode: assignColors(mindMapData.rootNode)
  };
};

export const useMindMap = () => {
  const [data, setData] = useState(() => {
    const mindMap = getCurrentMindMap();
    // 既存のマインドマップに色が設定されていない場合は自動設定
    return assignColorsToExistingNodes(mindMap);
  });
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

  // 方向キーによるノード選択
  const navigateToDirection = (direction) => {
    if (!selectedNodeId) return;
    
    const allNodes = flattenNodes(data.rootNode);
    const currentNode = findNode(selectedNodeId);
    if (!currentNode) return;
    
    let targetNode = null;
    let minDistance = Infinity;
    
    allNodes.forEach(node => {
      if (node.id === selectedNodeId) return;
      
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
    
    // 方向に適切なノードが見つからない場合は、関連ノードを選択
    if (!targetNode) {
      targetNode = getAlternativeNavigationTarget(direction);
    }
    
    if (targetNode) {
      setSelectedNodeId(targetNode.id);
    }
  };

  // 方向ナビゲーションの代替ターゲット
  const getAlternativeNavigationTarget = (direction) => {
    const currentNode = findNode(selectedNodeId);
    if (!currentNode) return null;
    
    switch (direction) {
      case 'up':
        // 上方向: 親ノードを選択
        const parent = findParentNode(selectedNodeId);
        return parent;
      case 'down':
        // 下方向: 最初の子ノードを選択
        return currentNode.children && currentNode.children.length > 0 
          ? currentNode.children[0] : null;
      case 'left':
        // 左方向: 前の兄弟ノードを選択
        const leftParent = findParentNode(selectedNodeId);
        if (leftParent && leftParent.children) {
          const currentIndex = leftParent.children.findIndex(child => child.id === selectedNodeId);
          return currentIndex > 0 ? leftParent.children[currentIndex - 1] : null;
        }
        return null;
      case 'right':
        // 右方向: 次の兄弟ノードを選択
        const rightParent = findParentNode(selectedNodeId);
        if (rightParent && rightParent.children) {
          const currentIndex = rightParent.children.findIndex(child => child.id === selectedNodeId);
          return currentIndex < rightParent.children.length - 1 
            ? rightParent.children[currentIndex + 1] : null;
        }
        return null;
      default:
        return null;
    }
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

  // ノードの色を取得する（親から継承または新規割り当て）
  const getNodeColor = (parentNode, childIndex) => {
    if (parentNode.id === 'root') {
      // ルートノードの子要素の場合、順番に色を割り当て
      return COLORS[childIndex % COLORS.length];
    } else {
      // 他の場合は親の色を継承
      return parentNode.color || '#666';
    }
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
    
    // 色を設定
    newChild.color = getNodeColor(parentNode, childrenCount);
    
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
    
    // 色の設定
    if (parentNode.id === 'root') {
      // メイントピックの子要素の場合は、新しい色を割り当て
      const siblingIndex = parentNode.children?.length || 0;
      newSibling.color = getNodeColor(parentNode, siblingIndex);
    } else {
      // 他の場合は既存の兄弟ノードと同じ色を継承
      const existingSibling = findNode(nodeId);
      if (existingSibling) {
        newSibling.color = existingSibling.color;
      } else {
        // フォールバック: 親から色を取得
        newSibling.color = parentNode.color || '#666';
      }
    }
    
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
    
    // 削除前に兄弟ノードを特定
    let siblingToSelect = null;
    const parentNode = findParentNode(nodeId);
    
    if (parentNode && parentNode.children) {
      const currentIndex = parentNode.children.findIndex(child => child.id === nodeId);
      if (currentIndex !== -1) {
        // 次の兄弟を優先、なければ前の兄弟、なければ親を選択
        if (currentIndex < parentNode.children.length - 1) {
          // 次の兄弟が存在する場合
          siblingToSelect = parentNode.children[currentIndex + 1].id;
        } else if (currentIndex > 0) {
          // 前の兄弟が存在する場合
          siblingToSelect = parentNode.children[currentIndex - 1].id;
        } else {
          // 兄弟がいない場合は親を選択（ただし親がrootの場合はnull）
          siblingToSelect = parentNode.id === 'root' ? null : parentNode.id;
        }
      }
    }
    
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
    
    // 削除されたノードが選択されていた場合、兄弟ノードを選択
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(siblingToSelect);
    }
    if (editingNodeId === nodeId) setEditingNodeId(null);
    
    return true;
  };

  // ノードをドラッグで移動
  const dragNode = (nodeId, x, y) => {
    updateNode(nodeId, { x, y });
  };

  // 編集開始
  const startEdit = (nodeId, clearText = false) => {
    const node = findNode(nodeId);
    if (node) {
      setEditingNodeId(nodeId);
      setEditText(clearText ? '' : node.text);
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

  // ファイル添付機能
  const attachFileToNode = async (nodeId, file) => {
    try {
      let dataURL = null;
      
      // 画像ファイルの場合はDataURLを生成
      if (isImageFile(file)) {
        dataURL = await readFileAsDataURL(file);
      }
      
      const fileAttachment = createFileAttachment(file, dataURL);
      const node = findNode(nodeId);
      
      if (node) {
        const updatedAttachments = [...(node.attachments || []), fileAttachment];
        updateNode(nodeId, { attachments: updatedAttachments });
        return fileAttachment.id;
      }
      
      return null;
    } catch (error) {
      console.error('ファイル添付エラー:', error);
      throw error;
    }
  };
  
  const removeFileFromNode = (nodeId, fileId) => {
    const node = findNode(nodeId);
    if (node && node.attachments) {
      const updatedAttachments = node.attachments.filter(file => file.id !== fileId);
      updateNode(nodeId, { attachments: updatedAttachments });
    }
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
