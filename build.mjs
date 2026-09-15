/**
 * PingClab 빌드
 *
 *   src/_head.html + src/_style.html + src/_body.html  →  HTML 셸
 *   src/app.jsx                                        →  esbuild 로 JSX 변환·압축
 *   두 결과를 합쳐 배포용 index.html 한 장을 만든다.
 *
 *   실행:  npm run build
 *
 * 브라우저에서 Babel 로 JSX 를 변환하던 방식을 대체한다.
 * 덕분에 방문자는 2.9MB 짜리 Babel Standalone 을 내려받지 않는다.
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

const result = await build({
  entryPoints: ['src/app.jsx'],
  bundle: false,
  write: false,
  format: 'iife',
  target: 'es2019',
  jsx: 'transform',          // React.createElement 로 변환 (React 는 전역 UMD)
  minify: true,
  legalComments: 'none',
  charset: 'utf8',
});

// 인라인 <script> 안에서 문자열 안의 </script> 가 태그를 조기 종료시키지 않도록 escape
const app = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const html = read('./src/_head.html') + read('./src/_style.html') + read('./src/_body.html');
const out = html.replace('/*APP*/', () => app);

if (out === html) throw new Error('빌드 실패: /*APP*/ 자리표시자를 찾지 못했습니다.');

writeFileSync(new URL('./index.html', import.meta.url), out);

const kb = (n) => (n / 1024).toFixed(1) + 'KB';
console.log(`✅ index.html  ${kb(Buffer.byteLength(out))}  (앱 ${kb(Buffer.byteLength(app))})`);
