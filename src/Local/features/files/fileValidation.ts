// ファイルアップロードのセキュリティ強化

// 許可されたファイルタイプの詳細定義
export const ALLOWED_FILE_TYPES = {
  images: {
    'image/jpeg': { extensions: ['.jpg', '.jpeg'], maxSize: 10 * 1024 * 1024 }, // 10MB
    'image/png': { extensions: ['.png'], maxSize: 10 * 1024 * 1024 },
    'image/gif': { extensions: ['.gif'], maxSize: 5 * 1024 * 1024 }, // 5MB
    'image/webp': { extensions: ['.webp'], maxSize: 10 * 1024 * 1024 },
    'image/svg+xml': { extensions: ['.svg'], maxSize: 1 * 1024 * 1024 } // 1MB
  },
  documents: {
    'application/pdf': { extensions: ['.pdf'], maxSize: 25 * 1024 * 1024 }, // 25MB
    'text/plain': { extensions: ['.txt'], maxSize: 1 * 1024 * 1024 },
    'application/json': { extensions: ['.json'], maxSize: 1 * 1024 * 1024 }
  }
};

// 危険なファイルタイプ（実行可能ファイルなど）
export const DANGEROUS_FILE_TYPES = [
  'application/x-executable',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-msi',
  'application/x-bat',
  'application/x-sh',
  'application/javascript',
  'text/javascript',
  'application/x-python-code',
  'text/x-script',
  'application/x-java-archive'
];

// 危険な拡張子
export const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
  '.app', '.deb', '.pkg', '.dmg', '.run', '.msi', '.dll', '.so', '.dylib'
];

// ファイルサイズ制限
export const FILE_SIZE_LIMITS = {
  total: 50 * 1024 * 1024, // 合計50MB
  single: 25 * 1024 * 1024, // 単一ファイル25MB
  image: 10 * 1024 * 1024,  // 画像10MB
  document: 25 * 1024 * 1024 // ドキュメント25MB
};

// ファイル名の検証
export const validateFileName = (fileName: string) => {
  const errors: string[] = [];
  
  // 基本的な文字チェック
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (invalidChars.test(fileName)) {
    errors.push('ファイル名に無効な文字が含まれています');
  }
  
  // 長さチェック
  if (fileName.length > 255) {
    errors.push('ファイル名が長すぎます（255文字以内）');
  }
  
  if (fileName.length === 0) {
    errors.push('ファイル名が空です');
  }
  
  // 危険な拡張子チェック
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  if (DANGEROUS_EXTENSIONS.includes(extension)) {
    errors.push(`危険な拡張子です: ${extension}`);
  }
  
  // Windowsの予約語チェック
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')).toUpperCase();
  if (reservedNames.includes(nameWithoutExt)) {
    errors.push('Windowsの予約語は使用できません');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// MIMEタイプの検証
export const validateMimeType = (file: File) => {
  const errors: string[] = [];
  
  // 危険なMIMEタイプチェック
  if (DANGEROUS_FILE_TYPES.includes(file.type)) {
    errors.push(`危険なファイルタイプです: ${file.type}`);
  }
  
  // 許可されたタイプかチェック
  const allAllowedTypes = [
    ...Object.keys(ALLOWED_FILE_TYPES.images),
    ...Object.keys(ALLOWED_FILE_TYPES.documents)
  ];
  
  if (!allAllowedTypes.includes(file.type)) {
    errors.push(`サポートされていないファイルタイプです: ${file.type}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// ファイル拡張子とMIMEタイプの整合性チェック
export const validateFileConsistency = (file: File) => {
  const errors: string[] = [];
  
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  const mimeType = file.type;
  
  // 拡張子とMIMEタイプの対応チェック
  let expectedMimeTypes: string[] = [];
  
  Object.entries(ALLOWED_FILE_TYPES.images).forEach(([mime, config]) => {
    if (config.extensions.includes(extension)) {
      expectedMimeTypes.push(mime);
    }
  });
  
  Object.entries(ALLOWED_FILE_TYPES.documents).forEach(([mime, config]) => {
    if (config.extensions.includes(extension)) {
      expectedMimeTypes.push(mime);
    }
  });
  
  if (expectedMimeTypes.length > 0 && !expectedMimeTypes.includes(mimeType)) {
    errors.push(`ファイル拡張子とMIMEタイプが一致しません。期待値: ${expectedMimeTypes.join(', ')}, 実際: ${mimeType}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// ファイルサイズの検証
export const validateFileSize = (file: File) => {
  const errors: string[] = [];
  
  // 単一ファイルサイズチェック
  if (file.size > FILE_SIZE_LIMITS.single) {
    errors.push(`ファイルサイズが大きすぎます: ${(file.size / 1024 / 1024).toFixed(1)}MB > ${FILE_SIZE_LIMITS.single / 1024 / 1024}MB`);
  }
  
  // ファイルタイプ別サイズチェック
  const allAllowedTypes = { ...ALLOWED_FILE_TYPES.images, ...ALLOWED_FILE_TYPES.documents };
  const typeConfig = allAllowedTypes[file.type as keyof typeof allAllowedTypes];
  
  if (typeConfig && file.size > typeConfig.maxSize) {
    errors.push(`このファイルタイプのサイズ制限を超えています: ${(file.size / 1024 / 1024).toFixed(1)}MB > ${typeConfig.maxSize / 1024 / 1024}MB`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// ファイル内容の基本チェック（マジックナンバー）
export const validateFileContent = async (file: File) => {
  return new Promise((resolve) => {
    const errors: string[] = [];
    
    // ファイルサイズが0の場合
    if (file.size === 0) {
      errors.push('ファイルが空です');
      resolve({ isValid: false, errors });
      return;
    }
    
    // ファイルの最初の数バイトを読み取ってマジックナンバーをチェック
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target?.result) {
        errors.push('ファイルの読み取りに失敗しました');
        resolve({ isValid: false, errors });
        return;
      }
      const arrayBuffer = e.target.result as ArrayBuffer;
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // 基本的なマジックナンバーチェック
      const magicNumbers: Record<string, number[]> = {
        'image/jpeg': [0xFF, 0xD8, 0xFF],
        'image/png': [0x89, 0x50, 0x4E, 0x47],
        'image/gif': [0x47, 0x49, 0x46],
        'application/pdf': [0x25, 0x50, 0x44, 0x46]
      };
      
      const expectedMagic = magicNumbers[file.type];
      if (expectedMagic) {
        const actualMagic = Array.from(uint8Array.slice(0, expectedMagic.length));
        const matches = expectedMagic.every((byte: number, index: number) => byte === actualMagic[index]);
        
        if (!matches) {
          errors.push(`ファイルの内容がファイルタイプと一致しません: ${file.type}`);
        }
      }
      
      resolve({
        isValid: errors.length === 0,
        errors
      });
    };
    
    reader.onerror = () => {
      errors.push('ファイルの読み取りに失敗しました');
      resolve({ isValid: false, errors });
    };
    
    // 最初の64バイトのみ読み取り
    const blob = file.slice(0, 64);
    reader.readAsArrayBuffer(blob);
  });
};

// 総合的なファイル検証
export const validateFile = async (file: File) => {
  const allErrors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // 1. ファイル名検証
    const nameValidation = validateFileName(file.name);
    if (!nameValidation.isValid) {
      allErrors.push(...nameValidation.errors);
    }
    
    // 2. MIMEタイプ検証
    const mimeValidation = validateMimeType(file);
    if (!mimeValidation.isValid) {
      allErrors.push(...mimeValidation.errors);
    }
    
    // 3. 整合性チェック
    const consistencyValidation = validateFileConsistency(file);
    if (!consistencyValidation.isValid) {
      allErrors.push(...consistencyValidation.errors);
    }
    
    // 4. サイズ検証
    const sizeValidation = validateFileSize(file);
    if (!sizeValidation.isValid) {
      allErrors.push(...sizeValidation.errors);
    }
    
    // 5. ファイル内容検証（非同期）
    const contentValidation = await validateFileContent(file) as { isValid: boolean; errors: string[] };
    if (!contentValidation.isValid) {
      allErrors.push(...contentValidation.errors);
    }
    
    // 警告の生成
    if (file.size > 5 * 1024 * 1024) { // 5MB以上
      warnings.push('大きなファイルです。アップロードに時間がかかる可能性があります。');
    }
    
    if (file.type === 'image/svg+xml') {
      warnings.push('SVGファイルには悪意のあるスクリプトが含まれる可能性があります。信頼できるソースからのファイルのみをアップロードしてください。');
    }
    
    const result = {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings,
      fileInfo: {
        name: file.name,
        type: file.type,
        size: file.size,
        sizeFormatted: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        lastModified: new Date(file.lastModified).toISOString()
      }
    };
    
    // セキュリティログ
    console.log('🔒 File validation result:', {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      isValid: result.isValid,
      errorCount: allErrors.length,
      warningCount: warnings.length
    });
    
    return result;
    
  } catch (error) {
    console.error('File validation error:', error);
    return {
      isValid: false,
      errors: ['ファイル検証中にエラーが発生しました'],
      warnings: [],
      fileInfo: {
        name: file.name,
        type: file.type,
        size: file.size
      }
    };
  }
};

// 複数ファイルの検証
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo: {
    name: string;
    type: string;
    size: number;
    sizeFormatted?: string;
    lastModified?: string;
  };
}

export const validateMultipleFiles = async (files: File[]) => {
  const results: ValidationResult[] = [];
  let totalSize = 0;
  
  for (const file of files) {
    const result = await validateFile(file);
    results.push(result);
    totalSize += file.size;
  }
  
  // 合計サイズチェック
  const totalSizeExceeded = totalSize > FILE_SIZE_LIMITS.total;
  if (totalSizeExceeded) {
    results.forEach(result => {
      result.errors.push(`合計ファイルサイズが制限を超えています: ${(totalSize / 1024 / 1024).toFixed(1)}MB > ${FILE_SIZE_LIMITS.total / 1024 / 1024}MB`);
      result.isValid = false;
    });
  }
  
  return {
    results,
    summary: {
      totalFiles: files.length,
      validFiles: results.filter(r => r.isValid).length,
      invalidFiles: results.filter(r => !r.isValid).length,
      totalSize,
      totalSizeFormatted: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
      totalSizeExceeded
    }
  };
};

// セキュリティレポートの生成
export const generateSecurityReport = (validationResults: ValidationResult[]) => {
  const report = {
    timestamp: new Date().toISOString(),
    totalFiles: validationResults.length,
    securityIssues: [] as {
      fileIndex: number;
      fileName: string;
      issues: string[];
    }[],
    recommendations: [] as {
      fileIndex: number;
      fileName: string;
      warnings: string[];
    }[]
  };
  
  validationResults.forEach((result, index) => {
    if (!result.isValid) {
      report.securityIssues.push({
        fileIndex: index,
        fileName: result.fileInfo.name,
        issues: result.errors
      });
    }
    
    if (result.warnings.length > 0) {
      report.recommendations.push({
        fileIndex: index,
        fileName: result.fileInfo.name,
        warnings: result.warnings
      });
    }
  });
  
  return report;
};