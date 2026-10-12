import { BaseController } from './BaseController.js';
import { normalizeSurl, isValidSurl } from '../utils/helpers.js';
import { transformerService } from '../services/TransformerService.js';

/**
 * Controller querying D1 cache directly by share ID or file ID
 */
export class LookupController extends BaseController {
  constructor({ transformer = transformerService } = {}) {
    super();
    this.transformer = transformer;
  }

  /**
   * Handle lookup mode - query D1 database directly without hitting upstream
   */
  async handleLookup(request, params, env) {
    const surl = normalizeSurl(params.get('surl'));
    const fid = params.get('fid');

    if (!surl && !fid) {
      return this.badRequest('Missing surl or fid parameter', ['surl', 'fid']);
    }
    if (surl && !isValidSurl(surl)) {
      return this.badRequest('Invalid surl format');
    }
    if (fid && !/^\d+$/.test(fid)) {
      return this.badRequest('Invalid fid format');
    }

    const kv = this.getKvService(env);

    try {
      // 1. Lookup by file ID
      if (fid) {
        if (kv.isAvailable()) {
          const kvFile = await kv.getFile(fid);
          if (kvFile) {
            const origin = new URL(request.url).origin;
            const thumbsObj = {};
            const thumbs = kvFile.thumbs || {};
            Object.keys(thumbs).forEach(type => {
              thumbsObj[type] = this.transformer.getProxyThumbnailUrl(origin, fid, type, kvFile.share_id);
            });
            const thumbUrl = thumbsObj.url3 || thumbsObj.url2 || thumbsObj.url1 || null;
            const hasDirect = kvFile.dlink && !kvFile.dlink.includes('/sharing/link');
            const dlink = hasDirect
              ? kvFile.dlink
              : (kvFile.share_id ? `${origin}/?mode=download&surl=${encodeURIComponent(kvFile.share_id)}&fid=${encodeURIComponent(fid)}` : null);

            return Response.json({
              source: 'kv',
              data: { ...kvFile, dlink, thumb: thumbUrl, thumbs: thumbsObj }
            });
          }
        }

        const missingD1 = this.requireD1(env);
        if (missingD1) return missingD1;

        const file = await env.sharedfile
          .prepare('SELECT * FROM media_files WHERE fs_id = ?')
          .bind(fid)
          .first();

        if (!file) {
          return this.errorJson(404, 'File not found', 'not_found', { fid });
        }

        // Get thumbnails for this file
        const thumbs = await env.sharedfile
          .prepare('SELECT url, thumbnail_type FROM thumbnails WHERE fs_id = ?')
          .bind(fid)
          .all();

        const thumbsObj = {};
        const origin = new URL(request.url).origin;
        (thumbs?.results || []).forEach(t => {
          thumbsObj[t.thumbnail_type] = this.transformer.getProxyThumbnailUrl(origin, fid, t.thumbnail_type, file.share_id);
        });

        const thumbUrl = thumbsObj.url3 || thumbsObj.url2 || thumbsObj.url1 || null;

        const hasDirect = file.dlink && !file.dlink.includes('/sharing/link');
        const dlink = hasDirect
          ? file.dlink
          : (file.share_id ? `${origin}/?mode=download&surl=${encodeURIComponent(file.share_id)}&fid=${encodeURIComponent(fid)}` : null);

        // Backfill KV cache
        if (kv.isAvailable()) {
          await kv.setFile(fid, { ...file, thumbs: thumbsObj }).catch(e => console.error('KV file backfill error:', e));
        }

        return Response.json({
          source: 'd1',
          data: { ...file, dlink, thumb: thumbUrl, thumbs: thumbsObj }
        });
      }

      // 2. Lookup by share ID
      if (kv.isAvailable()) {
        const kvShare = await kv.getShare(surl);
        if (kvShare) {
          const rewrittenShareData = this.transformer.rewriteResponseThumbnails(kvShare, request.url, surl);
          return Response.json({
            source: 'kv',
            data: rewrittenShareData
          });
        }
      }

      const missingD1 = this.requireD1(env);
      if (missingD1) return missingD1;

      const repo = this.getRepository(env);
      const shareData = await repo.getShareFromDb(surl);

      if (!shareData) {
        return this.errorJson(404, 'Share not found in D1 or KV. Use mode=resolve first.', 'not_found', { surl });
      }

      // Backfill KV cache
      if (kv.isAvailable()) {
        await kv.storeShare(surl, shareData).catch(e => console.error('KV share backfill error:', e));
      }

      const rewrittenShareData = this.transformer.rewriteResponseThumbnails(shareData, request.url, surl);
      return Response.json({
        source: 'd1',
        data: rewrittenShareData
      });
    } catch (err) {
      console.error('Storage lookup error:', err);
      return this.errorJson(500, 'Database or KV query failed', 'storage_error', err?.message || 'unknown');
    }
  }
}

export const lookupController = new LookupController();
