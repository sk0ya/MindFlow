import { useCallback } from 'react';

export interface InitializationWaiterOptions {
  timeout?: number;
  interval?: number;
}

/**
 * 初期化待機処理を抽象化したhook
 */
export const useInitializationWaiter = () => {
  const waitForInitialization = useCallback(
    async (
      checkFn: () => boolean,
      options: InitializationWaiterOptions = {}
    ): Promise<void> => {
      const { timeout = 10000, interval = 100 } = options;
      const startTime = Date.now();

      return new Promise<void>((resolve, reject) => {
        const check = () => {
          if (checkFn()) {
            resolve();
          } else if (Date.now() - startTime > timeout) {
            reject(new Error('Initialization timeout'));
          } else {
            setTimeout(check, interval);
          }
        };
        check();
      });
    },
    []
  );

  return { waitForInitialization };
};