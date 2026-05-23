// ═══════════════════════════════════════════════════════════════════════════════
// OraaSlayer Servers Page v4.1 - Golden Mind Production
// Unified Design | Lucide Icons | Same Header/Footer as home.js
// 🔥 Patched: Dynamic Params/Query extraction, Click events, Strict Navigation
// ═══════════════════════════════════════════════════════════════════════════════

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/* ───────────────────────── Firebase Config ───────────────────────── */
const FB_CONFIG = {
  apiKey: "AIzaSyBDMFcCvthKNkHUrEbgYY1Uc80KTPpS01M",
  authDomain: "oraa-slayer-anime.firebaseapp.com",
  projectId: "oraa-slayer-anime",
  storageBucket: "oraa-slayer-anime.firebasestorage.app",
  messagingSenderId: "426607460785",
  appId: "1:426607460785:web:c8d9844253c9111ad3bd90"
};
const FB = getApps().length ? getApp() : initializeApp(FB_CONFIG);
const auth = getAuth(FB);
const db = getFirestore(FB);

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN SERVERS MODULE
   ═══════════════════════════════════════════════════════════════════════════════ */
export default async function Servers(ctx) {
  const { root, go, onCleanup } = ctx;
  const cleanup = [];
  const doc$ = document;
  const win = window;
  const ac = new AbortController();
  const timers = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. META & SEO
  // ═══════════════════════════════════════════════════════════════════════════
  const setMeta = (name, content) => {
    let el = doc$.head.querySelector(`meta[name="${name}"]`);
    if (!el) { el = doc$.createElement('meta'); el.name = name; doc$.head.appendChild(el); }
    el.content = content;
  };
  setMeta('viewport', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
  setMeta('theme-color', '#0B1A3A');
  doc$.title = 'OraaSlayer | اختيار السيرفر';
  win.scrollTo({ top: 0, behavior: 'instant' });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. FONT LOADING
  // ═══════════════════════════════════════════════════════════════════════════
  if (!doc$.getElementById('font-cairo')) {
    const link = doc$.createElement('link');
    link.id = 'font-cairo';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap';
    doc$.head.appendChild(link);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. LUCIDE ICONS (Unified with home.js)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!win.lucide) {
    await new Promise((res) => {
      const s = doc$.createElement('script');
      s.src = 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js';
      s.async = true;
      s.onload = res;
      s.onerror = () => {
        const s2 = doc$.createElement('script');
        s2.src = 'https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js';
        s2.async = true;
        s2.onload = res;
        s2.onerror = res;
        doc$.head.appendChild(s2);
      };
      doc$.head.appendChild(s);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  const escapeHTML = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  
  const spaNav = (path) => {
    if (typeof go === 'function') return go(path);
    if (typeof win.go === 'function') return win.go(path);
    location.href = path;
  };

  const readPlayData = () => {
    try {
      const raw = localStorage.getItem('_play_data');
      if (!raw) return null;
      return JSON.parse(decodeURIComponent(atob(raw)));
    } catch {
      try { return JSON.parse(localStorage.getItem('_play_data')); } catch { return null; }
    }
  };

  const writePlayData = (data) => {
    try { localStorage.setItem('_play_data', btoa(encodeURIComponent(JSON.stringify(data)))); } catch {}
  };

  const getServerMeta = (name) => {
    const n = (name || '').toLowerCase();
    if (n.includes('drive') || n.includes('google')) return { cls: 'si-gd', label: 'GD', display: 'Google Drive', icon: 'cloud' };
    if (n.includes('h100')) return { cls: 'si-h100', label: 'H100', display: 'H100', icon: 'zap' };
    if (n.includes('youtube') || n.includes('yt')) return { cls: 'si-yt', label: 'YT', display: 'YouTube', icon: 'play' };
    if (n.includes('ok')) return { cls: 'si-ok', label: 'OK', display: 'Ok.ru', icon: 'globe' };
    if (n.includes('mp4upload') || n.includes('mp4')) return { cls: 'si-mp4', label: 'MP4', display: name || 'MP4Upload', icon: 'play' };
    if (n.includes('embed') || n.includes('default')) return { cls: 'si-mp', label: 'EMB', display: name || 'Embedded', icon: 'globe' };
    return { cls: 'si-other', label: 'SRV', display: name || 'سيرفر', icon: 'server' };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. UNIFIED STYLES (Same as anime.js)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!doc$.getElementById('servers-styles')) {
    const style = doc$.createElement('style');
    style.id = 'servers-styles';
    style.textContent = `
:root {
  --c1:#0B1A3A;--c2:#152D5A;--c3:#3A7BD5;--c4:#D6EAF8;--c-deep:#06122A;
  --gold:#FFCA28;--gold-soft:rgba(255,202,40,.12);--gold-glow:rgba(255,202,40,.4);
  --red:#FF4757;--red-soft:rgba(255,71,87,.12);--green:#2ED573;
  --bg:var(--c1);--surface:rgba(12,24,48,.85);--glass:rgba(10,20,40,.65);
  --text:#F8FAFC;--text-secondary:rgba(214,234,248,.85);
  --text-dim:rgba(255,255,255,.75);--text-muted:rgba(189,215,238,.5);
  --border:rgba(189,215,238,.12);--border-gold:rgba(255,202,40,.25);
  --header-h:64px;--footer-h:70px;--sidebar-w:260px;
  --safe-top:env(safe-area-inset-top,0px);--safe-bottom:env(safe-area-inset-bottom,0px);
  --page-pad:clamp(.5rem,1.4vw,1.2rem);--app-height:100vh;
}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html{scroll-behavior:smooth;width:100%;max-width:100%}
body{font-family:'Cairo',sans-serif;background:var(--bg);color:var(--text);direction:rtl;min-height:100vh;overflow-x:hidden;line-height:1.65;touch-action:pan-y}
img,svg,video{max-width:100%;height:auto;display:block}
button,a,input{touch-action:manipulation;-webkit-user-select:none;user-select:none}

/* ─── Animated Background ────────────────────────────────────── */
.animated-bg{position:fixed;inset:0;z-index:-2;background:linear-gradient(160deg,var(--c1) 0%,#081428 45%,var(--c2) 75%,#0a1832 100%)}
.pixel-container{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;display:none}
@media(min-width:768px){.pixel-container{display:block}.animated-bg{background:linear-gradient(-45deg,var(--c1),var(--c2),var(--c3),var(--c4));background-size:400% 400%;animation:gradientFlow 28s ease infinite}}
@keyframes gradientFlow{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
.pixel{position:absolute;background:rgba(189,215,238,.08);bottom:-120px;border-radius:4px;animation:floatUp 32s linear infinite;will-change:transform}
.pixel:nth-child(1){left:12%;width:36px;height:36px;animation-delay:0s;opacity:.25}
.pixel:nth-child(2){left:45%;width:22px;height:22px;animation-delay:9s}
.pixel:nth-child(3){left:75%;width:32px;height:32px;animation-delay:16s;opacity:.2}
@keyframes floatUp{0%{transform:translateY(0) rotate(0deg);opacity:0}10%{opacity:.25}90%{opacity:.25}100%{transform:translateY(-1100px) rotate(360deg);opacity:0}}

/* ─── Main Header ────────────────────────────────────────────── */
.main-header{position:fixed;top:0;left:0;right:0;height:calc(var(--header-h) + var(--safe-top));padding-top:var(--safe-top);background:rgba(8,18,38,.72);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);display:flex;align-items:center;justify-content:space-between;padding-inline:1rem;z-index:1000;box-shadow:0 10px 35px rgba(0,0,0,.3);border-bottom:1px solid var(--border)}
.main-header--scrolled{background:rgba(8,18,38,.92)}
.header-group{display:flex;align-items:center;gap:.8rem}
.icon-btn{width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--c4);transition:all .16s ease}
.icon-btn:hover{background:rgba(255,255,255,.1);transform:translateY(-1px)}.icon-btn:active{transform:scale(.93)}
.icon-btn svg,.icon-btn i{width:22px;height:22px;stroke-width:2}
.brand{font-size:1.28rem;font-weight:900;color:var(--c4);text-shadow:0 2px 6px rgba(0,0,0,.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:clamp(110px,30vw,260px);letter-spacing:.2px}

/* ─── Main Content ───────────────────────────────────────────── */
.main-content{
  padding-top:calc(var(--header-h) + var(--safe-top) + 10px);
  padding-bottom:calc(var(--footer-h) + var(--safe-bottom) + 20px);
  min-height:var(--app-height);
}
@media(min-width:1024px){
  .main-content{padding-right:var(--sidebar-w);padding-bottom:20px;max-width:900px;margin:0 auto}
}

/* ─── Hero Section ───────────────────────────────────────────── */
.hero-section{
  position:relative;border-radius:20px;overflow:hidden;
  margin:0 var(--page-pad) 16px;
  background:var(--surface);border:1px solid var(--border);
  box-shadow:0 12px 30px rgba(0,0,0,.25);
}
.hero-bg{
  position:absolute;inset:0;background-size:cover;background-position:center 25%;
  filter:brightness(.35) saturate(1.1);
  mask-image:linear-gradient(to bottom,black 60%,transparent 100%);
  -webkit-mask-image:linear-gradient(to bottom,black 60%,transparent 100%);
}
.hero-overlay{
  position:absolute;inset:0;
  background:linear-gradient(to top,var(--surface) 0%,rgba(12,24,48,.4) 50%,rgba(12,24,48,.2) 100%);
}
.hero-content{position:relative;z-index:5;padding:20px 16px;display:flex;align-items:flex-end;gap:14px}
.hero-poster{width:85px;height:122px;border-radius:14px;object-fit:cover;flex-shrink:0;border:2px solid var(--gold);box-shadow:0 8px 24px rgba(0,0,0,.4)}
.hero-poster-ph{width:85px;height:122px;border-radius:14px;flex-shrink:0;border:2px solid rgba(255,202,40,.2);background:linear-gradient(110deg,var(--surface) 30%,rgba(21,45,90,.4) 50%,var(--surface) 70%);background-size:200% 100%;animation:shimmer 1.8s infinite linear}
.hero-info{flex:1;min-width:0}
.hero-title{font-size:1.05rem;font-weight:800;line-height:1.4;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.hero-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:.72rem;color:var(--text-dim)}
.hero-dot{width:3px;height:3px;background:var(--text-dim);border-radius:50%;flex-shrink:0}
.hero-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:.66rem;font-weight:700}
.chip-ep{background:rgba(58,123,213,.15);color:var(--c3);border:1px solid rgba(58,123,213,.25)}
.chip-hd{background:rgba(46,213,115,.15);color:var(--green);border:1px solid rgba(46,213,115,.25)}
.hero-chip svg{width:12px;height:12px}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}

/* ─── Server Section ─────────────────────────────────────────── */
.server-section{padding:0 var(--page-pad);max-width:800px;margin:0 auto}
.server-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.server-title{font-size:.9rem;font-weight:700;display:flex;align-items:center;gap:10px;color:var(--text)}
.server-title svg{width:20px;height:20px;color:var(--c3)}
.server-count{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;padding:0 8px;background:linear-gradient(135deg,var(--c2),var(--c3));color:#fff;font-size:.7rem;font-weight:900;border-radius:999px}

/* ─── Server Cards ───────────────────────────────────────────── */
.server-grid{display:flex;flex-direction:column;gap:10px}
.server-card{
  display:flex;align-items:center;gap:14px;padding:16px;
  background:var(--surface);border:1px solid var(--border);
  border-radius:16px;cursor:pointer;transition:all .2s ease;
  position:relative;overflow:hidden;backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px);
}
.server-card:hover{border-color:var(--gold);background:rgba(21,45,90,.4);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.3),0 0 0 1px rgba(255,202,40,.15)}
.server-card:active{transform:scale(.98)}
.server-card::after{content:'';position:absolute;top:0;right:0;width:3px;height:0;background:linear-gradient(to bottom,var(--c3),var(--gold));transition:height .3s ease;border-radius:0 3px 3px 0}
.server-card:hover::after{height:100%}

.server-icon{
  width:50px;height:50px;border-radius:14px;display:flex;align-items:center;justify-content:center;
  font-weight:900;font-size:.7rem;color:#fff;flex-shrink:0;
}
.si-gd{background:linear-gradient(135deg,#4285f4,#34a853)}
.si-h100{background:linear-gradient(135deg,#ff6b35,#f7c948)}
.si-yt{background:#ff0000}
.si-ok{background:#ff8c00}
.si-mp4{background:linear-gradient(135deg,var(--c2),var(--c3))}
.si-mp{background:linear-gradient(135deg,#6366f1,#8b5cf6)}
.si-other{background:rgba(255,255,255,.1)}
.server-icon svg{width:22px;height:22px}

.server-info{flex:1;min-width:0}
.server-name{font-weight:700;font-size:.9rem;margin-bottom:4px}
.server-tags{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.server-tag{font-size:.64rem;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.06);color:var(--text-dim);border:1px solid rgba(255,255,255,.06)}
.server-tag.best{background:var(--gold-soft);color:var(--gold);border-color:var(--border-gold)}
.server-sub{font-size:.66rem;color:var(--text-dim);margin-top:4px;opacity:.6}

.server-arrow{
  width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:rgba(255,255,255,.04);color:var(--text-dim);transition:all .2s;flex-shrink:0;
}
.server-arrow svg{width:18px;height:18px}
.server-card:hover .server-arrow{background:var(--gold);color:#000;transform:scale(1.1)}

/* ─── Quality Section ────────────────────────────────────────── */
.quality-section{margin-top:20px;padding-top:16px;border-top:1px solid var(--border)}
.quality-header{font-size:.78rem;font-weight:700;color:var(--text-dim);margin-bottom:10px;display:flex;align-items:center;gap:6px}
.quality-header svg{width:14px;height:14px;color:var(--green)}
.quality-badges{display:flex;gap:8px;flex-wrap:wrap}
.quality-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);font-size:.74rem;font-weight:600;color:var(--text-dim);transition:all .15s}
.quality-badge:hover{border-color:var(--c3);color:#fff}

/* ─── Skeleton Loading ───────────────────────────────────────── */
.skel{background:linear-gradient(110deg,var(--surface) 30%,rgba(21,45,90,.4) 50%,var(--surface) 70%);background-size:200% 100%;animation:shimmer 1.8s infinite linear;border-radius:10px}
.skel-line{height:13px;margin-bottom:7px}
.skel-title{height:20px;width:60%;margin-bottom:8px}
.skel-card{display:flex;align-items:center;gap:14px;padding:16px;background:rgba(12,24,48,.3);border:1px solid var(--border);border-radius:16px;pointer-events:none}
.skel-icon{width:50px;height:50px;border-radius:14px;flex-shrink:0}

/* ─── Empty / Error State ────────────────────────────────────── */
.empty-state{text-align:center;padding:40px 20px;background:rgba(12,24,48,.3);border:1px dashed var(--border);border-radius:16px}
.empty-state svg{width:48px;height:48px;color:var(--text-dim);margin-bottom:14px}
.empty-state h3{font-size:1rem;font-weight:700;margin-bottom:6px}
.empty-state p{font-size:.82rem;color:var(--text-dim);max-width:280px;margin:0 auto 16px;line-height:1.7}
.btn-home{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:999px;background:var(--gold);color:#000;font-weight:700;font-size:.84rem;cursor:pointer;border:none;transition:opacity .15s;font-family:'Cairo',sans-serif}
.btn-home:hover{opacity:.85}
.btn-home svg{width:16px;height:16px}

/* ─── Bottom Navigation ──────────────────────────────────────── */
.bottom-nav{position:fixed;bottom:0;left:0;right:0;height:calc(var(--footer-h) + var(--safe-bottom));padding-bottom:var(--safe-bottom);background:rgba(8,18,38,.68);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);display:flex;align-items:center;justify-content:space-around;z-index:999;border-top:1px solid var(--border);box-shadow:0 -10px 28px rgba(0,0,0,.35)}
@media(min-width:1024px){.bottom-nav{display:none}}
.nav-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:7px 0;text-decoration:none;color:rgba(255,255,255,.4);transition:all .32s;position:relative}
.nav-item.active{color:var(--gold)}
.nav-item.active::before{content:'';position:absolute;top:-2px;width:28px;height:3px;background:var(--gold);border-radius:0 0 5px 5px;box-shadow:0 0 14px var(--gold)}
.nav-item svg,.nav-item i{width:24px;height:24px;stroke-width:1.8}
.nav-label{font-size:.62rem;font-weight:700}

/* ─── Toast ──────────────────────────────────────────────────── */
.toast-container{position:fixed;bottom:calc(70px + var(--safe-bottom));left:50%;transform:translateX(-50%);z-index:10000;display:flex;flex-direction:column;gap:8px;width:90%;max-width:400px;pointer-events:none}
.toast{background:rgba(12,24,48,.95);color:#fff;padding:12px 16px;border-radius:14px;font-size:.84rem;font-weight:600;display:flex;align-items:center;gap:10px;box-shadow:0 12px 30px rgba(0,0,0,.4);animation:fadeUp .3s ease;pointer-events:auto;border:1px solid var(--border)}
.toast svg{width:18px;height:18px;flex-shrink:0}
.t-success svg{color:var(--green)}
.t-error svg{color:var(--red)}
.t-info svg{color:var(--c3)}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}

/* ─── Responsive ─────────────────────────────────────────────── */
@media(max-width:560px){
  .hero-poster{width:75px;height:108px}.hero-poster-ph{width:75px;height:108px}
  .hero-title{font-size:.95rem}.server-card{padding:14px}
  .server-icon{width:44px;height:44px}
}
@media(max-width:480px){
  .brand{font-size:.92rem;max-width:28vw}
  .hero-content{padding:14px 12px;gap:10px}
  .hero-poster{width:65px;height:94px}.hero-poster-ph{width:65px;height:94px}
  .hero-title{font-size:.88rem}
  .server-card{padding:12px;gap:10px}
  .server-icon{width:40px;height:40px}
}
@media(max-width:360px){
  .brand{display:none}
  .hero-poster{width:55px;height:80px}.hero-poster-ph{width:55px;height:80px}
}
@media(min-width:768px){
  .hero-content{padding:24px 20px;gap:16px}
  .hero-poster{width:100px;height:144px}.hero-poster-ph{width:100px;height:144px}
  .hero-title{font-size:1.2rem}
}
@media(min-width:1024px){
  .main-content{padding-right:var(--sidebar-w)}
}
@media(prefers-reduced-motion:reduce){
  *{animation:none!important;transition:none!important}
}
.h{display:none!important}
    `;
    doc$.head.appendChild(style);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. BUILD DOM
  // ═══════════════════════════════════════════════════════════════════════════
  root.innerHTML = `
<div class="animated-bg"></div>
<div class="pixel-container"><span class="pixel"></span><span class="pixel"></span><span class="pixel"></span></div>

<!-- Toast Container -->
<div class="toast-container" id="toastContainer"></div>

<!-- Header -->
<header class="main-header" id="mainHeader">
  <div class="header-group">
    <button class="icon-btn" id="backBtn" aria-label="رجوع">
      <i data-lucide="arrow-right"></i>
    </button>
    <a data-link="/" href="/" class="brand" style="text-decoration:none;display:flex;align-items:center;gap:.6rem">
      <span style="font-size:1.28rem;font-weight:900;color:var(--c4);text-shadow:0 2px 6px rgba(0,0,0,.35)">OraaSlayer</span>
    </a>
  </div>
  <div class="header-group">
    <button class="icon-btn" id="refreshBtn" aria-label="تحديث">
      <i data-lucide="refresh-cw"></i>
    </button>
  </div>
</header>

<!-- Main Content -->
<div class="main-content">
  <!-- Hero (hidden until loaded) -->
  <div class="hero-section" id="heroSection" style="display:none">
    <div class="hero-bg" id="heroBg"></div>
    <div class="hero-overlay"></div>
    <div class="hero-content">
      <img class="hero-poster h" id="heroPoster" alt="Poster">
      <div class="hero-poster-ph" id="heroPosterPh"></div>
      <div class="hero-info">
        <h1 class="hero-title" id="heroTitle"></h1>
        <div class="hero-meta">
          <span class="hero-chip chip-ep" id="heroEpTag"></span>
          <span class="hero-dot"></span>
          <span class="hero-chip chip-hd"><i data-lucide="monitor"></i> جودة عالية</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Server Section -->
  <div class="server-section">
    <!-- Skeleton Loading -->
    <div id="skeletonLoading">
      <div style="margin-bottom:16px">
        <div class="skel skel-title" style="width:140px;height:20px"></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${[1,2,3].map(() => `
        <div class="skel-card">
          <div class="skel skel-icon"></div>
          <div style="flex:1">
            <div class="skel skel-title" style="width:55%"></div>
            <div style="display:flex;gap:6px;margin-top:8px">
              <div class="skel skel-line" style="width:70px"></div>
              <div class="skel skel-line" style="width:50px"></div>
            </div>
          </div>
        </div>`).join('')}
      </div>
    </div>

    <!-- Server List -->
    <div id="serverContent" style="display:none">
      <div class="server-header">
        <div class="server-title"><i data-lucide="server"></i><span>السيرفرات المتاحة</span></div>
        <span class="server-count" id="serverCount">0</span>
      </div>
      <div class="server-grid" id="serverGrid"></div>
      <div class="quality-section" id="qualitySection" style="display:none">
        <div class="quality-header"><i data-lucide="zap"></i><span>الجودات المتاحة</span></div>
        <div class="quality-badges" id="qualityBadges"></div>
      </div>
    </div>

    <!-- Error State -->
    <div id="errorState" style="display:none">
      <div class="empty-state">
        <i data-lucide="alert-circle"></i>
        <h3>لا توجد سيرفرات</h3>
        <p id="errorMessage">لم يتم العثور على روابط لهذه الحلقة.</p>
        <button class="btn-home" id="goHomeBtn"><i data-lucide="home"></i><span>العودة للرئيسية</span></button>
      </div>
    </div>
  </div>
</div>

<!-- Bottom Navigation -->
<nav class="bottom-nav">
  <a data-link="/" href="/" class="nav-item"><i data-lucide="home"></i><span class="nav-label">الرئيسية</span></a>
  <a data-link="/newsanime" href="/newsanime" class="nav-item"><i data-lucide="newspaper"></i><span class="nav-label">أخبار</span></a>
  <a data-link="/event_gacha/spin" href="/event_gacha/spin" class="nav-item"><i data-lucide="gift"></i><span class="nav-label">هدايا</span></a>
  <a data-link="/chat" href="/chat" class="nav-item"><i data-lucide="message-circle"></i><span class="nav-label">دردشة</span></a>
  <a data-link="/profile" href="/profile" class="nav-item"><i data-lucide="user"></i><span class="nav-label">حسابي</span></a>
</nav>`;

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. RENDER ICONS
  // ═══════════════════════════════════════════════════════════════════════════
  if (win.lucide?.createIcons) win.lucide.createIcons();

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. DOM REFS
  // ═══════════════════════════════════════════════════════════════════════════
  const $ = (sel) => root.querySelector(sel);
  const D = {
    mainHeader: $('#mainHeader'),
    toastContainer: $('#toastContainer'),
    heroSection: $('#heroSection'),
    heroBg: $('#heroBg'),
    heroPoster: $('#heroPoster'),
    heroPosterPh: $('#heroPosterPh'),
    heroTitle: $('#heroTitle'),
    heroEpTag: $('#heroEpTag'),
    skeletonLoading: $('#skeletonLoading'),
    serverContent: $('#serverContent'),
    serverGrid: $('#serverGrid'),
    serverCount: $('#serverCount'),
    errorState: $('#errorState'),
    errorMessage: $('#errorMessage'),
    qualitySection: $('#qualitySection'),
    qualityBadges: $('#qualityBadges'),
    backBtn: $('#backBtn'),
    refreshBtn: $('#refreshBtn'),
    goHomeBtn: $('#goHomeBtn'),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. STATE & PARAMS EXTRACTION (🔥 FIXED DYNAMIC ROUTING)
  // ═══════════════════════════════════════════════════════════════════════════
  const urlParams = new URLSearchParams(location.search);
  const animeId = ctx.params?.id || ctx.query?.id || urlParams.get('id');
  const episodeNum = parseInt(ctx.params?.episode || ctx.query?.ep || urlParams.get('ep')) || 1;
  const serverIndex = parseInt(ctx.query?.srv || urlParams.get('srv')) || 0;

  // التحقق من وجود معرف الأنمي، وإذا لم يوجد يتم التوجيه للرئيسية
  if (!animeId) {
    if (typeof ctx.go === 'function') ctx.go('/');
    else if (typeof win.go === 'function') win.go('/');
    else location.href = '/';
    return;
  }

  const S = { aid: animeId, ep: episodeNum, srvIdx: serverIndex, title: '', poster: '', servers: [] };

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. TOAST
  // ═══════════════════════════════════════════════════════════════════════════
  const toast = (msg, type = 'info') => {
    const icons = { success: 'check-circle', error: 'alert-circle', info: 'info' };
    const div = doc$.createElement('div');
    div.className = `toast t-${type}`;
    div.innerHTML = `<i data-lucide="${icons[type] || 'info'}"></i><span>${msg}</span>`;
    D.toastContainer.appendChild(div);
    if (win.lucide?.createIcons) win.lucide.createIcons();
    const tid = setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity .3s'; setTimeout(() => div.remove(), 300); }, 3000);
    timers.push(tid);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. RENDER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const showLoading = () => {
    D.skeletonLoading.style.display = '';
    D.serverContent.style.display = 'none';
    D.errorState.style.display = 'none';
  };

  const showError = (msg) => {
    D.skeletonLoading.style.display = 'none';
    D.serverContent.style.display = 'none';
    D.errorState.style.display = '';
    D.errorMessage.textContent = msg || 'لم يتم العثور على سيرفرات لهذه الحلقة.';
  };

  const renderHero = () => {
    D.heroSection.style.display = '';
    D.heroTitle.textContent = S.title || 'غير معروف';
    D.heroEpTag.innerHTML = `<i data-lucide="play-circle"></i> الحلقة ${S.ep}`;
    
    if (S.poster) {
      D.heroPoster.src = S.poster;
      D.heroPoster.onerror = () => { D.heroPoster.classList.add('h'); };
      D.heroPoster.classList.remove('h');
      D.heroPosterPh.style.display = 'none';
      D.heroBg.style.backgroundImage = `url(${S.poster})`;
    }
    
    doc$.title = `${S.title || 'أنمي'} - الحلقة ${S.ep} | اختيار السيرفر`;
    if (win.lucide?.createIcons) win.lucide.createIcons();
  };

  const renderServers = (servers) => {
    D.skeletonLoading.style.display = 'none';
    D.serverContent.style.display = '';

    if (!servers.length) {
      showError('لا توجد سيرفرات متاحة لهذه الحلقة.');
      return;
    }

    D.serverCount.textContent = servers.length;
    const qualities = [...new Set(servers.map(s => s.quality).filter(Boolean))];

    const frag = doc$.createDocumentFragment();
    servers.forEach((s, i) => {
      const m = getServerMeta(s.name);
      const card = doc$.createElement('div');
      card.className = 'server-card';
      card.style.animationDelay = `${i * 0.06}s`;
      card.dataset.idx = i;

      card.innerHTML = `
        <div class="server-icon ${m.cls}"><i data-lucide="${m.icon}"></i></div>
        <div class="server-info">
          <div class="server-name">${escapeHTML(m.display)}</div>
          <div class="server-tags">
            ${i === 0 ? '<span class="server-tag best"><i data-lucide="star" style="width:10px;height:10px"></i> الأفضل</span>' : ''}
            <span class="server-tag">${escapeHTML(s.quality || 'HD')}</span>
            ${s.type ? `<span class="server-tag">${escapeHTML(s.type)}</span>` : ''}
          </div>
          <div class="server-sub">اضغط للمشاهدة</div>
        </div>
        <div class="server-arrow"><i data-lucide="chevron-left"></i></div>`;

      frag.appendChild(card);
    });

    D.serverGrid.innerHTML = '';
    D.serverGrid.appendChild(frag);

    if (qualities.length > 1) {
      D.qualitySection.style.display = '';
      D.qualityBadges.innerHTML = qualities.map(q => `<div class="quality-badge"><i data-lucide="monitor" style="width:14px;height:14px"></i> ${escapeHTML(q)}</div>`).join('');
    }

    if (win.lucide?.createIcons) win.lucide.createIcons();

    // ✅ Server click - delegated
    D.serverGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.server-card');
      if (!card) return;
      selectServer(parseInt(card.dataset.idx));
    }, { signal: ac.signal });
  };

  const selectServer = (idx) => {
    const server = S.servers[idx];
    if (!server?.url) {
      toast('هذا السيرفر غير متاح حالياً', 'error');
      return;
    }

    writePlayData({
      animeId: S.aid,
      title: S.title,
      epNum: S.ep,
      poster: S.poster,
      servers: S.servers,
      currentServer: idx
    });

    // ✅ توجيه لصفحة المشاهدة بدلاً من فتح نافذة جديدة
    spaNav('/watch/' + encodeURIComponent(S.aid) + '/' + S.ep + '?srv=' + idx);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════
  const normalizeServers = (raw) => {
    const list = Array.isArray(raw) ? raw : [];
    return list.map((s, i) => {
      if (typeof s === 'string') return { name: `سيرفر ${i + 1}`, url: s, quality: 'HD', type: '' };
      return { name: s.name || `سيرفر ${i + 1}`, url: s.url || s.link || s.src || '', quality: s.quality || s.resolution || 'HD', type: s.type || '' };
    }).filter(s => s.url);
  };

  const loadServers = async () => {
    showLoading();
    const numericId = localStorage.getItem('_current_anime_id');

    // 1. Read play data from localStorage
    const playData = readPlayData();
    if (playData) {
      S.aid = playData.animeId || S.aid;
      S.ep = playData.epNum || S.ep;
      S.title = playData.title || S.title;
      S.poster = playData.poster || S.poster;

      if (playData.servers?.length) {
        S.servers = normalizeServers(playData.servers);
        renderHero();
        renderServers(S.servers);
        return;
      }
    }

    // 2. URL params are already extracted in Step 9
    if (!S.aid) {
      showError('لم يتم تحديد الأنمي. عد للصفحة الرئيسية واختر حلقة.');
      return;
    }

    renderHero();

    // 3. Try Firebase
    let loaded = false;
    try {
      const snap = await getDoc(doc(db, 'anime_list', String(S.aid)));
      if (snap.exists()) {
        const data = snap.data();
        S.title = S.title || data.title || '';
        S.poster = S.poster || data.poster || '';

        const episodes = data.episodes || [];
        const epData = episodes.find(e => String(e.epNum) === String(S.ep)) || episodes[S.ep - 1] || null;

        if (epData?.servers?.length) {
          S.servers = normalizeServers(epData.servers);
          loaded = true;
        } else if (data.servers?.length) {
          S.servers = normalizeServers(data.servers);
          loaded = true;
        }

        if (S.servers.length) {
          writePlayData({ animeId: S.aid, title: S.title, epNum: S.ep, poster: S.poster, servers: S.servers });
        }
        renderHero();
      }
    } catch (e) {
      console.warn('[Servers] Firebase error:', e);
    }

    // 4. Try JSON fallback
    if (!loaded) {
      try {
        const res = await fetch(`/anime/data/${encodeURIComponent(numericId || S.aid)}.json`);
        if (res.ok) {
          const data = await res.json();
          S.title = S.title || data.title || '';
          S.poster = S.poster || data.poster || data.cover || '';

          const episodes = data.episodes || [];
          const epData = episodes.find(e => String(e.epNum) === String(S.ep)) || episodes[S.ep - 1] || null;

          if (epData?.servers?.length) {
            S.servers = normalizeServers(epData.servers);
            loaded = true;
          } else if (data.servers?.length) {
            S.servers = normalizeServers(data.servers);
            loaded = true;
          }

          if (S.servers.length) {
            writePlayData({ animeId: S.aid, title: S.title, epNum: S.ep, poster: S.poster, servers: S.servers });
          }
          renderHero();
        }
      } catch (e) {
        console.warn('[Servers] JSON error:', e);
      }
    }

    // 5. Render
    S.servers.length ? renderServers(S.servers) : showError('لم يتم العثور على سيرفرات لهذه الحلقة.');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. EVENT HANDLERS (🔥 Fixed pointerdown to click)
  // ═══════════════════════════════════════════════════════════════════════════
  const navHandler = (e) => {
    const link = e.target.closest('[data-link]');
    if (link) { e.preventDefault(); spaNav(link.getAttribute('data-link')); }
  };
  root.addEventListener('click', navHandler);
  cleanup.push(() => root.removeEventListener('click', navHandler));

  D.backBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const storedId = localStorage.getItem('_current_anime_id');
    if (storedId) {
      spaNav('/anime?id=' + btoa(storedId));
    } else if (win.history.length > 1) {
      win.history.back();
    } else {
      spaNav('/');
    }
  });
  D.refreshBtn?.addEventListener('click', (e) => { e.preventDefault(); S.servers = []; loadServers(); });
  D.goHomeBtn?.addEventListener('click', (e) => { e.preventDefault(); spaNav('/'); });

  // ═══════════════════════════════════════════════════════════════════════════
  // 14. HEADER SCROLL
  // ═══════════════════════════════════════════════════════════════════════════
  let scrollRAF = 0;
  const onScroll = () => {
    if (scrollRAF) return;
    scrollRAF = requestAnimationFrame(() => {
      D.mainHeader?.classList.toggle('main-header--scrolled', win.scrollY > 50);
      scrollRAF = 0;
    });
  };
  win.addEventListener('scroll', onScroll, { passive: true });
  cleanup.push(() => win.removeEventListener('scroll', onScroll));

  // ═══════════════════════════════════════════════════════════════════════════
  // 15. APP HEIGHT
  // ═══════════════════════════════════════════════════════════════════════════
  const setAppHeight = () => doc$.documentElement.style.setProperty('--app-height', `${win.innerHeight}px`);
  setAppHeight();
  win.addEventListener('resize', setAppHeight, { passive: true });
  cleanup.push(() => win.removeEventListener('resize', setAppHeight));

  // ═══════════════════════════════════════════════════════════════════════════
  // 16. INIT
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    await signInAnonymously(auth).catch(() => {});
    await loadServers();
  } catch (err) {
    console.error('[Servers] Init failed:', err);
    showError('خطأ في تحميل الصفحة. حاول مرة أخرى.');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 17. CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════
  const runCleanup = () => {
    ac.abort();
    timers.forEach(id => clearTimeout(id));
    cleanup.forEach(fn => { try { fn(); } catch {} });
  };

  if (typeof onCleanup === 'function') onCleanup(runCleanup);
  else win.addEventListener('beforeunload', runCleanup, { once: true });
}
