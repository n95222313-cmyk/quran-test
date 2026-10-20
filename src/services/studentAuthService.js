/**
 * Student Authentication Service
 * خدمة المصادقة الخاصة بالطلاب
 *
 * Firebase Secondary Auth
 * لعزل جلسة الطالب عن جلسة الشيخ.
 *
 * TEST PROJECT:
 * quran-test-e8139 (Centralized)
 */

import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

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
  getDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  auth,
  db
} from "../config/firebase.js";

import {
  appConfig
} from "../config/app-config.js";


// ============================================================
// Secondary Firebase App (Protected against duplicate initialization)
// ============================================================

const studentApp = !getApps().some(app => app.name === "StudentAppInstance")
  ? initializeApp(
      appConfig.firebaseConfig,
      "StudentAppInstance"
    )
  : getApp("StudentAppInstance");


// ============================================================
// Student Authentication
// ============================================================

export const studentAuth =
  getAuth(studentApp);


// ============================================================
// Student Firestore
// ============================================================

export const studentDb =
  getFirestore(studentApp);


// ============================================================
// Helpers
// ============================================================

/**
 * تحويل النص إلى UTF-8 bytes
 */
function stringToUtf8Bytes(value) {

  return new TextEncoder().encode(value);

}


/**
 * إنشاء SHA-256 Hash
 *
 * نستخدمه فقط عندما يكون اسم المستخدم
 * غير مناسب مباشرة كجزء من Firebase Email.
 */
async function sha256(value) {

  const bytes =
    stringToUtf8Bytes(value);

  const hashBuffer =
    await crypto.subtle.digest(
      "SHA-256",
      bytes
    );

  const hashArray =
    Array.from(
      new Uint8Array(hashBuffer)
    );

  return hashArray
    .map(
      byte =>
        byte
          .toString(16)
          .padStart(2, "0")
    )
    .join("");

}


// ============================================================
// Student Authentication Service
// ============================================================

export const studentAuthService = {


  // ==========================================================
  // تنظيف اسم المستخدم
  // ==========================================================

  normalizeUsername(username) {

    /*
     * نحافظ على الحروف العربية كما هي.
     *
     * بالنسبة للإنجليزي:
     * يتم تحويله إلى lowercase
     * للحفاظ على السلوك القديم.
     *
     * المسافات المتعددة تصبح مسافة واحدة.
     */

    const value =
      String(username ?? "")
        .trim()
        .replace(/\s+/g, " ");

    /*
     * إذا كان الاسم كله إنجليزي/أرقام ورموز
     * نحافظ على السلوك القديم lowercase.
     *
     * العربي لا يتأثر.
     */

    if (
      /^[a-zA-Z0-9._\-\s]+$/.test(value)
    ) {

      return value.toLowerCase();

    }

    return value;

  },


  // ==========================================================
  // التحقق من اسم المستخدم
  // ==========================================================

  validateUsername(username) {

    const clean =
      this.normalizeUsername(username);


    // --------------------------------------------------------
    // فارغ
    // --------------------------------------------------------

    if (!clean) {

      return {
        valid: false,
        error:
          "اسم المستخدم مطلوب."
      };

    }


    // --------------------------------------------------------
    // الحد الأدنى
    // --------------------------------------------------------

    if (clean.length < 2) {

      return {
        valid: false,
        error:
          "اسم المستخدم يجب أن يكون حرفين أو أكثر."
      };

    }


    // --------------------------------------------------------
    // الحد الأقصى
    // --------------------------------------------------------

    if (clean.length > 40) {

      return {
        valid: false,
        error:
          "اسم المستخدم طويل جداً."
      };

    }


    // --------------------------------------------------------
    // الحروف المسموحة
    //
    // عربي
    // إنجليزي
    // أرقام إنجليزية
    // أرقام عربية
    // مسافات
    // _
    // -
    // .
    // --------------------------------------------------------

    const usernameRegex =
      /^[\u0600-\u06FFa-zA-Z0-9٠-٩._\-\s]+$/;


    if (!usernameRegex.test(clean)) {

      return {
        valid: false,
        error:
          "اسم المستخدم يمكن أن يحتوي على الحروف العربية أو الإنجليزية أو الأرقام، مع المسافات و _ و - و ."
      };

    }


    // --------------------------------------------------------
    // نجاح
    // --------------------------------------------------------

    return {

      valid: true,

      username:
        clean

    };

  },


  // ==========================================================
  // هل اسم المستخدم ASCII آمن؟
  // ==========================================================

  isSimpleUsername(username) {

    return /^[a-z0-9._-]+$/.test(
      username
    );

  },


  // ==========================================================
  // تحويل اسم المستخدم إلى Email داخلي
  // ==========================================================

  async generateSyntheticEmail(username) {

    const cleanUsername =
      this.normalizeUsername(username);


    /*
     * مهم جداً:
     *
     * الحسابات القديمة مثل:
     *
     * aaa
     *
     * كانت تستخدم:
     *
     * student_aaa@quran-organizer.internal
     *
     * لذلك نحافظ عليها بدون أي تغيير.
     */

    if (
      this.isSimpleUsername(
        cleanUsername
      )
    ) {

      return (
        "student_" +
        cleanUsername +
        "@quran-organizer.internal"
      );

    }


    /*
     * الأسماء العربية أو التي تحتوي
     * على مسافات يتم تحويلها إلى SHA-256.
     *
     * مثال:
     *
     * عبد الرحمن
     *
     * يصبح داخلياً شيئاً مثل:
     *
     * student_u_<hash>@quran-organizer.internal
     *
     * وهذا لا يغير اسم الطالب المخزن
     * في Firestore.
     */

    const hash =
      await sha256(
        cleanUsername
      );


    /*
     * نستخدم أول 32 حرفاً من الـHash.
     *
     * 128-bit تقريباً من مساحة التصادم،
     * وهي أكثر من كافية لهذا الاستخدام.
     */

    const shortHash =
      hash.substring(
        0,
        32
      );


    return (
      "student_u_" +
      shortHash +
      "@quran-organizer.internal"
    );

  },


  // ==========================================================
  // إنشاء حساب طالب
  // ==========================================================

  async createStudentAccount({
    studentId,
    username,
    password
  }) {

    try {

      // ------------------------------------------------------
      // التأكد من وجود الشيخ
      // ------------------------------------------------------

      const currentSheikh =
        auth.currentUser;


      if (!currentSheikh) {

        return {
          success: false,
          error:
            "لا يوجد شيخ مسجل الدخول حالياً."
        };

      }


      // ------------------------------------------------------
      // التحقق من اسم المستخدم
      // ------------------------------------------------------

      const validation =
        this.validateUsername(username);


      if (!validation.valid) {

        return {
          success: false,
          error:
            validation.error
        };

      }


      // ------------------------------------------------------
      // التحقق من كلمة المرور
      // ------------------------------------------------------

      if (
        !password ||
        password.length < 6
      ) {

        return {
          success: false,
          error:
            "كلمة المرور يجب أن تكون 6 أحرف أو أكثر."
        };

      }


      // ------------------------------------------------------
      // التحقق من Student ID
      // ------------------------------------------------------

      if (!studentId) {

        return {
          success: false,
          error:
            "معرف الطالب مطلوب."
        };

      }


      // ------------------------------------------------------
      // قراءة الطالب
      // ------------------------------------------------------

      const studentRef =
        doc(
          db,
          "students",
          studentId
        );


      const studentSnap =
        await getDoc(studentRef);


      if (!studentSnap.exists()) {

        return {
          success: false,
          error:
            "الطالب غير موجود."
        };

      }


      const studentData =
        studentSnap.data();


      // ------------------------------------------------------
      // التأكد أن الطالب تابع للشيخ الحالي
      // ------------------------------------------------------

      if (
        studentData.sheikhId !==
        currentSheikh.uid
      ) {

        return {
          success: false,
          error:
            "غير مصرح لك بإنشاء حساب لهذا الطالب."
        };

      }


      // ------------------------------------------------------
      // منع إنشاء حساب ثانٍ
      // ------------------------------------------------------

      if (
        studentData.studentAuthUid
      ) {

        return {
          success: false,
          error:
            "هذا الطالب لديه حساب بالفعل."
        };

      }


      // ------------------------------------------------------
      // اسم المستخدم النهائي
      // ------------------------------------------------------

      const usernameClean =
        validation.username;


      // ------------------------------------------------------
      // Email الداخلي
      // ------------------------------------------------------

      const syntheticEmail =
        await this.generateSyntheticEmail(
          usernameClean
        );


      console.log(
        "Creating student account:",
        {
          username:
            usernameClean,

          email:
            syntheticEmail,

          studentId
        }
      );


      let studentUid = null;


      // ------------------------------------------------------
      // إنشاء مستخدم Firebase Authentication
      // ------------------------------------------------------

      try {

        const credential =
          await createUserWithEmailAndPassword(
            studentAuth,
            syntheticEmail,
            password
          );


        studentUid =
          credential.user.uid;


      } catch (authError) {

        console.error(
          "Student Firebase Auth creation error:",
          authError
        );


        if (
          authError.code ===
          "auth/email-already-in-use"
        ) {

          return {
            success: false,

            error:
              "اسم المستخدم مستخدم بالفعل. اختر اسم مستخدم آخر.",

            code:
              authError.code

          };

        }


        if (
          authError.code ===
          "auth/weak-password"
        ) {

          return {
            success: false,

            error:
              "كلمة المرور ضعيفة. استخدم 6 أحرف أو أكثر.",

            code:
              authError.code

          };

        }


        if (
          authError.code ===
          "auth/operation-not-allowed"
        ) {

          return {
            success: false,

            error:
              "تسجيل الدخول بالبريد وكلمة المرور غير مفعل في Firebase.",

            code:
              authError.code

          };

        }


        return {
          success: false,

          error:
            authError.message ||
            "فشل إنشاء حساب الطالب.",

          code:
            authError.code

        };

      } finally {
        await signOut(
          studentAuth
        ).catch(() => {});
      }


      if (!studentUid) {

        return {
          success: false,
          error:
            "تعذر إنشاء معرف حساب الطالب."
        };

      }


      // ------------------------------------------------------
      // ربط حساب Auth بملف الطالب
      // ------------------------------------------------------

      await setDoc(
        studentRef,
        {

          studentAuthUid:
            studentUid,

          studentUsername:
            usernameClean,

          updatedAt:
            Timestamp.now()

        },

        {
          merge: true
        }
      );


      // ------------------------------------------------------
      // إنشاء Mapping
      // ------------------------------------------------------

      const accountRef =
        doc(
          db,
          "student_accounts",
          studentUid
        );


      await setDoc(
        accountRef,
        {

          studentUid:
            studentUid,

          studentId:
            studentId,

          sheikhId:
            currentSheikh.uid,

          username:
            usernameClean,

          createdAt:
            Timestamp.now()

        }
      );


      // ------------------------------------------------------
      // نجاح
      // ------------------------------------------------------

      console.log(
        "Student account created successfully:",
        {

          studentUid,

          username:
            usernameClean,

          email:
            syntheticEmail

        }
      );


      return {

        success: true,

        studentUid,

        username:
          usernameClean

      };


    } catch (error) {

      console.error(
        "Student account creation error:",
        error
      );


      return {

        success: false,

        error:
          error.message ||
          "حدث خطأ أثناء إنشاء حساب الطالب.",

        code:
          error.code || null

      };

    }

  },


  // ==========================================================
  // تسجيل دخول الطالب
  // ==========================================================

  async login(
    username,
    password
  ) {

    try {

      console.log(
        "Student login started:",
        {
          username
        }
      );


      // ------------------------------------------------------
      // التحقق من اسم المستخدم
      // ------------------------------------------------------

      const validation =
        this.validateUsername(username);


      if (!validation.valid) {

        console.error(
          "Student username validation failed:",
          validation.error
        );


        return {

          success: false,

          error:
            validation.error,

          code:
            "student/invalid-username"

        };

      }


      // ------------------------------------------------------
      // التحقق من كلمة المرور
      // ------------------------------------------------------

      if (!password) {

        return {

          success: false,

          error:
            "كلمة المرور مطلوبة.",

          code:
            "student/password-required"

        };

      }


      // ------------------------------------------------------
      // اسم المستخدم النهائي
      // ------------------------------------------------------

      const cleanUsername =
        validation.username;


      // ------------------------------------------------------
      // إنشاء Email الداخلي
      // ------------------------------------------------------

      const syntheticEmail =
        await this.generateSyntheticEmail(
          cleanUsername
        );


      console.log(
        "Student login email:",
        syntheticEmail
      );


      // ------------------------------------------------------
      // تسجيل الدخول
      // ------------------------------------------------------

      const credential =
        await signInWithEmailAndPassword(
          studentAuth,
          syntheticEmail,
          password
        );


      console.log(
        "Student login successful:",
        {

          uid:
            credential.user.uid,

          username:
            cleanUsername

        }
      );


      return {

        success: true,

        user:
          credential.user

      };


    } catch (error) {

      console.error(
        "Student login error:",
        error
      );


      // ------------------------------------------------------
      // رسائل مفهومة لأخطاء Firebase
      // ------------------------------------------------------

      let message =
        error.message ||
        "فشل تسجيل الدخول.";


      if (
        error.code ===
        "auth/invalid-credential"
      ) {

        message =
          "اسم المستخدم أو كلمة المرور غير صحيحة.";

      }


      else if (
        error.code ===
        "auth/user-not-found"
      ) {

        message =
          "حساب الطالب غير موجود في Firebase.";

      }


      else if (
        error.code ===
        "auth/wrong-password"
      ) {

        message =
          "كلمة المرور غير صحيحة.";

      }


      else if (
        error.code ===
        "auth/invalid-email"
      ) {

        message =
          "تعذر تكوين حساب الطالب من اسم المستخدم.";

      }


      else if (
        error.code ===
        "auth/user-disabled"
      ) {

        message =
          "حساب الطالب متوقف.";

      }


      else if (
        error.code ===
        "auth/too-many-requests"
      ) {

        message =
          "تم إجراء محاولات كثيرة. حاول مرة أخرى لاحقاً.";

      }


      else if (
        error.code ===
        "auth/network-request-failed"
      ) {

        message =
          "تعذر الاتصال بخدمة Firebase. تحقق من الإنترنت.";

      }


      return {

        success: false,

        error:
          message,

        code:
          error.code || null

      };

    }

  },


  // ==========================================================
  // تسجيل خروج الطالب
  // ==========================================================

  async logout() {

    try {

      await signOut(
        studentAuth
      );


      return {
        success: true,
        error: null
      };


    } catch (error) {

      console.error(
        "Student logout error:",
        error
      );


      return {

        success: false,

        error:
          error.message

      };

    }

  },


  // ==========================================================
  // الطالب الحالي
  // ==========================================================

  getCurrentStudentAuth() {

    return studentAuth.currentUser;

  }

};
