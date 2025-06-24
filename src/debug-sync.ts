// Debug script to test sync functionality
import { authManager } from './features/auth/authManager.js';
import { cloudStorage } from './core/storage/cloudStorage.js';
import { saveMindMap } from './core/storage/storageRouter.js';
import { createInitialData } from './shared/types/dataTypes.js';

export const debugSync = async () => {
  console.log('=== Sync Debug Test ===');
  
  // 1. Check authentication status
  const isAuth = authManager.isAuthenticated();
  const currentUser = authManager.getCurrentUser();
  console.log('🔐 Authentication Status:', {
    isAuthenticated: isAuth,
    currentUser: currentUser ? {
      userId: currentUser.userId,
      email: currentUser.email,
      id: currentUser.id
    } : null
  });
  
  // 2. Check cloud storage getUserId
  try {
    const cloudUserId = await cloudStorage.getUserId();
    console.log('☁️ Cloud Storage User ID:', cloudUserId);
  } catch (error) {
    console.error('❌ Cloud Storage getUserId failed:', error);
  }
  
  // 3. Test cloud connection
  try {
    const connectionTest = await cloudStorage.testConnection();
    console.log('🌐 Cloud Connection Test:', connectionTest);
  } catch (error) {
    console.error('❌ Cloud Connection Test failed:', error);
  }
  
  // 4. Test getting all mindmaps
  try {
    const allMaps = await cloudStorage.getAllMindMaps();
    console.log('📋 All Cloud Maps:', allMaps);
  } catch (error) {
    console.error('❌ Get all maps failed:', error);
  }
  
  // 5. Test sync with a dummy mindmap
  try {
    const testMap = createInitialData();
    testMap.title = 'Sync Test Map - ' + new Date().toISOString();
    
    console.log('🧪 Testing sync with test map:', {
      id: testMap.id,
      title: testMap.title
    });
    
    const syncResult = await saveMindMap(testMap);
    console.log('🔄 Sync Result:', syncResult);
  } catch (error) {
    console.error('❌ Sync Test failed:', error);
  }
  
  console.log('=== Debug Test Complete ===');
};

// Make it available globally for browser console
if (typeof window !== 'undefined') {
  window.debugSync = debugSync;
}