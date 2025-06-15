import { useState, useCallback, useEffect, useRef } from 'react';
import { getCurrentMindMap, saveMindMap, getAllMindMaps, createNewMindMap, deleteMindMap, saveMindMapHybrid, getAllMindMapsHybrid, deleteMindMapHybrid } from '../utils/storage.js';
import { createNewNode, calculateNodePosition, deepClone, COLORS, readFileAsDataURL, createFileAttachment, isImageFile, createInitialData, createNodeMapLink } from '../utils/dataTypes.js';
import { mindMapLayoutPreserveRoot } from '../utils/autoLayout.js';

// 既存のノードに色を自動割り当てする
const assignColorsToExistingNodes = (mindMapData) => {
  // rootNodeが存在しない場合の対応
  if (!mindMapData || !mindMapData.rootNode) {
    console.warn('Invalid mindmap data or missing rootNode:', mindMapData);
    return mindMapData || createInitialData();
  }
  
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
  
  // マルチマップ管理用の状態
  const [allMindMaps, setAllMindMaps] = useState(() => {
    const maps = getAllMindMaps();
    // 無効なデータを除外してログ出力
    const validMaps = maps.filter(map => {
      if (!map || !map.id) {
        console.warn('Invalid mindmap found and filtered out:', map);
        return false;
      }
      return true;
    });
    return validMaps;
  });
  const [currentMapId, setCurrentMapId] = useState(() => {
    const currentMap = getCurrentMindMap();
    return currentMap.id;
  });

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
      autoSaveTimeoutRef.current = setTimeout(async () => {
        try {
          await saveMindMapHybrid(newData);
        } catch (error) {
          console.error('Auto-save failed:', error);
          // フォールバックとしてローカル保存
          saveMindMap(newData);
        }
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
      minVerticalSpacing: 80, maxVerticalSpacing: 130
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
  const addChildNode = (parentId, nodeText = '', startEditing = false) => {
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
    
    // 編集状態を同時に設定
    if (startEditing) {
      setSelectedNodeId(newChild.id);
      setEditingNodeId(newChild.id);
      setEditText('');
    }
    
    return newChild.id;
  };

  // 兄弟ノードを追加
  const addSiblingNode = (nodeId, nodeText = '', startEditing = false) => {
    if (nodeId === 'root') return addChildNode('root', nodeText, startEditing);
    
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
    
    // 編集状態を同時に設定
    if (startEditing) {
      setSelectedNodeId(newSibling.id);
      setEditingNodeId(newSibling.id);
      setEditText('');
    }
    
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

  // ノードの親を変更
  const changeParent = (nodeId, newParentId) => {
    if (nodeId === 'root' || nodeId === newParentId) return false;
    
    // 新しい親が現在のノードの子孫でないかチェック（循環参照防止）
    const isDescendant = (parentId, childId) => {
      const parent = findNode(parentId);
      if (!parent || !parent.children) return false;
      
      return parent.children.some(child => 
        child.id === childId || isDescendant(child.id, childId)
      );
    };
    
    if (isDescendant(nodeId, newParentId)) {
      console.warn('循環参照が発生するため、親要素を変更できません');
      return false;
    }
    
    const nodeToMove = findNode(nodeId);
    const newParent = findNode(newParentId);
    
    if (!nodeToMove || !newParent) return false;
    
    // 現在の親から削除
    const removeFromParent = (node) => {
      return {
        ...node,
        children: (node.children || [])
          .filter(child => child.id !== nodeId)
          .map(removeFromParent)
      };
    };
    
    // 新しい親に追加（色を新しい親に合わせて更新）
    const addToNewParent = (node) => {
      if (node.id === newParentId) {
        const childrenCount = node.children?.length || 0;
        const updatedNode = {
          ...nodeToMove,
          color: getNodeColor(newParent, childrenCount)
        };
        
        return {
          ...node,
          children: [...(node.children || []), updatedNode]
        };
      }
      return {
        ...node,
        children: node.children?.map(addToNewParent) || []
      };
    };
    
    let newRootNode = removeFromParent(data.rootNode);
    newRootNode = addToNewParent(newRootNode);
    
    // 自動レイアウトを適用
    if (data.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    updateData({ ...data, rootNode: newRootNode });
    return true;
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
      // 空の場合はノードを削除（ルートノード以外）
      if (nodeId !== 'root') {
        deleteNode(nodeId);
        // 削除時は選択もクリア
        setSelectedNodeId(null);
      }
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
      // 全てのファイルでDataURLを生成（ダウンロードに必要）
      const dataURL = await readFileAsDataURL(file);
      
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

  // ファイル名を変更
  const renameFileInNode = (nodeId, fileId, newName) => {
    const node = findNode(nodeId);
    if (node && node.attachments) {
      const updatedAttachments = node.attachments.map(file => 
        file.id === fileId ? { ...file, name: newName } : file
      );
      updateNode(nodeId, { attachments: updatedAttachments });
    }
  };

  // ファイルをダウンロード
  const downloadFile = async (file) => {
    try {
      if (!file.dataURL) {
        console.warn('ファイルのダウンロードデータが見つかりません', file);
        return;
      }

      // File System Access APIが利用可能かチェック
      if (window.showSaveFilePicker) {
        try {
          // ファイル拡張子を取得
          const extension = file.name.split('.').pop();
          const mimeType = file.type || 'application/octet-stream';

          // ファイル保存ダイアログを表示
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: file.name,
            types: [{
              description: `${extension.toUpperCase()} files`,
              accept: { [mimeType]: [`.${extension}`] }
            }]
          });

          // Base64データをBlobに変換
          const response = await fetch(file.dataURL);
          const blob = await response.blob();

          // ファイルに書き込み
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          console.log('ファイルが正常に保存されました:', file.name);
          return;
        } catch (saveError) {
          // ユーザーがキャンセルした場合やエラーが発生した場合
          if (saveError.name === 'AbortError') {
            console.log('ファイル保存がキャンセルされました');
            return;
          }
          console.warn('File System Access API でのダウンロードに失敗:', saveError);
          // フォールバックに進む
        }
      }

      // フォールバック: 従来の方法（保存場所選択なし）
      const link = document.createElement('a');
      link.href = file.dataURL;
      link.download = file.name;
      
      // より確実にダウンロードを実行
      link.style.display = 'none';
      document.body.appendChild(link);
      
      // ダウンロード実行
      link.click();
      
      // クリーンアップ
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      }, 100);

    } catch (error) {
      console.error('ファイルダウンロードエラー:', error);
      throw error;
    }
  };

  // ノード用マップリンク管理機能
  const addNodeMapLink = (nodeId, targetMapId, targetMapTitle, description = '') => {
    const newLink = createNodeMapLink(targetMapId, targetMapTitle, description);
    
    const addLinkToNode = (node) => {
      if (node.id === nodeId) {
        return {
          ...node,
          mapLinks: [...(node.mapLinks || []), newLink]
        };
      }
      return {
        ...node,
        children: node.children?.map(addLinkToNode) || []
      };
    };
    
    updateData({
      ...data,
      rootNode: addLinkToNode(data.rootNode),
      updatedAt: new Date().toISOString()
    });
  };

  const removeNodeMapLink = (nodeId, linkId) => {
    const removeLinkFromNode = (node) => {
      if (node.id === nodeId) {
        return {
          ...node,
          mapLinks: (node.mapLinks || []).filter(link => link.id !== linkId)
        };
      }
      return {
        ...node,
        children: node.children?.map(removeLinkFromNode) || []
      };
    };
    
    updateData({
      ...data,
      rootNode: removeLinkFromNode(data.rootNode),
      updatedAt: new Date().toISOString()
    });
  };

  const updateNodeMapLinkTargetTitle = (targetMapId, newTitle) => {
    const updateLinksInNode = (node) => {
      const updatedNode = {
        ...node,
        mapLinks: (node.mapLinks || []).map(link =>
          link.targetMapId === targetMapId
            ? { ...link, targetMapTitle: newTitle }
            : link
        )
      };
      
      if (node.children) {
        updatedNode.children = node.children.map(updateLinksInNode);
      }
      
      return updatedNode;
    };
    
    updateData({
      ...data,
      rootNode: updateLinksInNode(data.rootNode),
      updatedAt: new Date().toISOString()
    });
  };

  // ヘルパー関数
  const hasMapLinkInNodes = (node, targetMapId) => {
    if (node.mapLinks && node.mapLinks.some(link => link.targetMapId === targetMapId)) {
      return true;
    }
    return node.children ? node.children.some(child => hasMapLinkInNodes(child, targetMapId)) : false;
  };

  const updateMapLinksInNodes = (node, targetMapId, newTitle) => {
    const updatedNode = {
      ...node,
      mapLinks: (node.mapLinks || []).map(link =>
        link.targetMapId === targetMapId
          ? { ...link, targetMapTitle: newTitle }
          : link
      )
    };
    
    if (node.children) {
      updatedNode.children = node.children.map(child => updateMapLinksInNodes(child, targetMapId, newTitle));
    }
    
    return updatedNode;
  };

  // マルチマップ管理機能
  const refreshAllMindMaps = () => {
    setAllMindMaps(getAllMindMaps());
  };

  const createMindMap = (title = '新しいマインドマップ', category = '未分類') => {
    const newMap = createNewMindMap(title);
    // メイントピックをマップ名に基づいて設定
    newMap.rootNode.text = title;
    newMap.category = category;
    
    // 更新されたマップを保存
    saveMindMap(newMap);
    refreshAllMindMaps();
    // 新規作成時はルートノードを選択
    switchToMap(newMap.id, true);
    return newMap.id;
  };

  const renameMindMap = (mapId, newTitle) => {
    const allMaps = getAllMindMaps();
    const mapIndex = allMaps.findIndex(map => map.id === mapId);
    
    if (mapIndex !== -1) {
      const updatedMap = { ...allMaps[mapIndex], title: newTitle, updatedAt: new Date().toISOString() };
      allMaps[mapIndex] = updatedMap;
      
      // ストレージに保存
      saveMindMap(updatedMap);
      refreshAllMindMaps();
      
      // 他のマップのノードリンクタイトルも更新
      allMaps.forEach(map => {
        if (map.id !== mapId) {
          const hasNodeLinkToRenamedMap = hasMapLinkInNodes(map.rootNode, mapId);
          if (hasNodeLinkToRenamedMap) {
            const updatedRootNode = updateMapLinksInNodes(map.rootNode, mapId, newTitle);
            const updatedMapWithLinks = { ...map, rootNode: updatedRootNode, updatedAt: new Date().toISOString() };
            saveMindMap(updatedMapWithLinks);
          }
        }
      });
      
      // 現在編集中のマップの場合はタイトルとリンクを更新
      if (mapId === currentMapId) {
        updateTitle(newTitle);
      } else {
        // 現在のマップがリネームされたマップへのリンクを持っている場合、リンクタイトルを更新
        updateNodeMapLinkTargetTitle(mapId, newTitle);
      }
    }
  };

  const deleteMindMapById = (mapId) => {
    if (allMindMaps.length <= 1) {
      console.warn('最後のマインドマップは削除できません');
      return false;
    }
    
    const newCurrentMap = deleteMindMap(mapId);
    refreshAllMindMaps();
    
    // 削除されたマップが現在のマップだった場合、新しいマップに切り替え
    if (mapId === currentMapId) {
      switchToMap(newCurrentMap.id);
    }
    
    return true;
  };

  const changeMapCategory = (mapId, newCategory) => {
    const allMaps = getAllMindMaps();
    const mapIndex = allMaps.findIndex(map => map.id === mapId);
    
    if (mapIndex !== -1) {
      const updatedMap = { ...allMaps[mapIndex], category: newCategory, updatedAt: new Date().toISOString() };
      allMaps[mapIndex] = updatedMap;
      
      // ストレージに保存
      saveMindMap(updatedMap);
      refreshAllMindMaps();
      
      // 現在編集中のマップの場合はデータを更新
      if (mapId === currentMapId) {
        setData(prev => ({ ...prev, category: newCategory }));
      }
    }
  };

  const getAvailableCategories = () => {
    const categories = new Set(['未分類']);
    allMindMaps.forEach(map => {
      if (map.category && map.category.trim()) {
        categories.add(map.category);
      }
    });
    return Array.from(categories).sort();
  };

  const switchToMap = (mapId, selectRoot = false) => {
    const allMaps = getAllMindMaps();
    const targetMap = allMaps.find(map => map && map.id === mapId);
    
    if (targetMap) {
      // 現在のマップを保存
      saveMindMap(data);
      
      // 新しいマップに切り替え
      const coloredMap = assignColorsToExistingNodes(targetMap);
      setData(coloredMap);
      setCurrentMapId(mapId);
      
      // 編集状態をリセット
      if (selectRoot) {
        // 新規作成時はルートノードを選択
        setSelectedNodeId('root');
      } else {
        setSelectedNodeId(null);
      }
      setEditingNodeId(null);
      setEditText('');
      
      // 履歴をリセット
      setHistory([deepClone(coloredMap)]);
      setHistoryIndex(0);
      
      // ストレージの現在のマップを更新
      localStorage.setItem('currentMindMap', JSON.stringify(coloredMap));
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
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    
    // その他
    updateTitle,
    changeTheme,
    updateSettings,
    saveMindMap: () => saveMindMap(data),
    
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
    
    // ノード用マップリンク管理
    addNodeMapLink,
    removeNodeMapLink,
    updateNodeMapLinkTargetTitle
  };
};
