import { logger } from '../../shared/utils/logger';

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
  timestamp: string;
  retryable: boolean;
}

export class ApiErrorHandler {
  private static readonly RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly RETRY_DELAY_BASE = 1000; // 1 second

  static createError(
    error: unknown,
    context: string,
    retryable = false
  ): ApiError {
    const timestamp = new Date().toISOString();

    if (error instanceof Response) {
      return {
        message: `${context}: ${error.statusText}`,
        status: error.status,
        timestamp,
        retryable: retryable || this.isRetryableStatus(error.status),
      };
    }

    if (error instanceof Error) {
      return {
        message: `${context}: ${error.message}`,
        timestamp,
        retryable,
        details: error,
      };
    }

    return {
      message: `${context}: Unknown error occurred`,
      timestamp,
      retryable,
      details: error,
    };
  }

  static isRetryableStatus(status: number): boolean {
    return this.RETRYABLE_STATUS_CODES.includes(status);
  }

  static async withRetry<T>(
    operation: () => Promise<T>,
    context: string,
    maxAttempts = this.MAX_RETRY_ATTEMPTS
  ): Promise<T> {
    let lastError: ApiError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.createError(error, context);
        
        if (!lastError.retryable || attempt === maxAttempts) {
          logger.error(`API error after ${attempt} attempts:`, lastError);
          throw lastError;
        }

        const delay = this.RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
        logger.warn(`Retrying ${context} after ${delay}ms (attempt ${attempt}/${maxAttempts})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error(`${context}: Failed after ${maxAttempts} attempts`);
  }

  static handleError(error: unknown, context: string): never {
    const apiError = this.createError(error, context);
    logger.error(context, apiError);
    throw apiError;
  }

  static async handleResponse(response: Response, context: string): Promise<Response> {
    if (!response.ok) {
      const apiError = this.createError(response, context);
      
      if (response.status === 404) {
        logger.debug(`${context}: Resource not found`);
        throw apiError;
      }

      logger.error(`${context}: Request failed`, apiError);
      throw apiError;
    }

    return response;
  }
}