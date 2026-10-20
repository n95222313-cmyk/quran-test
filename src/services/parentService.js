/**
 * Parent Service (Parent Portal Authentication & Data Retrieval)
 * خدمة بوابة ولي الأمر (التحقق من رقم الهاتف والاستعلام الفعلي عن الطلاب وتقاريرهم من Firestore)
 * تم التحديث لدعم النموذج الثاني (Secondary Auth & parentDb & parent_accounts)
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
import { db } from "../config/firebase.js";
import { parentAuth, parentDb } from "./parentAuthService.js";
import { reportService } from './reportService.js';

export const parentService = {
  async verifyParentPhone(phone) {
    const cleanPhone = String(phone || '').trim();
    const egyptianPhoneRegex = /^01[0125][0-9]{8}$/;
    
    if (!cleanPhone || !egyptianPhoneRegex.test(cleanPhone)) {
      return { success: false, error: "يرجى إدخال رقم هاتف محمول مصري صحيح ومكون من 11 رقماً (مثال: 01012345678)." };
    }
    
    try {
      const studentsRef = collection(db, "students");
      const q = query(studentsRef, where("parentPhone", "==", cleanPhone));
      const querySnapshot = await getDocs(q);
      
      const students = [];
      querySnapshot.forEach((docSnap) => {
        students.push({ id: docSnap.id, ...docSnap.data() });
      });

      if (students.length === 0) {
        return { success: false, error: "لا يوجد طالب مسجل بهذا الرقم." };
      }

      return { success: true, students };
    } catch (error) {
      console.error("Error verifying parent phone:", error);
      return { success: false, error: "حدث خطأ أثناء البحث، يرجى المحاولة لاحقاً." };
    }
  },

  async getStudentReportsData(studentId) {
    return await reportService.getStudentReports(studentId);
  },

  /**
   * الحصول على بيانات حساب ولي الأمر الحالي باستخدام Secondary Auth و parentDb
   */
  async getParentAccountData() {
    try {
      const currentParent = parentAuth.currentUser;
      if (!currentParent) {
        return { success: false, error: "لا يوجد ولي أمر مسجل الدخول حالياً." };
      }

      const parentUid = currentParent.uid;
      const accountDocRef = doc(parentDb, "parent_accounts", parentUid);
      const accountSnap = await getDoc(accountDocRef);

      if (!accountSnap.exists()) {
        return { success: false, error: "لم يتم العثور على ملف تعريف ولي الأمر." };
      }

      return { success: true, parentId: parentUid, data: accountSnap.data() };
    } catch (error) {
      console.error("Error getting parent account data:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * جلب الطلاب المملوكين لولي الأمر المصادق عليه مع التحقق من sheikhId
   */
  async getAuthenticatedParentStudents() {
    try {
      const accountRes = await this.getParentAccountData();
      if (!accountRes.success) {
        return { success: false, error: accountRes.error, students: [] };
      }

      const parentUid = accountRes.parentId;
      const sheikhId = accountRes.data.sheikhId;

      if (!sheikhId) {
        return { success: false, error: "حساب ولي الأمر غير مرتبط بمعرف شيخ صالح.", students: [] };
      }

      const studentsRef = collection(parentDb, "students");
      const q = query(
        studentsRef, 
        where("parentId", "==", parentUid),
        where("sheikhId", "==", sheikhId)
      );

      const querySnapshot = await getDocs(q);
      const students = [];
      querySnapshot.forEach((docSnap) => {
        students.push({ id: docSnap.id, ...docSnap.data() });
      });

      return { success: true, students };
    } catch (error) {
      console.error("Error fetching authenticated parent students:", error);
      return { success: false, error: error.message, students: [] };
    }
  },

  /**
   * جلب تقارير طالب معين مع التحقق الآمن من ارتباط الطالب بولي الأمر والشيخ عبر parentDb
   */
  async getParentStudentReports(studentId) {
    try {
      const accountRes = await this.getParentAccountData();
      if (!accountRes.success) {
        return { success: false, error: accountRes.error, data: [] };
      }

      const parentUid = accountRes.parentId;
      const sheikhId = accountRes.data.sheikhId;

      if (!studentId) {
        return { success: false, error: "معرف الطالب مطلوب.", data: [] };
      }

      const studentDocRef = doc(parentDb, "students", studentId);
      const studentSnap = await getDoc(studentDocRef);

      if (!studentSnap.exists()) {
        return { success: false, error: "الطالب غير موجود.", data: [] };
      }

      const studentData = studentSnap.data();
      if (studentData.parentId !== parentUid || studentData.sheikhId !== sheikhId) {
        return { success: false, error: "غير مصرح لك بالاطلاع على تقارير هذا الطالب.", data: [] };
      }

      const reportsRef = collection(parentDb, "lesson_reports");
      const q = query(
        reportsRef,
        where("sheikhId", "==", sheikhId),
        where("studentId", "==", studentId),
        orderBy("completedAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const reports = [];
      querySnapshot.forEach((docSnap) => {
        reports.push({ id: docSnap.id, ...docSnap.data() });
      });

      return { success: true, data: reports };
    } catch (error) {
      console.error("Error fetching parent student reports:", error);
      return { success: false, error: error.message, data: [] };
    }
  }
};
