/**
 * マップデータ操作のユーティリティ関数（ノード操作統合版）
 */

import { generateId as dataTypesGenerateId, generateMapId, createNewNode, deepClone, MindMapData, MindMapNode } from '../types/dataTypes.js';
import { LAYOUT } from '../constants/index.js';

// 型定義
export interface NodeSearchResult {
  node: MindMapNode | null;
  found: boolean;
}

export interface MapUpdateResult {
  success: boolean;
  data: MindMapData;
  updatedAt: string;
}

// ID生成はdataTypes.jsに統一（後方互換性のためのエイリアス）
export const generateId = dataTypesGenerateId;

// 初期マップデータを作成（dataTypes.jsに統一、ここはエイリアス）
import { createInitialData } from '../types/dataTypes.js';
export const createInitialMapData = (id: string = generateMapId(), title: string = '新しいマインドマップ'): MindMapData => {
  const data = createInitialData();
  if (id !== data.id) data.id = id;
  if (title !== data.title) data.title = title;
  return data;
};

// ノード作成はdataTypes.jsに統一（ここはエイリアス）
export const createNode = (text: string = '', parentNode: MindMapNode | null = null): MindMapNode => {
  const node = createNewNode(text, parentNode);
  
  // 位置計算の調整（既存ロジックを維持）
  if (parentNode) {
    const childCount = parentNode.children ? parentNode.children.length : 0;
    node.x = parentNode.x + LAYOUT.LEVEL_SPACING;
    node.y = parentNode.y + (childCount - 1) * 60 - 30;
  }
  
  return node;
};

// ノードを検索（再帰的）
export function findNode(rootNode: MindMapNode, nodeId: string): MindMapNode | null {
  if (rootNode.id === nodeId) {
    return rootNode;
  }

  if (rootNode.children) {
    for (const child of rootNode.children) {
      const found = findNode(child, nodeId);
      if (found) return found;
    }
  }

  return null;
}

// 親ノードを検索
export function findParent(rootNode: MindMapNode, nodeId: string): MindMapNode | null {
  if (rootNode.children) {
    for (const child of rootNode.children) {
      if (child.id === nodeId) {
        return rootNode;
      }
      
      const parent = findParent(child, nodeId);
      if (parent) return parent;
    }
  }

  return null;
}

// ノードを追加
export function addChildNode(mapData: MindMapData, parentId: string, nodeText: string = ''): MindMapData {
  const parentNode = findNode(mapData.rootNode, parentId);
  if (!parentNode) {
    throw new Error(`Parent node not found: ${parentId}`);
  }

  const newNode = createNode(nodeText, parentNode);
  
  if (!parentNode.children) {
    parentNode.children = [];
  }
  
  parentNode.children.push(newNode);

  return {
    ...mapData,
    updatedAt: new Date().toISOString(),
  };
}

// ノードを更新
export function updateNode(mapData: MindMapData, nodeId: string, updates: Partial<MindMapNode>): MindMapData {
  const node = findNode(mapData.rootNode, nodeId);
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  Object.assign(node, updates);

  return {
    ...mapData,
    updatedAt: new Date().toISOString(),
  };
}

// ノードを削除
export function deleteNode(mapData: MindMapData, nodeId: string): MindMapData {
  // ルートノードは削除できない
  if (nodeId === 'root') {
    throw new Error('Cannot delete root node');
  }

  const parent = findParent(mapData.rootNode, nodeId);
  if (!parent) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  parent.children = parent.children.filter(child => child.id !== nodeId);

  return {
    ...mapData,
    updatedAt: new Date().toISOString(),
  };
}

// データクローンはdataTypes.jsに統一（ここはエイリアス）
export const cloneMapData = (mapData: MindMapData): MindMapData => deepClone(mapData);