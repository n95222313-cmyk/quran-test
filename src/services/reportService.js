/**
 * Report Service (Firestore CRUD Operations & Quran Surah Data)
 * طبقة مستقلة لإدارة تقارير الحصص في Firestore وبيانات سور القرآن الكريم
 *
 * دعم:
 * - المواعيد الفردية
 * - المواعيد الجماعية
 * - تقرير مستقل لكل طالب داخل المجموعة
 * - الحفاظ على توافق التقارير الفردية القديمة
 * - تسجيل إلغاء الحصة كتقرير مستقل
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  setDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { db, auth } from "../config/firebase.js";

// ============================================================
// Collection
// ============================================================

const COLLECTION_NAME = "lesson_reports";

// ============================================================
// بيانات سور القرآن الكريم
// ============================================================

export const QURAN_SURAHS = [
  { number: 1, name: "الفاتحة", ayahs: 7 },
  { number: 2, name: "البقرة", ayahs: 286 },
  { number: 3, name: "آل عمران", ayahs: 200 },
  { number: 4, name: "النساء", ayahs: 176 },
  { number: 5, name: "المائدة", ayahs: 120 },
  { number: 6, name: "الأنعام", ayahs: 165 },
  { number: 7, name: "الأعراف", ayahs: 206 },
  { number: 8, name: "الأنفال", ayahs: 75 },
  { number: 9, name: "التوبة", ayahs: 129 },
  { number: 10, name: "يونس", ayahs: 109 },
  { number: 11, name: "هود", ayahs: 123 },
  { number: 12, name: "يوسف", ayahs: 111 },
  { number: 13, name: "الرعد", ayahs: 43 },
  { number: 14, name: "إبراهيم", ayahs: 52 },
  { number: 15, name: "الحجر", ayahs: 99 },
  { number: 16, name: "النحل", ayahs: 128 },
  { number: 17, name: "الإسراء", ayahs: 111 },
  { number: 18, name: "الكهف", ayahs: 110 },
  { number: 19, name: "مريم", ayahs: 98 },
  { number: 20, name: "طه", ayahs: 135 },
  { number: 21, name: "الأنبياء", ayahs: 112 },
  { number: 22, name: "الحج", ayahs: 78 },
  { number: 23, name: "المؤمنون", ayahs: 118 },
  { number: 24, name: "النور", ayahs: 64 },
  { number: 25, name: "الفرقان", ayahs: 77 },
  { number: 26, name: "الشعراء", ayahs: 227 },
  { number: 27, name: "النمل", ayahs: 93 },
  { number: 28, name: "القصص", ayahs: 88 },
  { number: 29, name: "العنكبوت", ayahs: 69 },
  { number: 30, name: "الروم", ayahs: 60 },
  { number: 31, name: "لقمان", ayahs: 34 },
  { number: 32, name: "السجدة", ayahs: 30 },
  { number: 33, name: "الأحزاب", ayahs: 73 },
  { number: 34, name: "سبأ", ayahs: 54 },
  { number: 35, name: "فاطر", ayahs: 45 },
  { number: 36, name: "يس", ayahs: 83 },
  { number: 37, name: "الصافات", ayahs: 182 },
  { number: 38, name: "ص", ayahs: 88 },
  { number: 39, name: "الزمر", ayahs: 75 },
  { number: 40, name: "غافر", ayahs: 85 },
  { number: 41, name: "فصلت", ayahs: 54 },
  { number: 42, name: "الشورى", ayahs: 53 },
  { number: 43, name: "الزخرف", ayahs: 89 },
  { number: 44, name: "الدخان", ayahs: 59 },
  { number: 45, name: "الجاثية", ayahs: 37 },
  { number: 46, name: "الأحقاف", ayahs: 35 },
  { number: 47, name: "محمد", ayahs: 38 },
  { number: 48, name: "الفتح", ayahs: 29 },
  { number: 49, name: "الحجرات", ayahs: 18 },
  { number: 50, name: "ق", ayahs: 45 },
  { number: 51, name: "الذاريات", ayahs: 60 },
  { number: 52, name: "الطور", ayahs: 49 },
  { number: 53, name: "النجم", ayahs: 62 },
  { number: 54, name: "القمر", ayahs: 55 },
  { number: 55, name: "الرحمن", ayahs: 78 },
  { number: 56, name: "الواقعة", ayahs: 96 },
  { number: 57, name: "الحديد", ayahs: 29 },
  { number: 58, name: "المجادلة", ayahs: 22 },
  { number: 59, name: "الحشر", ayahs: 24 },
  { number: 60, name: "الممتحنة", ayahs: 13 },
  { number: 61, name: "الصف", ayahs: 14 },
  { number: 62, name: "الجمعة", ayahs: 11 },
  { number: 63, name: "المنافقون", ayahs: 11 },
  { number: 64, name: "التغابن", ayahs: 18 },
  { number: 65, name: "الطلاق", ayahs: 12 },
  { number: 66, name: "التحريم", ayahs: 12 },
  { number: 67, name: "الملك", ayahs: 30 },
  { number: 68, name: "القلم", ayahs: 52 },
  { number: 69, name: "الحاقة", ayahs: 52 },
  { number: 70, name: "المعارج", ayahs: 44 },
  { number: 71, name: "نوح", ayahs: 28 },
  { number: 72, name: "الجن", ayahs: 28 },
  { number: 73, name: "المزمل", ayahs: 20 },
  { number: 74, name: "المدثر", ayahs: 56 },
  { number: 75, name: "القيامة", ayahs: 40 },
  { number: 76, name: "الإنسان", ayahs: 31 },
  { number: 77, name: "المرسلات", ayahs: 50 },
  { number: 78, name: "النبأ", ayahs: 40 },
  { number: 79, name: "النازعات", ayahs: 46 },
  { number: 80, name: "عبس", ayahs: 42 },
  { number: 81, name: "التكوير", ayahs: 29 },
  { number: 82, name: "الانفطار", ayahs: 19 },
  { number: 83, name: "المطففين", ayahs: 36 },
  { number: 84, name: "الانشقاق", ayahs: 25 },
  { number: 85, name: "البروج", ayahs: 22 },
  { number: 86, name: "الطارق", ayahs: 17 },
  { number: 87, name: "الأعلى", ayahs: 19 },
  { number: 88, name: "الغاشية", ayahs: 26 },
  { number: 89, name: "الفجر", ayahs: 30 },
  { number: 90, name: "البلد", ayahs: 20 },
  { number: 91, name: "الشمس", ayahs: 15 },
  { number: 92, name: "الليل", ayahs: 21 },
  { number: 93, name: "الضحى", ayahs: 11 },
  { number: 94, name: "الشرح", ayahs: 8 },
  { number: 95, name: "التين", ayahs: 8 },
  { number: 96, name: "العلق", ayahs: 19 },
  { number: 97, name: "القدر", ayahs: 5 },
  { number: 98, name: "البينة", ayahs: 8 },
  { number: 99, name: "الزلزلة", ayahs: 8 },
  { number: 100, name: "العاديات", ayahs: 11 },
  { number: 101, name: "القارعة", ayahs: 11 },
  { number: 102, name: "التكاثر", ayahs: 8 },
  { number: 103, name: "العصر", ayahs: 3 },
  { number: 104, name: "الهمزة", ayahs: 9 },
  { number: 105, name: "الفيل", ayahs: 5 },
  { number: 106, name: "قريش", ayahs: 4 },
  { number: 107, name: "الماعون", ayahs: 7 },
  { number: 108, name: "الكوثر", ayahs: 3 },
  { number: 109, name: "الكافرون", ayahs: 6 },
  { number: 110, name: "النصر", ayahs: 3 },
  { number: 111, name: "المسد", ayahs: 5 },
  { number: 112, name: "الإخلاص", ayahs: 4 },
  { number: 113, name: "الفلق", ayahs: 5 },
  { number: 114, name: "الناس", ayahs: 6 }
];

// ============================================================
// Report Service
// ============================================================

export const reportService = {

  // ============================================================
  // الحصول على UID الشيخ الحالي
  // ============================================================

  _getCurrentSheikhId() {
    return auth.currentUser?.uid || null;
  },


  // ============================================================
  // تاريخ اليوم بتوقيت القاهرة
  // ============================================================

  getTodayCairoDate() {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });

    return formatter.format(new Date());
  },


  // ============================================================
  // تحديد هل الجدول جماعي
  // ============================================================

  _isGroupSchedule(scheduleData) {
    return (
      scheduleData?.scheduleKind === "group" ||
      scheduleData?.type === "group"
    );
  },


  // ============================================================
  // بناء ID التقرير
  // ============================================================

  _buildReportDocId(
    sheikhId,
    scheduleId,
    dateString,
    studentId = null,
    isGroup = false
  ) {
    if (isGroup && studentId) {
      return `${sheikhId}_${scheduleId}_${studentId}_${dateString}`;
    }

    return `${sheikhId}_${scheduleId}_${dateString}`;
  },


  // ============================================================
  // التحقق من وجود تقرير للحصة (مع التشخيص الدقيق)
  // ============================================================

  async hasReportForSchedule(
    scheduleId,
    dateString,
    studentId = null
  ) {
    try {
      const sheikhId =
        this._getCurrentSheikhId();

      if (!sheikhId || !scheduleId) {
        return false;
      }

      const scheduleRef =
        doc(
          db,
          "schedules",
          scheduleId
        );

      let scheduleSnap;
      try {
        scheduleSnap =
          await getDoc(
            scheduleRef
          );
      } catch (docErr) {
        console.error("DIAGNOSTIC FAILURE - Operation: getDoc(scheduleRef)", {
          code: docErr.code,
          message: docErr.message,
          scheduleId
        });
        throw docErr;
      }

      if (!scheduleSnap.exists()) {
        return false;
      }

      const scheduleData =
        scheduleSnap.data();

      if (
        scheduleData.sheikhId !==
        sheikhId
      ) {
        return false;
      }

      const isGroup =
        this._isGroupSchedule(
          scheduleData
        );

      const reportQueryConstraints = [
        where(
          "sheikhId",
          "==",
          sheikhId
        ),

        where(
          "scheduleId",
          "==",
          scheduleId
        ),

        where(
          "date",
          "==",
          dateString
        )
      ];

      if (
        isGroup &&
        studentId
      ) {
        reportQueryConstraints.push(
          where(
            "studentId",
            "==",
            studentId
          )
        );
      }

      const reportsQuery =
        query(
          collection(
            db,
            COLLECTION_NAME
          ),
          ...reportQueryConstraints
        );

      let snapshot;
      try {
        snapshot =
          await getDocs(
            reportsQuery
          );
      } catch (docsErr) {
        console.error("DIAGNOSTIC FAILURE - Operation: getDocs(reportsQuery)", {
          code: docsErr.code,
          message: docsErr.message,
          scheduleId,
          dateString
        });
        throw docsErr;
      }

      if (snapshot.empty) {
        return false;
      }

      if (!isGroup) {
        return true;
      }

      if (!studentId) {
        return snapshot.docs.length > 0;
      }

      return snapshot.docs.some(
        reportDoc =>
          reportDoc.data()?.studentId ===
          studentId
      );

    } catch (error) {
      console.error(
        "Error checking report existence (Diagnostic Caught):",
        error.code,
        error.message
      );

      return false;
    }
  },


  // ============================================================
  // الحصول على تقارير اليوم
  // ============================================================

  async getTodayReports() {
    try {
      const sheikhId =
        this._getCurrentSheikhId();

      if (!sheikhId) {
        return [];
      }

      const dateStr =
        this.getTodayCairoDate();

      const reportsQuery =
        query(
          collection(
            db,
            COLLECTION_NAME
          ),

          where(
            "sheikhId",
            "==",
            sheikhId
          ),

          where(
            "date",
            "==",
            dateStr
          )
        );

      const snapshot =
        await getDocs(
          reportsQuery
        );

      return snapshot.docs.map(
        reportDoc => ({
          id: reportDoc.id,
          ...reportDoc.data()
        })
      );

    } catch (error) {
      console.error(
        "Error getting today's reports:",
        error
      );

      return [];
    }
  },


  // ============================================================
  // الحصول على رقم الحصة التالية للطالب في دورته الحالية
  // ============================================================

  async getStudentNextLessonNumber(studentId) {
    try {
      const sheikhId = this._getCurrentSheikhId();
      if (!sheikhId || !studentId) {
        return 1;
      }

      const studentRef = doc(db, "students", studentId);
      const studentSnap = await getDoc(studentRef);
      if (!studentSnap.exists()) {
        return 1;
      }

      const studentData = studentSnap.data();
      const activeCycleId = studentData.activeLessonCounterCycleId || null;

      const reports = await this.getStudentReports(studentId);
      const currentCycleReports = reports.filter(r => {
        if (r.status === "cancelled") return false;
        if (activeCycleId) {
          return r.lessonCounterCycleId === activeCycleId;
        }
        return true;
      });

      if (currentCycleReports.length === 0) {
        return 1;
      }

      let maxNum = 0;
      currentCycleReports.forEach(r => {
        const num = Number(r.lessonNumber);
        if (Number.isInteger(num) && num > maxNum) {
          maxNum = num;
        }
      });

      return maxNum > 0 ? maxNum + 1 : currentCycleReports.length + 1;
    } catch (error) {
      console.error("Error getting next lesson number:", error);
      return 1;
    }
  },


  // ============================================================
  // إضافة تقرير حصة عادي
  // ============================================================

  async addLessonReport(reportData) {
    try {
      const sheikhId =
        this._getCurrentSheikhId();

      if (!sheikhId) {
        return {
          success: false,
          error:
            "يجب تسجيل الدخول كشيخ أولاً."
        };
      }

      if (!reportData?.scheduleId) {
        return {
          success: false,
          error:
            "معرف الحصة غير موجود."
        };
      }

      if (!reportData?.studentId) {
        return {
          success: false,
          error:
            "معرف الطالب غير موجود."
        };
      }

      const dateStr =
        reportData.date ||
        this.getTodayCairoDate();


      // ----------------------------------------------------------
      // تحميل الحصة
      // ----------------------------------------------------------

      const scheduleRef =
        doc(
          db,
          "schedules",
          reportData.scheduleId
        );

      const scheduleSnap =
        await getDoc(
          scheduleRef
        );

      if (!scheduleSnap.exists()) {
        return {
          success: false,
          error:
            "الحصة غير موجودة."
        };
      }

      const scheduleData =
        scheduleSnap.data();


      // ----------------------------------------------------------
      // التحقق من ملكية الشيخ
      // ----------------------------------------------------------

      if (
        scheduleData.sheikhId !==
        sheikhId
      ) {
        return {
          success: false,
          error:
            "هذه الحصة لا تخص الشيخ الحالي."
        };
      }

      const isGroup =
        this._isGroupSchedule(
          scheduleData
        );


      // ----------------------------------------------------------
      // تحميل الطالب
      // ----------------------------------------------------------

      const studentRef =
        doc(
          db,
          "students",
          reportData.studentId
        );

      const studentSnap =
        await getDoc(
          studentRef
        );

      if (!studentSnap.exists()) {
        return {
          success: false,
          error:
            "الطالب غير موجود."
        };
      }

      const studentData =
        studentSnap.data();


      // ----------------------------------------------------------
      // التحقق من ملكية الشيخ للطالب
      // ----------------------------------------------------------

      if (
        studentData.sheikhId !==
        sheikhId
      ) {
        return {
          success: false,
          error:
            "هذا الطالب لا يتبع الشيخ الحالي."
        };
      }


      // ----------------------------------------------------------
      // التحقق من ارتباط الطالب بالحصة
      // ----------------------------------------------------------

      if (isGroup) {

        const studentIds =
          Array.isArray(
            scheduleData.studentIds
          )
            ? scheduleData.studentIds
            : [];

        if (
          !studentIds.includes(
            reportData.studentId
          )
        ) {
          return {
            success: false,
            error:
              "هذا الطالب ليس ضمن هذه المجموعة."
          };
        }

      } else {

        if (
          scheduleData.studentId !==
          reportData.studentId
        ) {
          return {
            success: false,
            error:
              "هذا الطالب ليس مرتبطاً بهذه الحصة."
          };
        }
      }


      // ----------------------------------------------------------
      // منع تكرار التقرير
      // ----------------------------------------------------------

      const alreadyExists =
        await this.hasReportForSchedule(
          reportData.scheduleId,
          dateStr,
          reportData.studentId
        );

      if (alreadyExists) {
        return {
          success: false,
          error:
            "تم تسجيل تقرير لهذه الحصة بالفعل اليوم."
        };
      }


      // ----------------------------------------------------------
      // بناء ID التقرير
      // ----------------------------------------------------------

      const reportId =
        this._buildReportDocId(
          sheikhId,
          reportData.scheduleId,
          dateStr,
          reportData.studentId,
          isGroup
        );

      const reportRef =
        doc(
          db,
          COLLECTION_NAME,
          reportId
        );


      // ----------------------------------------------------------
      // تقييم الحفظ والمراجعة (من 0 إلى 10)
      // ----------------------------------------------------------

      let memorizationRatingValue = null;
      if (
        reportData.memorizationRating !== undefined &&
        reportData.memorizationRating !== null &&
        reportData.memorizationRating !== ""
      ) {
        const parsedMem = Number(reportData.memorizationRating);
        if (Number.isInteger(parsedMem) && parsedMem >= 0 && parsedMem <= 10) {
          memorizationRatingValue = parsedMem;
        }
      }

      let reviewRatingValue = null;
      if (
        reportData.reviewRating !== undefined &&
        reportData.reviewRating !== null &&
        reportData.reviewRating !== ""
      ) {
        const parsedRev = Number(reportData.reviewRating);
        if (Number.isInteger(parsedRev) && parsedRev >= 0 && parsedRev <= 10) {
          reviewRatingValue = parsedRev;
        }
      }


      // ----------------------------------------------------------
      // رقم الحصة ودورة العداد
      // ----------------------------------------------------------

      let assignedLessonNumber = Number(reportData.lessonNumber);
      if (!Number.isInteger(assignedLessonNumber) || assignedLessonNumber < 1) {
        assignedLessonNumber = await this.getStudentNextLessonNumber(reportData.studentId);
      }

      const activeCycleId = studentData.activeLessonCounterCycleId || null;


      // ----------------------------------------------------------
      // بيانات التقرير
      // ----------------------------------------------------------

      const payload = {
        sheikhId: sheikhId,

        studentId:
          reportData.studentId,

        scheduleId:
          reportData.scheduleId,

        date:
          dateStr,

        completedAt:
          Timestamp.now(),

        memorization:
          Array.isArray(
            reportData.memorization
          )
            ? reportData.memorization
            : [],

        review:
          Array.isArray(
            reportData.review
          )
            ? reportData.review
            : [],

        memorizationRating: memorizationRatingValue,
        reviewRating: reviewRatingValue,

        lessonNumber: assignedLessonNumber,
        lessonCounterCycleId: activeCycleId,

        notes:
          reportData.notes || ""
      };


      // ----------------------------------------------------------
      // بيانات المجموعة
      // ----------------------------------------------------------

      if (isGroup) {

        payload.isGroup =
          true;

        payload.groupId =
          reportData.groupId ||
          reportData.scheduleId;

        payload.groupName =
          reportData.groupName ||
          scheduleData.groupName ||
          "";
      }


      // ----------------------------------------------------------
      // حفظ التقرير بمعاملة آمنة (Transaction)
      // ----------------------------------------------------------

      await runTransaction(
        db,
        async transaction => {
          const stSnap = await transaction.get(studentRef);
          if (!stSnap.exists()) {
            throw new Error("الطالب غير موجود.");
          }
          transaction.set(
            reportRef,
            payload
          );
        }
      );

      return {
        success: true,

        reportId:
          reportId,

        report: {
          id: reportId,
          ...payload
        }
      };

    } catch (error) {

      console.error(
        "Error adding lesson report:",
        error
      );

      return {
        success: false,

        error:
          error?.message ||
          "حدث خطأ أثناء حفظ التقرير."
      };
    }
  },


  // ============================================================
  // تسجيل إلغاء الحصة
  // ============================================================

  async addCancelledLessonReport(reportData) {
    try {

      const sheikhId =
        this._getCurrentSheikhId();

      if (!sheikhId) {
        return {
          success: false,
          error:
            "يجب تسجيل الدخول كشيخ أولاً."
        };
      }

      if (!reportData?.scheduleId) {
        return {
          success: false,
          error:
            "معرف الحصة غير موجود."
        };
      }

      if (!reportData?.studentId) {
        return {
          success: false,
          error:
            "معرف الطالب غير موجود."
        };
      }

      const dateStr =
        reportData.date ||
        this.getTodayCairoDate();


      // ----------------------------------------------------------
      // تحميل الحصة
      // ----------------------------------------------------------

      const scheduleRef =
        doc(
          db,
          "schedules",
          reportData.scheduleId
        );

      const scheduleSnap =
        await getDoc(
          scheduleRef
        );

      if (!scheduleSnap.exists()) {
        return {
          success: false,
          error:
            "الحصة غير موجودة."
        };
      }

      const scheduleData =
        scheduleSnap.data();


      // ----------------------------------------------------------
      // التحقق من ملكية الشيخ للحصة
      // ----------------------------------------------------------

      if (
        scheduleData.sheikhId !==
        sheikhId
      ) {
        return {
          success: false,
          error:
            "هذه الحصة لا تخص الشيخ الحالي."
        };
      }


      // ----------------------------------------------------------
      // تحديد نوع الحصة
      // ----------------------------------------------------------

      const isGroup =
        this._isGroupSchedule(
          scheduleData
        );


      // ----------------------------------------------------------
      // تحميل الطالب
      // ----------------------------------------------------------

      const studentRef =
        doc(
          db,
          "students",
          reportData.studentId
        );

      const studentSnap =
        await getDoc(
          studentRef
        );

      if (!studentSnap.exists()) {
        return {
          success: false,
          error:
            "الطالب غير موجود."
        };
      }

      const studentData =
        studentSnap.data();


      // ----------------------------------------------------------
      // التحقق من ملكية الشيخ للطالب
      // ----------------------------------------------------------

      if (
        studentData.sheikhId !==
        sheikhId
      ) {
        return {
          success: false,
          error:
            "هذا الطالب لا يتبع الشيخ الحالي."
        };
      }


      // ----------------------------------------------------------
      // التحقق من عضوية الطالب في الحصة
      // ----------------------------------------------------------

      if (isGroup) {

        const studentIds =
          Array.isArray(
            scheduleData.studentIds
          )
            ? scheduleData.studentIds
            : [];

        if (
          !studentIds.includes(
            reportData.studentId
          )
        ) {
          return {
            success: false,
            error:
              "هذا الطالب ليس ضمن هذه المجموعة."
          };
        }

      } else {

        if (
          scheduleData.studentId !==
          reportData.studentId
        ) {
          return {
            success: false,
            error:
              "هذا الطالب ليس مرتبطاً بهذه الحصة."
          };
        }
      }


      // ----------------------------------------------------------
      // منع وجود تقرير سابق
      // ----------------------------------------------------------

      const alreadyExists =
        await this.hasReportForSchedule(
          reportData.scheduleId,
          dateStr,
          reportData.studentId
        );

      if (alreadyExists) {
        return {
          success: false,
          error:
            "تم تسجيل تقرير لهذه الحصة والطالب بالفعل."
        };
      }


      // ----------------------------------------------------------
      // بناء ID التقرير
      // ----------------------------------------------------------

      const reportId =
        this._buildReportDocId(
          sheikhId,
          reportData.scheduleId,
          dateStr,
          reportData.studentId,
          isGroup
        );

      const reportRef =
        doc(
          db,
          COLLECTION_NAME,
          reportId
        );


      // ----------------------------------------------------------
      // بيانات تقرير الإلغاء
      // ----------------------------------------------------------

      const activeCycleId = studentData.activeLessonCounterCycleId || null;

      const payload = {

        sheikhId:
          sheikhId,

        studentId:
          reportData.studentId,

        scheduleId:
          reportData.scheduleId,

        date:
          dateStr,

        completedAt:
          Timestamp.now(),

        status:
          "cancelled",

        memorization:
          [],

        review:
          [],

        memorizationRating: null,
        reviewRating: null,

        lessonNumber: null,
        lessonCounterCycleId: activeCycleId,

        notes:
          reportData.notes ||
          "تم إلغاء الحصة من قِبل الشيخ."
      };


      // ----------------------------------------------------------
      // بيانات المجموعة
      // ----------------------------------------------------------

      if (isGroup) {

        payload.isGroup =
          true;

        payload.groupId =
          reportData.groupId ||
          reportData.scheduleId;

        payload.groupName =
          reportData.groupName ||
          scheduleData.groupName ||
          "";
      }


      // ----------------------------------------------------------
      // إنشاء تقرير الإلغاء
      // ----------------------------------------------------------

      await setDoc(
        reportRef,
        payload
      );


      return {

        success:
          true,

        reportId:
          reportId,

        report: {
          id: reportId,
          ...payload
        }
      };

    } catch (error) {

      console.error(
        "Error adding cancelled lesson report:",
        error
      );

      if (
        error?.code ===
        "permission-denied"
      ) {
        return {
          success: false,
          error:
            "ليس لديك صلاحية تسجيل إلغاء الحصة."
        };
      }

      return {
        success: false,

        error:
          error?.message ||
          "حدث خطأ أثناء تسجيل إلغاء الحصة."
      };
    }
  },


  // ============================================================
  // الحصول على تقارير طالب
  // ============================================================

  async getStudentReports(studentId) {
    try {

      const sheikhId =
        this._getCurrentSheikhId();

      if (
        !sheikhId ||
        !studentId
      ) {
        return [];
      }

      const reportsQuery =
        query(
          collection(
            db,
            COLLECTION_NAME
          ),

          where(
            "sheikhId",
            "==",
            sheikhId
          ),

          where(
            "studentId",
            "==",
            studentId
          )
        );

      const snapshot =
        await getDocs(
          reportsQuery
        );

      const reports =
        snapshot.docs.map(
          reportDoc => ({
            id: reportDoc.id,
            ...reportDoc.data()
          })
        );


      // ----------------------------------------------------------
      // ترتيب من الأحدث إلى الأقدم
      // ----------------------------------------------------------

      reports.sort(
        (a, b) => {

          const timeA =
            a.completedAt?.toMillis
              ? a.completedAt.toMillis()
              : 0;

          const timeB =
            b.completedAt?.toMillis
              ? b.completedAt.toMillis()
              : 0;

          return timeB - timeA;
        }
      );

      return reports;

    } catch (error) {

      console.error(
        "Error getting student reports:",
        error
      );

      return [];
    }
  },


  // ============================================================
  // الحصول على آخر تقرير لطالب
  // ============================================================

  async getLastStudentReport(studentId) {
    try {

      const reports =
        await this.getStudentReports(
          studentId
        );

      if (!reports.length) {
        return null;
      }

      return reports[0];

    } catch (error) {

      console.error(
        "Error getting last student report:",
        error
      );

      return null;
    }
  }

};
