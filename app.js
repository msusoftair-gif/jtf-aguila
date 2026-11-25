/* Obj7 «La Talpa» — prova E digitale, PCR 7/2/2027 · M.S.U. MultiPurpose Softair Unit A.s.d.
 * Pagina della prova: nessuna libreria esterna. Login, tempi, controllo delle risposte e punteggio
 * passano dal server (Apps Script legato al Foglio della direzione evento).
 */
(() => {
'use strict';

/* niente incorniciamento in pagine di terzi (clickjacking) */
if (window.top !== window.self) { document.documentElement.innerHTML = ''; throw new Error('frame'); }

/* ================= config & utils ================= */
const CFG = Object.assign({ api: '', audio: true }, window.TALPA_CONFIG || {});
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad = n => String(n).padStart(2, '0');
const fmt = s => { s = Math.max(0, Math.ceil(s - 1e-6)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };
const fmtMs = ms => { const s = Math.max(0, Math.round(ms / 1000)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isMobile = () => innerWidth < 760;
const isPortraitMap = () => innerWidth < 760 || innerHeight > innerWidth * 1.1;
const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* memoria del browser non disponibile */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* idem */ } }
};
const RUNKEY = 'jtf_aguila_run';

/* ================= audio (sintetizzato) ================= */
const Snd = (() => {
  let ctx = null, on = !!CFG.audio;
  const ac = () => {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const tone = (f, d = .08, type = 'sine', v = .08, when = 0, to = null) => {
    const c = ac(); if (!c || !on) return;
    const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .03);
  };
  const noise = (d = .2, v = .05) => {
    const c = ac(); if (!c || !on) return;
    const b = c.createBuffer(1, Math.floor(c.sampleRate * d), c.sampleRate), a = b.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / a.length);
    const s = c.createBufferSource(), g = c.createGain(); g.gain.value = v; s.buffer = b; s.connect(g).connect(c.destination); s.start();
  };
  const buzz = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* niente vibrazione */ } };
  return {
    unlock: ac,
    key: () => tone(1700 + Math.random() * 600, .02, 'square', .012),
    click: () => { tone(880, .05, 'triangle', .05); buzz(8); },
    step: () => tone(520, .03, 'square', .025),
    tick: () => tone(1250, .035, 'square', .035),
    ping: () => tone(1500, .5, 'sine', .05, 0, 650),
    scan: () => { tone(220, 2.2, 'sine', .035, 0, 880); tone(440, 2.2, 'triangle', .012, 0, 1760); },
    ok: () => { tone(660, .12, 'triangle', .08); tone(990, .14, 'triangle', .08, .09); tone(1320, .3, 'triangle', .08, .18); buzz(30); },
    err: () => { tone(170, .28, 'sawtooth', .07); tone(110, .34, 'sawtooth', .07, .12); noise(.15, .03); buzz([60, 40, 90]); },
    whoosh: () => noise(.35, .04),
    win: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, .45, 'triangle', .07, i * .11)); buzz([40, 30, 40, 30, 120]); },
    lose: () => { [440, 349, 262, 196].forEach((f, i) => tone(f, .4, 'sawtooth', .05, i * .16)); buzz(200); },
    get on() { return on; }, set on(v) { on = !!v; }
  };
})();

/* ================= sfondo animato ================= */
(() => {
  const cv = $('#bg'), x = cv.getContext('2d');
  let W, H, D, P = [], last = 0;
  const rs = () => {
    D = Math.min(1.5, window.devicePixelRatio || 1); W = cv.width = innerWidth * D; H = cv.height = innerHeight * D;
    const n = Math.round(Math.min(isMobile() ? 34 : 90, (innerWidth * innerHeight) / 18000));
    P = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .25 * D, vy: (Math.random() - .5) * .25 * D }));
  };
  rs(); addEventListener('resize', rs);
  const fr = t => {
    requestAnimationFrame(fr);
    if (document.hidden || t - last < 33) return; last = t;
    x.clearRect(0, 0, W, H);
    const g = x.createRadialGradient(W * .5, H * .35, 0, W * .5, H * .5, Math.max(W, H) * .8);
    g.addColorStop(0, '#071826'); g.addColorStop(1, '#02050a'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const L = 150 * D;
    for (const p of P) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; }
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const a = P[i], b = P[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < L) { x.strokeStyle = `rgba(60,240,255,${(1 - d / L) * .16})`; x.lineWidth = D; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); }
    }
    x.fillStyle = 'rgba(60,240,255,.5)';
    for (const p of P) { x.beginPath(); x.arc(p.x, p.y, 1.3 * D, 0, 6.283); x.fill(); }
  };
  requestAnimationFrame(fr);
})();

/* ================= navigazione ================= */
let state = 'standby';
function show(id) {
  const cur = $('.screen.active');
  if (cur && cur.id !== id) cur.classList.remove('active');
  const el = $('#' + id); el.classList.remove('active'); void el.offsetWidth; el.classList.add('active');
}
let toastT = 0;
function toast(msg, cls = '') {
  const t = $('#toast'); t.textContent = msg; t.className = 'show ' + cls; clearTimeout(toastT); toastT = setTimeout(() => { t.className = ''; }, 2600);
}
function bodyFx(cls, ms = 500) { document.body.classList.remove(cls); void document.body.offsetWidth; document.body.classList.add(cls); setTimeout(() => document.body.classList.remove(cls), ms); }
function goFullscreen() { const d = document.documentElement; try { if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch (e) { /* non supportato */ } }
let wake = null;
async function keepAwake(onOff) {
  try {
    if (onOff && 'wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); }
    if (!onOff && wake) { await wake.release(); wake = null; }
  } catch (e) { wake = null; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && state === 'mission') keepAwake(true); });

/* ================= server ================= */
async function post(body, timeout = 15000) {
  if (!CFG.api) throw new Error('api');
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(CFG.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body),
      signal: ctl.signal, redirect: 'follow', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/* coda degli eventi della prova: inviati in ordine, ritentati finché il server risponde */
const Q = { busy: false, wait: 800 };
function persist() { if (R) store.set(RUNKEY, { token: R.token, seq: R.seq, q: R.q }); }
function enqueue(ev) { if (!R) return; ev.seq = ++R.seq; R.q.push(ev); persist(); pump(); }
async function pump() {
  if (Q.busy) return; Q.busy = true;
  try {
    while (R && R.q.length) {
      const ev = R.q[0];
      let res = null;
      try { res = await post(Object.assign({ token: R.token }, ev), 15000); } catch (e) { res = null; }
      if (!R) break;
      if (!res) { netState(true); await sleep(Q.wait); Q.wait = Math.min(5000, Q.wait * 1.7); continue; }
      Q.wait = 800; netState(false);
      R.q.shift(); persist();
      if (!res.ok) {
        if (res.errore === 'annullata' || res.errore === 'tentativo') { annullata(res.messaggio); break; }
        continue;
      }
      if (typeof res.errori === 'number' && res.errori > R.errors) { R.errors = res.errori; $('#m-err').textContent = R.errors; }
      if (res.finito) { R.finito = res.finito; onFinito(); }
    }
  } finally { Q.busy = false; }
}
let netT = 0;
function netState(bad) {
  clearTimeout(netT);
  if (bad) netT = setTimeout(() => $('#net').classList.add('on'), 1200);
  else $('#net').classList.remove('on');
}

/* ================= dati fissi della mappa ================= */
const BUILDINGS = [
  { id: 'hacienda', nome: 'Hacienda El Sol', corto: 'Hacienda', x: 150, y: 135 },
  { id: 'motel', nome: 'Motel Las Palmas', corto: 'Motel', x: 485, y: 92 },
  { id: 'officina', nome: 'Officina Ruiz', corto: 'Officina', x: 845, y: 150 },
  { id: 'cantina', nome: 'Cantina Azteca', corto: 'Cantina', x: 600, y: 300 },
  { id: 'chiesa', nome: 'Chiesa San Judas', corto: 'Chiesa', x: 215, y: 375 },
  { id: 'mercato', nome: 'Mercado Central', corto: 'Mercado', x: 520, y: 505 },
  { id: 'molo', nome: 'Molo 7', corto: 'Molo 7', x: 870, y: 495 },
  { id: 'pista', nome: 'Pista Rancho Viejo', corto: 'Pista', x: 135, y: 565 }
];
const TOWERS = [
  { id: 'A', x: 345, y: 232, col: '#3cf0ff' },
  { id: 'B', x: 772, y: 338, col: '#ffb000' },
  { id: 'C', x: 372, y: 610, col: '#ff4fd8' }
];
const METRI = 4.5; // metri per unità di mappa
const TATS = [{ w: 'SCORPIONE', e: '🦂' }, { w: 'SERPENTE', e: '🐍' }, { w: 'TESCHIO', e: '💀' },
  { w: 'ROSA', e: '🌹' }, { w: 'AQUILA', e: '🦅' }, { w: 'PUGNALE', e: '🗡️' }];
const B = id => BUILDINGS.find(b => b.id === id);
function rot(s, k) {
  const kl = ((k % 26) + 26) % 26, kd = ((k % 10) + 10) % 10;
  return s.replace(/[A-Z0-9]/g, ch => {
    const c = ch.charCodeAt(0);
    return c >= 65 ? String.fromCharCode((c - 65 + kl) % 26 + 65) : String.fromCharCode((c - 48 + kd) % 10 + 48);
  });
}
function svela(cifrato, chiave) {
  const chiaro = rot(cifrato, -chiave);
  const ora = (chiaro.match(/\b\d{2}:\d{2}\b/) || [''])[0];
  const T = TATS.find(t => chiaro.includes(t.w)) || { w: '?', e: '❔' };
  return { chiaro, ora, T };
}

/* ================= grafica SVG ================= */
function emblemSVG() {
  const ticks = Array.from({ length: 36 }, (_, i) => {
    const a = i * 10 * Math.PI / 180, r1 = 56, r2 = i % 3 ? 52 : 48;
    return `<line x1="${60 + r1 * Math.cos(a)}" y1="${60 + r1 * Math.sin(a)}" x2="${60 + r2 * Math.cos(a)}" y2="${60 + r2 * Math.sin(a)}"/>`;
  }).join('');
  return `<svg viewBox="0 0 120 120">
    <defs><filter id="eg"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <g class="spin" stroke="#3cf0ff" stroke-width="1.4" opacity=".7">${ticks}</g>
    <g class="spin2"><circle cx="60" cy="60" r="44" fill="none" stroke="#3cf0ff" stroke-width="1" stroke-dasharray="4 7" opacity=".6"/></g>
    <g filter="url(#eg)" fill="none" stroke="#e8fbff" stroke-width="2.2" stroke-linejoin="round">
      <path d="M60 22 L92 38 V66 C92 84 77 96 60 102 C43 96 28 84 28 66 V38 Z" fill="rgba(60,240,255,.08)"/>
      <path d="M38 52 L60 62 L82 52 M42 64 L60 73 L78 64 M47 76 L60 83 L73 76" stroke="#3cf0ff"/>
      <circle cx="60" cy="44" r="7" stroke="#ffb000"/><path d="M60 33 V55 M49 44 H71" stroke="#ffb000" stroke-width="1.4"/>
    </g></svg>`;
}
function fingerprintSVG() {
  let p = '';
  for (let k = 1; k <= 11; k++) {
    const rx = 8 + k * 6.2, ry = 10 + k * 7.6, gap = (k * 37) % 50 + 10;
    p += `<path d="M ${150 - rx} ${150 + 12} A ${rx} ${ry} 0 1 1 ${150 + rx} ${150 + 12}" stroke-dasharray="${200 + k * 20} ${gap}" style="animation-delay:${k * .07}s"/>`;
  }
  return `<svg viewBox="0 0 300 300">
    <circle class="r1" cx="150" cy="150" r="138" fill="none" stroke="#3cf0ff" stroke-width="2" stroke-dasharray="60 30 10 30" opacity=".8"/>
    <circle class="r2" cx="150" cy="150" r="124" fill="none" stroke="#ffb000" stroke-width="1.2" stroke-dasharray="2 8" opacity=".8"/>
    <circle class="r3" cx="150" cy="150" r="112" fill="none" stroke="#3cf0ff" stroke-width="3" stroke-dasharray="40 660" stroke-linecap="round"/>
    <g class="fp" fill="none" stroke="#3cf0ff" stroke-width="2.4" stroke-linecap="round" opacity=".9">${p}</g>
    <g class="bar"><rect x="64" y="148" width="172" height="3" fill="#39ff88" opacity=".9"/><rect x="64" y="128" width="172" height="20" fill="url(#bg2)" opacity=".5"/></g>
    <defs><linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#39ff88" stop-opacity="0"/><stop offset="1" stop-color="#39ff88" stop-opacity=".6"/></linearGradient></defs>
  </svg>`;
}
let avN = 0;
const okCol = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#333333';
function avatarSVG(f) {
  const id = 'av' + (++avN);
  f = Object.assign({}, f, { skin: okCol(f.skin), hair: okCol(f.hair), suit: okCol(f.suit), bg: okCol(f.bg) });
  const hairBack = { long: '<path d="M27 46 C25 20 75 20 73 46 L76 84 C66 78 34 78 24 84 Z"/>', bob: '<path d="M28 44 C27 20 73 20 72 44 L73 68 C64 73 36 73 27 68 Z"/>' }[f.style] || '';
  const hairTop = {
    short: '<path d="M30.5 46 C29 22 71 22 69.5 46 C67 34 59 30 50 30 C41 30 33 34 30.5 46 Z"/>',
    buzz: '<path d="M32 43 C33 26 67 26 68 43 C64 34 36 34 32 43 Z" opacity=".85"/>',
    side: '<path d="M30.5 47 C28 21 72 21 69.5 45 C64 32 50 28 40 36 C36 39 33 43 30.5 47 Z"/>',
    bald: '<path d="M30 50 C30 42 32 40 33 39 L33 50 Z M70 50 C70 42 68 40 67 39 L67 50 Z" opacity=".8"/>',
    long: '<path d="M30 48 C28 22 72 22 70 48 C66 33 56 29 46 31 C38 33 33 40 30 48 Z"/>',
    bob: '<path d="M30 48 C28 22 72 22 70 48 C68 36 60 30 50 30 C40 30 32 36 30 48 Z"/>',
    bun: '<circle cx="50" cy="20" r="8"/><path d="M30.5 46 C29 23 71 23 69.5 46 C67 34 59 30 50 30 C41 30 33 34 30.5 46 Z"/>'
  }[f.style] || '';
  return `<svg viewBox="0 0 100 112"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${f.bg}"/><stop offset="1" stop-color="#05090d"/></linearGradient></defs>
    <rect width="100" height="112" fill="url(#${id})"/>
    <g fill="${f.hair}">${hairBack}</g>
    <path d="M8 112 C10 86 28 77 50 77 C72 77 90 86 92 112 Z" fill="${f.suit}"/>
    <path d="M43 77 L50 95 L57 77 Z" fill="#e9eef2"/><path d="M48.5 80 L50 96 L51.5 80 Z" fill="#7a1f2b"/>
    <rect x="43" y="63" width="14" height="15" rx="4" fill="${f.skin}"/>
    <ellipse cx="50" cy="48" rx="19.5" ry="23" fill="${f.skin}"/>
    <ellipse cx="30.5" cy="50" rx="3" ry="5" fill="${f.skin}"/><ellipse cx="69.5" cy="50" rx="3" ry="5" fill="${f.skin}"/>
    ${f.beard ? `<path d="M31 52 C33 76 67 76 69 52 C64 63 58 64 50 64 C42 64 36 63 31 52 Z" fill="${f.hair}" opacity=".92"/>` : ''}
    <g fill="#141414"><ellipse cx="42.5" cy="48" rx="2.3" ry="1.7"/><ellipse cx="57.5" cy="48" rx="2.3" ry="1.7"/></g>
    <g stroke="${f.hair}" stroke-width="2" stroke-linecap="round"><path d="M38 42.5 L46 41.5"/><path d="M54 41.5 L62 42.5"/></g>
    <path d="M50 49 L48 56 L51 56.5" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.2"/>
    <path d="M44.5 61 Q50 63.5 55.5 61" fill="none" stroke="#5b3426" stroke-width="1.6" stroke-linecap="round"/>
    ${f.glasses ? '<g fill="rgba(160,220,255,.12)" stroke="#0c0c0c" stroke-width="1.6"><rect x="35.5" y="43.5" width="13" height="9" rx="3"/><rect x="51.5" y="43.5" width="13" height="9" rx="3"/><path d="M48.5 47 H51.5"/></g>' : ''}
    <g fill="${f.hair}">${hairTop}</g>
  </svg>`;
}

/* mappa: in verticale (telefono) le coordinate si scambiano (x↔y): le distanze restano identiche */
let MAPV = false;
const MP = (x, y) => MAPV ? [y, x] : [x, y];
const mpath = d => d.replace(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g, (_, a, b) => MP(+a, +b).map(v => +v.toFixed(1)).join(' '));
function contours() {
  const hills = [{ x: 330, y: 120, s: 1 }, { x: 760, y: 560, s: .8 }, { x: 690, y: 160, s: .6 }, { x: 120, y: 330, s: .7 }];
  let out = '';
  hills.forEach((h, hi) => {
    for (let k = 1; k <= 6; k++) {
      let d = '';
      for (let i = 0; i <= 48; i++) {
        const a = i / 48 * Math.PI * 2, rr = k * 26 * h.s * (1 + .16 * Math.sin(3 * a + k + hi) + .08 * Math.cos(5 * a - hi));
        const [px, py] = MP(h.x + rr * Math.cos(a) * 1.25, h.y + rr * Math.sin(a));
        d += (i ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1);
      }
      out += `<path d="${d}Z"/>`;
    }
  });
  return out;
}
function mapSVG() {
  MAPV = isPortraitMap();
  const roads = [['hacienda', 'motel'], ['motel', 'officina'], ['officina', 'molo'], ['molo', 'mercato'], ['mercato', 'pista'], ['pista', 'chiesa'],
    ['chiesa', 'hacienda'], ['chiesa', 'cantina'], ['cantina', 'motel'], ['cantina', 'mercato'], ['cantina', 'officina']]
    .map(([a, b], i) => { const p = B(a), q = B(b), mx = (p.x + q.x) / 2 + (i % 2 ? 30 : -30), my = (p.y + q.y) / 2 + (i % 3 ? -25 : 25); return mpath(`M${p.x} ${p.y} Q${mx} ${my} ${q.x} ${q.y}`); });
  const river = mpath('M-60 455 C120 430 180 480 300 470 S470 400 610 420 S760 520 840 560 S960 600 1060 590');
  const vb = MAPV ? '36 74 640 862' : '0 0 1000 640';
  const [vx, vy, vw, vh] = vb.split(' ').map(Number);
  const grid = MAPV ? '' : Array.from({ length: 10 }, (_, i) => `<text x="${i * 100 + 50}" y="16">${String.fromCharCode(65 + i)}</text>`).join('') +
    Array.from({ length: 6 }, (_, i) => `<text x="10" y="${i * 100 + 56}">${i + 1}</text>`).join('');
  const comp = MAPV ? 'translate(618 282) scale(.8)' : 'translate(930 80)';
  const scale = MAPV ? 'translate(56 104)' : 'translate(30 615)';
  return `<svg id="map" class="${MAPV ? 'portrait' : ''}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">
  <defs>
    <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="rgba(60,240,255,.05)"/></pattern>
    <pattern id="grid2" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="rgba(60,240,255,.12)"/></pattern>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <radialGradient id="mbg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#0b2230"/><stop offset="1" stop-color="#040a10"/></radialGradient>
    <clipPath id="mclip"><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}"/></clipPath>
  </defs>
  <g clip-path="url(#mclip)">
    <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="url(#mbg)"/>
    <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="url(#grid)"/><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="url(#grid2)"/>
    <g fill="none" stroke="rgba(57,255,136,.10)" stroke-width="1.2">${contours()}</g>
    <path d="${river}" fill="none" stroke="#0f4f78" stroke-width="22" opacity=".55" stroke-linecap="round"/>
    <path d="${river}" fill="none" stroke="#3cb6ff" stroke-width="1.5" opacity=".45" stroke-dasharray="3 9"/>
    <g fill="none" stroke-linecap="round">
      ${roads.map(d => `<path d="${d}" stroke="rgba(215,246,255,.10)" stroke-width="9"/><path d="${d}" stroke="rgba(215,246,255,.22)" stroke-width="1.2" stroke-dasharray="8 10"/>`).join('')}
    </g>
    <g fill="rgba(109,141,160,.8)" font-size="11" font-family="Menlo,monospace">${grid}</g>
    <g id="rings"></g>
    ${TOWERS.map(t => { const [x, y] = MP(t.x, t.y); return `<g class="tower" transform="translate(${x} ${y})" color="${t.col}">
      <circle r="18" fill="${t.col}" opacity=".08"/>
      <path d="M0 -20 L-10 12 M0 -20 L10 12 M-6 0 H6 M-8 7 H8" stroke="${t.col}" stroke-width="2" fill="none"/>
      <circle cy="-21" r="3.5" fill="${t.col}" filter="url(#glow)"/>
      <path d="M-9 -29 A 12 12 0 0 1 9 -29 M-14 -34 A 19 19 0 0 1 14 -34" stroke="${t.col}" stroke-width="1.5" fill="none" opacity=".7"/>
      <text y="${MAPV ? 34 : 30}" fill="${t.col}">TORRE ${t.id}</text></g>`; }).join('')}
    ${BUILDINGS.map(b => { const [x, y] = MP(b.x, b.y); return `<g class="bld" data-id="${b.id}" transform="translate(${x} ${y})">
      <circle class="hit" r="${MAPV ? 52 : 34}"/><circle class="pulse" r="12"/>
      <rect class="ico" x="-10" y="-10" width="20" height="20" rx="3"/>
      <text class="lbl" y="${!MAPV && b.y > 590 ? -20 : MAPV ? 38 : 32}">${esc((MAPV ? b.corto : b.nome).toUpperCase())}</text></g>`; }).join('')}
    <g id="cross" class="cross"></g>
    <g transform="${comp}" stroke="rgba(215,246,255,.5)" fill="none"><circle r="26"/><path d="M0 -34 L6 0 L0 34 L-6 0 Z" fill="rgba(215,246,255,.15)"/><text y="-40" fill="rgba(215,246,255,.7)" stroke="none" font-size="13" text-anchor="middle" font-family="Menlo,monospace">N</text></g>
    <g transform="${scale}" font-family="Menlo,monospace" font-size="${MAPV ? 15 : 11}" fill="rgba(215,246,255,.7)"><rect width="111" height="5" fill="rgba(215,246,255,.6)"/><rect width="55.5" height="5" fill="#0b2230"/><text y="-7">0</text><text x="${MAPV ? 70 : 96}" y="-7">500 m</text></g>
  </g></svg>`;
}

/* ================= standby / boot / login ================= */
function initStatic() {
  $('#emblem').innerHTML = emblemSVG();
  $('#scan-art').innerHTML = fingerprintSVG();
}
async function typeLine(el, text, cls = '', speed = 12) {
  const d = document.createElement('div'); d.className = cls + ' cur'; el.appendChild(d);
  for (const ch of text) { d.textContent += ch; if (ch !== ' ' && Math.random() < .5) Snd.key(); await sleep(speed); }
  d.classList.remove('cur');
}
let booted = false;
async function startBoot() {
  if (booted) return; booted = true; state = 'boot';
  Snd.unlock(); goFullscreen();
  $('#standby').style.display = 'none';
  const log = $('#boot-log'); log.style.display = 'block'; log.innerHTML = '';
  const m = isMobile();
  const L = [
    ['JTF-ÁGUILA SECURE TERMINAL v4.7 // 2027.02', 'd', 3],
    [m ? '> kernel crittografico ....... [OK]' : '> inizializzazione kernel crittografico ........... [OK]', '', 4],
    [m ? '> canale AES-256 DEA ......... [OK]' : '> canale cifrato AES-256 con il comando DEA ......... [OK]', '', 4],
    [m ? '> SAT-COM 3 .................. [OK]' : '> collegamento satellitare SAT-COM 3 ................ [OK]', '', 4],
    [m ? '> ponti radio Sinaloa: 3 ..... [OK]' : '> rete ponti radio settore Sinaloa: 3 torri attive .. [OK]', '', 4],
    ['> ATTENZIONE: fuga di informazioni verso il cartello', 'w', 8],
    ['> PROTOCOLLO «LA TALPA» ATTIVATO', 'e', 14]
  ];
  for (const [t, c, s] of L) { await typeLine(log, t, c, s); await sleep(90); }
  Snd.ping(); await sleep(600);
  const saved = store.get(RUNKEY);
  if (saved && saved.token) return riprendi(saved);
  toLogin();
}
function toLogin(keep = false) {
  state = 'login'; show('s-login');
  if (!keep) { $('#pid').value = ''; $('#ppin').value = ''; $('#pcod').value = ''; }
  $('#login-err').textContent = '';
  $('#login-go').disabled = false;
  if (!isMobile()) setTimeout(() => $('#pid').focus(), 300);
}
function loginErr(msg) { $('#login-err').textContent = msg; Snd.err(); bodyFx('shake', 400); }

let LOGIN = null;
async function doLogin(ev) {
  if (ev) ev.preventDefault();
  if (state !== 'login') return;
  const pattuglia = $('#pid').value.trim(), pin = $('#ppin').value.trim(), codice = $('#pcod').value.trim();
  if (!pattuglia) return loginErr('Inserire il nome della pattuglia');
  if (!pin) return loginErr('Inserire il PIN della pattuglia');
  if (!codice) return loginErr('Inserire il codice dato dall\'arbitro');
  if (!CFG.api) return loginErr('Terminale non collegato al server');
  $('#login-go').disabled = true; Snd.click();
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
  state = 'scan';
  const req = post({ azione: 'login', pattuglia, pin, codice }, 25000).then(r => r, () => null);
  const anim = scanAnim(pattuglia.toUpperCase());
  const res = await req;
  if (!res || !res.ok) {
    await anim.stop(false);
    toLogin(true);
    return loginErr(res ? res.messaggio || 'Accesso negato' : 'Rete non disponibile: riprovare');
  }
  LOGIN = res;
  $('#scan-pid').textContent = res.pattuglia.toUpperCase() + (res.prova ? ' · COLLAUDO' : '');
  await anim.stop(true);
  startBrief();
}

/* ================= scan ================= */
function scanAnim(label) {
  show('s-scan');
  const art = $('#scan-art'); art.classList.remove('ok', 'ko'); art.innerHTML = fingerprintSVG();
  $('#scan-pid').textContent = label;
  const txt = $('#scan-txt'), pct = $('#scan-pct'); txt.className = 'scan-txt';
  Snd.scan();
  const msgs = ['Verifica identità…', 'Lettura impronta…', 'Confronto database JTF…', 'Verifica autorizzazioni…'];
  const T0 = performance.now(), DUR = 2200;
  let done = false, cap = .92;
  const f = () => {
    if (done) return;
    const p = Math.min(cap, (performance.now() - T0) / DUR);
    pct.textContent = Math.floor(p * 100) + '%';
    txt.textContent = msgs[Math.min(msgs.length - 1, Math.floor(p / cap * msgs.length))];
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
  return {
    async stop(ok) {
      const wait = DUR - (performance.now() - T0); if (wait > 0) await sleep(ok ? wait : Math.min(wait, 600));
      done = true;
      if (ok) {
        pct.textContent = '100%'; art.classList.add('ok'); txt.className = 'scan-txt ok'; txt.textContent = 'Accesso autorizzato'; Snd.ok(); bodyFx('flash-ok');
        await sleep(1000);
      } else {
        art.classList.add('ko'); txt.className = 'scan-txt ko'; txt.textContent = 'Accesso negato'; bodyFx('flash-err');
        await sleep(700);
      }
    }
  };
}

/* ================= briefing ================= */
let briefReady = false;
async function startBrief() {
  state = 'brief'; briefReady = false;
  show('s-brief');
  $('#brief-pid').textContent = LOGIN.pattuglia;
  $('#brief-rules').textContent = `Tempo massimo ${fmt(LOGIN.limite)} · ogni errore −${LOGIN.penalita} s`;
  const go = $('#brief-go'); go.classList.remove('in'); go.disabled = false;
  $$('#brief-steps li').forEach(li => li.classList.remove('in'));
  const el = $('#brief-txt'); el.textContent = ''; el.classList.add('cur');
  const text = 'Il cartello conosce in anticipo ogni nostra mossa: dentro la task force c\'è una TALPA.\n' +
    'Abbiamo intercettato un messaggio cifrato partito dal suo telefono usa e getta.\n' +
    'La finestra d\'attacco è aperta: appena si accorgerà di noi, sparirà.';
  const sp = isMobile() ? 9 : 14;
  for (const ch of text) { if (state !== 'brief') return; el.textContent += ch; if (ch !== ' ' && Math.random() < .35) Snd.key(); await sleep(ch === '\n' ? 160 : sp); }
  el.classList.remove('cur');
  for (const li of $$('#brief-steps li')) { await sleep(200); li.classList.add('in'); Snd.step(); }
  await sleep(200); go.classList.add('in'); briefReady = true;
}
function skipBrief() {
  if (state !== 'brief' || briefReady) return;
  state = 'brief-skip';
  setTimeout(() => {
    state = 'brief';
    $('#brief-txt').classList.remove('cur');
    $('#brief-txt').textContent = 'Il cartello conosce in anticipo ogni nostra mossa: dentro la task force c\'è una TALPA.\nAbbiamo intercettato un messaggio cifrato partito dal suo telefono usa e getta.\nLa finestra d\'attacco è aperta: appena si accorgerà di noi, sparirà.';
    $$('#brief-steps li').forEach(li => li.classList.add('in'));
    $('#brief-go').classList.add('in'); briefReady = true;
  }, 30);
}

async function startCountdown() {
  if (!briefReady || !LOGIN || state !== 'brief') return;
  briefReady = false; state = 'count'; Snd.click(); $('#brief-go').disabled = true;
  show('s-count');
  const n = $('#count-num'), sub = $('#count-sub'); sub.textContent = '';
  const req = post({ azione: 'avvia', ticket: LOGIN.ticket }, 25000).then(r => ({ r, at: performance.now() }), () => null);
  const pop = v => { n.textContent = v; n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop'); };
  for (const v of ['3', '2', '1']) { pop(v); Snd.tick(); await sleep(800); }
  const slow = setTimeout(() => { sub.textContent = 'Collegamento al comando…'; }, 600);
  const got = await req;
  clearTimeout(slow); sub.textContent = '';
  if (!got || !got.r || !got.r.ok) {
    const msg = got && got.r ? got.r.messaggio : 'Rete non disponibile: ripetere l\'accesso';
    LOGIN = null; toLogin(true); return loginErr(msg || 'Errore');
  }
  const r = got.r;
  // allineamento al tempo del server: la prova è iniziata (o inizierà) all'istante S
  const t0 = got.at + (r.S - r.ora);
  const wait = t0 - performance.now();
  if (wait > 0) await sleep(wait);
  pop('VIA'); Snd.ok();
  await sleep(450);
  startMission(r, t0);
}

/* ================= missione ================= */
let R = null;  // tentativo in corso
function elapsed() { return R ? (performance.now() - R.t0) / 1000 : 0; }
function limitEff() { return Math.min(R.limite, R.finestra * 60 - (R.S - R.A) / 1000); }
function remaining() { return limitEff() - elapsed() - R.errors * R.penalita; }
function newRun(r, t0) {
  return { token: r.token, pattuglia: r.pattuglia, prova: r.prova, A: r.A, S: r.S, limite: r.limite, penalita: r.penalita, finestra: r.finestra,
    sc: r.sc, t0, errors: 0, phase: 0, done: [0, 0, 0], ended: false, busy: false, seq: 0, q: [], finito: null,
    shift: 0, rot: 0, call: -1, bsel: null, asel: null, lastSec: null, intel: {} };
}
function startMission(r, t0) {
  R = newRun(r, t0);
  persist();
  enterMission(1);
}
function enterMission(phase) {
  state = 'mission';
  $('#m-pid').textContent = R.pattuglia + (R.prova ? ' ·T' : '');
  $('#m-err').textContent = R.errors;
  $('#intel').innerHTML = '<li class="empty">Nessuna informazione raccolta</li>';
  $('#timer').className = 'timer';
  show('s-mission');
  keepAwake(true);
  clearInterval(R.tick); R.tick = setInterval(tick, 200); tick();
  if (R.done[0]) { addIntel('Ora chiamata', esc(R.intel.ora), true); addIntel('Tatuaggio', `${R.intel.T.e} ${esc(R.intel.T.w.toLowerCase())}`, true); }
  if (R.done[1]) addIntel('Luogo agganciato', '📍 ' + esc(B(R.intel.edificio)[isMobile() ? 'corto' : 'nome']), true);
  setPhase(phase);
}
function tick() {
  if (!R || R.ended) return;
  const rem = remaining(), s = Math.ceil(rem);
  $('#m-time').textContent = fmt(Math.max(0, rem));
  const frac = Math.max(0, Math.min(1, rem / R.limite));
  $('#tr-fg').style.strokeDashoffset = (176 * (1 - frac)).toFixed(1);
  const t = $('#timer'); t.classList.toggle('warn', rem <= 60 && rem > 20); t.classList.toggle('crit', rem <= 20);
  document.body.classList.toggle('danger', rem <= 10);
  if (s !== R.lastSec) { R.lastSec = s; if (rem <= 20 && rem > 0) Snd.tick(); }
  if (rem <= 0) timeUp();
}
function penalty(msg) {
  if (!R || R.ended) return;
  R.errors++;
  $('#m-err').textContent = R.errors;
  const p = document.createElement('div'); p.className = 'pen'; p.textContent = '−' + R.penalita + 's'; $('#timer').appendChild(p); setTimeout(() => p.remove(), 1300);
  Snd.err(); bodyFx('shake', 400); bodyFx('flash-err');
  toast(msg, 'err'); tick();
}
function addIntel(label, value, quiet) {
  const ul = $('#intel'); const e = ul.querySelector('.empty'); if (e) e.remove();
  const li = document.createElement('li'); li.innerHTML = `<small>${esc(label)}</small><b>${value}</b>`; ul.appendChild(li);
  if (!quiet) Snd.step();
}
function setPhase(n) {
  R.phase = n; R.busy = false;
  $$('#phases li').forEach(li => { const p = +li.dataset.p; li.className = p < n || R.done[p - 1] ? 'done' : p === n ? 'active' : ''; });
  const st = $('#stage');
  st.scrollTop = 0;
  if (n === 1) st.innerHTML = phase1HTML(); else if (n === 2) st.innerHTML = phase2HTML(); else st.innerHTML = phase3HTML();
  Snd.whoosh();
  if (n === 1) bindPhase1(); else if (n === 2) bindPhase2(); else bindPhase3();
}
function phaseDone(i) { R.done[i] = 1; $$('#phases li')[i].className = 'done'; }
async function verifica(fase, valore) { return (await sha256(R.token + '|' + fase + '|' + valore)) === R.sc.h[fase - 1]; }
function invia(fase, risposta, extra) { enqueue(Object.assign({ azione: 'tentativo', fase, risposta: String(risposta) }, extra || {})); }

/* ---------- fase 1: decrittazione ---------- */
const STEP = 360 / 26;
function phase1HTML() {
  const sc = R.sc;
  const ring = (r, cls, fn) => `<g class="${cls}">${Array.from({ length: 26 }, (_, i) => {
    const a = (i * STEP - 90) * Math.PI / 180; return `<text x="${(r * Math.cos(a)).toFixed(1)}" y="${(r * Math.sin(a)).toFixed(1)}" transform="rotate(${i * STEP} ${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)})">${fn(i)}</text>`;
  }).join('')}</g>`;
  const ticks = Array.from({ length: 26 }, (_, i) => { const a = (i * STEP - 90 + STEP / 2) * Math.PI / 180; return `<line x1="${117 * Math.cos(a)}" y1="${117 * Math.sin(a)}" x2="${123 * Math.cos(a)}" y2="${123 * Math.sin(a)}"/>`; }).join('');
  return `<div class="phase p1">
    <div class="ph-head"><div class="ph-num">01</div><div><h2>Decrittazione</h2>
      <p class="d-only">Il messaggio è cifrato con uno slittamento dell'alfabeto. <b>Ruota il disco</b> (trascina, oppure ◀ ▶ / frecce della tastiera) finché il testo diventa italiano leggibile, poi premi <b>Decritta</b>.</p>
      <p class="m-only"><b>Ruota il disco</b> (trascina o ◀ ▶) finché il messaggio è leggibile, poi <b>Decritta</b>.</p></div></div>
    <div class="p1-grid">
      <div class="wheel-wrap">
        <svg id="wheel" viewBox="-170 -190 340 360">
          <defs><radialGradient id="wg"><stop offset="0" stop-color="#0d2533"/><stop offset="1" stop-color="#06121a"/></radialGradient>
          <filter id="wglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
          <circle r="160" fill="url(#wg)" stroke="rgba(255,176,0,.45)" stroke-width="1.5"/>
          <circle r="120" fill="#081923" stroke="rgba(60,240,255,.4)" stroke-width="1.5"/>
          <g stroke="rgba(215,246,255,.25)">${ticks}</g>
          ${ring(141, 'outer', i => String.fromCharCode(65 + i))}
          <g class="inner" id="inner">
            <circle r="84" fill="none" stroke="rgba(60,240,255,.2)" stroke-dasharray="2 6"/>
            ${ring(102, '', i => String.fromCharCode(65 + i))}
            <g stroke="rgba(60,240,255,.5)" stroke-width="2"><line x1="0" y1="-60" x2="0" y2="60"/><line x1="-60" y1="0" x2="60" y2="0"/></g>
          </g>
          <circle r="46" fill="#03080c" stroke="rgba(60,240,255,.5)"/>
          <text y="-8" text-anchor="middle" fill="#6d8da0" font-size="10" letter-spacing="3" style="font-family:Menlo,monospace">CHIAVE</text>
          <text id="wkey" y="16" text-anchor="middle" fill="#fff" font-size="30" style="font-family:var(--head);font-weight:800">00</text>
          <path d="M0 -168 L-9 -184 L9 -184 Z" fill="#ffb000" filter="url(#wglow)"/>
          <rect x="-15" y="-160" width="30" height="80" rx="6" fill="rgba(255,176,0,.10)" stroke="rgba(255,176,0,.6)"/>
        </svg>
        <div class="wheel-ctrl"><button class="btn" id="w-prev" type="button" aria-label="ruota a sinistra">◀</button><div class="key d-only">Esterno = cifrato<br>Interno = in chiaro</div><button class="btn primary m-only" type="button" data-lock>Decritta</button><button class="btn" id="w-next" type="button" aria-label="ruota a destra">▶</button></div>
      </div>
      <div class="msg-wrap">
        <div class="msg-label">Flusso intercettato · ${esc(sc.num)} · 06/02/2027</div>
        <div class="msg cipher">${esc(sc.cifrato)}</div>
        <div class="msg-label">Anteprima decrittazione</div>
        <div class="msg plain" id="plain">${esc(sc.cifrato)}</div>
        <div class="lock-row d-only"><button class="btn primary" type="button" data-lock>Decritta</button><span class="hint">Un errore costa ${R.penalita} secondi</span></div>
      </div>
    </div></div>`;
}
function setShift(v) {
  if (!R || R.phase !== 1 || R.busy) return;
  const nv = ((v % 26) + 26) % 26; if (nv === R.shift) return;
  R.rot = (R.rot || 0) + (((nv - R.shift + 39) % 26) - 13);
  R.shift = nv;
  $('#inner').style.transform = `rotate(${R.rot * STEP}deg)`;
  $('#wkey').textContent = pad(nv);
  const pl = $('#plain'); pl.textContent = rot(R.sc.cifrato, -nv); pl.classList.remove('flick'); void pl.offsetWidth; pl.classList.add('flick');
  Snd.step();
}
function bindPhase1() {
  R.shift = 0; R.rot = 0;
  $('#w-prev').onclick = () => setShift(R.shift - 1);
  $('#w-next').onclick = () => setShift(R.shift + 1);
  $$('[data-lock]').forEach(b => b.onclick = lockCipher);
  const w = $('#wheel');
  let drag = null;
  const ang = e => { const r = w.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
  w.addEventListener('pointerdown', e => { drag = { a: ang(e), acc: 0 }; try { w.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } w.classList.add('dragging'); e.preventDefault(); });
  w.addEventListener('pointermove', e => {
    if (!drag) return; const a = ang(e); let d = a - drag.a; if (d > 180) d -= 360; if (d < -180) d += 360; drag.a = a; drag.acc += d;
    while (drag.acc >= STEP / 1.4) { drag.acc -= STEP; setShift(R.shift + 1); }
    while (drag.acc <= -STEP / 1.4) { drag.acc += STEP; setShift(R.shift - 1); }
  });
  const up = () => { drag = null; w.classList.remove('dragging'); };
  w.addEventListener('pointerup', up); w.addEventListener('pointercancel', up);
  let wacc = 0;
  w.addEventListener('wheel', e => { e.preventDefault(); wacc += e.deltaY; if (Math.abs(wacc) >= 40) { setShift(R.shift + Math.sign(wacc)); wacc = 0; } }, { passive: false });
}
async function lockCipher() {
  if (!R || R.phase !== 1 || R.busy || R.ended) return;
  R.busy = true;
  const k = R.shift, ok = await verifica(1, k);
  invia(1, k);
  const pl = $('#plain');
  if (!ok) { R.busy = false; pl.classList.remove('bad'); void pl.offsetWidth; pl.classList.add('bad'); return penalty('Decrittazione fallita'); }
  Snd.ok(); bodyFx('flash-ok');
  const v = svela(R.sc.cifrato, k);
  R.intel.ora = v.ora; R.intel.T = v.T; R.intel.chiave = k;
  pl.classList.add('ok');
  pl.innerHTML = esc(v.chiaro).replace(v.ora, `<mark>${v.ora}</mark>`).replace(v.T.w, `<mark>${v.T.w}</mark>`);
  $$('[data-lock]').forEach(b => { b.disabled = true; b.textContent = 'Decrittato'; });
  phaseDone(0);
  await sleep(450); addIntel('Ora chiamata', esc(v.ora));
  await sleep(400); addIntel('Tatuaggio', `${v.T.e} ${esc(v.T.w.toLowerCase())}`);
  await sleep(1300);
  if (!R.ended) setPhase(2);
}

/* ---------- fase 2: triangolazione ---------- */
const km = d => (d * METRI / 1000).toFixed(2).replace('.', ',') + ' km';
function phase2HTML() {
  const sc = R.sc;
  return `<div class="phase p2">
    <div class="ph-head"><div class="ph-num">02</div><div><h2>Triangolazione</h2>
      <p class="d-only">Nel registro scegli <b>la chiamata della talpa</b> (usa l'ora decrittata): ogni torre traccia un cerchio alla distanza del telefono. <b>Clicca l'edificio</b> dove si incontrano i tre cerchi e aggancia il segnale.</p>
      <p class="m-only">Scegli la chiamata delle <b>${esc(R.intel.ora || '—')}</b>, poi tocca l'<b>edificio</b> dove si incrociano i tre cerchi.</p></div></div>
    <div class="p2-grid">
      <div class="map-wrap" id="map-wrap"></div>
      <div class="calllog glass">
        <h4>Registro chiamate · telefono usa e getta</h4>
        <div class="calls">${sc.chiamate.map((c, i) => `<button type="button" class="call" data-i="${i}"><span class="t">${esc(c.ora)}</span><span class="cinfo"><span class="n">${esc(c.num)}</span><span class="d">durata ${esc(c.dur)}</span></span><span class="d arr">▶</span></button>`).join('')}</div>
        <div class="towers-legend" id="tlegend">${TOWERS.map(t => `<div><span>Torre ${t.id}</span><b style="color:${t.col}" data-t="${t.id}">—</b></div>`).join('')}</div>
        <div class="lockbar"><div class="selbox">Edificio selezionato<b id="bsel">—</b></div>
        <button class="btn primary" id="b-lock" type="button" disabled>Aggancia segnale</button></div>
      </div>
    </div></div>`;
}
function renderMap() {
  const wrap = $('#map-wrap'); if (!wrap) return;
  wrap.innerHTML = mapSVG() + '<div class="sweep"></div>';
  wrap.classList.toggle('portrait', MAPV);
  $$('#map .bld').forEach(el => el.onclick = () => selectBld(el.dataset.id));
  if (R.call >= 0) drawRings(R.call, false);
  if (R.bsel) $$('#map .bld').forEach(el => el.classList.toggle('sel', el.dataset.id === R.bsel));
}
function bindPhase2() {
  R.call = -1; R.bsel = null;
  renderMap();
  $$('.call').forEach(el => el.onclick = () => selectCall(+el.dataset.i));
  $('#b-lock').onclick = lockBld;
}
function drawRings(i, anim) {
  const c = R.sc.chiamate[i], g = $('#rings'); if (!g) return; g.innerHTML = '';
  TOWERS.forEach((t, k) => {
    const Rr = Number(c.r[k]) || 0, [cx, cy] = MP(t.x, t.y);
    const lg = $(`#tlegend b[data-t="${t.id}"]`); if (lg) lg.textContent = km(Rr);
    const ns = 'http://www.w3.org/2000/svg';
    const f = document.createElementNS(ns, 'circle'); f.setAttribute('class', 'ringfill'); f.setAttribute('cx', cx); f.setAttribute('cy', cy); f.setAttribute('fill', t.col);
    const cc = document.createElementNS(ns, 'circle'); cc.setAttribute('class', 'ring'); cc.setAttribute('cx', cx); cc.setAttribute('cy', cy); cc.setAttribute('stroke', t.col);
    g.appendChild(f); g.appendChild(cc);
    if (!anim) { cc.setAttribute('r', Rr); f.setAttribute('r', Rr); return; }
    cc.setAttribute('r', 0); f.setAttribute('r', 0);
    const T0 = performance.now() + k * 160, D = 900;
    const an = now => {
      const p = Math.max(0, Math.min(1, (now - T0) / D)), e = 1 - Math.pow(1 - p, 3);
      cc.setAttribute('r', (Rr * e).toFixed(1)); f.setAttribute('r', (Rr * e).toFixed(1));
      if (p < 1) requestAnimationFrame(an);
    };
    requestAnimationFrame(an);
  });
}
function selectCall(i) {
  if (R.busy || R.phase !== 2) return;
  R.call = i; Snd.ping();
  $$('.call').forEach(el => el.classList.toggle('on', +el.dataset.i === i));
  drawRings(i, true);
}
function selectBld(id) {
  if (R.busy || R.phase !== 2) return;
  R.bsel = id; Snd.click();
  $$('#map .bld').forEach(el => el.classList.toggle('sel', el.dataset.id === id));
  $('#bsel').textContent = B(id).nome;
  $('#b-lock').disabled = false;
}
async function lockBld() {
  if (!R || R.phase !== 2 || R.busy || R.ended || !R.bsel) return;
  R.busy = true;
  const id = R.bsel, ok = await verifica(2, id);
  invia(2, id);
  const el = $(`#map .bld[data-id="${id}"]`);
  if (!ok) {
    R.busy = false;
    if (el) { el.classList.add('bad'); setTimeout(() => el.classList.remove('bad'), 900); }
    return penalty('Nessun segnale in ' + B(id).nome);
  }
  Snd.ok(); bodyFx('flash-ok');
  R.intel.edificio = id;
  if (el) { el.classList.remove('sel'); el.classList.add('win'); }
  const [x, y] = MP(B(id).x, B(id).y), cr = $('#cross');
  cr.setAttribute('transform', `translate(${x} ${y})`);
  cr.innerHTML = `<g><circle r="46" fill="none" stroke="#39ff88" stroke-width="2.5" filter="url(#glow)"/><circle r="64" fill="none" stroke="#39ff88" stroke-width="1" stroke-dasharray="4 6"/><path d="M0 -80 V-50 M0 50 V80 M-80 0 H-50 M50 0 H80" stroke="#39ff88" stroke-width="3"/></g>`;
  cr.classList.add('on');
  const lk = document.createElement('div'); lk.className = 'lockon'; lk.innerHTML = '<div>Segnale agganciato</div>'; $('#map-wrap').appendChild(lk);
  $('#b-lock').disabled = true;
  phaseDone(1);
  await sleep(550); addIntel('Luogo agganciato', '📍 ' + esc(B(id)[isMobile() ? 'corto' : 'nome']));
  await sleep(1500);
  if (!R.ended) setPhase(3);
}

/* ---------- fase 3: identificazione ---------- */
function phase3HTML() {
  const sc = R.sc, ora = esc(R.intel.ora || '—');
  return `<div class="phase p3">
    <div class="ph-head"><div class="ph-num">03</div><div><h2>Identificazione</h2>
      <p class="d-only">Incrocia il dossier: la talpa ha il <b>tatuaggio</b> del messaggio <b>e</b> alle <b>${ora}</b> il suo GPS di servizio era nel <b>luogo agganciato</b>. Seleziona l'agente e procedi all'arresto.</p>
      <p class="m-only">La talpa ha il tatuaggio <b>${R.intel.T ? esc(R.intel.T.e + ' ' + R.intel.T.w.toLowerCase()) : '—'}</b> e alle <b>${ora}</b> era a <b>${R.intel.edificio ? esc(B(R.intel.edificio).corto) : '—'}</b>.</p></div></div>
    <div class="agents">${sc.agenti.map((a, i) => `<button type="button" class="agent" data-uid="${esc(a.uid)}" style="animation-delay:${i * 70}ms">
      <span class="ph">${avatarSVG(a.av || {})}</span>
      <span class="info"><span class="nm">Ag. ${esc(a.n)}</span><span class="ag">${esc(a.a)} · ${esc(a.mat)}</span>
        <span class="row"><span>Tatuaggio</span><b><em>${esc(a.t.e)}</em>${esc(String(a.t.w).toLowerCase())}</b></span>
        <span class="row"><span>GPS ore ${ora}</span><b><em class="m-only">📍</em>${esc((B(a.b) || {})[isMobile() ? 'corto' : 'nome'] || a.b)}</b></span></span>
      <span class="stamp">Scagionato</span></button>`).join('')}</div>
    <div class="p3-foot"><div class="selbox">Agente selezionato<b id="asel">—</b></div><button class="btn primary" id="a-lock" type="button" disabled>Arresta</button></div>
  </div>`;
}
function bindPhase3() {
  R.asel = null;
  $$('.agent').forEach(el => el.onclick = () => {
    if (R.busy || el.classList.contains('out')) return;
    R.asel = el.dataset.uid; Snd.click();
    $$('.agent').forEach(x => x.classList.toggle('sel', x === el));
    $('#asel').textContent = 'Ag. ' + R.sc.agenti.find(a => a.uid === R.asel).n;
    $('#a-lock').disabled = false;
  });
  $('#a-lock').onclick = lockAgent;
}
async function lockAgent() {
  if (!R || R.phase !== 3 || R.busy || R.ended || !R.asel) return;
  R.busy = true;
  const uid = R.asel, ok = await verifica(3, uid);
  const t = Math.round(elapsed() * 1000);
  const a = R.sc.agenti.find(x => x.uid === uid), el = $(`.agent[data-uid="${CSS.escape(uid)}"]`);
  if (!ok) {
    invia(3, uid);
    R.busy = false;
    el.classList.remove('sel'); el.classList.add('out'); R.asel = null; $('#asel').textContent = '—'; $('#a-lock').disabled = true;
    return penalty('Agente scagionato: alibi confermato');
  }
  R.ended = true; clearInterval(R.tick); document.body.classList.remove('danger');
  invia(3, uid, { t });
  R.done[2] = 1; R.moleUid = uid;
  Snd.win(); bodyFx('flash-ok');
  el.classList.remove('sel'); el.classList.add('mole'); el.querySelector('.stamp').textContent = 'Talpa';
  $$('.agent').forEach(x => { if (x !== el) x.classList.add('out'); });
  $('#a-lock').disabled = true;
  phaseDone(2);
  addIntel('Talpa identificata', '🕵️ Ag. ' + esc(a.n));
  await sleep(2000);
  attendiEsito();
}

/* ---------- fine ---------- */
function timeUp() {
  if (!R || R.ended) return;
  R.ended = true; clearInterval(R.tick); document.body.classList.remove('danger');
  Snd.lose(); bodyFx('flash-err');
  toast('Tempo scaduto', 'err');
  enqueue({ azione: 'scaduto' });
  setTimeout(attendiEsito, 900);
}
let waitingEsito = false, esitoT = 0;
function attendiEsito() {
  if (!R) return;
  waitingEsito = true;
  if (R.finito) return onFinito();
  state = 'sending';
  $('#net').classList.add('on', 'send');
  pump();
  // rete persa a metà: se la coda è vuota e l'esito non è arrivato, lo si chiede al server
  clearInterval(esitoT);
  esitoT = setInterval(async () => {
    if (!R || R.finito || state !== 'sending') return clearInterval(esitoT);
    if (Q.busy || R.q.length) return;
    let res = null;
    try { res = await post({ azione: 'stato', token: R.token }, 12000); } catch (e) { res = null; }
    if (!R || state !== 'sending' || !res) return;
    if (!res.ok && res.errore === 'annullata') { clearInterval(esitoT); return annullata(res.messaggio); }
    if (res.ok && res.finito) { clearInterval(esitoT); R.finito = res.finito; onFinito(); }
  }, 3000);
}
function onFinito() {
  if (!R || !R.finito || state === 'resume') return;
  if (!R.ended) { R.ended = true; clearInterval(R.tick); document.body.classList.remove('danger'); }
  if (!waitingEsito && state === 'mission' && R.finito.esito === 'SUPERATA') return; // l'animazione dell'arresto è in corso
  $('#net').classList.remove('on', 'send');
  waitingEsito = false;
  showResult(R.finito);
}
function confetti() {
  const cols = ['#3cf0ff', '#39ff88', '#ffb000', '#ff4fd8', '#ffffff'];
  const n = isMobile() ? 50 : 90;
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div'); c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw'; c.style.background = cols[i % cols.length];
    c.style.animationDuration = (2.2 + Math.random() * 2.2) + 's'; c.style.animationDelay = (Math.random() * .6) + 's';
    c.style.opacity = .85; document.body.appendChild(c); setTimeout(() => c.remove(), 5200);
  }
}
function showResult(f) {
  clearInterval(esitoT);
  state = 'result'; keepAwake(false);
  const ok = f.esito === 'SUPERATA';
  const mole = ok && R && R.moleUid ? R.sc.agenti.find(a => a.uid === R.moleUid) : null;
  $('#result').innerHTML = `
    <div class="r-kicker">Pattuglia ${esc(f.pattuglia)}${f.prova ? ' · collaudo' : ''}</div>
    <h2>${ok ? 'Operazione conclusa' : 'Tempo scaduto'}</h2>
    <div class="r-stamp ${ok ? 'win' : 'lose'}">${ok ? 'Talpa smascherata' : 'Missione incompleta'}</div>
    ${mole ? `<div class="r-mole"><div class="ph">${avatarSVG(mole.av || {})}</div><div><small>In stato di arresto</small><b>Ag. ${esc(mole.n)}</b><br><span class="r-mat">${esc(mole.a)} · ${esc(mole.mat)}</span></div></div>` : ''}
    <div class="r-stats">
      <div><small>Tempo prova</small><b>${fmtMs(f.tp)}</b></div>
      <div><small>Errori</small><b class="${f.errori ? 'r' : 'g'}">${f.errori}</b></div>
      <div><small>Prove superate</small><b class="${ok ? 'g' : 'a'}">${f.fasi.filter(Boolean).length}/3</b></div>
      <div><small>Punti OBJ 7</small><b class="g">${f.totale}</b><span class="r-split">${f.punti} + bonus ${f.bonus}</span></div>
    </div>
    <div class="r-times"><span>Apertura finestra <b>${esc(f.apertura)}</b></span><span>Inizio <b>${esc(f.inizio)}</b></span><span>Fine <b>${esc(f.fine)}</b></span></div>
    <div class="r-note">Tempo comprensivo di ${f.penalita} s di penalità · bonus di 10 pt per ogni minuto intero risparmiato sulla finestra d'attacco di ${f.finestra}′ (usati ${fmtMs(f.tf)})<br>Risultato registrato · mostrare questa schermata all'arbitro</div>
    <button class="btn primary" id="r-close" type="button">Chiudi sessione</button>`;
  show('s-result');
  if (ok) { Snd.win(); confetti(); } else Snd.lose();
  $('#r-close').onclick = () => { Snd.click(); chiudiSessione(); };
}
function chiudiSessione() {
  if (R) clearInterval(R.tick);
  R = null; LOGIN = null; store.del(RUNKEY); keepAwake(false);
  toLogin();
}
function annullata(msg) {
  if (R) clearInterval(R.tick);
  R = null; LOGIN = null; store.del(RUNKEY); keepAwake(false); document.body.classList.remove('danger');
  $('#net').classList.remove('on', 'send');
  toLogin();
  loginErr(msg || 'Tentativo annullato dalla direzione evento');
}

/* ---------- ripresa dopo un ricaricamento ---------- */
async function riprendi(saved) {
  state = 'resume';
  const sub = $('#count-sub'); show('s-count'); $('#count-num').textContent = '…'; sub.textContent = 'Ripristino della sessione…';
  // prima gli eventi rimasti in coda, poi lo stato aggiornato
  R = { token: saved.token, seq: saved.seq || 0, q: saved.q || [], errors: 0 };
  let tries = 0;
  while (R && R.q.length && tries < 6) { await pump(); if (R && R.q.length) { tries++; await sleep(1500); } }
  if (!R) return;
  let res = null;
  for (let i = 0; i < 6 && !res; i++) { try { res = await post({ azione: 'stato', token: saved.token }, 15000); } catch (e) { res = null; await sleep(1500); } }
  sub.textContent = '';
  if (!res || !res.ok) {
    R = null;
    if (res) store.del(RUNKEY);
    toLogin(); if (res) loginErr(res.messaggio || 'Sessione non più valida'); else loginErr('Rete non disponibile: ricaricare la pagina');
    return;
  }
  const at = performance.now();
  const r = Object.assign({}, res);
  const nr = newRun(r, at - (r.ora - r.S));
  nr.seq = Math.max(saved.seq || 0, res.seq || 0); nr.errors = res.errori || 0; nr.done = res.fasi || [0, 0, 0];
  if (res.svelato && res.svelato.chiave != null) { const v = svela(r.sc.cifrato, res.svelato.chiave); nr.intel.ora = v.ora; nr.intel.T = v.T; }
  if (res.svelato && res.svelato.edificio) nr.intel.edificio = res.svelato.edificio;
  R = nr; persist();
  if (res.finito) { R.ended = true; R.finito = res.finito; return showResult(res.finito); }
  const phase = R.done[0] ? (R.done[1] ? 3 : 2) : 1;
  enterMission(phase);
}

/* ================= input globale ================= */
document.addEventListener('keydown', e => {
  if (state === 'standby') { startBoot(); return; }
  if (state === 'brief' && e.key === 'Enter') { if (briefReady) startCountdown(); else skipBrief(); return; }
  if (state === 'mission' && R && R.phase === 1) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setShift(R.shift - 1); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setShift(R.shift + 1); }
    if (e.key === 'Enter') lockCipher();
  }
});
$('#s-boot').addEventListener('click', startBoot);
$('#login-form').addEventListener('submit', doLogin);
$('#pid').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#ppin').focus(); } });
$('#ppin').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#pcod').focus(); } });
$('#brief-go').addEventListener('click', startCountdown);
$('#s-brief').addEventListener('click', e => { if (!e.target.closest('#brief-go')) skipBrief(); });
window.addEventListener('beforeunload', e => { if (state === 'mission' || state === 'sending') { e.preventDefault(); e.returnValue = ''; } });
let rzT = 0;
addEventListener('resize', () => {
  clearTimeout(rzT);
  rzT = setTimeout(() => { if (state === 'mission' && R && R.phase === 2 && !R.done[1] && $('#map-wrap') && MAPV !== isPortraitMap()) renderMap(); }, 200);
});
initStatic();
if (!CFG.api) console.warn('TALPA_CONFIG.api non impostato');
window.__talpa = { get R() { return R; }, get state() { return state; } };
})();
