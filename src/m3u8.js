/**
 * M3U8 playlist utilities for rewriting and transforming playlist URLs
 */

export function rewriteM3U8(content, request) {
  const base = new URL(request.url);
  base.search = '';

  return content
    .split('\n')
    .map(line => {
      if (
        line.startsWith('#') ||
        line.trim() === '' ||
        !line.startsWith('http')
      ) {
        return line;
      }
      let targetUrl = line;
      try {
        const parsed = new URL(line);
        if (parsed.searchParams.get('mode') === 'segment' && parsed.searchParams.has('url')) {
          targetUrl = parsed.searchParams.get('url');
        }
      } catch {}
      const u = new URL(base.toString());
      u.searchParams.set('mode', 'segment');
      u.searchParams.set('url', targetUrl);
      return u.toString();
    })
    .join('\n');
}
