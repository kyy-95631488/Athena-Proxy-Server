/**
 * Request handlers for different modes: page, api, resolve, stream, segment
 */

import { buildHeaders, extractJsToken, buildApiUrl, badRequest, jsonUpstream, errorJson, isValidSurl, normalizeSurl } from './utils.js';
import { rewriteM3U8 } from './m3u8.js';
import { storeUpstreamData, getShareFromDb } from './db.js';
const UPSTREAM_DOMAINS = [
  'www.terabox.app',
  'terabox.app',
  'www.1024tera.com',
  '1024tera.com',
  'www.1024terabox.com',
  '1024terabox.com',
  'www.terabox.com',
  'terabox.com'
];
let memoryJsToken = 'EF963D09A098AFE686EA6837292F7B077926BBAC31793D59B9C31846F75FAE22A64B007996B5DF222E4729DBB89106BD9088FE51AC6E5DCEA475FC6B1BEC5A5A17DEBC7677D2EF26D865A65F588A0E6303FAFD6463D1EFF1A4033E121803852F';
let memoryJsTokenTime = Date.now();
const SHARE_STREAM_SIGNING_KEY = 'iuuPc64E4Fhn0rTXEzrnbLph0o5qyEEa';
const RESOLVE_CACHE_TTL_MS = 15_000;
const RESOLVE_FAILURE_COOLDOWN_MS = 30_000;
const RESOLVE_CACHE_MAX_ENTRIES = 100;
const resolveResponseCache = new Map();
const resolveFailureCooldowns = new Map();
const inFlightResolves = new Map();

function isTransientStatus(status) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function getRetryAfterMs(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

function errorWithRetryAfter(status, message, code, details, upstreamResponse) {
  const response = errorJson(status, message, code, details);
  const retryAfter = upstreamResponse?.headers.get('Retry-After');
  if (!retryAfter) return response;

  const headers = new Headers(response.headers);
  headers.set('Retry-After', retryAfter);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function resolveCacheKey(request, surl, dir, requestedFid, raw, internalStreamRequest) {
  return JSON.stringify([
    new URL(request.url).origin,
    surl,
    dir,
    requestedFid,
    raw,
    internalStreamRequest,
    request.headers.get('User-Agent') || ''
  ]);
}

function withResolveCacheStatus(response, status) {
  const cachedResponse = response.clone();
  const headers = new Headers(cachedResponse.headers);
  headers.set('X-Resolve-Cache', status);
  return new Response(cachedResponse.body, {
    status: cachedResponse.status,
    statusText: cachedResponse.statusText,
    headers
  });
}

function mergeCookies(currentCookieHeader, setCookieHeaders) {
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

function localCookieHeader(request, env, targetHostname) {
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

function getCookieHeader(headers) {
  if (headers instanceof Headers) {
    return headers.get('Cookie') || '';
  }
  return headers?.Cookie || headers?.cookie || '';
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
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
      console.log(`[fetchWithTimeout] Cookie header present: ${!!getCookieHeader(fetchOptions.headers)}`);
      
      const res = await fetch(currentUrl, fetchOptions);
      console.log(`[fetchWithTimeout] Response status: ${res.status}`);

      // Check for manual redirect follow to preserve cookies/headers
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('Location');
        if (!location) {
          res._allSetCookies = allSetCookies;
          res._mergedCookie = getCookieHeader(fetchOptions.headers);
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
          res._mergedCookie = getCookieHeader(fetchOptions.headers);
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
          const currentCookie = getCookieHeader(fetchOptions.headers);
          const newCookie = mergeCookies(currentCookie, setCookies);
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
      res._mergedCookie = getCookieHeader(fetchOptions.headers);
      return res;
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(url, options, retries = 2, baseDelayMs = 200, timeoutMs = 8000) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs);
      if (res.ok || !isTransientStatus(res.status) || attempt === retries) {
        return res;
      }
      const retryAfterMs = getRetryAfterMs(res.headers.get('Retry-After'));
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

function toOptionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getProxyThumbnailUrl(origin, fid, size, surl, dir) {
  const params = new URLSearchParams();
  params.set('mode', 'thumbnail');
  params.set('fid', fid);
  if (size && size !== 'url3') {
    params.set('size', size);
  }
  if (surl) {
    params.set('surl', surl);
  }
  if (dir) {
    params.set('dir', dir);
  }
  return `${origin}/?${params.toString()}`;
}

function getParentDirectory(path) {
  const normalized = typeof path === 'string' ? path.replace(/\/+$/, '') : '';
  const separator = normalized.lastIndexOf('/');
  return separator <= 0 ? '' : normalized.slice(0, separator);
}

function rewriteResponseThumbnails(obj, requestUrl, surl) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const origin = new URL(requestUrl).origin;
  
  const processFile = (file, fileSurl) => {
    const fid = file.fs_id || file.fid;
    if (!fid) return;
    
    const resolvedSurl = fileSurl || file.share_id || surl;
    const dir = getParentDirectory(file.path);
    
    if (file.thumb && typeof file.thumb === 'string' && !file.thumb.includes('mode=thumbnail')) {
      file.thumb = getProxyThumbnailUrl(origin, fid, 'url3', resolvedSurl, dir);
    }
    
    if (file.thumbs && typeof file.thumbs === 'object') {
      for (const key of Object.keys(file.thumbs)) {
        if (typeof file.thumbs[key] === 'string' && !file.thumbs[key].includes('mode=thumbnail')) {
          file.thumbs[key] = getProxyThumbnailUrl(origin, fid, key, resolvedSurl, dir);
        }
      }
    }
  };

  if (Array.isArray(obj.list)) {
    obj.list.forEach(file => processFile(file, obj.share_id || surl));
  }
  
  if (obj.data) {
    if (Array.isArray(obj.data.list)) {
      obj.data.list.forEach(file => processFile(file, obj.data.share_id || surl));
    } else if (typeof obj.data === 'object') {
      processFile(obj.data, surl);
    }
  }
  
  return obj;
}

function buildResolvedRecord(surl, share, file, storedAt, origin = '') {
  if (!share || !file) return null;

  const fid = file.fs_id || file.fid || null;
  const thumbUrl = file.thumbs?.url3 || file.thumbs?.url2 || file.thumbs?.url1 || file.thumb || null;
  const isDir = Number(file.isdir) === 1;
  const cleanFid = fid ? String(fid).replace(/\.0+$/, '') : null;
  const defaultDl = (origin && cleanFid && !isDir)
    ? `${origin}/?mode=download&surl=${encodeURIComponent(surl)}&fid=${encodeURIComponent(cleanFid)}`
    : null;

  const hasDirectDlink = file.dlink && !file.dlink.includes('/sharing/link');

  return {
    name: file.server_filename || file.name || null,
    dlink: hasDirectDlink ? file.dlink : defaultDl,
    size: toOptionalNumber(file.size),
    time: toOptionalNumber(file.server_mtime || file.time),
    original_url: `https://terabox.app/s/${surl}`,
    thumb: thumbUrl,
    isdir: isDir,
    path: file.path || null,
    uk: share.uk || null,
    shareid: share.shareid || share.share_id || null,
    fid: fid,
    stored_at: storedAt ?? null,
    last_verified: storedAt ?? null
  };
}

function buildResolvedRecordFromDb(surl, shareData, origin = '') {
  const file = shareData?.list?.[0];
  const storedAt = shareData?.updated_at
    ? Math.floor(new Date(shareData.updated_at).getTime() / 1000)
    : null;

  return buildResolvedRecord(surl, shareData, file, storedAt, origin);
}

function buildShareItems(files, surl, origin = '') {
  return (files || []).map(file => {
    const fid = file.fs_id || file.fid || null;
    const thumb = file.thumbs?.url3 || file.thumbs?.url2 || file.thumbs?.url1 || file.thumb || null;
    const isDir = Number(file.isdir) === 1;
    const cleanFid = fid ? String(fid).replace(/\.0+$/, '') : null;
    const defaultDl = (origin && cleanFid && !isDir)
      ? `${origin}/?mode=download&surl=${encodeURIComponent(surl)}&fid=${encodeURIComponent(cleanFid)}`
      : null;
    const hasDirectDlink = file.dlink && !file.dlink.includes('/sharing/link');

    return {
      fid: fid == null ? null : String(fid),
      name: file.server_filename || file.name || null,
      isdir: isDir,
      path: file.path || null,
      size: toOptionalNumber(file.size),
      time: toOptionalNumber(file.server_mtime || file.time),
      thumb,
      dlink: hasDirectDlink ? file.dlink : defaultDl
    };
  });
}

/**
 * Handle page mode - fetches the share page
 */
export async function handlePage(request, params) {
  const surl = normalizeSurl(params.get('surl'));
  if (!surl) return badRequest('Missing surl');
  if (!isValidSurl(surl)) return badRequest('Invalid surl format');

  let lastErr;
  let htmlContent = null;
  let successStatus = 200;

  for (const domain of UPSTREAM_DOMAINS) {
    const url = new URL(`https://${domain}/sharing/link`);
    url.searchParams.set('surl', surl);

    try {
      const res = await fetchWithTimeout(url, {
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

        const res = await fetchWithTimeout(url, {
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
    return errorJson(502, 'All upstream domains failed or required verification', 'upstream_failed_all', {
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
export async function handleApi(request, params) {
  const jsToken = params.get('jsToken');
  const shorturl = normalizeSurl(params.get('shorturl'));
  if (!jsToken || !shorturl)
    return badRequest('Missing jsToken or shorturl', ['jsToken', 'shorturl']);
  if (!isValidSurl(shorturl)) return badRequest('Invalid shorturl format');

  const apiUrl = buildApiUrl(jsToken, shorturl, '1');

  let res;
  try {
    res = await fetchWithTimeout(apiUrl, {
      headers: buildHeaders(request, {
        Accept: 'application/json',
        Referer: 'https://terabox.com/'
      })
    }, 8000);
  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    return errorJson(504, 'Upstream API request timed out', 'upstream_timeout', {
      reason: isAbort ? 'timeout' : 'network_error'
    });
  }

  return jsonUpstream(res, 'Upstream API request failed');
}

/**
 * Handle resolve mode - extract metadata and cache in D1 when available
 */
export async function handleResolve(request, params, env, options = {}) {
  const surl = normalizeSurl(params.get('surl'));
  const dir = params.get('dir')?.trim() || '';
  const requestedFid = params.get('fid')?.trim() || '';
  const raw = params.get('raw') === '1';
  const internalStreamRequest = options.internalStreamRequest === true || params.get('internalStreamRequest') === '1';
  if (!isValidSurl(surl)) {
    return resolveShare(request, params, env, options);
  }

  const key = resolveCacheKey(request, surl, dir, requestedFid, raw, internalStreamRequest);
  const now = Date.now();
  const cooldown = resolveFailureCooldowns.get(key);
  if (cooldown && cooldown.expiresAt > now) {
    const retryAfter = String(Math.max(1, Math.ceil((cooldown.expiresAt - now) / 1000)));
    return errorWithRetryAfter(
      429,
      'The previous TeraBox request was blocked. Wait before trying this share again.',
      'upstream_backoff',
      { retry_after_seconds: Number(retryAfter) },
      new Response(null, { headers: { 'Retry-After': retryAfter } })
    );
  }
  if (cooldown) resolveFailureCooldowns.delete(key);

  const useResponseCache = !raw
    && params.get('refresh') !== '1'
    && !internalStreamRequest;
  const cached = useResponseCache ? resolveResponseCache.get(key) : null;
  if (cached && cached.expiresAt > now) {
    return withResolveCacheStatus(cached.response, 'HIT');
  }
  if (cached) resolveResponseCache.delete(key);

  const inFlight = inFlightResolves.get(key);
  if (inFlight) {
    return withResolveCacheStatus(await inFlight, 'COALESCED');
  }

  const pending = resolveShare(request, params, env, options);
  inFlightResolves.set(key, pending);
  try {
    const response = await pending;
    if (response.status === 403 || response.status === 429 || response.headers.has('Retry-After')) {
      const retryAfter = getRetryAfterMs(response.headers.get('Retry-After'));
      const cooldownMs = retryAfter === null ? RESOLVE_FAILURE_COOLDOWN_MS : retryAfter;
      if (cooldownMs > 0) {
        resolveFailureCooldowns.set(key, {
          expiresAt: Date.now() + cooldownMs
        });
        while (resolveFailureCooldowns.size > RESOLVE_CACHE_MAX_ENTRIES) {
          resolveFailureCooldowns.delete(resolveFailureCooldowns.keys().next().value);
        }
      }
    } else {
      resolveFailureCooldowns.delete(key);
    }
    if (useResponseCache && response.ok && response.headers.get('Content-Type')?.includes('application/json')) {
      resolveResponseCache.set(key, {
        response: response.clone(),
        expiresAt: Date.now() + RESOLVE_CACHE_TTL_MS
      });
      while (resolveResponseCache.size > RESOLVE_CACHE_MAX_ENTRIES) {
        resolveResponseCache.delete(resolveResponseCache.keys().next().value);
      }
    }
    return withResolveCacheStatus(response, 'MISS');
  } finally {
    inFlightResolves.delete(key);
  }
}

async function resolveShare(request, params, env, options = {}) {
  const surl = normalizeSurl(params.get('surl'));
  const raw = params.get('raw') === '1';
  const internalStreamRequest = options.internalStreamRequest === true || params.get('internalStreamRequest') === '1';
  const dir = params.get('dir')?.trim() || '';
  const requestedFid = params.get('fid')?.trim() || '';
  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.delete('Cookie');
  const upstreamRequest = new Request(request, { headers: upstreamHeaders });

  if (!surl) return badRequest('Missing surl');
  if (!isValidSurl(surl)) return badRequest('Invalid surl format');
  if (dir && (dir.length > 2048 || !dir.startsWith('/') || dir.includes('\\') || /(?:^|\/)\.\.(?:\/|$)/.test(dir))) {
    return badRequest('Invalid directory path');
  }
  if (requestedFid && !/^\d+$/.test(requestedFid)) {
    return badRequest('Invalid fid format');
  }

  // D1 stores files by share, not by directory. Serving that cache can mix items
  // from previously opened folders into the share root listing.

  let pageRes = null;
  let html = '';
  let jsToken = null;
  let streamBrowserId = null;
  let lastErr = null;
  const domainAttempts = [];
  const knownToken = env?.JSTOKEN || memoryJsToken || null;

  // Attempt live scrape on primary domain (1 subrequest)
  try {
    const pageUrlStr = `https://www.terabox.app/sharing/link?surl=${surl}`;
    const anonHeaders = buildHeaders(upstreamRequest);
    delete anonHeaders.Cookie;
    pageRes = await fetchWithTimeout(pageUrlStr, {
      headers: anonHeaders,
      redirect: 'follow'
    }, 4000);

    if (pageRes && pageRes.ok) {
      html = await pageRes.text();
      const extracted = extractJsToken(html);
      domainAttempts.push({ url: pageUrlStr, status: pageRes.status, len: html.length, hasCookie: false, needVerify: html.includes('need verify'), hasToken: !!extracted });
      if (extracted && html.length > 500 && !html.includes('need verify')) {
        jsToken = extracted;
        memoryJsToken = extracted;
        memoryJsTokenTime = Date.now();
      }
    }
  } catch (err) {
    domainAttempts.push({ url: `https://www.terabox.app/sharing/link?surl=${surl}`, err: err?.message });
    lastErr = err;
  }

  // If live scraping was challenged or unavailable, use resilient standalone token
  if (!jsToken && knownToken) {
    jsToken = knownToken;
  }

  if (!jsToken) {
    return errorJson(
      403,
      'Failed to extract jsToken across candidate domains',
      'token_extract_failed_all',
      { reason: lastErr?.message || 'unknown', attempts: domainAttempts }
    );
  }

  let upstream;
  try {
    // Extract Set-Cookie headers from page response
    let setCookies = [];
    if (typeof pageRes.headers.getSetCookie === 'function') {
      setCookies = pageRes.headers.getSetCookie();
    } else {
      const rawSetCookie = pageRes.headers.get('Set-Cookie');
      if (rawSetCookie) setCookies = [rawSetCookie];
    }

    const apiUrl = new URL(buildApiUrl(jsToken, surl, dir ? null : '1', dir || null, 1, 20));
    let localApiCookie = localCookieHeader(upstreamRequest, env, apiUrl.hostname);
    if (!localApiCookie) {
      const localDmCookie = localCookieHeader(upstreamRequest, env, 'dm.1024terabox.com');
      if (localDmCookie) {
        apiUrl.hostname = 'dm.1024terabox.com';
        localApiCookie = localDmCookie;
      }
    }

    // Add cookies from a local cookie export only for matching TeraBox domains.
    let mergedCookie = localApiCookie;
    if (setCookies.length > 0) {
      const cookiesObj = {};
      setCookies.forEach(sc => {
        const firstPart = sc.split(';')[0];
        const parts = firstPart.split('=');
        if (parts.length >= 2) cookiesObj[parts[0].trim()] = parts.slice(1).join('=').trim();
      });
      mergedCookie = mergeCookies(mergedCookie, Object.entries(cookiesObj).map(([k, v]) => `${k}=${v}`));
    }
    streamBrowserId = mergedCookie?.split(';')
      .map(part => part.trim())
      .find(part => part.toLowerCase().startsWith('browserid='))
      ?.slice('browserid='.length) || null;

    const apiHeaders = buildHeaders(upstreamRequest, {
      Accept: 'application/json',
      Referer: `https://${apiUrl.hostname}/sharing/link?surl=${encodeURIComponent(surl)}&clearCache=1`,
      Origin: `https://${apiUrl.hostname}`
    });
    if (mergedCookie) {
      apiHeaders.Cookie = mergedCookie;
    }

    const pageSize = 20;
    const maxItems = 1000;
    const maxPages = Math.ceil(maxItems / pageSize) + 1;
    const files = [];
    const seenFileIds = new Set();
    const root = dir ? null : '1';

    const apiHostCandidates = ['dm.terabox.app', 'www.terabox.app', 'www.1024tera.com', '1024tera.com', '1024terabox.com'];
    let workingApiHost = null;
    let pageData = null;
    let apiRes = null;

    const baseApiHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9'
    };

    const hostAttempts = [];
    // Find working host on page 1
    for (const host of apiHostCandidates) {
      const testApiUrl = new URL(buildApiUrl(jsToken, surl, root, dir || null, 1, pageSize));
      testApiUrl.hostname = host;
      const hostCookie = localCookieHeader(upstreamRequest, env, host) || mergedCookie;
      const headers = { ...baseApiHeaders, Referer: `https://${host}/` };
      if (hostCookie) headers.Cookie = hostCookie;
      try {
        const res = await fetchWithTimeout(testApiUrl.toString(), { headers }, 4000);
        const data = await res.json().catch(() => null);
        hostAttempts.push({ host, status: res.status, errno: data?.errno, errmsg: data?.errmsg, listLen: data?.list?.length });
        if (res.ok && data && data.errno === 0 && Array.isArray(data.list)) {
          workingApiHost = host;
          pageData = data;
          apiRes = res;
          break;
        }
      } catch (err) {
        hostAttempts.push({ host, error: err?.message });
      }
    }

    if (!workingApiHost || !pageData) {
      if (env?.sharedfile) {
        try {
          const cachedShare = await getShareFromDb(env.sharedfile, surl);
          if (cachedShare && cachedShare.list && cachedShare.list.length > 0) {
            let filteredFiles = cachedShare.list;
            if (dir) {
              const prefix = dir.replace(/\/+$/, '') + '/';
              const matched = filteredFiles.filter(f => f.path && (f.path.startsWith(prefix) || f.path === dir));
              if (matched.length > 0) filteredFiles = matched;
            } else {
              const rootItems = filteredFiles.filter(f => {
                const p = String(f.path || '').replace(/^\/+/, '');
                return !p.includes('/');
              });
              if (rootItems.length > 0) filteredFiles = rootItems;
            }
            const selectedFile = requestedFid
              ? cachedShare.list.find(file => String(file.fs_id || file.fid) === requestedFid)
              : filteredFiles[0];
            const origin = new URL(request.url).origin;
            const record = buildResolvedRecord(
              surl,
              { uk: cachedShare.uk, shareid: cachedShare.shareid },
              selectedFile || filteredFiles[0],
              cachedShare.server_time || Math.floor(Date.now() / 1000),
              origin
            );
            return Response.json({
              source: 'd1_cache',
              data: record,
              items: buildShareItems(filteredFiles, surl, origin),
              ...(internalStreamRequest && { _streamAuth: { jsToken, browserId: streamBrowserId } })
            });
          }
        } catch (d1Err) {
          console.error('D1 fallback error:', d1Err);
        }
      }
      return errorJson(502, 'All TeraBox API hosts rejected the request or required verification', 'all_hosts_failed', { attempts: hostAttempts, dir, root, jsToken: jsToken?.slice(0, 10) + '...' });
    }

    for (let page = 1; page <= maxPages; page++) {
      if (page > 1) {
        const pageApiUrl = new URL(buildApiUrl(jsToken, surl, root, dir || null, page, pageSize));
        pageApiUrl.hostname = workingApiHost;
        const pageCookie = localCookieHeader(upstreamRequest, env, workingApiHost) || mergedCookie;
        const headers = { ...baseApiHeaders, Referer: `https://${workingApiHost}/` };
        if (pageCookie) headers.Cookie = pageCookie;
        apiRes = await fetchWithTimeout(pageApiUrl.toString(), { headers }, 8000);
        if (!apiRes.ok) break;
        pageData = await apiRes.json().catch(() => null);
        if (!pageData || pageData.errno !== 0 || !Array.isArray(pageData.list)) break;
      }

      if (!upstream) upstream = pageData;
      const previousCount = files.length;
      for (const file of pageData.list) {
        const fileId = file.fs_id ?? file.fid;
        const key = fileId == null ? null : String(fileId);
        if (key !== null && seenFileIds.has(key)) continue;
        if (key !== null) seenFileIds.add(key);
        files.push(file);
      }

      if (files.length > maxItems) {
        return errorJson(502, 'Share listing exceeded the supported pagination limit', 'share_list_too_large', {
          maxItems
        });
      }
      if (pageData.list.length < pageSize) break;
      if (files.length === previousCount) {
        return errorJson(502, 'TeraBox repeated a share-list page; refusing to return an incomplete listing', 'share_list_pagination_stalled', {
          page,
          pageSize
        });
      }
      if (page === maxPages) {
        return errorJson(502, 'Share listing exceeded the supported pagination limit', 'share_list_too_large', {
          maxItems
        });
      }
    }

    upstream = { ...upstream, list: files };
  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    return errorJson(
      isAbort ? 504 : 502,
      isAbort ? 'Upstream API request timed out' : 'Upstream API request failed',
      isAbort ? 'upstream_timeout' : 'upstream_error',
      err?.message || (isAbort ? 'timeout' : 'network_error')
    );
  }

  if (!upstream?.list?.length) {
    return errorJson(502, 'Empty share list from upstream', 'upstream_empty', upstream);
  }

  // Store complete data in D1 for persistence when configured.
  try {
    if (env.sharedfile) {
      await storeUpstreamData(env.sharedfile, surl, upstream);
    }
  } catch (err) {
    console.error('D1 storage error:', err);
  }

  if (raw) {
    const rewrittenUpstream = rewriteResponseThumbnails(upstream, request.url, surl);
    return Response.json({
      source: 'live',
      upstream: rewrittenUpstream,
      ...(internalStreamRequest && { _streamAuth: { jsToken, browserId: streamBrowserId } })
    });
  }

  const selectedFile = requestedFid
    ? upstream.list.find(file => String(file.fs_id || file.fid) === requestedFid)
    : upstream.list[0];
  if (requestedFid && !selectedFile) {
    return errorJson(404, 'File not found in share directory', 'not_found', { fid: requestedFid });
  }

  const origin = new URL(request.url).origin;
  const record = buildResolvedRecord(
    surl,
    { uk: upstream?.uk, shareid: upstream?.shareid || upstream?.share_id || null },
    selectedFile,
    Math.floor(Date.now() / 1000),
    origin
  );

  if (selectedFile && Number(selectedFile.isdir) !== 1 && (!record.dlink || record.dlink.includes('?mode=download'))) {
    const targetFid = String(selectedFile.fs_id || selectedFile.fid || '').replace(/\.0+$/, '').trim();
    if (targetFid && /^\d+$/.test(targetFid)) {
      try {
        const direct = await fetchDirectDownload(surl, targetFid, env, upstreamRequest);
        if (direct?.dlink) {
          record.dlink = direct.dlink;
        }
      } catch (err) {
        // Fallback to mode=download URL
      }
    }
  }

  return Response.json({
    source: 'live',
    data: record,
    items: buildShareItems(upstream.list, surl, origin),
    ...(internalStreamRequest && { _streamAuth: { jsToken, browserId: streamBrowserId } })
  });
}

/**
 * Handle stream mode - returns M3U8 playlist using cached metadata
 */
export async function handleStream(request, params, env) {
  const surl = normalizeSurl(params.get('surl'));
  const userAgent = request.headers.get('User-Agent') || '';
  const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
  const type = params.get('type') || (isSafari ? 'M3U8_AUTO_360' : 'M3U8_FLV_264_360');
  const requestedFid = params.get('fid')?.trim() || '';
  const dir = params.get('dir')?.trim() || '';

  if (!surl) {
    return badRequest('Missing surl', ['surl']);
  }
  if (!isValidSurl(surl)) {
    return badRequest('Invalid surl format');
  }
  if (![
    'M3U8_AUTO_360',
    'M3U8_FLV_264_360',
    'M3U8_AUTO_480',
    'M3U8_FLV_264_480',
    'M3U8_AUTO_720',
    'M3U8_AUTO_1080',
    'M3U8_AUTO_4K'
  ].includes(type)) {
    return badRequest('Invalid stream type');
  }
  if (requestedFid && !/^\d+$/.test(requestedFid)) {
    return badRequest('Invalid fid format');
  }
  if (dir && (dir.length > 2048 || !dir.startsWith('/') || dir.includes('\\') || /(?:^|\/)\.\.(?:\/|$)/.test(dir))) {
    return badRequest('Invalid directory path');
  }

  let targetDir = dir;
  let record = null;

  // Check D1 first for uk, shareid, and path if requestedFid is available
  if (requestedFid && env?.sharedfile) {
    try {
      const [shareRow, fileRow] = await Promise.all([
        env.sharedfile.prepare('SELECT uk, shareid FROM shares WHERE share_id = ?').bind(surl).first(),
        env.sharedfile.prepare('SELECT path FROM media_files WHERE fs_id = ? AND share_id = ?').bind(requestedFid, surl).first()
      ]);
      if (shareRow && shareRow.uk && shareRow.shareid) {
        record = {
          uk: shareRow.uk,
          shareid: shareRow.shareid,
          fid: requestedFid
        };
      }
      if (fileRow && fileRow.path && !targetDir) {
        const lastSlash = fileRow.path.lastIndexOf('/');
        if (lastSlash > 0) targetDir = fileRow.path.slice(0, lastSlash);
      }
    } catch {}
  }

  let jsToken = env?.JSTOKEN || memoryJsToken || 'EF963D09A098AFE686EA6837292F7B077926BBAC31793D59B9C31846F75FAE22A64B007996B5DF222E4729DBB89106BD9088FE51AC6E5DCEA475FC6B1BEC5A5A17DEBC7677D2EF26D865A65F588A0E6303FAFD6463D1EFF1A4033E121803852F';
  let browserId = null;

  if (env?.TERABOX_COOKIE_JSON_B64) {
    try {
      const cookies = JSON.parse(atob(env.TERABOX_COOKIE_JSON_B64));
      const bCookie = cookies.find(c => c && c.name && c.name.toLowerCase() === 'browserid');
      if (bCookie?.value) browserId = bCookie.value;
    } catch {}
  }

  // If record not found in D1, resolve it
  if (!record) {
    const resolveParams = new URLSearchParams(params);
    resolveParams.delete('raw');
    if (requestedFid) resolveParams.set('fid', requestedFid);
    if (targetDir) resolveParams.set('dir', targetDir);
    const resolveRes = await handleResolve(request, resolveParams, env, {
      internalStreamRequest: true
    });
    if (!resolveRes.ok) return resolveRes;

    let resolvedBody;
    try {
      resolvedBody = await resolveRes.json();
    } catch {
      return errorJson(502, 'Resolve returned invalid stream metadata', 'invalid_stream_metadata');
    }
    record = resolvedBody?.data;
    if (resolvedBody?._streamAuth?.jsToken) jsToken = resolvedBody._streamAuth.jsToken;
    if (resolvedBody?._streamAuth?.browserId) browserId = resolvedBody._streamAuth.browserId;
  }

  if (!record?.uk || !record?.shareid || !record?.fid || !jsToken || !browserId) {
    return errorJson(502, 'TeraBox did not provide the required public stream parameters', 'incomplete_stream_metadata', {
      hasUk: !!record?.uk,
      hasShareId: !!record?.shareid,
      hasFid: !!record?.fid,
      hasJsToken: !!jsToken,
      hasBrowserId: !!browserId
    });
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const clientType = '0';
  const channel = 'dubox';
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
  const sign = Array.from(new Uint8Array(signatureBytes))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

  // Primary endpoint for full-duration streaming is /openapi/share/streaming on dm.terabox.app with session cookies
  const streamCandidates = [
    { host: 'dm.terabox.app', path: '/openapi/share/streaming' },
    { host: 'www.terabox.app', path: '/openapi/share/streaming' },
    { host: 'dm.terabox.app', path: '/share/streaming' },
    { host: 'www.terabox.app', path: '/share/streaming' }
  ];

  let res = null;
  let playlist = '';
  let bestRes = null;
  let bestPlaylist = '';
  let bestSegmentCount = 0;

  for (const candidate of streamCandidates) {
    const streamUrl = new URL(`https://${candidate.host}${candidate.path}`);
    streamUrl.searchParams.set('uk', String(record.uk));
    streamUrl.searchParams.set('shareid', String(record.shareid));
    streamUrl.searchParams.set('fid', String(record.fid));
    streamUrl.searchParams.set('type', type);
    streamUrl.searchParams.set('sign', sign);
    streamUrl.searchParams.set('timestamp', timestamp);
    streamUrl.searchParams.set('jsToken', jsToken);
    streamUrl.searchParams.set('esl', '1');
    streamUrl.searchParams.set('isplayer', '1');
    streamUrl.searchParams.set('ehps', '1');
    streamUrl.searchParams.set('clienttype', clientType);
    streamUrl.searchParams.set('app_id', '250528');
    streamUrl.searchParams.set('web', '1');
    streamUrl.searchParams.set('channel', channel);

    const cookie = localCookieHeader(request, env, candidate.host);
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Referer': `https://${candidate.host}/sharing/link?surl=${encodeURIComponent(surl)}`,
      'Origin': `https://${candidate.host}`
    };
    if (cookie) {
      headers.Cookie = cookie;
    }

    try {
      const streamRes = await fetchWithTimeout(streamUrl.toString(), { headers }, 8000);
      if (streamRes.ok) {
        const text = await streamRes.text();
        if (text.includes('#EXTM3U')) {
          const segCount = (text.match(/#EXTINF/g) || []).length;
          // Full video playlist from openapi or > 3 segments -> accept immediately
          if (candidate.path === '/openapi/share/streaming' || segCount > 3) {
            res = streamRes;
            playlist = text;
            break;
          }
          if (segCount > bestSegmentCount) {
            bestRes = streamRes;
            bestPlaylist = text;
            bestSegmentCount = segCount;
          }
        }
      }
    } catch {}
  }

  // Fallback to best available playlist if no host returned > 3 segments (e.g. short clips <= 30s)
  if (!playlist && bestPlaylist) {
    res = bestRes;
    playlist = bestPlaylist;
  }

  if (!res || !playlist.includes('#EXTM3U')) {
    return errorJson(502, 'Upstream stream request failed across all hosts', 'upstream_stream_failed');
  }
  const rewritten = rewriteM3U8(playlist, request);

  return new Response(rewritten, {
    status: res.status,
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-store'
    }
  });
}

/**
 * Allowed domains for segment proxying (SSRF protection)
 */
const ALLOWED_SEGMENT_DOMAINS = [
  'terabox.com',
  'terabox.app',
  '1024tera.com',
  '1024terabox.com',
  'freeterabox.com',
  'teraboxcdn.com',
  'dm.terabox.app',
  'dm.1024tera.com',
  'terasharelink.com',
  'terafileshare.com',
  'teraboxlink.com',
  'teraboxshare.com',
  'terasharefile.com',
  'teraboxurl.com',
  
];

/**
 * Validate that URL belongs to an allowed TeraBox domain
 */
function isAllowedSegmentUrl(urlString) {
  try {
    const url = new URL(urlString);
    return ALLOWED_SEGMENT_DOMAINS.some(domain => 
      url.hostname === domain || url.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

/**
 * Handle segment mode - proxies video segments
 */
export async function handleSegment(request, params, env) {
  const targetUrl = params.get('url');
  if (!targetUrl) {
    return badRequest('Missing url param', ['url']);
  }

  // SSRF protection: only allow TeraBox domains
  if (!isAllowedSegmentUrl(targetUrl)) {
    return errorJson(403, 'Invalid segment URL: only TeraBox domains allowed', 'invalid_segment_url');
  }

  const forwardHeaders = {};
  const range = request.headers.get('Range');
  if (range) forwardHeaders.Range = range;
  const ifRange = request.headers.get('If-Range');
  if (ifRange) forwardHeaders['If-Range'] = ifRange;
  const ifModified = request.headers.get('If-Modified-Since');
  if (ifModified) forwardHeaders['If-Modified-Since'] = ifModified;
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch) forwardHeaders['If-None-Match'] = ifNoneMatch;
  const acceptEncoding = request.headers.get('Accept-Encoding');
  if (acceptEncoding) forwardHeaders['Accept-Encoding'] = acceptEncoding;

  let res;
  try {
    res = await fetchWithTimeout(targetUrl, {
      headers: buildHeaders(request, {
        Referer: 'https://www.terabox.com/',
        ...forwardHeaders
      })
    }, 8000);
  } catch (err) {
    res = null;
  }

  if ((!res || !res.ok) && env?.UPSTREAM_RESOLVER_URL) {
    try {
      const fbUrl = new URL(env.UPSTREAM_RESOLVER_URL);
      fbUrl.searchParams.set('mode', 'segment');
      fbUrl.searchParams.set('url', targetUrl);
      const fbRes = await fetchWithTimeout(fbUrl.toString(), {
        headers: buildHeaders(request, {
          Referer: 'https://www.terabox.com/',
          ...forwardHeaders
        })
      }, 12000);
      if (fbRes.ok) {
        res = fbRes;
      }
    } catch (fbErr) {
      console.warn('Fallback segment error:', fbErr);
    }
  }

  if (!res || !res.ok) {
    return errorJson(
      res ? res.status : 502,
      'Upstream segment request failed',
      'upstream_error',
      res ? `HTTP ${res.status}` : 'network_error'
    );
  }

  const responseHeaders = new Headers({
    'Content-Type': res.headers.get('content-type') || 'video/mp2t',
    'Cache-Control': 'no-store'
  });
  const passthroughHeaders = [
    'Content-Range',
    'Accept-Ranges',
    'Content-Length',
    'ETag',
    'Last-Modified'
  ];
  passthroughHeaders.forEach((h) => {
    const v = res.headers.get(h);
    if (v) responseHeaders.set(h, v);
  });

  return new Response(res.body, {
    status: res.status,
    headers: responseHeaders
  });
}

const shareInfoCache = new Map();
const SHARE_INFO_CACHE_TTL_MS = 60 * 60 * 1000;

export async function fetchShareInfo(surl, env, request) {
  const normSurl = normalizeSurl(surl);
  const now = Date.now();
  const cached = shareInfoCache.get(normSurl);
  if (cached && cached.expiresAt > now) {
    return cached.data;
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
    const pageRes = await fetchWithTimeout(pageUrl, {
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

  const hosts = ['1024terabox.com', 'dm.1024terabox.com', 'dm.terabox.app', 'www.1024terabox.com', 'www.terabox.app', '1024tera.com', 'www.1024tera.com'];
  let info = null;
  let lastErr = null;
  const attempts = [];
  const jsToken = pageJsToken || env?.JSTOKEN || memoryJsToken || 'EF963D09A098AFE686EA6837292F7B077926BBAC31793D59B9C31846F75FAE22A64B007996B5DF222E4729DBB89106BD9088FE51AC6E5DCEA475FC6B1BEC5A5A17DEBC7677D2EF26D865A65F588A0E6303FAFD6463D1EFF1A4033E121803852F';

  for (const host of hosts) {
    const baseCookie = localCookieHeader(request, env, host) || localCookieHeader(request, env, 'dm.terabox.app');
    const fullCookie = baseCookie
      ? (pageCookies ? `${baseCookie}; ${pageCookies}` : baseCookie)
      : (pageCookies || '');

    const u = new URL(`https://${host}/api/shorturlinfo`);
    u.searchParams.set('app_id', '250528');
    u.searchParams.set('shorturl', querySurl);
    u.searchParams.set('root', '1');
    u.searchParams.set('jsToken', jsToken);

    try {
      const res = await fetchWithTimeout(u.toString(), {
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
      lastErr = new Error(`shorturlinfo on ${host} errno ${data?.errno}`);
    } catch (err) {
      attempts.push({ host, err: err?.message, cookieLen: fullCookie.length });
      lastErr = err;
    }
  }

  if (info) {
    shareInfoCache.set(normSurl, { data: info, expiresAt: now + SHARE_INFO_CACHE_TTL_MS });
    while (shareInfoCache.size > 200) {
      shareInfoCache.delete(shareInfoCache.keys().next().value);
    }
    return info;
  }
  throw new Error(`Failed to fetch share info: ${JSON.stringify({ pageStatus, pageCookiesLen: pageCookies.length, pageErr, attempts })}`);
}

export async function fetchDirectDownload(surl, fid, env, request) {
  const cleanFid = String(fid || '').replace(/\.0+$/, '').trim();
  if (!cleanFid || !/^\d+$/.test(cleanFid)) {
    throw new Error('Invalid file ID (fid)');
  }

  const info = await fetchShareInfo(surl, env, request);
  const jsToken = info.pageJsToken || env?.JSTOKEN || memoryJsToken || 'EF963D09A098AFE686EA6837292F7B077926BBAC31793D59B9C31846F75FAE22A64B007996B5DF222E4729DBB89106BD9088FE51AC6E5DCEA475FC6B1BEC5A5A17DEBC7677D2EF26D865A65F588A0E6303FAFD6463D1EFF1A4033E121803852F';

  const hosts = ['1024terabox.com', 'dm.1024terabox.com', 'dm.terabox.app', 'www.1024terabox.com', 'www.terabox.app', '1024tera.com', 'www.1024tera.com'];
  let downloadData = null;
  let lastErr = null;
  let workingCookie = null;

  for (const host of hosts) {
    const baseCookie = localCookieHeader(request, env, host) || localCookieHeader(request, env, 'dm.terabox.app');
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
      const res = await fetchWithTimeout(u.toString(), {
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

export async function handleDownload(request, params, env) {
  const surl = normalizeSurl(params.get('surl'));
  const rawFid = params.get('fid')?.trim() || '';
  const fid = rawFid.replace(/\.0+$/, '');
  const asJson = params.get('json') === '1';

  if (!surl) return badRequest('Missing surl');
  if (!isValidSurl(surl)) return badRequest('Invalid surl format');
  if (!fid || !/^\d+$/.test(fid)) return badRequest('Missing or invalid fid parameter');

  try {
    const result = await fetchDirectDownload(surl, fid, env, request);

    if (asJson) {
      return Response.json({
        ok: true,
        dlink: result.dlink,
        size: result.size,
        filename: result.filename
      });
    }

    if (params.get('redirect') === '1') {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': result.dlink,
          'Cache-Control': 'public, max-age=1800',
          ...(result.filename ? { 'Content-Disposition': `attachment; filename="${encodeURIComponent(result.filename)}"` } : {})
        }
      });
    }

    // Proxy the download stream directly to the client
    const rangeHeader = request.headers.get('Range') || request.headers.get('range');
    const proxyHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      ...(rangeHeader ? { Range: rangeHeader } : {})
    };

    const upstreamRes = await fetch(result.dlink, {
      headers: proxyHeaders
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': result.dlink,
          'Cache-Control': 'public, max-age=1800',
          ...(result.filename ? { 'Content-Disposition': `attachment; filename="${encodeURIComponent(result.filename)}"` } : {})
        }
      });
    }

    const respHeaders = new Headers(upstreamRes.headers);
    respHeaders.set('Access-Control-Allow-Origin', '*');
    respHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    respHeaders.set('Access-Control-Allow-Headers', 'Range, Content-Type');
    respHeaders.set('Cache-Control', 'public, max-age=3600');
    if (result.filename) {
      respHeaders.set('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    }

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: respHeaders
    });
  } catch (err) {
    return errorJson(502, err?.message || 'Failed to generate direct download link', 'download_failed');
  }
}

/**
 * Handle lookup mode - query D1 database directly without hitting upstream
 * Supports lookup by share ID (surl) or file ID (fid)
 */
export async function handleLookup(request, params, env) {
  const surl = normalizeSurl(params.get('surl'));
  const fid = params.get('fid');

  if (!surl && !fid) {
    return badRequest('Missing surl or fid parameter', ['surl', 'fid']);
  }
  if (surl && !isValidSurl(surl)) {
    return badRequest('Invalid surl format');
  }
  if (fid && !/^\d+$/.test(fid)) {
    return badRequest('Invalid fid format');
  }

  if (!env.sharedfile) {
    return errorJson(503, 'D1 database not configured', 'd1_unavailable');
  }

  try {
    // Lookup by file ID
    if (fid) {
      const file = await env.sharedfile
        .prepare('SELECT * FROM media_files WHERE fs_id = ?')
        .bind(fid)
        .first();

      if (!file) {
        return errorJson(404, 'File not found', 'not_found', { fid });
      }

      // Get thumbnails for this file
      const thumbs = await env.sharedfile
        .prepare('SELECT url, thumbnail_type FROM thumbnails WHERE fs_id = ?')
        .bind(fid)
        .all();

      const thumbsObj = {};
      const origin = new URL(request.url).origin;
      thumbs.results.forEach(t => {
        thumbsObj[t.thumbnail_type] = getProxyThumbnailUrl(origin, fid, t.thumbnail_type, file.share_id);
      });

      const thumbUrl = thumbsObj.url3 || thumbsObj.url2 || thumbsObj.url1 || null;

      const hasDirect = file.dlink && !file.dlink.includes('/sharing/link');
      const dlink = hasDirect ? file.dlink : (file.share_id ? `${origin}/?mode=download&surl=${encodeURIComponent(file.share_id)}&fid=${encodeURIComponent(fid)}` : null);

      return Response.json({
        source: 'd1',
        data: { ...file, dlink, thumb: thumbUrl, thumbs: thumbsObj }
      });
    }

    // Lookup by share ID
    const shareData = await getShareFromDb(env.sharedfile, surl);

    if (!shareData) {
      return errorJson(404, 'Share not found in D1. Use mode=resolve first.', 'not_found', { surl });
    }

    const rewrittenShareData = rewriteResponseThumbnails(shareData, request.url, surl);
    return Response.json({
      source: 'd1',
      data: rewrittenShareData
    });
  } catch (err) {
    console.error('D1 lookup error:', err);
    return errorJson(500, 'Database query failed', 'db_error', err?.message || 'unknown');
  }
}

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return n;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeOrder(order) {
  return order && order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
}

function normalizeSort(sort, allowed, fallback) {
  return allowed.includes(sort) ? sort : fallback;
}

function requireD1(env) {
  if (!env.sharedfile) {
    return errorJson(503, 'D1 database not configured', 'd1_unavailable');
  }
  return null;
}

export async function handleAdminOverview(request, params, env) {
  const missing = requireD1(env);
  if (missing) return missing;

  const sharesCount = await env.sharedfile
    .prepare('SELECT COUNT(*) as total FROM shares')
    .first();
  const filesCount = await env.sharedfile
    .prepare('SELECT COUNT(*) as total FROM media_files')
    .first();
  const thumbsCount = await env.sharedfile
    .prepare('SELECT COUNT(*) as total FROM thumbnails')
    .first();
  const latestShares = await env.sharedfile
    .prepare('SELECT share_id, title, updated_at FROM shares ORDER BY updated_at DESC LIMIT 20')
    .all();

  return Response.json({
    counts: {
      shares: sharesCount?.total || 0,
      media_files: filesCount?.total || 0,
      thumbnails: thumbsCount?.total || 0
    },
    latestShares: latestShares?.results || []
  });
}

export async function handleAdminShares(request, params, env) {
  const missing = requireD1(env);
  if (missing) return missing;

  const q = params.get('q')?.trim();
  const sort = normalizeSort(params.get('sort'), ['updated_at', 'server_time', 'title'], 'updated_at');
  const order = normalizeOrder(params.get('order'));
  const page = parsePositiveInt(params.get('page'), 1);
  const pageSize = clamp(parsePositiveInt(params.get('pageSize'), 50), 1, 200);
  const offset = (page - 1) * pageSize;

  const where = q ? 'WHERE share_id LIKE ? OR title LIKE ? OR uk LIKE ?' : '';
  const binds = [];
  if (q) {
    const like = `%${q}%`;
    binds.push(like, like, like);
  }

  const totalRow = await env.sharedfile
    .prepare(`SELECT COUNT(*) as total FROM shares ${where}`)
    .bind(...binds)
    .first();

  const list = await env.sharedfile
    .prepare(
      `SELECT share_id, uk, title, server_time, request_id, updated_at
       FROM shares ${where}
       ORDER BY ${sort} ${order}
       LIMIT ? OFFSET ?`
    )
    .bind(...binds, pageSize, offset)
    .all();

  return Response.json({
    page,
    pageSize,
    total: totalRow?.total || 0,
    items: list?.results || []
  });
}

export async function handleAdminShareDetail(request, params, env, shareId) {
  shareId = normalizeSurl(shareId);
  if (!shareId) return badRequest('Missing share_id');
  if (!isValidSurl(shareId)) return badRequest('Invalid share_id format');
  const missing = requireD1(env);
  if (missing) return missing;

  const share = await env.sharedfile
    .prepare('SELECT * FROM shares WHERE share_id = ?')
    .bind(shareId)
    .first();

  if (!share) {
    return errorJson(404, 'Share not found', 'not_found', { share_id: shareId });
  }

  const page = parsePositiveInt(params.get('page'), 1);
  const pageSize = clamp(parsePositiveInt(params.get('pageSize'), 50), 1, 200);
  const offset = (page - 1) * pageSize;

  const totalFilesRow = await env.sharedfile
    .prepare('SELECT COUNT(*) as total FROM media_files WHERE share_id = ?')
    .bind(shareId)
    .first();

  const files = await env.sharedfile
    .prepare(
      `SELECT * FROM media_files
       WHERE share_id = ?
       ORDER BY server_mtime DESC
       LIMIT ? OFFSET ?`
    )
    .bind(shareId, pageSize, offset)
    .all();

  const fileIds = (files?.results || []).map(f => f.fs_id).filter(Boolean);
  let thumbsByFsId = {};
  if (fileIds.length > 0 && fileIds.length <= 200) {
    const placeholders = fileIds.map(() => '?').join(',');
    const thumbs = await env.sharedfile
      .prepare(`SELECT fs_id, url, thumbnail_type FROM thumbnails WHERE fs_id IN (${placeholders})`)
      .bind(...fileIds)
      .all();

    thumbsByFsId = {};
    (thumbs?.results || []).forEach(t => {
      if (!thumbsByFsId[t.fs_id]) thumbsByFsId[t.fs_id] = {};
      thumbsByFsId[t.fs_id][t.thumbnail_type] = t.url;
    });
  }

  return Response.json({
    share,
    files: (files?.results || []).map(item => ({
      ...item,
      fs_id: item.fs_id ? String(item.fs_id).replace(/\.0+$/, '') : item.fs_id
    })),
    thumbsByFsId,
    page,
    pageSize,
    totalFiles: totalFilesRow?.total || 0
  });
}

export async function handleAdminFiles(request, params, env) {
  const missing = requireD1(env);
  if (missing) return missing;

  const q = params.get('q')?.trim();
  const shareId = normalizeSurl(params.get('share_id')?.trim());
  if (shareId && !isValidSurl(shareId)) return badRequest('Invalid share_id format');
  const sizeMin = params.get('size_min');
  const sizeMax = params.get('size_max');
  const sort = normalizeSort(params.get('sort'), ['server_mtime', 'size', 'server_filename'], 'server_mtime');
  const order = normalizeOrder(params.get('order'));
  const page = parsePositiveInt(params.get('page'), 1);
  const pageSize = clamp(parsePositiveInt(params.get('pageSize'), 50), 1, 200);
  const offset = (page - 1) * pageSize;

  const whereParts = [];
  const binds = [];

  if (shareId) {
    whereParts.push('share_id = ?');
    binds.push(shareId);
  }
  if (q) {
    whereParts.push('(server_filename LIKE ? OR fs_id LIKE ?)');
    const like = `%${q}%`;
    binds.push(like, like);
  }
  if (sizeMin) {
    whereParts.push('size >= ?');
    binds.push(Number(sizeMin));
  }
  if (sizeMax) {
    whereParts.push('size <= ?');
    binds.push(Number(sizeMax));
  }

  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const totalRow = await env.sharedfile
    .prepare(`SELECT COUNT(*) as total FROM media_files ${where}`)
    .bind(...binds)
    .first();

  const list = await env.sharedfile
    .prepare(
      `SELECT * FROM media_files ${where}
       ORDER BY ${sort} ${order}
       LIMIT ? OFFSET ?`
    )
    .bind(...binds, pageSize, offset)
    .all();

  return Response.json({
    page,
    pageSize,
    total: totalRow?.total || 0,
    items: (list?.results || []).map(item => ({
      ...item,
      fs_id: item.fs_id ? String(item.fs_id).replace(/\.0+$/, '') : item.fs_id
    }))
  });
}

export async function handleAdminFileDetail(request, params, env, fsId) {
  if (!fsId) return badRequest('Missing fs_id');
  const normalizedFsId = String(fsId).trim().replace(/\.0+$/, '');
  if (!/^\d+$/.test(normalizedFsId)) return badRequest('Invalid fs_id format');
  const missing = requireD1(env);
  if (missing) return missing;

  const file = await env.sharedfile
    .prepare('SELECT * FROM media_files WHERE fs_id = ? OR fs_id = ?')
    .bind(normalizedFsId, normalizedFsId + '.0')
    .first();

  if (!file) {
    return errorJson(404, 'File not found', 'not_found', { fs_id: fsId });
  }

  const thumbs = await env.sharedfile
    .prepare('SELECT url, thumbnail_type FROM thumbnails WHERE fs_id = ? OR fs_id = ?')
    .bind(normalizedFsId, normalizedFsId + '.0')
    .all();

  const thumbsObj = {};
  (thumbs?.results || []).forEach(t => {
    thumbsObj[t.thumbnail_type] = t.url;
  });

  const origin = new URL(request.url).origin;
  const cleanFsId = file.fs_id ? String(file.fs_id).replace(/\.0+$/, '') : file.fs_id;
  const hasDirect = file.dlink && !file.dlink.includes('/sharing/link');
  const dlink = hasDirect ? file.dlink : (file.share_id && cleanFsId ? `${origin}/?mode=download&surl=${encodeURIComponent(file.share_id)}&fid=${encodeURIComponent(cleanFsId)}` : null);

  return Response.json({
    file: {
      ...file,
      fs_id: cleanFsId,
      dlink: dlink
    },
    thumbs: thumbsObj
  });
}

export async function handleAdminThumbnails(request, params, env) {
  const missing = requireD1(env);
  if (missing) return missing;

  const rawFsId = params.get('fs_id')?.trim();
  const fsId = rawFsId ? rawFsId.replace(/\.0+$/, '') : null;
  if (fsId && !/^\d+$/.test(fsId)) return badRequest('Invalid fs_id format');
  const type = params.get('type')?.trim();
  const page = parsePositiveInt(params.get('page'), 1);
  const pageSize = clamp(parsePositiveInt(params.get('pageSize'), 50), 1, 200);
  const offset = (page - 1) * pageSize;

  const whereParts = [];
  const binds = [];

  if (fsId) {
    whereParts.push('(fs_id = ? OR fs_id = ?)');
    binds.push(fsId, fsId + '.0');
  }
  if (type) {
    whereParts.push('thumbnail_type = ?');
    binds.push(type);
  }

  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const totalRow = await env.sharedfile
    .prepare(`SELECT COUNT(*) as total FROM thumbnails ${where}`)
    .bind(...binds)
    .first();

  const list = await env.sharedfile
    .prepare(
      `SELECT * FROM thumbnails ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...binds, pageSize, offset)
    .all();

  return Response.json({
    page,
    pageSize,
    total: totalRow?.total || 0,
    items: (list?.results || []).map(item => ({
      ...item,
      fs_id: item.fs_id ? String(item.fs_id).replace(/\.0+$/, '') : item.fs_id
    }))
  });
}

export async function handleAdminAnalyticsProcessed(request, params, env) {
  const missing = requireD1(env);
  if (missing) return missing;

  const limit = clamp(parsePositiveInt(params.get('limit'), 30), 1, 180);
  const rows = await env.sharedfile
    .prepare(
      `SELECT DATE(updated_at) as day, COUNT(*) as shares
       FROM shares
       GROUP BY day
       ORDER BY day DESC
       LIMIT ?`
    )
    .bind(limit)
    .all();

  return Response.json({
    limit,
    items: rows?.results || []
  });
}

export async function handleAdminKvEntry(request, params, env) {
  const missing = requireD1(env);
  if (missing) return missing;

  const surl = normalizeSurl(params.get('surl'));
  if (!surl) return badRequest('Missing surl');
  if (!isValidSurl(surl)) return badRequest('Invalid surl format');

  try {
    const shareData = await getShareFromDb(env.sharedfile, surl);
    const record = buildResolvedRecordFromDb(surl, shareData);
    if (!record) {
      return errorJson(404, 'Cached entry not found', 'not_found', { surl });
    }
    return Response.json({ surl, data: record });
  } catch (err) {
    return errorJson(500, 'Cached entry lookup failed', 'db_error', err?.message || 'unknown');
  }
}

export async function handleThumbnail(request, params, env) {
  const fid = params.get('fid');
  const size = params.get('size') || 'url3'; // url3 is typically the highest resolution (850x580)
  let surl = normalizeSurl(params.get('surl'));
  let dir = params.get('dir')?.trim() || '';

  if (!fid) {
    return badRequest('Missing fid parameter', ['fid']);
  }
  if (!/^\d+$/.test(fid)) {
    return badRequest('Invalid fid format');
  }
  if (dir && (dir.length > 2048 || !dir.startsWith('/') || dir.includes('\\') || /(?:^|\/)\.\.(?:\/|$)/.test(dir))) {
    return badRequest('Invalid directory path');
  }

  if (!env.sharedfile) {
    return errorJson(503, 'D1 database not configured', 'd1_unavailable');
  }

  // Use the cached path to refresh thumbnails from the same directory listing.
  try {
    const row = await env.sharedfile
      .prepare('SELECT share_id, path FROM media_files WHERE fs_id = ?')
      .bind(fid)
      .first();
    if (row) {
      if (!surl) surl = row.share_id;
      if (!dir && row.path) dir = getParentDirectory(row.path);
    }
  } catch (err) {
    console.error('Database query error looking up thumbnail file:', err);
  }

  // Fetch signed image URLs through the Worker to avoid browser cross-origin restrictions.
  const fetchAndServeImage = async (imgUrl) => {
    const res = await fetchWithTimeout(imgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.terabox.com/'
      }
    }, 6000);

    if (res.ok) {
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) return null;
      // Return the image data with caching headers to cache on CDN
      return new Response(res.body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000', // 1 year cache
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    return null;
  };

  const getThumbnailUrls = async () => {
    const rows = await env.sharedfile
      .prepare('SELECT url, thumbnail_type FROM thumbnails WHERE fs_id = ?')
      .bind(fid)
      .all();
    const thumbsMap = {};
    (rows?.results || []).forEach(row => {
      thumbsMap[row.thumbnail_type] = row.url;
    });
    return [size, ...['url3', 'url2', 'url1', 'icon'].filter(type => type !== size)]
      .map(type => thumbsMap[type])
      .filter(Boolean);
  };
  const fetchFirstAvailableImage = async (urls) => {
    for (const imgUrl of urls) {
      try {
        const response = await fetchAndServeImage(imgUrl);
        if (response) return response;
      } catch (err) {
        console.error('Error fetching thumbnail image:', err);
      }
    }
    return null;
  };

  // Try each available quality; the highest-resolution URL can expire independently.
  let response = null;
  try {
    response = await fetchFirstAvailableImage(await getThumbnailUrls());
  } catch (err) {
    console.error('Database query error looking up thumbnail:', err);
  }
  if (response) return response;
  console.log(`[handleThumbnail] Cached thumbnail URLs for fid ${fid} expired or unavailable. Re-resolving share.`);

  // 4. If not found or expired, we need to resolve from upstream to refresh the signed URLs
  if (!surl) {
    return errorJson(404, 'Thumbnail not cached and associated surl not found. Please resolve the share first.', 'not_found');
  }

  // Trigger handleResolve to refresh the cache in D1
  console.log(`[handleThumbnail] Triggering live resolve for surl ${surl} to refresh thumbnails.`);
  const resolveParams = new URLSearchParams();
  resolveParams.set('surl', surl);
  resolveParams.set('refresh', '1');
  resolveParams.set('raw', '1');
  resolveParams.set('fid', fid);
  if (dir) resolveParams.set('dir', dir);

  const resolveRes = await handleResolve(request, resolveParams, env);
  if (!resolveRes.ok) {
    return resolveRes; // Return the resolve error (e.g. share deleted / verify needed)
  }

  // 5. Query D1 again for the newly resolved signed URL and pick the best one
  let freshUrls = [];
  try {
    freshUrls = await getThumbnailUrls();
  } catch (err) {
    console.error('Database query error looking up fresh thumbnails:', err);
  }

  response = await fetchFirstAvailableImage(freshUrls);
  if (response) {
    return response;
  }

  return errorJson(502, 'Failed to fetch thumbnail image from upstream', 'upstream_image_error');
}
