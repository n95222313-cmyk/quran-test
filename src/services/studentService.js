/**
 * Student Service
 * إدارة بيانات الطلاب وربطها بالشيخ
 *
 * يدعم:
 * - إضافة طالب
 * - جلب طلاب الشيخ
 * - تعديل طالب
 * - حذف طالب
 * - إنشاء حساب Firebase للطالب
 *
 * ملاحظات:
 * - كلمة مرور الطالب لا يتم تخزينها في Firestore.
 * - حساب الطالب يتم إنشاؤه عبر Secondary Auth.
 * - بيانات الطالب تظل مرتبطة بـ sheikhId.
 */

import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  db,
  auth
} from "../config/firebase.js";

import {
  studentAuthService
} from "./studentAuthService.js";


const COLLECTION_NAME = "students";


export const studentService = {

  /**
   * الحصول على UID الشيخ الحالي
   */
  _getCurrentSheikhId() {

    const user = auth.currentUser;

    if (!user) {
      throw new Error(
        "لا يوجد مستخدم مسجل الدخول حالياً. يرجى تسجيل الدخول أولاً."
      );
    }

    return user.uid;
  },


  /**
   * إضافة طالب جديد
   */
  async addStudent(studentData) {

    try {

      const sheikhId =
        this._getCurrentSheikhId();

      const now =
        Timestamp.now();

      const monthlySubVal = studentData.monthlySubscription;
      const targetLessonsVal = studentData.targetLessonsCount;

      const monthlySubscription =
        monthlySubVal !== undefined && monthlySubVal !== null && monthlySubVal !== ""
          ? Number(monthlySubVal)
          : null;

      const targetLessonsCount =
        targetLessonsVal !== undefined && targetLessonsVal !== null && targetLessonsVal !== ""
          ? Number(targetLessonsVal)
          : null;

      const docPayload = {

        sheikhId,

        name:
          studentData.name ?? "",

        age:
          studentData.age ?? null,

        address:
          studentData.address ?? "",

        parentPhone:
          studentData.parentPhone ?? "",

        level:
          studentData.level ?? "",

        notes:
          studentData.notes ?? "",

        monthlySubscription,

        targetLessonsCount,

        activeLessonCounterCycleId:
          "cycle_" + Date.now(),

        createdAt:
          now,

        updatedAt:
          now

      };

      const docRef =
        await addDoc(
          collection(
            db,
            COLLECTION_NAME
          ),
          docPayload
        );

      return {
        success: true,
        id: docRef.id
      };

    } catch (error) {

      console.error(
        "Error adding student:",
        error.message
      );

      return {
        success: false,
        error: error.message
      };
    }
  },


  /**
   * جلب جميع طلاب الشيخ الحالي
   */
  async getSheikhStudents() {

    try {

      const sheikhId =
        this._getCurrentSheikhId();

      const q =
        query(
          collection(
            db,
            COLLECTION_NAME
          ),
          where(
            "sheikhId",
            "==",
            sheikhId
          )
        );

      const querySnapshot =
        await getDocs(q);

      const students = [];

      querySnapshot.forEach(
        (document) => {

          students.push({
            id: document.id,
            ...document.data()
          });

        }
      );

      return {
        success: true,
        data: students
      };

    } catch (error) {

      console.error(
        "Error fetching students:",
        error.message
      );

      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  },


  /**
   * الحصول على طالب واحد
   *
   * تستخدم داخلياً عند الحاجة للتحقق من ملكية الطالب.
   */
  async getStudent(studentId) {

    try {

      const sheikhId =
        this._getCurrentSheikhId();

      if (!studentId) {
        return {
          success: false,
          error: "معرف الطالب مطلوب."
        };
      }

      const studentDocRef =
        doc(
          db,
          COLLECTION_NAME,
          studentId
        );

      const studentSnap =
        await getDoc(studentDocRef);

      if (!studentSnap.exists()) {

        return {
          success: false,
          error: "الطالب غير موجود."
        };
      }

      const studentData =
        studentSnap.data();

      if (
        studentData.sheikhId !==
        sheikhId
      ) {

        return {
          success: false,
          error: "غير مصرح لك بالوصول إلى هذا الطالب."
        };
      }

      return {
        success: true,
        data: {
          id: studentSnap.id,
          ...studentData
        }
      };

    } catch (error) {

      console.error(
        "Error fetching student:",
        error.message
      );

      return {
        success: false,
        error: error.message
      };
    }
  },


  /**
   * تعديل بيانات طالب
   */
  async updateStudent(
    studentId,
    updateData
  ) {

    try {

      this._getCurrentSheikhId();

      const studentDocRef =
        doc(
          db,
          COLLECTION_NAME,
          studentId
        );

      const payload = {
        updatedAt:
          Timestamp.now()
      };


      if (
        updateData.name !==
        undefined
      ) {

        payload.name =
          updateData.name;
      }


      if (
        updateData.age !==
        undefined
      ) {

        payload.age =
          updateData.age;
      }


      if (
        updateData.address !==
        undefined
      ) {

        payload.address =
          updateData.address;
      }


      if (
        updateData.level !==
        undefined
      ) {

        payload.level =
          updateData.level;
      }


      if (
        updateData.notes !==
        undefined
      ) {

        payload.notes =
          updateData.notes;
      }


      if (
        updateData.parentPhone !==
        undefined
      ) {

        payload.parentPhone =
          String(
            updateData.parentPhone || ""
          ).trim();
      }


      if (
        updateData.monthlySubscription !==
        undefined
      ) {
        const subVal = updateData.monthlySubscription;
        payload.monthlySubscription =
          subVal !== undefined && subVal !== null && subVal !== ""
            ? Number(subVal)
            : null;
      }


      if (
        updateData.targetLessonsCount !==
        undefined
      ) {
        const targetVal = updateData.targetLessonsCount;
        payload.targetLessonsCount =
          targetVal !== undefined && targetVal !== null && targetVal !== ""
            ? Number(targetVal)
            : null;
      }


      await updateDoc(
        studentDocRef,
        payload
      );

      return {
        success: true
      };

    } catch (error) {

      console.error(
        "Error updating student:",
        error.message
      );

      return {
        success: false,
        error: error.message
      };
    }
  },


  /**
   * إعادة تصفير عداد الحصص للطالب (توليد دورة جديدة)
   */
  async resetStudentLessonCounter(studentId) {

    try {

      const sheikhId =
        this._getCurrentSheikhId();

      if (!studentId) {
        return {
          success: false,
          error: "معرف الطالب مطلوب."
        };
      }

      const studentDocRef =
        doc(
          db,
          COLLECTION_NAME,
          studentId
        );

      const studentSnap =
        await getDoc(studentDocRef);

      if (!studentSnap.exists()) {
        return {
          success: false,
          error: "الطالب غير موجود."
        };
      }

      if (studentSnap.data().sheikhId !== sheikhId) {
        return {
          success: false,
          error: "غير مصرح لك بتعديل هذا الطالب."
        };
      }

      const newCycleId = "cycle_" + Date.now();

      await updateDoc(
        studentDocRef,
        {
          activeLessonCounterCycleId: newCycleId,
          updatedAt: Timestamp.now()
        }
      );

      return {
        success: true,
        newCycleId
      };

    } catch (error) {

      console.error(
        "Error resetting lesson counter:",
        error.message
      );

      return {
        success: false,
        error: error.message
      };
    }
  },


  /**
   * إنشاء حساب دخول للطالب
   */
  async createStudentAccount(
    studentId,
    username,
    password
  ) {

    try {

      const sheikhId =
        this._getCurrentSheikhId();

      if (!studentId) {

        return {
          success: false,
          error: "معرف الطالب مطلوب."
        };
      }


      const studentDocRef =
        doc(
          db,
          COLLECTION_NAME,
          studentId
        );

      const studentSnap =
        await getDoc(
          studentDocRef
        );


      if (!studentSnap.exists()) {

        return {
          success: false,
          error: "الطالب غير موجود."
        };
      }


      const studentData =
        studentSnap.data();


      if (
        studentData.sheikhId !==
        sheikhId
      ) {

        return {
          success: false,
          error: "غير مصرح لك بإنشاء حساب لهذا الطالب."
        };
      }


      if (
        studentData.studentAuthUid
      ) {

        return {
          success: false,
          error: "هذا الطالب لديه حساب دخول بالفعل."
        };
      }


      const accountResult =
        await studentAuthService.createStudentAccount({
          studentId,
          username,
          password
        });


      if (!accountResult.success) {

        return {
          success: false,
          error:
            accountResult.error ||
            "فشل إنشاء حساب الطالب."
        };
      }


      return {
        success: true,
        studentUid:
          accountResult.studentUid,
        username:
          accountResult.username
      };

    } catch (error) {

      console.error(
        "Error creating student account:",
        error
      );

      return {
        success: false,
        error: error.message
      };
    }
  },


  /**
   * حذف طالب
   */
  async deleteStudent(studentId) {

    try {

      this._getCurrentSheikhId();

      const studentDocRef =
        doc(
          db,
          COLLECTION_NAME,
          studentId
        );

      await deleteDoc(
        studentDocRef
      );

      return {
        success: true
      };

    } catch (error) {

      console.error(
        "Error deleting student:",
        error.message
      );

      return {
        success: false,
        error: error.message
      };
    }
  }

};
