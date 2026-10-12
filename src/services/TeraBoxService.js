import {
  DEFAULT_JS_TOKEN,
  SHARE_STREAM_SIGNING_KEY
} from '../config/constants.js';
import {
  buildHeaders,
  extractJsToken,
  normalizeSurl
} from '../utils/helpers.js';
import { HttpClient } from './HttpClient.js';
import { CookieService } from './CookieService.js';
import { cacheService } from './CacheService.js';

/**
 * Service managing communication with upstream TeraBox endpoints
 */
export class TeraBoxService {
  constructor({
    httpClient = HttpClient,
    cookieService = CookieService,
    cache = cacheService
  } = {}) {
    this.httpClient = httpClient;
    this.cookieService = cookieService;
    this.cache = cache;
    this.memoryJsToken = DEFAULT_JS_TOKEN;
    this.memoryJsTokenTime = Date.now();
  }

  getJsToken(env) {
    return env?.JSTOKEN || this.memoryJsToken || DEFAULT_JS_TOKEN;
  }

  setMemoryJsToken(token) {
    this.memoryJsToken = token;
    this.memoryJsTokenTime = Date.now();
  }

  /**
   * Scrape jsToken from the share link HTML page
   */
  async scrapeJsToken(surl, upstreamRequest, env) {
    let pageRes = null;
    let html = '';
    let jsToken = null;
    const domainAttempts = [];
    const knownToken = this.getJsToken(env);

    const candidateDomains = [
      'www.1024tera.com',
      '1024tera.com',
      'terasharelink.com',
      'www.terabox.app',
      '1024terabox.com'
    ];

    for (const domain of candidateDomains) {
      try {
        const pageUrlStr = `https://${domain}/sharing/link?surl=${surl}`;
        const anonHeaders = buildHeaders(upstreamRequest);
        delete anonHeaders.Cookie;
        const res = await this.httpClient.fetchWithTimeout(pageUrlStr, {
          headers: anonHeaders,
          redirect: 'follow'
        }, 5000);

        if (res && res.ok) {
          const body = await res.text();
          const extracted = extractJsToken(body);
          domainAttempts.push({
            url: pageUrlStr,
            status: res.status,
            len: body.length,
            needVerify: body.includes('need verify'),
            hasToken: !!extracted
          });
          if (extracted && body.length > 500 && !body.includes('need verify')) {
            jsToken = extracted;
            pageRes = res;
            html = body;
            this.setMemoryJsToken(extracted);
            break;
          }
        }
      } catch (err) {
        domainAttempts.push({
          url: `https://${domain}/sharing/link?surl=${surl}`,
          err: err?.message
        });
      }
    }

    if (!jsToken && knownToken) {
      jsToken = knownToken;
    }

    return { jsToken, pageRes, domainAttempts };
  }

  /**
   * Fetch share info (uk, shareid, sign, randsk) for direct download
   */
  async fetchShareInfo(surl, env, request) {
    const normSurl = normalizeSurl(surl);
    const cached = this.cache.getShareInfo(normSurl);
    if (cached) {
      return cached;
    }

    const querySurl = normSurl.startsWith('1') ? normSurl : `1${normSurl}`;

    // Fetch sharing page first to extract session Set-Cookies and fresh jsToken
    let pageCookies = '';
    let pageJsToken = null;
    let pageErr = null;
    let pageStatus = null;
    try {
      const pageUrl = `https://www.terabox.app/sharing/link?surl=${encodeURIComponent(normSurl)}`;
      const pageHeaders = buildHeaders(request);
      delete pageHeaders.Cookie;
      delete pageHeaders.cookie;
      const pageRes = await this.httpClient.fetchWithTimeout(pageUrl, {
        headers: pageHeaders,
        redirect: 'follow'
      }, 4000);
      if (pageRes) {
        pageStatus = pageRes.status;
        let setCookies = pageRes._allSetCookies || [];
        if (!setCookies.length) {
          if (typeof pageRes.headers.getSetCookie === 'function') {
            setCookies = pageRes.headers.getSetCookie();
          } else {
            const raw = pageRes.headers.get('Set-Cookie');
            if (raw) setCookies = [raw];
          }
        }
        pageCookies = setCookies.filter(Boolean).map(c => c.split(';')[0]).join('; ');
        if (pageRes._mergedCookie) {
          pageCookies = pageCookies ? `${pageRes._mergedCookie}; ${pageCookies}` : pageRes._mergedCookie;
        }
        const html = await pageRes.text();
        pageJsToken = extractJsToken(html);
      }
    } catch (err) {
      pageErr = err?.message;
    }

    const hosts = [
      '1024terabox.com',
      'dm.1024terabox.com',
      'dm.terabox.app',
      'www.1024terabox.com',
      'www.terabox.app',
      '1024tera.com',
      'www.1024tera.com'
    ];
    let info = null;
    const attempts = [];
    const jsToken = pageJsToken || this.getJsToken(env);

    for (const host of hosts) {
      const baseCookie = this.cookieService.localCookieHeader(request, env, host) || this.cookieService.localCookieHeader(request, env, 'dm.terabox.app');
      const fullCookie = baseCookie
        ? (pageCookies ? `${baseCookie}; ${pageCookies}` : baseCookie)
        : (pageCookies || '');

      const u = new URL(`https://${host}/api/shorturlinfo`);
      u.searchParams.set('app_id', '250528');
      u.searchParams.set('shorturl', querySurl);
      u.searchParams.set('root', '1');
      u.searchParams.set('jsToken', jsToken);

      try {
        const res = await this.httpClient.fetchWithTimeout(u.toString(), {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': `https://${host}/sharing/link?surl=${encodeURIComponent(normSurl)}`,
            ...(fullCookie ? { Cookie: fullCookie } : {})
          }
        }, 5000);
        const data = await res.json().catch(() => null);
        attempts.push({ host, status: res.status, errno: data?.errno, cookieLen: fullCookie.length });
        if (res.ok && data && data.errno === 0 && data.randsk) {
          info = {
            shareid: data.shareid,
            uk: data.uk,
            sign: data.sign,
            timestamp: data.timestamp,
            randsk: data.randsk,
            sekey: decodeURIComponent(data.randsk),
            pageCookies,
            pageJsToken
          };
          break;
        }
      } catch (err) {
        attempts.push({ host, err: err?.message, cookieLen: fullCookie.length });
      }
    }

    if (info) {
      this.cache.setShareInfo(normSurl, info);
      return info;
    }

    throw new Error(`Failed to fetch share info: ${JSON.stringify({ pageStatus, pageCookiesLen: pageCookies.length, pageErr, attempts })}`);
  }

  /**
   * Fetch direct download link for a file within a share
   */
  async fetchDirectDownload(surl, fid, env, request) {
    const cleanFid = String(fid || '').replace(/\.0+$/, '').trim();
    if (!cleanFid || !/^\d+$/.test(cleanFid)) {
      throw new Error('Invalid file ID (fid)');
    }

    const info = await this.fetchShareInfo(surl, env, request);
    const jsToken = info.pageJsToken || this.getJsToken(env);

    const hosts = [
      '1024terabox.com',
      'dm.1024terabox.com',
      'dm.terabox.app',
      'www.1024terabox.com',
      'www.terabox.app',
      '1024tera.com',
      'www.1024tera.com'
    ];
    let downloadData = null;
    let lastErr = null;
    let workingCookie = null;

    for (const host of hosts) {
      const baseCookie = this.cookieService.localCookieHeader(request, env, host) || this.cookieService.localCookieHeader(request, env, 'dm.terabox.app');
      const pageCookies = info.pageCookies || '';
      const mergedCookie = baseCookie
        ? (pageCookies ? `${baseCookie}; ${pageCookies}` : baseCookie)
        : (pageCookies || '');
      const fullCookie = mergedCookie
        ? `${mergedCookie}; BDCLND=${info.randsk}; BOXCLND=${info.randsk}`
        : `BDCLND=${info.randsk}; BOXCLND=${info.randsk}`;

      const u = new URL(`https://${host}/openapi/share/download`);
      u.searchParams.set('app_id', '250528');
      u.searchParams.set('jsToken', jsToken);
      u.searchParams.set('shareid', String(info.shareid));
      u.searchParams.set('uk', String(info.uk));
      u.searchParams.set('sign', info.sign);
      u.searchParams.set('timestamp', String(info.timestamp));
      u.searchParams.set('sekey', info.sekey);
      u.searchParams.set('fid_list', `[${cleanFid}]`);
      u.searchParams.set('primaryid', String(info.shareid));

      try {
        const res = await this.httpClient.fetchWithTimeout(u.toString(), {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            Referer: `https://${host}/sharing/link?surl=${encodeURIComponent(normalizeSurl(surl))}`,
            Cookie: fullCookie
          }
        }, 6000);
        const data = await res.json().catch(() => null);
        if (res.ok && data && data.errno === 0 && data.dlink) {
          downloadData = data;
          workingCookie = fullCookie;
          break;
        }
        lastErr = new Error(`openapi/share/download on ${host} errno ${data?.errno}`);
      } catch (err) {
        lastErr = err;
      }
    }

    if (!downloadData) {
      throw (lastErr || new Error('Failed to obtain download link from TeraBox'));
    }

    // Follow 302 redirect from dlink with workingCookie to get the direct CDN URL
    let directCdnUrl = downloadData.dlink;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const headRes = await fetch(downloadData.dlink, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          ...(workingCookie ? { Cookie: workingCookie } : {}),
          Referer: 'https://dm.terabox.app/'
        },
        redirect: 'manual',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const loc = headRes.headers.get('Location') || headRes.headers.get('location');
      if (loc && (headRes.status === 302 || headRes.status === 301)) {
        directCdnUrl = loc;
      }
    } catch (err) {
      console.error('Error following dlink 302:', err);
    }

    return {
      errno: 0,
      dlink: directCdnUrl,
      raw_dlink: downloadData.dlink,
      size: downloadData.file_info?.size,
      filename: downloadData.file_info?.filename,
      file_info: downloadData.file_info || null
    };
  }

  /**
   * Compute HMAC-SHA1 signature for HLS streaming requests
   */
  async createStreamSignature(clientType, channel, browserId, timestamp) {
    const signingKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SHARE_STREAM_SIGNING_KEY),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      signingKey,
      new TextEncoder().encode(`${clientType}${channel}${browserId}${timestamp}`)
    );
    return Array.from(new Uint8Array(signatureBytes))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }
}

export const teraboxService = new TeraBoxService();
