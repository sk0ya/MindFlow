#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

/**
 * 危険な型パターンを検出するスクリプト
 * TypeScriptファイルをスキャンして以下の危険パターンを検出:
 * 1. any型の使用
 * 2. 型アサーション (as any, as SomeType)
 * 3. 強制アンラップ (!)
 * 4. @ts-ignore/@ts-expect-error
 */

class UnsafePatternDetector {
  constructor() {
    this.patterns = [
      {
        name: 'any型使用',
        regex: /:\s*any\b|<any>|\bany\[\]/g,
        severity: 'error',
        description: 'any型は型安全性を損ないます'
      },
      {
        name: '型アサーション',
        regex: /\bas\s+(?!React\.FC)(?!const)\w+|\bas\s+any/g,
        severity: 'warning',
        description: '型アサーションは慎重に使用してください'
      },
      {
        name: '強制アンラップ',
        regex: /[^!]\!\s*[;\.\[\(]/g,
        severity: 'error',
        description: '強制アンラップ(!)はランタイムエラーの原因になります'
      },
      {
        name: 'TSコメント無視',
        regex: /@ts-ignore|@ts-expect-error/g,
        severity: 'warning',
        description: 'TypeScriptエラーを無視することは推奨されません'
      },
      {
        name: 'JSON.parse without validation',
        regex: /JSON\.parse\([^)]+\)\s+as\s+\w+|JSON\.parse\([^)]+\)\s*;/g,
        severity: 'error',
        description: 'JSON.parseは型検証と組み合わせて使用してください'
      },
      {
        name: 'console.log in production',
        regex: /console\.log\(/g,
        severity: 'info',
        description: 'console.logは本番環境で残さないでください'
      }
    ];

    this.results = [];
    this.stats = {
      totalFiles: 0,
      filesWithIssues: 0,
      totalIssues: 0,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0
    };
  }

  scanDirectory(dirPath, srcOnly = true) {
    const entries = readdirSync(dirPath);
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // node_modules, .git, distなどをスキップ
        if (['node_modules', '.git', 'dist', 'build', '.next'].includes(entry)) {
          continue;
        }
        
        this.scanDirectory(fullPath, srcOnly);
      } else if (stat.isFile()) {
        // TypeScriptファイルのみをチェック
        const ext = extname(entry);
        if (['.ts', '.tsx'].includes(ext)) {
          // srcディレクトリ限定の場合
          if (srcOnly && !fullPath.includes('/src/')) {
            continue;
          }
          
          this.scanFile(fullPath);
        }
      }
    }
  }

  scanFile(filePath) {
    this.stats.totalFiles++;
    
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      let fileHasIssues = false;

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const lineNumber = lineIndex + 1;

        // JSXタグの行は型アサーションから除外
        const isJSXLine = /<\/?[A-Z][a-zA-Z]*|<\w+\s|<\/\w+>/.test(line);

        for (const pattern of this.patterns) {
          // JSX行で型アサーションパターンの場合はスキップ
          if (isJSXLine && pattern.name === '型アサーション') {
            continue;
          }

          const matches = [...line.matchAll(pattern.regex)];
          
          for (const match of matches) {
            // 追加フィルタリング
            if (this.shouldSkipMatch(pattern.name, match[0], line)) {
              continue;
            }

            fileHasIssues = true;
            this.stats.totalIssues++;
            
            switch (pattern.severity) {
              case 'error':
                this.stats.errorCount++;
                break;
              case 'warning':
                this.stats.warningCount++;
                break;
              case 'info':
                this.stats.infoCount++;
                break;
            }

            this.results.push({
              file: filePath,
              line: lineNumber,
              column: match.index + 1,
              pattern: pattern.name,
              severity: pattern.severity,
              description: pattern.description,
              code: line.trim(),
              matched: match[0]
            });
          }
        }
      }

      if (fileHasIssues) {
        this.stats.filesWithIssues++;
      }

    } catch (error) {
      console.error(`ファイル読み込みエラー: ${filePath}`, error.message);
    }
  }

  shouldSkipMatch(patternName, matched, line) {
    // JSX要素、HTMLタグを除外
    if (patternName === '型アサーション') {
      if (matched.startsWith('<') && matched.endsWith('>')) {
        return true;
      }
      // React.FCアサーション、constアサーションは除外
      if (line.includes('React.FC<') || line.includes('as const')) {
        return true;
      }
    }

    // コメント行を除外
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      return true;
    }

    // console.logで開発中のものは除外対象外
    if (patternName === 'console.log in production' && line.includes('// TODO:')) {
      return false;
    }

    return false;
  }

  generateReport() {
    console.log('\n🔍 TypeScript 型安全性スキャン結果\n');
    console.log('='.repeat(60));
    
    // 統計情報
    console.log(`📊 スキャン統計:`);
    console.log(`  スキャンファイル数: ${this.stats.totalFiles}`);
    console.log(`  問題のあるファイル数: ${this.stats.filesWithIssues}`);
    console.log(`  総問題数: ${this.stats.totalIssues}`);
    console.log(`    エラー: ${this.stats.errorCount}`);
    console.log(`    警告: ${this.stats.warningCount}`);
    console.log(`    情報: ${this.stats.infoCount}`);
    console.log();

    if (this.results.length === 0) {
      console.log('✅ 危険な型パターンは検出されませんでした！');
      return true;
    }

    // 重要度別にソート
    const sortedResults = this.results.sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // 結果を表示
    console.log('🚨 検出された問題:\n');
    
    let currentFile = '';
    for (const result of sortedResults) {
      if (result.file !== currentFile) {
        currentFile = result.file;
        console.log(`📄 ${result.file}`);
      }

      const severityIcon = {
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
      }[result.severity];

      console.log(`  ${severityIcon} ${result.line}:${result.column} [${result.pattern}]`);
      console.log(`     ${result.description}`);
      console.log(`     コード: ${result.code}`);
      console.log(`     一致: "${result.matched}"`);
      console.log();
    }

    // 結果の総括
    const hasErrors = this.stats.errorCount > 0;
    console.log('='.repeat(60));
    
    if (hasErrors) {
      console.log('💥 エラーが検出されました。型安全性の改善が必要です。');
      return false;
    } else if (this.stats.warningCount > 0) {
      console.log('⚠️  警告が検出されました。確認を推奨します。');
      return true;
    } else {
      console.log('✅ クリティカルな問題はありません。');
      return true;
    }
  }

  // CI用の簡潔な出力
  generateCIReport() {
    if (this.stats.errorCount > 0) {
      console.error(`型安全性チェック失敗: ${this.stats.errorCount}個のエラー`);
      process.exit(1);
    } else {
      console.log(`型安全性チェック成功: エラー0個、警告${this.stats.warningCount}個`);
    }
  }
}

// メイン実行
const detector = new UnsafePatternDetector();
const rootDir = process.cwd();
const ciMode = process.argv.includes('--ci');
const localOnly = process.argv.includes('--local-only');

const scanDir = localOnly ? join(rootDir, 'src/Local') : rootDir;
console.log(`🔍 ${scanDir} の型安全性をスキャンしています...`);

detector.scanDirectory(scanDir);

if (ciMode) {
  detector.generateCIReport();
} else {
  detector.generateReport();
}