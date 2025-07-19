// Cloudflare Workers API integration
import type { MindMapData } from '@shared/types';
import { logger } from '../../shared/utils/logger';

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
      throw new Error(`マインドマップの取得に失敗しました: ${response.statusText}`);
    }

    const result: MindMapListApiResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'マインドマップの取得に失敗しました');
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
      throw new Error(`マインドマップの取得に失敗しました: ${response.statusText}`);
    }

    const result: MindMapApiResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'マインドマップの取得に失敗しました');
    }

    return result.data || null;
  }

  /**
   * マインドマップを作成
   */
  async createMindMap(data: MindMapData): Promise<MindMapData> {
    logger.debug('🆕 API: Creating mindmap:', { id: data.id, title: data.title });
    logger.debug('📤 API: Request data:', { 
      url: `${API_BASE_URL}/api/mindmaps`,
      dataKeys: Object.keys(data),
      dataSize: JSON.stringify(data).length
    });
    
    const headers = this.getAuthHeaders();
    logger.debug('🔑 API: Auth headers:', { 
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
      logger.error('❌ API: Create mindmap failed:', { 
        status: response.status, 
        statusText: response.statusText,
        body: errorText 
      });
      throw new Error(`マインドマップの作成に失敗しました: ${response.statusText}`);
    }

    const result: MindMapApiResponse = await response.json();
    logger.debug('📥 API: Create response:', result);
    
    if (!result.success) {
      logger.error('❌ API: Create mindmap API error:', result.error);
      throw new Error(result.error || 'マインドマップの作成に失敗しました');
    }

    if (!result.data) {
      throw new Error('マインドマップ作成レスポンスにデータがありません');
    }

    return result.data;
  }

  /**
   * マインドマップを更新
   */
  async updateMindMap(data: MindMapData): Promise<MindMapData> {
    logger.debug('🔄 API: Updating mindmap:', { id: data.id, title: data.title });
    logger.debug('📤 API: Update request data:', { 
      url: `${API_BASE_URL}/api/mindmaps/${data.id}`,
      dataKeys: Object.keys(data),
      dataSize: JSON.stringify(data).length
    });
    
    const headers = this.getAuthHeaders();
    logger.debug('🔑 API: Auth headers:', { 
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
      logger.error('❌ API: Update mindmap failed:', { 
        status: response.status, 
        statusText: response.statusText,
        body: errorText 
      });
      throw new Error(`マインドマップの更新に失敗しました: ${response.statusText}`);
    }

    const result: MindMapApiResponse = await response.json();
    logger.debug('📥 API: Update response:', result);
    
    if (!result.success) {
      logger.error('❌ API: Update mindmap API error:', result.error);
      throw new Error(result.error || 'マインドマップの更新に失敗しました');
    }

    if (!result.data) {
      throw new Error('マインドマップ更新レスポンスにデータがありません');
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
      throw new Error(`マインドマップの削除に失敗しました: ${response.statusText}`);
    }

    const result: ApiResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'マインドマップの削除に失敗しました');
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
      throw new Error(`マインドマップの同期に失敗しました: ${response.statusText}`);
    }

    const result: MindMapListApiResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'マインドマップの同期に失敗しました');
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
      throw new Error(`ユーザープロファイルの取得に失敗しました: ${response.statusText}`);
    }

    const result: ApiResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'ユーザープロファイルの取得に失敗しました');
    }

    return result.data;
  }

  /**
   * ファイルをアップロード
   */
  async uploadFile(mindmapId: string, nodeId: string, file: File): Promise<any> {
    logger.info('📤 API: Uploading file:', { mindmapId, nodeId, fileName: file.name, fileSize: file.size });
    
    const formData = new FormData();
    formData.append('file', file);
    
    const headers = this.getAuthHeaders();
    // FormDataを使用する場合はContent-Typeを削除（ブラウザが自動設定）
    delete headers['Content-Type'];
    
    logger.debug('🔑 API: Upload headers:', { 
      hasAuth: !!headers.Authorization, 
      authPrefix: headers.Authorization ? headers.Authorization.substring(0, 20) + '...' : 'none'
    });
    
    const response = await fetch(`${API_BASE_URL}/api/files/${mindmapId}/${nodeId}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('❌ API: File upload failed:', { 
        status: response.status, 
        statusText: response.statusText,
        body: errorText 
      });
      throw new Error(`ファイルのアップロードに失敗しました: ${response.statusText}`);
    }

    const result = await response.json();
    logger.debug('📥 API: Upload response:', result);
    
    return result;
  }

  /**
   * ファイルを削除
   */
  async deleteFile(mindmapId: string, nodeId: string, fileId: string): Promise<void> {
    logger.info('🗑️ API: Deleting file:', { mindmapId, nodeId, fileId });
    
    const response = await fetch(`${API_BASE_URL}/api/files/${mindmapId}/${nodeId}/${fileId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('❌ API: File delete failed:', { 
        status: response.status, 
        statusText: response.statusText,
        body: errorText 
      });
      throw new Error(`ファイルの削除に失敗しました: ${response.statusText}`);
    }

    const result = await response.json();
    logger.debug('📥 API: Delete response:', result);
  }

  /**
   * ファイル情報を取得
   */
  async getFileInfo(mindmapId: string, nodeId: string, fileId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/files/${mindmapId}/${nodeId}/${fileId}?type=info`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`ファイル情報の取得に失敗しました: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
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
      logger.error('Health check failed:', error);
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