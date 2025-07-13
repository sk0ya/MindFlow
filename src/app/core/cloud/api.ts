// Cloudflare Workers API integration
import type { MindMapData } from '@shared/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://mindflow-api-production.shigekazukoya.workers.dev';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface MindMapApiResponse extends ApiResponse<MindMapData> {}
export interface MindMapListApiResponse extends ApiResponse<MindMapData[]> {}

/**
 * Cloudflare Workers APIクライアント
 */
export class CloudflareAPI {
  constructor(private getAuthHeaders: () => Record<string, string>) {}

  /**
   * 全マインドマップを取得
   */
  async getMindMaps(): Promise<MindMapData[]> {
    const response = await fetch(`${API_BASE_URL}/api/mindmaps`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return []; // データなし
      }
      throw new Error(`Failed to fetch mindmaps: ${response.statusText}`);
    }

    const result: MindMapListApiResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch mindmaps');
    }

    return result.data || [];
  }

  /**
   * 特定のマインドマップを取得
   */
  async getMindMap(id: string): Promise<MindMapData | null> {
    const response = await fetch(`${API_BASE_URL}/api/mindmaps/${id}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // データなし
      }
      throw new Error(`Failed to fetch mindmap: ${response.statusText}`);
    }

    const result: MindMapApiResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch mindmap');
    }

    return result.data || null;
  }

  /**
   * マインドマップを作成
   */
  async createMindMap(data: MindMapData): Promise<MindMapData> {
    console.log('🆕 API: Creating mindmap:', { id: data.id, title: data.title });
    console.log('📤 API: Request data:', { 
      url: `${API_BASE_URL}/api/mindmaps`,
      dataKeys: Object.keys(data),
      dataSize: JSON.stringify(data).length
    });
    
    const headers = this.getAuthHeaders();
    console.log('🔑 API: Auth headers:', { 
      hasAuth: !!headers.Authorization, 
      authPrefix: headers.Authorization ? headers.Authorization.substring(0, 20) + '...' : 'none',
      contentType: headers['Content-Type']
    });
    
    const response = await fetch(`${API_BASE_URL}/api/mindmaps`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API: Create mindmap failed:', { 
        status: response.status, 
        statusText: response.statusText,
        body: errorText 
      });
      throw new Error(`Failed to create mindmap: ${response.statusText} - ${errorText}`);
    }

    const result: MindMapApiResponse = await response.json();
    console.log('📥 API: Create response:', result);
    
    if (!result.success) {
      console.error('❌ API: Create mindmap API error:', result.error);
      throw new Error(result.error || 'Failed to create mindmap');
    }

    if (!result.data) {
      throw new Error('No data returned from create mindmap');
    }

    return result.data;
  }

  /**
   * マインドマップを更新
   */
  async updateMindMap(data: MindMapData): Promise<MindMapData> {
    console.log('🔄 API: Updating mindmap:', { id: data.id, title: data.title });
    console.log('📤 API: Update request data:', { 
      url: `${API_BASE_URL}/api/mindmaps/${data.id}`,
      dataKeys: Object.keys(data),
      dataSize: JSON.stringify(data).length
    });
    
    const headers = this.getAuthHeaders();
    console.log('🔑 API: Auth headers:', { 
      hasAuth: !!headers.Authorization, 
      authPrefix: headers.Authorization ? headers.Authorization.substring(0, 20) + '...' : 'none',
      contentType: headers['Content-Type']
    });
    
    const response = await fetch(`${API_BASE_URL}/api/mindmaps/${data.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API: Update mindmap failed:', { 
        status: response.status, 
        statusText: response.statusText,
        body: errorText 
      });
      throw new Error(`Failed to update mindmap: ${response.statusText} - ${errorText}`);
    }

    const result: MindMapApiResponse = await response.json();
    console.log('📥 API: Update response:', result);
    
    if (!result.success) {
      console.error('❌ API: Update mindmap API error:', result.error);
      throw new Error(result.error || 'Failed to update mindmap');
    }

    if (!result.data) {
      throw new Error('No data returned from update mindmap');
    }

    return result.data;
  }

  /**
   * マインドマップを削除
   */
  async deleteMindMap(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/mindmaps/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete mindmap: ${response.statusText}`);
    }

    const result: ApiResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete mindmap');
    }
  }

  /**
   * 複数のマインドマップを一括作成/更新
   */
  async syncMindMaps(maps: MindMapData[]): Promise<MindMapData[]> {
    const response = await fetch(`${API_BASE_URL}/api/mindmaps/sync`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ maps }),
    });

    if (!response.ok) {
      throw new Error(`Failed to sync mindmaps: ${response.statusText}`);
    }

    const result: MindMapListApiResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to sync mindmaps');
    }

    return result.data || [];
  }

  /**
   * ユーザープロファイルを取得
   */
  async getUserProfile(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user profile: ${response.statusText}`);
    }

    const result: ApiResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch user profile');
    }

    return result.data;
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

/**
 * デフォルトAPIクライアントファクトリー
 */
export function createCloudflareAPIClient(getAuthHeaders: () => Record<string, string>): CloudflareAPI {
  return new CloudflareAPI(getAuthHeaders);
}

/**
 * データ清理ユーティリティ
 */
export function cleanEmptyNodesFromData(data: MindMapData): MindMapData {
  const cleanNode = (node: any): any => {
    const cleanedNode = {
      ...node,
      text: node.text || '',
      children: (node.children || [])
        .filter((child: any) => child.text && child.text.trim() !== '')
        .map(cleanNode)
    };
    
    return cleanedNode;
  };

  return {
    ...data,
    rootNode: cleanNode(data.rootNode)
  };
}

/**
 * ノード数をカウント
 */
export function countNodes(node: any): number {
  if (!node) return 0;
  
  let count = 1; // 現在のノード
  if (node.children) {
    count += node.children.reduce((sum: number, child: any) => sum + countNodes(child), 0);
  }
  
  return count;
}