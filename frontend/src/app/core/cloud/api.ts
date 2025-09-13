// Cloudflare Workers API integration
import type { MindMapData, MindMapNode } from '@shared/types';
import { logger } from '../../shared/utils/logger';
import { ApiErrorHandler } from '../utils/apiErrorHandler';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://mindflow-api-production.shigekazukoya.workers.dev';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileInfo {
  id: string;
  name: string;
  fileName: string;
  type: string;
  mimeType: string;
  size: number;
  fileSize: number;
  url: string;
  downloadUrl: string;
  storagePath: string;
  attachmentType: string;
  uploadedAt: string;
  isImage: boolean;
}

export interface ApiResponse<T = unknown> {
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
    return ApiErrorHandler.withRetry(async () => {
      const response = await fetch(`${API_BASE_URL}/api/mindmaps`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (response.status === 404) {
        return []; // データなし
      }

      await ApiErrorHandler.handleResponse(response, 'マインドマップの取得');

      const result: MindMapListApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'マインドマップの取得に失敗しました');
      }

      return result.data || [];
    }, 'getMindMaps');
  }

  /**
   * 特定のマインドマップを取得
   */
  async getMindMap(id: string): Promise<MindMapData | null> {
    return ApiErrorHandler.withRetry(async () => {
      const response = await fetch(`${API_BASE_URL}/api/mindmaps/${id}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (response.status === 404) {
        return null; // データなし
      }

      await ApiErrorHandler.handleResponse(response, 'マインドマップの取得');

      const result: MindMapApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'マインドマップの取得に失敗しました');
      }

      return result.data || null;
    }, 'getMindMap');
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

    await ApiErrorHandler.handleResponse(response, 'マインドマップの作成');

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

    await ApiErrorHandler.handleResponse(response, 'マインドマップの更新');

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
  async getUserProfile(): Promise<UserProfile> {
    const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`ユーザープロファイルの取得に失敗しました: ${response.statusText}`);
    }

    const result: ApiResponse<UserProfile> = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'ユーザープロファイルの取得に失敗しました');
    }

    return result.data;
  }

  /**
   * ファイルをアップロード
   */
  async uploadFile(mindmapId: string, nodeId: string, file: File): Promise<FileInfo> {
    logger.info('📤 API: Uploading file:', { mindmapId, nodeId, fileName: file.name, fileSize: file.size });
    
    const formData = new FormData();
    formData.append('file', file);
    logger.info('📋 API: FormData created with file');
    
    const headers = this.getAuthHeaders();
    // FormDataを使用する場合はContent-Typeを削除（ブラウザが自動設定）
    delete headers['Content-Type'];
    
    logger.info('🔑 API: Upload headers prepared:', { 
      hasAuth: !!headers.Authorization, 
      authPrefix: headers.Authorization ? headers.Authorization.substring(0, 20) + '...' : 'none',
      headersCount: Object.keys(headers).length
    });
    
    const uploadUrl = `${API_BASE_URL}/api/files/${mindmapId}/${nodeId}`;
    logger.info('🌐 API: Making fetch request to:', uploadUrl);
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: formData,
    });

    logger.info('📡 API: Response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('❌ API: File upload failed:', { 
        status: response.status, 
        statusText: response.statusText,
        body: errorText,
        url: uploadUrl
      });
      throw new Error(`ファイルのアップロードに失敗しました: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    logger.info('📥 API: Upload response:', result);
    
    // downloadUrlが相対パスの場合は絶対パスに変換
    if (result.downloadUrl && result.downloadUrl.startsWith('/')) {
      result.downloadUrl = `${API_BASE_URL}${result.downloadUrl}`;
      logger.info('🔗 API: Converted relative downloadUrl to absolute:', result.downloadUrl);
    }
    
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
  async getFileInfo(mindmapId: string, nodeId: string, fileId: string): Promise<FileInfo> {
    const response = await fetch(`${API_BASE_URL}/api/files/${mindmapId}/${nodeId}/${fileId}?type=info`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('File not found');
      }
      throw new Error(`ファイル情報の取得に失敗しました: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  }

  /**
   * ファイルをダウンロード
   */
  async downloadFile(mindmapId: string, nodeId: string, fileId: string): Promise<Blob> {
    logger.info('📥 API: Downloading file:', { mindmapId, nodeId, fileId });
    
    const downloadUrl = `${API_BASE_URL}/api/files/${mindmapId}/${nodeId}/${fileId}?type=download`;
    const headers = this.getAuthHeaders();
    
    logger.info('🌐 API: Download URL and headers:', {
      url: downloadUrl,
      hasAuth: !!headers.Authorization,
      authPrefix: headers.Authorization ? headers.Authorization.substring(0, 20) + '...' : 'none',
      headersCount: Object.keys(headers).length
    });
    
    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers,
    });

    logger.info('📡 API: Download response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length')
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('❌ API: File download failed:', { 
        status: response.status, 
        statusText: response.statusText,
        body: errorText 
      });
      
      if (response.status === 404) {
        throw new Error('ファイルが見つかりません');
      }
      throw new Error(`ファイルのダウンロードに失敗しました: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const blob = await response.blob();
    logger.info('📥 API: File downloaded successfully:', {
      size: blob.size,
      type: blob.type,
      responseContentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length')
    });
    
    // Content-TypeがblobのtypeがApplication/octet-streamの場合、レスポンスヘッダーから設定
    if (blob.type === 'application/octet-stream' || !blob.type) {
      const contentType = response.headers.get('content-type');
      if (contentType) {
        logger.info('🔄 API: Updating blob type from response headers:', contentType);
        return new Blob([blob], { type: contentType });
      }
    }
    
    return blob;
  }

  /**
   * すべてのファイル情報を取得
   */
  async getAllFiles(): Promise<FileInfo[]> {
    logger.info('📋 API: Getting all files for user');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/files`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      logger.info('📡 API: Get all files response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('❌ API: Get all files failed:', { 
          status: response.status, 
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`ファイル一覧の取得に失敗しました: ${response.status} ${response.statusText}`);
      }

      const result: ApiResponse<FileInfo[]> = await response.json();
      logger.info('📥 API: All files response:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'ファイル一覧の取得に失敗しました');
      }

      return result.data || [];
    } catch (error) {
      logger.error('❌ API: getAllFiles failed:', error);
      // エラーの場合は空配列を返す（サーバーにエンドポイントがない可能性もあるため）
      return [];
    }
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
  const cleanNode = (node: MindMapNode): MindMapNode => {
    const cleanedNode = {
      ...node,
      text: node.text || '',
      children: (node.children || [])
        .filter((child: MindMapNode) => child.text && child.text.trim() !== '')
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
export function countNodes(node: MindMapNode): number {
  if (!node) return 0;
  
  let count = 1; // 現在のノード
  if (node.children) {
    count += node.children.reduce<number>((sum, child) => sum + countNodes(child), 0);
  }
  
  return count;
}