/**
 * D1 Database helper functions for TeraBox proxy
 */

/**
 * Save share-level metadata to D1
 * @param {D1Database} db - D1 database binding
 * @param {string} shareId - The share URL identifier (surl)
 * @param {object} data - Upstream API response data
 */
export function cleanShareTitle(title, list) {
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

/**
 * Save share-level metadata to D1
 * @param {D1Database} db - D1 database binding
 * @param {string} shareId - The share URL identifier (surl)
 * @param {object} data - Upstream API response data
 */
export async function saveShare(db, shareId, data) {
  const title = cleanShareTitle(data.title, data.list);
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

export function normalizeFsId(id) {
  if (id === null || id === undefined) return null;
  return String(id).trim().replace(/\.0+$/, '');
}

/**
 * Save media file metadata to D1
 * @param {D1Database} db - D1 database binding
 * @param {string} shareId - The share URL identifier
 * @param {object} file - File object from API response
 */
export async function saveMediaFile(db, shareId, file) {
  const fsId = normalizeFsId(file.fs_id);
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

  // Save thumbnails if present
  if (file.thumbs) {
    await saveThumbnails(db, fsId, file.thumbs);
  }
}

/**
 * Save thumbnail URLs to D1
 * @param {D1Database} db - D1 database binding
 * @param {string} fsId - File system ID
 * @param {object} thumbs - Thumbnails object with url1, url2, url3, icon
 */
export async function saveThumbnails(db, fsId, thumbs) {
  const normalizedFsId = normalizeFsId(fsId);
  // Delete existing thumbnails for this file
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

/**
 * Store complete upstream response in D1 using batched operations
 * @param {D1Database} db - D1 database binding
 * @param {string} shareId - The share URL identifier
 * @param {object} upstream - Complete upstream API response
 */
export async function storeUpstreamData(db, shareId, upstream) {
  try {
    const batch = [];

    const title = cleanShareTitle(upstream.title || upstream.share_title, upstream.list);

    // Add share metadata statement
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

    // Add all file statements
    if (upstream.list && Array.isArray(upstream.list)) {
      for (const file of upstream.list) {
        const fsId = normalizeFsId(file.fs_id);
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

        // Add thumbnail statements if present
        if (file.thumbs) {
          // Delete existing thumbnails for this file
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

    // Execute all statements in one batch
    await db.batch(batch);

    return true;
  } catch (err) {
    console.error('D1 storage error:', err);
    return false;
  }
}

/**
 * Get share data from D1
 * @param {D1Database} db - D1 database binding
 * @param {string} shareId - The share URL identifier
 */
export async function getShareFromDb(db, shareId) {
  const share = await db.prepare('SELECT * FROM shares WHERE share_id = ?')
    .bind(shareId)
    .first();

  if (!share) return null;

  const files = await db.prepare('SELECT * FROM media_files WHERE share_id = ?')
    .bind(shareId)
    .all();

  const fileRows = files.results || [];
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

      (thumbs.results || []).forEach((thumb) => {
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
