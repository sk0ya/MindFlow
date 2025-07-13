// マインドマップ管理サービス - 一覧表示、検索、ソート、カテゴリ管理
import { MindMapData, MindMapNode } from '../../../shared/types/dataTypes';
import { logger } from '../../../shared/utils/logger';
import { localEngine } from '../../../core/storage/LocalEngine';

// 拡張マップ情報の型
export interface EnhancedMapInfo {
  id: string;
  title: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
  attachmentCount: number;
  mapLinkCount: number;
  storageSize: number;
  storageSizeFormatted: string;
  thumbnail?: string; // Base64 encoded SVG/PNG
  hasAttachments: boolean;
  hasMapLinks: boolean;
  lastAccessedAt?: string;
  tags?: string[];
}

// 検索オプション
export interface SearchOptions {
  query?: string;
  categories?: string[];
  hasAttachments?: boolean;
  hasMapLinks?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
}

// ソートオプション
export type SortField = 'title' | 'createdAt' | 'updatedAt' | 'nodeCount' | 'storageSize' | 'category';
export type SortOrder = 'asc' | 'desc';

export interface SortOptions {
  field: SortField;
  order: SortOrder;
}

// カテゴリ情報
export interface CategoryInfo {
  name: string;
  count: number;
  totalSize: number;
  createdAt: string;
  color?: string;
  description?: string;
}

// サムネイル生成設定
const THUMBNAIL_CONFIG = {
  width: 200,
  height: 150,
  nodeSize: 8,
  fontSize: 10,
  backgroundColor: '#ffffff',
  nodeColor: '#4a90e2',
  textColor: '#333333',
  connectionColor: '#cccccc'
};

// ノード数をカウント
const countNodes = (node: MindMapNode): number => {
  let count = 1;
  if (node.children) {
    node.children.forEach(child => {
      count += countNodes(child);
    });
  }
  return count;
};

// 添付ファイル数をカウント
const countAttachments = (node: MindMapNode): number => {
  let count = node.attachments?.length || 0;
  if (node.children) {
    node.children.forEach(child => {
      count += countAttachments(child);
    });
  }
  return count;
};

// マップリンク数をカウント
const countMapLinks = (node: MindMapNode): number => {
  let count = node.mapLinks?.length || 0;
  if (node.children) {
    node.children.forEach(child => {
      count += countMapLinks(child);
    });
  }
  return count;
};

// ストレージサイズを計算
const calculateStorageSize = (mapData: MindMapData): number => {
  try {
    const dataString = JSON.stringify(mapData);
    return new Blob([dataString]).size;
  } catch {
    return 0;
  }
};

// ファイルサイズの人間readable表示
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// SVGサムネイルの生成
const generateSVGThumbnail = (mapData: MindMapData): string => {
  const { width, height, nodeSize, fontSize, backgroundColor, nodeColor, textColor, connectionColor } = THUMBNAIL_CONFIG;
  
  // ノードの位置を正規化してサムネイルサイズに合わせる
  const normalizePosition = (nodes: MindMapNode[], bounds: { minX: number, maxX: number, minY: number, maxY: number }) => {
    const scaleX = (width - 40) / (bounds.maxX - bounds.minX || 1);
    const scaleY = (height - 40) / (bounds.maxY - bounds.minY || 1);
    const scale = Math.min(scaleX, scaleY, 1); // 最小スケールを1に制限
    
    return nodes.map(node => ({
      ...node,
      x: 20 + (node.x - bounds.minX) * scale,
      y: 20 + (node.y - bounds.minY) * scale
    }));
  };

  // 全ノードを収集
  const collectNodes = (node: MindMapNode, nodes: MindMapNode[] = []): MindMapNode[] => {
    nodes.push(node);
    if (node.children) {
      node.children.forEach(child => collectNodes(child, nodes));
    }
    return nodes;
  };

  const allNodes = collectNodes(mapData.rootNode);
  
  // バウンディングボックスを計算
  const bounds = allNodes.reduce(
    (acc, node) => ({
      minX: Math.min(acc.minX, node.x),
      maxX: Math.max(acc.maxX, node.x),
      minY: Math.min(acc.minY, node.y),
      maxY: Math.max(acc.maxY, node.y)
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  );

  // ポジションを正規化
  const normalizedNodes = normalizePosition(allNodes, bounds);

  // 接続線を生成
  const generateConnections = (node: MindMapNode, normalizedNodes: MindMapNode[]): string => {
    if (!node.children || node.children.length === 0) return '';
    
    const parentNode = normalizedNodes.find(n => n.id === node.id);
    if (!parentNode) return '';

    return node.children.map(child => {
      const childNode = normalizedNodes.find(n => n.id === child.id);
      if (!childNode) return '';
      
      return `<line x1="${parentNode.x}" y1="${parentNode.y}" x2="${childNode.x}" y2="${childNode.y}" stroke="${connectionColor}" stroke-width="1"/>` +
        generateConnections(child, normalizedNodes);
    }).join('');
  };

  // SVG要素を生成
  const connections = generateConnections(mapData.rootNode, normalizedNodes);
  
  const nodes = normalizedNodes.map(node => {
    const textLength = node.text.length;
    const truncatedText = textLength > 8 ? node.text.substring(0, 8) + '...' : node.text;
    const isRoot = node.id === mapData.rootNode.id;
    const fillColor = node.color || (isRoot ? '#ff6b6b' : nodeColor);
    
    return `
      <circle cx="${node.x}" cy="${node.y}" r="${isRoot ? nodeSize + 2 : nodeSize}" fill="${fillColor}" stroke="#fff" stroke-width="1"/>
      <text x="${node.x}" y="${node.y + fontSize/3}" text-anchor="middle" font-size="${fontSize}" font-family="Arial, sans-serif" fill="${textColor}">${truncatedText}</text>
    `;
  }).join('');

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${backgroundColor}"/>
      ${connections}
      ${nodes}
    </svg>
  `;

  // Base64エンコード
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
};

// 拡張マップ情報の生成
const generateEnhancedMapInfo = (mapData: MindMapData): EnhancedMapInfo => {
  const nodeCount = countNodes(mapData.rootNode);
  const attachmentCount = countAttachments(mapData.rootNode);
  const mapLinkCount = countMapLinks(mapData.rootNode);
  const storageSize = calculateStorageSize(mapData);
  
  return {
    id: mapData.id,
    title: mapData.title,
    category: mapData.category || '未分類',
    createdAt: mapData.createdAt,
    updatedAt: mapData.updatedAt,
    nodeCount,
    attachmentCount,
    mapLinkCount,
    storageSize,
    storageSizeFormatted: formatFileSize(storageSize),
    thumbnail: generateSVGThumbnail(mapData),
    hasAttachments: attachmentCount > 0,
    hasMapLinks: mapLinkCount > 0,
    tags: []
  };
};

// 全マップの拡張情報を取得
export const getAllEnhancedMapInfo = (): EnhancedMapInfo[] => {
  try {
    logger.info('📋 拡張マップ情報の取得開始');
    
    const allMaps = localEngine.getAllMindMapsWithFullData() as MindMapData[];
    const enhancedMaps = allMaps.map(generateEnhancedMapInfo);
    
    logger.info('✅ 拡張マップ情報の取得完了', {
      mapCount: enhancedMaps.length,
      totalSize: enhancedMaps.reduce((sum, map) => sum + map.storageSize, 0)
    });
    
    return enhancedMaps;
  } catch (error) {
    logger.error('❌ 拡張マップ情報の取得失敗', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return [];
  }
};

// マップ検索
export const searchMaps = (maps: EnhancedMapInfo[], options: SearchOptions): EnhancedMapInfo[] => {
  let filteredMaps = [...maps];
  
  // テキスト検索
  if (options.query) {
    const query = options.query.toLowerCase();
    filteredMaps = filteredMaps.filter(map =>
      map.title.toLowerCase().includes(query) ||
      map.category.toLowerCase().includes(query) ||
      (map.tags && map.tags.some(tag => tag.toLowerCase().includes(query)))
    );
  }
  
  // カテゴリフィルタ
  if (options.categories && options.categories.length > 0) {
    filteredMaps = filteredMaps.filter(map =>
      options.categories!.includes(map.category)
    );
  }
  
  // 添付ファイル有無フィルタ
  if (options.hasAttachments !== undefined) {
    filteredMaps = filteredMaps.filter(map =>
      map.hasAttachments === options.hasAttachments
    );
  }
  
  // マップリンク有無フィルタ
  if (options.hasMapLinks !== undefined) {
    filteredMaps = filteredMaps.filter(map =>
      map.hasMapLinks === options.hasMapLinks
    );
  }
  
  // 日付範囲フィルタ
  if (options.dateRange) {
    const { start, end } = options.dateRange;
    filteredMaps = filteredMaps.filter(map => {
      const updatedAt = new Date(map.updatedAt);
      return updatedAt >= start && updatedAt <= end;
    });
  }
  
  // タグフィルタ
  if (options.tags && options.tags.length > 0) {
    filteredMaps = filteredMaps.filter(map =>
      map.tags && options.tags!.some(tag => map.tags!.includes(tag))
    );
  }
  
  logger.info('🔍 マップ検索完了', {
    originalCount: maps.length,
    filteredCount: filteredMaps.length,
    searchOptions: options
  });
  
  return filteredMaps;
};

// マップソート
export const sortMaps = (maps: EnhancedMapInfo[], options: SortOptions): EnhancedMapInfo[] => {
  const { field, order } = options;
  
  const sortedMaps = [...maps].sort((a, b) => {
    let comparison = 0;
    
    switch (field) {
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'createdAt':
      case 'updatedAt':
        comparison = new Date(a[field]).getTime() - new Date(b[field]).getTime();
        break;
      case 'nodeCount':
      case 'storageSize':
        comparison = a[field] - b[field];
        break;
      case 'category':
        comparison = a.category.localeCompare(b.category);
        break;
      default:
        comparison = 0;
    }
    
    return order === 'desc' ? -comparison : comparison;
  });
  
  logger.info('📊 マップソート完了', {
    mapCount: sortedMaps.length,
    sortField: field,
    sortOrder: order
  });
  
  return sortedMaps;
};

// カテゴリ一覧の取得
export const getAllCategories = (): CategoryInfo[] => {
  try {
    const allMaps = getAllEnhancedMapInfo();
    const categoryMap = new Map<string, CategoryInfo>();
    
    allMaps.forEach(map => {
      const categoryName = map.category;
      if (categoryMap.has(categoryName)) {
        const categoryInfo = categoryMap.get(categoryName)!;
        categoryInfo.count++;
        categoryInfo.totalSize += map.storageSize;
      } else {
        categoryMap.set(categoryName, {
          name: categoryName,
          count: 1,
          totalSize: map.storageSize,
          createdAt: map.createdAt
        });
      }
    });
    
    const categories = Array.from(categoryMap.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
    
    logger.info('📂 カテゴリ一覧取得完了', {
      categoryCount: categories.length,
      totalMaps: allMaps.length
    });
    
    return categories;
  } catch (error) {
    logger.error('❌ カテゴリ一覧取得失敗', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return [];
  }
};

// マップのカテゴリ変更
export const updateMapCategory = (mapId: string, newCategory: string): boolean => {
  try {
    const mapData = localEngine.getMindMap(mapId);
    if (!mapData) {
      logger.error('❌ マップが見つかりません', { mapId });
      return false;
    }
    
    const updatedData = {
      ...mapData,
      category: newCategory,
      updatedAt: new Date().toISOString()
    };
    
    const result = localEngine.updateMindMap(mapId, updatedData);
    
    if (result.success) {
      logger.info('✅ マップカテゴリ変更完了', {
        mapId,
        oldCategory: mapData.category || '未分類',
        newCategory
      });
    } else {
      logger.error('❌ マップカテゴリ変更失敗', {
        mapId,
        error: result.error
      });
    }
    
    return result.success;
  } catch (error) {
    logger.error('❌ マップカテゴリ変更中にエラー', {
      mapId,
      newCategory,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
};

// マップの統計情報を取得
export const getMapStatistics = () => {
  try {
    const allMaps = getAllEnhancedMapInfo();
    
    const totalMaps = allMaps.length;
    const totalNodes = allMaps.reduce((sum, map) => sum + map.nodeCount, 0);
    const totalAttachments = allMaps.reduce((sum, map) => sum + map.attachmentCount, 0);
    const totalMapLinks = allMaps.reduce((sum, map) => sum + map.mapLinkCount, 0);
    const totalSize = allMaps.reduce((sum, map) => sum + map.storageSize, 0);
    
    const mapsWithAttachments = allMaps.filter(map => map.hasAttachments).length;
    const mapsWithMapLinks = allMaps.filter(map => map.hasMapLinks).length;
    
    const averageNodesPerMap = totalMaps > 0 ? Math.round(totalNodes / totalMaps) : 0;
    const averageSizePerMap = totalMaps > 0 ? totalSize / totalMaps : 0;
    
    const categories = getAllCategories();
    const largestMap = allMaps.reduce((largest, map) => 
      map.nodeCount > largest.nodeCount ? map : largest,
      allMaps[0] || { nodeCount: 0, title: '', id: '' }
    );
    
    const statistics = {
      totalMaps,
      totalNodes,
      totalAttachments,
      totalMapLinks,
      totalSize,
      totalSizeFormatted: formatFileSize(totalSize),
      mapsWithAttachments,
      mapsWithMapLinks,
      averageNodesPerMap,
      averageSizePerMap,
      averageSizePerMapFormatted: formatFileSize(averageSizePerMap),
      categoryCount: categories.length,
      largestMap: {
        id: largestMap.id,
        title: largestMap.title,
        nodeCount: largestMap.nodeCount
      },
      recentActivity: allMaps
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5)
        .map(map => ({
          id: map.id,
          title: map.title,
          updatedAt: map.updatedAt,
          nodeCount: map.nodeCount
        }))
    };
    
    logger.info('📊 マップ統計情報取得完了', statistics);
    
    return statistics;
  } catch (error) {
    logger.error('❌ マップ統計情報取得失敗', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
};