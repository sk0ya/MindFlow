import { useState, useEffect, useRef } from 'react';
import { getCurrentMindMap, saveMindMap, isCloudStorageEnabled, getAppSettings } from '../utils/storage.js';
import { deepClone, assignColorsToExistingNodes, createInitialData } from '../utils/dataTypes.js';

// データ管理専用のカスタムフック
export const useMindMapData = () => {
  const [data, setData] = useState(() => {
    // 設定をチェックしてからデータを初期化
    const settings = getAppSettings();
    
    if (settings.storageMode === 'cloud') {
      // クラウドモードの場合は空のデータから開始
      console.log('☁️ クラウドモード: 空データで初期化');
      return createInitialData();
    } else if (settings.storageMode === 'local') {
      // ローカルモードの場合は既存データを読み込み
      const mindMap = getCurrentMindMap();
      return assignColorsToExistingNodes(mindMap);
    } else {
      // ストレージモード未設定の場合は空データ
      console.log('❓ ストレージモード未設定: 空データで初期化');
      return createInitialData();
    }
  });
  
  const [isLoadingFromCloud, setIsLoadingFromCloud] = useState(false);
  
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const autoSaveTimeoutRef = useRef(null);
  
  // 初期化時にクラウドから同期（クラウドモードの場合のみ）
  useEffect(() => {
    const initializeFromCloud = async () => {
      try {
        // クラウドモードかどうかチェック
        if (!isCloudStorageEnabled()) {
          console.log('🏠 ローカルモード: クラウド同期をスキップ');
          return;
        }
        
        setIsLoadingFromCloud(true);
        
        // 認証状態を確認
        const { authManager } = await import('../utils/authManager.js');
        if (!authManager.isAuthenticated()) {
          console.log('⏳ 未認証のためクラウド同期を待機中...');
          return;
        }
        
        console.log('🔄 認証済み: クラウド同期を開始');
        
        // クラウドからマインドマップ一覧を取得
        const { loadMindMapsFromCloud, loadMindMapFromCloud } = await import('../utils/storage.js');
        const cloudMaps = await loadMindMapsFromCloud();
        
        if (cloudMaps && cloudMaps.length > 0) {
          // 最新のマインドマップを読み込み
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
          console.log('📭 クラウドにマップが見つかりません。新規作成します。');
        }
      } catch (error) {
        console.warn('❌ クラウド初期化失敗:', error);
      } finally {
        setIsLoadingFromCloud(false);
      }
    };
    
    // 少し遅延してクラウド同期を実行（認証が完了してから）
    const timer = setTimeout(initializeFromCloud, 2000);
    return () => clearTimeout(timer);
  }, []);

  // 認証状態変更時の再同期
  useEffect(() => {
    const syncOnAuthChange = async () => {
      try {
        if (!isCloudStorageEnabled()) return;
        
        const { authManager } = await import('../utils/authManager.js');
        if (authManager.isAuthenticated() && !isLoadingFromCloud) {
          console.log('🔑 認証状態変更: クラウド同期を再実行');
          
          setIsLoadingFromCloud(true);
          
          const { loadMindMapsFromCloud, loadMindMapFromCloud } = await import('../utils/storage.js');
          const cloudMaps = await loadMindMapsFromCloud();
          
          if (cloudMaps && cloudMaps.length > 0) {
            const latestMap = cloudMaps.sort((a, b) => 
              new Date(b.updatedAt) - new Date(a.updatedAt)
            )[0];
            
            const fullMapData = await loadMindMapFromCloud(latestMap.id);
            if (fullMapData) {
              const processedData = assignColorsToExistingNodes(fullMapData);
              setData(processedData);
              console.log('✅ 認証後のクラウド同期完了');
            }
          }
        }
      } catch (error) {
        console.warn('❌ 認証後同期失敗:', error);
      } finally {
        setIsLoadingFromCloud(false);
      }
    };

    // 認証状態の変更を監視（ポーリングで定期チェック）
    const authCheckInterval = setInterval(async () => {
      try {
        const { authManager } = await import('../utils/authManager.js');
        const isAuth = authManager.isAuthenticated();
        
        // 認証済みかつ、まだデータが空の場合は同期実行
        if (isAuth && isCloudStorageEnabled() && data && !data.rootNode?.children?.length) {
          await syncOnAuthChange();
        }
      } catch (error) {
        // Silent fail for auth check
      }
    }, 3000);

    return () => clearInterval(authCheckInterval);
  }, [isLoadingFromCloud, data]);

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
    isLoadingFromCloud
  };
};