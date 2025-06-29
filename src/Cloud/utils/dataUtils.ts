import type { MindMapData, MindMapNode } from '../types';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function createInitialNode(): MindMapNode {
  return {
    id: generateId(),
    text: 'メイントピック',
    x: 400,
    y: 300,
    children: [],
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333'
  };
}

export function createInitialData(): MindMapData {
  const now = new Date().toISOString();
  
  return {
    id: generateId(),
    title: '新しいマインドマップ',
    rootNode: createInitialNode(),
    createdAt: now,
    updatedAt: now,
    settings: {
      autoSave: true,
      autoLayout: false
    }
  };
}