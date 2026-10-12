/**
 * Configuration and constants for Athena Proxy
 */

export const UPSTREAM_DOMAINS = [
  'www.terabox.app',
  'terabox.app',
  'www.1024tera.com',
  '1024tera.com',
  'www.1024terabox.com',
  '1024terabox.com',
  'www.terabox.com',
  'terabox.com'
];

export const ALLOWED_SEGMENT_DOMAINS = [
  'terabox.com',
  'terabox.app',
  '1024tera.com',
  '1024terabox.com',
  'freeterabox.com',
  'teraboxcdn.com',
  'dm.terabox.app',
  'dm.1024tera.com',
  'terasharelink.com',
  'terafileshare.com',
  'teraboxlink.com',
  'teraboxshare.com',
  'terasharefile.com',
  'teraboxurl.com'
];

export const DEFAULT_JS_TOKEN = 'EF963D09A098AFE686EA6837292F7B077926BBAC31793D59B9C31846F75FAE22A64B007996B5DF222E4729DBB89106BD9088FE51AC6E5DCEA475FC6B1BEC5A5A17DEBC7677D2EF26D865A65F588A0E6303FAFD6463D1EFF1A4033E121803852F';

export const SHARE_STREAM_SIGNING_KEY = 'iuuPc64E4Fhn0rTXEzrnbLph0o5qyEEa';

export const RESOLVE_CACHE_TTL_MS = 15_000;
export const RESOLVE_FAILURE_COOLDOWN_MS = 30_000;
export const RESOLVE_CACHE_MAX_ENTRIES = 100;

export const SHARE_INFO_CACHE_TTL_MS = 60 * 60 * 1000;
export const SHARE_INFO_CACHE_MAX_ENTRIES = 200;

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
