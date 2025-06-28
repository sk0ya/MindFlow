// Debug script to test sync functionality
import { cloudAuthManager } from './Cloud/features/auth/cloudAuthManager.js';
import { getAllMindMaps } from './Cloud/core/storage/StorageManager.js';

export const debugSync = async () => {
  console.log('=== Sync Debug Test ===');
  
  // 1. Check authentication status
  try {
    const authState = cloudAuthManager.getAuthState();
    console.log('🔐 Auth State:', {
      isAuthenticated: authState.isAuthenticated,
      user: authState.user?.email || 'None'
    });
  } catch (error) {
    console.error('❌ Auth State check failed:', error);
  }
  
  // 2. Test getting all mindmaps
  try {
    const allMaps = await getAllMindMaps();
    console.log('📋 All Maps:', allMaps.length);
  } catch (error) {
    console.error('❌ Get all maps failed:', error);
  }
  
  console.log('=== Debug Test Complete ===');
};

// Make it available globally for browser console
if (typeof window !== 'undefined') {
  (window as any).debugSync = debugSync;
}