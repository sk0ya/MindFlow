// StorageSelection専用のStorageManager
export class StorageManager {
  static getStorageMode() {
    return localStorage.getItem('storage-mode') || null; // 未設定の場合はnullを返す
  }
  
  static setStorageMode(mode: string) {
    localStorage.setItem('storage-mode', mode);
  }
  
  static clearStorageMode() {
    localStorage.removeItem('storage-mode');
  }
}

// App settings functions
export function getAppSettings() {
  try {
    const settings = localStorage.getItem('app-settings');
    if (settings) {
      return JSON.parse(settings);
    }
  } catch (error) {
    console.warn('Failed to parse app settings:', error);
  }
  
  // Default settings
  return {
    storageMode: StorageManager.getStorageMode(),
    cloudSync: false,
    autoSave: true,
    autoLayout: true
  };
}

export function saveAppSettings(settings: any) {
  try {
    localStorage.setItem('app-settings', JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save app settings:', error);
  }
}