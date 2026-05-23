// ═══════════════════════════════════════════════════════════════════════════════
// OraaSlayer Profile Page v4.0 - Golden Mind Production
// Unified Design | Lucide Icons | High Performance | Mobile + Desktop
// ═══════════════════════════════════════════════════════════════════════════════

export default async function profilePage(ctx) {
  const { root, go, onCleanup } = ctx;
  const cleanup = [];
  const doc = document;
  const win = window;

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. META & SEO
  // ═══════════════════════════════════════════════════════════════════════════
  const setMeta = (name, content) => {
    let el = doc.head.querySelector(`meta[name="${name}"]`);
    if (!el) { el = doc.createElement('meta'); el.name = name; doc.head.appendChild(el); }
    el.content = content;
  };
  setMeta('viewport', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
  setMeta('theme-color', '#1C4D8D');
  doc.title = 'OraaSlayer | الملف الشخصي';
  win.scrollTo({ top: 0, behavior: 'instant' });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. FONT LOADING (Performance Optimized)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!doc.getElementById('font-cairo')) {
    const link = doc.createElement('link');
    link.id = 'font-cairo';
    link.rel = 'preload';
    link.as = 'style';
    link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Changa:wght@600;700;800;900&display=swap';
    link.onload = function() { this.rel = 'stylesheet'; };
    doc.head.appendChild(link);

    const fallback = doc.createElement('link');
    fallback.rel = 'stylesheet';
    fallback.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Changa:wght@600;700;800;900&display=swap';
    fallback.media = 'print';
    fallback.onload = function() { this.media = 'all'; };
    doc.head.appendChild(fallback);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. LUCIDE ICONS (Unified with home.js)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!win.lucide) {
    await new Promise((res) => {
      const s = doc.createElement('script');
      s.src = 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js';
      s.async = true;
      s.onload = res;
      s.onerror = () => {
        console.warn('[Profile] Lucide unpkg failed, fallback to jsdelivr');
        const s2 = doc.createElement('script');
        s2.src = 'https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js';
        s2.async = true;
        s2.onload = res;
        s2.onerror = res;
        doc.head.appendChild(s2);
      };
      doc.head.appendChild(s);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. AUTH INTEGRATION (Fixed & Reliable)
  // ═══════════════════════════════════════════════════════════════════════════
  let authMod = null;
  let authState = null;
  let currentUser = null;

  try {
    authMod = await import('/api/auth.js');
    if (authMod?.waitForAuth) {
      authState = await authMod.waitForAuth(4000);
    }
  } catch (e) {
    console.warn('[Profile] Auth module failed:', e.message);
  }

  // Try multiple sources for auth state
  if (!authState) {
    authState = win.__AUTH__ || authMod?.getAuthState?.() || null;
  }

  if (!authState || !authState.isLoggedIn) {
    root.innerHTML = buildAuthGate('🔒 يتطلب تسجيل الدخول', 'يرجى تسجيل الدخول للوصول للملف الشخصي', '/login', 'تسجيل الدخول');
    return;
  }

  currentUser = authMod?.getCurrentUser?.() || authState.user || {};
  const userRef = authState.user || currentUser;
  const displayName = authState.displayName || currentUser.displayName || userRef.displayName || 'مستخدم';
  const avatar = authState.avatar || currentUser.photoURL || userRef.photoURL || 'https://i.ibb.co/YRShYmn/avatar.png';
  const email = userRef.email || currentUser.email || authState.email || '';
  const role = (authState.role || userRef.role || 'member').toLowerCase();
  const uid = userRef.uid || currentUser.uid || null;

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. UNIFIED STYLES (Matches home.js exactly)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!doc.getElementById('profile-styles')) {
    const style = doc.createElement('style');
    style.id = 'profile-styles';
    style.textContent = `
:root {
  --c1: #0F2854; --c2: #1C4D8D; --c3: #4988C4; --c4: #BDE8F5; --gold: #FFCA28;
  --text-light: #FFFFFF; --text-dim: rgba(255, 255, 255, 0.82);
  --bg-card: rgba(15, 40, 84, 0.60); --border-subtle: rgba(189, 232, 245, 0.15);
  --role-vip: #FFCA28; --role-admin: #FF5C7A; --role-manager: #5CD6FF;
  --role-staff: #B78BFF; --role-member: #7BA6FF; --role-guest: #B6C2D1;
  --role-accent: var(--role-guest); --role-accent-soft: rgba(182, 194, 209, 0.28);
  --header-height: clamp(56px, 6.5vw, 72px);
  --footer-height: clamp(62px, 8vw, 76px);
  --sidebar-width: clamp(240px, 22vw, 300px);
  --content-max: 1500px;
  --page-pad: clamp(0.5rem, 1.4vw, 1.2rem);
  --card-min: clamp(132px, 18vw, 180px);
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --app-height: 100vh;
}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html{scroll-behavior:smooth;width:100%;max-width:100%}
body{font-family:'Cairo','Changa',sans-serif;color:var(--text-light);direction:rtl;min-height:100vh;overflow-x:hidden;background-color:var(--c1);text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;text-size-adjust:100%;touch-action:pan-y;overscroll-behavior-y:auto}
img,video,svg{max-width:100%;height:auto;display:block}
button,a,input{touch-action:manipulation;-webkit-user-select:none;user-select:none}

/* ─── Animated Background (Same as home.js) ────────────────────────────── */
.animated-bg{position:fixed;inset:0;z-index:-2;background:radial-gradient(1100px circle at 15% 15%,rgba(73,136,196,.2),transparent 35%),radial-gradient(900px circle at 85% 10%,rgba(255,202,40,.1),transparent 28%),linear-gradient(160deg,var(--c1) 0%,#0a1a3a 40%,var(--c2) 70%,#0d2248 100%)}
.pixel-container{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;display:none}
@media(min-width:768px){
  .pixel-container{display:block}
  .animated-bg{background:radial-gradient(1100px circle at 15% 15%,rgba(73,136,196,.2),transparent 35%),radial-gradient(900px circle at 85% 10%,rgba(255,202,40,.1),transparent 28%),linear-gradient(-45deg,var(--c1),var(--c2),var(--c3),var(--c4));background-size:400% 400%;animation:gradientFlow 25s ease infinite}
}
@keyframes gradientFlow{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
.pixel{position:absolute;background:rgba(189,232,245,.1);bottom:-150px;border-radius:4px;animation:floatUp 30s linear infinite;will-change:transform}
.pixel:nth-child(1){left:10%;width:40px;height:40px;animation-delay:0s;opacity:.3}
.pixel:nth-child(2){left:40%;width:25px;height:25px;animation-delay:8s}
.pixel:nth-child(3){left:70%;width:35px;height:35px;animation-delay:15s;opacity:.25}
@keyframes floatUp{0%{transform:translate3d(0,0,0) rotate(0deg);opacity:0}10%{opacity:.3}90%{opacity:.3}100%{transform:translate3d(0,-1100px,0) rotate(360deg);opacity:0}}

/* ─── Main Header (EXACT match to home.js) ────────────────────────────── */
.main-header{
  position:fixed;top:0;left:0;right:0;height:calc(var(--header-height) + var(--safe-top));
  padding-top:var(--safe-top);
  background:linear-gradient(180deg,rgba(10,28,60,.92),rgba(10,28,60,.65)),rgba(10,28,60,.55);
  backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);
  display:flex;align-items:center;justify-content:space-between;
  gap:.75rem;padding-inline:var(--page-pad);z-index:1000;
  box-shadow:0 8px 30px rgba(0,0,0,.35);
  border-bottom:1px solid rgba(189,232,245,.18);
  contain:layout paint style;transition:background .35s ease,box-shadow .35s ease;
}
.main-header::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(255,202,40,.25),transparent);pointer-events:none}
.main-header--scrolled{background:linear-gradient(180deg,rgba(10,28,60,.98),rgba(10,28,60,.85)),rgba(10,28,60,.82);box-shadow:0 12px 44px rgba(0,0,0,.45)}
.header-flex{display:flex;align-items:center;gap:.7rem;min-width:0}
.logo-link{display:flex;align-items:center;gap:.55rem;text-decoration:none;min-width:0}
.logo-text{font-size:clamp(.95rem,2vw,1.25rem);font-weight:900;color:var(--c4);text-shadow:0 2px 4px rgba(0,0,0,.3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:clamp(110px,30vw,260px);letter-spacing:.2px}
.menu-btn{
  width:40px;height:40px;border-radius:13px;
  background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.05)),rgba(255,255,255,.07);
  border:1px solid rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;
  cursor:pointer;color:var(--c4);transition:transform .2s ease,background .2s ease;
  flex-shrink:0;box-shadow:0 8px 22px rgba(0,0,0,.15);
}
.menu-btn:active{transform:scale(.94);background:rgba(255,255,255,.15)}
.menu-btn svg{width:20px;height:20px;stroke-width:2}

/* ─── User Profile Button (Header) ────────────────────────────────────── */
.user-profile{
  display:flex;align-items:center;flex-direction:row;gap:.6rem;
  padding:5px 10px 5px 12px;border-radius:999px;
  background:linear-gradient(180deg,rgba(0,0,0,.28),rgba(0,0,0,.16)),rgba(0,0,0,.3);
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  cursor:pointer;border:1.5px solid var(--role-accent-soft);
  transition:transform .25s ease,background .28s ease,border-color .28s ease,box-shadow .28s ease;
  position:relative;max-width:min(42vw,320px);box-shadow:0 10px 28px rgba(0,0,0,.2);
}
.avatar-wrap{
  width:36px;height:36px;border-radius:50%;overflow:hidden;
  border:2px solid var(--role-accent);
  box-shadow:0 0 14px var(--role-accent-soft),0 0 0 3px rgba(0,0,0,.3);
  flex-shrink:0;background:rgba(255,255,255,.08);transition:box-shadow .3s ease;
}
.avatar-wrap img{width:100%;height:100%;object-fit:cover;display:block}

/* ─── Page Layout ─────────────────────────────────────────────────────── */
.profile-page{
  padding-top:calc(var(--header-height) + var(--safe-top) + 20px);
  padding-bottom:calc(var(--footer-height) + var(--safe-bottom) + 20px);
  min-height:var(--app-height);position:relative;z-index:1;
}
@media(min-width:1024px){
  .profile-page{padding-right:var(--sidebar-width);padding-bottom:20px;max-width:var(--content-max);margin:0 auto}
}
.profile-container{max-width:600px;margin:0 auto;padding:0 var(--page-pad);position:relative;z-index:1}

/* ─── Profile Card ────────────────────────────────────────────────────── */
.profile-card{
  background:rgba(15,40,84,.7);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);
  border-radius:24px;border:1.5px solid var(--border-subtle);
  padding:30px 22px;text-align:center;
  box-shadow:0 20px 50px rgba(0,0,0,.35),0 0 0 1px rgba(255,255,255,.04);
  animation:fadeUp .5s cubic-bezier(.34,1.56,.64,1) forwards;
  opacity:0;transform:translate3d(0,20px,0);
}
@keyframes fadeUp{to{opacity:1;transform:translate3d(0,0,0)}}

.profile-avatar-wrapper{position:relative;width:130px;height:130px;margin:-85px auto 18px}
.profile-avatar{
  width:100%;height:100%;border-radius:50%;object-fit:cover;
  border:4px solid var(--c2);box-shadow:0 10px 30px rgba(0,0,0,.4);background:#000;
}
.avatar-ring{
  position:absolute;inset:-8px;border-radius:50%;
  border:3px solid var(--gold);animation:pulseRing 2s ease-in-out infinite;
}
@keyframes pulseRing{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.06);opacity:.6}}

.profile-name{
  font-size:clamp(1.3rem,2.5vw,1.8rem);font-weight:900;font-family:'Changa',sans-serif;
  background:linear-gradient(135deg,#fff,var(--c4),var(--gold));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  margin-bottom:8px;
}

/* ─── Role Badges ──────────────────────────────────────────────────────── */
.role-badge{
  display:inline-flex;align-items:center;justify-content:center;
  padding:5px 16px;border-radius:999px;font-size:.68rem;font-weight:900;
  letter-spacing:.5px;text-transform:uppercase;border:1px solid transparent;
  white-space:nowrap;line-height:1;margin-bottom:16px;
  box-shadow:0 6px 16px rgba(0,0,0,.14);
}
.role-badge.role-vip{background:rgba(255,202,40,.18);color:var(--role-vip);border-color:rgba(255,202,40,.4);box-shadow:0 0 12px rgba(255,202,40,.12)}
.role-badge.role-admin{background:rgba(255,92,122,.18);color:var(--role-admin);border-color:rgba(255,92,122,.4);box-shadow:0 0 12px rgba(255,92,122,.12)}
.role-badge.role-manager{background:rgba(92,214,255,.18);color:var(--role-manager);border-color:rgba(92,214,255,.4);box-shadow:0 0 12px rgba(92,214,255,.12)}
.role-badge.role-staff{background:rgba(183,139,255,.18);color:var(--role-staff);border-color:rgba(183,139,255,.4);box-shadow:0 0 12px rgba(183,139,255,.12)}
.role-badge.role-member{background:rgba(123,166,255,.18);color:var(--role-member);border-color:rgba(123,166,255,.4);box-shadow:0 0 12px rgba(123,166,255,.12)}

.profile-email{color:var(--text-dim);font-size:.85rem;margin-bottom:20px;word-break:break-all}

/* ─── Stats Grid ─────────────────────────────────────────────────────── */
.stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:25px}
.stat-card{
  background:rgba(0,0,0,.2);border-radius:16px;padding:18px 12px;
  border:1px solid rgba(255,255,255,.06);transition:all .2s;
}
.stat-card:hover{border-color:rgba(255,202,40,.3);transform:translateY(-3px);box-shadow:0 10px 20px rgba(0,0,0,.2)}
.stat-value{font-size:clamp(1.4rem,3vw,2rem);font-weight:900;color:var(--gold);display:block;margin-bottom:4px;font-family:'Changa',sans-serif}
.stat-label{font-size:.72rem;color:var(--text-dim);font-weight:600}

/* ─── Info Section ────────────────────────────────────────────────────── */
.info-section{
  background:rgba(0,0,0,.15);border-radius:16px;padding:16px;
  margin-bottom:22px;border:1px solid rgba(255,255,255,.05);
}
.info-item{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.info-item:last-child{border-bottom:none}
.info-label{color:var(--text-dim);font-size:.85rem;display:flex;align-items:center;gap:8px}
.info-label svg{width:16px;height:16px;color:var(--c3);stroke-width:2}
.info-value{color:#fff;font-weight:700;font-size:.9rem;text-align:left}

/* ─── Action Buttons ──────────────────────────────────────────────────── */
.action-buttons{display:flex;flex-direction:column;gap:10px}
.btn-action{
  width:100%;padding:15px 22px;border-radius:15px;font-size:.92rem;font-weight:700;
  cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;
  transition:all .22s ease;border:none;font-family:'Cairo',sans-serif;
}
.btn-action:active{transform:scale(.97)}
.btn-action svg{width:18px;height:18px;stroke-width:2}
.btn-primary{background:linear-gradient(180deg,rgba(28,77,141,.95),rgba(28,77,141,.85)),var(--c2);color:#fff;border:1px solid rgba(73,136,196,.3);box-shadow:0 8px 24px rgba(28,77,141,.3)}
.btn-primary:hover{box-shadow:0 12px 30px rgba(28,77,141,.45);transform:translateY(-2px)}
.btn-warning{background:linear-gradient(180deg,rgba(255,202,40,.95),rgba(255,180,20,.95));color:#08111f;border:1px solid rgba(255,202,40,.3);box-shadow:0 8px 24px rgba(255,202,40,.25)}
.btn-warning:hover{box-shadow:0 12px 30px rgba(255,202,40,.35);transform:translateY(-2px)}
.btn-danger{background:rgba(255,92,122,.12);border:2px solid rgba(255,92,122,.22);color:#ff8aa0}
.btn-danger:hover{background:rgba(255,92,122,.2);border-color:rgba(255,92,122,.35)}
.btn-secondary{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff}
.btn-secondary:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.18)}

/* ─── Bottom Navigation (Same as home.js) ─────────────────────────────── */
.bottom-nav{
  position:fixed;bottom:0;left:0;right:0;height:calc(var(--footer-height) + var(--safe-bottom));
  padding-bottom:var(--safe-bottom);
  background:rgba(10,28,60,.65);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);
  display:flex;align-items:center;justify-content:space-around;
  z-index:999;border-top:1px solid rgba(189,232,245,.22);box-shadow:0 -10px 30px rgba(0,0,0,.35);
}
@media(min-width:1024px){.bottom-nav{display:none}}
.nav-item{
  flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;
  padding:6px 0;text-decoration:none;color:rgba(255,255,255,.45);transition:all .3s;position:relative;
}
.nav-item.active{color:var(--gold)}
.nav-item.active::before{
  content:'';position:absolute;top:-1px;width:28px;height:3px;
  background:var(--gold);border-radius:0 0 5px 5px;box-shadow:0 0 14px var(--gold);
}
.nav-item svg{width:22px;height:22px;stroke-width:1.8;transition:all .3s}
.nav-item.active svg{filter:drop-shadow(0 0 10px var(--gold));transform:scale(1.12)}
.nav-label{font-size:.62rem;font-weight:700}

/* ─── Desktop Sidebar (Same as home.js) ───────────────────────────────── */
.desktop-sidebar{
  position:fixed;top:0;right:0;width:var(--sidebar-width);height:100vh;
  background:linear-gradient(180deg,rgba(8,20,45,.85),rgba(8,20,45,.72)),rgba(8,20,45,.75);
  backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);
  border-left:1px solid rgba(189,232,245,.22);box-shadow:-6px 0 30px rgba(0,0,0,.45);
  z-index:998;display:none;flex-direction:column;
  padding-top:calc(var(--header-height) + var(--safe-top) + 10px);overflow-y:auto;
}
@media(min-width:1024px){.desktop-sidebar{display:flex}}
.ds-header{padding:18px 20px 14px;border-bottom:1px solid rgba(255,255,255,.06)}
.ds-header h3{font-size:.75rem;font-weight:700;color:var(--text-dim);opacity:.5;text-transform:uppercase;letter-spacing:1px}
.ds-nav{padding:8px 10px;flex:1}
.ds-link{display:flex;align-items:center;flex-direction:row;gap:12px;padding:12px 15px;margin-bottom:2px;color:rgba(255,255,255,.55);text-decoration:none;font-size:.88rem;font-weight:600;border-radius:13px;transition:all .2s;text-align:right}
.ds-link:hover{background:rgba(189,232,245,.08);color:white}
.ds-link.active{background:rgba(255,202,40,.12);color:var(--gold);border:1px solid rgba(255,202,40,.18);box-shadow:0 0 14px rgba(255,202,40,.06)}
.ds-link svg{width:20px;height:20px;color:var(--c3);flex-shrink:0;stroke-width:1.8}
.ds-link.active svg{color:var(--gold);filter:drop-shadow(0 0 4px rgba(255,202,40,.4))}
.ds-footer{padding:16px 20px;border-top:1px solid rgba(255,255,255,.05);font-size:.7rem;color:rgba(255,255,255,.3);text-align:center}

/* ─── Toast Alert ─────────────────────────────────────────────────────── */
.alert-toast{
  position:fixed;top:calc(var(--header-height) + var(--safe-top) + 20px);
  left:50%;transform:translate3d(-50%,0,0);z-index:2000;
  padding:12px 22px;border-radius:14px;font-weight:700;font-size:.9rem;
  display:none;align-items:center;gap:8px;
  animation:toastIn .3s ease-out;box-shadow:0 10px 30px rgba(0,0,0,.4);
}
.alert-toast.show{display:flex}
.alert-toast.success{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;border:1px solid rgba(255,255,255,.15)}
.alert-toast.error{background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;border:1px solid rgba(255,255,255,.15)}
.alert-toast svg{width:18px;height:18px;flex-shrink:0}
@keyframes toastIn{from{opacity:0;transform:translate3d(-50%,-12px,0)}to{opacity:1;transform:translate3d(-50%,0,0)}}

/* ─── Responsive ──────────────────────────────────────────────────────── */
@media(max-width:768px){
  .profile-card{padding:28px 16px}
  .profile-avatar-wrapper{width:110px;height:110px;margin-top:-65px}
}
@media(max-width:560px){
  .logo-text{max-width:24vw}
  .profile-avatar-wrapper{width:100px;height:100px;margin-top:-55px}
  .profile-name{font-size:1.2rem}
  .stat-value{font-size:1.3rem}
}
@media(max-width:480px){
  .logo-text{font-size:.92rem;max-width:28vw}
  .profile-card{padding:24px 12px;border-radius:20px}
  .profile-avatar-wrapper{width:90px;height:90px;margin-top:-50px}
  .stats-grid{gap:8px}
  .stat-card{padding:14px 10px}
  .btn-action{padding:13px 16px;font-size:.85rem}
}
@media(max-width:360px){
  .logo-text{display:none}
  .profile-avatar-wrapper{width:80px;height:80px;margin-top:-45px}
}
@media(min-width:1024px){
  .profile-page{padding-right:var(--sidebar-width);padding-bottom:20px}
}
@media(prefers-reduced-motion:reduce){
  .profile-page *,.profile-page,.pixel{animation:none!important;transition:none!important}
}
button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid var(--gold);outline-offset:3px}
    `;
    doc.head.appendChild(style);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. HELPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const hexToRgba = (hex, a = 0.28) => {
    const h = String(hex || '').replace('#', '').trim();
    const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
    const n = parseInt(f, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  const getRoleClass = (r) => {
    const map = { admin:'role-admin', manager:'role-manager', staff:'role-staff', vip:'role-vip', member:'role-member', guest:'role-member' };
    return map[r] || 'role-member';
  };

  const getRoleLabel = (r) => {
    const map = { admin:'مدير عام', manager:'مدير', staff:'فريق العمل', vip:'عضو مميز', member:'عضو', guest:'زائر' };
    return map[r] || 'عضو';
  };

  const maskEmail = (e) => {
    if (!e || !e.includes('@')) return e || 'غير متاح';
    const [l, d] = e.split('@');
    return l.length <= 3 ? `${l[0]}***@${d}` : `${l.slice(0,3)}***@${d}`;
  };

  const formatDate = (d) => {
    try { return new Date(d).toLocaleDateString('ar-SA', { year:'numeric', month:'short', day:'numeric' }); }
    catch { return 'غير معروف'; }
  };

  const showToast = (message, type = 'success') => {
    const toast = root.querySelector('#alertToast');
    if (!toast) return;
    const icon = type === 'success' ? 'check-circle' : 'alert-circle';
    toast.innerHTML = `<i data-lucide="${icon}"></i> ${message}`;
    toast.className = `alert-toast ${type} show`;
    if (win.lucide?.createIcons) win.lucide.createIcons();
    clearTimeout(toast._tid);
    toast._tid = setTimeout(() => toast.classList.remove('show'), 3000);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. APPLY ROLE THEME
  // ═══════════════════════════════════════════════════════════════════════════
  const roleAccents = { vip:'#FFCA28', admin:'#FF5C7A', manager:'#5CD6FF', staff:'#B78BFF', member:'#7BA6FF', guest:'#B6C2D1' };
  const accent = roleAccents[role] || '#7BA6FF';
  doc.documentElement.style.setProperty('--role-accent', accent);
  doc.documentElement.style.setProperty('--role-accent-soft', hexToRgba(accent, 0.35));

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. RENDER HTML (Full Structure)
  // ═══════════════════════════════════════════════════════════════════════════
  root.innerHTML = `
<div class="animated-bg"></div>
<div class="pixel-container"><span class="pixel"></span><span class="pixel"></span><span class="pixel"></span></div>

<!-- ─── Main Header (Same as home.js) ───────────────────────────────────── -->
<header class="main-header" id="mainHeader">
  <div class="header-flex">
    <a data-link="/" href="/" class="logo-link">
      <span class="logo-text">OraaSlayer</span>
    </a>
  </div>
  <div class="header-flex">
    <div class="user-profile" id="userProfile" role="button" aria-label="حساب المستخدم" tabindex="0">
      <div class="avatar-wrap">
        <img src="${avatar}" alt="${displayName}" id="headerAvatar" 
             onerror="this.src='https://i.ibb.co/YRShYmn/avatar.png'" 
             width="36" height="36" loading="eager" decoding="async">
      </div>
    </div>
  </div>
</header>

<!-- ─── Desktop Sidebar ──────────────────────────────────────────────────── -->
<nav class="desktop-sidebar">
  <div class="ds-header"><h3>القائمة</h3></div>
  <div class="ds-nav">
    <a data-link="/" href="/" class="ds-link"><i data-lucide="home"></i> الرئيسية</a>
    <a data-link="/newsanime" href="/newsanime" class="ds-link"><i data-lucide="newspaper"></i> أخبار الأنمي</a>
    <a data-link="/new" href="/new" class="ds-link"><i data-lucide="palette"></i> المبدعين</a>
    <a data-link="/event_gacha/spin" href="/event_gacha/spin" class="ds-link"><i data-lucide="gift"></i> هدايا و أحداث</a>
    <a data-link="/favorites" href="/favorites" class="ds-link"><i data-lucide="heart"></i> المفضلة</a>
    <a data-link="/chat" href="/chat" class="ds-link"><i data-lucide="message-circle"></i> الدردشة</a>
    <a data-link="/redeem_cd" href="/redeem_cd" class="ds-link"><i data-lucide="ticket"></i> شحن كود</a>
    <a data-link="/download" href="/download" class="ds-link"><i data-lucide="download"></i> تحميل التطبيق</a>
    <a data-link="/profile" href="/profile" class="ds-link active"><i data-lucide="user"></i> الملف الشخصي</a>
    <a data-link="/about" href="/about" class="ds-link"><i data-lucide="info"></i> عن المنصة</a>
    <a data-link="/policy" href="/policy" class="ds-link"><i data-lucide="shield"></i> سياسة الخصوصية</a>
  </div>
  <div class="ds-footer">OraaSlayer &copy; 2026</div>
</nav>

<!-- ─── Alert Toast ──────────────────────────────────────────────────────── -->
<div class="alert-toast" id="alertToast" role="alert" aria-live="polite"></div>

<!-- ─── Main Content ──────────────────────────────────────────────────────── -->
<div class="profile-page" id="profilePage">
  <div class="profile-container">
    <div class="profile-card">
      <!-- Avatar -->
      <div class="profile-avatar-wrapper">
        <div class="avatar-ring"></div>
        <img src="${avatar}" class="profile-avatar" alt="${displayName}" id="profileAvatar" 
             onerror="this.src='https://i.ibb.co/YRShYmn/avatar.png'">
      </div>

      <!-- Name & Role -->
      <h1 class="profile-name">${displayName}</h1>
      <span class="role-badge ${getRoleClass(role)}">${getRoleLabel(role)}</span>
      <p class="profile-email">${email ? maskEmail(email) : 'غير متاح'}</p>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-value" id="statLevel">—</span>
          <span class="stat-label"><i data-lucide="star" style="width:14px;height:14px;"></i> المستوى</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" id="statCoins">—</span>
          <span class="stat-label"><i data-lucide="coins" style="width:14px;height:14px;"></i> الجواهر</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" id="statFollowers">—</span>
          <span class="stat-label"><i data-lucide="users" style="width:14px;height:14px;"></i> المتابعون</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" id="statFollowing">—</span>
          <span class="stat-label"><i data-lucide="user-check" style="width:14px;height:14px;"></i> يتابع</span>
        </div>
      </div>

      <!-- Info Section -->
      <div class="info-section">
        <div class="info-item">
          <span class="info-label"><i data-lucide="mail"></i> البريد الإلكتروني</span>
          <span class="info-value">${email ? maskEmail(email) : 'غير متاح'}</span>
        </div>
        <div class="info-item">
          <span class="info-label"><i data-lucide="shield-check"></i> نوع الحساب</span>
          <span class="info-value" id="providerType">${userRef.providerData?.[0]?.providerId || 'بريد إلكتروني'}</span>
        </div>
        <div class="info-item">
          <span class="info-label"><i data-lucide="calendar-days"></i> تاريخ التسجيل</span>
          <span class="info-value" id="joinDate">جارٍ التحميل...</span>
        </div>
        <div class="info-item">
          <span class="info-label"><i data-lucide="clock"></i> آخر تسجيل دخول</span>
          <span class="info-value">${formatDate(new Date())}</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button class="btn-action btn-primary" id="editProfileBtn">
          <i data-lucide="edit-3"></i> تعديل الملف الشخصي
        </button>
        <button class="btn-action btn-secondary" id="changeAvatarBtn">
          <i data-lucide="image"></i> تغيير الصورة الشخصية
        </button>
        <button class="btn-action btn-warning" id="gachaBtn">
          <i data-lucide="gift"></i> فعالية Gacha
        </button>
        <button class="btn-action btn-danger" id="logoutBtn">
          <i data-lucide="log-out"></i> تسجيل الخروج
        </button>
      </div>
    </div>
  </div>
</div>

<!-- ─── Bottom Navigation ─────────────────────────────────────────────── -->
<nav class="bottom-nav" id="bottomNav">
  <a data-link="/" href="/" class="nav-item">
    <i data-lucide="home"></i><span class="nav-label">الرئيسية</span>
  </a>
  <a data-link="/favorites" href="/favorites" class="nav-item">
    <i data-lucide="heart"></i><span class="nav-label">المفضلة</span>
  </a>
  <a data-link="/event_gacha/spin" href="/event_gacha/spin" class="nav-item">
    <i data-lucide="gift"></i><span class="nav-label">الهدايا</span>
  </a>
  <a data-link="/profile" href="/profile" class="nav-item active">
    <i data-lucide="user"></i><span class="nav-label">حسابي</span>
  </a>
</nav>`;

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. RENDER LUCIDE ICONS
  // ═══════════════════════════════════════════════════════════════════════════
  if (win.lucide?.createIcons) win.lucide.createIcons();

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. DOM CACHE
  // ═══════════════════════════════════════════════════════════════════════════
  const $ = (sel) => root.querySelector(sel);
  const dom = {
    mainHeader: $('#mainHeader'),
    logoutBtn: $('#logoutBtn'),
    editProfileBtn: $('#editProfileBtn'),
    changeAvatarBtn: $('#changeAvatarBtn'),
    gachaBtn: $('#gachaBtn'),
    userProfile: $('#userProfile'),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  // ✅ FIXED: Logout Handler (Multiple fallback paths)
  const handleLogout = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const btn = e.currentTarget;
    if (!btn || btn.disabled) return;

    btn.disabled = true;
    btn.style.opacity = '0.6';
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto;"></span>';

    try {
      // Method 1: Firebase Auth
      if (typeof firebase !== 'undefined' && firebase.auth) {
        await firebase.auth().signOut();
      }
      
      // Method 2: Auth module
      if (authMod?.logout) {
        await authMod.logout();
      }
      
      // Clear all auth state
      if (win.__AUTH__) {
        win.__AUTH__.isLoggedIn = false;
        win.__AUTH__.user = null;
        win.__AUTH__.ready = true;
      }

      // Dispatch event for other pages
      win.dispatchEvent(new CustomEvent('auth:changed', { 
        detail: { isLoggedIn: false, displayName: 'زائر', role: 'guest', avatar: 'https://i.ibb.co/YRShYmn/avatar.png' } 
      }));

      // Clear local storage auth tokens
      try {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('firebase_user');
        sessionStorage.clear();
      } catch {}

      showToast('تم تسجيل الخروج بنجاح', 'success');
      setTimeout(() => go('/'), 700);
    } catch (err) {
      console.error('[Profile] Logout failed:', err);
      btn.innerHTML = originalHTML;
      btn.disabled = false;
      btn.style.opacity = '1';
      showToast('فشل تسجيل الخروج - حاول مرة أخرى', 'error');
    }
  };

  // Bind handlers
  dom.logoutBtn?.addEventListener('pointerdown', handleLogout);
  dom.editProfileBtn?.addEventListener('pointerdown', () => showToast('قريباً - تعديل الملف الشخصي', 'success'));
  dom.changeAvatarBtn?.addEventListener('pointerdown', () => showToast('قريباً - تغيير الصورة الشخصية', 'success'));
  dom.gachaBtn?.addEventListener('pointerdown', () => go('/event_gacha/spin'));
  dom.userProfile?.addEventListener('pointerdown', () => go('/profile'));

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. NAVIGATION DELEGATION
  // ═══════════════════════════════════════════════════════════════════════════
  const navHandler = (e) => {
    const link = e.target.closest('[data-link]');
    if (link) {
      e.preventDefault();
      go(link.getAttribute('data-link'));
    }
  };
  root.addEventListener('click', navHandler);
  cleanup.push(() => root.removeEventListener('click', navHandler));

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. HEADER SCROLL EFFECT (Same as home.js)
  // ═══════════════════════════════════════════════════════════════════════════
  let scrollRAF = 0;
  const onScroll = () => {
    if (scrollRAF) return;
    scrollRAF = requestAnimationFrame(() => {
      dom.mainHeader?.classList.toggle('main-header--scrolled', win.scrollY > 50);
      scrollRAF = 0;
    });
  };
  win.addEventListener('scroll', onScroll, { passive: true });
  cleanup.push(() => win.removeEventListener('scroll', onScroll));

  // ═══════════════════════════════════════════════════════════════════════════
  // 14. APP HEIGHT
  // ═══════════════════════════════════════════════════════════════════════════
  const setAppHeight = () => doc.documentElement.style.setProperty('--app-height', `${win.innerHeight}px`);
  setAppHeight();
  win.addEventListener('resize', setAppHeight, { passive: true });
  win.addEventListener('orientationchange', setAppHeight, { passive: true });
  cleanup.push(
    () => win.removeEventListener('resize', setAppHeight),
    () => win.removeEventListener('orientationchange', setAppHeight),
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 15. LOAD USER STATS FROM FIRESTORE
  // ═══════════════════════════════════════════════════════════════════════════
  if (uid) {
    try {
      const { doc: firestoreDoc, getDoc, getFirestore } = await import('/api/firebase.js');
      const db = getFirestore ? getFirestore() : null;

      if (db && firestoreDoc && getDoc) {
        const userDocSnap = await getDoc(firestoreDoc(db, 'users', uid));
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          
          if (data.level != null) {
            const el = root.querySelector('#statLevel');
            if (el) el.textContent = data.level;
          }
          if (data.coins != null) {
            const el = root.querySelector('#statCoins');
            if (el) el.textContent = typeof data.coins === 'number' ? data.coins.toLocaleString() : data.coins;
          }
          if (data.followers != null) {
            const el = root.querySelector('#statFollowers');
            if (el) el.textContent = Array.isArray(data.followers) ? data.followers.length : data.followers;
          }
          if (data.following != null) {
            const el = root.querySelector('#statFollowing');
            if (el) el.textContent = Array.isArray(data.following) ? data.following.length : data.following;
          }
          if (data.createdAt) {
            const joinDate = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
            const el = root.querySelector('#joinDate');
            if (el) el.textContent = formatDate(joinDate);
          }
        } else {
          // User doc doesn't exist - set defaults
          const defaults = { statLevel:'1', statCoins:'0', statFollowers:'0', statFollowing:'0', joinDate:'جديد' };
          for (const [id, val] of Object.entries(defaults)) {
            const el = root.querySelector(`#${id}`);
            if (el) el.textContent = val;
          }
        }
      }
    } catch (err) {
      console.warn('[Profile] Stats load error - using defaults');
      // Silently use defaults
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 16. AUTH STATE LISTENER
  // ═══════════════════════════════════════════════════════════════════════════
  const onAuthChanged = (e) => {
    const d = e.detail || {};
    if (!d.isLoggedIn) {
      showToast('تم تسجيل الخروج من حسابك', 'error');
      setTimeout(() => go('/'), 1000);
    }
  };
  win.addEventListener('auth:changed', onAuthChanged);
  cleanup.push(() => win.removeEventListener('auth:changed', onAuthChanged));

  // ═══════════════════════════════════════════════════════════════════════════
  // 17. CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════
  const runCleanup = () => {
    cleanup.forEach(fn => { try { fn(); } catch {} });
  };

  if (typeof onCleanup === 'function') {
    onCleanup(runCleanup);
  } else {
    win.addEventListener('beforeunload', runCleanup, { once: true });
  }

  console.log('[Profile] ✅ Page loaded successfully for:', displayName);

  // ═══════════════════════════════════════════════════════════════════════════
  // 18. BUILD AUTH GATE (Error Page)
  // ═══════════════════════════════════════════════════════════════════════════
  function buildAuthGate(title, desc, link, btnText) {
    return `
<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(1100px circle at 15% 15%,rgba(73,136,196,.2),transparent 35%),linear-gradient(160deg,#0F2854,#0a1a3a,#1C4D8D);font-family:'Cairo',sans-serif;direction:rtl;">
  <div style="text-align:center;padding:40px;background:rgba(15,40,84,.7);backdrop-filter:blur(20px);border-radius:24px;border:1px solid rgba(189,232,245,.15);box-shadow:0 20px 50px rgba(0,0,0,.35);max-width:420px;margin:20px;">
    <div style="font-size:64px;margin-bottom:20px;">🔒</div>
    <h2 style="color:#fff;font-size:1.5rem;margin-bottom:10px;">${title}</h2>
    <p style="color:rgba(189,232,245,.7);margin-bottom:20px;">${desc}</p>
    <a href="${link}" data-link="${link}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#FFCA28,#f39c12);color:#000;border-radius:50px;font-weight:700;text-decoration:none;">${btnText}</a>
  </div>
</div>`;
  }
}