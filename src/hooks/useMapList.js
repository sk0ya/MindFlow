/**
 * マップ一覧管理のシンプルなフック
 */

import { useState, useEffect, useCallback } from 'react';
import { storageService } from '../services/storageService.js';

export function useMapList() {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // マップ一覧を読み込み
  const loadMaps = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const mapList = await storageService.getMaps();
      setMaps(mapList);
    } catch (err) {
      setError(err.message);
      console.error('Failed to load maps:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // マップ削除
  const deleteMap = useCallback(async (mapId) => {
    try {
      await storageService.deleteMap(mapId);
      setMaps(prev => prev.filter(m => m.id !== mapId));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, []);

  // 初回読み込み
  useEffect(() => {
    loadMaps();
  }, [loadMaps]);

  return {
    maps,
    loading,
    error,
    loadMaps,
    deleteMap,
  };
}