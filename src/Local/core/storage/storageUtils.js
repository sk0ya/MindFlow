// Local専用のストレージユーティリティ
export const getAppSettings = () => {
  const settings = localStorage.getItem('app-settings');
  return settings ? JSON.parse(settings) : {
    autoSave: true,
    autoLayout: true,
    theme: 'light'
  };
};