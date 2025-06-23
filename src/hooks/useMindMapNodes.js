import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createNewNode, calculateNodePosition, COLORS, deepClone } from '../utils/dataTypes.js';
import { mindMapLayoutPreserveRoot } from '../utils/autoLayout.js';
import { getCurrentAdapter } from '../utils/storageAdapter.js';

// ノード操作専用のカスタムフック
export const useMindMapNodes = (data, updateData) => {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editText, setEditText] = useState('');
  
  // 最新のdataを参照するためのref
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // 全ノードを平坦化（メモ化）
  const flattenNodes = useCallback((rootNode = data?.rootNode) => {
    if (!rootNode) return [];
    
    const flatten = (node, result = []) => {
      result.push(node);
      node.children?.forEach(child => flatten(child, result));
      return result;
    };
    
    return flatten(rootNode);
  }, [data?.rootNode]);

  // ノードを検索（メモ化）
  const findNode = useCallback((nodeId, rootNode = data?.rootNode) => {
    if (!rootNode || !nodeId) return null;
    if (rootNode.id === nodeId) return rootNode;
    
    for (const child of rootNode.children || []) {
      const found = findNode(nodeId, child);
      if (found) return found;
    }
    return null;
  }, [data?.rootNode]);

  // ノードの親を検索（メモ化）
  const findParentNode = useCallback((nodeId, rootNode = data.rootNode, parent = null) => {
    if (!rootNode || !nodeId) return null;
    if (rootNode.id === nodeId) return parent;
    
    for (const child of rootNode.children || []) {
      const found = findParentNode(nodeId, child, rootNode);
      if (found) return found;
    }
    return null;
  }, [data?.rootNode]);

  // オートレイアウトを適用
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
      return COLORS[childIndex % COLORS.length];
    } else {
      return parentNode.color || '#666';
    }
  };

  // ノード更新（完全分離版）
  const updateNode = async (nodeId, updates, syncToCloud = true, options = {}) => {
    // 🔧 重要: データ参照共有を防ぐため完全なディープクローンを実行
    const currentData = dataRef.current;
    console.log('📝 updateNode: データをディープクローン中...', { nodeId, updates });
    const clonedData = deepClone(currentData);
    
    // 1. クローンされたデータに対してローカル状態を即座に更新
    const updateNodeRecursive = (node) => {
      if (node.id === nodeId) {
        // 対象ノードを発見したらプロパティを更新
        Object.assign(node, updates);
        return node;
      }
      if (node.children) {
        node.children.forEach(updateNodeRecursive);
      }
      return node;
    };
    
    updateNodeRecursive(clonedData.rootNode);
    const newData = clonedData;
    
    // 更新オプションの準備
    const updateOptions = {
      skipHistory: false,
      source: options.source || 'updateNode',
      allowDuringEdit: options.allowDuringEdit || false,
      ...(updates.attachments ? { saveImmediately: true } : { immediate: true })
    };
    
    await updateData(newData, updateOptions);
    
    // 2. ストレージアダプターを通じて反映
    if (syncToCloud) {
      console.log('🔄 ノード個別同期開始:', nodeId);
      try {
        const { getCurrentAdapter } = await import('../utils/storageAdapter.js');
        const adapter = getCurrentAdapter();
        const result = await adapter.updateNode(data.id, nodeId, updates);
        
        if (result.success) {
          console.log('✅ ノード更新完了:', nodeId);
        } else {
          console.warn('⚠️ ノード更新失敗（リトライキューに追加）:', result.error);
        }
      } catch (error) {
        console.warn('⚠️ ノード更新失敗:', error.message);
      }
    } else {
      console.log('📝 ローカルのみ更新:', nodeId);
    }
  };

  // 子ノード追加（完全分離版）
  const addChildNode = async (parentId, nodeText = '', startEditing = false) => {
    const parentNode = findNode(parentId);
    if (!parentNode) return null;
    
    const newChild = createNewNode(nodeText, parentNode);
    const childrenCount = parentNode.children?.length || 0;
    const position = calculateNodePosition(parentNode, childrenCount, childrenCount + 1);
    newChild.x = position.x;
    newChild.y = position.y;
    
    // 色を設定
    newChild.color = getNodeColor(parentNode, childrenCount);
    
    // 🔧 重要: データ参照共有を防ぐため完全なディープクローンを実行
    console.log('📝 addChildNode: データをディープクローン中...');
    const currentData = dataRef.current;
    const clonedData = deepClone(currentData);
    
    // 1. クローンされたデータに対してローカル状態を即座に更新
    const addChildRecursive = (node) => {
      if (node.id === parentId) {
        if (!node.children) {
          node.children = [];
        }
        node.children.push(newChild);
        return node;
      }
      if (node.children) {
        node.children.forEach(addChildRecursive);
      }
      return node;
    };
    
    addChildRecursive(clonedData.rootNode);
    
    let newRootNode = clonedData.rootNode;
    if (clonedData.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData = { ...clonedData, rootNode: newRootNode };
    await updateData(newData, { skipHistory: false, saveImmediately: true });
    
    // 2. ストレージアダプターを通じて反映
    console.log('🔄 ノード追加同期開始:', newChild.id);
    let result = null;
    try {
      const { getCurrentAdapter } = await import('../utils/storageAdapter.js');
      const adapter = getCurrentAdapter();
      result = await adapter.addNode(data.id, newChild, parentId);
      
      if (result.success) {
        console.log('✅ ノード追加完了:', newChild.id);
        
        // ID再生成があった場合、ローカルデータを更新
        if (result.newId && result.newId !== newChild.id) {
          console.log('🔄 ID再生成によるローカルデータ更新:', {
            originalId: newChild.id,
            newId: result.newId
          });
          await updateNodeId(newChild.id, result.newId);
        }
      } else {
        console.warn('⚠️ ノード追加失敗（リトライキューに追加）:', result.error);
      }
    } catch (error) {
      console.warn('⚠️ ノード追加失敗:', error.message);
    }
    
    // 編集状態を同時に設定
    if (startEditing) {
      // ID再生成があった場合は新しいIDを使用
      const nodeIdToEdit = result?.newId || newChild.id;
      setSelectedNodeId(nodeIdToEdit);
      // 遅延なしで即座に編集モード開始（blur競合を防止）
      setEditingNodeId(nodeIdToEdit);
      setEditText(newChild.text || ''); // ノードのテキストを使用
    }
    
    // ID再生成があった場合は新しいIDを返す
    return result?.newId || newChild.id;
  };

  // 兄弟ノードを追加
  const addSiblingNode = async (nodeId, nodeText = '', startEditing = false) => {
    if (nodeId === 'root') return addChildNode('root', nodeText, startEditing);
    
    const parentNode = findParentNode(nodeId);
    if (!parentNode) return null;
    
    const newSibling = createNewNode(nodeText, parentNode);
    
    // 色の設定
    if (parentNode.id === 'root') {
      const siblingIndex = parentNode.children?.length || 0;
      newSibling.color = getNodeColor(parentNode, siblingIndex);
    } else {
      const existingSibling = findNode(nodeId);
      if (existingSibling) {
        newSibling.color = existingSibling.color;
      } else {
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
    
    await updateData({ ...data, rootNode: newRootNode });
    
    // 2. ストレージアダプターを通じて反映
    console.log('🔄 兄弟ノード追加同期開始:', newSibling.id);
    let result = null;
    try {
      const { getCurrentAdapter } = await import('../utils/storageAdapter.js');
      const adapter = getCurrentAdapter();
      result = await adapter.addNode(data.id, newSibling, parentNode.id);
      
      if (result.success) {
        console.log('✅ 兄弟ノード追加完了:', newSibling.id);
        
        // ID再生成があった場合、ローカルデータを更新
        if (result.newId && result.newId !== newSibling.id) {
          console.log('🔄 ID再生成によるローカルデータ更新:', {
            originalId: newSibling.id,
            newId: result.newId
          });
          await updateNodeId(newSibling.id, result.newId);
        }
      } else {
        console.warn('⚠️ 兄弟ノード追加失敗（リトライキューに追加）:', result.error);
      }
    } catch (error) {
      console.warn('⚠️ 兄弟ノード追加失敗:', error.message);
    }
    
    // データ状態確認
    setTimeout(() => {
      // ID再生成があった場合は新しいIDを使用
      const finalNodeId = result?.newId || newSibling.id;
      const actualNode = findNode(finalNodeId);
      console.log('🔍 兄弟ノード作成後のデータ確認:', { 
        nodeId: finalNodeId, 
        exists: !!actualNode,
        nodeData: actualNode,
        allNodeIds: flattenNodes().map(n => n.id)
      });
    }, 100);
    
    // 編集状態を同時に設定
    if (startEditing) {
      // ID再生成があった場合は新しいIDを使用
      const nodeIdToEdit = result?.newId || newSibling.id;
      setSelectedNodeId(nodeIdToEdit);
      // 遅延なしで即座に編集モード開始（blur競合を防止）
      setEditingNodeId(nodeIdToEdit);
      setEditText(newSibling.text || ''); // ノードのテキストを使用
    }
    
    // ID再生成があった場合は新しいIDを返す
    return result?.newId || newSibling.id;
  };

  // ノードを削除（即座DB反映）
  const deleteNode = async (nodeId) => {
    if (nodeId === 'root') return false;
    
    console.log('🗑️ deleteNode実行開始:', { 
      nodeId, 
      timestamp: Date.now(),
      callStack: new Error().stack
    });
    
    // 削除後に選択するノードを決定
    let nodeToSelect = null;
    const parentNode = findParentNode(nodeId);
    
    if (parentNode && parentNode.children) {
      const currentIndex = parentNode.children.findIndex(child => child.id === nodeId);
      if (currentIndex !== -1) {
        const siblings = parentNode.children;
        
        if (currentIndex < siblings.length - 1) {
          nodeToSelect = siblings[currentIndex + 1].id;
        } else if (currentIndex > 0) {
          nodeToSelect = siblings[currentIndex - 1].id;
        } else {
          nodeToSelect = parentNode.id;
        }
      }
    }
    
    if (!nodeToSelect) {
      nodeToSelect = 'root';
    }
    
    // 🔧 重要: データ参照共有を防ぐため完全なディープクローンを実行
    console.log('📝 deleteNode: データをディープクローン中...');
    const currentData = dataRef.current;
    const clonedData = deepClone(currentData);
    
    // 1. クローンされたデータに対してローカル状態を即座に更新
    const deleteNodeRecursive = (node) => {
      if (node.children) {
        node.children = node.children.filter(child => child.id !== nodeId);
        node.children.forEach(deleteNodeRecursive);
      }
      return node;
    };
    
    deleteNodeRecursive(clonedData.rootNode);
    
    let newRootNode = clonedData.rootNode;
    if (clonedData.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData = { ...clonedData, rootNode: newRootNode };
    await updateData(newData, { skipHistory: false, saveImmediately: true });
    
    // 2. ストレージアダプターを通じて反映
    console.log('🔄 ノード削除同期開始:', nodeId);
    try {
      const { getCurrentAdapter } = await import('../utils/storageAdapter.js');
      const adapter = getCurrentAdapter();
      const result = await adapter.deleteNode(data.id, nodeId);
      
      if (result.success) {
        console.log('✅ ノード削除完了:', nodeId);
      } else {
        console.warn('⚠️ ノード削除失敗（リトライキューに追加）:', result.error);
      }
    } catch (error) {
      console.warn('⚠️ ノード削除失敗:', error.message);
    }
    
    // 削除されたノードが選択されていた場合、決定されたノードを選択
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(nodeToSelect);
    }
    if (editingNodeId === nodeId) setEditingNodeId(null);
    
    return true;
  };

  // ノードをドラッグで移動（ローカルのみ、クラウド同期なし）
  const dragNode = (nodeId, x, y) => {
    updateNode(nodeId, { x, y }, false);
  };

  // ノードの親を変更
  const changeParent = (nodeId, newParentId) => {
    if (nodeId === 'root' || nodeId === newParentId) return false;
    
    // 循環参照防止
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
    
    // 新しい親に追加
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
    
    if (data.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    updateData(
      { ...data, rootNode: newRootNode },
      {
        operationType: 'node_move',
        operationData: {
          nodeId,
          newPosition: { x: nodeToMove.x, y: nodeToMove.y },
          newParentId
        }
      }
    );
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
  const finishEdit = async (nodeId, newText, options = {}) => {
    // newTextがundefinedの場合は現在のeditTextを使用
    const textToSave = newText !== undefined ? newText : editText;
    const currentNode = findNode(nodeId);
    
    console.log('📝 finishEdit - 詳細入力:', { 
      nodeId, 
      newText, 
      editText, 
      textToSave,
      isEmpty: !textToSave || textToSave.trim() === '',
      currentNodeText: currentNode?.text,
      isRoot: nodeId === 'root',
      textToSaveLength: textToSave?.length,
      newTextLength: newText?.length,
      options
    });
    
    const isEmpty = !textToSave || textToSave.trim() === '';
    const isRoot = nodeId === 'root';
    
    // 削除判定：明確な条件でのみ削除（マップ切り替え時は削除を無効化）
    const shouldDelete = isEmpty && !isRoot && currentNode && !options.skipMapSwitchDelete && (
      // 新規作成されたノード（元々空だった）で、テキストが空の場合のみ削除
      (!currentNode.text || currentNode.text.trim() === '') ||
      // または、明示的に削除を要求された場合
      options.forceDelete === true
    );
    
    if (shouldDelete) {
      console.log('🗑️ ノード削除実行:', { 
        nodeId, 
        reason: '空の新規ノードまたは内容を削除したノード',
        originalText: currentNode?.text,
        skipMapSwitchDelete: options.skipMapSwitchDelete
      });
      setEditingNodeId(null);
      setEditText('');
      await deleteNode(nodeId);
      return;
    }
    
    // マップ切り替え時の削除保護をログ出力
    if (isEmpty && !isRoot && options.skipMapSwitchDelete) {
      console.log('🛡️ マップ切り替え時削除保護:', { 
        nodeId, 
        text: textToSave,
        reason: 'マップ切り替え時は空ノードでも削除しない'
      });
    }
    
    if (isEmpty && !isRoot) {
      console.log('⚠️ 空のテキストだが削除しない:', { 
        nodeId, 
        reason: '既存の内容があったノード',
        originalText: currentNode?.text
      });
      // 空でも既存の内容があった場合は削除せず、元の内容を復元
      if (currentNode?.text) {
        await updateNode(nodeId, { text: currentNode.text }, true, { allowDuringEdit: true, source: 'finishEdit-restore' });
      }
    } else if (!isEmpty) {
      console.log('📝 finishEdit - 保存するテキスト:', textToSave.trim());
      await updateNode(nodeId, { text: textToSave.trim() }, true, { allowDuringEdit: true, source: 'finishEdit-save' });
    }
    
    // 編集状態をリセット（対象ノードが現在編集中の場合のみ）
    console.log('🔄 finishEdit編集状態チェック:', { 
      finishEditNodeId: nodeId, 
      currentEditingNodeId: editingNodeId, 
      shouldReset: editingNodeId === nodeId,
      preserveCurrentEdit: options.preserveCurrentEdit
    });
    
    // 編集状態のリセット制御
    const { onlyResetIfCurrent = true, preserveCurrentEdit, onlyUpdateText = false, skipEditStateReset = false } = options;
    
    // テキストのみ更新モード（編集状態は変更しない）
    if (onlyUpdateText) {
      console.log('📝 finishEdit - テキストのみ更新モード:', { 
        nodeId, 
        textToSave: textToSave.trim(),
        isEmpty
      });
      
      if (!isEmpty) {
        console.log('📝 finishEdit - テキストのみ保存:', textToSave.trim());
        await updateNode(nodeId, { text: textToSave.trim() }, true, { allowDuringEdit: true, source: 'finishEdit-textOnly' });
      }
      // 編集状態は変更せずにreturn
      return;
    }
    
    // 新しいノードが編集中の場合は編集状態を保護
    if (preserveCurrentEdit) {
      // setTimeoutの実行タイミングで、新しいノードがまだ編集状態になっていない場合があるため
      // preserveCurrentEditが指定されている場合は、finishEditの編集状態変更部分を無視する
      console.log('✅ 編集状態保護: 新しいノード作成のため編集状態変更をスキップ', { 
        preserveCurrentEdit, 
        currentEditingNodeId: editingNodeId,
        isNewNodeEditing: editingNodeId === preserveCurrentEdit,
        nodeIdBeingFinished: nodeId
      });
      
      // テキスト保存は実行するが、編集状態の変更はスキップ
      if (!isEmpty) {
        console.log('📝 finishEdit - 保護モード: テキストのみ保存:', textToSave.trim());
        updateNode(nodeId, { text: textToSave.trim() }, true, { allowDuringEdit: true, source: 'finishEdit-protected' });
      }
      return;
    }
    
    // 編集状態リセットをスキップ
    if (skipEditStateReset) {
      console.log('✅ 編集状態リセットをスキップ: 新しいノード作成のため');
      return;
    }
    
    if (onlyResetIfCurrent) {
      // 対象ノードが現在編集中の場合のみリセット
      if (editingNodeId === nodeId) {
        console.log('⚠️ 編集状態リセット: 対象ノードが編集中のため');
        setEditingNodeId(null);
        setEditText('');
      } else {
        console.log('✅ 編集状態保持: 対象ノードが編集中ではないため');
      }
    } else {
      // 強制的にリセット
      console.log('⚠️ 編集状態強制リセット');
      setEditingNodeId(null);
      setEditText('');
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

  // ノードIDを更新（UNIQUE制約違反対応）
  const updateNodeId = async (oldId, newId) => {
    try {
      console.log('🔄 ノードID更新開始:', { oldId, newId });
      
      const updateNodeIdRecursive = (node) => {
        if (node.id === oldId) {
          return { ...node, id: newId };
        }
        if (node.children) {
          return { 
            ...node, 
            children: node.children.map(updateNodeIdRecursive) 
          };
        }
        return node;
      };
      
      const newRootNode = updateNodeIdRecursive(data.rootNode);
      const newData = { ...data, rootNode: newRootNode };
      
      await updateData(newData, { skipHistory: true, saveImmediately: false });
      
      // 選択・編集状態も更新
      if (selectedNodeId === oldId) {
        setSelectedNodeId(newId);
      }
      if (editingNodeId === oldId) {
        setEditingNodeId(newId);
      }
      
      console.log('✅ ノードID更新完了:', { oldId, newId });
    } catch (error) {
      console.error('❌ ノードID更新失敗:', error);
    }
  };

  return {
    selectedNodeId,
    editingNodeId,
    editText,
    setSelectedNodeId,
    setEditingNodeId,
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
    toggleCollapse,
    updateNodeId
  };
};