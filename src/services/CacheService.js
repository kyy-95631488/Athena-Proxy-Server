import {
  RESOLVE_CACHE_TTL_MS,
  RESOLVE_FAILURE_COOLDOWN_MS,
  RESOLVE_CACHE_MAX_ENTRIES,
  SHARE_INFO_CACHE_TTL_MS,
  SHARE_INFO_CACHE_MAX_ENTRIES
} from '../config/constants.js';

/**
 * Service managing in-memory L1 caches, request coalescing, and failure backoffs
 */
export class CacheService {
  constructor() {
    this.resolveResponseCache = new Map();
    this.resolveFailureCooldowns = new Map();
    this.inFlightResolves = new Map();
    this.shareInfoCache = new Map();
  }

  /**
   * Build composite cache key for resolve operations
   */
  resolveCacheKey(request, surl, dir, requestedFid, raw, internalStreamRequest) {
    return JSON.stringify([
      new URL(request.url).origin,
      surl,
      dir,
      requestedFid,
      raw,
      internalStreamRequest,
      request.headers.get('User-Agent') || ''
    ]);
  }

  getCooldown(key) {
    const now = Date.now();
    const cooldown = this.resolveFailureCooldowns.get(key);
    if (cooldown && cooldown.expiresAt > now) {
      return cooldown;
    }
    if (cooldown) {
      this.resolveFailureCooldowns.delete(key);
    }
    return null;
  }

  setCooldown(key, cooldownMs = RESOLVE_FAILURE_COOLDOWN_MS) {
    if (cooldownMs <= 0) return;
    this.resolveFailureCooldowns.set(key, {
      expiresAt: Date.now() + cooldownMs
    });
    while (this.resolveFailureCooldowns.size > RESOLVE_CACHE_MAX_ENTRIES) {
      this.resolveFailureCooldowns.delete(this.resolveFailureCooldowns.keys().next().value);
    }
  }

  deleteCooldown(key) {
    this.resolveFailureCooldowns.delete(key);
  }

  getCachedResponse(key) {
    const now = Date.now();
    const cached = this.resolveResponseCache.get(key);
    if (cached && cached.expiresAt > now) {
      return new Response(cached.body, {
        status: cached.status,
        headers: new Headers(cached.headers)
      });
    }
    if (cached) {
      this.resolveResponseCache.delete(key);
    }
    return null;
  }

  setCachedData(key, data, ttlMs = RESOLVE_CACHE_TTL_MS) {
    if (!data || typeof data.body !== 'string') return;
    this.resolveResponseCache.set(key, {
      body: data.body,
      status: data.status || 200,
      headers: data.headers || {},
      expiresAt: Date.now() + ttlMs
    });
    while (this.resolveResponseCache.size > RESOLVE_CACHE_MAX_ENTRIES) {
      this.resolveResponseCache.delete(this.resolveResponseCache.keys().next().value);
    }
  }

  async setCachedResponse(key, response, ttlMs = RESOLVE_CACHE_TTL_MS) {
    try {
      const cloned = response.clone();
      const body = await cloned.text();
      this.setCachedData(key, {
        body,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      }, ttlMs);
    } catch (err) {
      console.error('setCachedResponse error:', err);
    }
  }

  getInFlight(key) {
    return this.inFlightResolves.get(key) || null;
  }

  setInFlight(key, promise) {
    this.inFlightResolves.set(key, promise);
  }

  deleteInFlight(key) {
    this.inFlightResolves.delete(key);
  }

  getShareInfo(normSurl) {
    const now = Date.now();
    const cached = this.shareInfoCache.get(normSurl);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
    return null;
  }

  setShareInfo(normSurl, data, ttlMs = SHARE_INFO_CACHE_TTL_MS) {
    const now = Date.now();
    this.shareInfoCache.set(normSurl, { data, expiresAt: now + ttlMs });
    while (this.shareInfoCache.size > SHARE_INFO_CACHE_MAX_ENTRIES) {
      this.shareInfoCache.delete(this.shareInfoCache.keys().next().value);
    }
  }
}

export const cacheService = new CacheService();
