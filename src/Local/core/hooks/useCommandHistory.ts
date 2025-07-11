import { useRef, useCallback } from 'react';
import { CommandHistory, Command } from '../commands';

export const useCommandHistory = () => {
  const historyRef = useRef(new CommandHistory());

  const executeCommand = useCallback((command: Command) => {
    historyRef.current.execute(command);
  }, []);

  const undo = useCallback(() => {
    return historyRef.current.undo();
  }, []);

  const redo = useCallback(() => {
    return historyRef.current.redo();
  }, []);

  const canUndo = useCallback(() => {
    return historyRef.current.canUndo();
  }, []);

  const canRedo = useCallback(() => {
    return historyRef.current.canRedo();
  }, []);

  const getUndoDescription = useCallback(() => {
    return historyRef.current.getUndoDescription();
  }, []);

  const getRedoDescription = useCallback(() => {
    return historyRef.current.getRedoDescription();
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current.clear();
  }, []);

  return {
    executeCommand,
    undo,
    redo,
    canUndo,
    canRedo,
    getUndoDescription,
    getRedoDescription,
    clearHistory
  };
};