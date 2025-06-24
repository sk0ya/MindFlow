/**
 * Method Name Compatibility Test
 * Verifies the fix for "authManager.getToken is not a function" error
 */

describe('AuthManager Method Name Compatibility', () => {
  it('should verify cloudAuthManager uses correct authManager method names', () => {
    // Read the cloudAuthManager source code to verify it uses getAuthToken
    const fs = require('fs');
    const path = require('path');
    
    const cloudAuthManagerPath = path.join(__dirname, '../../features/auth/cloudAuthManager.ts');
    const sourceCode = fs.readFileSync(cloudAuthManagerPath, 'utf8');
    
    // Verify that the source code uses getAuthToken() instead of getToken()
    expect(sourceCode).toContain('authManager.getAuthToken()');
    expect(sourceCode).not.toContain('authManager.getToken()');
    
    // Count the occurrences to ensure all instances were fixed
    const getAuthTokenMatches = sourceCode.match(/authManager\.getAuthToken\(\)/g) || [];
    const getTokenMatches = sourceCode.match(/authManager\.getToken\(\)/g) || [];
    
    // Should have multiple uses of getAuthToken and zero uses of getToken
    expect(getAuthTokenMatches.length).toBeGreaterThan(0);
    expect(getTokenMatches.length).toBe(0);
    
    console.log(`✅ Found ${getAuthTokenMatches.length} correct getAuthToken() calls`);
    console.log(`✅ Found ${getTokenMatches.length} incorrect getToken() calls (should be 0)`);
  });

  it('should verify authManager actually has getAuthToken method', () => {
    const fs = require('fs');
    const path = require('path');
    
    const authManagerPath = path.join(__dirname, '../../features/auth/authManager.ts');
    const sourceCode = fs.readFileSync(authManagerPath, 'utf8');
    
    // Verify that authManager defines getAuthToken method
    expect(sourceCode).toContain('getAuthToken()');
    expect(sourceCode).toContain('return this.token');
    
    console.log('✅ AuthManager has getAuthToken() method defined');
  });

  it('should verify the specific lines that were fixed', () => {
    const fs = require('fs');
    const path = require('path');
    
    const cloudAuthManagerPath = path.join(__dirname, '../../features/auth/cloudAuthManager.ts');
    const sourceCode = fs.readFileSync(cloudAuthManagerPath, 'utf8');
    const lines = sourceCode.split('\n');
    
    // Check specific lines that were fixed based on the error context
    const problematicLines = [
      'const token = authManager.getAuthToken();',
      'return authManager.getAuthToken();',
      'const currentToken = authManager.getAuthToken();'
    ];
    
    problematicLines.forEach(expectedLine => {
      const foundLine = lines.some(line => line.trim().includes(expectedLine.trim()));
      expect(foundLine).toBe(true);
    });
    
    console.log('✅ All fixed method calls verified in source code');
  });
});