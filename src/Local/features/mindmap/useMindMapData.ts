import { useState, useEffect, useRef } from 'react';
import { getCurrentMindMap, updateMindMap as saveMindMap } from '../../core/storage/LocalEngine';
import { deepClone, assignColorsToExistingNodes, createInitialData, MindMapData, MindMapSettings } from '../../shared/types/dataTypes';
import { DataIntegrityChecker } from '../../shared/utils/dataIntegrityChecker';
import { debug, warn, info, error } from '../../shared/utils/logger';

// データ管理専用のカスタムフック（ローカルモード専用）
export const useMindMapData = (isAppReady = false) => {
  const [data, setData] = useState<MindMapData | null>(null);
  const [history, setHistory] = useState<MindMapData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  
  // ローカルストレージへの保存機能
  const saveImmediately = async (dataToSave: MindMapData | null = data, options: { isManualSave?: boolean } = {}) => {
    if (!dataToSave) return { success: false, error: 'No data to save' };
    
    // TypeScript type assertion after null check
    let safeDataToSave: MindMapData = dataToSave;

    // データ整合性チェック
    const integrityResult = DataIntegrityChecker.checkMindMapIntegrity(safeDataToSave);
    if (!integrityResult.isValid) {
      warn('保存前データ整合性チェック失敗');
      DataIntegrityChecker.logIntegrityReport(integrityResult, safeDataToSave);
      
      const criticalIssues = integrityResult.issues.filter(issue => issue.severity === 'critical');
      if (criticalIssues.length > 0) {
        warn('重要な問題を検出、自動修復を試行...');
        const { repaired, issues } = DataIntegrityChecker.repairMindMapData(safeDataToSave);
        if (repaired) {
          info('データ修復完了', { repairedIssues: issues.length });
          safeDataToSave = repaired;
        } else {
          error('データ修復失敗、保存を中止');
          return { success: false, error: 'Data integrity check failed' };
        }
      }
    }
    
    // ローカルストレージに直接保存
    try {
      await saveMindMap(safeDataToSave.id, safeDataToSave);
      const timestamp = new Date().toLocaleTimeString();
      debug(`保存完了 (${timestamp}): ${safeDataToSave.title}`);
      
      // 手動保存の場合は特別なメッセージを表示
      if (options.isManualSave) {
        info('手動保存が正常に完了しました');
      }
      
      return { success: true, timestamp };
    } catch (err: unknown) {
      error('ローカル保存失敗', { error: err });
      return { success: false, error: err instanceof Error ? err.message : String(err) };
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
      debug('データ初期化開始', { isAppReady });
      
      // ローカルストレージからデータ取得
      const mindMap = await getCurrentMindMap();
      debug('getCurrentMindMap result', { 
        hasData: !!mindMap, 
        hasRootNode: !!(mindMap?.rootNode),
        id: mindMap?.id,
        title: mindMap?.title
      });
      
      if (mindMap && mindMap.rootNode) {
        debug('ローカルストレージから既存データ読み込み');
        const dataWithColors = assignColorsToExistingNodes(mindMap);
        setData(dataWithColors);
        // 初期化時の履歴を設定
        setHistory([deepClone(dataWithColors)]);
        setHistoryIndex(0);
      } else {
        debug('新規マップ作成');
        const newData = createInitialData();
        setData(newData);
        // 新規作成時は即座に保存
        await saveMindMap(newData.id, newData);
        // 初期化時の履歴を設定
        setHistory([deepClone(newData)]);
        setHistoryIndex(0);
      }
      debug('データ初期化完了');
    };

    initializeData();
  }, [isAppReady, data]);


  // 履歴に追加
  const addToHistory = (newData: MindMapData) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(deepClone(newData));
      return newHistory.slice(-50);
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  };

  // データ更新の共通処理（編集中保護強化）
  const updateData = async (newData: MindMapData, options: {
    allowDuringEdit?: boolean;
    source?: string;
    skipHistory?: boolean;
    saveImmediately?: boolean;
    immediate?: boolean;
    onUpdate?: (data: MindMapData, options: { [key: string]: unknown }) => void;
  } = {}) => {
    if (!newData) return;
    
    // 編集中の競合状態を検出・保護
    const editingInput = document.querySelector('.node-input') as HTMLInputElement | null;
    const isCurrentlyEditing = editingInput && document.activeElement === editingInput;
    
    if (isCurrentlyEditing && !options.allowDuringEdit) {
      debug('データ更新スキップ: ノード編集中のため保護', {
        editingValue: editingInput.value,
        updateSource: options.source || 'unknown',
        isExternal: options.skipHistory || false
      });
      return;
    }
    
    setData(newData);
    
    if (!options.skipHistory) {
      addToHistory(newData);
    }
    
    if (options.saveImmediately) {
      await saveImmediately(newData);
    } else if (newData.settings?.autoSave !== false) {
      startAutoSave();
    }
    
    debug('データ更新完了', {
      id: newData.id,
      immediate: options.immediate || false,
      saveImmediately: options.saveImmediately || false,
      skipHistory: options.skipHistory || false,
      wasEditingProtected: isCurrentlyEditing && !options.allowDuringEdit,
      source: options.source || 'unknown',
      allowDuringEdit: options.allowDuringEdit || false,
      wasEditing: isCurrentlyEditing || false
    });
    
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
      await saveImmediately(previousData, { isManualSave: true });
    }
  };

  // Redo
  const redo = async () => {
    if (historyIndex < history.length - 1) {
      const nextData = history[historyIndex + 1];
      setData(nextData);
      setHistoryIndex(prev => prev + 1);
      await saveImmediately(nextData, { isManualSave: true });
    }
  };

  // 設定を更新
  const updateSettings = (newSettings: Partial<MindMapSettings>) => {
    if (!data) return;
    updateData({
      ...data,
      settings: { ...data.settings, ...newSettings }
    });
  };

  // マップタイトルを更新
  const updateTitle = (newTitle: string) => {
    if (!data) return;
    updateData({ ...data, title: newTitle });
  };

  // テーマを変更
  const changeTheme = (themeName: string) => {
    if (!data) return;
    updateData({ ...data, theme: themeName });
  };

  // 初期化時に履歴を設定
  useEffect(() => {
    if (data && history.length === 0) {
      debug('Setting initial history for data', { dataId: data.id });
      setHistory([deepClone(data)]);
      setHistoryIndex(0);
    }
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [data]);

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
    saveMindMap: async () => await saveImmediately(data, { isManualSave: true }),
    setHistory,
    setHistoryIndex,
    triggerLocalSync: async () => await saveImmediately()
  };
};