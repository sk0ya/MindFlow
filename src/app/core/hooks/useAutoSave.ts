import { useEffect, useRef, useCallback } from 'react';
import { logger } from '../../shared/utils/logger';
import type { MindMapData } from '@shared/types';

interface AutoSaveOptions {
  debounceMs?: number;
  enabled?: boolean;
}

interface AutoSaveCallbacks {
  saveData: (_data: MindMapData) => Promise<void>;
  updateMapInList: (_data: MindMapData) => Promise<void>;
}

/**
 * 自動保存機能を提供するhook
 */
export const useAutoSave = (
  data: MindMapData | null,
  callbacks: AutoSaveCallbacks,
  options: AutoSaveOptions = {},
  settings?: { autoSave?: boolean; autoSaveInterval?: number }
) => {
  const { debounceMs = settings?.autoSaveInterval || 300, enabled = settings?.autoSave ?? options.enabled ?? true } = options;
  const { saveData, updateMapInList } = callbacks;

  const lastSaveTimeRef = useRef<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMapIdRef = useRef<string>('');

  const performAutoSave = useCallback(async (currentData: MindMapData) => {
    try {
      await saveData(currentData);
      await updateMapInList(currentData);
      logger.info('Auto save completed:', currentData.title);
      lastSaveTimeRef.current = currentData.updatedAt || '';
    } catch (error) {
      logger.error('Auto save failed:', error);
    }
  }, [saveData, updateMapInList]);

  useEffect(() => {
    if (!enabled || !data) return;

    const currentUpdatedAt = data.updatedAt || '';
    const currentMapId = data.id || '';

    // マップが切り替わった場合は保存しない
    if (currentMapId !== lastMapIdRef.current) {
      lastMapIdRef.current = currentMapId;
      lastSaveTimeRef.current = currentUpdatedAt;
      return;
    }

    // updatedAtが変更されていない場合は保存しない
    if (currentUpdatedAt === lastSaveTimeRef.current || !currentUpdatedAt) {
      return;
    }

    // 既存のタイマーをクリア
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // デバウンス保存
    saveTimeoutRef.current = setTimeout(() => {
      performAutoSave(data);
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [data?.updatedAt, data?.id, enabled, performAutoSave, debounceMs, data]);

  const saveManually = useCallback(async () => {
    if (data) {
      await performAutoSave(data);
    }
  }, [data, performAutoSave]);

  return { saveManually };
};