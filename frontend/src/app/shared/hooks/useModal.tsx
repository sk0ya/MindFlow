import { useState, useCallback } from 'react';

/**
 * 単一モーダルの状態管理フック
 */
export const useModal = (initialOpen = false) => {
  const [isOpen, setIsOpen] = useState(initialOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
};

/**
 * データ付きモーダルの状態管理フック
 */
export const useModalWithData = <T,>(initialData: T | null = null) => {
  const [data, setData] = useState<T | null>(initialData);
  const isOpen = data !== null;

  const open = useCallback((newData: T) => setData(newData), []);
  const close = useCallback(() => setData(null), []);

  return {
    isOpen,
    data,
    open,
    close,
  };
};