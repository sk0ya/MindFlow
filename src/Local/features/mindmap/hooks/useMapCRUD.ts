import { useState } from 'react';
import { getAllMindMapsWithFullData, deleteMindMap, updateMindMap as saveMindMap, storageManager, getMindMap } from '../../../core/storage/LocalEngine';
import { createInitialData, MindMapData } from '../../../shared/types/dataTypes';
import { debug, error } from '../../../shared/utils/logger';

export const useMapCRUD = () => {
  const [allMindMaps, setAllMindMaps] = useState<MindMapData[]>([]);

  // マップ一覧の更新
  const refreshAllMindMaps = async () => {
    try {
      debug('マップ一覧取得開始');
      
      const maps = await getAllMindMapsWithFullData();
      
      // データ整合性チェック
      const validMaps = maps.filter(map => map && map.id) as MindMapData[];
      setAllMindMaps(validMaps);
      console.log('✅ マップ一覧取得完了:', validMaps.length, '件');
      
    } catch (err: unknown) {
      error('マップ一覧取得失敗', { error: err });
      setAllMindMaps([]);
    }
  };

  // 新規マップ作成
  const createMindMap = async (title = '新しいマインドマップ', category = '未分類') => {
    try {
      const newMap = createInitialData();
      newMap.title = title;
      newMap.category = category;
      
      // メイントピックをマップ名に基づいて設定
      if (newMap.rootNode) {
        newMap.rootNode.text = title;
      }
      
      const result = await storageManager.createMap(newMap);
      
      if (!result.success) {
        throw new Error(result.error || 'マップ作成に失敗しました');
      }
      
      // マップ一覧を更新
      await refreshAllMindMaps();
      
      return result.data?.id || newMap.id;
      
    } catch (error) {
      console.error('❌ マップ作成失敗:', error);
      throw error;
    }
  };

  // マップ名変更
  const renameMindMap = async (mapId: string, newTitle: string) => {
    try {
      console.log('✏️ マップ名変更:', mapId, '->', newTitle);
      
      // 完全なマップデータを取得（rootNodeを含む）
      const fullMapData = await getMindMap(mapId);
      
      if (!fullMapData) {
        throw new Error('マップが見つかりません');
      }
      
      // タイトルとタイムスタンプのみ更新
      const updatedMap = { 
        ...fullMapData, 
        title: newTitle, 
        updatedAt: new Date().toISOString() 
      };
      
      // ローカルストレージに保存
      await storageManager.updateMindMap(mapId, updatedMap);
      console.log('✅ マップタイトル更新完了:', newTitle);
      
      // マップ一覧を更新
      await refreshAllMindMaps();
      
    } catch (error) {
      console.error('❌ マップ名変更失敗:', error);
      throw error;
    }
  };

  // マップ削除
  const deleteMindMapById = async (mapId: string) => {
    if (allMindMaps.length <= 1) {
      console.warn('最後のマインドマップは削除できません');
      return false;
    }
    
    try {
      // ローカルストレージから削除
      const success = await deleteMindMap(mapId);
      if (!success) {
        throw new Error('マップ削除に失敗しました');
      }
      
      // マップ一覧を更新
      await refreshAllMindMaps();
      
      return true;
      
    } catch (error) {
      console.error('❌ マップ削除失敗:', error);
      throw error;
    }
  };

  // カテゴリー変更
  const changeMapCategory = async (mapId: string, newCategory: string) => {
    try {
      // 完全なマップデータを取得（rootNodeを含む）
      const fullMapData = await getMindMap(mapId);
      
      if (!fullMapData) {
        throw new Error('マップが見つかりません');
      }
      
      // カテゴリーとタイムスタンプのみ更新
      const updatedMap = { 
        ...fullMapData, 
        category: newCategory, 
        updatedAt: new Date().toISOString() 
      };
      
      // ストレージに保存
      await saveMindMap(updatedMap.id, updatedMap);
      await refreshAllMindMaps();
      
    } catch (error) {
      console.error('❌ カテゴリー変更失敗:', error);
    }
  };

  // 利用可能なカテゴリー取得
  const getAvailableCategories = () => {
    const categories = new Set(['未分類']);
    allMindMaps.forEach((map: MindMapData) => {
      if (map.category && map.category.trim()) {
        categories.add(map.category);
      }
    });
    return Array.from(categories).sort();
  };

  return {
    allMindMaps,
    setAllMindMaps,
    refreshAllMindMaps,
    createMindMap,
    renameMindMap,
    deleteMindMapById,
    changeMapCategory,
    getAvailableCategories
  };
};