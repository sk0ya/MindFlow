import { useMindMap } from './useMindMap.js';
import { useState, useEffect } from 'react';

/**
 * アプリのレンダリング状態を管理するシンプルなフック（Local mode用）
 * 認証やストレージモード選択などの複雑な処理は不要
 */
export const useAppRender = () => {
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // ローカルモードでは簡単な初期化のみ
  useEffect(() => {
    const initialize = async () => {
      // 簡単な初期化（設定読み込みなど）
      await new Promise(resolve => setTimeout(resolve, 100)); // 短い遅延
      setIsInitializing(false);
      setIsReady(true);
    };

    initialize();
  }, []);

  const mindMap = useMindMap(isReady);

  // レンダリングタイプを決定（ローカルモード用に簡略化）
  const getRenderType = () => {
    // 1. 初期化中
    if (isInitializing) {
      return { type: 'LOADING', props: { message: 'アプリケーションを初期化中...' } };
    }

    // 2. 準備未完了
    if (!isReady) {
      return { type: 'LOADING', props: { message: '準備中...' } };
    }

    // 3. データ読み込み中
    if (isReady && !mindMap.data) {
      return { type: 'LOADING', props: { message: 'データを読み込み中...' } };
    }

    // 4. データなし（エラー状態）
    if (!mindMap.data) {
      return { type: 'LOADING', props: { message: 'データ読み込みエラー...' } };
    }

    // 5. メインアプリ表示
    return { type: 'MAIN_APP', props: {} };
  };

  const renderType = getRenderType();

  // デバッグログ（簡潔）
  console.log('🎨 Render:', renderType.type, {
    isReady,
    hasData: !!mindMap.data,
    isInitializing
  });

  return {
    renderType,
    mindMap,
    initState: {
      isReady,
      isInitializing,
      storageMode: 'local'
    }
  };
};