// 基本的なテスト - Jestが正しく動作することを確認

describe('Basic Tests', () => {
  test('基本的な計算が動作する', () => {
    expect(2 + 2).toBe(4);
  });

  test('文字列の比較が動作する', () => {
    expect('hello').toBe('hello');
  });

  test('配列の比較が動作する', () => {
    expect([1, 2, 3]).toEqual([1, 2, 3]);
  });

  test('DOM操作が動作する', () => {
    document.body.innerHTML = '<div id="test">Hello</div>';
    const element = document.getElementById('test');
    expect(element).not.toBeNull();
    expect(element!.textContent).toBe('Hello');
  });

  test('モックが動作する', () => {
    const mockFn = jest.fn();
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
  });
});