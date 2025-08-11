import type { MindMapData, MindMapNode } from '../types';

/**
 * 型ガード関数 - ランタイム型チェック
 */
export const isMindMapData = (data: unknown): data is MindMapData => {
  if (!data || typeof data !== 'object') return false;
  
  const obj = data as Record<string, unknown>;
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.rootNode === 'object' &&
    obj.rootNode !== null &&
    isMindMapNode(obj.rootNode)
  );
};

export const isMindMapNode = (node: unknown): node is MindMapNode => {
  if (!node || typeof node !== 'object') return false;
  
  const obj = node as Record<string, unknown>;
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.text === 'string' &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    Array.isArray(obj.children) &&
    obj.children.every((child: unknown) => isMindMapNode(child))
  );
};

/**
 * データバリデーション結果型
 */
export interface DataValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * MindMapDataの詳細バリデーション
 */
export const validateMindMapData = (data: unknown): DataValidationResult => {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Data must be an object');
    return { isValid: false, errors };
  }

  const obj = data as Record<string, unknown>;

  // 必須フィールドのチェック
  if (!obj.id || typeof obj.id !== 'string') {
    errors.push('Missing or invalid id field');
  }

  if (!obj.title || typeof obj.title !== 'string') {
    errors.push('Missing or invalid title field');
  }

  if (!obj.rootNode) {
    errors.push('Missing rootNode field');
  } else {
    const nodeValidation = validateMindMapNode(obj.rootNode);
    if (!nodeValidation.isValid) {
      errors.push(`Invalid rootNode: ${nodeValidation.errors.join(', ')}`);
    }
  }

  // オプショナルフィールドのチェック
  if (obj.createdAt && typeof obj.createdAt !== 'string') {
    errors.push('Invalid createdAt field');
  }

  if (obj.updatedAt && typeof obj.updatedAt !== 'string') {
    errors.push('Invalid updatedAt field');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * MindMapNodeの詳細バリデーション
 */
export const validateMindMapNode = (node: unknown): DataValidationResult => {
  const errors: string[] = [];

  if (!node || typeof node !== 'object') {
    errors.push('Node must be an object');
    return { isValid: false, errors };
  }

  const obj = node as Record<string, unknown>;

  // 必須フィールドのチェック
  if (!obj.id || typeof obj.id !== 'string') {
    errors.push('Missing or invalid node id');
  }

  if (typeof obj.text !== 'string') {
    errors.push('Missing or invalid node text');
  }

  if (typeof obj.x !== 'number' || isNaN(obj.x)) {
    errors.push('Missing or invalid node x coordinate');
  }

  if (typeof obj.y !== 'number' || isNaN(obj.y)) {
    errors.push('Missing or invalid node y coordinate');
  }

  // 子ノードのバリデーション
  if (!Array.isArray(obj.children)) {
    errors.push('Node children must be an array');
  } else {
    obj.children.forEach((child, index) => {
      const childValidation = validateMindMapNode(child);
      if (!childValidation.isValid) {
        errors.push(`Invalid child node at index ${index}: ${childValidation.errors.join(', ')}`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * ファイル拡張子バリデーション
 */
export const isValidFileExtension = (filename: string, allowedExtensions: string[]): boolean => {
  const extension = filename.toLowerCase().split('.').pop();
  return extension ? allowedExtensions.includes(extension) : false;
};

/**
 * URL バリデーション
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * 文字列の安全性チェック（XSS対策）
 */
export const isSafeString = (str: string): boolean => {
  // スクリプトタグや危険なパターンをチェック
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i
  ];

  return !dangerousPatterns.some(pattern => pattern.test(str));
};