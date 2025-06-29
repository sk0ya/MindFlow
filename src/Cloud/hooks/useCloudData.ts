import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

interface Node {
  id: string;
  text: string;
  x: number;
  y: number;
  children: Node[];
}

interface MindMapData {
  id: string;
  title: string;
  rootNode: Node;
  updatedAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://mindflow-api.shigekazukoya.workers.dev';

const generateId = () => Math.random().toString(36).substring(2, 15);

const createDefaultData = (): MindMapData => ({
  id: generateId(),
  title: 'クラウドマインドマップ',
  rootNode: {
    id: 'root',
    text: 'メイントピック',
    x: 400,
    y: 300,
    children: []
  },
  updatedAt: new Date().toISOString()
});

export const useCloudData = () => {
  const { authState, getAuthHeaders } = useAuth();
  const [data, setData] = useState<MindMapData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // マインドマップデータの取得
  const fetchMindMapData = useCallback(async () => {
    if (!authState.isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/mindmaps`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('データの取得に失敗しました');
      }

      const result = await response.json();
      
      if (result.mindmaps && result.mindmaps.length > 0) {
        // 最初のマインドマップを使用
        const mindmap = result.mindmaps[0];
        setData(mindmap);
      } else {
        // データがない場合はデフォルトデータを作成
        const defaultData = createDefaultData();
        await saveMindMapData(defaultData);
        setData(defaultData);
      }
      
      setLastSyncTime(new Date());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'データの取得に失敗しました';
      setError(errorMessage);
      console.error('Failed to fetch mindmap data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [authState.isAuthenticated, getAuthHeaders]);

  // マインドマップデータの保存
  const saveMindMapData = useCallback(async (mapData: MindMapData) => {
    if (!authState.isAuthenticated) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/mindmaps`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(mapData),
      });

      if (!response.ok) {
        throw new Error('データの保存に失敗しました');
      }

      setLastSyncTime(new Date());
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'データの保存に失敗しました';
      setError(errorMessage);
      console.error('Failed to save mindmap data:', error);
      return { success: false, error: errorMessage };
    }
  }, [authState.isAuthenticated, getAuthHeaders]);

  // マインドマップデータの更新
  const updateMindMapData = useCallback(async (mapData: MindMapData) => {
    if (!authState.isAuthenticated || !mapData.id) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/mindmaps/${mapData.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(mapData),
      });

      if (!response.ok) {
        throw new Error('データの更新に失敗しました');
      }

      setData(mapData);
      setLastSyncTime(new Date());
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'データの更新に失敗しました';
      setError(errorMessage);
      console.error('Failed to update mindmap data:', error);
      return { success: false, error: errorMessage };
    }
  }, [authState.isAuthenticated, getAuthHeaders]);

  // 認証状態が変わったらデータを取得
  useEffect(() => {
    if (authState.isAuthenticated && !data) {
      fetchMindMapData();
    } else if (!authState.isAuthenticated) {
      setData(null);
      setError(null);
    }
  }, [authState.isAuthenticated, data, fetchMindMapData]);

  // 自動保存（2秒ごと）
  useEffect(() => {
    if (!data || !authState.isAuthenticated) return;

    const interval = setInterval(() => {
      updateMindMapData(data);
    }, 2000);

    return () => clearInterval(interval);
  }, [data, authState.isAuthenticated, updateMindMapData]);

  return {
    data,
    setData,
    isLoading,
    error,
    lastSyncTime,
    fetchMindMapData,
    saveMindMapData,
    updateMindMapData
  };
};