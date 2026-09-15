/**
 * PingClab 스모크 테스트
 *
 *   node test/smoke.mjs
 *
 * 빌드된 index.html 을 실제 브라우저에 띄워 홈 → 셋업 → 플래너까지
 * 핵심 흐름이 끊기지 않는지 확인한다.
 *
 * 외부 CDN 이 막힌 환경에서도 돌아가도록 React 만 node_modules 사본으로
 * 바꿔치기하고, 나머지 SDK(지도·Firebase·html2canvas)는 일부러 실패시킨다.
 * 그 상태에서도 앱이 살아있어야 한다 — 지연 로딩의 안전망을 함께 검증하는 셈이다.
 *
 * 크로미움 경로가 기본 위치가 아니면 PW_CHROMIUM 환경변수로 지정한다.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT));

const html = readFileSync(new URL('index.html', ROOT), 'utf8')
  .replace(/https:\/\/unpkg\.com\/react@18\/umd\/react\.production\.min\.js/g, '/vendor/react.js')
  .replace(/https:\/\/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js/g, '/vendor/react-dom.js');

const VENDOR = {
  '/vendor/react.js': 'node_modules/react/umd/react.production.min.js',
  '/vendor/react-dom.js': 'node_modules/react-dom/umd/react-dom.production.min.js',
};

const server = createServer((req, res) => {
  const vendor = VENDOR[req.url];
  if (vendor) {
    res.writeHead(200, { 'content-type': 'application/javascript' });
    res.end(read(vendor));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(10000);

const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => {
  // 차단된 외부 SDK 의 네트워크 실패는 기대된 동작이므로 무시한다
  if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) {
    errors.push('CONSOLE: ' + m.text());
  }
});

let failed = 0;
const step = async (name, fn) => {
  try { await fn(); console.log('  ✅ ' + name); }
  catch (e) { failed++; console.log('  ❌ ' + name + ' → ' + e.message.split('\n')[0]); }
};

await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
console.log('\n── PingClab 스모크 테스트 ──');

await step('JS 없이도 본문이 보인다 (SEO)', async () => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p2 = await ctx.newPage();
  await p2.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
  const len = (await p2.evaluate(() => document.body.innerText || '')).trim().length;
  const h2 = await p2.locator('h2').count();
  await ctx.close();
  if (len < 500 || h2 < 3) throw new Error(`본문 ${len}자 / h2 ${h2}개 — 정적 콘텐츠가 부족합니다`);
});

await step('React 마운트 후 홈 렌더', async () => {
  await page.waitForSelector('.city-card');
  const t = await page.textContent('.sec-title');
  if (!t.includes('이용방법')) throw new Error('홈 섹션 없음: ' + t);
});

await step('도시 카드 → 셋업 진입', async () => {
  await page.click('.city-card >> nth=0');
  await page.waitForSelector('.setup-title');
});

await step('기간 선택 → STEP 3', async () => {
  await page.click('.dur-card >> nth=1');
  await page.click('.btn-main');
  await page.waitForSelector('.setup-eyebrow');
  const t = await page.textContent('.setup-eyebrow');
  if (!t.includes('STEP 3')) throw new Error('STEP 3 아님: ' + t);
});

await step('일정 자동 생성 → 플래너 진입', async () => {
  await page.click('.btn-main');
  await page.waitForSelector('.day-card');
  if ((await page.locator('.slot-row').count()) < 4) throw new Error('슬롯 부족');
});

await step('첫 방문 온보딩 닫기', async () => {
  if (await page.locator('.onboard-skip').count()) {
    await page.click('.onboard-skip');
    await page.waitForSelector('.onboard-overlay', { state: 'detached' });
  }
});

await step('장소가 실제로 배치됨', async () => {
  const filled = (await page.locator('.slot-name').allTextContents()).filter(Boolean);
  if (filled.length < 3) throw new Error('채워진 슬롯 부족: ' + filled.length);
});

await step('예산 합계 계산됨', async () => {
  if (!/\d/.test(await page.textContent('.budget-total'))) throw new Error('예산 미계산');
});

await step('Day 탭 전환', async () => {
  await page.click('.day-tab >> nth=1');
  await page.waitForTimeout(300);
  if (!(await page.locator('.day-tab').nth(1)).isVisible) throw new Error('탭 없음');
});

await step('사이드바 장소 목록 렌더', async () => {
  if ((await page.locator('.place-card').count()) < 5) throw new Error('장소 카드 부족');
});

await step('외부 SDK 가 모두 실패해도 앱이 살아있다', async () => {
  if (!(await page.locator('.day-card').count())) throw new Error('플래너 사라짐');
  if (await page.locator('#error-display').isVisible()) throw new Error('에러 화면이 떴음');
});

if (errors.length) { failed++; console.log('\nJS 에러:', errors.slice(0, 8)); }
else console.log('\nJS 에러: 없음');

await browser.close();
server.close();
console.log(failed ? `\n❌ ${failed}건 실패` : '\n✅ 전부 통과');
process.exit(failed ? 1 : 0);
