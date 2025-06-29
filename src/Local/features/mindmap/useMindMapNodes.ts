import { useState, useCallback, useRef, useEffect } from 'react';
// useMemo is imported for potential future performance optimizations
import { createNewNode, calculateNodePosition, COLORS, deepClone, MindMapData, MindMapNode } from '../../shared/types/dataTypes';
import { mindMapLayoutPreserveRoot } from '../../shared/utils/autoLayout';

// ======================================
// 型定義
// ======================================

// 基本的な型定義
export interface Position {
  x: number;
  y: number;
}

// ノード更新オプション
export interface UpdateNodeOptions {
  source?: string;
  allowDuringEdit?: boolean;
  skipHistory?: boolean;
  immediate?: boolean;
}

// データ更新オプション
export interface UpdateDataOptions {
  skipHistory?: boolean;
  source?: string;
  allowDuringEdit?: boolean;
  immediate?: boolean;
  operationType?: string;
  operationData?: Record<string, any>;
}

// 編集終了オプション
export interface FinishEditOptions {
  skipMapSwitchDelete?: boolean;
  forceDelete?: boolean;
  onlyResetIfCurrent?: boolean;
  preserveCurrentEdit?: string | null;
  onlyUpdateText?: boolean;
  skipEditStateReset?: boolean;
}

// レイアウトオプション
export interface LayoutOptions {
  centerX: number;
  centerY: number;
  baseRadius: number;
  levelSpacing: number;
  minVerticalSpacing: number;
  maxVerticalSpacing: number;
}

// ホック戻り値の型定義
export interface UseMindMapNodesReturn {
  // 状態
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  
  // 状態更新関数
  setSelectedNodeId: (nodeId: string | null) => void;
  setEditingNodeId: (nodeId: string | null) => void;
  setEditText: (text: string) => void;
  
  // ノード操作関数
  updateNode: (nodeId: string, updates: Partial<MindMapNode>, options?: UpdateNodeOptions) => Promise<void>;
  addChildNode: (parentId: string, nodeText?: string, startEditing?: boolean) => Promise<string | null>;
  addSiblingNode: (nodeId: string, nodeText?: string, startEditing?: boolean) => Promise<string | null>;
  deleteNode: (nodeId: string) => Promise<boolean>;
  dragNode: (nodeId: string, x: number, y: number) => void;
  changeParent: (nodeId: string, newParentId: string) => Promise<boolean>;
  
  // 検索・ユーティリティ関数
  findNode: (nodeId: string, rootNode?: MindMapNode) => MindMapNode | null;
  findParentNode: (nodeId: string, rootNode?: MindMapNode, parent?: MindMapNode | null) => MindMapNode | null;
  flattenNodes: (rootNode?: MindMapNode) => MindMapNode[];
  applyAutoLayout: (rootNode: MindMapNode) => MindMapNode;
  
  // 編集関数
  startEdit: (nodeId: string, clearText?: boolean) => void;
  finishEdit: (nodeId: string, newText?: string, options?: FinishEditOptions) => Promise<void>;
  toggleCollapse: (nodeId: string) => void;
}

// ノード操作専用のカスタムフック（Local版）
export const useMindMapNodes = (
  data: MindMapData,
  updateData: (newData: MindMapData, options?: UpdateDataOptions) => Promise<void>
): UseMindMapNodesReturn => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  
  // 最新のdataを参照するためのref
  const dataRef = useRef<MindMapData>(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // 全ノードを平坦化（メモ化）
  const flattenNodes = useCallback((rootNode: MindMapNode | undefined = data?.rootNode): MindMapNode[] => {
    if (!rootNode) return [];
    
    const flatten = (node: MindMapNode, result: MindMapNode[] = []): MindMapNode[] => {
      result.push(node);
      node.children?.forEach(child => flatten(child, result));
      return result;
    };
    
    return flatten(rootNode);
  }, [data?.rootNode]);

  // ノードを検索（メモ化）
  const findNode = useCallback((nodeId: string, rootNode: MindMapNode | undefined = data?.rootNode): MindMapNode | null => {
    if (!rootNode || !nodeId) return null;
    if (rootNode.id === nodeId) return rootNode;
    
    for (const child of rootNode.children || []) {
      const found = findNode(nodeId, child);
      if (found) return found;
    }
    return null;
  }, [data?.rootNode]);

  // ノードの親を検索（メモ化）
  const findParentNode = useCallback((
    nodeId: string, 
    rootNode: MindMapNode | undefined = data?.rootNode, 
    parent: MindMapNode | null = null
  ): MindMapNode | null => {
    if (!rootNode || !nodeId) return null;
    if (rootNode.id === nodeId) return parent;
    
    for (const child of rootNode.children || []) {
      const found = findParentNode(nodeId, child, rootNode);
      if (found) return found;
    }
    return null;
  }, [data?.rootNode]);

  // オートレイアウトを適用
  const applyAutoLayout = (rootNode: MindMapNode): MindMapNode => {
    const svg = document.querySelector('.mindmap-canvas-container svg') as SVGSVGElement | null;
    const centerX = rootNode.x || (svg?.clientWidth ? svg.clientWidth / 2 : 400);
    const centerY = rootNode.y || (svg?.clientHeight ? svg.clientHeight / 2 : 300);
    
    return mindMapLayoutPreserveRoot(rootNode, {
      centerX, centerY, baseRadius: 180, levelSpacing: 200,
      minVerticalSpacing: 80, maxVerticalSpacing: 130
    });
  };

  // ノードの色を取得する（親から継承または新規割り当て）
  const getNodeColor = (parentNode: MindMapNode, childIndex: number): string => {
    if (parentNode.id === 'root') {
      return COLORS[childIndex % COLORS.length] ?? '#666';
    } else {
      return parentNode.color || '#666';
    }
  };

  // ノード更新（Local版）
  const updateNode = async (
    nodeId: string, 
    updates: Partial<MindMapNode>, 
    options: UpdateNodeOptions = {}
  ): Promise<void> => {
    console.log('📝 updateNode開始:', { nodeId, updates });
    
    const currentData = dataRef.current;
    const clonedData = deepClone(currentData);
    
    const updateNodeRecursive = (node: MindMapNode): MindMapNode => {
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
    
    const updateOptions: UpdateDataOptions = {
      skipHistory: false,
      source: options.source || 'updateNode',
      allowDuringEdit: options.allowDuringEdit || false,
      immediate: true
    };
    
    await updateData(clonedData, updateOptions);
    
    console.log('✅ ローカル状態更新完了:', nodeId);
  };

  // 子ノード追加（Local版）
  const addChildNode = async (
    parentId: string, 
    nodeText: string = '', 
    startEditing: boolean = false
  ): Promise<string | null> => {
    const parentNode = findNode(parentId);
    if (!parentNode) return null;
    
    console.log('🔄 子ノード追加開始:', { parentId, nodeText, startEditing });
    
    // 新しい子ノードを作成
    const newChild = createNewNode(nodeText, parentNode);
    const childrenCount = parentNode.children?.length || 0;
    const position = calculateNodePosition(parentNode, childrenCount, childrenCount + 1);
    newChild.x = position.x;
    newChild.y = position.y;
    newChild.color = getNodeColor(parentNode, childrenCount);
    
    console.log('📝 子ノード作成:', newChild.id);
    
    // ローカル状態を更新
    const currentData = dataRef.current;
    const clonedData = deepClone(currentData);
    
    const addChildRecursive = (node: MindMapNode): MindMapNode => {
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
    await updateData(newData, { skipHistory: false, immediate: true });
    
    console.log('✅ 子ノード作成完了:', newChild.id);
    
    // 編集状態を設定
    if (startEditing) {
      setSelectedNodeId(newChild.id);
      setEditingNodeId(newChild.id);
      setEditText(newChild.text || '');
    }
    
    return newChild.id;
  };

  // 兄弟ノードを追加（Local版）
  const addSiblingNode = async (
    nodeId: string, 
    nodeText: string = '', 
    startEditing: boolean = false
  ): Promise<string | null> => {
    if (nodeId === 'root') return addChildNode('root', nodeText, startEditing);
    
    const parentNode = findParentNode(nodeId);
    if (!parentNode) return null;
    
    console.log('🔄 兄弟ノード追加開始:', { nodeId, parentNode: parentNode.id, nodeText, startEditing });
    
    // 新しい兄弟ノードを作成
    const newSibling = createNewNode(nodeText, parentNode);
    
    // 色の設定
    if (parentNode.id === 'root') {
      const siblingIndex = parentNode.children?.length || 0;
      newSibling.color = getNodeColor(parentNode, siblingIndex);
    } else {
      const existingSibling = findNode(nodeId);
      if (existingSibling) {
        newSibling.color = existingSibling.color ?? '#666';
      } else {
        newSibling.color = parentNode.color || '#666';
      }
    }
    
    console.log('📝 兄弟ノード作成:', newSibling.id);
    
    // ローカル状態を更新
    const currentData = dataRef.current;
    const clonedData = deepClone(currentData);
    
    const addSiblingRecursive = (node: MindMapNode): MindMapNode => {
      if (node.id === parentNode.id) {
        const currentIndex = node.children?.findIndex(child => child.id === nodeId) ?? -1;
        if (currentIndex === -1) return node;
        
        const newChildren = [...(node.children || [])];
        newChildren.splice(currentIndex + 1, 0, newSibling);
        return { ...node, children: newChildren };
      }
      return { ...node, children: node.children?.map(addSiblingRecursive) || [] };
    };
    
    let newRootNode = addSiblingRecursive(clonedData.rootNode);
    if (clonedData.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData = { ...clonedData, rootNode: newRootNode };
    await updateData(newData, { skipHistory: false, immediate: true });
    
    console.log('✅ 兄弟ノード作成完了:', newSibling.id);
    
    // 編集状態を設定
    if (startEditing) {
      setSelectedNodeId(newSibling.id);
      setEditingNodeId(newSibling.id);
      setEditText(newSibling.text || '');
    }
    
    return newSibling.id;
  };

  // ノードを削除（Local版）
  const deleteNode = async (nodeId: string): Promise<boolean> => {
    if (nodeId === 'root') return false;
    
    console.log('🗑️ deleteNode実行開始:', { nodeId, timestamp: Date.now() });
    
    // 削除後に選択するノードを決定
    let nodeToSelect: string | null = null;
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
    
    // ローカル状態を更新
    console.log('📝 ローカル状態更新開始');
    const currentData = dataRef.current;
    const clonedData = deepClone(currentData);
    
    const deleteNodeRecursive = (node: MindMapNode): MindMapNode => {
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
    await updateData(newData, { skipHistory: false, immediate: true });
    
    console.log('✅ ローカル状態更新完了:', nodeId);
    
    // 削除されたノードが選択されていた場合、決定されたノードを選択
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(nodeToSelect);
    }
    if (editingNodeId === nodeId) setEditingNodeId(null);
    
    return true;
  };

  // ノードをドラッグで移動（Local版）
  const dragNode = (nodeId: string, x: number, y: number): void => {
    updateNode(nodeId, { x, y });
  };

  // ノードの親を変更（Local版）
  const changeParent = async (nodeId: string, newParentId: string): Promise<boolean> => {
    if (nodeId === 'root' || nodeId === newParentId) return false;
    
    // 循環参照防止
    const isDescendant = (parentId: string, childId: string): boolean => {
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
    
    // ローカル状態を更新
    console.log('📝 ローカル状態更新開始');
    const currentData = dataRef.current;
    const clonedData = deepClone(currentData);
    
    // 現在の親から削除
    const removeFromParent = (node: MindMapNode): MindMapNode => {
      return {
        ...node,
        children: (node.children || [])
          .filter(child => child.id !== nodeId)
          .map(removeFromParent)
      };
    };
    
    // 新しい親に追加
    const addToNewParent = (node: MindMapNode): MindMapNode => {
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
      immediate: true,
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
  const startEdit = (nodeId: string, clearText: boolean = false): void => {
    const node = findNode(nodeId);
    if (node) {
      setEditingNodeId(nodeId);
      setEditText(clearText ? '' : node.text);
      setSelectedNodeId(nodeId);
    }
  };

  // 編集終了（Local版）
  const finishEdit = async (
    nodeId: string,
    newText?: string,
    options: FinishEditOptions = {}
  ): Promise<void> => {
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
        await updateNode(nodeId, { text: currentNode.text }, { allowDuringEdit: true, source: 'finishEdit-restore' });
      }
    } else if (!isEmpty) {
      console.log('📝 finishEdit - 保存するテキスト:', textToSave.trim());
      
      // ローカルストレージに直接保存
      await updateNode(nodeId, { text: textToSave.trim() }, { 
        allowDuringEdit: true, 
        source: 'finishEdit-local' 
      });
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
        await updateNode(nodeId, { text: textToSave.trim() }, { allowDuringEdit: true, source: 'finishEdit-textOnly' });
      }
      // 編集状態は変更せずにreturn
      return;
    }
    
    // 新しいノードが編集中の場合は編集状態を保護
    if (preserveCurrentEdit) {
      console.log('✅ 編集状態保護: 新しいノード作成のため編集状態変更をスキップ', { 
        preserveCurrentEdit, 
        currentEditingNodeId: editingNodeId,
        isNewNodeEditing: editingNodeId === preserveCurrentEdit,
        nodeIdBeingFinished: nodeId
      });
      
      // テキスト保存は実行するが、編集状態の変更はスキップ
      if (!isEmpty) {
        console.log('📝 finishEdit - 保護モード: テキストのみ保存:', textToSave.trim());
        updateNode(nodeId, { text: textToSave.trim() }, { allowDuringEdit: true, source: 'finishEdit-protected' });
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
  const toggleCollapse = (nodeId: string): void => {
    const toggleNodeRecursive = (node: MindMapNode): MindMapNode => {
      if (node.id === nodeId) return { ...node, collapsed: !node.collapsed };
      return { ...node, children: node.children?.map(toggleNodeRecursive) || [] };
    };
    
    updateData({ ...data, rootNode: toggleNodeRecursive(data.rootNode) }, { skipHistory: false });
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
    toggleCollapse
  };
};