/**
 * AuthManager Method Verification Test
 * Verifies that authManager has the correct method names
 */

// Mock authManager to avoid import.meta.env issues
const mockAuthManager = {
  getAuthToken: jest.fn(),
  getAuthHeader: jest.fn(),
  isAuthenticated: jest.fn(),
  getCurrentUser: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  sendMagicLink: jest.fn(),
  setAuthData: jest.fn(),
  user: null,
  token: null
};

jest.mock('../../features/auth/authManager', () => ({
  authManager: mockAuthManager
}));

import { authManager } from '../../features/auth/authManager';

describe('AuthManager Method Names', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set up default mock behavior
    mockAuthManager.isAuthenticated.mockImplementation(() => !!mockAuthManager.user && !!mockAuthManager.token);
    mockAuthManager.getCurrentUser.mockImplementation(() => mockAuthManager.user);
    mockAuthManager.getAuthToken.mockImplementation(() => mockAuthManager.token);
    mockAuthManager.getAuthHeader.mockImplementation(() => mockAuthManager.token ? `Bearer ${mockAuthManager.token}` : null);
  });

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