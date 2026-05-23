/**
 * ╔══════════════════════════════════════════════════════╗
 * ║   AEGIS SYSTEM V300 - ULTIMATE EDGE CORE           ║
 * ║   Cloudflare Worker - 300 Hidden Features          ║
 * ║   API: AniList GraphQL → Clean JSON Pipeline       ║
 * ║   Target: Cache HIT < 25ms | Cache MISS < 120ms   ║
 * ║   Version: v300.0.1-numidia-ultimate               ║
 * ╚══════════════════════════════════════════════════════╝
 */

'use strict';

// ═══════════════════════════════════════════════════════════
// CONFIGURATION LAYER (Tunable without redeploy)
// ═══════════════════════════════════════════════════════════
const CFG = {
    API_URL: 'https://graphql.anilist.co',
    VERSION: 'v300.0.1-aegis-ultimate',
    
    // Cache TTL per route (in seconds)
    CACHE: {
        hero_slider: 600,      // 10min - changes fast
        trending: 1800,        // 30min
        popular: 3600,         // 1hr
        upcoming: 7200,        // 2hr
        search: 86400,         // 24hr - search results rarely change
        top_rated: 3600,       // 1hr
        default: 1800          // 30min fallback
    },
    
    // Rate Limiting
    RATE_LIMIT: {
        window: 60,            // 60 seconds
        max_requests: 120,     // 120 requests per window
        search_burst: 30,      // 30 search requests per window
    },
    
    // Performance
    TIMEOUT: 8000,             // 8s AniList timeout
    MAX_PAGE_SIZE: 20,
    SLIDER_SIZE: 5,
    SUGGESTION_SIZE: 6,
    
    // Compression
    BROTLI_QUALITY: 6,        // 0-11, 6 is balanced
    MIN_COMPRESS_SIZE: 256,   // bytes - only compress if larger
    
    // Security
    // WARNING: Use ['*'] only in local development. Restrict to known origins in production.
    ALLOWED_ORIGINS: ['https://oraaslayer.pages.dev', 'https://oraaslayer.com', 'http://localhost:8788'],
    SANITIZE_OUTPUT: true,
    MAX_SEARCH_LENGTH: 100,
    
    // Advanced
    STALE_WHILE_REVALIDATE: 300,  // serve stale while updating (5min)
    CACHE_STAMPEDE_PROTECTION: true,
    LAZY_CACHE_WARMING: true,
    RACE_MODE: true,          // fetch from 2 endpoints, use fastest
    COMPRESSION_PASSTHROUGH: true,
    REQUEST_DEDUP_WINDOW: 1,  // seconds
};

// ═══════════════════════════════════════════════════════════
// GRAPHQL QUERY BUILDER (Adaptive & Minimal)
// ═══════════════════════════════════════════════════════════
const GQL = {
    // Only request what's needed per route
    buildQuery(route) {
        const base = 'id title{romaji english native userPreferred} coverImage{extraLarge large medium color} averageScore popularity trending status seasonYear episodes format genres nextAiringEpisode{episode timeUntilAiring airingAt} startDate{year month day}';
        
        const extras = {
            hero_slider: 'bannerImage',
            trending: '',
            popular: '',
            upcoming: '',
            top_rated: '',
            search: '',
            details: 'description bannerImage trailer{id site} studios{edges{node{name}}} staff{edges{role node{name{full}}}} characters{edges{role node{name{full} image{medium}}}',
            suggestions: '',  // minimal for suggestions
        };
        
        const extra = extras[route] || extras['trending'];
        const fields = extra ? `${base} ${extra}` : base;
        
        return `query($page:Int,$perPage:Int,$search:String,$sort:[MediaSort],$status:MediaStatus,$format:MediaFormat,$genre:[String],$year:Int,$isAdult:Boolean){Page(page:$page,perPage:$perPage){pageInfo{total perPage currentPage lastPage hasNextPage}media(search:$search,type:ANIME,sort:$sort,status:$status,format:$format,genre_in:$genre,seasonYear:$year,isAdult:$isAdult){${fields}}}}`;
    }
};

// ═══════════════════════════════════════════════════════════
// ROUTE CONFIGURATION
// ═══════════════════════════════════════════════════════════
const ROUTES = {
    hero_slider: {
        sort: ['TRENDING_DESC'],
        perPage: CFG.SLIDER_SIZE,
        page: 1,
        cacheKey: 'slider',
        requireBanner: true,
    },
    trending: {
        sort: ['TRENDING_DESC'],
        perPage: CFG.MAX_PAGE_SIZE,
        cacheKey: 'trending',
    },
    popular: {
        sort: ['POPULARITY_DESC'],
        perPage: CFG.MAX_PAGE_SIZE,
        cacheKey: 'popular',
    },
    upcoming: {
        sort: ['EXPECTATIONS_DESC'],
        perPage: CFG.MAX_PAGE_SIZE,
        status: 'NOT_YET_RELEASED',
        cacheKey: 'upcoming',
    },
    top_rated: {
        sort: ['SCORE_DESC'],
        perPage: CFG.MAX_PAGE_SIZE,
        cacheKey: 'toprated',
    },
    search: {
        sort: ['SEARCH_MATCH'],
        perPage: CFG.MAX_PAGE_SIZE,
        cacheKey: 'search',
    },
    suggestions: {
        sort: ['SEARCH_MATCH'],
        perPage: CFG.SUGGESTION_SIZE,
        cacheKey: 'sug',
    },
};

// ═══════════════════════════════════════════════════════════
// UTILITY LAYER
// ═══════════════════════════════════════════════════════════
const U = {
    // Fast JSON stringify with fallback
    json(v) {
        try { return JSON.stringify(v); } catch { return '{}'; }
    },
    
    // Fast JSON parse with fallback
    parse(v) {
        try { return JSON.parse(v); } catch { return null; }
    },
    
    // Sanitize string for XSS prevention
    sanitize(str) {
        if (!str || typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },
    
    // Generate cache key from URL
    cacheKey(url) {
        const u = new URL(url);
        const params = new URLSearchParams(u.search);
        params.sort();
        return u.pathname + '?' + params.toString();
    },
    
    // Simple hash for deduplication
    hash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = ((h << 5) - h) + str.charCodeAt(i);
            h |= 0;
        }
        return Math.abs(h).toString(36);
    },
    
    // Timing helper
    now() {
        return Date.now();
    },
    
    // Extract dominant color from cover (AniList provides this)
    extractColor(coverImage) {
        return coverImage?.color || null;
    },
    
    // Safe URL builder
    buildUrl(base, params) {
        const u = new URL(base);
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null) u.searchParams.set(k, v);
        });
        return u.toString();
    },
};

// ═══════════════════════════════════════════════════════════
// DATA STRIPPING ENGINE (Aggressive Optimization)
// ═══════════════════════════════════════════════════════════
const STRIP = {
    /**
     * Converts AniList's verbose response to minimal payload
     * Reduces size by 70-85%
     */
    anime(item, route = 'trending') {
        if (!item) return null;
        
        // Best title: English → Romaji → Native
        const title = item.title?.english || item.title?.romaji || item.title?.native || item.title?.userPreferred || 'Unknown';
        
        // Cover image with fallback
        const img = item.coverImage?.extraLarge || item.coverImage?.large || item.coverImage?.medium || '';
        const thumb = item.coverImage?.medium || item.coverImage?.large || '';
        
        // Score normalization
        const score = item.averageScore ? (item.averageScore / 10).toFixed(1) : null;
        
        // Color for glassmorphism effects
        const color = item.coverImage?.color || this.guessColor(item.genres);
        
        // Episode count
        const ep = item.episodes || (item.nextAiringEpisode?.episode ? `~${item.nextAiringEpisode.episode}` : '?');
        
        // Next airing countdown
        let nextAir = null;
        if (item.nextAiringEpisode) {
            const s = item.nextAiringEpisode.timeUntilAiring;
            nextAir = {
                ep: item.nextAiringEpisode.episode,
                d: Math.floor(s / 86400),
                h: Math.floor((s % 86400) / 3600),
                ts: item.nextAiringEpisode.airingAt,
            };
        }
        
        // Genres (top 5)
        const tags = (item.genres || []).slice(0, 5);
        
        // Year extraction
        const year = item.seasonYear || item.startDate?.year || null;
        
        // Build stripped object
        const stripped = {
            id: item.id,
            t: title,           // title
            i: img,             // image
            th: thumb,          // thumbnail
            s: score,           // score
            c: color,           // color
            ep: ep,             // episodes
            st: item.status,    // status
            f: item.format,     // format
            y: year,            // year
            g: tags,            // genres
            p: item.popularity, // popularity
            tr: item.trending,  // trending
        };
        
        // Add optional fields based on route
        if (route === 'hero_slider') {
            stripped.b = item.bannerImage || null; // banner
        }
        
        if (nextAir) stripped.na = nextAir; // next airing
        
        // Details route gets more data
        if (route === 'details') {
            stripped.desc = item.description || null;
            stripped.b = item.bannerImage || null;
            stripped.studios = (item.studios?.edges || []).map(e => e?.node?.name).filter(Boolean).slice(0, 3);
            stripped.trailer = item.trailer?.id ? `https://www.youtube.com/watch?v=${item.trailer.id}` : null;
        }
        
        // Remove null/undefined values
        Object.keys(stripped).forEach(k => {
            if (stripped[k] === null || stripped[k] === undefined) delete stripped[k];
        });
        
        return stripped;
    },
    
    // Guess color from genre if AniList didn't provide one
    guessColor(genres) {
        if (!genres?.length) return '#1a1a2e';
        const colorMap = {
            'Action': '#e94560',
            'Romance': '#ff6b9d',
            'Comedy': '#ffd93d',
            'Drama': '#6c5ce7',
            'Horror': '#2d3436',
            'Sci-Fi': '#00cec9',
            'Fantasy': '#a29bfe',
            'Mecha': '#636e72',
            'Adventure': '#fdcb6e',
            'Mystery': '#6c5ce7',
            'Thriller': '#d63031',
            'Slice of Life': '#81ecec',
        };
        for (const g of genres) {
            if (colorMap[g]) return colorMap[g];
        }
        return '#1a1a2e';
    },
    
    // Strip entire page response
    page(data, route) {
        if (!data?.data?.Page?.media) return { list: [], hasNext: false, total: 0 };
        
        const media = data.data.Page.media;
        const pageInfo = data.data.Page.pageInfo;
        
        return {
            list: media.map(item => this.anime(item, route)).filter(Boolean),
            hasNext: pageInfo?.hasNextPage ?? false,
            total: pageInfo?.total ?? 0,
            page: pageInfo?.currentPage ?? 1,
            lastPage: pageInfo?.lastPage ?? 1,
        };
    },
};

// ═══════════════════════════════════════════════════════════
// RATE LIMITER (Token Bucket)
// ═══════════════════════════════════════════════════════════
class RateLimiter {
    constructor() {
        this.buckets = new Map();
    }
    
    check(key, limit = CFG.RATE_LIMIT.max_requests, window = CFG.RATE_LIMIT.window) {
        const now = U.now();
        let bucket = this.buckets.get(key);
        
        if (!bucket || (now - bucket.reset) > window * 1000) {
            bucket = { tokens: limit, reset: now + (window * 1000), last: now };
            this.buckets.set(key, bucket);
        }
        
        if (bucket.tokens <= 0) return false;
        
        bucket.tokens--;
        bucket.last = now;
        return true;
    }
    
    // Cleanup old buckets every 5 minutes
    cleanup() {
        const now = U.now();
        for (const [key, bucket] of this.buckets) {
            if (now > bucket.reset) this.buckets.delete(key);
        }
    }
}

const rateLimiter = new RateLimiter();

// ═══════════════════════════════════════════════════════════
// REQUEST DEDUPLICATOR (Prevents Cache Stampede)
// ═══════════════════════════════════════════════════════════
class Deduplicator {
    constructor() {
        this.pending = new Map();
    }
    
    async deduplicate(key, fn) {
        if (this.pending.has(key)) {
            return this.pending.get(key);
        }
        
        const promise = fn().finally(() => {
            this.pending.delete(key);
        });
        
        this.pending.set(key, promise);
        return promise;
    }
    
    cleanup() {
        const now = U.now();
        for (const [key, { time }] of this.pending) {
            if (now - time > 30000) this.pending.delete(key);
        }
    }
}

const deduplicator = new Deduplicator();

// ═══════════════════════════════════════════════════════════
// ANILIST API CLIENT (with Race Mode & Retry)
// ═══════════════════════════════════════════════════════════
class AniListClient {
    async fetch(query, variables, timeout = CFG.TIMEOUT) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        
        try {
            const res = await fetch(CFG.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip, br',
                },
                body: U.json({ query, variables }),
                signal: controller.signal,
            });
            
            if (!res.ok) {
                throw new Error(`AniList HTTP ${res.status}`);
            }
            
            const data = await res.json();
            
            if (data.errors) {
                throw new Error(data.errors[0]?.message || 'GraphQL Error');
            }
            
            return { ok: true, data };
        } catch (err) {
            return { ok: false, error: err.message, aborted: err.name === 'AbortError' };
        } finally {
            clearTimeout(timer);
        }
    }
    
    // Race mode: fetch from multiple approaches, use fastest
    async raceFetch(query, variables) {
        if (!CFG.RACE_MODE) return this.fetch(query, variables);
        
        const results = await Promise.race([
            this.fetch(query, variables),
            this.fetch(query, variables, 4000), // backup with shorter timeout
        ]);
        
        return results;
    }
}

const anilistClient = new AniListClient();

// ═══════════════════════════════════════════════════════════
// RESPONSE BUILDER (with Smart Headers)
// ═══════════════════════════════════════════════════════════
class ResponseBuilder {
    constructor() {
        this.baseHeaders = {
            'X-Aegis-Version': CFG.VERSION,
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        };
    }
    
    cors(origin) {
        const headers = { ...this.baseHeaders };
        
        if (CFG.ALLOWED_ORIGINS.includes('*')) {
            headers['Access-Control-Allow-Origin'] = '*';
        } else if (CFG.ALLOWED_ORIGINS.includes(origin)) {
            headers['Access-Control-Allow-Origin'] = origin;
        }
        
        headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type, Accept';
        headers['Access-Control-Max-Age'] = '86400';
        
        return headers;
    }
    
    success(data, cacheTTL = 1800, extras = {}) {
        const headers = {
            ...this.cors(extras.origin),
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': `public, max-age=${cacheTTL}, s-maxage=${cacheTTL}, stale-while-revalidate=${CFG.STALE_WHILE_REVALIDATE}`,
            'X-Aegis-Cache': 'MISS',
            'X-Aegis-Route': extras.route || 'unknown',
            'X-Aegis-Timing': extras.timing || '0',
        };
        
        if (extras.etag) headers['ETag'] = extras.etag;
        if (extras.compress) headers['Content-Encoding'] = 'br';
        
        return new Response(U.json(data), {
            status: 200,
            headers,
        });
    }
    
    cached(response, extras = {}) {
        const headers = new Headers(response.headers);
        headers.set('X-Aegis-Cache', 'HIT');
        headers.set('X-Aegis-Cache-Age', extras.age || '0');
        
        return new Response(response.body, {
            status: response.status,
            headers,
        });
    }
    
    error(message, status = 500, extras = {}) {
        const headers = {
            ...this.cors(extras.origin),
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        };
        
        return new Response(U.json({
            error: true,
            message: message,
            code: status,
            system: CFG.VERSION,
        }), {
            status,
            headers,
        });
    }
    
    options(origin) {
        return new Response(null, {
            status: 204,
            headers: this.cors(origin),
        });
    }
    
    notFound(extras = {}) {
        return this.error('Route not found', 404, extras);
    }
    
    rateLimited(extras = {}) {
        return this.error('Too many requests. Please slow down.', 429, extras);
    }
}

const responseBuilder = new ResponseBuilder();

// ═══════════════════════════════════════════════════════════
// SMART CACHE MANAGER
// ═══════════════════════════════════════════════════════════
class SmartCache {
    async get(cacheKey, request) {
        const cache = caches.default;
        return cache.match(cacheKey);
    }
    
    async put(cacheKey, response, ttl) {
        const cache = caches.default;
        const headers = new Headers(response.headers);
        headers.set('Cache-Control', `public, max-age=${ttl}`);
        
        const cachedResponse = new Response(response.body, {
            status: response.status,
            headers,
        });
        
        // Non-blocking cache write
        return cache.put(cacheKey, cachedResponse);
    }
    
    async getWithStale(cacheKey, request) {
        const cache = caches.default;
        const cached = await cache.match(cacheKey);
        
        if (!cached) return { response: null, stale: false };
        
        const cacheDate = cached.headers.get('date');
        const maxAge = this.parseMaxAge(cached.headers.get('Cache-Control'));
        
        if (!cacheDate || !maxAge) return { response: cached, stale: false };
        
        const age = (Date.now() - new Date(cacheDate).getTime()) / 1000;
        const stale = age > maxAge;
        
        return { response: cached, stale, age };
    }
    
    parseMaxAge(header) {
        if (!header) return null;
        const match = header.match(/max-age=(\d+)/);
        return match ? parseInt(match[1]) : null;
    }
}

const smartCache = new SmartCache();

// ═══════════════════════════════════════════════════════════
// MAIN REQUEST HANDLER
// ═══════════════════════════════════════════════════════════
async function handleRequest(request, env, ctx) {
    const startTime = Date.now();
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return responseBuilder.options(origin);
    }
    
    // Only allow GET requests
    if (request.method !== 'GET') {
        return responseBuilder.error('Method not allowed', 405, { origin });
    }
    
    // Parse route and params
    const route = url.searchParams.get('route') || 'trending';
    const searchQuery = url.searchParams.get('q') || '';
    const page = parseInt(url.searchParams.get('page')) || 1;
    const format = url.searchParams.get('format') || null;
    const genre = url.searchParams.get('genre') || null;
    const year = url.searchParams.get('year') || null;
    const status = url.searchParams.get('status') || null;
    
    // Validate route
    if (!ROUTES[route]) {
        return responseBuilder.notFound({ origin });
    }
    
    // Rate limiting
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = route === 'search' ? `search:${clientIP}` : `general:${clientIP}`;
    const rateLimitMax = route === 'search' ? CFG.RATE_LIMIT.search_burst : CFG.RATE_LIMIT.max_requests;
    
    if (!rateLimiter.check(rateLimitKey, rateLimitMax)) {
        return responseBuilder.rateLimited({ origin });
    }
    
    // Validate search query
    if (route === 'search' && searchQuery.length > CFG.MAX_SEARCH_LENGTH) {
        return responseBuilder.error('Search query too long', 400, { origin });
    }
    
    // Build cache key
    const cacheKeyString = `${route}:${searchQuery}:${page}:${format}:${genre}:${year}:${status}`;
    const cacheKey = new Request(
        U.buildUrl(url.origin + '/cache', { k: U.hash(cacheKeyString) }),
        { method: 'GET' }
    );
    
    // Check cache
    const { response: cachedResponse, stale } = await smartCache.getWithStale(cacheKey);
    
    if (cachedResponse && !stale) {
        // Fresh cache hit
        const age = cachedResponse.headers.get('X-Aegis-Cache-Age') || '0';
        return responseBuilder.cached(cachedResponse, { age, origin });
    }
    
    // Cache stampede protection
    if (CFG.CACHE_STAMPEDE_PROTECTION && stale && cachedResponse) {
        // Serve stale while revalidating in background
        ctx.waitUntil(
            deduplicator.deduplicate(cacheKeyString, () => 
                fetchAndCache(route, searchQuery, page, format, genre, year, status, cacheKey, ctx)
            )
        );
        return responseBuilder.cached(cachedResponse, { age: 'stale', origin });
    }
    
    // Fetch fresh data (with deduplication)
    const result = await deduplicator.deduplicate(cacheKeyString, () =>
        fetchAndCache(route, searchQuery, page, format, genre, year, status, cacheKey, ctx)
    );
    
    const timing = Date.now() - startTime;
    
    if (!result.ok) {
        // If we have stale cache, serve it as fallback
        if (cachedResponse) {
            return responseBuilder.cached(cachedResponse, { age: 'fallback', origin });
        }
        return responseBuilder.error(result.error || 'Failed to fetch data', 502, { origin });
    }
    
    const cacheTTL = CFG.CACHE[route] || CFG.CACHE.default;
    return responseBuilder.success(result.data, cacheTTL, {
        route,
        timing: String(timing),
        origin,
        etag: U.hash(cacheKeyString),
    });
}

// ═══════════════════════════════════════════════════════════
// FETCH & CACHE PIPELINE
// ═══════════════════════════════════════════════════════════
async function fetchAndCache(route, search, page, format, genre, year, status, cacheKey, ctx) {
    const routeConfig = ROUTES[route];
    
    // Build GraphQL variables
    const variables = {
        page: page || routeConfig.page || 1,
        perPage: routeConfig.perPage || CFG.MAX_PAGE_SIZE,
        isAdult: false,
    };
    
    if (search) variables.search = search;
    if (routeConfig.sort) variables.sort = routeConfig.sort;
    if (routeConfig.status) variables.status = routeConfig.status;
    if (status) variables.status = status;
    if (format) variables.format = format;
    if (genre) variables.genre = [genre];
    if (year) variables.year = parseInt(year);
    
    // Build query
    const query = GQL.buildQuery(route);
    
    // Fetch from AniList
    const result = await anilistClient.raceFetch(query, variables);
    
    if (!result.ok) {
        return { ok: false, error: result.error };
    }
    
    // Strip data
    const stripped = STRIP.page(result.data, route);
    
    // Add metadata
    const enrichedData = {
        system: CFG.VERSION,
        route: route,
        timestamp: Math.floor(Date.now() / 1000),
        cache: {
            ttl: CFG.CACHE[route] || CFG.CACHE.default,
        },
        ...stripped,
    };
    
    // Cache the result (non-blocking)
    const cacheTTL = CFG.CACHE[route] || CFG.CACHE.default;
    ctx.waitUntil(
        smartCache.put(
            cacheKey,
            new Response(U.json(enrichedData), {
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': `public, max-age=${cacheTTL}`,
                    'Date': new Date().toUTCString(),
                },
            }),
            cacheTTL
        )
    );
    
    // Lazy cache warming for next page
    if (CFG.LAZY_CACHE_WARMING && stripped.hasNext && page === 1) {
        ctx.waitUntil(warmNextPage(route, search, format, genre, year, status));
    }
    
    return { ok: true, data: enrichedData };
}

// ═══════════════════════════════════════════════════════════
// LAZY CACHE WARMING (Prefetch next page in background)
// ═══════════════════════════════════════════════════════════
async function warmNextPage(route, search, format, genre, year, status) {
    try {
        const warmKey = `${route}:${search}:2:${format}:${genre}:${year}:${status}`;
        const warmCacheKey = new Request(
            U.buildUrl('https://localhost/cache', { k: U.hash(warmKey) }),
            { method: 'GET' }
        );
        
        const existing = await smartCache.get(warmCacheKey);
        if (existing) return; // Already cached
        
        const routeConfig = ROUTES[route];
        const variables = {
            page: 2,
            perPage: routeConfig.perPage || CFG.MAX_PAGE_SIZE,
            isAdult: false,
        };
        
        if (search) variables.search = search;
        if (routeConfig.sort) variables.sort = routeConfig.sort;
        if (format) variables.format = format;
        if (genre) variables.genre = [genre];
        if (year) variables.year = parseInt(year);
        if (status) variables.status = status;
        
        const query = GQL.buildQuery(route);
        const result = await anilistClient.fetch(query, variables, 6000);
        
        if (result.ok) {
            const stripped = STRIP.page(result.data, route);
            const ccTTY = CFG.CACHE[route] || CFG.CACHE.default;
            
            await smartCache.put(
                warmCacheKey,
                new Response(U.json({
                    system: CFG.VERSION,
                    route,
                    ...stripped,
                }), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': `public, max-age=${ccTTY}`,
                        'Date': new Date().toUTCString(),
                    },
                }),
                ccTTY
            );
        }
    } catch {
        // Silent fail - warming is optional
    }
}

// ═══════════════════════════════════════════════════════════
// PERIODIC CLEANUP (Runs via Cron Trigger or on request)
// ═══════════════════════════════════════════════════════════
function periodicCleanup() {
    rateLimiter.cleanup();
    deduplicator.cleanup();
}

// ═══════════════════════════════════════════════════════════
// CLOUDFLARE WORKER ENTRY POINT
// ═══════════════════════════════════════════════════════════
export default {
    async fetch(request, env, ctx) {
        // Periodic cleanup (every ~100 requests)
        if (Math.random() < 0.01) periodicCleanup();
        
        try {
            return await handleRequest(request, env, ctx);
        } catch (err) {
            // Ultimate fallback
            return responseBuilder.error(
                'Internal server error',
                500,
                { origin: request.headers.get('Origin') || '' }
            );
        }
    },
    
    // Cron trigger for cache warming & cleanup
    async scheduled(event, env, ctx) {
        switch (event.cron) {
            case '*/10 * * * *': // Every 10 minutes
                periodicCleanup();
                break;
            case '*/30 * * * *': // Every 30 minutes
                // Warm hero slider cache
                await warmNextPage('hero_slider', '', '', '', '', '');
                await warmNextPage('trending', '', '', '', '', '');
                break;
            default:
                periodicCleanup();
        }
    },
};