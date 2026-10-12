import { CORS_HEADERS } from '../config/constants.js';
import { HttpResponse } from './HttpResponse.js';
import { Router, router } from './Router.js';

/**
 * Main Application class for Athena Proxy on Cloudflare Workers
 */
export class Application {
  constructor({ appRouter = router } = {}) {
    this.router = appRouter;
  }

  /**
   * Main fetch handler conforming to Cloudflare Worker interface
   */
  async fetch(request, env) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    try {
      const response = await this.router.dispatch(request, env);
      return HttpResponse.withCors(response);
    } catch (err) {
      return HttpResponse.withCors(
        HttpResponse.errorJson(500, err?.message || 'Internal error', 'internal_error')
      );
    }
  }
}

export const app = new Application();
