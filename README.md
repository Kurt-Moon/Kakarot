# PingClab — 일본 자유여행 플래너

도쿄·오사카·교토·후쿠오카·삿포로 134곳을 큐레이션해, 날짜만 넣으면
최적 동선 일정표를 자동으로 만들어 주는 웹 앱. https://pinkclab.com

## 구조

```
src/_head.html     <head> — 메타·구조화 데이터·폰트·React
src/_style.html    전체 CSS
src/_body.html     <body> 셸 — 정적 SEO 콘텐츠 + JSON-LD + 앱 자리표시자
src/app.jsx        React 앱 본체
src/guide.html     이용방법 가이드 (독립된 정적 페이지)
build.mjs          위 파일들로 index.html + guide.html 을 만드는 빌드
index.html         배포 산출물 (직접 고치지 말 것 — 빌드가 덮어쓴다)
guide.html         배포 산출물
robots.txt         색인 규칙 (공유 링크 ?plan= 은 제외)
sitemap.xml        색인 대상 URL
test/smoke.mjs     핵심 흐름 + SEO 스모크 테스트
```

## 개발

```bash
npm install
npm run build      # src/ → index.html
npm test           # 빌드된 index.html 을 브라우저로 검증
```

`index.html` 은 **빌드 산출물**이다. 고칠 곳은 항상 `src/` 다.
빌드를 거치지 않고 `index.html` 을 직접 수정하면 다음 빌드에서 사라진다.

## 성능 설계

JSX 는 브라우저가 아니라 **빌드 시점에** esbuild 로 변환한다.
예전에는 Babel Standalone(2.8MB)을 방문자마다 내려받아 2,500줄을
실시간 변환했다. 지금은 그 과정이 없다.

무거운 외부 SDK 는 `<head>` 에서 받지 않고, 필요한 순간에 불러온다
(`src/app.jsx` 상단의 지연 로더):

| SDK | 크기 | 로드 시점 |
|---|---|---|
| Google Maps | — | 플래너에 진입할 때 |
| Firebase (app+auth+firestore) | 494KB | 로그인·저장, 또는 `?plan=` 공유 링크로 들어왔을 때 |
| html2canvas | 194KB | 이미지로 내보낼 때 |
| Leaflet | — | 인스타 카드를 만들 때 |

랜딩만 보고 떠나는 방문자는 React(139KB)와 폰트 외에 아무것도 받지 않는다.

재방문자 판별에는 `localStorage` 의 `pinkclab_auth` 힌트를 쓴다.
로그인한 적 있는 사람만 Firebase 를 미리 불러온다.

## SEO 설계

`#root` 안의 정적 마크업은 **React 홈 화면과 같은 내용**이어야 한다.
크롤러가 JS 실행 없이 본문을 읽게 하고, 첫 화면이 JS 없이 즉시 그려지게
하려는 것이다. React 가 마운트되면 같은 내용으로 교체된다.

> `src/app.jsx` 의 홈 화면 문구를 고치면 `src/_body.html` 도 함께 고칠 것.
> 둘이 어긋나면 크롤러가 보는 내용과 사용자가 보는 내용이 달라진다.
> `npm test` 가 둘 다 확인한다.

구조화 데이터(JSON-LD)는 `src/_body.html` 하단에 있다.

### 이용방법 가이드

`/guide.html` 은 독립된 정적 페이지다. 예전에는 `window.open` +
`document.write` 로 띄우는 팝업이라 URL 이 없었고, 그래서 3,000자가 넘는
내용이 검색엔진에 전혀 잡히지 않았다. 지금은 홈에서 실제 `<a href>` 로
연결하고 사이트맵에도 넣는다.

9단계 본문에서 `HowTo`, FAQ 에서 `FAQPage` 구조화 데이터를 자동으로
생성한다 — 본문을 고치면 스키마도 같이 고칠 것.

## 키 관리

`GOOGLE_MAPS_KEY`(`src/app.jsx`)와 `FIREBASE_CONFIG` 는 클라이언트 키라
소스에 노출되는 것이 정상이다. 대신 다음이 반드시 걸려 있어야 한다.

- Google Cloud 콘솔 → 해당 키에 **HTTP 리퍼러 제한**(`pinkclab.com`)
- Firebase → **Firestore 보안 규칙**

제한이 풀리면 제3자가 키를 가져다 쓰고 과금이 발생한다.
