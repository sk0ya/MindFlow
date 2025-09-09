import React, { useState, useEffect, useRef } from 'react';
import type { MindMapData } from '../../../../shared/types';
import { searchNodes, searchMultipleMaps, getMatchPosition, type SearchResult } from '../../../../shared/utils/searchUtils';
import './SearchSidebar.css';

export type SearchScope = 'current' | 'all';

interface SearchSidebarProps {
  currentMapData?: MindMapData | null;
  allMapsData?: MindMapData[];
  onNodeSelect?: (nodeId: string) => void;
  onMapSwitch?: (mapId: string) => void;
}

const SearchSidebar: React.FC<SearchSidebarProps> = ({
  currentMapData,
  allMapsData = [],
  onNodeSelect,
  onMapSwitch
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>('current');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search input when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);


  // Handle search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        setIsSearching(true);
        let results: SearchResult[] = [];
        
        if (searchScope === 'current') {
          results = searchNodes(searchQuery, currentMapData || null);
        } else if (searchScope === 'all') {
          results = searchMultipleMaps(searchQuery, allMapsData);
        }
        
        setSearchResults(results);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 300); // デバウンス

    return () => clearTimeout(timer);
  }, [searchQuery, currentMapData, allMapsData, searchScope]);

  const handleNodeClick = (result: SearchResult) => {
    // 他のマップのノードの場合は、まずマップを切り替えてからノードを選択
    if (result.mapId && result.mapId !== currentMapData?.id) {
      onMapSwitch?.(result.mapId);
      // マップ切り替え後にノードを選択（少し遅延させる）
      setTimeout(() => {
        onNodeSelect?.(result.nodeId);
      }, 500);
    } else {
      onNodeSelect?.(result.nodeId);
    }
  };

  const highlightMatch = (text: string, query: string) => {
    const matchPos = getMatchPosition(text, query);
    if (!matchPos) return text;
    
    const { beforeMatch, match, afterMatch } = matchPos;
    return (
      <>
        {beforeMatch}
        <mark className="search-highlight">{match}</mark>
        {afterMatch}
      </>
    );
  };


  const getMatchTypeLabel = (matchType: SearchResult['matchType']) => {
    switch (matchType) {
      case 'text':
        return 'テキスト';
      case 'note':
        return 'ノート';
      default:
        return '';
    }
  };

  return (
    <div className="search-sidebar">
      <div className="search-sidebar-header">
        <h2>検索</h2>
        
        {/* 検索スコープ選択 */}
        <div className="search-scope-selector">
          <div className="search-scope-options">
            <label className="search-scope-option">
              <input
                type="radio"
                name="searchScope"
                value="current"
                checked={searchScope === 'current'}
                onChange={(e) => setSearchScope(e.target.value as SearchScope)}
              />
              <span>現在のマップ</span>
            </label>
            <label className="search-scope-option">
              <input
                type="radio"
                name="searchScope"
                value="all"
                checked={searchScope === 'all'}
                onChange={(e) => setSearchScope(e.target.value as SearchScope)}
              />
              <span>すべてのマップ ({allMapsData.length}個)</span>
            </label>
          </div>
        </div>
        
        <div className="search-input-container">
          <input
            ref={inputRef}
            type="text"
            placeholder={searchScope === 'current' ? "現在のマップから検索..." : "すべてのマップから検索..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="クリア"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="search-results">
        {isSearching && (
          <div className="search-loading">
            検索中...
          </div>
        )}

        {!isSearching && searchQuery && searchResults.length === 0 && (
          <div className="search-no-results">
            検索結果が見つかりませんでした
          </div>
        )}

        {!isSearching && searchResults.length > 0 && (
          <>
            <div className="search-results-count">
              {searchResults.length}件の検索結果
            </div>
            <div className="search-results-list">
              {searchResults.map((result) => (
                <div
                  key={`${result.mapId}-${result.nodeId}`}
                  className="search-result-item"
                  onClick={() => handleNodeClick(result)}
                >
                  <div className="search-result-header">
                    <h4 className="search-result-title">
                      {highlightMatch(result.text, searchQuery)}
                    </h4>
                    <span className="search-result-match-type">
                      {getMatchTypeLabel(result.matchType)}
                    </span>
                  </div>
                  
                  {result.note && (
                    <div className="search-result-content">
                      {highlightMatch(result.note, searchQuery)}
                    </div>
                  )}
                  
                  {result.mapTitle && (
                    <div className="search-result-map">
                      マップ: {result.mapTitle}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {!searchQuery && (
          <div className="search-placeholder">
            <div className="search-placeholder-icon">🔍</div>
            <div className="search-placeholder-text">
              ノードのテキストやノートを検索できます
            </div>
            <div className="search-placeholder-tips">
              <h4>検索のヒント:</h4>
              <ul>
                <li>部分一致で検索されます</li>
                <li>大文字小文字は区別されません</li>
                <li>検索スコープを選択してください：</li>
                <li style={{ marginLeft: '16px' }}>• 現在のマップ：開いているマップのみ</li>
                <li style={{ marginLeft: '16px' }}>• すべてのマップ：保存されたすべてのマップ</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchSidebar;