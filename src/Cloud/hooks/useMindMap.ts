import { useState, useCallback, useEffect } from 'react';
import { useCloudData } from './useCloudData';

interface Node {
  id: string;
  text: string;
  x: number;
  y: number;
  children: Node[];
}

interface MindMapData {
  id: string;
  title: string;
  rootNode: Node;
  updatedAt: string;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useMindMap = () => {
  const { data, setData, updateMindMapData, isLoading, error } = useCloudData();
  const [selectedNodeId, setSelectedNodeId] = useState<string>('root');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [pendingAutoEdit, setPendingAutoEdit] = useState<string | null>(null);

  const findNode = useCallback((id: string, node?: Node): Node | null => {
    if (!data) return null;
    const searchRoot = node || data.rootNode;
    if (searchRoot.id === id) return searchRoot;
    for (const child of searchRoot.children) {
      const found = findNode(id, child);
      if (found) return found;
    }
    return null;
  }, [data]);

  const updateNode = useCallback((id: string, updates: Partial<Node>) => {
    if (!data) return;

    const updateNodeInTree = (node: Node): Node => {
      if (node.id === id) {
        return { ...node, ...updates };
      }
      return {
        ...node,
        children: node.children.map(updateNodeInTree)
      };
    };

    const newData = {
      ...data,
      rootNode: updateNodeInTree(data.rootNode),
      updatedAt: new Date().toISOString()
    };

    setData(newData);
  }, [data, setData]);

  const addChildNode = useCallback((parentId: string, text: string = '', autoEdit: boolean = false) => {
    if (!data) return;

    const parentNode = findNode(parentId);
    if (!parentNode) return;

    // ローカルモードと同じ座標計算ロジック（MindMeisterスタイル）
    let newX, newY;
    const childCount = parentNode.children.length;
    
    if (parentId === 'root') {
      // ルートノードの場合：左右分散配置
      const baseRadius = 180; // RADIAL_BASE_RADIUS + 30
      const angle = childCount * (Math.PI / 4); // 45度ずつ配置
      
      // 偶数インデックス→右側、奇数インデックス→左側
      const side = childCount % 2 === 0 ? 1 : -1; // 右: 1, 左: -1
      
      newX = parentNode.x + (baseRadius * side);
      newY = parentNode.y + Math.sin(angle) * 80; // 縦方向に変化
    } else {
      // 子ノードの場合：水平方向に配置
      const levelSpacing = 200; // LEVEL_SPACING
      const verticalSpacing = 80;
      
      newX = parentNode.x + levelSpacing;
      newY = parentNode.y + (childCount * verticalSpacing) - ((parentNode.children.length - 1) * verticalSpacing / 2);
    }

    const newNode: Node = {
      id: generateId(),
      text,
      x: newX,
      y: newY,
      children: []
    };

    const addToNode = (node: Node): Node => {
      if (node.id === parentId) {
        return {
          ...node,
          children: [...node.children, newNode]
        };
      }
      return {
        ...node,
        children: node.children.map(addToNode)
      };
    };

    const newData = {
      ...data,
      rootNode: addToNode(data.rootNode),
      updatedAt: new Date().toISOString()
    };

    // 自動編集の場合はIndexedDB保存を遅延（編集完了後に保存）
    const saveOptions = autoEdit ? { delayIndexedDB: true } : {};
    setData(newData, saveOptions);
    setSelectedNodeId(newNode.id);

    // 自動編集開始
    if (autoEdit) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 autoEdit=true: 自動編集状態を設定（IndexedDB保存遅延）', {
          newNodeId: newNode.id,
          newNodeText: newNode.text
        });
      }
      setPendingAutoEdit(newNode.id);
    } else if (process.env.NODE_ENV === 'development') {
      console.log('🎯 autoEdit=false: 自動編集なし（即座保存）');
    }
  }, [data, setData, findNode]);

  const deleteNode = useCallback((id: string) => {
    if (id === 'root' || !data) return;

    const removeFromNode = (node: Node): Node => ({
      ...node,
      children: node.children
        .filter(child => child.id !== id)
        .map(removeFromNode)
    });

    const newData = {
      ...data,
      rootNode: removeFromNode(data.rootNode),
      updatedAt: new Date().toISOString()
    };

    setData(newData);

    if (selectedNodeId === id) {
      setSelectedNodeId('root');
    }
  }, [data, setData, selectedNodeId]);

  const startEdit = useCallback((nodeId: string) => {
    const node = findNode(nodeId);
    if (node) {
      setEditingNodeId(nodeId);
      setEditText(node.text);
    }
  }, [findNode]);

  const finishEdit = useCallback((nodeId?: string, text?: string, options: any = {}) => {
    const targetNodeId = nodeId || editingNodeId;
    const targetText = text !== undefined ? text : editText;
    const isEmpty = !targetText || targetText.trim() === '';
    const currentNode = findNode(targetNodeId || '');
    const isRoot = targetNodeId === 'root';
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 finishEdit開始:', {
        targetNodeId,
        targetText,
        isEmpty,
        isRoot,
        originalText: currentNode?.text,
        skipDelete: options.skipDelete
      });
    }
    
    // 削除判定の改善（ローカルモードと同等の判定）
    // より厳格な空ノード削除ロジック
    const wasNewlyCreated = currentNode && (!currentNode.text || currentNode.text.trim() === '');
    const isIntentionalEdit = options.userInitiated !== false; // ユーザーが明示的に編集完了した場合
    const shouldDelete = isEmpty && !isRoot && currentNode && !options.skipDelete && (
      // 新規作成されたノード（元々空だった）で、テキストが空の場合
      (wasNewlyCreated && isIntentionalEdit) ||
      // または、明示的に削除を要求された場合
      options.forceDelete === true
    );
    
    if (shouldDelete) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🗑️ 空のノードを削除:', targetNodeId);
      }
      deleteNode(targetNodeId || '');
    } else if (isEmpty && !isRoot && currentNode?.text) {
      // 空でも既存の内容があった場合は削除せず、元の内容を復元
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 元のテキストを復元:', { targetNodeId, originalText: currentNode.text });
      }
      updateNode(targetNodeId || '', { text: currentNode.text });
    } else if (!isEmpty && targetNodeId) {
      // テキストを保存
      if (process.env.NODE_ENV === 'development') {
        console.log('💾 テキストを保存:', { targetNodeId, text: targetText.trim() });
      }
      updateNode(targetNodeId, { text: targetText.trim() });
    }
    
    setEditingNodeId(null);
    setEditText('');
  }, [editingNodeId, editText, updateNode, findNode, deleteNode]);

  const updateTitle = useCallback((title: string) => {
    if (!data) return;
    const newData = {
      ...data,
      title,
      updatedAt: new Date().toISOString()
    };
    setData(newData);
  }, [data, setData]);

  // pendingAutoEditを処理するuseEffect
  useEffect(() => {
    if (pendingAutoEdit && data) {
      const node = findNode(pendingAutoEdit);
      if (node) {
        if (process.env.NODE_ENV === 'development') {
          console.log('🎯 autoEdit実行: 編集状態を設定', {
            nodeId: pendingAutoEdit,
            text: node.text
          });
        }
        setEditingNodeId(pendingAutoEdit);
        setEditText(node.text);
        setPendingAutoEdit(null);
      }
    }
  }, [pendingAutoEdit, data, findNode]);

  // 編集完了時にIndexedDBに確実に保存するuseEffect
  useEffect(() => {
    // 編集が終了した時点でデータを保存（editingNodeIdがnullになった時）
    // ただし、ページロード直後の初期化は除外
    const hasValidData = data && data.rootNode && data.id;
    const wasActuallyEditing = document.hasFocus(); // ページがフォーカスされている場合のみ実際の編集
    
    if (!editingNodeId && hasValidData && wasActuallyEditing) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 編集完了 - IndexedDB同期実行', {
          hasValidData,
          wasActuallyEditing,
          dataId: data.id
        });
      }
      // 編集完了時は即座にIndexedDBに保存（ただし空ノードクリーンアップ付き）
      setData(data, { immediate: false, cleanupEmptyNodes: true });
    }
  }, [editingNodeId, data, setData]);

  // データ復元時のクリーンアップ（ページリロード対応）
  useEffect(() => {
    if (data && data.rootNode && data.id) {
      // データが設定された直後に空文字ノードをチェック
      const hasEmptyNodes = checkForEmptyNodes(data.rootNode);
      
      if (hasEmptyNodes) {
        if (process.env.NODE_ENV === 'development') {
          console.log('🧹 データ復元時: 空文字ノード検出、クリーンアップ実行');
        }
        
        // useCloudDataのsetDataを通じてクリーンアップを実行
        // これにより統一されたクリーンアップロジックが適用される
        setData(data, { cleanupEmptyNodes: true, immediate: false });
      }
    }
  }, [data?.id, setData]); // data.idが変わった時（新しいデータが読み込まれた時）のみ実行

  // 空文字ノードをチェックするヘルパー関数
  const checkForEmptyNodes = (node: any): boolean => {
    if (!node) return false;
    
    if (node.children) {
      for (const child of node.children) {
        // 空文字またはnullテキストのノードがあるかチェック
        if (!child.text || child.text.trim() === '') {
          return true;
        }
        // 再帰的にチェック
        if (checkForEmptyNodes(child)) {
          return true;
        }
      }
    }
    
    return false;
  };

  return {
    data,
    selectedNodeId,
    editingNodeId,
    editText,
    isLoading,
    error,
    setSelectedNodeId,
    setEditingNodeId,
    setEditText,
    findNode,
    updateNode,
    addChildNode,
    deleteNode,
    startEdit,
    finishEdit,
    updateTitle
  };
};