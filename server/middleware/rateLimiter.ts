/**
 * Custom Rate Limiting Middleware
 *
 * Protects against abuse and spam by limiting request rates per API key/user
 * This is a memory-based implementation suitable for single-instance deployments.
 *
 * For production with multiple instances, consider using express-rate-limit with Redis.
 */

import type { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private windowMs: number;
  private max: number;

  constructor(windowMs: number, max: number) {
    this.windowMs = windowMs;
    this.max = max;

    // Clean up old entries every minute to prevent memory leaks
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      if (entry.resetTime < now) {
        this.requests.delete(key);
      }
    }
  }

  check(key: string): { allowed: boolean; current: number; resetTime: number } {
    const now = Date.now();
    const entry = this.requests.get(key);

    // If no entry or window expired, create new entry
    if (!entry || entry.resetTime < now) {
      const newEntry = {
        count: 1,
        resetTime: now + this.windowMs
      };
      this.requests.set(key, newEntry);
      return {
        allowed: true,
        current: 1,
        resetTime: newEntry.resetTime
      };
    }

    // Increment count
    entry.count++;
    this.requests.set(key, entry);

    return {
      allowed: entry.count <= this.max,
      current: entry.count,
      resetTime: entry.resetTime
    };
  }
}

// Create rate limiters for different use cases
const apiLeadLimiterInstance = new RateLimiter(60 * 1000, 10); // 10 per minute
const strictLimiterInstance = new RateLimiter(60 * 60 * 1000, 10); // 10 per hour
const authLimiterInstance = new RateLimiter(15 * 60 * 1000, 100); // 100 per 15 minutes
const orderStatusLimiterInstance = new RateLimiter(60 * 1000, 30); // 30 per minute

/**
 * Rate limiter for external API lead ingestion
 * Limits: 10 requests per minute per API key
 */
export const apiLeadLimiter = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const key = apiKey || req.ip || 'unknown';

  const result = apiLeadLimiterInstance.check(key);

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', '10');
  res.setHeader('X-RateLimit-Remaining', Math.max(0, 10 - result.current).toString());
  res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

  if (!result.allowed) {
    console.warn('[Rate Limit] API lead ingestion limit exceeded:', {
      ip: req.ip,
      apiKey: apiKey ? apiKey.substring(0, 8) + '...' : 'none',
      endpoint: req.path,
      current: result.current,
      timestamp: new Date().toISOString()
    });

    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Limit: 10 lead submissions per minute. Please wait and try again.',
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
    });
  }

  next();
};

/**
 * Rate limiter for sensitive financial operations (withdrawals)
 * Limits: 10 requests per hour
 */
export const strictLimiter = (req: Request, res: Response, next: NextFunction) => {
  const key = req.user?.id?.toString() || req.ip || 'unknown';

  const result = strictLimiterInstance.check(key);

  res.setHeader('X-RateLimit-Limit', '10');
  res.setHeader('X-RateLimit-Remaining', Math.max(0, 10 - result.current).toString());
  res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

  if (!result.allowed) {
    console.warn('[Rate Limit] Strict operation limit exceeded:', {
      userId: req.user?.id,
      ip: req.ip,
      endpoint: req.path,
      current: result.current,
      timestamp: new Date().toISOString()
    });

    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many sensitive operations. Limit: 10 per hour. Please try again later.',
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
    });
  }

  next();
};

/**
 * General rate limiter for authenticated API endpoints
 * Limits: 100 requests per 15 minutes
 */
export const authLimiter = (req: Request, res: Response, next: NextFunction) => {
  const key = req.user?.id?.toString() || req.ip || 'unknown';

  const result = authLimiterInstance.check(key);

  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Remaining', Math.max(0, 100 - result.current).toString());
  res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

  if (!result.allowed) {
    console.warn('[Rate Limit] General auth limit exceeded:', {
      userId: req.user?.id,
      ip: req.ip,
      endpoint: req.path,
      current: result.current,
      timestamp: new Date().toISOString()
    });

    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down and try again later.',
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
    });
  }

  next();
};

/**
 * Rate limiter for order status updates
 * Limits: 30 requests per minute
 */
export const orderStatusLimiter = (req: Request, res: Response, next: NextFunction) => {
  const key = req.user?.id?.toString() || req.ip || 'unknown';

  const result = orderStatusLimiterInstance.check(key);

  res.setHeader('X-RateLimit-Limit', '30');
  res.setHeader('X-RateLimit-Remaining', Math.max(0, 30 - result.current).toString());
  res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

  if (!result.allowed) {
    console.warn('[Rate Limit] Order status update limit exceeded:', {
      userId: req.user?.id,
      ip: req.ip,
      endpoint: req.path,
      current: result.current,
      timestamp: new Date().toISOString()
    });

    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many status updates. Limit: 30 per minute.',
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
    });
  }

  next();
};
