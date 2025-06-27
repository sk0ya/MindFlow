export type StorageMode = 'local' | 'cloud';

export interface StorageConfig {
  mode: StorageMode;
  initialized: boolean;
}