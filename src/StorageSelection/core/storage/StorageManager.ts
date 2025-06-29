import type { StorageMode } from './types';

export class StorageManager {
  private static STORAGE_MODE_KEY = 'mindflow_storage_mode';

  static getStorageMode(): StorageMode | null {
    const mode = localStorage.getItem(this.STORAGE_MODE_KEY);
    return mode as StorageMode | null;
  }

  static setStorageMode(mode: StorageMode): void {
    localStorage.setItem(this.STORAGE_MODE_KEY, mode);
  }

  static clearStorageMode(): void {
    localStorage.removeItem(this.STORAGE_MODE_KEY);
  }
}