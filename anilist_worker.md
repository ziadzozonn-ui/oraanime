/**
 * ╔══════════════════════════════════════════════════╗
 * ║   AEGIS CLIENT V300 - ULTRA LIGHT FRONTEND     ║
 * ║   Receives optimized data from Worker          ║
 * ║   Renders ONLY - No API logic, No heavy lifting║
 * ║   Target: 60 FPS on low-end mobile devices      ║
 * ╚══════════════════════════════════════════════════╝
 */

'use strict';

// ═════════════════════════════════════════════════════
// CONFIGURATION
// ═════════════════════════════════════════════════════
const CFG = Object.freeze({
    WORKER_URL: 'https://super-serverh-6547100.ytleux7.workers.dev',
    SLIDER_INTERVAL: 5200,
    SCROLL_THRESHOLD: 850,
    IMAGE_ROOT_MARGIN: '500px',
    SEARCH_DEBOUNCE_PC: 140,
    SEARCH_DEBOUNCE_MOBILE: 280,
    SUGGEST_DEBOUNCE_PC: 110,
    SUGGEST_DEBOUNCE_MOBILE: 200,
    WRITE_FRAME_BUDGET: 8,
    SENTINEL_ID: 'loadMoreSentinel',
    LOCAL_CACHE_TIME: 1800000,
    MAX_LOCAL_CACHE_ITEMS: 50,
});

// ═════════════════════════════════════════════════════
// SIMPLE LOCAL CACHE (Lightweight, No IndexedDB)
// ═════════════════════════════════════════════════════
class LightCache {
    constructor() {
        this.store = new Map();
        this.timestamps = new Map();
    }

    get(key) {
        const entry = this.store.get(key);
        const time = this.timestamps.get(key);
        if (!entry || !time) return null;
        if (Date.now() - time > CFG.LOCAL_CACHE_TIME) {
            this.store.delete(key);
            this.timestamps.delete(key);
            return null;
        }
        return entry;
    }

    set(key, value) {
        // Enforce max items
        if (this.store.size >= CFG.MAX_LOCAL_CACHE_ITEMS) {
            const oldest = [...this.timestamps.entries()]
                .sort((a, b) => a[1] - b[1])[0];
            if (oldest) {
                this.store.delete(oldest[0]);
                this.timestamps.delete(oldest[0]);
            }
        }
        this.store.set(key, value);
        this.timestamps.set(key, Date.now());
    }

    clear() {
        this.store.clear();
        this.timestamps.clear();
    }
}

// ═════════════════════════════════════════════════════
// WORKER API CLIENT
// ═════════════════════════════════════════════════════
class WorkerClient {
    constructor(baseURL) {
        this.baseURL = baseURL;
    }

    async fetch(route, params = {}) {
        const url = new URL(this.baseURL);
        url.searchParams.set('route', route);

        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') {
                url.searchParams.set(k, String(v));
            }
        });

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);

        try {
            const res = await fetch(url.toString(), {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal,
            });

            if (!res.ok) {
                throw new Error(`Worker HTTP ${res.status}`);
            }

            const data = await res.json();

            // Transform short field names back to full names
            return this.expandResponse(data);
        } catch (err) {
            if (err.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw err;
        } finally {
            clearTimeout(timer);
        }
    }

    // Expand short field names from Worker
    expandResponse(data) {
        if (!data || !data.list) return data;

        return {
            ...data,
            list: data.list.map(item => this.expandItem(item)),
        };
    }

    expandItem(item) {
        if (!item) return null;
        return {
            id: item.id,
            title: { userPreferred: item.t || 'Unknown' },
            coverImage: {
                extraLarge: item.i || '',
                large: item.i || '',
                medium: item.th || item.i || '',
                color: item.c || '#1a1a2e',
            },
            bannerImage: item.b || null,
            averageScore: item.s ? parseFloat(item.s) * 10 : null,
            popularity: item.p || 0,
            trending: item.tr || 0,
            status: item.st || null,
            seasonYear: item.y || null,
            startDate: item.y ? { year: item.y } : null,
            episodes: item.ep,
            format: item.f || 'TV',
            genres: item.g || [],
            nextAiringEpisode: item.na ? {
                episode: item.na.ep,
                timeUntilAiring: (item.na.d * 86400) + (item.na.h * 3600),
                airingAt: item.na.ts,
            } : null,
            description: item.desc || null,
            studios: item.studios || [],
            trailer: item.trailer || null,
        };
    }
}

// ═════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════
const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c] ?? c));

const b64 = (v) => {
    try { return btoa(String(v)); }
    catch { return btoa(unescape(encodeURIComponent(String(v)))); }
};

const slugify = (text) => {
    return String(text || '')
        .toLowerCase().trim()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
};

const safeParse = (v, fb) => {
    try { return typeof v === 'string' ? JSON.parse(v) : v; }
    catch { return fb; }
};

const idle = (fn, timeout = 1000) =>
    ('requestIdleCallback' in window)
        ? requestIdleCallback(fn, { timeout })
        : setTimeout(fn, 0);

// ═════════════════════════════════════════════════════
// MAIN ENGINE
// ═════════════════════════════════════════════════════
class AegisEngine {
    #state = { page: 1, loading: false, hasNext: true, query: null };
    #active = { genre: null, format: null, year: null, status: null };
    #pending = { genre: null, format: null, year: null, status: null };
    #ctl = { slider: null, grid: null, sug: null };
    #seq = { slider: 0, grid: 0, sug: 0 };
    #writeQueue = [];
    #writeRAF = 0;
    #resizeRAF = 0;
    #tSearch = 0;
    #tSuggest = 0;
    #sugIdx = -1;
    #dead = false;
    #root;
    #dom = {};
    #touch = false;
    #imgObs = null;
    #scrollObs = null;
    #sliderData = [];
    #sliderIdx = 0;
    #sliderDots = [];
    #sliderTimer = null;
    #sliderPaused = false;
    #isScrolling = false;
    #scrollStopTimer = null;
    #prefetchUrls = new Set();
    _listeners = [];

    constructor(rootElement) {
        this.#root = rootElement || document;
        this.#touch = matchMedia('(pointer: coarse)').matches || innerWidth < 768;
        this.api = new WorkerClient(CFG.WORKER_URL);
        this.cache = new LightCache();
        this.#initObservers();
    }

    // ═════════════════════════════════════════════════
    // OBSERVERS
    // ═════════════════════════════════════════════════
    #initObservers() {
        if ('IntersectionObserver' in window) {
            this.#imgObs = new IntersectionObserver((entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        this.#lazyImg(e.target);
                        this.#imgObs.unobserve(e.target);
                    }
                }
            }, { rootMargin: CFG.IMAGE_ROOT_MARGIN, threshold: 0.01 });
        }
    }

    #initScrollSentinel() {
        if (!this.#dom.grid || !('IntersectionObserver' in window)) return;
        this.#scrollObs?.disconnect();

        let sentinel = document.getElementById(CFG.SENTINEL_ID);
        if (!sentinel) {
            sentinel = document.createElement('div');
            sentinel.id = CFG.SENTINEL_ID;
            sentinel.style.cssText = 'height:1px;width:100%;';
            this.#dom.grid.after(sentinel);
        }

        this.#scrollObs = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting && !this.#state.loading && this.#state.hasNext) {
                void this.#fetchGrid();
            }
        }, { rootMargin: '200px' });

        this.#scrollObs.observe(sentinel);
    }

    // ═════════════════════════════════════════════════
    // WRITE QUEUE (Batch DOM Updates)
    // ═════════════════════════════════════════════════
    #write(fn) {
        this.#writeQueue.push(fn);
        if (this.#writeRAF) return;

        this.#writeRAF = requestAnimationFrame(() => {
            this.#writeRAF = 0;
            const start = performance.now();
            while (this.#writeQueue.length > 0) {
                const f = this.#writeQueue.shift();
                try { f(); } catch (e) { console.error(e); }
                if (performance.now() - start > CFG.WRITE_FRAME_BUDGET) break;
            }
            if (this.#writeQueue.length > 0) this.#write(() => {});
        });
    }

    #vib(p) { try { navigator.vibrate?.(p); } catch {} }
    #abort(w) { if (this.#ctl[w]) { this.#ctl[w].abort(); this.#ctl[w] = null; } }

    // ═════════════════════════════════════════════════
    // IMAGE HANDLING
    // ═════════════════════════════════════════════════
    #lazyImg(img) {
        const src = img?.dataset?.src;
        if (!src) return;

        const pre = new Image();
        pre.decoding = 'async';
        pre.src = src;
        pre.onload = () => { img.src = src; img.classList.add('loaded'); };
        pre.onerror = () => {
            img.src = 'https://via.placeholder.com/300x450/0E2044/BDE8F5?text=—';
            img.classList.add('failed', 'loaded');
        };
        img.removeAttribute('data-src');
    }

    #observeImg(img) {
        if (!img) return;
        this.#imgObs ? this.#imgObs.observe(img) : this.#lazyImg(img);
    }

    // ═════════════════════════════════════════════════
    // DOM CACHE
    // ═════════════════════════════════════════════════
    #cacheDom() {
        const r = this.#root;
        this.#dom = {
            hero: r.querySelector('#heroSection'),
            sliderTrk: r.querySelector('#sliderTrack'),
            sliderDots: r.querySelector('#sliderDots'),
            sliderSkel: r.querySelector('#sliderSkeleton'),
            ticker: r.querySelector('#tickerContent'),
            grid: r.querySelector('#animeGrid'),
            searchIn: r.querySelector('#searchInput'),
            sugBox: r.querySelector('#suggestionsBox'),
            searchSpin: r.querySelector('#searchSpinner'),
            searchClr: r.querySelector('#searchClear'),
            filterBtn: r.querySelector('#filterToggleBtn'),
            filterPop: r.querySelector('#filterPopover'),
            filterApply: r.querySelector('#filterApplyBtn'),
            filterReset: r.querySelector('#filterResetBtn'),
            genreF: r.querySelector('#genreFilters'),
            formatF: r.querySelector('#formatFilters'),
            yearF: r.querySelector('#yearFilters'),
            statusF: r.querySelector('#statusFilters'),
        };

        if (this.#dom.sliderTrk) {
            this.#dom.sliderTrk.style.direction = 'ltr';
            this.#dom.sliderTrk.style.willChange = 'transform';
        }
    }

    // ═════════════════════════════════════════════════
    // INJECT STYLES
    // ═════════════════════════════════════════════════
    #injectStyles() {
        if (document.getElementById('aegis-v300-css')) return;
        const s = document.createElement('style');
        s.id = 'aegis-v300-css';
        s.textContent = `
.anime-card,.slide,.suggestion-item{touch-action:pan-y}

.anime-card{
    position:relative;
    border-radius:16px;
    overflow:hidden;
    aspect-ratio:2/3;
    cursor:pointer;
    background:linear-gradient(180deg,rgba(14,32,68,.85),rgba(8,16,36,.95));
    border:1px solid rgba(189,232,245,.06);
    content-visibility:auto;
    contain:layout style paint;
    contain-intrinsic-size:160px 240px;
    transition:transform .2s ease,box-shadow .2s ease,opacity .2s ease;
}

.anime-card.visible{animation:aegis-up .3s ease both}

@media(hover:hover){
    .anime-card:hover{
        transform:translateY(-5px) scale(1.02);
        box-shadow:0 14px 38px rgba(0,0,0,.35),0 0 0 1px rgba(100,180,255,.15);
        z-index:2;
        will-change:transform;
    }
}

.anime-card:active{transform:scale(.97)!important;transition-duration:.08s!important}

.anime-card .card-img{
    width:100%;height:100%;object-fit:cover;display:block;
    opacity:0;transition:opacity .3s ease,transform .4s ease;transform:scale(1.03);
}
.anime-card .card-img.loaded{opacity:1;transform:scale(1)}
.anime-card .card-img.failed{opacity:.25}

.anime-card .card-glow{
    position:absolute;inset:0;
    background:radial-gradient(120px circle at var(--mx,50%) var(--my,50%),rgba(100,180,255,.14),transparent 60%);
    opacity:0;transition:opacity .2s;pointer-events:none;z-index:1;
}
@media(hover:hover){
    .anime-card:hover .card-glow{opacity:1}
}
body.is-scrolling .anime-card .card-glow{display:none}

.anime-card .card-info{
    position:absolute;bottom:0;left:0;right:0;
    padding:36px 10px 10px;
    background:linear-gradient(0deg,rgba(6,14,32,.98) 0%,rgba(6,14,32,.75) 55%,transparent 100%);
    z-index:2;pointer-events:none;
}
@media(hover:hover){
    .anime-card:hover .card-info{
        backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
    }
}

.anime-card .card-title{
    font-size:13px;font-weight:700;color:#e8f4ff;line-height:1.35;
    margin:0 0 5px;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
    overflow:hidden;
    text-shadow:0 2px 8px rgba(0,0,0,.8);
}
.anime-card .card-meta{display:flex;gap:5px;flex-wrap:wrap}
.anime-card .chip{
    font-size:10px;padding:2px 7px;border-radius:6px;
    background:rgba(189,232,245,.08);color:rgba(189,232,245,.65);
    border:1px solid rgba(189,232,245,.06);
}
.anime-card .chip.score{color:#ffd966;border-color:rgba(255,217,102,.12)}

.anime-card .live-badge{
    position:absolute;top:8px;left:8px;display:flex;align-items:center;gap:4px;
    font-size:10px;font-weight:700;color:#fff;
    background:rgba(220,38,38,.9);padding:3px 8px;border-radius:6px;z-index:3;
}
.anime-card .live-dot{
    width:6px;height:6px;border-radius:50%;background:#fff;
    animation:aegis-pulse 1.2s infinite;
}

.sug-h{color:#60a5fa;font-weight:700}
@keyframes aegis-pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes aegis-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}

.skeleton-card{
    position:relative;overflow:hidden;border-radius:16px;aspect-ratio:2/3;
    background:linear-gradient(180deg,rgba(14,32,68,.7),rgba(8,16,36,.9));
    border:1px solid rgba(189,232,245,.06);
}
.skeleton-card::after{
    content:'';position:absolute;inset:0;transform:translateX(-100%);
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.06) 40%,rgba(255,255,255,.1) 50%,rgba(255,255,255,.06) 60%,transparent);
    animation:aegis-shim 1.4s infinite;
}
@keyframes aegis-shim{to{transform:translateX(100%)}}

.no-results,.soft-fail{
    grid-column:1/-1;text-align:center;padding:40px 20px;
    color:rgba(189,232,245,.6);font-size:16px;
}
.soft-fail button{
    margin-top:12px;padding:10px 24px;border-radius:8px;
    background:rgba(100,180,255,.15);color:#bde8f5;
    border:1px solid rgba(100,180,255,.25);cursor:pointer;font-size:14px;
}
`;
        document.head.appendChild(s);
    }

    // ═════════════════════════════════════════════════
    // SLIDER
    // ═════════════════════════════════════════════════
    #sliderGo(i) {
        if (!this.#dom.sliderTrk) return;
        this.#sliderIdx = i;
        this.#dom.sliderTrk.style.transform = `translate3d(${-i * 100}%, 0, 0)`;
        this.#sliderDots.forEach((d, idx) => d.classList.toggle('active', idx === i));
    }

    #sliderStart() {
        this.#sliderStop();
        if (!this.#sliderData.length) return;
        this.#sliderTimer = setInterval(() => {
            if (!this.#sliderPaused && this.#sliderData.length) {
                this.#sliderGo((this.#sliderIdx + 1) % this.#sliderData.length);
            }
        }, CFG.SLIDER_INTERVAL);
    }

    #sliderStop() {
        if (this.#sliderTimer) {
            clearInterval(this.#sliderTimer);
            this.#sliderTimer = null;
        }
    }

    #renderSlider(list) {
        const { sliderTrk, sliderDots, sliderSkel, hero } = this.#dom;
        if (!sliderTrk || !sliderDots || !list?.length) return;

        sliderTrk.style.transform = 'translate3d(0,0,0)';

        const html = list.map((a, i) => {
            const img = a.bannerImage || a.coverImage?.extraLarge || '';
            const ttl = esc(a.title?.userPreferred || 'Anime');
            const sc = a.averageScore ? (a.averageScore / 10).toFixed(1) : '—';
            const slug = slugify(a.title?.userPreferred || 'anime');
            const genres = a.genres || [];

            return `<div class="slide"
                data-url="/anime/${b64(a.id)}/${slug}"
                data-id="${a.id}"
                data-title="${ttl}"
                data-genres="${esc(encodeURIComponent(JSON.stringify(genres)))}"
                data-format="${esc(a.format || '')}">
                <img class="slide-media" src="${esc(img)}" alt="${ttl}" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async" fetchpriority="${i === 0 ? 'high' : 'low'}" onerror="this.style.background='#0E2044'">
                <div class="slide-overlay"></div>
                <div class="slide-content">
                    <h2 class="slide-title">${ttl}</h2>
                    <div class="slide-meta">
                        <span class="slide-badge">★ ${sc}</span>
                        ${a.seasonYear ? `<span class="slide-meta-chip">${esc(a.seasonYear)}</span>` : ''}
                        ${a.format ? `<span class="slide-meta-chip">${esc(a.format)}</span>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');

        const dots = list.map((_, i) =>
            `<button class="dot${i === 0 ? ' active' : ''}" data-idx="${i}" type="button" aria-label="Slide ${i + 1}"></button>`
        ).join('');

        this.#write(() => {
            if (sliderSkel) sliderSkel.style.display = 'none';
            sliderTrk.innerHTML = html;
            sliderTrk.style.display = 'flex';
            sliderDots.innerHTML = dots;
            if (hero) hero.style.opacity = '1';
        });

        this.#sliderData = list;
        this.#sliderIdx = 0;
        this.#sliderDots = sliderDots.querySelectorAll('.dot');
        this.#sliderStart();
    }

    async #fetchSlider() {
        this.#abort('slider');
        const seq = ++this.#seq.slider;

        // Check local cache first
        const cached = this.cache.get('slider_data');
        if (!this.#dead && seq === this.#seq.slider && cached?.length) {
            this.#renderSlider(cached);
            return;
        }

        try {
            const result = await this.api.fetch('hero_slider');
            if (this.#dead || seq !== this.#seq.slider) return;

            const list = result?.list || [];
            if (list.length) {
                this.cache.set('slider_data', list);
                this.#renderSlider(list);
            } else if (this.#dom.sliderSkel) {
                this.#dom.sliderSkel.style.display = 'none';
            }
        } catch {
            if (this.#dom.sliderSkel) this.#dom.sliderSkel.style.display = 'none';
        }
    }

    // ═════════════════════════════════════════════════
    // GRID RENDERING
    // ═════════════════════════════════════════════════
    #renderSkeleton() {
        if (!this.#dom.grid) return;
        this.#write(() => {
            this.#dom.grid.innerHTML = Array.from({ length: 12 }, () =>
                '<div class="skeleton-card"></div>'
            ).join('');
        });
    }

    #renderError(msg) {
        if (!this.#dom.grid) return;
        this.#write(() => {
            this.#dom.grid.innerHTML = `<div class="soft-fail">${esc(msg)}<div><button type="button" id="retryBtn">Retry</button></div></div>`;
            this.#root.querySelector('#retryBtn')?.addEventListener('click', () => {
                this.#resetAndFetch();
            });
        });
    }

    #renderEmpty() {
        if (!this.#dom.grid) return;
        this.#write(() => {
            this.#dom.grid.innerHTML = '<div class="no-results">No results found</div>';
        });
    }

    #renderCards(list) {
        if (!this.#dom.grid || !Array.isArray(list)) return;

        const frag = document.createDocumentFragment();
        for (let i = 0; i < list.length; i++) {
            const a = list[i];
            const card = document.createElement('article');
            card.className = 'anime-card visible';

            const ttl = a.title?.userPreferred || 'Anime';
            const slug = slugify(ttl);
            card.dataset.url = `/anime/${b64(a.id)}/${slug}`;
            card.dataset.id = a.id;
            card.dataset.title = ttl;
            card.dataset.genres = encodeURIComponent(JSON.stringify(a.genres || []));
            card.dataset.format = a.format || '';
            card.style.animationDelay = `${Math.min(i * 22, 180)}ms`;

            const sc = a.averageScore ? (a.averageScore / 10).toFixed(1) : '—';
            const cover = a.coverImage?.extraLarge || a.coverImage?.large || a.coverImage?.medium || '';
            const color = a.coverImage?.color || '#1a1a2e';

            let badge = '';
            if (a.nextAiringEpisode) {
                const na = a.nextAiringEpisode;
                const d = Math.floor(na.timeUntilAiring / 86400);
                const h = Math.floor((na.timeUntilAiring % 86400) / 3600);
                badge = `<div class="live-badge"><span class="live-dot"></span> EP ${na.episode} ${d ? `in ${d}d` : `in ${h}h`}</div>`;
            } else if (a.status === 'RELEASING') {
                badge = '<div class="live-badge"><span class="live-dot"></span> Airing</div>';
            }

            card.innerHTML = `<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-src="${esc(cover)}" class="card-img" alt="${esc(ttl)}" loading="lazy" decoding="async" style="background-color:${color}"><div class="card-glow"></div>${badge}<div class="card-info"><h3 class="card-title">${esc(ttl)}</h3><div class="card-meta"><span class="chip score">★ ${sc}</span><span class="chip">${esc(a.format || 'TV')}</span>${a.status ? `<span class="chip">${esc(a.status)}</span>` : ''}</div></div>`;
            frag.appendChild(card);
            this.#observeImg(card.querySelector('img'));
        }

        this.#write(() => {
            this.#dom.grid.appendChild(frag);
        });
    }

    // ═════════════════════════════════════════════════
    // GRID FETCH
    // ═════════════════════════════════════════════════
    #resetAndFetch() {
        this.#abort('grid');
        this.#state.page = 1;
        this.#state.hasNext = true;
        if (this.#dom.grid) this.#dom.grid.innerHTML = '';
        ++this.#seq.grid;
        void this.#fetchGrid();
    }

    async #fetchGrid() {
        if (this.#state.loading || !this.#state.hasNext || !this.#dom.grid) return;
        this.#state.loading = true;
        const reqId = ++this.#seq.grid;

        const cacheKey = `grid_${this.#state.page}_${this.#state.query || ''}_${this.#active.genre || ''}_${this.#active.format || ''}_${this.#active.year || ''}_${this.#active.status || ''}`;

        // Check local cache
        const cached = this.cache.get(cacheKey);
        if (!this.#dead && reqId === this.#seq.grid && cached) {
            if (this.#state.page === 1) this.#dom.grid.innerHTML = '';
            this.#renderCards(cached.list);
            this.#state.hasNext = cached.hasNext;
            this.#state.page++;
            this.#state.loading = false;
            this.#hideSpin();
            this.#initScrollSentinel();
            return;
        }

        if (this.#state.page === 1) this.#renderSkeleton();
        this.#showSpin();

        try {
            const params = { page: this.#state.page };
            if (this.#state.query) params.q = this.#state.query;
            if (this.#active.genre) params.genre = this.#active.genre;
            if (this.#active.format) params.format = this.#active.format;
            if (this.#active.year) params.year = this.#active.year;
            if (this.#active.status) params.status = this.#active.status;

            const route = this.#state.query ? 'search' : 'trending';
            const result = await this.api.fetch(route, params);

            if (this.#dead || reqId !== this.#seq.grid) {
                this.#state.loading = false;
                this.#hideSpin();
                return;
            }

            const list = result?.list || [];
            const hasNext = result?.hasNext ?? false;

            if (!list.length && this.#state.page === 1) {
                this.#renderEmpty();
            } else {
                this.cache.set(cacheKey, { list, hasNext });
                if (this.#state.page === 1) this.#dom.grid.innerHTML = '';
                this.#renderCards(list);
                this.#vib([8, 18, 8]);
            }

            this.#state.hasNext = hasNext;
            this.#state.page++;
        } catch (err) {
            if (this.#state.page === 1) {
                this.#renderError('Failed to load data');
                this.#vib([20, 40, 20]);
            }
        } finally {
            this.#state.loading = false;
            this.#hideSpin();
            this.#initScrollSentinel();
        }
    }

    // ═════════════════════════════════════════════════
    // SUGGESTIONS
    // ═════════════════════════════════════════════════
    async #fetchSug(q) {
        const n = q.trim().toLowerCase();
        if (n.length < 2) {
            this.#write(() => {
                if (this.#dom.sugBox) {
                    this.#dom.sugBox.innerHTML = '';
                    this.#dom.sugBox.classList.remove('active');
                }
                this.#sugIdx = -1;
            });
            return;
        }

        const reqId = ++this.#seq.sug;
        const cached = this.cache.get(`sug_${n}`);
        if (cached) {
            this.#renderSug(cached, n);
            return;
        }

        this.#abort('sug');

        try {
            const result = await this.api.fetch('suggestions', { q: n });
            if (this.#dead || reqId !== this.#seq.sug) return;

            const list = result?.list || [];
            this.cache.set(`sug_${n}`, list);
            this.#renderSug(list, n);
        } catch {
            // Silent fail for suggestions
        }
    }

    #renderSug(list, q = '') {
        const box = this.#dom.sugBox;
        if (!box) return;

        const safeQ = String(q || '').trim().toLowerCase();
        const highlight = (text) => {
            const raw = String(text || '');
            if (!safeQ) return esc(raw);
            const idx = raw.toLowerCase().indexOf(safeQ);
            if (idx < 0) return esc(raw);
            return esc(raw.slice(0, idx)) +
                `<span class="sug-h">${esc(raw.slice(idx, idx + safeQ.length))}</span>` +
                esc(raw.slice(idx + safeQ.length));
        };

        if (!list.length) {
            this.#write(() => {
                box.classList.remove('active');
                box.innerHTML = '';
            });
            this.#sugIdx = -1;
            return;
        }

        const html = list.map(a => {
            const title = a.title?.userPreferred || '';
            const slug = slugify(title);
            return `<button class="suggestion-item"
                type="button"
                data-url="/anime/${b64(a.id)}/${slug}"
                data-id="${a.id}"
                data-title="${esc(title)}">
                <img src="${esc(a.coverImage?.medium || '')}" class="suggestion-img" alt="${esc(title)}" loading="lazy" decoding="async">
                <div class="suggestion-info">
                    <div class="suggestion-title">${highlight(title)}</div>
                    <div class="suggestion-meta">
                        <span>${esc(a.format || 'TV')}</span>
                        <span>★ ${a.averageScore ? (a.averageScore / 10).toFixed(1) : '—'}</span>
                    </div>
                </div>
            </button>`;
        }).join('');

        this.#write(() => {
            box.innerHTML = html;
            box.classList.add('active');
        });
        this.#sugIdx = -1;
    }

    #moveSug(d) {
        const items = Array.from(this.#dom.sugBox?.querySelectorAll('.suggestion-item') ?? []);
        if (!items.length) return;
        this.#sugIdx = Math.max(0, Math.min(items.length - 1, this.#sugIdx + d));
        items.forEach((el, i) => el.classList.toggle('active', i === this.#sugIdx));
        items[this.#sugIdx]?.scrollIntoView({ block: 'nearest' });
        this.#dom.sugBox?.classList.add('active');
    }

    // ═════════════════════════════════════════════════
    // UI BINDINGS
    // ═════════════════════════════════════════════════
    #bindTap(container, selector, fn) {
        if (!container) return;

        const threshold = this.#touch ? 18 : 10;
        const maxDur = this.#touch ? 650 : 400;
        let active = null;

        const hDown = e => {
            const t = e.target.closest(selector);
            if (!t) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            active = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), target: t, moved: false };
        };

        const hMove = e => {
            if (!active || e.pointerId !== active.id) return;
            if (Math.hypot(e.clientX - active.x, e.clientY - active.y) > threshold) active.moved = true;
        };

        const hUp = e => {
            if (!active || e.pointerId !== active.id) return;
            const ok = !active.moved && (performance.now() - active.t) <= maxDur;
            const el = active.target;
            active = null;
            if (ok) fn(el, e);
        };

        const hCancel = () => { active = null; };

        container.addEventListener('pointerdown', hDown, { passive: true });
        container.addEventListener('pointermove', hMove, { passive: true });
        container.addEventListener('pointerup', hUp, { passive: true });
        container.addEventListener('pointercancel', hCancel, { passive: true });
        container.addEventListener('lostpointercapture', hCancel, { passive: true });

        this._listeners.push(
            { el: container, ev: 'pointerdown', fn: hDown },
            { el: container, ev: 'pointermove', fn: hMove },
            { el: container, ev: 'pointerup', fn: hUp },
            { el: container, ev: 'pointercancel', fn: hCancel },
            { el: container, ev: 'lostpointercapture', fn: hCancel }
        );
    }

    #navigate(url) {
        if (!url) return;
        if (typeof window.go === 'function') window.go(url);
        else window.location.href = url;
    }

    #bindUI() {
        const { searchIn, searchClr, sugBox, grid, sliderTrk, sliderDots, filterBtn, filterPop, filterApply, filterReset } = this.#dom;

        // Search Input
        if (searchIn) {
            const hInput = e => {
                const val = e.target.value.trim();
                searchClr?.classList.toggle('active', val.length > 0);

                clearTimeout(this.#tSuggest);
                this.#tSuggest = setTimeout(() => {
                    void this.#fetchSug(val);
                }, this.#touch ? CFG.SUGGEST_DEBOUNCE_MOBILE : CFG.SUGGEST_DEBOUNCE_PC);

                clearTimeout(this.#tSearch);
                this.#tSearch = setTimeout(() => {
                    const nq = val === '' ? null : val;
                    if (nq === this.#state.query) return;
                    this.#abort('grid');
                    this.#abort('sug');
                    this.#state.query = nq;
                    this.#sugIdx = -1;
                    sugBox?.classList.remove('active');
                    this.#resetAndFetch();
                }, this.#touch ? CFG.SEARCH_DEBOUNCE_MOBILE : CFG.SEARCH_DEBOUNCE_PC);
            };

            const hFocus = () => {
                if (sugBox?.innerHTML.trim()) sugBox.classList.add('active');
            };

            const hKey = e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); this.#moveSug(1); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); this.#moveSug(-1); }
                else if (e.key === 'Enter') {
                    const items = Array.from(sugBox?.querySelectorAll('.suggestion-item') ?? []);
                    if (this.#sugIdx >= 0 && items[this.#sugIdx]) {
                        e.preventDefault();
                        items[this.#sugIdx].click();
                    }
                }
                else if (e.key === 'Escape') { sugBox?.classList.remove('active'); this.#sugIdx = -1; }
            };

            searchIn.addEventListener('input', hInput);
            searchIn.addEventListener('focus', hFocus);
            searchIn.addEventListener('keydown', hKey);
            this._listeners.push(
                { el: searchIn, ev: 'input', fn: hInput },
                { el: searchIn, ev: 'focus', fn: hFocus },
                { el: searchIn, ev: 'keydown', fn: hKey }
            );
        }

        // Clear Button
        if (searchClr) {
            const hClr = () => {
                if (!searchIn) return;
                searchIn.value = '';
                this.#state.query = null;
                this.#sugIdx = -1;
                sugBox?.classList.remove('active');
                searchClr.classList.remove('active');
                this.#resetAndFetch();
                searchIn.focus();
                this.#vib(10);
            };
            searchClr.addEventListener('click', hClr);
            this._listeners.push({ el: searchClr, ev: 'click', fn: hClr });
        }

        // Close suggestions on outside click
        const hDocSug = e => {
            if (sugBox && searchIn && !sugBox.contains(e.target) && !searchIn.contains(e.target)) {
                sugBox.classList.remove('active');
            }
        };
        document.addEventListener('click', hDocSug, { passive: true });
        this._listeners.push({ el: document, ev: 'click', fn: hDocSug });

        // Grid Cards
        this.#bindTap(grid, '.anime-card', card => {
            this.#vib(10);
            this.#navigate(card.dataset.url);
        });

        // Slider
        this.#bindTap(sliderTrk, '.slide', slide => {
            this.#vib(10);
            this.#navigate(slide.dataset.url);
        });

        // Suggestions
        this.#bindTap(sugBox, '.suggestion-item', item => {
            this.#vib([8, 18, 8]);
            this.#navigate(item.dataset.url);
        });

        // Slider Dots
        if (sliderDots) {
            const hDots = e => {
                const dot = e.target.closest('.dot');
                if (!dot) return;
                this.#sliderGo(Number(dot.dataset.idx) || 0);
                this.#sliderStop();
                this.#sliderStart();
                this.#vib(10);
            };
            sliderDots.addEventListener('click', hDots, { passive: true });
            this._listeners.push({ el: sliderDots, ev: 'click', fn: hDots });
        }

        // Filter Popover
        if (filterBtn && filterPop) {
            const hToggle = e => {
                e.stopPropagation();
                const open = filterPop.classList.toggle('show');
                if (open) {
                    this.#pending = { ...this.#active };
                    this.#syncPopover();
                }
                this.#vib(10);
            };
            filterBtn.addEventListener('click', hToggle);
            this._listeners.push({ el: filterBtn, ev: 'click', fn: hToggle });

            if (filterApply) {
                const hApply = () => {
                    this.#active = { ...this.#pending };
                    filterPop.classList.remove('show');
                    filterBtn.classList.toggle('has-filters', !!(
                        this.#active.genre || this.#active.format ||
                        this.#active.year || this.#active.status
                    ));
                    this.#resetAndFetch();
                    this.#vib([8, 18, 8]);
                };
                filterApply.addEventListener('click', hApply);
                this._listeners.push({ el: filterApply, ev: 'click', fn: hApply });
            }

            if (filterReset) {
                const hReset = () => {
                    this.#pending = { genre: null, format: null, year: null, status: null };
                    this.#syncPopover();
                    this.#vib(10);
                };
                filterReset.addEventListener('click', hReset);
                this._listeners.push({ el: filterReset, ev: 'click', fn: hReset });
            }

            const hChip = e => {
                const chip = e.target.closest('.fp-chip');
                if (!chip) return;
                e.stopPropagation();
                this.#pending[chip.dataset.filter] = chip.dataset.value || null;
                this.#syncPopover();
            };
            filterPop.addEventListener('click', hChip);
            this._listeners.push({ el: filterPop, ev: 'click', fn: hChip });

            const hPopClose = e => {
                if (filterPop && filterBtn && !filterPop.contains(e.target) && !filterBtn.contains(e.target)) {
                    filterPop.classList.remove('show');
                }
            };
            document.addEventListener('click', hPopClose, { passive: true });
            this._listeners.push({ el: document, ev: 'click', fn: hPopClose });
        }

        // Keyboard Shortcuts
        const hDocKey = e => {
            const tag = document.activeElement?.tagName?.toUpperCase();
            const typing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchIn?.focus();
                searchIn?.select();
                return;
            }

            if (e.key === '/' && !typing) {
                e.preventDefault();
                searchIn?.focus();
                searchIn?.select();
                return;
            }

            if (e.key === 'Escape') {
                sugBox?.classList.remove('active');
                filterPop?.classList.remove('show');
                return;
            }

            if (!typing && this.#sliderData.length) {
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    this.#sliderGo((this.#sliderIdx + 1) % this.#sliderData.length);
                    this.#sliderStop();
                    this.#sliderStart();
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    this.#sliderGo((this.#sliderIdx - 1 + this.#sliderData.length) % this.#sliderData.length);
                    this.#sliderStop();
                    this.#sliderStart();
                }
            }
        };
        document.addEventListener('keydown', hDocKey);
        this._listeners.push({ el: document, ev: 'keydown', fn: hDocKey });

        // Visibility Change
        const hVis = () => {
            const hidden = document.hidden;
            this.#sliderPaused = hidden;
            if (this.#dom.ticker) this.#dom.ticker.style.animationPlayState = hidden ? 'paused' : 'running';
            if (hidden) this.#sliderStop();
            else if (this.#sliderData.length) this.#sliderStart();
        };
        document.addEventListener('visibilitychange', hVis, { passive: true });
        this._listeners.push({ el: document, ev: 'visibilitychange', fn: hVis });

        // Scroll State for Performance
        const hScrollState = () => {
            if (!this.#isScrolling) {
                this.#isScrolling = true;
                document.body.classList.add('is-scrolling');
            }
            clearTimeout(this.#scrollStopTimer);
            this.#scrollStopTimer = setTimeout(() => {
                this.#isScrolling = false;
                document.body.classList.remove('is-scrolling');
            }, 150);
        };
        window.addEventListener('scroll', hScrollState, { passive: true });
        this._listeners.push({ el: window, ev: 'scroll', fn: hScrollState });

        // Fallback Scroll for old browsers
        if (!('IntersectionObserver' in window)) {
            const hScroll = () => {
                if (this.#state.loading || !this.#state.hasNext) return;
                if ((innerHeight + scrollY) >= (document.documentElement.scrollHeight - CFG.SCROLL_THRESHOLD)) {
                    void this.#fetchGrid();
                }
            };
            window.addEventListener('scroll', hScroll, { passive: true });
            this._listeners.push({ el: window, ev: 'scroll', fn: hScroll });
        }

        // Resize
        const hResize = () => {
            if (this.#resizeRAF) return;
            this.#resizeRAF = requestAnimationFrame(() => {
                this.#resizeRAF = 0;
                this.#touch = matchMedia('(pointer: coarse)').matches || innerWidth < 768;
                document.documentElement.style.setProperty('--app-height', `${innerHeight}px`);
            });
        };
        window.addEventListener('resize', hResize, { passive: true });
        window.addEventListener('orientationchange', hResize, { passive: true });
        this._listeners.push(
            { el: window, ev: 'resize', fn: hResize },
            { el: window, ev: 'orientationchange', fn: hResize }
        );
    }

    #syncPopover() {
        const sync = (container, val) => {
            if (container) {
                container.querySelectorAll('.fp-chip').forEach(c => {
                    c.classList.toggle('active', (c.dataset.value || null) === val);
                });
            }
        };
        sync(this.#dom.genreF, this.#pending.genre);
        sync(this.#dom.formatF, this.#pending.format);
        sync(this.#dom.yearF, this.#pending.year);
        sync(this.#dom.statusF, this.#pending.status);
    }

    #showSpin() { this.#dom.searchSpin?.classList.add('active'); }
    #hideSpin() { this.#dom.searchSpin?.classList.remove('active'); }

    // ═════════════════════════════════════════════════
    // INIT & DESTROY
    // ═════════════════════════════════════════════════
    async init() {
        this.#cacheDom();
        this.#injectStyles();
        document.documentElement.style.setProperty('--app-height', `${innerHeight}px`);
        this.#bindUI();

        // Hero visibility observer
        if (this.#dom.hero && 'IntersectionObserver' in window) {
            const obs = new IntersectionObserver(([e]) => {
                const vis = !!e?.isIntersecting;
                this.#sliderPaused = !vis;
                if (this.#dom.ticker) this.#dom.ticker.style.animationPlayState = vis ? 'running' : 'paused';
                if (!vis) this.#sliderStop();
                else if (this.#sliderData.length) this.#sliderStart();
            }, { threshold: 0.25 });
            obs.observe(this.#dom.hero);
            this._listeners.push({ el: obs, ev: 'disconnect', fn: () => obs.disconnect() });
        }

        // Fetch initial data
        await Promise.allSettled([this.#fetchSlider(), this.#fetchGrid()]);
        return this;
    }

    destroy() {
        this.#dead = true;
        this.#sliderStop();

        for (const k in this.#ctl) this.#abort(k);
        this.#imgObs?.disconnect();
        this.#scrollObs?.disconnect();

        if (this.#writeRAF) cancelAnimationFrame(this.#writeRAF);
        if (this.#resizeRAF) cancelAnimationFrame(this.#resizeRAF);
        clearTimeout(this.#tSearch);
        clearTimeout(this.#tSuggest);
        clearTimeout(this.#scrollStopTimer);

        for (const { el, ev, fn } of this._listeners) {
            try {
                if (ev === 'disconnect') el();
                else el.removeEventListener(ev, fn);
            } catch {}
        }

        this._listeners = [];
        this.cache.clear();
        this.#prefetchUrls.clear();
    }
}

// ═════════════════════════════════════════════════════
// EXPORT
// ═════════════════════════════════════════════════════
window.AegisEngine = AegisEngine;