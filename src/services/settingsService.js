/**
 * Settings Service (Sheikh Account & Preferences Management)
 * خدمة إدارة إعدادات وبيانات الشيخ المرتبطة حصرياً بـ auth.currentUser.uid عبر Firestore مباشرة
 */
import { doc, getDoc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, auth } from "../config/firebase.js";

const COLLECTION_NAME = "sheikh_settings";
export const settingsService = {
  async getSheikhSettings() {
    try {
      const user = auth.currentUser;
      if (!user) return { success: false, error: "المستخدم غير مسجل الدخول." };

      const uid = user.uid;
      const docRef = doc(db, COLLECTION_NAME, uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { success: true, data: docSnap.data() };
      }

      return { success: true, data: { name: "", title: "الشيخ" } };
    } catch (error) {
      console.error("Error fetching sheikh settings:", error);
      return { success: false, error: error.message };
    }
  },

  async saveSheikhSettings(settingsData) {
    try {
      const user = auth.currentUser;
      if (!user) return { success: false, error: "المستخدم غير مسجل الدخول." };

      const uid = user.uid;
      const docRef = doc(db, COLLECTION_NAME, uid);

      const payload = {
        sheikhId: uid,
        name: settingsData.name || "",
        title: settingsData.title || "الشيخ",
        updatedAt: Timestamp.now()
      };

      await setDoc(docRef, payload, { merge: true });
      return { success: true };
    } catch (error) {
      console.error("Error saving sheikh settings:", error);
      return { success: false, error: error.message };
    }
  }
};
