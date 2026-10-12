/**
 * API client interacting with Athena Proxy serverless backend
 */

export const api = {
  // Normalization helper
  extractSurl(input) {
    if (!input) return '';
    const trimmed = input.trim();
    // Match /s/xxxx or ?surl=xxxx
    const sMatch = trimmed.match(/(?:terabox\.app|1024tera\.com|1024terabox\.com|freeterabox\.com|terasharelink\.com)\/(?:s\/|sharing\/link\?surl=)([a-zA-Z0-9_-]+)/i);
    if (sMatch) return sMatch[1];
    const surlParam = trimmed.match(/[?&]surl=([a-zA-Z0-9_-]+)/i);
    if (surlParam) return surlParam[1];
    const cleanAlphanum = trimmed.replace(/^https?:\/\/[^\/]+\/(?:s\/)?/, '').replace(/^\/+/, '');
    if (/^[a-zA-Z0-9_-]{6,50}$/.test(cleanAlphanum)) return cleanAlphanum;
    return trimmed;
  },

  async resolveShare(surl, dir = '', fid = '', refresh = false) {
    const params = new URLSearchParams();
    params.set('mode', 'resolve');
    params.set('surl', surl);
    if (dir) params.set('dir', dir);
    if (fid) params.set('fid', fid);
    if (refresh) params.set('refresh', '1');

    const res = await fetch(`/?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || data?.details?.reason || 'Gagal memproses link TeraBox');
    }
    return data;
  },

  async getDownloadLink(surl, fid) {
    const params = new URLSearchParams({
      mode: 'download',
      surl,
      fid,
      json: '1'
    });
    const res = await fetch(`/?${params.toString()}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data?.error || 'Gagal membuat tautan unduhan langsung');
    }
    return data;
  },

  getProxyStreamUrl(surl, fid = '', dir = '', type = 'M3U8_AUTO_360') {
    const params = new URLSearchParams({
      mode: 'stream',
      surl,
      type
    });
    if (fid) params.set('fid', fid);
    if (dir) params.set('dir', dir);
    return `${window.location.origin}/?${params.toString()}`;
  },

  getProxyDownloadUrl(surl, fid) {
    const cleanFid = String(fid || '').replace(/\.0+$/, '').trim();
    return `${window.location.origin}/?mode=download&surl=${encodeURIComponent(surl)}&fid=${encodeURIComponent(cleanFid)}`;
  },

  getThumbnailUrl(fid, size = 'url3', surl = '', dir = '') {
    const params = new URLSearchParams({
      mode: 'thumbnail',
      fid,
      size
    });
    if (surl) params.set('surl', surl);
    if (dir) params.set('dir', dir);
    return `${window.location.origin}/?${params.toString()}`;
  },

  // Admin APIs
  adminHeaders(key) {
    return key ? { 'x-admin-key': key } : {};
  },

  async adminOverview(key) {
    const res = await fetch('/admin/overview', { headers: this.adminHeaders(key) });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Akses ditolak atau D1 belum aktif');
    return data;
  },

  async adminShares({ key, q = '', sort = 'updated_at', order = 'DESC', page = 1, pageSize = 50 }) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort, order });
    if (q) params.set('q', q);
    const res = await fetch(`/admin/shares?${params.toString()}`, { headers: this.adminHeaders(key) });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Gagal memuat daftar shares');
    return data;
  },

  async adminShareDetail(shareId, { key, page = 1, pageSize = 50 }) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    const res = await fetch(`/admin/shares/${encodeURIComponent(shareId)}?${params.toString()}`, {
      headers: this.adminHeaders(key)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Gagal memuat detail share');
    return data;
  },

  async adminFiles({ key, shareId = '', q = '', category = '', sizeMin = '', sizeMax = '', sort = 'server_mtime', order = 'DESC', page = 1, pageSize = 50 }) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort, order });
    if (shareId) params.set('share_id', shareId);
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (sizeMin) params.set('size_min', sizeMin);
    if (sizeMax) params.set('size_max', sizeMax);

    const res = await fetch(`/admin/files?${params.toString()}`, { headers: this.adminHeaders(key) });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Gagal memuat berkas');
    return data;
  },

  async adminDeleteShare(shareId, key) {
    const res = await fetch(`/admin/shares/${encodeURIComponent(shareId)}`, {
      method: 'DELETE',
      headers: this.adminHeaders(key)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Gagal menghapus share dari database');
    return data;
  },

  async adminIngestShare(surl, dir = '', key) {
    const res = await fetch('/admin/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.adminHeaders(key)
      },
      body: JSON.stringify({ surl, dir })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || data?.details?.reason || 'Gagal sinkronisasi link TeraBox');
    return data;
  },

  async adminFileDetail(fsId, key) {
    const res = await fetch(`/admin/files/${encodeURIComponent(fsId)}`, { headers: this.adminHeaders(key) });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Gagal memuat berkas');
    return data;
  },

  async adminThumbnails({ key, fsId = '', type = '', page = 1, pageSize = 50 }) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (fsId) params.set('fs_id', fsId);
    if (type) params.set('type', type);

    const res = await fetch(`/admin/thumbnails?${params.toString()}`, { headers: this.adminHeaders(key) });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Gagal memuat thumbnails');
    return data;
  },

  async adminAnalytics(limit = 30, key) {
    const res = await fetch(`/admin/analytics/processed?limit=${limit}`, { headers: this.adminHeaders(key) });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Gagal memuat analitik');
    return data;
  },

  async adminKvLookup(surl, key) {
    const res = await fetch(`/admin/kv/entry?surl=${encodeURIComponent(surl)}`, { headers: this.adminHeaders(key) });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Data cache tidak ditemukan');
    return data;
  },

  async adminPurgeKv(surl, key) {
    const res = await fetch('/admin/kv/purge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.adminHeaders(key)
      },
      body: JSON.stringify({ surl })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Gagal membersihkan cache KV');
    return data;
  }
};
