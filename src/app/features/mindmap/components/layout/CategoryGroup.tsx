import React from 'react';
import MapItemList from './MapItemList';
import type { MindMapData } from '@shared/types';
import type { FolderTree } from '../../../../shared/utils/folderUtils';
import { getFolderName } from '../../../../shared/utils/folderUtils';

interface CategoryGroupProps {
  categories: string[];
  groupedMaps: { [category: string]: MindMapData[] };
  collapsedCategories: Set<string>;
  folderTree: FolderTree;
  selectedFolder: string | null;
  currentMapId: string | null;
  editingMapId: string | null;
  editingTitle: string;
  dragOverCategory: string | null;
  onToggleCategoryCollapse: (category: string) => void;
  onFolderSelect: (folderPath: string) => void;
  onContextMenu: (e: React.MouseEvent, targetPath: string | null, targetType: 'folder' | 'empty' | 'map', mapData?: MindMapData) => void;
  onSelectMap: (mapId: string) => void;
  onFinishRename: (mapId: string) => void;
  onCancelRename: () => void;
  onEditingTitleChange: (title: string) => void;
  onDragStart: (e: React.DragEvent, map: MindMapData) => void;
  onDragOver: (e: React.DragEvent, category: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, category: string) => void;
  onFolderDragStart?: (e: React.DragEvent, folderPath: string) => void;
  onFolderDrop?: (e: React.DragEvent, targetFolderPath: string) => void;
}

const CategoryGroup: React.FC<CategoryGroupProps> = ({
  categories,
  groupedMaps,
  collapsedCategories,
  folderTree,
  selectedFolder,
  currentMapId,
  editingMapId,
  editingTitle,
  dragOverCategory,
  onToggleCategoryCollapse,
  onFolderSelect,
  onContextMenu,
  onSelectMap,
  onFinishRename,
  onCancelRename,
  onEditingTitleChange,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onFolderDragStart,
  onFolderDrop
}) => {
  return (
    <div className="maps-content">
      {categories.map((category) => {
        const folderNode = folderTree[category];
        const folderName = getFolderName(category);
        const indentLevel = folderNode?.level || 0;
        const hasChildren = folderNode?.children && folderNode.children.length > 0;
        const hasMaps = groupedMaps[category] && groupedMaps[category].length > 0;
        const isSelected = selectedFolder === category;
        const isExpanded = !collapsedCategories.has(category);

        return (
          <div 
            key={category} 
            className={`category-group ${dragOverCategory === category ? 'drag-over' : ''}`}
            style={{ marginLeft: `${indentLevel * 18}px` }}
          >
            <div 
              className={`category-header ${isSelected ? 'selected' : ''} ${dragOverCategory === category ? 'drag-over' : ''}`}
              draggable
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  // Ctrl/Cmd + Click for folder selection
                  onFolderSelect(category);
                } else {
                  // Regular click for expand/collapse
                  onToggleCategoryCollapse(category);
                }
              }}
              onContextMenu={(e) => onContextMenu(e, category, 'folder')}
              onDragStart={(e) => {
                e.stopPropagation();
                if (onFolderDragStart) {
                  onFolderDragStart(e, category);
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDragOver(e, category);
              }}
              onDragLeave={(e) => {
                e.stopPropagation();
                onDragLeave(e);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onFolderDrop) {
                  onFolderDrop(e, category);
                } else {
                  onDrop(e, category);
                }
              }}
            >
              <span className="category-expand-icon">
                {(hasChildren || hasMaps) ? (isExpanded ? '▼' : '▶') : ''}
              </span>
              <span className="category-folder-icon">
                {isExpanded ? '📂' : '📁'}
              </span>
              <span className="category-name">{folderName}</span>
              {hasMaps && (
                <span className="category-count">
                  ({groupedMaps[category]?.length || 0})
                </span>
              )}
            </div>
            
            {isExpanded && hasMaps && (
              <div className="category-maps">
                <MapItemList
                  maps={groupedMaps[category] || []}
                  categoryPath={category}
                  currentMapId={currentMapId}
                  editingMapId={editingMapId}
                  editingTitle={editingTitle}
                  onSelectMap={onSelectMap}
                  onFinishRename={onFinishRename}
                  onCancelRename={onCancelRename}
                  onEditingTitleChange={onEditingTitleChange}
                  onDragStart={onDragStart}
                  onContextMenu={onContextMenu}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CategoryGroup;