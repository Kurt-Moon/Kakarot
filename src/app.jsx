const { useState, useEffect, useRef, useCallback } = React;

/* ═══════════════════════════════════════════════
   Firebase 설정 (firebase.google.com → 프로젝트 설정)
   비워두면 로컬 모드로 동작합니다.
═══════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCS5fY_tp_3Ii0kAj_f9tJPTKMjDxskjJc",
  authDomain:        "itineli-84a72.firebaseapp.com",
  projectId:         "itineli-84a72",
  storageBucket:     "itineli-84a72.firebasestorage.app",
  messagingSenderId: "68384675657",
  appId:             "1:68384675657:web:e4df25636bd3fccd022c98",
  measurementId:     "G-97069QMERD",
};
/* ═══════════════════════════════════════════════
   지연 로더 (Lazy SDK loader)

   무거운 외부 SDK 를 <head> 에서 미리 받지 않고, 실제로 필요한 순간에
   내려받는다. 첫 방문자(대부분 랜딩만 보고 떠난다)는 아무것도 받지 않는다.
═══════════════════════════════════════════════ */
const _scriptCache = {};
function loadScript(src){
  if(_scriptCache[src]) return _scriptCache[src];
  _scriptCache[src] = new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=src; s.async=true;
    s.onload=()=>resolve();
    s.onerror=()=>{ delete _scriptCache[src]; reject(new Error('스크립트 로드 실패: '+src)); };
    document.head.appendChild(s);
  });
  return _scriptCache[src];
}

/* ── Google Maps (플래너 진입 시) ── */
const GOOGLE_MAPS_KEY = 'AIzaSyCidH4vALKdix_8DCFMJy6AbTZJwxsni7c';
let _gmPromise = null;
function ensureGoogleMaps(){
  if(_gmPromise) return _gmPromise;
  if(!GOOGLE_MAPS_KEY){ _gmPromise = Promise.resolve(null); return _gmPromise; }
  _gmPromise = new Promise(resolve=>{
    const lang=(navigator.language||'ko').split('-')[0];
    const mapLang={ko:'ko',en:'en',ja:'ja',zh:'zh-CN',fr:'fr',de:'de'}[lang]||'ko';
    window.__gmReady=()=>resolve(window.google?.maps||null);
    loadScript('https://maps.googleapis.com/maps/api/js?key='+GOOGLE_MAPS_KEY+
               '&language='+mapLang+'&libraries=places&loading=async&callback=__gmReady')
      .catch(()=>resolve(null));
  });
  return _gmPromise;
}

/* ── html2canvas (이미지 내보내기 시) ── */
function ensureHtml2Canvas(){
  if(window.html2canvas) return Promise.resolve(window.html2canvas);
  return loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
    .then(()=>window.html2canvas);
}

/* ── Leaflet (인스타 카드 지도 폴백) ── */
function ensureLeaflet(){
  if(window.L) return Promise.resolve(window.L);
  if(!document.querySelector('link[href*="leaflet"]')){
    const lc=document.createElement('link');
    lc.rel='stylesheet'; lc.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(lc);
  }
  return loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js').then(()=>window.L);
}

/* ── Firebase (로그인 / 저장 / 공유 링크 열람 시) ── */
const FIREBASE_SDK = [
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js',
];
const AUTH_HINT_KEY = 'pinkclab_auth';   // 재방문 시 Firebase 를 미리 띄울지 판단하는 힌트
let _fbApp = null, _fbPromise = null;
function ensureFirebase(){
  if(_fbPromise) return _fbPromise;
  _fbPromise = (async()=>{
    if(!FIREBASE_CONFIG.apiKey) return null;
    try{
      for(const url of FIREBASE_SDK) await loadScript(url);   // app → auth → firestore 순서 유지
      _fbApp = firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(FIREBASE_CONFIG);
    }catch(e){ console.warn('Firebase 로드 실패',e); }
    return _fbApp;
  })();
  return _fbPromise;
}
const getAuth = () => _fbApp ? firebase.auth()      : null;
const getDB   = () => _fbApp ? firebase.firestore() : null;

/* ─────────────── BRAND ─────────────── */
const BRAND = {
  name:   'PingClab',
  domain: 'pinkclab.com',
  color:  '#FF6B9D',
};

/* ─────────────── DATA ─────────────── */

const CITIES = [
  { id:'tokyo', name:'도쿄', country:'일본', emoji:'🗼', currency:'JPY',
    agodaCity:'61413', skyscannerCode:'TYO',
    image:'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=75',
    center:{lat:35.6762,lng:139.6503},
    areas:['시부야','신주쿠','아사쿠사','하라주쿠','오다이바','롯폰기','긴자','우에노'],
    transport:{
      3:{ rec:'🚇 스이카(IC카드)', note:'도쿄 내 3일 이하는 IC카드가 경제적. 편의점·카페 결제까지 가능.', klook:'suica-card' },
      7:{ rec:'🚆 JR 도쿄 와이드패스', note:'7일 권장. 닛코·가마쿠라·가와구치코 포함 ¥15,000.', klook:'jr-tokyo-wide-pass' },
    },
    hotel:{ budget:8000, moderate:18000, luxury:45000 },
    insuranceKlook:'travel-insurance-japan',
  },
  { id:'osaka', name:'오사카', country:'일본', emoji:'🏯', currency:'JPY',
    agodaCity:'6027',skyscannerCode:'OSA',
    image:'https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=600&q=75',
    center:{lat:34.6937,lng:135.5023},
    areas:['난바','신사이바시','우메다','텐노지','오사카성','베이'],
    transport:{
      3:{ rec:'🎫 오사카 주유패스 1일권', note:'주요 관광지 35곳 무료 입장 + 지하철 무제한. ¥2,800/일.', klook:'osaka-amazing-pass' },
      7:{ rec:'🚇 ICOCA(IC카드)', note:'7일 이상 장기 체류는 IC카드가 실용적.', klook:'icoca-card' },
    },
    hotel:{ budget:7000, moderate:15000, luxury:35000 },
    insuranceKlook:'travel-insurance-japan',
  },
  { id:'kyoto', name:'교토', country:'일본', emoji:'⛩️', currency:'JPY',
    agodaCity:'6031',skyscannerCode:'UKY',
    image:'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=600&q=75',
    center:{lat:35.0116,lng:135.7681},
    areas:['아라시야마','기온','후시미','니조성','교토역','기타노'],
    transport:{
      3:{ rec:'🚌 버스 1일권 ¥700', note:'교토 시내버스 무제한 + IC카드 병행. 1일권은 관내에서 구매.', klook:'kyoto-bus-pass' },
    },
    hotel:{ budget:9000, moderate:20000, luxury:50000 },
    insuranceKlook:'travel-insurance-japan',
  },
  { id:'fukuoka', name:'후쿠오카', country:'일본', emoji:'🍜', currency:'JPY',
    agodaCity:'7936',skyscannerCode:'FUK',
    image:'https://images.unsplash.com/photo-1480796927426-f609979314bd?w=600&q=75',
    center:{lat:33.5904,lng:130.4017},
    areas:['텐진','하카타','나카스','오호리 공원','다자이후'],
    transport:{
      3:{ rec:'🚇 스고카(SUGOCA)', note:'후쿠오카 소도시라 IC카드면 충분. 하카타↔텐진 약 200엔.', klook:'sugoca-card' },
    },
    hotel:{ budget:6000, moderate:12000, luxury:28000 },
    insuranceKlook:'travel-insurance-japan',
  },
  { id:'sapporo', name:'삿포로', country:'일본', emoji:'⛄', currency:'JPY',
    agodaCity:'6026',skyscannerCode:'CTS',
    image:'https://images.unsplash.com/photo-1478436127897-769e1b3f0f36?w=600&q=75',
    center:{lat:43.0618,lng:141.3545},
    areas:['스스키노','오도리','마루야마','오타루'],
    transport:{
      3:{ rec:'🚇 지하철 1일권 ¥830', note:'삿포로 지하철 무제한. 오타루 방문 시 JR 왕복(¥1,260) 별도 구매.', klook:'sapporo-subway-pass' },
    },
    hotel:{ budget:7000, moderate:14000, luxury:32000 },
    insuranceKlook:'travel-insurance-japan',
  },
];

const WEATHER_DB = {
  tokyo:[
    {icon:'❄️',note:'맑고 건조, 추위 대비 필수'},
    {icon:'❄️',note:'건조하고 맑음, 가끔 눈'},
    {icon:'🌸',note:'벚꽃 시즌 시작 (3월 하순~4월 초)'},
    {icon:'🌸',note:'벚꽃 만개, 최적의 봄 날씨'},
    {icon:'🌤️',note:'따뜻하고 화창, 여행 최적기'},
    {icon:'🌧️',note:'장마 시즌 (6월 중순~7월 초)'},
    {icon:'☀️',note:'고온다습, 자외선 차단 필수'},
    {icon:'☀️',note:'무더위 지속, 수분 보충 필수'},
    {icon:'⛈️',note:'태풍 주의, 맑은 날도 있음'},
    {icon:'🍁',note:'단풍 시즌, 쾌적한 날씨'},
    {icon:'🍂',note:'단풍 절정, 선선하고 맑음'},
    {icon:'❄️',note:'건조하고 맑음, 연말 분위기'},
  ],
  osaka:[
    {icon:'🌤️',note:'건조하고 맑음, 추위 대비'},
    {icon:'🌤️',note:'서울보다 따뜻, 간간이 비'},
    {icon:'🌸',note:'벚꽃 시즌 시작 (도쿄보다 빠름)'},
    {icon:'🌸',note:'벚꽃 만개, 최고의 봄'},
    {icon:'🌤️',note:'쾌적하고 화창'},
    {icon:'🌧️',note:'장마, 비 오는 날 많음'},
    {icon:'☀️',note:'도쿄보다 더 습하고 더움'},
    {icon:'☀️',note:'폭염, 저녁 야외 길거리 음식 추천'},
    {icon:'⛈️',note:'태풍 + 장마 잔재'},
    {icon:'🍁',note:'단풍 시즌, 맑고 쾌적'},
    {icon:'🍂',note:'단풍 절정, 일교차 큼'},
    {icon:'❄️',note:'연말 일루미네이션 시즌'},
  ],
  kyoto:[
    {icon:'❄️',note:'가끔 눈, 조용하고 한적'},
    {icon:'🌤️',note:'추위 대비, 관광객 적어 한적'},
    {icon:'🌸',note:'벚꽃 명소 최고 시즌 시작'},
    {icon:'🌸',note:'벚꽃 만개 — 극혼잡 예상'},
    {icon:'🌤️',note:'신록이 아름다운 시즌'},
    {icon:'🌧️',note:'장마, 비 속 사찰도 운치 있음'},
    {icon:'☀️',note:'무더위, 이른 아침 관광 추천'},
    {icon:'☀️',note:'대로·사찰 그늘길 활용 필수'},
    {icon:'⛈️',note:'태풍 주의'},
    {icon:'🍁',note:'단풍 시즌 시작'},
    {icon:'🍁',note:'단풍 절정 — 극혼잡 예상'},
    {icon:'❄️',note:'눈 덮인 사찰 장관'},
  ],
  fukuoka:[
    {icon:'🌤️',note:'서울보다 따뜻, 겨울 최고기온 10°C'},
    {icon:'🌤️',note:'온화한 겨울'},
    {icon:'🌸',note:'벚꽃 일찍 핌 (도쿄보다 1주 빠름)'},
    {icon:'🌸',note:'봄 최적기, 야타이 야외 식사 좋음'},
    {icon:'🌤️',note:'쾌적한 봄'},
    {icon:'🌧️',note:'장마 일찍 시작'},
    {icon:'☀️',note:'더위, 바다 근처라 바람 있음'},
    {icon:'☀️',note:'무더위, 저녁 야타이 추천'},
    {icon:'⛈️',note:'태풍 영향 많음'},
    {icon:'🍁',note:'여행 최적기, 한적함'},
    {icon:'🍂',note:'단풍, 낙엽 아름다움'},
    {icon:'🌤️',note:'온화한 초겨울, 굴 제철'},
  ],
  sapporo:[
    {icon:'❄️',note:'스키 시즌, 폭설 대비 필수'},
    {icon:'❄️',note:'눈 축제 메인 시즌 (2월 초)'},
    {icon:'🌨️',note:'눈이 남아있음, 서서히 봄 준비'},
    {icon:'🌸',note:'벚꽃 (4월 하순~5월 초)'},
    {icon:'🌸',note:'벚꽃 + 라벤더 시즌 시작'},
    {icon:'🌤️',note:'시원한 초여름, 라벤더 절정'},
    {icon:'☀️',note:'맑고 시원, 삿포로 맥주 축제!'},
    {icon:'☀️',note:'일본 최고의 여름 피서지'},
    {icon:'🍁',note:'단풍 시즌 (9월 중순~10월 초)'},
    {icon:'🍂',note:'단풍 절정, 초설 가능'},
    {icon:'🌨️',note:'초겨울, 눈 준비 시작'},
    {icon:'❄️',note:'스키 시즌 시작, 설경 장관'},
  ],
};

const CAT_EMOJI = {spot:'📍',food:'🍽️',cafe:'☕',shopping:'🛍️',nightview:'🌃',hotel:'🏨'};
const CAT_LABEL = {spot:'관광',food:'맛집',cafe:'카페',shopping:'쇼핑',nightview:'야경',hotel:'숙소'};
const AMBER='#f59e0b';
const CAT_COLOR = {spot:'#3b82f6',food:AMBER,cafe:'#22c55e',shopping:'#ec4899',nightview:'#8b5cf6',hotel:'#0ea5e9'};

const PLACES_DB = {
  tokyo:[
    {id:'tok1',name:'시부야 스크램블 교차로',category:'spot',area:'시부야',lat:35.6595,lng:139.7004,duration:40,cost:0,bookable:false,hours:'24시간',closed:[],tip:'낮보다 저녁 6~8시가 최고 포토타임. 스타벅스 2층 창가석은 오전 8시 이전에 선점.',tags:['인생샷','무료','SNS'],klook:''},
    {id:'tok2',name:'메이지 신궁',category:'spot',area:'시부야',lat:35.6763,lng:139.6993,duration:70,cost:0,bookable:false,hours:'06:00~17:30',closed:[],tip:'이른 아침 방문이 최고. 삼나무 숲이 도심 속 별세계.',tags:['무료','산책','힐링'],klook:''},
    {id:'tok3',name:'시부야 스카이',category:'nightview',area:'시부야',lat:35.6580,lng:139.7024,duration:60,cost:2000,bookable:true,hours:'09:00~23:00',closed:[],tip:'해질녘 입장이 황금타임. 클룩 사전예약이 현장보다 저렴.',tags:['야경','전망대','인생샷'],klook:'shibuya-sky-observatory'},
    {id:'tok4',name:'다이칸야마 츠타야',category:'cafe',area:'시부야',lat:35.6490,lng:139.7035,duration:75,cost:1200,bookable:false,hours:'07:00~23:00',closed:[],tip:'세계 최고 서점 중 하나. 스타벅스와 결합.',tags:['감성','카페','서점'],klook:''},
    {id:'tok5',name:'하라주쿠 타케시타 거리',category:'shopping',area:'하라주쿠',lat:35.6701,lng:139.7025,duration:60,cost:0,bookable:false,hours:'10:00~20:00',closed:[],tip:'크레이프·솜사탕 길거리 음식 천국.',tags:['쇼핑','길거리 음식'],klook:''},
    {id:'tok6',name:'오모테산도 힐즈',category:'shopping',area:'하라주쿠',lat:35.6652,lng:139.7083,duration:90,cost:0,bookable:false,hours:'11:00~21:00',closed:[1],tip:'안도 타다오 설계 나선형 쇼핑몰. 월요일 휴관.',tags:['쇼핑','건축','명품'],klook:''},
    {id:'tok7',name:'요요기 공원',category:'spot',area:'시부야',lat:35.6715,lng:139.6951,duration:60,cost:0,bookable:false,hours:'05:00~20:00',closed:[],tip:'도쿄 최대 도심 숲 공원.',tags:['무료','공원','산책'],klook:''},
    {id:'tok8',name:'신주쿠 교엔',category:'spot',area:'신주쿠',lat:35.6851,lng:139.7100,duration:90,cost:500,bookable:false,hours:'09:00~16:30',closed:[1],tip:'월요일 휴관. 벚꽃 4월 초순 절정.',tags:['공원','산책','벚꽃'],klook:''},
    {id:'tok9',name:'오모이데요코초',category:'food',area:'신주쿠',lat:35.6933,lng:139.7002,duration:60,cost:2500,bookable:false,hours:'17:00~00:00',closed:[],tip:'신주쿠역 서쪽 야키토리 거리. 현지 직장인 단골.',tags:['야식','현지인 맛집'],klook:''},
    {id:'tok10',name:'가부키초 & 골든가이',category:'nightview',area:'신주쿠',lat:35.6959,lng:139.7036,duration:60,cost:0,bookable:false,hours:'18:00~새벽',closed:[],tip:'아시아 최대 번화가. 골든가이는 1~2평 바 200개 이상.',tags:['야경','바','네온'],klook:''},
    {id:'tok11',name:'신주쿠 이세탄 백화점',category:'shopping',area:'신주쿠',lat:35.6921,lng:139.7040,duration:90,cost:0,bookable:false,hours:'10:00~20:00',closed:[3],tip:'수요일 휴관. B1층 식품관이 진짜 볼거리.',tags:['쇼핑','백화점'],klook:''},
    {id:'tok12',name:'이치란 라멘 신주쿠',category:'food',area:'신주쿠',lat:35.6926,lng:139.7007,duration:45,cost:1200,bookable:false,hours:'24시간',closed:[],tip:'개인 칸막이 1인 식사. 24시간 운영.',tags:['라멘','혼밥'],menu:['특선 라멘 ¥980'],klook:''},
    {id:'tok13',name:'아사쿠사 센소지',category:'spot',area:'아사쿠사',lat:35.7148,lng:139.7967,duration:80,cost:0,bookable:false,hours:'06:00~17:00',closed:[],tip:'오전 6시 이전 방문 시 관광객 없어 조용하고 환상적.',tags:['무료','역사','인생샷'],klook:''},
    {id:'tok14',name:'나카미세 기념품 거리',category:'shopping',area:'아사쿠사',lat:35.7133,lng:139.7968,duration:40,cost:0,bookable:false,hours:'10:00~18:00',closed:[],tip:'250m 기념품 거리. 센소지 방문과 세트로.',tags:['기념품','쇼핑'],klook:''},
    {id:'tok15',name:'도쿄 스카이트리',category:'nightview',area:'아사쿠사',lat:35.7101,lng:139.8107,duration:90,cost:3400,bookable:true,hours:'10:00~21:00',closed:[],tip:'634m 세계 2위 전파탑. 오전 10시 개장 직후가 대기 없음.',tags:['전망대','야경'],klook:'tokyo-skytree'},
    {id:'tok16',name:'우에노 공원',category:'spot',area:'우에노',lat:35.7156,lng:139.7731,duration:70,cost:0,bookable:false,hours:'05:00~23:00',closed:[],tip:'봄 벚꽃 시즌 도쿄 최대 명소.',tags:['무료','공원','벚꽃'],klook:''},
    {id:'tok17',name:'아메요코 시장',category:'food',area:'우에노',lat:35.7087,lng:139.7744,duration:50,cost:1500,bookable:false,hours:'10:00~20:00',closed:[],tip:'전후 암시장에서 시작한 200개 점포 상설시장.',tags:['시장','쇼핑','먹거리'],klook:''},
    {id:'tok18',name:'아사히 슈퍼드라이홀',category:'food',area:'아사쿠사',lat:35.7103,lng:139.8008,duration:60,cost:2000,bookable:false,hours:'11:30~22:00',closed:[1],tip:'월요일 휴무. 스미다 강변 전망 레스토랑.',tags:['맥주','저녁'],klook:''},
    {id:'tok19',name:'츠키지 시장 조식',category:'food',area:'긴자',lat:35.6654,lng:139.7707,duration:60,cost:2500,bookable:false,hours:'05:00~14:00',closed:[0,3],tip:'일·수요일 일부 휴무. 오전 6~8시가 가장 활기참.',tags:['조식','해산물','시장'],menu:['참치 덮밥 ¥1,800~'],klook:'tsukiji-market'},
    {id:'tok20',name:'팀랩 플래닛',category:'spot',area:'오다이바',lat:35.6293,lng:139.7756,duration:120,cost:4200,bookable:true,hours:'10:00~21:00',closed:[],tip:'반바지·치마 착용 필수. 클룩 예약이 현장보다 저렴.',tags:['인생샷','체험','디지털아트'],klook:'teamlab-planets'},
    {id:'tok21',name:'오다이바 해변공원',category:'spot',area:'오다이바',lat:35.6270,lng:139.7759,duration:60,cost:0,bookable:false,hours:'24시간',closed:[],tip:'레인보우 브릿지와 미니 자유의 여신상 무료 포토스팟.',tags:['무료','야경','인생샷'],klook:''},
    {id:'tok22',name:'롯폰기힐스 전망대',category:'nightview',area:'롯폰기',lat:35.6604,lng:139.7292,duration:70,cost:2000,bookable:true,hours:'10:00~23:00',closed:[1],tip:'화요일 휴관. 52층 전망대.',tags:['야경','미술관'],klook:'mori-art-museum'},
    {id:'tok23',name:'아키하바라 전자상가',category:'shopping',area:'아키하바라',lat:35.6985,lng:139.7731,duration:90,cost:0,bookable:false,hours:'10:00~20:00',closed:[],tip:'가전·피규어·애니 굿즈 성지. 면세 쇼핑 필수.',tags:['쇼핑','애니','전자제품'],klook:''},
    {id:'tok24',name:'나카메구로 강변 산책',category:'cafe',area:'시부야',lat:35.6425,lng:139.6981,duration:90,cost:1000,bookable:false,hours:'24시간',closed:[],tip:'봄 벚꽃 시즌 도쿄 최고 산책로.',tags:['산책','카페','감성'],klook:''},
    {id:'tok25',name:'하마리큐 정원',category:'spot',area:'긴자',lat:35.6595,lng:139.7625,duration:60,cost:300,bookable:false,hours:'09:00~17:00',closed:[],tip:'도쿄만 배경의 에도시대 정원.',tags:['정원','역사','산책'],klook:''},
    {id:'tok26',name:'도요스 시장 견학',category:'food',area:'오다이바',lat:35.6454,lng:139.7851,duration:90,cost:0,bookable:false,hours:'05:00~17:00',closed:[0,3],tip:'일·수요일 휴장. 시장 내 초밥집이 진짜.',tags:['시장','조식','참치'],klook:'toyosu-market'},
    {id:'tok27',name:'긴자 거리',category:'shopping',area:'긴자',lat:35.6717,lng:139.7660,duration:75,cost:0,bookable:false,hours:'11:00~21:00',closed:[],tip:'일본 최고 명품거리. 주말 낮엔 보행자 천국.',tags:['쇼핑','명품'],klook:''},
    {id:'tok28',name:'도쿄 국립박물관',category:'spot',area:'우에노',lat:35.7188,lng:139.7762,duration:90,cost:1000,bookable:false,hours:'09:30~17:00',closed:[1],tip:'월요일 휴관. 세계 최대 일본미술 컬렉션.',tags:['박물관','역사','문화'],klook:''},
    {id:'tok29',name:'도쿄 타워',category:'nightview',area:'롯폰기',lat:35.6586,lng:139.7454,duration:60,cost:1800,bookable:false,hours:'09:00~23:00',closed:[],tip:'도쿄 심볼. 레트로 야경 감성.',tags:['야경','전망대'],klook:'tokyo-tower'},
    {id:'tok30',name:'스타벅스 리저브 롯폰기',category:'cafe',area:'롯폰기',lat:35.6651,lng:139.7302,duration:50,cost:1000,bookable:false,hours:'08:00~22:00',closed:[],tip:'도쿄 럭셔리 스타벅스.',tags:['카페','감성'],klook:''},
    {id:'tok31',name:'시모키타자와',category:'shopping',area:'시모키타자와',lat:35.6613,lng:139.6677,duration:90,cost:0,bookable:false,hours:'11:00~21:00',closed:[],tip:'빈티지·인디밴드의 성지. 매주 주말 길거리 공연.',tags:['빈티지','인디'],klook:''},
    {id:'tok32',name:'이노카시라 공원',category:'spot',area:'기치조지',lat:35.7020,lng:139.5754,duration:75,cost:0,bookable:false,hours:'24시간',closed:[],tip:'기치조지역 10분. 보트 대여 가능. 봄 벚꽃 최고.',tags:['공원','벚꽃'],klook:''},
    {id:'tok33',name:'요코하마 차이나타운',category:'food',area:'요코하마',lat:35.4432,lng:139.6445,duration:120,cost:3000,bookable:false,hours:'11:00~22:00',closed:[],tip:'도쿄역에서 JR 30분. 중화 딤섬.',tags:['맛집','당일치기'],klook:'yokohama-chinatown'},
    {id:'tok34',name:'신오쿠보 코리아타운',category:'food',area:'신오쿠보',lat:35.7011,lng:139.6994,duration:60,cost:2500,bookable:false,hours:'11:00~22:00',closed:[],tip:'떡볶이·순대 등 한국 길거리 음식 천국.',tags:['한국음식','길거리음식'],klook:''},
    {id:'tok35',name:'지유가오카 스위츠 거리',category:'cafe',area:'지유가오카',lat:35.6077,lng:139.6670,duration:75,cost:2000,bookable:false,hours:'10:00~20:00',closed:[],tip:'디저트·카페 거리. 몽블랑 발상지.',tags:['디저트','카페'],klook:''},
    {id:'tok36',name:'도쿄 디즈니랜드',category:'spot',area:'마이하마',lat:35.6329,lng:139.8803,duration:480,cost:9400,bookable:true,hours:'09:00~21:00',closed:[],tip:'클룩 사전 예매 필수.',tags:['테마파크','가족'],klook:'tokyo-disneyland'},
    {id:'tok37',name:'에비스 가든플레이스',category:'nightview',area:'에비스',lat:35.6447,lng:139.7134,duration:50,cost:0,bookable:false,hours:'24시간',closed:[],tip:'야경 명소. 삿포로 맥주 박물관 인접.',tags:['야경','무료'],klook:''},
    {id:'tok38',name:'가구라자카 골목',category:'spot',area:'가구라자카',lat:35.7005,lng:139.7432,duration:60,cost:0,bookable:false,hours:'24시간',closed:[],tip:'교토 같은 이시다타타미 골목길.',tags:['산책','전통','감성'],klook:''},
    {id:'tok39',name:'오다이바 건담 베이스',category:'spot',area:'오다이바',lat:35.6259,lng:139.7749,duration:30,cost:0,bookable:false,hours:'10:00~21:00',closed:[],tip:'실물 크기 유니콘 건담. 무료 포토스팟.',tags:['무료','인생샷'],klook:''},
    {id:'tok40',name:'야나카 긴자 상점가',category:'shopping',area:'야나카',lat:35.7258,lng:139.7659,duration:60,cost:1000,bookable:false,hours:'10:00~19:00',closed:[1],tip:'월요일 일부 휴무. 1950년대 레트로 상점가.',tags:['레트로','쇼핑'],klook:''},
    {id:'tok41',name:'도쿄 돔 시티',category:'spot',area:'분쿄',lat:35.7056,lng:139.7519,duration:120,cost:0,bookable:false,hours:'10:00~21:00',closed:[],tip:'야구 경기 없을 때도 관람차·놀이기구 운영.',tags:['놀이공원','가족'],klook:'tokyo-dome-city'},
    {id:'tok42',name:'하마초 리버워크',category:'cafe',area:'하마초',lat:35.6842,lng:139.7895,duration:60,cost:1200,bookable:false,hours:'08:00~21:00',closed:[],tip:'스미다 강변 감성 카페 거리.',tags:['카페','강변'],klook:''},
    {id:'tok43',name:'진보초 고서점 거리',category:'spot',area:'진보초',lat:35.6958,lng:139.7574,duration:60,cost:0,bookable:false,hours:'10:00~19:00',closed:[0],tip:'일요일 일부 휴무. 세계 최대 고서점 밀집.',tags:['서점','문화'],klook:''},
    {id:'tok44',name:'다카시마야 타임즈스퀘어',category:'shopping',area:'신주쿠',lat:35.6884,lng:139.7005,duration:90,cost:0,bookable:false,hours:'10:00~20:30',closed:[],tip:'신주쿠역 남쪽. 지하 식품관 필수.',tags:['쇼핑','백화점'],klook:''},
    {id:'tok45',name:'메이지 진구 가이엔',category:'spot',area:'아오야마',lat:35.6773,lng:139.7177,duration:50,cost:0,bookable:false,hours:'24시간',closed:[],tip:'11월 은행나무 단풍 명소.',tags:['은행나무','단풍','무료'],klook:''},
    {id:'tok46',name:'마루노우치 나카도리',category:'shopping',area:'마루노우치',lat:35.6800,lng:139.7650,duration:50,cost:0,bookable:false,hours:'11:00~21:00',closed:[],tip:'도쿄역 서쪽 쇼핑 거리. 계절 일루미네이션.',tags:['쇼핑','야경'],klook:''},
    {id:'tok47',name:'시부야 히카리에',category:'shopping',area:'시부야',lat:35.6588,lng:139.7026,duration:60,cost:0,bookable:false,hours:'10:00~21:00',closed:[],tip:'시부야역 직결. 8층 전망 레스토랑 뷰.',tags:['쇼핑','전망'],klook:''},
    {id:'tok48',name:'아자부다이 힐즈',category:'spot',area:'롯폰기',lat:35.6588,lng:139.7427,duration:60,cost:0,bookable:false,hours:'10:00~21:00',closed:[],tip:'2023년 개장 도쿄 최신 랜드마크.',tags:['명소','신개발'],klook:''},
    {id:'tok49',name:'이케부쿠로 선샤인시티',category:'shopping',area:'이케부쿠로',lat:35.7298,lng:139.7192,duration:90,cost:0,bookable:false,hours:'10:00~21:00',closed:[],tip:'전망대+수족관+쇼핑 복합단지.',tags:['쇼핑','가족'],klook:''},
    {id:'tok50',name:'아메야요코초 야시장',category:'food',area:'우에노',lat:35.7087,lng:139.7744,duration:45,cost:1800,bookable:false,hours:'10:00~20:00',closed:[0,3],tip:'일·수요일 일부 휴무. 저녁 야시장 분위기.',tags:['야시장','먹거리'],klook:''},
  ],
  osaka:[
    {id:'osa1',name:'도톤보리',category:'spot',area:'난바',lat:34.6687,lng:135.5013,duration:90,cost:0,bookable:false,hours:'24시간',closed:[],tip:'글리코상 야경 — 저녁 7시 이후 최적. 운하 건너편 계단에서.',tags:['인생샷','무료','야경'],klook:''},
    {id:'osa2',name:'호젠지 요코초',category:'spot',area:'난바',lat:34.6677,lng:135.5026,duration:30,cost:0,bookable:false,hours:'24시간',closed:[],tip:'이끼 덮인 불상과 좁은 골목. 도톤보리에서 2분.',tags:['숨겨진명소','무료','감성'],klook:''},
    {id:'osa3',name:'에비스바시 거리',category:'shopping',area:'신사이바시',lat:34.6717,lng:135.5010,duration:60,cost:0,bookable:false,hours:'10:00~21:00',closed:[],tip:'도톤보리~신사이바시 연결 쇼핑거리.',tags:['쇼핑','면세'],klook:''},
    {id:'osa4',name:'신사이바시 아케이드',category:'shopping',area:'신사이바시',lat:34.6730,lng:135.5010,duration:90,cost:0,bookable:false,hours:'11:00~21:00',closed:[],tip:'600m 아케이드. 비 와도 OK.',tags:['쇼핑','아케이드'],klook:''},
    {id:'osa5',name:'쿠로몬 시장',category:'food',area:'난바',lat:34.6653,lng:135.5070,duration:60,cost:2000,bookable:false,hours:'09:00~18:00',closed:[0],tip:'일요일 일부 휴무. 오사카의 부엌.',tags:['시장','해산물'],menu:['가리비 구이 ¥200','참치 회 ¥600'],klook:'kuromon-market'},
    {id:'osa6',name:'다루마 쿠시카츠',category:'food',area:'난바',lat:34.6627,lng:135.5005,duration:45,cost:1500,bookable:false,hours:'11:00~22:30',closed:[],tip:'소스 두 번 찍기 절대 금지.',tags:['현지 맛집','쿠시카츠'],menu:['모듬 쿠시카츠 ¥1,200'],klook:''},
    {id:'osa7',name:'551호라이 부타만',category:'food',area:'난바',lat:34.6654,lng:135.5020,duration:20,cost:500,bookable:false,hours:'10:00~21:00',closed:[],tip:'오사카 명물 찐 돼지고기 만두.',tags:['간식','기념품'],menu:['부타만 ¥230/개'],klook:''},
    {id:'osa8',name:'아메리카무라',category:'shopping',area:'신사이바시',lat:34.6739,lng:135.4970,duration:60,cost:0,bookable:false,hours:'11:00~20:00',closed:[],tip:'오사카 힙스터의 성지. 빈티지·스트리트 브랜드.',tags:['빈티지','쇼핑'],klook:''},
    {id:'osa9',name:'우메다 스카이빌딩',category:'nightview',area:'우메다',lat:34.7053,lng:135.4896,duration:70,cost:1500,bookable:true,hours:'09:30~22:30',closed:[],tip:'일몰 1시간 전 입장 시 낮+야경 동시 감상.',tags:['야경','전망대','인생샷'],klook:'umeda-sky-building'},
    {id:'osa10',name:'헵 파이브 관람차',category:'nightview',area:'우메다',lat:34.7022,lng:135.4960,duration:30,cost:600,bookable:false,hours:'11:00~23:00',closed:[],tip:'빨간 관람차. 우메다 야경 감상.',tags:['야경','관람차'],klook:''},
    {id:'osa11',name:'그랑프론트 오사카',category:'shopping',area:'우메다',lat:34.7040,lng:135.4972,duration:90,cost:0,bookable:false,hours:'10:00~21:00',closed:[],tip:'우메다역 바로 위 대형 쇼핑몰.',tags:['쇼핑'],klook:''},
    {id:'osa12',name:'오사카성',category:'spot',area:'오사카성',lat:34.6873,lng:135.5262,duration:90,cost:600,bookable:true,hours:'09:00~17:00',closed:[],tip:'천수각 8층 전망대. 벚꽃 절경.',tags:['역사','전망','벚꽃'],klook:'osaka-castle'},
    {id:'osa13',name:'아베노 하루카스',category:'nightview',area:'텐노지',lat:34.6459,lng:135.5135,duration:70,cost:1800,bookable:true,hours:'09:00~22:00',closed:[],tip:'일본 최고층 빌딩 300m.',tags:['야경','전망대'],klook:'abeno-harukas'},
    {id:'osa14',name:'텐노지 동물원',category:'spot',area:'텐노지',lat:34.6516,lng:135.5068,duration:90,cost:500,bookable:false,hours:'09:30~17:00',closed:[1],tip:'월요일 휴관.',tags:['가족','동물원'],klook:''},
    {id:'osa15',name:'시텐노지',category:'spot',area:'텐노지',lat:34.6544,lng:135.5161,duration:50,cost:300,bookable:false,hours:'08:30~16:30',closed:[],tip:'일본 최고 오래된 사원.',tags:['역사','사찰'],klook:''},
    {id:'osa16',name:'유니버설 스튜디오 재팬',category:'spot',area:'베이',lat:34.6654,lng:135.4323,duration:300,cost:8600,bookable:true,hours:'09:00~21:00',closed:[],tip:'슈퍼 닌텐도 월드·해리포터 인기. 클룩 사전 구매 필수.',tags:['테마파크','체험','가족'],klook:'universal-studios-japan'},
    {id:'osa17',name:'도톤보리 리버크루즈',category:'nightview',area:'난바',lat:34.6688,lng:135.5015,duration:30,cost:1500,bookable:true,hours:'14:00~21:00',closed:[],tip:'글리코상 야경을 수상에서. 저녁 7시 이후.',tags:['야경','체험','크루즈'],klook:'dotonbori-river-cruise'},
    {id:'osa18',name:'오사카 아쿠아리움',category:'spot',area:'베이',lat:34.6541,lng:135.4277,duration:120,cost:2700,bookable:true,hours:'10:00~20:00',closed:[],tip:'고래상어가 메인.',tags:['아쿠아리움','가족'],klook:'osaka-aquarium'},
    {id:'osa19',name:'텐포잔 대관람차',category:'nightview',area:'베이',lat:34.6540,lng:135.4282,duration:20,cost:900,bookable:false,hours:'10:00~22:00',closed:[],tip:'아쿠아리움 옆. 야간 LED 조명.',tags:['관람차','야경'],klook:''},
    {id:'osa20',name:'난카이 도리카이',category:'food',area:'난바',lat:34.6667,lng:135.4997,duration:50,cost:1500,bookable:false,hours:'11:00~22:00',closed:[],tip:'현지인 타코야키·야키토리 거리.',tags:['타코야키','현지 맛집'],menu:['타코야키 8개 ¥600'],klook:''},
  ,
    {id:'osa21',name:'신세카이',category:'nightview',area:'텐노지',lat:34.6521,lng:135.5065,duration:60,cost:0,bookable:false,hours:'24시간',closed:[],tip:'빌리켄 행운 동상. 1920년대 레트로 분위기.',tags:['레트로','야경','무료'],klook:''},
    {id:'osa22',name:'츠루하시 한인타운',category:'food',area:'텐노지',lat:34.6649,lng:135.5274,duration:75,cost:2500,bookable:false,hours:'10:00~20:00',closed:[0],tip:'일요일 일부 휴무. 오사카 속 코리아타운.',tags:['한국음식','야키니쿠'],klook:''},
    {id:'osa23',name:'나카자키초 카페 거리',category:'cafe',area:'우메다',lat:34.7106,lng:135.5047,duration:60,cost:1500,bookable:false,hours:'11:00~20:00',closed:[1],tip:'월요일 일부 휴무. 오사카 힙스터 감성 거리.',tags:['레트로','카페','감성'],klook:''},
    {id:'osa24',name:'스미요시 타이샤',category:'spot',area:'스미요시',lat:34.6123,lng:135.4931,duration:50,cost:0,bookable:false,hours:'06:00~17:00',closed:[],tip:'일본 3대 스미요시 신사. 독특한 아치형 다리.',tags:['신사','역사','무료'],klook:''},
    {id:'osa25',name:'도자이요코초 술집 골목',category:'food',area:'난바',lat:34.6656,lng:135.5019,duration:45,cost:2000,bookable:false,hours:'17:00~24:00',closed:[],tip:'도톤보리 뒷골목 현지인 선술집 거리.',tags:['이자카야','야식'],klook:''},
    {id:'osa26',name:'오사카 나카노시마',category:'spot',area:'우메다',lat:34.6923,lng:135.5022,duration:40,cost:0,bookable:false,hours:'24시간',closed:[],tip:'두 강 사이 도심 섬. 장미 공원 봄 명소.',tags:['산책','공원','무료'],klook:''},
    {id:'osa27',name:'루쿠아 오사카',category:'shopping',area:'우메다',lat:34.7045,lng:135.4976,duration:75,cost:0,bookable:false,hours:'10:00~21:00',closed:[],tip:'오사카역 직결. B2 식품관이 볼거리.',tags:['쇼핑','백화점'],klook:''},
    {id:'osa28',name:'난바 야사카 신사',category:'spot',area:'난바',lat:34.6614,lng:135.4987,duration:25,cost:0,bookable:false,hours:'24시간',closed:[],tip:'거대 사자 얼굴 본전. 인생샷 명소.',tags:['인생샷','신사','무료'],klook:''},
    {id:'osa29',name:'엑스포시티',category:'shopping',area:'외곽',lat:34.8055,lng:135.5229,duration:90,cost:0,bookable:false,hours:'10:00~21:00',closed:[2],tip:'수요일 휴무. 오사카 최대 쇼핑몰.',tags:['쇼핑','가족'],klook:''},
    {id:'osa30',name:'도톤보리 글리코 광장',category:'spot',area:'난바',lat:34.6687,lng:135.5013,duration:30,cost:0,bookable:false,hours:'24시간',closed:[],tip:'글리코상 아래 계단이 오사카 최고 포토스팟.',tags:['인생샷','무료','SNS'],klook:''},
  ],
  kyoto:[
    {id:'kyo1',name:'아라시야마 대나무 숲',category:'spot',area:'아라시야마',lat:35.0170,lng:135.6725,duration:60,cost:0,bookable:false,hours:'24시간',closed:[],tip:'오전 6~7시 방문 시 관광객 없어 환상적.',tags:['무료','인생샷'],klook:''},
    {id:'kyo2',name:'텐류지',category:'spot',area:'아라시야마',lat:35.0168,lng:135.6716,duration:60,cost:500,bookable:false,hours:'08:30~17:30',closed:[],tip:'세계유산 선종 사원. 가레산스이 정원이 압권.',tags:['세계유산','정원','역사'],klook:''},
    {id:'kyo3',name:'도게츠교 다리',category:'spot',area:'아라시야마',lat:35.0130,lng:135.6791,duration:30,cost:0,bookable:false,hours:'24시간',closed:[],tip:'단풍 시즌(11월) 절경.',tags:['무료','인생샷','단풍'],klook:''},
    {id:'kyo4',name:'기온 거리',category:'spot',area:'기온',lat:35.0037,lng:135.7752,duration:90,cost:0,bookable:false,hours:'24시간',closed:[],tip:'저녁 6~8시 마이코 출몰. 사진은 허락 필수.',tags:['무료','전통','인생샷'],klook:''},
    {id:'kyo5',name:'야사카 신사',category:'spot',area:'기온',lat:34.9946,lng:135.7784,duration:40,cost:0,bookable:false,hours:'24시간',closed:[],tip:'기온 거리 끝 무료 신사. 야간 조명 아름다움.',tags:['무료','야경','신사'],klook:''},
    {id:'kyo6',name:'철학자의 길',category:'spot',area:'기온',lat:35.0270,lng:135.7902,duration:60,cost:0,bookable:false,hours:'24시간',closed:[],tip:'약 2km 벚꽃 산책로.',tags:['무료','산책','벚꽃'],klook:''},
    {id:'kyo7',name:'난젠지',category:'spot',area:'기온',lat:35.0117,lng:135.7924,duration:60,cost:500,bookable:false,hours:'08:40~17:00',closed:[],tip:'수로각이 독특한 포토 포인트.',tags:['역사','사찰'],klook:''},
    {id:'kyo8',name:'후시미 이나리 신사',category:'spot',area:'후시미',lat:34.9671,lng:135.7727,duration:120,cost:0,bookable:false,hours:'24시간',closed:[],tip:'만 개의 붉은 도리이 터널. 일출 방문이 최고.',tags:['무료','인생샷','하이킹'],klook:'fushimi-inari'},
    {id:'kyo9',name:'킨카쿠지 (금각사)',category:'spot',area:'기타노',lat:35.0394,lng:135.7292,duration:60,cost:500,bookable:false,hours:'09:00~17:00',closed:[],tip:'개장 직후 9시가 관광객 가장 적음.',tags:['역사','인생샷'],klook:'kinkakuji'},
    {id:'kyo10',name:'니죠성',category:'spot',area:'니조성',lat:35.0142,lng:135.7481,duration:75,cost:1030,bookable:false,hours:'08:45~17:00',closed:[1],tip:'화요일 휴관. 꾀꼬리 마루 체험 추천.',tags:['역사','세계유산'],klook:''},
    {id:'kyo11',name:'니시키 시장',category:'food',area:'기온',lat:35.0047,lng:135.7650,duration:60,cost:1500,bookable:false,hours:'10:00~18:00',closed:[],tip:'400년 역사 교토의 부엌.',tags:['시장','교토요리'],menu:['두부 꼬치 ¥200','우나기 ¥1,500'],klook:'nishiki-market'},
    {id:'kyo12',name:'교토 카페 이노다',category:'cafe',area:'기온',lat:35.0020,lng:135.7670,duration:50,cost:1100,bookable:false,hours:'07:00~18:00',closed:[],tip:'1940년대 창업 교토의 상징 카페.',tags:['감성 카페','노포'],menu:['아라비아 진주 커피 ¥770'],klook:''},
    {id:'kyo13',name:'기요미즈데라',category:'spot',area:'기온',lat:34.9948,lng:135.7850,duration:75,cost:400,bookable:false,hours:'06:00~18:00',closed:[],tip:'목재 무못 본당 무대 전망 압권. 오전 8시 전 추천.',tags:['세계유산','역사','전망'],klook:'kiyomizudera'},
    {id:'kyo14',name:'산주산겐도',category:'spot',area:'후시미',lat:34.9882,lng:135.7742,duration:50,cost:600,bookable:false,hours:'08:00~17:00',closed:[],tip:'1001체 관음상. 120m 복도.',tags:['역사','절'],klook:''},
    {id:'kyo15',name:'기온 야마모토 멘바',category:'food',area:'기온',lat:35.0035,lng:135.7765,duration:45,cost:1200,bookable:false,hours:'11:30~14:00',closed:[3],tip:'수요일 휴무. 교토식 유바 라멘.',tags:['라멘','현지인 맛집'],menu:['유바 라멘 ¥1,100'],klook:''},
  ,
    {id:'kyo16',name:'야사카노토 오중탑',category:'spot',area:'기온',lat:34.9978,lng:135.7781,duration:25,cost:0,bookable:false,hours:'24시간',closed:[],tip:'산넨자카 부근. 교토 대표 야경 포토스팟.',tags:['인생샷','무료','야경'],klook:''},
    {id:'kyo17',name:'사가노 트롯코 열차',category:'spot',area:'아라시야마',lat:35.0163,lng:135.6722,duration:90,cost:1200,bookable:true,hours:'09:00~17:00',closed:[3],tip:'수요일 운행 없음. 클룩 예약 필수.',tags:['기차','단풍','가족'],klook:'sagano-scenic-railway'},
    {id:'kyo18',name:'교토 고쇼',category:'spot',area:'니조성',lat:35.0254,lng:135.7620,duration:60,cost:0,bookable:false,hours:'09:00~17:00',closed:[1],tip:'월요일 휴관. 구 왕궁. 무료 입장.',tags:['역사','무료','정원'],klook:''},
    {id:'kyo19',name:'아라시야마 자전거 투어',category:'spot',area:'아라시야마',lat:35.0107,lng:135.6777,duration:120,cost:1500,bookable:false,hours:'09:00~18:00',closed:[],tip:'대나무숲~도게츠교 자전거로.',tags:['자전거','힐링','활동'],klook:''},
    {id:'kyo20',name:'후시미 사케 거리',category:'food',area:'후시미',lat:34.9461,lng:135.7729,duration:60,cost:1800,bookable:false,hours:'10:00~17:00',closed:[],tip:'후시미 이나리 인근. 양조장 시음 투어.',tags:['술','문화','시음'],klook:''},
  ],
  fukuoka:[
    {id:'fuk1',name:'야타이 포장마차 거리',category:'food',area:'나카스',lat:33.5886,lng:130.4025,duration:90,cost:3000,bookable:false,hours:'18:00~01:00',closed:[],tip:'비 오면 대부분 운영 안 함. 나카스강변 150개 야타이.',tags:['현지 경험','야식','포장마차'],menu:['하카타 라멘 ¥800','나카스 꼬치 ¥150/개'],klook:''},
    {id:'fuk2',name:'오호리 공원',category:'spot',area:'오호리 공원',lat:33.5874,lng:130.3793,duration:60,cost:0,bookable:false,hours:'05:00~22:00',closed:[],tip:'대형 호수 중심 공원. 아침 조깅 코스.',tags:['무료','산책','공원'],klook:''},
    {id:'fuk3',name:'다자이후 텐만구',category:'spot',area:'다자이후',lat:33.5202,lng:130.5348,duration:90,cost:0,bookable:false,hours:'06:00~19:00',closed:[],tip:'하카타역에서 니시테츠 40분. 학업의 신.',tags:['역사','무료','당일치기'],klook:'dazaifu'},
    {id:'fuk4',name:'후쿠오카 타워',category:'nightview',area:'텐진',lat:33.5993,lng:130.3532,duration:50,cost:800,bookable:false,hours:'09:30~22:00',closed:[],tip:'서일본 최고층 전파탑 234m. 하카타만 야경.',tags:['야경','전망대'],klook:''},
    {id:'fuk5',name:'캐널시티 하카타',category:'shopping',area:'하카타',lat:33.5897,lng:130.4133,duration:90,cost:0,bookable:false,hours:'10:00~21:00',closed:[],tip:'수로 흐르는 복합 쇼핑몰. 라멘 스타디움.',tags:['쇼핑','무료구경','라멘'],klook:''},
    {id:'fuk6',name:'잇푸도 라멘 본점',category:'food',area:'텐진',lat:33.5928,lng:130.3998,duration:40,cost:900,bookable:false,hours:'11:00~24:00',closed:[],tip:'하카타 본점 감성. 시로마루 추천.',tags:['라멘','본점'],menu:['시로마루 모토미 ¥890'],klook:''},
    {id:'fuk7',name:'모츠나베 오오야마',category:'food',area:'텐진',lat:33.5921,lng:130.3993,duration:70,cost:2500,bookable:true,hours:'17:00~23:00',closed:[1],tip:'월요일 휴무. 하카타 특선 곱창전골.',tags:['저녁','현지 맛집','모츠나베'],menu:['모츠나베 ¥1,650/인'],klook:''},
    {id:'fuk8',name:'하카타역 & 아뮤플라자',category:'shopping',area:'하카타',lat:33.5896,lng:130.4200,duration:60,cost:0,bookable:false,hours:'10:00~21:00',closed:[],tip:'후쿠오카 최대 쇼핑·교통 허브.',tags:['쇼핑','기차역'],klook:''},
    {id:'fuk9',name:'우미노나카미치 해변공원',category:'spot',area:'외곽',lat:33.6490,lng:130.4410,duration:120,cost:450,bookable:false,hours:'09:00~17:30',closed:[1],tip:'월요일 휴관. 동물원+식물원+해변.',tags:['가족','자연','해변'],klook:''},
    {id:'fuk10',name:'마리노아 시티 아울렛',category:'shopping',area:'외곽',lat:33.5763,lng:130.3424,duration:120,cost:0,bookable:false,hours:'10:00~20:00',closed:[],tip:'후쿠오카 최대 아울렛.',tags:['아울렛','쇼핑'],klook:''},
    {id:'fuk11',name:'하카타 해산물 시장',category:'food',area:'하카타',lat:33.5931,lng:130.4105,duration:60,cost:2000,bookable:false,hours:'09:00~18:00',closed:[0],tip:'일요일 휴무. 성게·굴·회 직매.',tags:['해산물','시장'],klook:''},
    {id:'fuk12',name:'나카스 강변 야경 산책',category:'nightview',area:'나카스',lat:33.5895,lng:130.4010,duration:40,cost:0,bookable:false,hours:'24시간',closed:[],tip:'야타이 불빛 반영이 아름다움. 무료.',tags:['무료','야경','산책'],klook:''},
  ,
    {id:'fuk13',name:'야나가와 뱃놀이',category:'spot',area:'야나가와',lat:33.1662,lng:130.4046,duration:180,cost:1800,bookable:true,hours:'09:00~17:00',closed:[],tip:'후쿠오카역에서 특급 40분. 뱃사공 노래와 수로 여행.',tags:['당일치기','체험','감성'],klook:'yanagawa-boat'},
    {id:'fuk14',name:'이토시마 해변',category:'spot',area:'외곽',lat:33.5605,lng:130.1908,duration:120,cost:0,bookable:false,hours:'24시간',closed:[],tip:'후쿠오카에서 JR 40분. 에메랄드 바다.',tags:['해변','자연','인생샷'],klook:''},
    {id:'fuk15',name:'하카타 포트 타워',category:'nightview',area:'하카타',lat:33.5935,lng:130.4021,duration:40,cost:0,bookable:false,hours:'10:00~22:00',closed:[],tip:'하카타 항구 야경 무료 전망대.',tags:['야경','무료','전망'],klook:''},
    {id:'fuk16',name:'마린월드 수족관',category:'spot',area:'외곽',lat:33.6497,lng:130.4415,duration:120,cost:2400,bookable:true,hours:'09:30~17:30',closed:[],tip:'돌고래쇼 유명. 우미노나카미치 공원 인접.',tags:['수족관','가족','돌고래'],klook:''},
    {id:'fuk17',name:'후쿠오카 시립박물관',category:'spot',area:'사와라구',lat:33.5978,lng:130.3465,duration:60,cost:200,bookable:false,hours:'09:30~17:30',closed:[1],tip:'월요일 휴관. 금인(金印) 진품 전시.',tags:['역사','박물관'],klook:''},
  ],
  sapporo:[
    {id:'sap1',name:'오도리 공원',category:'spot',area:'오도리',lat:43.0596,lng:141.3519,duration:40,cost:0,bookable:false,hours:'24시간',closed:[],tip:'겨울=눈 축제, 여름=맥주 가든.',tags:['무료','공원'],klook:''},
    {id:'sap2',name:'JR 타워 전망대 T38',category:'nightview',area:'오도리',lat:43.0688,lng:141.3493,duration:50,cost:740,bookable:false,hours:'10:00~23:00',closed:[],tip:'삿포로역 직결 38층 전망대.',tags:['야경','전망대'],klook:''},
    {id:'sap3',name:'홋카이도 대학 은행나무 길',category:'spot',area:'오도리',lat:43.0757,lng:141.3401,duration:50,cost:0,bookable:false,hours:'24시간',closed:[],tip:'10월 말~11월 초 황금빛 은행나무 380m.',tags:['무료','인생샷','단풍'],klook:''},
    {id:'sap4',name:'삿포로 맥주 박물관',category:'spot',area:'오도리',lat:43.0712,lng:141.3665,duration:60,cost:0,bookable:false,hours:'11:00~18:00',closed:[1],tip:'월요일 휴관. 무료 관람 + 시음 유료.',tags:['체험','맥주'],klook:'sapporo-beer-museum'},
    {id:'sap5',name:'모이와야마 로프웨이',category:'nightview',area:'마루야마',lat:43.0227,lng:141.3102,duration:75,cost:2100,bookable:true,hours:'10:30~22:00',closed:[],tip:'삿포로 야경 NO.1. 일몰 전 출발 추천.',tags:['야경','전망대','로프웨이'],klook:'moiwa-ropeway'},
    {id:'sap6',name:'니조 시장 카이센동',category:'food',area:'스스키노',lat:43.0565,lng:141.3526,duration:60,cost:2500,bookable:false,hours:'07:00~17:00',closed:[0],tip:'일요일 일부 휴무. 게·연어알·성게 해산물 덮밥.',tags:['조식','해산물','시장'],menu:['카이센동 ¥1,800~'],klook:''},
    {id:'sap7',name:'스스키노 미소라멘',category:'food',area:'스스키노',lat:43.0546,lng:141.3546,duration:40,cost:1000,bookable:false,hours:'11:00~21:00',closed:[3],tip:'수요일 휴무. 버터·콘 토핑 삿포로 정통.',tags:['라멘','명물'],menu:['미소 버터콘 라멘 ¥950'],klook:''},
    {id:'sap8',name:'오타루 운하',category:'spot',area:'오타루',lat:43.1907,lng:140.9946,duration:180,cost:0,bookable:false,hours:'24시간',closed:[],tip:'JR 삿포로에서 35분. 유리공예·오르골 기념품.',tags:['당일치기','인생샷','무료'],klook:''},
    {id:'sap9',name:'징기스칸 양고기',category:'food',area:'스스키노',lat:43.0543,lng:141.3561,duration:70,cost:2800,bookable:false,hours:'17:00~23:30',closed:[],tip:'홋카이도 특산 양고기 철판 구이.',tags:['저녁','홋카이도명물'],menu:['양고기 모듬 ¥2,500'],klook:''},
    {id:'sap10',name:'홋카이도 신사',category:'spot',area:'마루야마',lat:43.0573,lng:141.3194,duration:50,cost:0,bookable:false,hours:'06:00~17:00',closed:[],tip:'마루야마 공원 인접. 벚꽃 시즌 4월 하순.',tags:['무료','신사','산책'],klook:''},
    {id:'sap11',name:'삿포로 팩토리',category:'shopping',area:'오도리',lat:43.0673,lng:141.3601,duration:75,cost:0,bookable:false,hours:'10:00~20:00',closed:[],tip:'맥주 공장 리모델링 쇼핑몰.',tags:['쇼핑','복합문화'],klook:''},
    {id:'sap12',name:'노르베사 대관람차',category:'nightview',area:'스스키노',lat:43.0561,lng:141.3527,duration:20,cost:700,bookable:false,hours:'11:00~23:00',closed:[],tip:'스스키노 옥상 관람차. 네온사인 조망.',tags:['야경','관람차'],klook:''},
    {id:'sap13',name:'시로이 코이비토 파크',category:'spot',area:'니시구',lat:43.0825,lng:141.2953,duration:75,cost:800,bookable:false,hours:'10:00~18:00',closed:[3],tip:'수요일 휴관. 홋카이도 명과 초콜릿 테마파크.',tags:['체험','기념품'],klook:''},
    {id:'sap14',name:'마루야마 동물원',category:'spot',area:'마루야마',lat:43.0542,lng:141.3138,duration:90,cost:800,bookable:false,hours:'09:00~17:00',closed:[3],tip:'수요일 휴관. 홋카이도 동물 특히 유명.',tags:['동물원','가족'],klook:''},
    {id:'sap15',name:'후라노 라벤더 밭',category:'spot',area:'후라노',lat:43.3500,lng:142.3833,duration:240,cost:0,bookable:false,hours:'24시간',closed:[],tip:'삿포로에서 JR 2시간. 7~8월 라벤더 절정.',tags:['라벤더','당일치기','인생샷'],klook:''},
    {id:'sap16',name:'오타루 유리공예 체험',category:'spot',area:'오타루',lat:43.1900,lng:140.9950,duration:60,cost:2000,bookable:true,hours:'09:00~18:00',closed:[],tip:'오타루 운하 근처 유리 불기 체험.',tags:['체험','기념품'],klook:''},
    {id:'sap17',name:'삿포로 팩토리 일루미네이션',category:'shopping',area:'오도리',lat:43.0673,lng:141.3601,duration:60,cost:0,bookable:false,hours:'10:00~20:00',closed:[],tip:'12월 크리스마스 최고 일루미네이션.',tags:['쇼핑','크리스마스','야경'],klook:''},
  ],
};


const SLOT_TEMPLATES = [
  {label:'오전 관광',time:'09:30',type:'spot'},
  {label:'점심 식사',time:'12:30',type:'food'},
  {label:'오후 관광',time:'14:30',type:'spot'},
  {label:'저녁 식사',time:'18:30',type:'food'},
  {label:'숙소',time:'21:00',type:'hotel',fixed:true},
];

/* ─────────────── UTILS ─────────────── */

function haversine(lat1,lng1,lat2,lng2){
  const R=6371,d2r=Math.PI/180;
  const dLat=(lat2-lat1)*d2r,dLng=(lng2-lng1)*d2r;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*d2r)*Math.cos(lat2*d2r)*Math.sin(dLng/2)**2;
  return R*(2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}

const SUBURB_PENALTY={'오타루':50,'다자이후':45,'우지':30,'닛코':90,'가마쿠라':60,'하코네':75};
function calcTransit(a,b){
  if(!a?.lat||!b?.lat)return{mins:0,mode:'',label:''};
  const km=haversine(a.lat,a.lng,b.lat,b.lng);
  const penalty=(km>20?40:0)+(SUBURB_PENALTY[a?.area]||0)+(SUBURB_PENALTY[b?.area]||0);
  if(a?.area===b?.area||km<0.7){const m=Math.max(5,Math.round(km*13));return{km,mins:m,mode:'도보',label:`🚶 도보 ${m}분`};}
  if(km<2.5){const m=Math.round(km*12);return{km,mins:m,mode:'도보',label:`🚶 도보 ${m}분`};}
  if(km<10){const m=Math.round(km*3)+15;return{km,mins:m,mode:'지하철',label:`🚇 지하철 약 ${m}분`};}
  if(km<30){const m=Math.round(km*2.5)+20+penalty;return{km,mins:m,mode:'전철',label:`🚆 전철 약 ${m}분`};}
  const m=Math.round(km*2)+40+penalty;return{km,mins:m,mode:'급행',label:`🚄 급행/버스 약 ${m}분`};
}

function addMins(time,mins){
  const[h,m]=(time||'09:00').split(':').map(Number);
  const t=((h*60+m+mins)%(24*60)+24*60)%(24*60);
  return`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
}

function dayOfWeek(dateStr,offset){
  if(!dateStr)return null;
  const d=new Date(dateStr+'T00:00:00');
  d.setDate(d.getDate()+offset);
  return d.getDay();
}

function formatDate(dateStr,offset){
  if(!dateStr)return '';
  const d=new Date(dateStr+'T00:00:00');
  d.setDate(d.getDate()+offset);
  return d.toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'});
}

function addDays(dateStr,n){
  if(!dateStr)return null;
  const d=new Date(dateStr+'T00:00:00');
  d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10);
}

function checkWarning(place,slotTime,dayOfW){
  if(!place)return[];
  const warns=[];
  const DN=['일','월','화','수','목','금','토'];
  if(place.closed?.includes(dayOfW))warns.push({type:'closed',msg:`${DN[dayOfW]}요일 휴무`});
  if(place.hours&&place.hours!=='24시간'&&slotTime){
    const m=place.hours.match(/(\d{1,2}):(\d{2})~(\d{1,2}):(\d{2})/);
    if(m){
      const[sh,sm]=slotTime.split(':').map(Number);
      const slotM=sh*60+sm;
      const openM=+m[1]*60+ +m[2];
      let closeM=+m[3]*60+ +m[4];
      const overnight=closeM<openM; // 야간영업 (18:00~02:00)
      if(overnight)closeM+=1440;
      const adj=slotM<openM&&overnight?slotM+1440:slotM;
      if(adj<openM)warns.push({type:'hours',msg:`오픈 전 (${m[1]}:${m[2]} 이후 방문)`});
      else if(adj>closeM-30)warns.push({type:'hours',msg:overnight?`마감 임박 (익일 ${m[3]}:${m[4]})`:'마감 30분 전 이내'});
    }
  }
  return warns;
}

function optimizeSlots(slots){
  const next=slots.map(s=>({...s}));
  const spotIdx=next.map((s,i)=>s.item&&s.item.category==='spot'?i:null).filter(v=>v!==null);
  if(spotIdx.length<2)return next;
  const items=spotIdx.map(i=>next[i].item);
  const n=items.length;
  let best=items.map((_,i)=>i),bestD=Infinity;
  function perm(arr){
    if(arr.length<=1)return[arr];
    return arr.flatMap((v,i)=>perm([...arr.slice(0,i),...arr.slice(i+1)]).map(p=>[v,...p]));
  }
  const orders=n<=7?perm(items.map((_,i)=>i)):items.map((_,i)=>i).map(start=>{
    const vis=new Array(n).fill(false);const ord=[start];vis[start]=true;
    for(let s=1;s<n;s++){
      const cur=items[ord[ord.length-1]];let bIdx=-1,bD=Infinity;
      items.forEach((c,j)=>{if(!vis[j]){const d=haversine(cur.lat,cur.lng,c.lat,c.lng);if(d<bD){bD=d;bIdx=j;}}});
      vis[bIdx]=true;ord.push(bIdx);
    }
    return ord;
  });
  orders.forEach(ord=>{
    let d=0;
    for(let i=0;i<ord.length-1;i++)d+=haversine(items[ord[i]].lat,items[ord[i]].lng,items[ord[i+1]].lat,items[ord[i+1]].lng);
    if(d<bestD){bestD=d;best=ord;}
  });
  best.forEach((origIdx,pos)=>{next[spotIdx[pos]].item=items[origIdx];});
  return next;
}

function buildHotelUrl(city,checkIn,checkOut){
  const cid='1922222';
  let url=`https://www.agoda.com/ko-kr/city/${city.agodaCity}.html?cid=${cid}`;
  if(checkIn)url+=`&checkIn=${checkIn}`;
  if(checkOut)url+=`&checkOut=${checkOut}`;
  return url;
}
function buildKlookUrl(q){
  return`https://www.klook.com/ko/search/result/?query=${encodeURIComponent(q)}`;
}
function buildFlightUrl(city){
  return`https://www.skyscanner.co.kr/flights/ICN/${city.skyscannerCode}/`;
}

let RATES={JPY:1/157,KRW:1/1370,USD:1};
function fmtMoney(amt,code){
  const s={JPY:'¥',KRW:'₩',USD:'$'}[code]||'';
  return`${s}${Math.round(amt||0).toLocaleString()}`;
}


/* ─────────────── ADDRESS MAP (전체 장소 주소) ─────────────── */
const ADDRESS_MAP = {
  // ── 도쿄 (30) ───────────────────────────────────────────
  tok1:  '도쿄도 시부야구 도겐자카 2-1',
  tok2:  '도쿄도 시부야구 요요기 신원초 1-1',
  tok3:  '도쿄도 시부야구 시부야 2-24-12 (스크램블 스퀘어 45F)',
  tok4:  '도쿄도 메구로구 다이칸야마초 17-5',
  tok5:  '도쿄도 시부야구 진구마에 1-17',
  tok6:  '도쿄도 시부야구 진구마에 4-12-10',
  tok7:  '도쿄도 시부야구 요요기 2-1',
  tok8:  '도쿄도 신주쿠구 나이토마치 11',
  tok9:  '도쿄도 신주쿠구 니시신주쿠 1-2-6',
  tok10: '도쿄도 신주쿠구 가부키초 1-19',
  tok11: '도쿄도 신주쿠구 신주쿠 3-14-1',
  tok12: '도쿄도 신주쿠구 신주쿠 3-22-7',
  tok13: '도쿄도 다이토구 아사쿠사 2-3-1',
  tok14: '도쿄도 다이토구 아사쿠사 1-36-3',
  tok15: '도쿄도 스미다구 오시아게 1-1-2',
  tok16: '도쿄도 다이토구 우에노 공원',
  tok17: '도쿄도 다이토구 우에노 4-1',
  tok18: '도쿄도 스미다구 아즈마바시 1-23-1',
  tok19: '도쿄도 주오구 쓰키지 4-16-2',
  tok20: '도쿄도 고토구 도요스 6-1-16',
  tok21: '도쿄도 미나토구 다이바 1-4',
  tok22: '도쿄도 미나토구 롯폰기 6-10-1 (롯폰기힐스)',
  tok23: '도쿄도 지요다구 소토칸다 4-1',
  tok24: '도쿄도 메구로구 나카메구로 2-1',
  tok25: '도쿄도 주오구 하마리큐 정원 1-1',
  tok26: '도쿄도 고토구 도요스 6-3',
  tok27: '도쿄도 주오구 긴자 4-1',
  tok28: '도쿄도 다이토구 우에노 공원 13-9',
  tok29: '도쿄도 미나토구 시바 공원 4-2-8',
  tok30: '도쿄도 미나토구 롯폰기 6-11-1',
  // ── 오사카 (20) ─────────────────────────────────────────
  osa1:  '오사카부 오사카시 주오구 도톤보리 1-8',
  osa2:  '오사카부 오사카시 주오구 난바 1-2-16',
  osa3:  '오사카부 오사카시 주오구 신사이바시스지 1-1',
  osa4:  '오사카부 오사카시 주오구 신사이바시스지 1-7',
  osa5:  '오사카부 오사카시 주오구 닛폰바시 2-4-1',
  osa6:  '오사카부 오사카시 주오구 난바 1-6-4',
  osa7:  '오사카부 오사카시 주오구 난바 1-1-3',
  osa8:  '오사카부 오사카시 주오구 니시신사이바시 2-11',
  osa9:  '오사카부 오사카시 기타구 오야도 1-1-88',
  osa10: '오사카부 오사카시 기타구 가다마치 11',
  osa11: '오사카부 오사카시 기타구 오야도 1-1',
  osa12: '오사카부 오사카시 주오구 오사카성 1-1',
  osa13: '오사카부 오사카시 아베노구 아베노스지 1-1-43',
  osa14: '오사카부 오사카시 텐노지구 가야마초 1-108',
  osa15: '오사카부 오사카시 텐노지구 시텐노지 1-11-18',
  osa16: '오사카부 오사카시 고노하나구 사쿠라지마 2-1-33',
  osa17: '오사카부 오사카시 주오구 도톤보리 1-8',
  osa18: '오사카부 오사카시 미나토구 가이간도리 1-1-10',
  osa19: '오사카부 오사카시 미나토구 가이간도리 1-1-10',
  osa20: '오사카부 오사카시 주오구 난바 (난카이)',
  // ── 교토 (15) ───────────────────────────────────────────
  kyo1:  '교토부 교토시 우쿄구 사가오노 (아라시야마)',
  kyo2:  '교토부 교토시 우쿄구 사가텐류지스스키노바바초 68',
  kyo3:  '교토부 교토시 우쿄구 아라시야마 (도게츠교)',
  kyo4:  '교토부 교토시 히가시야마구 기온마치 미나미가와',
  kyo5:  '교토부 교토시 히가시야마구 기온마치 기타가와 625',
  kyo6:  '교토부 교토시 사쿄구 오카자키 (철학자의 길)',
  kyo7:  '교토부 교토시 사쿄구 난젠지후쿠치초 86',
  kyo8:  '교토부 교토시 후시미구 후카쿠사야부노우치초 68',
  kyo9:  '교토부 교토시 기타구 킨카쿠지초 1',
  kyo10: '교토부 교토시 나카교구 니조죠초 541',
  kyo11: '교토부 교토시 나카교구 니시키코지 (니시키 시장)',
  kyo12: '교토부 교토시 나카교구 도미노코지도리 산조',
  kyo13: '교토부 교토시 히가시야마구 기요미즈 1-294',
  kyo14: '교토부 교토시 히가시야마구 산주산겐도마와리마치 657',
  kyo15: '교토부 교토시 히가시야마구 야마토오지도리 기온',
  // ── 후쿠오카 (12) ───────────────────────────────────────
  fuk1:  '후쿠오카현 후쿠오카시 하카타구 나카스',
  fuk2:  '후쿠오카현 후쿠오카시 주오구 오호리코엔 1-2',
  fuk3:  '후쿠오카현 다자이후시 사이후 4-7-1',
  fuk4:  '후쿠오카현 후쿠오카시 사와라구 모모치하마 2-3-26',
  fuk5:  '후쿠오카현 후쿠오카시 하카타구 스미요시 1-2',
  fuk6:  '후쿠오카현 후쿠오카시 하카타구 나카마치 1-62',
  fuk7:  '후쿠오카현 후쿠오카시 주오구 이마이즈미 1-1-6',
  fuk8:  '후쿠오카현 후쿠오카시 하카타구 하카타역 중앙가 1-1',
  fuk9:  '후쿠오카현 후쿠오카시 히가시구 사이토자키 3374-1',
  fuk10: '후쿠오카현 후쿠오카시 니시구 무로미 2-12-1',
  fuk11: '후쿠오카현 후쿠오카시 하카타구 가와바타마치',
  fuk12: '후쿠오카현 후쿠오카시 하카타구 나카스 강변',
  // ── 삿포로 (12) ─────────────────────────────────────────
  sap1:  '홋카이도 삿포로시 주오구 오도리 니시 1-13',
  sap2:  '홋카이도 삿포로시 주오구 기타 5조 니시 2-5',
  sap3:  '홋카이도 삿포로시 기타구 기타 8조 니시 5-4',
  sap4:  '홋카이도 삿포로시 히가시구 기타 7조 히가시 9-1-1',
  sap5:  '홋카이도 삿포로시 미나미구 모이와산로쿠 1-2',
  sap6:  '홋카이도 삿포로시 주오구 니조 니시 1초메',
  sap7:  '홋카이도 삿포로시 주오구 스스키노',
  sap8:  '홋카이도 오타루시 이로나이 1-2-1',
  sap9:  '홋카이도 삿포로시 주오구 스스키노 5초메',
  sap10: '홋카이도 삿포로시 주오구 마루야마니시마치 347',
  sap11: '홋카이도 삿포로시 주오구 기타 2조 히가시 4초메',
  sap12: '홋카이도 삿포로시 주오구 미나미 5조 니시 6초메',
  tok31:'도쿄도 세타가야구 시모키타자와',tok32:'도쿄도 무사시노시 기치조지',tok33:'가나가와현 요코하마시 주오구 야마시타초',
  tok34:'도쿄도 신주쿠구 오쿠보 1-10',tok35:'도쿄도 메구로구 지유가오카',tok36:'지바현 우라야스시 마이하마 1-1',
  tok37:'도쿄도 시부야구 에비스 4-20',tok38:'도쿄도 신주쿠구 가구라자카',tok39:'도쿄도 고토구 아오미 1-1-10',
  tok40:'도쿄도 다이토구 야나카',tok41:'도쿄도 분쿄구 고라쿠 1-3-61',tok42:'도쿄도 주오구 하마초 3-3',
  tok43:'도쿄도 지요다구 간다진보초 2-3',tok44:'도쿄도 신주쿠구 신주쿠 5-24-2',tok45:'도쿄도 미나토구 기타아오야마 2-1',
  tok46:'도쿄도 지요다구 마루노우치 2-4',tok47:'도쿄도 시부야구 시부야 2-21-1',tok48:'도쿄도 미나토구 아자부다이 1-3-1',
  tok49:'도쿄도 도시마구 히가시이케부쿠로 3-1',tok50:'도쿄도 다이토구 우에노 4-7',
  osa21:'오사카부 나니와구 에비스히가시 2-4',osa22:'오사카부 히가시나리구 스루하시 2-3',osa23:'오사카부 기타구 나카자키니시 1-1',
  osa24:'오사카부 스미요시구 스미요시 2-9-89',osa25:'오사카부 주오구 난바 1-7',osa26:'오사카부 기타구 나카노시마',
  osa27:'오사카부 기타구 우메다 3-1-3',osa28:'오사카부 나니와구 나가호리니시 2-9-19',osa29:'오사카부 스이타시 만박공원 2-1',
  osa30:'오사카부 주오구 도톤보리 1-8-1',
  kyo16:'교토부 히가시야마구 야사카도리 야스이',kyo17:'교토부 우쿄구 사가 (트롯코역)',kyo18:'교토부 가미교구 교토고쇼',
  kyo19:'교토부 우쿄구 아라시야마',kyo20:'교토부 후시미구 후시미이나리 근처',
  fuk13:'후쿠오카현 야나가와시 오키노하타마치',fuk14:'후쿠오카현 이토시마시 마에바루',fuk15:'후쿠오카현 하카타구 베이사이드 플레이스',
  fuk16:'후쿠오카현 히가시구 우미노나카미치',fuk17:'후쿠오카현 사와라구 모모치 1-7',
  sap13:'홋카이도 니시구 미야노사와 2조 2초메',sap14:'홋카이도 주오구 마루야마니시마치',sap15:'홋카이도 나카후라노초 기센',
  sap16:'홋카이도 오타루시 이로나이 2-1-20',sap17:'홋카이도 주오구 기타 2조 히가시 4초메',
};

/* ─────────────── COMPONENTS ─────────────── */

function DayMap({slots,activeId,onMarkerClick,expanded,onToggle}){
  const ref=useRef(null);
  const mapRef=useRef(null);
  const ovRef=useRef({markers:[],poly:null});
  const infoRef=useRef(null);
  const items=slots.filter(s=>s.item&&s.item.lat&&s.item.lng).map(s=>s.item);
  const itemKey=JSON.stringify(items.map(i=>i.id));

  useEffect(()=>{
    if(!ref.current||!items.length)return;
    let cancelled=false;

    const draw=()=>{
      if(cancelled||!ref.current)return;

      // 지도 SDK 가 아직 없으면 로드를 기다렸다가 다시 그린다.
      // 로드에 실패하거나 키가 없을 때만 CartoDB(Leaflet) 폴백으로 내려간다.
      if(!window.google?.maps){
        ensureGoogleMaps().then(maps=>{
          if(cancelled)return;
          if(maps){ draw(); return; }
          ensureLeaflet().then(()=>{ if(!cancelled) drawLeaflet(); }).catch(()=>{});
        });
        return;
      }

      const GM=window.google.maps;
      const lls=items.map(i=>({lat:i.lat,lng:i.lng}));

      if(!mapRef.current){
        mapRef.current=new GM.Map(ref.current,{
          zoom:14,center:lls[0],
          mapTypeControl:false,streetViewControl:false,
          fullscreenControl:false,zoomControl:false,
          gestureHandling:'none',
          styles:[
            {featureType:'poi',elementType:'labels',stylers:[{visibility:'off'}]},
            {featureType:'transit',elementType:'labels.icon',stylers:[{visibility:'off'}]},
          ],
        });
      }

      // 기존 오버레이 제거
      ovRef.current.markers.forEach(m=>m.setMap(null));
      ovRef.current.markers=[];
      if(ovRef.current.poly){ovRef.current.poly.setMap(null);ovRef.current.poly=null;}

      // 번호 마커
      items.forEach((item,idx)=>{
        const m=new GM.Marker({
          position:{lat:item.lat,lng:item.lng},map:mapRef.current,
          label:{text:String(idx+1),color:'#fff',fontSize:'11px',fontWeight:'900'},
          icon:{
            path:GM.SymbolPath.CIRCLE,scale:12,
            fillColor:item.id===activeId?'#0F7A6F':'#E94560',
            fillOpacity:1,strokeColor:'#fff',strokeWeight:2,
          },
          title:item.name,zIndex:idx,
        });
        m.addListener('click',()=>{
          if(!infoRef.current)infoRef.current=new GM.InfoWindow({maxWidth:200});
          const tip=item.tip?(item.tip.length>55?item.tip.slice(0,55)+'…':item.tip):'';
          infoRef.current.setContent(`<div style="font-family:'Noto Sans KR',sans-serif;padding:2px"><b style="font-size:.85rem">${item.name}</b>${tip?`<p style="font-size:.72rem;color:#6b7280;margin:.3rem 0 0">💡 ${tip}</p>`:''}<p style="font-size:.72rem;color:#9ca3af;margin:.25rem 0 0">⏱ ${item.duration}분 · ${item.cost>0?'¥'+item.cost.toLocaleString():'무료'}</p></div>`);
          infoRef.current.open({map:mapRef.current,anchor:m});
          onMarkerClick?.(item.id);
        });
        ovRef.current.markers.push(m);
      });

      // 점선 경로
      if(lls.length>=2){
        ovRef.current.poly=new GM.Polyline({
          path:lls,strokeOpacity:0,strokeWeight:0,
          icons:[{
            icon:{path:'M 0,-1 0,1',strokeOpacity:1,strokeWeight:2.5,strokeColor:'#E94560',scale:4},
            offset:'0',repeat:'18px',
          }],
          map:mapRef.current,
        });
        const b=new GM.LatLngBounds();
        lls.forEach(ll=>b.extend(ll));
        mapRef.current.fitBounds(b,{top:28,right:28,bottom:28,left:28});
      }else{
        mapRef.current.setCenter(lls[0]);
        mapRef.current.setZoom(15);
      }
    };

    // CartoDB 폴백 (Leaflet)
    const drawLeaflet=()=>{
      if(!window.L||cancelled||!ref.current)return;
      if(!mapRef.current){
        // Leaflet CDN 동적 로드
        if(!document.querySelector('link[href*="leaflet"]')){
          const lc=document.createElement('link');
          lc.rel='stylesheet';lc.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(lc);
        }
        if(!document.querySelector('script[src*="leaflet"]')){
          const ls=document.createElement('script');
          ls.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          ls.onload=draw;
          document.head.appendChild(ls);
          return;
        }
        mapRef.current=window.L.map(ref.current,{zoomControl:false,attributionControl:false,scrollWheelZoom:false});
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:19}).addTo(mapRef.current);
      }
      const map=mapRef.current;
      map.eachLayer(l=>{if(!(l instanceof window.L.TileLayer))map.removeLayer(l);});
      const lls=items.map(i=>[i.lat,i.lng]);
      items.forEach((item,idx)=>{
        const icon=window.L.divIcon({className:'',html:`<div class="route-marker-num">${idx+1}</div>`,iconSize:[22,22],iconAnchor:[11,11]});
        const m=window.L.marker([item.lat,item.lng],{icon}).addTo(map);
        m.on('click',()=>onMarkerClick?.(item.id));
      });
      if(lls.length>=2){window.L.polyline(lls,{color:'#E94560',weight:1.8,dashArray:'4 6'}).addTo(map);map.fitBounds(lls,{padding:[24,24]});}
      else{map.setView(lls[0],15);}
      setTimeout(()=>mapRef.current?.invalidateSize(),120);
    };

    draw();
    return()=>{cancelled=true;};
  },[itemKey,activeId]);

  useEffect(()=>()=>{
    ovRef.current.markers.forEach(m=>m.setMap(null));
    if(ovRef.current.poly)ovRef.current.poly.setMap(null);
  },[]);

  if(!items.length)return null;
  return(
    <div style={{position:'relative',marginBottom:'1.1rem'}}>
      <div ref={ref} className="day-map" style={{height:expanded?'390px':'200px',marginBottom:0,transition:'height .3s ease'}}/>
      {onToggle&&<button onClick={onToggle} style={{position:'absolute',bottom:8,right:8,background:'rgba(255,255,255,.93)',border:'1px solid var(--border)',borderRadius:'8px',padding:'.28rem .65rem',fontSize:'.72rem',fontWeight:700,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,.12)'}}>
        {expanded?'✕ 축소':'🗺 전체보기'}
      </button>}
    </div>
  );
}

function TimelineView({slots,tripStartDate,dayOffset}){
  const START=6,END=23;
  const totalMins=(END-START)*60;
  const placed=slots.filter(s=>s.item&&s.time);
  return(
    <div className="timeline-wrap">
      <div className="tl-hour-grid" style={{gridTemplateRows:`repeat(${END-START},56px)`}}>
        {Array.from({length:END-START},(_,h)=>{
          const hr=START+h;
          return<React.Fragment key={hr}>
            <div className="tl-hour mono">{String(hr).padStart(2,'0')}:00</div>
            <div className="tl-lane" style={{position:'relative'}}>
              <div className="tl-line" style={{top:0}}/>
            </div>
          </React.Fragment>;
        })}
      </div>
      <div style={{position:'relative',marginLeft:48,marginTop:`-${(END-START)*56}px`,pointerEvents:'none'}}>
        {placed.map((slot,i)=>{
          const[sh,sm]=slot.time.split(':').map(Number);
          const startMins=(sh*60+sm)-(START*60);
          const dur=slot.item.duration||60;
          if(startMins<0||startMins>totalMins)return null;
          const top=(startMins/60)*56;
          const height=Math.max(32,(dur/60)*56);
          const cat=slot.item.category||'spot';
          return<div key={i} className={`tl-block cat-${cat}`} style={{top,height,pointerEvents:'all'}} title={slot.item.name}>
            <div style={{fontWeight:800,fontSize:'.7rem',lineHeight:1.2,marginBottom:'.15rem'}}>{slot.item.name}</div>
            <div style={{fontSize:'.65rem',opacity:.75}}>{slot.time} · {dur}분</div>
          </div>;
        })}
      </div>
    </div>
  );
}

function PlaceCardSm({place,isSelected,onClick,onDragStart}){
  const emoji=CAT_EMOJI[place.category]||'📍';
  return(
    <div
      className={`place-card${isSelected?' selected':''}`}
      onClick={()=>onClick(place)}
      draggable
      onDragStart={e=>{
        e.dataTransfer.effectAllowed='copy';
        e.dataTransfer.setData('text/plain',place.id);
        if(onDragStart)onDragStart(place);
      }}
      style={{cursor:'grab'}}
    >
      <div className="place-card-top">
        <div className="place-img">{emoji}</div>
        <div className="place-info">
          <div className="place-name">{place.name}</div>
          <div className="place-area-tag">{place.area} · {CAT_LABEL[place.category]}</div>
          {ADDRESS_MAP[place.id]&&<div style={{fontSize:'.68rem',color:'var(--t3)',marginTop:'.1rem'}}>{ADDRESS_MAP[place.id]}</div>}
          <div className="place-tags">
            {(place.tags||[]).slice(0,3).map(t=><span key={t} className="p-tag">{t}</span>)}
          </div>
        </div>
      </div>
      <div className="place-meta">
        <span className="m">⏱ {place.duration}분</span>
        {place.cost>0&&<span className="m mono">¥{place.cost.toLocaleString()}</span>}
        {place.cost===0&&<span className="m" style={{color:'var(--teal2)'}}>무료</span>}
        {place.bookable&&<span className="m" style={{color:'var(--amber)'}}>예약 필요</span>}
      </div>
      {place.tip&&<div className="place-tip">💡 {place.tip}</div>}
    </div>
  );
}

/* ─────────────── AUTH COMPONENTS ─────────────── */
function AuthModal({onClose,onGoogle}){
  return(
    <div className="auth-modal-bg" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="auth-panel">
        <div style={{fontSize:'3rem',marginBottom:'.5rem'}}>✈️</div>
        <h2 style={{fontSize:'1.5rem',fontWeight:900,marginBottom:'.5rem',color:'var(--t1)'}}>일정을 저장할게요</h2>
        <p style={{color:'var(--t2)',fontSize:'.9rem',lineHeight:1.65,marginBottom:'2rem'}}>
          로그인하면 나만의 여행 일정을 저장하고<br/>
          <strong>친구에게 링크로 공유</strong>할 수 있어요 🗺️
        </p>
        <button className="auth-google-btn" onClick={onGoogle}>
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.4 5.6-5 7.3v6h8.1c4.8-4.4 7.2-10.9 7.2-17.4z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-8.1-6c-2.1 1.4-4.8 2.2-7.8 2.2-6 0-11.1-4.1-12.9-9.5H2.8v6.2C6.8 42.8 14.9 48 24 48z"/><path fill="#FBBC04" d="M11.1 28.9c-.5-1.4-.7-2.8-.7-4.4s.2-3 .7-4.4V14H2.8C1 17.4 0 21.1 0 24.5s1 7.1 2.8 10.5l8.3-6.1z"/><path fill="#E94235" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.4l6.6-6.6C35.9 2.5 30.4 0 24 0 14.9 0 6.8 5.2 2.8 14l8.3 6.1C12.9 13.5 18 9.5 24 9.5z"/></svg>
          Google로 계속하기
        </button>
        <button onClick={onClose} style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:'.85rem',width:'100%',padding:'.5rem'}}>
          나중에 할게요
        </button>
        {!_fbApp&&<div style={{marginTop:'1rem',padding:'.75rem',background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.3)',borderRadius:'var(--r)',fontSize:'.78rem',color:'#92400e',lineHeight:1.5,textAlign:'left'}}>
          🔧 Firebase 미설정. FIREBASE_CONFIG를 채우면 활성화됩니다.
        </div>}
      </div>
    </div>
  );
}

function MyPlansModal({plans,onClose,onLoad,onShare}){
  return(
    <div className="auth-modal-bg" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:'#fff',borderRadius:'var(--r2)',padding:'2rem',maxWidth:560,width:'100%',maxHeight:'85vh',display:'flex',flexDirection:'column',boxShadow:'0 32px 80px rgba(0,0,0,.22)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem',flexShrink:0}}>
          <h2 style={{fontSize:'1.375rem',fontWeight:900}}>🗺 내 여행 일정</h2>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:'1.5rem',cursor:'pointer',color:'var(--t3)',lineHeight:1}}>×</button>
        </div>
        {plans.length===0?(
          <div style={{textAlign:'center',padding:'3rem 1rem',color:'var(--t3)'}}>
            <div style={{fontSize:'3.5rem',marginBottom:'1rem'}}>🏖️</div>
            <p style={{fontWeight:700,marginBottom:'.5rem'}}>아직 저장된 일정이 없어요</p>
            <p style={{fontSize:'.875rem'}}>플래너에서 일정을 만들고 저장해보세요!</p>
          </div>
        ):(
          <div style={{overflowY:'auto',flex:1}}>
            {plans.map(plan=>(
              <div key={plan.id} className="myplan-card">
                <div style={{fontSize:'2.25rem',flexShrink:0}}>{plan.cityEmoji||'🗾'}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:'.9375rem',marginBottom:'.25rem'}}>{plan.title}</div>
                  <div style={{fontSize:'.775rem',color:'var(--t3)'}}>
                    {plan.createdAt?.toDate?.().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'})||'최근 저장'}
                  </div>
                </div>
                <button onClick={()=>onLoad(plan)} style={{background:'var(--navy)',color:'#fff',border:'none',padding:'.45rem .875rem',borderRadius:'8px',fontSize:'.78rem',fontWeight:700,cursor:'pointer',marginRight:'.4rem',whiteSpace:'nowrap'}}>불러오기</button>
                <button onClick={()=>onShare(plan)} style={{background:'var(--coral-g)',color:'#fff',border:'none',padding:'.45rem .875rem',borderRadius:'8px',fontSize:'.78rem',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>공유</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────── APP ─────────────── */
function App(){
  const[view,setView]=useState('home');
  const[setupStep,setSetupStep]=useState(1);
  const[selectedCity,setSelectedCity]=useState(null);
  const[durationDays,setDurationDays]=useState(3);
  const[tripStartDate,setTripStartDate]=useState('');
  const[travelStyle,setTravelStyle]=useState('couple');
  const[customDur,setCustomDur]=useState(false);
  const[budgetLevel,setBudgetLevel]=useState('moderate');
  const[schedule,setSchedule]=useState([]);
  const[undoStack,setUndoStack]=useState([]);
  const[catFilter,setCatFilter]=useState('all');
  const[areaFilter,setAreaFilter]=useState('all');
  const[placeSearch,setPlaceSearch]=useState('');
  const[viewMode,setViewMode]=useState('list');
  const[activeDay,setActiveDay]=useState(0);
  const[highlightedId,setHighlightedId]=useState(null);
  const[selectedSbPlace,setSelectedSbPlace]=useState(null);
  const[selectedSlotRef,setSelectedSlotRef]=useState(null);
  const[homeCurrency,setHomeCurrency]=useState('KRW');
  const[showOnboard,setShowOnboard]=useState(false);
  const[onboardStep,setOnboardStep]=useState(1);
  const[showResume,setShowResume]=useState(false);
  const[savedState,setSavedState]=useState(null);
  const[searchQ,setSearchQ]=useState('');
  const[showCustomForm,setShowCustomForm]=useState(false);
  const[customDraft,setCustomDraft]=useState({name:'',category:'spot',cost:0,duration:60,tip:''});
  const[customSuggestions,setCustomSuggestions]=useState([]);
  const[hotelAreas,setHotelAreas]=useState({});
  const[isExporting,setIsExporting]=useState(false);
  const[copyMsg,setCopyMsg]=useState('');
  const[optimizeMsg,setOptimizeMsg]=useState('');
  const[mapExpanded,setMapExpanded]=useState(false);
  const[currentUser,setCurrentUser]=useState(null);
  const[showAuthModal,setShowAuthModal]=useState(false);
  const[myPlans,setMyPlans]=useState([]);
  const[showMyPlans,setShowMyPlans]=useState(false);
  const[saving,setSaving]=useState(false);
  const[moveMode,setMoveMode]=useState(null);
  const[showMoreMenu,setShowMoreMenu]=useState(false);
  const[isCarouselExporting,setIsCarouselExporting]=useState(false);
  const[carouselProgress,setCarouselProgress]=useState('');
  const[visitedIds,setVisitedIds]=useState(()=>new Set());
  const[editingTime,setEditingTime]=useState(null);
  const[dragFrom,setDragFrom]=useState(null);
  const[dragOver,setDragOver]=useState(null);
  const[dragSbPlace,setDragSbPlace]=useState(null); // 사이드바→슬롯 드래그
  const[realTransit,setRealTransit]=useState({});
  const transitCache=useRef({});
  const[placeHoursMap,setPlaceHoursMap]=useState({});
  const hoursCache=useRef({});
  const placeSvcRef=useRef(null);
  const[externalResults,setExternalResults]=useState([]);
  const[searching,setSearching]=useState(false);
  const searchTimer=useRef(null);
  const[ratesDate,setRatesDate]=useState(null);

  // ── 브라우저 뒤로가기 / 앞으로가기 ─────────────────
  const pushNav=useCallback((v,step=1)=>{
    history.pushState({view:v,step},'',location.pathname+(v==='home'?'':v==='setup'?'#setup':'#planner'));
  },[]);

  const goToView=useCallback((v,step=1)=>{
    setView(v);
    if(v==='setup')setSetupStep(step);
    pushNav(v,step);
  },[pushNav]);

  useEffect(()=>{
    // 초기 state 설정
    history.replaceState({view:'home',step:1},'',location.pathname);
    const onPop=(e)=>{
      const s=e.state;
      if(!s)return;
      setView(s.view||'home');
      if(s.view==='setup')setSetupStep(s.step||1);
    };
    window.addEventListener('popstate',onPop);
    return()=>window.removeEventListener('popstate',onPop);
  },[]);

  // ── Firebase 연결 (지연 로드) ────────────────────
  // SDK 를 내려받고 인증 리스너를 한 번만 등록한다.
  // 반환 프로미스는 "첫 인증 상태가 확정된 뒤" 이행되므로, 로그인 상태를
  // 전제로 하는 Firestore 읽기를 그대로 이어서 실행할 수 있다.
  const fbRef=useRef({ready:null,unsub:null});
  const connectFirebase=useCallback(async()=>{
    await ensureFirebase();
    const auth=getAuth();
    if(!auth) return getDB();
    if(!fbRef.current.ready){
      fbRef.current.ready=new Promise(resolve=>{
        let first=true;
        fbRef.current.unsub=auth.onAuthStateChanged(user=>{
          setCurrentUser(user);
          try{ user?localStorage.setItem(AUTH_HINT_KEY,'1'):localStorage.removeItem(AUTH_HINT_KEY); }catch(e){}
          if(user)loadMyPlansFromDB(user.uid);
          if(first){ first=false; resolve(); }
        });
      });
    }
    await fbRef.current.ready;
    return getDB();
  },[]);
  useEffect(()=>()=>{ fbRef.current.unsub?.(); },[]);

  // ── 공유 링크(?plan=)로 접속 시 일정 복원 ─────────
  useEffect(()=>{
    const planId=new URLSearchParams(location.search).get('plan');
    let signedInBefore=false;
    try{ signedInBefore=localStorage.getItem(AUTH_HINT_KEY)==='1'; }catch(e){}
    // 공유 링크로 들어왔거나 예전에 로그인한 적이 있을 때만 Firebase 를 내려받는다.
    // 그 외 일반 방문자는 Firebase SDK(약 494KB)를 전혀 받지 않는다.
    if(!planId&&!signedInBefore) return;

    let disposed=false;
    connectFirebase().then(db=>{
      if(disposed||!planId||!db)return;
      db.collection('itineraries').doc(planId).get().then(doc=>{
        if(!doc.exists)return;
        const d=doc.data(),city=CITIES.find(c=>c.id===d.cityId);
        if(!city)return;
        try{
          setSelectedCity(city);setDurationDays(d.durationDays||3);
          setTripStartDate(d.tripStartDate||'');setTravelStyle(d.travelStyle||'couple');
          setBudgetLevel(d.budgetLevel||'moderate');setSchedule(JSON.parse(d.scheduleData));
          setActiveDay(0);setView('planner');
          history.replaceState(null,'',location.pathname);
        }catch(e){}
      }).catch(()=>{});
    });
    return()=>{ disposed=true; };
  },[]);

  // 플래너에 들어갈 때만 Google Maps 를 내려받는다 (랜딩 방문자는 받지 않음)
  useEffect(()=>{ if(view==='planner') ensureGoogleMaps(); },[view]);

  // Load exchange rates
  useEffect(()=>{
    fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=JPY,KRW')
      .then(r=>r.ok?r.json():null).then(d=>{
        if(d&&d.rates){RATES={JPY:1/d.rates.JPY,KRW:1/d.rates.KRW,USD:1};setRatesDate(d.date);}
      }).catch(()=>{});
    fetch('https://ipapi.co/json/').then(r=>r.ok?r.json():null).then(d=>{
      if(d&&d.currency&&RATES[d.currency])setHomeCurrency(d.currency);
    }).catch(()=>{});
  },[]);

  // Check saved state
  useEffect(()=>{
    try{
      const s=localStorage.getItem('pinkclab_v1');
      if(s){const parsed=JSON.parse(s);setSavedState(parsed);setShowResume(true);}
    }catch(e){}
  },[]);

  // Save on schedule change
  useEffect(()=>{
    if(view==='planner'&&schedule.length>0&&selectedCity){
      try{
        localStorage.setItem('pinkclab_v1',JSON.stringify({selectedCity,durationDays,tripStartDate,travelStyle,budgetLevel,schedule,homeCurrency,hotelAreas}));
      }catch(e){}
    }
  },[schedule,view]);

  // 공유 링크로 접속 시 일정 자동 복원
  useEffect(()=>{
    const hash=location.hash;
    if(!hash.startsWith('#s='))return;
    try{
      const raw=decodeURIComponent(escape(atob(hash.slice(3))));
      const d=JSON.parse(raw);
      if(d.v!==1)return;
      const city=CITIES.find(c=>c.id===d.c);
      if(!city)return;
      const db=PLACES_DB[city.id]||[];
      const sc=d.sc.map(dy=>({
        day:dy.dy,
        slots:dy.sl.map(sl=>{
          let item=null;
          if(sl.cx){
            item={id:'c'+Date.now()+Math.random().toString(36).slice(2),name:sl.cx.nm,category:sl.cx.ct,
              cost:sl.cx.co||0,duration:sl.cx.dr||60,tip:sl.cx.tp2||'',area:'직접 추가',
              lat:city.center.lat,lng:city.center.lng,tags:['직접 추가'],custom:true,bookable:false,hours:'',closed:[],klook:''};
          } else if(sl.id){
            item=db.find(p=>p.id===sl.id)||null;
          }
          return{type:sl.tp,time:sl.tm,label:sl.lb,item,fixed:sl.tp==='hotel'};
        })
      }));
      setSelectedCity(city);setDurationDays(d.d);setTripStartDate(d.dt||'');
      setTravelStyle(d.s||'couple');setBudgetLevel(d.b||'moderate');
      setSchedule(sc);setActiveDay(0);setView('planner');
      history.replaceState(null,'',location.pathname); // 해시 클린업
    }catch(e){console.warn('공유 링크 복원 실패',e);}
  },[]);

  // 아래 useEffect 들의 의존성 배열이 렌더 중에 이 값을 읽는다. 선언이 그보다
  // 뒤에 있으면 TDZ(ReferenceError)가 발생하므로 반드시 여기서 선언한다.
  const currentDay=schedule[activeDay];

  // ── 실시간 교통 (Google Directions API) ─────────────────
  useEffect(()=>{
    if(!currentDay)return;
    // 아이템 있는 슬롯만 순서대로 추출
    const filledSlots=currentDay.slots.filter(s=>s.item?.lat&&s.item?.lng&&s.item?.id);
    if(filledSlots.length<2)return;
    const tryFetch=async()=>{
      // 지도 SDK 로드 대기 (플래너 진입 시 이미 시작되어 있다)
      const maps=await ensureGoogleMaps();
      if(!maps)return;

      const svc=new window.google.maps.DirectionsService();
      const up={};

      for(let i=0;i<filledSlots.length-1;i++){
        const a=filledSlots[i].item,b=filledSlots[i+1].item;
        const key=`${a.id}||${b.id}`;
        if(transitCache.current[key]){up[key]=transitCache.current[key];continue;}

        // Step 1: TRANSIT 시도
        const transitResult=await new Promise(resolve=>{
          const dep=new Date();dep.setHours(9,30,0,0);
          if(dep<new Date())dep.setDate(dep.getDate()+1);
          svc.route({
            origin:{lat:a.lat,lng:a.lng},destination:{lat:b.lat,lng:b.lng},
            travelMode:window.google.maps.TravelMode.TRANSIT,
            region:'JP',
            transitOptions:{departureTime:dep},
          },(res,st)=>resolve({res,st}));
        });

        if(transitResult.st==='OK'){
          const leg=transitResult.res.routes[0]?.legs[0];
          if(leg){
            const mins=Math.round(leg.duration.value/60);
            const km=leg.distance.value/1000;
            const parts=[];let wm=0;
            for(const s of leg.steps){
              if(s.travel_mode==='TRANSIT'){
                const vt=s.transit?.line?.vehicle?.type||'';
                const em={SUBWAY:'🚇',BUS:'🚌',HEAVY_RAIL:'🚆',RAIL:'🚆',TRAM:'🚊'}[vt]||'🚆';
                const ln=s.transit?.line?.short_name||s.transit?.line?.name||'대중교통';
                const dep2=s.transit?.departure_stop?.name||'';
                const arr=s.transit?.arrival_stop?.name||'';
                const ns=s.transit?.num_stops;
                const info=dep2&&arr?`${dep2}→${arr}`:ns?`${ns}정류장`:'';
                parts.push(`${em} ${ln}${info?' ('+info+')':''}`);
              }else if(s.travel_mode==='WALKING'){
                wm+=Math.round(s.duration.value/60);
              }
            }
            if(wm>1)parts.push(`🚶 도보 ${wm}분`);
            if(parts.length){
              const label=parts.join(' → ')+(mins?` | 총 ${mins}분`:'');
              const t={mins,label,km,isReal:true};
              transitCache.current[key]=t;up[key]=t;
              continue;
            }
          }
        }

        // Step 2: WALKING 폴백
        const walkResult=await new Promise(resolve=>{
          svc.route({
            origin:{lat:a.lat,lng:a.lng},destination:{lat:b.lat,lng:b.lng},
            travelMode:window.google.maps.TravelMode.WALKING,
          },(res,st)=>resolve({res,st}));
        });

        if(walkResult.st==='OK'){
          const leg=walkResult.res.routes[0]?.legs[0];
          if(leg){
            const mins=Math.round(leg.duration.value/60);
            const km=leg.distance.value/1000;
            const label=mins>15
              ?`🚇 대중교통 이용 권장 | 직선 도보 약 ${mins}분`
              :`🚶 도보 ${mins}분 | 총 ${mins}분`;
            const t={mins,label,km,isReal:true};
            transitCache.current[key]=t;up[key]=t;
          }
        }
      }
      if(Object.keys(up).length)setRealTransit(p=>({...p,...up}));
        };
    tryFetch();
  },[activeDay,currentDay?.slots?.map(s=>s.item?.id).join(',')]);

    const getPlacesSvc=()=>{if(!window.google?.maps?.places)return null;if(!placeSvcRef.current){const d=document.createElement('div');placeSvcRef.current=new window.google.maps.places.PlacesService(d);}return placeSvcRef.current;};
  const isOpenAtSlotTime=(periods,dow,h,m)=>{if(!periods?.length)return null;const sm=h*60+m;if(periods.length===1&&periods[0].open?.time==='0000'&&!periods[0].close)return true;for(const p of periods){if(p.open?.day!==dow)continue;const om=parseInt(p.open.time.slice(0,2))*60+parseInt(p.open.time.slice(2));if(!p.close)return sm>=om;const overnight=p.close.day!==p.open.day;const cm=parseInt(p.close.time.slice(0,2))*60+parseInt(p.close.time.slice(2));return overnight?sm>=om:sm>=om&&sm<cm;}return false;};
  const SlotHoursBadge=({placeHoursMap,slot,tripStartDate,activeDay,getHoursStatus,dayOfWeek})=>{
    if(!slot.item)return null;
    const dow=dayOfWeek(tripStartDate,activeDay);
    const hs=getHoursStatus(placeHoursMap[slot.item?.id],dow,slot);
    if(!hs)return null;
    return React.createElement('div',{style:{fontSize:'.73rem',fontWeight:700,color:hs.color,display:'flex',alignItems:'center',gap:'.25rem',marginTop:'.3rem',padding:'.2rem .55rem',background:hs.color+'18',borderRadius:'6px',width:'fit-content'}},hs.icon,' ',hs.text);
  };
  const getHoursStatus=(hoursData,dow,slot)=>{
    // hasDate: dow must be a valid 0-6 integer (null/-1 = no date set)
    const hasDate=Number.isInteger(dow)&&dow>=0&&dow<=6;
    const DN=['일','월','화','수','목','금','토'];
    const item=slot?.item;
    const[h,m]=(slot?.time||'09:00').split(':').map(Number);

    // ── Step 1: hardcoded DB closed[] — most reliable, no API needed ──
    if(item?.closed?.length>0){
      if(hasDate&&item.closed.includes(dow)){
        // 날짜 설정 + 오늘이 휴무 요일
        return{icon:'🔴',text:`${DN[dow]}요일 휴무`,color:'#dc2626'};
      }
      // 날짜 미설정 시 → 뱃지 표시 안 함 (tip 텍스트에서 빨간 글씨로 대체)
    }

    // ── Step 2: hardcoded DB hours string (날짜 설정 시에만) ──
    if(hasDate&&item?.hours&&item.hours!=='24시간'){
      const mx=item.hours.match(/(\d{1,2}):(\d{2})~(\d{1,2}):(\d{2})/);
      if(mx){
        const slotM=h*60+m;
        const openM=+mx[1]*60+ +mx[2];
        const closeM=+mx[3]*60+ +mx[4];
        const overnight=closeM<openM;
        const adjSlot=slotM<openM&&overnight?slotM+1440:slotM;
        const adjClose=overnight?closeM+1440:closeM;
        if(adjSlot<openM)return{icon:'⚠️',text:`영업 전 — ${mx[1]}:${mx[2]} 오픈`,color:'#d97706'};
        if(adjSlot<adjClose)return{icon:'✅',text:`${mx[3].padStart(2,'0')}:${mx[4]}까지 영업`,color:'#16a34a'};
        return{icon:'🔴',text:'영업 종료',color:'#dc2626'};
      }
    }

    // ── Step 3: Google Places API 데이터 (캐시된 경우) ──
    if(!hoursData)return null;
    const{periods,weekdayText,businessStatus}=hoursData;
    if(businessStatus==='CLOSED_PERMANENTLY')return{icon:'🚫',text:'영구 폐업',color:'#dc2626'};
    if(!hasDate){
      const hasClosedDay=periods?.length>0&&periods.length<7;
      const textHasClosed=weekdayText?.some(t=>t.includes('휴무')||t.includes('Closed'));
      // 날짜 미설정 시 정기휴무 뱃지 표시 안 함
      return null;
    }
    if(!periods?.length){
      const t=weekdayText?.find(x=>x.startsWith(DN[dow]+'요일'));
      if(t?.includes('휴무')||t?.includes('Closed'))return{icon:'🔴',text:`${DN[dow]}요일 휴무`,color:'#dc2626'};
      if(t)return{icon:'🕐',text:t.split(': ')[1]||'',color:'var(--t2)'};
      return null;
    }
    const dp=periods.find(p=>p.open?.day===dow);
    const isOpen=isOpenAtSlotTime(periods,dow,h,m);
    if(isOpen===false){
      if(!dp)return{icon:'🔴',text:`${DN[dow]}요일 휴무`,color:'#dc2626'};
      const oh=parseInt(dp.open.time.slice(0,2));
      const om2=dp.open.time.slice(2).padStart(2,'0');
      return{icon:'⚠️',text:`영업 전 — ${oh}:${om2} 오픈`,color:'#d97706'};
    }
    if(isOpen===true&&dp?.close){
      const ch=parseInt(dp.close.time.slice(0,2));
      const cm2=dp.close.time.slice(2).padStart(2,'0');
      return{icon:'✅',text:`${ch}:${cm2}까지 영업`,color:'#16a34a'};
    }
    return null;
  };
  useEffect(()=>{
    if(!currentDay||view!=='planner')return;
    const svc=getPlacesSvc();if(!svc)return;
    if(!Object.keys(hoursCache.current).length){try{const raw=JSON.parse(localStorage.getItem('pinkclab_phours_v2')||'{}');const now=Date.now();Object.keys(raw).forEach(k=>{if(now-raw[k].ts>86400000)delete raw[k];});hoursCache.current=raw;}catch{}}
    const cached={};const needFetch=[];
    currentDay.slots.forEach(s=>{
      if(!s.item||s.type==='hotel')return;
      if(placeHoursMap[s.item.id])return;
      // 24시간 운영 또는 무료 야외 공공장소는 스킵
      const skip=s.item.hours==='24시간'||(s.item.category==='spot'&&s.item.cost===0&&!s.item.bookable);
      if(skip)return;
      if(hoursCache.current[s.item.id]){cached[s.item.id]=hoursCache.current[s.item.id].data;return;}
      needFetch.push(s);
    });
    if(Object.keys(cached).length)setPlaceHoursMap(p=>({...p,...cached}));
    if(!needFetch.length)return;
    (async()=>{
      const up={};
      for(const slot of needFetch){
        const pl=slot.item;
        await new Promise(resolve=>{svc.textSearch({query:`${pl.name} ${selectedCity?.name||''} Japan`,type:'establishment'},(results,status)=>{if(status!=='OK'||!results[0]){resolve();return;}svc.getDetails({placeId:results[0].place_id,fields:['opening_hours','business_status']},(detail,ds)=>{if(ds==='OK'){const data={periods:detail.opening_hours?.periods||null,weekdayText:detail.opening_hours?.weekday_text||null,businessStatus:detail.business_status||null};hoursCache.current[pl.id]={data,ts:Date.now()};try{localStorage.setItem('pinkclab_phours_v2',JSON.stringify(hoursCache.current));}catch{}up[pl.id]=data;}resolve();});});});
        await new Promise(r=>setTimeout(r,200));
      }
      if(Object.keys(up).length)setPlaceHoursMap(p=>({...p,...up}));
    })();
  },[activeDay,view,currentDay?.slots?.map(s=>s.item?.id).join(',')]);

  // Onboarding on first planner visit
  const hasOnboarded=useRef(false);
  const openPlanner=()=>{
    if(!hasOnboarded.current){
      hasOnboarded.current=true;
      setShowOnboard(true);setOnboardStep(1);
    }
  };

  const pushUndo=useCallback((current)=>{
    setUndoStack(prev=>[...prev.slice(-19),JSON.stringify(current)]);
  },[]);

  const handleUndo=()=>{
    if(!undoStack.length)return;
    const prev=undoStack[undoStack.length-1];
    setUndoStack(s=>s.slice(0,-1));
    setSchedule(JSON.parse(prev));
  };

  const initSchedule=(days,city)=>{
    const db=PLACES_DB[city.id]||[];
    // 카테고리별 풀 — 전체 카테고리 균형 있게 배분
    const pools={
      spot:[...db.filter(p=>p.category==='spot')],
      food:[...db.filter(p=>p.category==='food')],
      cafe:[...db.filter(p=>p.category==='cafe')],
      shopping:[...db.filter(p=>p.category==='shopping')],
      nightview:[...db.filter(p=>p.category==='nightview')],
    };
    const used=new Set();
    const pick=(...cats)=>{
      for(const cat of cats){
        const avail=(pools[cat]||[]).filter(p=>!used.has(p.id));
        if(avail.length){used.add(avail[0].id);return avail[0];}
      }
      return null;
    };
    const init=[];
    for(let i=1;i<=days;i++){
      const isLast=i===days;
      let slots=SLOT_TEMPLATES.map(t=>{
        if(t.type==='hotel')return{...t,item:null};
        let item=null;
        if(t.label==='오전 관광')  item=pick('spot','cafe');
        else if(t.label==='점심 식사')item=pick('food','cafe');
        else if(t.label==='오후 관광')item=pick(i%2===0?'shopping':'spot','spot','shopping');
        else if(t.label==='저녁 식사')item=pick(isLast?'nightview':'food','food','nightview');
        return{...t,item};
      });
      slots=optimizeSlots(slots);
      init.push({day:i,slots});
    }
    return init;
  };

  const startPlanner=()=>{
    const s=initSchedule(durationDays,selectedCity);
    setSchedule(s);
    setActiveDay(0);
    setView('planner');
    pushNav('planner');
    openPlanner();
  };

  const resumeSaved=()=>{
    const s=savedState;
    setSelectedCity(s.selectedCity);
    setDurationDays(s.durationDays);
    setTripStartDate(s.tripStartDate||'');
    setTravelStyle(s.travelStyle||'couple');
    setBudgetLevel(s.budgetLevel||'moderate');
    setSchedule(s.schedule);
    setHomeCurrency(s.homeCurrency||'KRW');
    setHotelAreas(s.hotelAreas||{});
    setShowResume(false);
    setView('planner');
    pushNav('planner');
    setActiveDay(0);
    openPlanner();
  };

  // Slot interaction
  const handleSbPlaceClick=(place)=>{
    setSelectedSbPlace(prev=>prev?.id===place.id?null:place);
    setSelectedSlotRef(null);
  };

  const handleSlotClick=(dayIdx,slotIdx,slot)=>{
    if(slot.type==='hotel')return;
    if(selectedSbPlace){
      pushUndo(schedule);
      setSchedule(prev=>prev.map((d,di)=>di!==dayIdx?d:{...d,slots:d.slots.map((s,si)=>si!==slotIdx?s:{...s,item:selectedSbPlace})}));
      setSelectedSbPlace(null);
      return;
    }
    if(selectedSlotRef){
      const{di:fDi,si:fSi}=selectedSlotRef;
      if(fDi===dayIdx&&fSi===slotIdx){setSelectedSlotRef(null);return;}
      pushUndo(schedule);
      setSchedule(prev=>{
        const next=prev.map(d=>({...d,slots:d.slots.map(s=>({...s}))}));
        const tmp=next[fDi].slots[fSi].item;
        next[fDi].slots[fSi].item=next[dayIdx].slots[slotIdx].item;
        next[dayIdx].slots[slotIdx].item=tmp;
        return next;
      });
      setSelectedSlotRef(null);
      return;
    }
    if(slot.item)setSelectedSlotRef({di:dayIdx,si:slotIdx});
  };

  const handleRemoveSlot=(dayIdx,slotIdx)=>{
    pushUndo(schedule);
    setSchedule(prev=>prev.map((d,di)=>di!==dayIdx?d:{...d,slots:d.slots.map((s,si)=>si!==slotIdx?s:{...s,item:null})}));
  };

  const handleOptimize=(dayIdx)=>{
    pushUndo(schedule);
    const spots=schedule[dayIdx]?.slots.filter(s=>s.item&&s.item.category==='spot')||[];
    setSchedule(prev=>prev.map((d,di)=>di!==dayIdx?d:{...d,slots:optimizeSlots(d.slots)}));
    const msg=spots.length>=2
      ?`⚡ 관광지 ${spots.length}곳 동선 최적화 완료 — 식사·카페 슬롯 위치는 유지됩니다`
      :'⚡ 동선 최적화 완료 (관광지 2개 이상일 때 효과적)';
    setOptimizeMsg(msg);setTimeout(()=>setOptimizeMsg(''),3800);
  };

  const handleAddSlot=(dayIdx)=>{
    pushUndo(schedule);
    setSchedule(prev=>prev.map((d,di)=>{
      if(di!==dayIdx)return d;
      const hotelIdx=d.slots.findIndex(s=>s.type==='hotel');
      const ins=hotelIdx===-1?d.slots.length:hotelIdx;
      const prev2=d.slots[ins-1];
      const t=prev2?addMins(prev2.time,90):'09:00';
      const ns=[...d.slots];
      ns.splice(ins,0,{label:'추가 일정',time:t,type:'spot',item:null,custom:true});
      return{...d,slots:ns};
    }));
  };

  // 카테고리 추측 (Nominatim type 기반)
  const guessCategory=(type,cls)=>{
    const t=((type||'')+(cls||'')).toLowerCase();
    if(/cafe|coffee/.test(t))return 'cafe';
    if(/restaurant|food|fast_food|bar|pub/.test(t))return 'food';
    if(/shop|mall|market|store/.test(t))return 'shopping';
    if(/nightclub|entertainment/.test(t))return 'nightview';
    return 'spot';
  };

  // Nominatim으로 외부 장소 검색 (구글 Maps 키 불필요)
  const searchExternal=async(query)=>{
    if(!query.trim()||!selectedCity)return;
    setSearching(true);
    try{
      const cityJa={tokyo:'Tokyo',osaka:'Osaka',kyoto:'Kyoto',fukuoka:'Fukuoka',sapporo:'Sapporo'}[selectedCity.id]||'Japan';
      const url=`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query+' '+cityJa+' Japan')}&format=json&limit=5&accept-language=ko&addressdetails=1&extratags=1`;
      const res=await fetch(url,{headers:{'Accept-Language':'ko'}});
      if(!res.ok)return;
      const data=await res.json();
      const results=data.slice(0,5).map(item=>{
        const parts=item.display_name.split(',');
        const addr=parts.slice(1,4).map(s=>s.trim()).filter(Boolean).join(', ');
        return{
          id:'ext_'+item.place_id,
          name:parts[0].trim(),
          address:addr,
          lat:parseFloat(item.lat),
          lng:parseFloat(item.lon),
          category:guessCategory(item.type,item.class),
          area:parts[1]?.trim()||selectedCity.areas?.[0]||'',
          duration:60,cost:0,bookable:false,hours:'',closed:[],tip:'',tags:['외부검색'],klook:'',
          source:'nominatim',
        };
      });
      setExternalResults(results);
    }catch(e){console.warn('외부 검색 실패',e);}
    setSearching(false);
  };

  const selectExternalResult=(p)=>{
    setCustomDraft({
      name:p.name,category:p.category,cost:0,duration:60,tip:'',
      lat:p.lat,lng:p.lng,area:p.area,tags:[],hours:'',closed:[],
      bookable:false,klook:'',id:p.id,fromDB:false,address:p.address,
    });
    setCustomSuggestions([]);
    setExternalResults([]);
  };

  const handleCustomName=(val)=>{
    setCustomDraft(d=>({...d,name:val,fromDB:false,id:undefined,lat:undefined,lng:undefined}));
    if(!val.trim()){setCustomSuggestions([]);setExternalResults([]);return;}
    const db=PLACES_DB[selectedCity?.id]||[];
    const q=val.trim();
    const matches=db.filter(p=>p.name.includes(q)||p.area.includes(q)).slice(0,4);
    setCustomSuggestions(matches);
    // 외부 검색 (DB 미검색 + 2글자 이상 시 500ms 디바운스)
    if(searchTimer.current)clearTimeout(searchTimer.current);
    setExternalResults([]);
    if(val.length>=2)searchTimer.current=setTimeout(()=>searchExternal(val),500);
  };
  const selectSuggestion=(p)=>{
    setCustomDraft({name:p.name,category:p.category,cost:p.cost,duration:p.duration,
      tip:p.tip||'',lat:p.lat,lng:p.lng,area:p.area,tags:p.tags,hours:p.hours||'',
      closed:p.closed||[],bookable:p.bookable||false,klook:p.klook||'',id:p.id,fromDB:true});
    setCustomSuggestions([]);
  };
  const submitCustom=()=>{
    if(!customDraft.name.trim())return;
    const db=PLACES_DB[selectedCity.id]||[];
    const cLat=customDraft.lat||(db.reduce((s,p)=>s+p.lat,0)/(db.length||1));
    const cLng=customDraft.lng||(db.reduce((s,p)=>s+p.lng,0)/(db.length||1));
    const place={
      id:customDraft.id||`c${Date.now()}`,name:customDraft.name.trim(),
      category:customDraft.category,area:customDraft.area||'직접 추가',
      lat:cLat,lng:cLng,duration:+customDraft.duration||60,cost:+customDraft.cost||0,
      bookable:customDraft.bookable||false,hours:customDraft.hours||'',closed:customDraft.closed||[],
      tip:customDraft.tip,tags:customDraft.tags||['직접 추가'],klook:customDraft.klook||'',
      custom:!customDraft.fromDB,
    };
    setSelectedSbPlace(place);
    setCustomDraft({name:'',category:'spot',cost:0,duration:60,tip:''});
    setCustomSuggestions([]);
    setShowCustomForm(false);
  };

  // ── 일정 URL 공유 ─────────────────────────────────
  // 일정을 URL 해시로 인코딩 → 링크 공유 → 상대방이 열면 자동 복원
  const encodeSchedule=()=>{
    const d={v:1,c:selectedCity.id,d:durationDays,dt:tripStartDate,s:travelStyle,b:budgetLevel,
      sc:schedule.map(dy=>({dy:dy.day,sl:dy.slots.map(sl=>({
        tp:sl.type,tm:sl.time,lb:sl.label,
        id:sl.item?.id||null,
        cx:sl.item?.custom?{nm:sl.item.name,ct:sl.item.category,co:sl.item.cost,dr:sl.item.duration,tp2:sl.item.tip||''}:null
      }))}))
    };
    return btoa(unescape(encodeURIComponent(JSON.stringify(d))));
  };

  const handleLogin=()=>{ ensureFirebase(); setShowAuthModal(true); };

  // 이용방법 가이드는 /guide.html 라는 독립된 페이지다 (src/guide.html).
  // 예전에는 window.open + document.write 로 만든 팝업이라 URL 도 없고
  // 검색엔진에도 잡히지 않았다. 지금은 홈에서 실제 링크로 연결한다.
  const GUIDE_URL='/guide.html';
  const loginWithGoogle=async()=>{
    await connectFirebase();
    const auth=getAuth();
    if(!auth){alert('로그인 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');return;}
    try{await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());setShowAuthModal(false);}
    catch(e){if(e.code!=='auth/popup-closed-by-user')alert('로그인 실패: '+e.message);}
  };
  const logout=async()=>{
    await getAuth()?.signOut();
    try{ localStorage.removeItem(AUTH_HINT_KEY); }catch(e){}
    setCurrentUser(null);setMyPlans([]);
  };

  const loadMyPlansFromDB=async(uid)=>{
    await ensureFirebase();
    const db=getDB();if(!db)return;
    try{
      const snap=await db.collection('itineraries')
        .where('userId','==',uid).orderBy('createdAt','desc').limit(30).get();
      setMyPlans(snap.docs.map(d=>({id:d.id,...d.data()})));
    }catch(e){console.warn('내 일정 로딩 실패',e);}
  };

  const saveCurrentPlan=async()=>{
    if(!currentUser){setShowAuthModal(true);return;}
    if(!schedule.length){alert('저장할 일정이 없어요.');return;}
    setSaving(true);
    try{
      const db=await connectFirebase();
      if(!db)throw new Error('저장 서비스를 불러오지 못했습니다.');
      const id=currentUser.uid+'_'+Date.now();
      await db.collection('itineraries').doc(id).set({
        userId:currentUser.uid,userName:currentUser.displayName||'익명',
        userPhoto:currentUser.photoURL||'',cityId:selectedCity.id,
        cityName:selectedCity.name,cityEmoji:selectedCity.emoji,
        durationDays,tripStartDate,travelStyle,budgetLevel,
        scheduleData:JSON.stringify(schedule),
        title:`${selectedCity.name} ${durationDays-1}박${durationDays}일`,
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
        isPublic:true,viewCount:0,
      });
      const url=`${location.origin}${location.pathname}?plan=${id}`;
      await navigator.clipboard?.writeText(url).catch(()=>{});
      setCopyMsg('✅ 저장 완료! 공유 링크 복사됨');setTimeout(()=>setCopyMsg(''),4000);
      loadMyPlansFromDB(currentUser.uid);
    }catch(e){alert('저장 실패: '+e.message);}
    setSaving(false);
  };

  const sharePlan=async(plan)=>{
    const url=`${location.origin}${location.pathname}?plan=${plan.id}`;
    await navigator.clipboard?.writeText(url).catch(()=>{});
    setCopyMsg('🔗 공유 링크 복사됨!');setTimeout(()=>setCopyMsg(''),3000);
  };

  const loadPlanFromFirestore=(plan)=>{
    const city=CITIES.find(c=>c.id===plan.cityId);if(!city)return;
    try{
      setSelectedCity(city);setDurationDays(plan.durationDays||3);
      setTripStartDate(plan.tripStartDate||'');setTravelStyle(plan.travelStyle||'couple');
      setBudgetLevel(plan.budgetLevel||'moderate');setSchedule(JSON.parse(plan.scheduleData));
      setActiveDay(0);setView('planner');setShowMyPlans(false);
    }catch(e){alert('일정 불러오기 실패');}
  };

  const moveItemToDay=(fromDay,fromSlotIdx,toDay)=>{
    if(fromDay===toDay){setMoveMode(null);return;}
    setSchedule(prev=>{
      const sc=prev.map(d=>({...d,slots:d.slots.map(s=>({...s}))}));
      const fromSlot=sc[fromDay].slots[fromSlotIdx];
      if(!fromSlot.item)return prev;
      const toSlots=sc[toDay].slots;
      let ti=toSlots.findIndex(s=>!s.fixed&&!s.item&&s.type===fromSlot.type);
      if(ti<0)ti=toSlots.findIndex(s=>!s.fixed&&!s.item);
      if(ti<0)ti=toSlots.findIndex(s=>!s.fixed);
      if(ti<0)return prev;
      const toItem=sc[toDay].slots[ti].item;
      sc[fromDay].slots[fromSlotIdx]={...fromSlot,item:toItem};
      sc[toDay].slots[ti]={...sc[toDay].slots[ti],item:fromSlot.item};
      return sc;
    });
    setMoveMode(null);setActiveDay(toDay);
    setOptimizeMsg(`✅ Day ${schedule[toDay]?.day}로 이동 완료`);
    setTimeout(()=>setOptimizeMsg(''),2500);
  };
  const toggleVisited=(e,id)=>{e.stopPropagation();setVisitedIds(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});};
  const handleTimeChange=(di,si,t)=>{setSchedule(p=>{const sc=p.map(d=>({...d,slots:[...d.slots]}));sc[di].slots[si]={...sc[di].slots[si],time:t};return sc;});};
  const handleSlotDragStart=(e,idx)=>{
    if(schedule[activeDay]?.slots[idx]?.fixed)return;
    setDragFrom(idx);e.dataTransfer.effectAllowed='move';
  };
  const handleSlotDragOver=(e,idx)=>{e.preventDefault();if(dragFrom!==null&&dragFrom!==idx)setDragOver(idx);};
  const handleSlotDrop=(e,toIdx)=>{
    e.preventDefault();const fi=dragFrom;setDragFrom(null);setDragOver(null);
    if(fi===null||fi===toIdx)return;
    pushUndo(schedule);
    setSchedule(prev=>{
      const sc=prev.map(d=>({...d,slots:d.slots.map(s=>({...s}))}));
      const slots=sc[activeDay].slots;
      if(slots[fi]?.fixed||slots[toIdx]?.fixed)return prev;
      // 시간·라벨·type은 고정 — 장소(item)만 교환
      const itemA=slots[fi].item;
      const itemB=slots[toIdx].item;
      slots[fi]={...slots[fi],item:itemB};
      slots[toIdx]={...slots[toIdx],item:itemA};
      return sc;
    });
  };
  const handleDayTabClick=(i)=>{if(moveMode&&moveMode.dayIdx!==i){moveItemToDay(moveMode.dayIdx,moveMode.slotIdx,i);return;}setMoveMode(null);setActiveDay(i);};
  const handleCopyText=()=>{
    const lines=[`🇯🇵 ${selectedCity?.name} ${durationDays-1}박${durationDays}일 여행 일정`,''];
    schedule.forEach(d=>{
      const dt=tripStartDate?` (${formatDate(tripStartDate,d.day-1)})`:'';
      lines.push(`━ Day ${d.day}${dt}`);
      d.slots.filter(s=>s.item&&s.type!=='hotel').forEach(s=>{
        const e=CAT_EMOJI[s.item.category]||'📍';
        const cost=s.item.cost>0?` ¥${s.item.cost.toLocaleString()}`:s.item.cost===0?' 무료':'';
        lines.push(`  ${s.time} ${e} ${s.item.name}${cost}`);
      });
      lines.push('');
    });
    lines.push('— PingClab | pinkclab.com');
    const text=lines.join('\n');
    if(navigator.clipboard){
      navigator.clipboard.writeText(text).then(()=>{
        setCopyMsg('📋 텍스트 복사됨! 카카오톡에 붙여넣으세요');
        setTimeout(()=>setCopyMsg(''),3000);
      });
    }
  };
  const handleShare=()=>{
    const encoded=encodeSchedule();
    const url=`${location.origin}${location.pathname}#s=${encoded}`;
    const copy=(txt)=>{
      if(navigator.clipboard){navigator.clipboard.writeText(txt).catch(()=>{});}
      else{const i=document.createElement('input');i.value=txt;document.body.appendChild(i);i.select();document.execCommand('copy');document.body.removeChild(i);}
      setCopyMsg('✅ 링크 복사됨!');setTimeout(()=>setCopyMsg(''),2500);
    };
    copy(url);
  };

  const handleExport=async()=>{
    setIsExporting(true);
    try{
      const el=document.getElementById('printable-planner');
      if(!el)return;
      await ensureHtml2Canvas();
      const canvas=await window.html2canvas(el,{scale:1.5,useCORS:true,allowTaint:true,backgroundColor:'#F5F4F0'});
      const link=document.createElement('a');
      link.download=`PingClab_${selectedCity?.name}_일정표.png`;
      link.href=canvas.toDataURL('image/png');
      link.click();
    }catch(e){alert('이미지 저장 중 오류가 발생했어요.');}
    finally{setIsExporting(false);}
  };

  // ── INSTAGRAM CAROUSEL EXPORT ──
  const _waitForMapTiles=(map)=>new Promise((resolve)=>{
    let pending=0;
    const inc=()=>pending++;
    const dec=()=>{pending=Math.max(0,pending-1);if(pending<=0)resolve();};
    map.on('tileloadstart',inc);
    map.on('tileload',dec);
    map.on('tileerror',dec);
    setTimeout(resolve,5000);
    setTimeout(()=>{if(pending===0)resolve();},1000);
  });
  const _CAT_ICON={spot:'🏛',food:'🍜',cafe:'☕',shopping:'🛍',nightview:'🌃',nature:'🌿',hotel:'🏨',onsen:'♨'};
  const _getCatIcon=(cat)=>_CAT_ICON[cat]||'📍';
  const _estTravel=(p1,p2)=>{
    if(!p1?.lat||!p2?.lat)return null;
    const R=6371,toR=d=>d*Math.PI/180;
    const dLat=toR(p2.lat-p1.lat),dLng=toR(p2.lng-p1.lng);
    const a=Math.sin(dLat/2)**2+Math.cos(toR(p1.lat))*Math.cos(toR(p2.lat))*Math.sin(dLng/2)**2;
    const km=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    const wMin=Math.round(km/5*60);
    if(wMin<=15)return{min:wMin,mode:'walk',icon:'🚶',label:'도보',clr:'#22c55e'};
    return{min:Math.max(8,Math.round(km/25*60)+5),mode:'transit',icon:'🚇',label:'전철',clr:'#3b82f6'};
  };
  const handleCarouselExport=async()=>{
    if(!schedule.length||!selectedCity){alert('일정을 먼저 생성해주세요.');return;}
    setIsCarouselExporting(true);
    try{ await ensureHtml2Canvas(); }
    catch(e){ alert('이미지 생성기를 불러오지 못했습니다.'); setIsCarouselExporting(false); return; }
    const BC=BRAND.color!=='[브랜드 컬러 확정 필요]'?BRAND.color:'#E84057';
    const BN=BRAND.name;
    const BD=BRAND.domain;
    const nights=durationDays-1;
    const fp=`pinkclab_${selectedCity.id}_${nights}박${durationDays}일`;
    const DOW_KO=['일','월','화','수','목','금','토'];
    const actCost=schedule.reduce((s,d)=>s+d.slots.reduce((s2,sl)=>s2+(sl.item&&sl.type!=='hotel'?sl.item.cost||0:0),0),0);
    const hcpn=selectedCity?.hotel?.[budgetLevel]||0;
    const thot=hcpn*durationDays;
    const tcost=budgetLevel==='budget'?1500:budgetLevel==='moderate'?3000:5000;
    const gtot=actCost+thot+(tcost*durationDays);
    const ctot=gtot*((RATES[selectedCity?.currency||'JPY']||1)/(RATES[homeCurrency]||1));
    const totalAP=schedule.reduce((s,d)=>s+d.slots.filter(sl=>sl.item&&sl.type!=='hotel'&&!(sl.item.closed?.length)).length,0);
    // off-screen container 1080×1350
    const oc=document.createElement('div');
    oc.style.cssText='position:fixed;left:-1200px;top:0;width:1080px;height:1350px;z-index:1;overflow:hidden;background:#fff;font-family:\'Noto Sans KR\',sans-serif;';
    document.body.appendChild(oc);
    const captureOC=()=>window.html2canvas(oc,{scale:2,useCORS:true,allowTaint:false,backgroundColor:'#ffffff',logging:false,width:1080,height:1350});
    const dl=async(canvas,name)=>{
      const lnk=document.createElement('a');
      lnk.download=name;lnk.href=canvas.toDataURL('image/png');lnk.click();
      await new Promise(r=>setTimeout(r,700));
    };
    const HDRSTYLE=`height:130px;background:linear-gradient(135deg,#1A2744,#253656);color:white;display:flex;align-items:center;padding:0 50px;gap:20px;flex-shrink:0;`;
    const FTRSTYLE=`height:80px;background:#1A2744;display:flex;align-items:center;justify-content:space-between;padding:0 40px;flex-shrink:0;`;
    const ftrHTML=`<div style="color:#fff;font-size:22px;font-weight:900;letter-spacing:-.5px;">${BN}</div><div style="color:rgba(255,255,255,.4);font-size:14px;">${BD}</div>`;
    let cn=0;
    try{
      await ensureLeaflet();
      // ── 01 훅 카드 ──
      cn++;
      setCarouselProgress(`1/${1+schedule.length+(schedule.some(d=>d.slots.some(sl=>sl.item&&sl.item.closed?.length))?1:0)+1} 훅 카드 생성 중...`);
      oc.innerHTML=`<div style="width:1080px;height:1350px;font-family:'Noto Sans KR',sans-serif;display:flex;flex-direction:column;background:linear-gradient(160deg,#1A2744 0%,#253656 55%,#1A2744 100%);position:relative;overflow:hidden;">
        <div style="position:absolute;top:-80px;right:-80px;width:500px;height:500px;border-radius:50%;background:${BC};opacity:.08;filter:blur(100px);pointer-events:none;"></div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 80px;text-align:center;gap:28px;">
          <div style="font-size:90px;line-height:1;">${selectedCity.emoji}</div>
          <div>
            <div style="color:rgba(255,255,255,.55);font-size:17px;letter-spacing:4px;margin-bottom:14px;font-weight:500;">PERFECT ITINERARY</div>
            <div style="color:#fff;font-size:78px;font-weight:900;line-height:1.05;letter-spacing:-3px;">${selectedCity.name}</div>
            <div style="color:#fff;font-size:42px;font-weight:700;margin-top:14px;">${nights}박 ${durationDays}일</div>
          </div>
          <div style="display:flex;gap:48px;margin-top:8px;">
            <div style="text-align:center;"><div style="color:#fff;font-size:44px;font-weight:900;">${totalAP}</div><div style="color:rgba(255,255,255,.5);font-size:15px;margin-top:5px;">큐레이션 장소</div></div>
            <div style="width:1px;background:rgba(255,255,255,.15);"></div>
            <div style="text-align:center;"><div style="color:#fff;font-size:44px;font-weight:900;">${durationDays}</div><div style="color:rgba(255,255,255,.5);font-size:15px;margin-top:5px;">일 일정</div></div>
            <div style="width:1px;background:rgba(255,255,255,.15);"></div>
            <div style="text-align:center;"><div style="color:#fff;font-size:44px;font-weight:900;">무료</div><div style="color:rgba(255,255,255,.5);font-size:15px;margin-top:5px;">플래너</div></div>
          </div>
          <div style="margin-top:10px;padding:16px 44px;background:${BC};border-radius:100px;color:#fff;font-size:20px;font-weight:700;">저장 · 공유 · 편집 모두 무료</div>
        </div>
        <div style="${FTRSTYLE}">${ftrHTML}</div>
      </div>`;
      {const cv=await captureOC();await dl(cv,`${fp}_01_훅.png`);}
      // ── DAY 카드 ──
      for(let di=0;di<schedule.length;di++){
        const day=schedule[di];const dayN=di+1;cn++;
        const cardIdx=String(cn).padStart(2,'0');
        setCarouselProgress(`${cn}/${1+schedule.length+2} Day ${dayN} 카드 생성 중...`);
        const aps=day.slots.filter(sl=>sl.item&&sl.type!=='hotel').map(sl=>sl.item).filter(p=>p.lat&&p.lng);
        let dateLbl=`${dayN}일차`;
        if(tripStartDate){const d=new Date(tripStartDate);d.setDate(d.getDate()+di);dateLbl=`${d.getMonth()+1}월 ${d.getDate()}일 (${DOW_KO[d.getDay()]})`;}
        // list HTML
        let listHTML='';
        for(let i=0;i<aps.length;i++){
          const p=aps[i];const isCl=p.closed?.length>0;
          listHTML+=`<div style="display:flex;align-items:flex-start;gap:12px;padding:9px 0;${i>0?'border-top:1px solid #f0f0f0;':''}">
            <div style="width:28px;height:28px;border-radius:50%;background:${isCl?'#9ca3af':BC};color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">${isCl?'⊗':i+1}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:15px;color:${isCl?'#9ca3af':'#1D1D1F'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_getCatIcon(p.category)} ${p.name}${isCl?' <span style=\'font-weight:400;font-size:13px;\'>(휴무)</span>':''}</div>
              <div style="font-size:13px;color:#6E6E73;margin-top:2px;">⏱ ${p.duration||60}분${p.cost>0?` · ¥${(p.cost||0).toLocaleString()}`:'  · 무료'}</div>
            </div></div>`;
          if(i<aps.length-1&&!isCl){
            const tr=_estTravel(p,aps[i+1]);
            if(tr)listHTML+=`<div style="display:flex;align-items:center;gap:6px;padding:3px 0 3px 40px;color:${tr.clr};font-size:12px;font-weight:600;">${tr.icon} ${tr.label} ${tr.min}분 (예상)</div>`;
          }
        }
        // build card DOM
        oc.innerHTML='';
        const cd=document.createElement('div');
        cd.style.cssText='width:1080px;height:1350px;font-family:\'Noto Sans KR\',sans-serif;display:flex;flex-direction:column;background:#fff;overflow:hidden;';
        // header
        const hd=document.createElement('div');
        hd.style.cssText=HDRSTYLE;
        hd.innerHTML=`<div style="width:52px;height:52px;border-radius:14px;background:${BC};display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:#fff;flex-shrink:0;">${dayN}</div>
          <div><div style="font-size:13px;letter-spacing:3px;opacity:.55;text-transform:uppercase;">DAY ${dayN}</div>
          <div style="font-size:30px;font-weight:900;margin-top:3px;">${selectedCity.name}</div>
          <div style="font-size:15px;opacity:.65;margin-top:2px;">${dateLbl}</div></div>`;
        cd.appendChild(hd);
        // map
        const mw=document.createElement('div');
        mw.style.cssText='height:680px;position:relative;flex-shrink:0;background:#e8e8e8;';
        const mel=document.createElement('div');
        mel.id='card-map-'+Date.now();
        mel.style.cssText='width:100%;height:100%;';
        mw.appendChild(mel);
        // L2 watermark
        const wm=document.createElement('div');
        wm.style.cssText=`position:absolute;bottom:14px;right:14px;z-index:1000;color:${BC};font-size:21px;font-weight:900;letter-spacing:-.5px;opacity:.35;text-shadow:0 0 4px #fff,0 0 4px #fff,0 0 4px #fff;pointer-events:none;`;
        wm.textContent=BN;
        mw.appendChild(wm);
        cd.appendChild(mw);
        // list
        const ld=document.createElement('div');
        ld.style.cssText='flex:1;overflow:hidden;padding:16px 30px 10px;background:#fafafa;';
        ld.innerHTML=listHTML;
        cd.appendChild(ld);
        // footer L1
        const ft=document.createElement('div');
        ft.style.cssText=FTRSTYLE;
        ft.innerHTML=ftrHTML;
        cd.appendChild(ft);
        oc.appendChild(cd);
        // Leaflet map
        const lm=window.L.map(mel,{zoomControl:false,attributionControl:false,scrollWheelZoom:false,dragging:false,touchZoom:false,doubleClickZoom:false});
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:19,crossOrigin:'anonymous'}).addTo(lm);
        // markers L3
        aps.forEach((p,idx)=>{
          const isCl=p.closed?.length>0;
          const ic=window.L.divIcon({className:'',html:`<div style="width:28px;height:28px;border-radius:50%;background:${isCl?'#9ca3af':BC};color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);font-family:sans-serif;">${isCl?'⊗':idx+1}</div>`,iconSize:[28,28],iconAnchor:[14,14]});
          window.L.marker([p.lat,p.lng],{icon:ic}).addTo(lm);
        });
        // dotted route
        const rc=aps.filter(p=>!p.closed?.length).map(p=>[p.lat,p.lng]);
        if(rc.length>1)window.L.polyline(rc,{color:BC,weight:3,opacity:.7,dashArray:'8,8'}).addTo(lm);
        // fit bounds
        if(aps.length>0){
          const ll=aps.map(p=>[p.lat,p.lng]);
          if(ll.length===1)lm.setView(ll[0],15);
          else lm.fitBounds(ll,{padding:[50,50]});
        }else{lm.setView([selectedCity.center.lat,selectedCity.center.lng],13);}
        lm.invalidateSize();
        await _waitForMapTiles(lm);
        await new Promise(r=>setTimeout(r,600));
        const cv=await captureOC();
        lm.remove();
        await dl(cv,`${fp}_${cardIdx}_day${dayN}.png`);
      }
      // ── 휴무 카드 ──
      const cpls=schedule.flatMap(d=>d.slots.filter(sl=>sl.item&&sl.type!=='hotel'&&sl.item.closed?.length>0).map(sl=>sl.item));
      if(cpls.length>0){
        cn++;
        const cardIdx=String(cn).padStart(2,'0');
        setCarouselProgress(`${cn} 휴무 카드 생성 중...`);
        const crows=cpls.map(p=>{
          const dstr=p.closed.map(d=>DOW_KO[d]+'요일').join(', ');
          return `<div style="display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid #f0f0f0;">
            <div style="width:32px;height:32px;border-radius:50%;background:#e5e7eb;color:#9ca3af;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">⊗</div>
            <div><div style="font-weight:700;font-size:17px;color:#1D1D1F;">${_getCatIcon(p.category)} ${p.name}</div>
            <div style="font-size:14px;color:#9ca3af;margin-top:3px;">${dstr} 휴무</div></div></div>`;
        }).join('');
        oc.innerHTML=`<div style="width:1080px;height:1350px;font-family:'Noto Sans KR',sans-serif;display:flex;flex-direction:column;background:#fff;overflow:hidden;">
          <div style="${HDRSTYLE}"><div><div style="font-size:13px;letter-spacing:3px;opacity:.55;text-transform:uppercase;">NOTICE</div>
            <div style="font-size:30px;font-weight:900;margin-top:4px;">휴무일 안내</div>
            <div style="font-size:15px;opacity:.65;margin-top:2px;">방문 전 반드시 확인하세요</div></div></div>
          <div style="flex:1;padding:36px 50px;overflow:hidden;">
            <div style="font-size:15px;color:#6E6E73;margin-bottom:20px;">아래 장소는 정기 휴무가 있습니다. 여행 날짜와 비교해 확인하세요.</div>
            ${crows}
          </div>
          <div style="${FTRSTYLE}">${ftrHTML}</div>
        </div>`;
        const cv=await captureOC();
        await dl(cv,`${fp}_${cardIdx}_휴무.png`);
      }
      // ── 예산+CTA 카드 ──
      cn++;
      const lastIdx=String(cn).padStart(2,'0');
      setCarouselProgress(`${cn} 예산 카드 생성 중...`);
      const brows=[
        {label:'숙박 (추정)',val:fmtMoney(thot,selectedCity?.currency),note:`1박 ${fmtMoney(hcpn,selectedCity?.currency)} × ${nights}박`},
        {label:'교통 추정',val:fmtMoney(tcost*durationDays,selectedCity?.currency),note:`1일 ${fmtMoney(tcost,selectedCity?.currency)} × ${durationDays}일`},
        {label:'액티비티·입장료',val:fmtMoney(actCost,selectedCity?.currency),note:'일정 내 유료 장소 합산'},
      ].map(b=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:1px solid #f0f0f0;">
        <div><div style="font-weight:600;font-size:16px;color:#1D1D1F;">${b.label}</div>
        <div style="font-size:13px;color:#9ca3af;margin-top:3px;">${b.note}</div></div>
        <div style="font-weight:700;font-size:18px;color:#1D1D1F;">${b.val}</div></div>`).join('');
      oc.innerHTML=`<div style="width:1080px;height:1350px;font-family:'Noto Sans KR',sans-serif;display:flex;flex-direction:column;background:#fff;overflow:hidden;">
        <div style="${HDRSTYLE}"><div><div style="font-size:13px;letter-spacing:3px;opacity:.55;text-transform:uppercase;">BUDGET</div>
          <div style="font-size:30px;font-weight:900;margin-top:4px;">예상 예산</div>
          <div style="font-size:15px;opacity:.65;margin-top:2px;">${selectedCity.name} ${nights}박 ${durationDays}일</div></div></div>
        <div style="flex:1;padding:36px 50px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;">
          <div>
            <div style="font-size:14px;color:#9ca3af;margin-bottom:4px;">항목별 예상 비용</div>
            ${brows}
            <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 0;margin-top:6px;border-top:2.5px solid #1A2744;">
              <div style="font-weight:900;font-size:20px;color:#1A2744;">총 합계 (추정)</div>
              <div style="font-weight:900;font-size:28px;color:${BC};">${fmtMoney(gtot,selectedCity?.currency)}</div>
            </div>
            <div style="font-size:13px;color:#9ca3af;margin-top:-6px;">≈ ${Math.round(ctot).toLocaleString()} ${homeCurrency} 환산</div>
          </div>
          <div style="background:linear-gradient(135deg,#1A2744,#253656);border-radius:20px;padding:40px;text-align:center;color:white;">
            <div style="font-size:22px;font-weight:900;margin-bottom:10px;">직접 수정하고 싶다면?</div>
            <div style="font-size:16px;opacity:.65;margin-bottom:24px;">장소 추가·삭제 · 순서 변경 · 지도 동선 확인</div>
            <div style="background:${BC};color:#fff;padding:14px 44px;border-radius:100px;font-size:18px;font-weight:700;display:inline-block;">${BD} 무료 이용</div>
          </div>
        </div>
        <div style="${FTRSTYLE}">${ftrHTML}</div>
      </div>`;
      {const cv=await captureOC();await dl(cv,`${fp}_${lastIdx}_예산.png`);}
      setCarouselProgress(`✅ 총 ${cn}장 완료!`);
      setTimeout(()=>setCarouselProgress(''),3000);
    }catch(e){console.error('carousel:',e);alert('카드 생성 오류\n'+e.message);}
    finally{document.body.removeChild(oc);setIsCarouselExporting(false);}
  };

  // Budget calc
  const activityCost=schedule.reduce((s,d)=>s+d.slots.reduce((s2,sl)=>s2+(sl.item&&sl.type!=='hotel'?sl.item.cost||0:0),0),0);
  const hotelCostPerNight=selectedCity?.hotel?.[budgetLevel]||0;
  const totalHotel=hotelCostPerNight*durationDays;
  const transportCost=budgetLevel==='budget'?1500:budgetLevel==='moderate'?3000:5000;
  const grandTotal=activityCost+totalHotel+(transportCost*durationDays);
  const convertedTotal=grandTotal*((RATES[selectedCity?.currency||'JPY']||1)/(RATES[homeCurrency]||1));

  // Sidebar place list
  const allPlaces=PLACES_DB[selectedCity?.id]||[];
  const filteredPlaces=allPlaces
    .filter(p=>catFilter==='all'||p.category===catFilter)
    .filter(p=>areaFilter==='all'||p.area===areaFilter)
    .filter(p=>!placeSearch||p.name.includes(placeSearch)||p.area.includes(placeSearch));
  const areas=[...new Set(allPlaces.map(p=>p.area))];

  // Transport rec
  const transportRec=selectedCity?.transport?.[durationDays<=3?3:7]||selectedCity?.transport?.[3];

  // Weather
  const month=tripStartDate?new Date(tripStartDate+'T00:00:00').getMonth():new Date().getMonth();
  const weatherInfo=WEATHER_DB[selectedCity?.id]?.[month];

  /* ── RENDER: HOME ── */
  if(view==='home') return(
    <>
      {/* ── HOME NAV ── */}
      <nav className="home-nav">
        <div className="nav-logo">Ping<span>Clab</span></div>
        <div className="home-nav-links">
          <a href={GUIDE_URL} target="_blank" rel="noopener">📖 이용방법</a>
          <a onClick={()=>{document.getElementById('cities')?.scrollIntoView({behavior:'smooth'})}}>도시 선택</a>
          <a onClick={()=>{document.getElementById('about')?.scrollIntoView({behavior:'smooth'})}}>서비스 소개</a>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'.7rem'}}>
          {currentUser?(
            <div className="home-login-user">
              <span>👋 {currentUser.displayName?.split(' ')[0]||'여행자'}</span>
              <button className="home-login-btn" style={{background:'rgba(255,255,255,.15)'}} onClick={()=>setShowMyPlans(true)}>내 일정</button>
            </div>
          ):(
            <button className="home-login-btn" onClick={handleLogin}>로그인</button>
          )}
        </div>
      </nav>

      {showResume&&savedState&&(
        <div className="resume-banner">
          <p>마지막으로 편집한 {savedState.selectedCity?.name} 일정이 있어요
            <span>{savedState.durationDays}박 · {savedState.schedule?.length}일 일정</span>
          </p>
          <div className="resume-actions">
            <button className="rb-btn rb-yes" onClick={resumeSaved}>불러오기</button>
            <button className="rb-btn rb-no" onClick={()=>setShowResume(false)}>새로 시작</button>
          </div>
        </div>
      )}
      <section className="hero">
        <div className="hero-content" style={{maxWidth:800,margin:'0 auto',position:'relative',zIndex:1}}>
          <div className="hero-logo">Ping<span>Clab</span></div>
          <p className="hero-sub">동선·날씨·예산까지 — 나만의 완벽한 일본 여행을 만들어보세요 ✈️</p>
        </div>
      </section>

      {/* ── 서비스 소개 (이용방법 자리로 이동) ── */}
      <section id="about" className="sec" style={{background:'#f8f9ff',paddingTop:'4rem',paddingBottom:'4rem'}}>
        <div className="container">
          <div className="sec-hd">
            <div className="sec-title">🦀 PingClab이란?</div>
            <div className="sec-sub">핑크랩이 일본 여행의 모든 고민을 해결합니다</div>
          </div>
          <div className="how-to-grid">
            {[
              {icon:'📍',t:'Ping만 찍으세요',d:'가고 싶은 곳에 핑만 찍으면 동선·휴무·이동시간을 자동으로 최적화합니다'},
              {icon:'🗓️',t:'휴무 걱정 끝',d:'각 장소의 정기 휴무일을 DB로 관리해 일정 충돌을 사전 차단합니다'},
              {icon:'💴',t:'예산 한눈에',d:'숙박·교통·입장료를 자동 합산해 여행 전 예산을 쉽게 파악할 수 있어요'},
              {icon:'📱',t:'인스타 카드',d:'완성 일정을 인스타그램 캐러셀 카드로 바로 저장해 친구들과 공유하세요'},
            ].map(({icon,t,d})=>(
              <div key={t} className="how-to-card">
                <div className="how-to-icon">{icon}</div>
                <div className="how-to-ttl">{t}</div>
                <div className="how-to-desc">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="cities" className="sec" style={{paddingTop:'5rem'}}>
        <div className="container">
          <div className="sec-hd">
            <div className="sec-title">🇯🇵 일본 도시 선택</div>
            <div className="sec-sub">5개 도시 · 장소 큐레이션 포함 · 지도 동선 자동 생성</div>
          </div>
          <div className="city-grid">
            {CITIES.map(c=>(
              <div key={c.id} className="city-card" onClick={()=>{setSelectedCity(c);goToView('setup',2);}}>
                <div className="badge-avail">✓ 지금 계획하기</div>
                <img src={c.image} alt={c.name} loading="lazy" onError={e=>{e.target.onerror=null;e.target.style.cssText="background:var(--bg);height:160px;display:block;width:100%";e.target.removeAttribute("src");}}/>
                <div className="city-card-body">
                  <div className="city-card-name">{c.emoji} {c.name}</div>
                  <div className="city-card-meta">{c.country} · {(PLACES_DB[c.id]||[]).length}개 장소 · 지도 동선 포함</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec sec-white">
        <div className="container">
          <div className="sec-hd">
            <div className="sec-title">🌏 다른 나라도 곧 오픈</div>
            <div className="sec-sub">도쿄 · 오사카 · 교토 · 후쿠오카 · 삿포로</div>
          </div>
          {[
            {label:'일본',countries:[{name:'일본',emoji:'🇯🇵',avail:true}]},
          ].map(region=>(
            <div key={region.label} className="region-section">
              <div className="region-label">{region.label}</div>
              <div className="chips">
                {region.countries.map(c=>(
                  <div key={c.name} className={`chip${c.avail?'':' disabled'}`} onClick={()=>{if(!c.avail){alert(c.name+' 준비 중! 곧 오픈합니다 🚀');return;}setSelectedCity(null);goToView('setup',1);}}>
                    <span>{c.emoji}</span><span>{c.name}</span>
                    {c.avail?<span className="chip-cnt">5개 도시</span>:<span className="chip-soon">준비중</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

    </>
  );

  /* ── RENDER: SETUP ── */
  if(view==='setup') return(
    <div className="setup-wrap">
      <div className="setup-panel">
        <button className="btn-back" onClick={()=>{if(setupStep===1){goToView('home');}else{const ns=setupStep-1;setSetupStep(ns);pushNav('setup',ns);}}}>← {setupStep===1?'홈으로':'이전'}</button>
        <div className="step-bar">{[1,2,3].map(s=><div key={s} className={`step-dot${s<=setupStep?' done':''}`}/>)}</div>

        {setupStep===1&&(
          <>
            <div className="setup-eyebrow">STEP 1 / 3</div>
            <div className="setup-title">어느 도시로 가시나요?</div>
            <div className="setup-sub">원하는 도시를 선택하세요</div>
            <div className="opt-grid">
              {CITIES.map(c=>(
                <div key={c.id} className={`opt-card${selectedCity?.id===c.id?' sel':''}`} onClick={()=>setSelectedCity(c)}>
                  <div className="opt-icon">{c.emoji}</div>
                  <div className="opt-name">{c.name}</div>
                  <div className="opt-desc">{c.country}</div>
                </div>
              ))}
            </div>
            <button className="btn-main" disabled={!selectedCity} onClick={()=>{setSetupStep(2);pushNav('setup',2);}}>다음 → 일정 설정</button>
          </>
        )}

        {setupStep===2&&(
          <>
            <div className="setup-eyebrow">STEP 2 / 3</div>
            <div className="setup-title">{selectedCity?.emoji} {selectedCity?.name} 일정 설정</div>
            <div className="setup-sub">여행 기간과 시작일을 선택하세요</div>
            <div style={{marginBottom:'.7rem',fontWeight:700,fontSize:'.9rem'}}>여행 일수</div>
            <div className="dur-grid">
              {[2,3,4,5,6,7].map(n=>(
                <div key={n} className={`dur-card${durationDays===n&&!customDur?' sel':''}`} onClick={()=>{setDurationDays(n);setCustomDur(false);}}>
                  <div className="dur-num">{n}</div>
                  <div className="dur-lbl">{n-1}박 {n}일</div>
                </div>
              ))}
              <div className={`dur-card${customDur?' sel':''}`} onClick={()=>setCustomDur(true)}>
                <div className="dur-num" style={{fontSize:'1.3rem'}}>✏️</div>
                <div className="dur-lbl">직접 입력</div>
              </div>
            </div>
            {customDur&&(
              <div className="custom-dur-wrap">
                <input type="number" min="1" max="30" value={durationDays}
                  onChange={e=>{const v=Math.max(1,Math.min(30,parseInt(e.target.value)||1));setDurationDays(v);}}
                  autoFocus
                />
                <span style={{fontSize:'.95rem',fontWeight:700,color:'var(--navy)'}}>일 ({durationDays-1}박 {durationDays}일)</span>
              </div>
            )}
            <div className="date-duo">
              <div className="date-row">
                <label>출발일</label>
                <input type="date" value={tripStartDate} onChange={e=>setTripStartDate(e.target.value)} min={new Date().toISOString().slice(0,10)}/>
              </div>
              <div className="return-date-row">
                <label>복귀일</label>
                <span>{tripStartDate?formatDate(tripStartDate,durationDays-1):'—'}</span>
                {tripStartDate&&<span style={{marginLeft:'auto',fontSize:'.8rem',color:'var(--t2)'}}>{durationDays-1}박 {durationDays}일</span>}
              </div>
            </div>
            <button className="btn-main" onClick={()=>{setSetupStep(3);pushNav('setup',3);}}>다음 → 미리보기</button>
          </>
        )}

        {setupStep===3&&(
          <>
            <div className="setup-eyebrow">STEP 3 / 3</div>
            <div className="setup-title">여행 요약 확인</div>
            <div className="setup-sub">아래 내용으로 초안 일정을 자동 생성합니다</div>
            <div style={{background:'var(--bg)',borderRadius:'var(--r)',padding:'1.3rem',marginBottom:'1.5rem',display:'flex',flexDirection:'column',gap:'.8rem'}}>
              {[
                {l:'🗺️ 목적지',v:`${selectedCity?.emoji} ${selectedCity?.name}, ${selectedCity?.country}`},
                {l:'📅 기간',v:`${durationDays-1}박 ${durationDays}일${tripStartDate?` · ${formatDate(tripStartDate,0)} 출발`:''}`},

              ].map(({l,v})=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'.88rem'}}>
                  <span style={{color:'var(--t2)'}}>{l}</span>
                  <span style={{fontWeight:700}}>{v}</span>
                </div>
              ))}
            </div>
            <button className="btn-main" onClick={startPlanner}>✨ 일정 자동 생성하기</button>
          </>
        )}
      </div>
    </div>
  );

  /* ── RENDER: PLANNER ── */
  const checkIn=tripStartDate;
  const checkOut=addDays(tripStartDate,durationDays);

  return(
    <>
      {showAuthModal&&<AuthModal onClose={()=>setShowAuthModal(false)} onGoogle={loginWithGoogle}/>}
      {showMyPlans&&<MyPlansModal plans={myPlans} onClose={()=>setShowMyPlans(false)} onLoad={loadPlanFromFirestore} onShare={sharePlan}/>}
      {/* Onboarding */}
      {showOnboard&&(
        <div className="onboard-overlay">
          <div className="onboard-panel">
            <div className="onboard-steps">{[1,2,3].map(s=><div key={s} className={`onboard-step${s<=onboardStep?' done':''}`}/>)}</div>
            {onboardStep===1&&<><div className="onboard-icon">👆</div><div className="onboard-title">장소 탭 → 슬롯 탭으로 배치</div><div className="onboard-desc">왼쪽 사이드바에서 장소를 탭하면 선택됩니다. 이후 오른쪽 일정 슬롯을 탭하면 그 자리에 배치돼요.</div></>}
            {onboardStep===2&&<><div className="onboard-icon">🔄</div><div className="onboard-title">슬롯 두 번 탭으로 순서 바꾸기</div><div className="onboard-desc">이미 채워진 슬롯을 탭하면 파란색으로 선택돼요. 이후 다른 슬롯을 탭하면 두 장소의 순서가 바뀝니다.</div></>}
            {onboardStep===3&&<><div className="onboard-icon">⚡</div><div className="onboard-title">자동 동선 최적화</div><div className="onboard-desc">각 날의 "동선 최적화" 버튼을 누르면 관광지를 최단 거리 순서로 자동 정렬해줘요. 이동시간이 크게 줄어요!</div></>}
            <button className="onboard-next" onClick={()=>{if(onboardStep<3)setOnboardStep(s=>s+1);else setShowOnboard(false);}}>
              {onboardStep<3?'다음':'시작하기!'}
            </button>
            <button className="onboard-skip" onClick={()=>setShowOnboard(false)}>건너뛰기</button>
          </div>
        </div>
      )}

      {optimizeMsg&&<div style={{position:'fixed',bottom:'1.5rem',left:'50%',transform:'translateX(-50%)',background:'var(--navy)',color:'#fff',padding:'.75rem 1.375rem',borderRadius:'var(--r)',boxShadow:'var(--shadow2)',fontSize:'.85rem',fontWeight:600,zIndex:600,whiteSpace:'nowrap'}}>{optimizeMsg}</div>}
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-logo" onClick={()=>goToView('home')}>Ping<span>Clab</span></div>
        <div className="nav-center">
          <span className="nav-city">{selectedCity?.emoji} {selectedCity?.name}</span>
          <span className="nav-dates">{durationDays-1}박 {durationDays}일{tripStartDate?` · ${formatDate(tripStartDate,0)}`:''}</span>
        </div>
        <div className="nav-actions">
          {/* 되돌리기 — 아이콘만 */}
          {undoStack.length>0&&(
            <button className="nav-icon-btn" title="되돌리기 (Ctrl+Z)" onClick={handleUndo}>↩</button>
          )}
          {/* 더보기 드롭다운 */}
          <div style={{position:'relative'}}>
            <button className="nav-icon-btn" title="더보기" onClick={()=>setShowMoreMenu(m=>!m)}
              style={showMoreMenu?{background:'rgba(255,255,255,.22)',color:'#fff'}:{}}>
              •••
            </button>
            {showMoreMenu&&(
              <>
                {/* 바깥 클릭 시 닫기 */}
                <div style={{position:'fixed',inset:0,zIndex:499}} onClick={()=>setShowMoreMenu(false)}/>
                <div className="nav-dropdown">
                  <button onClick={()=>{handleCopyText();setShowMoreMenu(false);}}>
                    📋 텍스트 복사
                  </button>
                  <button onClick={()=>{handleShare();setShowMoreMenu(false);}} style={copyMsg?{color:'#22c55e'}:{}}>
                    {copyMsg?'✅ 복사됨':'🔗 링크 공유'}
                  </button>
                  <button onClick={()=>{handleExport();setShowMoreMenu(false);}} disabled={isExporting}>
                    📸 이미지 저장
                  </button>
                  <button onClick={()=>{handleCarouselExport();setShowMoreMenu(false);}} disabled={isCarouselExporting} style={isCarouselExporting?{opacity:.5}:{}}>
                    📱 인스타 카드 생성
                  </button>
                  {currentUser&&<>
                    <div className="ndrop-div"/>
                    <button onClick={()=>{setShowMyPlans(true);setShowMoreMenu(false);}}>
                      📂 내 일정
                    </button>
                  </>}
                  <div className="ndrop-div"/>
                  <button onClick={()=>{setShowOnboard(true);setShowMoreMenu(false);}}>
                    ❓ 도움말
                  </button>
                </div>
              </>
            )}
          </div>
          {/* 캐러셀 진행 표시 */}
          {carouselProgress&&(
            <div style={{fontSize:'.75rem',color:'rgba(255,255,255,.7)',whiteSpace:'nowrap',maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis',padding:'0 .5rem'}}>
              {carouselProgress}
            </div>
          )}
          {/* 저장 버튼 */}
          <button className="nav-save-btn" onClick={saveCurrentPlan} disabled={saving}>
            {saving?'저장 중...':'💾 저장'}
          </button>
          {/* 로그인 / 프로필 */}
          {currentUser?(
            <button className="nav-profile-btn" title={`${currentUser.displayName||''} · 클릭하면 로그아웃`} onClick={logout}>
              {currentUser.photoURL
                ?<img src={currentUser.photoURL} onError={e=>{e.target.style.display='none';}} alt="프로필"/>
                :<span style={{fontSize:'1rem',color:'#fff'}}>👤</span>}
            </button>
          ):(
            <button className="nav-login-btn" onClick={()=>setShowAuthModal(true)}>로그인</button>
          )}
        </div>
      </nav>

      {/* Briefing */}
      <div className="briefing">
        <div className="briefing-inner">
          <div className="brief-card brief-main" style={{background:'none',border:'none',padding:0}}>
            <div className="brief-city">{selectedCity?.emoji} {selectedCity?.name}</div>
            <div className="brief-info">{durationDays-1}박 {durationDays}일 · {travelStyle==='solo'?'혼자':travelStyle==='couple'?'커플':travelStyle==='family'?'가족':'친구'} 여행</div>
            {weatherInfo&&<div className="weather-pill">{weatherInfo.icon} {tripStartDate?formatDate(tripStartDate,0):'이번달'} 날씨 — {weatherInfo.note}</div>}

          </div>
          <div className="brief-card">
            <div className="brief-lbl">액티비티 예상</div>
            <div className="brief-val">{fmtMoney(activityCost,selectedCity?.currency)}</div>
            <div className="brief-sub">{schedule.reduce((s,d)=>s+d.slots.filter(sl=>sl.item&&sl.type!=='hotel').length,0)}개 장소</div>
          </div>
          <div className="brief-card">
            <div className="brief-lbl">숙박 추정 ({budgetLevel})</div>
            <div className="brief-val">{fmtMoney(totalHotel,selectedCity?.currency)}</div>
            <div className="brief-sub">{fmtMoney(hotelCostPerNight,selectedCity?.currency)}/박 × {durationDays}박</div>
            <a href={buildHotelUrl(selectedCity,checkIn,checkOut)} target="_blank" rel="noopener" className="btn-cta-hotel" style={{display:'block',marginTop:'.6rem',background:'var(--coral)',color:'#fff',textAlign:'center',padding:'.4rem',borderRadius:'8px',textDecoration:'none',fontSize:'.78rem',fontWeight:700}}>아고다에서 예약 →</a>
          </div>
          <div className="brief-card">
            <div className="brief-lbl">총 예산 추정</div>
            <div className="brief-val" style={{fontSize:'1rem'}}>{fmtMoney(convertedTotal,homeCurrency)}</div>
            <div className="brief-sub">교통 포함 / 항공 제외</div>
          </div>
        </div>
      </div>

      {/* Budget bar */}
      <div className="budget-bar">
        <div className="budget-inner">
          {[
            {label:'액티비티',amt:activityCost,color:'var(--coral)'},
            {label:'숙박 추정',amt:totalHotel,color:'var(--teal)'},
            {label:'교통 추정',amt:transportCost*durationDays,color:AMBER},
          ].map(({label,amt,color})=>(
            <div key={label} className="budget-item">
              <div className="budget-dot" style={{background:color}}/>
              <span style={{color:'var(--t2)',fontSize:'.8rem'}}>{label}</span>
              <span style={{fontWeight:700}} className="mono">{fmtMoney(amt,selectedCity?.currency)}</span>
            </div>
          ))}
          <span className="budget-note">+항공권 별도</span>
          <div className="budget-total mono">{fmtMoney(convertedTotal,homeCurrency)} 총합</div>
          <select value={homeCurrency} onChange={e=>setHomeCurrency(e.target.value)} style={{padding:'.3rem .6rem',borderRadius:'8px',border:'1px solid var(--border)',fontSize:'.78rem',marginLeft:'.3rem'}}>
            {['JPY','KRW','USD'].map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Main planner */}
      <div id="printable-planner">
      <div className="planner-wrap">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-top">
            <div className="sidebar-filters">
              {[{v:'all',l:'전체'},{v:'spot',l:'🗺 관광'},{v:'food',l:'🍽 맛집'},{v:'cafe',l:'☕ 카페'},{v:'shopping',l:'🛍 쇼핑'},{v:'nightview',l:'🌃 야경'}].map(({v,l})=>(
                <button key={v} className={`flt-btn${catFilter===v?' act':''}`} onClick={()=>setCatFilter(v)}>{l}</button>
              ))}
            </div>
            <div className="area-scroll">
              <button className={`area-btn${areaFilter==='all'?' act':''}`} onClick={()=>setAreaFilter('all')}>전체</button>
              {areas.map(a=><button key={a} className={`area-btn${areaFilter===a?' act':''}`} onClick={()=>setAreaFilter(a)}>{a}</button>)}
            </div>
            <input className="place-search" placeholder="장소 검색..." value={placeSearch} onChange={e=>setPlaceSearch(e.target.value)}/>
          </div>

          {selectedSbPlace&&(
            <div style={{background:'rgba(233,69,96,.08)',border:'1px solid rgba(233,69,96,.3)',borderRadius:'var(--r)',margin:'.6rem .8rem',padding:'.7rem',fontSize:'.82rem',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span>✅ <strong>{selectedSbPlace.name}</strong> 선택됨<br/><span style={{color:'var(--t2)'}}>빈 슬롯을 탭해서 배치하세요</span></span>
              <button style={{background:'none',border:'none',color:'var(--t3)',fontSize:'1.1rem'}} onClick={()=>setSelectedSbPlace(null)}>×</button>
            </div>
          )}
          {selectedSlotRef&&(
            <div style={{background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.3)',borderRadius:'var(--r)',margin:'.6rem .8rem',padding:'.7rem',fontSize:'.82rem',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span>🔄 <strong>순서 바꾸기</strong> 모드<br/><span style={{color:'var(--t2)'}}>다른 슬롯을 탭해서 교체</span></span>
              <button style={{background:'none',border:'none',color:'var(--t3)',fontSize:'1.1rem'}} onClick={()=>setSelectedSlotRef(null)}>×</button>
            </div>
          )}

          <div className="sidebar-list">
            {filteredPlaces.length===0&&<div style={{textAlign:'center',color:'var(--t3)',padding:'2rem 0',fontSize:'.85rem'}}>검색 결과가 없어요</div>}
            {filteredPlaces.map(p=><PlaceCardSm key={p.id} place={p} isSelected={selectedSbPlace?.id===p.id} onClick={handleSbPlaceClick} onDragStart={p=>setDragSbPlace(p)}/>)}
          </div>

          {!showCustomForm?(
            <button className="add-custom-btn" onClick={()=>setShowCustomForm(true)}>+ 직접 장소 추가</button>
          ):(
            <div className="custom-form">
              <div style={{position:'relative'}}>
                <input placeholder="🔍 장소 검색 (예: 도쿄타워, 센소지...)" value={customDraft.name} onChange={e=>handleCustomName(e.target.value)} style={{width:'100%',boxSizing:'border-box'}}/>
                {customDraft.fromDB&&<div style={{fontSize:'.7rem',color:'var(--teal2)',marginTop:'.25rem'}}>✅ DB 자동완성 — 지도 좌표·비용·팁 자동 입력됨</div>}
                {(customSuggestions.length>0||externalResults.length>0||searching)&&(
                  <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid var(--border)',borderRadius:'var(--r)',boxShadow:'var(--shadow2)',zIndex:300,maxHeight:260,overflowY:'auto'}}>
                    {customSuggestions.map(p=>(
                      <div key={p.id} style={{padding:'.55rem .8rem',cursor:'pointer',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'.55rem'}}
                        onClick={()=>selectSuggestion(p)}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--teal-wash)'}
                        onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                        <span style={{fontSize:'1.05rem',flexShrink:0}}>{CAT_EMOJI[p.category]||'📍'}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:'.83rem'}}>{p.name}</div>
                          <div style={{fontSize:'.7rem',color:'var(--t3)',marginTop:'.1rem'}}>{p.area} · {CAT_LABEL[p.category]} · {p.duration}분 · {p.cost>0?`¥${p.cost.toLocaleString()}`:'무료'}</div>
                        </div>
                        <span style={{fontSize:'.7rem',color:'var(--teal2)',fontWeight:700,flexShrink:0}}>선택</span>
                      </div>
                    ))}
                    {externalResults.length>0&&(
                      <>
                        <div style={{padding:'.4rem .8rem',fontSize:'.7rem',fontWeight:700,color:'var(--t2)',background:'var(--bg)',borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)'}}>🔍 외부 검색 결과</div>
                        {externalResults.map(p=>(
                          <div key={p.id} style={{padding:'.55rem .8rem',cursor:'pointer',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'flex-start',gap:'.55rem'}}
                            onClick={()=>selectExternalResult(p)}
                            onMouseEnter={e=>e.currentTarget.style.background='rgba(15,122,111,.06)'}
                            onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                            <span style={{fontSize:'1.05rem',flexShrink:0,marginTop:'.1rem'}}>{CAT_EMOJI[p.category]||'📍'}</span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontWeight:700,fontSize:'.83rem'}}>{p.name}</div>
                              {p.address&&<div style={{fontSize:'.7rem',color:'var(--t3)',marginTop:'.1rem'}}>📍 {p.address}</div>}
                            </div>
                            <span style={{fontSize:'.7rem',color:'var(--teal2)',fontWeight:700,flexShrink:0,marginTop:'.1rem'}}>선택</span>
                          </div>
                        ))}
                      </>
                    )}
                    {searching&&<div style={{padding:'.6rem .8rem',fontSize:'.78rem',color:'var(--t3)',display:'flex',alignItems:'center',gap:'.4rem'}}>⏳ 외부 검색 중...</div>}
                    <div style={{padding:'.4rem .8rem',fontSize:'.7rem',color:'var(--t3)',background:'var(--bg)',borderTop:'1px solid var(--border)'}}>목록에 없으면 이름 직접 입력 후 저장</div>
                  </div>
                )}
              </div>
              <select value={customDraft.category} onChange={e=>setCustomDraft(d=>({...d,category:e.target.value}))}>
                {Object.entries(CAT_LABEL).filter(([v])=>v!=='hotel').map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
              <div className="cf-row">
                <input type="number" placeholder="소요(분)" value={customDraft.duration} onChange={e=>setCustomDraft(d=>({...d,duration:e.target.value}))} style={{flex:1}}/>
                <input type="number" placeholder={`비용(${selectedCity?.currency})`} value={customDraft.cost} onChange={e=>setCustomDraft(d=>({...d,cost:e.target.value}))} style={{flex:1}}/>
              </div>
              <input placeholder="팁 (선택)" value={customDraft.tip} onChange={e=>setCustomDraft(d=>({...d,tip:e.target.value}))}/>
              <div className="cf-row">
                <button className="cf-submit" onClick={submitCustom}>선택</button>
                <button style={{flex:1,background:'none',border:'1px solid var(--border)',borderRadius:'8px',padding:'.65rem',color:'var(--t2)',fontSize:'.83rem'}} onClick={()=>setShowCustomForm(false)}>취소</button>
              </div>
            </div>
          )}
        </div>

        {/* Main */}
        <div className="main-panel">
          <div className="tabs-row">
            <div className="day-tabs">
              {schedule.map((d,i)=>{
                const filled=d.slots.filter(s=>s.item&&s.type!=='hotel').length;
                const total=d.slots.filter(s=>s.type!=='hotel').length;
                const dayM=tripStartDate?((new Date(tripStartDate+'T00:00:00').getMonth()+i)%12):new Date().getMonth();
                const wInfo=WEATHER_DB[selectedCity?.id]?.[dayM];
                const isMT=moveMode&&moveMode.dayIdx!==i;
                return(<button key={i} className={`day-tab${activeDay===i?' act':''}${isMT?' move-target':''}`} onClick={()=>handleDayTabClick(i)}>
                  <div style={{display:'flex',alignItems:'center',gap:'.3rem',fontSize:'.8rem'}}>
                    {wInfo&&<span style={{fontSize:'.75rem'}}>{wInfo.icon}</span>}
                    <span>Day {d.day}</span>
                    {isMT&&<span style={{fontSize:'.65rem',fontWeight:700,color:'var(--coral)'}}>이동→</span>}
                  </div>
                  {tripStartDate&&<div style={{fontSize:'.65rem',fontWeight:400,opacity:.75,marginTop:'.1rem'}}>{formatDate(tripStartDate,i).slice(0,7)}</div>}
                  <div style={{display:'flex',gap:2,marginTop:3}}>{Array.from({length:total},(_,si)=>(<span key={si} style={{width:4,height:4,borderRadius:'50%',background:si<filled?(activeDay===i?'rgba(255,255,255,.9)':'var(--coral)'):(activeDay===i?'rgba(255,255,255,.3)':'var(--border2)')}}/>))}</div>
                </button>);
              })}
            </div>
            <div className="view-toggle">
              <button className={`view-btn${viewMode==='list'?' act':''}`} onClick={()=>setViewMode('list')}>📋 일정</button>
              <button className={`view-btn${viewMode==='timeline'?' act':''}`} onClick={()=>setViewMode('timeline')}>⏱ 타임라인</button>
            </div>
          </div>

          {currentDay&&(
            <div className="day-card">
              <div className="day-header">
                <div className="day-header-left">
                  <div className="day-badge">{currentDay.day}</div>
                  <div>
                    <div className="day-title">Day {currentDay.day}</div>
                    {tripStartDate&&<div className="day-date">{formatDate(tripStartDate,activeDay)}</div>}
                  </div>
                </div>
                <div className="day-header-actions">
                  <button className="day-act-btn" onClick={()=>handleOptimize(activeDay)}>⚡ 동선 최적화</button>
                  <button className="day-act-btn" onClick={()=>handleAddSlot(activeDay)}>+ 슬롯 추가</button>
                </div>
              </div>

              <div className="day-body">
                {(()=>{const tot=currentDay.slots.reduce((t,s)=>!s.item||s.type==='hotel'?t:t+(s.item.duration||60)+20,0);return tot>720&&(<div style={{background:tot>900?'rgba(233,69,96,.07)':'rgba(245,158,11,.07)',border:`1px solid ${tot>900?'rgba(233,69,96,.35)':'rgba(245,158,11,.35)'}`,borderRadius:'var(--r)',padding:'.55rem .9rem',marginBottom:'.75rem',fontSize:'.8rem',display:'flex',alignItems:'center',gap:'.45rem'}}><span>{tot>900?'🚨':'⚠️'}</span><span>하루 총 활동 약 <strong>{Math.floor(tot/60)}시간{tot%60>0?' '+tot%60+'분':''}</strong> — {tot>900?'너무 빡빡해요. 1~2곳을 줄여보세요.':'다소 빡빡한 편이에요.'}</span></div>);})()}
                {viewMode==='list'?(
                  <>
                    <DayMap
                      slots={currentDay.slots}
                      activeId={highlightedId}
                      onMarkerClick={id=>{setHighlightedId(id);setTimeout(()=>setHighlightedId(null),2000);}}
                      expanded={mapExpanded}
                      onToggle={()=>setMapExpanded(e=>!e)}
                    />
                    {(()=>{let _n=0;const _nums=currentDay.slots.map(s=>s.item&&s.type!=='hotel'?++_n:null);return currentDay.slots.map((slot,slotIdx)=>{
                      const slotNum=_nums[slotIdx];
                      const prev=slotIdx>0?currentDay.slots[slotIdx-1]:null;
                      // 이전 아이템 있는 슬롯 찾기 (빈 슬롯 건너뜀)
                      const prevFilled=currentDay.slots.slice(0,slotIdx).reverse().find(s=>s.item?.id);
                      const _rtKey=prevFilled?.item&&slot.item?`${prevFilled.item.id}||${slot.item.id}`:null;
                      const transit=(_rtKey&&realTransit[_rtKey])||calcTransit(prev?.item,slot.item);
                      const dow=typeof dayOfWeek(tripStartDate,activeDay)==='number'?dayOfWeek(tripStartDate,activeDay):new Date().getDay();
                      const warns=slot.item?checkWarning(slot.item,slot.time,dow):[];
                      const isHotel=slot.type==='hotel';
                      const isEmpty=!slot.item&&!isHotel;
                      const isHighlighted=slot.item?.id===highlightedId;
                      const isSelSwap=selectedSlotRef?.di===activeDay&&selectedSlotRef?.si===slotIdx;
                      const isReadyForPlace=!!selectedSbPlace&&isEmpty;

                      return(
                        <React.Fragment key={slotIdx}>
                          {slotIdx>0&&transit.mins>0&&(
                            <div className="transit-mini" style={{color:_rtKey&&realTransit[_rtKey]?'var(--teal2)':'var(--t3)'}}>
                              {transit.label}
                              {!((_rtKey)&&realTransit[_rtKey])&&transit.km&&<span style={{opacity:.7}}> ({transit.km<1?`${Math.round(transit.km*1000)}m`:`${transit.km.toFixed(1)}km`})</span>}
                            </div>
                          )}
                          <div className="slot-row"
                          draggable={!!slot.item&&!slot.fixed}
                          onDragStart={e=>handleSlotDragStart(e,slotIdx)}
                          onDragOver={e=>handleSlotDragOver(e,slotIdx)}
                          onDrop={e=>handleSlotDrop(e,slotIdx)}
                          onDragEnd={()=>{setDragFrom(null);setDragOver(null);setDragSbPlace(null);}}
                          style={{opacity:dragFrom===slotIdx?.55:1,outline:dragOver===slotIdx?"2px dashed var(--coral)":"",outlineOffset:2,borderRadius:"var(--r)",transition:"opacity .15s"}}>
                            <div className="slot-time-col">
                              {slot.item&&!slot.fixed&&<div style={{textAlign:"center",color:"var(--t3)",fontSize:".8rem",cursor:"grab",lineHeight:1,marginBottom:".15rem"}} title="드래그해서 순서 변경">⠿</div>}
                              {slotNum&&<div style={{width:18,height:18,borderRadius:'50%',background:'var(--coral)',color:'#fff',fontSize:10,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto .2rem'}}>{slotNum}</div>}
                              {editingTime?.dayIdx===activeDay&&editingTime?.slotIdx===slotIdx
                                ?<input type="time" value={slot.time} autoFocus style={{width:'4rem',border:'none',background:'transparent',fontFamily:'monospace',fontSize:'.76rem',fontWeight:700,color:'var(--coral)',padding:0}} onChange={e=>handleTimeChange(activeDay,slotIdx,e.target.value)} onBlur={()=>setEditingTime(null)}/>
                                :<div className="slot-time" title="클릭해서 시간 수정" style={{cursor:'pointer'}} onClick={e=>{e.stopPropagation();setEditingTime({dayIdx:activeDay,slotIdx});}}>{slot.time}</div>}
                            </div>
                            <div
                              className={`slot-item${isHotel?' hotel-slot':isEmpty?(isReadyForPlace||dragSbPlace?' empty ready':' empty'):' filled'}${isSelSwap?' sel-swap':''}${isHighlighted?' highlighted':''}${slot.item&&visitedIds.has(slot.item.id)?' visited':''}${moveMode?.dayIdx===activeDay&&moveMode?.slotIdx===slotIdx?' move-source':''}`}
                              onClick={()=>handleSlotClick(activeDay,slotIdx,slot)}
                              onDragOver={e=>{if(dragSbPlace&&!isHotel){e.preventDefault();e.dataTransfer.dropEffect='copy';}}}
                              onDrop={e=>{
                                if(!dragSbPlace||isHotel)return;
                                e.preventDefault();
                                pushUndo(schedule);
                                setSchedule(prev=>prev.map((d,di)=>di!==activeDay?d:{...d,slots:d.slots.map((s,si)=>si!==slotIdx?s:{...s,item:dragSbPlace})}));
                                setDragSbPlace(null);
                              }}
                              onDragEnter={e=>{if(dragSbPlace&&!isHotel)e.preventDefault();}}
                            >
                              {isHotel?(
                                <div>
                                  <div className="slot-type-label">🏨 숙소</div>
                                  {activeDay===0&&<div style={{fontSize:'.72rem',background:'rgba(15,122,111,.07)',border:'1px solid rgba(15,122,111,.25)',borderRadius:'8px',padding:'.35rem .6rem',marginBottom:'.4rem',color:'var(--teal2)'}}>💡 첫날 팁: 체크인 전이라면 짐을 프론트에 맡기고 일정을 시작하세요</div>}
                                  <div className="hotel-slot-inner">
                                    <div>
                                      <select className="hotel-area-sel" value={hotelAreas[activeDay]||''} onChange={e=>setHotelAreas(prev=>({...prev,[activeDay]:e.target.value}))}>
                                        <option value="">숙박 지역 선택...</option>
                                        {(selectedCity?.areas||[]).map(a=><option key={a} value={a}>{a}</option>)}
                                      </select>
                                      {hotelAreas[activeDay]&&<div style={{fontSize:'.73rem',color:'var(--t2)',marginTop:'.3rem'}}>📍 {hotelAreas[activeDay]} 지역 숙소 기준 다음날 동선 참고</div>}
                                    </div>
                                    <a className="hotel-book-btn" href={buildHotelUrl(selectedCity,addDays(tripStartDate,activeDay),addDays(tripStartDate,activeDay+1))} target="_blank" rel="noopener">아고다 예약 →</a>
                                  </div>
                                </div>
                              ):isEmpty?(
                                <div style={{textAlign:'center',padding:'.5rem 0'}}>
                                  <div style={{fontSize:'1.25rem',marginBottom:'.15rem'}}>{(isReadyForPlace||dragSbPlace)?'👆':'+'}</div>
                                  <div style={{fontSize:'.78rem',fontWeight:600}}>{(isReadyForPlace||dragSbPlace)?'여기에 놓기':'장소 추가'}</div>
                                  {!(isReadyForPlace||dragSbPlace)&&<div style={{fontSize:'.7rem',opacity:.7,marginTop:'.1rem'}}>탭 or 드래그</div>}
                                </div>
                              ):(
                                <>
                                  <div className="slot-actions" onClick={e=>e.stopPropagation()}>
                                    {!isHotel&&slot.item&&<>
                                      <button className={`slot-act-btn${moveMode?.dayIdx===activeDay&&moveMode?.slotIdx===slotIdx?' active':''}`} title="다른 날로 이동" onClick={e=>{e.stopPropagation();setMoveMode(moveMode?.slotIdx===slotIdx&&moveMode?.dayIdx===activeDay?null:{dayIdx:activeDay,slotIdx,item:slot.item});}}>↕</button>
                                      <button className={`slot-act-btn${visitedIds.has(slot.item?.id)?' active':''}`} title="방문 완료" onClick={e=>toggleVisited(e,slot.item?.id)}>{visitedIds.has(slot.item?.id)?'✅':'○'}</button>
                                    </>}
                                    <button className="slot-act-btn" style={{color:'var(--coral)'}} onClick={e=>{e.stopPropagation();handleRemoveSlot(activeDay,slotIdx);}}>✕</button>
                                  </div>
                                  <div className="slot-type-label">{slot.item?({'spot':'📍 관광','food':'🍽 맛집','cafe':'☕ 카페','shopping':'🛍 쇼핑','nightview':'🌃 야경'}[slot.item.category]||slot.label):slot.label}</div>
                                  <div className="slot-name">{slot.item?.name}</div>
                                  {(ADDRESS_MAP[slot.item?.id]||slot.item?.address)&&<div style={{fontSize:'.72rem',color:'var(--t3)',marginBottom:'.25rem',display:'flex',alignItems:'center',gap:'.25rem'}}>📍 {ADDRESS_MAP[slot.item?.id]||slot.item?.address}</div>}
                                  <div className="slot-row-info">
                                    <span className="slot-dur">⏱ {slot.item?.duration}분</span>
                                    {slot.item?.cost>0&&<span className="slot-cost">
                                      {fmtMoney(slot.item?.cost,selectedCity?.currency)}
                                      {homeCurrency!==selectedCity?.currency&&<span style={{fontSize:'.7rem',color:'var(--t3)',fontWeight:400,marginLeft:'.35rem'}}>≈{fmtMoney(Math.round((slot.item.cost)*(RATES[selectedCity?.currency||'JPY']||1)/(RATES[homeCurrency]||1)),homeCurrency)}</span>}
                                    </span>}
                                    {slot.item?.cost===0&&<span style={{color:'var(--teal2)',fontSize:'.75rem',fontWeight:700}}>무료</span>}
                                    {slot.item?.bookable&&<span style={{color:'var(--amber)',fontSize:'.73rem',fontWeight:700}}>예약 필요</span>}
                                    {slot.item?.hours&&slot.item?.hours!=='24시간'&&<span style={{fontSize:'.73rem',color:'var(--t3)'}}>🕐 {slot.item?.hours}</span>}
                                  </div>
                                  {warns.map((w,wi)=>(
                                    <div key={wi} className={`slot-warning${w.type==='closed'?' closed':''}`}>
                                      {w.type==='closed'?'🚫':'⚠️'} {w.msg}
                                    </div>
                                  ))}
                                  {slot.item?.tip&&<div className="slot-tip">💡 {(()=>{
                                    const kw=['휴관','휴무','휴장'];
                                    const parts=slot.item.tip.split(/(휴관|휴무|휴장)/g);
                                    return parts.map((p,i)=>kw.includes(p)?React.createElement('span',{key:i,style:{color:'#dc2626',fontWeight:700}},p):p);
                                  })()}</div>}
                                  {SlotHoursBadge({placeHoursMap,slot,tripStartDate,activeDay,getHoursStatus,dayOfWeek})}
                                  {slot.item?.tags&&slot.item.tags.length>0&&(
                                    <div className="slot-tags">{slot.item.tags.map(t=><span key={t} className="s-tag">{t}</span>)}</div>
                                  )}
                                  {slot.item?.bookable&&(
                                    <a href={slot.item.klook?`https://www.klook.com/ko/activity/${slot.item.klook}/`:`https://www.klook.com/ko/search/result/?query=${encodeURIComponent(slot.item.name+' '+selectedCity.name)}`} target="_blank" rel="noopener" style={{display:'inline-flex',alignItems:'center',gap:'.3rem',marginTop:'.5rem',fontSize:'.75rem',fontWeight:700,color:'var(--coral)',textDecoration:'none',padding:'.3rem .75rem',background:'rgba(233,69,96,.08)',borderRadius:'2rem',border:'1px solid rgba(233,69,96,.2)'}}>🎟 클룩 최저가 예약 →</a>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })})()}
                  </>
                ):(
                  <TimelineView slots={currentDay.slots} tripStartDate={tripStartDate} dayOffset={activeDay}/>
                )}
              </div>

              {/* CTA Row */}
              <div className="cta-row">
                <a className="cta-btn cta-hotel" href={buildHotelUrl(selectedCity,addDays(tripStartDate,activeDay),addDays(tripStartDate,activeDay+1))} target="_blank" rel="noopener">🏨 Day {currentDay.day} 숙소 예약</a>
                <a className="cta-btn cta-ticket" href={buildKlookUrl(`${selectedCity?.name} 입장권`)} target="_blank" rel="noopener">🎫 클룩에서 입장권</a>
                <a className="cta-btn cta-flight" href={buildFlightUrl(selectedCity)} target="_blank" rel="noopener">✈️ 항공권 검색</a>
                {transportRec&&<a className="cta-btn" style={{background:'#6366f1',color:'#fff'}} href={buildKlookUrl(transportRec.rec)} target="_blank" rel="noopener">🚌 교통패스 구매</a>}
              </div>
            </div>
          )}

          {/* Travel insurance CTA */}
          <div style={{background:'linear-gradient(90deg,#1e3a8a,#1e40af)',borderRadius:'var(--r2)',padding:'1.2rem 1.5rem',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'1rem'}}>
            <div>
              <div style={{color:'#fff',fontWeight:700,marginBottom:'.3rem'}}>🛡️ 해외 여행자 보험</div>
              <div style={{color:'rgba(255,255,255,.7)',fontSize:'.83rem'}}>갑작스러운 질병·사고·수하물 분실 대비</div>
            </div>
            <a href={buildKlookUrl('일본 여행자 보험')} target="_blank" rel="noopener" style={{background:'#fff',color:'#1e3a8a',padding:'.6rem 1.2rem',borderRadius:'var(--r)',fontWeight:700,fontSize:'.85rem',textDecoration:'none'}}>클룩에서 보험 가입 →</a>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

ReactDOM.render(<App/>,document.getElementById('root'));
_hideLoader();
