import { BaseController } from './BaseController.js';
import { UPSTREAM_DOMAINS } from '../config/constants.js';
import {
  normalizeSurl,
  isValidSurl,
  buildApiUrl,
  buildHeaders
} from '../utils/helpers.js';
import { HttpClient } from '../services/HttpClient.js';
import { HttpResponse } from '../core/HttpResponse.js';

/**
 * Controller handling legacy page and raw API modes
 */
export class LegacyController extends BaseController {
  constructor({ httpClient = HttpClient } = {}) {
    super();
    this.httpClient = httpClient;
  }

  /**
   * Handle page mode - fetches the raw share page HTML
   */
  async handlePage(request, params) {
    const surl = normalizeSurl(params.get('surl'));
    if (!surl) return this.badRequest('Missing surl');
    if (!isValidSurl(surl)) return this.badRequest('Invalid surl format');

    let lastErr;
    let htmlContent = null;
    let successStatus = 200;

    for (const domain of UPSTREAM_DOMAINS) {
      const url = new URL(`https://${domain}/sharing/link`);
      url.searchParams.set('surl', surl);

      try {
        const res = await this.httpClient.fetchWithTimeout(url, {
          headers: buildHeaders(request, { Accept: 'text/html' }),
          redirect: 'follow'
        }, 8000);

        if (res.ok) {
          const text = await res.text();
          if (!text.includes('need verify') && text.length > 500) {
            htmlContent = text;
            successStatus = res.status;
            break;
          }
          lastErr = new Error(`Verification challenge or truncated HTML (${text.length} bytes) on domain ${domain}`);
        } else {
          lastErr = new Error(`Upstream status ${res.status} on domain ${domain}`);
        }
      } catch (err) {
        lastErr = err;
      }

      // Anonymous fallback if cookie-based request was blocked or challenged
      const hasCookies = !!request.headers.get('Cookie');
      if (!htmlContent && hasCookies) {
        try {
          console.log(`[handlePage] Cookie-based request failed for ${domain}. Retrying anonymously...`);
          const anonHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html'
          };
          const acceptLang = request.headers.get('Accept-Language');
          if (acceptLang) anonHeaders['Accept-Language'] = acceptLang;

          const res = await this.httpClient.fetchWithTimeout(url, {
            headers: anonHeaders,
            redirect: 'follow'
          }, 8000);

          if (res.ok) {
            const text = await res.text();
            if (!text.includes('need verify') && text.length > 500) {
              htmlContent = text;
              successStatus = res.status;
              break;
            }
            lastErr = new Error(`Verification challenge or truncated HTML (${text.length} bytes) on domain ${domain} (anonymous fallback)`);
          } else {
            lastErr = new Error(`Upstream status ${res.status} on domain ${domain} (anonymous fallback)`);
          }
        } catch (err) {
          lastErr = err;
        }
      }
    }

    if (htmlContent === null) {
      return this.errorJson(502, 'All upstream domains failed or required verification', 'upstream_failed_all', {
        reason: lastErr?.message || 'unknown'
      });
    }

    return new Response(htmlContent, {
      status: successStatus,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  /**
   * Handle api mode - manual API call with jsToken and shorturl
   */
  async handleApi(request, params) {
    const jsToken = params.get('jsToken');
    const shorturl = normalizeSurl(params.get('shorturl'));
    if (!jsToken || !shorturl) {
      return this.badRequest('Missing jsToken or shorturl', ['jsToken', 'shorturl']);
    }
    if (!isValidSurl(shorturl)) return this.badRequest('Invalid shorturl format');

    const apiUrl = buildApiUrl(jsToken, shorturl, '1');

    let res;
    try {
      res = await this.httpClient.fetchWithTimeout(apiUrl, {
        headers: buildHeaders(request, {
          Accept: 'application/json',
          Referer: 'https://terabox.com/'
        })
      }, 8000);
    } catch (err) {
      const isAbort = err?.name === 'AbortError';
      return this.errorJson(504, 'Upstream API request timed out', 'upstream_timeout', {
        reason: isAbort ? 'timeout' : 'network_error'
      });
    }

    return HttpResponse.jsonUpstream(res, 'Upstream API request failed');
  }
}

export const legacyController = new LegacyController();
