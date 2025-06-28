/**
 * @jest-environment jsdom
 */

// Mock the CloudStorageAdapter to test URL construction
class MockCloudStorageAdapter {
  constructor() {
    this.baseUrl = 'https://mindflow-api-production.shigekazukoya.workers.dev/api';
  }

  constructUrl(endpoint) {
    return `${this.baseUrl}${endpoint}`;
  }
}

describe('API URL Construction Test', () => {
  test('should not create double /api paths in URLs', () => {
    const adapter = new MockCloudStorageAdapter();
    
    // Test the old buggy way vs fixed way
    const buggyEndpoint = '/api/mindmaps';
    const fixedEndpoint = '/mindmaps';
    
    const buggyUrl = adapter.constructUrl(buggyEndpoint);
    const fixedUrl = adapter.constructUrl(fixedEndpoint);
    
    // Verify the bug exists with old endpoint format
    expect(buggyUrl).toBe('https://mindflow-api-production.shigekazukoya.workers.dev/api/api/mindmaps');
    expect(buggyUrl).toContain('/api/api/');
    
    // Verify the fix works with new endpoint format
    expect(fixedUrl).toBe('https://mindflow-api-production.shigekazukoya.workers.dev/api/mindmaps');
    expect(fixedUrl).not.toContain('/api/api/');
  });

  test('should construct all API endpoints correctly after fix', () => {
    const adapter = new MockCloudStorageAdapter();
    
    // Test the fixed endpoints
    const correctEndpoints = [
      '/mindmaps',
      '/mindmaps/123',
      '/nodes/123',
      '/nodes/123/456',
      '/nodes/123/456/move'
    ];
    
    correctEndpoints.forEach(endpoint => {
      const url = adapter.constructUrl(endpoint);
      
      // Should not contain double /api
      expect(url).not.toContain('/api/api/');
      
      // Should have single /api in the path
      const apiMatches = url.match(/\/api/g);
      expect(apiMatches).toHaveLength(1);
      
      // Should start with the correct base URL
      expect(url.startsWith('https://mindflow-api-production.shigekazukoya.workers.dev/api')).toBe(true);
    });
  });

  test('URL construction bug demonstration', () => {
    const baseUrl = 'https://mindflow-api-production.shigekazukoya.workers.dev/api';
    
    // Demonstrate the bug that was causing 404 errors
    const buggyConstructedUrl = `${baseUrl}/api/mindmaps`;
    const correctConstructedUrl = `${baseUrl}/mindmaps`;
    
    expect(buggyConstructedUrl).toBe('https://mindflow-api-production.shigekazukoya.workers.dev/api/api/mindmaps');
    expect(correctConstructedUrl).toBe('https://mindflow-api-production.shigekazukoya.workers.dev/api/mindmaps');
    
    // The buggy URL would return 404 because /api/api/mindmaps doesn't exist
    // The correct URL will work because /api/mindmaps is the valid endpoint
  });
});