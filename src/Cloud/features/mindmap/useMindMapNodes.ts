import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createNewNode, calculateNodePosition, COLORS, deepClone } from '../../shared/types/dataTypes.js';
import { mindMapLayoutPreserveRoot } from '../../shared/utils/autoLayout.js';
import { storageManager } from '../../core/storage/StorageManager.js';
import { getAppSettings } from '../../core/storage/storageUtils.js';
import type { MindMapData, MindMapNode } from '../../shared/types/index.js';

interface UseMindMapNodesResult {
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  setSelectedNodeId: (id: string | null) => void;
  setEditingNodeId: (id: string | null) => void;
  setEditText: (text: string) => void;
  flattenNodes: (rootNode?: MindMapNode) => MindMapNode[];
  findNode: (nodeId: string, rootNode?: MindMapNode) => MindMapNode | null;
  findParentNode: (nodeId: string, rootNode?: MindMapNode, parent?: MindMapNode) => MindMapNode | null;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  addChildNode: (parentId: string, text?: string, startEditing?: boolean) => Promise<void>;
  addSiblingNode: (siblingId: string, text?: string, startEditing?: boolean) => Promise<void>;
  deleteNode: (nodeId: string) => void;
  dragNode: (nodeId: string, x: number, y: number) => void;
  changeParent: (nodeId: string, newParentId: string) => void;
  startEdit: (nodeId: string) => void;
  finishEdit: (nodeId: string, text: string) => void;
  toggleCollapse: (nodeId: string) => void;
  applyAutoLayout: (algorithm?: string) => void;
}

// ノード操作専用のカスタムフック
export const useMindMapNodes = (
  data: MindMapData | null, 
  updateData: (updatedData: MindMapData, options?: { allowDuringEdit?: boolean; reason?: string }) => void,
  blockRealtimeSyncTemporarily: () => void
): UseMindMapNodesResult => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  
  // 最新のdataを参照するためのref
  const dataRef = useRef<MindMapData | null>(data);
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

  // ノード更新（DB-First方式）
  const updateNode = async (nodeId, updates, syncToCloud = true, options = {}) => {
    console.log('📝 updateNode開始:', { nodeId, updates, syncToCloud });
    
    // syncToCloudがfalseの場合（ドラッグ操作など）は従来通りローカル先行
    if (!syncToCloud) {
      console.log('📝 ローカルのみ更新:', nodeId);
      const currentData = dataRef.current;
      const clonedData = deepClone(currentData);
      
      const updateNodeRecursive = (node) => {
        if (node.id === nodeId) {
          Object.assign(node, updates);
          return node;
        }
        if (node.children) {
          node.children.forEach(updateNodeRecursive);
        }
        return node;
      };
      
      updateNodeRecursive(clonedData.rootNode);
      
      const updateOptions = {
        skipHistory: false,
        source: options.source || 'updateNode-local',
        allowDuringEdit: options.allowDuringEdit || false,
        immediate: true
      };
      
      await updateData(clonedData, updateOptions);
      return;
    }
    
    // 1. 最初にDB操作を実行（syncToCloudがtrueの場合）
    let dbResult = null;
    
    try {
      console.log('📤 DB更新操作実行中:', nodeId);
      
      const adapter = storageManager;
      dbResult = await adapter.updateNode(dataRef.current.id, nodeId, updates);
      
      if (!dbResult.success) {
        console.error('❌ DB更新操作失敗:', dbResult.error);
        throw new Error(dbResult.error || 'ノード更新に失敗しました');
      }
      
      console.log('✅ DB更新操作成功:', nodeId);
      
    } catch (error) {
      console.error('❌ ノード更新DB操作失敗:', error);
      // DB操作失敗時はローカル状態を変更せずにエラーを返す
      throw error;
    }
    
    // 2. DB操作成功後、ローカル状態を更新
    console.log('📝 ローカル状態更新開始');
    const currentData = dataRef.current;
    const clonedData = deepClone(currentData);
    
    const updateNodeRecursive = (node) => {
      if (node.id === nodeId) {
        Object.assign(node, updates);
        return node;
      }
      if (node.children) {
        node.children.forEach(updateNodeRecursive);
      }
      return node;
    };
    
    updateNodeRecursive(clonedData.rootNode);
    
    const updateOptions = {
      skipHistory: false,
      source: options.source || 'updateNode',
      allowDuringEdit: options.allowDuringEdit || false,
      saveImmediately: false // DB操作済みなので即座保存は不要
    };
    
    await updateData(clonedData, updateOptions);
    
    console.log('✅ ローカル状態更新完了:', nodeId);
  };

  // 子ノード追加（一時ノード作成方式）
  const addChildNode = async (parentId, nodeText = '', startEditing = false) => {
    const parentNode = findNode(parentId);
    if (!parentNode) return null;
    
    console.log('🔄 一時ノード追加開始:', { parentId, nodeText, startEditing });
    
    // 1. ローカルに一時ノードを作成（DB保存はしない）
    const tempChild = createNewNode(nodeText, parentNode);
    const childrenCount = parentNode.children?.length || 0;
    const position = calculateNodePosition(parentNode, childrenCount, childrenCount + 1);
    tempChild.x = position.x;
    tempChild.y = position.y;
    tempChild.color = getNodeColor(parentNode, childrenCount);
    
    // 一時ノードフラグを設定（編集完了まではDB保存しない）
    tempChild.isTemporary = true;
    
    console.log('📝 一時ノード作成:', tempChild.id);
    
    // 2. ローカル状態を即座に更新
    const currentData = dataRef.current;
    const clonedData = deepClone(currentData);
    
    const addChildRecursive = (node) => {
      if (node.id === parentId) {
        if (!node.children) {
          node.children = [];
        }
        node.children.push(tempChild);
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
    await updateData(newData, { skipHistory: false, saveImmediately: false }); // 一時ノードなので保存しない
    
    console.log('✅ 一時ノード作成完了:', tempChild.id);
    
    // 編集状態を設定
    if (startEditing) {
      setSelectedNodeId(tempChild.id);
      setEditingNodeId(tempChild.id);
      setEditText(tempChild.text || '');
    }
    
    return tempChild.id;
  };

  // 兄弟ノードを追加（一時ノード作成方式）
  const addSiblingNode = async (nodeId, nodeText = '', startEditing = false) => {
    if (nodeId === 'root') return addChildNode('root', nodeText, startEditing);
    
    const parentNode = findParentNode(nodeId);
    if (!parentNode) return null;
    
    console.log('🔄 一時兄弟ノード追加開始:', { nodeId, parentNode: parentNode.id, nodeText, startEditing });
    
    // 1. ローカルに一時ノードを作成（DB保存はしない）
    const tempSibling = createNewNode(nodeText, parentNode);
    
    // 色の設定
    if (parentNode.id === 'root') {
      const siblingIndex = parentNode.children?.length || 0;
      tempSibling.color = getNodeColor(parentNode, siblingIndex);
    } else {
      const existingSibling = findNode(nodeId);
      if (existingSibling) {
        tempSibling.color = existingSibling.color;
      } else {
        tempSibling.color = parentNode.color || '#666';
      }
    }
    
    // 一時ノードフラグを設定
    tempSibling.isTemporary = true;
    
    console.log('📝 一時兄弟ノード作成:', tempSibling.id);
    
    // 2. ローカル状態を即座に更新
    const currentData = dataRef.current;
    const clonedData = deepClone(currentData);
    
    const addSiblingRecursive = (node) => {
      if (node.id === parentNode.id) {
        const currentIndex = node.children?.findIndex(child => child.id === nodeId) ?? -1;
        if (currentIndex === -1) return node;
        
        const newChildren = [...(node.children || [])];
        newChildren.splice(currentIndex + 1, 0, tempSibling);
        return { ...node, children: newChildren };
      }
      return { ...node, children: node.children?.map(addSiblingRecursive) || [] };
    };
    
    let newRootNode = addSiblingRecursive(clonedData.rootNode);
    if (clonedData.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData = { ...clonedData, rootNode: newRootNode };
    await updateData(newData, { skipHistory: false, saveImmediately: false }); // 一時ノードなので保存しない
    
    console.log('✅ 一時兄弟ノード作成完了:', tempSibling.id);
    
    // 編集状態を設定
    if (startEditing) {
      setSelectedNodeId(tempSibling.id);
      setEditingNodeId(tempSibling.id);
      setEditText(tempSibling.text || '');
    }
    
    return tempSibling.id;
  };

  // ノードを削除（一時ノード対応）
  const deleteNode = async (nodeId) => {
    if (nodeId === 'root') return false;
    
    const currentNode = findNode(nodeId);
    const isTemporary = currentNode?.isTemporary === true;
    
    console.log('🗑️ deleteNode実行開始:', { 
      nodeId, 
      isTemporary,
      timestamp: Date.now()
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
    
    // 一時ノードの場合はDB操作をスキップ（元々DBにない）
    if (!isTemporary) {
      // 1. DB操作を実行（既存ノードのみ）
      try {
        console.log('📤 DB削除操作実行中:', nodeId);
        
        const adapter = storageManager;
        const dbResult = await adapter.deleteNode(dataRef.current.id, nodeId);
        
        if (!dbResult.success) {
          console.error('❌ DB削除操作失敗:', dbResult.error);
          throw new Error(dbResult.error || 'ノード削除に失敗しました');
        }
        
        console.log('✅ DB削除操作成功:', nodeId);
        
      } catch (error) {
        console.error('❌ ノード削除DB操作失敗:', error);
        // DB操作失敗時はローカル状態を変更せずにエラーを返す
        throw error;
      }
    } else {
      console.log('📝 一時ノードのローカル削除:', nodeId);
    }
    
    // 2. ローカル状態を更新
    console.log('📝 ローカル状態更新開始');
    const currentData = dataRef.current;
    const clonedData = deepClone(currentData);
    
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
    await updateData(newData, { skipHistory: false, saveImmediately: false }); // 一時ノードはDB操作なし
    
    console.log('✅ ローカル状態更新完了:', nodeId);
    
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

  // ノードの親を変更（DB-First方式）
  const changeParent = async (nodeId, newParentId) => {
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
    
    console.log('🔄 ノード親変更開始:', { nodeId, newParentId });
    
    // 1. 最初にDB操作を実行
    let dbResult = null;
    
    try {
      console.log('📤 DB親変更操作実行中:', nodeId);
      
      const adapter = storageManager;
      dbResult = await adapter.moveNode(dataRef.current.id, nodeId, newParentId);
      
      if (!dbResult.success) {
        console.error('❌ DB親変更操作失敗:', dbResult.error);
        throw new Error(dbResult.error || 'ノード親変更に失敗しました');
      }
      
      console.log('✅ DB親変更操作成功:', nodeId);
      
    } catch (error) {
      console.error('❌ ノード親変更DB操作失敗:', error);
      // DB操作失敗時はローカル状態を変更せずにエラーを返す
      throw error;
    }
    
    // 2. DB操作成功後、ローカル状態を更新
    console.log('📝 ローカル状態更新開始');
    const currentData = dataRef.current;
    const clonedData = deepClone(currentData);
    
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
    
    let newRootNode = removeFromParent(clonedData.rootNode);
    newRootNode = addToNewParent(newRootNode);
    
    if (clonedData.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData = { ...clonedData, rootNode: newRootNode };
    await updateData(newData, {
      skipHistory: false,
      saveImmediately: false, // DB操作済みなので即座保存は不要
      operationType: 'node_move',
      operationData: {
        nodeId,
        newPosition: { x: nodeToMove.x, y: nodeToMove.y },
        newParentId
      }
    });
    
    console.log('✅ ローカル状態更新完了:', nodeId);
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

  // 編集終了（一時ノードのDB保存処理を含む）
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
      isTemporary: currentNode?.isTemporary,
      textToSaveLength: textToSave?.length,
      newTextLength: newText?.length,
      options
    });
    
    const isEmpty = !textToSave || textToSave.trim() === '';
    const isRoot = nodeId === 'root';
    const isTemporary = currentNode?.isTemporary === true;
    
    // 一時ノードの特別処理
    if (isTemporary) {
      console.log('📦 一時ノードの編集完了処理:', { 
        nodeId, 
        isEmpty, 
        textToSave,
        skipMapSwitchDelete: options.skipMapSwitchDelete 
      });
      
      if (isEmpty && !options.skipMapSwitchDelete) {
        // 空の一時ノードは削除（マップ切り替え時は保護）
        console.log('🗑️ 空の一時ノードを削除:', nodeId);
        setEditingNodeId(null);
        setEditText('');
        await deleteNode(nodeId); // ローカルのみ削除（元々DBにない）
        return;
      } else if (isEmpty && options.skipMapSwitchDelete) {
        // マップ切り替え時は空の一時ノードも保護
        console.log('🛡️ マップ切り替え時の一時ノード保護:', nodeId);
        // 一時フラグを除去して通常ノードに変換（空テキストでも）
        await updateNode(nodeId, { 
          text: '', // 空テキストで保存
          isTemporary: undefined 
        }, false, {
          allowDuringEdit: true, 
          source: 'finishEdit-tempToNormalOnMapSwitch' 
        });
        return;
      } else {
        // テキストがある一時ノードはDBに保存して正式なノードにする
        console.log('📤 一時ノードをDBに保存:', { nodeId, text: textToSave.trim() });
        
        try {
          // DBアダプターを取得
            const adapter = storageManager;
          
          // 親ノードを取得
          const parentNode = findParentNode(nodeId);
          if (!parentNode) {
            throw new Error('親ノードが見つかりません');
          }
          
          // 親ノードが一時ノードの場合は先に保存する必要がある
          if (parentNode.isTemporary) {
            console.log('🔄 親ノードも一時ノード: 先に親ノードを保存します', parentNode.id);
            
            // 親ノードに祖父ノードがある場合の処理
            const grandParentNode = findParentNode(parentNode.id);
            if (grandParentNode && grandParentNode.isTemporary) {
              console.log('⚠️ 祖父ノードも一時ノード: 階層保存が複雑になるため、一時ノードのままDBに保存をスキップ');
              throw new Error('階層的な一時ノードの保存は複雑になるため、親ノードを先に編集完了してください');
            }
            
            // 親ノードのテキストが空でない場合のみ保存
            if (parentNode.text && parentNode.text.trim()) {
              const parentNodeDataForDB = { ...parentNode };
              delete parentNodeDataForDB.isTemporary;
              
              const grandParentIdForDB = grandParentNode ? 
                (grandParentNode.id === 'root' ? 'root' : grandParentNode.id) : 'root';
              
              const parentDbResult = await adapter.addNode(dataRef.current.id, parentNodeDataForDB, grandParentIdForDB);
              
              if (parentDbResult.success) {
                console.log('✅ 親ノードのDB保存成功:', parentNode.id);
                
                // 親ノードの一時フラグを除去
                await updateNode(parentNode.id, { isTemporary: undefined }, false, { 
                  allowDuringEdit: true, 
                  source: 'finishEdit-parentSaved' 
                });
                
                // ID再生成があった場合
                if (parentDbResult.newId && parentDbResult.newId !== parentNode.id) {
                  await updateNodeId(parentNode.id, parentDbResult.newId);
                }
              }
            } else {
              console.log('⚠️ 親ノードのテキストが空のため、一時ノードのままDBに保存をスキップ');
              throw new Error('親ノードにテキストを入力してから、子ノードを保存してください');
            }
          }
          
          // 一時フラグを除去してDB保存用データを作成
          const nodeDataForDB = { ...currentNode };
          delete nodeDataForDB.isTemporary;
          nodeDataForDB.text = textToSave.trim();
          
          // 親ノードIDの適切な設定（rootの場合は'root'として扱う）
          const parentIdForDB = parentNode.id === 'root' ? 'root' : parentNode.id;
          
          const dbResult = await adapter.addNode(dataRef.current.id, nodeDataForDB, parentIdForDB);
          
          if (dbResult.success) {
            console.log('✅ 一時ノードのDB保存成功:', nodeId);
            
            // 🔧 NEW: サーバーファーストアーキテクチャ
            // サーバーからの最新データでローカルを更新（競合回避）
            await updateFromServerResponse(dbResult, nodeId, textToSave.trim());
            
          } else {
            console.error('❌ 一時ノードのDB保存失敗:', dbResult.error);
            // 失敗してもローカルではテキストを保持
            await updateNode(nodeId, { 
              text: textToSave.trim(),
              isTemporary: undefined
            }, false, {
              allowDuringEdit: true, 
              source: 'finishEdit-temporaryLocalOnly' 
            });
          }
          
        } catch (error) {
          console.error('❌ 一時ノードのDB保存エラー:', error);
          // エラーでもローカルではテキストを保持
          await updateNode(nodeId, { 
            text: textToSave.trim(),
            isTemporary: undefined
          }, false, {
            allowDuringEdit: true, 
            source: 'finishEdit-temporaryError' 
          });
        }
      }
    } else {
      // 既存ノードの通常処理
      
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
        
        // 🔧 NEW: クラウドモードではサーバーファースト更新
        const adapter = storageManager;
        // 型安全なクラウドアダプター判定
        const isCloudAdapter = adapter.storageMode === 'cloud';
        
        if (isCloudAdapter) {
          const cloudAdapter = adapter as CloudStorageAdapter;
          console.log('☁️ クラウドモード: サーバーファースト更新');
          try {
            // サーバーでノード更新
            const updateResult = await cloudAdapter.updateNode(dataRef.current.id, nodeId, { 
              text: textToSave.trim() 
            });
            
            if (updateResult.success) {
              // サーバー成功：最新データでローカル更新
              await refreshFromServer();
            } else {
              // サーバー失敗：フォールバックでローカル更新
              console.warn('⚠️ サーバー更新失敗、ローカルフォールバック');
              await updateNode(nodeId, { text: textToSave.trim() }, false, { 
                allowDuringEdit: true, 
                source: 'finishEdit-cloud-fallback' 
              });
            }
          } catch (error) {
            console.error('❌ クラウド更新エラー:', error);
            // エラー時はローカル更新
            await updateNode(nodeId, { text: textToSave.trim() }, false, { 
              allowDuringEdit: true, 
              source: 'finishEdit-error-fallback' 
            });
          }
        } else {
          // ローカルモード：従来通り
          await updateNode(nodeId, { text: textToSave.trim() }, true, { 
            allowDuringEdit: true, 
            source: 'finishEdit-local' 
          });
        }
      }
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
      if (!isEmpty && !isTemporary) { // 一時ノードは上で処理済み
        console.log('📝 finishEdit - 保護モード: テキストのみ保存:', textToSave.trim());
        updateNode(nodeId, { text: textToSave.trim() }, true, { allowDuringEdit: true, source: 'finishEdit-protected' });
      } else if (isTemporary) {
        // 一時ノードの保護モード処理は上で完了
        console.log('📦 一時ノードの保護モード処理完了:', nodeId);
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
    
    // 編集完了後、一時的にリアルタイム同期をブロック
    if (blockRealtimeSyncTemporarily && !options.skipSyncBlock) {
      blockRealtimeSyncTemporarily(3000); // 3秒間ブロック
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

  // 🔧 NEW: サーバーレスポンスからローカル状態を更新（サーバーファースト）
  const updateFromServerResponse = async (dbResult, originalNodeId, expectedText) => {
    try {
      console.log('🌐 サーバーレスポンスからローカル更新開始:', { 
        originalNodeId, 
        finalId: dbResult.finalId || dbResult.newId || originalNodeId,
        expectedText 
      });
      
      const finalNodeId = dbResult.finalId || dbResult.newId || originalNodeId;
      const hasIdChanged = finalNodeId !== originalNodeId;
      
      if (hasIdChanged) {
        // ID変更がある場合：まずIDを更新してからテキストを設定
        console.log('🔄 ID変更を含むサーバーレスポンス処理:', {
          originalId: originalNodeId,
          finalId: finalNodeId
        });
        
        // 1. IDのみ更新（テキストはサーバーから取得した内容を保持）
        await updateNodeId(originalNodeId, finalNodeId);
        
        // 2. 最新のサーバー状態でローカルを更新（競合回避）
        await refreshFromServer();
      } else {
        // ID変更なし：ローカルでテキストのみ更新
        console.log('📝 テキストのみ更新:', { nodeId: originalNodeId, text: expectedText });
        await updateNode(originalNodeId, { 
          text: expectedText, 
          isTemporary: undefined 
        }, false, { 
          allowDuringEdit: true, 
          source: 'finishEdit-serverResponse' 
        });
      }
      
      console.log('✅ サーバーレスポンス処理完了:', finalNodeId);
    } catch (error) {
      console.error('❌ サーバーレスポンス処理エラー:', error);
      // フォールバック：ローカルのみ更新
      await updateNode(originalNodeId, { 
        text: expectedText, 
        isTemporary: undefined 
      }, false, { 
        allowDuringEdit: true, 
        source: 'finishEdit-fallback' 
      });
    }
  };

  // サーバーから最新データを取得してローカル更新
  const refreshFromServer = async () => {
    try {
      console.log('📥 サーバーから最新データ取得開始');
      const adapter = storageManager;
      const latestData = await adapter.getMap(dataRef.current.id);
      
      if (latestData) {
        console.log('✅ サーバーから最新データ取得完了');
        // リアルタイム同期をスキップしてローカル更新
        await updateData(latestData, {
          skipHistory: false,
          source: 'server-refresh',
          allowDuringEdit: true,
          skipRealtimeSync: true // 🔧 NEW: リアルタイム同期をスキップ
        });
      }
    } catch (error) {
      console.error('❌ サーバーからのデータ取得エラー:', error);
    }
  };

  // ノードIDを更新（UNIQUE制約違反対応）
  const updateNodeId = async (oldId, newId) => {
    try {
      console.log('🔄 ノードID更新開始:', { oldId, newId });
      
      const updateNodeIdRecursive = (node) => {
        if (node.id === oldId) {
          // すべてのプロパティを保持してIDのみ更新
          return { ...node, id: newId };
        }
        if (node.children && node.children.length > 0) {
          return { 
            ...node, 
            children: node.children.map(updateNodeIdRecursive) 
          };
        }
        return node;
      };
      
      // 最新のデータを取得してID更新を実行
      const currentData = dataRef.current;
      const newRootNode = updateNodeIdRecursive(currentData.rootNode);
      const newData = { ...currentData, rootNode: newRootNode };
      
      await updateData(newData, { 
        skipHistory: true, 
        saveImmediately: false,
        allowDuringEdit: true, // ノードID更新は編集中でも実行必要
        source: 'node-id-update'
      });
      
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