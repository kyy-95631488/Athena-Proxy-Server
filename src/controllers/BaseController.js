import { HttpResponse } from '../core/HttpResponse.js';
import { ShareRepository } from '../repositories/ShareRepository.js';
import { KvService } from '../services/KvService.js';

/**
 * Base Controller with common response utilities and repository access
 */
export class BaseController {
  constructor() {
    this.response = HttpResponse;
  }

  /**
   * Ensure D1 database binding is present
   */
  requireD1(env) {
    if (!env || !env.sharedfile) {
      return HttpResponse.errorJson(503, 'D1 database not configured', 'd1_unavailable');
    }
    return null;
  }

  /**
   * Instantiate ShareRepository for current environment
   */
  getRepository(env) {
    return new ShareRepository(env?.sharedfile || null);
  }

  /**
   * Extract Workers KV namespace binding from environment
   */
  getKv(env) {
    return env?.SHARE_KV || env?.sharedfile_kv || env?.KV || null;
  }

  /**
   * Instantiate KvService for current environment
   */
  getKvService(env) {
    return new KvService(this.getKv(env));
  }

  badRequest(msg, required) {
    return HttpResponse.badRequest(msg, required);
  }

  errorJson(status, message, code = 'error', details, required) {
    return HttpResponse.errorJson(status, message, code, details, required);
  }
}
