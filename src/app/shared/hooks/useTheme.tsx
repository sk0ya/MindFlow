import { useEffect } from 'react';
import { useMindMapStore } from '../../core/store/mindMapStore';

export const useTheme = () => {
  const { settings } = useMindMapStore();

  useEffect(() => {
    // HTMLのdata-theme属性を更新
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    
    // ボディクラスも更新（既存のスタイルとの互換性のため）
    document.body.className = document.body.className
      .replace(/theme-\w+/g, '')
      .trim();
    document.body.classList.add(`theme-${settings.theme}`);

  }, [settings.theme]);

  return {
    theme: settings.theme,
    setTheme: (theme: 'dark' | 'light') => {
      const { updateSetting } = useMindMapStore.getState();
      updateSetting('theme', theme);
    }
  };
};