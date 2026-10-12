/**
 * Service to manage and merge cookies for upstream TeraBox sessions
 */
export class CookieService {
  /**
   * Merge existing Cookie header with newly received Set-Cookie headers
   */
  static mergeCookies(currentCookieHeader, setCookieHeaders) {
    const cookieMap = new Map();

    if (currentCookieHeader) {
      currentCookieHeader.split(';').forEach(c => {
        const parts = c.split('=');
        if (parts.length >= 2) {
          cookieMap.set(parts[0].trim(), parts.slice(1).join('=').trim());
        }
      });
    }

    setCookieHeaders.forEach(sc => {
      const firstPart = sc.split(';')[0];
      const parts = firstPart.split('=');
      if (parts.length >= 2) {
        cookieMap.set(parts[0].trim(), parts.slice(1).join('=').trim());
      }
    });

    return Array.from(cookieMap.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  /**
   * Extract cookie string from Request or Headers object
   */
  static getCookieHeader(headers) {
    if (headers instanceof Headers) {
      return headers.get('Cookie') || '';
    }
    return headers?.Cookie || headers?.cookie || '';
  }

  /**
   * Extract matching cookies from base64 JSON environment config for target hostname
   */
  static localCookieHeader(request, env, targetHostname) {
    if (!env || !env.TERABOX_COOKIE_JSON_B64) {
      return '';
    }

    let cookies;
    try {
      cookies = JSON.parse(atob(env.TERABOX_COOKIE_JSON_B64));
    } catch {
      throw new Error('Local TeraBox cookie JSON is invalid');
    }
    if (!Array.isArray(cookies)) {
      throw new Error('Local TeraBox cookie JSON must be an array');
    }

    const now = Date.now() / 1000;
    const isTbDomain = /terabox|1024tera|terasharelink|dubox/i.test(targetHostname);

    return cookies
      .filter(cookie => {
        if (!cookie || typeof cookie.name !== 'string' || typeof cookie.value !== 'string') return false;
        if (cookie.expirationDate && cookie.expirationDate <= now) return false;
        const domain = String(cookie.domain || '').replace(/^\./, '').toLowerCase();
        const host = targetHostname.toLowerCase();

        if (cookie.hostOnly) {
          return host === domain;
        }
        if (host === domain || host.endsWith(`.${domain}`)) {
          return true;
        }
        // If it is a TeraBox mirror and cookie is a general .terabox.app session cookie
        if (isTbDomain && (domain === 'terabox.app' || domain === '')) {
          return true;
        }
        return false;
      })
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');
  }

  // Instance methods delegating to static methods for flexibility
  mergeCookies(currentCookieHeader, setCookieHeaders) {
    return CookieService.mergeCookies(currentCookieHeader, setCookieHeaders);
  }

  getCookieHeader(headers) {
    return CookieService.getCookieHeader(headers);
  }

  localCookieHeader(request, env, targetHostname) {
    return CookieService.localCookieHeader(request, env, targetHostname);
  }
}

export const cookieService = new CookieService();
