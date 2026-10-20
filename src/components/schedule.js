/**
 * Schedule Component
 * مكون واجهة تبويب المواعيد مع الجدول الأسبوعي،
 * المواعيد الفردية والمجموعات،
 * فلترة الطلاب والبحث الذكي
 *
 * يدعم:
 * - المواعيد الفردية
 * - المواعيد الجماعية
 * - الحصص الحضورية
 * - الحصص الأونلاين
 * - التوقيت الثابت
 * - التوقيت المرتبط بالصلاة
 * - إعادة جدولة حصة واحدة بشكل مؤقت
 * - تعديل الموعد المؤقت
 * - حذف الموعد المؤقت
 * - إعدادات التوقيت المستقلة لكل يوم عبر dayConfigs
 */

import { scheduleService } from '../services/scheduleData.js';
import { studentService } from '../services/studentService.js';
import { rescheduleService } from '../services/rescheduleService.js';
import { prayerService } from '../services/prayerService.js';

export async function initScheduleModule(container) {
  if (!container) return;
  await renderScheduleView(container);
}

const daysColumns = [
  { id: 6, name: 'السبت' },
  { id: 0, name: 'الأحد' },
  { id: 1, name: 'الإثنين' },
  { id: 2, name: 'الثلاثاء' },
  { id: 3, name: 'الأربعاء' },
  { id: 4, name: 'الخميس' },
  { id: 5, name: 'الجمعة' }
];

const prayerNames = {
  fajr: 'الفجر',
  sunrise: 'الشروق',
  dhuhr: 'الظهر',
  asr: 'العصر',
  maghrib: 'المغرب',
  isha: 'العشاء'
};

function normalizeArabicText(text) {
  if (
    text === null ||
    text === undefined
  ) {
    return '';
  }

  let str =
    String(text).toLowerCase();

  str = str.replace(
    /[\u064b-\u0652]/g,
    ''
  );

  str = str.replace(
    /[أإآٱ]/g,
    'ا'
  );

  str = str.replace(
    /ى/g,
    'ي'
  );

  str = str.replace(
    /ـ/g,
    ''
  );

  str = str.replace(
    /\s+/g,
    ' '
  ).trim();

  return str;
}

function getScheduleKind(schedule) {
  return schedule?.scheduleKind === 'group'
    ? 'group'
    : 'individual';
}

function getLessonMode(schedule) {
  return schedule?.lessonMode === 'online'
    ? 'online'
    : 'in_person';
}

function getLessonModeLabel(schedule) {
  return getLessonMode(schedule) === 'online'
    ? '💻 أونلاين'
    : '🏠 حضوري';
}

function formatDateForDisplay(dateString) {
  if (!dateString) {
    return '';
  }

  const date =
    new Date(
      `${dateString}T12:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return dateString;
  }

  return new Intl.DateTimeFormat(
    'ar-EG',
    {
      weekday: 'long',
      day: 'numeric',
      month: 'numeric'
    }
  ).format(date);
}

function normalizeTime(time) {
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
}

function timeToMinutes(time) {
  const normalized = normalizeTime(time);

  if (!normalized) {
    return null;
  }

  const [hours, minutes] =
    normalized.split(":").map(Number);

  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
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
}

function getDayConfigForDisplay(schedule, dayId) {
  if (schedule?.dayConfigs && schedule.dayConfigs[String(dayId)]) {
    return schedule.dayConfigs[String(dayId)];
  }
  return {
    timeType: schedule?.timeType || 'fixed',
    startTime: schedule?.startTime || '',
    endTime: schedule?.endTime || '',
    prayerName: schedule?.prayerName || schedule?.prayer || '',
    offsetMinutes: Number(schedule?.offsetMinutes) || 0
  };
}

function calculateLessonEffectiveStartMinutesForDay(schedule, prayerTimings, dayId) {
  if (!schedule) {
    return 9999;
  }

  if (schedule.isRescheduled) {
    const t = schedule.newStartTime || schedule.startTime;
    const mins = timeToMinutes(t);
    return mins !== null ? mins : 9999;
  }

  const config = getDayConfigForDisplay(schedule, dayId);

  if (config.timeType !== 'prayer') {
    const mins = timeToMinutes(config.startTime);
    return mins !== null ? mins : 9999;
  }

  const prayerName = config.prayerName || "";
  const prayerTime = prayerTimings?.[prayerName];
  const prayerMinutes = timeToMinutes(prayerTime);

  if (prayerMinutes === null) {
    return 9999;
  }

  const offset = Number(config.offsetMinutes) || 0;
  return prayerMinutes + offset;
}

async function loadScheduleData() {
  const [
    studentsRes,
    schedulesRes,
    todaySchedules,
    rescheduledRes,
    prayerRes
  ] = await Promise.all([
    studentService.getSheikhStudents(),
    scheduleService.getSchedules(),
    scheduleService.getTodaySchedules(),
    scheduleService.getCurrentWeekRescheduledLessons(),
    prayerService.getTodayPrayerTimes()
  ]);

  return {
    students:
      studentsRes.success
        ? (studentsRes.data || [])
        : [],

    schedules:
      schedulesRes.success
        ? (schedulesRes.data || [])
        : [],

    todaySchedules:
      Array.isArray(todaySchedules)
        ? todaySchedules
        : [],

    rescheduledLessons:
      rescheduledRes.success &&
      Array.isArray(
        rescheduledRes.data
      )
        ? rescheduledRes.data
        : [],

    prayerTimings:
      prayerRes && prayerRes.success
        ? prayerRes.timings
        : {}
  };
}

async function renderScheduleView(container) {
  const {
    students,
    schedules,
    todaySchedules,
    rescheduledLessons,
    prayerTimings
  } =
    await loadScheduleData();

  const formattedDate =
    scheduleService.getFormattedArabicDate();

  const todayDateStr = rescheduleService.getTodayCairoDate ? rescheduleService.getTodayCairoDate() : new Date().toISOString().slice(0, 10);
  const nowForWeek = new Date(`${todayDateStr}T12:00:00`);
  const currentDayIndex = nowForWeek.getDay();
  const diffToSat = (currentDayIndex + 1) % 7;
  const weekStartDate = new Date(nowForWeek);
  weekStartDate.setDate(nowForWeek.getDate() - diffToSat);

  const weekPrayerTimingsMap = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartDate);
    d.setDate(weekStartDate.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getDay();
    if (dateStr === todayDateStr) {
      weekPrayerTimingsMap[dayOfWeek] = prayerTimings;
    } else {
      const pRes = await prayerService.getPrayerTimesForDate(dateStr);
      weekPrayerTimingsMap[dayOfWeek] = (pRes && pRes.success) ? pRes.timings : prayerTimings;
    }
  }

  const todaySchedulesMap =
    new Map();

  todaySchedules.forEach(
    schedule => {
      if (
        schedule &&
        schedule.id
      ) {
        todaySchedulesMap.set(
          schedule.id,
          schedule
        );
      }
    }
  );

  const activeRescheduledLessons =
    rescheduledLessons.filter(
      lesson =>
        lesson &&
        lesson.showTemporary === true
    );

  container.innerHTML = `
    <div class="students-container">

      <div class="students-header-card">

        <div class="students-title-area">
          <h2>جدول المواعيد الأسبوعي 📅</h2>
          <p>📅 ${formattedDate}</p>
        </div>

        <div
          style="
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            justify-content: flex-end;
          "
        >

          <button
            type="button"
            id="open-add-individual-schedule-modal"
            class="primary-action-btn"
          >
            + إضافة موعد فردي
          </button>

          <button
            type="button"
            id="open-add-group-schedule-modal"
            class="primary-action-btn"
          >
            👥 إضافة مجموعة
          </button>

        </div>

      </div>

      <div style="width: 100%;">

        <div
          class="weekly-grid-vertical"
          style="
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 10px;
            width: 100%;
          "
        >

          ${daysColumns.map(day => {

            const recurringDaySchedules =
              schedules
                .filter(
                  schedule =>
                    (
                      schedule.daysOfWeek || []
                    ).includes(day.id)
                );

            const temporaryDaySchedules =
              activeRescheduledLessons.filter(
                lesson =>
                  lesson.dayOfWeek ===
                  day.id
              );

            const daySchedules = [
              ...recurringDaySchedules,
              ...temporaryDaySchedules
            ].sort(
              (a, b) => {
                const dayTimings = weekPrayerTimingsMap[day.id] || prayerTimings;
                const aMins = calculateLessonEffectiveStartMinutesForDay(a, dayTimings, day.id);
                const bMins = calculateLessonEffectiveStartMinutesForDay(b, dayTimings, day.id);

                if (aMins !== bMins) {
                  return aMins - bMins;
                }

                const aConfig = getDayConfigForDisplay(a, day.id);
                const bConfig = getDayConfigForDisplay(b, day.id);
                const aTimeStr = a.startTime || a.newStartTime || aConfig.startTime || '';
                const bTimeStr = b.startTime || b.newStartTime || bConfig.startTime || '';
                return aTimeStr.localeCompare(bTimeStr);
              }
            );

            return `
              <div
                class="day-row-card"
                style="
                  background: var(--card-bg);
                  border: 1px solid var(--border-color);
                  border-radius: 12px;
                  padding: 14px;
                  display: flex;
                  flex-direction: column;
                  gap: 10px;
                  width: 100%;
                "
              >

                <div
                  class="day-header"
                  style="
                    font-weight: 700;
                    font-size: 1.05rem;
                    color: var(--primary-color);
                    border-bottom: 2px solid var(--border-color);
                    padding-bottom: 8px;
                  "
                >
                  📅 ${day.name}
                </div>

                <div
                  class="day-students-horizontal-scroll"
                  style="
                    display: flex;
                    gap: 10px;
                    overflow-x: auto;
                    padding-bottom: 4px;
                    align-items: center;
                    width: 100%;
                  "
                >

                  ${
                    daySchedules.length > 0
                      ? daySchedules
                          .map(
                            schedule => {

                              const scheduleKind =
                                getScheduleKind(
                                  schedule
                                );

                              const isRescheduled =
                                schedule.isRescheduled ===
                                true;

                              let timeDisplay =
                                '';

                              const dayTimings = weekPrayerTimingsMap[day.id] || prayerTimings;
                              const dayConfig = getDayConfigForDisplay(schedule, day.id);

                              if (
                                isRescheduled
                              ) {

                                timeDisplay =
                                  schedule.newStartTime ||
                                  schedule.startTime ||
                                  'وقت غير محدد';

                              } else if (
                                dayConfig.timeType ===
                                'fixed'
                              ) {

                                if (dayConfig.endTime) {
                                  const duration =
                                    scheduleService.calculateDuration(
                                      dayConfig.startTime,
                                      dayConfig.endTime
                                    );
                                  timeDisplay =
                                    `${dayConfig.startTime} - ${dayConfig.endTime} (${duration}د)`;
                                } else {
                                  timeDisplay = dayConfig.startTime;
                                }

                              } else {
                                const effectiveStart = calculateEffectiveStartTimeForConfig(dayConfig, dayTimings);
                                const prayerLabel = prayerNames[dayConfig.prayerName] || 'الصلاة';
                                const offsetMinutes = Number(dayConfig.offsetMinutes) || 0;

                                if (!effectiveStart) {
                                  timeDisplay = `وقت ${prayerLabel}`;
                                } else if (offsetMinutes === 0) {
                                  timeDisplay = `${effectiveStart} — بعد ${prayerLabel}`;
                                } else if (offsetMinutes > 0) {
                                  timeDisplay = `${effectiveStart} — بعد ${prayerLabel} بـ ${offsetMinutes} دقيقة`;
                                } else {
                                  timeDisplay = `${effectiveStart} — قبل ${prayerLabel} بـ ${Math.abs(offsetMinutes)} دقيقة`;
                                }
                              }

                              const startTimeOnly = isRescheduled
                                ? (schedule.newStartTime || schedule.startTime || '')
                                : (dayConfig.timeType === 'fixed' ? (dayConfig.startTime || '') : calculateEffectiveStartTimeForConfig(dayConfig, dayTimings));

                              const cardBg = isRescheduled ? '#fff7ed' : '#f8fafc';
                              const cardBorder = isRescheduled ? '#f97316' : 'var(--border-color)';

                              if (
                                scheduleKind ===
                                'group'
                              ) {
                                const groupName = schedule.groupName || 'مجموعة بدون اسم';

                                return `
                                  <div
                                    class="student-mini-card clickable-schedule-card"
                                    data-schedule-id="${schedule.id}"
                                    data-is-group="true"
                                    data-override-id="${schedule.overrideId || ''}"
                                    style="
                                      background: ${cardBg};
                                      border: 1px solid ${cardBorder};
                                      border-radius: 8px;
                                      padding: 8px 12px;
                                      display: flex;
                                      flex-direction: column;
                                      gap: 2px;
                                      cursor: pointer;
                                      flex-shrink: 0;
                                      min-width: 140px;
                                      transition: transform 0.15s ease, box-shadow 0.15s ease;
                                    "
                                  >
                                    <div style="font-weight: 700; color: var(--text-main); font-size: 0.9rem;">
                                      👥 ${groupName} ${isRescheduled ? '🔄' : ''}
                                    </div>
                                    <div style="color: var(--text-muted); font-size: 0.75rem;">
                                      ⏰ ${startTimeOnly || timeDisplay}
                                    </div>
                                  </div>
                                `;
                              }

                              const student =
                                students.find(
                                  student =>
                                    student.id ===
                                    schedule.studentId
                                );

                              const studentName =
                                student
                                  ? student.name
                                  : 'طالب غير متوفر';

                              return `
                                <div
                                  class="student-mini-card clickable-schedule-card"
                                  data-schedule-id="${schedule.id}"
                                  data-is-group="false"
                                  data-override-id="${schedule.overrideId || ''}"
                                  style="
                                    background: ${cardBg};
                                    border: 1px solid ${cardBorder};
                                    border-radius: 8px;
                                    padding: 8px 12px;
                                    display: flex;
                                    flex-direction: column;
                                    gap: 2px;
                                    cursor: pointer;
                                    flex-shrink: 0;
                                    min-width: 130px;
                                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                                  "
                                >
                                  <div style="font-weight: 700; color: var(--text-main); font-size: 0.9rem;">
                                    👤 ${studentName} ${isRescheduled ? '🔄' : ''}
                                  </div>
                                  <div style="color: var(--text-muted); font-size: 0.75rem;">
                                    ⏰ ${startTimeOnly || timeDisplay}
                                  </div>
                                </div>
                              `;
                            }
                          )
                          .join('')
                      : `
                        <div
                          style="
                            color: var(--text-muted);
                            font-size: 0.85rem;
                            padding: 4px 0;
                          "
                        >
                          لا مواعيد مسجلة في هذا اليوم.
                        </div>
                      `
                  }

                </div>
              </div>
            `;
          }).join('')}

        </div>
      </div>

    </div>

    <!-- نافذة تفاصيل الموعد (Modal) -->
    <div
      id="schedule-details-modal"
      class="modal-overlay"
      style="display: none;"
    >
      <div
        class="modal-content"
        style="max-width: 480px;"
      >
        <div class="modal-header">
          <h3 id="details-modal-title">تفاصيل الموعد</h3>
          <button type="button" id="close-details-modal" class="close-btn">&times;</button>
        </div>
        <div class="modal-form" id="schedule-details-body" style="display: flex; flex-direction: column; gap: 10px; font-size: 0.95rem;">
          <!-- تملأ ديناميكياً -->
        </div>
        <div class="modal-actions" style="padding: 0 20px 20px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div id="details-modal-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
            <!-- أزرار التعديل والحذف ديناميكياً -->
          </div>
          <button type="button" id="details-close-action-btn" class="secondary-btn">إغلاق</button>
        </div>
      </div>
    </div>

    <div
      id="add-schedule-modal"
      class="modal-overlay"
      style="display: none;"
    >
      <div
        class="modal-content"
        style="
          max-height: 90vh;
          overflow-y: auto;
        "
      >
        <div class="modal-header">
          <h3 id="schedule-modal-title">
            إضافة موعد أسبوعي متكرر
          </h3>

          <button
            type="button"
            id="close-schedule-modal"
            class="close-btn"
          >
            &times;
          </button>
        </div>

        <form
          id="add-schedule-form"
          class="modal-form"
        >
          <input
            type="hidden"
            id="sch-edit-id"
            value=""
          />

          <div class="form-group">
            <label for="sch-kind">
              نوع الموعد*
            </label>

            <select
              id="sch-kind"
              class="filter-select"
              required
            >
              <option value="individual">
                👤 موعد فردي
              </option>

              <option value="group">
                👥 موعد مجموعة
              </option>
            </select>
          </div>

          <div id="individual-schedule-fields">

            <div class="form-group">
              <label for="sch-student-search">
                🔍 ابحث باسم الطالب...
              </label>

              <input
                type="text"
                id="sch-student-search"
                class="search-input"
                placeholder="اكتب للبحث في أسماء الطلاب المتاحين..."
              />
            </div>

            <div class="form-group">
              <label for="sch-student">
                اختر الطالب*
              </label>

              <select
                id="sch-student"
                class="filter-select"
              >
                <option value="">
                  -- اختر الطالب --
                </option>
              </select>
            </div>

          </div>

          <div
            id="group-schedule-fields"
            style="display: none;"
          >

            <div class="form-group">
              <label for="sch-group-name">
                اسم المجموعة*
              </label>

              <input
                type="text"
                id="sch-group-name"
                class="search-input"
                placeholder="مثال: مجموعة الفجر"
              />
            </div>

            <div class="form-group">
              <label for="sch-group-search">
                🔍 ابحث عن الطلاب
              </label>

              <input
                type="text"
                id="sch-group-search"
                class="search-input"
                placeholder="اكتب اسم الطالب للبحث..."
              />
            </div>

            <div class="form-group">
              <label>
                اختر طلاب المجموعة*
              </label>

              <div
                id="sch-group-students-list"
                style="
                  border: 1px solid var(--border-color);
                  border-radius: 8px;
                  padding: 8px;
                  max-height: 220px;
                  overflow-y: auto;
                  display: flex;
                  flex-direction: column;
                  gap: 6px;
                  background: var(--card-bg);
                "
              >
              </div>

              <small
                style="
                  color: var(--text-muted);
                  font-size: 0.78rem;
                  line-height: 1.5;
                  display: block;
                  margin-top: 5px;
                "
              >
                يمكن اختيار أكثر من طالب، وسيكون لهم موعد واحد مشترك.
              </small>

            </div>

          </div>

          <div class="form-group">

            <label>
              أيام الأسبوع*
              (اختر يوماً واحداً على الأقل)
            </label>

            <div
              id="sch-days-container"
              style="
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 4px;
              "
            >
              ${daysColumns.map(day => `
                <label
                  style="
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.85rem;
                    cursor: pointer;
                  "
                >
                  <input
                    type="checkbox"
                    name="sch-days"
                    value="${day.id}"
                  />

                  ${day.name}
                </label>
              `).join('')}
            </div>

          </div>

          <div id="days-configs-section" style="display: flex; flex-direction: column; gap: 12px; margin-top: 6px;">
            <label style="font-weight: 700; color: var(--primary-color);">إعدادات التوقيت المستقلة للأيام المختارة</label>
            <div id="days-configs-container" style="display: flex; flex-direction: column; gap: 10px;"></div>
          </div>

          <div class="form-group">

            <label for="sch-lesson-mode">
              طريقة الحصة*
            </label>

            <select
              id="sch-lesson-mode"
              class="filter-select"
              required
            >
              <option value="in_person">
                🏠 حضوري
              </option>

              <option value="online">
                💻 أونلاين
              </option>
            </select>

            <small
              style="
                color: var(--text-muted);
                font-size: 0.78rem;
                line-height: 1.5;
              "
            >
              في الحصة الأونلاين سيظهر عند بدء الحصة زر لفتح واتساب الطالب مباشرة.
            </small>

          </div>

          <div class="form-group">

            <label for="sch-type">
              نوع الموعد*
            </label>

            <input
              type="text"
              id="sch-type"
              required
              placeholder="مثال: حفظ، مراجعة، تجويد"
              value="حفظ"
            />

          </div>

          <div class="modal-actions">

            <button
              type="button"
              id="cancel-schedule-modal"
              class="secondary-btn"
            >
              إلغاء
            </button>

            <button
              type="submit"
              id="schedule-submit-btn"
              class="primary-action-btn"
            >
              حفظ الموعد
            </button>

          </div>

        </form>
      </div>
    </div>

    <div
      id="edit-rescheduled-modal"
      class="modal-overlay"
      style="display: none;"
    >
      <div
        class="modal-content"
        style="
          max-width: 500px;
        "
      >

        <div class="modal-header">

          <h3>
            ✏️ تعديل الموعد المؤقت
          </h3>

          <button
            type="button"
            id="close-rescheduled-modal"
            class="close-btn"
          >
            &times;
          </button>

        </div>

        <form
          id="edit-rescheduled-form"
          class="modal-form"
        >

          <input
            type="hidden"
            id="rescheduled-edit-id"
            value=""
          />

          <div
            style="
              background: #fff7ed;
              border: 1px solid #fed7aa;
              color: #9a3412;
              border-radius: 8px;
              padding: 10px;
              margin-bottom: 12px;
              font-size: 0.82rem;
              line-height: 1.6;
            "
          >
            🔄 سيتم تعديل هذه الحصة المؤقتة فقط،
            ولن يتم تغيير الموعد الأسبوعي الأصلي.
          </div>

          <div class="form-group">

            <label for="rescheduled-new-date">
              التاريخ الجديد*
            </label>

            <input
              type="date"
              id="rescheduled-new-date"
              required
            />

          </div>

          <div class="form-group">

            <label for="rescheduled-new-time">
              وقت البداية الجديد*
            </label>

            <input
              type="time"
              id="rescheduled-new-time"
              required
            />

          </div>

          <div class="modal-actions">

            <button
              type="button"
              id="cancel-rescheduled-modal"
              class="secondary-btn"
            >
              إلغاء
            </button>

            <button
              type="submit"
              class="primary-action-btn"
            >
              حفظ التعديل
            </button>

          </div>

        </form>

      </div>
    </div>
  `;

  attachScheduleEvents(
    container,
    students,
    schedules,
    rescheduledLessons,
    weekPrayerTimingsMap
  );
}

function calculateEffectiveStartTimeForConfig(config, prayerTimings) {
  if (!config) return "";
  if (config.timeType !== 'prayer') {
    return normalizeTime(config.startTime);
  }
  const prayerName = config.prayerName || "";
  const prayerTime = prayerTimings?.[prayerName];
  const prayerMinutes = timeToMinutes(prayerTime);
  if (prayerMinutes === null) return "";
  const offset = Number(config.offsetMinutes) || 0;
  return minutesToTime(prayerMinutes + offset);
}

function attachScheduleEvents(
  container,
  studentsList,
  schedulesList,
  rescheduledLessonsList = [],
  weekPrayerTimingsMap = {}
) {

  const modal =
    container.querySelector(
      '#add-schedule-modal'
    );

  const openIndividualBtn =
    container.querySelector(
      '#open-add-individual-schedule-modal'
    );

  const openGroupBtn =
    container.querySelector(
      '#open-add-group-schedule-modal'
    );

  const closeBtn =
    container.querySelector(
      '#close-schedule-modal'
    );

  const cancelBtn =
    container.querySelector(
      '#cancel-schedule-modal'
    );

  const form =
    container.querySelector(
      '#add-schedule-form'
    );

  const modalTitle =
    container.querySelector(
      '#schedule-modal-title'
    );

  const editIdInput =
    container.querySelector(
      '#sch-edit-id'
    );

  const kindSelect =
    container.querySelector(
      '#sch-kind'
    );

  const individualFields =
    container.querySelector(
      '#individual-schedule-fields'
    );

  const groupFields =
    container.querySelector(
      '#group-schedule-fields'
    );

  const lessonModeSelect =
    container.querySelector(
      '#sch-lesson-mode'
    );

  const studentSearchInput =
    container.querySelector(
      '#sch-student-search'
    );

  const studentSelect =
    container.querySelector(
      '#sch-student'
    );

  const groupNameInput =
    container.querySelector(
      '#sch-group-name'
    );

  const groupSearchInput =
    container.querySelector(
      '#sch-group-search'
    );

  const groupStudentsList =
    container.querySelector(
      '#sch-group-students-list'
    );

  const daysContainer =
    container.querySelector(
      '#sch-days-container'
    );

  const daysConfigsContainer =
    container.querySelector(
      '#days-configs-container'
    );

  const rescheduledModal =
    container.querySelector(
      '#edit-rescheduled-modal'
    );

  const rescheduledForm =
    container.querySelector(
      '#edit-rescheduled-form'
    );

  const rescheduledEditId =
    container.querySelector(
      '#rescheduled-edit-id'
    );

  const rescheduledNewDate =
    container.querySelector(
      '#rescheduled-new-date'
    );

  const rescheduledNewTime =
    container.querySelector(
      '#rescheduled-new-time'
    );

  const closeRescheduledBtn =
    container.querySelector(
      '#close-rescheduled-modal'
    );

  const cancelRescheduledBtn =
    container.querySelector(
      '#cancel-rescheduled-modal'
    );

  const detailsModal = container.querySelector('#schedule-details-modal');
  const closeDetailsModalBtn = container.querySelector('#close-details-modal');
  const detailsCloseActionBtn = container.querySelector('#details-close-action-btn');
  const detailsBody = container.querySelector('#schedule-details-body');
  const detailsActions = container.querySelector('#details-modal-actions');

  modal.style.display = 'none';

  rescheduledModal.style.display =
    'none';
  if (detailsModal) detailsModal.style.display = 'none';

  let currentAvailableStudents = [];

  let currentAvailableGroupStudents =
    [];

  let selectedStudentIdWhenEditing =
    null;

  let selectedGroupStudentIds =
    new Set();

  let activeDayConfigsState = {};

  const renderDaysConfigsUI = (existingConfigs = {}) => {
    const checkedDays = Array.from(
      container.querySelectorAll('input[name="sch-days"]:checked')
    ).map(cb => Number(cb.value));

    if (checkedDays.length === 0) {
      daysConfigsContainer.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 10px;">
          الرجاء اختيار يوم واحد على الأقل من أيام الأسبوع لتخصيص إعدادات التوقيت.
        </div>
      `;
      return;
    }

    daysConfigsContainer.innerHTML = checkedDays.map(dayId => {
      const dayObj = daysColumns.find(d => d.id === dayId);
      const dayName = dayObj ? dayObj.name : '';
      const cfg = existingConfigs[String(dayId)] || {
        timeType: 'fixed',
        startTime: '',
        endTime: '',
        prayerName: 'fajr',
        offsetMinutes: 0
      };

      return `
        <div class="day-config-row" data-day-id="${dayId}" style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 10px;">
          <div style="font-weight: 700; color: var(--primary-color); font-size: 0.9rem;">
            📅 إعدادات يوم ${dayName}
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem;">نمط التوقيت</label>
            <select class="filter-select day-timetype-select" data-day-id="${dayId}" style="padding: 6px;">
              <option value="fixed" ${cfg.timeType === 'fixed' ? 'selected' : ''}>وقت ثابت</option>
              <option value="prayer" ${cfg.timeType === 'prayer' ? 'selected' : ''}>مرتبط بالصلاة</option>
            </select>
          </div>
          <div class="day-fixed-fields" data-day-id="${dayId}" style="display: ${cfg.timeType !== 'prayer' ? 'flex' : 'none'}; flex-direction: column; gap: 8px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label style="font-size: 0.8rem;">وقت البداية</label>
              <input type="time" class="filter-input day-start-input" data-day-id="${dayId}" value="${cfg.startTime || ''}" style="padding: 6px;" />
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label style="font-size: 0.8rem;">وقت النهاية (اختياري)</label>
              <input type="time" class="filter-input day-end-input" data-day-id="${dayId}" value="${cfg.endTime || ''}" style="padding: 6px;" />
            </div>
          </div>
          <div class="day-prayer-fields" data-day-id="${dayId}" style="display: ${cfg.timeType === 'prayer' ? 'flex' : 'none'}; flex-direction: column; gap: 8px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label style="font-size: 0.8rem;">اختر الصلاة</label>
              <select class="filter-select day-prayer-select" data-day-id="${dayId}" style="padding: 6px;">
                <option value="fajr" ${cfg.prayerName === 'fajr' ? 'selected' : ''}>الفجر</option>
                <option value="sunrise" ${cfg.prayerName === 'sunrise' ? 'selected' : ''}>الشروق</option>
                <option value="dhuhr" ${cfg.prayerName === 'dhuhr' ? 'selected' : ''}>الظهر</option>
                <option value="asr" ${cfg.prayerName === 'asr' ? 'selected' : ''}>العصر</option>
                <option value="maghrib" ${cfg.prayerName === 'maghrib' ? 'selected' : ''}>المغرب</option>
                <option value="isha" ${cfg.prayerName === 'isha' ? 'selected' : ''}>العشاء</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label style="font-size: 0.8rem;">التوقيت بالنسبة للصلاة (بالدقائق)</label>
              <input type="number" class="filter-input day-offset-input" data-day-id="${dayId}" value="${Number.isFinite(Number(cfg.offsetMinutes)) ? cfg.offsetMinutes : 0}" step="1" style="padding: 6px;" />
            </div>
          </div>
        </div>
      `;
    }).join('');

    daysConfigsContainer.querySelectorAll('.day-timetype-select').forEach(sel => {
      sel.addEventListener('change', e => {
        const dId = e.target.getAttribute('data-day-id');
        const val = e.target.value;
        const fixedRow = daysConfigsContainer.querySelector(`.day-fixed-fields[data-day-id="${dId}"]`);
        const prayerRow = daysConfigsContainer.querySelector(`.day-prayer-fields[data-day-id="${dId}"]`);
        if (val === 'prayer') {
          fixedRow.style.display = 'none';
          prayerRow.style.display = 'flex';
        } else {
          fixedRow.style.display = 'flex';
          prayerRow.style.display = 'none';
        }
      });
    });
  };

  if (daysContainer) {
    daysContainer.querySelectorAll('input[name="sch-days"]').forEach(cb => {
      cb.addEventListener('change', () => {
        renderDaysConfigsUI(activeDayConfigsState);
      });
    });
  }

  const populateStudentSelect =
    studentsToDisplay => {

      if (
        studentsToDisplay.length > 0
      ) {

        studentSelect.innerHTML = `
          <option value="">
            -- اختر الطالب --
          </option>

          ${studentsToDisplay
            .map(
              student => `
                <option value="${student.id}">
                  ${student.name}
                </option>
              `
            )
            .join('')}
        `;

      } else {

        studentSelect.innerHTML = `
          <option value="">
            لا يوجد طالب بهذا الاسم
          </option>
        `;
      }

      if (
        selectedStudentIdWhenEditing
      ) {
        studentSelect.value =
          selectedStudentIdWhenEditing;
      }
    };

  const renderGroupStudents =
    studentsToDisplay => {

      if (
        !studentsToDisplay ||
        studentsToDisplay.length === 0
      ) {

        groupStudentsList.innerHTML = `
          <div
            style="
              color: var(--text-muted);
              font-size: 0.8rem;
              text-align: center;
              padding: 15px;
            "
          >
            لا يوجد طلاب متاحون
          </div>
        `;

        return;
      }

      groupStudentsList.innerHTML =
        studentsToDisplay
          .map(student => {

            const checked =
              selectedGroupStudentIds.has(
                student.id
              );

            return `
              <label
                style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  padding: 7px;
                  border-radius: 6px;
                  cursor: pointer;
                  border: 1px solid var(--border-color);
                "
              >

                <input
                  type="checkbox"
                  class="sch-group-student-checkbox"
                  value="${student.id}"
                  ${checked ? 'checked' : ''}
                />

                <span>
                  ${student.name}
                </span>

              </label>
            `;
          })
          .join('');

      groupStudentsList
        .querySelectorAll(
          '.sch-group-student-checkbox'
        )
        .forEach(checkbox => {

          checkbox.addEventListener(
            'change',
            event => {

              const studentId =
                event.target.value;

              if (
                event.target.checked
              ) {

                selectedGroupStudentIds.add(
                  studentId
                );

              } else {

                selectedGroupStudentIds.delete(
                  studentId
                );
              }
            }
          );
        });
    };

  const updateScheduleKindUI =
    () => {

      const kind =
        kindSelect.value;

      if (
        kind === 'group'
      ) {

        individualFields.style.display =
          'none';

        groupFields.style.display =
          'block';

        studentSelect.removeAttribute(
          'required'
        );

        groupNameInput.setAttribute(
          'required',
          'true'
        );

      } else {

        individualFields.style.display =
          'block';

        groupFields.style.display =
          'none';

        studentSelect.setAttribute(
          'required',
          'true'
        );

        groupNameInput.removeAttribute(
          'required'
        );
      }
    };

  if (
    studentSearchInput &&
    studentSelect
  ) {

    studentSearchInput.addEventListener(
      'input',
      event => {

        const query =
          normalizeArabicText(
            event.target.value
          );

        const filtered =
          currentAvailableStudents.filter(
            student =>
              normalizeArabicText(
                student.name
              ).includes(query)
          );

        populateStudentSelect(
          filtered
        );
      }
    );
  }

  if (
    groupSearchInput
  ) {

    groupSearchInput.addEventListener(
      'input',
      event => {

        const query =
          normalizeArabicText(
            event.target.value
          );

        const filtered =
          currentAvailableGroupStudents.filter(
            student =>
              normalizeArabicText(
                student.name
              ).includes(query)
          );

        renderGroupStudents(
          filtered
        );
      }
    );
  }

  const toggleModal = (
    show,
    mode = 'individual',
    scheduleData = null
  ) => {

    if (show) {

      modal.style.display =
        'flex';

      if (
        studentSearchInput
      ) {
        studentSearchInput.value =
          '';
      }

      if (
        groupSearchInput
      ) {
        groupSearchInput.value =
          '';
      }

      selectedStudentIdWhenEditing =
        null;

      selectedGroupStudentIds =
        new Set();

      activeDayConfigsState = {};

      const scheduledStudentIds =
        new Set();

      schedulesList.forEach(
        schedule => {

          if (
            schedule.id ===
            (
              scheduleData?.id ||
              editIdInput.value
            )
          ) {
            return;
          }

          if (
            getScheduleKind(
              schedule
            ) === 'group'
          ) {

            if (
              Array.isArray(
                schedule.studentIds
              )
            ) {

              schedule.studentIds.forEach(
                studentId => {

                  scheduledStudentIds.add(
                    studentId
                  );
                }
              );
            }

          } else if (
            schedule.studentId
          ) {

            scheduledStudentIds.add(
              schedule.studentId
            );
          }
        }
      );

      if (
        mode === 'individual'
      ) {

        kindSelect.value =
          'individual';

        currentAvailableStudents =
          studentsList.filter(
            student =>
              !scheduledStudentIds.has(
                student.id
              ) ||
              (
                scheduleData &&
                scheduleData.studentId ===
                  student.id
              )
          );

        populateStudentSelect(
          currentAvailableStudents
        );
      }

      if (
        mode === 'group'
      ) {

        kindSelect.value =
          'group';

        const editingGroupStudentIds =
          scheduleData &&
          Array.isArray(
            scheduleData.studentIds
          )
            ? scheduleData.studentIds
            : [];

        selectedGroupStudentIds =
          new Set(
            editingGroupStudentIds
          );

        currentAvailableGroupStudents =
          studentsList.filter(
            student =>
              !scheduledStudentIds.has(
                student.id
              ) ||
              selectedGroupStudentIds.has(
                student.id
              )
          );

        renderGroupStudents(
          currentAvailableGroupStudents
        );
      }

      updateScheduleKindUI();

      if (
        scheduleData
      ) {

        modalTitle.textContent =
          getScheduleKind(
            scheduleData
          ) === 'group'
            ? 'تعديل المجموعة'
            : 'تعديل الموعد';

        editIdInput.value =
          scheduleData.id;

        lessonModeSelect.value =
          getLessonMode(
            scheduleData
          );

        if (
          getScheduleKind(
            scheduleData
          ) === 'group'
        ) {

          kindSelect.value =
            'group';

          groupNameInput.value =
            scheduleData.groupName ||
            '';

          selectedGroupStudentIds =
            new Set(
              Array.isArray(
                scheduleData.studentIds
              )
                ? scheduleData.studentIds
                : []
            );

          currentAvailableGroupStudents =
            studentsList.filter(
              student =>
                !scheduledStudentIds.has(
                  student.id
                ) ||
                selectedGroupStudentIds.has(
                  student.id
                )
            );

          renderGroupStudents(
            currentAvailableGroupStudents
          );

        } else {

          kindSelect.value =
            'individual';

          selectedStudentIdWhenEditing =
            scheduleData.studentId;

          currentAvailableStudents =
            studentsList.filter(
              student =>
                !scheduledStudentIds.has(
                  student.id
                ) ||
                student.id ===
                  scheduleData.studentId
            );

          populateStudentSelect(
            currentAvailableStudents
          );

          studentSelect.value =
            scheduleData.studentId ||
            '';
        }

        container.querySelector(
          '#sch-type'
        ).value =
          scheduleData.type ||
          'حفظ';

        const dayCheckboxes =
          container.querySelectorAll(
            'input[name="sch-days"]'
          );

        dayCheckboxes.forEach(
          checkbox => {

            checkbox.checked =
              (
                scheduleData.daysOfWeek ||
                []
              ).includes(
                Number(
                  checkbox.value
                )
              );
          }
        );

        activeDayConfigsState = scheduleData.dayConfigs ? { ...scheduleData.dayConfigs } : {};
        if (!scheduleData.dayConfigs) {
          const fallbackTimeType = scheduleData.timeType || 'fixed';
          const fallbackStart = scheduleData.startTime || '';
          const fallbackEnd = scheduleData.endTime || '';
          const fallbackPrayer = scheduleData.prayerName || scheduleData.prayer || 'fajr';
          const fallbackOffset = Number(scheduleData.offsetMinutes) || 0;

          (scheduleData.daysOfWeek || []).forEach(d => {
            activeDayConfigsState[String(d)] = {
              timeType: fallbackTimeType,
              startTime: fallbackStart,
              endTime: fallbackEnd,
              prayerName: fallbackPrayer,
              offsetMinutes: fallbackOffset
            };
          });
        }

        renderDaysConfigsUI(activeDayConfigsState);

      } else {

        modalTitle.textContent =
          mode === 'group'
            ? 'إضافة مجموعة أسبوعية'
            : 'إضافة موعد أسبوعي متكرر';

        editIdInput.value = '';

        form.reset();

        lessonModeSelect.value =
          'in_person';

        selectedGroupStudentIds =
          new Set();

        activeDayConfigsState = {};

        if (
          mode === 'group'
        ) {

          kindSelect.value =
            'group';

          currentAvailableGroupStudents =
            studentsList.filter(
              student =>
                !scheduledStudentIds.has(
                  student.id
                )
            );

          renderGroupStudents(
            currentAvailableGroupStudents
          );

        } else {

          kindSelect.value =
            'individual';

          currentAvailableStudents =
            studentsList.filter(
              student =>
                !scheduledStudentIds.has(
                  student.id
                )
            );

          populateStudentSelect(
            currentAvailableStudents
          );
        }

        groupNameInput.value = '';

        container.querySelectorAll('input[name="sch-days"]').forEach(cb => cb.checked = false);
        renderDaysConfigsUI({});

        updateScheduleKindUI();
      }

    } else {

      modal.style.display =
        'none';

      selectedStudentIdWhenEditing =
        null;

      selectedGroupStudentIds =
        new Set();

      activeDayConfigsState = {};
    }
  };

  const openRescheduledEditModal =
    override => {

      if (!override) {
        return;
      }

      rescheduledEditId.value =
        override.overrideId ||
        override.id ||
        '';

      rescheduledNewDate.value =
        override.newDate ||
        '';

      rescheduledNewTime.value =
        override.newStartTime ||
        override.startTime ||
        '';

      rescheduledModal.style.display =
        'flex';
    };

  const closeRescheduledModal =
    () => {

      rescheduledModal.style.display =
        'none';

      rescheduledEditId.value =
        '';

      rescheduledNewDate.value =
        '';

      rescheduledNewTime.value =
        '';
    };

  // دالة فتح نافذة تفاصيل الموعد عند الضغط على الكارت
  const openScheduleDetailsModal = (scheduleObj, isResched, overrideObj) => {
    if (!detailsModal) return;

    const scheduleKind = getScheduleKind(scheduleObj);
    const lessonModeLabel = getLessonModeLabel(scheduleObj);
    const isRescheduled = isResched || scheduleObj.isRescheduled === true;

    let titleText = '';
    let bodyHtml = '';
    let actionsHtml = '';

    if (scheduleKind === 'group') {
      const groupStudents = Array.isArray(scheduleObj.studentIds)
        ? scheduleObj.studentIds.map(id => studentsList.find(s => s.id === id)?.name).filter(Boolean)
        : [];

      titleText = `👥 تفاصيل مجموعة: ${scheduleObj.groupName || 'مجموعة'}`;
      bodyHtml = `
        <p>👥 <strong>اسم المجموعة:</strong> ${scheduleObj.groupName || 'بدون اسم'}</p>
        <p>🏷️ <strong>نوع الموعد:</strong> ${scheduleObj.type || 'حفظ'}</p>
        <p>💻 <strong>طريقة الحصة:</strong> ${lessonModeLabel}</p>
        <p>📅 <strong>أيام الأسبوع:</strong> ${(scheduleObj.daysOfWeek || []).map(d => daysColumns.find(col => col.id === d)?.name).filter(Boolean).join('، ') || 'غير محددة'}</p>
        <p>⏰ <strong>التوقيت:</strong> ${scheduleObj.startTime || scheduleObj.newStartTime || 'حسب الإعدادات'}</p>
        <p>👨‍🎓 <strong>الطلاب (${groupStudents.length}):</strong> ${groupStudents.join('، ') || 'لا يوجد'}</p>
        ${isRescheduled ? `<p style="color: #ea580c; font-weight: 700;">🔄 موعد مُعاد جدولته للتاريخ: ${formatDateForDisplay(scheduleObj.newDate || overrideObj?.newDate)}</p>` : ''}
      `;
    } else {
      const student = studentsList.find(s => s.id === scheduleObj.studentId);
      const studentName = student ? student.name : 'طالب غير متوفر';

      titleText = `👤 تفاصيل موعد الطالب: ${studentName}`;
      bodyHtml = `
        <p>👤 <strong>اسم الطالب:</strong> ${studentName}</p>
        <p>🏷️ <strong>نوع الموعد:</strong> ${scheduleObj.type || 'حفظ'}</p>
        <p>💻 <strong>طريقة الحصة:</strong> ${lessonModeLabel}</p>
        <p>📅 <strong>أيام الأسبوع:</strong> ${(scheduleObj.daysOfWeek || []).map(d => daysColumns.find(col => col.id === d)?.name).filter(Boolean).join('، ') || 'غير محددة'}</p>
        <p>⏰ <strong>التوقيت:</strong> ${scheduleObj.startTime || scheduleObj.newStartTime || 'حسب الإعدادات'}</p>
        ${student?.parentPhone ? `<p>📞 <strong>رقم ولي الأمر:</strong> ${student.parentPhone}</p>` : ''}
        ${isRescheduled ? `<p style="color: #ea580c; font-weight: 700;">🔄 موعد مُعاد جدولته للتاريخ: ${formatDateForDisplay(scheduleObj.newDate || overrideObj?.newDate)}</p>` : ''}
      `;
    }

    if (isRescheduled) {
      const ovId = overrideObj?.overrideId || scheduleObj.overrideId;
      actionsHtml = `
        <button type="button" class="secondary-btn edit-rescheduled-btn" data-override-id="${ovId}" style="background: #e0f2fe; color: #0369a1;">✏️ تعديل المؤقت</button>
        <button type="button" class="secondary-btn delete-rescheduled-btn" data-override-id="${ovId}" style="background: #fee2e2; color: #991b1b;">🗑️ حذف المؤقت</button>
      `;
    } else {
      actionsHtml = `
        <button type="button" class="secondary-btn edit-schedule-btn" data-id="${scheduleObj.id}" style="background: #e0f2fe; color: #0369a1;">✏️ تعديل الموعد</button>
        <button type="button" class="secondary-btn delete-schedule-btn" data-id="${scheduleObj.id}" style="background: #fee2e2; color: #991b1b;">🗑️ حذف الموعد</button>
      `;
    }

    container.querySelector('#details-modal-title').textContent = titleText;
    detailsBody.innerHTML = bodyHtml;
    detailsActions.innerHTML = actionsHtml;

    attachDetailsModalActionsEvents();
    detailsModal.style.display = 'flex';
  };

  const closeScheduleDetailsModal = () => {
    if (detailsModal) detailsModal.style.display = 'none';
  };

  if (closeDetailsModalBtn) closeDetailsModalBtn.addEventListener('click', closeScheduleDetailsModal);
  if (detailsCloseActionBtn) detailsCloseActionBtn.addEventListener('click', closeScheduleDetailsModal);
  if (detailsModal) {
    detailsModal.addEventListener('click', e => {
      if (e.target === detailsModal) closeScheduleDetailsModal();
    });
  }

  const attachDetailsModalActionsEvents = () => {
    detailsActions.querySelectorAll('.edit-schedule-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const scheduleId = e.currentTarget.getAttribute('data-id');
        const scheduleToEdit = schedulesList.find(s => s.id === scheduleId);
        closeScheduleDetailsModal();
        if (scheduleToEdit) {
          toggleModal(true, getScheduleKind(scheduleToEdit), scheduleToEdit);
        }
      });
    });

    detailsActions.querySelectorAll('.delete-schedule-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        const scheduleId = e.currentTarget.getAttribute('data-id');
        const confirmed = confirm('هل أنت متأكد من حذف هذا الموعد الأسبوعي؟');
        if (!confirmed) return;

        const result = await scheduleService.deleteSchedule(scheduleId);
        if (result.success) {
          closeScheduleDetailsModal();
          await renderScheduleView(container);
        } else {
          alert('حدث خطأ أثناء الحذف: ' + (result.error || 'يرجى المحاولة مرة أخرى.'));
        }
      });
    });

    detailsActions.querySelectorAll('.edit-rescheduled-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const overrideId = e.currentTarget.getAttribute('data-override-id');
        const override = rescheduledLessonsList.find(l => (l.overrideId || l.id) === overrideId);
        closeScheduleDetailsModal();
        if (override) {
          openRescheduledEditModal(override);
        }
      });
    });

    detailsActions.querySelectorAll('.delete-rescheduled-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        const overrideId = e.currentTarget.getAttribute('data-override-id');
        if (!overrideId) return;

        const confirmed = confirm('هل أنت متأكد من حذف إعادة الجدولة؟\n\nسيعود الموعد الأسبوعي الأصلي للعمل بشكل طبيعي.');
        if (!confirmed) return;

        const result = await rescheduleService.deleteRescheduledLesson(overrideId);
        if (result.success) {
          closeScheduleDetailsModal();
          await renderScheduleView(container);
        } else {
          alert('حدث خطأ أثناء حذف الموعد المؤقت: ' + (result.error || 'يرجى المحاولة مرة أخرى.'));
        }
      });
    });
  };

  openIndividualBtn.addEventListener(
    'click',
    () =>
      toggleModal(
        true,
        'individual'
      )
  );

  openGroupBtn.addEventListener(
    'click',
    () =>
      toggleModal(
        true,
        'group'
      )
  );

  closeBtn.addEventListener(
    'click',
    () =>
      toggleModal(false)
  );

  cancelBtn.addEventListener(
    'click',
    () =>
      toggleModal(false)
  );

  modal.addEventListener(
    'click',
    event => {

      if (
        event.target === modal
      ) {
        toggleModal(false);
      }
    }
  );

  closeRescheduledBtn.addEventListener(
    'click',
    closeRescheduledModal
  );

  cancelRescheduledBtn.addEventListener(
    'click',
    closeRescheduledModal
  );

  rescheduledModal.addEventListener(
    'click',
    event => {

      if (
        event.target ===
        rescheduledModal
      ) {
        closeRescheduledModal();
      }
    }
  );

  kindSelect.addEventListener(
    'change',
    () => {

      updateScheduleKindUI();

      if (
        kindSelect.value ===
        'group'
      ) {

        currentAvailableGroupStudents =
          studentsList.filter(
            student => {

              const usedByOtherSchedule =
                schedulesList.some(
                  schedule => {

                    if (
                      schedule.id ===
                      editIdInput.value
                    ) {
                      return false;
                    }

                    if (
                      getScheduleKind(
                        schedule
                      ) === 'group'
                    ) {

                      return (
                        Array.isArray(
                          schedule.studentIds
                        ) &&
                        schedule.studentIds.includes(
                          student.id
                        )
                      );
                    }

                    return (
                      schedule.studentId ===
                      student.id
                    );
                  }
                );

              return (
                !usedByOtherSchedule ||
                selectedGroupStudentIds.has(
                  student.id
                )
              );
            }
          );

        renderGroupStudents(
          currentAvailableGroupStudents
        );
      }
    }
  );

  form.addEventListener(
    'submit',
    async event => {

      event.preventDefault();

      const editId =
        editIdInput.value;

      const scheduleKind =
        kindSelect.value === 'group'
          ? 'group'
          : 'individual';

      const lessonMode =
        lessonModeSelect.value === 'online'
          ? 'online'
          : 'in_person';

      const type =
        container.querySelector(
          '#sch-type'
        ).value.trim();

      const dayCheckboxes =
        container.querySelectorAll(
          'input[name="sch-days"]:checked'
        );

      const daysOfWeek =
        Array.from(
          dayCheckboxes
        ).map(
          checkbox =>
            Number(
              checkbox.value
            )
        );

      if (
        daysOfWeek.length === 0
      ) {

        alert(
          'يرجى اختيار يوم واحد على الأقل من أيام الأسبوع'
        );

        return;
      }

      if (!type) {

        alert(
          'يرجى إدخال نوع الموعد'
        );

        return;
      }

      const collectedDayConfigs = { ...activeDayConfigsState };
      let firstTimeType = 'fixed';
      let firstStartTime = '';
      let firstEndTime = null;
      let firstPrayer = 'fajr';
      let firstOffset = 0;

      let isFirstValid = false;

      for (const dayId of daysOfWeek) {
        const row = daysConfigsContainer.querySelector(`.day-config-row[data-day-id="${dayId}"]`);
        if (row) {
          const tType = row.querySelector('.day-timetype-select').value;
          const sTime = row.querySelector('.day-start-input')?.value || '';
          const eTime = row.querySelector('.day-end-input')?.value || null;
          const pName = row.querySelector('.day-prayer-select')?.value || 'fajr';
          const oMin = Number(row.querySelector('.day-offset-input')?.value) || 0;

          if (tType === 'fixed' && !sTime) {
            alert(`يرجى تحديد وقت البداية ليوم ${daysColumns.find(d => d.id === dayId)?.name || ''}`);
            return;
          }
          if (tType === 'fixed' && eTime && sTime >= eTime) {
            alert(`وقت البداية يجب أن يكون قبل وقت النهاية ليوم ${daysColumns.find(d => d.id === dayId)?.name || ''}`);
            return;
          }

          collectedDayConfigs[String(dayId)] = {
            timeType: tType,
            startTime: tType === 'fixed' ? normalizeTime(sTime) : null,
            endTime: tType === 'fixed' ? (normalizeTime(eTime) || null) : null,
            prayerName: tType === 'prayer' ? pName : '',
            offsetMinutes: oMin
          };

          if (!isFirstValid) {
            firstTimeType = tType;
            firstStartTime = sTime;
            firstEndTime = eTime;
            firstPrayer = pName;
            firstOffset = oMin;
            isFirstValid = true;
          }
        } else if (!collectedDayConfigs[String(dayId)]) {
          collectedDayConfigs[String(dayId)] = {
            timeType: 'fixed',
            startTime: '17:00',
            endTime: null,
            prayerName: 'fajr',
            offsetMinutes: 0
          };
        }
      }

      let studentId = null;
      let groupName = null;
      let studentIds = [];

      if (
        scheduleKind ===
        'individual'
      ) {

        studentId =
          studentSelect.value;

        if (!studentId) {

          alert(
            'يرجى اختيار الطالب'
          );

          return;
        }

      } else {

        groupName =
          groupNameInput.value.trim();

        if (!groupName) {

          alert(
            'يرجى إدخال اسم المجموعة'
          );

          groupNameInput.focus();

          return;
        }

        studentIds =
          Array.from(
            selectedGroupStudentIds
          );

        if (
          studentIds.length === 0
        ) {

          alert(
            'يرجى اختيار طالب واحد على الأقل للمجموعة'
          );

          return;
        }
      }

      const payload = {
        scheduleKind,
        studentId,
        groupName,
        studentIds,
        daysOfWeek,
        dayConfigs: collectedDayConfigs,
        timeType: firstTimeType,
        startTime: firstTimeType === 'fixed' ? normalizeTime(firstStartTime) : null,
        endTime: firstTimeType === 'fixed' ? (normalizeTime(firstEndTime) || null) : null,
        prayer: firstPrayer,
        prayerName: firstPrayer,
        offsetMinutes: firstOffset,
        type,
        lessonMode
      };

      let result;

      if (editId) {

        result =
          await scheduleService.updateSchedule(
            editId,
            payload
          );

      } else {

        result =
          await scheduleService.addSchedule(
            payload
          );
      }

      if (
        result.success
      ) {

        toggleModal(false);

        await renderScheduleView(
          container
        );

      } else {

        alert(
          'حدث خطأ أثناء الحفظ: ' +
            (
              result.error ||
              'يرجى المحاولة مرة أخرى.'
            )
        );
      }
    }
  );

  rescheduledForm.addEventListener(
    'submit',
    async event => {

      event.preventDefault();

      const overrideId =
        rescheduledEditId.value;

      const newDate =
        rescheduledNewDate.value;

      const newStartTime =
        rescheduledNewTime.value;

      if (!overrideId) {
        alert(
          'تعذر تحديد الموعد المؤقت.'
        );
        return;
      }

      if (!newDate) {
        alert(
          'يرجى اختيار التاريخ الجديد.'
        );
        return;
      }

      if (!newStartTime) {
        alert(
          'يرجى اختيار وقت البداية الجديد.'
        );
        return;
      }

      const result =
        await rescheduleService
          .updateRescheduledLesson({
            overrideId,
            newDate,
            newStartTime
          });

      if (
        result.success
      ) {

        closeRescheduledModal();

        await renderScheduleView(
          container
        );

      } else {

        alert(
          'حدث خطأ أثناء تعديل الموعد المؤقت: ' +
            (
              result.error ||
              'يرجى المحاولة مرة أخرى.'
            )
        );
      }
    }
  );

  // ربط النقر على الكروت الأفقية المختصرة لفتح نافذة التفاصيل Modal
  container.querySelectorAll('.clickable-schedule-card').forEach(card => {
    card.addEventListener('click', e => {
      const schId = e.currentTarget.getAttribute('data-schedule-id');
      const ovId = e.currentTarget.getAttribute('data-override-id');

      let targetSchedule = null;
      let targetOverride = null;
      let isResched = false;

      if (ovId && ovId !== '') {
        targetOverride = rescheduledLessonsList.find(l => (l.overrideId || l.id) === ovId);
        if (targetOverride) {
          targetSchedule = schedulesList.find(s => s.id === targetOverride.originalScheduleId) || targetOverride;
          isResched = true;
        }
      }

      if (!targetSchedule) {
        targetSchedule = schedulesList.find(s => s.id === schId);
      }

      if (targetSchedule) {
        openScheduleDetailsModal(targetSchedule, isResched, targetOverride);
      }
    });
  });
}
