// Local専用のストレージユーティリティ
interface AppSettings {
  autoSave: boolean;
  autoLayout: boolean;
  theme: string;
  storageMode?: string;
  showWelcome?: boolean;
}

export const getAppSettings = (): AppSettings => {
  const settings = localStorage.getItem('app-settings');
  return settings ? JSON.parse(settings) : {
    autoSave: true,
    autoLayout: true,
    theme: 'light',
    storageMode: undefined,
    showWelcome: true
  };
};

export const saveAppSettings = (settings: AppSettings): void => {
  localStorage.setItem('app-settings', JSON.stringify(settings));
};