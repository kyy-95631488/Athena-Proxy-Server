import { HttpResponse } from './HttpResponse.js';
import { AdminController, adminController } from '../controllers/AdminController.js';
import { resolveController } from '../controllers/ResolveController.js';
import { streamController } from '../controllers/StreamController.js';
import { downloadController } from '../controllers/DownloadController.js';
import { lookupController } from '../controllers/LookupController.js';
import { thumbnailController } from '../controllers/ThumbnailController.js';
import { legacyController } from '../controllers/LegacyController.js';

const spaHtml = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d8f36a'><path d='M13 2L3 14h9l-1 8 10-12h-9l1-8z'/></svg>" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Athena Proxy / Edge Platform</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script type="module" crossorigin src="/assets/index-CB_eAIXQ.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-DJaDNOSq.css">
  </head>
  <body class="bg-[#f4f5f1] text-[#252922] antialiased min-h-screen">
    <div id="root"></div>
  </body>
</html>`;

export function renderSpaResponse() {
  return new Response(spaHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    }
  });
}

/**
 * Router class responsible for matching paths, query modes, and dispatching to controllers
 */
export class Router {
  constructor({
    admin = adminController,
    resolve = resolveController,
    stream = streamController,
    download = downloadController,
    lookup = lookupController,
    thumbnail = thumbnailController,
    legacy = legacyController
  } = {}) {
    this.admin = admin;
    this.resolve = resolve;
    this.stream = stream;
    this.download = download;
    this.lookup = lookup;
    this.thumbnail = thumbnail;
    this.legacy = legacy;
  }

  async dispatch(request, env) {
    const url = new URL(request.url);
    const params = url.searchParams;
    const mode = params.get('mode');

    // Direct download handling (must precede static assets to avoid SPA hijacking downloads)
    if (mode === 'download' || (url.pathname === '/download' && (params.has('fid') || params.has('surl')))) {
      return await this.download.handleDownload(request, params, env);
    }

    // Cloudflare Workers Static Assets (React + Vite SPA)
    if (env?.ASSETS) {
      if (
        url.pathname.startsWith('/assets/') ||
        url.pathname === '/favicon.ico' ||
        (((url.pathname === '/' || url.pathname === '/admin' || url.pathname === '/admin/' || url.pathname === '/download' || url.pathname === '/download/') && !mode) && (request.method === 'GET' || request.method === 'HEAD'))
      ) {
        return env.ASSETS.fetch(request);
      }
    }

    // SPA UI shell fallback (React + Vite SPA)
    if ((url.pathname === '/admin' || url.pathname === '/admin/' || url.pathname === '/' || url.pathname === '/download' || url.pathname === '/download/') && !mode && (request.method === 'GET' || request.method === 'HEAD')) {
      return renderSpaResponse();
    }

    // Admin API routes
    if (url.pathname.startsWith('/admin')) {
      if (!AdminController.isAuthorized(url, request, env)) {
        return HttpResponse.errorJson(401, 'Unauthorized', 'unauthorized');
      }

      try {
        if (url.pathname === '/admin/overview') {
          return await this.admin.handleAdminOverview(request, params, env);
        }
        if (url.pathname === '/admin/shares') {
          return await this.admin.handleAdminShares(request, params, env);
        }
        if (url.pathname.startsWith('/admin/shares/')) {
          const shareId = decodeURIComponent(url.pathname.replace('/admin/shares/', ''));
          if (request.method === 'DELETE') {
            return await this.admin.handleAdminDeleteShare(request, params, env, shareId);
          }
          return await this.admin.handleAdminShareDetail(request, params, env, shareId);
        }
        if (url.pathname === '/admin/ingest') {
          return await this.admin.handleAdminIngest(request, params, env);
        }
        if (url.pathname === '/admin/files') {
          return await this.admin.handleAdminFiles(request, params, env);
        }
        if (url.pathname.startsWith('/admin/files/')) {
          const fsId = decodeURIComponent(url.pathname.replace('/admin/files/', ''));
          return await this.admin.handleAdminFileDetail(request, params, env, fsId);
        }
        if (url.pathname === '/admin/thumbnails') {
          return await this.admin.handleAdminThumbnails(request, params, env);
        }
        if (url.pathname === '/admin/analytics/processed') {
          return await this.admin.handleAdminAnalyticsProcessed(request, params, env);
        }
        if (url.pathname === '/admin/kv/entry') {
          return await this.admin.handleAdminKvEntry(request, params, env);
        }
        if (url.pathname === '/admin/kv/purge') {
          return await this.admin.handleAdminPurgeKv(request, params, env);
        }
        if (url.pathname === '/admin/kv/stats') {
          return await this.admin.handleAdminKvStats(request, params, env);
        }
        return HttpResponse.errorJson(404, 'Not found', 'not_found');
      } catch (err) {
        return HttpResponse.errorJson(500, err?.message || 'Internal error', 'internal_error');
      }
    }

    // Health check endpoint
    if (mode === 'health') {
      return Response.json(
        {
          status: 'ok',
          timestamp: new Date().toISOString(),
          storage: {
            d1: Boolean(env?.sharedfile),
            kv: Boolean(env?.SHARE_KV || env?.sharedfile_kv || env?.KV)
          }
        },
        { status: 200 }
      );
    }

    // Query mode based endpoints
    if (mode === 'page') return await this.legacy.handlePage(request, params);
    if (mode === 'api') return await this.legacy.handleApi(request, params);
    if (mode === 'resolve') return await this.resolve.handleResolve(request, params, env);
    if (mode === 'download') return await this.download.handleDownload(request, params, env);
    if (mode === 'stream') return await this.stream.handleStream(request, params, env);
    if (mode === 'segment') return await this.stream.handleSegment(request, params, env);
    if (mode === 'lookup') return await this.lookup.handleLookup(request, params, env);
    if (mode === 'thumbnail') return await this.thumbnail.handleThumbnail(request, params, env);

    return Response.json(
      {
        error: 'Invalid or missing mode',
        code: 'invalid_mode',
        allowed: ['page', 'api', 'resolve', 'download', 'stream', 'segment', 'lookup', 'thumbnail', 'health', 'admin/*']
      },
      { status: 400 }
    );
  }
}

export const router = new Router();
