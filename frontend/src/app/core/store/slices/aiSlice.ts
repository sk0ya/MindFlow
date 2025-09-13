import { StateCreator } from 'zustand';
import { STORAGE_KEYS, getLocalStorage, setLocalStorage } from '../../../shared/utils/localStorage';

// AI設定の状態型
export interface AISettings {
  enabled: boolean;
  ollamaUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  childGenerationPrompt: string;
}

// デフォルト設定（ユーザーが設定画面で変更できる）
const defaultAISettings: AISettings = {
  enabled: false,
  ollamaUrl: 'http://localhost:11434',
  model: 'llama2', // ユーザーが利用可能なモデルから選択
  maxTokens: 150,
  temperature: 0.7,
  systemPrompt: 'あなたは創造的で論理的な思考を持つAIアシスタントです。ユーザーのマインドマップ作成をサポートします。',
  childGenerationPrompt: '以下のトピックについて、関連する子要素やサブトピックを3〜5個生成してください。各項目は簡潔に1〜3単語で表現してください。\n\nトピック: {parentText}\nコンテキスト: {context}'
};

// AI状態のスライス
export interface AISlice {
  aiSettings: AISettings;
  isGenerating: boolean;
  generationError: string | null;
  
  // AI設定のアクション
  updateAISettings: (settings: Partial<AISettings>) => void;
  resetAISettings: () => void;
  setIsGenerating: (generating: boolean) => void;
  setGenerationError: (error: string | null) => void;
  toggleAIEnabled: () => void;
}

// LocalStorageから設定を読み込む
const loadAISettingsFromStorage = (): AISettings => {
  const result = getLocalStorage(STORAGE_KEYS.AI_SETTINGS, defaultAISettings);
  if (result.success && result.data) {
    return { ...defaultAISettings, ...result.data };
  }
  return defaultAISettings;
};

// LocalStorageに設定を保存する
const saveAISettingsToStorage = (settings: AISettings): void => {
  setLocalStorage(STORAGE_KEYS.AI_SETTINGS, settings);
};

export const createAISlice: StateCreator<any, [], [], AISlice> = (set, get) => ({
  aiSettings: loadAISettingsFromStorage(),
  isGenerating: false,
  generationError: null,
  
  updateAISettings: (newSettings) => {
    const currentSettings = get().aiSettings;
    const updatedSettings = { ...currentSettings, ...newSettings };
    
    set({ aiSettings: updatedSettings });
    saveAISettingsToStorage(updatedSettings);
  },
  
  resetAISettings: () => {
    set({ aiSettings: defaultAISettings });
    saveAISettingsToStorage(defaultAISettings);
  },
  
  setIsGenerating: (generating) => {
    set({ isGenerating: generating });
  },
  
  setGenerationError: (error) => {
    set({ generationError: error });
  },
  
  toggleAIEnabled: () => {
    const currentSettings = get().aiSettings;
    const newSettings = { ...currentSettings, enabled: !currentSettings.enabled };
    
    set({ aiSettings: newSettings });
    saveAISettingsToStorage(newSettings);
  }
});