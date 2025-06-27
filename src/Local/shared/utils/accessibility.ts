// アクセシビリティ関連のユーティリティ

// ARIA属性の生成
export const generateAriaAttributes = (nodeType, nodeData, context = {}) => {
  const baseAttributes = {
    role: nodeType === 'root' ? 'main' : 'treeitem',
    'aria-level': nodeData.level || 1,
    'aria-expanded': nodeData.children?.length > 0 ? !nodeData.collapsed : undefined,
    'aria-selected': context.isSelected || false,
    'aria-label': nodeData.text || 'マインドマップノード'
  };

  // 子ノードがある場合
  if (nodeData.children?.length > 0) {
    baseAttributes['aria-owns'] = nodeData.children.map(child => child.id).join(' ');
  }

  // 編集中の場合
  if (context.isEditing) {
    baseAttributes['aria-busy'] = true;
    baseAttributes['aria-live'] = 'polite';
  }

  // ファイル添付がある場合
  if (nodeData.attachments?.length > 0) {
    baseAttributes['aria-describedby'] = `${nodeData.id}-attachments`;
  }

  return baseAttributes;
};

// フォーカス管理
export class FocusManager {
  constructor() {
    this.focusHistory = [];
    this.maxHistory = 10;
  }

  // フォーカスを設定（履歴に追加）
  setFocus(elementId, options = {}) {
    const element = document.getElementById(elementId);
    if (!element) return false;

    // 履歴に追加
    this.addToHistory(elementId);

    // フォーカス設定
    element.focus(options);

    // スクリーンリーダー用の通知
    this.announceToScreenReader(element, options.announcement);

    return true;
  }

  // フォーカス履歴に追加
  addToHistory(elementId) {
    // 同じ要素が連続の場合は追加しない
    if (this.focusHistory[this.focusHistory.length - 1] === elementId) return;

    this.focusHistory.push(elementId);
    
    // 最大履歴数を超えた場合は古いものを削除
    if (this.focusHistory.length > this.maxHistory) {
      this.focusHistory = this.focusHistory.slice(-this.maxHistory);
    }
  }

  // 前のフォーカスに戻る
  restorePreviousFocus() {
    if (this.focusHistory.length < 2) return false;

    // 現在のフォーカスを除いて前のフォーカスを取得
    this.focusHistory.pop();
    const previousElementId = this.focusHistory[this.focusHistory.length - 1];
    
    return this.setFocus(previousElementId, { announcement: '前の項目に戻りました' });
  }

  // スクリーンリーダーへの音声通知
  announceToScreenReader(element, customMessage) {
    const message = customMessage || this.generateAnnouncementMessage(element);
    
    // ARIA live regionを使用して通知
    let liveRegion = document.getElementById('aria-live-region');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'aria-live-region';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.left = '-10000px';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      document.body.appendChild(liveRegion);
    }

    liveRegion.textContent = message;
  }

  // 音声通知メッセージの生成
  generateAnnouncementMessage(element) {
    const role = element.getAttribute('role');
    const level = element.getAttribute('aria-level');
    const expanded = element.getAttribute('aria-expanded');
    const selected = element.getAttribute('aria-selected');
    const label = element.getAttribute('aria-label') || element.textContent;

    let message = label;

    if (role === 'treeitem') {
      message += `, レベル ${level || 1}`;
      
      if (expanded === 'true') {
        message += ', 展開済み';
      } else if (expanded === 'false') {
        message += ', 折りたたみ済み';
      }
      
      if (selected === 'true') {
        message += ', 選択済み';
      }
    }

    return message;
  }
}

// キーボードナビゲーションのヘルパー
export class KeyboardNavigationHelper {
  constructor(rootElement, options = {}) {
    this.rootElement = rootElement;
    this.options = {
      enableArrowKeys: true,
      enableTabNavigation: true,
      enableHomeEnd: true,
      enableTypeAhead: true,
      ...options
    };
    
    this.typeAheadBuffer = '';
    this.typeAheadTimeout = null;
    
    this.init();
  }

  init() {
    if (this.options.enableArrowKeys) {
      this.setupArrowKeyNavigation();
    }
    
    if (this.options.enableHomeEnd) {
      this.setupHomeEndNavigation();
    }
    
    if (this.options.enableTypeAhead) {
      this.setupTypeAheadNavigation();
    }
  }

  setupArrowKeyNavigation() {
    this.rootElement.addEventListener('keydown', (event) => {
      const currentElement = event.target;
      let targetElement = null;

      switch (event.key) {
        case 'ArrowUp':
          targetElement = this.findPreviousElement(currentElement);
          break;
        case 'ArrowDown':
          targetElement = this.findNextElement(currentElement);
          break;
        case 'ArrowLeft':
          targetElement = this.findParentElement(currentElement);
          break;
        case 'ArrowRight':
          targetElement = this.findFirstChildElement(currentElement);
          break;
      }

      if (targetElement) {
        event.preventDefault();
        targetElement.focus();
      }
    });
  }

  setupHomeEndNavigation() {
    this.rootElement.addEventListener('keydown', (event) => {
      if (event.key === 'Home') {
        event.preventDefault();
        const firstElement = this.findFirstElement();
        if (firstElement) firstElement.focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        const lastElement = this.findLastElement();
        if (lastElement) lastElement.focus();
      }
    });
  }

  setupTypeAheadNavigation() {
    this.rootElement.addEventListener('keydown', (event) => {
      // 文字キーの場合
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        this.handleTypeAhead(event.key);
      }
    });
  }

  handleTypeAhead(char) {
    // バッファに文字を追加
    this.typeAheadBuffer += char.toLowerCase();
    
    // タイムアウトをクリア
    if (this.typeAheadTimeout) {
      clearTimeout(this.typeAheadTimeout);
    }
    
    // マッチする要素を検索
    const matchingElement = this.findElementByText(this.typeAheadBuffer);
    if (matchingElement) {
      matchingElement.focus();
    }
    
    // バッファをリセット（1秒後）
    this.typeAheadTimeout = setTimeout(() => {
      this.typeAheadBuffer = '';
    }, 1000);
  }

  findElementByText(searchText) {
    const elements = this.getAllFocusableElements();
    return elements.find(element => {
      const text = element.textContent.toLowerCase();
      return text.startsWith(searchText);
    });
  }

  findPreviousElement(currentElement) {
    const elements = this.getAllFocusableElements();
    const currentIndex = elements.indexOf(currentElement);
    return currentIndex > 0 ? elements[currentIndex - 1] : null;
  }

  findNextElement(currentElement) {
    const elements = this.getAllFocusableElements();
    const currentIndex = elements.indexOf(currentElement);
    return currentIndex < elements.length - 1 ? elements[currentIndex + 1] : null;
  }

  findParentElement(currentElement) {
    // ARIA関係から親要素を特定
    const parentId = currentElement.getAttribute('aria-parent');
    return parentId ? document.getElementById(parentId) : null;
  }

  findFirstChildElement(currentElement) {
    // ARIA関係から最初の子要素を特定
    const owns = currentElement.getAttribute('aria-owns');
    if (owns) {
      const childIds = owns.split(' ');
      return document.getElementById(childIds[0]);
    }
    return null;
  }

  findFirstElement() {
    const elements = this.getAllFocusableElements();
    return elements[0] || null;
  }

  findLastElement() {
    const elements = this.getAllFocusableElements();
    return elements[elements.length - 1] || null;
  }

  getAllFocusableElements() {
    // フォーカス可能な要素を取得
    const selector = '[tabindex], [role="treeitem"], button, input, select, textarea, a[href]';
    return Array.from(this.rootElement.querySelectorAll(selector))
      .filter(element => !element.disabled && !element.hidden);
  }
}

// カラーコントラスト計算
export const calculateColorContrast = (color1, color2) => {
  // RGB値を正規化された値に変換
  const getRGBValues = (color) => {
    // 16進数カラーを想定
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    return [r, g, b];
  };

  // 相対輝度を計算
  const getRelativeLuminance = (rgb) => {
    const [r, g, b] = rgb.map(c => {
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const rgb1 = getRGBValues(color1);
  const rgb2 = getRGBValues(color2);
  
  const lum1 = getRelativeLuminance(rgb1);
  const lum2 = getRelativeLuminance(rgb2);
  
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  const contrast = (lighter + 0.05) / (darker + 0.05);
  
  return {
    ratio: contrast,
    meetsAA: contrast >= 4.5,
    meetsAAA: contrast >= 7,
    level: contrast >= 7 ? 'AAA' : contrast >= 4.5 ? 'AA' : 'Fail'
  };
};

// アクセシビリティチェッカー
export const runAccessibilityCheck = (rootElement) => {
  const issues = [];

  // 基本的なアクセシビリティチェック
  const elementsWithoutLabels = rootElement.querySelectorAll('button:not([aria-label]):not([aria-labelledby]), input:not([aria-label]):not([aria-labelledby]):not([id])');
  if (elementsWithoutLabels.length > 0) {
    issues.push({
      type: 'missing-labels',
      severity: 'high',
      count: elementsWithoutLabels.length,
      message: 'ラベルが不足している要素があります'
    });
  }

  // フォーカス可能な要素のチェック
  const nonFocusableInteractiveElements = rootElement.querySelectorAll('[onclick]:not([tabindex]):not(button):not(a):not(input):not(select):not(textarea)');
  if (nonFocusableInteractiveElements.length > 0) {
    issues.push({
      type: 'non-focusable-interactive',
      severity: 'medium',
      count: nonFocusableInteractiveElements.length,
      message: 'キーボードでフォーカスできないインタラクティブ要素があります'
    });
  }

  return {
    totalIssues: issues.length,
    issues,
    passed: issues.length === 0
  };
};

// グローバルアクセシビリティマネージャー
export const accessibilityManager = {
  focusManager: new FocusManager(),
  isScreenReaderActive: false,
  isHighContrastMode: false,
  
  init() {
    this.detectScreenReader();
    this.detectHighContrastMode();
    this.setupGlobalKeyboardHandlers();
  },
  
  detectScreenReader() {
    // スクリーンリーダーの検出（簡易的な方法）
    this.isScreenReaderActive = window.navigator.userAgent.includes('NVDA') || 
                               window.navigator.userAgent.includes('JAWS') || 
                               window.speechSynthesis !== undefined;
  },
  
  detectHighContrastMode() {
    // ハイコントラストモードの検出
    const testElement = document.createElement('div');
    testElement.style.border = '1px solid';
    testElement.style.borderColor = 'red green';
    document.body.appendChild(testElement);
    
    const computedStyle = window.getComputedStyle(testElement);
    this.isHighContrastMode = computedStyle.borderTopColor === computedStyle.borderRightColor;
    
    document.body.removeChild(testElement);
  },
  
  setupGlobalKeyboardHandlers() {
    // Escapeキーでフォーカストラップから抜ける
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.closest('[role="dialog"]')) {
          this.focusManager.restorePreviousFocus();
        }
      }
    });
  }
};

// 初期化
if (typeof window !== 'undefined') {
  accessibilityManager.init();
}