/**
 * マップデータ操作のユーティリティ関数
 */

// シンプルなID生成（タイムスタンプベース）
export function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 初期マップデータを作成
export function createInitialMapData(id = generateId(), title = '新しいマインドマップ') {
  return {
    id,
    title,
    rootNode: {
      id: 'root',
      text: 'メインテーマ',
      x: 400,
      y: 300,
      children: [],
      fontSize: 16,
      fontWeight: 'bold',
      color: '#333333',
    },
    settings: {
      autoSave: true,
      autoLayout: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ノードを作成
export function createNode(text = '', parentNode = null) {
  const node = {
    id: generateId(),
    text,
    children: [],
    fontSize: 14,
    fontWeight: 'normal',
    color: '#666666',
  };

  // 親ノードがある場合は位置を計算
  if (parentNode) {
    const childCount = parentNode.children.length;
    node.x = parentNode.x + 200;
    node.y = parentNode.y + (childCount - 1) * 60 - 30;
  } else {
    node.x = 400;
    node.y = 300;
  }

  return node;
}

// ノードを検索（再帰的）
export function findNode(rootNode, nodeId) {
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
export function findParent(rootNode, nodeId) {
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
export function addChildNode(mapData, parentId, nodeText = '') {
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
export function updateNode(mapData, nodeId, updates) {
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
export function deleteNode(mapData, nodeId) {
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

// マップデータを深くクローン
export function cloneMapData(mapData) {
  return JSON.parse(JSON.stringify(mapData));
}