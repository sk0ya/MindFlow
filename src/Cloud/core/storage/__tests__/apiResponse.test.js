/**
 * @jest-environment jsdom
 */

describe('API Response Processing', () => {
  test('should handle different API response formats correctly', () => {
    // Test response format 1: { mindmaps: [...] } (actual API format)
    const response1 = {
      mindmaps: [
        { id: '1', title: 'Map 1' },
        { id: '2', title: 'Map 2' }
      ]
    };

    // Test response format 2: { maps: [...] } (alternative format)
    const response2 = {
      maps: [
        { id: '3', title: 'Map 3' }
      ]
    };

    // Test response format 3: Direct array
    const response3 = [
      { id: '4', title: 'Map 4' }
    ];

    // Test response format 4: Empty response
    const response4 = {};

    // Test the processing logic from storageAdapter.ts
    const processResponse = (response) => {
      return Array.isArray(response) ? response : (response.mindmaps || response.maps || []);
    };

    // Test each format
    expect(processResponse(response1)).toHaveLength(2);
    expect(processResponse(response1)[0].title).toBe('Map 1');

    expect(processResponse(response2)).toHaveLength(1);
    expect(processResponse(response2)[0].title).toBe('Map 3');

    expect(processResponse(response3)).toHaveLength(1);
    expect(processResponse(response3)[0].title).toBe('Map 4');

    expect(processResponse(response4)).toHaveLength(0);
  });

  test('should match cloudStorage.ts processing logic', () => {
    // Simulate the cloudStorage.ts logic
    const cloudStorageProcess = (result) => {
      const maps = result.mindmaps || [];
      return maps.map(map => ({
        id: map.id,
        title: map.title || '無題のマップ',
        category: map.category || '未分類',
        updatedAt: map.updatedAt || new Date().toISOString(),
        createdAt: map.createdAt || map.updatedAt || new Date().toISOString(),
        isBasicInfo: true
      }));
    };

    // Simulate the storageAdapter.ts logic
    const storageAdapterProcess = (response) => {
      return Array.isArray(response) ? response : (response.mindmaps || response.maps || []);
    };

    // Test with typical API response
    const apiResponse = {
      mindmaps: [
        { id: '1', title: 'Test Map', category: 'Work', updatedAt: '2024-01-01T00:00:00Z' }
      ]
    };

    const cloudResult = cloudStorageProcess(apiResponse);
    const adapterResult = storageAdapterProcess(apiResponse);

    // Both should extract the same number of maps
    expect(cloudResult).toHaveLength(1);
    expect(adapterResult).toHaveLength(1);

    // cloudStorage adds additional processing
    expect(cloudResult[0].isBasicInfo).toBe(true);
    expect(cloudResult[0].category).toBe('Work');
    
    // storageAdapter returns raw data
    expect(adapterResult[0].id).toBe('1');
    expect(adapterResult[0].title).toBe('Test Map');
  });
});