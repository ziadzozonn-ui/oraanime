export default async function loginPage(ctx) {
  const { root, go, onCleanup } = ctx;
  const cleanupFns = [];

  // ─── 1. Import auth module (Fixed: /api/auth.js) ────────────────────────
  let authMod = null;
  try {
    authMod = await import('/api/auth.js');
  } catch (e) {
    root.innerHTML = `<div style="padding:40px;color:#fff;background:#050508;text-align:center;font-family:'Cairo';direction:rtl;"><h2>⚠️ فشل تحميل نظام المصادقة</h2><p style="color:#94a3b8;margin-top:8px;">يرجى تحديث الصفحة أو المحاولة لاحقاً</p></div>`;
    return;
  }

  const { login, loginWithGoogle, sendPasswordReset } = authMod;

  // ─── 2. Inject Styles ────────────────────────────────
  if (!document.getElementById('login-page-cairo')) {
    const link = document.createElement('link');
    link.id = 'login-page-cairo';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Changa:wght@400;600;700;800;900&display=swap';
    document.head.appendChild(link);
  }

  if (!document.getElementById('login-page-styles')) {
    const style = document.createElement('style');
    style.id = 'login-page-styles';
    style.textContent = `
    .login-page {
      direction: rtl;
      min-height: 100%;
      color: #fff;
      background:
        radial-gradient(circle at 14% 18%, rgba(91, 141, 239, .20), transparent 24%),
        radial-gradient(circle at 82% 16%, rgba(255, 202, 40, .11), transparent 22%),
        radial-gradient(circle at 76% 84%, rgba(34, 211, 166, .10), transparent 18%),
        linear-gradient(135deg, #040713 0%, #071022 38%, #0c1734 100%);
      overflow-x: hidden;
      position: relative;
      font-family: 'Changa', 'Cairo', system-ui, sans-serif;
    }

    .login-page * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
      font-family: inherit;
    }

    .login-page::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      opacity: .16;
      background-image:
        linear-gradient(rgba(255, 255, 255, .04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, .04) 1px, transparent 1px);
      background-size: 30px 30px;
      mask-image: linear-gradient(to bottom, rgba(0, 0, 0, .95), transparent 95%);
      -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, .95), transparent 95%);
      z-index: 0;
    }

    .login-page .app-shell {
      position: relative;
      width: 100%;
      min-height: 100dvh;
      display: grid;
      grid-template-columns: 1.06fr .94fr;
      isolation: isolate;
      z-index: 1;
    }

    .login-page .hero,
    .login-page .form-side {
      position: relative;
      min-height: 100dvh;
    }

    .login-page .hero {
      overflow: hidden;
      background: linear-gradient(180deg, rgba(5, 8, 22, .18), rgba(5, 8, 22, .72));
    }

    .login-page .hero-media,
    .login-page .hero-media::before,
    .login-page .hero-media::after {
      position: absolute;
      inset: 0;
      content: "";
    }

    .login-page .hero-media img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transform: scale(1.04);
      filter: saturate(1.12) contrast(1.05) brightness(.78);
      animation: loginHeroZoom 20s ease-in-out infinite alternate;
      will-change: transform;
    }

    .login-page .hero-media::before {
      background:
        radial-gradient(circle at 20% 18%, rgba(255, 202, 40, .20), transparent 16%),
        radial-gradient(circle at 55% 30%, rgba(91, 141, 239, .22), transparent 22%),
        radial-gradient(circle at 70% 78%, rgba(255, 110, 199, .10), transparent 18%);
      filter: blur(14px);
      opacity: .95;
      animation: loginGlowShift 10s ease-in-out infinite alternate;
      z-index: 1;
    }
        
    .login-page .hero-media::after {
      background:
        linear-gradient(270deg, rgba(5, 8, 22, .98) 0%, rgba(5, 8, 22, .72) 30%, rgba(5, 8, 22, .24) 62%, rgba(5, 8, 22, .60) 100%),
        linear-gradient(180deg, rgba(5, 8, 22, .06) 0%, rgba(5, 8, 22, .48) 100%);
      z-index: 2;
    }

    .login-page .noise {
      position: absolute;
      inset: 0;
      z-index: 3;
      pointer-events: none;
      opacity: .07;
      background-image: radial-gradient(rgba(255,255,255,.55) 0.6px, transparent 0.6px);
      background-size: 4px 4px;
      mix-blend-mode: screen;
    }

    .login-page .hero-content {
      position: relative;
      z-index: 5;
      min-height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 18px;
      padding: clamp(24px, 3.8vw, 60px);
    }

    .login-page .hero-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .login-page .brand-mark {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
    }

    .login-page .brand-logo,
    .login-page .mini-logo {
      object-fit: cover;
      background: rgba(189, 232, 245, .12);
      border: 1px solid rgba(189, 232, 245, .20);
      box-shadow: 0 12px 30px rgba(0, 0, 0, .25);
      flex-shrink: 0;
    }

    .login-page .brand-logo {
      width: 56px;
      height: 56px;
      border-radius: 18px;
    }

    .login-page .brand-name,
    .login-page .mini-name {
      font-family: 'Changa', sans-serif;
      font-weight: 900;
      color: #bde8f5;
      line-height: 1;
    }

    .login-page .brand-name {
      font-size: 1.42rem;
      letter-spacing: .2px;
    }

    .login-page .brand-tag {
      margin-top: 6px;
      font-size: .78rem;
      color: rgba(255, 255, 255, .62);
    }
        
    .login-page .hero-badge,
    .login-page .floating-chip,
    .login-page .mode-chip,
    .login-page .pill,
    .login-page .stat,
    .login-page .login-card,
    .login-page .btn-primary,
    .login-page .btn-google,
    .login-page .input-field,
    .login-page .password-toggle {
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
    }

    .login-page .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 999px;
      background: rgba(255, 202, 40, .10);
      border: 1px solid rgba(255, 202, 40, .22);
      color: #ffca28;
      font-size: .78rem;
      font-weight: 800;
      white-space: nowrap;
      box-shadow: 0 10px 24px rgba(0,0,0,.12);
      animation: loginFloatChip 5.5s ease-in-out infinite;
    }

    .login-page .hero-main {
      max-width: 690px;
      margin-top: auto;
      padding-bottom: 8px;
    }

    .login-page .hero-kicker {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: rgba(255, 255, 255, .84);
      font-size: .84rem;
      font-weight: 700;
      margin-bottom: 14px;
      padding-inline: 2px;
    }

    .login-page .hero-kicker i,
    .login-page .floating-chip i,
    .login-page .pill i {
      color: #ffca28;
    }

    .login-page .hero-title {
      font-family: 'Changa', sans-serif;
      font-weight: 900;
      font-size: clamp(2.15rem, 3.9vw, 4.75rem);
      line-height: .98;
      letter-spacing: -.95px;
      text-shadow: 0 10px 32px rgba(0, 0, 0, .35);
      margin-bottom: 16px;
      max-width: 11ch;
    }

    .login-page .hero-title .accent { color: #ffca28; }

    .login-page .hero-desc {
      max-width: 590px;
      font-size: clamp(.96rem, 1vw, 1.08rem);
      line-height: 1.9;
      color: rgba(255, 255, 255, .76);
      text-wrap: balance;
    }

    .login-page .hero-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 24px;
    }

    .login-page .pill {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(255, 255, 255, .06);
      border: 1px solid rgba(255, 255, 255, .10);
      color: rgba(255, 255, 255, .86);
      font-size: .82rem;
      font-weight: 700;
      box-shadow: 0 8px 20px rgba(0,0,0,.14);
    }

    .login-page .hero-pills .pill:nth-child(1) { animation: loginPillFloat 7s ease-in-out infinite; }
    .login-page .hero-pills .pill:nth-child(2) { animation: loginPillFloat 7s ease-in-out .4s infinite; }
    .login-page .hero-pills .pill:nth-child(3) { animation: loginPillFloat 7s ease-in-out .8s infinite; }

    .login-page .hero-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-top: 28px;
      max-width: 560px;
    }

    .login-page .stat {
      position: relative;
      overflow: hidden;
      padding: 16px 14px;
      border-radius: 20px;
      background: rgba(255, 255, 255, .08);
      border: 1px solid rgba(255, 255, 255, .11);
      box-shadow: 0 16px 35px rgba(0, 0, 0, .16);
      transform: translateZ(0);
    }

    .login-page .stat::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,.12) 50%, transparent 100%);
      transform: translateX(-120%);
      animation: loginSheen 5.8s ease-in-out infinite;
      pointer-events: none;
    }

    .login-page .stat-value {
      display: block;
      font-family: 'Changa', sans-serif;
      font-size: 1.55rem;
      font-weight: 900;
      line-height: 1;
      color: #ffca28;
    }

    .login-page .stat-label {
      display: block;
      margin-top: 7px;
      font-size: .72rem;
      letter-spacing: .2px;
      color: rgba(255, 255, 255, .58);
    }

    .login-page .hero-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      margin-top: 24px;
      color: rgba(255, 255, 255, .56);
      font-size: .78rem;
    }

    .login-page .manga-line {
      width: 140px;
      height: 1px;
      background: linear-gradient(90deg, rgba(189, 232, 245, 0), rgba(189, 232, 245, .6), rgba(189, 232, 245, 0));
      flex-shrink: 0;
    }

    .login-page .hero-flares,
    .login-page .petal-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 4;
      overflow: hidden;
    }

    .login-page .flare {
      position: absolute;
      border-radius: 50%;
      filter: blur(12px);
      opacity: .75;
      animation: loginDrift 12s ease-in-out infinite;
    }

    .login-page .flare.f1 { width: 10px; height: 10px; left: 12%; top: 20%; background: #ffca28; }
    .login-page .flare.f2 { width: 8px; height: 8px; left: 24%; top: 74%; background: #bde8f5; animation-duration: 14s; animation-direction: reverse; }
    .login-page .flare.f3 { width: 12px; height: 12px; right: 18%; top: 32%; background: #ff6ec7; animation-duration: 11s; }
    .login-page .flare.f4 { width: 7px; height: 7px; right: 28%; bottom: 18%; background: #22d3a6; animation-duration: 13s; animation-direction: reverse; }

    .login-page .petal {
      position: absolute;
      top: -12vh;
      width: 12px;
      height: 18px;
      border-radius: 12px 12px 14px 14px;
      background: linear-gradient(180deg, rgba(255, 180, 214, .98), rgba(255, 145, 192, .84));
      opacity: .82;
      filter: blur(.15px) drop-shadow(0 8px 10px rgba(0,0,0,.18));
      transform: rotate(20deg);
      animation-name: loginPetalFall, loginPetalTwirl;
      animation-timing-function: linear, ease-in-out;
      animation-iteration-count: infinite, infinite;
      animation-fill-mode: both, both;
      will-change: transform, top, left, opacity;
    }

    .login-page .petal::before {
      content: "";
      position: absolute;
      inset: 2px 3px 4px 3px;
      border-radius: inherit;
      background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.85), transparent 55%);
      opacity: .38;
    }

    .login-page .floating-chip {
      position: absolute;
      left: 22px;
      top: 22px;
      z-index: 6;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 18px;
      background: rgba(255, 255, 255, .07);
      border: 1px solid rgba(255, 255, 255, .12);
      color: #fff;
      box-shadow: 0 12px 28px rgba(0,0,0,.20);
      font-size: .8rem;
      font-weight: 700;
      animation: loginFloatChip 6s ease-in-out infinite;
    }

    .login-page .form-side {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: clamp(18px, 3vw, 44px);
      background:
        radial-gradient(circle at 18% 20%, rgba(28, 77, 141, .28), transparent 26%),
        radial-gradient(circle at 80% 76%, rgba(255, 202, 40, .10), transparent 24%),
        linear-gradient(180deg, rgba(5, 8, 22, .18), rgba(5, 8, 22, .72));
      overflow: hidden;
    }

    .login-page .orb {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      filter: blur(90px);
      opacity: .74;
      z-index: 0;
      animation: loginOrbPulse 12s ease-in-out infinite;
    }

    .login-page .orb-1 {
      width: 360px;
      height: 360px;
      top: -120px;
      left: -110px;
      background: rgba(28, 77, 141, .30);
    }

    .login-page .orb-2 {
      width: 280px;
      height: 280px;
      bottom: -90px;
      right: -90px;
      background: rgba(255, 202, 40, .10);
      animation-delay: 1.6s;
    }

    .login-page .orb-3 {
      width: 180px;
      height: 180px;
      top: 45%;
      right: 10%;
      background: rgba(255, 110, 199, .12);
      animation-delay: .8s;
    }

    .login-page .login-card {
      position: relative;
      z-index: 2;
      width: 100%;
      max-width: 500px;
      padding: clamp(22px, 3vw, 36px);
      border-radius: 30px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, .10), rgba(255, 255, 255, .045)),
        rgba(10, 18, 39, .76);
      border: 1px solid rgba(189, 232, 245, .14);
      box-shadow: 0 30px 100px rgba(0, 0, 0, .52);
      isolation: isolate;
      animation: loginCardRise .7s cubic-bezier(.2,.8,.2,1) both;
    }

    .login-page .login-card::before {
      content: "";
      position: absolute;
      inset: 1px;
      border-radius: 29px;
      pointer-events: none;
      background: linear-gradient(135deg, rgba(255,255,255,.14), transparent 28%, transparent 72%, rgba(255,255,255,.08));
      opacity: .9;
    }
        
    .login-page .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 20px;
    }

    .login-page .mini-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .login-page .mini-logo {
      width: 46px;
      height: 46px;
      border-radius: 16px;
    }

    .login-page .mini-name {
      font-size: 1.18rem;
    }

    .login-page .mini-sub {
      margin-top: 4px;
      color: rgba(255, 255, 255, .55);
      font-size: .76rem;
    }

    .login-page .mode-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, .06);
      border: 1px solid rgba(255, 255, 255, .08);
      color: rgba(255, 255, 255, .72);
      font-size: .76rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .login-page .login-head {
      margin: 12px 0 22px;
    }

    .login-page .login-title {
      font-family: 'Changa', sans-serif;
      font-size: clamp(1.6rem, 2.2vw, 2rem);
      font-weight: 900;
      letter-spacing: -.5px;
      margin-bottom: 6px;
    }

    .login-page .login-subtitle {
      color: rgba(189, 232, 245, .58);
      font-size: .92rem;
      line-height: 1.7;
    }

    .login-page .alert {
      display: none;
      align-items: flex-start;
      gap: 10px;
      padding: 14px 16px;
      margin-bottom: 18px;
      border-radius: 18px;
      font-size: .9rem;
      font-weight: 600;
      line-height: 1.6;
      animation: loginPop .24s ease-out;
    }

    .login-page .alert-error {
      background: rgba(255, 90, 122, .12);
      border: 1px solid rgba(255, 90, 122, .24);
      color: #ff94a6;
    }

    .login-page .alert-success {
      background: rgba(34, 211, 166, .12);
      border: 1px solid rgba(34, 211, 166, .24);
      color: #82f1d4;
    }

    .login-page .form-grid { display: grid; gap: 16px; }
    .login-page .input-group { display: grid; gap: 8px; }
    .login-page .input-group label { font-size: .84rem; font-weight: 700; color: rgba(189, 232, 245, .92); }
    .login-page .input-wrap { position: relative; }

    .login-page .input-icon {
      position: absolute;
      right: 15px;
      top: 50%;
      transform: translateY(-50%);
      font-size: .95rem;
      color: rgba(189, 232, 245, .52);
      pointer-events: none;
    }

    .login-page .input-field {
      width: 100%;
      height: 56px;
      padding: 0 44px 0 18px;
      border-radius: 18px;
      border: 1px solid rgba(189, 232, 245, .14);
      background: linear-gradient(180deg, rgba(0, 0, 0, .24), rgba(0, 0, 0, .30));
      color: #fff;
      outline: none;
      font: inherit;
      font-size: .96rem;
      transition: .22s ease;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, .03);
    }

    .login-page .input-field::placeholder { color: rgba(255, 255, 255, .32); }

    .login-page .input-field:focus {
      border-color: rgba(255, 202, 40, .70);
      background: rgba(0, 0, 0, .38);
      box-shadow: 0 0 0 4px rgba(255, 202, 40, .10);
    }

    .login-page .password-wrap .input-field { padding-left: 56px; }

    .login-page .password-toggle {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      width: 38px;
      height: 38px;
      border: none;
      border-radius: 12px;
      background: rgba(255, 255, 255, .05);
      color: rgba(255, 255, 255, .72);
      cursor: pointer;
      transition: .2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
    }

    .login-page .password-toggle:hover { background: rgba(255, 255, 255, .10); color: #fff; }

    .login-page .forgot-link { text-align: left; margin-top: 2px; }
    .login-page .forgot-link a { color: #ffca28; font-size: .82rem; font-weight: 700; text-decoration: none; cursor: pointer; }
    .login-page .forgot-link a:hover { text-decoration: underline; }

    .login-page .btn-primary,
    .login-page .btn-google {
      width: 100%;
      height: 56px;
      border: none;
      border-radius: 999px;
      cursor: pointer;
      font: inherit;
      font-weight: 800;
      transition: transform .16s ease, box-shadow .18s ease, background .18s ease, opacity .18s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    .login-page .btn-primary {
      position: relative;
      color: #fff;
      background: linear-gradient(135deg, #1f57a3 0%, #4d8cff 100%);
      box-shadow: 0 16px 34px rgba(28, 77, 141, .34);
      overflow: hidden;
    }

    .login-page .btn-primary::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,.24) 50%, transparent 100%);
      transform: translateX(-130%);
      animation: loginSheen 5.5s ease-in-out infinite;
      pointer-events: none;
    }

    .login-page .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 18px 40px rgba(28, 77, 141, .45); }
    .login-page .btn-primary:active { transform: translateY(0) scale(.986); }
    .login-page .btn-primary:disabled { opacity: .62; cursor: not-allowed; transform: none; }

    .login-page .divider {
      display: flex;
      align-items: center;
      gap: 14px;
      color: rgba(255, 255, 255, .40);
      font-size: .72rem;
      letter-spacing: .45px;
      font-weight: 800;
      margin: 20px 0;
    }

    .login-page .divider::before,
    .login-page .divider::after {
      content: "";
      height: 1px;
      flex: 1;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .10), transparent);
    }

    .login-page .btn-google {
      color: #fff;
      background: rgba(255, 255, 255, .06);
      border: 1px solid rgba(255, 255, 255, .12);
      box-shadow: 0 18px 40px rgba(28, 77, 141, .22);
    }

    .login-page .btn-google:hover { background: rgba(255, 255, 255, .10); border-color: rgba(255, 255, 255, .20); transform: translateY(-2px); }
    .login-page .btn-google:active { transform: translateY(0) scale(.986); }
    .login-page .btn-google:disabled { opacity: .62; cursor: not-allowed; transform: none; }

    .login-page .google-icon {
      width: 22px; height: 22px; border-radius: 50%;
      background: #fff; color: #4285F4;
      display: grid; place-items: center;
      font-weight: 900; font-size: .72rem; flex-shrink: 0;
    }

    .login-page .signup-text {
      margin-top: 22px; text-align: center;
      color: rgba(255, 255, 255, .60); font-size: .9rem;
    }

    .login-page .signup-text a {
      color: #ffca28; font-weight: 800; text-decoration: none;
    }

    .login-page .signup-text a:hover { text-decoration: underline; }

    .login-page .spinner {
      width: 20px; height: 20px; border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, .28);
      border-top-color: #fff;
      animation: spin .65s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes loginDrift { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(18px,-16px,0) scale(1.25); } }
    @keyframes loginPop { from { opacity:0; transform:translateY(-8px) scale(.98); } to { opacity:1; transform:translateY(0) scale(1); } }
    @keyframes loginHeroZoom { from { transform:scale(1.03) translate3d(0,0,0); } to { transform:scale(1.08) translate3d(0,-1.2%,0); } }
    @keyframes loginGlowShift { from { transform:translate3d(-2%,0,0) scale(1); opacity:.72; } to { transform:translate3d(2%,-1%,0) scale(1.03); opacity:1; } }
    @keyframes loginFloatChip { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }
    @keyframes loginOrbPulse { 0%,100% { transform:scale(1); opacity:.72; } 50% { transform:scale(1.08); opacity:.95; } }
    @keyframes loginCardRise { from { opacity:0; transform:translateY(18px) scale(.985); } to { opacity:1; transform:translateY(0) scale(1); } }
    @keyframes loginPillFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-4px); } }
    @keyframes loginSheen { 0%,50% { transform:translateX(-130%); opacity:0; } 55% { opacity:.95; } 100% { transform:translateX(130%); opacity:0; } }
    @keyframes loginPetalFall { 0% { top:-12vh; opacity:0; } 8% { opacity:.9; } 100% { top:112vh; opacity:0; } }
    @keyframes loginPetalTwirl { 0% { transform:translateX(0) rotate(0deg) scale(1); } 25% { transform:translateX(12px) rotate(80deg) scale(.95); } 50% { transform:translateX(-8px) rotate(180deg) scale(1.03); } 75% { transform:translateX(16px) rotate(270deg) scale(.96); } 100% { transform:translateX(0) rotate(360deg) scale(1); } }

    @media (max-width: 860px) {
      .login-page .app-shell { grid-template-columns: 1fr; min-height: auto; }
      .login-page .hero { min-height: 35dvh; height: 350px; order: 1; }
      .login-page .form-side { min-height: auto; order: 2; padding-top: 18px; padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px)); overflow: visible; }
      .login-page .hero-content { padding: 20px 16px 18px; justify-content: flex-end; }
      .login-page .hero-badge { display: none; }
      .login-page .hero-main { max-width: 100%; }
      .login-page .hero-title { max-width: 12ch; font-size: clamp(1.82rem, 6vw, 3rem); margin-bottom: 10px; }
      .login-page .hero-desc { max-width: 100%; font-size: .88rem; line-height: 1.72; }
      .login-page .hero-pills { gap: 10px; margin-top: 18px; }
      .login-page .pill { padding: 9px 12px; font-size: .76rem; }
      .login-page .hero-stats { grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; max-width: 100%; }
      .login-page .stat { padding: 12px 10px; border-radius: 16px; }
      .login-page .stat-value { font-size: 1.15rem; }
      .login-page .stat-label { font-size: .66rem; }
      .login-page .hero-footer { display: none; }
      .login-page .floating-chip { top: 14px; left: 14px; padding: 10px 12px; font-size: .72rem; }
      .login-page .login-card { max-width: 560px; border-radius: 24px; }
    }

    @media (max-width: 520px) {
      .login-page .hero { height: 315px; }
      .login-page .hero-content { padding: 16px 14px 14px; }
      .login-page .brand-logo { width: 48px; height: 48px; border-radius: 16px; }
      .login-page .brand-name { font-size: 1.16rem; }
      .login-page .brand-tag { font-size: .71rem; }
      .login-page .login-card { padding: 18px; }
      .login-page .card-top { align-items: flex-start; margin-bottom: 16px; }
      .login-page .mode-chip { padding: 8px 10px; font-size: .70rem; }
      .login-page .login-title { font-size: 1.42rem; }
      .login-page .login-subtitle { font-size: .86rem; }
      .login-page .input-field, .login-page .btn-primary, .login-page .btn-google { height: 52px; }
      .login-page .input-field { font-size: .94rem; }
      .login-page .signup-text { font-size: .84rem; }
      .login-page .hero-stats { gap: 8px; }
      .login-page .hero-pills { gap: 8px; }
      .login-page .pill { font-size: .72rem; }
      .login-page .stat { border-radius: 14px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .login-page *, .login-page *::before, .login-page *::after { animation: none !important; transition: none !important; }
      .login-page .hero-media img { transform: none !important; }
    }
    `;
    document.head.appendChild(style);
  }

  // ─── 3. Petal Factory ────────────────────────────────
  function createPetals(layer) {
    if (!layer) return;
    const isMobile = window.innerWidth < 768;
    const count = isMobile ? 18 : 36;
    const colors = ["#ffb4d6", "#ffc2e0", "#ffd2eb", "#f7a7cb"];
    layer.innerHTML = "";

    for (let i = 0; i < count; i++) {
      const petal = document.createElement("span");
      petal.className = "petal";
      const size = 7 + Math.random() * (isMobile ? 7 : 9);
      const left = Math.random() * 100;
      const delay = Math.random() * -18;
      const duration = 9 + Math.random() * 14;
      const opacity = 0.28 + Math.random() * 0.55;
      const scale = 0.72 + Math.random() * 1.22;
      const rotate = Math.random() * 360;
      const color = colors[Math.floor(Math.random() * colors.length)];

      petal.style.left = left + "vw";
      petal.style.width = size + "px";
      petal.style.height = (size * 1.45) + "px";
      petal.style.opacity = opacity;
      petal.style.transform = `rotate(${rotate}deg) scale(${scale})`;
      petal.style.animationDuration = `${duration}s, ${4 + Math.random() * 5}s`;
      petal.style.animationDelay = `${delay}s, ${Math.random() * -4}s`;
      petal.style.filter = `blur(${Math.random() * 0.35}px)`;
      petal.style.background = `linear-gradient(180deg, ${color}, rgba(255, 145, 192, .82))`;
      layer.appendChild(petal);
    }

    // Petals are recycled via CSS animation - no DOM recreation needed
    // Each petal has a unique animation-delay ensuring continuous visual coverage
    // No setInterval needed - CSS handles the looping automatically
  }

  // ─── 4. Render HTML ──────────────────────────────────
  root.innerHTML = `
    <section class="login-page" id="loginPage">
      <main class="app-shell">
        <section class="hero" aria-label="قسم Hero">
          <div class="hero-media">
            <img src="/assist/bckj.jpg" alt="خلفية أنمي" id="heroImage" onerror="this.src='https://picsum.photos/seed/oraaanime/1400/1200'">
            <div class="noise"></div>
          </div>
        
          <div class="hero-flares" aria-hidden="true">
            <span class="flare f1"></span>
            <span class="flare f2"></span>
            <span class="flare f3"></span>
            <span class="flare f4"></span>
          </div>

          <div id="petalLayer" class="petal-layer" aria-hidden="true"></div>

          <div class="floating-chip">✨ نمط أنمي ليلي</div>

          <div class="hero-content">
            <div class="hero-top">
              <div class="brand-mark">
                <img src="/assist/oraaic.jpg" class="brand-logo" alt="OraaSlayer" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2256%22 height=%2256%22><rect fill=%22%230F2854%22 width=%2256%22 height=%2256%22 rx=%2218%22/><text x=%2228%22 y=%2238%22 text-anchor=%22middle%22 fill=%22%23FFCA28%22 font-size=%2230%22 font-weight=%22900%22>O</text></svg>'">
                <div class="brand-text">
                  <div class="brand-name">OraaSlayer</div>
                  <div class="brand-tag">شاهد • تتبع • تطور</div>
                </div>
              </div>
              <div class="hero-badge">⭐ تجربة أنمي مميزة</div>
            </div>

            <div class="hero-main">
              <div class="hero-kicker">▶ عالم الأنمي يبدأ من هنا</div>
              <h2 class="hero-title">شاهد <span class="accent">الأنمي</span> بأفضل تجربة</h2>
              <p class="hero-desc">انضم للمجتمع، تابع رحلتك، واحتفظ بقائمة المشاهدة في مكان واحد مع واجهة سينمائية مصممة للجوال وسطح المكتب.</p>

              <div class="hero-pills">
                <div class="pill">⚡ تسجيل سريع</div>
                <div class="pill">📺 جودة HD</div>
                <div class="pill">👥 مجتمع تفاعلي</div>
              </div>

              <div class="hero-stats">
                <div class="stat"><span class="stat-value">+10K</span><span class="stat-label">مستخدم نشط</span></div>
                <div class="stat"><span class="stat-value">+5K</span><span class="stat-label">أنمي مترجم</span></div>
                <div class="stat"><span class="stat-value">HD</span><span class="stat-label">جودة عالية</span></div>
              </div>
            </div>

            <div class="hero-footer">
              <span>مصمم لعشاق الأنمي</span>
              <span class="manga-line"></span>
              <span>متجاوب مع كل الأجهزة</span>
            </div>
          </div>
        </section>

        <section class="form-side" aria-label="نموذج تسجيل الدخول">
          <div class="orb orb-1"></div>
          <div class="orb orb-2"></div>
          <div class="orb orb-3"></div>

          <div class="login-card">
            <div class="card-top">
              <div class="mini-brand">
                <img src="/assist/oraaic.jpg" class="mini-logo" alt="OraaSlayer" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2246%22 height=%2246%22><rect fill=%22%230F2854%22 width=%2246%22 height=%2246%22 rx=%2216%22/><text x=%2223%22 y=%2232%22 text-anchor=%22middle%22 fill=%22%23FFCA28%22 font-size=%2224%22 font-weight=%22900%22>O</text></svg>'">
                <div>
                  <div class="mini-name">OraaSlayer</div>
                  <div class="mini-sub">سجل دخولك للمتابعة</div>
                </div>
              </div>
              <div class="mode-chip">🌙 نمط ليلي</div>
            </div>

            <div class="login-head">
              <h1 class="login-title">مرحباً بعودتك</h1>
              <p class="login-subtitle">أدخل بيانات حسابك لتستمتع بالمشاهدة وتحافظ على مزامنة ملفك.</p>
            </div>

            <div id="alertBox" class="alert" role="alert" aria-live="polite"></div>

            <form id="loginForm" class="form-grid" autocomplete="on" novalidate>
              <div class="input-group">
                <label for="email">البريد الإلكتروني</label>
                <div class="input-wrap">
                  <span class="input-icon">✉</span>
                  <input type="email" id="email" class="input-field" placeholder="example@email.com" autocomplete="email" inputmode="email" required>
                </div>
              </div>

              <div class="input-group">
                <label for="password">كلمة المرور</label>
                <div class="input-wrap password-wrap">
                  <span class="input-icon">🔒</span>
                  <input type="password" id="password" class="input-field" placeholder="********" autocomplete="current-password" required>
                  <button type="button" class="password-toggle" id="togglePassword" aria-label="إظهار/إخفاء" aria-pressed="false">👁</button>
                </div>
              </div>

              <div class="forgot-link">
                <a id="forgotPasswordLink">نسيت كلمة المرور؟</a>
              </div>

              <button type="submit" class="btn-primary" id="emailLoginBtn">
                <span>🔐</span><span>تسجيل الدخول</span>
              </button>
            </form>

            <div class="divider"><span>أو تابع عبر</span></div>

            <button class="btn-google" id="googleBtn" type="button">
              <div class="google-icon">G</div>
              <span>متابعة بحساب Google</span>
            </button>

            <div class="signup-text">
              ليس لديك حساب؟ <a href="/register" data-link="/register">إنشاء حساب جديد</a>
            </div>
          </div>
        </section>
      </main>
    </section>
  `;

  // ─── 5. DOM Cache ────────────────────────────────────
  const $ = (sel) => root.querySelector(sel);
  const petalLayer = $('#petalLayer');
  const emailInput = $('#email');
  const passwordInput = $('#password');
  const emailBtn = $('#emailLoginBtn');
  const googleBtn = $('#googleBtn');
  const alertBox = $('#alertBox');
  const toggleBtn = $('#togglePassword');
  const loginForm = $('#loginForm');
  const forgotLink = $('#forgotPasswordLink');

  const originalEmailHtml = emailBtn?.innerHTML || '';
  const originalGoogleHtml = googleBtn?.innerHTML || '';
  let alertTimer = null;
  let isSubmitting = false;

  // ─── 6. Helpers ─────────────────────────────────────
  function showAlert(message, type = 'error') {
    const icon = type === 'error' ? '⚠️' : '✅';
    alertBox.innerHTML = `<span>${icon}</span><div>${message}</div>`;
    alertBox.className = `alert alert-${type}`;
    alertBox.style.display = 'flex';
    clearTimeout(alertTimer);
    if (type === 'success') {
      alertTimer = setTimeout(() => { alertBox.style.display = 'none'; }, 5000);
    }
  }

  function hideAlert() {
    clearTimeout(alertTimer);
    alertBox.style.display = 'none';
  }

  function setLoading(btn, loading, originalHtml) {
    if (!btn) return;
    btn.disabled = loading;
    btn.innerHTML = loading ? '<div class="spinner"></div><span>جاري التحميل...</span>' : originalHtml;
  }

  function validateEmail(email) {
    const at = email.indexOf('@');
    const dot = email.lastIndexOf('.');
    return at > 0 && dot > at + 1 && dot < email.length - 1 && !email.includes(' ');
  }

  function handleError(error) {
    const messages = {
      'auth/user-not-found': 'لا يوجد حساب بهذا البريد',
      'auth/wrong-password': 'كلمة المرور غير صحيحة',
      'auth/invalid-email': 'بريد إلكتروني غير صالح',
      'auth/too-many-requests': 'محاولات كثيرة، حاول لاحقاً',
      'auth/invalid-credential': 'بيانات الدخول غير صحيحة',
      'auth/popup-closed-by-user': 'تم إغلاق النافذة المنبثقة',
      'auth/popup-blocked': 'النافذة محظورة من المتصفح',
      'auth/network-request-failed': 'فشل الاتصال بالشبكة',
      'auth/user-disabled': 'تم تعطيل هذا الحساب',
      'auth/missing-email': 'البريد الإلكتروني مطلوب',
      'auth/email-already-in-use': 'هذا البريد مستخدم بالفعل',
      'auth/weak-password': 'كلمة المرور ضعيفة'
    };
    return messages[error?.code] || error?.error || error?.message || 'فشل تسجيل الدخول';
  }

  async function handleSuccess() {
    showAlert('تم تسجيل الدخول بنجاح! جاري التوجيه...', 'success');
    await new Promise(r => setTimeout(r, 1000));
    go('/');
  }

  // ─── 7. Event Listeners ──────────────────────────────
  toggleBtn?.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    toggleBtn.textContent = isHidden ? '🙈' : '👁';
    toggleBtn.setAttribute('aria-pressed', String(isHidden));
  });

  emailInput?.addEventListener('input', hideAlert);
  passwordInput?.addEventListener('input', hideAlert);

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showAlert('يرجى ملء جميع الحقول');
      return;
    }
    if (!validateEmail(email)) {
      emailInput.focus();
      showAlert('بريد إلكتروني غير صالح');
      return;
    }
    if (password.length < 6) {
      passwordInput.focus();
      showAlert('كلمة المرور 6 أحرف على الأقل');
      return;
    }

    isSubmitting = true;
    setLoading(emailBtn, true, originalEmailHtml);
    hideAlert();

    try {
      const result = await login(email, password);
      if (result?.success) {
        await handleSuccess();
      } else {
        showAlert(handleError(result));
        setLoading(emailBtn, false, originalEmailHtml);
      }
    } catch (error) {
      showAlert(handleError(error));
      setLoading(emailBtn, false, originalEmailHtml);
    } finally {
      isSubmitting = false;
    }
  });

  googleBtn?.addEventListener('click', async () => {
    if (isSubmitting) return;
    hideAlert();
    isSubmitting = true;
    setLoading(googleBtn, true, originalGoogleHtml);

    try {
      const result = await loginWithGoogle();
      if (result?.success) {
        await handleSuccess();
      } else {
        showAlert(handleError(result));
        setLoading(googleBtn, false, originalGoogleHtml);
      }
    } catch (error) {
      showAlert(handleError(error));
      setLoading(googleBtn, false, originalGoogleHtml);
    } finally {
      isSubmitting = false;
    }
  });

  forgotLink?.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) {
      emailInput.focus();
      showAlert('أدخل بريدك أولاً');
      return;
    }
    if (!validateEmail(email)) {
      emailInput.focus();
      showAlert('بريد غير صالح');
      return;
    }

    try {
      if (typeof sendPasswordReset === 'function') {
        await sendPasswordReset(email);
        showAlert('تم إرسال رابط إعادة التعيين! تفقد بريدك.', 'success');
      } else {
        showAlert('خدمة استعادة كلمة المرور غير متوفرة حالياً');
      }
    } catch (error) {
      showAlert(handleError(error));
    }
  });

  // ─── 8. Navigation ───────────────────────────────────
  const navHandler = (e) => {
    const link = e.target.closest('[data-link]');
    if (link) {
      e.preventDefault();
      go(link.getAttribute('data-link'));
    }
  };
  root.addEventListener('click', navHandler);
  cleanupFns.push(() => root.removeEventListener('click', navHandler));

  // ─── 9. Init Petals ──────────────────────────────────
  createPetals(petalLayer);
  let resizeDebounce;
  const hResize = () => {
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(() => createPetals(petalLayer), 250);
  };
  window.addEventListener('resize', hResize, { passive: true });
  cleanupFns.push(() => window.removeEventListener('resize', hResize));

  // ─── 10. Cleanup ─────────────────────────────────────
  const runCleanup = () => {
    clearTimeout(alertTimer);
    clearTimeout(resizeDebounce);
    for (const fn of cleanupFns) { try { fn(); } catch {} }
  };

  if (typeof onCleanup === 'function') {
    onCleanup(runCleanup);
  } else {
    window.addEventListener('beforeunload', runCleanup, { once: true });
  }
}