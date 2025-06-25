/**
 * @jest-environment jsdom
 */

import { getCurrentAdapter, reinitializeAdapter } from '../storageAdapter.js';
import { authManager } from '../../../features/auth/authManager.js';
import { getAppSettings, setAppSettings } from '../storageUtils.js';

// Mock modules
jest.mock('../../../features/auth/authManager.js', () => ({
  authManager: {
    isAuthenticated: jest.fn(),
    getAuthToken: jest.fn(),
    getCurrentUser: jest.fn()
  }
}));

jest.mock('../storageUtils.js', () => ({
  getAppSettings: jest.fn(),
  setAppSettings: jest.fn()
}));

describe('Storage Adapter Switching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default mock return values
    getAppSettings.mockReturnValue({ storageMode: 'local' });
    authManager.isAuthenticated.mockReturnValue(false);
    authManager.getAuthToken.mockReturnValue(null);
    authManager.getCurrentUser.mockReturnValue(null);
    // Reset any cached adapters
    reinitializeAdapter();
  });

  test('should switch from LocalStorageAdapter to CloudStorageAdapter when user authenticates', () => {
    // Initially not authenticated, cloud mode
    authManager.isAuthenticated.mockReturnValue(false);
    getAppSettings.mockReturnValue({ storageMode: 'cloud' });

    const adapter1 = getCurrentAdapter();
    expect(adapter1.constructor.name).toBe('LocalStorageAdapter');

    // User authenticates
    authManager.isAuthenticated.mockReturnValue(true);
    authManager.getAuthToken.mockReturnValue('mock-token');

    const adapter2 = getCurrentAdapter();
    expect(adapter2.constructor.name).toBe('CloudStorageAdapter');
    expect(adapter2).not.toBe(adapter1); // Should be a different instance
  });

  test('should switch adapters when storage mode changes', () => {
    // Start with local mode
    authManager.isAuthenticated.mockReturnValue(false);
    getAppSettings.mockReturnValue({ storageMode: 'local' });

    const adapter1 = getCurrentAdapter();
    expect(adapter1.constructor.name).toBe('LocalStorageAdapter');

    // Switch to cloud mode (authenticated)
    authManager.isAuthenticated.mockReturnValue(true);
    getAppSettings.mockReturnValue({ storageMode: 'cloud' });

    const adapter2 = getCurrentAdapter();
    expect(adapter2.constructor.name).toBe('CloudStorageAdapter');
    expect(adapter2).not.toBe(adapter1);
  });

  test('should return PendingStorageAdapter when storage mode is not set', () => {
    // Clear cache to ensure fresh state
    reinitializeAdapter();
    getAppSettings.mockReturnValue({ storageMode: null });

    const adapter = getCurrentAdapter();
    expect(adapter.constructor.name).toBe('PendingStorageAdapter');
  });

  test('should fallback to LocalStorageAdapter in cloud mode when not authenticated', () => {
    authManager.isAuthenticated.mockReturnValue(false);
    getAppSettings.mockReturnValue({ storageMode: 'cloud' });

    const adapter = getCurrentAdapter();
    expect(adapter.constructor.name).toBe('LocalStorageAdapter');
  });

  test('should cache adapter when no changes occur', () => {
    authManager.isAuthenticated.mockReturnValue(true);
    getAppSettings.mockReturnValue({ storageMode: 'cloud' });

    const adapter1 = getCurrentAdapter();
    const adapter2 = getCurrentAdapter();
    
    expect(adapter1).toBe(adapter2); // Should be the same instance when cached
  });

  test('should detect authentication state changes correctly', () => {
    // Clear cache first
    reinitializeAdapter();
    
    // Initially authenticated in cloud mode
    getAppSettings.mockReturnValue({ storageMode: 'cloud' });
    authManager.isAuthenticated.mockReturnValue(true);
    authManager.getAuthToken.mockReturnValue('mock-token');

    const adapter1 = getCurrentAdapter();
    expect(adapter1.constructor.name).toBe('CloudStorageAdapter');

    // User logs out
    authManager.isAuthenticated.mockReturnValue(false);
    authManager.getAuthToken.mockReturnValue(null);

    const adapter2 = getCurrentAdapter();
    expect(adapter2.constructor.name).toBe('LocalStorageAdapter');
    expect(adapter2).not.toBe(adapter1); // Should be a different instance
  });
});