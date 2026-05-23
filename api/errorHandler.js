// ═══════════════════════════════════════════════════════════
// OraaSlayer Centralized Error Handler v1.0
// Provides typed error messages, retry logic, and cached fallback
// ═══════════════════════════════════════════════════════════

/**
 * Error types for categorized handling
 */
const ErrorType = Object.freeze({
  NETWORK: 'network',
  API: 'api',
  AUTH: 'auth',
  TIMEOUT: 'timeout',
  RATE_LIMIT: 'rate_limit',
  VALIDATION: 'validation',
  UNKNOWN: 'unknown'
});

/**
 * Map error codes/types to user-friendly Arabic messages
 */
const ERROR_MESSAGES = {
  [ErrorType.NETWORK]: {
    title: 'خطأ في الاتصال',
    message: 'لا يمكن الاتصال بالخادم. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.',
    icon: 'wifi-off'
  },
  [ErrorType.API]: {
    title: 'خطأ في الخادم',
    message: 'حدث خطأ في الخادم. يرجى المحاولة لاحقاً.',
    icon: 'server'
  },
  [ErrorType.AUTH]: {
    title: 'خطأ في المصادقة',
    message: 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.',
    icon: 'lock'
  },
  [ErrorType.TIMEOUT]: {
    title: 'انتهت المهلة',
    message: 'استغرق الطلب وقتاً طويلاً. حاول مرة أخرى.',
    icon: 'clock'
  },
  [ErrorType.RATE_LIMIT]: {
    title: 'طلبات كثيرة',
    message: 'أنت ترسل طلبات بسرعة كبيرة. انتظر قليلاً وحاول مرة أخرى.',
    icon: 'gauge'
  },
  [ErrorType.VALIDATION]: {
    title: 'بيانات غير صالحة',
    message: 'البيانات المُدخلة غير صحيحة. تحقق وأعد المحاولة.',
    icon: 'alert-circle'
  },
  [ErrorType.UNKNOWN]: {
    title: 'حدث خطأ',
    message: 'حدث خطأ غير متوقع. حاول مرة أخرى.',
    icon: 'alert-triangle'
  }
};

/**
 * Classify an error into its type
 */
function classifyError(error) {
  if (!error) return ErrorType.UNKNOWN;
  
  const msg = String(error.message || error.code || error).toLowerCase();
  const code = String(error.code || '').toLowerCase();
  
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch') || 
      msg.includes('net::') || msg.includes('offline') || code === 'auth/network-request-failed') {
    return ErrorType.NETWORK;
  }
  if (code.startsWith('auth/')) return ErrorType.AUTH;
  if (msg.includes('timeout') || msg.includes('abort') || msg.includes('timed out')) return ErrorType.TIMEOUT;
  if (msg.includes('rate') || msg.includes('429') || msg.includes('too many')) return ErrorType.RATE_LIMIT;
  if (msg.includes('invalid') || msg.includes('required') || msg.includes('validation')) return ErrorType.VALIDATION;
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('server')) return ErrorType.API;
  
  return ErrorType.UNKNOWN;
}

/**
 * Get user-friendly error info
 */
function getErrorInfo(error) {
  const type = classifyError(error);
  return { type, ...ERROR_MESSAGES[type] };
}

/**
 * Retry with exponential backoff
 */
async function withRetry(fn, options = {}) {
  const { maxRetries = 3, baseDelay = 1000, shouldRetry = () => true } = options;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= maxRetries || !shouldRetry(error)) throw error;
      
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export { ErrorType, classifyError, getErrorInfo, withRetry, ERROR_MESSAGES };
export default { ErrorType, classifyError, getErrorInfo, withRetry, ERROR_MESSAGES };
