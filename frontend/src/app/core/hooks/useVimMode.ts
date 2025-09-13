import { useState, useCallback } from 'react';
import { useMindMapStore } from '../store/mindMapStore';

export type VimMode = 'normal' | 'insert' | 'visual' | 'command';

interface VimState {
  mode: VimMode;
  isEnabled: boolean;
  lastCommand: string;
  commandBuffer: string;
}

interface VimActions {
  setMode: (mode: VimMode) => void;
  enable: () => void;
  disable: () => void;
  toggle: () => void;
  executeCommand: (command: string) => void;
  appendToCommandBuffer: (char: string) => void;
  clearCommandBuffer: () => void;
}

export interface VimModeHook extends VimState, VimActions {}

export const useVimMode = (): VimModeHook => {
  const { settings, updateSetting } = useMindMapStore();
  const [state, setState] = useState<Omit<VimState, 'isEnabled'>>({
    mode: 'normal',
    lastCommand: '',
    commandBuffer: ''
  });

  const setMode = useCallback((mode: VimMode) => {
    setState(prev => ({ ...prev, mode }));
  }, []);

  const enable = useCallback(() => {
    updateSetting('vimMode', true);
    setMode('normal');
  }, [updateSetting, setMode]);

  const disable = useCallback(() => {
    updateSetting('vimMode', false);
    setMode('normal');
  }, [updateSetting, setMode]);

  const toggle = useCallback(() => {
    if (settings.vimMode) {
      disable();
    } else {
      enable();
    }
  }, [settings.vimMode, enable, disable]);

  const executeCommand = useCallback((command: string) => {
    setState(prev => ({ 
      ...prev, 
      lastCommand: command,
      commandBuffer: ''
    }));
  }, []);

  const appendToCommandBuffer = useCallback((char: string) => {
    setState(prev => ({ 
      ...prev, 
      commandBuffer: prev.commandBuffer + char 
    }));
  }, []);

  const clearCommandBuffer = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      commandBuffer: '' 
    }));
  }, []);

  return {
    ...state,
    isEnabled: settings.vimMode,
    setMode,
    enable,
    disable,
    toggle,
    executeCommand,
    appendToCommandBuffer,
    clearCommandBuffer
  };
};