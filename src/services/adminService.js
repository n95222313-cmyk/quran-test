/**
 * Admin Service (Sheikhs Management)
 * إدارة حسابات الشيوخ بواسطة الإدارة المركزية باستخدام Secondary Firebase App
 */
import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  Timestamp,
  query,
  where,
  getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { db, auth } from "../config/firebase.js";
import { appConfig } from "../config/app-config.js";

const adminApp = !getApps().some(app => app.name === "AdminSheikhAppInstance")
  ? initializeApp(appConfig.firebaseConfig, "AdminSheikhAppInstance")
  : getApp("AdminSheikhAppInstance");

const adminAuth = getAuth(adminApp);

export const adminService = {
  async createSheikhAccount({ name, email, password }) {
    let newUid = null;
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== appConfig.centerAdminUid) {
        return { success: false, error: "غير مصرح لك بإجراء هذه العملية." };
      }

      const cleanName = String(name || "").trim();
      const cleanEmail = String(email || "").trim().toLowerCase();
      const cleanPassword = String(password || "");

      if (!cleanName || !cleanEmail || !cleanPassword) {
        return { success: false, error: "جميع الحقول (الاسم، البريد، كلمة المرور) مطلوبة." };
      }

      if (cleanPassword.length < 6) {
        return { success: false, error: "كلمة المرور يجب أن تكون 6 أحرف أو أكثر." };
      }

      const credential = await createUserWithEmailAndPassword(adminAuth, cleanEmail, cleanPassword);
      newUid = credential.user.uid;

      if (!newUid) {
        return { success: false, error: "تعذر الحصول على معرف الشيخ الجديد." };
      }

      const sheikhRef = doc(db, "sheikhs", newUid);
      const now = Timestamp.now();

      const payload = {
        sheikhId: newUid,
        name: cleanName,
        email: cleanEmail,
        role: "sheikh",
        disabled: false,
        createdAt: now,
        updatedAt: now
      };

      await setDoc(sheikhRef, payload);

      return { success: true, uid: newUid };
    } catch (error) {
      console.error("Create sheikh account error:", error);
      return { success: false, error: error.message || "حدث خطأ غير متوقع." };
    } finally {
      await signOut(adminAuth).catch(() => {});
    }
  },

  async getSheikhs() {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== appConfig.centerAdminUid) {
        return { success: false, error: "غير مصرح.", data: [] };
      }

      const querySnapshot = await getDocs(collection(db, "sheikhs"));
      const sheikhs = [];
      querySnapshot.forEach(docSnap => {
        sheikhs.push({ id: docSnap.id, ...docSnap.data() });
      });

      return { success: true, data: sheikhs };
    } catch (error) {
      console.error("Error fetching sheikhs:", error);
      return { success: false, error: error.message, data: [] };
    }
  },

  async getSheikhStudentCount(sheikhUid) {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== appConfig.centerAdminUid) {
        return 0;
      }
      if (!sheikhUid) return 0;

      const q = query(collection(db, "students"), where("sheikhId", "==", sheikhUid));
      const snapshot = await getCountFromServer(q);
      return snapshot.data().count;
    } catch (error) {
      console.error("Error getting sheikh student count:", error);
      return 0;
    }
  },

  async updateSheikhStatus(sheikhUid, disabledState) {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== appConfig.centerAdminUid) {
        return { success: false, error: "غير مصرح." };
      }

      if (!sheikhUid) {
        return { success: false, error: "معرف الشيخ مطلوب." };
      }

      const sheikhRef = doc(db, "sheikhs", sheikhUid);
      await updateDoc(sheikhRef, {
        disabled: Boolean(disabledState),
        updatedAt: Timestamp.now()
      });

      return { success: true };
    } catch (error) {
      console.error("Error updating sheikh status:", error);
      return { success: false, error: error.message };
    }
  }
};
