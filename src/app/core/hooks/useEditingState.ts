import { useEffect, useCallback } from 'react';
import { EditingStateService, type EditingActivity } from '../services/EditingStateService';
import { logger } from '../../shared/utils/logger';

/**
 * 編集状態を管理するHook
 * コンポーネントが編集アクティビティを開始/終了する際に使用
 */
export const useEditingState = () => {
  const editingStateService = EditingStateService.getInstance();

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      editingStateService.endAllActivities();
    };
  }, [editingStateService]);

  // アクティビティ開始
  const startActivity = useCallback((activity: EditingActivity) => {
    editingStateService.startActivity(activity);
  }, [editingStateService]);

  const endActivity = useCallback((activity: EditingActivity) => {
    editingStateService.endActivity(activity);
  }, [editingStateService]);

  const isEditing = useCallback(() => {
    return editingStateService.isEditing();
  }, [editingStateService]);

  return {
    startActivity,
    endActivity,
    isEditing
  };
};

/**
 * 特定のアクティビティのライフサイクルを管理するHook
 */
export const useActivityLifecycle = (activity: EditingActivity, isActive: boolean) => {
  const { startActivity, endActivity } = useEditingState();

  useEffect(() => {
    if (isActive) {
      startActivity(activity);
      logger.debug(`useActivityLifecycle: Started ${activity}`);
    } else {
      endActivity(activity);
      logger.debug(`useActivityLifecycle: Ended ${activity}`);
    }

    // クリーンアップ
    return () => {
      endActivity(activity);
    };
  }, [isActive, activity, startActivity, endActivity]);
};

