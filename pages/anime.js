// anime.js – SPA module for the anime detail page
// ✅ v4.1 Golden Mind: Play Store Rating, Fixed Fav Button, 3D Poster, Premium UI
// 🔥 Patched: Dynamic Params/Query extraction for Anime ID
// 🔥 Fixed: Episode navigation now uses path segments (/servers/:id/:episode)
// ✅ v4.2 FIXED: Uses local JSON ID (filename) for servers route, not numeric AniList ID

export default async function Anime(ctx) {
  const { root, go, auth, db } = ctx;
  const ac = new AbortController();
  const unsubs = [];

  // ─── 1. Meta & Scroll ────────────────────────────────────────────
  window.scrollTo({ top: 0, behavior: 'instant' });
  
  const ensureMeta = (name, content) => {
    let el = document.head.querySelector(`meta[name="${name}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
    el.setAttribute('content', content);
  };
  
  ensureMeta('theme-color', '#1C4D8D');
  ensureMeta('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
  document.title = 'OraaSlayer | Experience';

  // ─── 2. Firebase from ctx ───────────
  const firestore = db || window.firebaseDB;
  const fireauth = auth || window.firebaseAuth;
  
  let FS = {};
  if (!firestore) {
    try {
      FS = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
    } catch(e) { console.warn('Firestore import failed:', e); }
  }
  let authModule = {};
  try {
    authModule = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
  } catch(e) { console.warn('Auth import failed:', e); }
  const { onAuthStateChanged, signOut } = authModule;

  // ─── 3. Anime ID extraction (🔥 IMPROVED) ──────────────────────────────────────
  function extractAnimeId(ctx) {
    let rawId = null;
    
    // من params (للمسارات مثل /anime/:id أو /anime/:id/:slug)
    if (ctx.params?.id) rawId = ctx.params.id;
    
    // من query كـ URLSearchParams
    else if (ctx.query instanceof URLSearchParams) rawId = ctx.query.get('id');
    
    // من query كـ object (من createContext في الروتر)
    else if (ctx.query?.id) rawId = ctx.query.id;
    
    // من location مباشرة
    if (!rawId) rawId = new URLSearchParams(location.search).get('id');
    
    if (!rawId) return null;
    
    try {
      const decoded = atob(rawId);
      if (/^\d+$/.test(decoded.trim())) return decoded.trim();
      return decoded.trim();
    } catch {
      if (/^\d+$/.test(rawId.trim())) return rawId.trim();
    }
    return rawId;
  }

  const animeId = extractAnimeId(ctx);

  // ─── 4. HTML & Premium CSS ───────────────────────────────────────
  root.innerHTML = `
<style>
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
  --r-sm:10px;--r-md:14px;--r-lg:18px;--r-xl:24px;
  --spring:cubic-bezier(.34,1.56,.64,1);--smooth:cubic-bezier(.4,0,.2,1);--out:cubic-bezier(.16,1,.3,1);
  --fast:160ms;--base:260ms;--slow:420ms;
  --sh-sm:0 4px 12px rgba(0,0,0,.25);--sh-md:0 10px 30px rgba(0,0,0,.4);
  --sh-lg:0 18px 50px rgba(0,0,0,.55);--sh-gold:0 6px 24px rgba(255,202,40,.25);
}
*,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased}
body{font-family:'Cairo',sans-serif;background:var(--bg);color:var(--text);direction:rtl;overflow-x:hidden;line-height:1.65;touch-action:pan-y}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}

.animated-bg{position:fixed;inset:0;z-index:-2;background:linear-gradient(160deg,var(--c1) 0%,#081428 45%,var(--c2) 75%,#0a1832 100%)}
.pixel-container{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;display:none}
@media(min-width:768px){.pixel-container{display:block}.animated-bg{background:linear-gradient(-45deg,var(--c1),var(--c2),var(--c3),var(--c4));background-size:400% 400%;animation:gradientFlow 28s ease infinite}}
@keyframes gradientFlow{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
.pixel{position:absolute;background:rgba(189,215,238,.08);bottom:-120px;border-radius:4px;animation:floatUp 32s linear infinite;will-change:transform}
.pixel:nth-child(1){left:12%;width:36px;height:36px;animation-delay:0s;opacity:.25}
.pixel:nth-child(2){left:45%;width:22px;height:22px;animation-delay:9s}
.pixel:nth-child(3){left:75%;width:32px;height:32px;animation-delay:16s;opacity:.2}
@keyframes floatUp{0%{transform:translateY(0) rotate(0deg);opacity:0}10%{opacity:.25}90%{opacity:.25}100%{transform:translateY(-1100px) rotate(360deg);opacity:0}}

@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes pulse-gold{0%,100%{box-shadow:0 0 0 0 rgba(255,202,40,.35)}50%{box-shadow:0 0 0 10px rgba(255,202,40,0)}}
@keyframes tabSlide{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes ratingPop{0%{transform:scale(1)}50%{transform:scale(1.25)}100%{transform:scale(1)}}

.anim-fade-up{opacity:0;animation:fadeUp .55s var(--out) forwards}
.anim-d1{animation-delay:.08s}.anim-d2{animation-delay:.16s}.anim-d3{animation-delay:.24s}

.main-header{position:fixed;top:0;left:0;right:0;height:calc(var(--header-h) + var(--safe-top));padding-top:var(--safe-top);background:rgba(8,18,38,.72);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);display:flex;align-items:center;justify-content:space-between;padding-inline:1rem;z-index:1000;box-shadow:0 10px 35px rgba(0,0,0,.3);border-bottom:1px solid var(--border)}
.header--scrolled{background:rgba(8,18,38,.92)}
.header-group{display:flex;align-items:center;gap:.8rem}
.icon-btn{width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--c4);transition:all var(--fast)}
.icon-btn:hover{background:rgba(255,255,255,.1);transform:translateY(-1px)}.icon-btn:active{transform:scale(.93)}
.icon-btn svg,.icon-btn i{width:22px;height:22px;stroke-width:2}
.brand{display:flex;align-items:center;gap:.6rem;text-decoration:none}
.brand__text{font-size:1.28rem;font-weight:900;color:var(--c4);text-shadow:0 2px 6px rgba(0,0,0,.35)}

.icon-btn--fav{color:rgba(255,255,255,.4);border-color:rgba(255,255,255,.1)}
.icon-btn--fav:hover{background:var(--gold-soft);color:var(--gold);border-color:var(--border-gold)}
.icon-btn--fav.active{background:var(--gold);color:var(--c-deep);border-color:var(--gold);animation:pulse-gold 2.2s infinite;box-shadow:var(--sh-gold)}

.user-profile{display:flex;align-items:center;gap:.6rem;padding:6px 14px 6px 16px;border-radius:999px;background:rgba(0,0,0,.28);backdrop-filter:blur(12px);cursor:pointer;border:1.5px solid var(--border-gold);transition:all .25s;position:relative}
.user-profile:hover{background:rgba(0,0,0,.45);border-color:var(--gold)}
.avatar-wrap{width:36px;height:36px;border-radius:50%;overflow:hidden;border:2px solid var(--gold);flex-shrink:0}
.avatar-wrap img{width:100%;height:100%;object-fit:cover;display:block}
.user-name{font-size:.84rem;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:95px}
.user-role{font-size:.64rem;color:var(--gold);font-weight:600}
.user-details{display:flex;flex-direction:column;min-width:0}

.dropdown-menu{position:absolute;top:calc(100% + 12px);right:0;min-width:230px;background:var(--glass);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);border-radius:18px;box-shadow:var(--sh-lg),0 0 0 1px var(--border);border:1px solid var(--border-gold);opacity:0;visibility:hidden;transform:translateY(-10px) scale(.97);transform-origin:top right;transition:all .28s var(--spring);z-index:1001;overflow:hidden}
.dropdown-menu.show{opacity:1;visibility:visible;transform:translateY(0) scale(1)}
.dropdown-header{padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.05);font-size:.74rem;font-weight:700;color:var(--text-dim);display:flex;align-items:center;gap:8px}
.dropdown-item{display:flex;align-items:center;gap:12px;padding:12px 16px;color:var(--text-dim);text-decoration:none;font-size:.9rem;font-weight:600;transition:all .18s;border-bottom:1px solid rgba(255,255,255,.02)}
.dropdown-item:last-child{border-bottom:none}
.dropdown-item:hover{background:rgba(189,215,238,.06);color:#fff;padding-right:22px}
.dropdown-item svg,.dropdown-item i{width:18px;height:18px;color:var(--c3);flex-shrink:0;stroke-width:2}
.dropdown-item.danger{color:#FF6B6B}
.dropdown-item.danger svg,.dropdown-item.danger i{color:#FF6B6B}

.main-content{padding-top:calc(var(--header-h) + var(--safe-top));padding-bottom:calc(var(--footer-h) + var(--safe-bottom));min-height:100vh;touch-action:pan-y}
@media(min-width:1024px){.main-content{padding-right:var(--sidebar-w);padding-bottom:0}}

.hero{position:relative;height:360px;width:100%;overflow:hidden;border-radius:0 0 var(--r-xl) var(--r-xl)}
.hero__backdrop{position:absolute;inset:0;background-size:cover;background-position:center 25%;filter:brightness(.35) saturate(1.2);mask-image:linear-gradient(to bottom,black 45%,transparent 100%);-webkit-mask-image:linear-gradient(to bottom,black 45%,transparent 100%);transform:scale(1.06);transition:transform 8s ease-out}
.hero:hover .hero__backdrop{transform:scale(1.1)}
.hero__vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 35%,rgba(6,14,30,.85) 100%);pointer-events:none}
.hero__content{position:absolute;bottom:0;left:0;right:0;padding:32px 22px;display:flex;align-items:flex-end;gap:20px;z-index:5}
.poster-wrap{perspective:800px;flex-shrink:0}
.poster{width:130px;height:186px;object-fit:cover;border-radius:var(--r-lg);box-shadow:var(--sh-lg),0 0 0 1px rgba(255,255,255,.1);border:3px solid var(--gold);margin-bottom:-32px;transition:transform var(--base) var(--spring);will-change:transform}
.poster:hover{transform:translateY(-8px) rotateY(-8deg) scale(1.03)}
.poster--skel{background:linear-gradient(110deg,rgba(255,255,255,.04) 30%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 70%);background-size:200% 100%;animation:shimmer 1.8s infinite linear;border-radius:var(--r-lg);width:130px;height:186px;margin-bottom:-32px;border:3px solid rgba(255,202,40,.25)}
.meta{flex:1;padding-bottom:10px}
.meta__title{font-size:1.6rem;font-weight:900;line-height:1.25;margin-bottom:12px;text-shadow:0 3px 14px rgba(0,0,0,.65)}
.meta__tags{display:flex;gap:7px;flex-wrap:wrap}
.tag{font-size:.7rem;font-weight:700;padding:4px 11px;background:var(--gold-soft);border:1px solid var(--border-gold);border-radius:20px;color:var(--gold);backdrop-filter:blur(6px)}

.cache-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;background:rgba(46,213,115,.1);border:1px solid rgba(46,213,115,.2);border-radius:20px;font-size:.62rem;color:#2ED573;font-weight:700;margin-bottom:10px}

.tabs-wrap{padding:0 18px;position:sticky;top:calc(var(--header-h) + var(--safe-top));z-index:100;padding-top:10px;padding-bottom:6px}
.tabs-track{display:flex;gap:5px;background:rgba(6,16,36,.82);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid var(--border);border-radius:var(--r-lg);padding:6px;overflow-x:auto;scrollbar-width:none;touch-action:pan-x;box-shadow:0 8px 24px rgba(0,0,0,.2)}
.tabs-track::-webkit-scrollbar{display:none}
.tab-btn{flex:1;min-width:max-content;padding:10px 16px;border-radius:var(--r-md);border:none;background:transparent;color:var(--text-muted);font-family:'Cairo',sans-serif;font-weight:700;font-size:.82rem;cursor:pointer;white-space:nowrap;transition:all var(--base);display:flex;align-items:center;justify-content:center;gap:7px;position:relative}
.tab-btn i,.tab-btn svg{width:16px;height:16px;opacity:.75;transition:opacity var(--base)}
.tab-btn.active{background:linear-gradient(135deg, var(--gold-soft), rgba(255,202,40,.2));color:var(--gold);box-shadow:0 0 0 1px var(--border-gold),var(--sh-gold)}
.tab-btn.active i,.tab-btn.active svg{opacity:1}
.tab-btn:hover:not(.active){background:rgba(255,255,255,.04);color:var(--text-dim)}
.tab-badge{background:var(--gold);color:var(--c-deep);font-size:.62rem;font-weight:900;padding:2px 6px;border-radius:20px;line-height:1.3}

.panels-wrap{padding:14px 18px;max-width:1050px;margin:0 auto;position:relative;z-index:10;touch-action:pan-y}
.tab-panel{display:none;animation:tabSlide .38s var(--out) forwards}
.tab-panel.active{display:block}

.card{background:var(--surface);border-radius:var(--r-lg);padding:22px;margin-bottom:18px;border:1px solid rgba(255,255,255,.05);backdrop-filter:blur(12px);box-shadow:var(--sh-sm);transition:all var(--base);position:relative;overflow:hidden}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg, transparent, var(--gold), transparent);opacity:0;transition:opacity var(--base)}
.card:hover{border-color:rgba(255,255,255,.1);box-shadow:var(--sh-md)}
.card:hover::before{opacity:1}
.card__header{display:flex;align-items:center;gap:10px;margin-bottom:18px;color:var(--gold);font-size:.98rem;font-weight:800}
.card__header i,.card__header svg{width:18px;height:18px;opacity:.9}

.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px}
.stat-ring-card{background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.04);border-radius:var(--r-md);padding:18px 12px;text-align:center;transition:all var(--base);position:relative;overflow:hidden}
.stat-ring-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--gold),var(--c3));opacity:.6}
.stat-ring-card:hover{transform:translateY(-3px);border-color:var(--gold);box-shadow:var(--sh-gold)}
.stat-ring{width:64px;height:64px;border-radius:50%;margin:0 auto 10px;position:relative;display:flex;align-items:center;justify-content:center;background:conic-gradient(var(--gold) calc(var(--p,0)*1%), rgba(255,255,255,.06) 0);transition:background 1.2s var(--out)}
.stat-ring::before{content:'';position:absolute;inset:6px;border-radius:50%;background:var(--c1)}
.stat-ring-value{position:relative;z-index:2;font-size:1.1rem;font-weight:900;color:var(--gold)}
.stat-ring-label{font-size:.68rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.stat-ring-sub{font-size:.6rem;color:var(--text-muted);opacity:.7;margin-top:4px}

.description{color:var(--text-secondary);font-size:.95rem;line-height:1.9;margin-bottom:18px}
.trailer-trigger{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:15px;border-radius:var(--r-md);background:rgba(255,71,87,.08);border:1px solid rgba(255,71,87,.15);color:#fff;font-family:'Cairo',sans-serif;font-weight:800;font-size:.92rem;cursor:pointer;transition:all var(--base)}
.trailer-trigger:hover{background:rgba(255,71,87,.15);transform:translateY(-1px)}
.trailer-trigger i,.trailer-trigger svg{width:20px;height:20px;color:#ff4757}

.rating-section{margin-top:20px;padding-top:20px;border-top:1px solid var(--border)}
.rating-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px}
.rating-title{font-size:.9rem;color:var(--gold);font-weight:800;display:flex;align-items:center;gap:8px}
.play-rating{display:flex;gap:12px;direction:ltr}
.rate-emoji{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.05);border:2px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;transition:all .25s var(--spring);position:relative}
.rate-emoji:hover{transform:scale(1.15);background:rgba(255,255,255,.1)}
.rate-emoji.active{animation:ratingPop .4s var(--spring)}
.rate-emoji[data-val="1"].active{background:rgba(255,71,87,.15);border-color:#FF4757;box-shadow:0 0 16px rgba(255,71,87,.3)}
.rate-emoji[data-val="2"].active{background:rgba(255,165,2,.15);border-color:#FFA502;box-shadow:0 0 16px rgba(255,165,2,.3)}
.rate-emoji[data-val="3"].active{background:rgba(255,215,0,.15);border-color:#FFD700;box-shadow:0 0 16px rgba(255,215,0,.3)}
.rate-emoji[data-val="4"].active{background:rgba(46,213,115,.15);border-color:#2ED573;box-shadow:0 0 16px rgba(46,213,115,.3)}
.rate-emoji[data-val="5"].active{background:rgba(255,202,40,.2);border-color:var(--gold);box-shadow:0 0 16px var(--gold-glow)}
.rate-label{font-size:.78rem;font-weight:700;color:var(--text-secondary);text-align:center;margin-top:6px;transition:color .2s}

.community-bars{display:flex;flex-direction:column;gap:12px;margin-top:16px}
.comm-bar-row{display:flex;align-items:center;gap:10px}
.comm-bar-label{font-size:.72rem;font-weight:700;width:55px;color:var(--text-secondary)}
.comm-bar-track{flex:1;height:8px;background:rgba(255,255,255,.06);border-radius:10px;overflow:hidden;position:relative}
.comm-bar-fill{height:100%;border-radius:10px;transition:width 1s var(--out)}
.comm-bar-fill.blood{background:linear-gradient(90deg,#FF4757,#FF6B81);box-shadow:0 0 8px rgba(255,71,87,.3)}
.comm-bar-fill.art{background:linear-gradient(90deg,#FFCA28,#FFE082);box-shadow:0 0 8px rgba(255,202,40,.3)}
.comm-bar-val{font-size:.68rem;font-weight:800;color:var(--text-muted);width:32px;text-align:left}

.feedback{display:flex;justify-content:center;align-items:center;gap:44px;margin-top:22px;padding-top:20px;border-top:1px solid rgba(255,255,255,.05)}
.feedback__btn{display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;background:none;border:none;color:inherit;font-family:inherit;transition:transform var(--fast)}
.feedback__btn:active{transform:scale(.94)}
.feedback__icon{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.04);border:2px solid transparent;display:flex;align-items:center;justify-content:center;transition:all var(--base);position:relative}
.feedback__btn.active .feedback__icon{border-color:var(--gold);background:var(--gold-soft);box-shadow:var(--sh-gold)}
.feedback__btn.active .feedback__icon::before{content:'';position:absolute;inset:-5px;border-radius:50%;border:2px solid rgba(255,202,40,.25);animation:pulse-gold 2.2s infinite}
.feedback__btn svg{width:26px;height:26px;fill:var(--text-muted);color:var(--text-muted);transition:all var(--base)}
.feedback__btn.active svg{fill:var(--gold);color:var(--gold)}
.feedback__count{font-size:.74rem;font-weight:800;color:var(--text-muted);transition:color var(--fast)}
.feedback__btn.active .feedback__count{color:var(--gold)}

.cast-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(85px,1fr));gap:16px}
.cast-member{text-align:center;animation:scaleIn .32s var(--spring) backwards;cursor:pointer;transition:transform var(--fast)}
.cast-member:hover{transform:translateY(-5px)}
.cast-member__img{width:72px;height:72px;border-radius:50%;object-fit:cover;border:2.5px solid var(--c3);box-shadow:0 5px 14px rgba(0,0,0,.35);transition:all var(--base);background:var(--c2);margin:0 auto 10px;display:block}
.cast-member:hover .cast-member__img{border-color:var(--gold);box-shadow:0 8px 24px rgba(255,202,40,.18)}
.cast-member__name{font-size:.7rem;color:var(--c4);display:block;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cast-member__role{font-size:.6rem;color:var(--gold);opacity:.85;margin-top:2px;font-weight:600}

.va-list{display:flex;flex-direction:column;gap:12px;margin-top:22px;padding-top:20px;border-top:1px solid rgba(255,255,255,.05)}
.va-section-title{font-size:.85rem;color:var(--gold);font-weight:800;margin-bottom:14px;display:flex;align-items:center;gap:10px}
.va-item{display:flex;align-items:center;gap:12px;padding:12px;border-radius:var(--r-md);background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.04);transition:background var(--fast)}
.va-item:hover{background:rgba(0,0,0,.28)}
.va-img{width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--c3);flex-shrink:0}
.va-info{flex:1;min-width:0}
.va-name{font-size:.85rem;font-weight:800;color:#fff;display:block}
.va-char{font-size:.7rem;color:var(--text-secondary);margin-top:2px}
.va-lang{font-size:.62rem;color:var(--gold);font-weight:700;background:var(--gold-soft);border:1px solid var(--border-gold);padding:2px 8px;border-radius:20px;margin-top:4px;display:inline-block}

.ep-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.ep-count-badge{font-size:.74rem;color:var(--text-muted);font-weight:600;background:rgba(255,255,255,.04);padding:5px 14px;border-radius:20px}
.ep-progress{width:100%;height:5px;background:rgba(255,255,255,.05);border-radius:3px;margin-bottom:16px;overflow:hidden}
.ep-progress__fill{height:100%;background:linear-gradient(90deg,var(--gold),#ffe082);border-radius:3px;transition:width .65s var(--out)}
.ep-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}
.episode-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;cursor:pointer;transition:all var(--base);position:relative;overflow:hidden;display:flex;flex-direction:column;gap:6px;contain:layout style paint}
.episode-card::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at center,rgba(255,202,40,.06),transparent 70%);opacity:0;transition:opacity var(--base)}
.episode-card:hover{transform:translateY(-3px);border-color:var(--c3);box-shadow:var(--sh-md)}
.episode-card:hover::before{opacity:1}
.episode-card.watched{border-color:var(--gold);background:linear-gradient(135deg,rgba(255,202,40,.08),rgba(255,202,40,.02))}
.episode-card.watched::after{content:'✓';position:absolute;top:6px;left:6px;font-size:.7rem;color:var(--gold);background:rgba(0,0,0,.5);width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.ep-num{font-size:1.1rem;font-weight:900;color:var(--gold)}
.ep-title{font-size:.78rem;color:var(--text-secondary);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ep-play-icon{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;margin-top:auto;align-self:flex-end;transition:all var(--fast)}
.episode-card:hover .ep-play-icon{background:var(--gold);color:var(--c-deep)}
.ep-empty{text-align:center;padding:28px;color:var(--text-muted);font-size:.88rem;background:rgba(255,255,255,.015);border:1px dashed rgba(255,255,255,.06);border-radius:var(--r-md)}

.reco-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
@media(min-width:480px){.reco-grid{grid-template-columns:repeat(3,1fr)}}
@media(min-width:768px){.reco-grid{grid-template-columns:repeat(4,1fr)}}
.reco-card{background:rgba(255,255,255,.03);border-radius:var(--r-md);overflow:hidden;border:1px solid rgba(255,255,255,.05);cursor:pointer;transition:all var(--base) var(--spring);position:relative;contain:layout style paint}
.reco-card::before{content:'';position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.85) 0%,transparent 60%);z-index:1}
.reco-card:hover{transform:translateY(-6px);box-shadow:var(--sh-md)}
.reco-card img{width:100%;aspect-ratio:2/3;object-fit:cover;display:block}
.reco-card__meta{position:absolute;bottom:0;left:0;right:0;padding:12px;z-index:2}
.reco-card__title{font-size:.78rem;font-weight:800;line-height:1.35;color:#fff;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-shadow:0 2px 6px rgba(0,0,0,.8)}
.reco-card__score{font-size:.64rem;color:var(--gold);margin-top:5px;font-weight:700}

.comm-list{display:flex;flex-direction:column;gap:14px;max-height:450px;overflow-y:auto;padding:4px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.08) transparent;touch-action:pan-y}
.comm-list::-webkit-scrollbar{width:5px}
.comm-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:5px}
.comment-bubble{background:rgba(0,0,0,.22);padding:14px 16px;border-radius:16px 16px 4px 16px;border-right:3px solid var(--gold);transition:background var(--fast);position:relative}
.comment-bubble:hover{background:rgba(0,0,0,.3)}
.comment-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.comment-avatar{width:28px;height:28px;border-radius:50%;background:var(--c3);display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:800;color:#fff;flex-shrink:0}
.comment-author{font-size:.76rem;color:var(--gold);font-weight:800}
.comment-time{font-size:.6rem;color:var(--text-muted);margin-right:auto}
.comment-text{font-size:.88rem;color:var(--text);line-height:1.65;word-break:break-word}
.comm-input-wrap{display:flex;gap:10px;margin-top:18px;align-items:flex-end}
.input-field{flex:1;background:rgba(0,0,0,.25);border:1.5px solid rgba(255,255,255,.06);border-radius:var(--r-lg);padding:14px 16px;color:var(--text);font-family:'Cairo',sans-serif;font-size:.9rem;transition:all var(--fast);resize:none;min-height:48px;max-height:120px}
.input-field::placeholder{color:var(--text-muted)}
.input-field:focus{outline:none;border-color:rgba(255,202,40,.35);background:rgba(0,0,0,.35);box-shadow:0 0 0 4px rgba(255,202,40,.06)}
.send-btn{width:48px;height:48px;border-radius:var(--r-lg);background:var(--gold);border:none;color:var(--c-deep);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all var(--base) var(--spring);flex-shrink:0;opacity:.3;pointer-events:none}
.send-btn.ready{opacity:1;pointer-events:auto}
.send-btn.ready:hover{transform:scale(1.08);box-shadow:var(--sh-gold)}
.send-btn.ready:active{transform:scale(.94)}

.skel{background:linear-gradient(110deg,rgba(255,255,255,.03) 30%,rgba(255,255,255,.06) 50%,rgba(255,255,255,.03) 70%);background-size:200% 100%;animation:shimmer 1.8s infinite linear;border-radius:7px}
.skel-line{height:14px;margin-bottom:9px}
.skel-title{height:24px;width:70%;margin-bottom:12px}
.skel-circle{width:72px;height:72px;border-radius:50%}
.skel-poster{border-radius:var(--r-lg);width:130px;height:186px;margin-bottom:-32px;border:3px solid rgba(255,202,40,.25)}
.empty-state{text-align:center;padding:28px 18px;color:var(--text-muted);font-size:.88rem;background:rgba(255,255,255,.015);border:1px dashed rgba(255,255,255,.06);border-radius:var(--r-md)}

.sidebar-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1499;opacity:0;visibility:hidden;transition:all .32s}
.sidebar-overlay.show{opacity:1;visibility:visible}
.mobile-sidebar{position:fixed;top:0;right:-100%;width:280px;height:100%;background:rgba(6,16,38,.96);backdrop-filter:blur(28px);z-index:1500;transition:right .38s var(--smooth);overflow-y:auto;border-left:1px solid var(--border-gold);box-shadow:-6px 0 30px rgba(0,0,0,.5);touch-action:pan-y}
.mobile-sidebar.open{right:0}
.ms-header{padding:1.6rem 1.2rem;background:linear-gradient(180deg,var(--c2),rgba(21,45,90,.85));display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.08)}
.ms-header h2{font-size:1.15rem;font-weight:800}
.close-btn{background:none;border:none;color:#fff;cursor:pointer;font-size:1.35rem;padding:5px;transition:transform .2s}
.close-btn:active{transform:scale(.88)}
.ms-link{display:flex;align-items:center;gap:12px;padding:14px 1.2rem;color:var(--text-dim);text-decoration:none;font-weight:600;font-size:.92rem;transition:all .22s;border-bottom:1px solid rgba(255,255,255,.02)}
.ms-link:hover{background:var(--gold-soft);color:var(--gold);padding-right:1.6rem}
.ms-link svg,.ms-link i{width:20px;height:20px;color:var(--gold);stroke-width:1.8}

.desktop-sidebar{position:fixed;top:0;right:0;width:var(--sidebar-w);height:100vh;background:rgba(6,16,36,.78);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-left:1px solid var(--border);box-shadow:-5px 0 28px rgba(0,0,0,.45);z-index:998;display:none;flex-direction:column;padding-top:calc(var(--header-h) + var(--safe-top) + 12px);overflow-y:auto}
@media(min-width:1024px){.desktop-sidebar{display:flex}}
.ds-header{padding:18px 22px 14px;border-bottom:1px solid rgba(255,255,255,.04)}
.ds-header h3{font-size:.78rem;font-weight:700;color:var(--text-dim);opacity:.45;text-transform:uppercase;letter-spacing:1.2px}
.ds-nav{padding:10px 12px;flex:1}
.ds-link{display:flex;align-items:center;gap:14px;padding:13px 16px;margin-bottom:3px;color:rgba(255,255,255,.5);text-decoration:none;font-size:.9rem;font-weight:600;border-radius:13px;transition:all .22s}
.ds-link:hover{background:rgba(189,215,238,.06);color:#fff}
.ds-link.active{background:var(--gold-soft);color:var(--gold);border:1px solid var(--border-gold)}
.ds-link svg,.ds-link i{width:20px;height:20px;color:var(--c3);flex-shrink:0;stroke-width:1.8}
.ds-link.active svg,.ds-link.active i{color:var(--gold)}
.ds-footer{padding:18px 22px;border-top:1px solid rgba(255,255,255,.04);font-size:.72rem;color:rgba(255,255,255,.25);text-align:center}

.bottom-nav{position:fixed;bottom:0;left:0;right:0;height:calc(var(--footer-h) + var(--safe-bottom));padding-bottom:var(--safe-bottom);background:rgba(8,18,38,.68);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);display:flex;align-items:center;justify-content:space-around;z-index:999;border-top:1px solid var(--border);box-shadow:0 -10px 28px rgba(0,0,0,.35)}
@media(min-width:1024px){.bottom-nav{display:none}}
.nav-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:7px 0;text-decoration:none;color:rgba(255,255,255,.4);transition:all .32s;position:relative}
.nav-item.active{color:var(--gold)}
.nav-item.active::before{content:'';position:absolute;top:-2px;width:28px;height:3px;background:var(--gold);border-radius:0 0 5px 5px;box-shadow:0 0 14px var(--gold)}
.nav-icon-wrap{width:46px;height:30px;display:flex;align-items:center;justify-content:center}
.nav-item svg,.nav-item i{width:24px;height:24px;stroke-width:1.8}
.nav-label{font-size:.62rem;font-weight:700}

.overlay{position:fixed;inset:0;background:rgba(0,0,0,.94);backdrop-filter:blur(10px);z-index:3000;display:none;align-items:center;justify-content:center;flex-direction:column;opacity:0;transition:opacity var(--base)}
.overlay.show{display:flex;opacity:1}
.overlay__close{position:absolute;top:26px;right:22px;width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);color:#fff;font-size:1.4rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all var(--fast)}
.overlay__close:hover{background:rgba(255,255,255,.15);transform:rotate(90deg)}
.video-container{width:94%;max-width:960px;aspect-ratio:16/9;background:#000;border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--sh-lg);border:1px solid rgba(255,255,255,.08)}

.hidden{display:none!important}
.fade-in{animation:fadeUp .48s var(--out) forwards}

@media(min-width:768px){.hero{height:400px}.poster{width:155px;height:222px;margin-bottom:-38px}.meta__title{font-size:1.9rem}.panels-wrap{padding:16px 36px}}
@media(min-width:1024px){.hero{height:450px}.hero__content{padding:44px 52px;gap:32px}.poster{width:172px;height:246px;margin-bottom:-46px}.meta__title{font-size:2.1rem}.card{padding:28px}.cast-grid{grid-template-columns:repeat(auto-fill,minmax(95px,1fr))}.cast-member__img{width:82px;height:82px}}
@media(max-width:360px){.user-details{display:none}}
</style>

<div class="animated-bg"></div>
<div class="pixel-container"><span class="pixel"></span><span class="pixel"></span><span class="pixel"></span></div>

<header class="main-header" id="mainHeader">
  <div class="header-group">
    <button class="icon-btn" id="menuBtn" aria-label="القائمة"><i data-lucide="menu"></i></button>
    <a data-link="/" class="brand" href="/"><span class="brand__text">Oraa Slayer</span></a>
  </div>
  <div class="header-group">
    <button id="favBtn" class="icon-btn icon-btn--fav" aria-label="المفضلة"><i data-lucide="heart"></i></button>
    <div class="user-profile" id="userProfile">
      <div class="avatar-wrap"><img id="headerAvatar" src="https://i.ibb.co/YRShYmn/avatar.png" alt="Avatar"></div>
      <div class="user-details"><span class="user-name" id="userName">زائر</span><span class="user-role" id="roleLabel">اضغط للدخول</span></div>
      <div class="dropdown-menu" id="dropdownMenu">
        <div id="guestMenu">
          <div class="dropdown-header"><i data-lucide="user" style="width:14px;height:14px"></i> حسابي</div>
          <a data-link="/login" class="dropdown-item" href="/login"><i data-lucide="log-in"></i> تسجيل الدخول</a>
          <a data-link="/register" class="dropdown-item" href="/register"><i data-lucide="user-plus"></i> إنشاء حساب</a>
        </div>
        <div id="userMenu" style="display:none">
          <div class="dropdown-header"><i data-lucide="user" style="width:14px;height:14px"></i> حسابي</div>
          <a data-link="/profile" class="dropdown-item" href="/profile"><i data-lucide="user-circle"></i> الملف الشخصي</a>
          <a data-link="/favorites" class="dropdown-item" href="/favorites"><i data-lucide="heart"></i> المفضلة</a>
          <a data-link="/settings" class="dropdown-item" href="/settings"><i data-lucide="settings"></i> الإعدادات</a>
          <a href="#" class="dropdown-item danger" id="logoutBtn"><i data-lucide="log-out"></i> تسجيل الخروج</a>
        </div>
      </div>
    </div>
  </div>
</header>

<div class="sidebar-overlay" id="sidebarOverlay"></div>
<aside class="mobile-sidebar" id="mobileSidebar">
  <div class="ms-header"><h2>القائمة</h2><button class="close-btn" id="closeSidebar"><i data-lucide="x"></i></button></div>
  <nav style="padding:.6rem 0">
    <a data-link="/" class="ms-link" href="/"><i data-lucide="home"></i> الرئيسية</a>
    <a data-link="/newsanime" class="ms-link" href="/newsanime"><i data-lucide="newspaper"></i> أخبار الأنمي</a>
    <a data-link="/event_gacha/spin" class="ms-link" href="/event_gacha/spin"><i data-lucide="gift"></i> هدايا و أحداث</a>
    <a data-link="/favorites" class="ms-link" href="/favorites"><i data-lucide="heart"></i> المفضلة</a>
    <a data-link="/chat" class="ms-link" href="/chat"><i data-lucide="message-circle"></i> الدردشة</a>
    <a data-link="/policy" class="ms-link" href="/policy"><i data-lucide="shield"></i> سياسة الخصوصية</a>
  </nav>
</aside>

<nav class="desktop-sidebar">
  <div class="ds-header"><h3>القائمة</h3></div>
  <div class="ds-nav">
    <a data-link="/" class="ds-link active" href="/"><i data-lucide="home"></i> الرئيسية</a>
    <a data-link="/newsanime" class="ds-link" href="/newsanime"><i data-lucide="newspaper"></i> أخبار الأنمي</a>
    <a data-link="/event_gacha/spin" class="ds-link" href="/event_gacha/spin"><i data-lucide="gift"></i> هدايا و أحداث</a>
    <a data-link="/favorites" class="ds-link" href="/favorites"><i data-lucide="heart"></i> المفضلة</a>
    <a data-link="/chat" class="ds-link" href="/chat"><i data-lucide="message-circle"></i> الدردشة</a>
    <a data-link="/policy" class="ds-link" href="/policy"><i data-lucide="shield"></i> سياسة الخصوصية</a>
  </div>
  <div class="ds-footer">Oraa Slayer &copy; 2026</div>
</nav>

<div id="trailerOverlay" class="overlay">
  <button class="overlay__close" id="trailerCloseBtn"><i data-lucide="x"></i></button>
  <div id="ytContainer" class="video-container"></div>
</div>

<div class="main-content">
  <section class="hero anim-fade-up">
    <div id="heroBg" class="hero__backdrop"></div>
    <div class="hero__vignette"></div>
    <div class="hero__content">
      <div class="poster-wrap">
        <div id="skelPoster" class="skel skel-poster"></div>
        <img id="poster" class="poster hidden" alt="Poster" loading="eager" decoding="async">
      </div>
      <div class="meta anim-fade-up anim-d1">
        <div id="cacheBadge" class="cache-badge hidden"><i data-lucide="zap" style="width:12px;height:12px"></i> محمّل من الكاش</div>
        <div id="skelTitle" class="skel skel-title"></div>
        <h1 id="title" class="meta__title hidden"></h1>
        <div id="tags" class="meta__tags"></div>
      </div>
    </div>
  </section>

  <div class="tabs-wrap anim-fade-up anim-d2">
    <div class="tabs-track" role="tablist" id="tabsTrack">
      <button class="tab-btn active" data-tab="story" role="tab"><i data-lucide="book-open"></i> القصة</button>
      <button class="tab-btn" data-tab="cast" role="tab"><i data-lucide="users"></i> الأبطال<span class="tab-badge" id="castBadge" style="display:none"></span></button>
      <button class="tab-btn" data-tab="episodes" role="tab"><i data-lucide="clapperboard"></i> الحلقات<span class="tab-badge" id="epBadge" style="display:none"></span></button>
      <button class="tab-btn" data-tab="stats" role="tab"><i data-lucide="bar-chart-3"></i> الإحصاء</button>
      <button class="tab-btn" data-tab="reco" role="tab"><i data-lucide="sparkles"></i> مقترحات</button>
      <button class="tab-btn" data-tab="comments" role="tab"><i data-lucide="message-square"></i> النقاش</button>
    </div>
  </div>

  <div class="panels-wrap">
    <div id="panel-story" class="tab-panel active" role="tabpanel">
      <div class="card anim-fade-up anim-d3">
        <div class="card__header"><i data-lucide="book-open"></i> القصة والوصف</div>
        <div id="descContainer"><div class="skel skel-line"></div><div class="skel skel-line" style="width:85%"></div><div class="skel skel-line" style="width:60%"></div></div>
        <div id="trailerBtn" class="hidden" style="margin-top:18px"><button class="trailer-trigger" id="trailerTrigger"><i data-lucide="play-circle"></i> مشاهدة الإعلان</button></div>
        <div class="rating-section">
          <div class="rating-header"><div class="rating-title"><i data-lucide="star"></i> تقييمك الشخصي</div>
            <div class="play-rating" id="playRating">
              <div class="rate-emoji" data-val="1">😡<div class="rate-label">سيء</div></div>
              <div class="rate-emoji" data-val="2">😕<div class="rate-label">لابأس</div></div>
              <div class="rate-emoji" data-val="3">😐<div class="rate-label">عادي</div></div>
              <div class="rate-emoji" data-val="4">😊<div class="rate-label">جيد</div></div>
              <div class="rate-emoji" data-val="5">🤩<div class="rate-label">ممتاز</div></div>
            </div>
          </div>
          <div class="community-bars">
            <div class="comm-bar-row"><span class="comm-bar-label">دموية</span><div class="comm-bar-track"><div id="bloodBar" class="comm-bar-fill blood" style="width:0%"></div></div><span id="bloodVal" class="comm-bar-val">0%</span></div>
            <div class="comm-bar-row"><span class="comm-bar-label">الفنية</span><div class="comm-bar-track"><div id="artBar" class="comm-bar-fill art" style="width:0%"></div></div><span id="artVal" class="comm-bar-val">0%</span></div>
          </div>
        </div>
        <div class="feedback">
          <button id="likeBtn" class="feedback__btn"><div class="feedback__icon"><svg viewBox="0 0 27 27"><path d="M0.7229 26.5H5.92292V10.9008H0.7229V26.5ZM26.6299 15.2618L24.372 23.7566C23.9989 25.3696 22.5621 26.5 20.9072 26.5H8.52293V10.9278L10.7573 2.87293C10.9669 1.50799 12.1418 0.5 13.524 0.5C15.0699 0.5 16.323 1.7527 16.323 3.29837V10.8998H23.1651C25.4519 10.9009 27.1453 13.0335 26.6299 15.2618Z"/></svg></div><span id="likeCount" class="feedback__count">0</span></button>
          <button id="unlikeBtn" class="feedback__btn"><div class="feedback__icon"><svg viewBox="0 0 27 27"><path d="M26.7229 0.5L21.5229 0.5L21.5229 16.0992L26.7229 16.0992L26.7229 0.5ZM0.815853 11.7382L3.07376 3.24339C3.44687 1.63037 4.88372 0.500027 6.53861 0.500027L18.9229 0.500028L18.9229 16.0722L16.6885 24.1271C16.4789 25.492 15.304 26.5 13.9218 26.5C12.3759 26.5 11.1228 25.2473 11.1228 23.7016L11.1228 16.1002L4.28068 16.1002C1.99391 16.0991 0.300502 13.9664 0.815853 11.7382Z"/></svg></div><span id="unlikeCount" class="feedback__count">0</span></button>
        </div>
      </div>
    </div>
    <div id="panel-cast" class="tab-panel" role="tabpanel"><div class="card"><div class="card__header"><i data-lucide="users"></i> الشخصيات</div><div id="castGrid" class="cast-grid"></div><div id="vaSection" class="va-list hidden"><div class="va-section-title"><i data-lucide="mic"></i> المؤدون الصوتيون</div><div id="vaList"></div></div></div></div>
    <div id="panel-episodes" class="tab-panel" role="tabpanel"><div class="card"><div class="ep-header"><div class="card__header" style="margin:0"><i data-lucide="clapperboard"></i> الحلقات</div><span id="epCountBadge" class="ep-count-badge">...</span></div><div class="ep-progress"><div id="epProgressFill" class="ep-progress__fill" style="width:0%"></div></div><div id="epGrid" class="ep-grid"></div></div></div>
    <div id="panel-stats" class="tab-panel" role="tabpanel"><div class="card"><div class="card__header"><i data-lucide="bar-chart-3"></i> الإحصائيات</div><div class="stats-grid"><div class="stat-ring-card"><div class="stat-ring" style="--target:0;--p:0"><span class="stat-ring-value" id="popularityVal">-</span></div><span class="stat-ring-label">مشاهد</span><span class="stat-ring-sub">Popularity</span></div><div class="stat-ring-card"><div class="stat-ring" style="--target:0;--p:0"><span class="stat-ring-value" id="scoreVal">-</span></div><span class="stat-ring-label">التقييم</span><span class="stat-ring-sub">Score</span></div><div class="stat-ring-card"><div class="stat-ring" style="--target:0;--p:0"><span class="stat-ring-value" id="epStatVal">-</span></div><span class="stat-ring-label">الحلقات</span><span class="stat-ring-sub">Episodes</span></div><div class="stat-ring-card"><div class="stat-ring" style="--target:0;--p:0"><span class="stat-ring-value" id="formatVal" style="font-size:.85rem">-</span></div><span class="stat-ring-label">النوع</span><span class="stat-ring-sub">Format</span></div><div class="stat-ring-card"><div class="stat-ring" style="--target:0;--p:0"><span class="stat-ring-value" id="statusVal" style="font-size:.85rem">-</span></div><span class="stat-ring-label">الحالة</span><span class="stat-ring-sub">Status</span></div><div class="stat-ring-card"><div class="stat-ring" style="--target:0;--p:0"><span class="stat-ring-value" id="studioVal" style="font-size:.75rem;word-break:break-word">-</span></div><span class="stat-ring-label">الاستوديو</span><span class="stat-ring-sub">Studio</span></div></div></div></div>
    <div id="panel-reco" class="tab-panel" role="tabpanel"><div class="card"><div class="card__header"><i data-lucide="sparkles"></i> أنميات مقترحة</div><div id="recoGrid" class="reco-grid"></div></div></div>
    <div id="panel-comments" class="tab-panel" role="tabpanel"><div class="card"><div class="card__header"><i data-lucide="message-square"></i> النقاشات</div><div id="commList" class="comm-list"></div><div class="comm-input-wrap"><textarea id="commInput" class="input-field" placeholder="شارك برأيك هنا..." autocomplete="off" maxlength="280" rows="1"></textarea><button id="sendBtn" class="send-btn" aria-label="إرسال"><i data-lucide="send" style="width:20px;height:20px"></i></button></div></div></div>
  </div>
</div>

<footer class="bottom-nav">
  <a data-link="/" class="nav-item active" href="/"><div class="nav-icon-wrap"><i data-lucide="home"></i></div><span class="nav-label">الرئيسية</span></a>
  <a data-link="/newsanime" class="nav-item" href="/newsanime"><div class="nav-icon-wrap"><i data-lucide="newspaper"></i></div><span class="nav-label">أخبار</span></a>
  <a data-link="/event_gacha/spin" class="nav-item" href="/event_gacha/spin"><div class="nav-icon-wrap"><i data-lucide="gift"></i></div><span class="nav-label">هدايا</span></a>
  <a data-link="/chat" class="nav-item" href="/chat"><div class="nav-icon-wrap"><i data-lucide="message-circle"></i></div><span class="nav-label">دردشة</span></a>
  <a data-link="/profile" class="nav-item" href="/profile"><div class="nav-icon-wrap"><i data-lucide="user"></i></div><span class="nav-label">حسابي</span></a>
</footer>
`;

  // ─── 5. Load Dependencies & Icons ─────────────────────────────────
  if (!window.lucide) {
    await new Promise(res => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js';
      s.onload = res; s.onerror = res; document.head.appendChild(s);
    });
  }
  requestAnimationFrame(() => window.lucide?.createIcons());

  // ─── 6. SPA Navigation ───────────────────────────────────────────
  const spaNav = (path) => {
    if (typeof go === 'function') return go(path);
    if (typeof window.go === 'function') return window.go(path);
    location.href = path;
  };
  root.addEventListener('click', (e) => {
    const link = e.target.closest('[data-link]');
    if (link) { e.preventDefault(); const path = link.getAttribute('data-link'); if (path) spaNav(path); }
  }, { signal: ac.signal });

  // ─── 7. DOM References ───────────────────────────────────────────
  const qs = (id) => root.querySelector('#' + id);
  const D = {
    mainHeader: qs('mainHeader'), menuBtn: qs('menuBtn'), mobileSidebar: qs('mobileSidebar'),
    sidebarOverlay: qs('sidebarOverlay'), closeSidebar: qs('closeSidebar'), userProfile: qs('userProfile'),
    dropdownMenu: qs('dropdownMenu'), guestMenu: qs('guestMenu'), userMenu: qs('userMenu'),
    userName: qs('userName'), roleLabel: qs('roleLabel'), headerAvatar: qs('headerAvatar'),
    favBtn: qs('favBtn'), logoutBtn: qs('logoutBtn'), heroBg: qs('heroBg'), skelPoster: qs('skelPoster'),
    skelTitle: qs('skelTitle'), cacheBadge: qs('cacheBadge'), poster: qs('poster'), title: qs('title'),
    tags: qs('tags'), descContainer: qs('descContainer'), trailerBtn: qs('trailerBtn'),
    trailerTrigger: qs('trailerTrigger'), trailerOverlay: qs('trailerOverlay'),
    trailerCloseBtn: qs('trailerCloseBtn'), ytContainer: qs('ytContainer'), bloodBar: qs('bloodBar'),
    artBar: qs('artBar'), bloodVal: qs('bloodVal'), artVal: qs('artVal'), likeBtn: qs('likeBtn'),
    unlikeBtn: qs('unlikeBtn'), likeCount: qs('likeCount'), unlikeCount: qs('unlikeCount'),
    playRating: qs('playRating'), castGrid: qs('castGrid'), vaSection: qs('vaSection'),
    vaList: qs('vaList'), epGrid: qs('epGrid'), epCountBadge: qs('epCountBadge'),
    epProgressFill: qs('epProgressFill'), epBadge: qs('epBadge'), castBadge: qs('castBadge'),
    popularityVal: qs('popularityVal'), scoreVal: qs('scoreVal'), epStatVal: qs('epStatVal'),
    formatVal: qs('formatVal'), statusVal: qs('statusVal'), studioVal: qs('studioVal'),
    recoGrid: qs('recoGrid'), commList: qs('commList'), commInput: qs('commInput'), sendBtn: qs('sendBtn'),
  };

  // ─── 8. Constants ────────────────────────────────────────────────
  const IMG_FALLBACK = 'https://via.placeholder.com/300x450/0F2854/BDE8F5?text=No+Image';
  const ANILIST_URL = 'https://graphql.anilist.co';
  const ANILIST_QUERY = `query($id:Int){Media(id:$id){id title{userPreferred} description(asHtml:false) coverImage{extraLarge large medium} bannerImage trailer{id site} episodes status format popularity averageScore genres studios(isMain:true){nodes{name}} characters(sort:ROLE,perPage:14){edges{role node{name{userPreferred} image{large}} voiceActors(language:JAPANESE){name{userPreferred} image{large} languageV2}}} recommendations(sort:RATING_DESC,perPage:10){nodes{rating mediaRecommendation{id title{userPreferred} coverImage{extraLarge large} averageScore format seasonYear}}}}}`;
  const safeImg = (s) => s || IMG_FALLBACK;
  const escapeHTML = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const refreshIcons = () => { try { window.lucide?.createIcons(); } catch {} };

  // ─── 9. IndexedDB Cache ──────────────────────────────────────────
  const IDB = (() => {
    let _db = null;
    const open = () => new Promise((res, rej) => {
      const req = indexedDB.open('aegis-cache-v1', 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore('anime', { keyPath: 'id' });
      req.onsuccess = e => { _db = e.target.result; res(_db); };
      req.onerror = () => rej(req.error);
    });
    const get = async (id) => {
      if (!_db) await open();
      return new Promise((res, rej) => {
        const req = _db.transaction('anime','readonly').objectStore('anime').get(String(id));
        req.onsuccess = () => res(req.result || null); req.onerror = () => rej(req.error);
      });
    };
    const set = async (id, data) => {
      if (!_db) await open();
      return new Promise((res, rej) => {
        const req = _db.transaction('anime','readwrite').objectStore('anime').put({ id: String(id), data, ts: Date.now() });
        req.onsuccess = () => res(); req.onerror = () => rej(req.error);
      });
    };
    return { open, get, set };
  })();

  // ─── 10. State ───────────────────────────────────────────────────
  let _state = {
    animeId: animeId ? String(animeId) : null,
    // ✅ NEW: localJsonId stores the filename/id used for local JSON and servers route
    //    Will be set after loading the local JSON (e.g., "Jigokuraku_Season_2")
    localJsonId: null,   
    uid: null, media: null, localData: null, fromCache: false,
    currentTab: 'story', vote: null, likes: 0, unlikes: 0,
    bloodHigh: 0, bloodLow: 0, artGood: 0, artBad: 0, watched: [], isFav: false, userRating: 0
  };
  const _listeners = {};
  const emit = (evt, payload) => (_listeners[evt] || []).forEach(fn => fn(payload));
  const onEvt = (evt, fn) => { (_listeners[evt] ??= []).push(fn); };
  const patch = (partial) => { _state = { ..._state, ...partial }; emit('change', _state); };

  // ─── 11. Tab System ──────────────────────────────────────────────
  const tabPanels = {}, tabButtons = {};
  root.querySelectorAll('.tab-btn').forEach(btn => {
    const t = btn.dataset.tab; tabButtons[t] = btn;
    btn.addEventListener('click', () => { if (_state.currentTab !== t) { patch({ currentTab: t }); emit('tab', t); } }, { signal: ac.signal });
  });
  root.querySelectorAll('.tab-panel').forEach(p => { tabPanels[p.id.replace('panel-', '')] = p; });
  let activeTab = 'story';
  onEvt('tab', (tabId) => {
    if (tabId === activeTab) return;
    requestAnimationFrame(() => {
      if (tabPanels[activeTab]) { tabPanels[activeTab].classList.remove('active'); tabButtons[activeTab]?.classList.remove('active'); }
      activeTab = tabId;
      if (tabPanels[tabId]) { tabPanels[tabId].classList.add('active'); tabPanels[tabId].style.animation='none'; requestAnimationFrame(()=>{ tabPanels[tabId].style.animation=''; }); }
      if (tabButtons[tabId]) { tabButtons[tabId].classList.add('active'); }
      refreshIcons();
    });
  });

  // ─── 12. Render Functions ────────────────────────────────────────
  const renderCast = (edges) => {
    if (!D.castGrid) return;
    const frag = document.createDocumentFragment(), vaFrag = document.createDocumentFragment();
    let vaCount = 0;
    edges.forEach((edge, i) => {
      const c = edge.node || {}, va = (edge.voiceActors || [])[0];
      const div = document.createElement('div'); div.className = 'cast-member fade-in'; div.style.animationDelay = (i * 0.04) + 's';
      div.innerHTML = `<img src="${safeImg(c.image?.large)}" class="cast-member__img" loading="lazy" onerror="this.src='${IMG_FALLBACK}'"><span class="cast-member__name">${escapeHTML(c.name?.userPreferred||'Unknown')}</span><span class="cast-member__role">${escapeHTML(edge.role||'')}</span>`;
      frag.appendChild(div);
      if (va) { vaCount++; const item = document.createElement('div'); item.className = 'va-item'; item.innerHTML = `<img src="${safeImg(va.image?.large)}" class="va-img" loading="lazy" onerror="this.src='${IMG_FALLBACK}'"><div class="va-info"><strong class="va-name">${escapeHTML(va.name?.userPreferred||'')}</strong><span class="va-char">يؤدي: ${escapeHTML(c.name?.userPreferred||'')}</span><span class="va-lang">${escapeHTML(va.languageV2||'JP')}</span></div>`; vaFrag.appendChild(item); }
    });
    D.castGrid.innerHTML = ''; D.castGrid.appendChild(frag);
    if (vaCount > 0 && D.vaList && D.vaSection) { D.vaList.innerHTML = ''; D.vaList.appendChild(vaFrag); D.vaSection.classList.remove('hidden'); }
    if (edges.length > 0 && D.castBadge) { D.castBadge.textContent = edges.length; D.castBadge.style.display = 'inline'; }
    refreshIcons();
  };

  const updateEpProgress = (watched, total) => { if (D.epProgressFill) D.epProgressFill.style.width = (total > 0 ? Math.round((watched / total) * 100) : 0) + '%'; };
  
  // ✅ FIXED: renderEpisodes now uses _state.localJsonId (the file-name ID) for navigation
  const renderEpisodes = (episodes, aid, watchedArr) => {
    if (!D.epGrid) return;
    const frag = document.createDocumentFragment();
    // 🚀 IMPORTANT: Use the localJsonId (e.g. "Jigokuraku_Season_2") for the servers route
    const routeId = _state.localJsonId || aid;
    
    episodes.forEach((ep, i) => {
      const div = document.createElement('div'); 
      div.className = 'episode-card' + (watchedArr.includes(ep.epNum) ? ' watched' : '') + ' fade-in'; 
      div.style.animationDelay = Math.min(i, 20) * 0.02 + 's';
      div.innerHTML = `<span class="ep-num">EP ${ep.epNum}</span><span class="ep-title" title="${escapeHTML(ep.title||`الحلقة ${ep.epNum}`)}">${escapeHTML(ep.title||`الحلقة ${ep.epNum}`)}</span><div class="ep-play-icon"><i data-lucide="play" style="width:14px;height:14px"></i></div>`;
      div.addEventListener('click', () => {
        patch({ watched: [..._state.watched, ep.epNum] });
        localStorage.setItem('watched_' + aid, JSON.stringify([..._state.watched, ep.epNum]));
        try { localStorage.setItem('_play_data', btoa(encodeURIComponent(JSON.stringify({ animeId: aid, title: _state.media?.title?.userPreferred || '', epNum: ep.epNum, poster: _state.media?.coverImage?.extraLarge || '' })))); } catch {}
        localStorage.setItem('_current_anime_id', aid);
        localStorage.setItem('_current_anime_title', _state.media?.title?.userPreferred || '');
        localStorage.setItem('_current_anime_poster', _state.media?.coverImage?.extraLarge || '');
        // 🔥 FIXED: Navigate to servers page using the LOCAL JSON ID
        spaNav(`/servers/${encodeURIComponent(routeId)}/${ep.epNum}`);
      }, { signal: ac.signal });
      frag.appendChild(div);
    });
    D.epGrid.innerHTML = ''; D.epGrid.appendChild(frag);
    if (D.epCountBadge) D.epCountBadge.textContent = episodes.length + ' حلقة';
    if (D.epBadge) { D.epBadge.textContent = episodes.length; D.epBadge.style.display = 'inline'; }
    updateEpProgress(watchedArr.length, episodes.length);
    refreshIcons();
  };

  const renderRecommendations = (nodes) => {
    if (!D.recoGrid) return;
    const items = nodes.map(n => n.mediaRecommendation).filter(Boolean).filter(i => String(i.id) !== String(_state.animeId)).slice(0, 8);
    if (!items.length) { D.recoGrid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">لا توجد اقتراحات.</div>'; return; }
    const frag = document.createDocumentFragment();
    items.forEach((item, i) => {
      const card = document.createElement('div'); card.className = 'reco-card fade-in'; card.style.animationDelay = (i * 0.05) + 's';
      card.innerHTML = `<img src="${safeImg(item.coverImage?.extraLarge||item.coverImage?.large)}" loading="lazy" onerror="this.src='${IMG_FALLBACK}'"><div class="reco-card__meta"><div class="reco-card__title">${escapeHTML(item.title?.userPreferred||'Unknown')}</div><div class="reco-card__score">★ ${item.averageScore ? (item.averageScore/10).toFixed(1) : '-'} · ${escapeHTML(item.format||'TV')}</div></div>`;
      card.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); spaNav('/anime?id=' + btoa(String(item.id))); }, { signal: ac.signal });
      frag.appendChild(card);
    });
    D.recoGrid.innerHTML = ''; D.recoGrid.appendChild(frag);
  };

  const renderStats = (m) => {
    const statusMap = { FINISHED:'منتهي', RELEASING:'يعرض', NOT_YET_RELEASED:'قريباً', CANCELLED:'ملغي' };
    const formatMap = { TV:'تلفزيوني', MOVIE:'فيلم', OVA:'OVA', ONA:'ONA', SPECIAL:'خاص', MUSIC:'موسيقي' };
    const setRing = (el, val, pct) => { if(el){ el.textContent = val; el.parentElement.style.setProperty('--target', pct); requestAnimationFrame(()=>{ el.parentElement.style.setProperty('--p', pct); }); } };
    setRing(D.popularityVal, (m.popularity||0).toLocaleString(), Math.min(100, Math.round((m.popularity || 0) / 1000)));
    setRing(D.scoreVal, m.averageScore ? (m.averageScore/10).toFixed(1) : '-', m.averageScore || 0);
    setRing(D.epStatVal, m.episodes || '?', Math.min(100, (m.episodes || 0) * 2));
    setRing(D.formatVal, formatMap[m.format] || m.format || '-', 100);
    setRing(D.statusVal, statusMap[m.status] || m.status || '-', 100);
    setRing(D.studioVal, m.studios?.nodes?.[0]?.name || '-', 100);
  };

  // ✅ FIXED: processMedia now extracts localJsonId from the local JSON response
  const processMedia = (m, localData, fromCache = false) => {
    patch({ media: m, localData, fromCache });
    
    // 🚀 Extract the local JSON ID from the response
    if (localData && localData.id) {
      patch({ localJsonId: String(localData.id) });
    } else if (localData && localData.episodes && !localData.id) {
      // إذا كانت الاستجابة المحلية لا تحتوي على حقل id صريح، نحاول استنتاجه
      // (تم تعيينه مسبقاً في launchEngine)
    }
    
    if (D.skelPoster) D.skelPoster.classList.add('hidden');
    if (D.skelTitle) D.skelTitle.classList.add('hidden');
    if (D.poster) { D.poster.classList.remove('hidden'); D.poster.src = safeImg(m.coverImage?.extraLarge || m.coverImage?.large || m.coverImage?.medium); D.poster.onerror = () => { D.poster.src = IMG_FALLBACK; }; }
    if (D.title) { D.title.classList.remove('hidden'); D.title.textContent = m.title?.userPreferred || 'Unknown'; }
    if (D.heroBg) D.heroBg.style.backgroundImage = `url(${safeImg(m.bannerImage || m.coverImage?.extraLarge || m.coverImage?.large)})`;
    document.title = 'OraaSlayer | ' + (m.title?.userPreferred || 'أنمي');
    if (fromCache && D.cacheBadge) D.cacheBadge.classList.remove('hidden');
    if (D.tags) D.tags.innerHTML = (m.genres || []).slice(0, 4).map(g => `<span class="tag">${escapeHTML(g)}</span>`).join('');
    const clean = (m.description || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (D.descContainer) D.descContainer.innerHTML = clean ? `<p class="description">${escapeHTML(clean)}</p>` : '<div class="empty-state">لا يوجد وصف.</div>';
    if (m.trailer?.site === 'youtube' && m.trailer?.id) { window.__trailerKey = m.trailer.id; if (D.trailerBtn) D.trailerBtn.classList.remove('hidden'); }
    renderStats(m);
    const edges = m.characters?.edges || [];
    if (edges.length) requestAnimationFrame(() => renderCast(edges));
    requestAnimationFrame(() => renderRecommendations(m.recommendations?.nodes || []));
    const watched = JSON.parse(localStorage.getItem('watched_' + m.id) || '[]'); patch({ watched });
    if (localData?.episodes?.length) { requestAnimationFrame(() => renderEpisodes(localData.episodes, m.id, watched)); }
    else if (D.epGrid) { D.epGrid.innerHTML = '<div class="ep-empty">الحلقات غير متوفرة حالياً</div>'; if (D.epCountBadge) D.epCountBadge.textContent = '—'; }
    
    // ★ FIX FAVORITE STATE ON LOAD ★
    const favs = JSON.parse(localStorage.getItem('user_favs') || '[]');
    const isFav = favs.includes(String(m.id));
    patch({ isFav });
    if (D.favBtn) D.favBtn.classList.toggle('active', isFav);

    refreshIcons();
  };

  // ─── 13. Play Store Rating & Favorite ────────────────────────────
  const initRating = () => {
    const saved = localStorage.getItem('rate_' + _state.animeId);
    if (saved) { patch({ userRating: parseInt(saved) }); updateRatingUI(parseInt(saved)); }
    D.playRating?.querySelectorAll('.rate-emoji').forEach(emoji => {
      emoji.addEventListener('click', () => {
        const val = parseInt(emoji.dataset.val);
        patch({ userRating: val }); localStorage.setItem('rate_' + _state.animeId, val);
        updateRatingUI(val);
      }, { signal: ac.signal });
    });
  };

  const updateRatingUI = (val) => {
    D.playRating?.querySelectorAll('.rate-emoji').forEach(e => {
      const v = parseInt(e.dataset.val);
      const isActive = v === val;
      e.classList.toggle('active', isActive);
      const label = e.querySelector('.rate-label');
      if (label) label.style.color = isActive ? '#fff' : '';
    });
  };

  // ★ FIXED FAVORITE BUTTON LOGIC ★
  const initFavorite = () => {
    D.favBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!_state.animeId) return;
      
      let favs = JSON.parse(localStorage.getItem('user_favs') || '[]');
      const id = String(_state.animeId);
      const isFav = favs.includes(id);
      
      if (isFav) {
        favs = favs.filter(f => f !== id);
        patch({ isFav: false });
      } else {
        favs.push(id);
        patch({ isFav: true });
      }
      
      localStorage.setItem('user_favs', JSON.stringify(favs));
      if (D.favBtn) D.favBtn.classList.toggle('active', !isFav);
    }, { signal: ac.signal });
  };

  // ─── 14. Events ──────────────────────────────────────────────────
  const openTrailer = () => {
    const key = window.__trailerKey; if (!key || !D.trailerOverlay) return;
    D.trailerOverlay.classList.add('show'); document.body.style.overflow = 'hidden';
    if (D.ytContainer) D.ytContainer.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${key}?autoplay=1&rel=0" allow="autoplay;encrypted-media;picture-in-picture" allowfullscreen style="border:none"></iframe>`;
  };
  const closeTrailer = () => {
    D.trailerOverlay?.classList.remove('show'); document.body.style.overflow = '';
    setTimeout(() => { if (D.ytContainer) D.ytContainer.innerHTML = ''; }, 300);
  };
  D.trailerTrigger?.addEventListener('click', openTrailer, { signal: ac.signal });
  D.trailerCloseBtn?.addEventListener('click', closeTrailer, { signal: ac.signal });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTrailer(); }, { signal: ac.signal });

  D.menuBtn?.addEventListener('click', () => { D.mobileSidebar?.classList.add('open'); D.sidebarOverlay?.classList.add('show'); refreshIcons(); }, { signal: ac.signal });
  D.closeSidebar?.addEventListener('click', () => { D.mobileSidebar?.classList.remove('open'); D.sidebarOverlay?.classList.remove('show'); }, { signal: ac.signal });
  D.sidebarOverlay?.addEventListener('click', () => { D.mobileSidebar?.classList.remove('open'); D.sidebarOverlay?.classList.remove('show'); }, { signal: ac.signal });
  D.userProfile?.addEventListener('click', (e) => { e.stopPropagation(); D.dropdownMenu?.classList.toggle('show'); refreshIcons(); }, { signal: ac.signal });
  document.addEventListener('click', () => D.dropdownMenu?.classList.remove('show'), { signal: ac.signal });
  
  let scrollTick = false;
  window.addEventListener('scroll', () => { if (scrollTick) return; scrollTick = true; requestAnimationFrame(() => { D.mainHeader?.classList.toggle('header--scrolled', window.scrollY > 50); scrollTick = false; }); }, { signal: ac.signal, passive: true });

  // ─── 15. Data Loading ────────────────────────────────────────────
  // ✅ FIXED: launchEngine now explicitly extracts localJsonId from the fetched JSON
  const launchEngine = async (aid) => {
    const localVote = localStorage.getItem('vote_' + aid); 
    if (localVote) { patch({ vote: localVote }); D.likeBtn?.classList.toggle('active', localVote === 'like'); D.unlikeBtn?.classList.toggle('active', localVote === 'unlike'); }
    const watched = JSON.parse(localStorage.getItem('watched_' + aid) || '[]'); patch({ watched });
    
    let fromCache = false;
    
    // Try loading local data first to get the localJsonId
    let localDataFromFetch = null;
    try {
      localDataFromFetch = await fetch(`/anime/data/${aid}.json`).then(r => r.ok ? r.json() : null).catch(() => null);
      // ✅ SET localJsonId from the fetched data
      if (localDataFromFetch && localDataFromFetch.id) {
        patch({ localJsonId: String(localDataFromFetch.id) });
      } else if (localDataFromFetch) {
        // Fallback: if the JSON doesn't have an explicit id, use the aid (numeric Anilist ID)
        // But for servers we'll use the aid for fetching, but we need the actual file ID
        // This assumes your JS file knows which local ID corresponds to which Anilist ID
        // For now, we'll keep the aid as fallback, but the router fix is still needed
      }
    } catch (e) {
      console.warn('Failed to preload local data:', e);
    }
    
    try { 
      const cached = await IDB.get(aid); 
      if (cached && (Date.now() - cached.ts < 3600000)) { 
        fromCache = true; 
        // Use the already fetched local data or fetch again
        processMedia(cached.data, localDataFromFetch, true); 
      } 
    } catch(e) { console.warn('IDB Cache failed:', e); }

    try {
      // Fetch AniList API
      const apiRes = await fetch(ANILIST_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ query: ANILIST_QUERY, variables: { id: parseInt(aid) } }) 
      }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
      
      const media = apiRes?.data?.Media;
      if (!media) throw new Error('لم يعثر على الأنمي');
      patch({ animeId: String(media.id) }); 
      IDB.set(aid, media).catch(() => {});
      
      // If local data wasn't pre-fetched, fetch it now
      if (!localDataFromFetch && !fromCache) {
        localDataFromFetch = await fetch(`/anime/data/${aid}.json`).then(r => r.ok ? r.json() : null).catch(() => null);
        if (localDataFromFetch && localDataFromFetch.id) {
          patch({ localJsonId: String(localDataFromFetch.id) });
        }
      }
      
      if (!fromCache) processMedia(media, localDataFromFetch, false);
      else patch({ media: media, localData: localDataFromFetch });
      
      initRating();
      initFavorite();
      initComments(animeId);
    } catch (err) {
      console.error('[Anime Engine Error]', err);
      if (!fromCache && D.descContainer) {
        D.descContainer.innerHTML = `<div class="empty-state"><div style="font-size:1.5rem;margin-bottom:8px">⚠️</div><div>تعذر جلب البيانات</div><button id="retryBtn" style="margin-top:12px;padding:8px 18px;border-radius:10px;background:var(--gold);color:#08111f;border:none;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif">إعادة المحاولة</button></div>`;
        qs('retryBtn')?.addEventListener('click', () => { if (D.descContainer) D.descContainer.innerHTML = '<div class="skel skel-line"></div>'; launchEngine(aid); }, { signal: ac.signal });
      }
    }
  };

  // ─── 16. Comments ─────────
  const initComments = (aid) => {
    if (!D.commList) return;
    D.commList.innerHTML = '<div class="empty-state" style="font-size:.8rem;color:var(--text-muted)">سجل الدخول للمشاركة في النقاش</div>';
  };

  // ─── 17. Auth ────────────────────────────────────────────────────
  if (fireauth && onAuthStateChanged) {
    const authUnsub = onAuthStateChanged(fireauth, async user => {
      if (user) {
        patch({ uid: user.uid });
        if (D.userName) D.userName.textContent = user.displayName || 'مستخدم';
        if (D.roleLabel) D.roleLabel.textContent = 'عضو';
        if (D.headerAvatar && user.photoURL) D.headerAvatar.src = user.photoURL;
        if (D.guestMenu) D.guestMenu.style.display = 'none';
        if (D.userMenu) D.userMenu.style.display = 'block';
        if (D.commInput) D.commInput.placeholder = 'شارك برأيك هنا...';
      } else {
        patch({ uid: null });
        if (D.guestMenu) D.guestMenu.style.display = 'block';
        if (D.userMenu) D.userMenu.style.display = 'none';
        if (D.userName) D.userName.textContent = 'زائر';
        if (D.roleLabel) D.roleLabel.textContent = 'اضغط للدخول';
      }
      refreshIcons();
    });
    if (D.logoutBtn && signOut) {
      D.logoutBtn.addEventListener('click', (e) => { e.preventDefault(); signOut(fireauth); }, { signal: ac.signal });
    }
  }

  // ─── 18. Launch ──────────────────────────────────────────────────
  if (!animeId) {
    if (D.descContainer) D.descContainer.innerHTML = '<div class="empty-state"><div style="font-size:1.5rem;margin-bottom:8px">❓</div>لم يتم تحديد أنمي — تحقق من الرابط.</div>';
  } else {
    IDB.open().catch(() => {});
    await launchEngine(animeId);
  }
  
  refreshIcons();

  // ─── 19. Cleanup ─────────────────────────────────────────────────
  if (typeof ctx.onCleanup === 'function') {
    ctx.onCleanup(() => {
      ac.abort();
      unsubs.forEach(fn => { try { fn(); } catch {} });
      document.body.style.overflow = '';
      delete window.__trailerKey;
    });
  }
}