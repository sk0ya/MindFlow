import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { 
  initCloudIndexedDB, 
  saveToIndexedDB, 
  getAllFromIndexedDB,
  markAsSynced,
  getDirtyData
} from '../utils/indexedDB';
import { cleanEmptyNodesFromData, countNodes } from '../utils/dataUtils';

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
  const [allMaps, setAllMaps] = useState<MindMapData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isIndexedDBReady, setIsIndexedDBReady] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  // IndexedDB初期化
  useEffect(() => {
    const initDB = async () => {
      try {
        await initCloudIndexedDB();
        setIsIndexedDBReady(true);
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Cloud IndexedDB 初期化完了');
        }
      } catch (error) {
        console.error('❌ Cloud IndexedDB 初期化失敗:', error);
        // IndexedDBが失敗してもアプリは続行
        setIsIndexedDBReady(false);
      }
    };
    initDB();
  }, []);

  // マインドマップデータの取得（IndexedDB + API）
  const fetchMindMapData = useCallback(async (createIfNotExists = true) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('📋 fetchMindMapData開始:', { 
        isAuthenticated: authState.isAuthenticated,
        isIndexedDBReady
      });
    }
    
    if (!authState.isAuthenticated) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⏭️ 未認証のためデータ取得スキップ');
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. まずIndexedDBからローカルキャッシュを確認
      let localData = null;
      if (isIndexedDBReady) {
        try {
          const allLocalData = await getAllFromIndexedDB(authState.user?.email);
          if (allLocalData.length > 0) {
            const rawLocalData = allLocalData[0]; // 最初のマップを使用
            
            // ローカルデータもクリーンアップ
            localData = cleanEmptyNodesFromData(rawLocalData);
            
            if (process.env.NODE_ENV === 'development') {
              console.log('📱 IndexedDB: ローカルキャッシュ発見・クリーンアップ:', {
                id: localData.id,
                title: localData.title,
                isDirty: localData._metadata?.isDirty
              });
            }
            // クリーンアップ済みローカルデータを即座に表示
            setData(localData);
          }
        } catch (indexedDBError) {
          console.warn('⚠️ IndexedDB読み込み警告:', indexedDBError);
        }
      }

      // 2. APIからサーバーデータを取得
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 API データ取得開始');
      }

      const headers = getAuthHeaders();
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
        // APIエラー時はローカルデータがあればそれを使用
        if (localData) {
          if (process.env.NODE_ENV === 'development') {
            console.log('📱 API失敗、ローカルデータを使用');
          }
          setLastSyncTime(new Date(localData._metadata?.lastSync || Date.now()));
          return;
        }
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error('データの取得に失敗しました');
      }

      const result = await response.json();
      
      if (result.mindmaps && result.mindmaps.length > 0) {
        // 全マップのリストを保存（rootNodeが存在しない場合はデフォルトを作成）
        const allServerMaps = result.mindmaps.map((mapData: any) => {
          // rootNodeが存在しない場合はデフォルトrootNodeを追加
          if (!mapData.rootNode) {
            if (process.env.NODE_ENV === 'development') {
              console.log('⚠️ rootNodeが存在しないため、デフォルトrootNodeを作成:', { id: mapData.id, title: mapData.title });
            }
            mapData.rootNode = {
              id: 'root',
              text: 'メイントピック',
              x: 400,
              y: 300,
              children: []
            };
          }
          return cleanEmptyNodesFromData(mapData);
        });
        setAllMaps(allServerMaps);
        
        const serverData = allServerMaps[0];
        
        // 3. サーバーデータの空文字ノードをクリーンアップ
        const cleanedServerData = cleanEmptyNodesFromData(serverData);
        
        // 4. クリーンアップ済みデータをIndexedDBに保存
        if (isIndexedDBReady) {
          try {
            await saveToIndexedDB(cleanedServerData, authState.user?.email);
            // 同期済みとしてマーク
            await markAsSynced(cleanedServerData.id);
          } catch (saveError) {
            console.warn('⚠️ IndexedDB保存警告:', saveError);
          }
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('✅ サーバーデータ取得・クリーンアップ・保存完了:', { 
            id: cleanedServerData.id, 
            title: cleanedServerData.title,
            nodeCount: countNodes(cleanedServerData.rootNode),
            totalMaps: allServerMaps.length
          });
        }
        setData(cleanedServerData);
        
        // rootNodeが追加された場合は、修正されたデータを保存
        const originalData = result.mindmaps[0];
        if (!originalData.rootNode && cleanedServerData.rootNode) {
          if (process.env.NODE_ENV === 'development') {
            console.log('💾 rootNode追加後のデータを保存:', { id: cleanedServerData.id });
          }
          setTimeout(async () => {
            try {
              await updateMindMapData(cleanedServerData);
            } catch (error) {
              console.warn('⚠️ rootNode追加後の保存エラー:', error);
            }
          }, 500);
        }
      } else if (createIfNotExists) {
        // データがない場合はデフォルトデータを作成してすぐに保存
        const defaultData = createDefaultData();
        if (process.env.NODE_ENV === 'development') {
          console.log('🆕 デフォルトデータ作成:', { id: defaultData.id, title: defaultData.title });
        }
        setData(defaultData);
        
        // デフォルトデータをすぐにAPIに保存（重複を避けるため一度だけ）
        setTimeout(async () => {
          if (process.env.NODE_ENV === 'development') {
            console.log('💾 デフォルトデータ即座保存開始');
          }
          try {
            const saveResult = await saveMindMapData(defaultData);
            if (saveResult && saveResult.success && saveResult.data) {
              if (process.env.NODE_ENV === 'development') {
                console.log('✅ デフォルトデータ保存成功');
              }
              setData(saveResult.data);
            } else {
              console.warn('⚠️ デフォルトデータ保存失敗:', saveResult);
            }
          } catch (error) {
            console.warn('⚠️ デフォルトデータ保存エラー:', error);
          }
        }, 100);
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
  }, [authState.isAuthenticated, authState.user?.email, isIndexedDBReady, getAuthHeaders]);

  // マインドマップデータの保存（IndexedDB + API）
  const saveMindMapData = useCallback(async (mapData: MindMapData) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('💾 saveMindMapData開始:', { 
        isAuthenticated: authState.isAuthenticated,
        hasId: !!mapData.id,
        title: mapData.title,
        isIndexedDBReady,
        isAlreadySaving: savingIds.has(mapData.id)
      });
    }
    
    if (!authState.isAuthenticated) return { success: false, error: '未認証' };
    
    // 重複保存防止
    if (savingIds.has(mapData.id)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⏭️ 重複保存をスキップ:', { id: mapData.id, title: mapData.title });
      }
      return { success: false, error: '保存中...' };
    }
    
    setSavingIds(prev => new Set(prev).add(mapData.id));

    // 1. 先にIndexedDBに保存（即座の応答性）
    if (isIndexedDBReady) {
      try {
        await saveToIndexedDB(mapData, authState.user?.email);
        if (process.env.NODE_ENV === 'development') {
          console.log('💾 IndexedDB保存完了（即座）');
        }
      } catch (indexedDBError) {
        console.warn('⚠️ IndexedDB保存警告:', indexedDBError);
      }
    }

    // 2. APIに送信（バックグラウンド同期）
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
      
      // 3. API成功時はIndexedDBでも同期済みマーク
      if (isIndexedDBReady && result.id) {
        try {
          await markAsSynced(result.id);
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ API同期完了、IndexedDBにマーク');
          }
        } catch (markError) {
          console.warn('⚠️ 同期マーク警告:', markError);
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ マップ保存成功（API + IndexedDB）:', result);
      }

      setLastSyncTime(new Date());
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'データの保存に失敗しました';
      console.error('❌ API保存エラー（IndexedDBには保存済み）:', error);
      
      // APIに失敗してもIndexedDBには保存されているので部分的成功
      return { 
        success: false, 
        error: errorMessage,
        localSaved: isIndexedDBReady // ローカル保存は成功している
      };
    } finally {
      // 保存完了後にIDを削除
      setSavingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(mapData.id);
        return newSet;
      });
    }
  }, [authState.isAuthenticated, authState.user?.email, isIndexedDBReady, getAuthHeaders, savingIds]);

  // マインドマップデータの更新（IndexedDB + API）
  const updateMindMapData = useCallback(async (mapData: MindMapData) => {
    if (!authState.isAuthenticated || !mapData.id) return { success: false, error: '認証エラーまたはIDなし' };

    // 1. 先にIndexedDBに保存（即座の応答性）
    if (isIndexedDBReady) {
      try {
        await saveToIndexedDB(mapData, authState.user?.email);
        if (process.env.NODE_ENV === 'development') {
          console.log('💾 IndexedDB更新完了（即座）');
        }
      } catch (indexedDBError) {
        console.warn('⚠️ IndexedDB更新警告:', indexedDBError);
      }
    }

    // 2. APIに送信（バックグラウンド同期）
    try {
      const response = await fetch(`${API_BASE_URL}/api/mindmaps/${mapData.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(mapData),
      });

      if (!response.ok) {
        throw new Error('データの更新に失敗しました');
      }

      // 3. API成功時はIndexedDBでも同期済みマーク
      if (isIndexedDBReady) {
        try {
          await markAsSynced(mapData.id);
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ API更新完了、IndexedDBにマーク');
          }
        } catch (markError) {
          console.warn('⚠️ 同期マーク警告:', markError);
        }
      }

      setData(mapData);
      setLastSyncTime(new Date());
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'データの更新に失敗しました';
      setError(errorMessage);
      console.error('❌ API更新エラー（IndexedDBには保存済み）:', error);
      
      // APIに失敗してもIndexedDBには保存されているので部分的成功
      return { 
        success: false, 
        error: errorMessage,
        localSaved: isIndexedDBReady
      };
    }
  }, [authState.isAuthenticated, authState.user?.email, isIndexedDBReady, getAuthHeaders]);

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

  // 新規データの保存（サーバーに未保存のデータ）- 既存データがある場合は無効化
  useEffect(() => {
    if (!data || !authState.isAuthenticated || isLoading) return;
    
    // 既にマップが存在する場合は新規作成を避ける
    if (allMaps.length > 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⏭️ 既存マップ存在により新規データ保存をスキップ:', { existingMaps: allMaps.length });
      }
      return;
    }
    
    // createdAt と updatedAt が一致していて、データベースに保存されていない新規データかチェック
    const isNewUnsavedData = data.id && (!('createdAt' in data) || !data.createdAt) && (!('updatedAt' in data) || !data.updatedAt);

    if (isNewUnsavedData) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🆕 新規データ検出 - 保存実行:', { id: data.id, title: data.title });
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
    }
  }, [data?.id, data && 'createdAt' in data ? data.createdAt : undefined, data && 'updatedAt' in data ? data.updatedAt : undefined, authState.isAuthenticated, isLoading, saveMindMapData, allMaps.length]);

  // デバウンス自動保存（5秒後）
  useEffect(() => {
    if (!data || !authState.isAuthenticated || !data.id) return;

    const timeoutId = setTimeout(() => {
      if (process.env.NODE_ENV === 'development') {
        console.log('⏰ デバウンス自動保存実行:', { hasId: !!data.id, title: data.title });
      }
      updateMindMapData(data);
    }, 5000); // 5秒後に保存

    return () => clearTimeout(timeoutId);
  }, [data, authState.isAuthenticated, updateMindMapData]);

  // データ更新のラッパー関数（簡素化）
  const updateDataSafe = useCallback(async (newData: MindMapData, options: any = {}) => {
    // 空ノードのクリーンアップ（必要に応じて）
    const cleanedData = options.cleanupEmptyNodes ? cleanEmptyNodesFromData(newData) : newData;
    
    // UI更新（即座）
    setData(cleanedData);
    
    // IndexedDBに保存
    if (isIndexedDBReady && authState.isAuthenticated) {
      try {
        await saveToIndexedDB(cleanedData, authState.user?.email);
      } catch (error) {
        console.warn('⚠️ IndexedDB保存警告:', error);
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📝 データ更新完了:', { 
        title: cleanedData.title,
        cleaned: !!options.cleanupEmptyNodes
      });
    }
  }, [isIndexedDBReady, authState.isAuthenticated, authState.user?.email]);

  // バックグラウンド同期（未同期データをAPIに送信）
  const syncDirtyData = useCallback(async () => {
    if (!isIndexedDBReady || !authState.isAuthenticated) return;

    try {
      const dirtyMaps = await getDirtyData();
      if (dirtyMaps.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 バックグラウンド同期: 未同期データなし');
        }
        return;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 バックグラウンド同期開始:', { count: dirtyMaps.length });
      }

      for (const dirtyMap of dirtyMaps) {
        try {
          const headers = getAuthHeaders();
          const response = await fetch(`${API_BASE_URL}/api/mindmaps/${dirtyMap.id}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(dirtyMap),
          });

          if (response.ok) {
            await markAsSynced(dirtyMap.id);
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ バックグラウンド同期成功:', { id: dirtyMap.id, title: dirtyMap.title });
            }
          } else {
            console.warn('⚠️ バックグラウンド同期失敗:', { 
              id: dirtyMap.id, 
              status: response.status 
            });
          }
        } catch (syncError) {
          console.warn('⚠️ バックグラウンド同期エラー:', { 
            id: dirtyMap.id, 
            error: syncError 
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ バックグラウンド同期処理エラー:', error);
    }
  }, [isIndexedDBReady, authState.isAuthenticated, getAuthHeaders]);

  // バックグラウンド同期（30秒間隔）
  useEffect(() => {
    if (!isIndexedDBReady || !authState.isAuthenticated) return;

    const syncInterval = setInterval(() => {
      syncDirtyData();
    }, 30000); // 30秒間隔

    // 初回同期も実行
    syncDirtyData();

    return () => clearInterval(syncInterval);
  }, [isIndexedDBReady, authState.isAuthenticated, syncDirtyData]);


  // マップ切り替え関数
  const switchToMap = useCallback(async (mapId: string) => {
    const targetMap = allMaps.find(map => map.id === mapId);
    if (targetMap) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 マップ切り替え:', { from: data?.id, to: mapId, title: targetMap.title });
      }
      setData(targetMap);
    }
  }, [allMaps, data?.id]);

  // 新規マップ作成関数
  const createNewMap = useCallback(async (title: string = '新しいマインドマップ') => {
    const newMapData = createDefaultData();
    newMapData.title = title;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🆕 新規マップ作成:', { title, id: newMapData.id });
    }
    
    // 新規マップを保存
    const saveResult = await saveMindMapData(newMapData);
    if (saveResult && saveResult.success && saveResult.data) {
      setData(saveResult.data);
      setAllMaps(prev => [saveResult.data, ...prev]);
      return saveResult.data;
    }
    return null;
  }, [saveMindMapData]);

  return {
    data,
    allMaps,
    setData: updateDataSafe,
    isLoading,
    error,
    lastSyncTime,
    fetchMindMapData,
    saveMindMapData,
    updateMindMapData,
    syncDirtyData,
    switchToMap,
    createNewMap,
    isIndexedDBReady
  };
};