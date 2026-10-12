/**
 * Repository encapsulating Cloudflare D1 database operations for shares, media files, and thumbnails
 */
export class ShareRepository {
  /**
   * @param {D1Database} db - Cloudflare D1 database binding
   */
  constructor(db = null) {
    this.db = db;
  }

  static cleanShareTitle(title, list) {
    let res = title;
    if (!res && Array.isArray(list) && list.length > 0) {
      const firstPath = list[0].path;
      if (firstPath) {
        const parts = firstPath.split('/').filter(Boolean);
        res = parts.length > 1 ? parts[parts.length - 2] : parts[0];
      }
      if (!res) res = list[0].server_filename || null;
    }
    if (res && typeof res === 'string') {
      res = res.trim();
      if (res.startsWith('/')) {
        const parts = res.split('/').filter(Boolean);
        res = parts[parts.length - 1] || res.slice(1);
      }
    }
    return res || null;
  }

  static normalizeFsId(id) {
    if (id === null || id === undefined) return null;
    return String(id).trim().replace(/\.0+$/, '');
  }

  cleanShareTitle(title, list) {
    return ShareRepository.cleanShareTitle(title, list);
  }

  normalizeFsId(id) {
    return ShareRepository.normalizeFsId(id);
  }

  async saveShare(shareId, data) {
    const db = this.db;
    if (!db) throw new Error('Database binding not configured');

    const title = ShareRepository.cleanShareTitle(data.title, data.list);
    const stmt = db.prepare(`
      INSERT INTO shares (share_id, uk, shareid, title, server_time, cfrom_id, errno, request_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(share_id) DO UPDATE SET
        uk = COALESCE(excluded.uk, shares.uk),
        shareid = COALESCE(excluded.shareid, shares.shareid),
        title = COALESCE(excluded.title, shares.title),
        server_time = COALESCE(excluded.server_time, shares.server_time),
        cfrom_id = COALESCE(excluded.cfrom_id, shares.cfrom_id),
        errno = excluded.errno,
        request_id = COALESCE(excluded.request_id, shares.request_id),
        updated_at = CURRENT_TIMESTAMP
    `);

    await stmt.bind(
      shareId,
      data.uk?.toString() || null,
      data.shareid?.toString() || data.share_id?.toString() || null,
      title,
      data.server_time || null,
      data.cfrom_id || null,
      data.errno || 0,
      data.request_id?.toString() || null
    ).run();
  }

  async saveMediaFile(shareId, file) {
    const db = this.db;
    if (!db) throw new Error('Database binding not configured');

    const fsId = ShareRepository.normalizeFsId(file.fs_id);
    const stmt = db.prepare(`
      INSERT INTO media_files (
        fs_id, share_id, category, isdir, local_ctime, local_mtime,
        md5, path, play_forbid, server_ctime, server_filename,
        server_mtime, size, is_adult, cmd5, dlink
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(fs_id) DO UPDATE SET
        share_id = excluded.share_id,
        category = excluded.category,
        md5 = excluded.md5,
        path = excluded.path,
        server_filename = excluded.server_filename,
        server_mtime = excluded.server_mtime,
        size = excluded.size,
        is_adult = excluded.is_adult,
        cmd5 = excluded.cmd5,
        dlink = excluded.dlink
    `);

    await stmt.bind(
      fsId,
      shareId,
      file.category != null ? String(file.category).replace(/\.0+$/, '') : null,
      file.isdir || 0,
      file.local_ctime || null,
      file.local_mtime || null,
      file.md5 || null,
      file.path || null,
      file.play_forbid || 0,
      file.server_ctime || null,
      file.server_filename || null,
      file.server_mtime || null,
      file.size ? Number(file.size) : null,
      file.is_adult || 0,
      file.cmd5 || null,
      file.dlink || null
    ).run();

    if (file.thumbs) {
      await this.saveThumbnails(fsId, file.thumbs);
    }
  }

  async saveThumbnails(fsId, thumbs) {
    const db = this.db;
    if (!db) throw new Error('Database binding not configured');

    const normalizedFsId = ShareRepository.normalizeFsId(fsId);
    await db.prepare('DELETE FROM thumbnails WHERE fs_id = ?').bind(normalizedFsId).run();

    const thumbnailTypes = ['url1', 'url2', 'url3', 'icon'];
    const batch = [];

    for (const type of thumbnailTypes) {
      if (thumbs[type]) {
        batch.push(
          db.prepare('INSERT INTO thumbnails (fs_id, url, thumbnail_type) VALUES (?, ?, ?)')
            .bind(normalizedFsId, thumbs[type], type)
        );
      }
    }

    if (batch.length > 0) {
      await db.batch(batch);
    }
  }

  async storeUpstreamData(shareId, upstream) {
    const db = this.db;
    if (!db) return false;

    try {
      const batch = [];
      const title = ShareRepository.cleanShareTitle(upstream.title || upstream.share_title, upstream.list);

      batch.push(
        db.prepare(`
          INSERT INTO shares (share_id, uk, shareid, title, server_time, cfrom_id, errno, request_id, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(share_id) DO UPDATE SET
            uk = COALESCE(excluded.uk, shares.uk),
            shareid = COALESCE(excluded.shareid, shares.shareid),
            title = COALESCE(excluded.title, shares.title),
            server_time = COALESCE(excluded.server_time, shares.server_time),
            cfrom_id = COALESCE(excluded.cfrom_id, shares.cfrom_id),
            errno = excluded.errno,
            request_id = COALESCE(excluded.request_id, shares.request_id),
            updated_at = CURRENT_TIMESTAMP
        `).bind(
          shareId,
          upstream.uk?.toString() || null,
          upstream.shareid?.toString() || upstream.share_id?.toString() || null,
          title,
          upstream.server_time || null,
          upstream.cfrom_id || null,
          upstream.errno || 0,
          upstream.request_id?.toString() || null
        )
      );

      if (upstream.list && Array.isArray(upstream.list)) {
        for (const file of upstream.list) {
          const fsId = ShareRepository.normalizeFsId(file.fs_id);
          batch.push(
            db.prepare(`
              INSERT INTO media_files (
                fs_id, share_id, category, isdir, local_ctime, local_mtime,
                md5, path, play_forbid, server_ctime, server_filename,
                server_mtime, size, is_adult, cmd5, dlink
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(fs_id) DO UPDATE SET
                share_id = excluded.share_id,
                category = excluded.category,
                md5 = excluded.md5,
                path = excluded.path,
                server_filename = excluded.server_filename,
                server_mtime = excluded.server_mtime,
                size = excluded.size,
                is_adult = excluded.is_adult,
                cmd5 = excluded.cmd5,
                dlink = excluded.dlink
            `).bind(
              fsId,
              shareId,
              file.category != null ? String(file.category).replace(/\.0+$/, '') : null,
              file.isdir || 0,
              file.local_ctime || null,
              file.local_mtime || null,
              file.md5 || null,
              file.path || null,
              file.play_forbid || 0,
              file.server_ctime || null,
              file.server_filename || null,
              file.server_mtime || null,
              file.size ? Number(file.size) : null,
              file.is_adult || 0,
              file.cmd5 || null,
              file.dlink || null
            )
          );

          if (file.thumbs) {
            batch.push(
              db.prepare('DELETE FROM thumbnails WHERE fs_id = ?').bind(fsId)
            );

            const thumbnailTypes = ['url1', 'url2', 'url3', 'icon'];
            for (const type of thumbnailTypes) {
              if (file.thumbs[type]) {
                batch.push(
                  db.prepare('INSERT INTO thumbnails (fs_id, url, thumbnail_type) VALUES (?, ?, ?)')
                    .bind(fsId, file.thumbs[type], type)
                );
              }
            }
          }
        }
      }

      // Execute in safe chunks of 50 statements to strictly stay within Cloudflare D1 batch limits
      const chunkSize = 50;
      for (let i = 0; i < batch.length; i += chunkSize) {
        await db.batch(batch.slice(i, i + chunkSize));
      }
      return true;
    } catch (err) {
      console.error('D1 storage error:', err);
      return false;
    }
  }

  async getShareFromDb(shareId) {
    const db = this.db;
    if (!db) return null;

    let share = await db.prepare('SELECT * FROM shares WHERE share_id = ? COLLATE NOCASE')
      .bind(shareId)
      .first();

    // Fallback: Handle user typing O (letter) vs 0 (zero)
    if (!share && typeof shareId === 'string') {
      const candidates = [];
      if (shareId.includes('O')) candidates.push(shareId.replace(/O/g, '0'));
      if (shareId.includes('0')) candidates.push(shareId.replace(/0/g, 'O'));
      if (shareId.includes('o')) candidates.push(shareId.replace(/o/g, '0'));
      for (const altId of candidates) {
        share = await db.prepare('SELECT * FROM shares WHERE share_id = ? COLLATE NOCASE')
          .bind(altId)
          .first();
        if (share) break;
      }
    }

    if (!share) return null;

    const files = await db.prepare('SELECT * FROM media_files WHERE share_id = ?')
      .bind(share.share_id)
      .all();

    const fileRows = files?.results || [];
    const fileIds = fileRows.map(file => file.fs_id).filter(Boolean);
    let thumbsByFsId = {};

    if (fileIds.length > 0) {
      const maxIdsPerQuery = 80;
      for (let offset = 0; offset < fileIds.length; offset += maxIdsPerQuery) {
        const idBatch = fileIds.slice(offset, offset + maxIdsPerQuery);
        const placeholders = idBatch.map(() => '?').join(',');
        const thumbs = await db.prepare(
          `SELECT fs_id, url, thumbnail_type FROM thumbnails WHERE fs_id IN (${placeholders})`
        )
          .bind(...idBatch)
          .all();

        (thumbs?.results || []).forEach((thumb) => {
          if (!thumbsByFsId[thumb.fs_id]) {
            thumbsByFsId[thumb.fs_id] = {};
          }
          thumbsByFsId[thumb.fs_id][thumb.thumbnail_type] = thumb.url;
        });
      }
    }

    const filesWithThumbs = fileRows.map((file) => ({
      ...file,
      thumbs: thumbsByFsId[file.fs_id] || {}
    }));

    return {
      ...share,
      list: filesWithThumbs
    };
  }

  // Admin Query Methods
  async getOverview() {
    const db = this.db;
    const [sharesCount, filesCount, thumbsCount, latestShares, storageStats] = await Promise.all([
      db.prepare('SELECT COUNT(*) as total FROM shares').first(),
      db.prepare('SELECT COUNT(*) as total FROM media_files').first(),
      db.prepare('SELECT COUNT(*) as total FROM thumbnails').first(),
      db.prepare('SELECT share_id, title, updated_at FROM shares ORDER BY updated_at DESC LIMIT 20').all(),
      db.prepare(`
        SELECT
          COALESCE(SUM(size), 0) as total_bytes,
          COUNT(CASE WHEN isdir = 1 THEN 1 END) as total_folders,
          COUNT(CASE WHEN category = '1' THEN 1 END) as total_videos,
          COUNT(CASE WHEN category = '3' THEN 1 END) as total_images,
          COUNT(CASE WHEN (category NOT IN ('1', '3') OR category IS NULL) AND isdir != 1 THEN 1 END) as total_other
        FROM media_files
      `).first()
    ]);

    return {
      counts: {
        shares: sharesCount?.total || 0,
        media_files: filesCount?.total || 0,
        thumbnails: thumbsCount?.total || 0,
        total_bytes: storageStats?.total_bytes || 0,
        total_folders: storageStats?.total_folders || 0,
        total_videos: storageStats?.total_videos || 0,
        total_images: storageStats?.total_images || 0,
        total_other: storageStats?.total_other || 0
      },
      latestShares: latestShares?.results || []
    };
  }

  async deleteShare(shareId) {
    const db = this.db;
    if (!db) return false;

    try {
      const files = await db.prepare('SELECT fs_id FROM media_files WHERE share_id = ?').bind(shareId).all();
      const fsIds = (files?.results || []).map(f => f.fs_id).filter(Boolean);

      const chunkSize = 50;
      for (let i = 0; i < fsIds.length; i += chunkSize) {
        const chunk = fsIds.slice(i, i + chunkSize);
        const placeholders = chunk.map(() => '?').join(',');
        await db.prepare(`DELETE FROM thumbnails WHERE fs_id IN (${placeholders})`).bind(...chunk).run();
      }

      await db.batch([
        db.prepare('DELETE FROM media_files WHERE share_id = ?').bind(shareId),
        db.prepare('DELETE FROM shares WHERE share_id = ?').bind(shareId)
      ]);

      return true;
    } catch (err) {
      console.error('deleteShare error:', err);
      return false;
    }
  }

  async getShares({ q, sort, order, page, pageSize }) {
    const db = this.db;
    const offset = (page - 1) * pageSize;
    const where = q ? 'WHERE share_id LIKE ? OR title LIKE ? OR uk LIKE ?' : '';
    const binds = [];
    if (q) {
      const like = `%${q}%`;
      binds.push(like, like, like);
    }

    const totalRow = await db
      .prepare(`SELECT COUNT(*) as total FROM shares ${where}`)
      .bind(...binds)
      .first();

    const list = await db
      .prepare(
        `SELECT share_id, uk, title, server_time, request_id, updated_at
         FROM shares ${where}
         ORDER BY ${sort} ${order}
         LIMIT ? OFFSET ?`
      )
      .bind(...binds, pageSize, offset)
      .all();

    return {
      page,
      pageSize,
      total: totalRow?.total || 0,
      items: list?.results || []
    };
  }

  async getShareDetail(shareId, { page, pageSize }) {
    const db = this.db;
    const offset = (page - 1) * pageSize;

    const share = await db.prepare('SELECT * FROM shares WHERE share_id = ?')
      .bind(shareId)
      .first();

    if (!share) return null;

    const totalFilesRow = await db
      .prepare('SELECT COUNT(*) as total FROM media_files WHERE share_id = ?')
      .bind(shareId)
      .first();

    const files = await db
      .prepare(
        `SELECT * FROM media_files
         WHERE share_id = ?
         ORDER BY server_mtime DESC
         LIMIT ? OFFSET ?`
      )
      .bind(shareId, pageSize, offset)
      .all();

    const fileIds = (files?.results || []).map(f => f.fs_id).filter(Boolean);
    let thumbsByFsId = {};
    if (fileIds.length > 0 && fileIds.length <= 200) {
      const placeholders = fileIds.map(() => '?').join(',');
      const thumbs = await db
        .prepare(`SELECT fs_id, url, thumbnail_type FROM thumbnails WHERE fs_id IN (${placeholders})`)
        .bind(...fileIds)
        .all();

      thumbsByFsId = {};
      (thumbs?.results || []).forEach(t => {
        if (!thumbsByFsId[t.fs_id]) thumbsByFsId[t.fs_id] = {};
        thumbsByFsId[t.fs_id][t.thumbnail_type] = t.url;
      });
    }

    return {
      share,
      files: (files?.results || []).map(item => ({
        ...item,
        fs_id: item.fs_id ? String(item.fs_id).replace(/\.0+$/, '') : item.fs_id
      })),
      thumbsByFsId,
      page,
      pageSize,
      totalFiles: totalFilesRow?.total || 0
    };
  }

  async getFiles({ shareId, q, category, sizeMin, sizeMax, sort, order, page, pageSize }) {
    const db = this.db;
    const offset = (page - 1) * pageSize;
    const whereParts = [];
    const binds = [];

    if (shareId) {
      whereParts.push('share_id = ?');
      binds.push(shareId);
    }
    if (q) {
      whereParts.push('(server_filename LIKE ? OR fs_id LIKE ?)');
      const like = `%${q}%`;
      binds.push(like, like);
    }
    if (category) {
      if (category === 'folder') {
        whereParts.push('isdir = 1');
      } else if (category === 'video') {
        whereParts.push("category = '1'");
      } else if (category === 'image') {
        whereParts.push("category = '3'");
      } else {
        whereParts.push('category = ?');
        binds.push(category);
      }
    }
    if (sizeMin) {
      whereParts.push('size >= ?');
      binds.push(Number(sizeMin));
    }
    if (sizeMax) {
      whereParts.push('size <= ?');
      binds.push(Number(sizeMax));
    }

    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const totalRow = await db
      .prepare(`SELECT COUNT(*) as total FROM media_files ${where}`)
      .bind(...binds)
      .first();

    const list = await db
      .prepare(
        `SELECT * FROM media_files ${where}
         ORDER BY ${sort} ${order}
         LIMIT ? OFFSET ?`
      )
      .bind(...binds, pageSize, offset)
      .all();

    return {
      page,
      pageSize,
      total: totalRow?.total || 0,
      items: (list?.results || []).map(item => ({
        ...item,
        fs_id: item.fs_id ? String(item.fs_id).replace(/\.0+$/, '') : item.fs_id
      }))
    };
  }

  async getFileDetail(fsId, normalizedFsId) {
    const db = this.db;
    const file = await db
      .prepare('SELECT * FROM media_files WHERE fs_id = ? OR fs_id = ?')
      .bind(normalizedFsId, normalizedFsId + '.0')
      .first();

    if (!file) return null;

    const thumbs = await db
      .prepare('SELECT url, thumbnail_type FROM thumbnails WHERE fs_id = ? OR fs_id = ?')
      .bind(normalizedFsId, normalizedFsId + '.0')
      .all();

    const thumbsObj = {};
    (thumbs?.results || []).forEach(t => {
      thumbsObj[t.thumbnail_type] = t.url;
    });

    return { file, thumbs: thumbsObj };
  }

  async getThumbnails({ fsId, type, page, pageSize }) {
    const db = this.db;
    const offset = (page - 1) * pageSize;
    const whereParts = [];
    const binds = [];

    if (fsId) {
      whereParts.push('(fs_id = ? OR fs_id = ?)');
      binds.push(fsId, fsId + '.0');
    }
    if (type) {
      whereParts.push('thumbnail_type = ?');
      binds.push(type);
    }

    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const totalRow = await db
      .prepare(`SELECT COUNT(*) as total FROM thumbnails ${where}`)
      .bind(...binds)
      .first();

    const list = await db
      .prepare(
        `SELECT * FROM thumbnails ${where}
         ORDER BY id DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...binds, pageSize, offset)
      .all();

    return {
      page,
      pageSize,
      total: totalRow?.total || 0,
      items: (list?.results || []).map(item => ({
        ...item,
        fs_id: item.fs_id ? String(item.fs_id).replace(/\.0+$/, '') : item.fs_id
      }))
    };
  }

  async getAnalyticsProcessed(limit) {
    const db = this.db;
    const rows = await db
      .prepare(
        `SELECT DATE(updated_at) as day, COUNT(*) as shares
         FROM shares
         GROUP BY day
         ORDER BY day DESC
         LIMIT ?`
      )
      .bind(limit)
      .all();

    return {
      limit,
      items: rows?.results || []
    };
  }
}
