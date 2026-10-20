/**
 * Parent Authentication Service (Secondary Auth)
 * خدمة المصادقة الثانوية لأولياء الأمور وعزل الجلسة عن الشيخ
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  Timestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "../config/firebase.js";

// إعدادات نفس المشروع للـ Secondary App لضمان استقلالية الجلسة
const parentFirebaseConfig = {
  apiKey: "AIzaSyBfSBdzPBXPQZxXZCqRZ6xjO_mk9izvKo4",
  authDomain: "smart-quran-organizer.firebaseapp.com",
  projectId: "smart-quran-organizer",
  storageBucket: "smart-quran-organizer.firebasestorage.app",
  messagingSenderId: "28466334215",
  appId: "1:28466334215:web:0ca5eb5a826fea7f0a38a2",
  measurementId: "G-VE75J26SF6"
};

const parentApp = initializeApp(parentFirebaseConfig, "ParentAppInstance");
export const parentAuth = getAuth(parentApp);
export const parentDb = getFirestore(parentApp);

export const parentAuthService = {
  /**
   * تطبيع رقم الهاتف لإزالة الرموز الزائدة
   */
  normalizePhone(phone) {
    let clean = String(phone || '').trim();
    if (clean.startsWith('+')) {
      clean = clean.substring(1);
    }
    return clean;
  },

  /**
   * توليد البريد الاصطناعي الثابت للشيخ ورقم الهاتف
   */
  generateSyntheticEmail(sheikhId, phone) {
    const cleanPhone = this.normalizePhone(phone);
    return `parent_${sheikhId}_${cleanPhone}@quran-organizer.internal`;
  },

  /**
   * دالة حل أو إنشاء حساب ولي الأمر للطلاب (مربوط بالشيخ ورقم الهاتف)
   */
  async resolveParentUidForStudent(phone, password) {
    try {
      const cleanPhone = this.normalizePhone(phone);
      if (!cleanPhone) {
        return { success: false, error: "رقم هاتف ولي الأمر مطلوب." };
      }

      // الحصول على sheikhId الحالي من الـ Primary Auth
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { success: false, error: "لا يوجد شيخ مسجل الدخول حالياً." };
      }
      const sheikhId = currentUser.uid;

      // الاستعلام عن parent_accounts للشيخ الحالي ورقم الهاتف
      const parentAccountsRef = collection(db, "parent_accounts");
      const q = query(
        parentAccountsRef,
        where("sheikhId", "==", sheikhId),
        where("phone", "==", cleanPhone)
      );

      const querySnapshot = await getDocs(q);
      const accounts = [];
      querySnapshot.forEach(docSnap => {
        accounts.push({ id: docSnap.id, ...docSnap.data() });
      });

      // حالة وجود أكثر من وثيقة لنفس الشيخ ونفس الهاتف (تكرار غير مسموح)
      if (accounts.length > 1) {
        return { success: false, error: "خطأ: يوجد أكثر من حساب مسجل لنفس رقم الهاتف تحت إشراف هذا الشيخ." };
      }

      // حالة وجود ولي الأمر مسبقاً
      if (accounts.length === 1) {
        const existingParentUid = accounts[0].parentUid || accounts[0].id;
        return { success: true, parentUid: existingParentUid };
      }

      // إذا لم يوجد في parent_accounts، نتحقق من وجود الحساب في Firebase Auth أو ننشئه
      if (!password) {
        return { success: false, error: "كلمة المرور الأولية مطلوبة لإنشاء حساب ولي الأمر الجديد." };
      }

      const syntheticEmail = this.generateSyntheticEmail(sheikhId, cleanPhone);
      let parentUid = null;

      try {
        // محاولة إنشاء حساب جديد في Firebase Auth الثانوي
        const userCredential = await createUserWithEmailAndPassword(parentAuth, syntheticEmail, password);
        parentUid = userCredential.user.uid;
      } catch (authError) {
        // إذا كان الحساب موجوداً مسبقاً في Firebase Auth
        if (authError.code === 'auth/email-already-in-use') {
          try {
            const loginCred = await signInWithEmailAndPassword(parentAuth, syntheticEmail, password);
            parentUid = loginCred.user.uid;
          } catch (loginError) {
            await signOut(parentAuth).catch(() => {});
            return { success: false, error: "فشل تسجيل الدخول لحساب ولي الأمر الموجود مسبقاً: كلمة المرور غير صحيحة." };
          }
        } else {
          await signOut(parentAuth).catch(() => {});
          return { success: false, error: "فشل إنشاء حساب مصادقة ولي الأمر: " + authError.message };
        }
      }

      // التأكد من تسجيل الخروج من parentAuth فورا لضمان عزل جلسة الشيخ
      await signOut(parentAuth).catch(() => {});

      if (!parentUid) {
        return { success: false, error: "تعذر تحديد معرف ولي الأمر (parentUid)." };
      }

      // حفظ مستند في parent_accounts/{parentUid} مباشرة باستخدام setDoc مع merge بدون استخدام getDoc
      const parentDocRef = doc(db, "parent_accounts", parentUid);
      await setDoc(parentDocRef, {
        sheikhId: sheikhId,
        parentUid: parentUid,
        phone: cleanPhone,
        createdAt: Timestamp.now()
      }, { merge: true });

      return { success: true, parentUid: parentUid };

    } catch (error) {
      // ضمان تسجيل خروج الـ parentAuth دائماً عند حدوث أي خطأ
      await signOut(parentAuth).catch(() => {});
      console.error("Error resolving parent uid:", error);
      return { success: false, error: error.message };
    }
  }
};
