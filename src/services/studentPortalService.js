/**
 * Student Portal Service
 * خدمة بيانات بوابة الطالب
 *
 * الطالب يستطيع:
 * - قراءة ملفه فقط
 * - قراءة تقاريره فقط
 *
 * لا يستطيع:
 * - تعديل بياناته
 * - تعديل التقارير
 * - قراءة طلاب آخرين
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  studentAuth,
  studentDb
} from "./studentAuthService.js";

export const studentPortalService = {

  async getAccountData() {

    try {

      const currentUser =
        studentAuth.currentUser;

      if (!currentUser) {
        return {
          success: false,
          error: "لا يوجد طالب مسجل الدخول."
        };
      }

      console.log(
        "Student portal: loading account",
        currentUser.uid
      );

      const accountRef =
        doc(
          studentDb,
          "student_accounts",
          currentUser.uid
        );

      const accountSnap =
        await getDoc(accountRef);

      if (!accountSnap.exists()) {
        return {
          success: false,
          error: "لم يتم العثور على حساب الطالب."
        };
      }

      console.log(
        "Student portal: account loaded",
        accountSnap.data()
      );

      return {
        success: true,
        data: accountSnap.data()
      };

    } catch (error) {

      console.error(
        "Error getting student account:",
        error
      );

      return {
        success: false,
        error: error.message
      };
    }
  },

  async getCurrentStudent() {

    try {

      const accountRes =
        await this.getAccountData();

      if (!accountRes.success) {
        return {
          success: false,
          error: accountRes.error
        };
      }

      const studentId =
        accountRes.data.studentId;

      if (!studentId) {
        return {
          success: false,
          error: "حساب الطالب غير مرتبط بملف طالب."
        };
      }

      const studentRef =
        doc(
          studentDb,
          "students",
          studentId
        );

      const studentSnap =
        await getDoc(studentRef);

      if (!studentSnap.exists()) {
        return {
          success: false,
          error: "ملف الطالب غير موجود."
        };
      }

      return {
        success: true,
        id: studentSnap.id,
        data: studentSnap.data()
      };

    } catch (error) {

      console.error(
        "Error getting current student:",
        error
      );

      return {
        success: false,
        error: error.message
      };
    }
  },

  async getStudentReports() {

    try {

      const accountRes =
        await this.getAccountData();

      if (!accountRes.success) {
        return {
          success: false,
          error: accountRes.error,
          data: []
        };
      }

      const studentId =
        accountRes.data.studentId;

      if (!studentId) {
        return {
          success: false,
          error: "حساب الطالب غير مرتبط بملف طالب.",
          data: []
        };
      }

      const reportsRef =
        collection(
          studentDb,
          "lesson_reports"
        );

      const q =
        query(
          reportsRef,
          where(
            "studentId",
            "==",
            studentId
          ),
          orderBy(
            "completedAt",
            "desc"
          )
        );

      const snapshot =
        await getDocs(q);

      const reports = [];

      snapshot.forEach(docSnap => {

        reports.push({
          id: docSnap.id,
          ...docSnap.data()
        });

      });

      return {
        success: true,
        data: reports
      };

    } catch (error) {

      console.error(
        "Error getting student reports:",
        error
      );

      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  },

  async getLastReport() {

    const result =
      await this.getStudentReports();

    if (
      !result.success ||
      !result.data.length
    ) {
      return {
        success: true,
        data: null
      };
    }

    return {
      success: true,
      data: result.data[0]
    };
  }
};
