import { StateCreator } from 'zustand';

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

// AI設定をlocalStorageに保存するキー
const AI_SETTINGS_STORAGE_KEY = 'mindflow_ai_settings';

// LocalStorageから設定を読み込む
const loadAISettingsFromStorage = (): AISettings => {
  try {
    const stored = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultAISettings, ...parsed };
    }
  } catch (error) {
    console.warn('Failed to load AI settings from localStorage:', error);
  }
  return defaultAISettings;
};

// LocalStorageに設定を保存する
const saveAISettingsToStorage = (settings: AISettings): void => {
  try {
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save AI settings to localStorage:', error);
  }
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