import { BaseController } from './BaseController.js';
import { normalizeSurl, isValidSurl } from '../utils/helpers.js';
import { teraboxService } from '../services/TeraBoxService.js';

/**
 * Controller managing direct file downloads and streaming downloads
 */
export class DownloadController extends BaseController {
  constructor({ tbService = teraboxService } = {}) {
    super();
    this.tbService = tbService;
  }

  async fetchDirectDownload(surl, fid, env, request) {
    return this.tbService.fetchDirectDownload(surl, fid, env, request);
  }

  /**
   * Handle download mode - streams file or returns direct link / 302 redirect
   */
  async handleDownload(request, params, env) {
    const surl = normalizeSurl(params.get('surl'));
    const rawFid = params.get('fid')?.trim() || '';
    const fid = rawFid.replace(/\.0+$/, '');
    const asJson = params.get('json') === '1';

    if (!surl) return this.badRequest('Missing surl');
    if (!isValidSurl(surl)) return this.badRequest('Invalid surl format');
    if (!fid || !/^\d+$/.test(fid)) return this.badRequest('Missing or invalid fid parameter');

    try {
      const result = await this.fetchDirectDownload(surl, fid, env, request);

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
      return this.errorJson(502, err?.message || 'Failed to generate direct download link', 'download_failed');
    }
  }
}

export const downloadController = new DownloadController();
