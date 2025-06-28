import { MapHandlerParams, MapHandlers } from './handlerTypes';

/**
 * マップ管理関連のハンドラーを管理するカスタムフック
 */
export const useMapHandlers = ({
  allMindMaps,
  switchToMap,
  createMindMap,
  deleteMindMapById,
  renameMindMap,
  changeMapCategory
}: MapHandlerParams): MapHandlers => {
  const handleSelectMap = async (mapId: string): Promise<void> => {
    try {
      await switchToMap(mapId);
    } catch (error) {
      console.error('マップ切り替えエラー:', error);
      alert('マップの切り替えに失敗しました: ' + (error as Error).message);
    }
  };

  const handleCreateMap = async (providedName: string | null = null, providedCategory: string | null = null): Promise<string | null> => {
    let mapName = providedName;
    if (!mapName) {
      mapName = prompt('新しいマインドマップの名前を入力してください:', '新しいマインドマップ') || '';
    }
    
    if (mapName && mapName.trim()) {
      try {
        const category = providedCategory || '未分類';
        const mapId = await createMindMap(mapName.trim(), category);
        return mapId;
      } catch (error) {
        console.error('マップ作成エラー:', error);
        alert('マップの作成に失敗しました: ' + (error as Error).message);
        return null;
      }
    }
    return null;
  };

  const handleDeleteMap = (mapId: string): boolean => {
    if (allMindMaps.length <= 1) {
      alert('最後のマインドマップは削除できません');
      return false;
    }
    return deleteMindMapById(mapId);
  };

  const handleRenameMap = (mapId: string, newTitle: string): void => {
    renameMindMap(mapId, newTitle);
  };

  const handleChangeCategory = (mapId: string, newCategory: string): void => {
    changeMapCategory(mapId, newCategory);
  };

  const handleNavigateToMap = async (mapId: string): Promise<void> => {
    try {
      await switchToMap(mapId);
    } catch (error) {
      console.error('マップナビゲーションエラー:', error);
      alert('マップの切り替えに失敗しました: ' + (error as Error).message);
    }
  };

  return {
    handleSelectMap,
    handleCreateMap,
    handleDeleteMap,
    handleRenameMap,
    handleChangeCategory,
    handleNavigateToMap
  };
};