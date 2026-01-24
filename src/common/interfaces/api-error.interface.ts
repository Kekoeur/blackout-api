/**
 * Standard API error response interface.
 * Used across all endpoints to provide consistent error formatting.
 */
export interface ApiErrorResponse {
  /**
   * HTTP status code
   */
  statusCode: number;

  /**
   * Human-readable error message
   */
  message: string | string[];

  /**
   * Error type identifier (e.g., 'ValidationError', 'UnauthorizedError')
   */
  error?: string;

  /**
   * ISO 8601 timestamp of when the error occurred
   */
  timestamp?: string;

  /**
   * API path where the error occurred
   */
  path?: string;
}
