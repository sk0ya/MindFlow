import { useState, useCallback, useEffect } from 'react';
import type { MindMapData, MindMapNode } from '../types';
import { createInitialData, generateId } from '../utils/dataUtils';
import { useCloudData } from './useCloudData';

export function useMindMap(isAuthenticated: boolean = false) {
  const [data, setData] = useState<MindMapData>(createInitialData());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(data.rootNode.id);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  
  const cloudData = useCloudData(isAuthenticated);

  // クラウドデータとの同期（リソース負荷を軽減）
  useEffect(() => {
    if (isAuthenticated && cloudData.maps.length > 0) {
      const currentMap = cloudData.getCurrentMap();
      if (currentMap) {
        setData(currentMap);
        setSelectedNodeId(currentMap.rootNode.id);
        console.log('✅ Map loaded from cloud:', currentMap.id);
      }
    }
    // リソース不足エラーを避けるため、自動マップ作成は無効化
    // ユーザーが手動で作成ボタンを押すまで待機
  }, [isAuthenticated, cloudData.maps]);

  // ログアウト時の初期化
  useEffect(() => {
    if (!isAuthenticated) {
      const initialData = createInitialData();
      setData(initialData);
      setSelectedNodeId(initialData.rootNode.id);
      setEditingNodeId(null);
      setEditText('');
    }
  }, [isAuthenticated]);

  const findNode = useCallback((nodeId: string, node: MindMapNode = data.rootNode): MindMapNode | null => {
    if (node.id === nodeId) return node;
    
    for (const child of node.children) {
      const found = findNode(nodeId, child);
      if (found) return found;
    }
    
    return null;
  }, [data.rootNode]);

  const updateNode = useCallback((nodeId: string, updates: Partial<MindMapNode>) => {
    setData(prevData => {
      const updateNodeRecursive = (node: MindMapNode): MindMapNode => {
        if (node.id === nodeId) {
          return { ...node, ...updates };
        }
        
        return {
          ...node,
          children: node.children.map(updateNodeRecursive)
        };
      };

      return {
        ...prevData,
        rootNode: updateNodeRecursive(prevData.rootNode),
        updatedAt: new Date().toISOString()
      };
    });
  }, []);

  const addChildNode = useCallback((parentId: string, text: string = 'New Node') => {
    const newNode: MindMapNode = {
      id: generateId(),
      text,
      x: 0,
      y: 0,
      children: [],
      fontSize: 14,
      color: '#333'
    };

    setData(prevData => {
      const addChildRecursive = (node: MindMapNode): MindMapNode => {
        if (node.id === parentId) {
          return {
            ...node,
            children: [...node.children, newNode]
          };
        }
        
        return {
          ...node,
          children: node.children.map(addChildRecursive)
        };
      };

      return {
        ...prevData,
        rootNode: addChildRecursive(prevData.rootNode),
        updatedAt: new Date().toISOString()
      };
    });

    return newNode.id;
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    if (nodeId === data.rootNode.id) {
      console.warn('Cannot delete root node');
      return;
    }

    setData(prevData => {
      const deleteNodeRecursive = (node: MindMapNode): MindMapNode => {
        return {
          ...node,
          children: node.children
            .filter(child => child.id !== nodeId)
            .map(deleteNodeRecursive)
        };
      };

      return {
        ...prevData,
        rootNode: deleteNodeRecursive(prevData.rootNode),
        updatedAt: new Date().toISOString()
      };
    });

    if (selectedNodeId === nodeId) {
      setSelectedNodeId(data.rootNode.id);
    }
    if (editingNodeId === nodeId) {
      setEditingNodeId(null);
      setEditText('');
    }
  }, [data.rootNode.id, selectedNodeId, editingNodeId]);

  const startEdit = useCallback((nodeId: string) => {
    const node = findNode(nodeId);
    if (node) {
      setEditingNodeId(nodeId);
      setEditText(node.text);
    }
  }, [findNode]);

  const finishEdit = useCallback((nodeId: string, text: string) => {
    if (text.trim()) {
      updateNode(nodeId, { text: text.trim() });
    }
    setEditingNodeId(null);
    setEditText('');
  }, [updateNode]);

  const updateTitle = useCallback((newTitle: string) => {
    setData(prevData => ({
      ...prevData,
      title: newTitle,
      updatedAt: new Date().toISOString()
    }));
  }, []);

  return {
    data,
    selectedNodeId,
    editingNodeId,
    editText,
    setSelectedNodeId,
    setEditingNodeId,
    setEditText,
    findNode,
    updateNode,
    addChildNode,
    deleteNode,
    startEdit,
    finishEdit,
    updateTitle,
    cloudData,
    isDataLoading: cloudData.isLoading
  };
}