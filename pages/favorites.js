// /pages/favorites.js – صفحة المفضلة الاحترافية
// متوافقة مع الروتر، Firebase auth، Lucide icons، AniList API
export default async function Favorites(ctx) {
  const { root, go, auth, db } = ctx;
  const cleanup = [];
  const ac = new AbortController();

  // ─── 1. Meta & Scroll ────────────────────────────────────────────
  const ensureMeta = (name, content) => {
    let el = document.head.querySelector(`meta[name="${name}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
    el.setAttribute('content', content);
  };
  ensureMeta('theme-color', '#1C4D8D');
  ensureMeta('viewport', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
  document.title = 'OraaSlayer | المفضلة';
  window.scrollTo({ top: 0, behavior: 'instant' });

  // ─── 2. Firebase Auth ────────────────────────────────────────────
  const fireauth = auth || window.firebaseAuth;
  const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");

  const DEFAULT_AVATAR = 'https://i.ibb.co/YRShYmn/avatar.png';
  const ANILIST_QUERY = `query($ids:[Int]){Page(page:1,perPage:50){media(id_in:$ids){id title{userPreferred} coverImage{extraLarge large medium} averageScore format genres status episodes seasonYear}}}`;

  // ─── 3. HTML & Premium CSS ──────────────────────────────────────
  root.innerHTML = `
<style>
:root {
  --c1:#0F2854;--c2:#1C4D8D;--c3:#4988C4;--c4:#BDE8F5;--gold:#FFCA28;--accent:#4988C4;
  --text-light:#FFFFFF;--text-dim:rgba(255,255,255,0.82);--text-muted:rgba(189,232,245,0.55);
  --bg-card:rgba(15,40,84,0.60);--border-subtle:rgba(189,232,245,0.15);
  --header-height:clamp(56px,6.5vw,72px);--footer-height:clamp(62px,8vw,76px);
  --sidebar-width:clamp(240px,22vw,300px);--page-pad:clamp(0.5rem,1.4vw,1.2rem);
  --card-min:clamp(132px,18vw,180px);--content-max:1500px;
  --safe-top:env(safe-area-inset-top,0px);--safe-bottom:env(safe-area-inset-bottom,0px);
  --app-height:100vh;
  --r-sm:10px;--r-md:14px;--r-lg:18px;--r-xl:24px;
  --sh-sm:0 4px 16px rgba(0,0,0,0.22);--sh-md:0 12px 32px rgba(0,0,0,0.35);
  --sh-lg:0 20px 50px rgba(0,0,0,0.5);
  --spring:cubic-bezier(.34,1.56,.64,1);--smooth:cubic-bezier(.4,0,.2,1);
  --fast:160ms;--base:260ms;--slow:420ms;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html{scroll-behavior:smooth;width:100%;max-width:100%}
body{font-family:'Cairo',sans-serif;color:var(--text-light);direction:rtl;min-height:100vh;overflow-x:hidden;background-color:var(--c1);text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;text-size-adjust:100%;touch-action:pan-y}
img,video,iframe,canvas,svg{max-width:100%;height:auto}
button,a,input,.fav-card,.ds-link,.ms-link,.menu-btn,.nav-item,.close-btn,.tab-btn,.empty-action-btn,.icon-btn{touch-action:manipulation;-webkit-user-select:none;user-select:none}

.animated-bg{position:fixed;inset:0;z-index:-2;background:radial-gradient(1100px circle at 15% 15%,rgba(73,136,196,0.20),transparent 35%),radial-gradient(900px circle at 85% 10%,rgba(255,202,40,0.10),transparent 28%),linear-gradient(160deg,var(--c1) 0%,#0a1a3a 40%,var(--c2) 70%,#0d2248 100%)}
.pixel-container{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;display:none}
@media(min-width:768px){.pixel-container{display:block}.animated-bg{background:radial-gradient(1100px circle at 15% 15%,rgba(73,136,196,0.20),transparent 35%),radial-gradient(900px circle at 85% 10%,rgba(255,202,40,0.10),transparent 28%),linear-gradient(-45deg,var(--c1),var(--c2),var(--c3),var(--c4));background-size:400% 400%;animation:gradientFlow 25s ease infinite}}
@keyframes gradientFlow{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
.pixel{position:absolute;background:rgba(189,232,245,0.1);bottom:-150px;border-radius:4px;animation:floatUp 30s linear infinite;will-change:transform}
.pixel:nth-child(1){left:10%;width:40px;height:40px;animation-delay:0s;opacity:.3}
.pixel:nth-child(2){left:40%;width:25px;height:25px;animation-delay:8s}
.pixel:nth-child(3){left:70%;width:35px;height:35px;animation-delay:15s;opacity:.25}
@keyframes floatUp{0%{transform:translate3d(0,0,0) rotate(0deg);opacity:0}10%{opacity:.3}90%{opacity:.3}100%{transform:translate3d(0,-1100px,0) rotate(360deg);opacity:0}}

@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse-glow{0%,100%{box-shadow:0 0 6px rgba(255,202,40,.4)}50%{box-shadow:0 0 18px rgba(255,202,40,.85)}}

.anim-fade-up{opacity:0;animation:fadeUp .55s var(--out,cubic-bezier(.16,1,.3,1)) forwards}
.anim-d1{animation-delay:.06s}.anim-d2{animation-delay:.14s}.anim-d3{animation-delay:.22s}

/* ─── Main Header ─── */
.main-header{position:fixed;top:0;left:0;right:0;height:calc(var(--header-height) + var(--safe-top));padding-top:var(--safe-top);background:linear-gradient(180deg,rgba(10,28,60,0.88),rgba(10,28,60,0.60)),rgba(10,28,60,0.48);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);display:flex;align-items:center;justify-content:space-between;padding-inline:var(--page-pad);z-index:1000;box-shadow:0 8px 30px rgba(0,0,0,0.25);border-bottom:1px solid rgba(189,232,245,0.16);contain:layout paint style;transition:background .3s ease,box-shadow .3s ease}
.main-header::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent);pointer-events:none}
.main-header--scrolled{background:linear-gradient(180deg,rgba(10,28,60,0.96),rgba(10,28,60,0.78)),rgba(10,28,60,0.72);box-shadow:0 12px 40px rgba(0,0,0,.35)}
.header-flex{display:flex;align-items:center;gap:.7rem;min-width:0}
.icon-btn{width:40px;height:40px;border-radius:12px;background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.04)),rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--c4);transition:transform .18s ease,background .18s ease;flex-shrink:0;box-shadow:0 8px 22px rgba(0,0,0,.15)}
.icon-btn:hover{background:rgba(255,255,255,.12);transform:translateY(-1px)}
.icon-btn:active{transform:scale(.94);background:rgba(255,255,255,.15)}
.icon-btn svg,.icon-btn i{width:20px;height:20px;stroke-width:2}
.logo-link{display:flex;align-items:center;gap:.55rem;text-decoration:none;min-width:0}
.logo-text{font-size:clamp(0.95rem,2vw,1.25rem);font-weight:900;color:var(--c4);text-shadow:0 2px 4px rgba(0,0,0,.3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:clamp(110px,30vw,260px);letter-spacing:.2px}

.user-profile{display:flex;align-items:center;flex-direction:row;gap:.6rem;padding:5px 10px 5px 12px;border-radius:999px;background:linear-gradient(180deg,rgba(0,0,0,.24),rgba(0,0,0,.14)),rgba(0,0,0,.26);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);cursor:pointer;border:1px solid rgba(182,194,209,.28);transition:transform .2s ease,background .25s ease,border-color .25s ease,box-shadow .25s ease;position:relative;max-width:min(42vw,320px);box-shadow:0 10px 26px rgba(0,0,0,.18)}
.user-profile:hover{background:rgba(0,0,0,.42);border-color:var(--gold);box-shadow:0 0 0 1px rgba(255,202,40,.15),0 14px 26px rgba(0,0,0,.22)}
.avatar-wrap{width:34px;height:34px;border-radius:50%;overflow:hidden;border:2px solid var(--gold);box-shadow:0 0 10px rgba(255,202,40,.2);flex-shrink:0;background:rgba(255,255,255,.08)}
.avatar-wrap img{width:100%;height:100%;object-fit:cover;display:block}
.user-name{font-size:.82rem;font-weight:800;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:clamp(70px,12vw,120px)}
.user-role{font-size:.6rem;color:rgba(255,255,255,.72);font-weight:600;white-space:nowrap}

/* ─── Main Content ─── */
.main-content{padding-top:calc(var(--header-height) + var(--safe-top) + 1rem);padding-bottom:calc(var(--footer-height) + var(--safe-bottom));min-height:var(--app-height);transition:padding-top .4s cubic-bezier(.4,0,.2,1)}
@media(min-width:1024px){.main-content{padding-right:var(--sidebar-width);padding-bottom:0}}

.page-header{display:flex;align-items:center;justify-content:space-between;padding:0 var(--page-pad);margin-bottom:1rem;flex-wrap:wrap;gap:10px}
.page-title-section{display:flex;align-items:center;gap:10px}
.page-icon{width:32px;height:32px;color:var(--gold);filter:drop-shadow(0 0 8px rgba(255,202,40,.4))}
.page-title{font-size:1.35rem;font-weight:900;color:white}
.fav-count-badge{font-size:.74rem;font-weight:700;color:var(--text-dim);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);padding:6px 14px;border-radius:999px;display:inline-flex;align-items:center;gap:6px}
.fav-count-badge .count-num{color:var(--gold);font-size:.9rem}

/* ─── Tab Filters ─── */
.tabs-wrap{padding:0 var(--page-pad);margin-bottom:.6rem}
.tabs-track{display:flex;gap:5px;background:rgba(6,16,36,.7);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid var(--border-subtle);border-radius:var(--r-lg);padding:5px;overflow-x:auto;scrollbar-width:none}
.tabs-track::-webkit-scrollbar{display:none}
.tab-btn{flex:1;min-width:max-content;padding:9px 14px;border-radius:var(--r-md);border:none;background:transparent;color:var(--text-muted);font-family:'Cairo',sans-serif;font-weight:700;font-size:.78rem;cursor:pointer;white-space:nowrap;transition:all var(--fast);display:flex;align-items:center;justify-content:center;gap:6px}
.tab-btn:hover:not(.active){background:rgba(255,255,255,.04);color:var(--text-dim)}
.tab-btn.active{background:rgba(255,202,40,.12);color:var(--gold);box-shadow:0 0 0 1px rgba(255,202,40,.2),0 4px 14px rgba(255,202,40,.1)}
.tab-btn i,.tab-btn svg{width:15px;height:15px;opacity:.7;transition:opacity var(--fast)}
.tab-btn.active i,.tab-btn.active svg{opacity:1}
.tab-badge{background:var(--gold);color:var(--c1);font-size:.6rem;font-weight:900;padding:3px 7px;border-radius:999px;line-height:1.2;box-shadow:0 0 8px rgba(255,202,40,.3)}

/* ─── Favorites Grid ─── */
.fav-grid-wrap{padding:0 var(--page-pad);max-width:var(--content-max);margin:0 auto}
.fav-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(var(--card-min),1fr));gap:clamp(10px,1.4vw,16px);align-items:stretch}
@media(min-width:768px){.fav-grid{gap:14px;grid-template-columns:repeat(auto-fit,minmax(165px,1fr))}}
@media(min-width:1280px){.fav-grid{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}}
@media(min-width:1440px){.fav-grid{grid-template-columns:repeat(auto-fit,minmax(185px,1fr))}}
@media(max-width:560px){.fav-grid{grid-template-columns:repeat(auto-fit,minmax(138px,1fr));gap:10px}}
@media(max-width:400px){.fav-grid{grid-template-columns:repeat(auto-fit,minmax(124px,1fr))}}

.fav-card{position:relative;border-radius:18px;overflow:hidden;aspect-ratio:2/3;cursor:pointer;background:linear-gradient(180deg,rgba(18,43,88,.88) 0%,rgba(9,18,40,.95) 100%);border:1px solid rgba(189,232,245,.10);box-shadow:0 10px 28px rgba(0,0,0,.3);opacity:0;transform:translate3d(0,12px,0) scale(.98);transition:transform .3s var(--spring),box-shadow .3s ease,border-color .3s ease,opacity .4s ease;will-change:transform,opacity;isolation:isolate}
.fav-card.visible{opacity:1;transform:translate3d(0,0,0) scale(1)}
.fav-card:hover{transform:translate3d(0,-6px,0) scale(1.03);border-color:var(--c3);box-shadow:0 20px 40px rgba(0,0,0,.45),0 0 0 1px rgba(73,136,196,.2);z-index:2}
.fav-card:active{transform:scale(.97);transition-duration:.1s}
.fav-card .card-media{position:absolute;inset:0;overflow:hidden}
.fav-card .card-image{width:100%;height:100%;object-fit:cover;display:block;opacity:0;background:rgba(0,0,0,.2);transition:opacity .3s ease,transform .5s cubic-bezier(.25,.46,.45,.94)}
.fav-card .card-image.loaded,.fav-card .card-image.failed{opacity:1}
.fav-card:hover .card-image{transform:scale(1.07)}
.fav-card .card-glow{position:absolute;inset:0;background:radial-gradient(240px circle at var(--mx,50%) var(--my,50%),rgba(189,232,245,.22),transparent 45%);opacity:0;transition:opacity .2s ease;pointer-events:none;z-index:3}
.fav-card:hover .card-glow{opacity:1}
.fav-card .card-overlay{position:absolute;inset:auto 0 0 0;padding:12px 10px 10px;background:linear-gradient(to top,rgba(6,16,36,.98) 0%,rgba(6,16,36,.85) 50%,rgba(6,16,36,0) 100%);z-index:4;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.fav-card .card-title{font-size:.8rem;font-weight:800;color:#fff;line-height:1.3;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-shadow:0 2px 6px rgba(0,0,0,.9)}
.fav-card .card-meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;align-items:center}
.fav-card .card-chip{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:.58rem;font-weight:800;background:rgba(255,255,255,.10);color:rgba(255,255,255,.9);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.fav-card .card-chip.score{background:linear-gradient(135deg,rgba(255,202,40,.95),rgba(255,180,20,.9));color:#08111f;border-color:transparent;box-shadow:0 4px 10px rgba(255,202,40,.2)}
.fav-card .remove-btn{position:absolute;top:10px;right:10px;z-index:10;width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,71,87,.25);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#FF6B81;opacity:0;transform:scale(.85);transition:all .22s var(--spring)}
.fav-card:hover .remove-btn{opacity:1;transform:scale(1)}
.remove-btn:hover{background:rgba(255,71,87,.2);border-color:rgba(255,71,87,.5);color:#fff}
.remove-btn:active{transform:scale(.88)}
.remove-btn i,.remove-btn svg{width:16px;height:16px}

/* ─── Empty / Loading / Error States ─── */
.empty-state,.soft-fail{grid-column:1/-1;text-align:center;padding:50px 20px}
.empty-state__icon{font-size:3rem;display:block;margin-bottom:14px;opacity:.7}
.empty-state__title{font-size:1.1rem;font-weight:800;color:var(--c4);margin-bottom:8px}
.empty-state__desc{font-size:.85rem;color:var(--text-muted);margin-bottom:22px;line-height:1.7}
.empty-action-btn{padding:12px 20px;border-radius:12px;background:var(--gold);color:#08111f;border:none;font-family:'Cairo',sans-serif;font-weight:800;font-size:.88rem;cursor:pointer;transition:transform .2s,box-shadow .2s}
.empty-action-btn:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(255,202,40,.3)}
.empty-action-btn:active{transform:scale(.95)}
.soft-fail{border:1px solid rgba(189,232,245,.12);border-radius:18px;background:rgba(10,25,60,.45);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.soft-fail button{margin-top:12px;padding:10px 16px;border:0;border-radius:12px;background:var(--gold);color:#000;font-weight:800;cursor:pointer}

.skel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(var(--card-min),1fr));gap:clamp(10px,1.4vw,16px);padding:0 var(--page-pad);max-width:var(--content-max);margin:0 auto}
.skel-card{aspect-ratio:2/3;border-radius:18px;background:linear-gradient(110deg,rgba(255,255,255,.04) 30%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 70%);background-size:200% 100%;animation:shimmer 1.8s infinite linear;border:1px solid rgba(189,232,245,.08)}
@media(min-width:768px){.skel-grid{gap:14px;grid-template-columns:repeat(auto-fit,minmax(165px,1fr))}}

/* ─── Sidebar & Footer ─── */
.desktop-sidebar{position:fixed;top:0;right:0;width:var(--sidebar-width);height:100vh;background:linear-gradient(180deg,rgba(8,20,45,.82),rgba(8,20,45,.68)),rgba(8,20,45,.72);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);border-left:1px solid rgba(189,232,245,.2);box-shadow:-4px 0 25px rgba(0,0,0,.4);z-index:998;display:none;flex-direction:column;padding-top:calc(var(--header-height) + var(--safe-top) + 10px);overflow-y:auto}
@media(min-width:1024px){.desktop-sidebar{display:flex}}
.ds-header{padding:16px 20px 12px;border-bottom:1px solid rgba(255,255,255,.05)}
.ds-header h3{font-size:.75rem;font-weight:700;color:var(--text-dim);opacity:.5;text-transform:uppercase;letter-spacing:1px}
.ds-nav{padding:8px 10px;flex:1}
.ds-link{display:flex;align-items:center;flex-direction:row;gap:12px;padding:11px 14px;margin-bottom:2px;color:rgba(255,255,255,.55);text-decoration:none;font-size:.88rem;font-weight:600;border-radius:12px;transition:all .2s;text-align:right}
.ds-link:hover{background:rgba(189,232,245,.08);color:white}
.ds-link.active{background:rgba(255,202,40,.10);color:var(--gold);border:1px solid rgba(255,202,40,.15)}
.ds-link svg,.ds-link i{width:20px;height:20px;color:var(--c3);flex-shrink:0;stroke-width:1.8}
.ds-link.active svg,.ds-link.active i{color:var(--gold)}
.ds-footer{padding:16px 20px;border-top:1px solid rgba(255,255,255,.05);font-size:.7rem;color:rgba(255,255,255,.3);text-align:center}

.bottom-nav{position:fixed;bottom:0;left:0;right:0;height:calc(var(--footer-height) + var(--safe-bottom));padding-bottom:var(--safe-bottom);background:rgba(10,28,60,.62);backdrop-filter:blur(25px);-webkit-backdrop-filter:blur(25px);display:flex;align-items:center;justify-content:space-around;z-index:999;border-top:1px solid rgba(189,232,245,.2);box-shadow:0 -8px 25px rgba(0,0,0,.3)}
@media(min-width:1024px){.bottom-nav{display:none}}
.nav-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 0;text-decoration:none;color:rgba(255,255,255,.45);transition:all .3s;position:relative}
.nav-item.active{color:var(--gold)}
.nav-item.active::before{content:'';position:absolute;top:-1px;width:26px;height:3px;background:var(--gold);border-radius:0 0 4px 4px;box-shadow:0 0 12px var(--gold)}
.nav-icon-wrap{width:44px;height:28px;display:flex;align-items:center;justify-content:center}
.nav-item svg,.nav-item i{width:24px;height:24px;transition:all .3s;stroke-width:1.8}
.nav-item.active svg,.nav-item.active i{filter:drop-shadow(0 0 8px var(--gold));transform:scale(1.12)}
.nav-label{font-size:.6rem;font-weight:700}

.sidebar-overlay{position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:1499;opacity:0;visibility:hidden;transition:.3s}
.sidebar-overlay.show{opacity:1;visibility:visible}
.mobile-sidebar{position:fixed;top:0;right:0;width:min(86vw,320px);height:100%;background:linear-gradient(180deg,rgba(8,20,50,.96),rgba(8,20,50,.90)),rgba(8,20,50,.92);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);z-index:1500;transform:translate3d(100%,0,0);transition:transform .35s cubic-bezier(.4,0,.2,1);overflow-y:auto;border-left:1px solid rgba(255,202,40,.35);box-shadow:-5px 0 25px rgba(0,0,0,.5)}
.mobile-sidebar.open{transform:translate3d(0,0,0)}
.ms-header{padding:1.5rem 1rem;background:linear-gradient(180deg,var(--c2),rgba(28,77,141,.8));color:white;display:flex;flex-direction:row;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.1)}
.ms-header h2{font-size:1.1rem;font-weight:800}
.ms-link{display:flex;align-items:center;flex-direction:row;gap:10px;padding:12px 1rem;color:var(--text-dim);text-decoration:none;font-weight:600;font-size:.9rem;transition:all .2s;border-bottom:1px solid rgba(255,255,255,.03);text-align:right}
.ms-link:hover{background:rgba(255,202,40,.08);color:var(--gold);padding-right:1.5rem}
.ms-link svg,.ms-link i{width:20px;height:20px;color:var(--gold);stroke-width:1.8}

@media(max-width:768px){.user-details{display:none}.fav-grid{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}}
@media(max-width:480px){.fav-grid{grid-template-columns:repeat(auto-fit,minmax(138px,1fr));gap:10px}}
@media(max-width:360px){.logo-text{display:none}.fav-grid{grid-template-columns:repeat(auto-fit,minmax(132px,1fr))}}

button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid var(--gold);outline-offset:3px}
</style>

<div class="animated-bg"></div>
<div class="pixel-container"><span class="pixel"></span><span class="pixel"></span><span class="pixel"></span></div>

<header class="main-header" id="mainHeader">
    <div class="header-flex">
        <button class="icon-btn" id="menuBtn" aria-label="القائمة" type="button"><i data-lucide="menu"></i></button>
        <a data-link="/" href="/" class="logo-link"><span class="logo-text">OraaSlayer</span></a>
    </div>
    <div class="header-flex">
        <div class="user-profile" id="userProfile" role="button" aria-label="حساب المستخدم" tabindex="0">
            <div class="avatar-wrap"><img id="headerAvatar" src="${DEFAULT_AVATAR}" alt="الصورة الشخصية" width="34" height="34" loading="eager" decoding="async"></div>
            <div class="user-details"><div class="user-line"><span class="user-name" id="userName">زائر</span></div><span class="user-role" id="roleLabel">اضغط للدخول</span></div>
        </div>
    </div>
</header>

<div class="sidebar-overlay" id="overlay"></div>
<aside class="mobile-sidebar" id="mobileSidebar">
    <div class="ms-header"><h2>القائمة</h2><button class="icon-btn" id="closeSidebar" aria-label="إغلاق" type="button" style="color:white;border:none;background:transparent;font-size:1.4rem;cursor:pointer"><i data-lucide="x"></i></button></div>
    <nav style="padding:.5rem 0">
        <a data-link="/" href="/" class="ms-link"><i data-lucide="home"></i> الرئيسية</a>
        <a data-link="/newsanime" href="/newsanime" class="ms-link"><i data-lucide="newspaper"></i> أخبار الأنمي</a>
        <a data-link="/new" href="/new" class="ms-link"><i data-lucide="palette"></i> المبدعين</a>
        <a data-link="/event_gacha/spin" href="/event_gacha/spin" class="ms-link"><i data-lucide="gift"></i> هدايا و أحداث</a>
        <a data-link="/favorites" href="/favorites" class="ms-link" style="color:var(--gold);font-weight:800"><i data-lucide="heart"></i> المفضلة</a>
        <a data-link="/chat" href="/chat" class="ms-link"><i data-lucide="message-circle"></i> الدردشة</a>
        <a data-link="/policy" href="/policy" class="ms-link"><i data-lucide="shield"></i> سياسة الخصوصية</a>
    </nav>
</aside>

<nav class="desktop-sidebar">
    <div class="ds-header"><h3>القائمة</h3></div>
    <div class="ds-nav">
        <a data-link="/" href="/" class="ds-link"><i data-lucide="home"></i> الرئيسية</a>
        <a data-link="/newsanime" href="/newsanime" class="ds-link"><i data-lucide="newspaper"></i> أخبار الأنمي</a>
        <a data-link="/new" href="/new" class="ds-link"><i data-lucide="palette"></i> المبدعين</a>
        <a data-link="/event_gacha/spin" href="/event_gacha/spin" class="ds-link"><i data-lucide="gift"></i> هدايا و أحداث</a>
        <a data-link="/favorites" href="/favorites" class="ds-link active"><i data-lucide="heart"></i> المفضلة</a>
        <a data-link="/chat" href="/chat" class="ds-link"><i data-lucide="message-circle"></i> الدردشة</a>
        <a data-link="/policy" href="/policy" class="ds-link"><i data-lucide="shield"></i> سياسة الخصوصية</a>
    </div>
    <div class="ds-footer">OraaSlayer &copy; 2026</div>
</nav>

<div class="main-content" id="mainContent">
    <div class="page-header anim-fade-up">
        <div class="page-title-section">
            <i data-lucide="heart" class="page-icon"></i>
            <h1 class="page-title">مفضلتي</h1>
            <span class="fav-count-badge" id="favCountBadge"><span class="count-num" id="favCountNum">0</span> أنمي</span>
        </div>
    </div>

    <div class="tabs-wrap anim-fade-up anim-d1">
        <div class="tabs-track" role="tablist" id="filterTabs">
            <button class="tab-btn active" data-filter="all" role="tab"><i data-lucide="layout-grid"></i> الكل</button>
            <button class="tab-btn" data-filter="watching" role="tab"><i data-lucide="eye"></i> قيد المشاهدة</button>
            <button class="tab-btn" data-filter="completed" role="tab"><i data-lucide="check-circle"></i> مكتمل</button>
            <button class="tab-btn" data-filter="planning" role="tab"><i data-lucide="bookmark"></i> أريد مشاهدته</button>
        </div>
    </div>

    <div class="fav-grid-wrap anim-fade-up anim-d2">
        <div class="fav-grid" id="favGrid"></div>
        <div class="skel-grid" id="skelGrid">
            <div class="skel-card"></div><div class="skel-card"></div><div class="skel-card"></div>
            <div class="skel-card"></div><div class="skel-card"></div><div class="skel-card"></div>
        </div>
    </div>
</div>

<footer class="bottom-nav">
    <a data-link="/" href="/" class="nav-item"><div class="nav-icon-wrap"><i data-lucide="home"></i></div><span class="nav-label">الرئيسية</span></a>
    <a data-link="/newsanime" href="/newsanime" class="nav-item"><div class="nav-icon-wrap"><i data-lucide="newspaper"></i></div><span class="nav-label">أخبار</span></a>
    <a data-link="/event_gacha/spin" href="/event_gacha/spin" class="nav-item"><div class="nav-icon-wrap"><i data-lucide="gift"></i></div><span class="nav-label">هدايا</span></a>
    <a data-link="/chat" href="/chat" class="nav-item"><div class="nav-icon-wrap"><i data-lucide="message-circle"></i></div><span class="nav-label">دردشة</span></a>
    <a data-link="/profile" href="/profile" class="nav-item"><div class="nav-icon-wrap"><i data-lucide="user"></i></div><span class="nav-label">حسابي</span></a>
</footer>`;

  // ─── 4. Load Lucide Icons ────────────────────────────────────────
  if (!window.lucide) {
    await new Promise((res) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js';
      s.onload = res; s.onerror = res;
      document.head.appendChild(s);
    });
  }
  window.lucide?.createIcons();

  // ─── 5. DOM References ───────────────────────────────────────────
  const $ = (sel) => root.querySelector(sel);
  const mainHeader    = $('#mainHeader');
  const menuBtn       = $('#menuBtn');
  const mobileSidebar = $('#mobileSidebar');
  const overlay       = $('#overlay');
  const closeSidebar  = $('#closeSidebar');
  const favGrid       = $('#favGrid');
  const skelGrid      = $('#skelGrid');
  const favCountNum   = $('#favCountNum');
  const userProfile   = $('#userProfile');
  const userName      = $('#userName');
  const roleLabel     = $('#roleLabel');
  const headerAvatar  = $('#headerAvatar');
  const filterTabs    = $('#filterTabs');

  // ─── 6. SPA Navigation ──────────────────────────────────────────
  root.addEventListener('click', (e) => {
    const link = e.target.closest('[data-link]');
    if (link) { e.preventDefault(); const path = link.getAttribute('data-link'); if (path && typeof go === 'function') go(path); }
  }, { signal: ac.signal });

  // ─── 7. Sidebar Logic ───────────────────────────────────────────
  menuBtn?.addEventListener('pointerdown', (e) => { e.preventDefault(); mobileSidebar?.classList.add('open'); overlay?.classList.add('show'); if (window.lucide) window.lucide.createIcons(); }, { signal: ac.signal });
  closeSidebar?.addEventListener('pointerdown', () => { mobileSidebar?.classList.remove('open'); overlay?.classList.remove('show'); }, { signal: ac.signal });
  overlay?.addEventListener('pointerdown', () => { mobileSidebar?.classList.remove('open'); overlay?.classList.remove('show'); }, { signal: ac.signal });

  // ─── 8. Header Scroll Effect ────────────────────────────────────
  let scrollTick = false;
  const hScroll = () => { if (scrollTick) return; scrollTick = true; requestAnimationFrame(() => { mainHeader?.classList.toggle('main-header--scrolled', window.scrollY > 40); scrollTick = false; }); };
  window.addEventListener('scroll', hScroll, { passive: true, signal: ac.signal });

  // ─── 9. Helpers ─────────────────────────────────────────────────
  const IMG_FALLBACK = 'https://via.placeholder.com/300x450/0F2854/BDE8F5?text=No+Image';
  const escapeHTML = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const safeImg = (s) => s || IMG_FALLBACK;

  // ─── 10. State ──────────────────────────────────────────────────
  let state = { uid: null, favorites: [], filter: 'all', animeData: [] };

  // ─── 11. Local Storage Helpers ──────────────────────────────────
  const getFavs = (uid) => {
    try {
      const raw = localStorage.getItem(`fav_${uid}`);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };

  const setFavs = (uid, favs) => {
    try { localStorage.setItem(`fav_${uid}`, JSON.stringify(favs)); } catch {}
  };

  // ─── 12. Remove Favorite ────────────────────────────────────────
  const removeFav = (animeId) => {
    state.favorites = state.favorites.filter(f => String(f.id) !== String(animeId));
    state.animeData = state.animeData.filter(a => String(a.id) !== String(animeId));
    if (state.uid) setFavs(state.uid, state.favorites);
    renderGrid();
  };

  // ─── 13. Render Grid ────────────────────────────────────────────
  const renderGrid = () => {
    if (skelGrid) skelGrid.style.display = 'none';
    if (!favGrid) return;

    let items = [...state.animeData];

    // Apply filter
    if (state.filter !== 'all') {
      items = items.filter(a => (a.userStatus || 'watching') === state.filter);
    }

    // Update count
    if (favCountNum) favCountNum.textContent = items.length;

    if (items.length === 0) {
      const emptyHTML = state.favorites.length === 0 ? `
        <div class="empty-state">
          <span class="empty-state__icon">💔</span>
          <div class="empty-state__title">المفضلة فارغة</div>
          <p class="empty-state__desc">لم تقم بإضافة أي أنمي إلى المفضلة بعد.<br>ابدأ التصفح وأضف ما يعجبك!</p>
          <button class="empty-action-btn" data-link="/home" type="button"><i data-lucide="compass" style="width:18px;height:18px;vertical-align:middle;margin-left:6px"></i> تصفح الأنميات</button>
        </div>` : `
        <div class="empty-state">
          <span class="empty-state__icon">🔍</span>
          <div class="empty-state__title">لا توجد نتائج</div>
          <p class="empty-state__desc">لا يوجد أنمي مطابق للفلتر الحالي</p>
        </div>`;
      favGrid.innerHTML = emptyHTML;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const frag = document.createDocumentFragment();
    items.forEach((anime, i) => {
      const card = document.createElement('div');
      card.className = 'fav-card visible';
      card.style.animationDelay = (i * 0.04) + 's';
      card.setAttribute('data-id', anime.id);

      const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
      const formatMap = { TV:'مسلسل', MOVIE:'فيلم', OVA:'أوفا', ONA:'أونا', SPECIAL:'خاص' };

      card.innerHTML = `
        <div class="card-media">
          <img class="card-image loaded" src="${safeImg(anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium)}" alt="${escapeHTML(anime.title?.userPreferred||'')}" loading="lazy" onerror="this.src='${IMG_FALLBACK}';this.classList.add('failed')">
        </div>
        <div class="card-glow"></div>
        <button class="remove-btn" data-remove="${anime.id}" aria-label="إزالة من المفضلة" type="button"><i data-lucide="trash-2"></i></button>
        <div class="card-overlay">
          <h3 class="card-title">${escapeHTML(anime.title?.userPreferred || 'Unknown')}</h3>
          <div class="card-meta">
            ${score ? `<span class="card-chip score"><i data-lucide="star" style="width:10px;height:10px;display:inline;vertical-align:middle;margin-left:2px"></i> ${score}</span>` : ''}
            <span class="card-chip">${escapeHTML(formatMap[anime.format] || anime.format || 'TV')}</span>
            ${anime.seasonYear ? `<span class="card-chip">${anime.seasonYear}</span>` : ''}
          </div>
        </div>`;

      // Hover glow effect
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mx', `${x}%`);
        card.style.setProperty('--my', `${y}%`);
      });

      // Click to navigate
      card.addEventListener('click', (e) => {
        if (e.target.closest('.remove-btn')) return;
        if (typeof go === 'function') go('/anime?id=' + btoa(String(anime.id)));
      });

      // Remove button
      card.querySelector('.remove-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const id = e.currentTarget.getAttribute('data-remove');
        if (id) {
          card.style.opacity = '0';
          card.style.transform = 'scale(0.85)';
          card.style.transition = 'all 0.25s ease';
          setTimeout(() => removeFav(id), 250);
        }
      });

      frag.appendChild(card);
    });

    favGrid.innerHTML = '';
    favGrid.appendChild(frag);
    if (window.lucide) window.lucide.createIcons();
  };

  // ─── 14. Fetch Anime Data from AniList ──────────────────────────
  const fetchAnimeData = async (ids) => {
    if (!ids.length) return [];
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: ANILIST_QUERY, variables: { ids: ids.map(id => parseInt(id)) } })
      });
      const json = await res.json();
      return (json?.data?.Page?.media || []).map(m => ({
        ...m,
        userStatus: (state.favorites.find(f => String(f.id) === String(m.id)) || {}).status || 'watching'
      }));
    } catch (err) {
      console.warn('[Favorites] AniList fetch failed:', err);
      return ids.map(id => {
        const existing = state.animeData.find(a => String(a.id) === String(id));
        return existing || { id, title: { userPreferred: 'أنمي ' + id }, format: 'TV', userStatus: 'watching' };
      });
    }
  };

  // ─── 15. Filter Tabs ────────────────────────────────────────────
  filterTabs?.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const filter = btn.getAttribute('data-filter');
    if (filter && filter !== state.filter) {
      state.filter = filter;
      filterTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGrid();
    }
  });

  // ─── 16. Auth State ─────────────────────────────────────────────
  const handleAuth = async (user) => {
    if (user) {
      state.uid = user.uid;
      if (userName) userName.textContent = user.displayName || 'مستخدم';
      if (roleLabel) roleLabel.textContent = 'عضو';
      if (headerAvatar && user.photoURL) headerAvatar.src = user.photoURL;

      // Load favorites
      state.favorites = getFavs(user.uid);

      if (skelGrid) skelGrid.style.display = 'grid';

      // Fetch data from AniList
      const ids = state.favorites.map(f => f.id);
      state.animeData = ids.length ? await fetchAnimeData(ids) : [];
      renderGrid();
    } else {
      state.uid = null;
      state.favorites = [];
      state.animeData = [];
      if (userName) userName.textContent = 'زائر';
      if (roleLabel) roleLabel.textContent = 'اضغط للدخول';
      if (headerAvatar) headerAvatar.src = DEFAULT_AVATAR;
      renderGrid();
    }
  };

  // ─── 17. Init ───────────────────────────────────────────────────
  if (fireauth) {
    const authUnsub = onAuthStateChanged(fireauth, handleAuth);
    cleanup.push(authUnsub);
  } else {
    // Fallback: show empty state
    if (skelGrid) skelGrid.style.display = 'none';
    renderGrid();
  }

  // ─── 18. App Height ─────────────────────────────────────────────
  const hResize = () => document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  hResize();
  window.addEventListener('resize', hResize, { passive: true, signal: ac.signal });
  window.addEventListener('orientationchange', hResize, { passive: true, signal: ac.signal });

  // ─── 19. Cleanup ────────────────────────────────────────────────
  if (typeof ctx.onCleanup === 'function') {
    ctx.onCleanup(() => {
      ac.abort();
      for (const fn of cleanup) { try { fn(); } catch {} }
    });
  } else {
    window.addEventListener('beforeunload', () => {
      ac.abort();
      for (const fn of cleanup) { try { fn(); } catch {} }
    }, { once: true });
  }
}