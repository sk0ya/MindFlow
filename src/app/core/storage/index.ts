// Storage abstraction barrel exports
export type {
  StorageAdapter,
  StorageConfig,
  StorageMode,
  SyncStatus,
  StorageEvents,
  StorageAdapterFactory as IStorageAdapterFactory
} from './types';

export { LocalStorageAdapter } from './adapters/LocalStorageAdapter';
export { CloudStorageAdapter } from './adapters/CloudStorageAdapter';

export {
  StorageAdapterFactory,
  defaultStorageAdapterFactory,
  createStorageAdapter,
  createLocalStorageAdapter,
  createCloudStorageAdapter,
} from './StorageAdapterFactory';