/**
 * Dashboard Data & Business Logic Layer (Firestore Integration)
 * طبقة بيانات لوحة التحكم المرتبطة بـ Firestore لجلب الطلاب ومواعيد اليوم الحقيقية واسم الشيخ المحدث
 */

import { studentService } from "./studentService.js";
import { scheduleService } from "./scheduleData.js";
import { settingsService } from "./settingsService.js";

export const dashboardService = {
  getSheikhInfo() {
    return {
      name: "عبد الله",
      title: "الشيخ"
    };
  },

  async getDashboardData() {
    try {
      const settingsRes =
        await settingsService.getSheikhSettings();

      const sheikhName =
        settingsRes.success &&
        settingsRes.data &&
        settingsRes.data.name
          ? settingsRes.data.name
          : "عبد الله";

      const sheikhTitle =
        settingsRes.success &&
        settingsRes.data &&
        settingsRes.data.title
          ? settingsRes.data.title
          : "الشيخ";

      const sheikhInfo = {
        name: sheikhName,
        title: sheikhTitle
      };

      const studentsRes =
        await studentService.getSheikhStudents();

      if (!studentsRes.success) {
        return {
          success: false,
          error:
            studentsRes.error ||
            "فشل تحميل بيانات الطلاب"
        };
      }

      /**
       * scheduleService هو المصدر الموحد
       * لمواعيد اليوم، بما فيها المواعيد المرتبطة
       * بمواقيت الصلاة الفعلية لليوم.
       */
      const todaySchedules =
        await scheduleService.getTodaySchedules();

      const students =
        studentsRes.data || [];

      const studentsCount =
        students.length;

      const todayLessonsCount =
        todaySchedules.length;

      const currentLesson =
        todaySchedules.find(
          lesson =>
            lesson.status ===
            "current"
        ) || null;

      const nextLesson =
        todaySchedules.find(
          lesson =>
            lesson.status ===
            "upcoming"
        ) || null;

      return {
        success: true,

        sheikh: sheikhInfo,

        studentsCount,

        todayLessonsCount,

        todayLessons:
          todaySchedules,

        currentLesson,

        nextLesson,

        formattedDate:
          scheduleService.getFormattedArabicDate()
      };
    } catch (error) {
      console.error(
        "Error fetching dashboard data:",
        error.message
      );

      return {
        success: false,
        error: error.message
      };
    }
  }
};
