// pages/chat.js
// ✅ FIXED: Using centralized auth system from /api/auth.js

const AI_WORKER_URL = "https://hidden-feather-4c06.ziadzozonn.workers.dev/";
const AI_SENDER = {
  name: "Oraa AI",
  avatar: "ai_avatar.png",
  role: "AI",
  verifyIcon: "admin_verify.png",
  currentFrame: "",
};

// XSS-safe text escaping - uses DOM-based approach
const _escDiv = document.createElement("div");
function esc(t) {
  _escDiv.textContent = t ?? "";
  return _escDiv.innerHTML;
}

// Escape for use in inline event handler attributes (onclick="...")
function escAttr(s) {
  return esc(s).replace(/'/g, "&#39;").replace(/`/g, "&#96;");
}

// Client-side rate limiter for AI chat
const _aiRateLimit = { lastSent: 0, count: 0, windowStart: Date.now(), maxPerMin: 10 };
function canSendAIMessage() {
  const now = Date.now();
  if (now - _aiRateLimit.windowStart > 60000) {
    _aiRateLimit.count = 0;
    _aiRateLimit.windowStart = now;
  }
  if (_aiRateLimit.count >= _aiRateLimit.maxPerMin) return false;
  _aiRateLimit.count++;
  return true;
}

// Sanitize user input to prevent prompt injection
function sanitizeAIInput(text) {
  if (!text || typeof text !== 'string') return '';
  // Limit message length
  let sanitized = text.slice(0, 2000);
  // Remove common injection patterns
  sanitized = sanitized.replace(/(?:ignore\s+(?:all\s+)?(?:previous|above|earlier)\s+(?:instructions?|prompts?|rules?|directions?|constraints?))/gi, '');
  sanitized = sanitized.replace(/(?:system\s*[:：]|assistant\s*[:：]|user\s*[:：])/gi, '');
  sanitized = sanitized.replace(/(?:you\s+are\s+now|act\s+as|pretend\s+(?:to\s+be|you're)|roleplay\s+as)/gi, '');
  sanitized = sanitized.replace(/```[\s\S]*?```/g, '[code block removed]');
  return sanitized.trim();
}

function roleClass(r) {
  if (r === "Admin Root") return "rank-admin";
  if (r === "Admin" || r === "Manager") return "rank-mgr";
  if (r === "VIP") return "rank-vip";
  if (r === "AI") return "rank-admin";
  return "rank-user";
}

function fmtTime(d) {
  const ts = d?.time;
  let dt;
  if (ts && typeof ts.toDate === "function") dt = ts.toDate();
  else if (typeof d?.clientCreatedAt === "number") dt = new Date(d.clientCreatedAt);
  else return "الآن";
  return `${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
}

function sortTime(d) {
  if (typeof d?.clientCreatedAt === "number") return d.clientCreatedAt;
  const ts = d?.time;
  if (ts && typeof ts.toMillis === "function") return ts.toMillis();
  if (ts && typeof ts.seconds === "number") {
    return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
  }
  return 0;
}

function nearBottom(c) {
  return c.scrollHeight - c.scrollTop - c.clientHeight < 120;
}

function scrollAnchor(c) {
  const top = c.scrollTop;
  const ch = [...c.children].find((el) => el.offsetTop + el.offsetHeight > top + 1);
  return ch ? { id: ch.id, offset: ch.offsetTop - top } : null;
}

const _AR_MON = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function dateLabel(ts) {
  if (!ts) return "اليوم";
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = today - msg;
  if (diff === 0) return "اليوم";
  if (diff === 86400000) return "أمس";
  return `${d.getDate()} ${_AR_MON[d.getMonth()]} ${d.getFullYear()}`;
}

function isDesktop() {
  return window.innerWidth >= 1024;
}

function injectStylesOnce() {
  if (document.getElementById("chat-page-styles")) return;

  const style = document.createElement("style");
  style.id = "chat-page-styles";
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Changa:wght@300;500;700;900&display=swap');

    .chat-page {
      direction: rtl;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      color: #fff;
      position: relative;
      overflow: hidden;
      background:
        linear-gradient(160deg, #0F2854 0%, #0a1a3a 40%, #1C4D8D 70%, #0d2248 100%);
      font-family: 'Cairo', sans-serif;
      isolation: isolate;
    }

    .chat-page * {
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
      font-family: inherit;
    }

    .chat-page .animated-bg {
      position: fixed;
      inset: 0;
      z-index: -2;
      background:
        linear-gradient(160deg, #0F2854 0%, #0a1a3a 40%, #1C4D8D 70%, #0d2248 100%);
    }

    .chat-page .pixel-container {
      position: fixed;
      inset: 0;
      z-index: -1;
      overflow: hidden;
      pointer-events: none;
      display: none;
    }

    .chat-page .pixel {
      position: absolute;
      background: rgba(189,232,245,.1);
      bottom: -150px;
      border-radius: 4px;
      animation: floatUp 30s linear infinite;
      will-change: transform;
    }

    .chat-page .pixel:nth-child(1){left:10%;width:40px;height:40px;animation-delay:0s;opacity:.3}
    .chat-page .pixel:nth-child(2){left:40%;width:25px;height:25px;animation-delay:8s}
    .chat-page .pixel:nth-child(3){left:70%;width:35px;height:35px;animation-delay:15s;opacity:.25}

    @keyframes floatUp {
      0%{transform:translateY(0) rotate(0deg);opacity:0}
      10%{opacity:.3}
      90%{opacity:.3}
      100%{transform:translateY(-1100px) rotate(360deg);opacity:0}
    }

    .chat-page .private-alert-host{
      position:fixed;
      top:calc(env(safe-area-inset-top,0px) + 70px);
      left:10px;
      right:10px;
      z-index:3000;
      display:flex;
      flex-direction:column;
      gap:8px;
      pointer-events:none;
    }

    .chat-page .private-alert{
      pointer-events:none;
      background:linear-gradient(135deg,rgba(150,20,20,.95),rgba(100,10,10,.95));
      border:1px solid rgba(255,100,100,.2);
      color:#fff;
      border-radius:16px;
      padding:14px 16px;
      box-shadow:0 10px 35px rgba(0,0,0,.4);
      animation: alertIn .3s cubic-bezier(.4,0,.2,1);
    }

    .chat-page .private-alert .t1{
      font-family:'Changa';
      font-weight:900;
      font-size:.9rem;
      margin-bottom:4px;
    }

    .chat-page .private-alert .t2{
      font-size:.85rem;
      line-height:1.5;
      opacity:.9;
    }

    @keyframes alertIn{
      from{opacity:0;transform:translateY(-15px) scale(.95)}
      to{opacity:1;transform:translateY(0) scale(1)}
    }

    .chat-page .nav-sidebar-overlay{
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.6);
      z-index:1599;
      opacity:0;
      visibility:hidden;
      transition:.3s;
      backdrop-filter:blur(4px);
    }
    .chat-page .nav-sidebar-overlay.show{opacity:1;visibility:visible}

    .chat-page .nav-sidebar{
      position:fixed;
      top:0;
      right:-100%;
      width:270px;
      height:100%;
      background:rgba(8,20,50,.95);
      backdrop-filter:blur(25px);
      -webkit-backdrop-filter:blur(25px);
      z-index:1600;
      transition:right .35s cubic-bezier(.4,0,.2,1);
      overflow-y:auto;
      border-left:1px solid #FFCA28;
      box-shadow:-5px 0 25px rgba(0,0,0,.5);
      display:flex;
      flex-direction:column;
    }
    .chat-page .nav-sidebar.open{right:0}

    .chat-page .nav-sidebar-header{
      padding:1.5rem 1rem;
      background:linear-gradient(180deg,#1C4D8D,rgba(28,77,141,.8));
      color:#fff;
      display:flex;
      justify-content:space-between;
      align-items:center;
      border-bottom:1px solid rgba(255,255,255,.1);
      flex-shrink:0;
    }
    .chat-page .nav-sidebar-header h2{
      font-size:1.1rem;
      font-weight:800;
      font-family:'Changa';
    }

    .chat-page .nav-sidebar-close{
      background:none;
      border:none;
      color:#fff;
      cursor:pointer;
      padding:4px;
      border-radius:8px;
      transition:.2s;
    }
    .chat-page .nav-sidebar-close:hover{background:rgba(255,255,255,.1)}
    .chat-page .nav-sidebar-close svg{width:22px;height:22px}

    .chat-page .nav-sidebar-link{
      display:flex;
      align-items:center;
      gap:10px;
      padding:12px 1rem;
      color:rgba(255,255,255,.8);
      text-decoration:none;
      font-weight:600;
      font-size:.9rem;
      transition:all .25s;
      border-right:3px solid transparent;
    }
    .chat-page .nav-sidebar-link:hover{
      background:rgba(255,202,40,.08);
      color:#FFCA28;
      padding-right:1.5rem;
      border-right-color:#FFCA28;
    }
    .chat-page .nav-sidebar-link.active-page{background:rgba(255,202,40,.12);color:#FFCA28;font-weight:800}
    .chat-page .nav-sidebar-link svg{width:20px;height:20px;color:#FFCA28;stroke-width:1.8}

    .chat-page .nav-brand{display:none}
    .chat-page .nav-user-card{display:none}
    .chat-page .nav-section-title{display:none}
    .chat-page .nav-spacer{flex:1}

    .chat-page .sidebar{
      position:fixed;
      top:0;
      bottom:0;
      right:0;
      width:280px;
      background:rgba(8,20,45,.92);
      backdrop-filter:blur(30px);
      -webkit-backdrop-filter:blur(30px);
      z-index:1500;
      transform:translateX(100%);
      transition:transform .35s cubic-bezier(.4,0,.2,1);
      border-left:1px solid rgba(189,232,245,.2);
      display:flex;
      flex-direction:column;
      box-shadow:-5px 0 30px rgba(0,0,0,.4);
    }
    .chat-page .sidebar.active{transform:translateX(0)}

    .chat-page .sb-overlay{
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.7);
      z-index:1400;
      display:none;
      opacity:0;
      transition:opacity .3s;
      backdrop-filter:blur(3px);
    }
    .chat-page .sb-overlay.active{display:block;opacity:1}

    .chat-page .sb-header{
      padding:16px;
      font-weight:800;
      font-family:'Changa';
      color:#FFCA28;
      border-bottom:1px solid rgba(189,232,245,.15);
      display:flex;
      align-items:center;
      gap:10px;
      flex-shrink:0;
      font-size:.95rem;
      background:rgba(15,40,84,.3);
    }

    .chat-page .sb-list{
      flex:1;
      overflow-y:auto;
      padding:10px;
    }
    .chat-page .sb-list::-webkit-scrollbar{width:3px}
    .chat-page .sb-list::-webkit-scrollbar-thumb{background:#4988C4;border-radius:10px}

    .chat-page .usr-item{
      display:flex;
      align-items:center;
      gap:12px;
      padding:10px;
      border-radius:12px;
      margin-bottom:5px;
      transition:all .2s;
      cursor:pointer;
    }
    .chat-page .usr-item:hover{background:rgba(255,255,255,.04)}
    .chat-page .usr-item:active{background:rgba(255,255,255,.06);transform:scale(.98)}
    .chat-page .usr-av{
      width:40px;
      height:40px;
      border-radius:50%;
      object-fit:cover;
      border:2px solid #4988C4;
      transition:border-color .2s;
    }
    .chat-page .usr-item:hover .usr-av{border-color:#FFCA28}
    .chat-page .usr-info{flex:1;min-width:0}
    .chat-page .usr-name{font-size:.9rem;font-weight:700}
    .chat-page .usr-role{font-size:.7rem;color:#888}

    .chat-page .app-header{
      flex-shrink:0;
      position:relative;
      background:rgba(10,28,60,.5);
      backdrop-filter:blur(25px);
      -webkit-backdrop-filter:blur(25px);
      border-bottom:1px solid rgba(189,232,245,.2);
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:0 12px;
      height:62px;
      box-shadow:0 8px 30px rgba(0,0,0,.25);
      z-index:1000;
    }

    .chat-page .header-left{
      display:flex;
      align-items:center;
      gap:10px;
      z-index:2;
      min-width:0;
      flex:1;
    }
    .chat-page .header-right{
      display:flex;
      align-items:center;
      gap:8px;
      z-index:2;
    }

    .chat-page .header-btn{
      width:40px;
      height:40px;
      border-radius:12px;
      background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.1);
      display:flex;
      align-items:center;
      justify-content:center;
      color:#BDE8F5;
      cursor:pointer;
      transition:all .25s;
      font-size:1rem;
      flex-shrink:0;
    }
    .chat-page .header-btn:active{transform:scale(.92);background:rgba(255,202,40,.2);color:#FFCA28}
    .chat-page .header-btn:hover{background:rgba(255,255,255,.12)}
    .chat-page .header-btn svg,.chat-page .header-btn i{width:22px;height:22px;stroke-width:2}

    .chat-page .brand-mini{display:flex;align-items:center;text-decoration:none;flex-shrink:0}
    .chat-page .brand-mini-logo{
      width:34px;height:34px;border-radius:8px;object-fit:cover;background:#BDE8F5;box-shadow:0 2px 8px rgba(0,0,0,.3)
    }

    .chat-page .room-info{display:flex;flex-direction:column;min-width:0}
    .chat-page .room-info h2{
      font-family:'Changa';
      font-weight:900;
      font-size:1.1rem;
      color:#fff;
      text-shadow:0 2px 8px rgba(0,0,0,.4);
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .chat-page .room-status{
      font-size:.65rem;
      color:#00D4AA;
      display:flex;
      align-items:center;
      gap:5px;
      margin-top:3px;
      background:rgba(0,212,170,.15);
      padding:2px 8px;
      border-radius:12px;
      width:fit-content;
      border:1px solid rgba(0,212,170,.3);
      font-weight:700;
    }
    .chat-page .dot-online{
      width:6px;height:6px;background:#00D4AA;border-radius:50%;
      animation:pulse 2s infinite
    }
    @keyframes pulse{
      0%{box-shadow:0 0 0 0 rgba(0,212,170,.7)}
      70%{box-shadow:0 0 0 6px rgba(0,212,170,0)}
      100%{box-shadow:0 0 0 0 rgba(0,212,170,0)}
    }

    .chat-page .header-avatar-link{
      width:34px;height:34px;border-radius:50%;overflow:hidden;
      border:2px solid #FFCA28;flex-shrink:0;display:block;box-shadow:0 0 10px rgba(255,202,40,.3)
    }
    .chat-page .header-avatar-link img{width:100%;height:100%;object-fit:cover}

    .chat-page .layout-wrapper{
      flex:1;
      position:relative;
      overflow:hidden;
      min-height:0;
    }

    .chat-page .chat-shell{
      height:100%;
      display:flex;
      flex-direction:column;
      overflow:hidden;
      min-height:0;
    }

    .chat-page #msg-container{
      flex:1;
      overflow-y:auto;
      padding:15px;
      display:flex;
      flex-direction:column;
      gap:12px;
      scroll-behavior:smooth;
      padding-bottom:10px;
      min-height:0;
    }

    .chat-page #msg-container::-webkit-scrollbar{width:4px}
    .chat-page #msg-container::-webkit-scrollbar-thumb{background:#4988C4;border-radius:10px}
    .chat-page #msg-container::-webkit-scrollbar-track{background:transparent}

    .chat-page .date-separator{
      display:flex;
      align-items:center;
      gap:14px;
      padding:6px 0;
      align-self:center;
      width:100%;
    }
    .chat-page .date-separator::before,
    .chat-page .date-separator::after{
      content:'';
      flex:1;
      height:1px;
      background:linear-gradient(90deg,transparent,rgba(189,232,245,.15),transparent)
    }
    .chat-page .date-separator span{
      font-size:.68rem;
      color:rgba(255,255,255,.55);
      font-weight:700;
      padding:4px 16px;
      background:rgba(15,40,84,.5);
      border-radius:20px;
      border:1px solid rgba(189,232,245,.15);
      white-space:nowrap;
    }

    .chat-page .msg-box{
      display:flex;
      gap:10px;
      max-width:85%;
      animation:msgSlide .3s cubic-bezier(.4,0,.2,1);
      position:relative;
    }
    .chat-page .msg-box.me{align-self:flex-start;flex-direction:row}
    .chat-page .msg-box.other{align-self:flex-end;flex-direction:row-reverse}
    .chat-page .msg-box.grouped{margin-top:-6px}
    .chat-page .msg-box.grouped .sender-info{visibility:hidden;height:0;overflow:hidden;padding:0}

    @keyframes msgSlide{
      from{opacity:0;transform:translateY(12px) scale(.98)}
      to{opacity:1;transform:translateY(0) scale(1)}
    }

    .chat-page .av-wrapper{
      position:relative;
      width:40px;
      height:40px;
      flex-shrink:0;
      cursor:pointer;
      align-self:flex-end;
    }
    .chat-page .av-img{
      width:100%;
      height:100%;
      border-radius:50%;
      border:2px solid #4988C4;
      object-fit:cover;
      position:relative;
      z-index:1;
      transition:border-color .2s
    }
    .chat-page .msg-box:hover .av-img{border-color:#FFCA28}
    .chat-page .frame-img{
      position:absolute;
      inset:-18%;
      width:136%;
      height:136%;
      z-index:2;
      pointer-events:none;
      filter:drop-shadow(0 0 4px #FFCA28)
    }
    .chat-page .vrf-badge{
      position:absolute;
      bottom:-2px;
      right:-2px;
      width:16px;
      height:16px;
      z-index:3;
      background:#fff;
      border-radius:50%;
      padding:1px;
      box-shadow:0 2px 5px rgba(0,0,0,.3)
    }
    .chat-page .msg-box.other .vrf-badge{right:auto;left:-2px}

    .chat-page .bubble-wrap{
      display:flex;
      flex-direction:column;
      gap:4px;
      flex:1;
      min-width:0;
    }

    .chat-page .sender-info{
      display:flex;
      align-items:center;
      gap:8px;
      padding:0 6px;
      height:18px;
      transition:height .2s;
    }
    .chat-page .msg-box.me .sender-info{justify-content:flex-start}
    .chat-page .msg-box.other .sender-info{justify-content:flex-end;direction:ltr}

    .chat-page .s-name{
      font-weight:800;
      font-family:'Changa';
      font-size:.85rem;
    }
    .chat-page .s-time{
      font-size:.65rem;
      color:rgba(255,255,255,.4);
      direction:ltr;
      transition:color .2s;
    }
    .chat-page .msg-box:hover .s-time{color:rgba(255,255,255,.7)}

    .chat-page .bubble{
      background:rgba(15,40,84,.6);
      backdrop-filter:blur(10px);
      -webkit-backdrop-filter:blur(10px);
      padding:12px 16px;
      border-radius:20px;
      border:1px solid rgba(189,232,245,.15);
      position:relative;
      box-shadow:0 4px 15px rgba(0,0,0,.15);
      word-wrap:break-word;
      min-width:50px;
      transition:border-color .2s,box-shadow .2s;
    }
    .chat-page .bubble:hover{border-color:rgba(189,232,245,.25);box-shadow:0 6px 20px rgba(0,0,0,.25)}
    .chat-page .msg-box.me .bubble{background:linear-gradient(135deg,#1C4D8D,#0F2854);border-bottom-right-radius:4px}
    .chat-page .msg-box.other .bubble{background:rgba(15,40,84,.45);border-bottom-left-radius:4px}
    .chat-page .msg-box.ai .bubble{
      background:linear-gradient(135deg,rgba(255,202,40,.15),rgba(255,143,0,.1));
      border:1px solid rgba(255,202,40,.4);
      box-shadow:0 0 20px rgba(255,202,40,.08)
    }
    .chat-page .msg-box.ai .s-name{color:#FFCA28;text-shadow:0 0 10px rgba(255,202,40,.5)}

    .chat-page .txt{
      font-size:.95rem;
      line-height:1.65;
      color:#fff;
      word-break:break-word;
      text-align:right;
    }

    .chat-page .sticker-img{
      max-width:140px;
      border-radius:12px;
      transition:transform .2s;
    }
    .chat-page .sticker-img:hover{transform:scale(1.05)}

    .chat-page .mention{
      color:#FFCA28;
      font-weight:800;
      background:rgba(255,202,40,.15);
      padding:2px 6px;
      border-radius:6px;
      cursor:pointer;
      border:1px solid rgba(255,202,40,.3);
      transition:all .2s;
    }
    .chat-page .mention:hover{background:rgba(255,202,40,.25)}

    .chat-page .rank-admin{color:#FF4B4B}
    .chat-page .rank-mgr{color:#A78BFA}
    .chat-page .rank-vip{color:#FFD700}
    .chat-page .rank-user{color:#00D4AA}

    .chat-page .del-btn{
      position:absolute;
      top:-10px;
      left:-10px;
      background:#FF4B4B;
      color:#fff;
      width:24px;
      height:24px;
      border-radius:50%;
      border:2px solid #050508;
      cursor:pointer;
      opacity:0;
      transition:all .2s;
      z-index:10;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:.7rem;
      box-shadow:0 2px 8px rgba(0,0,0,.5);
      transform:scale(.8);
    }
    .chat-page .msg-box.me .del-btn{left:auto;right:-10px}
    .chat-page .bubble:hover .del-btn{opacity:1;transform:scale(1)}
    .chat-page .del-btn:hover{background:#ff2d2d;transform:scale(1.15)!important}

    .chat-page .input-zone{
      flex-shrink:0;
      background:rgba(10,28,60,.6);
      backdrop-filter:blur(25px);
      -webkit-backdrop-filter:blur(25px);
      border-top:1px solid rgba(189,232,245,.2);
      display:flex;
      align-items:center;
      gap:10px;
      padding:10px 15px;
      height:68px;
      position:relative;
    }

    .chat-page .input-wrap{
      flex:1;
      position:relative;
      height:48px;
    }

    .chat-page .input-fld{
      width:100%;
      height:100%;
      background:rgba(15,40,84,.5);
      border:1px solid rgba(189,232,245,.15);
      border-radius:25px;
      padding:0 55px 0 20px;
      color:#fff;
      font-size:1rem;
      outline:none;
      transition:all .3s;
    }
    .chat-page .input-fld:focus{
      border-color:#FFCA28;
      box-shadow:0 0 0 3px rgba(255,202,40,.15);
      background:rgba(15,40,84,.7)
    }
    .chat-page .input-fld::placeholder{color:rgba(189,232,245,.35)}

    .chat-page .char-counter{
      position:absolute;
      left:14px;
      top:50%;
      transform:translateY(-50%);
      font-size:.6rem;
      color:rgba(189,232,245,.3);
      pointer-events:none;
      direction:ltr;
      font-weight:600;
      transition:all .25s;
      opacity:0;
    }
    .chat-page .char-counter.visible{opacity:1}
    .chat-page .char-counter.warning{color:#ff6b6b}

    .chat-page .icon-btn{
      width:48px;
      height:48px;
      border-radius:50%;
      background:rgba(255,255,255,.06);
      border:1px solid rgba(189,232,245,.15);
      color:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      font-size:1.2rem;
      transition:all .25s;
      flex-shrink:0;
    }
    .chat-page .icon-btn:active{transform:scale(.88)}
    .chat-page .icon-btn:hover{background:rgba(255,255,255,.1)}
    .chat-page .btn-send{
      background:linear-gradient(135deg,#1C4D8D,#4988C4);
      box-shadow:0 4px 15px rgba(28,77,141,.4)
    }
    .chat-page .btn-send:hover{
      box-shadow:0 6px 20px rgba(28,77,141,.6);
      transform:scale(1.05)
    }
    .chat-page .btn-send:active{transform:scale(.9)}

    .chat-page .mention-list{
      position:absolute;
      bottom:100%;
      left:0;
      right:0;
      background:rgba(15,40,84,.98);
      border:1px solid rgba(189,232,245,.15);
      border-radius:16px 16px 0 0;
      margin-bottom:5px;
      display:none;
      flex-direction:column;
      max-height:200px;
      overflow-y:auto;
      backdrop-filter:blur(15px);
      z-index:100;
      box-shadow:0 -10px 30px rgba(0,0,0,.3);
    }
    .chat-page .mention-list.active{display:flex}
    .chat-page .mention-list::-webkit-scrollbar{width:3px}
    .chat-page .mention-list::-webkit-scrollbar-thumb{background:#4988C4;border-radius:10px}
    .chat-page .mention-item{
      display:flex;
      align-items:center;
      gap:12px;
      padding:12px 20px;
      cursor:pointer;
      border-bottom:1px solid rgba(255,255,255,.04);
      transition:.2s;
    }
    .chat-page .mention-item:hover{background:rgba(255,202,40,.1)}
    .chat-page .mention-item:last-child{border-bottom:none}
    .chat-page .mention-item img{width:32px;height:32px;border-radius:50%;border:1px solid #FFCA28}

    .chat-page .main-nav{
      flex-shrink:0;
      height:68px;
      background:rgba(10,28,60,.6);
      backdrop-filter:blur(25px);
      -webkit-backdrop-filter:blur(25px);
      display:flex;
      align-items:center;
      justify-content:space-around;
      border-top:1px solid rgba(189,232,245,.2);
      box-shadow:0 -8px 25px rgba(0,0,0,.3);
    }

    .chat-page .nav-item{
      flex:1;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:3px;
      padding:6px 0;
      text-decoration:none;
      color:rgba(255,255,255,.45);
      transition:all .3s;
      position:relative;
    }
    .chat-page .nav-item.active{color:#FFCA28}
    .chat-page .nav-item.active::before{
      content:'';
      position:absolute;
      top:-1px;
      width:26px;
      height:3px;
      background:#FFCA28;
      border-radius:0 0 4px 4px;
      box-shadow:0 0 12px #FFCA28
    }
    .chat-page .nav-item.active svg{
      filter:drop-shadow(0 0 6px rgba(255,202,40,.5));
      transform:scale(1.1)
    }
    .chat-page .nav-item:not(.active):hover{color:rgba(255,255,255,.65)}
    .chat-page .nav-icon-wrap{
      width:44px;
      height:30px;
      display:flex;
      align-items:center;
      justify-content:center
    }
    .chat-page .nav-item svg{
      width:24px;
      height:24px;
      transition:all .2s;
      stroke-width:1.8
    }
    .chat-page .nav-label{font-size:.6rem;font-weight:700}

    .chat-page #global-typing{
      padding:5px 20px;
      font-size:.85rem;
      color:#BDE8F5;
      display:none;
      align-items:center;
      gap:10px;
      height:30px;
      font-weight:700;
    }
    .chat-page #global-typing.active{display:flex}
    .chat-page .typing-dots{
      display:flex;
      gap:4px;
      direction:ltr
    }
    .chat-page .typing-dots span{
      width:6px;
      height:6px;
      background:#FFCA28;
      border-radius:50%;
      animation:bounce 1.4s infinite ease-in-out
    }
    .chat-page .typing-dots span:nth-child(1){animation-delay:-.32s}
    .chat-page .typing-dots span:nth-child(2){animation-delay:-.16s}
    @keyframes bounce{
      0%,80%,100%{transform:scale(0)}
      40%{transform:scale(1);box-shadow:0 0 5px #FFCA28}
    }
    .chat-page .typing-indicator{
      display:flex;
      gap:3px;
      padding:5px;
      direction:ltr;
    }
    .chat-page .typing-dot{
      width:6px;
      height:6px;
      background:#fff;
      border-radius:50%;
      animation:bounce 1.4s infinite ease-in-out both
    }
    .chat-page .msg-box.ai .typing-dot{background:#FFCA28}
    .chat-page .typing-dot:nth-child(1){animation-delay:-.32s}
    .chat-page .typing-dot:nth-child(2){animation-delay:-.16s}

    .chat-page .overlay-bg,
    .chat-page .sticker-overlay{
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.85);
      backdrop-filter:blur(8px);
      z-index:2000;
      display:none;
      align-items:center;
      justify-content:center;
      padding:20px;
      opacity:0;
      transition:opacity .25s;
    }
    .chat-page .overlay-bg.active,
    .chat-page .sticker-overlay.active{
      display:flex;
      opacity:1
    }

    .chat-page .prof-card{
      background:linear-gradient(180deg,#0F2854,rgba(5,5,8,.98));
      width:100%;
      max-width:340px;
      border-radius:24px;
      overflow:hidden;
      text-align:center;
      padding-bottom:25px;
      border:1px solid rgba(189,232,245,.15);
      box-shadow:0 20px 60px rgba(0,0,0,.5);
      transform:scale(.88) translateY(20px);
      transition:all .35s cubic-bezier(.4,0,.2,1)
    }
    .chat-page .overlay-bg.active .prof-card{transform:scale(1) translateY(0)}

    .chat-page .p-banner{
      height:100px;
      background:linear-gradient(135deg,#1C4D8D,#4988C4);
      position:relative;
      overflow:hidden
    }
    .chat-page .p-banner::after{
      content:'';
      position:absolute;
      bottom:0;
      left:0;
      right:0;
      height:40px;
      background:linear-gradient(transparent,#0F2854)
    }

    .chat-page .close-x{
      position:absolute;
      top:10px;
      left:10px;
      width:32px;
      height:32px;
      border-radius:50%;
      background:rgba(0,0,0,.6);
      border:1px solid rgba(255,255,255,.1);
      color:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      z-index:10;
      transition:all .2s
    }
    .chat-page .close-x:hover{background:rgba(0,0,0,.8);transform:scale(1.1)}

    .chat-page .p-av-wrapper{
      position:relative;
      width:90px;
      height:90px;
      margin:-45px auto 10px
    }
    .chat-page .p-av{
      width:100%;
      height:100%;
      border-radius:50%;
      border:4px solid #0F2854;
      object-fit:cover;
      position:relative;
      z-index:2;
      box-shadow:0 4px 15px rgba(0,0,0,.3)
    }
    .chat-page .p-frame{
      position:absolute;
      inset:-15%;
      width:130%;
      height:130%;
      z-index:3;
      pointer-events:none
    }
    .chat-page .p-vrf{
      position:absolute;
      bottom:0;
      left:0;
      width:28px;
      height:28px;
      z-index:4
    }
    .chat-page .p-name{
      font-family:'Changa';
      font-size:1.4rem;
      font-weight:900;
      margin:10px 0 5px
    }
    .chat-page .p-role{
      display:inline-flex;
      align-items:center;
      gap:5px;
      padding:4px 14px;
      border-radius:15px;
      font-size:.75rem;
      font-weight:700;
      margin-bottom:12px
    }
    .chat-page .p-role.admin{background:#FF4B4B;color:#fff}
    .chat-page .p-role.mgr{background:#A78BFA;color:#fff}
    .chat-page .p-role.vip{background:#FFD700;color:#000}
    .chat-page .p-role.user{background:#00D4AA;color:#000}
    .chat-page .p-bio{
      color:#aaa;
      font-size:.9rem;
      padding:0 20px;
      line-height:1.6;
      margin-bottom:15px
    }
    .chat-page .p-stats{
      display:flex;
      justify-content:center;
      gap:30px;
      padding:0 20px;
      margin-bottom:15px
    }
    .chat-page .p-stat .val{
      display:block;
      font-size:1.2rem;
      font-weight:900;
      color:#FFCA28;
      font-family:'Changa'
    }
    .chat-page .p-stat .lbl{font-size:.7rem;color:#888}
    .chat-page .p-actions{
      display:flex;
      gap:10px;
      padding:0 20px
    }
    .chat-page .p-btn{
      flex:1;
      padding:12px;
      border-radius:12px;
      border:none;
      font-weight:700;
      cursor:pointer;
      font-family:'Changa';
      font-size:.85rem;
      transition:all .25s
    }
    .chat-page .p-btn:active{transform:scale(.95)}
    .chat-page .p-btn.primary{background:linear-gradient(135deg,#1C4D8D,#4988C4);color:#fff}
    .chat-page .p-btn.secondary{background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(189,232,245,.15)}

    .chat-page .sticker-overlay{align-items:flex-end}
    .chat-page .sticker-panel{
      width:100%;
      height:42vh;
      background:linear-gradient(180deg,#0F2854,rgba(5,5,8,.98));
      border-radius:25px 25px 0 0;
      padding:20px;
      border-top:2px solid rgba(73,136,196,.4);
      transform:translateY(100%);
      transition:transform .35s cubic-bezier(.4,0,.2,1);
      box-shadow:0 -10px 40px rgba(0,0,0,.4)
    }
    .chat-page .sticker-overlay.active .sticker-panel{transform:translateY(0)}
    .chat-page .sticker-header{
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin-bottom:15px
    }
    .chat-page .sticker-header h3{
      font-family:'Changa';
      color:#FFCA28;
      font-size:1.1rem;
      display:flex;
      align-items:center;
      gap:8px
    }
    .chat-page .sticker-grid{
      display:grid;
      grid-template-columns:repeat(4,1fr);
      gap:10px;
      overflow-y:auto;
      height:calc(100% - 50px);
      padding-bottom:10px
    }
    .chat-page .sticker-grid::-webkit-scrollbar{width:3px}
    .chat-page .sticker-grid::-webkit-scrollbar-thumb{background:#4988C4;border-radius:10px}
    .chat-page .sticker-item{
      aspect-ratio:1;
      border-radius:14px;
      background:rgba(255,255,255,.04);
      cursor:pointer;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:8px;
      transition:all .25s;
      border:1px solid transparent
    }
    .chat-page .sticker-item:hover{background:rgba(255,202,40,.08);border-color:rgba(255,202,40,.2);transform:scale(1.05)}
    .chat-page .sticker-item:active{transform:scale(.92);border-color:#FFCA28}
    .chat-page .sticker-item img{max-width:100%;max-height:100%;object-fit:contain}

    .chat-page .scroll-bottom-btn{
      position:absolute;
      bottom:16px;
      left:50%;
      transform:translateX(-50%);
      width:42px;
      height:42px;
      border-radius:50%;
      background:linear-gradient(135deg,#1C4D8D,#0F2854);
      border:1px solid rgba(189,232,245,.15);
      color:#BDE8F5;
      display:none;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      z-index:50;
      box-shadow:0 4px 20px rgba(0,0,0,.4);
      transition:all .25s
    }
    .chat-page .scroll-bottom-btn.visible{display:flex}
    .chat-page .scroll-bottom-btn:active{transform:translateX(-50%) scale(.88)}
    .chat-page .scroll-bottom-btn:hover{box-shadow:0 6px 25px rgba(0,0,0,.5)}
    .chat-page .scroll-bottom-btn i{font-size:1rem}

    .chat-page .chat-loading{
      flex:1;
      display:flex;
      align-items:center;
      justify-content:center;
      flex-direction:column;
      gap:12px;
      color:#BDE8F5
    }
    .chat-page .chat-loading-spinner{
      width:36px;
      height:36px;
      border:3px solid rgba(189,232,245,.15);
      border-top-color:#BDE8F5;
      border-radius:50%;
      animation:spin .7s linear infinite
    }
    @keyframes spin{to{transform:rotate(360deg)}}

    .chat-page .main-nav{
      flex-shrink:0;
      height:68px;
      background:rgba(10,28,60,.6);
      backdrop-filter:blur(25px);
      -webkit-backdrop-filter:blur(25px);
      display:flex;
      align-items:center;
      justify-content:space-around;
      border-top:1px solid rgba(189,232,245,.2);
      box-shadow:0 -8px 25px rgba(0,0,0,.3);
    }

    .chat-page .nav-item{
      flex:1;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:3px;
      padding:6px 0;
      text-decoration:none;
      color:rgba(255,255,255,.45);
      transition:all .3s;
      position:relative
    }
    .chat-page .nav-item.active{color:#FFCA28}
    .chat-page .nav-item.active::before{
      content:'';
      position:absolute;
      top:-1px;
      width:26px;
      height:3px;
      background:#FFCA28;
      border-radius:0 0 4px 4px;
      box-shadow:0 0 12px #FFCA28
    }
    .chat-page .nav-item.active svg{
      filter:drop-shadow(0 0 6px rgba(255,202,40,.5));
      transform:scale(1.1)
    }
    .chat-page .nav-item:not(.active):hover{color:rgba(255,255,255,.65)}
    .chat-page .nav-icon-wrap{
      width:44px;
      height:30px;
      display:flex;
      align-items:center;
      justify-content:center
    }
    .chat-page .nav-item svg{
      width:24px;
      height:24px;
      transition:all .2s;
      stroke-width:1.8
    }
    .chat-page .nav-label{font-size:.6rem;font-weight:700}

    .chat-page .desktop-only{display:none}
    .chat-page .mobile-only{display:flex}

    .chat-page .msg-box.ai .bubble .txt,
    .chat-page .msg-box.ai .bubble{
      color:#fff;
    }

    @media(min-width:768px){
      .chat-page .pixel-container{display:block}
    }

    @media(min-width:1024px){
      .chat-page{
        display:grid;
        grid-template-columns:260px 1fr 280px;
        grid-template-rows:auto 1fr auto;
        grid-template-areas:
          "nav header members"
          "nav chat members"
          "nav input members";
        height:100dvh;
      }

      .chat-page .mobile-only,
      .chat-page .nav-sidebar-overlay,
      .chat-page .sb-overlay,
      .chat-page .main-nav{
        display:none!important;
      }

      .chat-page .desktop-only{display:flex!important}

      .chat-page .nav-sidebar{
        grid-area:nav;
        position:static!important;
        transform:none!important;
        right:auto!important;
        width:100%!important;
        height:100%!important;
        border-left:none!important;
        border-right:1px solid rgba(189,232,245,.2)!important;
        box-shadow:none!important;
        z-index:auto!important;
        overflow:hidden;
      }
      .chat-page .nav-sidebar-header{display:none!important}

      .chat-page .nav-brand{
        display:flex!important;
        align-items:center;
        gap:12px;
        padding:20px 16px;
        border-bottom:1px solid rgba(189,232,245,.15);
        flex-shrink:0;
      }
      .chat-page .nav-brand img{
        width:42px;
        height:42px;
        border-radius:10px;
        object-fit:cover;
        box-shadow:0 2px 8px rgba(0,0,0,.3)
      }
      .chat-page .nav-brand-text{display:flex;flex-direction:column}
      .chat-page .nav-brand-name{
        font-family:'Changa';
        font-weight:900;
        font-size:1.2rem;
        color:#FFCA28;
        text-shadow:0 2px 8px rgba(255,202,40,.2)
      }
      .chat-page .nav-brand-sub{font-size:.65rem;color:rgba(255,255,255,.55);margin-top:1px}

      .chat-page .nav-sidebar nav{
        flex:1;
        padding:8px 0;
        overflow-y:auto
      }
      .chat-page .nav-sidebar nav::-webkit-scrollbar{width:3px}
      .chat-page .nav-sidebar nav::-webkit-scrollbar-thumb{background:#4988C4;border-radius:10px}

      .chat-page .nav-section-title{
        display:block!important;
        padding:12px 20px 6px;
        font-size:.6rem;
        color:rgba(255,255,255,.55);
        font-weight:800;
        letter-spacing:1.5px;
        text-transform:uppercase
      }

      .chat-page .nav-sidebar-link{
        padding:11px 16px;
        margin:1px 8px;
        border-radius:10px;
        border-right:none!important;
        font-size:.88rem;
      }
      .chat-page .nav-sidebar-link:hover{
        background:rgba(255,202,40,.08);
        color:#FFCA28;
        padding-right:16px
      }
      .chat-page .nav-sidebar-link.active-page{
        background:rgba(255,202,40,.12);
        color:#FFCA28;
        font-weight:800
      }

      .chat-page .nav-user-card{
        display:flex!important;
        align-items:center;
        gap:10px;
        padding:14px 16px;
        border-top:1px solid rgba(189,232,245,.15);
        background:rgba(0,0,0,.25);
        flex-shrink:0;
      }
      .chat-page .nav-user-av{
        width:38px;
        height:38px;
        border-radius:50%;
        border:2px solid #FFCA28;
        object-fit:cover;
        box-shadow:0 0 8px rgba(255,202,40,.2)
      }
      .chat-page .nav-user-info{
        display:flex;
        flex-direction:column;
        min-width:0;
        flex:1
      }
      .chat-page .nav-user-name{
        font-weight:700;
        font-size:.85rem;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis
      }
      .chat-page .nav-user-role-text{font-size:.65rem;color:rgba(255,255,255,.55)}
      .chat-page .nav-user-settings{
        width:34px;
        height:34px;
        border-radius:8px;
        background:rgba(255,255,255,.06);
        border:none;
        color:rgba(255,255,255,.7);
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        transition:.2s;
        flex-shrink:0;
      }
      .chat-page .nav-user-settings:hover{background:rgba(255,255,255,.12);color:#FFCA28}

      .chat-page .app-header{grid-area:header}
      .chat-page .layout-wrapper{grid-area:chat}
      .chat-page .input-zone{
        grid-area:input;
        padding:12px 30px;
      }

      .chat-page .sidebar{
        grid-area:members;
        position:static!important;
        transform:none!important;
        width:100%!important;
        height:100%!important;
        box-shadow:none!important;
        border-left:1px solid rgba(189,232,245,.2)!important;
        z-index:auto!important;
        overflow:hidden;
      }
      .chat-page .sb-header{
        padding:20px 16px;
        font-size:1rem;
        background:rgba(15,40,84,.3);
        border-bottom:1px solid rgba(189,232,245,.15);
      }
      .chat-page .sb-list{padding:12px}
      .chat-page .usr-item{padding:10px 12px}
      .chat-page .private-alert-host{top:75px;left:290px;right:310px}
      .chat-page #msg-container{padding:20px 30px;gap:14px}
      .chat-page .msg-box{max-width:70%}
    }

    @media(min-width:1600px){
      .chat-page{grid-template-columns:300px 1fr 320px}
      .chat-page .private-alert-host{left:330px;right:350px}
    }
  `;
  document.head.appendChild(style);
}

function getFirebaseCtx(ctx) {
  const app = initializeApp(firebaseConfig);
  return {
    auth: ctx?.auth || getAuth(app),
    db: ctx?.db || getFirestore(app),
  };
}

export default async function chatPage(ctx) {
  previousCleanup?.();
  injectStylesOnce();

  const root = ctx.root;
  const { auth, db } = getFirebaseCtx(ctx);

  const controller = new AbortController();
  const { signal } = controller;

  let me = null;
  let myLiveState = {};
  let currentProfileUid = null;

  let chatStarted = false;
  let initialLoadDone = false;
  let oldestCursorDoc = null;
  let hasMoreOlder = true;
  let loadingOlder = false;
  let alertsReady = false;
  let typingTimeout = null;
  let mentionTargetUser = null;
  let scrollBtnVisible = false;

  let onlineUsersData = [];
  const latestMessages = new Map();
  const olderMessages = new Map();
  const pendingMessages = new Map();
  const seenAlertIds = new Set();

  let lastMessagesKey = "";
  let lastUsersKey = "";
  let rafScrollUpdate = 0;

  const cleanupFns = [];
  let unsubAuth = null;
  let unsubSelfUser = null;
  let unsubMyLiveState = null;
  let unsubChat = null;
  let unsubUsers = null;
  let unsubAlerts = null;

  const AI_WORKER_URL = "https://hidden-feather-4c06.ziadzozonn.workers.dev/";

  root.innerHTML = `
    <section class="chat-page" id="chatPage">
      <div class="animated-bg"></div>
      <div class="pixel-container">
        <span class="pixel"></span><span class="pixel"></span><span class="pixel"></span>
      </div>

      <div class="private-alert-host" id="alertHost"></div>

      <div class="nav-sidebar-overlay" id="navSidebarOverlay"></div>
      <aside class="nav-sidebar" id="navSidebar">
        <div class="nav-sidebar-header">
          <h2>القائمة</h2>
          <button class="nav-sidebar-close" id="closeNavSidebar" type="button"><i data-lucide="x"></i></button>
        </div>

        <div class="nav-brand desktop-only">
          <img src="oraaic.jpg" alt="Logo" onerror="this.src='https://via.placeholder.com/42'">
          <div class="nav-brand-text">
            <span class="nav-brand-name">Oraa Slayer</span>
            <span class="nav-brand-sub">مجتمع الأنمي</span>
          </div>
        </div>

        <nav>
          <div class="nav-section-title">التنقل</div>
          <a href="/" data-link class="nav-sidebar-link"><i data-lucide="home"></i> الرئيسية</a>
          <a href="/newsanime" data-link class="nav-sidebar-link"><i data-lucide="newspaper"></i> أخبار الأنمي</a>
          <a href="/redeem" data-link class="nav-sidebar-link"><i data-lucide="ticket"></i> شحن كود</a>
          <a href="/favorites" data-link class="nav-sidebar-link"><i data-lucide="heart"></i> المفضلة</a>
          <a href="/chat" data-link class="nav-sidebar-link active-page"><i data-lucide="message-circle"></i> الدردشة</a>
          <a href="/profile" data-link class="nav-sidebar-link"><i data-lucide="user"></i> حسابي</a>
          <div class="nav-section-title" style="margin-top:8px">أخرى</div>
          <a href="/policy" data-link class="nav-sidebar-link"><i data-lucide="shield"></i> السياسات</a>
          <a href="/event_gacha/spin.html" class="nav-sidebar-link"><i data-lucide="gift"></i> الهدايا</a>
        </nav>

        <div class="nav-spacer"></div>

        <div class="nav-user-card desktop-only">
          <img id="navUserAv" class="nav-user-av" src="https://i.ibb.co/YRShYmn/avatar.png" alt="">
          <div class="nav-user-info">
            <span class="nav-user-name" id="navUserName">...</span>
            <span class="nav-user-role-text" id="navUserRole">عضو</span>
          </div>
          <button class="nav-user-settings" type="button" id="navUserSettingsBtn" title="الإعدادات">
            <i data-lucide="settings"></i>
          </button>
        </div>
      </aside>

      <div class="sb-overlay" id="sbOvr"></div>
      <aside class="sidebar" id="sidebar">
        <div class="sb-header"><i class="fa-solid fa-users"></i> المتواجدون الآن</div>
        <div class="sb-list" id="usrList"></div>
      </aside>

      <header class="app-header" id="appHeader">
        <div class="header-left">
          <button class="header-btn mobile-only" id="menuBtn" type="button"><i data-lucide="menu"></i></button>
          <a href="/" data-link class="brand-mini">
            <img src="oraaic.jpg" class="brand-mini-logo" onerror="this.src='https://via.placeholder.com/34'">
          </a>
          <div class="room-info">
            <h2>المجتمع</h2>
            <div class="room-status"><span class="dot-online"></span><span id="onlineCnt">جاري التحميل...</span></div>
          </div>
        </div>
        <div class="header-right">
          <button class="header-btn mobile-only" id="toggleMembersBtn" type="button"><i class="fa-solid fa-users"></i></button>
          <a href="/profile" data-link class="header-avatar-link">
            <img id="headerAvatar" src="https://i.ibb.co/YRShYmn/avatar.png" alt="Avatar">
          </a>
        </div>
      </header>

      <div class="layout-wrapper">
        <main class="chat-shell">
          <div id="msg-container">
            <div class="chat-loading" id="chatLoading">
              <div class="chat-loading-spinner"></div>
              <span>جاري تحميل المحادثة...</span>
            </div>
          </div>
          <div id="global-typing">
            <div class="typing-dots"><span></span><span></span><span></span></div>
            <span id="typing-text">يكتب...</span>
          </div>
        </main>
        <button class="scroll-bottom-btn" id="scrollBottomBtn" type="button">
          <i class="fa-solid fa-chevron-down"></i>
        </button>
      </div>

      <div class="input-zone">
        <div id="mention-suggest" class="mention-list"></div>
        <button class="icon-btn" id="openStickersBtn" type="button"><i class="fa-regular fa-face-laugh-beam" style="color:#FFCA28"></i></button>
        <div class="input-wrap">
          <input type="text" id="msgInp" class="input-fld" placeholder="اكتب رسالتك..." autocomplete="off" maxlength="1000">
          <span class="char-counter" id="charCounter"></span>
        </div>
        <button class="icon-btn btn-send" id="sendBtn" type="button"><i class="fa-solid fa-paper-plane"></i></button>
      </div>

      <nav class="main-nav mobile-only">
        <a href="/" data-link class="nav-item"><div class="nav-icon-wrap"><i data-lucide="home"></i></div><span class="nav-label">الرئيسية</span></a>
        <a href="/newsanime" data-link class="nav-item"><div class="nav-icon-wrap"><i data-lucide="newspaper"></i></div><span class="nav-label">أخبار</span></a>
        <a href="/event_gacha/spin.html" class="nav-item"><div class="nav-icon-wrap"><i data-lucide="gift"></i></div><span class="nav-label">هدايا</span></a>
        <a href="/chat" data-link class="nav-item active"><div class="nav-icon-wrap"><i data-lucide="message-circle"></i></div><span class="nav-label">دردشة</span></a>
        <a href="/profile" data-link class="nav-item"><div class="nav-icon-wrap"><i data-lucide="user"></i></div><span class="nav-label">حسابي</span></a>
      </nav>

      <div class="sticker-overlay" id="stickerMod">
        <div class="sticker-panel">
          <div class="sticker-header">
            <h3><i class="fa-solid fa-icons"></i> الملصقات</h3>
            <button class="close-x" id="closeStickerBtn" type="button" style="position:static;width:35px;height:35px;background:#1C4D8D"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="sticker-grid" id="stGrid"></div>
        </div>
      </div>

      <div class="overlay-bg" id="pModal">
        <div class="prof-card" id="profCard">
          <div class="p-banner" id="pBan">
            <button class="close-x" id="closeProfileBtn" type="button"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="p-av-wrapper">
            <img src="" id="pAv" class="p-av" alt="">
            <img src="" id="pFrm" class="p-frame" style="display:none">
            <img src="" id="pVrf" class="p-vrf" style="display:none">
          </div>
          <h3 class="p-name" id="pNm">المستخدم</h3>
          <div class="p-role" id="pRole">عضو</div>
          <p class="p-bio" id="pBio">لا يوجد وصف</p>
          <div class="p-stats">
            <div class="p-stat">
              <span class="val" id="pMsgs">0</span>
              <span class="lbl">رسالة</span>
            </div>
          </div>
          <div class="p-actions">
            <button class="p-btn primary" id="goFullProfileBtn" type="button"><i class="fa-solid fa-user"></i> الملف الشخصي</button>
            <button class="p-btn secondary" id="mentionUserBtn" type="button"><i class="fa-solid fa-at"></i> ذكر</button>
          </div>
        </div>
      </div>
    </section>
  `;

  const page = root.querySelector("#chatPage");
  const alertHost = root.querySelector("#alertHost");
  const navSidebar = root.querySelector("#navSidebar");
  const navOverlay = root.querySelector("#navSidebarOverlay");
  const sidebar = root.querySelector("#sidebar");
  const sbOverlay = root.querySelector("#sbOvr");
  const menuBtn = root.querySelector("#menuBtn");
  const toggleMembersBtn = root.querySelector("#toggleMembersBtn");
  const closeNavBtn = root.querySelector("#closeNavSidebar");
  const headerAvatar = root.querySelector("#headerAvatar");
  const navUserAv = root.querySelector("#navUserAv");
  const navUserName = root.querySelector("#navUserName");
  const navUserRole = root.querySelector("#navUserRole");
  const navUserSettingsBtn = root.querySelector("#navUserSettingsBtn");

  const onlineCnt = root.querySelector("#onlineCnt");
  const usrList = root.querySelector("#usrList");
  const msgContainer = root.querySelector("#msg-container");
  const chatLoading = root.querySelector("#chatLoading");
  const globalTyping = root.querySelector("#global-typing");
  const typingText = root.querySelector("#typing-text");
  const scrollBottomBtn = root.querySelector("#scrollBottomBtn");
  const msgInp = root.querySelector("#msgInp");
  const charCounter = root.querySelector("#charCounter");
  const mentionSuggest = root.querySelector("#mention-suggest");
  const openStickersBtn = root.querySelector("#openStickersBtn");
  const sendBtn = root.querySelector("#sendBtn");

  const stickerMod = root.querySelector("#stickerMod");
  const closeStickerBtn = root.querySelector("#closeStickerBtn");
  const stGrid = root.querySelector("#stGrid");

  const pModal = root.querySelector("#pModal");
  const pBan = root.querySelector("#pBan");
  const pAv = root.querySelector("#pAv");
  const pFrm = root.querySelector("#pFrm");
  const pVrf = root.querySelector("#pVrf");
  const pNm = root.querySelector("#pNm");
  const pRole = root.querySelector("#pRole");
  const pBio = root.querySelector("#pBio");
  const pMsgs = root.querySelector("#pMsgs");
  const closeProfileBtn = root.querySelector("#closeProfileBtn");
  const goFullProfileBtn = root.querySelector("#goFullProfileBtn");
  const mentionUserBtn = root.querySelector("#mentionUserBtn");

  const AI_WORKER = {
    url: AI_WORKER_URL,
  };

  function updateCharCounter(len) {
    if (!charCounter) return;
    if (!len) {
      charCounter.textContent = "";
      charCounter.classList.remove("visible", "warning");
      return;
    }
    charCounter.textContent = `${len}/1000`;
    charCounter.classList.add("visible");
    charCounter.classList.toggle("warning", len > 900);
  }

  function openSidebar() {
    if (isDesktop()) return;
    sidebar?.classList.add("active");
    sbOverlay?.classList.add("active");
  }

  function closeSidebar() {
    sidebar?.classList.remove("active");
    sbOverlay?.classList.remove("active");
  }

  function openNavSidebar() {
    if (isDesktop()) return;
    navSidebar?.classList.add("open");
    navOverlay?.classList.add("show");
  }

  function closeNavSidebar() {
    navSidebar?.classList.remove("open");
    navOverlay?.classList.remove("show");
  }

  function toggleSidebar() {
    if (isDesktop()) return;
    const isOpen = sidebar?.classList.contains("active");
    if (isOpen) closeSidebar();
    else openSidebar();
  }

  function showWarn(msg) {
    if (!alertHost) return;
    const d = document.createElement("div");
    d.className = "private-alert";
    d.innerHTML = `<div class="t1">تنبيه</div><div class="t2">${esc(msg || "")}</div>`;
    alertHost.appendChild(d);
    setTimeout(() => {
      d.style.opacity = "0";
      d.style.transform = "translateY(-10px)";
      setTimeout(() => d.remove(), 300);
    }, 4000);
  }

  function showAlertHostItem(message) {
    showWarn(message);
  }

  function roleClassShort(role) {
    if (role === "Admin Root") return "rank-admin";
    if (role === "Admin" || role === "Manager") return "rank-mgr";
    if (role === "VIP") return "rank-vip";
    if (role === "AI") return "rank-admin";
    return "rank-user";
  }

  function updateNavUserCard() {
    if (!me || !navUserAv) return;
    navUserAv.src = me.avatar?.startsWith("http") ? me.avatar : `anime_img/${me.avatar || "01.jpg"}`;
    if (navUserName) navUserName.textContent = me.name || "مستخدم";
    if (navUserRole) navUserRole.textContent = me.role || "عضو";
  }

  function updateScrollBtn() {
    if (!msgContainer || !scrollBottomBtn) return;
    const show = !nearBottom(msgContainer) && initialLoadDone;
    if (show !== scrollBtnVisible) {
      scrollBtnVisible = show;
      scrollBottomBtn.classList.toggle("visible", show);
    }
  }

  function renderUsersList() {
    if (!usrList) return;

    const order = { "Admin Root": 0, "Admin": 1, "Manager": 2, "VIP": 3, "AI": 0 };
    const sorted = [...onlineUsersData].sort((a, b) => (order[a.role] ?? 4) - (order[b.role] ?? 4));

    usrList.innerHTML = sorted.map((u) => `
      <div class="usr-item" onclick="viewProfile('${escAttr(u.uid)}')">
        <img src="anime_img/${esc(u.avatar || "01.jpg")}" class="usr-av" loading="lazy" onerror="this.src='anime_img/01.jpg'">
        <div class="usr-info">
          <div class="usr-name ${roleClass(u.role)}">${esc(u.name || "مستخدم")}</div>
          <div class="usr-role">${esc(u.role || "عضو")}${u.typing ? " · يكتب" : ""}</div>
        </div>
      </div>
    `).join("");
  }

  function createMsgEl(id, data, isPend = false, grouped = false) {
    const s = data.sender || {};
    const isMe = data.senderId === me?.uid;
    const isAI = s.role === "AI";
    const isSticker = typeof data.text === "string" && data.text.startsWith("anime_img/");

    let txt = esc(data.text || "");
    if (!isSticker) txt = txt.replace(/@([^\s]+)/g, '<span class="mention">@$1</span>');

    let badge = "";
    if (s.verifyIcon) badge = `<img src="vrf/${esc(s.verifyIcon)}" class="vrf-badge" onerror="this.style.display='none'">`;
    else if (s.role === "Admin Root" || isAI) badge = `<img src="vrf/admin_verify.png" class="vrf-badge" onerror="this.style.display='none'">`;

    const frame = s.currentFrame ? `<img src="frame_data/${esc(s.currentFrame)}" class="frame-img" onerror="this.style.display='none'">` : "";
    const content = isSticker
      ? `<img src="${esc(data.text)}" class="sticker-img" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="txt">${txt}</div>`;

    const su = ["Admin Root", "Admin", "Manager", "VIP"].includes(me?.role);
    const canDel = (isMe || su) && !isPend;
    const delBtn = canDel ? `<button class="del-btn" onclick="deleteMsg('${escAttr(id)}')" title="حذف"><i class="fa-solid fa-trash"></i></button>` : "";

    const timeDots = isPend
      ? `<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`
      : (!isSticker ? `<span class="s-time">${fmtTime(data)}</span>` : "");

    const div = document.createElement("div");
    div.id = id;
    div.className = `msg-box ${isMe ? "me" : "other"} ${isPend ? "pending" : ""} ${isAI ? "ai" : ""} ${grouped ? "grouped" : ""}`;
    div.innerHTML = `
      <div class="av-wrapper" onclick="${isPend ? "" : `viewProfile('${escAttr(data.senderId)}')`}">
        <img src="anime_img/${esc(s.avatar || "01.jpg")}" class="av-img" loading="lazy" onerror="this.src='anime_img/01.jpg'">
        ${frame}
        ${badge}
      </div>
      <div class="bubble-wrap">
        <div class="sender-info"><span class="s-name ${roleClass(s.role)}">${esc(s.name || "مستخدم")}</span>${timeDots}</div>
        <div class="bubble">${delBtn} ${content}</div>
      </div>
    `;
    return div;
  }

  function renderAllMessages(mode = "auto", pT = 0, pH = 0) {
    if (!msgContainer || !me) return;
    const wasBottom = nearBottom(msgContainer);
    const anchor = mode === "preserve" ? scrollAnchor(msgContainer) : null;

    const items = [];
    const seen = new Set();

    for (const [id, it] of olderMessages.entries()) {
      if (!seen.has(id)) {
        items.push({ id, data: it.data, pending: false });
        seen.add(id);
      }
    }
    for (const [id, it] of latestMessages.entries()) {
      if (!seen.has(id)) {
        items.push({ id, data: it.data, pending: false });
        seen.add(id);
      }
    }
    for (const [tid, p] of pendingMessages.entries()) {
      if (!seen.has(tid)) {
        items.push({
          id: tid,
          data: {
            senderId: me.uid,
            text: p.text,
            sender: p.sender,
            clientCreatedAt: p.clientCreatedAt,
            time: null,
          },
          pending: true,
        });
        seen.add(tid);
      }
    }

    items.sort((a, b) => {
      const ta = sortTime(a.data);
      const tb = sortTime(b.data);
      return ta !== tb ? ta - tb : String(a.id).localeCompare(String(b.id));
    });

    const frag = document.createDocumentFragment();
    let lastDate = null;
    let prevSender = null;
    let prevTime = 0;

    for (const item of items) {
      const ts = sortTime(item.data);
      const dl = dateLabel(ts);
      if (dl !== lastDate) {
        lastDate = dl;
        const sep = document.createElement("div");
        sep.className = "date-separator";
        sep.innerHTML = `<span>${dl}</span>`;
        frag.appendChild(sep);
        prevSender = null;
      }

      const grouped = item.data.senderId === prevSender && (ts - prevTime) < 120000 && !item.pending;
      frag.appendChild(createMsgEl(item.id, item.data, item.pending, grouped));
      prevSender = item.data.senderId;
      prevTime = ts;
    }

    msgContainer.replaceChildren(frag);

    if (chatLoading) chatLoading.style.display = "none";

    requestAnimationFrame(() => {
      if (mode === "bottom" || (mode === "auto" && wasBottom)) {
        msgContainer.scrollTop = msgContainer.scrollHeight;
      } else if (anchor) {
        const el = document.getElementById(anchor.id);
        if (el) msgContainer.scrollTop = el.offsetTop - anchor.offset;
      } else if (pH) {
        msgContainer.scrollTop = pT + (msgContainer.scrollHeight - pH);
      }
      updateScrollBtn();
    });
  }

  function setAiThinking(a) {
    if (!globalTyping || !typingText) return;
    if (a) {
      typingText.innerText = "Oraa AI يفكر...";
      globalTyping.classList.add("active");
      globalTyping.dataset.aiLock = "1";
    } else {
      globalTyping.classList.remove("active");
      delete globalTyping.dataset.aiLock;
    }
  }

  function updateTyping() {
    const typers = onlineUsersData.filter((u) => u.typing && u.uid !== me?.uid);
    if (!globalTyping || !typingText) return;

    if (typers.length) {
      typingText.innerText = `${typers.map((u) => u.name).join("، ")} يكتب...`;
      globalTyping.classList.add("active");
    } else if (!globalTyping.dataset.aiLock) {
      globalTyping.classList.remove("active");
    }
  }

  function renderStickersOnce() {
    if (!stGrid || stGrid.children.length) return;
    for (let i = 1; i <= 20; i++) {
      const n = i < 10 ? `0${i}` : `${i}`;
      const d = document.createElement("div");
      d.className = "sticker-item";
      d.onclick = () => sendMsg(`anime_img/${n}.jpg`);
      d.innerHTML = `<img src="anime_img/${n}.jpg" loading="lazy" onerror="this.style.display='none'">`;
      stGrid.appendChild(d);
    }
  }

  function openStickers() {
    renderStickersOnce();
    if (!stickerMod) return;
    stickerMod.style.display = "flex";
    setTimeout(() => stickerMod.classList.add("active"), 10);
  }

  function closeStickers() {
    if (!stickerMod) return;
    stickerMod.classList.remove("active");
    setTimeout(() => {
      stickerMod.style.display = "none";
    }, 350);
  }

  async function checkMute() {
    if (!me) return false;
    const snap = await getDoc(doc(db, "chat_users", me.uid));
    if (!snap.exists()) return false;
    const m = snap.data()?.mutedUntil;
    if (!m) return false;
    const ms = m?.toMillis ? m.toMillis() : (m?.seconds ? m.seconds * 1000 : 0);
    return ms > Date.now();
  }

  function muteUser(s = 60) {
    return setDoc(
      doc(db, "chat_users", me.uid),
      { mutedUntil: Timestamp.fromMillis(Date.now() + s * 1000) },
      { merge: true }
    );
  }

  function handleMentions(text) {
    if (!mentionSuggest) return;

    if (!text.includes("@")) {
      mentionSuggest.classList.remove("active");
      return;
    }
    if (!["Admin Root", "Admin", "Manager", "VIP"].includes(me?.role)) {
      mentionSuggest.classList.remove("active");
      return;
    }

    const qs = text.split("@").pop().toLowerCase().trim();
    const filt = onlineUsersData.filter((u) => (u.name || "").toLowerCase().includes(qs));

    if (!filt.length) {
      mentionSuggest.classList.remove("active");
      return;
    }

    mentionSuggest.innerHTML = filt.map((u) => `
      <div class="mention-item" onclick="insertMention('${escAttr(u.name || "")}', '${escAttr(u.uid)}')">
        <img src="anime_img/${esc(u.avatar || "01.jpg")}" onerror="this.src='anime_img/01.jpg'">
        <span>${esc(u.name || "مستخدم")}</span>
      </div>
    `).join("");

    mentionSuggest.classList.add("active");
  }

  window.insertMention = (name, uid) => {
    const inp = msgInp;
    if (!inp) return;
    const parts = inp.value.split("@");
    parts.pop();
    inp.value = parts.join("@") + `@${name} `;
    mentionTargetUser = uid;
    mentionSuggest?.classList.remove("active");
    inp.focus();
    updateCharCounter(inp.value.length);
  };

  function showAiOrWarn(msg) {
    showWarn(msg);
  }

  // Track active AI request for cancellation on navigation
  let _activeAiAbort = null;

  // Build conversation context from recent messages (sliding window)
  function buildAIContext() {
    const allItems = [];
    const seen = new Set();
    for (const [id, it] of olderMessages.entries()) {
      if (!seen.has(id)) { allItems.push(it.data); seen.add(id); }
    }
    for (const [id, it] of latestMessages.entries()) {
      if (!seen.has(id)) { allItems.push(it.data); seen.add(id); }
    }
    allItems.sort((a, b) => sortTime(a) - sortTime(b));
    // Keep only last 20 messages for context window
    const recent = allItems.slice(-20);
    const systemMsg = {
      role: "system",
      content: "You are Oraa AI, a friendly assistant for the Oraa Slayer anime community chat. Respond helpfully and respectfully in Arabic. Keep responses concise."
    };
    const messages = recent.map((m) => {
      const isAI = (m.sender?.role === "AI") || (m.senderId === "AI_AGENT_ID");
      return {
        role: isAI ? "assistant" : "user",
        content: sanitizeAIInput(m.text || ""),
        senderName: m.sender?.name || "مستخدم",
      };
    });
    return { system: systemMsg, messages };
  }

  async function fetchAI(text, retryCount = 0) {
    // Cancel any previous active AI request
    if (_activeAiAbort) { try { _activeAiAbort.abort(); } catch {} }
    const aiAbort = new AbortController();
    _activeAiAbort = aiAbort;
    const AI_TIMEOUT = 15000;
    const MAX_RETRIES = 3;

    const timeoutId = setTimeout(() => aiAbort.abort(), AI_TIMEOUT);

    try {
      const context = buildAIContext();
      const sanitizedText = sanitizeAIInput(text);

      const res = await fetch(AI_WORKER.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: aiAbort.signal,
        body: JSON.stringify({
          mode: "reply",
          message: sanitizedText,
          user: {
            uid: me.uid,
            name: me.name,
            role: me.role || "member",
          },
          context: context,
        }),
      });

      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      _activeAiAbort = null;
      return {
        allowed: d.allowed === true,
        agentResponse: d.agentResponse || "",
        reason: d.reason,
        action: d.action,
      };
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === "AbortError") {
        console.warn("AI request aborted");
        _activeAiAbort = null;
        return { allowed: true, agentResponse: "", reason: null, action: null };
      }
      // Retry on network errors
      if (retryCount < MAX_RETRIES) {
        console.warn(`AI retry ${retryCount + 1}/${MAX_RETRIES}:`, e.message);
        _activeAiAbort = null;
        return fetchAI(text, retryCount + 1);
      }
      console.warn("AI unreachable after retries:", e.message);
      _activeAiAbort = null;
      return { allowed: true, agentResponse: "", reason: null, action: null };
    }
  }

  async function sendMsg(val = null) {
    const text = (val ?? msgInp?.value ?? "").trim();
    if (!text || !me) return;

    if (await checkMute()) {
      showWarn("أنت مكتوم مؤقتًا.");
      return;
    }

    const lm = myLiveState?.mutedUntil;
    if (lm?.toMillis && lm.toMillis() > Date.now()) {
      showWarn("أنت مكتوم مؤقتًا.");
      return;
    }

    if (text.length > 1000) {
      showWarn("الرسالة طويلة جداً (الحد 1000).");
      return;
    }

    // Rate limit check for AI chat
    if (!canSendAIMessage()) {
      showWarn("أرسلت رسائل كثيرة جداً. انتظر قليلاً.");
      return;
    }

    const tmpId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const sd = {
      name: me.name,
      avatar: me.avatar || "01.jpg",
      role: me.role || "عضو",
      verifyIcon: me.verifyIcon || "",
      currentFrame: me.currentFrame || "",
    };

    try {
      pendingMessages.set(tmpId, {
        tmpId,
        text,
        sender: sd,
        clientCreatedAt: Date.now(),
      });
      renderAllMessages("bottom");

      setAiThinking(true);
      const { allowed, agentResponse, reason, action } = await fetchAI(text);
      setAiThinking(false);

      if (!allowed) {
        showWarn(agentResponse || (reason ? `تم رفض الرسالة: ${reason}` : "الرسالة غير مسموحة"));
        if (action === "mute") await muteUser(60);
        pendingMessages.delete(tmpId);
        renderAllMessages("bottom");
        if (msgInp) msgInp.value = "";
        updateCharCounter(0);
        closeStickers();
        return;
      }

      await addDoc(collection(db, "chat_messages"), {
        senderId: me.uid,
        text,
        sender: sd,
        time: serverTimestamp(),
        clientCreatedAt: Date.now(),
        clientTempId: tmpId,
      });

      if (msgInp) msgInp.value = "";
      updateCharCounter(0);
      closeStickers();

      if (agentResponse?.trim()) {
        await addDoc(collection(db, "chat_messages"), {
          senderId: "AI_AGENT_ID",
          text: agentResponse.trim(),
          sender: AI_SENDER,
          time: serverTimestamp(),
          clientCreatedAt: Date.now(),
        });
      }
    } catch (e) {
      console.error("sendMsg:", e);
      pendingMessages.delete(tmpId);
      showWarn("حدث خطأ أثناء الإرسال.");
    } finally {
      setAiThinking(false);
      renderAllMessages("bottom");
    }
  }

  async function deleteMsg(id) {
    if (!confirm("حذف الرسالة نهائياً؟")) return;
    try {
      await deleteDoc(doc(db, "chat_messages", id));
    } catch (e) {
      console.error(e);
    }
  }

  async function loadOlder() {
    if (loadingOlder || !hasMoreOlder || !oldestCursorDoc) return;
    loadingOlder = true;

    const pT = msgContainer?.scrollTop || 0;
    const pH = msgContainer?.scrollHeight || 0;

    try {
      const q = query(
        collection(db, "chat_messages"),
        orderBy("time", "desc"),
        startAfter(oldestCursorDoc),
        limit(20)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        hasMoreOlder = false;
        loadingOlder = false;
        return;
      }

      const docs = [];
      snap.forEach((d) => {
        const dt = d.data() || {};
        olderMessages.set(d.id, { id: d.id, data: dt });
        docs.push(d);
      });

      oldestCursorDoc = docs[docs.length - 1];
      if (docs.length < 20) hasMoreOlder = false;
      renderAllMessages("preserve", pT, pH);
    } catch (e) {
      console.error(e);
    }

    loadingOlder = false;
  }

  function viewProfile(uid) {
    currentProfileUid = uid;
    getDoc(doc(db, "users", uid))
      .then((sn) => {
        if (!sn.exists()) return;
        const u = sn.data();

        if (pAv) pAv.src = `anime_img/${u.avatar || "01.jpg"}`;
        if (pNm) pNm.innerText = u.name || "مستخدم";
        if (pBio) pBio.innerText = u.bio || "لا يوجد وصف";

        if (pBan) {
          if (u.banner) {
            pBan.style.backgroundImage = `url('banner_data/${u.banner}')`;
            pBan.style.backgroundSize = "cover";
            pBan.style.backgroundPosition = "center";
          } else {
            pBan.style.backgroundImage = "";
            pBan.style.background = "linear-gradient(135deg,#1C4D8D,#4988C4)";
          }
        }

        let rc = "user";
        const rt = u.role || "عضو";
        if (u.role === "Admin Root") rc = "admin";
        else if (u.role === "Admin" || u.role === "Manager") rc = "mgr";
        else if (u.role === "VIP") rc = "vip";

        if (pRole) {
          pRole.className = `p-role ${rc}`;
          pRole.innerHTML = esc(rt);
        }

        if (pFrm) {
          if (u.currentFrame) {
            pFrm.src = `frame_data/${u.currentFrame}`;
            pFrm.style.display = "block";
          } else {
            pFrm.style.display = "none";
          }
        }

        if (pVrf) {
          if (u.verifyIcon) {
            pVrf.src = `vrf/${u.verifyIcon}`;
            pVrf.style.display = "block";
          } else if (u.role === "Admin Root") {
            pVrf.src = "vrf/admin_verify.png";
            pVrf.style.display = "block";
          } else {
            pVrf.style.display = "none";
          }
        }

        getDocs(query(collection(db, "chat_messages"), where("senderId", "==", uid), limit(500)))
          .then((msgs) => {
            if (pMsgs) pMsgs.innerText = msgs.size >= 500 ? "500+" : msgs.size;
          })
          .catch(() => {
            if (pMsgs) pMsgs.innerText = "?";
          });

        if (pModal) {
          pModal.style.display = "flex";
          setTimeout(() => pModal.classList.add("active"), 10);
        }
      })
      .catch((err) => console.error(err));
  }

  function closeProfile() {
    if (!pModal) return;
    pModal.classList.remove("active");
    setTimeout(() => {
      pModal.style.display = "none";
    }, 350);
  }

  function goToFullProfile() {
    if (!currentProfileUid) return;
    const path = `/profile?uid=${encodeURIComponent(currentProfileUid)}`;
    if (typeof ctx.go === "function") ctx.go(path);
    else window.location.href = path;
  }

  function mentionUser() {
    const n = pNm?.innerText || "مستخدم";
    insertMention(n, currentProfileUid);
    closeProfile();
  }

  function createStickersGrid() {
    if (!stGrid || stGrid.children.length) return;
    for (let i = 1; i <= 20; i++) {
      const n = i < 10 ? `0${i}` : `${i}`;
      const d = document.createElement("div");
      d.className = "sticker-item";
      d.onclick = () => sendMsg(`anime_img/${n}.jpg`);
      d.innerHTML = `<img src="anime_img/${n}.jpg" loading="lazy" onerror="this.style.display='none'">`;
      stGrid.appendChild(d);
    }
  }

  function openStickers() {
    createStickersGrid();
    if (!stickerMod) return;
    stickerMod.style.display = "flex";
    setTimeout(() => stickerMod.classList.add("active"), 10);
  }

  function closeStickers() {
    if (!stickerMod) return;
    stickerMod.classList.remove("active");
    setTimeout(() => {
      stickerMod.style.display = "none";
    }, 350);
  }

  function updateDesktopLayoutClass() {
    page?.classList.toggle("desktop-layout", isDesktop());
    if (isDesktop()) {
      closeSidebar();
      closeNavSidebar();
    }
  }

  function initChat() {
    const q = query(collection(db, "chat_messages"), orderBy("time", "desc"), limit(20));
    unsubChat = onSnapshot(q, (snap) => {
      const nk = snap.docs.map((d) => {
        const dt = d.data() || {};
        return `${d.id}:${dt.clientTempId || ""}:${sortTime(dt)}`;
      }).join("|");

      if (nk === lastMessagesKey && pendingMessages.size === 0) return;
      lastMessagesKey = nk;

      latestMessages.clear();
      const tids = new Set();
      const docs = [];

      snap.forEach((d) => {
        const dt = d.data() || {};
        latestMessages.set(d.id, { id: d.id, data: dt });
        docs.push(d);
        if (dt.clientTempId) tids.add(dt.clientTempId);
      });

      if (docs.length) {
        oldestCursorDoc = docs[docs.length - 1];
        hasMoreOlder = docs.length === 20;
      } else {
        oldestCursorDoc = null;
        hasMoreOlder = false;
      }

      tids.forEach((t) => {
        if (pendingMessages.has(t)) pendingMessages.delete(t);
      });

      renderAllMessages("auto");
      if (!initialLoadDone) initialLoadDone = true;
    });

    unsubUsers = onSnapshot(collection(db, "chat_users"), (snap) => {
      if (onlineCnt) onlineCnt.innerText = `${snap.size} متصل`;

      onlineUsersData = [];
      snap.forEach((d) => onlineUsersData.push(d.data()));

      updateTyping();

      const sbOpen = sidebar?.classList.contains("active");
      if (!sbOpen && !isDesktop()) return;

      const nk = onlineUsersData
        .map((u) => `${u.uid}:${u.typing ? 1 : 0}:${u.name || ""}:${u.avatar || ""}:${u.role || ""}`)
        .join("|");

      if (nk === lastUsersKey) return;
      lastUsersKey = nk;
      renderUsersList();
    });

    if (msgInp) {
      msgInp.addEventListener("input", () => {
        clearTimeout(typingTimeout);
        if (me?.uid) {
          setDoc(doc(db, "chat_users", me.uid), { typing: true }, { merge: true });
          typingTimeout = setTimeout(() => {
            setDoc(doc(db, "chat_users", me.uid), { typing: false }, { merge: true });
          }, 1200);
        }
        handleMentions(msgInp.value);
        updateCharCounter(msgInp.value.length);
      }, { signal });

      msgInp.addEventListener("blur", () => {
        if (me?.uid) setDoc(doc(db, "chat_users", me.uid), { typing: false }, { merge: true });
        mentionSuggest?.classList.remove("active");
      }, { signal });

      msgInp.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMsg();
      }, { signal });
    }
  }

  async function setupUser(user) {
    const sn = await getDoc(doc(db, "users", user.uid));
    if (!sn.exists()) return false;

    me = { uid: user.uid, ...sn.data() };

    if (headerAvatar && me.avatar) {
      headerAvatar.src = me.avatar.startsWith("http") ? me.avatar : `anime_img/${me.avatar}`;
    }

    updateNavUserCard();

    unsubSelfUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();

      if (headerAvatar && d.avatar) {
        headerAvatar.src = d.avatar.startsWith("http") ? d.avatar : `anime_img/${d.avatar}`;
      }
      me = { ...me, ...d };
      updateNavUserCard();
    });

    await setDoc(doc(db, "chat_users", user.uid), {
      uid: user.uid,
      name: me.name,
      avatar: me.avatar || "01.jpg",
      role: me.role || "عضو",
      verifyIcon: me.verifyIcon || "",
      currentFrame: me.currentFrame || "",
      lastSeen: serverTimestamp(),
    }, { merge: true });

    unsubMyLiveState = onSnapshot(doc(db, "chat_users", user.uid), (snap) => {
      myLiveState = snap.exists() ? snap.data() : {};
    });

    return true;
  }

  function listenPrivateAlerts() {
    const q = query(collection(db, "user_alerts"), where("recipientUid", "==", me.uid));
    unsubAlerts = onSnapshot(q, (snap) => {
      if (!alertsReady) {
        snap.forEach((ds) => {
          const d = ds.data() || {};
          seenAlertIds.add(d.clientAlertId || ds.id);
        });
        alertsReady = true;
        return;
      }

      snap.docChanges().forEach((ch) => {
        if (ch.type !== "added") return;
        const d = ch.doc.data() || {};
        const k = d.clientAlertId || ch.doc.id;
        if (seenAlertIds.has(k)) return;
        seenAlertIds.add(k);
        showWarn(d.message || "تنبيه جديد");
      });
    });
  }

  function bindEvents() {
    menuBtn?.addEventListener("click", openNavSidebar, { signal });
    toggleMembersBtn?.addEventListener("click", toggleSidebar, { signal });
    closeNavBtn?.addEventListener("click", closeNavSidebar, { signal });
    navOverlay?.addEventListener("click", closeNavSidebar, { signal });
    sbOverlay?.addEventListener("click", closeSidebar, { signal });

    scrollBottomBtn?.addEventListener("click", () => {
      if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
    }, { signal });

    openStickersBtn?.addEventListener("click", openStickers, { signal });
    closeStickerBtn?.addEventListener("click", closeStickers, { signal });

    root.querySelector("#sendBtn")?.addEventListener("click", () => sendMsg(), { signal });
    root.querySelector("#scrollBottomBtn")?.addEventListener("click", () => {
      if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
    }, { signal });

    closeProfileBtn?.addEventListener("click", closeProfile, { signal });
    pModal?.addEventListener("click", (e) => {
      if (e.target === pModal) closeProfile();
    }, { signal });

    stickerMod?.addEventListener("click", (e) => {
      if (e.target === stickerMod) closeStickers();
    }, { signal });

    goFullProfileBtn?.addEventListener("click", goToFullProfile, { signal });
    mentionUserBtn?.addEventListener("click", mentionUser, { signal });

    navUserSettingsBtn?.addEventListener("click", () => {
      const path = "/profile";
      if (typeof ctx.go === "function") ctx.go(path);
      else window.location.href = path;
    }, { signal });

    if (msgContainer) {
      msgContainer.addEventListener("scroll", () => {
        if (rafScrollUpdate) cancelAnimationFrame(rafScrollUpdate);
        rafScrollUpdate = requestAnimationFrame(() => {
          updateScrollBtn();
          if (msgContainer.scrollTop < 120) loadOlder();
        });
      }, { passive: true, signal });
    }

    window.addEventListener("resize", () => {
      updateDesktopLayoutClass();
      if (isDesktop()) {
        if (onlineUsersData.length) renderUsersList();
      }
    }, { passive: true, signal });

    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && me) {
        setDoc(doc(db, "chat_users", me.uid), { lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
      }
    }, { signal });

    window.addEventListener("beforeunload", () => {
      if (me) {
        setDoc(doc(db, "chat_users", me.uid), { lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
      }
    }, { signal });
  }

  window.toggleSidebar = toggleSidebar;
  window.openStickers = openStickers;
  window.closeStickers = closeStickers;
  window.viewProfile = viewProfile;
  window.closeProfile = closeProfile;
  window.goToFullProfile = goToFullProfile;
  window.mentionUser = mentionUser;
  window.deleteMsg = deleteMsg;
  window.sendMsg = sendMsg;
  window.scrollToBottom = () => {
    if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
  };

  bindEvents();
  updateDesktopLayoutClass();

  unsubAuth = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      if (typeof ctx.replace === "function") ctx.replace("/login");
      else window.location.href = "/login";
      return;
    }

    const ok = await setupUser(user);
    if (!ok) return;

    if (!chatStarted) {
      chatStarted = true;
      initChat();
      listenPrivateAlerts();
    }

    window.lucide?.createIcons?.();
  });

  window.lucide?.createIcons?.();

  previousCleanup = () => {
    try { if (_activeAiAbort) _activeAiAbort.abort(); } catch {}
    try { controller.abort(); } catch {}
    try { unsubAuth?.(); } catch {}
    try { unsubSelfUser?.(); } catch {}
    try { unsubMyLiveState?.(); } catch {}
    try { unsubChat?.(); } catch {}
    try { unsubUsers?.(); } catch {}
    try { unsubAlerts?.(); } catch {}
    try { clearTimeout(typingTimeout); } catch {}
    try { cancelAnimationFrame(rafScrollUpdate); } catch {}
    try { window.toggleSidebar = undefined; } catch {}
    try { window.openStickers = undefined; } catch {}
    try { window.closeStickers = undefined; } catch {}
    try { window.viewProfile = undefined; } catch {}
    try { window.closeProfile = undefined; } catch {}
    try { window.goToFullProfile = undefined; } catch {}
    try { window.mentionUser = undefined; } catch {}
    try { window.deleteMsg = undefined; } catch {}
    try { window.sendMsg = undefined; } catch {}
    try { window.scrollToBottom = undefined; } catch {}
    try { root.querySelector("#chatPage")?.remove(); } catch {}
    try { document.body.style.overflow = ""; } catch {}
  };

  window.__chatPageCleanup = previousCleanup;
}