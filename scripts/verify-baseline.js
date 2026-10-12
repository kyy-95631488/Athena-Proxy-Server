import assert from 'node:assert/strict';
import worker, { Application, Router } from '../src/index.js';
import * as helpers from '../src/utils/helpers.js';
import { HttpResponse } from '../src/core/HttpResponse.js';
import { ShareRepository } from '../src/repositories/ShareRepository.js';
import { PlaylistService } from '../src/services/PlaylistService.js';
import { adminController } from '../src/controllers/AdminController.js';
import { resolveController } from '../src/controllers/ResolveController.js';
import { streamController } from '../src/controllers/StreamController.js';
import { downloadController } from '../src/controllers/DownloadController.js';
import { lookupController } from '../src/controllers/LookupController.js';
import { thumbnailController } from '../src/controllers/ThumbnailController.js';
import { legacyController } from '../src/controllers/LegacyController.js';

console.log('Testing clean OOP functionality...');

// 1. Helpers
assert.equal(helpers.normalizeSurl('1' + 'a'.repeat(22)), 'a'.repeat(22));
assert.equal(helpers.normalizeSurl('a'.repeat(22)), 'a'.repeat(22));
assert.equal(helpers.isValidSurl('1234567890'), true);
assert.equal(helpers.isValidSurl('short'), false);
assert.equal(helpers.extractJsToken('something fn("TOKEN123")'), 'TOKEN123');
assert.equal(helpers.findBetween('<a>hello</a>', '<a>', '</a>'), 'hello');

// 2. Repository static helper functions
assert.equal(ShareRepository.cleanShareTitle(null, [{ path: '/folder/file.mp4' }]), 'folder');
assert.equal(ShareRepository.normalizeFsId('12345.000'), '12345');

// 3. M3U8 rewrite service
const m3u8Sample = `#EXTM3U\n#EXTINF:10,\nhttps://example.com/segment.ts`;
const reqMock = new Request('https://proxy.test/?mode=stream&surl=test');
const rewritten = PlaylistService.rewriteM3U8(m3u8Sample, reqMock);
assert(rewritten.includes('mode=segment'));
assert(rewritten.includes('url=https%3A%2F%2Fexample.com%2Fsegment.ts'));

// 4. Worker routing tests
const envMock = { ADMIN_KEY: 'secret123' };

// OPTIONS
const optRes = await worker.fetch(new Request('https://proxy.test/', { method: 'OPTIONS' }), envMock);
assert.equal(optRes.status, 204);
assert.equal(optRes.headers.get('access-control-allow-origin'), '*');

// Root SPA shell
const rootRes = await worker.fetch(new Request('https://proxy.test/'), envMock);
assert.equal(rootRes.status, 200);
assert(rootRes.headers.get('content-type').includes('text/html'));

// Admin dashboard shell
const adminUiRes = await worker.fetch(new Request('https://proxy.test/admin'), envMock);
assert.equal(adminUiRes.status, 200);
assert(adminUiRes.headers.get('content-type').includes('text/html'));

// Healthcheck
const healthRes = await worker.fetch(new Request('https://proxy.test/?mode=health'), envMock);
assert.equal(healthRes.status, 200);
const healthJson = await healthRes.json();
assert.equal(healthJson.status, 'ok');

// Invalid mode
const invalidRes = await worker.fetch(new Request('https://proxy.test/?mode=nonexistent'), envMock);
assert.equal(invalidRes.status, 400);

// Admin unauthorized
const unauthRes = await worker.fetch(new Request('https://proxy.test/admin/overview'), envMock);
assert.equal(unauthRes.status, 401);

// Admin not found
const notFoundAdmin = await worker.fetch(new Request('https://proxy.test/admin/unknown?key=secret123'), envMock);
assert.equal(notFoundAdmin.status, 404);

// 5. D1 Mock tests with ShareRepository
const mockD1 = {
  queries: [],
  prepare(sql) {
    const query = { sql, binds: [] };
    return {
      bind(...args) {
        query.binds = args;
        return this;
      },
      async first() {
        mockD1.queries.push(query);
        if (sql.includes('COUNT(*) as total FROM shares')) return { total: 5 };
        if (sql.includes('SELECT * FROM shares WHERE share_id = ?')) return { share_id: 'abc', title: 'Test' };
        return null;
      },
      async all() {
        mockD1.queries.push(query);
        return { results: [] };
      },
      async run() {
        mockD1.queries.push(query);
        return { success: true };
      }
    };
  },
  async batch(statements) {
    mockD1.queries.push({ batch: statements.length });
    return statements.map(() => ({ success: true }));
  }
};

const repo = new ShareRepository(mockD1);
await repo.saveShare('share123', { title: 'My Share', uk: 1234, list: [] });
assert(mockD1.queries.length > 0);

await repo.saveMediaFile('share123', { fs_id: '999', server_filename: 'video.mp4', thumbs: { url3: 'http://thumb' } });
assert(mockD1.queries.length > 1);

const fetchedShare = await repo.getShareFromDb('abc');
assert.equal(fetchedShare.share_id, 'abc');

// 6. Admin endpoints with mock D1 and mock KV
const mockKvStore = new Map();
const mockKv = {
  async get(key, options) {
    const val = mockKvStore.get(key);
    if (!val) return null;
    return options?.type === 'json' ? JSON.parse(val) : val;
  },
  async put(key, val, options) {
    mockKvStore.set(key, typeof val === 'string' ? val : JSON.stringify(val));
    return true;
  },
  async delete(key) {
    mockKvStore.delete(key);
    return true;
  }
};

const adminEnv = { ADMIN_KEY: 'secret123', sharedfile: mockD1, SHARE_KV: mockKv };
const overviewRes = await worker.fetch(new Request('https://proxy.test/admin/overview?key=secret123'), adminEnv);
assert.equal(overviewRes.status, 200);
const overviewJson = await overviewRes.json();
assert.equal(overviewJson.counts.shares, 5);
assert.equal(overviewJson.kv.enabled, true);

// KV health check test
const healthRes2 = await worker.fetch(new Request('https://proxy.test/?mode=health'), adminEnv);
assert.equal(healthRes2.status, 200);
const healthJson2 = await healthRes2.json();
assert.equal(healthJson2.storage.d1, true);
assert.equal(healthJson2.storage.kv, true);

// 7. Controller verification
assert(typeof adminController.handleAdminOverview === 'function');
assert(typeof adminController.handleAdminKvStats === 'function');
assert(typeof resolveController.handleResolve === 'function');
assert(typeof streamController.handleStream === 'function');
assert(typeof streamController.handleSegment === 'function');
assert(typeof downloadController.handleDownload === 'function');
assert(typeof lookupController.handleLookup === 'function');
assert(typeof thumbnailController.handleThumbnail === 'function');
assert(typeof legacyController.handlePage === 'function');
assert(typeof legacyController.handleApi === 'function');

console.log('All clean OOP tests passed successfully!');
