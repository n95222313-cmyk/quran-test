
/**
 * تسجيل إلغاء الحصة داخل lesson_reports
 * دون حذف تقارير الإتمام السابقة.
 */

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { auth, db } from "../config/firebase.js";
import { reportService } from "./reportService.js";

export const cancellationService = {

  async cancelLesson(scheduleId, reason) {

    try {

      const sheikhId = auth.currentUser?.uid;

      if (!sheikhId) {
        throw new Error("يرجى تسجيل الدخول أولاً.");
      }

      if (!scheduleId) {
        throw new Error("معرف الحصة غير موجود.");
      }

      const cancellationReason =
        String(reason || "").trim();

      if (!cancellationReason) {
        throw new Error("يرجى كتابة سبب الإلغاء.");
      }

      if (cancellationReason.length > 500) {
        throw new Error("سبب الإلغاء طويل جداً.");
      }

      const date =
        reportService.getTodayCairoDate();

      const scheduleRef =
        doc(db, "schedules", scheduleId);

      const scheduleSnap =
        await getDoc(scheduleRef);

      if (
        !scheduleSnap.exists() ||
        scheduleSnap.data().sheikhId !== sheikhId
      ) {
        throw new Error(
          "الحصة غير موجودة أو غير تابعة لحسابك."
        );
      }

      const schedule = scheduleSnap.data();

      const isGroup =
        schedule.scheduleKind === "group" ||
        schedule.type === "group";

      const studentIds = [
        ...new Set(
          isGroup
            ? (schedule.studentIds || [])
            : [schedule.studentId]
        )
      ].filter(Boolean);

      if (!studentIds.length) {
        throw new Error(
          "لا يوجد طلاب مرتبطون بالحصة."
        );
      }

      // تحديد الطلاب الذين لم تُسجل لهم تقارير بعد.
      const existing = await getDocs(
        query(
          collection(db, "lesson_reports"),
          where("sheikhId", "==", sheikhId),
          where("scheduleId", "==", scheduleId),
          where("date", "==", date)
        )
      );

      const alreadyReported = new Set(
        existing.docs.map(
          document => document.data().studentId
        )
      );

      const pending = studentIds.filter(
        id => !alreadyReported.has(id)
      );

      if (!pending.length) {
        throw new Error(
          "جميع الطلاب لديهم تقارير مسجلة بالفعل لهذه الحصة."
        );
      }

      const result = await runTransaction(
        db,
        async transaction => {

          const liveSchedule =
            await transaction.get(scheduleRef);

          if (
            !liveSchedule.exists() ||
            liveSchedule.data().sheikhId !== sheikhId
          ) {
            throw new Error(
              "تعذر التحقق من ملكية الحصة."
            );
          }

          const current = liveSchedule.data();

          const currentIds =
            current.scheduleKind === "group" ||
            current.type === "group"
              ? (current.studentIds || [])
              : [current.studentId];

          if (
            pending.some(
              id => !currentIds.includes(id)
            )
          ) {
            throw new Error(
              "تم تغيير طلاب الحصة. حدّث الصفحة وحاول مجدداً."
            );
          }

          const studentRefs = pending.map(
            id => doc(db, "students", id)
          );

          const reportRefs = pending.map(
            id => doc(
              db,
              "lesson_reports",
              isGroup
                ? `${sheikhId}_${scheduleId}_${id}_${date}`
                : `${sheikhId}_${scheduleId}_${date}`
            )
          );

          // جميع القراءات قبل عمليات الكتابة.
          const studentSnaps = [];

          for (const ref of studentRefs) {
            studentSnaps.push(
              await transaction.get(ref)
            );
          }

          const reportSnaps = [];

          for (const ref of reportRefs) {
            reportSnaps.push(
              await transaction.get(ref)
            );
          }

          const toCreate = [];

          for (
            let i = 0;
            i < pending.length;
            i++
          ) {

            if (
              !studentSnaps[i].exists() ||
              studentSnaps[i].data().sheikhId !== sheikhId
            ) {
              throw new Error(
                "أحد الطلاب غير تابع لحسابك."
              );
            }

            if (!reportSnaps[i].exists()) {
              toCreate.push(i);
            }

          }

          for (const i of toCreate) {

            const payload = {
              sheikhId,
              scheduleId,
              studentId: pending[i],
              date,

              status: "cancelled",
              cancellationReason,

              completedAt: Timestamp.now(),

              memorization: [],
              review: [],
              rating: null,

              notes: cancellationReason
            };

            if (isGroup) {
              payload.isGroup = true;
              payload.groupId = scheduleId;
              payload.groupName =
                current.groupName || "";
            }

            transaction.set(
              reportRefs[i],
              payload
            );

          }

          return toCreate.length;

        }
      );

      return {
        success: true,
        cancelledCount: result,
        skippedCount:
          studentIds.length - result
      };

    } catch (error) {

      console.error(
        "Cancel lesson error:",
        error
      );

      return {
        success: false,
        error:
          error.message ||
          "تعذر إلغاء الحصة."
      };

    }

  }

};
