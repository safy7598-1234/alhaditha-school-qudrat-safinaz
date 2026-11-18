import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDevPreviewOrigin,
  normalizeCustomPublicUrl,
  resolvePublicOrigin,
  selectBestPublicOrigin,
  buildShareLink,
  buildWhatsAppShareUrl,
  classifyLinkCheckResult
} from './shareUrl';

test('resolvePublicOrigin converts private ais-dev host to public ais-pre host', () => {
  const devOrigin = 'https://ais-dev-fmmiqch7ketn5rcxnizpky-230333526947.europe-west2.run.app';
  const expected = 'https://ais-pre-fmmiqch7ketn5rcxnizpky-230333526947.europe-west2.run.app';
  assert.equal(isDevPreviewOrigin(devOrigin), true);
  assert.equal(resolvePublicOrigin(devOrigin), expected);
});

test('resolvePublicOrigin preserves deployed Cloud Run or custom origins', () => {
  const prodOrigin = 'https://ais-pre-fmmiqch7ketn5rcxnizpky-230333526947.europe-west2.run.app/';
  assert.equal(isDevPreviewOrigin(prodOrigin), false);
  assert.equal(
    resolvePublicOrigin(prodOrigin),
    'https://ais-pre-fmmiqch7ketn5rcxnizpky-230333526947.europe-west2.run.app'
  );
});

test('resolvePublicOrigin prioritizes customPublicUrl and sanitizes ais-dev custom URLs', () => {
  const devOrigin = 'https://ais-dev-fmmiqch7ketn5rcxnizpky-230333526947.europe-west2.run.app';
  assert.equal(
    resolvePublicOrigin(devOrigin, 'qudurat.alhaditha.edu.sa/'),
    'https://qudurat.alhaditha.edu.sa'
  );
  assert.equal(
    normalizeCustomPublicUrl(devOrigin),
    'https://ais-pre-fmmiqch7ketn5rcxnizpky-230333526947.europe-west2.run.app'
  );
});

test('buildShareLink creates clean root, section, and leaderboard deep-links', () => {
  const base = 'https://ais-pre-fmmiqch7ketn5rcxnizpky-230333526947.europe-west2.run.app';
  assert.equal(buildShareLink(base), `${base}/`);
  assert.equal(buildShareLink(base, { sectionId: 'all' }), `${base}/`);
  assert.equal(buildShareLink(base, { sectionId: 'sec_3' }), `${base}/?section=sec_3`);
  assert.equal(buildShareLink(base, { view: 'leaderboard' }), `${base}/?view=leaderboard`);
});

test('buildWhatsAppShareUrl encodes link and academic supervisor credit properly', () => {
  const link = 'https://ais-pre-fmmiqch7ketn5rcxnizpky-230333526947.europe-west2.run.app/?section=sec_1';
  const waUrl = buildWhatsAppShareUrl(link, 'القسم الأول');
  assert.ok(waUrl.startsWith('https://api.whatsapp.com/send?text='));
  assert.ok(decodeURIComponent(waUrl).includes(link));
  assert.ok(decodeURIComponent(waUrl).includes('مدارس الحديثة الأهلية للتفوق في القدرات'));
  assert.ok(decodeURIComponent(waUrl).includes('إعداد المشرفة الأكاديمية: أ/ صافيناز عبدالعزيز'));
});

test('classifyLinkCheckResult detects 404, cookie_check, and live links', () => {
  assert.deepEqual(
    classifyLinkCheckResult(404, null, 'ais-pre-abc.europe-west2.run.app'),
    { live: false, code: 'not_published_404', status: 404 }
  );
  assert.deepEqual(
    classifyLinkCheckResult(302, '/__cookie_check.html', 'ais-pre-abc.europe-west2.run.app'),
    { live: false, code: 'private_dev', status: 302 }
  );
  assert.deepEqual(
    classifyLinkCheckResult(200, null, 'ais-dev-abc.europe-west2.run.app'),
    { live: false, code: 'private_dev', status: 200 }
  );
  assert.deepEqual(
    classifyLinkCheckResult(200, null, 'ais-pre-abc.europe-west2.run.app'),
    { live: true, code: 'ok', status: 200 }
  );
});

test('selectBestPublicOrigin returns permanent origin when in dev preview', () => {
  const devOrigin = 'https://ais-dev-fmmiqch7ketn5rcxnizpky-230333526947.europe-west2.run.app';
  assert.equal(
    selectBestPublicOrigin({ currentOrigin: devOrigin }),
    'https://ais-pre-fmmiqch7ketn5rcxnizpky-230333526947.europe-west2.run.app'
  );
  assert.equal(
    selectBestPublicOrigin({
      currentOrigin: devOrigin,
      customPublicUrl: 'https://qudurat.alhaditha.edu.sa/'
    }),
    'https://qudurat.alhaditha.edu.sa'
  );
});
