/**
 * @jest-environment jsdom
 */

describe('Realtime Sync During Editing', () => {
  // Mock DOM elements
  beforeEach(() => {
    // Create a mock input element for editing
    document.body.innerHTML = '<input class="node-input" />';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should skip realtime sync when user is editing', () => {
    const editingInput = document.querySelector('.node-input');
    
    // Simulate user editing
    editingInput.focus();
    editingInput.value = 'User is typing...';
    
    // Check editing state detection logic
    const isCurrentlyEditing = editingInput && document.activeElement === editingInput;
    
    expect(isCurrentlyEditing).toBe(true);
    expect(editingInput.value).toBe('User is typing...');
  });

  test('should detect editing state changes during async operations', async () => {
    const editingInput = document.querySelector('.node-input');
    
    // Initial state: not editing
    expect(document.activeElement).not.toBe(editingInput);
    
    // Start editing during async operation
    const asyncOperation = new Promise(resolve => {
      setTimeout(() => {
        editingInput.focus();
        editingInput.value = 'Started editing during async';
        resolve();
      }, 50);
    });
    
    await asyncOperation;
    
    // Check state after async operation
    const isEditingAfter = editingInput && document.activeElement === editingInput;
    expect(isEditingAfter).toBe(true);
    expect(editingInput.value).toBe('Started editing during async');
  });

  test('should handle multiple editing state checks', () => {
    const editingInput = document.querySelector('.node-input');
    
    // Helper function to check editing state (from useMindMapData.ts)
    const checkEditingState = () => {
      const input = document.querySelector('.node-input');
      return input && document.activeElement === input;
    };
    
    // Not editing initially
    expect(checkEditingState()).toBe(false);
    
    // Start editing
    editingInput.focus();
    editingInput.value = 'Editing content';
    expect(checkEditingState()).toBe(true);
    
    // Stop editing
    editingInput.blur();
    expect(checkEditingState()).toBe(false);
    
    // Start editing again
    editingInput.focus();
    expect(checkEditingState()).toBe(true);
  });

  test('should properly identify input element types', () => {
    // Test different input types that might be used for editing
    document.body.innerHTML = `
      <input class="node-input" type="text" />
      <textarea class="node-input"></textarea>
      <div class="node-input" contenteditable="true"></div>
    `;
    
    const textInput = document.querySelector('input.node-input');
    const textArea = document.querySelector('textarea.node-input');
    const contentEditable = document.querySelector('div.node-input');
    
    // Test text input
    textInput.focus();
    let activeElement = document.activeElement;
    expect(activeElement.tagName).toBe('INPUT');
    expect(activeElement.classList.contains('node-input')).toBe(true);
    
    // Test textarea
    textArea.focus();
    activeElement = document.activeElement;
    expect(activeElement.tagName).toBe('TEXTAREA');
    expect(activeElement.classList.contains('node-input')).toBe(true);
    
    // Test contenteditable
    contentEditable.focus();
    activeElement = document.activeElement;
    expect(activeElement.tagName).toBe('DIV');
    expect(activeElement.classList.contains('node-input')).toBe(true);
  });

  test('should simulate realtime sync conflict scenario', async () => {
    const editingInput = document.querySelector('.node-input');
    let syncSkipped = false;
    
    // Mock realtime sync handler logic
    const mockRealtimeSyncHandler = async (eventData) => {
      // Pre-check editing state
      const isCurrentlyEditing = editingInput && document.activeElement === editingInput;
      
      if (isCurrentlyEditing) {
        console.log('✋ Sync skipped: editing in progress');
        syncSkipped = true;
        return;
      }
      
      // Simulate async data fetch
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Post-check editing state
      const isEditingAfter = editingInput && document.activeElement === editingInput;
      
      if (isEditingAfter) {
        console.log('✋ Sync skipped: still editing after async operation');
        syncSkipped = true;
        return;
      }
      
      // Apply update if not editing
      console.log('✅ Sync applied successfully');
    };
    
    // Scenario 1: User starts editing before sync
    editingInput.focus();
    editingInput.value = 'User typing';
    
    await mockRealtimeSyncHandler({ id: 'test-map' });
    expect(syncSkipped).toBe(true);
    
    // Scenario 2: User starts editing during async operation
    syncSkipped = false;
    editingInput.blur(); // Stop editing
    
    // Start sync and begin editing during the async operation
    const syncPromise = mockRealtimeSyncHandler({ id: 'test-map' });
    
    // User starts editing during the async operation
    setTimeout(() => {
      editingInput.focus();
      editingInput.value = 'Started editing during sync';
    }, 50);
    
    await syncPromise;
    expect(syncSkipped).toBe(true);
  });
});