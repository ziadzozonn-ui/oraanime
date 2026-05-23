'use strict';

if (!Promise.withResolvers) {
    Promise.withResolvers = function () {
        let resolve, reject;
        const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
        return { promise, resolve, reject };
    };
}
 
const AEGIS_CONFIG = Object.freeze({
    API: 'https://graphql.anilist.co',
    PAGE_SIZE: 20,
    SLIDER_COUNT: 5,
    CACHE_TIME: 3600000,
    SCROLL_THRESHOLD: 850,
    IMAGE_ROOT_MARGIN: '500px',
    SEARCH_DEBOUNCE_PC: 140,
    SEARCH_DEBOUNCE_MOBILE: 280,
    SUGGEST_DEBOUNCE_PC: 110,
    SUGGEST_DEBOUNCE_MOBILE: 200,
    SLIDER_INTERVAL: 5200,
    DIVERSITY_FACTOR: 0.25,
    DECAY_DAYS: 30,
    PREFETCH_MAX_IMAGES: 4,
    API_TIMEOUT: 10000,
    SUGGESTION_CACHE_TTL: 180000,
    MIN_YEAR: 2023,
    SESSION_SEED: Math.random() * 9999,
    WRITE_FRAME_BUDGET: 8,
    DB_NAME: 'AEGIS_DB_V51_OPTIMIZED',
    SENTINEL_ID: 'loadMoreSentinel'
});

const idle = (fn, timeout = 1000) =>
    ('requestIdleCallback' in window)
        ? requestIdleCallback(fn, { timeout })
        : setTimeout(fn, 0);

const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c] ?? c));

const b64 = (v) => {
    try {
        return btoa(String(v));
    } catch {
        return btoa(unescape(encodeURIComponent(String(v))));
    }
};

/* ── Smart Sort Web Worker ─────────────────────────── */
const WORKER_BLOB = new Blob([`
'use strict';
const CONFIG = {
    DIVERSITY_FACTOR: 0.25,
    DECAY_DAYS: 30,
    MIN_YEAR: 2023,
    SESSION_SEED: ${AEGIS_CONFIG.SESSION_SEED}
};

function decay(profile, now) {
    const days = (now - (profile.ld || now)) / 86400000;
    if (days < 1) return profile;
    const f = Math.pow(0.97, days / CONFIG.DECAY_DAYS);
    const w = {}, fw = {};
    for (const k in profile.w) {
        const v = +(profile.w[k] * f).toFixed(1);
        if (v >= 0.1) w[k] = v;
    }
    for (const k in profile.fw) {
        const v = +(profile.fw[k] * f).toFixed(1);
        if (v >= 0.1) fw[k] = v;
    }
    return { w, fw, rg: profile.rg || [], ld: now };
}

function goldenScore(item, profile) {
    const year = item.seasonYear || (item.startDate && item.startDate.year) || 0;
    const avg = (item.averageScore || 0) / 10;
    const pop = Math.min(item.popularity || 0, 120000) / 12000;
    const trend = (item.trending || 0) / 100;
    const airing = item.status === 'RELEASING';
    const recent = year >= CONFIG.MIN_YEAR;

    let s = avg * 0.28 + pop * 0.12 + trend * 0.22;

    if (recent) s += (year - CONFIG.MIN_YEAR + 1) * 0.75;
    else if (year > 0 && year < CONFIG.MIN_YEAR) s -= Math.max(0, (CONFIG.MIN_YEAR - year) * 0.25);

    if (airing) s += 0.45;
    if (item.nextAiringEpisode) s += 0.15;

    const genres = item.genres || [];
    const fmt = item.format || '';
    s += genres.reduce((sum, g) => sum + (profile.w[g] || 0), 0) * 0.35;
    s += (profile.fw[fmt] || 0) * 0.25;

    const hash = ((item.id * 17 + CONFIG.SESSION_SEED) % 100) / 100;
    s += hash * 0.18;

    const overlap = genres.reduce((sum, g) => sum + (profile.rg.includes(g) ? 1 : 0), 0);
    s -= overlap * 0.08;

    return s;
}

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function smartSort(list, profile, now) {
    if (!list || !list.length) return list;
    const p = decay(profile, now);
    const scored = list.map(a => ({ a, s: goldenScore(a, p) }));
    const sorted = scored.toSorted((x, y) => y.s - x.s);

    if (sorted.length < 8) return sorted.map(x => x.a);

    const coreN = Math.max(1, Math.round(sorted.length * (1 - CONFIG.DIVERSITY_FACTOR)));
    const core = sorted.slice(0, coreN);
    const tail = shuffle(sorted.slice(coreN));
    const out = [];
    let ci = 0, ti = 0;

    while (ci < core.length || ti < tail.length) {
        if ((out.length + 1) % 4 === 0 && ti < tail.length) out.push(tail[ti++]);
        else if (ci < core.length) out.push(core[ci++]);
        else if (ti < tail.length) out.push(tail[ti++]);
    }

    return out.map(x => x.a);
}

self.onmessage = function(e) {
    const { list, profile, id } = e.data;
    try {
        const result = smartSort(list, profile, Date.now());
        self.postMessage({ id, result, ok: true });
    } catch (err) {
        self.postMessage({ id, result: null, ok: false, error: err.message });
    }
};
`], { type: 'application/javascript' });

/* ── DB (Enhanced with Batching & Auto-Cleanup) ────── */
class AegisDB {
    constructor(name = AEGIS_CONFIG.DB_NAME, version = 2) {
        this.name = name;
        this.version = version;
        this.db = null;
        this.fallbackPrefix = `${name}::`;
        this.useFallback = typeof indexedDB === 'undefined';
        this._batchQueue = [];
        this._batchTimer = null;
        this._batchRunning = false;
        this._autoCleanupComplete = false;
    }

    close() {
        if (this._batchTimer) clearTimeout(this._batchTimer);
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    async ready() {
        if (this.useFallback) return null;
        if (this.db) return this.db;

        const { promise, resolve, reject } = Promise.withResolvers();
        const req = indexedDB.open(this.name, this.version);

        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('c')) db.createObjectStore('c', { keyPath: 'k' });
            if (!db.objectStoreNames.contains('p')) db.createObjectStore('p', { keyPath: 'k' });
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);

        this.db = await promise;
        return this.db;
    }

    async get(s, k) {
        if (this.useFallback) {
            try {
                return JSON.parse(localStorage.getItem(`${this.name}:${s}:${k}`));
            } catch {
                return null;
            }
        }

        const db = await this.ready();
        const { promise, resolve, reject } = Promise.withResolvers();
        const req = db.transaction(s, 'readonly').objectStore(s).get(k);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
        return promise;
    }

    _enqueueBatch() {
        if (this._batchTimer) clearTimeout(this._batchTimer);
        this._batchTimer = setTimeout(() => {
            this._flushBatch().catch(() => {});
        }, 50);
    }

    async _flushBatch() {
        if (this._batchRunning || !this._batchQueue.length) return;
        this._batchRunning = true;
        const queue = this._batchQueue.splice(0);
        this._batchTimer = null;

        try {
            const db = await this.ready();
            const { promise, resolve, reject } = Promise.withResolvers();
            const tx = db.transaction(['c', 'p'], 'readwrite');
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);

            for (const { op, store, key, value } of queue) {
                if (op === 'put') tx.objectStore(store).put(value);
                else if (op === 'delete') tx.objectStore(store).delete(key);
            }

            return promise;
        } catch (e) {
            // ULTRA-SILENT
        } finally {
            this._batchRunning = false;
        }
    }

    async set(s, k, v) {
        if (this.useFallback) {
            try {
                localStorage.setItem(`${this.name}:${s}:${k}`, JSON.stringify({ k, v }));
            } catch {}
            return;
        }

        this._batchQueue.push({ op: 'put', store: s, key: k, value: { k, v } });
        this._enqueueBatch();
        return Promise.resolve();
    }

    async del(s, k) {
        if (this.useFallback) {
            localStorage.removeItem(`${this.name}:${s}:${k}`);
            return;
        }

        this._batchQueue.push({ op: 'delete', store: s, key: k });
        this._enqueueBatch();
        return Promise.resolve();
    }

    async getAll(s) {
        if (this.useFallback) {
            const out = [];
            const pfx = `${this.name}:${s}:`;
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k?.startsWith(pfx)) {
                    try {
                        out.push(JSON.parse(localStorage.getItem(k)));
                    } catch {}
                }
            }
            return out;
        }

        const db = await this.ready();
        const { promise, resolve, reject } = Promise.withResolvers();
        const req = db.transaction(s, 'readonly').objectStore(s).getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => reject(req.error);
        return promise;
    }

    async cleanupOldVersions() {
        if (this.useFallback || this._autoCleanupComplete) return;
        this._autoCleanupComplete = true;

        try {
            const dbs = await indexedDB.databases?.() || [];
            for (const dbInfo of dbs) {
                const dbVersion = parseInt(String(dbInfo.name || '').split('_V')[1]);
                const currentVersion = parseInt(String(this.name).split('_V')[1]);
                if (dbInfo.name && dbVersion && currentVersion && dbVersion < currentVersion && dbInfo.name.startsWith('AEGIS_DB_')) {
                    indexedDB.deleteDatabase(dbInfo.name).catch(() => {});
                }
            }
        } catch {}
    }

    async init() {
        await this.ready();
        await this.cleanupOldVersions();
    }
}

/* ── Engine (Fully Optimized) ───────────────────────── */
class AegisEngine {
    #state = { page: 1, loading: false, hasNext: true, query: null };
    #active = { genre: null, format: null, year: null, status: null };
    #pending = { genre: null, format: null, year: null, status: null };
    #profile = { w: {}, fw: {}, rg: [], ld: Date.now() };
    #ctl = { slider: null, grid: null, sug: null, pre: null };
    #seq = { slider: 0, grid: 0, sug: 0, pre: 0 };
    #prefetchUrls = new Set();
    #sugCache = new Map();
    #writeQueue = [];
    #writeRAF = 0;
    #resizeRAF = 0;
    #tSearch = 0;
    #tSuggest = 0;
    #sugIdx = -1;
    #prefetching = false;
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
    #worker = null;
    #workerId = 0;
    #workerResolvers = new Map();
    #globalAbort = new AbortController();
    #isScrolling = false; // Added for glow optimization
    #scrollStopTimer = null;
    _listeners = [];

    constructor(rootElement) {
        this.#root = rootElement || document;
        this.#touch = matchMedia('(pointer: coarse)').matches || innerWidth < 768;
        this.db = new AegisDB();
        this.#initWorker();
        this.#initObservers();
    }

    /* ── Web Worker Management ─────────────────────── */
    #initWorker() {
        try {
            const url = URL.createObjectURL(WORKER_BLOB);
            this.#worker = new Worker(url);
            URL.revokeObjectURL(url);

            this.#worker.onmessage = (e) => {
                const { id, result, ok, error } = e.data;
                const resolver = this.#workerResolvers.get(id);
                if (resolver) {
                    this.#workerResolvers.delete(id);
                    resolver.resolve(ok ? result : null);
                }
                if (!ok && error) console.warn('Worker error:', error);
            };

            this.#worker.onerror = (err) => {
                console.warn('Worker error:', err);
                this.#worker?.terminate();
                this.#worker = null;
                this.#workerResolvers.forEach(r => r.resolve(null));
                this.#workerResolvers.clear();
            };
        } catch (e) {
            this.#worker = null;
        }
    }

    async #sortInWorker(list) {
        if (!this.#worker) return this.#smartSortFallback(list);
        if (!list?.length) return list;

        const id = ++this.#workerId;
        const { promise, resolve } = Promise.withResolvers();
        this.#workerResolvers.set(id, { resolve });

        try {
            this.#worker.postMessage({
                list: list.map(a => ({
                    id: a.id,
                    averageScore: a.averageScore,
                    popularity: a.popularity,
                    trending: a.trending,
                    status: a.status,
                    seasonYear: a.seasonYear,
                    startDate: a.startDate,
                    nextAiringEpisode: a.nextAiringEpisode,
                    genres: a.genres,
                    format: a.format
                })),
                profile: {
                    w: this.#profile.w,
                    fw: this.#profile.fw,
                    rg: this.#profile.rg,
                    ld: this.#profile.ld
                },
                id
            });
        } catch {
            this.#workerResolvers.delete(id);
            return this.#smartSortFallback(list);
        }

        const sorted = await promise;
        if (!sorted) return this.#smartSortFallback(list);

        const idMap = new Map(list.map(a => [a.id, a]));
        return sorted.map(s => idMap.get(s.id)).filter(Boolean);
    }

    #smartSortFallback(list) {
        if (!list?.length) return list;
        const decay = () => {
            const days = (Date.now() - this.#profile.ld) / 86400000;
            if (days < 1) return;
            const f = Math.pow(0.97, days / AEGIS_CONFIG.DECAY_DAYS);
            for (const k in this.#profile.w) {
                this.#profile.w[k] = +(this.#profile.w[k] * f).toFixed(1);
                if (this.#profile.w[k] < 0.1) delete this.#profile.w[k];
            }
            for (const k in this.#profile.fw) {
                this.#profile.fw[k] = +(this.#profile.fw[k] * f).toFixed(1);
                if (this.#profile.fw[k] < 0.1) delete this.#profile.fw[k];
            }
            this.#profile.ld = Date.now();
        };
        const goldenScore = (item) => {
            const year = item.seasonYear || item.startDate?.year || 0;
            const avg = (item.averageScore || 0) / 10;
            const pop = Math.min(item.popularity || 0, 120000) / 12000;
            const trend = (item.trending || 0) / 100;
            const airing = item.status === 'RELEASING';
            const recent = year >= AEGIS_CONFIG.MIN_YEAR;
            let s = avg * 0.28 + pop * 0.12 + trend * 0.22;
            if (recent) s += (year - AEGIS_CONFIG.MIN_YEAR + 1) * 0.75;
            else if (year > 0 && year < AEGIS_CONFIG.MIN_YEAR) s -= Math.max(0, (AEGIS_CONFIG.MIN_YEAR - year) * 0.25);
            if (airing) s += 0.45;
            if (item.nextAiringEpisode) s += 0.15;
            const genres = item.genres || [];
            const fmt = item.format || '';
            s += genres.reduce((sum, g) => sum + (this.#profile.w[g] || 0), 0) * 0.35;
            s += (this.#profile.fw[fmt] || 0) * 0.25;
            const hash = ((item.id * 17 + AEGIS_CONFIG.SESSION_SEED) % 100) / 100;
            s += hash * 0.18;
            const overlap = genres.reduce((sum, g) => sum + (this.#profile.rg.includes(g) ? 1 : 0), 0);
            s -= overlap * 0.08;
            return s;
        };
        decay();
        const scored = list.map(a => ({ a, s: goldenScore(a) }));
        const sorted = scored.toSorted((x, y) => y.s - x.s);
        if (sorted.length < 8) return sorted.map(x => x.a);
        const coreN = Math.max(1, Math.round(sorted.length * (1 - AEGIS_CONFIG.DIVERSITY_FACTOR)));
        const core = sorted.slice(0, coreN);
        const tail = sorted.slice(coreN);
        for (let i = tail.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tail[i], tail[j]] = [tail[j], tail[i]];
        }
        const out = [];
        let ci = 0, ti = 0;
        while (ci < core.length || ti < tail.length) {
            if ((out.length + 1) % 4 === 0 && ti < tail.length) out.push(tail[ti++]);
            else if (ci < core.length) out.push(core[ci++]);
            else if (ti < tail.length) out.push(tail[ti++]);
        }
        return out.map(x => x.a);
    }

    /* ── Observers ──────────────────────────────────── */
    #initObservers() {
        if ('IntersectionObserver' in window) {
            this.#imgObs = new IntersectionObserver((entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        this.#lazyImg(e.target);
                        this.#imgObs.unobserve(e.target);
                    }
                }
            }, { rootMargin: AEGIS_CONFIG.IMAGE_ROOT_MARGIN, threshold: 0.01 });
        }
    }

    #initScrollSentinel() {
        if (!this.#dom.grid || !('IntersectionObserver' in window)) return;
        this.#scrollObs?.disconnect();

        let sentinel = document.getElementById(AEGIS_CONFIG.SENTINEL_ID);
        if (!sentinel) {
            sentinel = document.createElement('div');
            sentinel.id = AEGIS_CONFIG.SENTINEL_ID;
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

    /* ── Helpers ──────────────────────────────────────── */
    #write(fn) {
        this.#writeQueue.push(fn);
        if (this.#writeRAF) return;

        this.#writeRAF = requestAnimationFrame((timestamp) => {
            this.#writeRAF = 0;
            const start = performance.now();
            while (this.#writeQueue.length > 0) {
                const f = this.#writeQueue.shift();
                try { f(); } catch (e) { console.error(e); }
                if (performance.now() - start > AEGIS_CONFIG.WRITE_FRAME_BUDGET) break;
            }
            if (this.#writeQueue.length > 0) this.#write(() => {});
        });
    }

    #vib(p) { try { navigator.vibrate?.(p); } catch {} }
    #abort(w) { if (this.#ctl[w]) { this.#ctl[w].abort(); this.#ctl[w] = null; } }
    #safeParse(i, fb) { try { return typeof i === 'string' ? JSON.parse(i) : i; } catch { return fb; } }

    #slugify(text) {
        return String(text || '')
            .toLowerCase()
            .trim()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    /* ── Profile & Decay ──────────────────────────────── */
    async #loadProfile() {
        try {
            const r = await this.db.get('p', 'profile_v2');
            const d = r?.v ?? r ?? { w: {}, fw: {}, rg: [], ld: Date.now() };
            return { w: d.w ?? {}, fw: d.fw ?? {}, rg: Array.isArray(d.rg) ? d.rg : [], ld: d.ld ?? Date.now() };
        } catch {
            return { w: {}, fw: {}, rg: [], ld: Date.now() };
        }
    }

    #saveProfile() {
        if (this.#dead) return;
        idle(() => this.db.set('p', 'profile_v2', this.#profile).catch(() => {}), 1500);
    }

    #track(genres, fmt) {
        if (!Array.isArray(genres) || !genres.length) return;
        for (const g of genres) this.#profile.w[g] = (this.#profile.w[g] || 0) + 1;
        if (fmt) this.#profile.fw[fmt] = (this.#profile.fw[fmt] || 0) + 0.5;
        this.#profile.rg = [...this.#profile.rg, ...genres].slice(-12);
        this.#saveProfile();
    }

    /* ── Memoization for Cards ──────────────────────────── */
    #memoSort = new Map();
    #memoKey = '';

    #getMemoKey() {
        return `${this.#state.query || 'ALL'}_G${this.#active.genre || 'ALL'}_F${this.#active.format || 'ALL'}_Y${this.#active.year || 'ALL'}_S${this.#active.status || 'ALL'}`;
    }

    #invalidateMemo(key) {
        if (key) this.#memoSort.delete(key);
        else this.#memoSort.clear();
    }

    /* ── Cache ────────────────────────────────────────── */
    async #cacheGet(key) {
        try {
            const r = await this.db.get('c', key);
            const v = r?.v ?? r;
            if (!v) return null;
            if (v.e && Date.now() > v.e) {
                await this.db.del('c', key);
                return null;
            }
            return { list: v.d ?? [], hasNext: v.h };
        } catch {
            return null;
        }
    }

    async #cacheSet(key, data, hasNext) {
        const p = { t: Date.now(), e: Date.now() + AEGIS_CONFIG.CACHE_TIME, d: data, h: hasNext };
        try {
            await this.db.set('c', key, p);
        } catch (e) {
            if (e?.name === 'QuotaExceededError') {
                await this.#purgeCache();
                try { await this.db.set('c', key, p); } catch {}
            }
        }
    }

    async #purgeCache() {
        try {
            const all = await this.db.getAll('c');
            const now = Date.now();
            const valid = [];

            for (const r of all) {
                const k = r?.k, v = r?.v ?? r;
                if (!k || !v) continue;
                if (v.e && now > v.e) await this.db.del('c', k);
                else valid.push({ k, t: v.t ?? 0 });
            }

            if (valid.length > 20) {
                const old = valid.toSorted((a, b) => a.t - b.t);
                const rm = Math.ceil(old.length / 2);
                for (let i = 0; i < rm; i++) await this.db.del('c', old[i].k);
            }
        } catch {}
    }

    /* ── DOM & Styles ─────────────────────────────────── */
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
            statusF: r.querySelector('#statusFilters')
        };

        if (this.#dom.sliderTrk) {
            this.#dom.sliderTrk.style.direction = 'ltr';
            this.#dom.sliderTrk.style.willChange = 'transform';
        }
    }

    #injectStyles() {
        if (document.getElementById('aegis50-css')) return;
        const s = document.createElement('style');
        s.id = 'aegis50-css';
        s.textContent = `
.anime-card,.slide,.suggestion-item{touch-action:pan-y}

/* ★ ULTIMATE SCROLL PERFORMANCE ★ */
.anime-card{
    position:relative;
    border-radius:16px;
    overflow:hidden;
    aspect-ratio:2/3;
    cursor:pointer;
    background:linear-gradient(180deg,rgba(14,32,68,.85),rgba(8,16,36,.95));
    border:1px solid rgba(189,232,245,.06);
    
    /* 1. Removed translateZ(0) & will-change to save GPU Memory */
    /* 2. Removed isolation: isolate (Huge performance killer for scrolling) */
    content-visibility:auto;
    contain:layout style paint;
    contain-intrinsic-size:160px 240px;
    
    transition:transform .2s ease,box-shadow .2s ease,opacity .2s ease;
}

.anime-card.visible{animation:aegis-up .3s ease both}

.anime-card:hover{
    transform:translateY(-5px) scale(1.02);
    box-shadow:0 14px 38px rgba(0,0,0,.35),0 0 0 1px rgba(100,180,255,.15);
    z-index:2;
    will-change:transform;
}

.anime-card:active{transform:scale(.97)!important;transition-duration:.08s!important}
@media(pointer:coarse){.anime-card:hover{transform:scale(1.01)}}

.anime-card .card-img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .3s ease,transform .4s ease;transform:scale(1.03)}
.anime-card .card-img.loaded{opacity:1;transform:scale(1)}
.anime-card .card-img.failed{opacity:.25}

/* ★ OPTIMIZED GLOW - Smaller radius & Paused during scroll */
.anime-card .card-glow{
    position:absolute;inset:0;
    background:radial-gradient(120px circle at var(--mx,50%) var(--my,50%),rgba(100,180,255,.14),transparent 60%);
    opacity:0;transition:opacity .2s;pointer-events:none;z-index:1;
}
.anime-card:hover .card-glow{opacity:1}
body.is-scrolling .anime-card .card-glow{display:none}

/* ★ BLUR ONLY ON HOVER (Huge CPU/GPU save) */
.anime-card .card-info{
    position:absolute;bottom:0;left:0;right:0;
    padding:36px 10px 10px;
    background:linear-gradient(0deg,rgba(6,14,32,.98) 0%,rgba(6,14,32,.75) 55%,transparent 100%);
    z-index:2;pointer-events:none;
    transition:backdrop-filter .2s ease, -webkit-backdrop-filter .2s ease;
}
.anime-card:hover .card-info{
    backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
}

.anime-card .card-title{font-size:13px;font-weight:700;color:#e8f4ff;line-height:1.35;margin:0 0 5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-shadow:0 2px 8px rgba(0,0,0,.8)}
.anime-card .card-meta{display:flex;gap:5px;flex-wrap:wrap}
.anime-card .chip{font-size:10px;padding:2px 7px;border-radius:6px;background:rgba(189,232,245,.08);color:rgba(189,232,245,.65);border:1px solid rgba(189,232,245,.06)}
.anime-card .chip.score{color:#ffd966;border-color:rgba(255,217,102,.12)}

/* ★ REMOVED CONSTANT BLUR FROM LIVE BADGE */
.anime-card .live-badge{position:absolute;top:8px;left:8px;display:flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:#fff;background:rgba(220,38,38,.9);padding:3px 8px;border-radius:6px;z-index:3}
.anime-card .live-dot{width:6px;height:6px;border-radius:50%;background:#fff;animation:aegis-pulse 1.2s infinite}

.sug-h{color:#60a5fa;font-weight:700}
@keyframes aegis-pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes aegis-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.skeleton-card{position:relative;overflow:hidden;border-radius:16px;aspect-ratio:2/3;background:linear-gradient(180deg,rgba(14,32,68,.7),rgba(8,16,36,.9));border:1px solid rgba(189,232,245,.06)}
.skeleton-card::after{content:'';position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.06) 40%,rgba(255,255,255,.1) 50%,rgba(255,255,255,.06) 60%,transparent);animation:aegis-shim 1.4s infinite}
@keyframes aegis-shim{to{transform:translateX(100%)}}
`;
        document.head.appendChild(s);
    }

    /* ── Image Handling ───────────────────────────────── */
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

    #observeImg(img) { if (!img) return; this.#imgObs ? this.#imgObs.observe(img) : this.#lazyImg(img); }

    #warmImages(list, hero = false) {
        const urls = (list ?? [])
            .map(a => a?.bannerImage || a?.coverImage?.extraLarge || a?.coverImage?.medium || '')
            .filter(Boolean)
            .slice(0, hero ? 8 : AEGIS_CONFIG.PREFETCH_MAX_IMAGES);

        for (const u of urls) {
            if (this.#prefetchUrls.has(u)) continue;
            this.#prefetchUrls.add(u);
            const img = new Image();
            img.decoding = 'async';
            img.src = u;
            if (img.decode) img.decode().catch(() => {});
        }
    }

    /* ── GraphQL & API ────────────────────────────────── */
    async #gql(query, vars, ctl, timeout = AEGIS_CONFIG.API_TIMEOUT) {
        let timedOut = false;
        const tid = setTimeout(() => { timedOut = true; try { ctl.abort(); } catch {} }, timeout);
        try {
            const res = await fetch(AEGIS_CONFIG.API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables: vars }),
                signal: ctl.signal
            });
            if (!res.ok) throw new Error(`HTTP_${res.status}`);
            return { ok: true, data: await res.json(), timedOut: false };
        } catch (err) {
            return { ok: false, err, timedOut };
        } finally {
            clearTimeout(tid);
        }
    }

    #gridQuery() {
        return `query($p:Int,$s:String,$genre:[String],$format:MediaFormat,$year:Int,$status:MediaStatus){Page(page:$p,perPage:${AEGIS_CONFIG.PAGE_SIZE}){pageInfo{hasNextPage}media(search:$s,type:ANIME,genre_in:$genre,format:$format,seasonYear:$year,status:$status,sort:[TRENDING_DESC,POPULARITY_DESC],isAdult:false){id title{userPreferred}coverImage{extraLarge large medium}averageScore popularity trending status seasonYear startDate{year}episodes format genres nextAiringEpisode{episode timeUntilAiring}}}}`;
    }

    /* ── Slider ───────────────────────────────────────── */
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
        }, AEGIS_CONFIG.SLIDER_INTERVAL);
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
            const slug = this.#slugify(a.title?.userPreferred || 'anime');

            return `<div class="slide"
                data-url="/anime/${b64(a.id)}/${slug}"
                data-id="${a.id}"
                data-title="${ttl}"
                data-genres="${esc(encodeURIComponent(JSON.stringify(a.genres || [])))}"
                data-format="${esc(a.format || '')}">
                <img class="slide-media" src="${esc(img)}" alt="${ttl}" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async" fetchpriority="${i === 0 ? 'high' : 'low'}" onerror="this.src='https://via.placeholder.com/1200x600/0E2044/BDE8F5?text=—'">
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

        const dots = list.map((_, i) => `<button class="dot${i === 0 ? ' active' : ''}" data-idx="${i}" type="button" aria-label="شريحة ${i + 1}"></button>`).join('');

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
        this.#warmImages(list, true);
    }

    async #fetchSlider() {
        this.#abort('slider');
        const ctl = new AbortController();
        this.#ctl.slider = ctl;
        const seq = ++this.#seq.slider;

        const cached = await this.#cacheGet('slider_v51');
        if (this.#dead || seq !== this.#seq.slider) return;
        if (cached?.list?.length) {
            this.#sliderData = cached.list;
            this.#renderSlider(cached.list);
            return;
        }

        const q = `{Page(page:1,perPage:${AEGIS_CONFIG.SLIDER_COUNT}){media(sort:TRENDING_DESC,type:ANIME,isAdult:false){id title{userPreferred}bannerImage coverImage{extraLarge}averageScore seasonYear format genres}}}`;
        const { ok, data } = await this.#gql(q, undefined, ctl);

        if (this.#dead || seq !== this.#seq.slider) return;
        if (!ok) {
            if (this.#dom.sliderSkel) this.#dom.sliderSkel.style.display = 'none';
            return;
        }

        const list = data?.data?.Page?.media ?? [];
        if (!list.length) {
            if (this.#dom.sliderSkel) this.#dom.sliderSkel.style.display = 'none';
            return;
        }

        await this.#cacheSet('slider_v51', list, true);
        if (this.#dead || seq !== this.#seq.slider) return;

        this.#sliderData = list;
        this.#renderSlider(list);
    }

    /* ── Grid Rendering ───────────────────────────────── */
    #renderSkeleton() {
        if (!this.#dom.grid) return;
        this.#write(() => {
            this.#dom.grid.innerHTML = Array.from({ length: 12 }, () => '<div class="skeleton-card"></div>').join('');
        });
    }

    #renderError(msg) {
        if (!this.#dom.grid) return;
        this.#write(() => {
            this.#dom.grid.innerHTML = `<div class="soft-fail">${esc(msg)}<div><button type="button" id="retryBtn">إعادة المحاولة</button></div></div>`;
            this.#root.querySelector('#retryBtn')?.addEventListener('pointerdown', () => {
                this.#vib(10);
                this.#resetAndFetch();
            }, { passive: true });
        });
    }

    #renderEmpty() {
        if (!this.#dom.grid) return;
        this.#write(() => {
            this.#dom.grid.innerHTML = '<div class="no-results">لا توجد نتائج تطابق بحثك أو الفلاتر المحددة</div>';
        });
    }

    #renderCards(list) {
        if (!this.#dom.grid || !Array.isArray(list)) return;

        const frag = document.createDocumentFragment();
        for (let i = 0; i < list.length; i++) {
            const a = list[i];
            const card = document.createElement('article');
            
            // ★ Applied directly to avoid Layout Thrashing (Reflow)
            card.className = 'anime-card visible'; 

            const ttl = a.title?.userPreferred || 'Anime';
            const slug = this.#slugify(ttl);

            card.dataset.url = `/anime/${b64(a.id)}/${slug}`;
            card.dataset.id = a.id;
            card.dataset.title = ttl;
            card.dataset.genres = encodeURIComponent(JSON.stringify(a.genres || []));
            card.dataset.format = a.format || '';
            card.style.animationDelay = `${Math.min(i * 22, 180)}ms`;

            const sc = a.averageScore ? (a.averageScore / 10).toFixed(1) : '—';
            const cover = a.coverImage?.extraLarge || a.coverImage?.large || a.coverImage?.medium || '';

            let badge = '';
            if (a.nextAiringEpisode) {
                const s = a.nextAiringEpisode.timeUntilAiring;
                const d = Math.floor(s / 86400);
                const h = Math.floor((s % 86400) / 3600);
                badge = `<div class="live-badge"><span class="live-dot"></span> EP ${a.nextAiringEpisode.episode} ${d ? `في ${d}ي` : `في ${h}س`}</div>`;
            } else if (a.status === 'RELEASING') {
                badge = '<div class="live-badge"><span class="live-dot"></span> يعرض الآن</div>';
            }

            card.innerHTML = `<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-src="${esc(cover)}" class="card-img" alt="${esc(ttl)}" loading="lazy" decoding="async"><div class="card-glow"></div>${badge}<div class="card-info"><h3 class="card-title">${esc(ttl)}</h3><div class="card-meta"><span class="chip score">★ ${sc}</span><span class="chip">${esc(a.format || 'TV')}</span>${a.status ? `<span class="chip">${esc(a.status)}</span>` : ''}</div></div>`;
            frag.appendChild(card);
            this.#observeImg(card.querySelector('img'));
        }

        // ★ Direct append without querying the DOM again
        this.#write(() => {
            this.#dom.grid.appendChild(frag);
        });
    }

    /* ── Grid Fetch ───────────────────────────────────── */
    #resetAndFetch() {
        this.#abort('grid');
        this.#abort('pre');
        this.#state.page = 1;
        this.#state.hasNext = true;
        if (this.#dom.grid) this.#dom.grid.innerHTML = '';
        this.#invalidateMemo();
        ++this.#seq.grid;
        ++this.#seq.pre;
        void this.#fetchGrid();
    }

    async #fetchGrid() {
        if (this.#state.loading || !this.#state.hasNext || !this.#dom.grid) return;
        this.#state.loading = true;
        const reqId = ++this.#seq.grid;

        const ck = this.#getMemoKey();
        const fullCk = `P${this.#state.page}_${ck}`;

        const cached = await this.#cacheGet(fullCk);
        if (this.#dead || reqId !== this.#seq.grid) {
            this.#state.loading = false;
            return;
        }

        if (cached) {
            if (this.#state.page === 1) this.#dom.grid.innerHTML = '';
            this.#renderCards(cached.list);
            this.#state.hasNext = cached.hasNext ?? true;
            this.#state.page++;
            this.#state.loading = false;
            this.#hideSpin();
            this.#schedulePrefetch();
            this.#initScrollSentinel();
            return;
        }

        if (this.#state.page === 1) this.#renderSkeleton();
        this.#abort('grid');
        const ctl = new AbortController();
        this.#ctl.grid = ctl;
        this.#showSpin();

        const vars = { p: this.#state.page, s: this.#state.query };
        if (this.#active.genre) vars.genre = [this.#active.genre];
        if (this.#active.format) vars.format = this.#active.format;
        if (this.#active.year) vars.year = parseInt(this.#active.year);
        if (this.#active.status) vars.status = this.#active.status;

        const { ok, data, timedOut } = await this.#gql(this.#gridQuery(), vars, ctl);
        if (this.#dead || reqId !== this.#seq.grid) {
            this.#state.loading = false;
            this.#hideSpin();
            return;
        }

        if (!ok) {
            if (!timedOut && ctl.signal.aborted) {
                this.#state.loading = false;
                this.#hideSpin();
                return;
            }
            if (this.#state.page === 1) {
                this.#renderError('حدثت مشكلة في تحميل البيانات');
                this.#vib([20, 40, 20]);
            }
            this.#state.loading = false;
            this.#hideSpin();
            return;
        }

        const page = data?.data?.Page;
        if (!page?.media) {
            this.#state.loading = false;
            this.#hideSpin();
            return;
        }

        if (this.#state.page === 1) this.#dom.grid.innerHTML = '';

        let list = page.media;
        const shouldSort = !this.#state.query && !this.#active.genre && !this.#active.format && !this.#active.year && !this.#active.status;

        if (shouldSort) {
            if (this.#memoSort.has(ck)) {
                list = this.#memoSort.get(ck);
            } else {
                list = await this.#sortInWorker(list);
                if (list) this.#memoSort.set(ck, list);
            }
        }

        if (!list.length && this.#state.page === 1) {
            this.#renderEmpty();
        } else {
            await this.#cacheSet(fullCk, list, page.pageInfo.hasNextPage);
            if (this.#dead || reqId !== this.#seq.grid) {
                this.#state.loading = false;
                this.#hideSpin();
                return;
            }
            this.#renderCards(list);
            this.#vib([8, 18, 8]);
        }

        this.#state.hasNext = page.pageInfo.hasNextPage;
        this.#state.page++;
        this.#state.loading = false;
        this.#hideSpin();
        this.#schedulePrefetch();
        this.#initScrollSentinel();
    }

    /* ── Prefetch & Suggestions ───────────────────────── */
    #schedulePrefetch() {
        if (this.#state.hasNext && !this.#dead) idle(() => void this.#prefetch(), 800);
    }

    async #prefetch() {
        if (this.#prefetching || this.#state.loading || !this.#state.hasNext || this.#dead) return;

        const reqId = ++this.#seq.pre;
        const np = this.#state.page;
        const ck = this.#getMemoKey();
        const fullCk = `P${np}_${ck}`;
        if (await this.#cacheGet(fullCk)) return;
        if (this.#dead || reqId !== this.#seq.pre) return;

        this.#prefetching = true;
        this.#abort('pre');
        const ctl = new AbortController();
        this.#ctl.pre = ctl;

        try {
            const vars = { p: np, s: this.#state.query };
            if (this.#active.genre) vars.genre = [this.#active.genre];
            if (this.#active.format) vars.format = this.#active.format;
            if (this.#active.year) vars.year = parseInt(this.#active.year);
            if (this.#active.status) vars.status = this.#active.status;

            const { ok, data } = await this.#gql(this.#gridQuery(), vars, ctl, 10000);
            if (this.#dead || reqId !== this.#seq.pre || !ok) return;

            const page = data?.data?.Page;
            if (!page?.media) return;

            let list = page.media;
            const shouldSort = !this.#state.query && !this.#active.genre && !this.#active.format && !this.#active.year && !this.#active.status;

            if (shouldSort) {
                list = await this.#sortInWorker(list);
                if (list) this.#memoSort.set(ck, list);
            }

            await this.#cacheSet(fullCk, list, page.pageInfo.hasNextPage);
            this.#warmImages(list);
        } catch (e) {
            if (e?.name !== 'AbortError') console.warn('Prefetch:', e);
        } finally {
            this.#prefetching = false;
        }
    }

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
        const cached = this.#getSugCache(n);
        if (cached) {
            this.#renderSug(cached, n);
            return;
        }

        this.#abort('sug');
        const ctl = new AbortController();
        this.#ctl.sug = ctl;

        const gql = `query($s:String){Page(page:1,perPage:5){media(search:$s,type:ANIME,sort:SEARCH_MATCH,isAdult:false){id title{userPreferred}coverImage{medium}seasonYear format averageScore}}}`;
        const { ok, data } = await this.#gql(gql, { s: q }, ctl, 7000);
        if (this.#dead || reqId !== this.#seq.sug) return;
        if (!ok) return;

        const list = data?.data?.Page?.media ?? [];
        this.#setSugCache(n, list);
        this.#renderSug(list, n);
    }

    #getSugCache(q) {
        const h = this.#sugCache.get(q);
        if (!h) return null;
        if (Date.now() - h.t > AEGIS_CONFIG.SUGGESTION_CACHE_TTL) {
            this.#sugCache.delete(q);
            return null;
        }
        return h.list;
    }

    #setSugCache(q, list) {
        this.#sugCache.set(q, { t: Date.now(), list });
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
            return esc(raw.slice(0, idx)) + `<span class="sug-h">${esc(raw.slice(idx, idx + safeQ.length))}</span>` + esc(raw.slice(idx + safeQ.length));
        };

        const ranked = list.toSorted((a, b) => {
            const nq = safeQ;
            const at = a.title?.userPreferred?.toLowerCase() || '';
            const bt = b.title?.userPreferred?.toLowerCase() || '';
            return ((b.averageScore || 0) / 10 + (bt.startsWith(nq) ? 3 : 0) + (bt.includes(nq) ? 1.5 : 0)) -
                   ((a.averageScore || 0) / 10 + (at.startsWith(nq) ? 3 : 0) + (at.includes(nq) ? 1.5 : 0));
        });

        if (!ranked.length) {
            this.#write(() => {
                box.classList.remove('active');
                box.innerHTML = '';
            });
            this.#sugIdx = -1;
            return;
        }

        const html = ranked.map(a => {
            const title = a.title?.userPreferred || '';
            const slug = this.#slugify(title);

            return `<button class="suggestion-item"
                type="button"
                data-url="/anime/${b64(a.id)}/${slug}"
                data-id="${a.id}"
                data-title="${esc(title)}">
                <img src="${esc(a.coverImage?.medium || '')}" class="suggestion-img" alt="${esc(title)}" loading="lazy" decoding="async">
                <div class="suggestion-info">
                    <div class="suggestion-title">${highlight(title)}</div>
                    <div class="suggestion-meta">
                        ${a.seasonYear ? `<span>${esc(a.seasonYear)}</span>` : ''}
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

    /* ── UI Bindings ──────────────────────────────────── */
    #bindTap(container, selector, fn, opts = {}) {
        if (!container) return;

        const threshold = opts.threshold ?? (this.#touch ? 18 : 10);
        const maxDur = opts.maxDur ?? (this.#touch ? 650 : 400);
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

            if (ok) {
                const title = el.dataset.title || el.querySelector('.card-title, .slide-title, .suggestion-title')?.textContent;
                if (title) {
                    this.#write(() => {
                        document.title = String(title).trim();
                    });
                }
                fn(el, e);
            }
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

    #bindUI() {
        const { searchIn, searchClr, sugBox, grid, sliderTrk, sliderDots, filterBtn, filterPop, filterApply, filterReset } = this.#dom;

        if (searchIn) {
            const hInput = e => {
                const val = e.target.value.trim();
                searchClr?.classList.toggle('active', val.length > 0);

                clearTimeout(this.#tSuggest);
                this.#tSuggest = window.setTimeout(() => void this.#fetchSug(val), this.#touch ? AEGIS_CONFIG.SUGGEST_DEBOUNCE_MOBILE : AEGIS_CONFIG.SUGGEST_DEBOUNCE_PC);

                clearTimeout(this.#tSearch);
                this.#tSearch = window.setTimeout(() => {
                    const nq = val === '' ? null : val;
                    if (nq === this.#state.query) return;
                    this.#abort('grid');
                    this.#abort('sug');
                    this.#state.query = nq;
                    this.#sugIdx = -1;
                    sugBox?.classList.remove('active');
                    this.#invalidateMemo();
                    this.#resetAndFetch();
                }, this.#touch ? AEGIS_CONFIG.SEARCH_DEBOUNCE_MOBILE : AEGIS_CONFIG.SEARCH_DEBOUNCE_PC);
            };

            const hFocus = () => { if (sugBox?.innerHTML.trim()) sugBox.classList.add('active'); };
            const hKey = e => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.#moveSug(1);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.#moveSug(-1);
                } else if (e.key === 'Enter') {
                    const items = Array.from(sugBox?.querySelectorAll('.suggestion-item') ?? []);
                    if (this.#sugIdx >= 0 && items[this.#sugIdx]) {
                        e.preventDefault();
                        items[this.#sugIdx].dispatchEvent(new PointerEvent('pointerdown', {
                            bubbles: true,
                            cancelable: true,
                            pointerType: 'mouse',
                            button: 0
                        }));
                    }
                } else if (e.key === 'Escape') {
                    sugBox?.classList.remove('active');
                    this.#sugIdx = -1;
                }
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

        if (searchClr) {
            const hClr = () => {
                if (!searchIn) return;
                searchIn.value = '';
                this.#state.query = null;
                this.#sugIdx = -1;
                sugBox?.classList.remove('active');
                searchClr.classList.remove('active');
                this.#invalidateMemo();
                this.#resetAndFetch();
                searchIn.focus();
                this.#vib(10);
            };
            searchClr.addEventListener('pointerdown', hClr, { passive: true });
            this._listeners.push({ el: searchClr, ev: 'pointerdown', fn: hClr });
        }

        const hDocSug = e => {
            if (sugBox && searchIn && !sugBox.contains(e.target) && !searchIn.contains(e.target)) sugBox.classList.remove('active');
        };
        document.addEventListener('pointerdown', hDocSug, { passive: true });
        this._listeners.push({ el: document, ev: 'pointerdown', fn: hDocSug });

        this.#bindTap(grid, '.anime-card', card => {
            const url = card.dataset.url;
            if (!url) return;
            this.#vib(10);
            this.#track(this.#safeParse(card.dataset.genres, []), card.dataset.format || '');
            if (typeof window.go === 'function') window.go(url);
            else window.location.href = url;
        });

        this.#bindTap(sliderTrk, '.slide', slide => {
            const url = slide.dataset.url;
            if (!url) return;
            this.#vib(10);
            this.#track(this.#safeParse(decodeURIComponent(slide.dataset.genres || '[]'), []), slide.dataset.format || '');
            if (typeof window.go === 'function') window.go(url);
            else window.location.href = url;
        });

        this.#bindTap(sugBox, '.suggestion-item', item => {
            const url = item.dataset.url;
            if (!url) return;
            this.#vib([8, 18, 8]);
            if (typeof window.go === 'function') window.go(url);
            else window.location.href = url;
        });

        if (sliderDots) {
            const hDots = e => {
                const dot = e.target.closest('.dot');
                if (!dot) return;
                this.#sliderGo(Number(dot.dataset.idx) || 0);
                this.#sliderStop();
                this.#sliderStart();
                this.#vib(10);
            };
            sliderDots.addEventListener('pointerdown', hDots, { passive: true });
            this._listeners.push({ el: sliderDots, ev: 'pointerdown', fn: hDots });
        }

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
            filterBtn.addEventListener('pointerdown', hToggle, { passive: false });
            this._listeners.push({ el: filterBtn, ev: 'pointerdown', fn: hToggle });

            if (filterApply) {
                const hApply = () => {
                    this.#active = { ...this.#pending };
                    filterPop.classList.remove('show');
                    filterBtn.classList.toggle('has-filters', !!(this.#active.genre || this.#active.format || this.#active.year || this.#active.status));
                    this.#invalidateMemo();
                    this.#resetAndFetch();
                    this.#vib([8, 18, 8]);
                };
                filterApply.addEventListener('pointerdown', hApply, { passive: true });
                this._listeners.push({ el: filterApply, ev: 'pointerdown', fn: hApply });
            }

            if (filterReset) {
                const hReset = () => {
                    this.#pending = { genre: null, format: null, year: null, status: null };
                    this.#syncPopover();
                    this.#vib(10);
                };
                filterReset.addEventListener('pointerdown', hReset, { passive: true });
                this._listeners.push({ el: filterReset, ev: 'pointerdown', fn: hReset });
            }

            const hChip = e => {
                const chip = e.target.closest('.fp-chip');
                if (!chip) return;
                e.stopPropagation();
                this.#pending[chip.dataset.filter] = chip.dataset.value || null;
                this.#syncPopover();
            };
            filterPop.addEventListener('pointerdown', hChip, { passive: true });
            this._listeners.push({ el: filterPop, ev: 'pointerdown', fn: hChip });

            const hPopClose = e => {
                if (filterPop && filterBtn && !filterPop.contains(e.target) && !filterBtn.contains(e.target)) {
                    filterPop.classList.remove('show');
                }
            };
            document.addEventListener('pointerdown', hPopClose, { passive: true });
            this._listeners.push({ el: document, ev: 'pointerdown', fn: hPopClose });
        }

        const hDocKey = e => {
            const tag = document.activeElement?.tagName?.toUpperCase();
            const typing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchIn?.focus();
                searchIn?.select?.();
                return;
            }

            if (e.key === '/' && !typing) {
                e.preventDefault();
                searchIn?.focus();
                searchIn?.select?.();
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

        const hVis = () => {
            const hidden = document.hidden;
            this.#sliderPaused = hidden;
            if (this.#dom.ticker) this.#dom.ticker.style.animationPlayState = hidden ? 'paused' : 'running';
            if (hidden) this.#sliderStop();
            else if (this.#sliderData.length) this.#sliderStart();
        };
        document.addEventListener('visibilitychange', hVis, { passive: true });
        this._listeners.push({ el: document, ev: 'visibilitychange', fn: hVis });

        // ★ ADDED SCROLL STATE FOR GLOW PERFORMANCE
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

        if (!('IntersectionObserver' in window)) {
            const hScroll = () => {
                if (this.#state.loading || !this.#state.hasNext) return;
                if ((innerHeight + scrollY) >= (document.documentElement.scrollHeight - AEGIS_CONFIG.SCROLL_THRESHOLD)) {
                    void this.#fetchGrid();
                }
            };
            window.addEventListener('scroll', hScroll, { passive: true });
            this._listeners.push({ el: window, ev: 'scroll', fn: hScroll });
        }

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
            if (container) container.querySelectorAll('.fp-chip').forEach(c => c.classList.toggle('active', (c.dataset.value || null) === val));
        };
        sync(this.#dom.genreF, this.#pending.genre);
        sync(this.#dom.formatF, this.#pending.format);
        sync(this.#dom.yearF, this.#pending.year);
        sync(this.#dom.statusF, this.#pending.status);
    }

    #showSpin() { this.#dom.searchSpin?.classList.add('active'); }
    #hideSpin() { this.#dom.searchSpin?.classList.remove('active'); }

    /* ── Init & Destroy ───────────────────────────────── */
    async init() {
        this.#cacheDom();
        this.#injectStyles();
        document.documentElement.style.setProperty('--app-height', `${innerHeight}px`);

        await this.db.init().catch(() => {});
        try { this.#profile = await this.#loadProfile(); } catch {}

        this.#bindUI();

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

        await Promise.allSettled([this.#fetchSlider(), this.#fetchGrid()]);
        idle(() => this.#schedulePrefetch(), 1000);
        return this;
    }

    destroy() {
        this.#dead = true;
        this.#sliderStop();

        for (const k in this.#ctl) this.#abort(k);
        this.#imgObs?.disconnect();
        this.#scrollObs?.disconnect();
        this.#globalAbort.abort();

        if (this.#worker) {
            this.#worker.terminate();
            this.#worker = null;
        }
        this.#workerResolvers.forEach(r => r.resolve(null));
        this.#workerResolvers.clear();

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
        this.#memoSort.clear();
        this.#sugCache.clear();
        this.#prefetchUrls.clear();
        this.db.close();
    }
}

window.AegisEngine = AegisEngine;
window.AegisDB = AegisDB;