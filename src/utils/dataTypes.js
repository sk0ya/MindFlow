export const COLORS = [
  '#4285f4',
  '#34a853',
  '#ea4335',
  '#fbbc04',
  '#9c27b0',
  '#ff9800',
  '#795548',
  '#607d8b',
];

export const THEMES = {
  default: {
    name: 'デフォルト',
    background: 'white',
    connectionColor: 'black',
    textColor: 'black'
  }
};

export const generateId = () => {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const createInitialData = () => ({
  id: generateId(),
  title: '新しいマインドマップ',
  theme: 'default',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  rootNode: {
    id: 'root',
    text: 'メイントピック',
    x: 400,
    y: 300,
    fontSize: 16,
    fontWeight: 'normal',
    children: []
  },
  settings: {
    autoSave: true,
    autoLayout: true,
    snapToGrid: false,
    showGrid: false,
    animationEnabled: true
  }
});

export const createNewNode = (text = '新しいアイデア', parentNode = null) => {
  return {
    id: generateId(),
    text,
    x: parentNode ? parentNode.x + 150 : 400,
    y: parentNode ? parentNode.y : 300,
    fontSize: 14,
    fontWeight: 'normal',
    children: []
  };
};

export const calculateNodePosition = (parentNode, childIndex, totalChildren) => {
  if (!parentNode) return { x: 400, y: 300 };
  
  const distance = 180;
  const startAngle = -90;
  const angleStep = totalChildren > 1 ? 180 / (totalChildren - 1) : 0;
  const angle = startAngle + (angleStep * childIndex);
  
  const radian = (angle * Math.PI) / 180;
  const x = parentNode.x + Math.cos(radian) * distance;
  const y = parentNode.y + Math.sin(radian) * distance;
  
  return { x, y };
};

export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

export const STORAGE_KEYS = {
  MINDMAPS: 'mindmaps',
  CURRENT_MAP: 'currentMap',
  SETTINGS: 'appSettings'
};
