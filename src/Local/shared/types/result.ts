// Result pattern for error handling
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Factory functions for Result
export const Success = <T>(data: T): Result<T> => ({
  success: true,
  data
});

export const Failure = <T, E = Error>(error: E): Result<T, E> => ({
  success: false,
  error
});

// Utility functions for Result
export const isSuccess = <T, E>(result: Result<T, E>): result is { success: true; data: T } => {
  return result.success;
};

export const isFailure = <T, E>(result: Result<T, E>): result is { success: false; error: E } => {
  return !result.success;
};

// Chain operations on Result
export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (_value: T) => U
): Result<U, E> => {
  if (isSuccess(result)) {
    return { success: true, data: fn(result.data) };
  }
  return { success: false, error: result.error };
};

export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (_value: T) => Result<U, E>
): Result<U, E> => {
  if (isSuccess(result)) {
    return fn(result.data);
  }
  return { success: false, error: result.error };
};

// Handle Result patterns
export const match = <T, E, U>(
  result: Result<T, E>,
  patterns: {
    success: (_data: T) => U;
    failure: (_error: E) => U;
  }
): U => {
  if (isSuccess(result)) {
    return patterns.success(result.data);
  }
  return patterns.failure(result.error);
};

// Collect multiple Results
export const collect = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const successes: T[] = [];
  
  for (const result of results) {
    if (isFailure(result)) {
      return { success: false, error: result.error };
    }
    successes.push(result.data);
  }
  
  return { success: true, data: successes };
};

// Try-catch wrapper that returns Result
export const tryCatch = <T, E = Error>(
  fn: () => T,
  errorHandler?: (_error: unknown) => E
): Result<T, E> => {
  try {
    return { success: true, data: fn() };
  } catch (error) {
    const handledError = errorHandler ? errorHandler(error) : error as E;
    return { success: false, error: handledError };
  }
};

// Async version of tryCatch
export const tryCatchAsync = async <T, E = Error>(
  fn: () => Promise<T>,
  errorHandler?: (_error: unknown) => E
): Promise<Result<T, E>> => {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const handledError = errorHandler ? errorHandler(error) : error as E;
    return { success: false, error: handledError };
  }
};