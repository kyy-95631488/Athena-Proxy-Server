import { CORS_HEADERS } from '../config/constants.js';

/**
 * HttpResponse builder with CORS and standard error structures
 */
export class HttpResponse {
  /**
   * Attach CORS headers to an existing response
   */
  static withCors(response) {
    const headers = new Headers(response.headers);
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      headers.set(key, value);
    });
    return new Response(response.body, {
      status: response.status,
      headers
    });
  }

  /**
   * Return standardized JSON error response
   */
  static errorJson(status, message, code = 'error', details, required) {
    const body = { error: message, code };
    if (details !== undefined) body.details = details;
    if (required) body.required = required;
    return Response.json(body, { status });
  }

  /**
   * Return 400 Bad Request error response
   */
  static badRequest(msg, required) {
    return HttpResponse.errorJson(400, msg, 'bad_request', undefined, required);
  }

  /**
   * Handle upstream JSON responses or return formatted 502 error
   */
  static async jsonUpstream(res, message = 'Upstream request failed') {
    const ct = res.headers.get('content-type') || '';

    if (!res.ok) {
      let details = { status: res.status };
      if (ct.includes('application/json')) {
        try {
          details.body = await res.json();
        } catch {
          // ignore parse errors
        }
      }
      return HttpResponse.errorJson(502, message, 'upstream_error', details);
    }

    if (ct.includes('application/json')) {
      return Response.json(await res.json(), { status: res.status });
    }

    return HttpResponse.errorJson(502, 'Upstream returned non-JSON', 'upstream_non_json', { status: res.status });
  }

  /**
   * Return error response with Retry-After header forwarded if present
   */
  static errorWithRetryAfter(status, message, code, details, upstreamResponse) {
    const response = HttpResponse.errorJson(status, message, code, details);
    const retryAfter = upstreamResponse?.headers.get('Retry-After');
    if (!retryAfter) return response;

    const headers = new Headers(response.headers);
    headers.set('Retry-After', retryAfter);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  /**
   * Clone response and set X-Resolve-Cache header
   */
  static withResolveCacheStatus(response, status) {
    const cachedResponse = response.clone();
    const headers = new Headers(cachedResponse.headers);
    headers.set('X-Resolve-Cache', status);
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers
    });
  }
}

// Re-export convenience functions for backward compatibility
export const withCors = HttpResponse.withCors;
export const errorJson = HttpResponse.errorJson;
export const badRequest = HttpResponse.badRequest;
export const jsonUpstream = HttpResponse.jsonUpstream;
export const errorWithRetryAfter = HttpResponse.errorWithRetryAfter;
export const withResolveCacheStatus = HttpResponse.withResolveCacheStatus;
