/**
 * Sheikh Dashboard Component
 *
 * لوحة الشيخ الرئيسية.
 *
 * يدعم:
 * - المواعيد الفردية
 * - مواعيد المجموعات
 * - تقرير مستقل لكل طالب داخل المجموعة
 * - إلغاء الحصة بواسطة الشيخ فقط
 * - إرسال التقرير عبر WhatsApp
 * - الحصص الأونلاين
 * - إعادة جدولة occurrence واحدة
 * - الحفاظ على الموعد الأسبوعي الأصلي
 */

import { dashboardService } from "../services/dashboardData.js";
import { reportService, QURAN_SURAHS } from "../services/reportService.js";
import { studentService } from "../services/studentService.js";
import { rescheduleService } from "../services/rescheduleService.js";

let dashboardInterval = null;
let countdownInterval = null;

export async function renderSheikhDashboard(containerId) {
  const container =
    typeof containerId === "string"
      ? document.getElementById(containerId)
      : containerId;

  if (!container) {
    return;
  }

  if (dashboardInterval) {
    clearInterval(dashboardInterval);
    dashboardInterval = null;
  }

  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  const localReportOverrides = new Map();

  container.innerHTML = `
    <div class="no-data">
      جاري تحميل بيانات لوحة التحكم...
    </div>
  `;

  /* =========================================================
     أدوات الوقت
     ========================================================= */

  const formatTime12Hour = timeString => {
    if (!timeString || typeof timeString !== "string") {
      return "";
    }

    const match = timeString.match(/^(\d{1,2}):(\d{2})/);

    if (!match) {
      return timeString;
    }

    const hour24 = Number(match[1]);
    const minutes = match[2];

    if (
      !Number.isFinite(hour24) ||
      hour24 < 0 ||
      hour24 > 23
    ) {
      return timeString;
    }

    const period = hour24 < 12 ? "ص" : "م";
    let hour12 = hour24 % 12;

    if (hour12 === 0) {
      hour12 = 12;
    }

    return `${hour12}:${minutes} ${period}`;
  };

  const formatTimeDisplay = timeDisplay => {
    if (!timeDisplay || typeof timeDisplay !== "string") {
      return "";
    }

    return timeDisplay.replace(
      /\b(\d{1,2}):(\d{2})\b/g,
      (fullMatch, hour, minute) => {
        return formatTime12Hour(
          `${String(hour).padStart(2, "0")}:${minute}`
        );
      }
    );
  };

  const getEffectiveLessonStartTime = lesson => {
    if (!lesson) {
      return "";
    }

    return lesson.effectiveStartTime || lesson.startTime || "";
  };

  const getEffectiveLessonEndTime = lesson => {
    if (!lesson) {
      return "";
    }

    return lesson.effectiveEndTime || lesson.endTime || "";
  };

  const getLessonTimeDisplay = lesson => {
    if (!lesson) {
      return "";
    }

    const start = getEffectiveLessonStartTime(lesson);
    const end = getEffectiveLessonEndTime(lesson);

    if (start) {
      if (end) {
        const formattedStart = formatTime12Hour(start);
        const formattedEnd = formatTime12Hour(end);

        if (
          formattedStart &&
          formattedEnd &&
          formattedStart !== formattedEnd
        ) {
          return `${formattedStart} - ${formattedEnd}`;
        }
      }

      if (lesson.timeType === "prayer" && lesson.timeDisplay) {
        return formatTimeDisplay(lesson.timeDisplay);
      }

      return formatTime12Hour(start);
    }

    return formatTimeDisplay(lesson.timeDisplay || "");
  };

  const timeToMinutes = timeString => {
    if (!timeString) {
      return null;
    }

    const match = String(timeString).match(/^(\d{1,2}):(\d{2})/);

    if (!match) {
      return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    return hours * 60 + minutes;
  };

  const calculateCountdown = startTime => {
    const targetMinutes = timeToMinutes(startTime);

    if (targetMinutes === null) {
      return {
        isStarted: false,
        text: "موعد الحصة غير محدد"
      };
    }

    const now = new Date();
    const targetDate = new Date();

    targetDate.setHours(
      Math.floor(targetMinutes / 60),
      targetMinutes % 60,
      0,
      0
    );

    const diffMs = targetDate.getTime() - now.getTime();

    if (diffMs <= 0) {
      return {
        isStarted: true,
        text: "🟢 الحصة بدأت الآن"
      };
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );
    const seconds = totalSeconds % 60;

    const formatted =
      `${String(hours).padStart(2, "0")}:` +
      `${String(minutes).padStart(2, "0")}:` +
      `${String(seconds).padStart(2, "0")}`;

    return {
      isStarted: false,
      text: `متبقي ${formatted}`
    };
  };

  /* =========================================================
     Online / WhatsApp
     ========================================================= */

  const isOnlineLesson = lesson => {
    return lesson?.lessonMode === "online";
  };

  const normalizeEgyptianPhone = phone => {
    let value = String(phone || "").replace(/\D/g, "");

    if (!value) {
      return "";
    }

    if (value.startsWith("0020")) {
      value = value.substring(2);
    }

    if (value.startsWith("01")) {
      value = "20" + value.substring(1);
    }

    return value;
  };

  const openStudentWhatsApp = (
    phone,
    studentName = "الطالب"
  ) => {
    const whatsappPhone = normalizeEgyptianPhone(phone);

    if (!whatsappPhone) {
      alert(
        `لا يوجد رقم واتساب مسجل للطالب ${studentName}.`
      );
      return;
    }

    const message =
      `السلام عليكم ${studentName} 🌷\n` +
      `حان الآن موعد الحصة القرآنية أونلاين.\n` +
      `سأرسل لك رابط الحصة الآن بإذن الله.`;

    const whatsappUrl =
      `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
        message
      )}`;

    window.open(
      whatsappUrl,
      "_blank",
      "noopener,noreferrer"
    );
  };

  /* =========================================================
     المجموعات
     ========================================================= */

  const isGroupLesson = lesson => {
    return lesson?.scheduleKind === "group";
  };

  const getLessonStudents = lesson => {
    if (!lesson) {
      return [];
    }

    if (Array.isArray(lesson.students)) {
      return lesson.students;
    }

    return [];
  };

  const getStudentIdsForLesson = lesson => {
    if (!lesson) {
      return [];
    }

    if (
      Array.isArray(lesson.studentIds) &&
      lesson.studentIds.length > 0
    ) {
      return lesson.studentIds;
    }

    if (lesson.studentId) {
      return [lesson.studentId];
    }

    if (Array.isArray(lesson.students)) {
      return lesson.students
        .map(student => student.id)
        .filter(Boolean);
    }

    return [];
  };

  const getReportKey = (scheduleId, studentId) => {
    return `${scheduleId}__${studentId}`;
  };

  const buildReportsMap = reports => {
    const map = new Map();

    (reports || []).forEach(report => {
      if (
        !report ||
        !report.scheduleId ||
        !report.studentId
      ) {
        return;
      }

      map.set(
        getReportKey(
          report.scheduleId,
          report.studentId
        ),
        report
      );
    });

    localReportOverrides.forEach((report, key) => {
      map.set(key, report);
    });

    return map;
  };

  const isLessonFullyReported = (
    lesson,
    reportsMap
  ) => {
    if (!lesson) {
      return false;
    }

    const studentIds =
      getStudentIdsForLesson(lesson);

    if (studentIds.length === 0) {
      return false;
    }

    return studentIds.every(studentId =>
      reportsMap.has(
        getReportKey(
          lesson.id,
          studentId
        )
      )
    );
  };

  const getLessonReportedCount = (
    lesson,
    reportsMap
  ) => {
    const studentIds =
      getStudentIdsForLesson(lesson);

    return studentIds.filter(studentId =>
      reportsMap.has(
        getReportKey(
          lesson.id,
          studentId
        )
      )
    ).length;
  };

  const getActiveStudentsForLesson = (
    lesson,
    reportsMap
  ) => {
    const students =
      getLessonStudents(lesson);

    return students.filter(student => {
      if (!student || !student.id) {
        return false;
      }

      return !reportsMap.has(
        getReportKey(
          lesson.id,
          student.id
        )
      );
    });
  };

  /* =========================================================
     إعادة الجدولة
     ========================================================= */

  const formatDateForDisplay = dateString => {
    if (!dateString) {
      return "";
    }

    const date = new Date(
      `${dateString}T12:00:00`
    );

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return new Intl.DateTimeFormat(
      "ar-EG",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }
    ).format(date);
  };

  const getTodayDate = () => {
    return reportService.getTodayCairoDate();
  };

  const openRescheduleModal = ({
    scheduleId,
    studentName,
    groupName,
    isGroup,
    originalTime
  }) => {
    const modal =
      container.querySelector(
        "#reschedule-modal"
      );

    if (!modal) {
      return;
    }

    const title =
      container.querySelector(
        "#reschedule-title"
      );

    const currentInfo =
      container.querySelector(
        "#reschedule-current-info"
      );

    const dateInput =
      container.querySelector(
        "#reschedule-date"
      );

    const timeInput =
      container.querySelector(
        "#reschedule-time"
      );

    const scheduleIdInput =
      container.querySelector(
        "#reschedule-schedule-id"
      );

    const isGroupInput =
      container.querySelector(
        "#reschedule-is-group"
      );

    if (title) {
      title.textContent = isGroup
        ? `📅 إعادة جدولة المجموعة: ${
            groupName || "مجموعة"
          }`
        : `📅 إعادة جدولة حصة: ${
            studentName || "الطالب"
          }`;
    }

    if (currentInfo) {
      currentInfo.textContent =
        `الموعد الحالي: ${
          formatTime12Hour(originalTime) ||
          "غير محدد"
        }`;
    }

    if (scheduleIdInput) {
      scheduleIdInput.value =
        scheduleId || "";
    }

    if (isGroupInput) {
      isGroupInput.value =
        isGroup ? "true" : "false";
    }

    const today = getTodayDate();

    if (dateInput) {
      dateInput.min = today;
      dateInput.value = "";
    }

    if (timeInput) {
      timeInput.value = "";
    }

    modal.style.display = "flex";

    setTimeout(() => {
      dateInput?.focus();
    }, 0);
  };

  const closeRescheduleModal = () => {
    const modal =
      container.querySelector(
        "#reschedule-modal"
      );

    if (modal) {
      modal.style.display = "none";
    }
  };

  const submitReschedule = async () => {
    const scheduleId =
      container.querySelector(
        "#reschedule-schedule-id"
      )?.value;

    const dateInput =
      container.querySelector(
        "#reschedule-date"
      );

    const timeInput =
      container.querySelector(
        "#reschedule-time"
      );

    const newDate =
      dateInput?.value || "";

    const newStartTime =
      timeInput?.value || "";

    if (!scheduleId) {
      alert("تعذر تحديد الحصة.");
      return;
    }

    if (!newDate) {
      alert("يرجى اختيار التاريخ الجديد.");
      return;
    }

    if (!newStartTime) {
      alert("يرجى اختيار الوقت الجديد.");
      return;
    }

    const today = getTodayDate();

    if (newDate < today) {
      alert(
        "لا يمكن اختيار تاريخ سابق لليوم."
      );
      return;
    }

    const submitBtn =
      container.querySelector(
        "#confirm-reschedule-btn"
      );

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent =
        "جاري فحص التعارض وإعادة الجدولة...";
    }

    try {
      const originalDate =
        getTodayDate();

      const result =
        await rescheduleService.rescheduleLesson(
          {
            scheduleId,
            originalDate,
            newDate,
            newStartTime,
            forceConfirm: false
          }
        );

      if (result.requiresConfirmation) {
        const conflictList = (result.conflicts || [])
          .map(c => `• الطالب/المجموعة: "${c.name}" عند الساعة ${c.time}`)
          .join("\n");

        const confirmMsg =
          `⚠️ تنبيه: يوجد تعارض في الموعد مع الحصص التالية في نفس التاريخ:\n\n` +
          conflictList +
          `\n\nهل تريد المتابعة وإتمام إعادة الجدولة على هر حال؟`;

        const userConfirmed = confirm(confirmMsg);
        if (!userConfirmed) {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent =
              "📅 تأكيد إعادة الجدولة";
          }
          return;
        }

        const forcedResult = await rescheduleService.rescheduleLesson({
          scheduleId,
          originalDate,
          newDate,
          newStartTime,
          forceConfirm: true
        });

        if (!forcedResult.success) {
          alert(
            forcedResult.error ||
              "تعذر إعادة جدولة الحصة."
          );
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent =
              "📅 تأكيد إعادة الجدولة";
          }
          return;
        }
      } else if (!result.success) {
        alert(
          result.error ||
            "تعذر إعادة جدولة الحصة."
        );
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent =
            "📅 تأكيد إعادة الجدولة";
        }
        return;
      }

      closeRescheduleModal();

      alert(
        `✅ تمت إعادة جدولة الحصة بنجاح.\n\n` +
        `الموعد الجديد:\n` +
        `${formatDateForDisplay(newDate)}\n` +
        `${formatTime12Hour(newStartTime)}\n\n` +
        `الموعد الأسبوعي الأصلي لم يتغير.`
      );

      await refreshDashboard(false);
    } catch (error) {
      console.error(
        "Error rescheduling lesson:",
        error
      );

      alert(
        "حدث خطأ أثناء إعادة جدولة الحصة: " +
          (
            error?.message ||
            "يرجى المحاولة لاحقًا."
          )
      );
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent =
          "📅 تأكيد إعادة الجدولة";
      }
    }
  };

  /* =========================================================
     إلغاء الحصة
     ========================================================= */

  const cancelLessonForStudent = async ({
    scheduleId,
    studentId,
    studentName,
    isGroup = false,
    groupId = null,
    groupName = ""
  }) => {
    if (!scheduleId || !studentId) {
      alert(
        "تعذر تحديد الطالب أو الحصة."
      );
      return;
    }

    const reasonInput = prompt(
      `اكتب سبب إلغاء حصة ${
        studentName || "الطالب"
      }:`
    );

    if (reasonInput === null) {
      return;
    }

    const cancellationReason =
      String(reasonInput).trim();

    if (!cancellationReason) {
      alert(
        "يجب كتابة سبب إلغاء الحصة."
      );
      return;
    }

    if (cancellationReason.length > 500) {
      alert(
        "سبب الإلغاء طويل جدًا. الحد الأقصى 500 حرف."
      );
      return;
    }

    const confirmed = confirm(
      `هل أنت متأكد من إلغاء حصة ${
        studentName || "الطالب"
      }؟\n\n` +
      `سبب الإلغاء:\n${cancellationReason}\n\n` +
      `سيتم تسجيل الإلغاء ولن يمكن تسجيل تقرير عادي لنفس الطالب لهذه الحصة اليوم.`
    );

    if (!confirmed) {
      return;
    }

    try {
      const todayDate =
        reportService.getTodayCairoDate();

      const result =
        await reportService.addCancelledLessonReport(
          {
            studentId,
            scheduleId,
            date: todayDate,
            notes: cancellationReason,
            isGroup,
            groupId: isGroup
              ? groupId || scheduleId
              : null,
            groupName: isGroup
              ? groupName
              : null
          }
        );

      if (!result.success) {
        alert(
          "حدث خطأ أثناء إلغاء الحصة: " +
            (
              result.error ||
              "يرجى المحاولة لاحقًا."
            )
        );
        return;
      }

      const localCancelledReport = {
        id:
          result.id ||
          getReportKey(
            scheduleId,
            studentId
          ),
        scheduleId,
        studentId,
        date: todayDate,
        completedAt: new Date(),
        status: "cancelled",
        cancellationReason,
        memorization: [],
        review: [],
        rating: null,
        memorizationRating: null,
        reviewRating: null,
        notes: cancellationReason,
        isGroup,
        groupId: isGroup
          ? groupId || scheduleId
          : null,
        groupName: isGroup
          ? groupName
          : null
      };

      localReportOverrides.set(
        getReportKey(
          scheduleId,
          studentId
        ),
        localCancelledReport
      );

      alert(
        `تم إلغاء حصة ${
          studentName || "الطالب"
        } وتسجيل سبب الإلغاء بنجاح.`
      );

      await refreshDashboard(false);
    } catch (error) {
      console.error(
        "Error cancelling lesson:",
        error
      );

      alert(
        "حدث خطأ أثناء إلغاء الحصة: " +
          (
            error?.message ||
            "يرجى المحاولة لاحقًا."
          )
      );
    }
  };

  /* =========================================================
     المؤقت
     ========================================================= */

  const startCountdown = nextLesson => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    if (!nextLesson) {
      return;
    }

    const effectiveStartTime =
      getEffectiveLessonStartTime(
        nextLesson
      );

    if (!effectiveStartTime) {
      return;
    }

    const updateCountdown =
      async () => {
        const activeTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab');
        if (activeTab && activeTab !== "dashboard") {
          if (countdownInterval) {
            clearInterval(
              countdownInterval
            );
            countdownInterval = null;
          }
          return;
        }

        if (
          !container ||
          !container.isConnected
        ) {
          if (countdownInterval) {
            clearInterval(
              countdownInterval
            );
            countdownInterval = null;
          }

          return;
        }

        const timerElement =
          container.querySelector(
            "#countdown-timer"
          );

        if (!timerElement) {
          return;
        }

        const countdown =
          calculateCountdown(
            effectiveStartTime
          );

        timerElement.textContent =
          countdown.text;

        if (countdown.isStarted) {
          timerElement.style.color =
            "#16a34a";

          if (countdownInterval) {
            clearInterval(
              countdownInterval
            );
            countdownInterval = null;
          }

          await refreshDashboard(false);
        }
      };

    updateCountdown();

    countdownInterval = setInterval(
      updateCountdown,
      1000
    );
  };

  /* =========================================================
     تحديث Dashboard
     ========================================================= */

  const refreshDashboard = async (
    isInitial = false
  ) => {
    const currentActiveTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab');
    if (currentActiveTab && currentActiveTab !== "dashboard") {
      if (dashboardInterval) {
        clearInterval(dashboardInterval);
        dashboardInterval = null;
      }
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      return;
    }

    if (
      !container ||
      !container.isConnected
    ) {
      if (dashboardInterval) {
        clearInterval(
          dashboardInterval
        );
        dashboardInterval = null;
      }

      if (countdownInterval) {
        clearInterval(
          countdownInterval
        );
        countdownInterval = null;
      }

      return;
    }

    if (!isInitial) {
      const existingReportModal =
        container.querySelector(
          "#lesson-report-modal"
        );

      if (
        existingReportModal &&
        existingReportModal.style.display ===
          "flex"
      ) {
        return;
      }
    }

    const [
      dataResult,
      todayReportsRes,
      studentsRes
    ] = await Promise.all([
      dashboardService.getDashboardData(),
      reportService.getTodayReports(),
      studentService.getSheikhStudents()
    ]);

    const postAwaitTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab');
    if (postAwaitTab && postAwaitTab !== "dashboard") {
      return;
    }

    if (!container.isConnected) {
      return;
    }

    const allStudents =
      studentsRes.success &&
      Array.isArray(studentsRes.data)
        ? studentsRes.data
        : [];

    if (!dataResult.success) {
      if (isInitial) {
        container.innerHTML = `
          <div class="dashboard-container">
            <div
              class="no-data"
              style="color:#991b1b;background:#fee2e2;border-color:#fca5a5;"
            >
              عذرًا، حدث خطأ أثناء تحميل بيانات لوحة التحكم:
              ${
                dataResult.error ||
                "يرجى التحقق من الاتصال."
              }
            </div>
          </div>
        `;
      }

      return;
    }

    let {
      sheikh,
      studentsCount,
      todayLessonsCount,
      todayLessons,
      currentLesson,
      nextLesson,
      formattedDate
    } = dataResult;

    todayLessons = Array.isArray(
      todayLessons
    )
      ? todayLessons
      : [];

    const todayReports =
      Array.isArray(todayReportsRes)
        ? todayReportsRes
        : (
            todayReportsRes?.success &&
            Array.isArray(
              todayReportsRes.data
            )
              ? todayReportsRes.data
              : []
          );

    todayReports.forEach(report => {
      if (
        report &&
        report.scheduleId &&
        report.studentId
      ) {
        const key = getReportKey(
          report.scheduleId,
          report.studentId
        );

        if (
          localReportOverrides.has(
            key
          )
        ) {
          localReportOverrides.delete(
            key
          );
        }
      }
    });

    const reportsMap =
      buildReportsMap(todayReports);

    if (
      currentLesson &&
      isLessonFullyReported(
        currentLesson,
        reportsMap
      )
    ) {
      currentLesson = null;
    }

    if (
      currentLesson &&
      isGroupLesson(currentLesson)
    ) {
      const activeCurrentStudents =
        getActiveStudentsForLesson(
          currentLesson,
          reportsMap
        );

      if (
        activeCurrentStudents.length ===
        0
      ) {
        currentLesson = null;
      }
    }

    if (
      nextLesson &&
      isLessonFullyReported(
        nextLesson,
        reportsMap
      )
    ) {
      const alternativeNext =
        todayLessons.find(
          lesson =>
            lesson.status ===
              "upcoming" &&
            !isLessonFullyReported(
              lesson,
              reportsMap
            )
        );

      nextLesson =
        alternativeNext || null;
    }

    const currentLessonTime =
      currentLesson
        ? getLessonTimeDisplay(
            currentLesson
          )
        : "";

    const nextLessonTime =
      nextLesson
        ? getLessonTimeDisplay(
            nextLesson
          )
        : "";

    const nextLessonStartTime =
      nextLesson
        ? getEffectiveLessonStartTime(
            nextLesson
          )
        : "";

    /* =======================================================
       الحصة الحالية
       ======================================================= */

    let currentLessonHTML = `
      <div class="no-data">
        لا توجد حصة جارية في الوقت الحالي
      </div>
    `;

    if (currentLesson) {
      const group =
        isGroupLesson(
          currentLesson
        );

      if (group) {
        const allGroupStudents =
          getLessonStudents(
            currentLesson
          );

        const activeStudents =
          getActiveStudentsForLesson(
            currentLesson,
            reportsMap
          );

        const reportedCount =
          getLessonReportedCount(
            currentLesson,
            reportsMap
          );

        const online =
          isOnlineLesson(
            currentLesson
          );

        const studentsHTML =
          activeStudents.length > 0
            ? activeStudents
                .map(student => {
                  return `
              <div
                style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid var(--border-color);border-radius:8px;background:var(--card-bg,#fff);flex-wrap:wrap;"
              >
                <span>
                  👤 ${student.name}
                </span>

                <div
                  style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;"
                >
                  ${
                    online
                      ? `
                        <button
                          type="button"
                          class="secondary-btn open-online-whatsapp-btn"
                          data-student-id="${student.id}"
                          data-student-name="${student.name}"
                          style="font-size:.78rem;padding:4px 10px;background:#22c55e;color:#fff;"
                        >
                          💬 واتساب الطالب
                        </button>
                      `
                      : ""
                  }

                  <button
                    type="button"
                    class="secondary-btn open-report-modal-btn"
                    data-schedule-id="${currentLesson.id}"
                    data-student-id="${student.id}"
                    data-student-name="${student.name}"
                    data-is-group="true"
                    data-group-name="${
                      currentLesson.groupName ||
                      ""
                    }"
                    style="font-size:.78rem;padding:4px 10px;background:#e0f2fe;color:#0369a1;"
                  >
                    📝 تسجيل التقرير
                  </button>

                  <button
                    type="button"
                    class="secondary-btn cancel-lesson-btn"
                    data-schedule-id="${currentLesson.id}"
                    data-student-id="${student.id}"
                    data-student-name="${student.name}"
                    data-is-group="true"
                    data-group-id="${currentLesson.id}"
                    data-group-name="${
                      currentLesson.groupName ||
                      ""
                    }"
                    style="font-size:.78rem;padding:4px 10px;background:#fee2e2;color:#991b1b;"
                  >
                    🚫 إلغاء الحصة
                  </button>

                  <button
                    type="button"
                    class="secondary-btn reschedule-lesson-btn"
                    data-schedule-id="${currentLesson.id}"
                    data-student-name="${student.name}"
                    data-group-name="${
                      currentLesson.groupName ||
                      ""
                    }"
                    data-is-group="true"
                    data-original-time="${getEffectiveLessonStartTime(
                      currentLesson
                    )}"
                    style="font-size:.78rem;padding:4px 10px;background:#fef3c7;color:#92400e;"
                  >
                    📅 إعادة جدولة
                  </button>
                </div>
              </div>
            `;
                })
                .join("")
            : `
              <div class="no-data">
                لا يوجد طلاب متاحون في هذه المجموعة.
              </div>
            `;

        currentLessonHTML = `
          <div
            class="lesson-card current"
            style="display:flex;flex-direction:column;gap:12px;"
          >
            <div
              style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;"
            >
              <div class="lesson-info">
                <span class="lesson-student">
                  👥 ${
                    currentLesson.groupName ||
                    "مجموعة"
                  }
                </span>

                <span class="lesson-time">
                  ⏰ ${currentLessonTime}
                </span>

                <span class="lesson-type">
                  🏷️ ${currentLesson.type}
                </span>

                ${
                  currentLesson.isRescheduled
                    ? `
                      <span
                        style="display:block;color:#92400e;font-weight:700;margin-top:4px;"
                      >
                        📅 حصة معاد جدولتها
                      </span>
                    `
                    : ""
                }

                ${
                  online
                    ? `
                      <span
                        style="display:block;color:#15803d;font-weight:700;margin-top:4px;"
                      >
                        💻 حصة أونلاين
                      </span>
                    `
                    : `
                      <span
                        style="display:block;color:var(--text-muted);margin-top:4px;"
                      >
                        🏠 حصة حضورية
                      </span>
                    `
                }

                <span
                  style="display:block;margin-top:4px;font-size:.85rem;color:var(--text-muted);"
                >
                  👨‍🎓 ${
                    reportedCount
                  }/${allGroupStudents.length}
                  تم تسجيل تقاريرهم
                </span>
              </div>

              <span class="badge current">
                جارية الآن
              </span>
            </div>

            <div
              style="display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--border-color);padding-top:10px;"
            >
              ${studentsHTML}
            </div>
          </div>
        `;
      } else {
        const studentId =
          currentLesson.studentId;

        const report =
          reportsMap.get(
            getReportKey(
              currentLesson.id,
              studentId
            )
          );

        const online =
          isOnlineLesson(
            currentLesson
          );

        if (!report) {
          currentLessonHTML = `
            <div
              class="lesson-card current"
              style="display:flex;flex-direction:column;gap:12px;"
            >
              <div
                style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;"
              >
                <div class="lesson-info">
                  <span class="lesson-student">
                    👨‍🎓 ${
                      currentLesson.studentName
                    }
                  </span>

                  <span class="lesson-time">
                    ⏰ ${currentLessonTime}
                  </span>

                  <span class="lesson-type">
                    🏷️ ${currentLesson.type}
                  </span>

                  ${
                    currentLesson.isRescheduled
                      ? `
                        <span
                          style="display:block;color:#92400e;font-weight:700;margin-top:4px;"
                        >
                          📅 حصة معاد جدولتها
                        </span>
                      `
                      : ""
                  }

                  ${
                    online
                      ? `
                        <span
                          style="display:block;color:#15803d;font-weight:700;margin-top:4px;"
                        >
                          💻 حصة أونلاين
                        </span>
                      `
                      : `
                        <span
                          style="display:block;color:var(--text-muted);margin-top:4px;"
                        >
                          🏠 حصة حضورية
                        </span>
                      `
                  }
                </div>

                <span class="badge current">
                  جارية الآن
                </span>
              </div>

              <div
                style="display:flex;justify-content:flex-end;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px solid var(--border-color);padding-top:8px;"
              >
                ${
                  online
                    ? `
                      <button
                        type="button"
                        class="secondary-btn open-online-whatsapp-btn"
                        data-student-id="${studentId}"
                        data-student-name="${currentLesson.studentName}"
                        style="font-size:.85rem;padding:6px 14px;background:#22c55e;color:#fff;"
                      >
                        💬 فتح واتساب الطالب
                      </button>
                    `
                    : ""
                }

                <button
                  type="button"
                  class="primary-action-btn open-report-modal-btn"
                  data-schedule-id="${currentLesson.id}"
                  data-student-id="${studentId}"
                  data-student-name="${currentLesson.studentName}"
                  data-is-group="false"
                  style="font-size:.85rem;padding:6px 14px;"
                >
                  ✅ إتمام وتسجيل تقرير الحصة
                </button>

                <button
                  type="button"
                  class="secondary-btn cancel-lesson-btn"
                  data-schedule-id="${currentLesson.id}"
                  data-student-id="${studentId}"
                  data-student-name="${currentLesson.studentName}"
                  data-is-group="false"
                  style="font-size:.85rem;padding:6px 14px;background:#fee2e2;color:#991b1b;"
                >
                  🚫 إلغاء الحصة
                </button>

                <button
                  type="button"
                  class="secondary-btn reschedule-lesson-btn"
                  data-schedule-id="${currentLesson.id}"
                  data-student-name="${currentLesson.studentName}"
                  data-group-name=""
                  data-is-group="false"
                  data-original-time="${getEffectiveLessonStartTime(
                    currentLesson
                  )}"
                  style="font-size:.85rem;padding:6px 14px;background:#fef3c7;color:#92400e;"
                >
                  📅 إعادة جدولة
                </button>
              </div>
            </div>
          `;
        }
      }
    }

    /* =======================================================
       HTML الرئيسي
       ======================================================= */

    container.innerHTML = `
      <div class="dashboard-container">

        <div class="dash-welcome-card">
          <h2>
            مرحبًا بك، ${sheikh.title}
            ${sheikh.name} 👋
          </h2>

          <span class="dash-date">
            📅 ${formattedDate}
          </span>

          <p class="dash-subtitle">
            ${
              studentsCount > 0
                ? `لديك اليوم ${todayLessonsCount} حصص قرآنية مسجلة.`
                : "لا توجد حصص مسجلة اليوم."
            }
          </p>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-value">
              ${studentsCount}
            </span>

            <span class="stat-label">
              إجمالي الطلاب
            </span>
          </div>

          <div class="stat-card">
            <span class="stat-value">
              ${todayLessonsCount}
            </span>

            <span class="stat-label">
              حصص اليوم
            </span>
          </div>
        </div>

        <section class="dash-section">
          <h3 class="section-title">
            الحصة الحالية
          </h3>

          ${currentLessonHTML}
        </section>

        <section class="dash-section">
          <h3 class="section-title">
            ⏰ الحصة القادمة
          </h3>

          ${
            nextLesson
              ? `
                <div class="lesson-card upcoming">

                  <div class="lesson-info">

                    <span class="lesson-student">
                      ${
                        isGroupLesson(
                          nextLesson
                        )
                          ? `👥 ${
                              nextLesson.groupName ||
                              "مجموعة"
                            }`
                          : `👨‍🎓 ${
                              nextLesson.studentName
                            }`
                      }
                    </span>

                    <span class="lesson-time">
                      ⏰ ${nextLessonTime}
                    </span>

                    <span class="lesson-type">
                      🏷️ ${nextLesson.type}
                    </span>

                    ${
                      nextLesson.isRescheduled
                        ? `
                          <span
                            style="display:block;color:#92400e;font-weight:700;margin-top:4px;"
                          >
                            📅 حصة معاد جدولتها
                          </span>
                        `
                        : ""
                    }

                    ${
                      isOnlineLesson(
                        nextLesson
                      )
                        ? `
                          <span
                            style="display:block;color:#15803d;font-weight:700;margin-top:4px;"
                          >
                            💻 أونلاين
                          </span>
                        `
                        : ""
                    }

                    ${
                      isGroupLesson(
                        nextLesson
                      )
                        ? `
                          <span
                            style="color:var(--text-muted);font-size:.85rem;"
                          >
                            👨‍🎓 ${
                              nextLesson.studentCount ||
                              0
                            } طلاب
                          </span>
                        `
                        : ""
                    }

                    <span
                      id="countdown-timer"
                      style="font-weight:700;color:#0369a1;margin-top:4px;font-size:.95rem;direction:rtl;"
                    >
                      ${
                        nextLessonStartTime
                          ? calculateCountdown(
                              nextLessonStartTime
                            ).text
                          : "موعد الحصة غير محدد"
                      }
                    </span>
                  </div>

                  <div
                    style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;flex-wrap:wrap;"
                  >
                    <button
                      type="button"
                      class="secondary-btn reschedule-lesson-btn"
                      data-schedule-id="${nextLesson.id}"
                      data-student-name="${
                        nextLesson.studentName ||
                        ""
                      }"
                      data-group-name="${
                        nextLesson.groupName ||
                        ""
                      }"
                      data-is-group="${isGroupLesson(
                        nextLesson
                      )}"
                      data-original-time="${getEffectiveLessonStartTime(
                        nextLesson
                      )}"
                      style="font-size:.82rem;padding:5px 12px;background:#fef3c7;color:#92400e;"
                    >
                      📅 إعادة جدولة
                    </button>
                  </div>
                </div>
              `
              : `
                <div class="no-data">
                  لا توجد حصص قادمة اليوم
                </div>
              `
          }
        </section>

        <section class="dash-section">

          <h3 class="section-title">
            حصص اليوم
          </h3>

          <div class="lessons-list">

            ${
              todayLessons.length > 0
                ? todayLessons
                    .map(
                      lesson => {
                        const group =
                          isGroupLesson(
                            lesson
                          );

                        const lessonTime =
                          getLessonTimeDisplay(
                            lesson
                          );

                        const studentIds =
                          getStudentIdsForLesson(
                            lesson
                          );

                        const reportedCount =
                          getLessonReportedCount(
                            lesson,
                            reportsMap
                          );

                        const online =
                          isOnlineLesson(
                            lesson
                          );

                        const isOriginalRescheduled = lesson.isRescheduledOriginal === true;

                        if (group) {
                          const students =
                            getLessonStudents(
                              lesson
                            );

                          const allCancelled =
                            studentIds.length >
                              0 &&
                            studentIds.every(
                              studentId => {
                                const report =
                                  reportsMap.get(
                                    getReportKey(
                                      lesson.id,
                                      studentId
                                    )
                                  );

                                return (
                                  report &&
                                  report.status ===
                                    "cancelled"
                                );
                              }
                            );

                          return `
                            <div
                              class="lesson-list-item"
                              style="display:flex;flex-direction:column;gap:10px;"
                            >

                              <div
                                style="display:flex;justify-content:space-between;align-items:center;width:100%;flex-wrap:wrap;gap:8px;"
                              >

                                <div
                                  class="item-main"
                                  style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;"
                                >

                                  <span class="item-student">
                                    👥 ${
                                      lesson.groupName ||
                                      "مجموعة"
                                    }
                                  </span>

                                  <span class="item-time-type">
                                    ⏰ ${lessonTime}
                                    | 🏷️ ${lesson.type}
                                  </span>

                                  ${
                                    lesson.isRescheduled
                                      ? `
                                        <span
                                          style="color:#92400e;font-weight:700;"
                                        >
                                          📅 معاد جدولتها
                                        </span>
                                      `
                                      : ""
                                  }

                                  ${
                                    online
                                      ? `
                                        <span
                                          style="color:#15803d;font-weight:700;"
                                        >
                                          💻 أونلاين
                                        </span>
                                      `
                                      : ""
                                  }

                                  <span
                                    style="font-size:.8rem;color:var(--text-muted);"
                                  >
                                    👨‍🎓
                                    ${reportedCount}/${studentIds.length}
                                  </span>
                                </div>

                                <span
                                  class="badge ${isOriginalRescheduled ? 'rescheduled-badge' : lesson.status}"
                                  style="${
                                    allCancelled
                                      ? "background:#fee2e2;color:#991b1b;"
                                      : isOriginalRescheduled
                                      ? "background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;"
                                      : ""
                                  }"
                                >
                                  ${
                                    isOriginalRescheduled
                                      ? "🔄 معاد جدولتها"
                                      : allCancelled
                                      ? "🚫 حصة ملغاة"
                                      : isLessonFullyReported(
                                            lesson,
                                            reportsMap
                                          )
                                      ? "تم التقرير للجميع"
                                      : lesson.status ===
                                          "completed"
                                      ? "منتهية"
                                      : lesson.status ===
                                          "current"
                                      ? "جارية"
                                      : "قادمة"
                                  }
                                </span>
                              </div>

                              <div
                                style="display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap;"
                              >
                                ${
                                  !isOriginalRescheduled &&
                                  !allCancelled &&
                                  !isLessonFullyReported(
                                    lesson,
                                    reportsMap
                                  )
                                    ? `
                                      <button
                                        type="button"
                                        class="secondary-btn reschedule-lesson-btn"
                                        data-schedule-id="${lesson.id}"
                                        data-student-name=""
                                        data-group-name="${
                                          lesson.groupName ||
                                          ""
                                        }"
                                        data-is-group="true"
                                        data-original-time="${getEffectiveLessonStartTime(
                                          lesson
                                        )}"
                                        style="font-size:.78rem;padding:4px 10px;background:#fef3c7;color:#92400e;"
                                      >
                                        📅 إعادة جدولة المجموعة
                                      </button>
                                    `
                                    : ""
                                }
                              </div>

                              <div
                                style="display:flex;flex-direction:column;gap:7px;border-top:1px solid var(--border-color);padding-top:8px;"
                              >

                                ${
                                  students.length >
                                  0
                                    ? students
                                        .map(
                                          student => {
                                            const report =
                                              reportsMap.get(
                                                getReportKey(
                                                  lesson.id,
                                                  student.id
                                                )
                                              );

                                            const isCancelled =
                                              report?.status ===
                                              "cancelled";

                                            return `
                                              <div
                                                style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;border:1px solid ${
                                                  isCancelled
                                                    ? "#fecaca"
                                                    : "var(--border-color)"
                                                };border-radius:7px;flex-wrap:wrap;background:${
                                                  isCancelled
                                                    ? "#fff7f7"
                                                    : "transparent"
                                                };"
                                              >

                                                <span
                                                  style="${
                                                    isCancelled
                                                      ? "color:#991b1b;font-weight:700;"
                                                      : ""
                                                  }"
                                                >
                                                  👤 ${
                                                    student.name
                                                  }
                                                </span>

                                                <div
                                                  style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;"
                                                >

                                                  ${
                                                    isCancelled
                                                      ? `
                                                        <span
                                                          style="display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:6px;background:#fee2e2;color:#991b1b;font-size:.78rem;font-weight:800;"
                                                        >
                                                          🚫 حصة ملغاة
                                                        </span>

                                                        <button
                                                          type="button"
                                                          class="secondary-btn view-report-modal-btn"
                                                          data-report-id="${
                                                            report.id ||
                                                            ""
                                                          }"
                                                          data-student-id="${student.id}"
                                                          data-student-name="${student.name}"
                                                          style="font-size:.78rem;padding:4px 10px;background:#fee2e2;color:#991b1b;"
                                                        >
                                                          عرض الإلغاء
                                                        </button>
                                                      `
                                                      : report
                                                      ? `
                                                        <button
                                                          type="button"
                                                          class="secondary-btn view-report-modal-btn"
                                                          data-report-id="${
                                                            report.id ||
                                                            ""
                                                          }"
                                                          data-student-id="${student.id}"
                                                          data-student-name="${student.name}"
                                                          style="font-size:.78rem;padding:4px 10px;background:#dcfce7;color:#166534;"
                                                        >
                                                          📊 التقرير
                                                        </button>
                                                      `
                                                      : isOriginalRescheduled
                                                      ? `<span style="font-size:.78rem;color:#c2410c;font-weight:600;">تم نقل الموعد</span>`
                                                      : `
                                                        <button
                                                          type="button"
                                                          class="secondary-btn open-report-modal-btn"
                                                          data-schedule-id="${lesson.id}"
                                                          data-student-id="${student.id}"
                                                          data-student-name="${student.name}"
                                                          data-is-group="true"
                                                          data-group-name="${
                                                            lesson.groupName ||
                                                            ""
                                                          }"
                                                          style="font-size:.78rem;padding:4px 10px;background:#e0f2fe;color:#0369a1;display:${(lesson.status === "current" || lesson.status === "completed") ? "inline-block" : "none"};"
                                                        >
                                                          📝 تسجيل التقرير
                                                        </button>

                                                        <button
                                                          type="button"
                                                          class="secondary-btn cancel-lesson-btn"
                                                          data-schedule-id="${lesson.id}"
                                                          data-student-id="${student.id}"
                                                          data-student-name="${student.name}"
                                                          data-is-group="false"
                                                          style="font-size:.78rem;padding:4px 10px;background:#fee2e2;color:#991b1b;"
                                                        >
                                                          🚫 إلغاء الحصة
                                                        </button>
                                                      `
                                                  }

                                                </div>
                                              </div>
                                            `;
                                          }
                                        )
                                        .join("")
                                    : `
                                      <div class="no-data">
                                        لا يوجد طلاب متاحون في المجموعة.
                                      </div>
                                    `
                                }

                              </div>
                            </div>
                          `;
                        }

                        const report =
                          reportsMap.get(
                            getReportKey(
                              lesson.id,
                              lesson.studentId
                            )
                          );

                        const isReported =
                          Boolean(report);

                        const isCancelled =
                          report?.status ===
                          "cancelled";

                        return `
                          <div
                            class="lesson-list-item"
                            style="display:flex;flex-direction:column;gap:8px;${
                              isCancelled
                                ? "background:#fff7f7;border-color:#fecaca;"
                                : isOriginalRescheduled
                                ? "background:#fffcf5;border-color:#fed7aa;"
                                : ""
                            }"
                          >

                            <div
                              style="display:flex;justify-content:space-between;align-items:center;width:100%;flex-wrap:wrap;gap:8px;"
                            >

                              <div
                                class="item-main"
                                style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;"
                              >

                                <span
                                  class="item-student"
                                  style="${
                                    isCancelled
                                      ? "color:#991b1b;font-weight:700;"
                                      : isOriginalRescheduled
                                      ? "color:#c2410c;font-weight:700;"
                                      : ""
                                  }"
                                >
                                  👤 ${
                                    lesson.studentName
                                  }
                                </span>

                                <span class="item-time-type">
                                  ⏰ ${lessonTime}
                                  | 🏷️ ${lesson.type}
                                </span>

                                ${
                                  lesson.isRescheduled
                                    ? `
                                      <span
                                        style="color:#92400e;font-weight:700;"
                                      >
                                        📅 معاد جدولتها
                                      </span>
                                    `
                                    : ""
                                }

                                ${
                                  online
                                    ? `
                                      <span
                                        style="color:#15803d;font-weight:700;"
                                      >
                                        💻 أونلاين
                                      </span>
                                    `
                                    : ""
                                }

                                ${
                                  isCancelled
                                    ? `
                                      <span
                                        style="display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:6px;background:#fee2e2;color:#991b1b;font-size:.78rem;font-weight:800;"
                                      >
                                        🚫 حصة ملغاة
                                      </span>

                                      <button
                                        type="button"
                                        class="secondary-btn view-report-modal-btn"
                                        data-report-id="${
                                          report.id ||
                                          ""
                                        }"
                                        data-student-id="${lesson.studentId}"
                                        data-student-name="${lesson.studentName}"
                                        style="font-size:.78rem;padding:4px 10px;background:#fee2e2;color:#991b1b;"
                                      >
                                        عرض الإلغاء
                                      </button>
                                    `
                                    : isReported
                                    ? `
                                      <button
                                        type="button"
                                        class="secondary-btn view-report-modal-btn"
                                        data-report-id="${
                                          report.id ||
                                          ""
                                        }"
                                        data-student-id="${lesson.studentId}"
                                        data-student-name="${lesson.studentName}"
                                        style="font-size:.78rem;padding:4px 10px;background:#dcfce7;color:#166534;"
                                      >
                                        📊 التقرير
                                      </button>
                                    `
                                    : isOriginalRescheduled
                                    ? `<span style="font-size:.78rem;color:#c2410c;font-weight:600;">تم نقل الموعد</span>`
                                    : `
                                      <button
                                        type="button"
                                        class="secondary-btn open-report-modal-btn"
                                        data-schedule-id="${lesson.id}"
                                        data-student-id="${lesson.studentId}"
                                        data-student-name="${lesson.studentName}"
                                        data-is-group="false"
                                        style="font-size:.78rem;padding:4px 10px;background:#e0f2fe;color:#0369a1;display:${(lesson.status === "current" || lesson.status === "completed") ? "inline-block" : "none"};"
                                      >
                                        📝 تسجيل التقرير
                                      </button>

                                      <button
                                        type="button"
                                        class="secondary-btn cancel-lesson-btn"
                                        data-schedule-id="${lesson.id}"
                                        data-student-id="${lesson.studentId}"
                                        data-student-name="${lesson.studentName}"
                                        data-is-group="false"
                                        style="font-size:.78rem;padding:4px 10px;background:#fee2e2;color:#991b1b;"
                                      >
                                        🚫 إلغاء الحصة
                                      </button>
                                    `
                                }

                                ${
                                  !isOriginalRescheduled &&
                                  !isCancelled &&
                                  !isReported
                                    ? `
                                      <button
                                        type="button"
                                        class="secondary-btn reschedule-lesson-btn"
                                        data-schedule-id="${lesson.id}"
                                        data-student-name="${lesson.studentName}"
                                        data-group-name=""
                                        data-is-group="false"
                                        data-original-time="${getEffectiveLessonStartTime(
                                          lesson
                                        )}"
                                        style="font-size:.78rem;padding:4px 10px;background:#fef3c7;color:#92400e;"
                                      >
                                        📅 إعادة جدولة
                                      </button>
                                    `
                                    : ""
                                }

                                ${
                                  online &&
                                  !isCancelled &&
                                  !isOriginalRescheduled
                                    ? `
                                      <button
                                        type="button"
                                        class="secondary-btn open-online-whatsapp-btn"
                                        data-student-id="${lesson.studentId}"
                                        data-student-name="${lesson.studentName}"
                                        style="font-size:.78rem;padding:4px 10px;background:#22c55e;color:#fff;"
                                      >
                                        💬 واتساب
                                      </button>
                                    `
                                    : ""
                                }

                              </div>

                              <span
                                class="badge ${isOriginalRescheduled ? 'rescheduled-badge' : lesson.status}"
                                style="${
                                  isCancelled
                                    ? "background:#fee2e2;color:#991b1b;"
                                    : isOriginalRescheduled
                                    ? "background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;"
                                    : ""
                                }"
                              >
                                ${
                                  isOriginalRescheduled
                                    ? "🔄 معاد جدولتها"
                                    : isCancelled
                                    ? "🚫 حصة ملغاة"
                                    : isReported
                                    ? "تم التقرير"
                                    : lesson.status ===
                                        "completed"
                                    ? "منتهية"
                                    : lesson.status ===
                                        "current"
                                    ? "جارية"
                                    : "قادمة"
                                }
                              </span>

                            </div>
                          </div>
                        `;
                      }
                    )
                    .join("")
                : `
                  <div class="no-data">
                    لا توجد حصص اليوم.
                  </div>
                `
            }

          </div>
        </section>
      </div>

      <!-- نافذة إعادة الجدولة -->

      <div
        id="reschedule-modal"
        class="modal-overlay"
        style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1100;align-items:center;justify-content:center;padding:16px;"
      >

        <div
          class="modal-content"
          style="background:var(--card-bg,#fff);border-radius:12px;max-width:500px;width:100%;padding:24px;box-shadow:0 10px 25px rgba(0,0,0,.15);"
        >

          <div
            style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-color);padding-bottom:12px;margin-bottom:16px;"
          >

            <h3
              id="reschedule-title"
              style="margin:0;color:var(--primary-color);font-size:1.1rem;"
            >
              📅 إعادة جدولة الحصة
            </h3>

            <button
              type="button"
              id="close-reschedule-modal"
              class="close-btn"
              style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-muted);"
            >
              &times;
            </button>

          </div>

          <input
            type="hidden"
            id="reschedule-schedule-id"
          />

          <input
            type="hidden"
            id="reschedule-is-group"
          />

          <div
            style="display:flex;flex-direction:column;gap:14px;"
          >

            <div
              style="background:#f8fafc;border:1px solid var(--border-color);border-radius:8px;padding:12px;"
            >

              <div
                id="reschedule-current-info"
                style="font-weight:700;color:var(--text-main);"
              >
                الموعد الحالي:
              </div>

              <div
                style="margin-top:6px;color:var(--text-muted);font-size:.85rem;line-height:1.7;"
              >
                ℹ️ سيتم نقل هذه الحصة فقط. الموعد الأسبوعي الأصلي لن يتغير.
              </div>

            </div>

            <div
              style="display:flex;flex-direction:column;gap:6px;"
            >

              <label
                for="reschedule-date"
                style="font-weight:700;"
              >
                📅 التاريخ الجديد
              </label>

              <input
                type="date"
                id="reschedule-date"
                style="padding:9px;border:1px solid var(--border-color);border-radius:7px;width:100%;box-sizing:border-box;"
              />

            </div>

            <div
              style="display:flex;flex-direction:column;gap:6px;"
            >

              <label
                for="reschedule-time"
                style="font-weight:700;"
              >
                ⏰ الوقت الجديد
              </label>

              <input
                type="time"
                id="reschedule-time"
                style="padding:9px;border:1px solid var(--border-color);border-radius:7px;width:100%;box-sizing:border-box;"
              />

            </div>

            <div
              style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:8px;padding:10px;font-size:.85rem;line-height:1.7;"
            >
              ⚠️ لا يمكن إعادة جدولة حصة تم تسجيل تقرير لها أو تم إلغاؤها.
            </div>

            <div
              style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--border-color);padding-top:14px;"
            >

              <button
                type="button"
                id="cancel-reschedule-modal"
                class="secondary-btn"
                style="padding:8px 16px;"
              >
                إلغاء
              </button>

              <button
                type="button"
                id="confirm-reschedule-btn"
                class="primary-action-btn"
                style="padding:8px 16px;"
              >
                📅 تأكيد إعادة الجدولة
              </button>

            </div>

          </div>
        </div>
      </div>

      <!-- تقرير الحصة -->

      <div
        id="lesson-report-modal"
        class="modal-overlay"
        style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;align-items:center;justify-content:center;padding:16px;"
      >

        <div
          class="modal-content"
          style="background:var(--card-bg,#fff);border-radius:12px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto;padding:24px;box-shadow:0 10px 25px rgba(0,0,0,.15);"
        >

          <div
            class="modal-header"
            style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-color);padding-bottom:12px;margin-bottom:16px;"
          >

            <h3
              style="font-size:1.1rem;color:var(--primary-color);"
            >
              📝 تقرير إتمام الحصة:
              <span id="report-student-title"></span>
            </h3>

            <button
              type="button"
              id="close-report-modal"
              class="close-btn"
              style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-muted);"
            >
              &times;
            </button>

          </div>

          <form
            id="lesson-report-form"
            class="modal-form"
            style="display:flex;flex-direction:column;gap:16px;"
          >

            <div
              style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:10px;"
            >
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <label for="report-lesson-number" style="font-weight:700;color:#166534;">🔢 رقم الحصة:</label>
                  <input type="number" id="report-lesson-number" min="1" step="1" style="width:80px;padding:6px;border-radius:6px;border:1px solid #86efac;text-align:center;font-weight:bold;font-size:1rem;" />
                </div>
                <button type="button" id="reset-counter-btn" class="secondary-btn" style="font-size:.78rem;padding:5px 10px;background:#fee2e2;color:#991b1b;border:1px solid #fecaca;">
                  🔄 إعادة تصفير العداد إلى 1
                </button>
              </div>
              <div id="target-lesson-alert" style="display:none;color:#9a3412;font-size:.85rem;background:#fff7ed;border:1px solid #ffedd5;padding:6px 10px;border-radius:6px;font-weight:600;"></div>
            </div>

            <div
              style="background:#f8fafc;border:1px solid var(--border-color);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:10px;"
            >

              <div
                style="display:flex;justify-content:space-between;align-items:center;"
              >

                <label
                  style="font-weight:700;color:var(--text-main);"
                >
                  📖 مقاطع الحفظ الجديد (اختياري)
                </label>

                <button
                  type="button"
                  id="add-memorization-btn"
                  class="secondary-btn"
                  style="font-size:.8rem;padding:4px 10px;background:#e0f2fe;color:#0369a1;"
                >
                  + إضافة مقطع حفظ
                </button>

              </div>

              <div
                id="memorization-container"
                style="display:flex;flex-direction:column;gap:8px;"
              ></div>

            </div>

            <div
              style="background:#f8fafc;border:1px solid var(--border-color);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:10px;"
            >

              <div
                style="display:flex;justify-content:space-between;align-items:center;"
              >

                <label
                  style="font-weight:700;color:var(--text-main);"
                >
                  🔄 مقاطع المراجعة (اختياري)
                </label>

                <button
                  type="button"
                  id="add-review-btn"
                  class="secondary-btn"
                  style="font-size:.8rem;padding:4px 10px;background:#e0f2fe;color:#0369a1;"
                >
                  + إضافة مقطع مراجعة
                </button>

              </div>

              <div
                id="review-container"
                style="display:flex;flex-direction:column;gap:8px;"
              ></div>

            </div>

            <div
              class="form-group"
              style="display:flex;flex-direction:column;gap:12px;"
            >
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <label for="report-memorization-rating" style="font-weight: 700; color: var(--text-main);">
                  📖 تقييم الحفظ (من 0 إلى 10)
                </label>
                <input
                  type="number"
                  id="report-memorization-rating"
                  class="filter-input"
                  min="0"
                  max="10"
                  step="1"
                  placeholder="مثال: 9"
                  style="padding: 8px; border-radius: 6px; border: 1px solid var(--border-color);"
                />
              </div>

              <div style="display: flex; flex-direction: column; gap: 6px;">
                <label for="report-review-rating" style="font-weight: 700; color: var(--text-main);">
                  🔄 تقييم المراجعة (من 0 إلى 10)
                </label>
                <input
                  type="number"
                  id="report-review-rating"
                  class="filter-input"
                  min="0"
                  max="10"
                  step="1"
                  placeholder="مثال: 8"
                  style="padding: 8px; border-radius: 6px; border: 1px solid var(--border-color);"
                />
              </div>
            </div>

            <div
              class="form-group"
              style="display:flex;flex-direction:column;gap:6px;"
            >

              <label
                for="report-notes"
                style="font-weight:700;color:var(--text-main);"
              >
                📝 ملاحظات (اختياري)
              </label>

              <textarea
                id="report-notes"
                placeholder="أي ملاحظات أداء أو سلوك..."
                style="padding:8px;border-radius:6px;border:1px solid var(--border-color);min-height:70px;resize:vertical;"
              ></textarea>

            </div>

            <div
              class="modal-actions"
              style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--border-color);padding-top:12px;"
            >

              <button
                type="button"
                id="cancel-report-modal"
                class="secondary-btn"
                style="padding:8px 16px;"
              >
                إلغاء
              </button>

              <button
                type="submit"
                id="submit-report-btn"
                class="primary-action-btn"
                style="padding:8px 16px;"
              >
                حفظ التقرير وإتمام الحصة
              </button>

            </div>

          </form>

          <div
            id="report-success-section"
            style="display:none;flex-direction:column;gap:16px;padding-top:8px;"
          >

            <div
              style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:10px;"
            >

              <h4
                id="success-section-title"
                style="color:#166534;font-size:1rem;font-weight:700;"
              >
                ✅ تم حفظ التقرير بنجاح!
              </h4>

              <div
                id="saved-report-summary-content"
                style="font-size:.9rem;color:var(--text-main);display:flex;flex-direction:column;gap:4px;"
              ></div>

            </div>

            <div
              id="whatsapp-prompt-text"
              style="text-align:center;font-weight:700;color:var(--text-main);font-size:.95rem;"
            >
              هل تريد إرسال التقرير إلى ولي الأمر عبر واتساب؟
            </div>

            <div
              style="display:flex;justify-content:center;gap:12px;border-top:1px solid var(--border-color);padding-top:14px;"
            >

              <button
                type="button"
                id="skip-whatsapp-btn"
                class="secondary-btn"
                style="padding:8px 20px;"
              >
                تخطي
              </button>

              <button
                type="button"
                id="send-whatsapp-modal-btn"
                class="primary-action-btn"
                style="padding:8px 20px;background:#22c55e;color:#fff;"
              >
                📱 نعم، إرسال عبر واتساب
              </button>

            </div>

          </div>

        </div>
      </div>
    `;

    startCountdown(nextLesson);

    /* =======================================================
       أزرار إعادة الجدولة
       ======================================================= */

    const rescheduleButtons =
      container.querySelectorAll(
        ".reschedule-lesson-btn"
      );

    rescheduleButtons.forEach(button => {
      button.addEventListener(
        "click",
        event => {
          const btn =
            event.currentTarget;

          openRescheduleModal({
            scheduleId:
              btn.getAttribute(
                "data-schedule-id"
              ),
            studentName:
              btn.getAttribute(
                "data-student-name"
              ) || "الطالب",
            groupName:
              btn.getAttribute(
                "data-group-name"
              ) || "مجموعة",
            isGroup:
              btn.getAttribute(
                "data-is-group"
              ) === "true",
            originalTime:
              btn.getAttribute(
                "data-original-time"
              ) || ""
          });
        }
      );
    });

    const closeRescheduleButton =
      container.querySelector(
        "#close-reschedule-modal"
      );

    const cancelRescheduleButton =
      container.querySelector(
        "#cancel-reschedule-modal"
      );

    const confirmRescheduleButton =
      container.querySelector(
        "#confirm-reschedule-btn"
      );

    const rescheduleModal =
      container.querySelector(
        "#reschedule-modal"
      );

    if (closeRescheduleButton) {
      closeRescheduleButton.addEventListener(
        "click",
        closeRescheduleModal
      );
    }

    if (cancelRescheduleButton) {
      cancelRescheduleButton.addEventListener(
        "click",
        closeRescheduleModal
      );
    }

    if (confirmRescheduleButton) {
      confirmRescheduleButton.addEventListener(
        "click",
        submitReschedule
      );
    }

    if (rescheduleModal) {
      rescheduleModal.addEventListener(
        "click",
        event => {
          if (
            event.target ===
            rescheduleModal
          ) {
            closeRescheduleModal();
          }
        }
      );
    }

    /* =======================================================
       WhatsApp أونلاين
       ======================================================= */

    const onlineWhatsappButtons =
      container.querySelectorAll(
        ".open-online-whatsapp-btn"
      );

    onlineWhatsappButtons.forEach(
      button => {
        button.addEventListener(
          "click",
          event => {
            const studentId =
              event.currentTarget.getAttribute(
                "data-student-id"
              );

            const studentName =
              event.currentTarget.getAttribute(
                "data-student-name"
              ) || "الطالب";

            if (!studentId) {
              alert(
                "تعذر تحديد الطالب."
              );
              return;
            }

            const student =
              allStudents.find(
                item =>
                  item.id ===
                  studentId
              );

            openStudentWhatsApp(
              student?.parentPhone ||
                "",
              studentName
            );
          }
        );
      }
    );

    /* =======================================================
       إلغاء الحصة
       ======================================================= */

    const cancelLessonButtons =
      container.querySelectorAll(
        ".cancel-lesson-btn"
      );

    cancelLessonButtons.forEach(
      button => {
        button.addEventListener(
          "click",
          async event => {
            const btn =
              event.currentTarget;

            await cancelLessonForStudent({
              scheduleId:
                btn.getAttribute(
                  "data-schedule-id"
                ),
              studentId:
                btn.getAttribute(
                  "data-student-id"
                ),
              studentName:
                btn.getAttribute(
                  "data-student-name"
                ) || "الطالب",
              isGroup:
                btn.getAttribute(
                  "data-is-group"
                ) === "true",
              groupId:
                btn.getAttribute(
                  "data-group-id"
                ) || null,
              groupName:
                btn.getAttribute(
                  "data-group-name"
                ) || ""
            });
          }
        );
      }
    );

    /* =======================================================
       Report Modal
       ======================================================= */

    const openReportButtons =
      container.querySelectorAll(
        ".open-report-modal-btn"
      );

    const viewReportButtons =
      container.querySelectorAll(
        ".view-report-modal-btn"
      );

    const reportModal =
      container.querySelector(
        "#lesson-report-modal"
      );

    const closeReportBtn =
      container.querySelector(
        "#close-report-modal"
      );

    const cancelReportBtn =
      container.querySelector(
        "#cancel-report-modal"
      );

    const reportForm =
      container.querySelector(
        "#lesson-report-form"
      );

    const successSection =
      container.querySelector(
        "#report-success-section"
      );

    const successSectionTitle =
      container.querySelector(
        "#success-section-title"
      );

    const savedSummaryContent =
      container.querySelector(
        "#saved-report-summary-content"
      );

    const whatsappPromptText =
      container.querySelector(
        "#whatsapp-prompt-text"
      );

    const sendWhatsappModalBtn =
      container.querySelector(
        "#send-whatsapp-modal-btn"
      );

    const skipWhatsappBtn =
      container.querySelector(
        "#skip-whatsapp-btn"
      );

    const reportStudentTitle =
      container.querySelector(
        "#report-student-title"
      );

    const addMemBtn =
      container.querySelector(
        "#add-memorization-btn"
      );

    const addRevBtn =
      container.querySelector(
        "#add-review-btn"
      );

    const memContainer =
      container.querySelector(
        "#memorization-container"
      );

    const revContainer =
      container.querySelector(
        "#review-container"
      );

    const lessonNumberInput =
      container.querySelector(
        "#report-lesson-number"
      );

    const resetCounterBtn =
      container.querySelector(
        "#reset-counter-btn"
      );

    const targetLessonAlert =
      container.querySelector(
        "#target-lesson-alert"
      );

    if (!reportModal) {
      return;
    }

    let activeScheduleId = null;
    let activeStudentId = null;
    let activeStudentPhone = "";
    let activeIsGroup = false;
    let activeGroupId = null;
    let activeGroupName = "";
    let lastSavedReportData = null;

    if (resetCounterBtn) {
      resetCounterBtn.addEventListener("click", async () => {
        if (!activeStudentId) return;
        const confirmed = confirm("هل أنت متأكد من إعادة تصفير عداد الحصص لهذا الطالب ليبدأ من الرقم 1؟\n\n(لن يتم حذف التقارير السابقة).");
        if (!confirmed) return;

        const res = await studentService.resetStudentLessonCounter(activeStudentId);
        if (res.success) {
          const nextNum = await reportService.getStudentNextLessonNumber(activeStudentId);
          if (lessonNumberInput) lessonNumberInput.value = nextNum;
          if (targetLessonAlert) targetLessonAlert.style.display = "none";
          alert("✅ تم تصفير عداد الحصص بنجاح. الحصة القادمة برقم 1.");
        } else {
          alert("تعذر تصفير العداد: " + (res.error || "يرجى المحاولة لاحقاً."));
        }
      });
    }

    openReportButtons.forEach(
      button => {
        button.addEventListener(
          "click",
          async event => {
            const btn =
              event.currentTarget;

            const scheduleId =
              btn.getAttribute(
                "data-schedule-id"
              );

            const studentId =
              btn.getAttribute(
                "data-student-id"
              );

            const studentName =
              btn.getAttribute(
                "data-student-name"
              );

            const isGroup =
              btn.getAttribute(
                "data-is-group"
              ) === "true";

            const groupName =
              btn.getAttribute(
                "data-group-name"
              ) || "";

            if (
              !scheduleId ||
              !studentId
            ) {
              alert(
                "تعذر تحديد الطالب والموعد."
              );
              return;
            }

            activeScheduleId =
              scheduleId;

            activeStudentId =
              studentId;

            activeIsGroup =
              isGroup;

            activeGroupId =
              isGroup
                ? scheduleId
                : null;

            activeGroupName =
              groupName;

            const studentsRes =
              await studentService.getSheikhStudents();

            const studentsList =
              studentsRes.success
                ? studentsRes.data || []
                : [];

            const studentObj =
              studentsList.find(
                student =>
                  student.id ===
                  studentId
              );

            activeStudentPhone =
              studentObj
                ? studentObj.parentPhone ||
                  ""
                : "";

            const todayDateStr =
              reportService.getTodayCairoDate();

            const alreadyReported =
              await reportService.hasReportForSchedule(
                scheduleId,
                todayDateStr,
                studentId
              );

            if (alreadyReported) {
              alert(
                "عذرًا، تم تسجيل تقرير لهذا الطالب في هذه الحصة اليوم مسبقًا."
              );
              return;
            }

            reportStudentTitle.textContent =
              isGroup &&
              groupName
                ? `${studentName} — ${groupName}`
                : studentName;

            memContainer.innerHTML =
              "";

            revContainer.innerHTML =
              "";

            reportForm.reset();

            const nextNum = await reportService.getStudentNextLessonNumber(studentId);
            if (lessonNumberInput) lessonNumberInput.value = nextNum;

            if (studentObj && studentObj.targetLessonsCount) {
              const target = Number(studentObj.targetLessonsCount);
              if (target > 0 && nextNum >= target) {
                targetLessonAlert.textContent = `⚠️ تنبيه: وصل الطالب إلى الحصة رقم ${nextNum}، وهو العدد المستهدف شهرياً (${target} حصص).`;
                targetLessonAlert.style.display = "block";
              } else {
                targetLessonAlert.style.display = "none";
              }
            } else {
              targetLessonAlert.style.display = "none";
            }

            reportForm.style.display =
              "flex";

            successSection.style.display =
              "none";

            if (whatsappPromptText) {
              whatsappPromptText.style.display =
                "block";
            }

            if (sendWhatsappModalBtn) {
              sendWhatsappModalBtn.style.display =
                "inline-block";
            }

            if (skipWhatsappBtn) {
              skipWhatsappBtn.textContent =
                "تخطي";
            }

            if (successSectionTitle) {
              successSectionTitle.textContent =
                "✅ تم حفظ التقرير بنجاح!";
            }

            lastSavedReportData =
              null;

            reportModal.style.display =
              "flex";
          }
        );
      }
    );

    viewReportButtons.forEach(
      button => {
        button.addEventListener(
          "click",
          async event => {
            const btn =
              event.currentTarget;

            const reportId =
              btn.getAttribute(
                "data-report-id"
              );

            const studentId =
              btn.getAttribute(
                "data-student-id"
              );

            const studentName =
              btn.getAttribute(
                "data-student-name"
              );

            if (!reportId) {
              alert(
                "تعذر تحديد التقرير المسجل."
              );
              return;
            }

            activeStudentId =
              studentId;

            activeScheduleId =
              null;

            activeIsGroup =
              false;

            activeGroupId =
              null;

            activeGroupName =
              "";

            const studentsRes =
              await studentService.getSheikhStudents();

            const studentsList =
              studentsRes.success
                ? studentsRes.data || []
                : [];

            const studentObj =
              studentsList.find(
                student =>
                  student.id ===
                  studentId
              );

            activeStudentPhone =
              studentObj
                ? studentObj.parentPhone ||
                  ""
                : "";

            const todayReportsResult =
              await reportService.getTodayReports();

            const todayReports =
              Array.isArray(
                todayReportsResult
              )
                ? todayReportsResult
                : (
                    todayReportsResult?.success &&
                    Array.isArray(
                      todayReportsResult.data
                    )
                      ? todayReportsResult.data
                      : []
                  );

            let reportObj =
              todayReports.find(
                report =>
                  report.id ===
                  reportId
              );

            if (!reportObj) {
              reportObj =
                Array.from(
                  localReportOverrides.values()
                ).find(
                  report =>
                    report.id ===
                      reportId ||
                    (
                      report.studentId ===
                        studentId &&
                      report.status ===
                        "cancelled"
                    )
                );
            }

            if (!reportObj) {
              const studentReports = await reportService.getStudentReports(studentId);
              reportObj = studentReports.find(r => r.id === reportId);
            }

            if (!reportObj) {
              alert(
                "تعذر تحميل تفاصيل التقرير."
              );
              return;
            }

            lastSavedReportData =
              reportObj;

            reportStudentTitle.textContent =
              studentName ||
              (
                studentObj
                  ? studentObj.name
                  : "الطالب"
              );

            reportForm.style.display =
              "none";

            if (
              reportObj.status ===
              "cancelled"
            ) {
              const cancellationReason =
                reportObj.cancellationReason ||
                reportObj.notes ||
                "لم يتم تحديد سبب الإلغاء.";

              savedSummaryContent.innerHTML = `
                <p>
                  📅 <strong>التاريخ:</strong>
                  ${reportObj.date || ""}
                </p>

                <div
                  style="margin-top:8px;padding:16px;border-radius:10px;background:#fee2e2;border:1px solid #fecaca;color:#991b1b;text-align:center;"
                >

                  <div
                    style="font-size:34px;margin-bottom:8px;"
                  >
                    🚫
                  </div>

                  <div
                    style="font-size:20px;font-weight:800;margin-bottom:8px;"
                  >
                    تم إلغاء هذه الحصة
                  </div>

                  <div
                    style="font-size:14px;line-height:1.8;"
                  >
                    <strong>سبب الإلغاء:</strong>
                    ${cancellationReason}
                  </div>

                </div>
              `;

              if (successSectionTitle) {
                successSectionTitle.textContent =
                  "🚫 تفاصيل إلغاء الحصة";
              }

              if (whatsappPromptText) {
                whatsappPromptText.style.display =
                  "none";
              }

              if (sendWhatsappModalBtn) {
                sendWhatsappModalBtn.style.display =
                  "none";
              }

              if (skipWhatsappBtn) {
                skipWhatsappBtn.textContent =
                  "إغلاق";
              }

              successSection.style.display =
                "flex";

              reportModal.style.display =
                "flex";

              return;
            }

            const memText =
              reportObj.memorization &&
              reportObj.memorization.length >
                0
                ? reportObj.memorization
                    .map(
                      item =>
                        `سورة ${item.surah} (من آية ${item.fromAyah} إلى آية ${item.toAyah})`
                    )
                    .join("<br>")
                : "لا يوجد";

            const revText =
              reportObj.review &&
              reportObj.review.length >
                0
                ? reportObj.review
                    .map(
                      item =>
                        `سورة ${item.surah} (من آية ${item.fromAyah} إلى آية ${item.toAyah})`
                    )
                    .join("<br>")
                : "لا يوجد";

            let ratingHtml = "";
            if (
              reportObj.memorizationRating !== null &&
              reportObj.memorizationRating !== undefined &&
              reportObj.memorizationRating !== ""
            ) {
              ratingHtml += `<p>📖 <strong>تقييم الحفظ:</strong> ${reportObj.memorizationRating} من 10</p>`;
            } else {
              ratingHtml += `<p>📖 <strong>تقييم الحفظ:</strong> بدون تقييم</p>`;
            }

            if (
              reportObj.reviewRating !== null &&
              reportObj.reviewRating !== undefined &&
              reportObj.reviewRating !== ""
            ) {
              ratingHtml += `<p>🔄 <strong>تقييم المراجعة:</strong> ${reportObj.reviewRating} من 10</p>`;
            } else {
              ratingHtml += `<p>🔄 <strong>تقييم المراجعة:</strong> بدون تقييم</p>`;
            }

            const lessonNumSummary = reportObj.lessonNumber ? `<p>🔢 <strong>رقم الحصة:</strong> ${reportObj.lessonNumber}</p>` : "";
            const notesText =
              reportObj.notes ||
              "لا توجد ملاحظات";

            savedSummaryContent.innerHTML = `
              <p>
                📅 <strong>التاريخ:</strong>
                ${reportObj.date || ""}
              </p>

              ${lessonNumSummary}

              <p>
                📖 <strong>الحفظ الجديد:</strong>
                ${memText}
              </p>

              <p>
                🔄 <strong>المراجعة:</strong>
                ${revText}
              </p>

              ${ratingHtml}

              <p>
                📝 <strong>الملاحظات:</strong>
                ${notesText}
              </p>
            `;

            if (successSectionTitle) {
              successSectionTitle.textContent =
                "📊 تفاصيل التقرير المسجل";
            }

            if (whatsappPromptText) {
              whatsappPromptText.style.display =
                "none";
            }

            if (sendWhatsappModalBtn) {
              sendWhatsappModalBtn.style.display =
                "none";
            }

            if (skipWhatsappBtn) {
              skipWhatsappBtn.textContent =
                "إغلاق";
            }

            successSection.style.display =
              "flex";

            reportModal.style.display =
              "flex";
          }
        );
      }
    );

    const closeReportModal =
      async () => {
        reportModal.style.display =
          "none";

        activeScheduleId = null;
        activeStudentId = null;
        activeStudentPhone = "";
        activeIsGroup = false;
        activeGroupId = null;
        activeGroupName = "";
        lastSavedReportData = null;

        await refreshDashboard(false);
      };

    if (closeReportBtn) {
      closeReportBtn.addEventListener(
        "click",
        closeReportModal
      );
    }

    if (cancelReportBtn) {
      cancelReportBtn.addEventListener(
        "click",
        closeReportModal
      );
    }

    reportModal.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          reportModal
        ) {
          closeReportModal();
        }
      }
    );

    /* =======================================================
       سور القرآن
       ======================================================= */

    const getSurahOptionsHTML =
      () => {
        return QURAN_SURAHS.map(
          surah =>
            `<option value="${surah.name}" data-ayahs="${surah.ayahs}">${surah.name} (${surah.ayahs} آية)</option>`
        ).join("");
      };

    const addSegmentRow =
      targetContainer => {
        const rowDiv =
          document.createElement(
            "div"
          );

        rowDiv.className =
          "segment-row";

        rowDiv.style.cssText = `
          display:flex;
          gap:8px;
          align-items:center;
          background:#fff;
          padding:8px;
          border-radius:6px;
          border:1px solid var(--border-color);
          flex-wrap:wrap;
        `;

        rowDiv.innerHTML = `
          <select
            class="filter-select surah-select"
            style="flex:2;min-width:130px;padding:6px;border-radius:4px;border:1px solid var(--border-color);"
          >
            <option value="">
              -- اختر السورة --
            </option>

            ${getSurahOptionsHTML()}
          </select>

          <div
            style="display:flex;align-items:center;gap:4px;flex:1;min-width:90px;"
          >
            <span
              style="font-size:.8rem;color:var(--text-muted);"
            >
              من:
            </span>

            <input
              type="number"
              class="from-ayah-input"
              min="1"
              value="1"
              style="width:100%;padding:6px;border-radius:4px;border:1px solid var(--border-color);"
            />
          </div>

          <div
            style="display:flex;align-items:center;gap:4px;flex:1;min-width:90px;"
          >
            <span
              style="font-size:.8rem;color:var(--text-muted);"
            >
              إلى:
            </span>

            <input
              type="number"
              class="to-ayah-input"
              min="1"
              value="1"
              style="width:100%;padding:6px;border-radius:4px;border:1px solid var(--border-color);"
            />
          </div>

          <button
            type="button"
            class="secondary-btn remove-row-btn"
            style="background:#fee2e2;color:#991b1b;padding:6px 10px;font-size:.8rem;"
          >
            🗑️
          </button>
        `;

        const surahSelect =
          rowDiv.querySelector(
            ".surah-select"
          );

        const fromInput =
          rowDiv.querySelector(
            ".from-ayah-input"
          );

        const toInput =
          rowDiv.querySelector(
            ".to-ayah-input"
          );

        const removeBtn =
          rowDiv.querySelector(
            ".remove-row-btn"
          );

        surahSelect.addEventListener(
          "change",
          event => {
            const selectedOption =
              event.target.options[
                event.target
                  .selectedIndex
              ];

            const maxAyahs =
              Number(
                selectedOption.getAttribute(
                  "data-ayahs"
                )
              ) || 1;

            fromInput.max =
              maxAyahs;

            toInput.max =
              maxAyahs;

            toInput.value =
              Math.min(
                Number(
                  toInput.value
                ) || 1,
                maxAyahs
              );
          }
        );

        removeBtn.addEventListener(
          "click",
          () => rowDiv.remove()
        );

        targetContainer.appendChild(
          rowDiv
        );
      };

    if (addMemBtn) {
      addMemBtn.addEventListener(
        "click",
        () =>
          addSegmentRow(
            memContainer
          )
      );
    }

    if (addRevBtn) {
      addRevBtn.addEventListener(
        "click",
        () =>
          addSegmentRow(
            revContainer
          )
      );
    }

    const validateSegments = (
      rows,
      sectionName
    ) => {
      const list = [];

      for (const row of rows) {
        const surah =
          row.querySelector(
            ".surah-select"
          ).value;

        const fromAyahVal =
          row.querySelector(
            ".from-ayah-input"
          ).value;

        const toAyahVal =
          row.querySelector(
            ".to-ayah-input"
          ).value;

        if (!surah) {
          alert(
            `يرجى اختيار السورة في مقاطع ${sectionName}.`
          );

          return null;
        }

        const fromAyah =
          Number(fromAyahVal);

        const toAyah =
          Number(toAyahVal);

        if (fromAyah > toAyah) {
          alert(
            `رقم آية البداية يجب ألا يتجاوز آية النهاية في ${sectionName}.`
          );

          return null;
        }

        list.push({
          surah,
          fromAyah,
          toAyah
        });
      }

      return list;
    };

    /* =======================================================
       حفظ التقرير
       ======================================================= */

    reportForm.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        if (
          !activeScheduleId ||
          !activeStudentId
        ) {
          alert(
            "تعذر تحديد الطالب أو الموعد."
          );

          return;
        }

        const memRows =
          memContainer.querySelectorAll(
            ".segment-row"
          );

        const revRows =
          revContainer.querySelectorAll(
            ".segment-row"
          );

        const memorizationList =
          validateSegments(
            memRows,
            "الحفظ الجديد"
          );

        if (
          memorizationList ===
          null
        ) {
          return;
        }

        const reviewList =
          validateSegments(
            revRows,
            "المراجعة"
          );

        if (
          reviewList ===
          null
        ) {
          return;
        }

        const memRatingInput = container.querySelector("#report-memorization-rating").value;
        const revRatingInput = container.querySelector("#report-review-rating").value;
        const lessonNumInputVal = lessonNumberInput ? lessonNumberInput.value : "";

        let lessonNumber = lessonNumInputVal !== "" ? Number(lessonNumInputVal) : null;
        if (lessonNumber !== null && (!Number.isInteger(lessonNumber) || lessonNumber < 1)) {
          alert("رقم الحصة يجب أن يكون رقماً صحيحاً موجباً.");
          return;
        }

        let memorizationRating = null;
        if (memRatingInput !== undefined && memRatingInput !== null && memRatingInput !== "") {
          const parsedMem = Number(memRatingInput);
          if (Number.isInteger(parsedMem) && parsedMem >= 0 && parsedMem <= 10) {
            memorizationRating = parsedMem;
          } else {
            alert("تقييم الحفظ يجب أن يكون رقماً صحيحاً من 0 إلى 10.");
            return;
          }
        }

        let reviewRating = null;
        if (revRatingInput !== undefined && revRatingInput !== null && revRatingInput !== "") {
          const parsedRev = Number(revRatingInput);
          if (Number.isInteger(parsedRev) && parsedRev >= 0 && parsedRev <= 10) {
            reviewRating = parsedRev;
          } else {
            alert("تقييم المراجعة يجب أن يكون رقماً صحيحاً من 0 إلى 10.");
            return;
          }
        }

        const notes =
          container.querySelector(
            "#report-notes"
          ).value;

        const todayDateStr =
          reportService.getTodayCairoDate();

        const reportPayload = {
          studentId:
            activeStudentId,

          scheduleId:
            activeScheduleId,

          date:
            todayDateStr,

          memorization:
            memorizationList,

          review:
            reviewList,

          memorizationRating,
          reviewRating,

          lessonNumber,

          notes,

          isGroup:
            activeIsGroup,

          groupId:
            activeIsGroup
              ? activeGroupId
              : null,

          groupName:
            activeIsGroup
              ? activeGroupName
              : null
        };

        const submitButton =
          container.querySelector(
            "#submit-report-btn"
          );

        if (submitButton) {
          submitButton.disabled =
            true;

          submitButton.textContent =
            "جاري حفظ التقرير...";
        }

        try {
          const result =
            await reportService.addLessonReport(
              reportPayload
            );

          if (result.success) {
            lastSavedReportData = {
              ...reportPayload,
              id: result.id || result.reportId,
              lessonNumber: result.report?.lessonNumber || lessonNumber
            };

            localReportOverrides.set(
              getReportKey(
                activeScheduleId,
                activeStudentId
              ),
              lastSavedReportData
            );

            const memText =
              memorizationList.length >
              0
                ? memorizationList
                    .map(
                      item =>
                        `سورة ${item.surah} (من آية ${item.fromAyah} إلى آية ${item.toAyah})`
                    )
                    .join("<br>")
                : "لا يوجد";

            const revText =
              reviewList.length >
              0
                ? reviewList
                    .map(
                      item =>
                        `سورة ${item.surah} (من آية ${item.fromAyah} إلى آية ${item.toAyah})`
                    )
                    .join("<br>")
                : "لا يوجد";

            let ratingHtml = "";
            if (memorizationRating !== null && memorizationRating !== undefined) {
              ratingHtml += `<p>📖 <strong>تقييم الحفظ:</strong> ${memorizationRating} من 10</p>`;
            } else {
              ratingHtml += `<p>📖 <strong>تقييم الحفظ:</strong> بدون تقييم</p>`;
            }

            if (reviewRating !== null && reviewRating !== undefined) {
              ratingHtml += `<p>🔄 <strong>تقييم المراجعة:</strong> ${reviewRating} من 10</p>`;
            } else {
              ratingHtml += `<p>🔄 <strong>تقييم المراجعة:</strong> بدون تقييم</p>`;
            }

            const savedLessonNum = lastSavedReportData.lessonNumber;
            const lessonNumHtml = savedLessonNum ? `<p>🔢 <strong>رقم الحصة:</strong> ${savedLessonNum}</p>` : "";
            const notesText =
              notes ||
              "لا توجد ملاحظات";

            savedSummaryContent.innerHTML = `
              <p>
                👤 <strong>الطالب:</strong>
                ${reportStudentTitle.textContent}
              </p>

              ${lessonNumHtml}

              <p>
                📖 <strong>الحفظ الجديد:</strong>
                ${memText}
              </p>

              <p>
                🔄 <strong>المراجعة:</strong>
                ${revText}
              </p>

              ${ratingHtml}

              <p>
                📝 <strong>الملاحظات:</strong>
                ${notesText}
              </p>
            `;

            if (successSectionTitle) {
              successSectionTitle.textContent =
                "✅ تم حفظ التقرير بنجاح!";
            }

            if (whatsappPromptText) {
              whatsappPromptText.style.display =
                "block";
            }

            if (sendWhatsappModalBtn) {
              sendWhatsappModalBtn.style.display =
                "inline-block";
            }

            if (skipWhatsappBtn) {
              skipWhatsappBtn.textContent =
                "تخطي";
            }

            reportForm.style.display =
              "none";

            successSection.style.display =
              "flex";
          } else {
            alert(
              "حدث خطأ أثناء حفظ التقرير: " +
                (
                  result.error ||
                  "يرجى المحاولة لاحقًا."
                )
            );
          }
        } catch (error) {
          console.error(
            "Error saving lesson report:",
            error
          );

          alert(
            "حدث خطأ أثناء حفظ التقرير: " +
              (
                error?.message ||
                "يرجى المحاولة لاحقًا."
              )
          );
        } finally {
          if (submitButton) {
            submitButton.disabled =
              false;

            submitButton.textContent =
              "حفظ التقرير وإتمام الحصة";
          }
        }
      }
    );

    /* =======================================================
       WhatsApp التقرير
       ======================================================= */

    if (sendWhatsappModalBtn) {
      sendWhatsappModalBtn.addEventListener(
        "click",
        () => {
          const whatsappPhone =
            normalizeEgyptianPhone(
              activeStudentPhone
            );

          if (!whatsappPhone) {
            alert(
              "تنبيه: لا يوجد رقم ولي أمر مسجل لهذا الطالب."
            );

            return;
          }

          if (!lastSavedReportData) {
            alert(
              "تعذر العثور على بيانات التقرير المحفوظ."
            );

            return;
          }

          const memText =
            lastSavedReportData.memorization &&
            lastSavedReportData
              .memorization.length > 0
              ? lastSavedReportData
                  .memorization
                  .map(
                    item =>
                      `سورة ${item.surah} (من آية ${item.fromAyah} إلى آية ${item.toAyah})`
                  )
                  .join("، ")
              : "لا يوجد";

          const revText =
            lastSavedReportData.review &&
            lastSavedReportData
              .review.length > 0
              ? lastSavedReportData
                  .review
                  .map(
                    item =>
                      `سورة ${item.surah} (من آية ${item.fromAyah} إلى آية ${item.toAyah})`
                  )
                  .join("، ")
              : "لا يوجد";

          let ratingMsg = "";
          if (
            lastSavedReportData.memorizationRating !== null &&
            lastSavedReportData.memorizationRating !== undefined
          ) {
            ratingMsg += `📖 تقييم الحفظ: ${lastSavedReportData.memorizationRating} من 10\n`;
          }
          if (
            lastSavedReportData.reviewRating !== null &&
            lastSavedReportData.reviewRating !== undefined
          ) {
            ratingMsg += `🔄 تقييم المراجعة: ${lastSavedReportData.reviewRating} من 10\n`;
          }

          const lessonNumMsg = lastSavedReportData.lessonNumber ? `🔢 رقم الحصة: ${lastSavedReportData.lessonNumber}\n` : "";
          const notesText =
            lastSavedReportData.notes ||
            "لا توجد ملاحظات";

          const dateStr =
            lastSavedReportData.date ||
            "اليوم";

          const studentName =
            reportStudentTitle
              ? reportStudentTitle.textContent
              : "الطالب";

          const message =
            `السلام عليكم، تقرير متابعة الحصة القرآنية للطالب (${studentName}) بتاريخ ${dateStr}:\n\n` +
            lessonNumMsg +
            `📖 الحفظ الجديد: ${memText}\n` +
            `🔄 المراجعة: ${revText}\n` +
            ratingMsg +
            `📝 ملاحظات المحفظ: ${notesText}\n\n` +
            `مع تمنياتنا دوام التوفيق والنجاح.`;

          const whatsappUrl =
            `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
              message
            )}`;

          window.open(
            whatsappUrl,
            "_blank",
            "noopener,noreferrer"
          );

          closeReportModal();
        }
      );
    }

    if (skipWhatsappBtn) {
      skipWhatsappBtn.addEventListener(
        "click",
        closeReportModal
      );
    }
  };

  await refreshDashboard(true);

  dashboardInterval =
    setInterval(
      async () => {
        const activeTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab');
        if (activeTab && activeTab !== "dashboard") {
          clearInterval(dashboardInterval);
          dashboardInterval = null;
          if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
          }
          return;
        }

        if (
          !container ||
          !container.isConnected
        ) {
          clearInterval(
            dashboardInterval
          );

          dashboardInterval =
            null;

          if (countdownInterval) {
            countdownInterval =
              null;
          }

          return;
        }

        await refreshDashboard(false);
      },
      60000
    );
}
