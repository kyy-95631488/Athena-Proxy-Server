import { toOptionalNumber, getParentDirectory } from '../utils/helpers.js';

/**
 * Service for transforming and normalizing TeraBox share items, records, and thumbnails
 */
export class TransformerService {
  /**
   * Build proxy URL for serving image thumbnails
   */
  static getProxyThumbnailUrl(origin, fid, size, surl, dir) {
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

  /**
   * Rewrite remote thumbnail links to use proxy thumbnail endpoint
   */
  static rewriteResponseThumbnails(obj, requestUrl, surl) {
    if (!obj || typeof obj !== 'object') return obj;

    const origin = new URL(requestUrl).origin;

    const processFile = (file, fileSurl) => {
      const fid = file.fs_id || file.fid;
      if (!fid) return;

      const resolvedSurl = fileSurl || file.share_id || surl;
      const dir = getParentDirectory(file.path);

      if (file.thumb && typeof file.thumb === 'string' && !file.thumb.includes('mode=thumbnail')) {
        file.thumb = TransformerService.getProxyThumbnailUrl(origin, fid, 'url3', resolvedSurl, dir);
      }

      if (file.thumbs && typeof file.thumbs === 'object') {
        for (const key of Object.keys(file.thumbs)) {
          if (typeof file.thumbs[key] === 'string' && !file.thumbs[key].includes('mode=thumbnail')) {
            file.thumbs[key] = TransformerService.getProxyThumbnailUrl(origin, fid, key, resolvedSurl, dir);
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

  /**
   * Build resolved metadata record for single file
   */
  static buildResolvedRecord(surl, share, file, storedAt, origin = '') {
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

  /**
   * Build resolved record from D1 share row
   */
  static buildResolvedRecordFromDb(surl, shareData, origin = '') {
    const file = shareData?.list?.[0];
    const storedAt = shareData?.updated_at
      ? Math.floor(new Date(shareData.updated_at).getTime() / 1000)
      : null;

    return TransformerService.buildResolvedRecord(surl, shareData, file, storedAt, origin);
  }

  /**
   * Build array of simplified share items for API response
   */
  static buildShareItems(files, surl, origin = '') {
    return (files || []).map(file => {
      const fid = file.fs_id || file.fid || null;
      const cleanFid = fid ? String(fid).replace(/\.0+$/, '') : null;
      const isDir = Number(file.isdir) === 1;
      const dir = getParentDirectory(file.path);

      // Prefer HD proxy thumbnail (url3) when origin and fid are present
      const thumb = (origin && cleanFid && !isDir)
        ? TransformerService.getProxyThumbnailUrl(origin, cleanFid, 'url3', surl, dir)
        : (file.thumbs?.url3 || file.thumbs?.url2 || file.thumbs?.url1 || file.thumb || null);

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
        thumbs: file.thumbs || {},
        dlink: hasDirectDlink ? file.dlink : defaultDl
      };
    });
  }

  // Instance wrappers
  getProxyThumbnailUrl(origin, fid, size, surl, dir) {
    return TransformerService.getProxyThumbnailUrl(origin, fid, size, surl, dir);
  }

  rewriteResponseThumbnails(obj, requestUrl, surl) {
    return TransformerService.rewriteResponseThumbnails(obj, requestUrl, surl);
  }

  buildResolvedRecord(surl, share, file, storedAt, origin = '') {
    return TransformerService.buildResolvedRecord(surl, share, file, storedAt, origin);
  }

  buildResolvedRecordFromDb(surl, shareData, origin = '') {
    return TransformerService.buildResolvedRecordFromDb(surl, shareData, origin);
  }

  buildShareItems(files, surl, origin = '') {
    return TransformerService.buildShareItems(files, surl, origin);
  }
}

export const transformerService = new TransformerService();
