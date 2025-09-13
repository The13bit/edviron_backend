import logger from './logger.js';

/**
 * Async wrapper for catching errors in async functions
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Wrapped function that handles errors
 */
export const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Creates a delay using Promise
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} - Promise that resolves after delay
 */
export const delay = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry an async operation with exponential backoff
 * @param {Function} operation - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @returns {Promise} - Promise that resolves with operation result or rejects after max retries
 */
export const retryWithBackoff = async (operation, maxRetries = 3, baseDelay = 1000, maxDelay = 10000) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        logger.error(`Operation failed after ${maxRetries + 1} attempts`, {
          error: error.message,
          attempts: attempt + 1
        });
        break;
      }
      
      const delayTime = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      logger.warn(`Operation failed, retrying in ${delayTime}ms`, {
        attempt: attempt + 1,
        maxRetries,
        error: error.message
      });
      
      await delay(delayTime);
    }
  }
  
  throw lastError;
};

/**
 * Execute multiple async operations in parallel with concurrency limit
 * @param {Array} items - Array of items to process
 * @param {Function} asyncFn - Async function to apply to each item
 * @param {number} concurrency - Maximum number of concurrent operations
 * @returns {Promise<Array>} - Promise that resolves with array of results
 */
export const parallelLimit = async (items, asyncFn, concurrency = 5) => {
  const results = [];
  const executing = [];
  
  for (const [index, item] of items.entries()) {
    const promise = asyncFn(item, index).then(result => {
      results[index] = result;
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });
    
    results[index] = promise;
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
};

/**
 * Timeout wrapper for async operations
 * @param {Promise} promise - Promise to add timeout to
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} errorMessage - Error message for timeout
 * @returns {Promise} - Promise that rejects if timeout is reached
 */
export const withTimeout = (promise, timeoutMs, errorMessage = 'Operation timed out') => {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  
  return Promise.race([promise, timeout]);
};

/**
 * Safe async execution with error handling and logging
 * @param {Function} fn - Async function to execute safely
 * @param {string} operation - Description of the operation for logging
 * @param {*} defaultValue - Default value to return on error
 * @returns {Promise} - Promise that always resolves
 */
export const safeAsync = async (fn, operation = 'Operation', defaultValue = null) => {
  try {
    const result = await fn();
    logger.debug(`${operation} completed successfully`);
    return result;
  } catch (error) {
    logger.error(`${operation} failed`, {
      error: error.message,
      stack: error.stack
    });
    return defaultValue;
  }
};

/**
 * Batch process items in chunks
 * @param {Array} items - Items to process
 * @param {Function} processFn - Function to process each batch
 * @param {number} batchSize - Size of each batch
 * @returns {Promise<Array>} - Promise that resolves with array of batch results
 */
export const processBatches = async (items, processFn, batchSize = 100) => {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    logger.debug(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`, {
      batchSize: batch.length,
      totalItems: items.length
    });
    
    try {
      const batchResult = await processFn(batch, Math.floor(i / batchSize));
      results.push(batchResult);
    } catch (error) {
      logger.error(`Batch processing failed for batch ${Math.floor(i / batchSize) + 1}`, {
        error: error.message,
        batchStart: i,
        batchSize: batch.length
      });
      throw error;
    }
  }
  
  return results;
};

/**
 * Create a rate-limited version of an async function
 * @param {Function} fn - Async function to rate limit
 * @param {number} limit - Maximum calls per period
 * @param {number} period - Period in milliseconds
 * @returns {Function} - Rate-limited function
 */
export const rateLimit = (fn, limit, period) => {
  const calls = [];
  
  return async (...args) => {
    const now = Date.now();
    
    // Remove old calls outside the period
    while (calls.length > 0 && calls[0] <= now - period) {
      calls.shift();
    }
    
    // Check if we've hit the limit
    if (calls.length >= limit) {
      const waitTime = calls[0] + period - now;
      logger.debug(`Rate limit reached, waiting ${waitTime}ms`);
      await delay(waitTime);
      return rateLimit(fn, limit, period)(...args);
    }
    
    calls.push(now);
    return fn(...args);
  };
};

/**
 * Memoize async function results with TTL
 * @param {Function} fn - Async function to memoize
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Function} - Memoized function
 */
export const memoizeAsync = (fn, ttl = 60000) => {
  const cache = new Map();
  
  return async (...args) => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      logger.debug('Returning memoized result');
      return cached.value;
    }
    
    try {
      const result = await fn(...args);
      cache.set(key, { value: result, timestamp: Date.now() });
      
      // Clean up expired entries periodically
      if (cache.size > 100) {
        const now = Date.now();
        for (const [cacheKey, cacheValue] of cache.entries()) {
          if (now - cacheValue.timestamp >= ttl) {
            cache.delete(cacheKey);
          }
        }
      }
      
      return result;
    } catch (error) {
      logger.error('Memoized function failed', { error: error.message });
      throw error;
    }
  };
};