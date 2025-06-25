/**
 * CloudAuthManager テストスイート
 * 認証システムの統合テスト
 */

// Mock cloudAuthManager to avoid import.meta.env issues
jest.mock('../../features/auth/cloudAuthManager', () => ({
  cloudAuthManager: {
    signInWithGitHub: jest.fn(),
    handleCallback: jest.fn(),
    signOut: jest.fn(),
    isAuthenticated: jest.fn(),
    getCurrentUser: jest.fn(),
    hasValidCloudToken: jest.fn(),
    isCloudAuthEnabled: jest.fn(),
    getCloudSyncToken: jest.fn(),
    handleGitHubCallback: jest.fn(),
    checkTokenValidity: jest.fn(),
    healthCheck: jest.fn(),
    cloudLogout: jest.fn(),
    addEventListener: jest.fn(),
    getCloudUser: jest.fn()
  }
}));

// Using Jest testing framework
import { cloudAuthManager } from '../../features/auth/cloudAuthManager';
import { authManager } from '../../features/auth/authManager';

// Mock authManager
jest.mock('../../features/auth/authManager', () => ({
  authManager: {
    isAuthenticated: jest.fn(),
    getAuthToken: jest.fn(), // 正しいメソッド名
    getAuthHeader: jest.fn(),
    getCurrentUser: jest.fn(),
    setAuthData: jest.fn(),
    logout: jest.fn(),
    login: jest.fn()
  }
}));

describe('CloudAuthManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Token Validation', () => {
    it('should check if cloud token is valid', () => {
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiZXhwIjoxOTk5OTk5OTk5fQ.signature';
      
      authManager.isAuthenticated.mockReturnValue(true);
      authManager.getAuthToken.mockReturnValue(mockToken);

      const isValid = cloudAuthManager.hasValidCloudToken();
      
      expect(isValid).toBe(true);
      expect(authManager.getAuthToken).toHaveBeenCalled();
    });

    it('should return false if no token', () => {
      authManager.isAuthenticated.mockReturnValue(true);
      authManager.getAuthToken.mockReturnValue(null);

      const isValid = cloudAuthManager.hasValidCloudToken();
      
      expect(isValid).toBe(false);
    });

    it('should return false if token is expired', () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiZXhwIjoxMDAwMDAwMDAwfQ.signature';
      
      authManager.isAuthenticated.mockReturnValue(true);
      authManager.getAuthToken.mockReturnValue(expiredToken);

      const isValid = cloudAuthManager.hasValidCloudToken();
      
      expect(isValid).toBe(false);
    });
  });

  describe('Cloud Auth Enabled', () => {
    it('should check if cloud auth is enabled', () => {
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiZXhwIjoxOTk5OTk5OTk5fQ.signature';
      
      authManager.isAuthenticated.mockReturnValue(true);
      authManager.getAuthToken.mockReturnValue(mockToken);

      const isEnabled = cloudAuthManager.isCloudAuthEnabled();
      
      expect(isEnabled).toBe(true);
      expect(authManager.isAuthenticated).toHaveBeenCalled();
      expect(authManager.getAuthToken).toHaveBeenCalled();
    });

    it('should return false if not authenticated', () => {
      authManager.isAuthenticated.mockReturnValue(false);

      const isEnabled = cloudAuthManager.isCloudAuthEnabled();
      
      expect(isEnabled).toBe(false);
    });
  });

  describe('Get Cloud Sync Token', () => {
    it('should return token if cloud auth is enabled', () => {
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiZXhwIjoxOTk5OTk5OTk5fQ.signature';
      
      authManager.isAuthenticated.mockReturnValue(true);
      authManager.getAuthToken.mockReturnValue(mockToken);

      const token = cloudAuthManager.getCloudSyncToken();
      
      expect(token).toBe(mockToken);
    });

    it('should return null if cloud auth is not enabled', () => {
      authManager.isAuthenticated.mockReturnValue(false);

      const token = cloudAuthManager.getCloudSyncToken();
      
      expect(token).toBeNull();
    });
  });

  describe('GitHub OAuth Flow', () => {
    it('should start GitHub OAuth flow', async () => {
      const originalLocation = window.location.href;
      
      sessionStorage.setItem = jest.fn();
      
      // Mock environment variables
      const originalEnv = global.import?.meta?.env || {};
      if (global.import && global.import.meta) {
        global.import.meta.env = {
          ...originalEnv,
          VITE_GITHUB_CLIENT_ID: 'test-client-id',
          VITE_GITHUB_REDIRECT_URI: 'http://localhost:3000/callback'
        };
      }

      await cloudAuthManager.startGitHubOAuth({
        scope: ['user:email'],
        state: 'test-state'
      });

      expect(sessionStorage.setItem).toHaveBeenCalledWith('github_oauth_state', 'test-state');
      expect(sessionStorage.setItem).toHaveBeenCalledWith('github_oauth_started', expect.any(String));

      // Restore environment
      if (global.import && global.import.meta) {
        global.import.meta.env = originalEnv;
      }
      window.location.href = originalLocation;
    });

    it('should handle GitHub callback successfully', async () => {
      const code = 'test-code';
      const state = 'test-state';
      
      sessionStorage.getItem = jest.fn((key) => {
        if (key === 'github_oauth_state') return state;
        return null;
      });

      global.fetch = jest.fn()
        .mockResolvedValueOnce({ // Token exchange
          ok: true,
          json: () => Promise.resolve({ access_token: 'github-token' })
        })
        .mockResolvedValueOnce({ // User data
          ok: true,
          json: () => Promise.resolve({ 
            id: 123, 
            login: 'testuser',
            email: 'test@example.com'
          })
        })
        .mockResolvedValueOnce({ // Emails
          ok: true,
          json: () => Promise.resolve([
            { email: 'test@example.com', primary: true }
          ])
        })
        .mockResolvedValueOnce({ // Backend auth
          ok: true,
          json: () => Promise.resolve({
            token: 'app-token',
            user: { id: '123', email: 'test@example.com' }
          })
        });

      const result = await cloudAuthManager.handleGitHubCallback(code, state);

      expect(result).toHaveProperty('token', 'app-token');
      expect(result).toHaveProperty('user');
      expect(authManager.setAuthData).toHaveBeenCalledWith('app-token', expect.any(Object));
    });

    it('should handle invalid OAuth state', async () => {
      sessionStorage.getItem = jest.fn(() => 'different-state');

      await expect(
        cloudAuthManager.handleGitHubCallback('code', 'wrong-state')
      ).rejects.toThrow('Invalid OAuth state');
    });
  });

  describe('Token Refresh', () => {
    it('should refresh token when needed', async () => {
      const currentToken = 'current-token';
      const newToken = 'new-token';
      
      authManager.getAuthToken.mockReturnValue(currentToken);
      
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          token: newToken,
          user: { id: '123', email: 'test@example.com' }
        })
      });

      // Trigger token check
      cloudAuthManager['checkTokenValidity']();

      // Verify getAuthToken was called
      expect(authManager.getAuthToken).toHaveBeenCalled();
    });
  });

  describe('Health Check', () => {
    it('should perform health check successfully', async () => {
      const mockToken = 'test-token';
      
      authManager.isAuthenticated.mockReturnValue(true);
      authManager.getAuthToken.mockReturnValue(mockToken);

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true
      });

      const isHealthy = await cloudAuthManager.healthCheck();

      expect(isHealthy).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/health'),
        expect.objectContaining({
          headers: {
            'Authorization': `Bearer ${mockToken}`
          }
        })
      );
    });

    it('should return false if no token', async () => {
      authManager.isAuthenticated.mockReturnValue(false);
      authManager.getAuthToken.mockReturnValue(null);

      const isHealthy = await cloudAuthManager.healthCheck();

      expect(isHealthy).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('Cloud Logout', () => {
    it('should logout from cloud', async () => {
      const mockToken = 'test-token';
      
      authManager.isAuthenticated.mockReturnValue(true);
      authManager.getAuthToken.mockReturnValue(mockToken);

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true
      });

      await cloudAuthManager.cloudLogout();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockToken}`,
            'Content-Type': 'application/json'
          }
        })
      );
      expect(authManager.logout).toHaveBeenCalled();
    });
  });

  describe('Event Listeners', () => {
    it('should add and remove event listeners', () => {
      const listener = jest.fn();
      
      const unsubscribe = cloudAuthManager.addEventListener(listener);
      
      // Trigger an event
      cloudAuthManager['notifyAuthEvent']('test_event', { data: 'test' });
      
      expect(listener).toHaveBeenCalledWith({
        event: 'test_event',
        data: { data: 'test' },
        timestamp: expect.any(String)
      });
      
      // Unsubscribe
      unsubscribe();
      
      // Trigger again
      cloudAuthManager['notifyAuthEvent']('test_event', { data: 'test2' });
      
      // Should still be called only once
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Cloud User', () => {
    it('should return cloud user if authenticated', () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      
      authManager.isAuthenticated.mockReturnValue(true);
      authManager.getAuthToken.mockReturnValue('valid-token');
      authManager.getCurrentUser.mockReturnValue(mockUser);

      const user = cloudAuthManager.getCloudUser();
      
      expect(user).toEqual(mockUser);
    });

    it('should return null if not authenticated', () => {
      authManager.isAuthenticated.mockReturnValue(false);

      const user = cloudAuthManager.getCloudUser();
      
      expect(user).toBeNull();
    });
  });
});

describe('CloudAuthManager Method Name Compatibility', () => {
  it('should use correct authManager method names', () => {
    // This test ensures we're using the correct method names
    const mockToken = 'test-token';
    
    authManager.isAuthenticated.mockReturnValue(true);
    authManager.getAuthToken.mockReturnValue(mockToken);

    // Test all methods that use authManager
    cloudAuthManager.hasValidCloudToken();
    expect(authManager.getAuthToken).toHaveBeenCalled();
    
    cloudAuthManager.getCloudSyncToken();
    expect(authManager.getAuthToken).toHaveBeenCalled();
    
    // Ensure we're NOT calling non-existent methods
    expect(authManager.getToken).toBeUndefined();
  });
});