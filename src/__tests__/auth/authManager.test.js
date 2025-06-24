/**
 * AuthManager Method Verification Test
 * Verifies that authManager has the correct method names
 */

import { authManager } from '../../features/auth/authManager';

describe('AuthManager Method Names', () => {
  it('should have getAuthToken method (not getToken)', () => {
    expect(typeof authManager.getAuthToken).toBe('function');
    expect(authManager.getToken).toBeUndefined();
  });

  it('should have all required authentication methods', () => {
    expect(typeof authManager.isAuthenticated).toBe('function');
    expect(typeof authManager.getCurrentUser).toBe('function');
    expect(typeof authManager.getAuthHeader).toBe('function');
    expect(typeof authManager.getAuthToken).toBe('function');
    expect(typeof authManager.setAuthData).toBe('function');
    expect(typeof authManager.logout).toBe('function');
  });

  it('should return expected types from key methods', () => {
    // Test when not authenticated
    authManager.token = null;
    authManager.user = null;
    
    expect(authManager.isAuthenticated()).toBe(false);
    expect(authManager.getCurrentUser()).toBeNull();
    expect(authManager.getAuthToken()).toBeNull();
    expect(authManager.getAuthHeader()).toBeNull();
  });

  it('should return expected types when authenticated', () => {
    // Mock authentication state
    const mockToken = 'test-token';
    const mockUser = { id: '123', email: 'test@example.com' };
    
    authManager.token = mockToken;
    authManager.user = mockUser;
    
    expect(authManager.isAuthenticated()).toBe(true);
    expect(authManager.getCurrentUser()).toEqual(mockUser);
    expect(authManager.getAuthToken()).toBe(mockToken);
    expect(authManager.getAuthHeader()).toBe(`Bearer ${mockToken}`);
  });
});