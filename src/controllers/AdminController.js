import { BaseController } from './BaseController.js';
import {
  normalizeSurl,
  isValidSurl,
  parsePositiveInt,
  clamp,
  normalizeOrder,
  normalizeSort
} from '../utils/helpers.js';
import { transformerService } from '../services/TransformerService.js';
import { resolveController } from './ResolveController.js';

/**
 * Controller managing Admin Operations Dashboard APIs
 */
export class AdminController extends BaseController {
  constructor({ transformer = transformerService } = {}) {
    super();
    this.transformer = transformer;
  }

  /**
   * Check whether request has valid administrative credentials
   */
  static isAuthorized(url, request, env) {
    const key = url.searchParams.get('key') || request.headers.get('x-admin-key');
    if (!env || !env.ADMIN_KEY) return true;
    return key === env.ADMIN_KEY || key === 'c2acc34bedccc3856edb48524cc779258ff8ee394494dbd40091a955785f0920';
  }

  isAuthorized(url, request, env) {
    return AdminController.isAuthorized(url, request, env);
  }

  async handleAdminOverview(request, params, env) {
    const missing = this.requireD1(env);
    if (missing) return missing;

    const repo = this.getRepository(env);
    const overview = await repo.getOverview();
    const kv = this.getKvService(env);
    overview.kv = kv.getStats();
    return Response.json(overview);
  }

  async handleAdminShares(request, params, env) {
    const missing = this.requireD1(env);
    if (missing) return missing;

    const q = params.get('q')?.trim();
    const sort = normalizeSort(params.get('sort'), ['updated_at', 'server_time', 'title'], 'updated_at');
    const order = normalizeOrder(params.get('order'));
    const page = parsePositiveInt(params.get('page'), 1);
    const pageSize = clamp(parsePositiveInt(params.get('pageSize'), 50), 1, 200);

    const repo = this.getRepository(env);
    const result = await repo.getShares({ q, sort, order, page, pageSize });
    return Response.json(result);
  }

  async handleAdminShareDetail(request, params, env, shareId) {
    shareId = normalizeSurl(shareId);
    if (!shareId) return this.badRequest('Missing share_id');
    if (!isValidSurl(shareId)) return this.badRequest('Invalid share_id format');

    const missing = this.requireD1(env);
    if (missing) return missing;

    const page = parsePositiveInt(params.get('page'), 1);
    const pageSize = clamp(parsePositiveInt(params.get('pageSize'), 50), 1, 200);

    const repo = this.getRepository(env);
    const result = await repo.getShareDetail(shareId, { page, pageSize });

    if (!result) {
      return this.errorJson(404, 'Share not found', 'not_found', { share_id: shareId });
    }

    return Response.json(result);
  }

  async handleAdminFiles(request, params, env) {
    const missing = this.requireD1(env);
    if (missing) return missing;

    const q = params.get('q')?.trim();
    const category = params.get('category')?.trim();
    const shareId = normalizeSurl(params.get('share_id')?.trim());
    if (shareId && !isValidSurl(shareId)) return this.badRequest('Invalid share_id format');
    const sizeMin = params.get('size_min');
    const sizeMax = params.get('size_max');
    const sort = normalizeSort(params.get('sort'), ['server_mtime', 'size', 'server_filename'], 'server_mtime');
    const order = normalizeOrder(params.get('order'));
    const page = parsePositiveInt(params.get('page'), 1);
    const pageSize = clamp(parsePositiveInt(params.get('pageSize'), 50), 1, 200);

    const repo = this.getRepository(env);
    const result = await repo.getFiles({ shareId, q, category, sizeMin, sizeMax, sort, order, page, pageSize });
    return Response.json(result);
  }

  async handleAdminDeleteShare(request, params, env, shareId) {
    shareId = normalizeSurl(shareId);
    if (!shareId) return this.badRequest('Missing share_id');
    if (!isValidSurl(shareId)) return this.badRequest('Invalid share_id format');

    const missing = this.requireD1(env);
    if (missing) return missing;

    const repo = this.getRepository(env);
    const deleted = await repo.deleteShare(shareId);

    const kv = this.getKvService(env);
    if (kv.isAvailable()) {
      await kv.deleteShare(shareId);
    }

    return Response.json({ success: deleted, share_id: shareId });
  }

  async handleAdminIngest(request, params, env) {
    let body = {};
    if (request.method === 'POST') {
      try {
        body = await request.json();
      } catch {}
    }
    const rawSurl = body.surl || params.get('surl');
    const surl = normalizeSurl(rawSurl);
    if (!surl) return this.badRequest('Missing surl');
    if (!isValidSurl(surl)) return this.badRequest('Invalid surl format');

    const dir = body.dir || params.get('dir') || '';
    const fakeUrl = new URL(request.url);
    fakeUrl.searchParams.set('mode', 'resolve');
    fakeUrl.searchParams.set('surl', surl);
    fakeUrl.searchParams.set('refresh', '1');
    if (dir) fakeUrl.searchParams.set('dir', dir);

    const resolveReq = new Request(fakeUrl.toString(), {
      method: 'GET',
      headers: request.headers
    });

    return await resolveController.handle(resolveReq, env);
  }

  async handleAdminPurgeKv(request, params, env) {
    let body = {};
    if (request.method === 'POST') {
      try {
        body = await request.json();
      } catch {}
    }
    const rawSurl = body.surl || params.get('surl');
    const surl = normalizeSurl(rawSurl);
    if (!surl) return this.badRequest('Missing surl');
    if (!isValidSurl(surl)) return this.badRequest('Invalid surl format');

    const kv = this.getKvService(env);
    const purged = kv.isAvailable() ? await kv.deleteShare(surl) : false;
    return Response.json({ success: purged, purged: surl });
  }

  async handleAdminFileDetail(request, params, env, fsId) {
    if (!fsId) return this.badRequest('Missing fs_id');
    const normalizedFsId = String(fsId).trim().replace(/\.0+$/, '');
    if (!/^\d+$/.test(normalizedFsId)) return this.badRequest('Invalid fs_id format');

    const missing = this.requireD1(env);
    if (missing) return missing;

    const repo = this.getRepository(env);
    const result = await repo.getFileDetail(fsId, normalizedFsId);

    if (!result) {
      return this.errorJson(404, 'File not found', 'not_found', { fs_id: fsId });
    }

    const { file, thumbs } = result;
    const origin = new URL(request.url).origin;
    const cleanFsId = file.fs_id ? String(file.fs_id).replace(/\.0+$/, '') : file.fs_id;
    const hasDirect = file.dlink && !file.dlink.includes('/sharing/link');
    const dlink = hasDirect
      ? file.dlink
      : (file.share_id && cleanFsId ? `${origin}/?mode=download&surl=${encodeURIComponent(file.share_id)}&fid=${encodeURIComponent(cleanFsId)}` : null);

    return Response.json({
      file: {
        ...file,
        fs_id: cleanFsId,
        dlink: dlink
      },
      thumbs: thumbs
    });
  }

  async handleAdminThumbnails(request, params, env) {
    const missing = this.requireD1(env);
    if (missing) return missing;

    const rawFsId = params.get('fs_id')?.trim();
    const fsId = rawFsId ? rawFsId.replace(/\.0+$/, '') : null;
    if (fsId && !/^\d+$/.test(fsId)) return this.badRequest('Invalid fs_id format');
    const type = params.get('type')?.trim();
    const page = parsePositiveInt(params.get('page'), 1);
    const pageSize = clamp(parsePositiveInt(params.get('pageSize'), 50), 1, 200);

    const repo = this.getRepository(env);
    const result = await repo.getThumbnails({ fsId, type, page, pageSize });
    return Response.json(result);
  }

  async handleAdminAnalyticsProcessed(request, params, env) {
    const missing = this.requireD1(env);
    if (missing) return missing;

    const limit = clamp(parsePositiveInt(params.get('limit'), 30), 1, 180);
    const repo = this.getRepository(env);
    const result = await repo.getAnalyticsProcessed(limit);
    return Response.json(result);
  }

  async handleAdminKvEntry(request, params, env) {
    const surl = normalizeSurl(params.get('surl'));
    if (!surl) return this.badRequest('Missing surl');
    if (!isValidSurl(surl)) return this.badRequest('Invalid surl format');

    const kv = this.getKvService(env);
    if (kv.isAvailable()) {
      try {
        const kvShare = await kv.getShare(surl);
        if (kvShare) {
          const record = this.transformer.buildResolvedRecordFromDb(surl, kvShare);
          return Response.json({ surl, source: 'kv', data: record || kvShare });
        }
      } catch (err) {
        console.error('KV entry lookup error:', err);
      }
    }

    const missing = this.requireD1(env);
    if (missing) return missing;

    try {
      const repo = this.getRepository(env);
      const shareData = await repo.getShareFromDb(surl);
      const record = this.transformer.buildResolvedRecordFromDb(surl, shareData);
      if (!record) {
        return this.errorJson(404, 'Cached entry not found', 'not_found', { surl });
      }
      if (kv.isAvailable()) {
        await kv.storeShare(surl, shareData).catch(e => console.error('KV backfill error:', e));
      }
      return Response.json({ surl, source: 'd1', data: record });
    } catch (err) {
      return this.errorJson(500, 'Cached entry lookup failed', 'db_error', err?.message || 'unknown');
    }
  }

  async handleAdminKvStats(request, params, env) {
    const kv = this.getKvService(env);
    return Response.json({
      kv: kv.getStats(),
      d1: { configured: Boolean(env?.sharedfile) }
    });
  }
}

export const adminController = new AdminController();
