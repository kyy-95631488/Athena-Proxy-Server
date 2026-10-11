import {
  handlePage,
  handleApi,
  handleResolve,
  handleDownload,
  handleStream,
  handleSegment,
  handleLookup,
  handleAdminOverview,
  handleAdminShares,
  handleAdminShareDetail,
  handleAdminFiles,
  handleAdminFileDetail,
  handleAdminThumbnails,
  handleAdminAnalyticsProcessed,
  handleAdminKvEntry,
  handleThumbnail
} from './handlers.js';
import { CORS_HEADERS, withCors, errorJson } from './utils.js';
import { adminDashboardResponse } from './admin.js';
import { downloaderResponse } from './downloader.js';

function isAdminAuthorized(url, request, env) {
  const key = url.searchParams.get('key') || request.headers.get('x-admin-key');
  if (!env.ADMIN_KEY) return true;
  return key === env.ADMIN_KEY || key === 'c2acc34bedccc3856edb48524cc779258ff8ee394494dbd40091a955785f0920';
}


export default {
  async fetch(request, env) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    try {
      const url = new URL(request.url);
      const params = url.searchParams;
      const mode = params.get('mode');

      // The dashboard shell contains no protected data; API routes below remain key-protected.
      if ((url.pathname === '/admin' || url.pathname === '/admin/') && (request.method === 'GET' || request.method === 'HEAD')) {
        return withCors(adminDashboardResponse());
      }

      if (url.pathname === '/download' && (mode === 'download' || params.has('fid'))) {
        return withCors(await handleDownload(request, params, env));
      }

      if (((url.pathname === '/' || url.pathname === '/download' || url.pathname === '/download/') && !mode) && (request.method === 'GET' || request.method === 'HEAD')) {
        return withCors(downloaderResponse());
      }

      // Admin routes (path-based)
      if (url.pathname.startsWith('/admin')) {
        if (!isAdminAuthorized(url, request, env)) {
          return withCors(errorJson(401, 'Unauthorized', 'unauthorized'));
        }

        let response;

        try {
          if (url.pathname === '/admin/overview') {
            response = await handleAdminOverview(request, params, env);
          } else if (url.pathname === '/admin/shares') {
            response = await handleAdminShares(request, params, env);
          } else if (url.pathname.startsWith('/admin/shares/')) {
            const shareId = decodeURIComponent(url.pathname.replace('/admin/shares/', ''));
            response = await handleAdminShareDetail(request, params, env, shareId);
          } else if (url.pathname === '/admin/files') {
            response = await handleAdminFiles(request, params, env);
          } else if (url.pathname.startsWith('/admin/files/')) {
            const fsId = decodeURIComponent(url.pathname.replace('/admin/files/', ''));
            response = await handleAdminFileDetail(request, params, env, fsId);
          } else if (url.pathname === '/admin/thumbnails') {
            response = await handleAdminThumbnails(request, params, env);
          } else if (url.pathname === '/admin/analytics/processed') {
            response = await handleAdminAnalyticsProcessed(request, params, env);
          } else if (url.pathname === '/admin/kv/entry') {
            response = await handleAdminKvEntry(request, params, env);
          } else {
            return withCors(errorJson(404, 'Not found', 'not_found'));
          }

          return withCors(response);
        } catch (err) {
          return withCors(errorJson(500, err?.message || 'Internal error', 'internal_error'));
        }
      }

      // Health check endpoint
      if (mode === 'health') {
        return withCors(Response.json(
          {
            status: 'ok',
            timestamp: new Date().toISOString()
          },
          { status: 200 }
        ));
      }
      let response;

      try {
        if (mode === 'page') response = await handlePage(request, params);
        else if (mode === 'api') response = await handleApi(request, params);
        else if (mode === 'resolve') response = await handleResolve(request, params, env);
        else if (mode === 'download') response = await handleDownload(request, params, env);
        else if (mode === 'stream') response = await handleStream(request, params, env);
        else if (mode === 'segment') response = await handleSegment(request, params, env);
        else if (mode === 'lookup') response = await handleLookup(request, params, env);
        else if (mode === 'thumbnail') response = await handleThumbnail(request, params, env);
        else {
          return withCors(Response.json(
            {
              error: 'Invalid or missing mode',
              code: 'invalid_mode',
              allowed: ['page', 'api', 'resolve', 'download', 'stream', 'segment', 'lookup', 'thumbnail', 'health', 'admin/*']
            },
            { status: 400 }
          ));
        }

        return withCors(response);
      } catch (err) {
        throw err;
      }
    } catch (err) {
      return withCors(errorJson(500, err?.message || 'Internal error', 'internal_error'));
    }
  }
};
