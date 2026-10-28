// End-to-end smoke test: serves dist/, drives the app in headless Chromium with a fake camera feed
// (a looping y4m of a portrait), and checks capture -> analysis -> simulation -> plan -> save.
//
// Usage: node tests/e2e.mjs [--video path.y4m] [--photo path.jpg]
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Playwright may be installed globally (NODE_PATH); CommonJS resolution finds it either way.
const { chromium } = createRequire(import.meta.url)('playwright');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const outDir = join(root, 'tests', 'output');
const args = process.argv.slice(2);
const argOf = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const video = argOf('--video', process.env.E2E_VIDEO);
const photo = argOf('--photo', process.env.E2E_PHOTO);
const PORT = 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
};

function serve() {
  return new Promise((res) => {
    const server = createServer(async (req, resp) => {
      try {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        let file = join(dist, decodeURIComponent(url.pathname));
        if (!file.startsWith(dist)) throw new Error('bad path');
        if (!existsSync(file) || (await stat(file)).isDirectory()) file = join(dist, 'index.html');
        const body = await readFile(file);
        resp.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
        resp.end(body);
      } catch (e) {
        resp.writeHead(404);
        resp.end(String(e));
      }
    });
    server.listen(PORT, '127.0.0.1', () => res(server));
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  console.log(`  ok - ${msg}`);
}

async function main() {
  if (!existsSync(dist)) throw new Error('dist/ not found. Run `npm run build` first.');
  await mkdir(outDir, { recursive: true });
  const server = await serve();
  const launchArgs = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'];
  if (video) launchArgs.push(`--use-file-for-fake-video-capture=${resolve(video)}`);
  const browser = await chromium.launch({ args: launchArgs });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ['camera'],
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log(`  [browser ${m.type()}] ${m.text().slice(0, 300)}`);
  });

  console.log('1. Home screen + model load');
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.getByText('Face analysis model ready').waitFor({ timeout: 120000 });
  await page.screenshot({ path: join(outDir, '01-home.png') });
  assert(true, 'face landmarker loaded');

  console.log('2. Camera capture (fake device)');
  await page.getByTestId('quick-scan').click();
  await page.getByTestId('capture-screen').waitFor();
  const hint = page.getByTestId('capture-hint');
  await hint.waitFor({ timeout: 30000 });
  const seen = new Set();
  const t0 = Date.now();
  let detected = false;
  while (Date.now() - t0 < 20000) {
    const text = (await hint.textContent()) ?? '';
    seen.add(text);
    if (text !== 'Position your face in the oval' && text !== 'Starting camera…') detected = true;
    if (await page.getByTestId('analysis-photo').isVisible().catch(() => false)) break; // auto-captured
    if (detected && Date.now() - t0 > 2500) break;
    await page.waitForTimeout(250);
  }
  console.log(`  hints seen: ${[...seen].join(' | ')}`);
  await page.screenshot({ path: join(outDir, '02-capture.png') });
  if (video) assert(detected, 'face detected in the live camera feed');
  if (!(await page.getByTestId('analysis-photo').isVisible().catch(() => false))) {
    if (video) {
      await page.getByTestId('shutter').click();
    } else {
      // no camera feed: use the upload path
      await page.getByTestId('file-input').setInputFiles(resolve(photo));
    }
  }

  console.log('3. Analysis');
  await page.getByTestId('analysis-photo').waitFor({ timeout: 60000 });
  await page.waitForTimeout(600);
  const analysis = await page.evaluate(() => window.__jgLastAnalysis);
  assert(analysis && analysis.concerns.length === 15, `analysis produced ${analysis?.concerns?.length} concern scores`);
  console.log('  overall skin score:', analysis.overallSkin, '| tone:', analysis.skinTone);
  console.log('  scores:', analysis.concerns.map((c) => `${c.id}=${c.score}`).join(', '));
  console.log('  metrics:', JSON.stringify(Object.fromEntries(Object.entries(analysis.metrics).map(([k, v]) => [k, Math.round(v * 1000) / 1000]))));
  await page.screenshot({ path: join(outDir, '03-analysis-all.png') });
  for (const id of ['forehead_lines', 'nasolabial_folds', 'pigmentation', 'under_eye']) {
    await page.getByTestId(`score-${id}`).click();
    await page.waitForTimeout(200);
    await page.getByTestId('analysis-photo').screenshot({ path: join(outDir, `03-analysis-${id}.png`) });
  }
  await page.getByTestId('concern-detail').waitFor();
  assert(true, 'concern detail card shown');

  console.log('4. Simulator');
  await page.getByTestId('to-simulate').click();
  const canvas = page.getByTestId('sim-canvas');
  await canvas.waitFor();
  await page.waitForTimeout(800);
  const diffVs = async () =>
    page.evaluate(() => {
      const c = document.querySelector('[data-testid="sim-canvas"]');
      const img = document.querySelector('.sim-frame img.before');
      const w = c.width;
      const h = c.height;
      const a = document.createElement('canvas');
      a.width = w;
      a.height = h;
      const ctx = a.getContext('2d');
      ctx.drawImage(c, 0, 0);
      const A = ctx.getImageData(0, 0, w, h).data;
      ctx.drawImage(img, 0, 0, w, h);
      const B = ctx.getImageData(0, 0, w, h).data;
      let sum = 0;
      let changed = 0;
      for (let i = 0; i < A.length; i += 4) {
        const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
        sum += d;
        if (d > 24) changed++;
      }
      const n = A.length / 4;
      return { meanDiff: sum / n / 3, changedFrac: changed / n, w, h, nonBlack: A.some((v, i) => i % 4 !== 3 && v > 20) };
    });
  const base = await diffVs();
  console.log('  no-treatment render vs photo:', base);
  assert(base.nonBlack, 'simulator canvas rendered the photo');
  assert(base.meanDiff < 4, `identity render matches the photo (mean diff ${base.meanDiff.toFixed(2)} < 4)`);

  const applyBtn = page.getByTestId('apply-suggestions');
  if (await applyBtn.isVisible().catch(() => false)) {
    await applyBtn.click();
  }
  // make sure a representative set is on, whatever the suggestions were
  for (const id of ['neuromodulator', 'lip_filler', 'cheek_filler', 'chin_jaw_filler']) {
    await page.getByText('Injectables', { exact: true }).click();
    const card = page.getByTestId(`treat-${id}`);
    await card.waitFor();
    const sw = card.getByRole('switch');
    if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click();
  }
  await page.getByText('Skin treatments', { exact: true }).click();
  const peel = page.getByTestId('treat-chemical_peel').getByRole('switch');
  if ((await peel.getAttribute('aria-checked')) !== 'true') await peel.click();
  await page.waitForTimeout(500);
  const treated = await diffVs();
  console.log('  treated render vs photo:', treated);
  assert(treated.meanDiff > base.meanDiff + 0.3, `treatments change the render (mean diff ${treated.meanDiff.toFixed(2)})`);
  assert(treated.changedFrac < 0.6, `changes are localised (${(treated.changedFrac * 100).toFixed(1)}% of pixels changed)`);
  // drag the comparison slider fully to the "after" side for the screenshot
  const frame = page.getByTestId('sim-frame');
  const box = await frame.boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + 2, box.y + box.height * 0.5, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  await frame.screenshot({ path: join(outDir, '04-sim-after.png') });
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5 + 1);
  await page.mouse.up();
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(outDir, '04-sim-split.png'), fullPage: false });
  // side-by-side before/after for review
  await page.evaluate(() => {
    const c = document.querySelector('[data-testid="sim-canvas"]');
    const img = document.querySelector('.sim-frame img.before');
    const out = document.createElement('canvas');
    out.width = c.width * 2;
    out.height = c.height;
    const ctx = out.getContext('2d');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    ctx.drawImage(c, c.width, 0);
    window.__jgPair = out.toDataURL('image/jpeg', 0.9);
  });
  const pair = await page.evaluate(() => window.__jgPair);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(outDir, '04-before-after.jpg'), Buffer.from(pair.split(',')[1], 'base64'));

  console.log('5. Plan + save with a new client');
  await page.getByTestId('to-plan').click();
  await page.getByTestId('plan-total').waitFor();
  const total = await page.getByTestId('plan-total').textContent();
  console.log('  plan total:', total);
  await page.screenshot({ path: join(outDir, '05-plan.png'), fullPage: true });
  await page.getByTestId('save-consult').click(); // walk-in: goes to intake
  await page.getByLabel('First name *').fill('Test');
  await page.getByLabel('Last name').fill('Client');
  const checks = page.locator('label.check input[type=checkbox]');
  await checks.nth(0).check();
  await checks.nth(1).check();
  await page.getByTestId('save-client').click();
  await page.getByTestId('plan-total').waitFor();
  await page.getByTestId('save-consult').click();
  await page.getByTestId('start-consult').waitFor({ timeout: 20000 });
  await page.getByText('Skin score').first().waitFor();
  await page.screenshot({ path: join(outDir, '06-client-history.png'), fullPage: true });
  assert(true, 'consultation saved and listed under the client');

  console.log('6. Upload path');
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.getByText('Face analysis model ready').waitFor({ timeout: 120000 });
  await page.getByText('Test Client').first().waitFor();
  assert(true, 'client persisted across reload');
  await page.getByTestId('quick-scan').click();
  await page.getByTestId('capture-screen').waitFor();
  await page.getByTestId('file-input').setInputFiles(resolve(photo));
  await page.getByTestId('analysis-photo').waitFor({ timeout: 60000 });
  assert(true, 'uploaded photo analysed');

  assert(errors.length === 0, `no page errors (${errors.join('; ')})`);
  await browser.close();
  server.close();
  console.log('\nALL CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
