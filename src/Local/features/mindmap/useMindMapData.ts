import { useState, useEffect, useRef } from 'react';
import { getCurrentMindMap, updateMindMap as saveMindMap, getAllMindMaps, getMindMap } from '../../core/storage/LocalEngine';
import { deepClone, assignColorsToExistingNodes, createInitialData } from '../../shared/types/dataTypes';
import { DataIntegrityChecker } from '../../shared/utils/dataIntegrityChecker';

// データ管理専用のカスタムフック（ローカルモード専用）
export const useMindMapData = (isAppReady = false) => {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const autoSaveTimeoutRef = useRef(null);


  
  // ローカルストレージへの保存機能
  const saveImmediately = async (dataToSave = data, options = {}) => {
    if (!dataToSave) return;

    // データ整合性チェック
    const integrityResult = DataIntegrityChecker.checkMindMapIntegrity(dataToSave);
    if (!integrityResult.isValid) {
      console.warn('⚠️ 保存前データ整合性チェック失敗');
      DataIntegrityChecker.logIntegrityReport(integrityResult, dataToSave);
      
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
    
    // ローカルストレージに直接保存
    try {
      await saveMindMap(dataToSave.id, dataToSave);
      console.log('💾 ローカル保存完了:', dataToSave.title);
    } catch (error) {
      console.error('❌ ローカル保存失敗:', error);
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
      
      // ローカルストレージからデータ取得
      const mindMap = await getCurrentMindMap();
      if (mindMap && mindMap.rootNode) {
        console.log('📊 ローカルストレージから既存データ読み込み');
        setData(assignColorsToExistingNodes(mindMap));
      } else {
        console.log('📊 新規マップ作成');
        setData(createInitialData());
      }
      console.log('✅ データ初期化完了');
    };

    initializeData();
  }, [isAppReady, data]);


  // 履歴に追加
  const addToHistory = (newData) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(deepClone(newData));
      return newHistory.slice(-50);
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  };

  // データ更新の共通処理（編集中保護強化）
  const updateData = async (newData, options = {}) => {
    // ローカルモードでは常にデータ更新を処理
    if (!newData) return;
    
    // 🔧 編集中の競合状態を検出・保護
    const editingInput = document.querySelector('.node-input');
    const isCurrentlyEditing = editingInput && document.activeElement === editingInput;
    
    if (isCurrentlyEditing && !options.allowDuringEdit) {
      console.log('✋ データ更新スキップ: ノード編集中のため保護', {
        editingValue: editingInput.value,
        updateSource: options.source || 'unknown',
        isExternal: options.skipHistory || false
      });
      
      // 編集中は外部からの更新をスキップして編集を保護
      // ただし、明示的に許可された場合は更新を実行
      return;
    }
    
    setData(newData);
    
    // 外部操作の適用中でない場合のみ履歴に追加
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
      await saveMindMap(previousData.id, previousData);
    }
  };

  // Redo
  const redo = async () => {
    if (historyIndex < history.length - 1) {
      const nextData = history[historyIndex + 1];
      setData(nextData);
      setHistoryIndex(prev => prev + 1);
      await saveMindMap(nextData.id, nextData);
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

  // ローカルモードでは追加の同期処理は不要

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
    saveMindMap: async () => await saveMindMap(data.id, data)
  };
};