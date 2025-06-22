import { useState, useEffect, useRef } from 'react';
import { getCurrentMindMap, saveMindMap, isCloudStorageEnabled, getAppSettings } from '../utils/storage.js';
import { deepClone, assignColorsToExistingNodes, createInitialData } from '../utils/dataTypes.js';

// データ管理専用のカスタムフック
export const useMindMapData = (isAppReady = false) => {
  const [data, setData] = useState(() => {
    // アプリが準備完了まではプレースホルダー
    if (!isAppReady) {
      return {
        id: 'loading-placeholder',
        title: '初期化中...',
        rootNode: {
          id: 'root',
          text: 'アプリケーションを初期化中...',
          x: 400,
          y: 300,
          children: [],
          color: '#f8f9fa'
        },
        settings: { autoSave: false, autoLayout: false },
        isPlaceholder: true
      };
    }

    // アプリ準備完了後の初期化
    const settings = getAppSettings();
    
    if (settings.storageMode === 'local') {
      // ローカルモード: 既存データまたは新規作成
      const mindMap = getCurrentMindMap();
      if (mindMap) {
        console.log('📁 ローカルモード: 既存データ読み込み');
        return assignColorsToExistingNodes(mindMap);
      } else {
        console.log('📁 ローカルモード: 新規マップ作成');
        return createInitialData();
      }
    } else if (settings.storageMode === 'cloud') {
      // クラウドモード: プレースホルダーから開始
      console.log('☁️ クラウドモード: 認証待機中');
      return {
        id: 'cloud-loading-placeholder',
        title: 'クラウド同期中...',
        rootNode: {
          id: 'root',
          text: 'クラウドデータを読み込み中...',
          x: 400,
          y: 300,
          children: [],
          color: '#e8f4fd'
        },
        settings: { autoSave: false, autoLayout: false },
        isPlaceholder: true
      };
    } else {
      // フォールバック
      console.log('❓ 設定不明: デフォルトデータ');
      return createInitialData();
    }
  });
  
  const [isLoadingFromCloud, setIsLoadingFromCloud] = useState(false);
  
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const autoSaveTimeoutRef = useRef(null);
  
  // アプリ準備完了時のデータ初期化
  useEffect(() => {
    if (!isAppReady) return;

    const initializeData = async () => {
      const settings = getAppSettings();
      
      if (settings.storageMode === 'local') {
        // ローカルモード: 既にuseStateで初期化済み
        console.log('📁 ローカルモード: 初期化完了');
        
      } else if (settings.storageMode === 'cloud') {
        // クラウドモード: 認証状態をチェックして同期
        await initializeFromCloud();
      }
    };

    initializeData();
  }, [isAppReady]);

  // クラウド同期処理（統一）
  const initializeFromCloud = async () => {
    try {
      setIsLoadingFromCloud(true);
      
      // 認証状態を確認
      const { authManager } = await import('../utils/authManager.js');
      if (!authManager.isAuthenticated()) {
        console.log('⏳ 未認証: クラウド同期を待機');
        return;
      }
      
      console.log('🔄 認証済み: クラウド同期開始');
      
      // クラウドからマインドマップ一覧を取得
      const { loadMindMapsFromCloud, loadMindMapFromCloud } = await import('../utils/storage.js');
      const cloudMaps = await loadMindMapsFromCloud();
      
      if (cloudMaps && cloudMaps.length > 0) {
        // 既存データを読み込み
        const latestMap = cloudMaps.sort((a, b) => 
          new Date(b.updatedAt) - new Date(a.updatedAt)
        )[0];
        
        console.log('📥 最新のクラウドマップを読み込み:', latestMap.title);
        const fullMapData = await loadMindMapFromCloud(latestMap.id);
        
        if (fullMapData) {
          const processedData = assignColorsToExistingNodes(fullMapData);
          setData(processedData);
          console.log('✅ クラウド同期完了');
        }
      } else {
        // 新規マップを作成
        console.log('📭 クラウドにマップなし: 新規作成');
        const newMap = createInitialData();
        newMap.title = '新しいマインドマップ';
        setData(newMap);
        
        // クラウドに保存
        try {
          const { saveMindMapHybrid } = await import('../utils/storage.js');
          await saveMindMapHybrid(newMap);
          console.log('✅ 新規マップのクラウド保存完了');
        } catch (saveError) {
          console.warn('❌ 新規マップ保存失敗:', saveError);
        }
      }
    } catch (error) {
      console.warn('❌ クラウド同期失敗:', error);
      // エラー時は新規マップで開始
      const newMap = createInitialData();
      setData(newMap);
    } finally {
      setIsLoadingFromCloud(false);
    }
  };

  // 認証成功時のクラウド同期トリガー
  const triggerCloudSync = async () => {
    if (isCloudStorageEnabled() && data?.isPlaceholder) {
      console.log('🔑 認証成功: クラウド同期をトリガー');
      await initializeFromCloud();
    }
  };

  // 履歴に追加
  const addToHistory = (newData) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(deepClone(newData));
      return newHistory.slice(-50);
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  };

  // データ更新の共通処理
  const updateData = (newData, options = {}) => {
    // プレースホルダーデータの場合は更新を無視
    if (data?.isPlaceholder) {
      console.log('⏳ プレースホルダー中: データ更新をスキップ');
      return;
    }
    
    setData(newData);
    
    // リアルタイム操作の適用中でない場合のみ履歴に追加
    if (!options.skipHistory) {
      addToHistory(newData);
    }
    
    // 自動保存
    if (data.settings?.autoSave) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(async () => {
        try {
          console.log('🔄 オートセーブ開始:', newData.id, newData.title);
          // 動的インポートでsaveMindMapHybridを使用
          const { saveMindMapHybrid } = await import('../utils/storage.js');
          await saveMindMapHybrid(newData);
          console.log('✅ オートセーブ成功');
        } catch (error) {
          console.error('❌ オートセーブ失敗:', error);
          // フォールバックとしてローカル保存
          console.log('🏠 ローカル保存にフォールバック');
          await saveMindMap(newData);
        }
      }, 1000);
    }
    
    // カスタムコールバックがあれば実行
    if (options.onUpdate) {
      options.onUpdate(newData, options);
    }
  };

  // Undo
  const undo = async () => {
    if (historyIndex > 0) {
      const previousData = history[historyIndex - 1];
      setData(previousData);
      setHistoryIndex(prev => prev - 1);
      await saveMindMap(previousData);
    }
  };

  // Redo
  const redo = async () => {
    if (historyIndex < history.length - 1) {
      const nextData = history[historyIndex + 1];
      setData(nextData);
      setHistoryIndex(prev => prev + 1);
      await saveMindMap(nextData);
    }
  };

  // 設定を更新
  const updateSettings = (newSettings) => {
    updateData({
      ...data,
      settings: { ...data.settings, ...newSettings }
    });
  };

  // マップタイトルを更新
  const updateTitle = (newTitle) => {
    updateData({ ...data, title: newTitle });
  };

  // テーマを変更
  const changeTheme = (themeName) => {
    updateData({ ...data, theme: themeName });
  };

  // 初期化時に履歴を設定
  useEffect(() => {
    if (history.length === 0) {
      setHistory([deepClone(data)]);
      setHistoryIndex(0);
    }
    
    // クリーンアップ
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    data,
    setData,
    updateData,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    updateSettings,
    updateTitle,
    changeTheme,
    saveMindMap: async () => await saveMindMap(data),
    isLoadingFromCloud,
    triggerCloudSync
  };
};