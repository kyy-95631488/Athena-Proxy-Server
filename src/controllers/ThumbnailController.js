import { BaseController } from './BaseController.js';
import { normalizeSurl, getParentDirectory } from '../utils/helpers.js';
import { HttpClient } from '../services/HttpClient.js';
import { resolveController } from './ResolveController.js';

/**
 * Controller managing thumbnail resolution, proxying, and caching
 */
export class ThumbnailController extends BaseController {
  constructor({ httpClient = HttpClient, resController = resolveController } = {}) {
    super();
    this.httpClient = httpClient;
    this.resolveController = resController;
  }

  /**
   * Handle thumbnail mode - serves proxied thumbnail images with long CDN cache
   */
  async handleThumbnail(request, params, env) {
    const fid = params.get('fid');
    const size = params.get('size') || 'url3'; // url3 is typically the highest resolution (850x580)
    let surl = normalizeSurl(params.get('surl'));
    let dir = params.get('dir')?.trim() || '';

    if (!fid) {
      return this.badRequest('Missing fid parameter', ['fid']);
    }
    if (!/^\d+$/.test(fid)) {
      return this.badRequest('Invalid fid format');
    }
    if (dir && (dir.length > 2048 || !dir.startsWith('/') || dir.includes('\\') || /(?:^|\/)\.\.(?:\/|$)/.test(dir))) {
      return this.badRequest('Invalid directory path');
    }

    const kv = this.getKvService(env);
    if (kv.isAvailable()) {
      try {
        const fileKv = await kv.getFile(fid);
        if (fileKv) {
          if (!surl) surl = fileKv.share_id;
          if (!dir && fileKv.path) dir = getParentDirectory(fileKv.path);
        }
      } catch {}
    }

    if (!surl && env?.sharedfile) {
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
    }

    // Fetch signed image URLs through the Worker to avoid browser cross-origin restrictions
    const fetchAndServeImage = async (imgUrl) => {
      const res = await this.httpClient.fetchWithTimeout(imgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.terabox.com/'
        }
      }, 6000);

      if (res.ok) {
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        if (!contentType.startsWith('image/')) return null;
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
      if (kv.isAvailable()) {
        try {
          const kvThumbs = await kv.getThumbnails(fid);
          if (kvThumbs && typeof kvThumbs === 'object' && Object.keys(kvThumbs).length > 0) {
            return [size, ...['url3', 'url2', 'url1', 'icon'].filter(type => type !== size)]
              .map(type => kvThumbs[type])
              .filter(Boolean);
          }
        } catch {}
      }

      if (env?.sharedfile) {
        const rows = await env.sharedfile
          .prepare('SELECT url, thumbnail_type FROM thumbnails WHERE fs_id = ?')
          .bind(fid)
          .all();
        const thumbsMap = {};
        (rows?.results || []).forEach(row => {
          thumbsMap[row.thumbnail_type] = row.url;
        });
        if (kv.isAvailable() && Object.keys(thumbsMap).length > 0) {
          await kv.setThumbnails(fid, thumbsMap).catch(e => console.error('KV thumbnail backfill error:', e));
        }
        return [size, ...['url3', 'url2', 'url1', 'icon'].filter(type => type !== size)]
          .map(type => thumbsMap[type])
          .filter(Boolean);
      }
      return [];
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

    // Try each available quality; the highest-resolution URL can expire independently
    let response = null;
    try {
      response = await fetchFirstAvailableImage(await getThumbnailUrls());
    } catch (err) {
      console.error('Database query error looking up thumbnail:', err);
    }
    if (response) return response;
    console.log(`[handleThumbnail] Cached thumbnail URLs for fid ${fid} expired or unavailable. Re-resolving share.`);

    // If not found or expired, resolve from upstream to refresh the signed URLs
    if (!surl) {
      return this.errorJson(404, 'Thumbnail not cached and associated surl not found. Please resolve the share first.', 'not_found');
    }

    console.log(`[handleThumbnail] Triggering live resolve for surl ${surl} to refresh thumbnails.`);
    const resolveParams = new URLSearchParams();
    resolveParams.set('surl', surl);
    resolveParams.set('refresh', '1');
    resolveParams.set('raw', '1');
    resolveParams.set('fid', fid);
    if (dir) resolveParams.set('dir', dir);

    const resolveRes = await this.resolveController.handleResolve(request, resolveParams, env);
    if (!resolveRes.ok) {
      return resolveRes;
    }

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

    return this.errorJson(502, 'Failed to fetch thumbnail image from upstream', 'upstream_image_error');
  }
}

export const thumbnailController = new ThumbnailController();
