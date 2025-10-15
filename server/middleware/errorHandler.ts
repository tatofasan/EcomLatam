/**
 * Error Handler Middleware
 *
 * Sanitizes error responses to prevent information disclosure in production
 * while providing detailed errors in development.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Global error handler middleware
 *
 * This should be the last middleware added to Express.
 * It catches all errors and provides sanitized responses.
 *
 * In production: Returns generic error messages without stack traces
 * In development: Returns detailed error information for debugging
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log full error details for debugging
  console.error('[Error Handler] Error occurred:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString()
  });

  // Determine if we're in production
  const isProduction = process.env.NODE_ENV === 'production';

  // Extract status code
  const status = err.status || err.statusCode || 500;

  // Build response based on environment
  const response: any = {
    success: false,
    message: isProduction
      ? sanitizeErrorMessage(err.message, status)
      : err.message
  };

  // Add additional info in development
  if (!isProduction) {
    response.stack = err.stack;
    response.error = err.name || 'Error';
  }

  // Send error response
  res.status(status).json(response);
}

/**
 * Sanitizes error messages for production to prevent information disclosure
 *
 * @param message - Original error message
 * @param status - HTTP status code
 * @returns Sanitized error message safe for production
 */
function sanitizeErrorMessage(message: string, status: number): string {
  // For 4xx errors (client errors), we can be more specific
  if (status >= 400 && status < 500) {
    // Remove any database or file system paths
    let sanitized = message
      .replace(/\/[\w\/\-\.]+/g, '[PATH]')
      .replace(/C:\\[\w\\:\-\.]+/g, '[PATH]')
      .replace(/at .+\(.+:\d+:\d+\)/g, '')
      .trim();

    // Remove SQL-like patterns that might leak schema info
    sanitized = sanitized
      .replace(/table\s+"?\w+"?/gi, 'table [TABLE]')
      .replace(/column\s+"?\w+"?/gi, 'column [COLUMN]')
      .replace(/SELECT .+ FROM/gi, 'SELECT [QUERY] FROM')
      .replace(/INSERT INTO .+/gi, 'INSERT [QUERY]')
      .replace(/UPDATE .+ SET/gi, 'UPDATE [QUERY] SET');

    return sanitized || 'Bad Request';
  }

  // For 5xx errors (server errors), return generic message
  switch (status) {
    case 500:
      return 'Internal Server Error';
    case 501:
      return 'Not Implemented';
    case 502:
      return 'Bad Gateway';
    case 503:
      return 'Service Unavailable';
    case 504:
      return 'Gateway Timeout';
    default:
      return 'An error occurred while processing your request';
  }
}

/**
 * Async error wrapper
 *
 * Wraps async route handlers to catch errors and pass them to error handler
 * Usage: app.get('/route', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not Found handler
 *
 * Catches requests to non-existent routes
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const error: any = new Error(`Route not found: ${req.method} ${req.path}`);
  error.status = 404;
  next(error);
}
