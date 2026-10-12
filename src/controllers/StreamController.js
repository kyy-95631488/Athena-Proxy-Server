import { BaseController } from './BaseController.js';
import {
  normalizeSurl,
  isValidSurl,
  isAllowedSegmentUrl,
  buildHeaders
} from '../utils/helpers.js';
import { HttpClient } from '../services/HttpClient.js';
import { CookieService } from '../services/CookieService.js';
import { PlaylistService } from '../services/PlaylistService.js';
import { teraboxService } from '../services/TeraBoxService.js';
import { resolveController } from './ResolveController.js';

/**
 * Controller managing HLS streaming playlists and video chunk segments
 */
export class StreamController extends BaseController {
  constructor({
    httpClient = HttpClient,
    cookieService = CookieService,
    playlistService = PlaylistService,
    tbService = teraboxService,
    resController = resolveController
  } = {}) {
    super();
    this.httpClient = httpClient;
    this.cookieService = cookieService;
    this.playlistService = playlistService;
    this.tbService = tbService;
    this.resolveController = resController;
  }

  /**
   * Handle stream mode - returns M3U8 playlist using cached metadata
   */
  async handleStream(request, params, env) {
    const surl = normalizeSurl(params.get('surl'));
    const userAgent = request.headers.get('User-Agent') || '';
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    const type = params.get('type') || (isSafari ? 'M3U8_AUTO_360' : 'M3U8_FLV_264_360');
    const requestedFid = params.get('fid')?.trim() || '';
    const dir = params.get('dir')?.trim() || '';

    if (!surl) {
      return this.badRequest('Missing surl', ['surl']);
    }
    if (!isValidSurl(surl)) {
      return this.badRequest('Invalid surl format');
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
      return this.badRequest('Invalid stream type');
    }
    if (requestedFid && !/^\d+$/.test(requestedFid)) {
      return this.badRequest('Invalid fid format');
    }
    if (dir && (dir.length > 2048 || !dir.startsWith('/') || dir.includes('\\') || /(?:^|\/)\.\.(?:\/|$)/.test(dir))) {
      return this.badRequest('Invalid directory path');
    }

    let targetDir = dir;
    let record = null;

    // Check Workers KV first, then D1 for uk, shareid, and path if requestedFid is available
    if (requestedFid) {
      const kv = this.getKvService(env);
      if (kv.isAvailable()) {
        try {
          const [shareKv, fileKv] = await Promise.all([
            kv.getShare(surl),
            kv.getFile(requestedFid)
          ]);
          if (shareKv && shareKv.uk && (shareKv.shareid || shareKv.share_id)) {
            record = {
              uk: shareKv.uk,
              shareid: shareKv.shareid || shareKv.share_id,
              fid: requestedFid
            };
          }
          if (fileKv && fileKv.path && !targetDir) {
            const lastSlash = fileKv.path.lastIndexOf('/');
            if (lastSlash > 0) targetDir = fileKv.path.slice(0, lastSlash);
          }
        } catch {}
      }

      if (!record && env?.sharedfile) {
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
    }

    let jsToken = this.tbService.getJsToken(env);
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
      const resolveRes = await this.resolveController.handleResolve(request, resolveParams, env, {
        internalStreamRequest: true
      });
      if (!resolveRes.ok) return resolveRes;

      let resolvedBody;
      try {
        resolvedBody = await resolveRes.json();
      } catch {
        return this.errorJson(502, 'Resolve returned invalid stream metadata', 'invalid_stream_metadata');
      }
      record = resolvedBody?.data;
      if (resolvedBody?._streamAuth?.jsToken) jsToken = resolvedBody._streamAuth.jsToken;
      if (resolvedBody?._streamAuth?.browserId) browserId = resolvedBody._streamAuth.browserId;
    }

    if (!record?.uk || !record?.shareid || !record?.fid || !jsToken || !browserId) {
      return this.errorJson(502, 'TeraBox did not provide the required public stream parameters', 'incomplete_stream_metadata', {
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
    const sign = await this.tbService.createStreamSignature(clientType, channel, browserId, timestamp);

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

      const cookie = this.cookieService.localCookieHeader(request, env, candidate.host);
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
        const streamRes = await this.httpClient.fetchWithTimeout(streamUrl.toString(), { headers }, 8000);
        if (streamRes.ok) {
          const text = await streamRes.text();
          if (text.includes('#EXTM3U')) {
            const segCount = (text.match(/#EXTINF/g) || []).length;
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

    if (!playlist && bestPlaylist) {
      res = bestRes;
      playlist = bestPlaylist;
    }

    if (!res || !playlist.includes('#EXTM3U')) {
      return this.errorJson(502, 'Upstream stream request failed across all hosts', 'upstream_stream_failed');
    }

    const rewritten = this.playlistService.rewriteM3U8(playlist, request);

    return new Response(rewritten, {
      status: res.status,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store'
      }
    });
  }

  /**
   * Handle segment mode - proxies video TS chunks with SSRF protection
   */
  async handleSegment(request, params, env) {
    const targetUrl = params.get('url');
    if (!targetUrl) {
      return this.badRequest('Missing url param', ['url']);
    }

    // SSRF protection: only allow TeraBox domains
    if (!isAllowedSegmentUrl(targetUrl)) {
      return this.errorJson(403, 'Invalid segment URL: only TeraBox domains allowed', 'invalid_segment_url');
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
      res = await this.httpClient.fetchWithTimeout(targetUrl, {
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
        const fbRes = await this.httpClient.fetchWithTimeout(fbUrl.toString(), {
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
      return this.errorJson(
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
}

export const streamController = new StreamController();
