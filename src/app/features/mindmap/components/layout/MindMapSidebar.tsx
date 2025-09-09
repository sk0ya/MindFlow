import React, { useState, useCallback, useMemo, memo } from 'react';
import SidebarHeader from './SidebarHeader';
import CategoryGroup from './CategoryGroup';
import SidebarCollapsed from './SidebarCollapsed';
import SidebarStyles from './SidebarStyles';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
import type { MindMapData } from '@shared/types';
import { createChildFolderPath } from '../../../../shared/utils/folderUtils';
import { logger } from '../../../../shared/utils/logger';
import { useDragAndDrop } from '../../../../shared/hooks/useDragAndDrop';

interface MindMapSidebarProps {
  mindMaps: MindMapData[];
  currentMapId: string | null;
  onSelectMap: (mapId: string) => void;
  onCreateMap: (title: string, category?: string) => void;
  onDeleteMap: (mapId: string) => void;
  onRenameMap: (mapId: string, newTitle: string) => void;
  onChangeCategory: (mapId: string, category: string) => void;
  onChangeCategoryBulk?: (mapUpdates: Array<{id: string, category: string}>) => Promise<void>;
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
  onChangeCategoryBulk,
  isCollapsed,
  onToggleCollapse 
}) => {
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState(new Set<string>());
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [emptyFolders, setEmptyFolders] = useState<Set<string>>(new Set());
  
  // Drag & Drop フック
  const {
    draggedMap,
    draggedFolder,
    dragOverCategory,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFolderDragStart,
    handleFolderDrop,
    handleRootDrop
  } = useDragAndDrop({
    mindMaps,
    onChangeCategory,
    onChangeCategoryBulk,
    setEmptyFolders,
    setCollapsedCategories
  });
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean;
    position: { x: number; y: number };
    targetPath: string | null;
    targetType: 'folder' | 'empty' | 'map' | null;
    mapData?: MindMapData | null;
  }>({
    isVisible: false,
    position: { x: 0, y: 0 },
    targetPath: null,
    targetType: null,
    mapData: null
  });

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




  // フォルダ選択ハンドラー
  const handleFolderSelect = useCallback((folderPath: string) => {
    setSelectedFolder(prev => prev === folderPath ? null : folderPath);
  }, []);

  // コンテキストメニューハンドラー
  const handleContextMenu = useCallback((e: React.MouseEvent, targetPath: string | null, targetType: 'folder' | 'empty' | 'map', mapData?: MindMapData) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      isVisible: true,
      position: { x: e.clientX, y: e.clientY },
      targetPath,
      targetType,
      mapData: mapData || null
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({
      isVisible: false,
      position: { x: 0, y: 0 },
      targetPath: null,
      targetType: null,
      mapData: null
    });
  }, []);

  const handleCreateFolder = useCallback((parentPath: string | null) => {
    const parentInfo = parentPath ? ` (${parentPath} の下)` : '';
    // eslint-disable-next-line no-alert
    const newFolderName = window.prompt(`新しいフォルダ名を入力してください${parentInfo}:`, '');
    if (newFolderName && newFolderName.trim()) {
      const newFolderPath = createChildFolderPath(parentPath, newFolderName.trim());
      
      // フォルダのみを作成し、ダミーマップは作成しない
      // フォルダ状態を管理するために、空フォルダのリストを管理
      setEmptyFolders(prev => new Set([...prev, newFolderPath]));
      
      // 新しく作成したフォルダを展開状態にする
      setCollapsedCategories(prev => {
        const newSet = new Set(prev);
        newSet.delete(newFolderPath); // 展開状態にする
        return newSet;
      });
    }
  }, []);

  const handleCreateMap = useCallback((parentPath: string | null) => {
    const parentInfo = parentPath ? ` (${parentPath} 内)` : '';
    // eslint-disable-next-line no-alert
    const mapName = window.prompt(`新しいマインドマップの名前を入力してください${parentInfo}:`, '新しいマインドマップ');
    if (mapName && mapName.trim()) {
      onCreateMap(mapName.trim(), parentPath || undefined);
      
      // マップが作成されたフォルダを空フォルダリストから削除
      if (parentPath) {
        setEmptyFolders(prev => {
          const newSet = new Set(prev);
          newSet.delete(parentPath);
          return newSet;
        });
      }
    }
  }, [onCreateMap, setEmptyFolders]);

  // 新しいボタン用のハンドラー
  const handleAddMap = useCallback(() => {
    handleCreateMap(null);
  }, [handleCreateMap]);

  const handleAddFolder = useCallback(() => {
    handleCreateFolder(null);
  }, [handleCreateFolder]);

  const handleExpandAll = useCallback(() => {
    setCollapsedCategories(new Set());
  }, []);

  const handleCollapseAll = useCallback(() => {
    // すべてのカテゴリを取得してから折りたたみ状態にする
    const allFolders = new Set([...Object.keys(mindMaps.reduce((groups: { [key: string]: any[] }, map) => {
      const category = map.category || '';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(map);
      return groups;
    }, {})), ...Array.from(emptyFolders)]);
    
    setCollapsedCategories(allFolders);
  }, [mindMaps, emptyFolders]);

  // フォルダの削除ハンドラー
  const handleDeleteFolder = useCallback((folderPath: string) => {
    // そのフォルダに属するマップをチェック
    const mapsInFolder = mindMaps.filter(map => map.category === folderPath);
    
    // そのフォルダの子フォルダに属するマップもチェック
    const mapsInSubfolders = mindMaps.filter(map => 
      map.category && map.category.startsWith(folderPath + '/')
    );
    
    const totalMaps = mapsInFolder.length + mapsInSubfolders.length;
    
    if (totalMaps > 0) {
      // マップが含まれている場合は削除を拒否
      // eslint-disable-next-line no-alert
      alert(`「${folderPath}」またはその子フォルダにマップが含まれているため削除できません。先にマップを移動または削除してください。`);
      return;
    }
    
    // 空のフォルダの場合
    // eslint-disable-next-line no-alert
    if (window.confirm(`空のフォルダ「${folderPath}」を削除しますか？`)) {
      // 空フォルダリストから削除
      setEmptyFolders(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderPath);
        // 子フォルダも削除
        Array.from(prev).forEach(folder => {
          if (folder.startsWith(folderPath + '/')) {
            newSet.delete(folder);
          }
        });
        return newSet;
      });
      
      // 折りたたみ状態からも削除
      setCollapsedCategories(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderPath);
        return newSet;
      });
      
      logger.info(`空のフォルダ「${folderPath}」を削除しました`);
    }
  }, [mindMaps, setEmptyFolders]);

  // フォルダのリネームハンドラー
  const handleRenameFolder = useCallback((oldPath: string) => {
    const currentName = oldPath.split('/').pop() || oldPath;
    // eslint-disable-next-line no-alert
    const newName = window.prompt(`フォルダ名を変更:`, currentName);
    
    if (newName && newName.trim() && newName.trim() !== currentName) {
      const pathParts = oldPath.split('/');
      pathParts[pathParts.length - 1] = newName.trim();
      const newPath = pathParts.join('/');
      
      // そのフォルダ内のすべてのマップのカテゴリを更新
      const mapsToUpdate = mindMaps.filter(map => 
        map.category === oldPath || (map.category && map.category.startsWith(oldPath + '/'))
      );
      
      mapsToUpdate.forEach(map => {
        const updatedCategory = map.category?.replace(oldPath, newPath);
        if (updatedCategory) {
          onChangeCategory(map.id, updatedCategory);
        }
      });
      
      // 空フォルダの場合もパス更新
      setEmptyFolders(prev => {
        const newSet = new Set<string>();
        Array.from(prev).forEach(folder => {
          if (folder === oldPath) {
            newSet.add(newPath);
          } else if (folder.startsWith(oldPath + '/')) {
            newSet.add(folder.replace(oldPath, newPath));
          } else {
            newSet.add(folder);
          }
        });
        return newSet;
      });
    }
  }, [mindMaps, onChangeCategory, setEmptyFolders]);

  // フィルタリングとグループ化（階層フォルダ対応）
  const { filteredMaps, groupedMaps, visibleFolders } = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    
    // マップのタイトルまたはカテゴリ名で検索
    const filtered = mindMaps.filter(map => {
      const titleMatch = map.title.toLowerCase().includes(searchLower);
      const categoryMatch = map.category && map.category.toLowerCase().includes(searchLower);
      return titleMatch || categoryMatch;
    });

    const grouped = filtered.reduce((groups: { [key: string]: MindMapData[] }, map) => {
      const category = map.category || '';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(map);
      return groups;
    }, {});

    // 各カテゴリ内のマップを50音順でソート
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => {
        return a.title.localeCompare(b.title, 'ja', {
          numeric: true,
          sensitivity: 'base'
        });
      });
    });

    // 検索時のフォルダフィルタリング
    let foldersToShow = new Set<string>();
    
    if (searchTerm) {
      // 検索がある場合：マップが含まれるフォルダ + 検索にヒットするフォルダ名 + その親フォルダも含める
      Object.keys(grouped).forEach(category => {
        // マップが含まれるフォルダを追加
        foldersToShow.add(category);
        
        // 親フォルダも追加（階層構造を維持するため）
        const parts = category.split('/');
        for (let i = 1; i < parts.length; i++) {
          const parentPath = parts.slice(0, i).join('/');
          foldersToShow.add(parentPath);
        }
      });
      
      // フォルダ名が検索条件にマッチするフォルダも追加
      Array.from(emptyFolders).forEach(folder => {
        if (folder.toLowerCase().includes(searchLower)) {
          foldersToShow.add(folder);
          
          // その親フォルダも追加
          const parts = folder.split('/');
          for (let i = 1; i < parts.length; i++) {
            const parentPath = parts.slice(0, i).join('/');
            foldersToShow.add(parentPath);
          }
        }
      });
    } else {
      // 検索がない場合：すべてのフォルダを表示
      foldersToShow = new Set([...Object.keys(grouped), ...Array.from(emptyFolders)]);
    }
    
    // 階層構造を保持したソート
    const sortedFolders = Array.from(foldersToShow).sort((a, b) => {
      // パスを分割
      const partsA = a.split('/');
      const partsB = b.split('/');
      
      // 共通の親パスを見つけるまで比較
      const minLength = Math.min(partsA.length, partsB.length);
      for (let i = 0; i < minLength; i++) {
        const comparison = partsA[i].localeCompare(partsB[i], 'ja', { 
          numeric: true, 
          sensitivity: 'base' 
        });
        if (comparison !== 0) return comparison;
      }
      
      // 共通部分が同じ場合、階層の深い方を後に
      return partsA.length - partsB.length;
    });

    return { 
      filteredMaps: filtered, 
      groupedMaps: grouped, 
      visibleFolders: sortedFolders
    };
  }, [mindMaps, searchTerm, emptyFolders]);

  // コンテキストメニューのアイテムを生成
  const contextMenuItems = useMemo((): ContextMenuItem[] => {
    const { targetPath, targetType, mapData } = contextMenu;
    
    if (targetType === 'folder') {
      const mapsInFolder = targetPath ? mindMaps.filter(map => map.category === targetPath) : [];
      const mapsInSubfolders = targetPath ? mindMaps.filter(map => 
        map.category && map.category.startsWith(targetPath + '/')
      ) : [];
      
      const totalMaps = mapsInFolder.length + mapsInSubfolders.length;
      
      // フォルダ削除可能かどうかの判定（空フォルダのみ削除可能）
      const canDelete = totalMaps === 0;
      
      return [
        {
          label: 'マップを作成',
          icon: '🗺️',
          onClick: () => handleCreateMap(targetPath)
        },
        {
          label: 'フォルダを作成',
          icon: '📁',
          onClick: () => handleCreateFolder(targetPath)
        },
        { separator: true },
        {
          label: 'フォルダを展開',
          icon: '📂',
          onClick: () => {
            if (targetPath) {
              toggleCategoryCollapse(targetPath);
            }
          }
        },
        { separator: true },
        {
          label: 'フォルダ名を変更',
          icon: '✏️',
          onClick: () => {
            if (targetPath) {
              handleRenameFolder(targetPath);
            }
          }
        },
        {
          label: 'フォルダを削除',
          icon: '🗑️',
          disabled: !canDelete,
          onClick: () => {
            if (targetPath) {
              handleDeleteFolder(targetPath);
            }
          }
        }
      ];
    } else if (targetType === 'map' && mapData) {
      const mapCategory = mapData.category || '';
      return [
        {
          label: '同じフォルダにマップを作成',
          icon: '🗺️',
          onClick: () => handleCreateMap(mapCategory)
        },
        { separator: true },
        {
          label: 'マップを開く',
          icon: '📖',
          onClick: () => onSelectMap(mapData.id)
        },
        {
          label: '名前を変更',
          icon: '✏️',
          onClick: () => handleStartRename(mapData.id, mapData.title)
        },
        {
          label: 'マップを削除',
          icon: '🗑️',
          onClick: () => {
            // eslint-disable-next-line no-alert
            if (window.confirm(`「${mapData.title}」を削除しますか？`)) {
              onDeleteMap(mapData.id);
            }
          }
        }
      ];
    } else if (targetType === 'empty') {
      return [
        {
          label: 'マップを作成',
          icon: '🗺️',
          onClick: () => handleCreateMap(null)
        },
        {
          label: 'フォルダを作成',
          icon: '📁',
          onClick: () => handleCreateFolder(null)
        }
      ];
    }
    
    return [];
  }, [contextMenu, handleCreateMap, handleCreateFolder, toggleCategoryCollapse, onSelectMap, onDeleteMap, handleStartRename, handleRenameFolder, handleDeleteFolder, mindMaps]);

  // 折りたたみ状態の場合
  if (isCollapsed) {
    return (
      <>
        <SidebarCollapsed 
          onToggleCollapse={onToggleCollapse}
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
        onToggleCollapse={onToggleCollapse}
        onAddMap={handleAddMap}
        onAddFolder={handleAddFolder}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
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
        <div 
          className={`maps-content-wrapper ${dragOverCategory === '__root__' ? 'drag-over-root' : ''}`}
          onContextMenu={(e) => handleContextMenu(e, null, 'empty')}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (draggedFolder || draggedMap) {
              handleDragOver(e, '__root__');
            }
          }}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleRootDrop(e)}
        >
          <CategoryGroup
            categories={visibleFolders}
            groupedMaps={groupedMaps}
            collapsedCategories={collapsedCategories}
            selectedFolder={selectedFolder}
            currentMapId={currentMapId}
            editingMapId={editingMapId}
            editingTitle={editingTitle}
            dragOverCategory={dragOverCategory}
            searchTerm={searchTerm}
            onToggleCategoryCollapse={toggleCategoryCollapse}
            onFolderSelect={handleFolderSelect}
            onContextMenu={handleContextMenu}
            onSelectMap={onSelectMap}
            onFinishRename={handleFinishRename}
            onCancelRename={handleCancelRename}
            onEditingTitleChange={setEditingTitle}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFolderDragStart={handleFolderDragStart}
            onFolderDrop={handleFolderDrop}
          />
        </div>
      )}

      <ContextMenu
        isVisible={contextMenu.isVisible}
        position={contextMenu.position}
        items={contextMenuItems}
        onClose={closeContextMenu}
      />

      <SidebarStyles />
    </div>
  );
};

export default memo(MindMapSidebar);