// Storage adapter factory - creates appropriate storage adapter based on configuration
import type { StorageAdapter, StorageConfig, StorageMode, StorageAdapterFactory as IStorageAdapterFactory } from './types';
import { LocalStorageAdapter } from './adapters/LocalStorageAdapter';
import { CloudStorageAdapter } from './adapters/CloudStorageAdapter';
import { HybridStorageAdapter } from './adapters/HybridStorageAdapter';

/**
 * ストレージアダプターファクトリー
 * 設定に基づいて適切なストレージアダプターを作成
 */
export class StorageAdapterFactory implements IStorageAdapterFactory {
  /**
   * 設定に基づいてストレージアダプターを作成
   */
  async create(config: StorageConfig): Promise<StorageAdapter> {
    // 設定検証
    this.validateConfig(config);

    switch (config.mode) {
      case 'local':
        return this.createLocalAdapter();
        
      case 'cloud':
        return this.createCloudAdapter(config);
        
      case 'hybrid':
        return this.createHybridAdapter(config);
        
      default:
        throw new Error(`Unsupported storage mode: ${config.mode}`);
    }
  }

  /**
   * 指定されたモードがサポートされているかチェック
   */
  isSupported(mode: StorageMode): boolean {
    const supportedModes: StorageMode[] = ['local', 'cloud', 'hybrid'];
    return supportedModes.includes(mode);
  }

  /**
   * ブラウザがIndexedDBをサポートしているかチェック
   */
  static isIndexedDBSupported(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  }

  /**
   * 設定の検証
   */
  private validateConfig(config: StorageConfig): void {
    if (!config.mode) {
      throw new Error('Storage mode is required');
    }

    if (!this.isSupported(config.mode)) {
      throw new Error(`Unsupported storage mode: ${config.mode}`);
    }

    if ((config.mode === 'cloud' || config.mode === 'hybrid') && !config.authAdapter) {
      throw new Error(`Auth adapter is required for ${config.mode} mode`);
    }

    if (!StorageAdapterFactory.isIndexedDBSupported()) {
      throw new Error('IndexedDB is not supported in this environment');
    }
  }

  /**
   * ローカルストレージアダプターを作成
   */
  private async createLocalAdapter(): Promise<StorageAdapter> {
    const adapter = new LocalStorageAdapter();
    await adapter.initialize();
    console.log('✅ StorageAdapterFactory: Local adapter created');
    return adapter;
  }

  /**
   * クラウドストレージアダプターを作成
   */
  private async createCloudAdapter(config: StorageConfig): Promise<StorageAdapter> {
    if (!config.authAdapter) {
      throw new Error('Auth adapter is required for cloud mode');
    }

    const adapter = new CloudStorageAdapter(config.authAdapter);
    await adapter.initialize();
    console.log('✅ StorageAdapterFactory: Cloud adapter created');
    return adapter;
  }

  /**
   * ハイブリッドストレージアダプターを作成
   */
  private async createHybridAdapter(config: StorageConfig): Promise<StorageAdapter> {
    if (!config.authAdapter) {
      throw new Error('Auth adapter is required for hybrid mode');
    }

    const adapter = new HybridStorageAdapter(config.authAdapter);
    await adapter.initialize();
    console.log('✅ StorageAdapterFactory: Hybrid adapter created');
    return adapter;
  }
}

/**
 * デフォルトファクトリーインスタンス
 */
export const defaultStorageAdapterFactory = new StorageAdapterFactory();

/**
 * 便利な関数 - 設定に基づいてストレージアダプターを作成
 */
export async function createStorageAdapter(config: StorageConfig): Promise<StorageAdapter> {
  return defaultStorageAdapterFactory.create(config);
}

/**
 * 便利な関数 - デフォルト設定でローカルアダプターを作成
 */
export async function createLocalStorageAdapter(): Promise<StorageAdapter> {
  return defaultStorageAdapterFactory.create({ mode: 'local' });
}

/**
 * 便利な関数 - 認証アダプターを使ってクラウドアダプターを作成
 */
export async function createCloudStorageAdapter(authAdapter: any): Promise<StorageAdapter> {
  return defaultStorageAdapterFactory.create({ 
    mode: 'cloud', 
    authAdapter 
  });
}

/**
 * 便利な関数 - 認証アダプターを使ってハイブリッドアダプターを作成
 */
export async function createHybridStorageAdapter(authAdapter: any): Promise<StorageAdapter> {
  return defaultStorageAdapterFactory.create({ 
    mode: 'hybrid', 
    authAdapter 
  });
}