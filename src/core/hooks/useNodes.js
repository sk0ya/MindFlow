/**
 * ノード操作のシンプルなフック
 */

import { useCallback } from 'react';
import { addChildNode, updateNode, deleteNode, findNode } from '../../shared/utils/mapUtils.js';

export function useNodes(mapData, updateMap) {
  // 子ノードを追加
  const addChild = useCallback((parentId, text = '') => {
    if (!mapData) return null;
    
    try {
      const updatedMap = addChildNode(mapData, parentId, text);
      updateMap(updatedMap);
      
      // 新しく作成されたノードのIDを返す
      const parentNode = findNode(updatedMap.rootNode, parentId);
      return parentNode.children[parentNode.children.length - 1].id;
    } catch (error) {
      console.error('Failed to add child node:', error);
      return null;
    }
  }, [mapData, updateMap]);

  // 兄弟ノードを追加
  const addSibling = useCallback((nodeId, text = '') => {
    if (!mapData || nodeId === 'root') return null;
    
    try {
      // 親ノードを見つけて、そこに子ノードとして追加
      const parent = findNode(mapData.rootNode, nodeId);
      if (!parent) return null;
      
      // 親の親を探す（grandparent）
      let grandParent = null;
      const findGrandParent = (node, targetId) => {
        if (node.children) {
          for (const child of node.children) {
            if (child.id === targetId) {
              return node;
            }
            const found = findGrandParent(child, targetId);
            if (found) return found;
          }
        }
        return null;
      };
      
      grandParent = findGrandParent(mapData.rootNode, nodeId);
      if (!grandParent) return null;
      
      return addChild(grandParent.id, text);
    } catch (error) {
      console.error('Failed to add sibling node:', error);
      return null;
    }
  }, [mapData, addChild]);

  // ノードを更新
  const update = useCallback((nodeId, updates) => {
    if (!mapData) return;
    
    try {
      const updatedMap = updateNode(mapData, nodeId, updates);
      updateMap(updatedMap);
    } catch (error) {
      console.error('Failed to update node:', error);
    }
  }, [mapData, updateMap]);

  // ノードを削除
  const remove = useCallback((nodeId) => {
    if (!mapData) return;
    
    try {
      const updatedMap = deleteNode(mapData, nodeId);
      updateMap(updatedMap);
    } catch (error) {
      console.error('Failed to delete node:', error);
    }
  }, [mapData, updateMap]);

  // ノードを検索
  const find = useCallback((nodeId) => {
    if (!mapData) return null;
    return findNode(mapData.rootNode, nodeId);
  }, [mapData]);

  return {
    addChild,
    addSibling,
    update,
    remove,
    find,
  };
}