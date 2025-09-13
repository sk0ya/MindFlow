import React from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import MapItemList from './MapItemList';
import type { MindMapData } from '@shared/types';
import { getFolderName } from '../../../../shared/utils/folderUtils';
import { highlightSearchTerm } from '../../../../shared/utils/highlightUtils';

interface CategoryGroupProps {
  categories: string[];
  groupedMaps: { [category: string]: MindMapData[] };
  collapsedCategories: Set<string>;
  selectedFolder: string | null;
  currentMapId: string | null;
  editingMapId: string | null;
  editingTitle: string;
  dragOverCategory: string | null;
  searchTerm: string;
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
  selectedFolder,
  currentMapId,
  editingMapId,
  editingTitle,
  dragOverCategory,
  searchTerm,
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
        const folderName = getFolderName(category);
        const indentLevel = category.split('/').length - 1;
        const hasChildren = categories.some(cat => cat.startsWith(category + '/') && cat.split('/').length === category.split('/').length + 1);
        const hasMaps = groupedMaps[category] && groupedMaps[category].length > 0;
        const isSelected = selectedFolder === category;
        const isExpanded = !collapsedCategories.has(category);
        
        // 空のcategory（未分類）の場合は、フォルダヘッダーなしでマップを直接表示
        if (category === '' && hasMaps) {
          return (
            <div key="uncategorized-maps" className="uncategorized-maps">
              <MapItemList
                maps={groupedMaps[category] || []}
                categoryPath={category}
                currentMapId={currentMapId}
                editingMapId={editingMapId}
                editingTitle={editingTitle}
                searchTerm={searchTerm}
                onSelectMap={onSelectMap}
                onFinishRename={onFinishRename}
                onCancelRename={onCancelRename}
                onEditingTitleChange={onEditingTitleChange}
                onDragStart={onDragStart}
                onContextMenu={onContextMenu}
              />
            </div>
          );
        }

        // 空のcategoryでマップがない場合は何も表示しない
        if (category === '' && !hasMaps) {
          return null;
        }
        
        // 祖先フォルダのいずれかが非表示の場合は表示しない（再帰チェック）
        const pathSegments = category.split('/');
        if (pathSegments.length > 1) {
          // 全ての祖先パス（ルートから直接の親まで）をチェック
          for (let i = 1; i < pathSegments.length; i++) {
            const ancestorPath = pathSegments.slice(0, i).join('/');
            
            // 祖先パス自体が存在しない、または祖先パスが折りたたまれている場合は非表示
            if (!categories.includes(ancestorPath) || collapsedCategories.has(ancestorPath)) {
              return null;
            }
          }
        }

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
                {(hasChildren || hasMaps) ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : ''}
              </span>
              <span className="category-folder-icon">
                {isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
              </span>
              <span className="category-name">{highlightSearchTerm(folderName, searchTerm)}</span>
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
                  searchTerm={searchTerm}
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