import React from 'react';
import MapItemList from './MapItemList';
import type { MindMapData } from '../../../../shared/types';

interface CategoryGroupProps {
  categories: string[];
  groupedMaps: { [category: string]: MindMapData[] };
  collapsedCategories: Set<string>;
  currentMapId: string | null;
  editingMapId: string | null;
  editingTitle: string;
  dragOverCategory: string | null;
  onToggleCategoryCollapse: (category: string) => void;
  onSelectMap: (mapId: string) => void;
  onStartRename: (mapId: string, title: string) => void;
  onFinishRename: (mapId: string) => void;
  onCancelRename: () => void;
  onDeleteMap: (mapId: string) => void;
  onEditingTitleChange: (title: string) => void;
  onDragStart: (e: React.DragEvent, map: MindMapData) => void;
  onDragOver: (e: React.DragEvent, category: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, category: string) => void;
}

const CategoryGroup: React.FC<CategoryGroupProps> = ({
  categories,
  groupedMaps,
  collapsedCategories,
  currentMapId,
  editingMapId,
  editingTitle,
  dragOverCategory,
  onToggleCategoryCollapse,
  onSelectMap,
  onStartRename,
  onFinishRename,
  onCancelRename,
  onDeleteMap,
  onEditingTitleChange,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop
}) => {
  return (
    <div className="maps-content">
      {categories.map((category) => (
        <div 
          key={category} 
          className={`category-group ${dragOverCategory === category ? 'drag-over' : ''}`}
          onDragOver={(e) => onDragOver(e, category)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, category)}
        >
          <div 
            className="category-header"
            onClick={() => onToggleCategoryCollapse(category)}
          >
            <span className="category-icon">
              {collapsedCategories.has(category) ? '▶' : '▼'}
            </span>
            <span className="category-name">{category}</span>
            <span className="category-count">
              ({groupedMaps[category]?.length || 0})
            </span>
          </div>
          
          {!collapsedCategories.has(category) && (
            <div className="category-maps">
              <MapItemList
                maps={groupedMaps[category] || []}
                currentMapId={currentMapId}
                editingMapId={editingMapId}
                editingTitle={editingTitle}
                onSelectMap={onSelectMap}
                onStartRename={onStartRename}
                onFinishRename={onFinishRename}
                onCancelRename={onCancelRename}
                onDeleteMap={onDeleteMap}
                onEditingTitleChange={onEditingTitleChange}
                onDragStart={onDragStart}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default CategoryGroup;