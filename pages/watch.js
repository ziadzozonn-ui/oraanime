// ═══════════════════════════════════════════════════════════════════════════════
// OraaSlayer Watch Page v4.2 - Golden Mind Production
// Unified Design | Lucide Icons | Same Header/Footer as home.js/anime.js
// Fixed: reads play data from localStorage, iframe embed, correct back nav
// ═══════════════════════════════════════════════════════════════════════════════

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN WATCH MODULE
   ═══════════════════════════════════════════════════════════════════════════════ */
export default async function Watch(ctx) {
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
  setMeta('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
  setMeta('theme-color', '#0B1A3A');
  doc$.title = 'OraaSlayer | مشاهدة';
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

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. UNIFIED STYLES (Same as home.js / anime.js / servers.js)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!doc$.getElementById('watch-styles')) {
    const style = doc$.createElement('style');
    style.id = 'watch-styles';
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
.header-title-text{font-size:clamp(.78rem,1.8vw,.92rem);font-weight:700;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:clamp(100px,28vw,220px);transition:color .2s}

/* ─── Main Content ───────────────────────────────────────────── */
.main-content{
  padding-top:calc(var(--header-h) + var(--safe-top) + 10px);
  padding-bottom:calc(var(--footer-h) + var(--safe-bottom) + 20px);
  min-height:var(--app-height);
}
@media(min-width:1024px){
  .main-content{padding-right:var(--sidebar-w);padding-bottom:20px;max-width:1100px;margin:0 auto}
}

/* ─── Video Player Section ───────────────────────────────────── */
.player-section{
  position:relative;
  margin:0 var(--page-pad) 16px;
  border-radius:20px;overflow:hidden;
  background:#000;border:1px solid var(--border);
  box-shadow:0 12px 40px rgba(0,0,0,.5);
}
.player-wrapper{
  position:relative;width:100%;
  aspect-ratio:16/9;
  background:#000;
  overflow:hidden;
}
.player-wrapper iframe{
  position:absolute;inset:0;
  width:100%;height:100%;
  border:none;outline:none;
  background:#000;
}
.player-loading{
  position:absolute;inset:0;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:14px;z-index:5;
  background:rgba(0,0,0,.85);
}
.spinner{
  width:42px;height:42px;border-radius:50%;
  border:3px solid rgba(255,255,255,.12);border-top-color:var(--gold);
  animation:spin .85s linear infinite;
  box-shadow:0 0 18px rgba(255,202,40,.3);
}
@keyframes spin{to{transform:rotate(360deg)}}
.player-loading span{font-size:.82rem;color:var(--text-dim);font-weight:600}

.player-error{
  position:absolute;inset:0;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:12px;z-index:5;padding:24px;text-align:center;
  background:rgba(0,0,0,.92);
}
.player-error i{color:var(--red);opacity:.6}
.player-error h3{font-size:.95rem;color:var(--text);font-weight:700}
.player-error p{font-size:.8rem;color:var(--text-dim);max-width:280px;line-height:1.7}
.btn-retry{
  display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border-radius:999px;
  background:var(--gold);color:#000;font-weight:700;font-size:.82rem;
  cursor:pointer;border:none;transition:opacity .15s;font-family:'Cairo',sans-serif;
  margin-top:6px;
}
.btn-retry:hover{opacity:.85}
.btn-retry svg{width:16px;height:16px}

/* ─── Video Info Bar ─────────────────────────────────────────── */
.video-info{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 16px;
  background:rgba(10,20,40,.8);
  border-top:1px solid var(--border);
}
.video-info-left{display:flex;align-items:center;gap:10px;min-width:0;flex:1}
.video-info-poster{
  width:38px;height:54px;border-radius:8px;object-fit:cover;
  flex-shrink:0;border:1.5px solid var(--gold);
  box-shadow:0 4px 12px rgba(0,0,0,.4);
}
.video-info-poster-ph{
  width:38px;height:54px;border-radius:8px;flex-shrink:0;
  border:1.5px solid rgba(255,202,40,.2);
  background:linear-gradient(110deg,rgba(11,26,58,.5) 30%,rgba(21,45,90,.4) 50%,rgba(11,26,58,.5) 70%);
  background-size:200% 100%;animation:shimmer 1.8s infinite linear;
}
.video-info-text{min-width:0;flex:1}
.video-info-title{font-size:.84rem;font-weight:800;color:var(--text);line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.video-info-ep{font-size:.68rem;color:var(--gold);font-weight:700;margin-top:2px}
.video-info-server{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:rgba(58,123,213,.12);color:var(--c3);border:1px solid rgba(58,123,213,.2);font-size:.66rem;font-weight:700;flex-shrink:0}
.video-info-server svg{width:12px;height:12px}

/* ─── Server Switch Section ─────────────────────────────────── */
.server-switch-section{padding:0 var(--page-pad);max-width:800px;margin:0 auto}
.server-switch-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.server-switch-title{font-size:.82rem;font-weight:700;display:flex;align-items:center;gap:8px;color:var(--text)}
.server-switch-title svg{width:18px;height:18px;color:var(--c3)}
.server-chips{display:flex;gap:8px;flex-wrap:wrap;overflow-x:auto;scrollbar-width:none;padding-bottom:4px}
.server-chips::-webkit-scrollbar{display:none}
.server-chip{
  display:inline-flex;align-items:center;gap:6px;padding:10px 16px;
  border-radius:14px;cursor:pointer;transition:all .2s ease;
  background:var(--surface);border:1px solid var(--border);
  color:var(--text-dim);font-size:.78rem;font-weight:600;
  white-space:nowrap;flex-shrink:0;
}
.server-chip:hover{border-color:var(--c3);color:#fff;background:rgba(21,45,90,.4);transform:translateY(-1px)}
.server-chip.active{
  background:linear-gradient(135deg,rgba(255,202,40,.15),rgba(255,202,40,.25));
  border-color:var(--gold);color:var(--gold);
  box-shadow:0 4px 16px rgba(255,202,40,.15);
}
.server-chip svg{width:16px;height:16px}
.server-chip-quality{
  font-size:.6rem;padding:2px 7px;border-radius:20px;
  background:rgba(46,213,115,.12);color:var(--green);border:1px solid rgba(46,213,115,.2);
  font-weight:700;
}

/* ─── Episode Nav ─────────────────────────────────────────────── */
.ep-nav{display:flex;align-items:center;justify-content:center;gap:12px;padding:14px var(--page-pad)}
.ep-nav-btn{
  display:inline-flex;align-items:center;gap:8px;padding:10px 20px;
  border-radius:999px;background:var(--surface);border:1px solid var(--border);
  color:var(--text);font-weight:700;font-size:.82rem;cursor:pointer;
  transition:all .2s;font-family:'Cairo',sans-serif;
}
.ep-nav-btn:hover:not(:disabled){border-color:var(--c3);background:rgba(21,45,90,.4);transform:translateY(-1px)}
.ep-nav-btn:disabled{opacity:.3;cursor:not-allowed}
.ep-nav-btn svg{width:18px;height:18px}
.ep-nav-label{font-size:.72rem;color:var(--text-dim);font-weight:600}

@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}

/* ─── Bottom Navigation ──────────────────────────────────────── */
.bottom-nav{position:fixed;bottom:0;left:0;right:0;height:calc(var(--footer-h) + var(--safe-bottom));padding-bottom:var(--safe-bottom);background:rgba(8,18,38,.68);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);display:flex;align-items:center;justify-content:space-around;z-index:999;border-top:1px solid var(--border);box-shadow:0 -10px 28px rgba(0,0,0,.35)}
@media(min-width:1024px){.bottom-nav{display:none}}
.nav-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:7px 0;text-decoration:none;color:rgba(255,255,255,.4);transition:all .32s;position:relative}
.nav-item.active{color:var(--gold)}
.nav-item.active::before{content:'';position:absolute;top:-2px;width:28px;height:3px;background:var(--gold);border-radius:0 0 5px 5px;box-shadow:0 0 14px var(--gold)}
.nav-item svg,.nav-item i{width:24px;height:24px;stroke-width:1.8}
.nav-label{font-size:.62rem;font-weight:700}

/* ─── Fullscreen ────────────────────────────────────────────── */
.player-wrapper:fullscreen{border-radius:0}
.player-wrapper:-webkit-full-screen{border-radius:0}
.fullscreen-btn{
  width:40px;height:40px;border-radius:13px;
  background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.05)),rgba(255,255,255,.07);
  border:1px solid rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;
  cursor:pointer;color:var(--c4);transition:transform .2s ease,background .2s ease;
  flex-shrink:0;
}
.fullscreen-btn:active{transform:scale(.94)}
.fullscreen-btn svg{width:20px;height:20px;stroke-width:2}

/* ─── Responsive ─────────────────────────────────────────────── */
@media(max-width:560px){
  .video-info-poster,.video-info-poster-ph{width:32px;height:46px}
  .video-info-title{font-size:.78rem}
  .server-chip{padding:8px 14px;font-size:.74rem}
}
@media(max-width:480px){
  .header-title-text{max-width:28vw}
  .server-chip{padding:7px 12px;font-size:.72rem}
}
@media(max-width:360px){
  .brand span{display:none}
  .header-title-text{max-width:120px}
}
@media(min-width:768px){
  .player-wrapper{aspect-ratio:16/9}
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
  // 6. READ DATA
  // ═══════════════════════════════════════════════════════════════════════════
  const playData = readPlayData();
  const animeTitle = localStorage.getItem('_current_anime_title') || playData?.title || '';
  const animePoster = localStorage.getItem('_current_anime_poster') || playData?.poster || '';
  const animeId = localStorage.getItem('_current_anime_id') || playData?.animeId || '';
  const epNum = parseInt(ctx.params?.episode || ctx.query?.ep || playData?.epNum) || 1;
  const srvIdx = parseInt(ctx.query?.srv || playData?.currentServer || 0) || 0;
  const servers = playData?.servers || [];

  const currentServer = servers[srvIdx] || null;
  const serverUrl = currentServer?.url || '';
  const serverName = currentServer?.name || '';
  const serverQuality = currentServer?.quality || 'HD';

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. BUILD DOM
  // ═══════════════════════════════════════════════════════════════════════════
  root.innerHTML = `
<div class="animated-bg"></div>
<div class="pixel-container"><span class="pixel"></span><span class="pixel"></span><span class="pixel"></span></div>

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
    <span class="header-title-text" id="headerTitle"></span>
    <button class="icon-btn" id="fullscreenBtn" aria-label="ملء الشاشة">
      <i data-lucide="maximize"></i>
    </button>
  </div>
</header>

<!-- Main Content -->
<div class="main-content">
  <!-- Video Player -->
  <div class="player-section">
    <div class="player-wrapper" id="playerWrapper">
      ${serverUrl ? `
        <iframe
          id="videoIframe"
          src="${escapeHTML(serverUrl)}"
          allowfullscreen
          allow="autoplay; encrypted-media; fullscreen"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
          loading="eager"
        ></iframe>
      ` : ''}
      <div class="player-loading ${serverUrl ? 'h' : ''}" id="playerLoading">
        <div class="spinner"></div>
        <span>جارٍ تحميل المشغل...</span>
      </div>
      <div class="player-error h" id="playerError">
        <i data-lucide="alert-triangle" style="width:42px;height:42px"></i>
        <h3>لا يمكن تشغيل الفيديو</h3>
        <p>لم يتم العثور على رابط صالح لهذا السيرفر. حاول سيرفر آخر.</p>
        <button class="btn-retry" id="retryBtn"><i data-lucide="refresh-cw"></i><span>إعادة المحاولة</span></button>
      </div>
    </div>

    <!-- Video Info Bar -->
    <div class="video-info">
      <div class="video-info-left">
        ${animePoster ? `<img class="video-info-poster" src="${escapeHTML(animePoster)}" alt="Poster" onerror="this.classList.add('h')">` : `<div class="video-info-poster-ph"></div>`}
        <div class="video-info-text">
          <div class="video-info-title">${escapeHTML(animeTitle || 'غير معروف')}</div>
          <div class="video-info-ep">الحلقة ${epNum}</div>
        </div>
      </div>
      <div class="video-info-server">
        <i data-lucide="server"></i>
        <span>${escapeHTML(serverName || 'سيرفر')}</span>
        <span class="server-chip-quality">${escapeHTML(serverQuality)}</span>
      </div>
    </div>
  </div>

  <!-- Server Switch -->
  ${servers.length > 1 ? `
  <div class="server-switch-section">
    <div class="server-switch-header">
      <div class="server-switch-title"><i data-lucide="list"></i><span>تبديل السيرفر</span></div>
    </div>
    <div class="server-chips" id="serverChips">
      ${servers.map((s, i) => `
        <button class="server-chip ${i === srvIdx ? 'active' : ''}" data-idx="${i}" data-url="${escapeHTML(s.url || '')}">
          <i data-lucide="${s.name?.toLowerCase()?.includes('drive') || s.name?.toLowerCase()?.includes('google') ? 'cloud' : 'monitor'}"></i>
          <span>${escapeHTML(s.name || 'سيرفر ' + (i + 1))}</span>
          <span class="server-chip-quality">${escapeHTML(s.quality || 'HD')}</span>
        </button>
      `).join('')}
    </div>
  </div>
  ` : ''}

  <!-- Episode Navigation -->
  <div class="ep-nav" id="epNav">
    <button class="ep-nav-btn" id="prevEpBtn" ${epNum <= 1 ? 'disabled' : ''}>
      <i data-lucide="chevron-right"></i>
      <span>السابقة</span>
    </button>
    <span class="ep-nav-label">الحلقة ${epNum}</span>
    <button class="ep-nav-btn" id="nextEpBtn">
      <span>التالية</span>
      <i data-lucide="chevron-left"></i>
    </button>
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
  // 8. RENDER ICONS
  // ═══════════════════════════════════════════════════════════════════════════
  if (win.lucide?.createIcons) win.lucide.createIcons();

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. DOM REFS
  // ═══════════════════════════════════════════════════════════════════════════
  const $ = (sel) => root.querySelector(sel);
  const D = {
    mainHeader: $('#mainHeader'),
    headerTitle: $('#headerTitle'),
    videoIframe: $('#videoIframe'),
    playerWrapper: $('#playerWrapper'),
    playerLoading: $('#playerLoading'),
    playerError: $('#playerError'),
    retryBtn: $('#retryBtn'),
    serverChips: $('#serverChips'),
    backBtn: $('#backBtn'),
    fullscreenBtn: $('#fullscreenBtn'),
    prevEpBtn: $('#prevEpBtn'),
    nextEpBtn: $('#nextEpBtn'),
    epNav: $('#epNav'),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. UPDATE TITLE
  // ═══════════════════════════════════════════════════════════════════════════
  doc$.title = `${animeTitle || 'أنمي'} - الحلقة ${epNum} | مشاهدة`;
  if (D.headerTitle) {
    D.headerTitle.textContent = `${animeTitle || ''} - الحلقة ${epNum}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. IFRAME LOADED
  // ═══════════════════════════════════════════════════════════════════════════
  if (D.videoIframe) {
    D.videoIframe.addEventListener('load', () => {
      if (D.playerLoading) D.playerLoading.classList.add('h');
      if (D.playerError) D.playerError.classList.add('h');
    }, { signal: ac.signal, once: true });
  } else {
    // No server URL available
    if (D.playerLoading) D.playerLoading.classList.add('h');
    if (D.playerError) D.playerError.classList.remove('h');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. SWITCH SERVER
  // ═══════════════════════════════════════════════════════════════════════════
  const switchServer = (idx) => {
    const server = servers[idx];
    if (!server?.url) return;

    // Update play data
    if (playData) {
      writePlayData({ ...playData, currentServer: idx });
    } else {
      writePlayData({ animeId, title: animeTitle, epNum, poster: animePoster, servers, currentServer: idx });
    }

    // Show loading
    if (D.playerLoading) D.playerLoading.classList.remove('h');
    if (D.playerError) D.playerError.classList.add('h');

    // Update iframe
    if (D.videoIframe) {
      D.videoIframe.src = server.url;
    }

    // Update active chip
    if (D.serverChips) {
      D.serverChips.querySelectorAll('.server-chip').forEach((chip, i) => {
        chip.classList.toggle('active', i === idx);
      });
    }
  };

  if (D.serverChips) {
    D.serverChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.server-chip');
      if (!chip) return;
      const idx = parseInt(chip.dataset.idx);
      if (!isNaN(idx)) switchServer(idx);
    }, { signal: ac.signal });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. NAVIGATE EPISODE
  // ═══════════════════════════════════════════════════════════════════════════
  const navigateEpisode = (newEp) => {
    if (!animeId) { spaNav('/'); return; }

    // Save current server state
    if (playData || servers.length) {
      writePlayData({ animeId, title: animeTitle, epNum: newEp, poster: animePoster, servers, currentServer: srvIdx });
    }

    // Navigate to servers page for the new episode
    spaNav('/servers/' + encodeURIComponent(animeId) + '/' + newEp + '?srv=' + srvIdx);
  };

  D.prevEpBtn?.addEventListener('click', () => {
    if (epNum > 1) navigateEpisode(epNum - 1);
  });

  D.nextEpBtn?.addEventListener('click', () => {
    navigateEpisode(epNum + 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 14. BACK BUTTON → servers.js
  // ═══════════════════════════════════════════════════════════════════════════
  D.backBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const storedId = localStorage.getItem('_current_anime_id') || animeId;
    if (storedId) {
      spaNav('/servers/' + encodeURIComponent(storedId) + '/' + epNum);
    } else if (win.history.length > 1) {
      win.history.back();
    } else {
      spaNav('/');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 15. FULLSCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  D.fullscreenBtn?.addEventListener('click', () => {
    const el = D.playerWrapper;
    if (!el) return;
    if (!doc$.fullscreenElement && !doc$.webkitFullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen();
    } else {
      if (doc$.exitFullscreen) doc$.exitFullscreen();
      else if (doc$.webkitExitFullscreen) doc$.webkitExitFullscreen();
      else if (doc$.webkitCancelFullScreen) doc$.webkitCancelFullScreen();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 16. RETRY
  // ═══════════════════════════════════════════════════════════════════════════
  D.retryBtn?.addEventListener('click', () => {
    if (D.playerError) D.playerError.classList.add('h');
    if (D.playerLoading) D.playerLoading.classList.remove('h');
    if (D.videoIframe && serverUrl) {
      D.videoIframe.src = '';
      setTimeout(() => { D.videoIframe.src = serverUrl; }, 100);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 17. LINK NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════
  const navHandler = (e) => {
    const link = e.target.closest('[data-link]');
    if (link) { e.preventDefault(); spaNav(link.getAttribute('data-link')); }
  };
  root.addEventListener('click', navHandler);
  cleanup.push(() => root.removeEventListener('click', navHandler));

  // ═══════════════════════════════════════════════════════════════════════════
  // 18. HEADER SCROLL
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
  // 19. APP HEIGHT
  // ═══════════════════════════════════════════════════════════════════════════
  const setAppHeight = () => doc$.documentElement.style.setProperty('--app-height', `${win.innerHeight}px`);
  setAppHeight();
  win.addEventListener('resize', setAppHeight, { passive: true });
  cleanup.push(() => win.removeEventListener('resize', setAppHeight));

  // ═══════════════════════════════════════════════════════════════════════════
  // 20. CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════
  const runCleanup = () => {
    ac.abort();
    timers.forEach(id => clearTimeout(id));
    cleanup.forEach(fn => { try { fn(); } catch {} });
  };

  if (typeof onCleanup === 'function') onCleanup(runCleanup);
  else win.addEventListener('beforeunload', runCleanup, { once: true });
}
