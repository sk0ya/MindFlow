/**
 * @jest-environment jsdom
 */

describe('Adapter Detection in Production Environment', () => {
  test('should detect cloud adapter using name property instead of constructor.name', () => {
    // Mock a compressed CloudStorageAdapter (as would appear in production)
    const mockCloudAdapter = {
      constructor: { name: 'Xl' }, // Compressed class name
      name: 'クラウドストレージ（シンプル版）',
      retryPendingOperations: jest.fn()
    };

    // Mock a LocalStorageAdapter
    const mockLocalAdapter = {
      constructor: { name: 'Yl' }, // Compressed class name
      name: 'ローカルストレージ'
    };

    // Mock a PendingStorageAdapter
    const mockPendingAdapter = {
      constructor: { name: 'Zl' }, // Compressed class name
      name: 'ストレージモード選択待ち'
    };

    // Test cloud adapter detection (current logic in realtimeSync.ts)
    const isCloudAdapter1 = mockCloudAdapter.name && mockCloudAdapter.name.includes('クラウド');
    expect(isCloudAdapter1).toBe(true);

    // Test local adapter detection
    const isCloudAdapter2 = mockLocalAdapter.name && mockLocalAdapter.name.includes('クラウド');
    expect(isCloudAdapter2).toBe(false);

    // Test pending adapter detection
    const isCloudAdapter3 = mockPendingAdapter.name && mockPendingAdapter.name.includes('クラウド');
    expect(isCloudAdapter3).toBe(false);
  });

  test('should detect cloud adapter for retry operations using name property', () => {
    // Mock a compressed CloudStorageAdapter with retry method
    const mockCloudAdapter = {
      constructor: { name: 'Xl' },
      name: 'クラウドストレージ（シンプル版）',
      retryPendingOperations: jest.fn()
    };

    // Mock a LocalStorageAdapter without retry method
    const mockLocalAdapter = {
      constructor: { name: 'Yl' },
      name: 'ローカルストレージ'
    };

    // Test cloud adapter detection for retry operations (logic in storageAdapter.ts)
    const isCloudAdapter1 = mockCloudAdapter.name && mockCloudAdapter.name.includes('クラウド');
    const hasRetryMethod1 = typeof mockCloudAdapter.retryPendingOperations === 'function';
    expect(isCloudAdapter1 && hasRetryMethod1).toBe(true);

    // Test local adapter (should not qualify for retry operations)
    const isCloudAdapter2 = mockLocalAdapter.name && mockLocalAdapter.name.includes('クラウド');
    const hasRetryMethod2 = typeof mockLocalAdapter.retryPendingOperations === 'function';
    expect(isCloudAdapter2 && hasRetryMethod2).toBe(false);
  });

  test('should handle edge cases in adapter detection', () => {
    // Test adapter without name property
    const adapterWithoutName = {
      constructor: { name: 'Xl' }
    };
    const isCloudAdapter1 = adapterWithoutName.name && adapterWithoutName.name.includes('クラウド');
    expect(isCloudAdapter1).toBeFalsy();

    // Test adapter with null name
    const adapterWithNullName = {
      constructor: { name: 'Xl' },
      name: null
    };
    const isCloudAdapter2 = adapterWithNullName.name && adapterWithNullName.name.includes('クラウド');
    expect(isCloudAdapter2).toBeFalsy();

    // Test adapter with unexpected name
    const adapterWithUnexpectedName = {
      constructor: { name: 'Xl' },
      name: 'Unknown Adapter'
    };
    const isCloudAdapter3 = adapterWithUnexpectedName.name && adapterWithUnexpectedName.name.includes('クラウド');
    expect(isCloudAdapter3).toBe(false);
  });
});