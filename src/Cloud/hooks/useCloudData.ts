import { useState, useEffect } from 'react';
import type { MindMapData } from '../types';

interface CloudDataState {
  maps: MindMapData[];
  currentMapId: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useCloudData(isAuthenticated: boolean) {
  const [state, setState] = useState<CloudDataState>({
    maps: [],
    currentMapId: null,
    isLoading: false,
    error: null
  });

  // ログイン後のデータ同期
  useEffect(() => {
    if (isAuthenticated) {
      syncData();
    } else {
      // ログアウト時にデータをクリア
      setState({
        maps: [],
        currentMapId: null,
        isLoading: false,
        error: null
      });
    }
  }, [isAuthenticated]);

  const syncData = async (): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const token = sessionStorage.getItem('auth_token');
      if (!token) {
        throw new Error('認証トークンがありません');
      }

      const response = await fetch('https://mindflow-api.shigekazukoya.workers.dev/api/maps', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`データ取得に失敗しました: ${response.status}`);
      }

      const result = await response.json();
      const maps: MindMapData[] = result.maps || [];
      
      setState(prev => ({
        ...prev,
        maps,
        currentMapId: maps.length > 0 ? maps[0].id : null,
        isLoading: false,
        error: null
      }));

      console.log('✅ Cloud data synced:', { mapCount: maps.length });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'データ同期に失敗しました'
      }));
      console.error('❌ Cloud data sync failed:', error);
    }
  };

  const createNewMap = async (title: string = '新しいマインドマップ'): Promise<string | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const token = sessionStorage.getItem('auth_token');
      if (!token) {
        throw new Error('認証トークンがありません');
      }

      const newMap: Partial<MindMapData> = {
        title,
        rootNode: {
          id: 'root',
          text: title,
          x: 400,
          y: 300,
          children: []
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const response = await fetch('https://mindflow-api.shigekazukoya.workers.dev/api/maps', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newMap)
      });

      if (!response.ok) {
        throw new Error(`マップ作成に失敗しました: ${response.status}`);
      }

      const result = await response.json();
      const createdMap = result.map;

      setState(prev => ({
        ...prev,
        maps: [...prev.maps, createdMap],
        currentMapId: createdMap.id,
        isLoading: false,
        error: null
      }));

      console.log('✅ New map created:', createdMap.id);
      return createdMap.id;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'マップ作成に失敗しました'
      }));
      console.error('❌ Map creation failed:', error);
      return null;
    }
  };

  const switchMap = (mapId: string): void => {
    setState(prev => ({
      ...prev,
      currentMapId: mapId
    }));
  };

  const getCurrentMap = (): MindMapData | null => {
    if (!state.currentMapId) return null;
    return state.maps.find(map => map.id === state.currentMapId) || null;
  };

  return {
    ...state,
    syncData,
    createNewMap,
    switchMap,
    getCurrentMap
  };
}