import React, { useState, useCallback, useMemo, memo } from 'react';
import SidebarHeader from './sidebar/SidebarHeader';
import CategoryGroup from './sidebar/CategoryGroup';
import SidebarCollapsed from './sidebar/SidebarCollapsed';
import SidebarStyles from './sidebar/SidebarStyles';
import type { MindMapData } from '@shared/types';

interface MindMapSidebarProps {
  mindMaps: MindMapData[];
  currentMapId: string | null;
  onSelectMap: (mapId: string) => void;
  onCreateMap: (title: string, category?: string) => void;
  onDeleteMap: (mapId: string) => void;
  onRenameMap: (mapId: string, newTitle: string) => void;
  onChangeCategory: (mapId: string, category: string) => void;
  availableCategories: string[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const MindMapSidebar: React.FC<MindMapSidebarProps> = ({ 
  mindMaps, 
  currentMapId, 
  onSelectMap, 
  onCreateMap, 
  onDeleteMap,
  onRenameMap,
  onChangeCategory,
  isCollapsed,
  onToggleCollapse 
}) => {
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState(new Set<string>());
  const [draggedMap, setDraggedMap] = useState<MindMapData | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

  // イベントハンドラー
  const handleStartRename = useCallback((mapId: string, currentTitle: string) => {
    setEditingMapId(mapId);
    setEditingTitle(currentTitle);
  }, []);

  const handleFinishRename = useCallback((mapId: string) => {
    if (editingTitle.trim() && editingTitle.trim() !== '') {
      onRenameMap(mapId, editingTitle.trim());
    }
    setEditingMapId(null);
    setEditingTitle('');
  }, [editingTitle, onRenameMap]);

  const handleCancelRename = useCallback(() => {
    setEditingMapId(null);
    setEditingTitle('');
  }, []);

  const toggleCategoryCollapse = useCallback((category: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category);
    } else {
      newCollapsed.add(category);
    }
    setCollapsedCategories(newCollapsed);
  }, [collapsedCategories]);

  // ドラッグ&ドロップハンドラー
  const handleDragStart = useCallback((e: React.DragEvent, map: MindMapData) => {
    setDraggedMap(map);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, category: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCategory(category);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverCategory(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, category: string) => {
    e.preventDefault();
    if (draggedMap && draggedMap.category !== category) {
      onChangeCategory(draggedMap.id, category);
    }
    setDraggedMap(null);
    setDragOverCategory(null);
  }, [draggedMap, onChangeCategory]);

  // フィルタリングとグループ化
  const { filteredMaps, groupedMaps, categories } = useMemo(() => {
    const filtered = mindMaps.filter(map =>
      map.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const grouped = filtered.reduce((groups: { [key: string]: MindMapData[] }, map) => {
      const category = map.category || 'その他';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(map);
      return groups;
    }, {});

    const cats = Object.keys(grouped).sort((a, b) => {
      if (a === 'その他') return 1;
      if (b === 'その他') return -1;
      return a.localeCompare(b);
    });

    return { filteredMaps: filtered, groupedMaps: grouped, categories: cats };
  }, [mindMaps, searchTerm]);

  // 折りたたみ状態の場合
  if (isCollapsed) {
    return (
      <>
        <SidebarCollapsed 
          onToggleCollapse={onToggleCollapse}
          onCreateMap={onCreateMap}
        />
        <SidebarStyles />
      </>
    );
  }

  // 展開状態
  return (
    <div className="mindmap-sidebar">
      <SidebarHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onCreateMap={onCreateMap}
        onToggleCollapse={onToggleCollapse}
      />

      {filteredMaps.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🗺️</div>
          <div className="empty-title">
            {mindMaps.length === 0 ? 'マインドマップがありません' : '検索結果が見つかりません'}
          </div>
          <div className="empty-description">
            {mindMaps.length === 0 
              ? '上の「+」ボタンから新しいマインドマップを作成してください。' 
              : '検索条件を変更してみてください。'
            }
          </div>
        </div>
      ) : (
        <CategoryGroup
          categories={categories}
          groupedMaps={groupedMaps}
          collapsedCategories={collapsedCategories}
          currentMapId={currentMapId}
          editingMapId={editingMapId}
          editingTitle={editingTitle}
          dragOverCategory={dragOverCategory}
          onToggleCategoryCollapse={toggleCategoryCollapse}
          onSelectMap={onSelectMap}
          onStartRename={handleStartRename}
          onFinishRename={handleFinishRename}
          onCancelRename={handleCancelRename}
          onDeleteMap={onDeleteMap}
          onEditingTitleChange={setEditingTitle}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />
      )}

      <SidebarStyles />
    </div>
  );
};

export default memo(MindMapSidebar);