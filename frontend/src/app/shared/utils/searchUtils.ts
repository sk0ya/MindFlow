import type { MindMapNode, MindMapData } from '../types';

export interface SearchResult {
  nodeId: string;
  text: string;
  note: string;
  mapId: string | null;
  mapTitle: string | null;
  matchType: 'text' | 'note';
}

/**
 * ノードを再帰的に検索して、検索クエリにマッチするノードを返す
 */
export function searchNodesRecursively(
  node: MindMapNode,
  query: string,
  mapData: MindMapData,
  results: SearchResult[] = []
): SearchResult[] {
  const searchTerm = query.toLowerCase().trim();
  
  // 現在のノードをチェック
  const textMatch = node.text.toLowerCase().includes(searchTerm);
  const noteMatch = node.note?.toLowerCase().includes(searchTerm);

  if (textMatch || noteMatch) {
    results.push({
      nodeId: node.id,
      text: node.text,
      note: node.note || '',
      mapId: mapData.id,
      mapTitle: mapData.title,
      matchType: textMatch ? 'text' : 'note'
    });
  }

  // 子ノードを再帰的に検索
  if (node.children) {
    node.children.forEach(child => {
      searchNodesRecursively(child, query, mapData, results);
    });
  }

  return results;
}

/**
 * マインドマップ内のノードを検索する
 */
export function searchNodes(query: string, mapData: MindMapData | null): SearchResult[] {
  if (!query.trim() || !mapData) return [];
  
  return searchNodesRecursively(mapData.rootNode, query, mapData);
}

/**
 * 複数のマインドマップからノードを検索する
 */
export function searchMultipleMaps(query: string, maps: MindMapData[]): SearchResult[] {
  if (!query.trim() || maps.length === 0) return [];
  
  const allResults: SearchResult[] = [];
  
  maps.forEach(mapData => {
    const mapResults = searchNodesRecursively(mapData.rootNode, query, mapData);
    allResults.push(...mapResults);
  });
  
  return allResults;
}

/**
 * 検索結果のハイライト表示用のマッチ位置を返す
 */
export function getMatchPosition(text: string, query: string): {
  beforeMatch: string;
  match: string;
  afterMatch: string;
} | null {
  if (!query.trim()) return null;
  
  const searchTerm = query.toLowerCase();
  const lowerText = text.toLowerCase();
  const startIndex = lowerText.indexOf(searchTerm);
  
  if (startIndex === -1) return null;
  
  return {
    beforeMatch: text.slice(0, startIndex),
    match: text.slice(startIndex, startIndex + searchTerm.length),
    afterMatch: text.slice(startIndex + searchTerm.length)
  };
}