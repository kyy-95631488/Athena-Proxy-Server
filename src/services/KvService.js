import { ShareRepository } from '../repositories/ShareRepository.js';

/**
 * Service managing Cloudflare Workers KV operations for high-speed edge caching
 */
export class KvService {
  /**
   * @param {KVNamespace|null} kv - Cloudflare Workers KV namespace binding
   * @param {number} defaultTtl - Default TTL in seconds (default: 7 days = 604800s)
   */
  constructor(kv = null, defaultTtl = 604800) {
    this.kv = kv;
    this.defaultTtl = defaultTtl;
  }

  /**
   * Check if KV binding is available
   */
  isAvailable() {
    return Boolean(this.kv && typeof this.kv.get === 'function');
  }

  /**
   * Normalize KV key prefix
   */
  shareKey(surl, dir = '') {
    if (dir) {
      return `share:${surl}:dir:${encodeURIComponent(dir)}`;
    }
    return `share:${surl}`;
  }

  fileKey(fsId) {
    const cleanId = ShareRepository.normalizeFsId(fsId);
    return `file:${cleanId}`;
  }

  thumbKey(fsId) {
    const cleanId = ShareRepository.normalizeFsId(fsId);
    return `thumb:${cleanId}`;
  }

  /**
   * Retrieve cached share metadata from KV
   */
  async getShare(surl, dir = '') {
    if (!this.isAvailable() || !surl) return null;
    try {
      if (dir) {
        const dirData = await this.kv.get(this.shareKey(surl, dir), { type: 'json' });
        return (dirData && dirData.list && dirData.list.length > 0) ? dirData : null;
      }
      const data = await this.kv.get(this.shareKey(surl), { type: 'json' });
      return data || null;
    } catch (err) {
      console.error('KV getShare error:', err);
      return null;
    }
  }

  /**
   * Store share metadata and its files into KV with expiration TTL
   */
  async storeShare(surl, upstream, ttl = this.defaultTtl, dir = '') {
    if (!this.isAvailable() || !surl || !upstream) return false;
    try {
      const title = ShareRepository.cleanShareTitle(upstream.title || upstream.share_title, upstream.list);
      const shareRecord = {
        share_id: surl,
        surl: surl,
        uk: upstream.uk?.toString() || null,
        shareid: upstream.shareid?.toString() || upstream.share_id?.toString() || null,
        title: title,
        server_time: upstream.server_time || null,
        cfrom_id: upstream.cfrom_id || null,
        errno: upstream.errno || 0,
        request_id: upstream.request_id?.toString() || null,
        list: upstream.list || [],
        cached_at: Math.floor(Date.now() / 1000)
      };

      // 1. If dir is specified, cache specifically under dir key
      if (dir) {
        await this.kv.put(this.shareKey(surl, dir), JSON.stringify(shareRecord), {
          expirationTtl: Math.max(60, ttl)
        });
      } else {
        // 2. Primary root share record is cached when dir is empty
        await this.kv.put(this.shareKey(surl), JSON.stringify(shareRecord), {
          expirationTtl: Math.max(60, ttl)
        });
      }

      // 2. Cache top files safely within Cloudflare subrequest budget (up to 15 files)
      if (Array.isArray(upstream.list) && upstream.list.length > 0) {
        const topFiles = upstream.list.slice(0, 15);
        const subPromises = [];
        for (const file of topFiles) {
          if (!file || !file.fs_id) continue;
          const fsId = ShareRepository.normalizeFsId(file.fs_id);
          const fileRecord = {
            fs_id: fsId,
            share_id: surl,
            category: file.category != null ? String(file.category).replace(/\.0+$/, '') : null,
            isdir: file.isdir || 0,
            local_ctime: file.local_ctime || null,
            local_mtime: file.local_mtime || null,
            md5: file.md5 || null,
            path: file.path || null,
            play_forbid: file.play_forbid || 0,
            server_ctime: file.server_ctime || null,
            server_filename: file.server_filename || null,
            server_mtime: file.server_mtime || null,
            size: file.size ? Number(file.size) : null,
            is_adult: file.is_adult || 0,
            cmd5: file.cmd5 || null,
            dlink: file.dlink || null,
            thumbs: file.thumbs || {}
          };

          subPromises.push(
            this.kv.put(this.fileKey(fsId), JSON.stringify(fileRecord), {
              expirationTtl: Math.max(60, ttl)
            }).catch(() => {})
          );
        }
        if (subPromises.length > 0) {
          await Promise.all(subPromises);
        }
      }

      return true;
    } catch (err) {
      console.error('KV storeShare error:', err);
      return false;
    }
  }

  /**
   * Retrieve file metadata from KV
   */
  async getFile(fsId) {
    if (!this.isAvailable() || !fsId) return null;
    try {
      const data = await this.kv.get(this.fileKey(fsId), { type: 'json' });
      return data || null;
    } catch (err) {
      console.error('KV getFile error:', err);
      return null;
    }
  }

  /**
   * Store individual file metadata into KV
   */
  async setFile(fsId, fileRecord, ttl = this.defaultTtl) {
    if (!this.isAvailable() || !fsId || !fileRecord) return false;
    try {
      await this.kv.put(this.fileKey(fsId), JSON.stringify(fileRecord), {
        expirationTtl: Math.max(60, ttl)
      });
      return true;
    } catch (err) {
      console.error('KV setFile error:', err);
      return false;
    }
  }

  /**
   * Retrieve thumbnails from KV
   */
  async getThumbnails(fsId) {
    if (!this.isAvailable() || !fsId) return null;
    try {
      const data = await this.kv.get(this.thumbKey(fsId), { type: 'json' });
      return data || null;
    } catch (err) {
      console.error('KV getThumbnails error:', err);
      return null;
    }
  }

  /**
   * Store thumbnails into KV
   */
  async setThumbnails(fsId, thumbs, ttl = this.defaultTtl) {
    if (!this.isAvailable() || !fsId || !thumbs) return false;
    try {
      await this.kv.put(this.thumbKey(fsId), JSON.stringify(thumbs), {
        expirationTtl: Math.max(60, ttl)
      });
      return true;
    } catch (err) {
      console.error('KV setThumbnails error:', err);
      return false;
    }
  }

  /**
   * Delete share and associated keys from KV
   */
  async deleteShare(surl) {
    if (!this.isAvailable() || !surl) return false;
    try {
      await this.kv.delete(this.shareKey(surl));
      return true;
    } catch (err) {
      console.error('KV deleteShare error:', err);
      return false;
    }
  }

  /**
   * Delete file from KV
   */
  async deleteFile(fsId) {
    if (!this.isAvailable() || !fsId) return false;
    try {
      await Promise.all([
        this.kv.delete(this.fileKey(fsId)),
        this.kv.delete(this.thumbKey(fsId))
      ]);
      return true;
    } catch (err) {
      console.error('KV deleteFile error:', err);
      return false;
    }
  }

  /**
   * Get KV statistics / metadata summary
   */
  getStats() {
    return {
      enabled: this.isAvailable(),
      ttl_seconds: this.defaultTtl,
      ttl_policy: `${Math.round(this.defaultTtl / 86400)} days`
    };
  }
}

export const kvService = new KvService();
