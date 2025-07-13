import type { MindMapData } from '@shared/types';

// Type definitions
interface MapHandlersReturn {
  handleSelectMap: (mapId: string) => Promise<void>;
  handleCreateMap: (providedName?: string | null, providedCategory?: string | null) => Promise<string | null>;
  handleDeleteMap: (mapId: string) => Promise<boolean>;
  handleRenameMap: (mapId: string, newTitle: string) => void;
  handleChangeCategory: (mapId: string, newCategory: string) => void;
  handleNavigateToMap: (mapId: string) => Promise<void>;
}

/**
 * マップ管理関連のハンドラーを管理するカスタムフック
 */
export const useMapHandlers = (
  allMindMaps: MindMapData[],
  switchToMap: (mapId: string) => Promise<void>,
  createMindMap: (name: string, category: string) => Promise<string>,
  deleteMindMapById: (mapId: string) => Promise<boolean>,
  renameMindMap: (mapId: string, newTitle: string) => void,
  changeMapCategory: (mapId: string, newCategory: string) => void
): MapHandlersReturn => {
  const handleSelectMap = async (mapId: string): Promise<void> => {
    try {
      await switchToMap(mapId);
    } catch (error) {
      console.error('マップ切り替えエラー:', error);
      // eslint-disable-next-line no-alert
      alert('マップの切り替えに失敗しました: ' + (error as Error).message);
    }
  };

  const handleCreateMap = async (providedName: string | null = null, providedCategory: string | null = null): Promise<string | null> => {
    let mapName = providedName;
    if (!mapName) {
      // eslint-disable-next-line no-alert
      mapName = prompt('新しいマインドマップの名前を入力してください:', '新しいマインドマップ');
    }
    
    if (mapName && mapName.trim()) {
      try {
        const category = providedCategory || '未分類';
        const mapId = await createMindMap(mapName.trim(), category);
        return mapId;
      } catch (error) {
        console.error('マップ作成エラー:', error);
        // eslint-disable-next-line no-alert
        alert('マップの作成に失敗しました: ' + (error as Error).message);
        return null;
      }
    }
    return null;
  };

  const handleDeleteMap = async (mapId: string): Promise<boolean> => {
    if (allMindMaps.length <= 1) {
      // eslint-disable-next-line no-alert
      alert('最後のマインドマップは削除できません');
      return false;
    }
    return await deleteMindMapById(mapId);
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
      // eslint-disable-next-line no-alert
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