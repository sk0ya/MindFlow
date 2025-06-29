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
  const fetchMindMapData = useCallback(async (createIfNotExists = true) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('📋 fetchMindMapData開始:', { isAuthenticated: authState.isAuthenticated });
    }
    
    if (!authState.isAuthenticated) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⏭️ 未認証のためデータ取得スキップ');
      }
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 データ取得開始');
    }
    setIsLoading(true);
    setError(null);

    try {
      const headers = getAuthHeaders();
      if (process.env.NODE_ENV === 'development') {
        console.log('📡 API Request:', { 
          url: `${API_BASE_URL}/api/mindmaps`,
          headers: { ...headers, Authorization: headers.Authorization?.substring(0, 20) + '...' }
        });
      }
      
      const response = await fetch(`${API_BASE_URL}/api/mindmaps`, {
        method: 'GET',
        headers: headers,
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('📋 API Response:', { 
          status: response.status, 
          ok: response.ok,
          statusText: response.statusText 
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error('データの取得に失敗しました');
      }

      const result = await response.json();
      if (process.env.NODE_ENV === 'development') {
        console.log('📋 Response Data:', { 
          hasMindmaps: !!result.mindmaps,
          mindmapsCount: result.mindmaps?.length || 0,
          result 
        });
      }
      
      if (result.mindmaps && result.mindmaps.length > 0) {
        // 最初のマインドマップを使用
        const mindmap = result.mindmaps[0];
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ 既存マップデータ使用:', { 
            id: mindmap.id, 
            title: mindmap.title,
            hasRootNode: !!mindmap.rootNode,
            rootNodeId: mindmap.rootNode?.id,
            rootNodeText: mindmap.rootNode?.text,
            dataStructure: Object.keys(mindmap)
          });
        }
        setData(mindmap);
      } else if (createIfNotExists) {
        // データがない場合はデフォルトデータを作成
        if (process.env.NODE_ENV === 'development') {
          console.log('🆕 デフォルトデータ作成開始');
        }
        const defaultData = createDefaultData();
        if (process.env.NODE_ENV === 'development') {
          console.log('💾 デフォルトデータ作成のみ（保存は別途実行）');
        }
        setData(defaultData);
        
        // 保存はuseEffectで別途実行（無限ループを防ぐため）
      }
      
      setLastSyncTime(new Date());
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ データ取得完了');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'データの取得に失敗しました';
      console.error('❌ データ取得エラー:', error);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [authState.isAuthenticated]);

  // マインドマップデータの保存
  const saveMindMapData = useCallback(async (mapData: MindMapData) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('💾 saveMindMapData開始:', { 
        isAuthenticated: authState.isAuthenticated,
        hasId: !!mapData.id,
        title: mapData.title 
      });
    }
    
    if (!authState.isAuthenticated) return;

    try {
      const headers = getAuthHeaders();
      if (process.env.NODE_ENV === 'development') {
        console.log('📡 API Request (POST):', { 
          url: `${API_BASE_URL}/api/mindmaps`,
          headers: { ...headers, Authorization: headers.Authorization?.substring(0, 20) + '...' },
          bodyPreview: { id: mapData.id, title: mapData.title, hasRootNode: !!mapData.rootNode }
        });
      }
      
      const response = await fetch(`${API_BASE_URL}/api/mindmaps`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(mapData),
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('📋 API Response (POST):', { 
          status: response.status, 
          ok: response.ok,
          statusText: response.statusText 
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response (POST):', errorText);
        throw new Error('データの保存に失敗しました');
      }

      const result = await response.json();
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ マップ保存成功:', result);
      }

      setLastSyncTime(new Date());
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'データの保存に失敗しました';
      console.error('❌ データ保存エラー:', error);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [authState.isAuthenticated]);

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
  }, [authState.isAuthenticated]);

  // 認証状態が変わったらデータを取得
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 認証状態変化 - useCloudData:', { 
        isAuthenticated: authState.isAuthenticated,
        hasData: !!data,
        isLoading,
        error
      });
    }
    
    if (authState.isAuthenticated && !data && !isLoading) {
      if (process.env.NODE_ENV === 'development') {
        console.log('▶️ 認証済み&データなし&ロード中でない → データ取得実行');
      }
      fetchMindMapData();
    } else if (!authState.isAuthenticated) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ 未認証 → データクリア');
      }
      setData(null);
      setError(null);
    } else if (authState.isAuthenticated && data) {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ 認証済み&データあり → データ取得スキップ');
      }
    }
  }, [authState.isAuthenticated, data, isLoading, fetchMindMapData]);

  // 新規データの保存
  useEffect(() => {
    if (!data || !authState.isAuthenticated || data.id || isLoading) return;

    if (process.env.NODE_ENV === 'development') {
      console.log('🆕 新規データ検出 - 保存実行');
    }
    const saveNewData = async () => {
      const saveResult = await saveMindMapData(data);
      if (saveResult && saveResult.success && saveResult.data) {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ 新規データ保存成功 - IDを含むデータに更新');
        }
        setData(saveResult.data);
      }
    };
    
    saveNewData();
  }, [data?.id, authState.isAuthenticated, isLoading, saveMindMapData]);

  // 自動保存（10秒ごと）
  useEffect(() => {
    if (!data || !authState.isAuthenticated || !data.id) return;

    const interval = setInterval(() => {
      if (process.env.NODE_ENV === 'development') {
        console.log('⏰ 自動保存実行:', { hasId: !!data.id, title: data.title });
      }
      updateMindMapData(data);
    }, 10000); // 10秒間隔

    return () => clearInterval(interval);
  }, [data, authState.isAuthenticated, updateMindMapData]);

  // データ更新のラッパー関数
  const updateDataSafe = useCallback((newData: MindMapData, options: any = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('📝 データ更新実行:', { 
        hasId: !!newData.id,
        title: newData.title,
        immediate: options.immediate
      });
    }
    
    setData(newData);
    
    // 即座保存が必要な場合
    if (options.immediate) {
      updateMindMapData(newData);
    }
  }, [setData, updateMindMapData]);

  return {
    data,
    setData: updateDataSafe,
    isLoading,
    error,
    lastSyncTime,
    fetchMindMapData,
    saveMindMapData,
    updateMindMapData
  };
};