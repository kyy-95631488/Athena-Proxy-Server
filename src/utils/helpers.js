import { ALLOWED_SEGMENT_DOMAINS } from '../config/constants.js';

/**
 * Utility functions for token extraction, URL parsing, and parameter sanitation
 */

export function extractJsToken(html) {
  if (!html || typeof html !== 'string') return null;
  // 1. Matches fn%28%22<token>%22%29 or fn("<token>")
  const match = html.match(/fn(?:%28|\()(?:%22|%27|["'])([^%'"\(\)]+)(?:%22|%27|["'])(?:%29|\))/);
  if (match) return match[1];

  // 2. Matches window.jsToken = "..." or window.jsToken = '...'
  const match2 = html.match(/window\.jsToken\s*=\s*["']([^"']+)["']/);
  if (match2) return match2[1];

  // 3. Matches jsToken%20%3D%20%22...%22 or jsToken="..."
  const match3 = html.match(/jsToken(?:%20|\s)*(?:%3D|=)(?:%20|\s)*(?:%22|%27|["'])([^%'"\(\)]+)(?:%22|%27|["'])/);
  if (match3) return match3[1];

  return null;
}

export function findBetween(str, start, end) {
  const i = str.indexOf(start);
  if (i === -1) return null;
  const j = str.indexOf(end, i + start.length);
  if (j === -1) return null;
  return str.slice(i + start.length, j);
}

export function buildApiUrl(jsToken, shorturl, root, dir, page = 1, num = 20) {
  const u = new URL('https://dm.terabox.app/share/list');
  u.searchParams.set('app_id', '250528');
  u.searchParams.set('web', '1');
  u.searchParams.set('channel', 'dubox');
  u.searchParams.set('clienttype', '0');
  u.searchParams.set('jsToken', jsToken);
  u.searchParams.set('site_referer', 'https://www.terabox.app/');
  u.searchParams.set('shorturl', shorturl);
  u.searchParams.set('page', String(page));
  u.searchParams.set('num', String(num));
  if (root) u.searchParams.set('root', root);
  if (dir) u.searchParams.set('dir', dir);
  return u.toString();
}

export function buildHeaders(request, extra = {}) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Ch-Ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    ...extra
  };
  const cookie = request?.headers?.get ? request.headers.get('Cookie') : request?.headers?.Cookie;
  if (cookie) headers.Cookie = cookie;

  const acceptLang = request?.headers?.get ? request.headers.get('Accept-Language') : request?.headers?.['Accept-Language'];
  if (acceptLang) headers['Accept-Language'] = acceptLang;

  return headers;
}

export function normalizeSurl(surl) {
  if (!surl || typeof surl !== 'string') return surl;
  if (surl.length === 23 && surl.startsWith('1')) {
    return surl.slice(1);
  }
  return surl;
}

export function isValidSurl(surl) {
  if (!surl || typeof surl !== 'string') return false;
  // TeraBox surls are typically alphanumeric, 10-30 characters
  return /^[a-zA-Z0-9_-]{6,50}$/.test(surl);
}

export function isAllowedSegmentUrl(urlString) {
  try {
    const url = new URL(urlString);
    return ALLOWED_SEGMENT_DOMAINS.some(domain => 
      url.hostname === domain || url.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

export function toOptionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function getParentDirectory(path) {
  const normalized = typeof path === 'string' ? path.replace(/\/+$/, '') : '';
  const separator = normalized.lastIndexOf('/');
  return separator <= 0 ? '' : normalized.slice(0, separator);
}

export function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return n;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeOrder(order) {
  return order && order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
}

export function normalizeSort(sort, allowed, fallback) {
  return allowed.includes(sort) ? sort : fallback;
}
