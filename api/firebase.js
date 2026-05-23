// /api/firebase.js
// =====================================
// Firebase Professional Core Module
// Auth + Firestore + Storage + Analytics
// =====================================

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
        getAnalytics,
        isSupported as isAnalyticsSupported,
        logEvent
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";

import {
        getAuth,
        onAuthStateChanged,
        signOut,
        signInWithPopup,
        GoogleAuthProvider,
        createUserWithEmailAndPassword,
        signInWithEmailAndPassword,
        updateProfile,
        sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import {
        getFirestore,
        doc,
        getDoc,
        setDoc,
        updateDoc,
        deleteDoc,
        collection,
        addDoc,
        getDocs,
        query,
        where,
        orderBy,
        limit,
        arrayUnion,
        arrayRemove,
        serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

import {
        getStorage,
        ref,
        uploadBytes,
        getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

import {
        initializeAppCheck,
        ReCaptchaV3Provider
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app-check.js";

// ==========================
// Configuration
// ==========================
// SECURITY NOTE: Firebase API keys are designed to be public in client-side code.
// Access is controlled through Firebase Security Rules (Firestore, Storage) and
// Authorized Domains (Auth). Ensure Security Rules are properly configured to
// restrict unauthenticated access. App Check is enabled below for additional protection.
const firebaseConfig = {
        apiKey: "AIzaSyBDMFcCvthKNkHUrEbgYY1Uc80KTPpS01M",
        authDomain: "oraa-slayer-anime.firebaseapp.com",
        projectId: "oraa-slayer-anime",
        storageBucket: "oraa-slayer-anime.firebasestorage.app",
        messagingSenderId: "426607460785",
        appId: "1:426607460785:web:c8d9844253c9111ad3bd90",
        measurementId: "G-VNHP64HXD5"
};

// ==========================
// Safe initialization
// ==========================
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ==========================
// App Check (abuse protection)
// ==========================
// Enables reCAPTCHA v3 attestation to verify that requests originate from
// the legitimate app. Protects against unauthorized API usage.
try {
        initializeAppCheck(app, {
                provider: new ReCaptchaV3Provider('6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'),
                isTokenAutoRefreshEnabled: true
        });
} catch (_) {
        // App Check initialization may fail in non-browser environments; silently continue.
}

// Analytics may not be available in every environment
let analytics = null;
try {
        if (await isAnalyticsSupported()) {
                analytics = getAnalytics(app);
        }
} catch (err) {
        console.warn("Analytics is unavailable in this environment:", err);
}

// ==========================
// Helpers
// ==========================
const googleProvider = new GoogleAuthProvider();

function logAppEvent(name, params = {}) {
        if (!analytics) return;
        try {
                logEvent(analytics, name, params);
        } catch (err) {
                console.warn("logEvent failed:", err);
        }
}

function getUserDoc(uid, collectionName = "users") {
        return doc(db, collectionName, uid);
}

async function safeGetDoc(refDoc) {
        const snap = await getDoc(refDoc);
        return {
                exists: snap.exists(),
                id: snap.id,
                data: snap.exists() ? snap.data() : null,
                snapshot: snap
        };
}

async function safeSetDoc(refDoc, data, options = {}) {
        if (options.merge) {
                return setDoc(refDoc, data, { merge: true });
        }
        return setDoc(refDoc, data);
}

async function safeUpdateProfile(user, data) {
        if (!user) throw new Error("No authenticated user found.");
        return updateProfile(user, data);
}

async function signInWithGoogle() {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
}

async function signUpWithEmail(email, password, displayName = "") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
                await updateProfile(cred.user, { displayName });
        }
        return cred.user;
}

async function signInWithEmail(email, password) {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        return cred.user;
}

async function signOutUser() {
        return signOut(auth);
}

async function uploadFileToStorage(path, file, metadata = {}) {
        const storageRef = ref(storage, path);
        const snap = await uploadBytes(storageRef, file, metadata);
        const url = await getDownloadURL(snap.ref);
        return { snap, url };
}

function nowServer() {
        return serverTimestamp();
}

// ==========================
// Global compatibility
// ==========================
window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDB = db;
window.firebaseStorage = storage;
window.firebaseAnalytics = analytics;
window.firebaseGoogleProvider = googleProvider;

// ==========================
// Startup analytics
// ==========================
logAppEvent("app_start", {
        version: "5.6_oraa_combined",
        platform: "web"
});

// Firebase initialized silently (no console output in production)

// ==========================
// Exports
// ==========================
export {
        // core
        app,
        auth,
        db,
        storage,
        analytics,
        
        // config / provider
        firebaseConfig,
        googleProvider,
        
        // auth SDK
        onAuthStateChanged,
        signOut,
        signInWithPopup,
        GoogleAuthProvider,
        createUserWithEmailAndPassword,
        signInWithEmailAndPassword,
        updateProfile,
        sendPasswordResetEmail,
        
        // firestore SDK
        doc,
        getDoc,
        setDoc,
        updateDoc,
        deleteDoc,
        collection,
        addDoc,
        getDocs,
        query,
        where,
        orderBy,
        limit,
        arrayUnion,
        arrayRemove,
        serverTimestamp,
        
        // storage SDK
        ref,
        uploadBytes,
        getDownloadURL,
        
        // helpers
        logAppEvent,
        getUserDoc,
        safeGetDoc,
        safeSetDoc,
        safeUpdateProfile,
        signInWithGoogle,
        signUpWithEmail,
        signInWithEmail,
        signOutUser,
        uploadFileToStorage,
        nowServer
};

export default {
        app,
        auth,
        db,
        storage,
        analytics,
        firebaseConfig,
        googleProvider,
        logAppEvent,
        getUserDoc,
        safeGetDoc,
        safeSetDoc,
        safeUpdateProfile,
        signInWithGoogle,
        signUpWithEmail,
        signInWithEmail,
        signOutUser,
        uploadFileToStorage,
        nowServer
};
