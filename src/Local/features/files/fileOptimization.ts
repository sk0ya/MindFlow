// ファイル最適化とBase64圧縮ユーティリティ

// 圧縮結果の型定義
interface CompressionResult {
  dataURL: string;
  blob?: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: string;
  outputType: string;
  dimensions?: { width: number; height: number };
}

// Base64圧縮結果の型定義
interface Base64CompressionResult {
  compressed: string;
  originalSize: number;
  compressedSize: number;
  ratio: string;
}

// 最適化結果の型定義
export interface OptimizationResult {
  dataURL: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: string | number;
  isCompressed: boolean;
  type: string;
  dimensions?: { width: number; height: number };
}

// 画像圧縮用の設定
const COMPRESSION_SETTINGS = {
  // 画像の最大サイズ（幅・高さ）
  MAX_IMAGE_DIMENSION: 1920,
  // JPEG品質（0.1 - 1.0）
  JPEG_QUALITY: 0.8,
  // WebP品質（0.1 - 1.0）
  WEBP_QUALITY: 0.8,
  // 圧縮閾値（この サイズを超えたら圧縮）
  COMPRESSION_THRESHOLD: 100 * 1024, // 100KB
  // ファイルサイズ上限
  MAX_FILE_SIZE: 5 * 1024 * 1024 // 5MB
};

// Canvasを使った画像リサイズ
const resizeImage = (file: File, maxDimension: number = COMPRESSION_SETTINGS.MAX_IMAGE_DIMENSION, quality: number = COMPRESSION_SETTINGS.JPEG_QUALITY): Promise<CompressionResult> => {
  return new Promise<CompressionResult>((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // アスペクト比を保持してリサイズ
      let { width, height } = img;
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // 画像を描画
      ctx.drawImage(img, 0, 0, width, height);
      
      // 出力形式を決定
      let outputType = 'image/jpeg';
      let outputQuality = quality;
      
      // 元がPNGで透明度がある場合はPNGを維持
      if (file.type === 'image/png') {
        // 透明度チェック
        const imageData = ctx.getImageData(0, 0, width, height);
        const hasTransparency = imageData.data.some((value, index) => 
          (index + 1) % 4 === 0 && value < 255
        );
        
        if (hasTransparency) {
          outputType = 'image/png';
          outputQuality = undefined; // PNGには品質設定なし
        }
      }
      
      // WebPサポートチェック
      const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
      if (supportsWebP && file.size > COMPRESSION_SETTINGS.COMPRESSION_THRESHOLD) {
        outputType = 'image/webp';
        outputQuality = COMPRESSION_SETTINGS.WEBP_QUALITY;
      }
      
      // DataURLとして出力
      const dataURL = canvas.toDataURL(outputType, outputQuality);
      
      // 圧縮結果をBlobとして取得
      canvas.toBlob(
        (blob: Blob | null) => {
          if (blob) {
            resolve({
              dataURL,
              blob,
              originalSize: file.size,
              compressedSize: blob.size,
              compressionRatio: ((file.size - blob.size) / file.size * 100).toFixed(1),
              outputType,
              dimensions: { width, height }
            });
          } else {
            reject(new Error('画像圧縮に失敗しました'));
          }
        },
        outputType,
        outputQuality
      );
    };
    
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = URL.createObjectURL(file);
  });
};

// Base64文字列の圧縮（gzip風の簡易圧縮）
const compressBase64 = (base64String: string): Base64CompressionResult => {
  try {
    // データ部分のみを抽出（data:image/jpeg;base64, の部分を除く）
    const commaIndex = base64String.indexOf(',');
    const header = base64String.substring(0, commaIndex + 1);
    const data = base64String.substring(commaIndex + 1);
    
    // 簡易的な重複除去圧縮
    let compressed = data;
    
    // よく出現するパターンを短縮
    const patterns = [
      { pattern: /AAAA/g, replacement: 'α1' },
      { pattern: /FFFF/g, replacement: 'β1' },
      { pattern: /0000/g, replacement: 'γ1' },
      { pattern: /=====/g, replacement: 'δ1' },
    ];
    
    patterns.forEach(({ pattern, replacement }) => {
      compressed = compressed.replace(pattern, replacement);
    });
    
    return {
      compressed: header + compressed,
      originalSize: base64String.length,
      compressedSize: header.length + compressed.length,
      ratio: ((base64String.length - (header.length + compressed.length)) / base64String.length * 100).toFixed(1)
    };
  } catch (error) {
    console.warn('Base64圧縮に失敗:', error);
    return {
      compressed: base64String,
      originalSize: base64String.length,
      compressedSize: base64String.length,
      ratio: '0'
    };
  }
};

// Base64の展開
const decompressBase64 = (compressedBase64: string): string => {
  try {
    const commaIndex = compressedBase64.indexOf(',');
    const header = compressedBase64.substring(0, commaIndex + 1);
    let data = compressedBase64.substring(commaIndex + 1);
    
    // 圧縮パターンを元に戻す
    const patterns = [
      { pattern: /α1/g, replacement: 'AAAA' },
      { pattern: /β1/g, replacement: 'FFFF' },
      { pattern: /γ1/g, replacement: '0000' },
      { pattern: /δ1/g, replacement: '=====' },
    ];
    
    patterns.forEach(({ pattern, replacement }) => {
      data = data.replace(pattern, replacement);
    });
    
    return header + data;
  } catch (error) {
    console.warn('Base64展開に失敗:', error);
    return compressedBase64;
  }
};

// ファイルの最適化処理
export const optimizeFile = async (file: File): Promise<OptimizationResult> => {
  try {
    // ファイルサイズチェック
    if (file.size > COMPRESSION_SETTINGS.MAX_FILE_SIZE) {
      throw new Error(`ファイルサイズが上限を超えています: ${(file.size / 1024 / 1024).toFixed(1)}MB > ${(COMPRESSION_SETTINGS.MAX_FILE_SIZE / 1024 / 1024).toFixed(1)}MB`);
    }
    
    // 画像ファイルの場合は圧縮
    if (file.type.startsWith('image/')) {
      // 小さい画像はそのまま
      if (file.size <= COMPRESSION_SETTINGS.COMPRESSION_THRESHOLD) {
        const reader = new FileReader();
        return new Promise<OptimizationResult>((resolve, reject) => {
          reader.onload = (e: ProgressEvent<FileReader>) => {
            resolve({
              dataURL: e.target?.result as string,
              originalSize: file.size,
              optimizedSize: file.size,
              compressionRatio: '0',
              isCompressed: false,
              type: file.type
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      
      // 大きい画像は圧縮
      const compressed: CompressionResult = await resizeImage(file);
      
      return {
        dataURL: compressed.dataURL,
        originalSize: compressed.originalSize,
        optimizedSize: compressed.compressedSize,
        compressionRatio: compressed.compressionRatio,
        isCompressed: true,
        type: compressed.outputType,
        dimensions: compressed.dimensions
      };
    }
    
    // 画像以外のファイル
    const reader = new FileReader();
    return new Promise<OptimizationResult>((resolve, reject) => {
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const dataURL = e.target?.result as string;
        
        // Base64圧縮を試行
        const base64Compression: Base64CompressionResult = compressBase64(dataURL);
        
        resolve({
          dataURL: base64Compression.compressed,
          originalSize: file.size,
          optimizedSize: Math.round(base64Compression.compressedSize * 0.75), // Base64のオーバーヘッドを考慮
          compressionRatio: base64Compression.ratio,
          isCompressed: base64Compression.ratio > 0,
          type: file.type
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
  } catch (error) {
    console.error('ファイル最適化エラー:', error);
    throw error;
  }
};

// 最適化されたファイルの復元
export const restoreOptimizedFile = (optimizedData: OptimizationResult): OptimizationResult => {
  if (optimizedData.isCompressed && !optimizedData.type.startsWith('image/')) {
    // Base64圧縮の場合は展開
    return {
      ...optimizedData,
      dataURL: decompressBase64(optimizedData.dataURL)
    };
  }
  
  // 画像の場合はそのまま
  return optimizedData;
};

// ファイルサイズの人間readable表示
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// 圧縮統計の計算
export const calculateCompressionStats = (files: OptimizationResult[]): {
  totalOriginal: number;
  totalOptimized: number;
  totalSaved: number;
  totalSavedPercentage: string;
  fileCount: number;
  compressedCount: number;
} => {
  const totalOriginal = files.reduce((sum: number, file: OptimizationResult) => sum + (file.originalSize || 0), 0);
  const totalOptimized = files.reduce((sum: number, file: OptimizationResult) => sum + (file.optimizedSize || file.originalSize || 0), 0);
  const totalSaved = totalOriginal - totalOptimized;
  
  return {
    totalOriginal,
    totalOptimized,
    totalSaved,
    totalSavedPercentage: totalOriginal > 0 ? ((totalSaved / totalOriginal) * 100).toFixed(1) : '0',
    fileCount: files.length,
    compressedCount: files.filter((f: OptimizationResult) => f.isCompressed).length
  };
};