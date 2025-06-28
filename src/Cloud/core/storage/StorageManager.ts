// クラウド専用ストレージマネージャー
// クラウドモード専用、ローカルストレージ依存なし

import { createCloudEngine } from './cloud/CloudEngine.js';
import { authManager } from '../../features/auth/authManager.js';
import { getAppSettings } from './storageUtils.js';
import type { CloudEngine } from './cloud/CloudEngine.js';
import type { MindMapData, Node, StorageResult, SyncStatus } from './types.js';

type StorageEngine = CloudEngine;

export class StorageManager {
  private static instance: StorageManager | null = null;
  private currentEngine: StorageEngine | null = null;
  private lastStorageMode: string | null = null;
  private lastAuthState: boolean | null = null;

  private constructor() {
    console.log('🏭 ストレージマネージャー: 初期化');
  }

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  private getCurrentEngine(): StorageEngine {
    const settings = getAppSettings();
    const currentAuthState = authManager.isAuthenticated();
    const currentStorageMode = settings.storageMode;

    // エンジンの再作成が必要かチェック
    const shouldRecreateEngine = 
      !this.currentEngine ||
      this.lastStorageMode !== currentStorageMode ||
      (currentStorageMode === 'cloud' && this.lastAuthState !== currentAuthState);

    if (shouldRecreateEngine) {
      console.log('🔄 ストレージエンジン切り替え:', {
        reason: !this.currentEngine ? 'initial' : 
                this.lastStorageMode !== currentStorageMode ? 'storage-mode-changed' : 
                'auth-state-changed',
        oldMode: this.lastStorageMode,
        newMode: currentStorageMode,
        oldAuth: this.lastAuthState,
        newAuth: currentAuthState
      });

      this.createEngine(currentStorageMode, currentAuthState);
      this.lastStorageMode = currentStorageMode;
      this.lastAuthState = currentAuthState;
    }

    if (!this.currentEngine) {
      throw new Error('ストレージエンジンが初期化されていません');
    }

    return this.currentEngine;
  }

  private createEngine(storageMode: string, isAuthenticated: boolean): void {
    try {
      console.log('☁️ クラウド専用エンジン作成（認証状態:', isAuthenticated, '）');
      this.currentEngine = createCloudEngine();
    } catch (error) {
      console.error('❌ クラウドエンジン作成失敗:', error);
      throw error;
    }
  }

  // ストレージモード変更時の再初期化
  reinitialize(): void {
    console.log('🔄 ストレージマネージャー再初期化');
    
    // 現在のエンジンをクリア
    this.currentEngine = null;
    this.lastStorageMode = null;
    this.lastAuthState = null;
    
    // 新しいエンジンを作成
    this.getCurrentEngine();
  }

  // 統一インターフェース
  async getAllMaps(): Promise<MindMapData[]> {
    const engine = this.getCurrentEngine();
    return await engine.getAllMaps();
  }

  async getMap(mapId: string): Promise<MindMapData> {
    const engine = this.getCurrentEngine();
    return await engine.getMap(mapId);
  }

  async createMap(mapData: MindMapData): Promise<StorageResult<MindMapData>> {
    const engine = this.getCurrentEngine();
    return await engine.createMap(mapData);
  }

  async updateMap(mapId: string, mapData: MindMapData): Promise<StorageResult<MindMapData>> {
    const engine = this.getCurrentEngine();
    return await engine.updateMap(mapId, mapData);
  }

  async deleteMap(mapId: string): Promise<StorageResult<MindMapData | null | boolean>> {
    const engine = this.getCurrentEngine();
    return await engine.deleteMap(mapId);
  }

  async getCurrentMap(): Promise<MindMapData | null> {
    const engine = this.getCurrentEngine();
    return await engine.getCurrentMap();
  }

  async setCurrentMap(mapData: MindMapData): Promise<StorageResult<MindMapData>> {
    const engine = this.getCurrentEngine();
    return await engine.setCurrentMap(mapData);
  }

  async addNode(mapId: string, nodeData: Node, parentId: string): Promise<StorageResult<Node>> {
    const engine = this.getCurrentEngine();
    return await engine.addNode(mapId, nodeData, parentId);
  }

  async updateNode(mapId: string, nodeId: string, updates: Partial<Node>): Promise<StorageResult<Node>> {
    const engine = this.getCurrentEngine();
    return await engine.updateNode(mapId, nodeId, updates);
  }

  async deleteNode(mapId: string, nodeId: string): Promise<StorageResult<boolean>> {
    const engine = this.getCurrentEngine();
    return await engine.deleteNode(mapId, nodeId);
  }

  async moveNode(mapId: string, nodeId: string, newParentId: string): Promise<StorageResult<boolean>> {
    const engine = this.getCurrentEngine();
    return await engine.moveNode(mapId, nodeId, newParentId);
  }

  async exportMapAsJSON(mapData: MindMapData): Promise<void> {
    const engine = this.getCurrentEngine();
    return await engine.exportMapAsJSON(mapData);
  }

  async importMapFromJSON(file: File): Promise<StorageResult<MindMapData>> {
    const engine = this.getCurrentEngine();
    return await engine.importMapFromJSON(file);
  }

  async testConnection(): Promise<boolean> {
    const engine = this.getCurrentEngine();
    return await engine.testConnection();
  }

  getSyncStatus(): SyncStatus {
    const engine = this.getCurrentEngine();
    return engine.getSyncStatus();
  }

  async hasLocalData(): Promise<boolean> {
    const engine = this.getCurrentEngine();
    return await engine.hasLocalData();
  }

  async cleanupCorruptedData(): Promise<any> {
    const engine = this.getCurrentEngine();
    return await engine.cleanupCorruptedData();
  }

  async clearAllData(): Promise<boolean> {
    const engine = this.getCurrentEngine();
    return await engine.clearAllData();
  }

  // デバッグ情報
  getEngineInfo(): { mode: 'local' | 'cloud', name: string } {
    const engine = this.getCurrentEngine();
    return {
      mode: engine.mode,
      name: engine.name
    };
  }

  // 後方互換性のための旧インターフェース
  async getAllMindMaps(): Promise<MindMapData[]> {
    return await this.getAllMaps();
  }

  async getMindMap(mapId: string): Promise<MindMapData> {
    return await this.getMap(mapId);
  }

  async createMindMap(mapData: MindMapData): Promise<MindMapData> {
    const result = await this.createMap(mapData);
    if (!result.success) {
      throw new Error(result.error || 'マップ作成に失敗しました');
    }
    return result.data!;
  }

  async updateMindMap(mapId: string, mapData: MindMapData): Promise<MindMapData> {
    const result = await this.updateMap(mapId, mapData);
    if (!result.success) {
      throw new Error(result.error || 'マップ更新に失敗しました');
    }
    return result.data!;
  }

  async deleteMindMap(mapId: string): Promise<boolean> {
    const result = await this.deleteMap(mapId);
    return result.success;
  }

  async exportMindMapAsJSON(mapData: MindMapData): Promise<void> {
    return await this.exportMapAsJSON(mapData);
  }

  async importMindMapFromJSON(file: File): Promise<MindMapData> {
    const result = await this.importMapFromJSON(file);
    if (!result.success) {
      throw new Error(result.error || 'インポートに失敗しました');
    }
    return result.data!;
  }
}

// シングルトンインスタンス
export const storageManager = StorageManager.getInstance();

// 便利関数（既存コードとの互換性のため）
export async function getAllMindMaps(): Promise<MindMapData[]> {
  return await storageManager.getAllMaps();
}

export async function getMindMap(mapId: string): Promise<MindMapData> {
  return await storageManager.getMap(mapId);
}

export async function createMindMap(mapData: MindMapData): Promise<MindMapData> {
  return await storageManager.createMindMap(mapData);
}

export async function updateMindMap(mapId: string, mapData: MindMapData): Promise<MindMapData> {
  return await storageManager.updateMindMap(mapId, mapData);
}

export async function deleteMindMap(mapId: string): Promise<boolean> {
  return await storageManager.deleteMindMap(mapId);
}

export async function getCurrentMindMap(): Promise<MindMapData | null> {
  return await storageManager.getCurrentMap();
}

export async function setCurrentMindMap(mapData: MindMapData): Promise<void> {
  const result = await storageManager.setCurrentMap(mapData);
  if (!result.success) {
    throw new Error(result.error || '現在のマップ設定に失敗しました');
  }
}

export async function exportMindMapAsJSON(mapData: MindMapData): Promise<void> {
  return await storageManager.exportMapAsJSON(mapData);
}

export async function importMindMapFromJSON(file: File): Promise<MindMapData> {
  return await storageManager.importMindMapFromJSON(file);
}

export async function testCloudConnection(): Promise<boolean> {
  return await storageManager.testConnection();
}

export function getSyncStatus(): SyncStatus {
  return storageManager.getSyncStatus();
}

export function reinitializeStorage(): void {
  storageManager.reinitialize();
}

export function getStorageEngineInfo(): { mode: 'local' | 'cloud', name: string } {
  return storageManager.getEngineInfo();
}

// ストレージモード設定（storageUtilsから移行）
export async function setStorageMode(mode: 'local' | 'cloud'): Promise<any> {
  const { getAppSettings, saveAppSettings } = await import('./storageUtils.js');
  
  const settings = getAppSettings();
  const updatedSettings = {
    ...settings,
    storageMode: mode,
    autoSave: true,
    cloudSync: mode === 'cloud'
  };
  
  console.log('📝 ストレージモード設定:', mode, updatedSettings);
  await saveAppSettings(updatedSettings);
  
  // ストレージマネージャーを再初期化
  reinitializeStorage();
  
  if (mode === 'cloud') {
    console.log('☁️ クラウドモード: クラウドエンジン使用');
  } else {
    console.log('🏠 ローカルモード: ローカルエンジン使用');
  }
  
  return updatedSettings;
}

// ストレージモード判定
export function isCloudStorageEnabled(): boolean {
  const settings = getAppSettings();
  return settings.storageMode === 'cloud';
}

export function isLocalStorageEnabled(): boolean {
  const settings = getAppSettings();
  return settings.storageMode === 'local';
}

export function isFirstTimeSetup(): boolean {
  const settings = getAppSettings();
  return !settings || !settings.storageMode;
}