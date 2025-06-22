import { useState, useEffect, useRef } from 'react';
import { getCurrentMindMap, saveMindMap } from '../utils/storage.js';
import { deepClone, assignColorsToExistingNodes } from '../utils/dataTypes.js';

// データ管理専用のカスタムフック
export const useMindMapData = () => {
  const [data, setData] = useState(() => {
    const mindMap = getCurrentMindMap();
    return assignColorsToExistingNodes(mindMap);
  });
  
  const [isLoadingFromCloud, setIsLoadingFromCloud] = useState(false);
  
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const autoSaveTimeoutRef = useRef(null);
  
  // 初期化時にクラウドから同期
  useEffect(() => {
    const initializeFromCloud = async () => {
      try {
        setIsLoadingFromCloud(true);
        
        // 認証状態を確認
        const { authManager } = await import('../utils/authManager.js');
        if (!authManager.isAuthenticated()) {
          console.log('未認証のためクラウド同期スキップ');
          return;
        }
        
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
            
            // ローカルにもバックアップとして保存
            const { saveMindMap } = await import('../utils/storage.js');
            saveMindMap(processedData);
            
            console.log('✅ クラウド同期完了');
          }
        }
      } catch (error) {
        console.warn('❌ クラウド初期化失敗:', error);
      } finally {
        setIsLoadingFromCloud(false);
      }
    };
    
    // 少し遅延してクラウド同期を実行（認証が完了してから）
    const timer = setTimeout(initializeFromCloud, 1000);
    return () => clearTimeout(timer);
  }, []);

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