import type { StateCreator } from 'zustand';
import type { MindMapStore } from './types';

export interface AppSettings {
  // テーマ設定
  theme: 'dark' | 'light';
  
  // フォント設定
  fontSize: number;
  fontFamily: string;
}

export interface SettingsSlice {
  settings: AppSettings;
  
  // Settings Actions
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  loadSettingsFromStorage: () => void;
  saveSettingsToStorage: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'system-ui'
};

export const createSettingsSlice: StateCreator<
  MindMapStore,
  [["zustand/immer", never]],
  [],
  SettingsSlice
> = (set, get) => ({
  settings: DEFAULT_SETTINGS,

  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    set((state) => {
      state.settings[key] = value;
    });
    // 設定変更後に自動でlocalStorageに保存
    setTimeout(() => {
      get().saveSettingsToStorage();
    }, 0);
  },

  updateSettings: (newSettings: Partial<AppSettings>) => {
    set((state) => {
      Object.assign(state.settings, newSettings);
    });
    // 設定変更後に自動でlocalStorageに保存
    setTimeout(() => {
      get().saveSettingsToStorage();
    }, 0);
  },

  resetSettings: () => {
    set((state) => {
      state.settings = { ...DEFAULT_SETTINGS };
    });
    get().saveSettingsToStorage();
  },

  loadSettingsFromStorage: () => {
    try {
      const savedSettings = localStorage.getItem('mindflow_app_settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        set((state) => {
          state.settings = { ...DEFAULT_SETTINGS, ...parsedSettings };
        });
      }
    } catch (error) {
      console.error('Failed to load settings from storage:', error);
    }
  },

  saveSettingsToStorage: () => {
    try {
      const { settings } = get();
      localStorage.setItem('mindflow_app_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings to storage:', error);
    }
  },
});