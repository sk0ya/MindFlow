import { useState, useEffect, useRef } from 'react';
import { getCurrentMindMap, updateMindMap as saveMindMap, isCloudStorageEnabled, getAllMindMaps, getMindMap } from '../../core/storage/StorageManager';
import { getAppSettings } from '../../core/storage/storageUtils.js';
import { deepClone, assignColorsToExistingNodes, createInitialData } from '../../shared/types/dataTypes.js';
import { unifiedAuthManager } from '../auth/UnifiedAuthManager.js';
import { realtimeSync } from '../../core/sync/realtimeSync.js';
import { DataIntegrityChecker } from '../../shared/utils/dataIntegrityChecker.js';

// データ管理専用のカスタムフック
export const useMindMapData = (isAppReady = false) => {
  const [data, setData] = useState(null);
  
  const [isLoadingFromCloud, setIsLoadingFromCloud] = useState(false);
  
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const autoSaveTimeoutRef = useRef(null);
  const isSavingRef = useRef(false); // 同時保存処理防止フラグ
  const realtimeSyncBlockedUntilRef = useRef(0); // リアルタイム同期ブロック時刻
  
  // 🔧 統一: リアルタイム同期ブロック期間3秒に統一（競合防止）
  const blockRealtimeSyncTemporarily = (durationMs = 3000) => {
    realtimeSyncBlockedUntilRef.current = Date.now() + durationMs;
    console.log('🚫 リアルタイム同期を3秒間ブロック:', { durationMs, blockedUntil: new Date(realtimeSyncBlockedUntilRef.current).toISOString() });
  };
  
  // 即座保存機能（編集中の安全性を考慮）
  const saveImmediately = async (dataToSave = data, options = {}) => {
    if (!dataToSave || dataToSave.isPlaceholder) return;

    // 🔧 データ整合性チェック
    const integrityResult = DataIntegrityChecker.checkMindMapIntegrity(dataToSave);
    if (!integrityResult.isValid) {
      console.warn('⚠️ 保存前データ整合性チェック失敗');
      DataIntegrityChecker.logIntegrityReport(integrityResult, dataToSave);
      
      // 重要な問題がある場合は修復を試行
      const criticalIssues = integrityResult.issues.filter(issue => issue.severity === 'critical');
      if (criticalIssues.length > 0) {
        console.warn('🔧 重要な問題を検出、自動修復を試行...');
        const { repaired, issues } = DataIntegrityChecker.repairMindMapData(dataToSave);
        if (repaired) {
          console.log('✅ データ修復完了', { repairedIssues: issues.length });
          dataToSave = repaired;
        } else {
          console.error('❌ データ修復失敗、保存を中止');
          return;
        }
      }
    }
    
    // 🔧 改善: 同時保存処理防止とキューイング
    if (isSavingRef.current) {
      console.log('⏸️ 保存スキップ: 既に保存処理実行中');
      
      // 保存待ちの最大時間（10秒）
      const maxWaitTime = 10000;
      const startTime = Date.now();
      
      // 保存完了まで待機（ポーリング）
      while (isSavingRef.current && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // タイムアウトの場合は強制継続
      if (isSavingRef.current) {
        console.warn('⚠️ 保存タイムアウト: 強制継続');
        isSavingRef.current = false;
      }
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
      
      // 🔧 修正: 保存後にリアルタイム同期を一時的にブロック（無限ループ防止）
      blockRealtimeSyncTemporarily(5000); // 5秒間ブロック
      
      // 🔧 NEW: リアルタイム同期のスキップオプション
      if (options.skipRealtimeSync) {
        console.log('⏭️ リアルタイム同期スキップ: サーバーファースト更新のため');
      }
      
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
      if (!unifiedAuthManager.isAuthenticated) {
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
      await saveImmediately(newData, { skipRealtimeSync: options.skipRealtimeSync });
    } else if (options.immediate && !options.skipRealtimeSync) {
      // 通常の自動保存（2秒デバウンス）
      // skipRealtimeSyncが指定されている場合は自動保存もスキップ
      startAutoSave();
    }
    
    console.log('🔄 データ更新完了:', {
      id: newData.id,
      immediate: options.immediate || false,
      saveImmediately: options.saveImmediately || false,
      skipHistory: options.skipHistory || false,
      wasEditingProtected: isCurrentlyEditing && !options.allowDuringEdit,
      source: options.source || 'unknown',
      allowDuringEdit: options.allowDuringEdit || false,
      wasEditing: isCurrentlyEditing || false
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
      console.log('🔄 リアルタイム同期: マップ更新検出', {
        eventMapId: event.data.id,
        currentMapId: data.id,
        isMatch: event.data.id === data.id,
        originUserId: event.originUserId,
        currentUserId: unifiedAuthManager.user?.id,
        timestamp: event.timestamp
      });
      
      // 🔧 修正: ポーリングベースの同期では originUserId が含まれないため、
      // 一時ブロック機能で無限ループを防止
      // TODO: 将来的にWebSocketベースの同期でoriginUserIdを実装
      if (event.originUserId && unifiedAuthManager.user?.id && event.originUserId === unifiedAuthManager.user.id) {
        console.log('⏸️ リアルタイム同期スキップ: 自分の更新のため除外', {
          originUserId: event.originUserId,
          currentUserId: unifiedAuthManager.user.id
        });
        return;
      }
      
      // 現在のマップIDと一致する場合のみ更新
      if (event.data.id === data.id) {
        // 一時ブロックチェック
        const now = Date.now();
        if (realtimeSyncBlockedUntilRef.current > now) {
          console.log('🚫 リアルタイム同期スキップ: 一時ブロック中', {
            remainingMs: realtimeSyncBlockedUntilRef.current - now,
            blockedUntil: new Date(realtimeSyncBlockedUntilRef.current).toISOString()
          });
          return;
        }
        
        // 編集状態を事前チェック
        const editingInput = document.querySelector('.node-input');
        const isCurrentlyEditing = editingInput && document.activeElement === editingInput;
        
        if (isCurrentlyEditing) {
          console.log('✋ リアルタイム同期スキップ: 編集中のため保護', {
            editingValue: editingInput.value,
            activeElement: document.activeElement.tagName
          });
          return; // 編集中は即座にリターン
        }
        
        try {
          console.log('📥 リアルタイム同期: 最新データ取得開始', event.data.id);
          // 最新データを取得
          const updatedMap = await getMindMap(event.data.id);
          if (updatedMap) {
            // 再度編集状態をチェック（非同期処理後）
            const editingInputAfter = document.querySelector('.node-input');
            const isEditingAfter = editingInputAfter && document.activeElement === editingInputAfter;
            
            if (isEditingAfter) {
              console.log('✋ リアルタイム同期スキップ: データ取得後も編集中', {
                editingValue: editingInputAfter.value
              });
              return;
            }
            
            // リアルタイム更新は履歴をスキップし、編集中は保護
            updateData(assignColorsToExistingNodes(updatedMap), {
              skipHistory: true,
              source: 'realtime-sync',
              allowDuringEdit: false // 編集中は更新をスキップ
            });
            console.log('✅ リアルタイム同期: マップ更新適用完了', {
              mapId: updatedMap.id,
              title: updatedMap.title
            });
          } else {
            console.warn('⚠️ リアルタイム同期: 更新データが空', event.data.id);
          }
        } catch (error) {
          console.error('❌ リアルタイム同期エラー:', {
            error: error.message,
            mapId: event.data.id,
            stack: error.stack
          });
        }
      } else {
        console.log('⏸️ リアルタイム同期: マップID不一致によりスキップ', {
          eventMapId: event.data.id,
          currentMapId: data.id
        });
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
    triggerCloudSync,
    blockRealtimeSyncTemporarily
  };
};