import { useState, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { getCurrentMindMap, updateMindMap as saveMindMap } from '../../core/storage/StorageManager.js';
import { deepClone, assignColorsToExistingNodes, createInitialData } from '../../shared/types/dataTypes.js';
import { unifiedAuthManager } from '../auth/UnifiedAuthManager.js';
import { DataIntegrityChecker } from '../../shared/utils/dataIntegrityChecker.js';
// import { unifiedSyncService } from '../../core/sync/UnifiedSyncService.js'; // 削除済み
import type { MindMapData, AuthState } from '../../shared/types/index.js';

interface SaveOptions {
  force?: boolean;
  reason?: string;
}

interface UpdateDataOptions {
  allowDuringEdit?: boolean;
  reason?: string;
  source?: string;
  skipHistory?: boolean;
  saveImmediately?: boolean;
  immediate?: boolean;
  skipRealtimeSync?: boolean;
  onUpdate?: (data: MindMapData, options: UpdateDataOptions) => void;
}

interface UseMindMapDataResult {
  data: MindMapData | null;
  isLoadingFromCloud: boolean;
  history: MindMapData[];
  historyIndex: number;
  setData: Dispatch<SetStateAction<MindMapData | null>>;
  setHistory: (history: MindMapData[]) => void;
  setHistoryIndex: (index: number) => void;
  updateData: (data: Partial<MindMapData>, options?: UpdateDataOptions) => Promise<void>;
  updateTitle: (title: string) => void;
  changeTheme: (theme: string) => void;
  updateSettings: (settings: any) => void;
  saveMindMap: () => Promise<void>;
  triggerCloudSync: () => void;
  blockRealtimeSyncTemporarily: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveImmediately: (dataToSave?: MindMapData | null, options?: SaveOptions) => Promise<void>;
}

// データ管理専用のカスタムフック（統一同期サービス統合版）
export const useMindMapData = (isAppReady: boolean = false): UseMindMapDataResult => {
  // 🔧 緊急修正: 初期データを直接設定してError #310を回避
  const initialData = createInitialData() as any;
  const [data, setData] = useState<MindMapData | null>(initialData);
  const [isLoadingFromCloud] = useState<boolean>(false);
  const [history, setHistory] = useState<MindMapData[]>([initialData]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // isSavingRef removed as it's no longer used
  const syncServiceInitialized = useRef<boolean>(false);

  // 統一同期サービス初期化（正しいReactパターン）
  useEffect(() => {
    if (!syncServiceInitialized.current && isAppReady) {
      syncServiceInitialized.current = true;
      
      const initializeSyncService = async () => {
        try {
          // 認証状態の安全な取得
          let isAuthenticated = false;
          try {
            if (unifiedAuthManager && typeof unifiedAuthManager.getAuthState === 'function') {
              const authState = unifiedAuthManager.getAuthState();
              isAuthenticated = authState.isAuthenticated || false;
            }
          } catch (authError) {
            console.warn('⚠️ 認証状態取得エラー, ローカルモードで続行:', authError);
          }
          
          // モード決定（エラー時はローカルモード）
          const mode = isAuthenticated ? 'cloud' : 'local';
          
          // await unifiedSyncService.initialize(mode, {
          //   apiBaseUrl: 'https://mindflow-api.shigekazukoya.workers.dev'
          // });
          
          console.log(`🔄 統一同期サービス初期化完了: ${mode}モード`);
        } catch (error) {
          console.error('❌ 統一同期サービス初期化失敗:', error);
          // フォールバック: ローカルモードで初期化
          try {
            // await unifiedSyncService.initialize('local');
            console.log('🔄 フォールバック: ローカルモードで初期化完了');
          } catch (fallbackError) {
            console.error('❌ フォールバック初期化も失敗:', fallbackError);
          }
        }
      };
      
      initializeSyncService();
    }
  }, [isAppReady]);

  // 認証状態変更の監視とモード切り替え
  useEffect(() => {
    const handleAuthChange = async (authState: AuthState): Promise<void> => {
      try {
        if (authState.isAuthenticated) {
          console.log('🔑 認証成功: クラウドモードに切り替え');
          // await unifiedSyncService.switchToCloudMode({
          //   apiBaseUrl: 'https://mindflow-api.shigekazukoya.workers.dev'
          // });
          await triggerCloudSync();
        } else {
          console.log('🔐 ログアウト: ローカルモードに切り替え');
          // await unifiedSyncService.switchToLocalMode();
        }
      } catch (error) {
        console.error('❌ 認証状態変更処理エラー:', error);
      }
    };

    // unifiedAuthManagerが利用可能かチェック
    if (unifiedAuthManager && typeof unifiedAuthManager.onAuthStateChange === 'function') {
      return unifiedAuthManager.onAuthStateChange(handleAuthChange);
    } else {
      console.warn('⚠️ unifiedAuthManager.onAuthStateChange is not available');
      return () => {}; // noop cleanup function
    }
  }, []);
  
  // 統一同期サービスを使用した保存機能
  const saveImmediately = async (dataToSave: MindMapData | null = data, options: SaveOptions = {}): Promise<void> => {
    if (!dataToSave || (dataToSave as any).isPlaceholder) return;

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
    
    // 統一同期サービスを使用（編集保護機能付き）
    try {
      // 統一同期サービスが利用可能かチェック
      // フォールバック: 直接保存（統一同期サービス削除のため）
      await saveMindMap(dataToSave.id, dataToSave as any);
      console.log('💾 直接保存完了:', dataToSave.title);
    } catch (error) {
      console.warn('⚠️ 統一同期サービス保存失敗:', (error as Error).message);
      // フォールバック: 直接保存
      try {
        await saveMindMap(dataToSave.id, dataToSave as any);
        console.log('💾 フォールバック保存完了:', dataToSave.title);
      } catch (fallbackError) {
        console.error('❌ フォールバック保存も失敗:', fallbackError);
      }
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
  
  // 🔧 初期化useEffectを削除 - データは最初から設定済み
  useEffect(() => {
    console.log('✅ useMindMapData: 初期データ既に設定済み', {
      hasData: !!data,
      title: data?.title
    });
  }, []); // 一度だけ実行

  // クラウド同期処理（統一）
  // 認証成功時のクラウド同期トリガー（シンプル版）
  const triggerCloudSync = async () => {
    console.log('🔑 認証成功: データ再読み込み');
    // 何もしない（初期化は通常フローに任せる）
  };

  // 履歴に追加
  const addToHistory = (newData: MindMapData) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(deepClone(newData));
      return newHistory.slice(-50);
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  };

  // データ更新の共通処理（リアルタイム同期対応・編集中保護強化）
  const updateData = async (newData: Partial<MindMapData>, options: UpdateDataOptions = {}) => {
    // プレースホルダーデータの場合は更新を無視
    if ((data as any)?.isPlaceholder) {
      console.log('⏳ プレースホルダー中: データ更新をスキップ');
      return;
    }
    
    // 🔧 編集中の競合状態を検出・保護
    const editingInput = document.querySelector('.node-input') as HTMLInputElement;
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
    
    setData(newData as MindMapData);
    
    // リアルタイム操作の適用中でない場合のみ履歴に追加
    if (!options.skipHistory) {
      addToHistory(newData as MindMapData);
    }
    
    // 保存処理
    if (options.saveImmediately) {
      // 即座保存（重要な操作用）
      await saveImmediately(newData as MindMapData, { skipRealtimeSync: options.skipRealtimeSync } as SaveOptions);
    } else if (options.immediate && !options.skipRealtimeSync) {
      // 通常の自動保存（2秒デバウンス）
      // skipRealtimeSyncが指定されている場合は自動保存もスキップ
      startAutoSave();
    }
    
    console.log('🔄 データ更新完了:', {
      id: (newData as MindMapData).id,
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
      options.onUpdate(newData as MindMapData, options);
    }
  };

  // Undo
  const undo = async () => {
    if (historyIndex > 0) {
      const previousData = history[historyIndex - 1];
      if (previousData) {
        setData(previousData);
        setHistoryIndex(prev => prev - 1);
        await saveMindMap(previousData.id, previousData);
      }
    }
  };

  // Redo
  const redo = async () => {
    if (historyIndex < history.length - 1) {
      const nextData = history[historyIndex + 1];
      if (nextData) {
        setData(nextData);
        setHistoryIndex(prev => prev + 1);
        await saveMindMap(nextData.id, nextData);
      }
    }
  };

  // 設定を更新
  const updateSettings = (newSettings: any) => {
    if (data) {
      updateData({
        ...data,
        settings: { ...data.settings, ...newSettings }
      });
    }
  };

  // マップタイトルを更新
  const updateTitle = (newTitle: string) => {
    if (data) {
      updateData({ ...data, title: newTitle });
    }
  };

  // テーマを変更
  const changeTheme = (themeName: string) => {
    if (data) {
      updateData({ ...data, theme: themeName } as Partial<MindMapData>);
    }
  };

  // 初期化時に履歴を設定
  useEffect(() => {
    if (history.length === 0 && data) {
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
  // リアルタイム同期はクラウドエンジンで内部処理（イベントリスナーは削除）

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
    saveMindMap: async () => {
      if (data) {
        await saveMindMap(data.id, data);
      }
    },
    isLoadingFromCloud,
    triggerCloudSync,
    blockRealtimeSyncTemporarily: () => {}
  };
};