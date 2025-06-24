/**
 * 現在のマップ管理のシンプルなフック
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { storageService } from '../services/storage.js';
import { createInitialMapData, generateId } from '../utils/mapUtils.js';

export function useCurrentMap(mapId) {
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const autoSaveTimeoutRef = useRef(null);
  const lastSaveDataRef = useRef(null);

  // マップデータを読み込み
  const loadMap = useCallback(async (id) => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let data = await storageService.getMap(id);
      
      // マップが見つからない場合は新規作成
      if (!data) {
        data = createInitialMapData(id);
        await storageService.saveMap(data);
      }
      
      setMapData(data);
      lastSaveDataRef.current = JSON.stringify(data);
    } catch (err) {
      setError(err.message);
      console.error('Failed to load map:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // マップデータを保存
  const saveMap = useCallback(async (data = mapData, immediate = false) => {
    if (!data) return;

    // データが変更されていない場合はスキップ
    const currentDataString = JSON.stringify(data);
    if (currentDataString === lastSaveDataRef.current) {
      return;
    }

    if (immediate) {
      setSaving(true);
      try {
        await storageService.saveMap(data);
        lastSaveDataRef.current = currentDataString;
      } catch (err) {
        setError(err.message);
        console.error('Failed to save map:', err);
      } finally {
        setSaving(false);
      }
    } else {
      // 自動保存（デバウンス）
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await storageService.saveMap(data);
          lastSaveDataRef.current = currentDataString;
        } catch (err) {
          console.error('Auto-save failed:', err);
        } finally {
          setSaving(false);
        }
      }, 1000);
    }
  }, [mapData]);

  // マップデータを更新
  const updateMap = useCallback((updater) => {
    setMapData(prev => {
      const newData = typeof updater === 'function' ? updater(prev) : updater;
      
      // 自動保存
      if (storageService.getSettings().autoSave) {
        saveMap(newData, false);
      }
      
      return newData;
    });
  }, [saveMap]);

  // 新しいマップを作成
  const createNewMap = useCallback(async (title = '新しいマインドマップ') => {
    const newId = generateId();
    const newData = createInitialMapData(newId, title);
    
    setMapData(newData);
    
    try {
      await storageService.saveMap(newData);
      return newId;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // mapId が変更されたら新しいマップを読み込み
  useEffect(() => {
    if (mapId) {
      loadMap(mapId);
    }
  }, [mapId, loadMap]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    mapData,
    loading,
    error,
    saving,
    updateMap,
    saveMap,
    createNewMap,
    loadMap,
  };
}