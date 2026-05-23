// ═══════════════════════════════════════════════════════════════════════════════
// OraaSlayer Registration Page (v5.0 Premium Redesign)
// Modern split-screen layout with sakura animation
// ═══════════════════════════════════════════════════════════════════════════════

export default async function registerPage(ctx) {
  const { root, go, onCleanup } = ctx;
  const cleanupFns = [];

  // ─── 1. Import auth module ────────────────────────────────────────────────
  let authMod = null;
  try {
    authMod = await import('/api/auth.js');
  } catch (e) {
    console.error('[Register] Failed to load auth module:', e);
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0a0a0a 0%,#1a1a2e 100%);font-family:'Tajawal',sans-serif;direction:rtl;">
        <div style="text-align:center;padding:40px;background:rgba(255,255,255,0.03);backdrop-filter:blur(20px);border-radius:24px;border:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:64px;margin-bottom:20px;">⚠️</div>
          <h2 style="color:#e0e0e0;font-size:1.5rem;margin-bottom:10px;">فشل تحميل نظام المصادقة</h2>
          <p style="color:rgba(255,255,255,0.5);">يرجى تحديث الصفحة أو المحاولة لاحقاً</p>
        </div>
      </div>
    `;
    return;
  }

  const { register, loginWithGoogle, waitForAuth } = authMod;

  // ─── 2. Inject Google Fonts ───────────────────────────────────────────────
  if (!document.getElementById('register-premium-fonts')) {
    const link = document.createElement('link');
    link.id = 'register-premium-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Poppins:wght@400;500;600;700;800;900&display=swap';
    document.head.appendChild(link);
  }

  // ─── 3. Inject Premium Styles ─────────────────────────────────────────────
  if (!document.getElementById('register-premium-styles')) {
    const style = document.createElement('style');
    style.id = 'register-premium-styles';
    style.textContent = `
      /* ═══════════════════════════════════════════════════════════════════════
         REGISTRATION PAGE - PREMIUM DESIGN SYSTEM (Dark Glassmorphism)
         ═══════════════════════════════════════════════════════════════════════ */

      .reg-page {
        direction: rtl;
        min-height: 100vh;
        background: #0a0a0a;
        font-family: 'Tajawal', 'Poppins', system-ui, sans-serif;
        overflow: hidden;
        position: relative;
      }

      .reg-page * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        -webkit-tap-highlight-color: transparent;
        font-family: inherit;
      }

      /* ─── Canvas Animation ─────────────────────────────────────────────── */
      .reg-page .sakura-canvas {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 1;
      }

      /* ─── Main Container ───────────────────────────────────────────────── */
      .reg-page .reg-container {
        display: flex;
        min-height: 100vh;
        position: relative;
        z-index: 2;
      }

      /* ─── Hero Side (Left) ─────────────────────────────────────────────── */
      .reg-page .hero-section {
        flex: 1.1;
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .reg-page .hero-bg {
        position: absolute;
        inset: 0;
        background: url('/assist/bckj.jpg') center/cover no-repeat;
        animation: heroZoom 25s ease-in-out infinite alternate;
      }

      @keyframes heroZoom {
        from { transform: scale(1); }
        to { transform: scale(1.08); }
      }

      .reg-page .hero-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          135deg,
          rgba(5, 5, 15, 0.95) 0%,
          rgba(15, 15, 45, 0.8) 50%,
          rgba(30, 15, 60, 0.7) 100%
        );
      }

      .reg-page .hero-content {
        position: relative;
        z-index: 2;
        padding: 60px 50px;
        max-width: 580px;
        text-align: right;
      }

      .reg-page .hero-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 20px;
        background: rgba(99, 102, 241, 0.15);
        border: 1px solid rgba(99, 102, 241, 0.3);
        border-radius: 50px;
        color: #818cf8;
        font-size: 0.85rem;
        font-weight: 700;
        margin-bottom: 24px;
        animation: floatBadge 3s ease-in-out infinite;
      }

      @keyframes floatBadge {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
      }

      .reg-page .hero-title {
        font-size: clamp(2.2rem, 4vw, 3.2rem);
        font-weight: 900;
        color: #f0f0f0;
        line-height: 1.25;
        margin-bottom: 20px;
        text-shadow: 0 4px 30px rgba(0, 0, 0, 0.6);
      }

      .reg-page .hero-desc {
        font-size: 1.1rem;
        color: rgba(255, 255, 255, 0.65);
        line-height: 1.8;
        margin-bottom: 36px;
      }

      .reg-page .hero-stats {
        display: flex;
        gap: 40px;
        flex-wrap: wrap;
      }

      .reg-page .hero-stat {
        text-align: right;
      }

      .reg-page .hero-stat-value {
        font-size: 2rem;
        font-weight: 900;
        color: #818cf8;
        font-family: 'Poppins', sans-serif;
      }

      .reg-page .hero-stat-label {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.45);
        font-weight: 500;
        margin-top: 4px;
      }

      /* ─── Form Side (Right) ────────────────────────────────────────────── */
      .reg-page .form-section {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px;
        background: linear-gradient(135deg, #0d0d1a 0%, #13132b 100%);
        position: relative;
      }

      .reg-page .form-card {
        width: 100%;
        max-width: 440px;
        background: rgba(20, 20, 40, 0.6);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 32px;
        padding: 48px 40px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 
          0 25px 80px rgba(0, 0, 0, 0.4),
          0 10px 30px rgba(0, 0, 0, 0.3);
        animation: cardEnter 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        opacity: 0;
        transform: translateY(30px);
      }

      @keyframes cardEnter {
        to { opacity: 1; transform: translateY(0); }
      }

      .reg-page .form-header {
        text-align: center;
        margin-bottom: 36px;
      }

      .reg-page .form-logo {
        width: 64px;
        height: 64px;
        border-radius: 18px;
        object-fit: cover;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 2px solid rgba(99, 102, 241, 0.3);
        box-shadow: 0 8px 25px rgba(99, 102, 241, 0.15);
        margin-bottom: 16px;
      }

      .reg-page .form-brand {
        font-size: 1.6rem;
        font-weight: 900;
        color: #e0e0e0;
        margin-bottom: 8px;
        font-family: 'Poppins', sans-serif;
      }

      .reg-page .form-subtitle {
        font-size: 0.95rem;
        color: rgba(255, 255, 255, 0.5);
        font-weight: 500;
      }

      .reg-page .form-title {
        font-size: 1.6rem;
        font-weight: 800;
        color: #e0e0e0;
        margin-bottom: 6px;
      }

      .reg-page .form-hint {
        font-size: 0.88rem;
        color: rgba(255, 255, 255, 0.4);
        margin-bottom: 28px;
      }

      /* ─── Alert Box ─────────────────────────────────────────────────────── */
      .reg-page .alert-box {
        padding: 16px 18px;
        border-radius: 16px;
        margin-bottom: 20px;
        font-size: 0.9rem;
        font-weight: 600;
        display: none;
        align-items: center;
        gap: 12px;
        animation: alertIn 0.35s ease-out;
      }

      @keyframes alertIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .reg-page .alert-error {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
      }

      .reg-page .alert-success {
        background: rgba(34, 197, 94, 0.15);
        border: 1px solid rgba(34, 197, 94, 0.3);
        color: #86efac;
      }

      .reg-page .alert-icon {
        font-size: 1.2rem;
        flex-shrink: 0;
      }

      /* ─── Form Groups ───────────────────────────────────────────────────── */
      .reg-page .form-group {
        margin-bottom: 20px;
      }

      .reg-page .form-label {
        display: block;
        font-size: 0.9rem;
        font-weight: 700;
        color: #c0c0c0;
        margin-bottom: 10px;
      }

      .reg-page .form-input {
        width: 100%;
        padding: 16px 20px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        color: #e0e0e0;
        font-size: 1rem;
        font-weight: 500;
        outline: none;
        transition: all 0.25s ease;
      }

      .reg-page .form-input::placeholder {
        color: rgba(255, 255, 255, 0.3);
        font-weight: 400;
      }

      .reg-page .form-input:focus {
        border-color: #6366f1;
        background: rgba(255, 255, 255, 0.08);
        box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15);
      }

      .reg-page .input-wrapper {
        position: relative;
      }

      .reg-page .input-icon {
        position: absolute;
        right: 18px;
        top: 50%;
        transform: translateY(-50%);
        color: rgba(255, 255, 255, 0.3);
        font-size: 1.1rem;
        pointer-events: none;
        transition: color 0.25s;
      }

      .reg-page .form-input:focus ~ .input-icon {
        color: #818cf8;
      }

      .reg-page .input-wrapper .form-input {
        padding-right: 50px;
      }

      .reg-page .password-toggle {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.4);
        cursor: pointer;
        padding: 8px;
        font-size: 1.1rem;
        transition: all 0.2s;
        border-radius: 10px;
      }

      .reg-page .password-toggle:hover {
        color: #818cf8;
        background: rgba(99, 102, 241, 0.1);
      }

      /* ─── Password Strength ─────────────────────────────────────────────── */
      .reg-page .strength-meter {
        margin-top: 12px;
      }

      .reg-page .strength-bars {
        display: flex;
        gap: 6px;
        margin-bottom: 6px;
      }

      .reg-page .strength-bar {
        flex: 1;
        height: 5px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.1);
        transition: background 0.3s;
      }

      .reg-page .strength-text {
        font-size: 0.78rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.4);
        transition: color 0.3s;
      }

      /* ─── Primary Button ───────────────────────────────────────────────── */
      .reg-page .btn-primary {
        width: 100%;
        padding: 18px 24px;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: #fff;
        border: none;
        border-radius: 50px;
        font-size: 1.05rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin-top: 8px;
        position: relative;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(99, 102, 241, 0.35);
      }

      .reg-page .btn-primary::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255, 255, 255, 0.2) 50%,
          transparent 100%
        );
        transition: left 0.5s;
      }

      .reg-page .btn-primary:hover::before {
        left: 100%;
      }

      .reg-page .btn-primary:hover {
        transform: translateY(-3px);
        box-shadow: 0 15px 40px rgba(99, 102, 241, 0.5);
      }

      .reg-page .btn-primary:active {
        transform: translateY(0);
      }

      .reg-page .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .reg-page .btn-primary:disabled:hover {
        box-shadow: 0 10px 30px rgba(99, 102, 241, 0.35);
      }

      /* ─── Divider ──────────────────────────────────────────────────────── */
      .reg-page .divider {
        display: flex;
        align-items: center;
        margin: 28px 0;
        color: rgba(255, 255, 255, 0.3);
        font-size: 0.85rem;
        font-weight: 600;
      }

      .reg-page .divider::before,
      .reg-page .divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: rgba(255, 255, 255, 0.1);
      }

      .reg-page .divider span {
        padding: 0 16px;
      }

      /* ─── Social Buttons ───────────────────────────────────────────────── */
      .reg-page .social-buttons {
        display: flex;
        gap: 12px;
        justify-content: center;
      }

      .reg-page .social-btn {
        width: 54px;
        height: 54px;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.03);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.25s ease;
        position: relative;
        overflow: hidden;
        color: rgba(255, 255, 255, 0.6);
      }

      .reg-page .social-btn::before {
        content: '';
        position: absolute;
        inset: 0;
        opacity: 0;
        transition: opacity 0.25s;
        background: currentColor;
      }

      .reg-page .social-btn:hover {
        transform: translateY(-4px);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        border-color: transparent;
        color: #fff;
      }

      .reg-page .social-btn:hover::before {
        opacity: 0.15;
      }

      .reg-page .social-btn.google { color: #4285F4; }
      .reg-page .social-btn.facebook { color: #1877F2; }
      .reg-page .social-btn.twitter { color: #E8E8E8; }

      .reg-page .social-btn svg {
        width: 24px;
        height: 24px;
        position: relative;
        z-index: 1;
        fill: currentColor;
      }

      /* ─── Footer Links ─────────────────────────────────────────────────── */
      .reg-page .form-footer {
        text-align: center;
        margin-top: 28px;
      }

      .reg-page .footer-text {
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .reg-page .footer-link {
        color: #818cf8;
        font-weight: 700;
        text-decoration: none;
        transition: color 0.2s;
      }

      .reg-page .footer-link:hover {
        color: #6366f1;
        text-decoration: underline;
      }

      .reg-page .terms-text {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.3);
        margin-top: 16px;
        line-height: 1.6;
      }

      .reg-page .terms-text a {
        color: rgba(255, 255, 255, 0.4);
        text-decoration: none;
        font-weight: 600;
      }

      .reg-page .terms-text a:hover {
        color: #818cf8;
        text-decoration: underline;
      }

      /* ─── Spinner ───────────────────────────────────────────────────────── */
      .reg-page .spinner {
        width: 22px;
        height: 22px;
        border: 3px solid rgba(255, 255, 255, 0.2);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      /* ═══════════════════════════════════════════════════════════════════════
         RESPONSIVE DESIGN (Mobile-First Fix)
         ═══════════════════════════════════════════════════════════════════════ */

      @media (max-width: 1024px) {
        .reg-page .hero-section { flex: 0.9; }
        .reg-page .form-section { flex: 1.1; }
        .reg-page .hero-content { padding: 40px 35px; }
      }

      @media (max-width: 900px) {
        .reg-page .reg-container {
          flex-direction: column;
        }

        .reg-page .hero-section {
          flex: none;
          min-height: 280px;
        }

        .reg-page .hero-content {
          padding: 30px 24px;
          text-align: center;
        }

        .reg-page .hero-stats {
          justify-content: center;
        }

        .reg-page .hero-stat {
          text-align: center;
        }

        .reg-page .form-section {
          flex: 1;
          padding: 30px 20px;
          align-items: flex-start;
        }

        .reg-page .form-card {
          padding: 36px 28px;
          border-radius: 24px;
        }

        /* Fix: Ensure social buttons visible */
        .reg-page .social-buttons {
          gap: 10px;
        }

        .reg-page .social-btn {
          width: 50px;
          height: 50px;
          border-radius: 14px;
        }
      }

      @media (max-width: 480px) {
        .reg-page .hero-section {
          min-height: 220px;
        }

        .reg-page .hero-title {
          font-size: 1.6rem;
        }

        .reg-page .hero-desc {
          font-size: 0.9rem;
          display: none;
        }

        .reg-page .hero-badge {
          font-size: 0.75rem;
          padding: 8px 14px;
        }

        .reg-page .form-card {
          padding: 28px 20px;
          border-radius: 20px;
          box-shadow: none;
        }

        .reg-page .form-logo {
          width: 52px;
          height: 52px;
          border-radius: 14px;
        }

        .reg-page .form-title {
          font-size: 1.4rem;
        }

        .reg-page .social-btn {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
        }

        .reg-page .social-btn svg {
          width: 20px;
          height: 20px;
        }

        .reg-page .divider {
          margin: 20px 0;
        }

        .reg-page .btn-primary {
          padding: 16px 20px;
          font-size: 1rem;
        }
      }

      /* Fix: Very small screens */
      @media (max-width: 360px) {
        .reg-page .form-card {
          padding: 20px 16px;
        }

        .reg-page .social-btn {
          width: 44px;
          height: 44px;
        }

        .reg-page .social-buttons {
          gap: 8px;
        }

        .reg-page .form-input {
          padding: 14px 16px;
          font-size: 0.9rem;
        }
      }

      /* ─── Reduced Motion ───────────────────────────────────────────────── */
      @media (prefers-reduced-motion: reduce) {
        .reg-page *,
        .reg-page *::before,
        .reg-page *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }

      /* ─── Touch Device Optimization ─────────────────────────────────────── */
      @media (hover: none) and (pointer: coarse) {
        .reg-page .social-btn:active {
          transform: scale(0.95);
        }

        .reg-page .btn-primary:active {
          transform: scale(0.98);
        }

        .reg-page .password-toggle {
          padding: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── 4. Sakura Canvas Animation ───────────────────────────────────────────
  function createSakuraCanvas() {
    const canvas = root.querySelector('#sakuraCanvas');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resizeCanvas();

    let petals = [];
    const MAX_PETALS = 50;
    let rafId = 0;
    let isRunning = true;

    class SakuraPetal {
      constructor() {
        this.reset(true);
      }

      reset(initial = false) {
        this.x = Math.random() * canvas.width;
        this.y = initial ? Math.random() * -canvas.height : -30;
        this.size = Math.random() * 12 + 8;
        this.speedY = Math.random() * 1.5 + 1;
        this.speedX = (Math.random() - 0.5) * 0.8;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
        this.opacity = Math.random() * 0.6 + 0.4;
        this.swing = Math.random() * 2;
        this.swingSpeed = Math.random() * 0.02 + 0.01;
      }

      update() {
        this.y += this.speedY;
        this.x += this.speedX + Math.sin(this.swing) * 0.5;
        this.rotation += this.rotationSpeed;
        this.swing += this.swingSpeed;
        if (this.y > canvas.height + 50) this.reset();
      }

      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.opacity;

        const gradient = ctx.createLinearGradient(0, 0, 0, this.size);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.8)');
        gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.6)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.3)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size * 0.4, this.size * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(-this.size * 0.1, -this.size * 0.05, this.size * 0.12, this.size * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }

    function initPetals() {
      petals = [];
      for (let i = 0; i < MAX_PETALS; i++) {
        petals.push(new SakuraPetal());
      }
    }

    function animate() {
      if (!isRunning) {
        rafId = requestAnimationFrame(animate);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const petal of petals) {
        petal.update();
        petal.draw();
      }
      rafId = requestAnimationFrame(animate);
    }

    const handleResize = () => {
      resizeCanvas();
      if (petals.length === 0) initPetals();
    };

    window.addEventListener('resize', handleResize, { passive: true });
    cleanupFns.push(() => window.removeEventListener('resize', handleResize));

    initPetals();
    animate();

    return {
      stop: () => { isRunning = false; },
      start: () => { isRunning = true; },
      destroy: () => {
        isRunning = false;
        if (rafId) cancelAnimationFrame(rafId);
        petals = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }

  // ─── 5. Render HTML ────────────────────────────────────────────────────────
  root.innerHTML = `
    <div class="reg-page" id="registerPage">
      <canvas id="sakuraCanvas" class="sakura-canvas" aria-hidden="true"></canvas>

      <div class="reg-container">
        <!-- Hero Section -->
        <div class="hero-section">
          <div class="hero-bg"></div>
          <div class="hero-overlay"></div>
          <div class="hero-content">
            <div class="hero-badge">
              <span>⭐</span>
              <span>منصة الأنمي الأولى</span>
            </div>
            <h1 class="hero-title">انضم لأقوى مجتمع<br>أنمي في العالم</h1>
            <p class="hero-desc">أنشئ حسابك الآن واستمتع بآلاف العناوين، فعاليات حصرية، ومجتمع مليء بالأوتاكو المحترفين.</p>
            <div class="hero-stats">
              <div class="hero-stat">
                <div class="hero-stat-value">+10K</div>
                <div class="hero-stat-label">مستخدم نشط</div>
              </div>
              <div class="hero-stat">
                <div class="hero-stat-value">+5K</div>
                <div class="hero-stat-label">عنوان أنمي</div>
              </div>
              <div class="hero-stat">
                <div class="hero-stat-value">100%</div>
                <div class="hero-stat-label">مجاني</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Form Section -->
        <div class="form-section">
          <div class="form-card">
            <div class="form-header">
              <img src="/assist/oraaic.jpg" class="form-logo" alt="OraaSlayer" 
                   onerror="this.style.display='none'">
              <div class="form-brand">OraaSlayer</div>
              <p class="form-subtitle">شاهد الأنمي، انضم للمجتمع، ارتقِ بمستواك</p>
            </div>

            <h2 class="form-title">إنشاء حساب جديد</h2>
            <p class="form-hint">املأ بياناتك للانضمام إلى مجتمعنا</p>

            <div id="alertBox" class="alert-box" role="alert" aria-live="polite"></div>

            <form id="registerForm" novalidate autocomplete="off">
              <div class="form-group">
                <label class="form-label" for="reg-name">الاسم الكامل</label>
                <div class="input-wrapper">
                  <input type="text" id="reg-name" class="form-input" 
                         placeholder="أدخل اسمك الكامل" 
                         autocomplete="name" required maxlength="20" minlength="3">
                  <span class="input-icon" aria-hidden="true">👤</span>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="reg-email">البريد الإلكتروني</label>
                <div class="input-wrapper">
                  <input type="email" id="reg-email" class="form-input" 
                         placeholder="example@email.com" 
                         autocomplete="email" required>
                  <span class="input-icon" aria-hidden="true">✉️</span>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="reg-password">كلمة المرور</label>
                <div class="input-wrapper">
                  <input type="password" id="reg-password" class="form-input" 
                         placeholder="********" 
                         autocomplete="new-password" required minlength="6">
                  <button type="button" class="password-toggle" id="togglePassword" aria-label="إظهار كلمة المرور">👁</button>
                </div>
                <div class="strength-meter" id="strengthMeter" style="display:none;">
                  <div class="strength-bars">
                    <div class="strength-bar" aria-hidden="true"></div>
                    <div class="strength-bar" aria-hidden="true"></div>
                    <div class="strength-bar" aria-hidden="true"></div>
                    <div class="strength-bar" aria-hidden="true"></div>
                  </div>
                  <div class="strength-text" id="strengthText"></div>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="reg-confirm">تأكيد كلمة المرور</label>
                <div class="input-wrapper">
                  <input type="password" id="reg-confirm" class="form-input" 
                         placeholder="********" 
                         autocomplete="off" required>
                  <button type="button" class="password-toggle" id="toggleConfirm" aria-label="إظهار كلمة المرور">👁</button>
                </div>
              </div>

              <button type="submit" class="btn-primary" id="signupBtn">
                <span aria-hidden="true">✨</span>
                <span>إنشاء حساب</span>
              </button>
            </form>

            <div class="divider"><span>أو سجل باستخدام</span></div>

            <div class="social-buttons">
              <button type="button" class="social-btn google" id="googleBtn" aria-label="تسجيل بحساب Google">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              </button>
              <button type="button" class="social-btn facebook" aria-label="تسجيل بحساب Facebook">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </button>
              <button type="button" class="social-btn twitter" aria-label="تسجيل بحساب Twitter">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </button>
            </div>

            <div class="form-footer">
              <p class="footer-text">
                لديك حساب بالفعل؟ <a href="/login" class="footer-link" data-link="/login">تسجيل الدخول</a>
              </p>
              <p class="terms-text">
                بالمتابعة، أنت توافق على <a href="/policy" data-link="/policy">شروط الخدمة</a> و <a href="/policy" data-link="/policy">سياسة الخصوصية</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // ─── 6. Initialize Animation ──────────────────────────────────────────────
  const sakura = createSakuraCanvas();

  // ─── 7. DOM Cache ─────────────────────────────────────────────────────────
  const $ = (sel) => root.querySelector(sel);
  const nameInput = $('#reg-name');
  const emailInput = $('#reg-email');
  const passwordInput = $('#reg-password');
  const confirmInput = $('#reg-confirm');
  const signupBtn = $('#signupBtn');
  const googleBtn = $('#googleBtn');
  const alertBox = $('#alertBox');
  const togglePasswordBtn = $('#togglePassword');
  const toggleConfirmBtn = $('#toggleConfirm');
  const strengthMeter = $('#strengthMeter');
  const strengthBars = strengthMeter?.querySelectorAll('.strength-bar');
  const strengthText = $('#strengthText');
  const form = $('#registerForm');

  const origSignup = signupBtn?.innerHTML || '';
  const origGoogle = googleBtn?.innerHTML || '';
  let alertTimer = null;
  let isSubmitting = false;

  // ─── 8. Helper Functions ───────────────────────────────────────────────────
  function showAlert(msg, type = 'error') {
    if (!alertBox) return;
    const icon = type === 'error' ? '⚠️' : '✅';
    alertBox.innerHTML = `<span class="alert-icon" aria-hidden="true">${icon}</span><span>${msg}</span>`;
    alertBox.className = `alert-box alert-${type}`;
    alertBox.style.display = 'flex';
    clearTimeout(alertTimer);
    if (type === 'success') {
      alertTimer = setTimeout(() => { alertBox.style.display = 'none'; }, 5000);
    }
  }

  function hideAlert() {
    if (alertBox) alertBox.style.display = 'none';
    clearTimeout(alertTimer);
  }

  function setLoading(btn, loading, originalHtml) {
    if (!btn) return;
    btn.disabled = loading;
    btn.innerHTML = loading ? `<div class="spinner" aria-label="جاري التحميل"></div><span>جاري التحميل...</span>` : originalHtml;
  }

  function checkPasswordStrength(pwd) {
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  }

  const strengthColors = ['', '#ef4444', '#f59e0b', '#eab308', '#22c55e'];
  const strengthTexts = ['', 'ضعيفة جداً', 'ضعيفة', 'متوسطة', 'قوية'];

  function handleError(error) {
    if (typeof error === 'object' && error !== null) {
      if (error.error) return error.error;
      if (error.message) return error.message;
      if (error.code) {
        const messages = {
          'auth/email-already-in-use': 'البريد الإلكتروني مستخدم بالفعل',
          'auth/weak-password': 'كلمة المرور ضعيفة جداً',
          'auth/invalid-email': 'بريد إلكتروني غير صالح',
          'auth/too-many-requests': 'محاولات كثيرة، حاول لاحقاً',
          'auth/popup-closed-by-user': 'تم إغلاق النافذة المنبثقة',
          'auth/popup-blocked': 'النافذة محظورة من المتصفح',
          'auth/network-request-failed': 'فشل الاتصال بالشبكة'
        };
        return messages[error.code] || `خطأ: ${error.code}`;
      }
    }
    if (typeof error === 'string') return error;
    return 'فشل إنشاء الحساب';
  }

  async function handleSuccess() {
    showAlert('تم إنشاء الحساب بنجاح! جاري التوجيه...', 'success');
    await new Promise(r => setTimeout(r, 1200));
    go('/');
  }

  function validateForm() {
    const name = nameInput?.value.trim() || '';
    const email = emailInput?.value.trim() || '';
    const password = passwordInput?.value || '';
    const confirm = confirmInput?.value || '';

    if (!name || !email || !password || !confirm) {
      showAlert('يرجى ملء جميع الحقول');
      return null;
    }

    if (name.length < 3) {
      showAlert('الاسم يجب أن يكون 3 أحرف على الأقل');
      nameInput?.focus();
      return null;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert('بريد إلكتروني غير صالح');
      emailInput?.focus();
      return null;
    }

    if (password.length < 6) {
      showAlert('كلمة المرور 6 أحرف على الأقل');
      passwordInput?.focus();
      return null;
    }

    if (password !== confirm) {
      showAlert('كلمات المرور غير متطابقة');
      confirmInput?.focus();
      return null;
    }

    return { name, email, password };
  }

  // ─── 9. Event Listeners ───────────────────────────────────────────────────
  function setupPasswordToggle(btn, input) {
    if (!btn || !input) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      btn.textContent = isPass ? '🙈' : '👁';
      btn.setAttribute('aria-label', isPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
    });
  }

  setupPasswordToggle(togglePasswordBtn, passwordInput);
  setupPasswordToggle(toggleConfirmBtn, confirmInput);

  // Sanitize name input
  nameInput?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^a-zA-Z0-9\u0621-\u064A_ ]/g, '').slice(0, 20);
    hideAlert();
  });

  [emailInput, passwordInput, confirmInput].forEach((input) => {
    input?.addEventListener('input', hideAlert);
  });

  passwordInput?.addEventListener('input', () => {
    const pwd = passwordInput.value;
    const score = checkPasswordStrength(pwd);
    
    if (pwd.length > 0) {
      strengthMeter.style.display = 'block';
      strengthBars?.forEach((bar, i) => {
        bar.style.background = i < score ? strengthColors[score] : 'rgba(255,255,255,0.1)';
      });
      strengthText.textContent = strengthTexts[score];
      strengthText.style.color = strengthColors[score];
    } else {
      strengthMeter.style.display = 'none';
    }
  });

  // Rate limiting
  let lastSubmitTime = 0;
  const MIN_SUBMIT_INTERVAL = 2000;

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const now = Date.now();
    if (now - lastSubmitTime < MIN_SUBMIT_INTERVAL) {
      showAlert('يرجى الانتظار قليلاً قبل المحاولة مرة أخرى');
      return;
    }
    
    if (isSubmitting) return;

    const data = validateForm();
    if (!data) return;

    isSubmitting = true;
    lastSubmitTime = now;
    setLoading(signupBtn, true, origSignup);
    hideAlert();

    try {
      const result = await register(data.email, data.password, data.name);

      if (result?.success) {
        await handleSuccess();
        return;
      }

      showAlert(handleError(result));
      setLoading(signupBtn, false, origSignup);
      isSubmitting = false;

    } catch (error) {
      console.error('[Register] Submit error:', error);
      showAlert(handleError(error));
      setLoading(signupBtn, false, origSignup);
      isSubmitting = false;
    }
  });

  googleBtn?.addEventListener('click', async () => {
    if (isSubmitting) return;

    hideAlert();
    isSubmitting = true;
    setLoading(googleBtn, true, origGoogle);

    try {
      const result = await loginWithGoogle();

      if (result?.success) {
        await handleSuccess();
        return;
      }

      showAlert(handleError(result));
      setLoading(googleBtn, false, origGoogle);
      isSubmitting = false;

    } catch (error) {
      console.error('[Register] Google error:', error);
      showAlert(handleError(error));
      setLoading(googleBtn, false, origGoogle);
      isSubmitting = false;
    }
  });

  // ─── 10. Navigation Handler ───────────────────────────────────────────────
  const navHandler = (e) => {
    const link = e.target.closest('[data-link]');
    if (link) {
      e.preventDefault();
      const path = link.getAttribute('data-link');
      if (path) go(path);
    }
  };
  root.addEventListener('click', navHandler);
  cleanupFns.push(() => root.removeEventListener('click', navHandler));

  // ─── 11. Keyboard Navigation ──────────────────────────────────────────────
  const keyHandler = (e) => {
    if (e.key === 'Escape') hideAlert();
  };
  root.addEventListener('keydown', keyHandler);
  cleanupFns.push(() => root.removeEventListener('keydown', keyHandler));

  // ─── 12. Cleanup ───────────────────────────────────────────────────────────
  const runCleanup = () => {
    clearTimeout(alertTimer);
    if (sakura) sakura.destroy();
    for (const fn of cleanupFns) { try { fn(); } catch {} }
  };

  if (typeof onCleanup === 'function') {
    onCleanup(runCleanup);
  } else {
    window.addEventListener('beforeunload', runCleanup, { once: true });
  }
}