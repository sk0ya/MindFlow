import React, { useState, useCallback, useMemo, memo } from 'react';
import SidebarHeader from './SidebarHeader';
import CategoryGroup from './CategoryGroup';
import SidebarCollapsed from './SidebarCollapsed';
import SidebarStyles from './SidebarStyles';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
import type { MindMapData } from '@shared/types';
import { buildFolderTree, getVisibleFolders, createChildFolderPath } from '../../../../shared/utils/folderUtils';

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
  const [draggedMap, setDraggedMap] = useState<MindMapData | null>(null);
  const [draggedFolder, setDraggedFolder] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [emptyFolders, setEmptyFolders] = useState<Set<string>>(new Set());
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

  // ドラッグ&ドロップハンドラー
  const handleDragStart = useCallback((e: React.DragEvent, map: MindMapData) => {
    setDraggedMap(map);
    setDraggedFolder(null); // フォルダドラッグをクリア
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/map-id', map.id);
    console.log('Map drag started:', map.title, 'category:', map.category);
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
    console.log('Drop event triggered', { category, draggedMap, draggedFolder });
    
    // マップのドロップ処理
    if (draggedMap && draggedMap.category !== category) {
      console.log('Moving map from', draggedMap.category, 'to', category);
      onChangeCategory(draggedMap.id, category);
    }
    
    setDraggedMap(null);
    setDraggedFolder(null);
    setDragOverCategory(null);
  }, [draggedMap, draggedFolder, onChangeCategory]);

  // フォルダドラッグ&ドロップハンドラー
  const handleFolderDragStart = useCallback((e: React.DragEvent, folderPath: string) => {
    setDraggedFolder(folderPath);
    setDraggedMap(null); // マップドラッグをクリア
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/folder-path', folderPath);
    console.log('Folder drag started:', folderPath);
  }, []);

  const handleFolderDrop = useCallback(async (e: React.DragEvent, targetFolderPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Folder drop event triggered', { targetFolderPath, draggedFolder, draggedMap });

    // マップをフォルダにドロップする場合
    if (draggedMap && draggedMap.category !== targetFolderPath) {
      console.log('Moving map from', draggedMap.category, 'to folder', targetFolderPath);
      onChangeCategory(draggedMap.id, targetFolderPath);
      setDraggedMap(null);
      setDraggedFolder(null);
      setDragOverCategory(null);
      return;
    }

    // フォルダをフォルダにドロップする場合
    if (!draggedFolder || draggedFolder === targetFolderPath) {
      setDraggedFolder(null);
      setDragOverCategory(null);
      return;
    }

    // 循環参照をチェック（親フォルダを子フォルダに移動しようとする場合）
    if (targetFolderPath.startsWith(draggedFolder + '/')) {
      alert('フォルダを自分の子フォルダに移動することはできません。');
      setDraggedFolder(null);
      setDragOverCategory(null);
      return;
    }

    // フォルダのリネーム（移動）
    const draggedFolderName = draggedFolder.split('/').pop();
    const newFolderPath = targetFolderPath + '/' + draggedFolderName;

    console.log('Moving folder from', draggedFolder, 'to', newFolderPath);

    // そのフォルダ内のすべてのマップのカテゴリを更新
    const mapsToUpdate = mindMaps.filter(map => 
      map.category === draggedFolder || (map.category && map.category.startsWith(draggedFolder + '/'))
    );

    console.log('Maps to update:', mapsToUpdate.map(m => ({id: m.id, title: m.title, category: m.category})));
    console.log('Drag operation:', { draggedFolder, newFolderPath });

    // 一括更新を使用
    if (onChangeCategoryBulk && mapsToUpdate.length > 0) {
      const mapUpdates = mapsToUpdate.map(map => ({
        id: map.id,
        category: map.category?.replace(draggedFolder, newFolderPath) || newFolderPath
      })).filter(update => update.category !== undefined);
      
      console.log('Bulk updating maps:', mapUpdates);
      await onChangeCategoryBulk(mapUpdates);
    } else {
      // フォールバック: 個別更新
      mapsToUpdate.forEach(map => {
        const updatedCategory = map.category?.replace(draggedFolder, newFolderPath);
        if (updatedCategory) {
          console.log(`Updating map "${map.title}" from "${map.category}" to "${updatedCategory}"`);
          onChangeCategory(map.id, updatedCategory);
        }
      });
    }

    // 空フォルダの場合もパス更新
    setEmptyFolders(prev => {
      const newSet = new Set<string>();
      Array.from(prev).forEach(folder => {
        if (folder === draggedFolder) {
          newSet.add(newFolderPath);
        } else if (folder.startsWith(draggedFolder + '/')) {
          newSet.add(folder.replace(draggedFolder, newFolderPath));
        } else {
          newSet.add(folder);
        }
      });
      return newSet;
    });

    // 新しい場所のフォルダを展開
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      newSet.delete(targetFolderPath);
      newSet.delete(newFolderPath);
      return newSet;
    });

    setDraggedFolder(null);
    setDragOverCategory(null);
  }, [draggedFolder, draggedMap, mindMaps, onChangeCategory, onChangeCategoryBulk, setEmptyFolders]);

  // ルートエリアへのドロップハンドラー
  const handleRootDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Root drop event triggered', { draggedFolder, draggedMap });

    // マップをルートレベルに移動
    if (draggedMap && draggedMap.category !== '未分類') {
      console.log('Moving map to root level');
      onChangeCategory(draggedMap.id, '未分類');
      setDraggedMap(null);
      setDraggedFolder(null);
      setDragOverCategory(null);
      return;
    }

    // フォルダをルートレベルに移動
    if (draggedFolder) {
      const draggedFolderName = draggedFolder.split('/').pop();
      if (!draggedFolderName) return;

      // 既にルートレベルの場合は何もしない
      if (!draggedFolder.includes('/')) {
        setDraggedFolder(null);
        setDragOverCategory(null);
        return;
      }

      console.log('Moving folder to root level:', draggedFolderName);

      // そのフォルダ内のすべてのマップとサブフォルダのカテゴリを更新
      const mapsToUpdate = mindMaps.filter(map => 
        map.category === draggedFolder || (map.category && map.category.startsWith(draggedFolder + '/'))
      );

      console.log('Root drop - Maps to update:', mapsToUpdate.map(m => ({id: m.id, title: m.title, category: m.category})));
      console.log('Root drop operation:', { draggedFolder, draggedFolderName });

      // 一括更新を使用
      if (onChangeCategoryBulk && mapsToUpdate.length > 0) {
        const mapUpdates = mapsToUpdate.map(map => ({
          id: map.id,
          category: map.category?.replace(draggedFolder, draggedFolderName) || draggedFolderName
        })).filter(update => update.category !== undefined);
        
        console.log('Root drop - Bulk updating maps:', mapUpdates);
        await onChangeCategoryBulk(mapUpdates);
      } else {
        // フォールバック: 個別更新
        mapsToUpdate.forEach(map => {
          let updatedCategory = map.category?.replace(draggedFolder, draggedFolderName);
          if (updatedCategory) {
            console.log(`Root drop - Updating map "${map.title}" from "${map.category}" to "${updatedCategory}"`);
            onChangeCategory(map.id, updatedCategory);
          }
        });
      }

      // 空フォルダの場合もパス更新
      setEmptyFolders(prev => {
        const newSet = new Set<string>();
        Array.from(prev).forEach(folder => {
          if (folder === draggedFolder) {
            newSet.add(draggedFolderName);
          } else if (folder.startsWith(draggedFolder + '/')) {
            newSet.add(folder.replace(draggedFolder, draggedFolderName));
          } else {
            newSet.add(folder);
          }
        });
        return newSet;
      });

      // 新しいルートフォルダを展開状態にする
      setCollapsedCategories(prev => {
        const newSet = new Set(prev);
        newSet.delete(draggedFolderName);
        return newSet;
      });

      setDraggedFolder(null);
      setDragOverCategory(null);
    }
  }, [draggedFolder, draggedMap, mindMaps, onChangeCategory, onChangeCategoryBulk, setEmptyFolders]);

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
      
      console.log(`空のフォルダ「${folderPath}」を削除しました`);
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
  const { filteredMaps, groupedMaps, folderTree, visibleFolders } = useMemo(() => {
    const filtered = mindMaps.filter(map =>
      map.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const grouped = filtered.reduce((groups: { [key: string]: MindMapData[] }, map) => {
      const category = map.category || '未分類';
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

    // 展開状態を反転させてfolderTreeに渡す（collapsedCategoriesは閉じているもの、folderTreeは開いているものを管理）
    const expandedFolders = new Set<string>();
    Object.keys(grouped).forEach(category => {
      if (!collapsedCategories.has(category)) {
        expandedFolders.add(category);
      }
    });

    // マップがあるフォルダと空フォルダを統合
    const allFolders = new Set([...Object.keys(grouped), ...Array.from(emptyFolders)]);
    
    // フォルダツリーを構築
    const tree = buildFolderTree(Array.from(allFolders), expandedFolders);
    const visible = getVisibleFolders(tree);

    return { 
      filteredMaps: filtered, 
      groupedMaps: grouped, 
      folderTree: tree,
      visibleFolders: visible
    };
  }, [mindMaps, searchTerm, collapsedCategories, emptyFolders]);

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
      const mapCategory = mapData.category || '未分類';
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
              setDragOverCategory('__root__');
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDragOverCategory(null);
            }
          }}
          onDrop={(e) => handleRootDrop(e)}
        >
          <CategoryGroup
            categories={visibleFolders}
            groupedMaps={groupedMaps}
            collapsedCategories={collapsedCategories}
            folderTree={folderTree}
            selectedFolder={selectedFolder}
            currentMapId={currentMapId}
            editingMapId={editingMapId}
            editingTitle={editingTitle}
            dragOverCategory={dragOverCategory}
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