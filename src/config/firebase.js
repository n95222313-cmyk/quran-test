/**
 * Firebase Core Initialization & Authentication Service
 * طبقة مستقلة لتهيئة Firebase Web SDK (v10+ ESM)
 * وإدارة مصادقة الشيخ وFirestore
 *
 * TEST PROJECT:
 * test-cc853
 */

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// ============================================================
// Firebase Test Project Configuration
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyC7FNd9XYssihLdEXRR0BfeJMmkO2qfsw8",
  authDomain: "test-cc853.firebaseapp.com",
  projectId: "test-cc853",
  storageBucket: "test-cc853.firebasestorage.app",
  messagingSenderId: "459506119460",
  appId: "1:459506119460:web:f767ac7f93f2c4fa8f79b1",
  measurementId: "G-63HVZGE5L5"
};


// ============================================================
// Firebase App
// ============================================================

const app = initializeApp(firebaseConfig);


// ============================================================
// Firebase Authentication
// ============================================================

export const auth = getAuth(app);


// ============================================================
// Firestore
// ============================================================

export const db = getFirestore(app);


// ============================================================
// Sheikh Authentication Service
// ============================================================

export const authService = {

  // ==========================================================
  // تسجيل دخول الشيخ
  // ==========================================================

  async login(email, password) {

    console.log("🔐 Sheikh login started:", {
      email
    });

    try {

      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      console.log("✅ Sheikh login successful:", {
        uid: userCredential.user?.uid || null,
        email: userCredential.user?.email || null
      });

      return {
        success: true,
        user: userCredential.user
      };

    } catch (error) {

      console.error(
        "❌ Firebase Login Error:",
        error.message
      );

      return {
        success: false,
        error: error.message
      };
    }
  },


  // ==========================================================
  // تسجيل خروج الشيخ
  // ==========================================================

  async logout() {

    console.warn("🚪 Sheikh logout requested.", {
      currentUser: auth.currentUser
        ? {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email
          }
        : null
    });

    try {

      await signOut(auth);

      console.log("✅ Sheikh logout completed.");

      return {
        success: true
      };

    } catch (error) {

      console.error(
        "❌ Firebase Logout Error:",
        error.message
      );

      return {
        success: false,
        error: error.message
      };
    }
  },


  // ==========================================================
  // مراقبة حالة تسجيل الدخول
  // ==========================================================

  onAuthStateChange(callback) {

    console.log(
      "👀 Sheikh Auth State Listener Registered."
    );

    return onAuthStateChanged(
      auth,
      (user) => {

        console.log(
          user
            ? "🔐 SHEIKH AUTH STATE: LOGGED IN"
            : "⚠️ SHEIKH AUTH STATE: NULL / LOGGED OUT",
          user
            ? {
                uid: user.uid,
                email: user.email
              }
            : null
        );

        callback(user);
      }
    );
  },


  // ==========================================================
  // المستخدم الحالي
  // ==========================================================

  getCurrentUser() {

    const user =
      auth.currentUser;

    console.log(
      "🔎 Current Sheikh User:",
      user
        ? {
            uid: user.uid,
            email: user.email
          }
        : null
    );

    return user;
  }

};
