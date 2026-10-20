/**
 * Schedule Data & Business Logic Layer
 * Firestore Integration & Security
 *
 * طبقة بيانات المواعيد المتكررة أسبوعياً
 *
 * يدعم:
 * - الموعد الفردي القديم
 * - موعد المجموعة
 * - المواعيد المرتبطة بمواقيت الصلاة
 * - الحصص الحضورية والأونلاين
 * - تقارير الطلاب
 * - إلغاء الحصة
 * - إعادة جدولة occurrence واحدة بدون تعديل الموعد الأسبوعي
 * - دعم إعدادات dayConfigs المستقلة لكل يوم مع التوافق العكسي
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

import { db, auth } from "../config/firebase.js";
import { studentService } from "./studentService.js";
import { prayerService } from "./prayerService.js";
import { reportService } from "./reportService.js";
import { rescheduleService } from "./rescheduleService.js";

const COLLECTION_NAME = "schedules";

const prayerNames = {
  fajr: "الفجر",
  sunrise: "الشروق",
  dhuhr: "الظهر",
  asr: "العصر",
  maghrib: "المغرب",
  isha: "العشاء"
};

const _getCurrentSheikhId = () => {
  return auth.currentUser?.uid || null;
};

const getScheduleKind = schedule => {
  return schedule?.scheduleKind === "group"
    ? "group"
    : "individual";
};

const getLessonMode = schedule => {
  return schedule?.lessonMode === "online"
    ? "online"
    : "in_person";
};

const normalizeDays = days => {
  if (!Array.isArray(days)) {
    return [];
  }

  return days
    .map(day => Number(day))
    .filter(
      day =>
        Number.isInteger(day) &&
        day >= 0 &&
        day <= 6
    );
};

const normalizeTime = time => {
  if (!time) {
    return "";
  }

  const match = String(time).match(
    /^(\d{1,2}):(\d{2})/
  );

  if (!match) {
    return "";
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return "";
  }

  return (
    `${String(hour).padStart(2, "0")}:` +
    `${String(minute).padStart(2, "0")}`
  );
};

const timeToMinutes = time => {
  const normalized = normalizeTime(time);

  if (!normalized) {
    return null;
  }

  const [hours, minutes] =
    normalized.split(":").map(Number);

  return hours * 60 + minutes;
};

const minutesToTime = totalMinutes => {
  let value = Number(totalMinutes);

  if (!Number.isFinite(value)) {
    return "";
  }

  value =
    ((value % 1440) + 1440) %
    1440;

  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  return (
    `${String(hours).padStart(2, "0")}:` +
    `${String(minutes).padStart(2, "0")}`
  );
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

const calculateEffectiveStartTime = (
  schedule,
  prayerTimings,
  dayOfWeek = null
) => {
  if (!schedule) {
    return "";
  }

  const config = getDayConfig(schedule, dayOfWeek);

  if (config.timeType !== "prayer") {
    return normalizeTime(config.startTime);
  }

  const prayerName =
    config.prayerName ||
    "";

  const prayerTime =
    prayerTimings?.[prayerName];

  const prayerMinutes =
    timeToMinutes(prayerTime);

  if (prayerMinutes === null) {
    return "";
  }

  const offset =
    Number(config.offsetMinutes) || 0;

  return minutesToTime(
    prayerMinutes + offset
  );
};

const calculateEffectiveEndTime = (
  schedule,
  prayerTimings,
  dayOfWeek = null
) => {
  if (!schedule) {
    return "";
  }

  const config = getDayConfig(schedule, dayOfWeek);

  if (config.timeType !== "prayer") {
    return normalizeTime(config.endTime);
  }

  return calculateEffectiveStartTime(
    schedule,
    prayerTimings,
    dayOfWeek
  );
};

const buildPrayerTimeDisplay = (
  schedule,
  prayerTimings,
  dayOfWeek = null
) => {
  const config = getDayConfig(schedule, dayOfWeek);
  const effectiveStart =
    calculateEffectiveStartTime(
      schedule,
      prayerTimings,
      dayOfWeek
    );

  if (!effectiveStart) {
    return "";
  }

  if (config.timeType !== "prayer") {
    const end =
      normalizeTime(config.endTime);

    if (end) {
      return `${effectiveStart} -${end}`;
    }

    return effectiveStart;
  }

  const prayerName =
    config.prayerName ||
    "";

  const prayerLabel =
    prayerNames[prayerName] ||
    prayerName ||
    "الصلاة";

  const offset =
    Number(config.offsetMinutes) || 0;

  if (offset === 0) {
    return `${effectiveStart} — بعد ${prayerLabel}`;
  }

  const direction =
    offset > 0
      ? `بعد ${prayerLabel} بـ ${Math.abs(offset)} دقيقة`
      : `قبل ${prayerLabel} بـ ${Math.abs(offset)} دقيقة`;

  return `${effectiveStart} —${direction}`;
};

const _getStudentsForCurrentSheikh =
  async () => {
    const result =
      await studentService.getSheikhStudents();

    if (
      !result.success ||
      !Array.isArray(result.data)
    ) {
      return [];
    }

    return result.data;
  };

const _getStudentNameOrGroupName = async (schedule, studentsList) => {
  const kind = getScheduleKind(schedule);
  if (kind === "group") {
    return schedule.groupName || "مجموعة";
  }
  const student = studentsList.find(s => s.id === schedule.studentId);
  return student ? student.name : (schedule.studentName || "طالب");
};

const getDateForDayOfWeekInCurrentWeek = (targetDayOfWeek) => {
  const todayDateStr = reportService.getTodayCairoDate();
  const now = new Date(`${todayDateStr}T12:00:00`);
  const currentDayIndex = now.getDay();
  const diffToSat = (currentDayIndex + 1) % 7;
  const satDate = new Date(now);
  satDate.setDate(now.getDate() - diffToSat);

  for (let i = 0; i < 7; i++) {
    const d = new Date(satDate);
    d.setDate(satDate.getDate() + i);
    if (d.getDay() === targetDayOfWeek) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }
  return todayDateStr;
};

const _checkScheduleStartTimeConflict = async ({
  sheikhId,
  daysOfWeek,
  dayConfigs,
  excludeScheduleId = null,
  studentsList = []
}) => {
  try {
    const schedulesResult = await scheduleService.getSchedules();
    if (!schedulesResult.success) {
      return { success: true };
    }

    const existingSchedules = (schedulesResult.data || []).filter(
      s => s.id !== excludeScheduleId
    );

    if (existingSchedules.length === 0) {
      return { success: true };
    }

    const prayerTimingsCache = {};
    for (const dayId of daysOfWeek) {
      const dateStr = getDateForDayOfWeekInCurrentWeek(dayId);
      if (!prayerTimingsCache[dayId]) {
        const pRes = await prayerService.getPrayerTimesForDate(dateStr);
        if (!pRes.success || !pRes.timings) {
          return {
            success: false,
            error: `تعذر جلب مواقيت الصلاة لتاريخ يوم الأسبوع (${dateStr}). يرجى التحقق من الاتصال بالإنترنت أو استخدام وقت ثابت.`
          };
        }
        prayerTimingsCache[dayId] = pRes.timings;
      }
    }

    const newScheduleTimings = {};
    for (const dayId of daysOfWeek) {
      const config = dayConfigs[String(dayId)] || { timeType: "fixed", startTime: "" };
      let effectiveStart = "";
      if (config.timeType === "prayer") {
        const timings = prayerTimingsCache[dayId];
        const prayerName = config.prayerName || "";
        const prayerTime = timings[prayerName];
        const prayerMins = timeToMinutes(prayerTime);
        if (prayerMins === null) {
          return {
            success: false,
            error: `تعذر حساب وقت الصلاة المطلوب (${prayerName}) لهذا اليوم.`
          };
        }
        const offset = Number(config.offsetMinutes) || 0;
        effectiveStart = minutesToTime(prayerMins + offset);
      } else {
        effectiveStart = normalizeTime(config.startTime);
      }
      if (!effectiveStart) {
        return {
          success: false,
          error: "وقت البداية غير صالح."
        };
      }
      newScheduleTimings[dayId] = effectiveStart;
    }

    for (const existing of existingSchedules) {
      const existingDays = normalizeDays(existing.daysOfWeek);
      const commonDays = daysOfWeek.filter(d => existingDays.includes(d));
      if (commonDays.length === 0) continue;

      const existingPrayerTimingsCache = {};
      for (const dayId of commonDays) {
        const dateStr = getDateForDayOfWeekInCurrentWeek(dayId);
        const pRes = await prayerService.getPrayerTimesForDate(dateStr);
        if (pRes.success && pRes.timings) {
          existingPrayerTimingsCache[dayId] = pRes.timings;
        } else {
          existingPrayerTimingsCache[dayId] = {};
        }
      }

      for (const dayId of commonDays) {
        const newStart = newScheduleTimings[dayId];
        const existingConfig = getDayConfig(existing, dayId);
        let existingStart = "";
        if (existingConfig.timeType === "prayer") {
          const timings = existingPrayerTimingsCache[dayId] || {};
          const prayerName = existingConfig.prayerName || "";
          const prayerTime = timings[prayerName];
          const prayerMins = timeToMinutes(prayerTime);
          if (prayerMins !== null) {
            const offset = Number(existingConfig.offsetMinutes) || 0;
            existingStart = minutesToTime(prayerMins + offset);
          } else {
            existingStart = calculateEffectiveStartTime(existing, timings, dayId);
          }
        } else {
          existingStart = normalizeTime(existingConfig.startTime);
        }

        if (newStart && existingStart && newStart === existingStart) {
          const nameOrGroup = await _getStudentNameOrGroupName(existing, studentsList);
          const dayNameObj = [
            { id: 6, name: "السبت" },
            { id: 0, name: "الأحد" },
            { id: 1, name: "الإثنين" },
            { id: 2, name: "الثلاثاء" },
            { id: 3, name: "الأربعاء" },
            { id: 4, name: "الخميس" },
            { id: 5, name: "الجمعة" }
          ].find(d => d.id === dayId);
          const dayName = dayNameObj ? dayNameObj.name : "هذا اليوم";

          return {
            success: false,
            error: `عذراً، لا يمكن حفظ الموعد؛ لوجود موعد أسبوعي آخر مسجل بالفعل لـ "${nameOrGroup}" يوم ${dayName} عند الساعة ${newStart}. يرجى اختيار وقت آخر.`
          };
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error in conflict check:", error);
    return {
      success: false,
      error: error.message || "حدث خطأ أثناء فحص تعارض المواعيد."
    };
  }
};

const _valideGroupStudents =
  async studentIds => {
    if (
      !Array.isArray(studentIds) ||
      studentIds.length === 0
    ) {
      return {
        success: false,
        error:
          "يجب اختيار طالب واحد على الأقل للمجموعة."
      };
    }

    const students =
      await _getStudentsForCurrentSheikh();

    const studentMap =
      new Map(
        students.map(student => [
          student.id,
          student
        ])
      );

    const invalidIds =
      studentIds.filter(
        id => !studentMap.has(id)
      );

    if (invalidIds.length > 0) {
      return {
        success: false,
        error:
          "يوجد طالب غير تابع للشيخ الحالي داخل المجموعة."
      };
    }

    return {
      success: true,
      students:
        studentIds.map(
          id => studentMap.get(id)
        )
    };
  };

const _getTodayReportsMap =
  async () => {
    const result =
      await reportService.getTodayReports();

    const reports =
      Array.isArray(result)
        ? result
        : (
            result?.success &&
            Array.isArray(result.data)
              ? result.data
              : []
          );

    const map = new Map();

    reports.forEach(report => {
      if (
        !report ||
        !report.scheduleId ||
        !report.studentId
      ) {
        return;
      }

      const key =
        `${report.scheduleId}__${report.studentId}`;

      map.set(key, report);
    });

    return map;
  };

const _applyReportState = (
  schedule,
  reportsMap
) => {
  const studentIds =
    getScheduleKind(schedule) === "group"
      ? (
          Array.isArray(schedule.studentIds)
            ? schedule.studentIds
            : []
        )
      : schedule.studentId
        ? [schedule.studentId]
        : [];

  const reportedStudentIds =
    studentIds.filter(studentId =>
      reportsMap.has(
        `${schedule.id}__${studentId}`
      )
    );

  const cancelledStudentIds =
    reportedStudentIds.filter(studentId => {
      const report =
        reportsMap.get(
          `${schedule.id}__${studentId}`
        );

      return report?.status === "cancelled";
    });

  const pendingStudentIds =
    studentIds.filter(
      studentId =>
        !reportsMap.has(
          `${schedule.id}__${studentId}`
        )
    );

  const allStudentsReported =
    studentIds.length > 0 &&
    pendingStudentIds.length === 0;

  const isCancelled =
    getScheduleKind(schedule) === "individual" &&
    reportedStudentIds.length > 0 &&
    cancelledStudentIds.length > 0;

  return {
    ...schedule,

    reportedStudentIds,
    cancelledStudentIds,
    pendingStudentIds,
    allStudentsReported,
    isCancelled,

    hasReport:
      reportedStudentIds.length > 0,

    reportState: {
      reportedStudentIds,
      cancelledStudentIds,
      pendingStudentIds,
      allStudentsReported,
      isCancelled
    }
  };
};

const _buildStudentScheduleData = (
  schedule,
  students
) => {
  const kind =
    getScheduleKind(schedule);

  if (kind === "group") {
    const studentIds =
      Array.isArray(schedule.studentIds)
        ? schedule.studentIds
        : [];

    const groupStudents =
      studentIds
        .map(studentId =>
          students.find(
            student =>
              student.id === studentId
          )
        )
        .filter(Boolean);

    return {
      ...schedule,

      scheduleKind: "group",

      students: groupStudents,

      studentIds,

      studentCount:
        groupStudents.length,

      lessonMode:
        getLessonMode(schedule)
    };
  }

  const student =
    students.find(
      item =>
        item.id === schedule.studentId
    );

  return {
    ...schedule,

    scheduleKind: "individual",

    studentId:
      schedule.studentId,

    studentName:
      student?.name ||
      schedule.studentName ||
      "طالب",

    student:
      student || null,

    students:
      student
        ? [student]
        : [],

    studentIds:
      schedule.studentId
        ? [schedule.studentId]
        : [],

    studentCount:
      student
        ? 1
        : 0,

    lessonMode:
      getLessonMode(schedule)
  };
};

const _buildRescheduledOccurrence = (
  override,
  originalSchedule,
  students
) => {
  if (!override) {
    return null;
  }

  const snapshot =
    override.originalScheduleSnapshot ||
    {};

  const scheduleKind =
    override.scheduleKind ||
    snapshot.scheduleKind ||
    getScheduleKind(
      originalSchedule
    );

  const baseSchedule =
    originalSchedule || snapshot;

  const occurrence = {
    ...baseSchedule,

    id:
      override.originalScheduleId,

    scheduleId:
      override.originalScheduleId,

    scheduleKind,

    isRescheduled: true,

    overrideId:
      override.id ||
      override.overrideId,

    originalScheduleId:
      override.originalScheduleId,

    originalDate:
      override.originalDate,

    rescheduledDate:
      override.newDate,

    newDate:
      override.newDate,

    type:
      override.type ||
      snapshot.type ||
      baseSchedule.type ||
      "حفظ",

    lessonMode:
      override.lessonMode ||
      snapshot.lessonMode ||
      getLessonMode(baseSchedule),

    timeType: "fixed",

    startTime:
      normalizeTime(
        override.newStartTime
      ),

    endTime: "",

    effectiveStartTime:
      normalizeTime(
        override.newStartTime
      ),

    effectiveEndTime: "",

    sortStartTime:
      normalizeTime(
        override.newStartTime
      ),

    timeDisplay:
      normalizeTime(
        override.newStartTime
      ),

    recurrenceType: "override"
  };

  if (scheduleKind === "group") {
    occurrence.groupName =
      override.groupName ||
      snapshot.groupName ||
      baseSchedule.groupName ||
      "مجموعة";

    occurrence.studentIds =
      Array.isArray(
        override.studentIds
      )
        ? [...override.studentIds]
        : Array.isArray(
            snapshot.studentIds
          )
          ? [...snapshot.studentIds]
          : [];

    occurrence.students =
      occurrence.studentIds
        .map(studentId =>
          students.find(
            student =>
              student.id === studentId
          )
        )
        .filter(Boolean);

    occurrence.studentCount =
      occurrence.students.length;
  } else {
    occurrence.studentId =
      override.studentId ||
      snapshot.studentId ||
      baseSchedule.studentId ||
      "";

    const student =
      students.find(
        item =>
          item.id ===
          occurrence.studentId
      );

    occurrence.student =
      student || null;

    occurrence.students =
      student
        ? [student]
        : [];

    occurrence.studentIds =
      occurrence.studentId
        ? [occurrence.studentId]
        : [];

    occurrence.studentCount =
      student
        ? 1
        : 0;

    occurrence.studentName =
      student?.name ||
      snapshot.studentName ||
      baseSchedule.studentName ||
      "طالب";
  }

  return occurrence;
};

const _getCurrentWeekRescheduledLessons =
  async () => {
    try {
      const overridesResult =
        await rescheduleService.getSheikhOverrides();

      if (!overridesResult.success) {
        return {
          success: false,
          error:
            overridesResult.error ||
            "فشل تحميل إعادة جدولة الحصص.",
          data: []
        };
      }

      const overrides =
        Array.isArray(
          overridesResult.data
        )
          ? overridesResult.data
          : [];

      const schedulesResult =
        await scheduleService.getSchedules();

      const schedules =
        schedulesResult.success
          ? (
              schedulesResult.data || []
            )
          : [];

      const students =
        await _getStudentsForCurrentSheikh();

      const todayDate =
        reportService.getTodayCairoDate();

      const today =
        new Date(
          `${todayDate}T12:00:00`
        );

      const weekStart =
        new Date(today);

      const currentDay = today.getDay();
      const diffToSaturday = (currentDay + 1) % 7;
      weekStart.setDate(weekStart.getDate() - diffToSaturday);

      const toDateString =
        date => {
          const year =
            date.getFullYear();

          const month =
            String(
              date.getMonth() + 1
            ).padStart(2, "0");

          const day =
            String(
              date.getDate()
            ).padStart(2, "0");

          return `${year}-${month}-${day}`;
        };

      const weekDates =
        Array.from(
          { length: 7 },
          (_, index) => {
            const date =
              new Date(weekStart);

            date.setDate(
              weekStart.getDate() +
              index
            );

            return toDateString(date);
          }
        );

      const weekDatesSet =
        new Set(weekDates);

      const result = [];

      for (
        const override of overrides
      ) {
        if (
          !override ||
          override.status !==
            "rescheduled"
        ) {
          continue;
        }

        const originalDate =
          override.originalDate || "";

        const newDate =
          override.newDate || "";

        if (
          !weekDatesSet.has(originalDate) &&
          !weekDatesSet.has(newDate)
        ) {
          continue;
        }

        const originalSchedule =
          schedules.find(
            schedule =>
              schedule.id ===
              override.originalScheduleId
          );

        const occurrence =
          _buildRescheduledOccurrence(
            override,
            originalSchedule,
            students
          );

        if (!occurrence) {
          continue;
        }

        const studentIds =
          getScheduleKind(
            occurrence
          ) === "group"
            ? (
                Array.isArray(
                  occurrence.studentIds
                )
                  ? occurrence.studentIds
                  : []
              )
            : occurrence.studentId
              ? [
                  occurrence.studentId
                ]
              : [];

        let completed = false;

        if (
          studentIds.length > 0
        ) {
          let completedStudents = 0;

          for (
            const studentId of studentIds
          ) {
            if (!originalSchedule) {
              continue;
            }

            const hasReport =
              await reportService.hasReportForSchedule(
                occurrence.id,
                newDate,
                studentId
              );

            if (hasReport) {
              completedStudents++;
            }
          }

          completed =
            completedStudents ===
            studentIds.length;
        }

        const newDateObject =
          new Date(
            `${newDate}T12:00:00`
          );

        const originalDateObject =
          new Date(
            `${originalDate}T12:00:00`
          );

        occurrence.isRescheduled = true;

        occurrence.overrideId =
          override.id ||
          override.overrideId;

        occurrence.originalDate =
          originalDate;

        occurrence.newDate =
          newDate;

        occurrence.rescheduledDate =
          newDate;

        occurrence.isCompleted =
          completed;

        occurrence.rescheduleLabel =
          "🔄 مُعاد جدولتها";

        occurrence.dayOfWeek =
          newDateObject.getDay();

        occurrence.originalDayOfWeek =
          originalDateObject.getDay();

        occurrence.suppressOriginal =
          weekDatesSet.has(
            originalDate
          );

        occurrence.showTemporary =
          override.status === "rescheduled" &&
          weekDatesSet.has(newDate) &&
          !completed;

        result.push(
          occurrence
        );
      }

      return {
        success: true,
        data: result
      };

    } catch (error) {
      console.error(
        "Error loading current week rescheduled lessons:",
        error
      );

      return {
        success: false,
        error:
          error?.message ||
          "فشل تحميل الحصص المعاد جدولتها.",
        data: []
      };
    }
  };

export const scheduleService = {

  async getSchedules() {
    try {
      const sheikhId =
        _getCurrentSheikhId();

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

      const schedules =
        snapshot.docs.map(
          item => ({
            id: item.id,
            ...item.data()
          })
        );

      return {
        success: true,
        data: schedules
      };

    } catch (error) {
      console.error(
        "Error fetching schedules:",
        error
      );

      return {
        success: false,
        error:
          error?.message ||
          "فشل تحميل المواعيد.",
        data: []
      };
    }
  },

  async getCurrentWeekRescheduledLessons() {
    return await _getCurrentWeekRescheduledLessons();
  },

  async getTodaySchedules() {
    try {
      const schedulesResult =
        await this.getSchedules();

      if (!schedulesResult.success) {
        return [];
      }

      const schedules =
        schedulesResult.data || [];

      const students =
        await _getStudentsForCurrentSheikh();

      const now =
        new Date();

      const currentDayOfWeek =
        now.getDay();

      const todayDate =
        reportService.getTodayCairoDate();

      const prayerResult =
        await prayerService.getTodayPrayerTimes();

      const prayerTimings =
        prayerResult && prayerResult.success
          ? prayerResult.timings
          : {};

      const reportsMap =
        await _getTodayReportsMap();

      const overridesResult =
        await rescheduleService.getSheikhOverrides();

      const overrides =
        overridesResult.success
          ? (
              Array.isArray(
                overridesResult.data
              )
                ? overridesResult.data
                : []
            )
          : [];

      const todayOriginalOverridesMap = new Map();
      overrides.forEach(override => {
        if (override.status === "rescheduled" && override.originalDate === todayDate && override.newDate !== todayDate) {
          todayOriginalOverridesMap.set(override.originalScheduleId, override);
        }
      });

      const todayNewOverrides =
        overrides.filter(
          override =>
            override.status ===
              "rescheduled" &&
            override.newDate ===
              todayDate
        );

      // جلب الحصص التي كان موعدها الأصلي اليوم وتم نقلها لتاريخ آخر (لإظهارها في حصص اليوم كمنقولة)
      const todayMovedAwayOverrides =
        overrides.filter(
          override =>
            override.status ===
              "rescheduled" &&
            override.originalDate ===
              todayDate &&
            override.newDate !==
              todayDate
        );

      const todayRecurringSchedules =
        schedules.filter(
          schedule => {
            const days =
              normalizeDays(
                schedule.daysOfWeek
              );

            const occursToday =
              days.includes(
                currentDayOfWeek
              );

            if (!occursToday) {
              return false;
            }

            if (todayOriginalOverridesMap.has(schedule.id)) {
              return false;
            }

            return true;
          }
        );

      const recurringLessons =
        todayRecurringSchedules.map(
          schedule => {
            const effectiveStartTime =
              calculateEffectiveStartTime(
                schedule,
                prayerTimings,
                currentDayOfWeek
              );

            const effectiveEndTime =
              calculateEffectiveEndTime(
                schedule,
                prayerTimings,
                currentDayOfWeek
              );

            const base =
              _buildStudentScheduleData(
                {
                  ...schedule,
                  effectiveStartTime,
                  effectiveEndTime,
                  sortStartTime:
                    effectiveStartTime,
                  timeDisplay:
                    buildPrayerTimeDisplay(
                      schedule,
                      prayerTimings,
                      currentDayOfWeek
                    )
                },
                students
              );

            return base;
          }
        );

      const overrideLessons =
        todayNewOverrides
          .map(
            override => {
              const originalSchedule =
                schedules.find(
                  schedule =>
                    schedule.id ===
                    override.originalScheduleId
                );

              const occurrence =
                _buildRescheduledOccurrence(
                  override,
                  originalSchedule,
                  students
                );

              if (!occurrence) {
                return null;
              }

              return occurrence;
            }
          )
          .filter(Boolean);

      // تجهيز الحصص التي نُقلت من اليوم لتظهر في حصص اليوم كمنقولة
      const movedAwayLessons =
        todayMovedAwayOverrides
          .map(
            override => {
              const originalSchedule =
                schedules.find(
                  schedule =>
                    schedule.id ===
                    override.originalScheduleId
                );

              const occurrence =
                _buildRescheduledOccurrence(
                  override,
                  originalSchedule,
                  students
                );

              if (!occurrence) {
                return null;
              }

              // تعيين الأوسمة والوسوم الخاصة بالنقل لموعد آخر
              occurrence.isRescheduledOriginal = true;
              occurrence.isRescheduled = true;
              occurrence.rescheduleLabel = "🔄 معاد جدولتها";
              occurrence.newDateDisplay = override.newDate;
              occurrence.newTimeDisplay = override.newStartTime;
              return occurrence;
            }
          )
          .filter(Boolean);

      let todaySchedules = [
        ...recurringLessons,
        ...overrideLessons,
        ...movedAwayLessons
      ];

      const uniqueLessons =
        new Map();

      todaySchedules.forEach(
        lesson => {
          const occurrenceKey =
            lesson.isRescheduled && !lesson.isRescheduledOriginal
              ? `${lesson.id}__override__${lesson.overrideId}`
              : lesson.isRescheduledOriginal
              ? `${lesson.id}__moved__${lesson.overrideId}`
              : `${lesson.id}__recurring__${todayDate}`;

          uniqueLessons.set(
            occurrenceKey,
            lesson
          );
        }
      );

      todaySchedules =
        Array.from(
          uniqueLessons.values()
        );

      todaySchedules =
        todaySchedules.map(
          lesson =>
            _applyReportState(
              lesson,
              reportsMap
            )
        );

      todaySchedules.sort(
        (a, b) => {
          const aMinutes =
            timeToMinutes(
              a.effectiveStartTime
            );

          const bMinutes =
            timeToMinutes(
              b.effectiveStartTime
            );

          if (
            aMinutes === null &&
            bMinutes === null
          ) {
            return 0;
          }

          if (aMinutes === null) {
            return 1;
          }

          if (bMinutes === null) {
            return -1;
          }

          return aMinutes - bMinutes;
        }
      );

      const nowMinutes =
        now.getHours() * 60 +
        now.getMinutes();

      todaySchedules =
        todaySchedules.map(
          (lesson, index) => {
            const nextLesson =
              todaySchedules[
                index + 1
              ];

            const nextStart =
              nextLesson
                ? nextLesson.effectiveStartTime
                : "";

            const ownStart =
              timeToMinutes(
                lesson.effectiveStartTime
              );

            const nextStartMinutes =
              timeToMinutes(
                nextStart
              );

            let status =
              "upcoming";

            if (lesson.isRescheduledOriginal) {
              status = "rescheduled_original";
            } else if (
              lesson.allStudentsReported
            ) {
              status = "completed";
            } else if (
              ownStart !== null &&
              nowMinutes >= ownStart
            ) {
              if (
                nextStartMinutes !== null &&
                nowMinutes >=
                  nextStartMinutes
              ) {
                status = "completed";
              } else {
                status = "current";
              }
            }

            if (
              ownStart === null
            ) {
              status =
                lesson.allStudentsReported
                  ? "completed"
                  : lesson.isRescheduledOriginal
                    ? "rescheduled_original"
                    : "upcoming";
            }

            return {
              ...lesson,

              effectiveEndTime:
                nextStart ||
                lesson.effectiveEndTime ||
                "",

              status,

              isCurrent:
                status === "current",

              isUpcoming:
                status === "upcoming",

              isCompleted:
                status === "completed"
            };
          }
        );

      return todaySchedules;

    } catch (error) {
      console.error(
        "Error fetching today's schedules:",
        error
      );

      return [];
    }
  },

  async addSchedule(scheduleData) {
    try {
      const sheikhId =
        _getCurrentSheikhId();

      if (!sheikhId) {
        return {
          success: false,
          error:
            "يجب تسجيل الدخول أولًا."
        };
      }

      const {
        scheduleKind = "individual",
        studentId,
        studentIds,
        groupName,
        daysOfWeek,
        timeType = "fixed",
        startTime,
        endTime,
        prayerName,
        offsetMinutes = 0,
        type = "حفظ",
        lessonMode = "in_person",
        dayConfigs
      } = scheduleData || {};

      const normalizedDays =
        normalizeDays(daysOfWeek);

      if (
        normalizedDays.length === 0
      ) {
        return {
          success: false,
          error:
            "يجب اختيار يوم واحد على الأقل."
        };
      }

      let finalDayConfigs = {};
      if (dayConfigs && typeof dayConfigs === "object") {
        finalDayConfigs = { ...dayConfigs };
      } else {
        normalizedDays.forEach(day => {
          finalDayConfigs[String(day)] = {
            timeType,
            startTime: timeType === "fixed" ? normalizeTime(startTime) : null,
            endTime: timeType === "fixed" ? (normalizeTime(endTime) || null) : null,
            prayerName: timeType === "prayer" ? (prayerName || "") : "",
            offsetMinutes: Number(offsetMinutes) || 0
          };
        });
      }

      const studentsList = await _getStudentsForCurrentSheikh();

      const conflictCheck = await _checkScheduleStartTimeConflict({
        sheikhId,
        daysOfWeek: normalizedDays,
        dayConfigs: finalDayConfigs,
        excludeScheduleId: null,
        studentsList
      });

      if (!conflictCheck.success) {
        return conflictCheck;
      }

      if (
        scheduleKind === "group"
      ) {
        if (
          !String(groupName || "").trim()
        ) {
          return {
            success: false,
            error:
              "يجب كتابة اسم المجموعة."
          };
        }

        const validation =
          await _valideGroupStudents(
            studentIds
          );

        if (!validation.success) {
          return validation;
        }

        if (
          timeType === "fixed" &&
          !normalizeTime(startTime)
        ) {
          return {
            success: false,
            error:
              "يجب تحديد وقت بداية الحصة."
          };
        }

        const payload = {
          sheikhId,

          scheduleKind: "group",

          groupName:
            String(groupName).trim(),

          studentIds: [...studentIds],

          recurrenceType: "weekly",

          daysOfWeek:
            normalizedDays,

          dayConfigs: finalDayConfigs,

          timeType,

          type,

          lessonMode:
            lessonMode === "online"
              ? "online"
              : "in_person",

          offsetMinutes:
            Number(offsetMinutes) || 0,

          createdAt:
            Timestamp.now(),

          updatedAt:
            Timestamp.now()
        };

        if (
          timeType === "fixed"
        ) {
          payload.startTime =
            normalizeTime(startTime);

          payload.endTime =
            normalizeTime(endTime) || null;
        } else {
          payload.prayerName =
            prayerName || "";

          payload.startTime = null;
          payload.endTime = null;
        }

        const docRef =
          await addDoc(
            collection(
              db,
              COLLECTION_NAME
            ),
            payload
          );

        return {
          success: true,
          id: docRef.id,
          data: {
            id: docRef.id,
            ...payload
          }
        };
      }

      if (!studentId) {
        return {
          success: false,
          error:
            "يجب اختيار الطالب."
        };
      }

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

      if (
        studentData.sheikhId !==
        sheikhId
      ) {
        return {
          success: false,
          error:
            "لا تملك صلاحية استخدام هذا الطالب."
        };
      }

      const existingQuery =
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
          ),
          where(
            "scheduleKind",
            "==",
            "individual"
          )
        );

      const existingSnapshot =
        await getDocs(existingQuery);

      if (
        !existingSnapshot.empty
      ) {
        return {
          success: false,
          error:
            "هذا الطالب لديه موعد فردي مسجل بالفعل."
        };
      }

      if (
        timeType === "fixed" &&
        !normalizeTime(startTime)
      ) {
        return {
          success: false,
          error:
            "يجب تحديد وقت بداية الحصة."
        };
      }

      const payload = {
        sheikhId,

        scheduleKind:
          "individual",

        studentId,

        recurrenceType:
          "weekly",

        daysOfWeek:
          normalizedDays,

        dayConfigs: finalDayConfigs,

        timeType,

        type,

        lessonMode:
          lessonMode === "online"
            ? "online"
            : "in_person",

        offsetMinutes:
          Number(offsetMinutes) || 0,

        createdAt:
          Timestamp.now(),

        updatedAt:
          Timestamp.now()
      };

      if (
        timeType === "fixed"
      ) {
        payload.startTime =
          normalizeTime(startTime);

        payload.endTime =
          normalizeTime(endTime) || null;
      } else {
        payload.prayerName =
          prayerName || "";

        payload.startTime = null;
        payload.endTime = null;
      }

      const docRef =
        await addDoc(
          collection(
            db,
            COLLECTION_NAME
          ),
          payload
        );

      return {
        success: true,
        id: docRef.id,
        data: {
          id: docRef.id,
          ...payload
        }
      };

    } catch (error) {
      console.error(
        "Error adding schedule:",
        error
      );

      return {
        success: false,
        error:
          error?.message ||
          "حدث خطأ أثناء إضافة الموعد."
      };
    }
  },

  async updateSchedule(
    scheduleId,
    updateData
  ) {
    try {
      const sheikhId =
        _getCurrentSheikhId();

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
            "تعذر تحديد الموعد."
        };
      }

      const scheduleRef =
        doc(
          db,
          COLLECTION_NAME,
          scheduleId
        );

      const scheduleSnap =
        await getDoc(scheduleRef);

      if (!scheduleSnap.exists()) {
        return {
          success: false,
          error:
            "الموعد غير موجود."
        };
      }

      const current =
        scheduleSnap.data();

      if (
        current.sheikhId !==
        sheikhId
      ) {
        return {
          success: false,
          error:
            "لا تملك صلاحية تعديل هذا الموعد."
        };
      }

      const next = {
        ...current,
        ...(updateData || {})
      };

      const scheduleKind =
        getScheduleKind(next);

      const normalizedDays =
        normalizeDays(
          next.daysOfWeek
        );

      if (
        normalizedDays.length === 0
      ) {
        return {
          success: false,
          error:
            "يجب اختيار يوم واحد على الأقل."
        };
      }

      let mergedDayConfigs = current.dayConfigs ? { ...current.dayConfigs } : {};
      if (updateData && updateData.dayConfigs && typeof updateData.dayConfigs === "object") {
        mergedDayConfigs = {
          ...mergedDayConfigs,
          ...updateData.dayConfigs
        };
      } else {
        normalizedDays.forEach(day => {
          if (!mergedDayConfigs[String(day)]) {
            mergedDayConfigs[String(day)] = {
              timeType: next.timeType || "fixed",
              startTime: next.startTime || null,
              endTime: next.endTime || null,
              prayerName: next.prayerName || "",
              offsetMinutes: Number(next.offsetMinutes) || 0
            };
          }
        });
      }

      const studentsList = await _getStudentsForCurrentSheikh();

      const conflictCheck = await _checkScheduleStartTimeConflict({
        sheikhId,
        daysOfWeek: normalizedDays,
        dayConfigs: mergedDayConfigs,
        excludeScheduleId: scheduleId,
        studentsList
      });

      if (!conflictCheck.success) {
        return conflictCheck;
      }

      const payload = {
        ...updateData,

        sheikhId,

        scheduleKind,

        daysOfWeek:
          normalizedDays,

        dayConfigs: mergedDayConfigs,

        updatedAt:
          Timestamp.now()
      };

      if (
        scheduleKind === "group"
      ) {
        const validation =
          await _valideGroupStudents(
            next.studentIds
          );

        if (!validation.success) {
          return validation;
        }

        payload.groupName =
          String(
            next.groupName ||
            current.groupName ||
            "مجموعة"
          ).trim();

        payload.studentIds = [
          ...(next.studentIds || [])
        ];

        delete payload.studentId;

      } else {
        if (!next.studentId) {
          return {
            success: false,
            error:
              "يجب تحديد الطالب."
          };
        }

        const studentRef =
          doc(
            db,
            "students",
            next.studentId
          );

        const studentSnap =
          await getDoc(studentRef);

        if (
          !studentSnap.exists() ||
          studentSnap.data()
            .sheikhId !==
            sheikhId
        ) {
          return {
            success: false,
            error:
              "الطالب غير تابع للشيخ الحالي."
          };
        }

        payload.studentId =
          next.studentId;

        delete payload.groupName;
        delete payload.studentIds;
      }

      if (
        next.timeType === "fixed"
      ) {
        const normalizedStart =
          normalizeTime(
            next.startTime
          );

        if (!normalizedStart) {
          return {
            success: false,
            error:
              "يجب تحديد وقت بداية صحيح."
          };
        }

        payload.timeType = "fixed";

        payload.startTime =
          normalizedStart;

        payload.endTime =
          normalizeTime(
            next.endTime
          ) || null;

        delete payload.prayerName;

      } else {
        payload.timeType = "prayer";

        payload.prayerName =
          next.prayerName ||
          "";

        payload.offsetMinutes =
          Number(
            next.offsetMinutes
          ) || 0;

        delete payload.startTime;
        delete payload.endTime;
      }

      payload.lessonMode =
        next.lessonMode === "online"
          ? "online"
          : "in_person";

     await updateDoc(
        scheduleRef,
        payload
      );

      return {
        success: true,
        data: {
          id: scheduleId,
          ...current,
          ...payload
        }
      };

    } catch (error) {
      console.error(
        "Error updating schedule:",
        error
      );

      return {
        success: false,
        error:
          error?.message ||
          "حدث خطأ أثناء تعديل الموعد."
      };
    }
  },

  async deleteSchedule(
    scheduleId
  ) {
    try {
      const sheikhId =
        _getCurrentSheikhId();

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
            "تعذر تحديد الموعد."
        };
      }

      const scheduleRef =
        doc(
          db,
          COLLECTION_NAME,
          scheduleId
        );

      const scheduleSnap =
        await getDoc(scheduleRef);

      if (!scheduleSnap.exists()) {
        return {
          success: false,
          error:
            "الموعد غير موجود."
        };
      }

      if (
        scheduleSnap.data()
          .sheikhId !==
        sheikhId
      ) {
        return {
          success: false,
          error:
            "لا تملك صلاحية حذف هذا الموعد."
        };
      }

      await deleteDoc(
        scheduleRef
      );

      return {
        success: true
      };

    } catch (error) {
      console.error(
        "Error deleting schedule:",
        error
      );

      return {
        success: false,
        error:
          error?.message ||
          "حدث خطأ أثناء حذف الموعد."
      };
    }
  },

  calculateStatus(
    startTime,
    endTime
  ) {
    const now =
      new Date();

    const nowMinutes =
      now.getHours() * 60 +
      now.getMinutes();

    const start =
      timeToMinutes(startTime);

    const end =
      timeToMinutes(endTime);

    if (start === null) {
      return "upcoming";
    }

    if (nowMinutes < start) {
      return "upcoming";
    }

    if (
      end !== null &&
      nowMinutes >= end
    ) {
      return "completed";
    }

    return "current";
  },

  calculateDuration(
    startTime,
    endTime
  ) {
    const start =
      timeToMinutes(startTime);

    const end =
      timeToMinutes(endTime);

    if (
      start === null ||
      end === null
    ) {
      return 0;
    }

    let duration =
      end - start;

    if (duration < 0) {
      duration += 1440;
    }

    return duration;
  },

  getFormattedArabicDate() {
    return new Intl.DateTimeFormat(
      "ar-EG",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone:
          "Africa/Cairo"
      }
    ).format(
      new Date()
    );
  }
};
