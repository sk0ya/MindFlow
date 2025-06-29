import { useState, useCallback } from 'react';
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

  const addChildNode = useCallback((parentId: string, text: string = 'New Node') => {
    if (!data) return;

    const parentNode = findNode(parentId);
    if (!parentNode) return;

    const newNode: Node = {
      id: generateId(),
      text,
      x: parentNode.x + (parentNode.children.length * 50) + 100,
      y: parentNode.y + 80,
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

    setData(newData);
    setSelectedNodeId(newNode.id);
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

  const finishEdit = useCallback((nodeId?: string, text?: string) => {
    const targetNodeId = nodeId || editingNodeId;
    const targetText = text || editText;
    
    if (targetNodeId && targetText.trim()) {
      updateNode(targetNodeId, { text: targetText.trim() });
    }
    setEditingNodeId(null);
    setEditText('');
  }, [editingNodeId, editText, updateNode]);

  const updateTitle = useCallback((title: string) => {
    if (!data) return;
    const newData = {
      ...data,
      title,
      updatedAt: new Date().toISOString()
    };
    setData(newData);
  }, [data, setData]);

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