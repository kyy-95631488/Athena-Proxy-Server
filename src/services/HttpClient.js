import { CookieService } from './CookieService.js';

/**
 * Resilient HTTP client with timeouts, manual redirect tracking, and exponential retry
 */
export class HttpClient {
  constructor(cookieService = CookieService) {
    this.cookieService = cookieService;
  }

  /**
   * Determine whether an HTTP status code is transient/retryable
   */
  static isTransientStatus(status) {
    return status === 408 || status === 429 || (status >= 500 && status <= 599);
  }

  /**
   * Calculate retry delay in milliseconds from a Retry-After header
   */
  static getRetryAfterMs(value) {
    if (!value) return null;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const date = Date.parse(value);
    return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
  }

  /**
   * Fetch with timeout and manual redirect handling to preserve session cookies
   */
  static async fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const fetchOptions = {
      ...options,
      redirect: 'manual',
      signal: controller.signal
    };

    let currentUrl = url.toString();
    let redirectsFollowed = 0;
    const maxRedirects = 5;
    const visitedUrls = new Set([currentUrl]);

    const allSetCookies = [];

    try {
      while (true) {
        const currentLogUrl = new URL(currentUrl);
        console.log(`[fetchWithTimeout] Fetching: ${currentLogUrl.origin}${currentLogUrl.pathname}`);
        console.log(`[fetchWithTimeout] Cookie header present: ${!!CookieService.getCookieHeader(fetchOptions.headers)}`);

        const res = await fetch(currentUrl, fetchOptions);
        console.log(`[fetchWithTimeout] Response status: ${res.status}`);

        // Check for manual redirect follow to preserve cookies/headers
        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get('Location');
          if (!location) {
            res._allSetCookies = allSetCookies;
            res._mergedCookie = CookieService.getCookieHeader(fetchOptions.headers);
            return res;
          }

          if (redirectsFollowed >= maxRedirects) {
            throw new Error('Too many redirects followed in manual redirect handler');
          }

          const redirectUrl = new URL(location, currentUrl);
          const nextUrl = redirectUrl.toString();
          console.log(`[fetchWithTimeout] Redirecting to: ${redirectUrl.origin}${redirectUrl.pathname}`);
          if (visitedUrls.has(nextUrl)) {
            console.warn(`[fetchWithTimeout] Redirect loop detected at: ${redirectUrl.origin}${redirectUrl.pathname}`);
            res._allSetCookies = allSetCookies;
            res._mergedCookie = CookieService.getCookieHeader(fetchOptions.headers);
            return res;
          }

          // Extract and merge Set-Cookie headers from redirect response
          let setCookies = [];
          if (typeof res.headers.getSetCookie === 'function') {
            setCookies = res.headers.getSetCookie();
          } else {
            const rawSetCookie = res.headers.get('Set-Cookie');
            if (rawSetCookie) setCookies = [rawSetCookie];
          }

          if (setCookies.length > 0) {
            allSetCookies.push(...setCookies);
            const currentCookie = CookieService.getCookieHeader(fetchOptions.headers);
            const newCookie = CookieService.mergeCookies(currentCookie, setCookies);
            if (newCookie) {
              if (fetchOptions.headers instanceof Headers) {
                fetchOptions.headers.set('Cookie', newCookie);
              } else {
                if (!fetchOptions.headers) fetchOptions.headers = {};
                fetchOptions.headers.Cookie = newCookie;
                delete fetchOptions.headers.cookie;
              }
            }
          }

          currentUrl = nextUrl;
          visitedUrls.add(currentUrl);
          redirectsFollowed++;
          continue;
        }

        if (typeof res.headers.getSetCookie === 'function') {
          const sc = res.headers.getSetCookie();
          if (sc && sc.length) allSetCookies.push(...sc);
        } else {
          const rawSetCookie = res.headers.get('Set-Cookie');
          if (rawSetCookie) allSetCookies.push(rawSetCookie);
        }
        res._allSetCookies = allSetCookies;
        res._mergedCookie = CookieService.getCookieHeader(fetchOptions.headers);
        return res;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch with exponential retry on transient upstream errors
   */
  static async fetchWithRetry(url, options, retries = 2, baseDelayMs = 200, timeoutMs = 8000) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await HttpClient.fetchWithTimeout(url, options, timeoutMs);
        if (res.ok || !HttpClient.isTransientStatus(res.status) || attempt === retries) {
          return res;
        }
        const retryAfterMs = HttpClient.getRetryAfterMs(res.headers.get('Retry-After'));
        if (retryAfterMs !== null && retryAfterMs > 2000) {
          return res;
        }
        lastErr = new Error(`Transient upstream status: ${res.status}`);
        if (retryAfterMs !== null) {
          await new Promise(resolve => setTimeout(resolve, retryAfterMs));
          continue;
        }
      } catch (err) {
        lastErr = err;
        if (attempt === retries) throw err;
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    throw lastErr || new Error('Upstream request failed');
  }

  // Instance wrappers
  isTransientStatus(status) {
    return HttpClient.isTransientStatus(status);
  }

  getRetryAfterMs(value) {
    return HttpClient.getRetryAfterMs(value);
  }

  fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    return HttpClient.fetchWithTimeout(url, options, timeoutMs);
  }

  fetchWithRetry(url, options, retries = 2, baseDelayMs = 200, timeoutMs = 8000) {
    return HttpClient.fetchWithRetry(url, options, retries, baseDelayMs, timeoutMs);
  }
}

export const httpClient = new HttpClient();
