// ═══════════════════════════════════════════════════════════════════════════════
// OraaSlayer Central Authentication Module
// Version: 3.2.0 (ES6 Module)
// يدير كل ما يتعلق بالمستخدم: تسجيل، دخول، خروج، صلاحيات
// يعتمد على /api/firebase.js الذي يجب تحميله أولاً
// ═══════════════════════════════════════════════════════════════════════════════

import {
    auth,
    db,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    sendPasswordResetEmail,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from '/api/firebase.js';

// ═══════════════════════════════════════════════════════════════════════════════
// تصحيح: التحقق من تهيئة Firebase
// ═══════════════════════════════════════════════════════════════════════════════
if (!auth || !db) {
    console.error('[AUTH] Firebase not initialized. Check /api/firebase.js');
    throw new Error('Firebase initialization failed');
}

// =====================================
// 1. SINGLETON INSTANCES (من firebase.js)
// =====================================
const authInstance = auth;
const dbInstance = db;

// =====================================
// 2. CONSTANTS
// =====================================
const DEFAULT_AVATAR = 'https://i.ibb.co/YRShYmn/avatar.png';

const ROLE_HIERARCHY = Object.freeze({
    guest: 0,
    member: 1,
    vip: 2,
    staff: 3,
    manager: 4,
    admin: 5
});

const ROLE_COLORS = Object.freeze({
    guest: '#B6C2D1',
    member: '#7BA6FF',
    vip: '#FFCA28',
    staff: '#B78BFF',
    manager: '#5CD6FF',
    admin: '#FF5C7A'
});

const ROLE_LABELS = Object.freeze({
    guest: 'زائر',
    member: 'عضو',
    vip: 'عضو مميز',
    staff: 'فريق العمل',
    manager: 'مدير',
    admin: 'إداري'
});

// =====================================
// 3. GLOBAL AUTH STATE
// =====================================
const defaultAuthState = Object.freeze({
    user: null,
    profile: null,
    isLoggedIn: false,
    ready: false,
    role: 'guest',
    avatar: DEFAULT_AVATAR,
    displayName: 'زائر'
});

window.__AUTH__ = { ...defaultAuthState };

// Internal guards - FIXED:，确保 Firebase Auth 完全初始化后才标记 ready
let authListenerStarted = false;
let authReadyResolve;
let authReadyReject;
let authBootstrapDone = false;

const authReadyPromise = new Promise((resolve, reject) => {
    authReadyResolve = resolve;
    authReadyReject = reject;
});

// =====================================
// 4. HELPERS
// =====================================
function safeString(value, fallback = '') {
    return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeRole(rawRole) {
    if (!rawRole) return 'member';

    const r = String(rawRole).trim().toLowerCase();

    if (['admin', 'administrator', 'adm', 'admin root'].includes(r)) return 'admin';
    if (['manager', 'manger', 'mgr'].includes(r)) return 'manager';
    if (['staff', 'staf'].includes(r)) return 'staff';
    if (['vip', 'premium', 'pro'].includes(r)) return 'vip';
    if (['member', 'user'].includes(r)) return 'member';

    return 'member';
}

function buildAvatarUrl(avatar, userPhotoURL = '') {
    const raw = safeString(avatar);

    if (!raw) return safeString(userPhotoURL) || DEFAULT_AVATAR;
    if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;

    return `anime_img/${raw}`;
}

function getDisplayName(profile, user) {
    const fromProfile = safeString(profile?.name);
    const fromUser = safeString(user?.displayName);

    return fromProfile || fromUser || 'مستخدم';
}

function getAvatarFromProfile(profile, user) {
    return buildAvatarUrl(profile?.avatar, user?.photoURL || DEFAULT_AVATAR);
}

function createGuestState() {
    return {
        user: null,
        profile: null,
        isLoggedIn: false,
        ready: true,
        role: 'guest',
        avatar: DEFAULT_AVATAR,
        displayName: 'زائر'
    };
}

function createSignedInState(user, profile = null) {
    const role = normalizeRole(profile?.role);

    return {
        user,
        profile,
        isLoggedIn: true,
        ready: true,
        role,
        avatar: getAvatarFromProfile(profile, user),
        displayName: getDisplayName(profile, user)
    };
}

function broadcast() {
    const ev = new CustomEvent('auth:changed', {
        detail: { ...window.__AUTH__ },
        bubbles: false,
        cancelable: false
    });

    window.dispatchEvent(ev);
}

function setAuthState(nextState) {
    window.__AUTH__ = {
        ...defaultAuthState,
        ...nextState
    };

    // FIXED: Mark state as ready when Firebase has settled
    if (!window.__AUTH__.ready && (nextState.user || authBootstrapDone)) {
        window.__AUTH__.ready = true;
    }

    broadcast();
    persistAuthState();
}

async function syncUserDocument(user, profile = null) {
    if (!user?.uid) return null;

    const userDocRef = doc(dbInstance, 'users', user.uid);

    const baseData = {
        uid: user.uid,
        email: user.email || profile?.email || '',
        name: safeString(profile?.name, user.displayName || 'مستخدم'),
        role: normalizeRole(profile?.role || 'member'),
        avatar: safeString(profile?.avatar, user.photoURL || ''),
        updatedAt: serverTimestamp(),
        lastLogin: serverTimestamp()
    };

    try {
        const existing = await getDoc(userDocRef);

        if (existing.exists()) {
            await setDoc(userDocRef, baseData, { merge: true });
            return { exists: true, data: existing.data() };
        }

        await setDoc(userDocRef, {
            ...baseData,
            createdAt: serverTimestamp()
        });

        return { exists: false, data: null };
    } catch (err) {
        console.error('[AUTH] Failed to sync user document:', err?.message || err);
        return null;
    }
}

async function loadUserProfile(user) {
    if (!user?.uid) return null;

    const userDocRef = doc(dbInstance, 'users', user.uid);

    try {
        const snap = await getDoc(userDocRef);

        if (snap.exists()) {
            return snap.data();
        }

        return null;
    } catch (err) {
        console.warn('[AUTH] Failed to load profile:', err?.message || err);
        return null;
    }
}

function mapLoginError(err) {
    const messages = {
        'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني',
        'auth/wrong-password': 'كلمة المرور غير صحيحة',
        'auth/invalid-email': 'صيغة البريد الإلكتروني غير صالحة',
        'auth/user-disabled': 'تم تعطيل هذا الحساب',
        'auth/invalid-credential': 'بيانات الدخول غير صحيحة',
        'auth/too-many-requests': 'محاولات كثيرة، حاول لاحقاً',
        'auth/network-request-failed': 'فشل الاتصال بالشبكة',
        'auth/internal-error': 'خطأ داخلي، يرجى المحاولة لاحقاً'
    };

    return messages[err?.code] || err?.message || 'فشل تسجيل الدخول';
}

function mapRegisterError(err) {
    const messages = {
        'auth/email-already-in-use': 'البريد الإلكتروني مستخدم بالفعل',
        'auth/invalid-email': 'صيغة البريد الإلكتروني غير صالحة',
        'auth/weak-password': 'كلمة المرور ضعيفة جداً',
        'auth/too-many-requests': 'محاولات كثيرة، حاول لاحقاً',
        'auth/network-request-failed': 'فشل الاتصال بالشبكة',
        'auth/operation-not-allowed': 'هذه الطريقة لتسجيل الدخول غير مفعّلة'
    };

    return messages[err?.code] || err?.message || 'فشل إنشاء الحساب';
}

function mapResetError(err) {
    const messages = {
        'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني',
        'auth/invalid-email': 'صيغة البريد الإلكتروني غير صالحة',
        'auth/too-many-requests': 'محاولات كثيرة، حاول لاحقاً',
        'auth/network-request-failed': 'فشل الاتصال بالشبكة'
    };

    return messages[err?.code] || err?.message || 'فشل إرسال رابط إعادة التعيين';
}

async function ensureProfileLoaded(user) {
    if (!user) {
        // FIXED: Set ready flag even for guest state
        window.__AUTH__.ready = true;
        authBootstrapDone = true;
        setAuthState(createGuestState());
        return window.__AUTH__;
    }

    try {
        const profile = await loadUserProfile(user);

        if (profile) {
            setAuthState(createSignedInState(user, profile));
            try {
                await syncUserDocument(user, profile);
            } catch (_) {}
            return window.__AUTH__;
        }

        const fallbackProfile = {
            uid: user.uid,
            name: user.displayName || 'مستخدم',
            email: user.email || '',
            role: 'member',
            avatar: user.photoURL || '',
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp()
        };

        setAuthState(createSignedInState(user, fallbackProfile));

        try {
            await setDoc(doc(dbInstance, 'users', user.uid), fallbackProfile);
        } catch (_) {}

        return window.__AUTH__;
    } catch (err) {
        console.warn('[AUTH] Failed to fetch user profile:', err?.message || err);

        const fallbackProfile = {
            uid: user.uid,
            name: user.displayName || 'مستخدم',
            email: user.email || '',
            role: 'member',
            avatar: user.photoURL || ''
        };

        setAuthState(createSignedInState(user, fallbackProfile));
        return window.__AUTH__;
    }
}

// =====================================
// 5. CORE AUTH LISTENER (FIXED)
// =====================================
function startAuthListener() {
    if (authListenerStarted) return;
    authListenerStarted = true;

    onAuthStateChanged(authInstance, async (user) => {
        try {
            if (user) {
                await ensureProfileLoaded(user);
            } else {
                // User logged out or session expired
                // Check if this is initial boot or explicit logout
                if (!authBootstrapDone) {
                    // Initial page load - set guest state immediately
                    authBootstrapDone = true;
                    setAuthState(createGuestState());
                } else {
                    // User logged out explicitly - keep guest state
                    setAuthState(createGuestState());
                }
            }
        } catch (err) {
            console.error('[AUTH] Auth state change error:', err?.message || err);
            setAuthState(createGuestState());
        } finally {
            // CRITICAL FIX: Resolve authReadyPromise only ONCE on initial load
            // This ensures pages can correctly check auth state after refresh
            if (typeof authReadyResolve === 'function') {
                // Add a minimum delay to ensure Firebase has fully settled
                setTimeout(() => {
                    if (typeof authReadyResolve === 'function') {
                        authReadyResolve(window.__AUTH__);
                        authReadyResolve = null;
                        authReadyReject = null;
                    }
                }, 100);
            }

        }
    });
}

startAuthListener();

// =====================================
// 6. AUTH FUNCTIONS
// =====================================

/**
 * تسجيل الدخول بالبريد الإلكتروني وكلمة المرور
 */
async function login(email, password) {
    const safeEmail = safeString(email);
    const safePassword = typeof password === 'string' ? password : '';

    if (!safeEmail || !safePassword) {
        return { success: false, user: null, error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' };
    }

    if (!safeEmail.includes('@') || !safeEmail.includes('.')) {
        return { success: false, user: null, error: 'بريد إلكتروني غير صالح' };
    }

    if (safePassword.length < 6) {
        return { success: false, user: null, error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
    }

    try {
        const result = await signInWithEmailAndPassword(authInstance, safeEmail, safePassword);

        try {
            await ensureProfileLoaded(result.user);
        } catch (_) {}

        return {
            success: true,
            user: result.user,
            error: null
        };
    } catch (err) {
        console.error('[AUTH] Login failed:', err?.code || err);
        return {
            success: false,
            user: null,
            error: mapLoginError(err)
        };
    }
}

/**
 * إنشاء حساب جديد
 */
async function register(email, password, displayName = '') {
    const safeEmail = safeString(email);
    const safePassword = typeof password === 'string' ? password : '';
    const safeName = safeString(displayName);

    if (!safeEmail || !safePassword) {
        return { success: false, user: null, error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' };
    }

    if (!safeEmail.includes('@') || !safeEmail.includes('.')) {
        return { success: false, user: null, error: 'بريد إلكتروني غير صالح' };
    }

    if (safePassword.length < 6) {
        return { success: false, user: null, error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
    }

    if (safeName && safeName.length < 3) {
        return { success: false, user: null, error: 'الاسم يجب أن يكون 3 أحرف على الأقل' };
    }

    try {
        const result = await createUserWithEmailAndPassword(authInstance, safeEmail, safePassword);

        if (safeName) {
            try {
                await updateProfile(result.user, { displayName: safeName });
            } catch (err) {
                console.warn('[AUTH] Failed to update profile name:', err?.message || err);
            }
        }

        const userData = {
            uid: result.user.uid,
            name: safeName || result.user.displayName || 'مستخدم',
            email: safeEmail,
            role: 'member',
            avatar: result.user.photoURL || '',
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        try {
            await setDoc(doc(dbInstance, 'users', result.user.uid), userData);
        } catch (err) {
            console.warn('[AUTH] Failed to create Firestore user doc:', err?.message || err);
        }

        return {
            success: true,
            user: result.user,
            error: null
        };
    } catch (err) {
        console.error('[AUTH] Register failed:', err?.code || err);
        return {
            success: false,
            user: null,
            error: mapRegisterError(err)
        };
    }
}

/**
 * تسجيل الدخول بحساب Google
 */
async function loginWithGoogle() {
    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        const result = await signInWithPopup(authInstance, provider);

        try {
            await ensureProfileLoaded(result.user);
        } catch (_) {}

        return {
            success: true,
            user: result.user,
            error: null
        };
    } catch (err) {
        console.error('[AUTH] Google login failed:', err?.code || err);

        if (err?.code === 'auth/popup-closed-by-user') {
            return { success: false, user: null, error: 'تم إغلاق نافذة تسجيل الدخول' };
        }

        if (err?.code === 'auth/cancelled-popup-request') {
            return { success: false, user: null, error: 'تم إلغاء طلب تسجيل الدخول' };
        }

        if (err?.code === 'auth/popup-blocked') {
            return { success: false, user: null, error: 'تم حظر النافذة المنبثقة من المتصفح' };
        }

        return {
            success: false,
            user: null,
            error: err?.message || 'فشل تسجيل الدخول بـ Google'
        };
    }
}

/**
 * تسجيل الخروج
 */
async function logout() {
    try {
        await signOut(authInstance);
        return { success: true, error: null };
    } catch (err) {
        console.error('[AUTH] Logout failed:', err?.message || err);
        return { success: false, error: err?.message || 'فشل تسجيل الخروج' };
    }
}

/**
 * إرسال رابط إعادة تعيين كلمة المرور
 */
async function sendPasswordReset(email) {
    const safeEmail = safeString(email);

    if (!safeEmail) {
        return { success: false, error: 'يرجى إدخال البريد الإلكتروني' };
    }

    if (!safeEmail.includes('@') || !safeEmail.includes('.')) {
        return { success: false, error: 'بريد إلكتروني غير صالح' };
    }

    try {
        await sendPasswordResetEmail(authInstance, safeEmail);
        
        return { success: true, error: null };
    } catch (err) {
        console.error('[AUTH] Password reset failed:', err?.code || err);
        return {
            success: false,
            error: mapResetError(err)
        };
    }
}

// =====================================
// 7. PERSISTENCE HELPERS (NEW)
// =====================================

/**
 * Save auth state to localStorage for session persistence
 * This helps handle page refresh correctly
 */
function persistAuthState() {
    try {
        // WARNING: Do NOT store 'role' in localStorage.
        // Role MUST be verified server-side before any privileged action.
        // Client-side role is for UI display only and must never be trusted for security decisions.
        const state = {
            isLoggedIn: window.__AUTH__.isLoggedIn,
            displayName: window.__AUTH__.displayName,
            avatar: window.__AUTH__.avatar,
            timestamp: Date.now()
        };
        localStorage.setItem('oraa_auth_state', JSON.stringify(state));
    } catch (e) {
        // Silently ignore persistence errors
    }
}

/**
 * Restore auth state from localStorage (for quick UI before Firebase settles)
 */
function restorePersistedState() {
    try {
        const raw = localStorage.getItem('oraa_auth_state');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        // Check if state is stale (older than 24 hours)
        if (parsed?.timestamp && (Date.now() - parsed.timestamp) > 86400000) {
            localStorage.removeItem('oraa_auth_state');
            return null;
        }
        return parsed;
    } catch (e) {
        return null;
    }
}

// =====================================
// 8. UTILITY FUNCTIONS
// =====================================

/**
 * انتظار حتى يكتمل التحقق الأولي من حالة المستخدم (FIXED)
 * الآن يضمن أن Firebase Auth قد انتهى من تحديد الحالة
 */
function waitForAuth(timeout = 5000) {
    // If auth is already ready, return immediately
    if (window.__AUTH__.ready) return Promise.resolve(window.__AUTH__);

    // If Firebase auth is ready (authBootstrapDone), return current state
    if (authBootstrapDone) {
        return Promise.resolve(window.__AUTH__);
    }

    // Wait for auth to be determined (either login or guest state)
    return Promise.race([
        authReadyPromise,
        new Promise((resolve) => {
            setTimeout(() => {
                // Even on timeout, return current state
                resolve(window.__AUTH__);
            }, timeout);
        })
    ]);
}

/**
 * التحقق من صلاحية الوصول
 */
function requireAuth(redirectTo = '/login') {
    if (!window.__AUTH__.isLoggedIn) {
        const target = `${redirectTo}?redirect=${encodeURIComponent(location.pathname + location.search)}`;

        if (typeof window.go === 'function') {
            window.go(target);
        } else {
            location.href = target;
        }

        return false;
    }

    return true;
}

/**
 * التحقق من صلاحيات الأدمن
 */
function isAdmin() {
    return window.__AUTH__.role === 'admin';
}

/**
 * التحقق من صلاحيات المدير فما فوق
 */
function isStaff() {
    return ['admin', 'manager', 'staff'].includes(window.__AUTH__.role);
}

/**
 * التحقق من أن المستخدم VIP
 */
function isVIP() {
    return window.__AUTH__.role === 'vip';
}

/**
 * التحقق من أن الدور أعلى أو يساوي الدور المطلوب
 */
function hasRoleAtLeast(requiredRole = 'member') {
    const current = ROLE_HIERARCHY[window.__AUTH__.role] ?? 0;
    const required = ROLE_HIERARCHY[normalizeRole(requiredRole)] ?? 0;
    return current >= required;
}

/**
 * إعادة تحميل ملف المستخدم من Firestore
 */
async function refreshAuthProfile() {
    if (!authInstance.currentUser) return window.__AUTH__;

    const profile = await loadUserProfile(authInstance.currentUser);
    if (profile) {
        setAuthState(createSignedInState(authInstance.currentUser, profile));
        persistAuthState();
    }
    return window.__AUTH__;
}

/**
 * الوصول إلى الحالة الحالية بشكل آمن
 */
function getAuthState() {
    return { ...window.__AUTH__ };
}

/**
 * الحصول على معلومات المستخدم الحالي
 */
function getCurrentUser() {
    return authInstance?.currentUser || null;
}

/**
 * التحقق من حالة الجاهزية
 */
function isAuthReady() {
    return window.__AUTH__?.ready ?? false;
}

/**
 * التحقق من حالة تسجيل الدخول
 */
function isLoggedIn() {
    return window.__AUTH__?.isLoggedIn ?? false;
}

// =====================================
// 9. EXPORTS
// =====================================
export {
    // Core instances
    authInstance as auth,
    dbInstance as db,

    // Auth functions
    login,
    register,
    loginWithGoogle,
    logout,
    sendPasswordReset,

    // Utility functions
    waitForAuth,
    requireAuth,
    isAdmin,
    isStaff,
    isVIP,
    hasRoleAtLeast,
    refreshAuthProfile,
    getAuthState,
    getCurrentUser,
    isAuthReady,
    isLoggedIn,

    // Persistence helpers (NEW)
    persistAuthState,
    restorePersistedState,

    // Constants
    normalizeRole,
    ROLE_COLORS,
    ROLE_LABELS,
    ROLE_HIERARCHY,
    DEFAULT_AVATAR
};

export default {
    // Core instances
    auth: authInstance,
    db: dbInstance,

    // Auth functions
    login,
    register,
    loginWithGoogle,
    logout,
    sendPasswordReset,

    // Utility functions
    waitForAuth,
    requireAuth,
    isAdmin,
    isStaff,
    isVIP,
    hasRoleAtLeast,
    refreshAuthProfile,
    getAuthState,
    getCurrentUser,
    isAuthReady,
    isLoggedIn,

    // Persistence helpers (NEW)
    persistAuthState,
    restorePersistedState,

    // Constants
    normalizeRole,
    ROLE_COLORS,
    ROLE_LABELS,
    ROLE_HIERARCHY,
    DEFAULT_AVATAR
};

// Auth Module v3.2 loaded silently
