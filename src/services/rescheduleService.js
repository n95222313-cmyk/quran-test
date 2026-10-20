/**
 * Lesson Reschedule Service
 * خدمة إعادة جدولة حصة واحدة بدون تعديل الموعد الأسبوعي الأصلي.
 *
 * يدعم:
 * - إنشاء إعادة جدولة مؤقتة
 * - تعديل الموعد المؤقت
 * - حذف الموعد المؤقت
 * - عدم المساس بالموعد الأسبوعي الأصلي
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { auth, db } from "../config/firebase.js";
import { reportService } from "./reportService.js";
import { prayerService } from "./prayerService.js";

const COLLECTION_NAME = "lesson_overrides";

const getCurrentSheikhId = () => {
  return auth.currentUser?.uid || null;
};

const isValidDateString = value => {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(value || "")
  );
};

const isValidTimeString = value => {
  return /^\d{2}:\d{2}$/.test(
    String(value || "")
  );
};

const dateStringToDayOfWeek = dateString => {
  const date =
    new Date(
      `${dateString}T12:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.getDay();
};

const getTodayCairoDate = () => {
  return reportService.getTodayCairoDate();
};

const buildOverrideId = (
  sheikhId,
  scheduleId,
  originalDate
) => {
  return `${sheikhId}_${scheduleId}_${originalDate}`;
};

const getScheduleKind = schedule => {
  return schedule?.scheduleKind === "group"
    ? "group"
    : "individual";
};

const normalizeTime = time => {
  if (!time) return "";
  const match = String(time).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const timeToMinutes = time => {
  const normalized = normalizeTime(time);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = totalMinutes => {
  let value = Number(totalMinutes);
  if (!Number.isFinite(value)) return "";
  value = ((value % 1440) + 1440) % 1440;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const getDayConfig = (schedule, dayOfWeek) => {
  if (dayOfWeek !== null && schedule?.dayConfigs && schedule.dayConfigs[String(dayOfWeek)]) {
    return schedule.dayConfigs[String(dayOfWeek)];
  }
  return {
    timeType: schedule?.timeType || "fixed",
    startTime: schedule?.startTime || "",
    endTime: schedule?.endTime || "",
    prayerName: schedule?.prayerName || schedule?.prayer || "",
    offsetMinutes: Number(schedule?.offsetMinutes) || 0
  };
};

const calculateEffectiveStartTime = (schedule, prayerTimings, dayOfWeek = null) => {
  if (!schedule) return "";
  const config = getDayConfig(schedule, dayOfWeek);
  if (config.timeType !== "prayer") {
    return normalizeTime(config.startTime);
  }
  const prayerName = config.prayerName || "";
  const prayerTime = prayerTimings?.[prayerName];
  const prayerMinutes = timeToMinutes(prayerTime);
  if (prayerMinutes === null) return "";
  const offset = Number(config.offsetMinutes) || 0;
  return minutesToTime(prayerMinutes + offset);
};

const buildOverridePayload = ({
  sheikhId,
  scheduleId,
  schedule,
  originalDate,
  newDate,
  newStartTime,
  overrideId
}) => {
  const isGroup =
    getScheduleKind(schedule) === "group";

  const payload = {
    sheikhId,

    overrideId,

    originalScheduleId:
      scheduleId,

    originalDate,

    newDate,

    newStartTime,

    status:
      "rescheduled",

    scheduleKind:
      isGroup
        ? "group"
        : "individual",

    type:
      schedule.type ||
      "حفظ",

    lessonMode:
      schedule.lessonMode ||
      "in_person",

    createdAt:
      Timestamp.now(),

    updatedAt:
      Timestamp.now()
  };

  if (isGroup) {
    payload.groupName =
      schedule.groupName ||
      "مجموعة";

    payload.studentIds =
      Array.isArray(
        schedule.studentIds
      )
        ? [...schedule.studentIds]
        : [];
  } else {
    payload.studentId =
      schedule.studentId;
  }

  payload.originalScheduleSnapshot = {
    scheduleKind:
      schedule.scheduleKind ||
      "individual",

    studentId:
      schedule.studentId ||
      null,

    studentIds:
      Array.isArray(
        schedule.studentIds
      )
        ? [...schedule.studentIds]
        : [],

    groupName:
      schedule.groupName ||
      null,

    type:
      schedule.type ||
      "حفظ",

    lessonMode:
      schedule.lessonMode ||
      "in_person",

    timeType:
      schedule.timeType ||
      "fixed",

    startTime:
      schedule.startTime ||
      null,

    endTime:
      schedule.endTime ||
      null,

    prayerName:
      schedule.prayerName ||
      null,

    offsetMinutes:
      Number.isFinite(
        Number(
          schedule.offsetMinutes
        )
      )
        ? Number(
            schedule.offsetMinutes
          )
        : 0
  };

  return payload;
};

const getStudentsToCheck = schedule => {
  const kind =
    getScheduleKind(schedule);

  if (kind === "group") {
    return Array.isArray(
      schedule.studentIds
    )
      ? schedule.studentIds
      : [];
  }

  return schedule.studentId
    ? [schedule.studentId]
    : [];
};

const validateNewDateAndTime = ({
  schedule,
  originalDate,
  newDate,
  newStartTime
}) => {
  if (
    !isValidDateString(newDate)
  ) {
    return {
      success: false,
      error:
        "التاريخ الجديد غير صحيح."
    };
  }

  if (
    !isValidTimeString(newStartTime)
  ) {
    return {
      success: false,
      error:
        "وقت الحصة الجديد غير صحيح."
    };
  }

  const today =
    getTodayCairoDate();

  if (newDate < today) {
    return {
      success: false,
      error:
        "لا يمكن إعادة جدولة الحصة إلى تاريخ سابق لليوم."
    };
  }

  const originalStartTime =
    schedule.timeType === "fixed"
      ? schedule.startTime || ""
      : "";

  if (
    newDate === originalDate &&
    String(newStartTime) ===
      String(originalStartTime)
  ) {
    return {
      success: false,
      error:
        "التاريخ والوقت الجديدان مطابقان للموعد الحالي."
    };
  }

  const newDayOfWeek =
    dateStringToDayOfWeek(
      newDate
    );

  const recurringDays =
    Array.isArray(
      schedule.daysOfWeek
    )
      ? schedule.daysOfWeek.map(Number)
      : [];

  const sameRecurringDay =
    recurringDays.includes(
      newDayOfWeek
    );

  if (
    sameRecurringDay &&
    newDate !== originalDate
  ) {
    return {
      success: false,
      error:
        "هذا التاريخ يحتوي أصلًا على الموعد الأسبوعي لهذه الحصة. اختر تاريخًا آخر لتجنب تكرار الحصة."
    };
  }

  return {
    success: true
  };
};

export const rescheduleService = {

  async checkRescheduleConflicts({
    sheikhId,
    newDate,
    newStartTime,
    excludeScheduleId = null,
    excludeOverrideId = null
  }) {
    try {
      const targetDate = new Date(`${newDate}T12:00:00`);
      const newDayOfWeek = targetDate.getDay();
      const normalizedNewStart = normalizeTime(newStartTime);

      if (!normalizedNewStart) {
        return { hasConflict: false, conflicts: [] };
      }

      const prayerRes = await prayerService.getPrayerTimesForDate(newDate);
      const prayerTimings = prayerRes.success && prayerRes.timings ? prayerRes.timings : {};

      const conflicts = [];

      const schedulesQuery = query(
        collection(db, "schedules"),
        where("sheikhId", "==", sheikhId)
      );
      const schedulesSnap = await getDocs(schedulesQuery);
      
      for (const docItem of schedulesSnap.docs) {
        const schedule = { id: docItem.id, ...docItem.data() };
        if (schedule.id === excludeScheduleId) continue;

        const days = Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek.map(Number) : [];
        if (!days.includes(newDayOfWeek)) continue;

        const effectiveStart = calculateEffectiveStartTime(schedule, prayerTimings, newDayOfWeek);
        if (effectiveStart === normalizedNewStart) {
          const name = schedule.scheduleKind === "group" ? (schedule.groupName || "مجموعة") : (schedule.studentName || "طالب");
          conflicts.push({
            name,
            time: effectiveStart,
            type: "weekly"
          });
        }
      }

      const overridesResult = await this.getSheikhOverrides();
      if (overridesResult.success && Array.isArray(overridesResult.data)) {
        for (const override of overridesResult.data) {
          if (override.status !== "rescheduled") continue;
          if (override.newDate !== newDate) continue;
          if (override.id === excludeOverrideId || override.originalScheduleId === excludeScheduleId) continue;

          const overrideStart = normalizeTime(override.newStartTime);
          if (overrideStart === normalizedNewStart) {
            const name = override.scheduleKind === "group" ? (override.groupName || "مجموعة") : (override.studentName || "طالب");
            conflicts.push({
              name,
              time: overrideStart,
              type: "override"
            });
          }
        }
      }

      return {
        hasConflict: conflicts.length > 0,
        conflicts
      };
    } catch (error) {
      console.error("Error checking reschedule conflicts:", error);
      return { hasConflict: false, conflicts: [] };
    }
  },

  async rescheduleLesson({
    scheduleId,
    originalDate,
    newDate,
    newStartTime,
    forceConfirm = false
  }) {

    try {

      const sheikhId =
        getCurrentSheikhId();

      if (!sheikhId) {
        return {
          success: false,
          error:
            "يجب تسجيل الدخول أولًا."
        };
      }

      if (!scheduleId) {
        return {
          success: false,
          error:
            "تعذر تحديد الحصة."
        };
      }

      if (
        !isValidDateString(
          originalDate
        )
      ) {
        return {
          success: false,
          error:
            "تاريخ الحصة الأصلي غير صحيح."
        };
      }

      if (
        !isValidDateString(
          newDate
        )
      ) {
        return {
          success: false,
          error:
            "التاريخ الجديد غير صحيح."
        };
      }

      if (
        !isValidTimeString(
          newStartTime
        )
      ) {
        return {
          success: false,
          error:
            "وقت الحصة الجديد غير صحيح."
        };
      }

      const scheduleRef =
        doc(
          db,
          "schedules",
          scheduleId
        );

      const scheduleSnap =
        await getDoc(
          scheduleRef
        );

      if (!scheduleSnap.exists()) {
        return {
          success: false,
          error:
            "الحصة الأصلية غير موجودة."
        };
      }

      const schedule =
        scheduleSnap.data();

      if (
        schedule.sheikhId !==
        sheikhId
      ) {
        return {
          success: false,
          error:
            "لا تملك صلاحية تعديل هذه الحصة."
        };
      }

      const scheduleKind =
        getScheduleKind(schedule);

      if (
        scheduleKind === "group"
      ) {

        if (
          !Array.isArray(
            schedule.studentIds
          ) ||
          schedule.studentIds.length === 0
        ) {
          return {
            success: false,
            error:
              "لا يمكن إعادة جدولة مجموعة بدون طلاب."
          };
        }

      } else if (
        !schedule.studentId
      ) {

        return {
          success: false,
          error:
            "لا يمكن إعادة جدولة موعد بدون طالب."
        };
      }

      const validation =
        validateNewDateAndTime({
          schedule,
          originalDate,
          newDate,
          newStartTime
        });

      if (!validation.success) {
        return validation;
      }

      if (!forceConfirm) {
        const conflictCheck = await this.checkRescheduleConflicts({
          sheikhId,
          newDate,
          newStartTime,
          excludeScheduleId: scheduleId
        });

        if (conflictCheck.hasConflict) {
          return {
            success: false,
            requiresConfirmation: true,
            conflicts: conflictCheck.conflicts,
            error: "يوجد تعارض في الموعد مع حصة طالب آخر."
          };
        }
      }

      const studentsToCheck =
        getStudentsToCheck(
          schedule
        );

      for (
        const studentId of studentsToCheck
      ) {

        const alreadyReported =
          await reportService.hasReportForSchedule(
            scheduleId,
            originalDate,
            studentId
          );

        if (alreadyReported) {
          return {
            success: false,
            error:
              "لا يمكن إعادة جدولة حصة تم تسجيل تقرير أو إلغاء لها بالفعل."
          };
        }
      }

      const overrideId =
        buildOverrideId(
          sheikhId,
          scheduleId,
          originalDate
        );

      const overridesQuery =
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

      const overridesSnapshot =
        await getDocs(
          overridesQuery
        );

      const existingOverride =
        overridesSnapshot.docs.find(
          item =>
            item.id === overrideId ||
            item.data()?.overrideId ===
              overrideId
        );

      if (existingOverride) {
        return {
          success: false,
          error:
            "تمت إعادة جدولة هذه الحصة من قبل، ولا يمكن إعادة جدولتها مرة أخرى."
        };
      }

      const payload =
        buildOverridePayload({
          sheikhId,
          scheduleId,
          schedule,
          originalDate,
          newDate,
          newStartTime,
          overrideId
        });

      const overrideRef =
        doc(
          db,
          COLLECTION_NAME,
          overrideId
        );

      await setDoc(
        overrideRef,
        payload
      );

      return {
        success: true,
        id: overrideId,
        data: {
          id: overrideId,
          ...payload
        }
      };

    } catch (error) {

      console.error(
        "❌ RESCHEDULE ERROR:",
        error
      );

      if (
        error?.code ===
        "permission-denied"
      ) {
        return {
          success: false,
          error:
            "Firestore Permission Error: Missing or insufficient permissions."
        };
      }

      return {
        success: false,
        error:
          error?.message ||
          "حدث خطأ أثناء إعادة جدولة الحصة."
      };
    }
  },

  async updateRescheduledLesson({
    overrideId,
    newDate,
    newStartTime
  }) {

    try {

      const sheikhId =
        getCurrentSheikhId();

      if (!sheikhId) {
        return {
          success: false,
          error:
            "يجب تسجيل الدخول أولًا."
        };
      }

      if (!overrideId) {
        return {
          success: false,
          error:
            "تعذر تحديد الموعد المؤقت."
        };
      }

      if (
        !isValidDateString(newDate)
      ) {
        return {
          success: false,
          error:
            "التاريخ الجديد غير صحيح."
        };
      }

      if (
        !isValidTimeString(
          newStartTime
        )
      ) {
        return {
          success: false,
          error:
            "وقت الحصة الجديد غير صحيح."
        };
      }

      const overrideRef =
        doc(
          db,
          COLLECTION_NAME,
          overrideId
        );

      const overrideSnap =
        await getDoc(
          overrideRef
        );

      if (!overrideSnap.exists()) {
        return {
          success: false,
          error:
            "الموعد المؤقت غير موجود."
        };
      }

      const override =
        overrideSnap.data();

      if (
        override.sheikhId !==
        sheikhId
      ) {
        return {
          success: false,
          error:
            "لا تملك صلاحية تعديل هذا الموعد المؤقت."
        };
      }

      if (
        override.status !==
        "rescheduled"
      ) {
        return {
          success: false,
          error:
            "هذا الموعد المؤقت غير صالح للتعديل."
        };
      }

      const originalScheduleId =
        override.originalScheduleId;

      if (!originalScheduleId) {
        return {
          success: false,
          error:
            "تعذر تحديد الموعد الأسبوعي الأصلي."
        };
      }

      const scheduleRef =
        doc(
          db,
          "schedules",
          originalScheduleId
        );

      const scheduleSnap =
        await getDoc(
          scheduleRef
        );

      if (!scheduleSnap.exists()) {
        return {
          success: false,
          error:
            "الموعد الأسبوعي الأصلي غير موجود."
        };
      }

      const schedule =
        scheduleSnap.data();

      if (
        schedule.sheikhId !==
        sheikhId
      ) {
        return {
          success: false,
          error:
            "لا تملك صلاحية تعديل هذا الموعد."
        };
      }

      const originalDate =
        override.originalDate;

      const validation =
        validateNewDateAndTime({
          schedule,
          originalDate,
          newDate,
          newStartTime
        });

      if (!validation.success) {
        return validation;
      }

      const studentsToCheck =
        getStudentsToCheck(
          schedule
        );

      for (
        const studentId of studentsToCheck
      ) {

        const originalReported =
          await reportService.hasReportForSchedule(
            originalScheduleId,
            originalDate,
            studentId
          );

        if (originalReported) {
          return {
            success: false,
            error:
              "لا يمكن تعديل إعادة جدولة حصة تم تسجيل تقرير أو إلغاء لها."
          };
        }
      }

      for (
        const studentId of studentsToCheck
      ) {

        const newDateReported =
          await reportService.hasReportForSchedule(
            originalScheduleId,
            newDate,
            studentId
          );

        if (newDateReported) {
          return {
            success: false,
            error:
              "لا يمكن نقل الحصة إلى تاريخ تم تسجيل تقرير لها بالفعل."
          };
        }
      }

      await updateDoc(
        overrideRef,
        {
          newDate,
          newStartTime,
          updatedAt:
            Timestamp.now()
        }
      );

      return {
        success: true,
        data: {
          id: overrideId,
          ...override,
          newDate,
          newStartTime
        }
      };

    } catch (error) {

      console.error(
        "❌ UPDATE RESCHEDULE ERROR:",
        error
      );

      if (
        error?.code ===
        "permission-denied"
      ) {
        return {
          success: false,
          error:
            "Firestore Permission Error: Missing or insufficient permissions."
        };
      }

      return {
        success: false,
        error:
          error?.message ||
          "حدث خطأ أثناء تعديل الموعد المؤقت."
      };
    }
  },

  async deleteRescheduledLesson(
    overrideId
  ) {

    try {

      const sheikhId =
        getCurrentSheikhId();

      if (!sheikhId) {
        return {
          success: false,
          error:
            "يجب تسجيل الدخول أولًا."
        };
      }

      if (!overrideId) {
        return {
          success: false,
          error:
            "تعذر تحديد الموعد المؤقت."
        };
      }

      const overrideRef =
        doc(
          db,
          COLLECTION_NAME,
          overrideId
        );

      const overrideSnap =
        await getDoc(
          overrideRef
        );

      if (!overrideSnap.exists()) {
        return {
          success: false,
          error:
            "الموعد المؤقت غير موجود."
        };
      }

      const override =
        overrideSnap.data();

      if (
        override.sheikhId !==
        sheikhId
      ) {
        return {
          success: false,
          error:
            "لا تملك صلاحية حذف هذا الموعد المؤقت."
        };
      }

      await deleteDoc(
        overrideRef
      );

      return {
        success: true
      };

    } catch (error) {

      console.error(
        "❌ DELETE RESCHEDULE ERROR:",
        error
      );

      if (
        error?.code ===
        "permission-denied"
      ) {
        return {
          success: false,
          error:
            "Firestore Permission Error: Missing or insufficient permissions."
        };
      }

      return {
        success: false,
        error:
          error?.message ||
          "حدث خطأ أثناء حذف الموعد المؤقت."
      };
    }
  },

  async getSheikhOverrides() {

    try {

      const sheikhId =
        getCurrentSheikhId();

      if (!sheikhId) {
        return {
          success: false,
          error:
            "يجب تسجيل الدخول أولًا.",
          data: []
        };
      }

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

      const snapshot =
        await getDocs(q);

      const data =
        snapshot.docs.map(
          item => ({
            id: item.id,
            ...item.data()
          })
        );

      return {
        success: true,
        data
      };

    } catch (error) {

      console.error(
        "Error loading lesson overrides:",
        error
      );

      return {
        success: false,
        error:
          error?.message ||
          "فشل تحميل إعادة جدولة الحصص.",
        data: []
      };
    }
  },

  async getOverridesForDate(
    dateString
  ) {

    const result =
      await this.getSheikhOverrides();

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      data:
        result.data.filter(
          item =>
            item.newDate ===
            dateString
        )
    };
  }
};
