import { BaseController } from './BaseController.js';
import {
  RESOLVE_FAILURE_COOLDOWN_MS,
  RESOLVE_CACHE_TTL_MS
} from '../config/constants.js';
import {
  normalizeSurl,
  isValidSurl,
  buildApiUrl,
  buildHeaders,
  getParentDirectory
} from '../utils/helpers.js';
import { HttpClient } from '../services/HttpClient.js';
import { CookieService } from '../services/CookieService.js';
import { cacheService } from '../services/CacheService.js';
import { teraboxService } from '../services/TeraBoxService.js';
import { transformerService } from '../services/TransformerService.js';
import { HttpResponse } from '../core/HttpResponse.js';
import { ShareRepository } from '../repositories/ShareRepository.js';

/**
 * Controller managing share metadata resolution and caching
 */
export class ResolveController extends BaseController {
  constructor({
    httpClient = HttpClient,
    cookieService = CookieService,
    cache = cacheService,
    tbService = teraboxService,
    transformer = transformerService
  } = {}) {
    super();
    this.httpClient = httpClient;
    this.cookieService = cookieService;
    this.cache = cache;
    this.tbService = tbService;
    this.transformer = transformer;
  }

  /**
   * Primary entrypoint for resolve mode with caching and deduplication
   */
  async handleResolve(request, params, env, options = {}) {
    const surl = normalizeSurl(params.get('surl'));
    const dir = params.get('dir')?.trim() || '';
    const requestedFid = params.get('fid')?.trim() || '';
    const raw = params.get('raw') === '1';
    const internalStreamRequest = options.internalStreamRequest === true || params.get('internalStreamRequest') === '1';

    if (!isValidSurl(surl)) {
      return this.resolveShare(request, params, env, options);
    }

    const key = this.cache.resolveCacheKey(request, surl, dir, requestedFid, raw, internalStreamRequest);
    const now = Date.now();
    const cooldown = this.cache.getCooldown(key);

    if (cooldown && cooldown.expiresAt > now) {
      const retryAfter = String(Math.max(1, Math.ceil((cooldown.expiresAt - now) / 1000)));
      return HttpResponse.errorWithRetryAfter(
        429,
        'The previous TeraBox request was blocked. Wait before trying this share again.',
        'upstream_backoff',
        { retry_after_seconds: Number(retryAfter) },
        new Response(null, { headers: { 'Retry-After': retryAfter } })
      );
    }
    if (cooldown) this.cache.deleteCooldown(key);

    const useResponseCache = !raw
      && params.get('refresh') !== '1'
      && !internalStreamRequest;

    const cached = useResponseCache ? this.cache.getCachedResponse(key) : null;
    if (cached) {
      return HttpResponse.withResolveCacheStatus(cached, 'HIT');
    }

    const inFlight = this.cache.getInFlight(key);
    if (inFlight) {
      const data = await inFlight;
      if (data) {
        return HttpResponse.withResolveCacheStatus(
          new Response(data.body, {
            status: data.status,
            headers: new Headers(data.headers)
          }),
          'COALESCED'
        );
      }
    }

    const pending = (async () => {
      const res = await this.resolveShare(request, params, env, options);
      try {
        const cloned = res.clone();
        const body = await cloned.text();
        return {
          response: res,
          snapshot: {
            body,
            status: res.status,
            headers: Object.fromEntries(res.headers.entries())
          }
        };
      } catch {
        return { response: res, snapshot: null };
      }
    })();

    this.cache.setInFlight(key, pending.then(p => p.snapshot).catch(() => null));

    try {
      const { response, snapshot } = await pending;
      if (response.status === 403 || response.status === 429 || response.headers.has('Retry-After')) {
        const retryAfter = HttpClient.getRetryAfterMs(response.headers.get('Retry-After'));
        const cooldownMs = retryAfter === null ? RESOLVE_FAILURE_COOLDOWN_MS : retryAfter;
        if (cooldownMs > 0) {
          this.cache.setCooldown(key, cooldownMs);
        }
      } else {
        this.cache.deleteCooldown(key);
      }

      if (useResponseCache && response.ok && snapshot && response.headers.get('Content-Type')?.includes('application/json')) {
        this.cache.setCachedData(key, snapshot, RESOLVE_CACHE_TTL_MS);
      }

      return HttpResponse.withResolveCacheStatus(response, 'MISS');
    } finally {
      this.cache.deleteInFlight(key);
    }
  }

  filterShareFiles(allFiles, targetDir = '') {
    if (!allFiles || allFiles.length === 0) return [];

    if (targetDir) {
      const cleanDir = targetDir.replace(/\/+$/, '');
      // Direct children: items whose parent directory strictly matches cleanDir
      const directChildren = allFiles.filter(f => {
        if (!f.path || f.path === cleanDir) return false;
        return getParentDirectory(f.path) === cleanDir;
      });

      return directChildren;
    }

    // targetDir is empty (root)
    // 1. Check if there are true root items (parent is '' or '/')
    const rootItems = allFiles.filter(f => {
      if (!f.path) return true;
      const parent = getParentDirectory(f.path);
      return !parent || parent === '/' || !f.path.replace(/^\/+/, '').includes('/');
    });

    if (rootItems.length > 0) return rootItems;

    // 2. If directories exist with multiple path components, find top-level directory entries (shortest path depth)
    const dirEntries = allFiles.filter(f => Boolean(f.isdir));
    if (dirEntries.length > 0) {
      const depths = dirEntries.map(f => (f.path || '').split('/').filter(Boolean).length);
      const minDepth = Math.min(...depths);
      const topDirs = dirEntries.filter(f => (f.path || '').split('/').filter(Boolean).length === minDepth);
      if (topDirs.length > 0) return topDirs;
    }

    // 3. If only files exist with deeper paths, return items with minimum path depth
    const depths = allFiles.map(f => (f.path || '').split('/').filter(Boolean).length);
    const minDepth = Math.min(...depths);
    return allFiles.filter(f => (f.path || '').split('/').filter(Boolean).length === minDepth);
  }

  /**
   * Internal share resolver fetching live data and updating D1 storage
   */
  async resolveShare(request, params, env, options = {}) {
    const surl = normalizeSurl(params.get('surl'));
    const raw = params.get('raw') === '1';
    const internalStreamRequest = options.internalStreamRequest === true || params.get('internalStreamRequest') === '1';
    const dir = params.get('dir')?.trim() || '';
    const requestedFid = params.get('fid')?.trim() || '';
    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.delete('Cookie');
    const upstreamRequest = new Request(request, { headers: upstreamHeaders });

    if (!surl) return this.badRequest('Missing surl');
    if (!isValidSurl(surl)) return this.badRequest('Invalid surl format');
    if (dir && (dir.length > 2048 || !dir.startsWith('/') || dir.includes('\\') || /(?:^|\/)\.\.(?:\/|$)/.test(dir))) {
      return this.badRequest('Invalid directory path');
    }
    if (requestedFid && !/^\d+$/.test(requestedFid)) {
      return this.badRequest('Invalid fid format');
    }

    const repo = this.getRepository(env);
    const kv = this.getKvService(env);

    // Fast-path: Check D1 database and KV cache first if not explicitly refreshing
    if (params.get('refresh') !== '1' && !raw) {
      // 1. Primary check: D1 SQL database
      if (env?.sharedfile) {
        try {
          const cachedShare = await repo.getShareFromDb(surl);
          if (cachedShare && cachedShare.list && cachedShare.list.length > 0) {
            const filteredFiles = this.filterShareFiles(cachedShare.list, dir);
            if (filteredFiles && filteredFiles.length > 0) {
              if (kv.isAvailable()) {
                await kv.storeShare(surl, { ...cachedShare, list: filteredFiles }, undefined, dir).catch(e => console.error('KV backfill error:', e));
              }
              const selectedFile = requestedFid
                ? cachedShare.list.find(file => String(file.fs_id || file.fid) === requestedFid)
                : filteredFiles[0];
              const origin = new URL(request.url).origin;
              const record = this.transformer.buildResolvedRecord(
                surl,
                { uk: cachedShare.uk, shareid: cachedShare.shareid },
                selectedFile || filteredFiles[0],
                cachedShare.server_time || Math.floor(Date.now() / 1000),
                origin
              );
              return Response.json({
                source: 'd1_database',
                data: record,
                items: this.transformer.buildShareItems(filteredFiles, surl, origin),
                ...(internalStreamRequest && { _streamAuth: { jsToken: this.tbService.getJsToken(env), browserId: null } })
              });
            }
          }
        } catch (dbErr) {
          console.error('D1 pre-check error:', dbErr);
        }
      }

      // 2. Secondary check: Edge KV cache
      if (kv.isAvailable()) {
        try {
          const cachedKvShare = await kv.getShare(surl, dir);
          if (cachedKvShare && cachedKvShare.list && cachedKvShare.list.length > 0) {
            const filteredFiles = this.filterShareFiles(cachedKvShare.list, dir);
            if (filteredFiles && filteredFiles.length > 0) {
              const selectedFile = requestedFid
                ? cachedKvShare.list.find(file => String(file.fs_id || file.fid) === requestedFid)
                : filteredFiles[0];
              const origin = new URL(request.url).origin;
              const record = this.transformer.buildResolvedRecord(
                surl,
                { uk: cachedKvShare.uk, shareid: cachedKvShare.shareid },
                selectedFile || filteredFiles[0],
                cachedKvShare.server_time || Math.floor(Date.now() / 1000),
                origin
              );
              return Response.json({
                source: 'kv_cache',
                data: record,
                items: this.transformer.buildShareItems(filteredFiles, surl, origin),
                ...(internalStreamRequest && { _streamAuth: { jsToken: this.tbService.getJsToken(env), browserId: null } })
              });
            }
          }
        } catch (kvErr) {
          console.error('KV pre-check error:', kvErr);
        }
      }
    }

    const { jsToken, pageRes, domainAttempts } = await this.tbService.scrapeJsToken(surl, upstreamRequest, env);
    let streamBrowserId = null;

    if (!jsToken) {
      return this.errorJson(
        403,
        'Failed to extract jsToken across candidate domains',
        'token_extract_failed_all',
        { attempts: domainAttempts }
      );
    }

    let upstream;
    try {
      // Extract Set-Cookie headers from page response
      let setCookies = [];
      if (pageRes) {
        if (typeof pageRes.headers.getSetCookie === 'function') {
          setCookies = pageRes.headers.getSetCookie();
        } else {
          const rawSetCookie = pageRes.headers.get('Set-Cookie');
          if (rawSetCookie) setCookies = [rawSetCookie];
        }
      }

      const apiUrl = new URL(buildApiUrl(jsToken, surl, dir ? null : '1', dir || null, 1, 20));
      let localApiCookie = this.cookieService.localCookieHeader(upstreamRequest, env, apiUrl.hostname);
      if (!localApiCookie) {
        const localDmCookie = this.cookieService.localCookieHeader(upstreamRequest, env, 'dm.1024terabox.com');
        if (localDmCookie) {
          apiUrl.hostname = 'dm.1024terabox.com';
          localApiCookie = localDmCookie;
        }
      }

      let mergedCookie = localApiCookie;
      if (setCookies.length > 0) {
        const cookiesObj = {};
        setCookies.forEach(sc => {
          const firstPart = sc.split(';')[0];
          const parts = firstPart.split('=');
          if (parts.length >= 2) cookiesObj[parts[0].trim()] = parts.slice(1).join('=').trim();
        });
        mergedCookie = this.cookieService.mergeCookies(mergedCookie, Object.entries(cookiesObj).map(([k, v]) => `${k}=${v}`));
      }
      streamBrowserId = mergedCookie?.split(';')
        .map(part => part.trim())
        .find(part => part.toLowerCase().startsWith('browserid='))
        ?.slice('browserid='.length) || null;

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
      let workingCookie = null;
      // Find working host on page 1
      for (const host of apiHostCandidates) {
        const testApiUrl = new URL(buildApiUrl(jsToken, surl, root, dir || null, 1, pageSize));
        testApiUrl.hostname = host;
        const hostCookie = this.cookieService.localCookieHeader(upstreamRequest, env, host) || mergedCookie;
        const headers = { ...baseApiHeaders, Referer: `https://${host}/` };
        if (hostCookie) headers.Cookie = hostCookie;
        try {
          let res = await this.httpClient.fetchWithTimeout(testApiUrl.toString(), { headers }, 6500);
          let data = await res.json().catch(() => null);

          // If upstream returns "need verify" with the cookie, retry anonymously!
          let usedCookie = Boolean(hostCookie);
          if (data && (data.errno === 400141 || data.errno === 4000020 || data.errno === 140) && headers.Cookie) {
            const anonHeaders = { ...headers };
            delete anonHeaders.Cookie;
            const retryRes = await this.httpClient.fetchWithTimeout(testApiUrl.toString(), { headers: anonHeaders }, 6500);
            const retryData = await retryRes.json().catch(() => null);
            if (retryRes.ok && retryData && retryData.errno === 0 && Array.isArray(retryData.list)) {
              res = retryRes;
              data = retryData;
              usedCookie = false;
            }
          }

          hostAttempts.push({ host, status: res.status, errno: data?.errno, errmsg: data?.errmsg, listLen: data?.list?.length });
          if (res.ok && data && data.errno === 0 && Array.isArray(data.list)) {
            workingApiHost = host;
            workingCookie = usedCookie ? hostCookie : null;
            pageData = data;
            apiRes = res;
            break;
          }
        } catch (err) {
          hostAttempts.push({ host, error: err?.message });
        }
      }

      const repo = this.getRepository(env);
      const kv = this.getKvService(env);

      if (!workingApiHost || !pageData) {
        if (kv.isAvailable()) {
          try {
            const cachedKvShare = await kv.getShare(surl, dir);
            if (cachedKvShare && cachedKvShare.list && cachedKvShare.list.length > 0) {
              const filteredFiles = this.filterShareFiles(cachedKvShare.list, dir);
              if (filteredFiles && filteredFiles.length > 0) {
                const selectedFile = requestedFid
                  ? cachedKvShare.list.find(file => String(file.fs_id || file.fid) === requestedFid)
                  : filteredFiles[0];
                const origin = new URL(request.url).origin;
                const record = this.transformer.buildResolvedRecord(
                  surl,
                  { uk: cachedKvShare.uk, shareid: cachedKvShare.shareid },
                  selectedFile || filteredFiles[0],
                  cachedKvShare.server_time || Math.floor(Date.now() / 1000),
                  origin
                );
                return Response.json({
                  source: 'kv_cache',
                  data: record,
                  items: this.transformer.buildShareItems(filteredFiles, surl, origin),
                  ...(internalStreamRequest && { _streamAuth: { jsToken, browserId: streamBrowserId } })
                });
              }
            }
          } catch (kvErr) {
            console.error('KV fallback error:', kvErr);
          }
        }

        if (env?.sharedfile) {
          try {
            const cachedShare = await repo.getShareFromDb(surl);
            if (cachedShare && cachedShare.list && cachedShare.list.length > 0) {
              let filteredFiles = this.filterShareFiles(cachedShare.list, dir);
              if ((!filteredFiles || filteredFiles.length === 0) && dir) {
                const prefix = dir.replace(/\/+$/, '') + '/';
                filteredFiles = cachedShare.list.filter(f => f.path && f.path.startsWith(prefix));
              }
              if (filteredFiles && filteredFiles.length > 0) {
                if (kv.isAvailable()) {
                  await kv.storeShare(surl, { ...cachedShare, list: filteredFiles }, undefined, dir).catch(e => console.error('KV backfill error:', e));
                }
                const selectedFile = requestedFid
                  ? cachedShare.list.find(file => String(file.fs_id || file.fid) === requestedFid)
                  : filteredFiles[0];
                const origin = new URL(request.url).origin;
                const record = this.transformer.buildResolvedRecord(
                  surl,
                  { uk: cachedShare.uk, shareid: cachedShare.shareid },
                  selectedFile || filteredFiles[0],
                  cachedShare.server_time || Math.floor(Date.now() / 1000),
                  origin
                );
                return Response.json({
                  source: 'd1_cache',
                  data: record,
                  items: this.transformer.buildShareItems(filteredFiles, surl, origin),
                  ...(internalStreamRequest && { _streamAuth: { jsToken, browserId: streamBrowserId } })
                });
              }
            }
          } catch (dbErr) {
            console.error('D1 fallback error:', dbErr);
          }
        }
        return this.errorJson(502, 'All TeraBox API hosts rejected the request or required verification', 'all_hosts_failed', { attempts: hostAttempts, dir, root, jsToken: jsToken?.slice(0, 10) + '...' });
      }

      for (let page = 1; page <= maxPages; page++) {
        if (page > 1) {
          const pageApiUrl = new URL(buildApiUrl(jsToken, surl, root, dir || null, page, pageSize));
          pageApiUrl.hostname = workingApiHost;
          const headers = { ...baseApiHeaders, Referer: `https://${workingApiHost}/` };
          if (workingCookie) headers.Cookie = workingCookie;
          apiRes = await this.httpClient.fetchWithTimeout(pageApiUrl.toString(), { headers }, 8000);
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
          return this.errorJson(502, 'Share listing exceeded the supported pagination limit', 'share_list_too_large', {
            maxItems
          });
        }
        if (pageData.list.length < pageSize) break;
        if (files.length === previousCount) {
          return this.errorJson(502, 'TeraBox repeated a share-list page; refusing to return an incomplete listing', 'share_list_pagination_stalled', {
            page,
            pageSize
          });
        }
        if (page === maxPages) {
          return this.errorJson(502, 'Share listing exceeded the supported pagination limit', 'share_list_too_large', {
            maxItems
          });
        }
      }

      upstream = { ...upstream, list: files };
    } catch (err) {
      const isAbort = err?.name === 'AbortError';
      return this.errorJson(
        isAbort ? 504 : 502,
        isAbort ? 'Upstream API request timed out' : 'Upstream API request failed',
        isAbort ? 'upstream_timeout' : 'upstream_error',
        err?.message || (isAbort ? 'timeout' : 'network_error')
      );
    }

    if (!upstream?.list?.length) {
      return this.errorJson(502, 'Empty share list from upstream', 'upstream_empty', upstream);
    }

    // Store complete data in D1 and Workers KV for persistence and edge caching
    try {
      if (env?.sharedfile) {
        const repo = this.getRepository(env);
        await repo.storeUpstreamData(surl, upstream);
      }
    } catch (err) {
      console.error('D1 storage error:', err);
    }

    try {
      const kv = this.getKvService(env);
      if (kv.isAvailable()) {
        await kv.storeShare(surl, upstream, undefined, dir);
      }
    } catch (err) {
      console.error('KV storage error:', err);
    }

    if (raw) {
      const rewrittenUpstream = this.transformer.rewriteResponseThumbnails(upstream, request.url, surl);
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
      return this.errorJson(404, 'File not found in share directory', 'not_found', { fid: requestedFid });
    }

    const origin = new URL(request.url).origin;
    const record = this.transformer.buildResolvedRecord(
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
          const direct = await this.tbService.fetchDirectDownload(surl, targetFid, env, upstreamRequest);
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
      items: this.transformer.buildShareItems(upstream.list, surl, origin),
      ...(internalStreamRequest && { _streamAuth: { jsToken, browserId: streamBrowserId } })
    });
  }
}

export const resolveController = new ResolveController();
