import { useState, useEffect, useRef } from 'react';
import { getCurrentMindMap, saveMindMap, isCloudStorageEnabled, getAllMindMaps, getMindMap } from '../../core/storage/storageRouter.js';
import { getAppSettings } from '../../core/storage/storageUtils.js';
import { deepClone, assignColorsToExistingNodes, createInitialData } from '../../shared/types/dataTypes.js';
import { authManager } from '../auth/authManager.js';
import { realtimeSync } from '../../core/sync/realtimeSync.js';

// データ管理専用のカスタムフック
export const useMindMapData = (isAppReady = false) => {
  const [data, setData] = useState(null);
  
  const [isLoadingFromCloud, setIsLoadingFromCloud] = useState(false);
  
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const autoSaveTimeoutRef = useRef(null);
  const isSavingRef = useRef(false); // 同時保存処理防止フラグ
  
  // 即座保存機能（編集中の安全性を考慮）
  const saveImmediately = async (dataToSave = data) => {
    if (!dataToSave || dataToSave.isPlaceholder) return;
    
    // 🔧 同時保存処理の防止
    if (isSavingRef.current) {
      console.log('⏸️ 保存スキップ: 既に保存処理実行中');
      return;
    }
    
    try {
      isSavingRef.current = true; // 保存開始フラグ
      
      // タイマーをクリア
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }

      // 🔧 修正: 編集中の場合は自動保存をスキップして編集を保護
      const editingInput = document.querySelector('.node-input');
      if (editingInput && document.activeElement === editingInput) {
        console.log('✋ 自動保存スキップ: ノード編集中のため保護', { 
          value: editingInput.value,
          activeElement: document.activeElement.tagName,
          isEditing: true
        });
        // 編集中は強制blurを行わず、保存もスキップして編集を保護
        return;
      }
      
      await saveMindMap(dataToSave);
      console.log('💾 即座保存完了:', dataToSave.title);
    } catch (error) {
      console.warn('⚠️ 即座保存失敗:', error.message);
    } finally {
      isSavingRef.current = false; // 保存完了フラグリセット
    }
  };

  // 自動保存を開始（ノード個別同期無効化中の対策）
  const startAutoSave = () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(async () => {
      await saveImmediately();
    }, 2000); // 2秒後に保存
  };
  
  // アプリ準備完了時のデータ初期化
  useEffect(() => {
    if (!isAppReady || data !== null) return;

    const initializeData = async () => {
      console.log('🚀 データ初期化開始 (isAppReady: true)');
      const settings = getAppSettings();
      
      if (settings.storageMode === 'local') {
        // ローカルモード: データを初期化
        const mindMap = await getCurrentMindMap();
        if (mindMap && mindMap.rootNode) {
          console.log('📁 ローカルモード: 既存データ読み込み');
          setData(assignColorsToExistingNodes(mindMap));
        } else {
          console.log('📁 ローカルモード: 新規マップ作成');
          setData(createInitialData());
        }
        console.log('📁 ローカルモード: 初期化完了');
        
      } else if (settings.storageMode === 'cloud') {
        // クラウドモード: 認証状態をチェックして同期
        await initializeFromCloud();
      } else {
        // フォールバック
        console.log('❓ 設定不明: デフォルトデータ');
        setData(createInitialData());
      }
    };

    initializeData();
  }, [isAppReady, data]);

  // クラウド同期処理（統一）
  const initializeFromCloud = async () => {
    try {
      setIsLoadingFromCloud(true);
      
      // 認証状態を確認
      if (!authManager.isAuthenticated()) {
        console.log('⏳ 未認証: クラウド同期を待機');
        return;
      }
      
      console.log('🔄 認証済み: クラウド同期開始');
      
      // クラウドからマインドマップ一覧を取得
      const cloudMaps = await getAllMindMaps();
      
      if (cloudMaps && cloudMaps.length > 0) {
        // 既存データを読み込み
        const latestMap = cloudMaps.sort((a, b) => 
          new Date(b.updatedAt) - new Date(a.updatedAt)
        )[0];
        
        console.log('📥 最新のクラウドマップを読み込み:', latestMap.title);
        const fullMapData = await getMindMap(latestMap.id);
        
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
          await saveMindMap(newMap);
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

  // データ更新の共通処理（リアルタイム同期対応・編集中保護強化）
  const updateData = async (newData, options = {}) => {
    // プレースホルダーデータの場合は更新を無視
    if (data?.isPlaceholder) {
      console.log('⏳ プレースホルダー中: データ更新をスキップ');
      return;
    }
    
    // 🔧 編集中の競合状態を検出・保護
    const editingInput = document.querySelector('.node-input');
    const isCurrentlyEditing = editingInput && document.activeElement === editingInput;
    
    if (isCurrentlyEditing && !options.allowDuringEdit) {
      console.log('✋ データ更新スキップ: ノード編集中のため保護', {
        editingValue: editingInput.value,
        updateSource: options.source || 'unknown',
        isExternalSync: options.skipHistory || false
      });
      
      // 編集中は外部同期からの更新をスキップして編集を保護
      // ただし、明示的に許可された場合は更新を実行
      return;
    }
    
    setData(newData);
    
    // リアルタイム操作の適用中でない場合のみ履歴に追加
    if (!options.skipHistory) {
      addToHistory(newData);
    }
    
    // 保存処理
    if (options.saveImmediately) {
      // 即座保存（重要な操作用）
      await saveImmediately(newData);
    } else if (options.immediate) {
      // 通常の自動保存（2秒デバウンス）
      startAutoSave();
    }
    
    console.log('🔄 データ更新完了:', {
      id: newData.id,
      immediate: options.immediate || false,
      saveImmediately: options.saveImmediately || false,
      skipHistory: options.skipHistory || false,
      wasEditingProtected: isCurrentlyEditing && !options.allowDuringEdit
    });
    
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

  // リアルタイム同期のイベントリスナー設定
  useEffect(() => {
    if (!isAppReady || !data || data.isPlaceholder) return;
    
    const settings = getAppSettings();
    if (settings.storageMode !== 'cloud') return;
    
    // マップ更新イベントをリッスン
    const unsubscribe = realtimeSync.addEventListener('map_updated', async (event) => {
      console.log('🔄 リアルタイム同期: マップ更新検出', event.data.id);
      
      // 現在のマップIDと一致する場合のみ更新
      if (event.data.id === data.id) {
        try {
          // 最新データを取得
          const updatedMap = await getMindMap(event.data.id);
          if (updatedMap) {
            // リアルタイム更新は履歴をスキップし、編集中は保護
            updateData(assignColorsToExistingNodes(updatedMap), {
              skipHistory: true,
              source: 'realtime-sync',
              allowDuringEdit: false // 編集中は更新をスキップ
            });
            console.log('✅ リアルタイム同期: マップ更新適用');
          }
        } catch (error) {
          console.error('❌ リアルタイム同期エラー:', error);
        }
      }
    });
    
    // クリーンアップ
    return () => {
      unsubscribe();
    };
  }, [isAppReady, data]);

  return {
    data,
    setData,
    updateData,
    saveImmediately,
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