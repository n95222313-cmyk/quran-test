/**
 * Available Slots Component
 * تبويب المواعيد المتاحة - عرض للقراءة فقط يعتمد على البيانات الحقيقية ومواقيت الصلاة.
 */

import { scheduleService } from "../services/scheduleData.js";
import { rescheduleService } from "../services/rescheduleService.js";
import { prayerService } from "../services/prayerService.js";
import { studentService } from "../services/studentService.js";

const DAYS_CONFIG = [
  { id: 6, name: "السبت" },
  { id: 0, name: "الأحد" },
  { id: 1, name: "الإثنين" },
  { id: 2, name: "الثلاثاء" },
  { id: 3, name: "الأربعاء" },
  { id: 4, name: "الخميس" },
  { id: 5, name: "الجمعة" }
];

const START_HOUR = 9;  // 9 AM
const END_HOUR = 23;   // 11 PM

const timeToMinutes = timeStr => {
  if (!timeStr || typeof timeStr !== "string") return null;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const minutesToTime = totalMinutes => {
  let value = Number(totalMinutes);
  if (!Number.isFinite(value)) return "";
  value = ((value % 1440) + 1440) % 1440;
  const h = Math.floor(value / 60);
  const m = value % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const formatTime12Hour = timeString => {
  const norm = minutesToTime(timeToMinutes(timeString));
  if (!norm) return timeString || "";
  const [hStr, mStr] = norm.split(":");
  let h = Number(hStr);
  const period = h < 12 ? "ص" : "م";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${mStr} ${period}`;
};

const getShortDisplayName = (booking) => {
  if (booking.isGroup) {
    return booking.groupName || "مجموعة";
  }
  const rawName = String(booking.studentName || "").trim();
  if (!rawName) return "طالب";
  const parts = rawName.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0] || "طالب";
};

export async function initAvailableSlotsModule(containerId) {
  const container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
  if (!container) return;

  container.innerHTML = `
    <div style="padding: 16px; display: flex; flex-direction: column; gap: 16px; max-width: 1200px; margin: 0 auto; direction: rtl; box-sizing: border-box; width: 100%; position: relative;">
      
      <div style="background: var(--card-bg, #fff); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; box-shadow: var(--shadow-sm); box-sizing: border-box;">
        <h2 style="margin: 0 0 8px 0; color: var(--primary-color); font-size: 1.2rem;">📅 المواعيد المتاحة أسبوعياً</h2>
        <p style="margin: 0; color: var(--text-muted); font-size: 0.85rem; line-height: 1.5;">
          عروض للقراءة فقط تستند إلى المواعيد الأسبوعية الثابتة، أوقات الصلاة الفعلية، وإعادة الجدولة. اضغط على أي موعد محجوز (أحمر) لعرض التفاصيل.
        </p>

        <div style="margin-top: 14px; display: flex; flex-direction: column; gap: 8px;">
          <label for="slot-duration-filter" style="font-weight: 700; font-size: 0.88rem;">⏱️ فلتر مدة الحصة:</label>
          <select id="slot-duration-filter" style="padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: #fff; font-size: 0.9rem; width: 100%; box-sizing: border-box;">
            <option value="0">عرض الخط الزمني الكامل (بدون فلتر)</option>
            <option value="20">20 دقيقة</option>
            <option value="30">30 دقيقة</option>
            <option value="45">45 دقيقة</option>
            <option value="60">60 دقيقة</option>
          </select>
        </div>

        <div style="margin-top: 12px; display: flex; gap: 12px; font-size: 0.8rem; flex-wrap: wrap;">
          <span style="display: flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; background: #22c55e; display: inline-block; border-radius: 3px; flex-shrink: 0;"></span> متاح</span>
          <span style="display: flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; background: #ef4444; display: inline-block; border-radius: 3px; flex-shrink: 0;"></span> محجوز (اضغط للعرض)</span>
          <span style="display: flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; background: #9ca3af; display: inline-block; border-radius: 3px; flex-shrink: 0;"></span> غير مؤكد</span>
        </div>
      </div>

      <div id="slots-timeline-container" style="display: flex; flex-direction: column; gap: 14px; box-sizing: border-box; width: 100%;">
        <div style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 0.9rem;">جاري حساب التوافر الزمني...</div>
      </div>

      <!-- نافذة منبثقة مصغرة لعرض تفاصيل الحجز -->
      <div id="booking-detail-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1200; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;">
        <div style="background: var(--card-bg, #fff); border-radius: 12px; padding: 20px; max-width: 360px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.2); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 12px; box-sizing: border-box;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
            <h4 style="margin: 0; color: var(--primary-color); font-size: 1rem;">📌 تفاصيل الموعد المحجوز</h4>
            <button type="button" id="close-booking-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted); padding: 0;">&times;</button>
          </div>
          <div id="booking-modal-body" style="font-size: 0.9rem; color: var(--text-main); display: flex; flex-direction: column; gap: 8px; line-height: 1.6;">
            <!-- التفاصيل تظهر هنا برمجياً -->
          </div>
        </div>
      </div>

    </div>
  `;

  let schedulesData = [];
  let overridesData = [];
  let studentsMap = new Map();
  const bookingsMapRegistry = new Map();

  try {
    const [schedRes, overRes, studRes] = await Promise.all([
      scheduleService.getSchedules(),
      rescheduleService.getSheikhOverrides(),
      studentService.getSheikhStudents()
    ]);
    if (schedRes.success) schedulesData = schedRes.data || [];
    if (overRes.success) overridesData = overRes.data || [];
    if (studRes.success && Array.isArray(studRes.data)) {
      studRes.data.forEach(st => {
        if (st && st.id) {
          studentsMap.set(st.id, st.name || "طالب");
        }
      });
    }
  } catch (err) {
    console.error("Error loading availability data:", err);
  }

  const renderTimeline = async (filterDuration = 0) => {
    const timelineEl = container.querySelector("#slots-timeline-container");
    if (!timelineEl) return;

    let daysHtml = "";
    bookingsMapRegistry.clear();

    const todayDateStr = new Date().toISOString().split('T')[0];
    const nowRef = new Date(`${todayDateStr}T12:00:00`);
    const currentDayIndex = nowRef.getDay();
    const diffToSat = (currentDayIndex + 1) % 7;
    const satDate = new Date(nowRef);
    satDate.setDate(nowRef.getDate() - diffToSat);

    for (let i = 0; i < 7; i++) {
      const dObj = new Date(satDate);
      dObj.setDate(satDate.getDate() + i);
      const y = dObj.getFullYear();
      const m = String(dObj.getMonth() + 1).padStart(2, "0");
      const dayStr = String(dObj.getDate()).padStart(2, "0");
      const dateString = `${y}-${m}-${dayStr}`;
      const dayOfWeek = dObj.getDay();
      const dayConfigItem = DAYS_CONFIG.find(dc => dc.id === dayOfWeek) || { name: "يوم" };

      let prayerTimes = {};
      let prayerStatusOk = true;
      try {
        const pRes = await prayerService.getPrayerTimesForDate(dateString);
        if (pRes.success && pRes.timings) {
          prayerTimes = pRes.timings;
        } else {
          prayerStatusOk = false;
        }
      } catch (e) {
        prayerStatusOk = false;
      }

      const dayBookings = [];

      schedulesData.forEach(sch => {
        const days = Array.isArray(sch.daysOfWeek) ? sch.daysOfWeek.map(Number) : [];
        if (!days.includes(dayOfWeek)) return;

        const isOverridden = overridesData.some(
          o => o.status === "rescheduled" && o.originalScheduleId === sch.id && o.originalDate === dateString
        );
        if (isOverridden) return;

        let startMins = null;
        let endMins = null;
        const cfg = sch.dayConfigs && sch.dayConfigs[String(dayOfWeek)] ? sch.dayConfigs[String(dayOfWeek)] : {
          timeType: sch.timeType || "fixed",
          startTime: sch.startTime || "",
          endTime: sch.endTime || "",
          prayerName: sch.prayerName || sch.prayer || "",
          offsetMinutes: Number(sch.offsetMinutes) || 0
        };

        if (cfg.timeType === "prayer") {
          if (!prayerStatusOk) {
            dayBookings.push({ type: "uncertain", label: "موعد مرتبط بالصلاة (تعذر جلب المواقيت)" });
            return;
          }
          const pTime = prayerTimes[cfg.prayerName];
          const pMins = timeToMinutes(pTime);
          if (pMins === null) {
            dayBookings.push({ type: "uncertain", label: `موعد مرتبط بالصلاة (${cfg.prayerName})` });
            return;
          }
          startMins = pMins + (Number(cfg.offsetMinutes) || 0);
          endMins = startMins; 
        } else {
          startMins = timeToMinutes(cfg.startTime);
          endMins = timeToMinutes(cfg.endTime);
        }

        if (startMins !== null) {
          const isGrp = sch.scheduleKind === "group";
          let resolvedStudentName = "طالب";
          if (!isGrp && sch.studentId) {
            resolvedStudentName = studentsMap.get(sch.studentId) || sch.studentName || "طالب";
          }
          const bookingId = `b_${Math.random().toString(36).substring(2, 9)}`;
          const bookingObj = {
            id: bookingId,
            start: startMins,
            end: endMins !== null ? endMins : startMins,
            hasEnd: endMins !== null,
            type: "booked",
            isGroup: isGrp,
            groupName: isGrp ? (sch.groupName || "مجموعة") : "",
            studentName: resolvedStudentName
          };
          bookingsMapRegistry.set(bookingId, bookingObj);
          dayBookings.push(bookingObj);
        }
      });

      overridesData.forEach(over => {
        if (over.status !== "rescheduled" || over.newDate !== dateString) return;
        const startMins = timeToMinutes(over.newStartTime);
        if (startMins !== null) {
          const isGrp = over.scheduleKind === "group";
          let resolvedStudentName = "طالب";
          if (!isGrp && over.studentId) {
            resolvedStudentName = studentsMap.get(over.studentId) || over.studentName || "طالب";
          }
          const bookingId = `b_${Math.random().toString(36).substring(2, 9)}`;
          const bookingObj = {
            id: bookingId,
            start: startMins,
            end: startMins,
            hasEnd: false,
            type: "booked",
            isGroup: isGrp,
            groupName: isGrp ? (over.groupName || "مجموعة") : "",
            studentName: resolvedStudentName + " (معاد جدولتها)"
          };
          bookingsMapRegistry.set(bookingId, bookingObj);
          dayBookings.push(bookingObj);
        }
      });

      const dayStartBoundary = START_HOUR * 60;
      const dayEndBoundary = END_HOUR * 60;
      
      dayBookings.sort((a, b) => a.start - b.start);

      let timelineSegmentsHtml = "";
      let currentTimePointer = dayStartBoundary;

      if (!prayerStatusOk) {
        timelineSegmentsHtml = `
          <div style="background: #f3f4f6; color: #4b5563; padding: 10px; border-radius: 6px; font-size: 0.8rem; border: 1px solid #d1d5db; width: 100%; text-align: center; box-sizing: border-box;">
            ⚠️ تعذر جلب مواقيت الصلاة بدقة. الفترات مصنفة كغير مؤكدة.
          </div>
        `;
      }

      dayBookings.forEach(booking => {
        if (booking.type === "uncertain") {
          timelineSegmentsHtml += `
            <div style="background: #9ca3af; color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 0.78rem; white-space: nowrap; flex-shrink: 0;">
              ❓ ${booking.label} (غير مؤكد)
            </div>
          `;
          return;
        }

        if (filterDuration > 0) {
          if (booking.start - currentTimePointer >= filterDuration) {
            timelineSegmentsHtml += `
              <div style="background: #22c55e; color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 0.78rem; white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px;">
                ✅ متاح (${formatTime12Hour(minutesToTime(currentTimePointer))} - ${formatTime12Hour(minutesToTime(booking.start))})
              </div>
            `;
          }
        } else {
          if (booking.start > currentTimePointer) {
            timelineSegmentsHtml += `
              <div style="background: #22c55e; color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 0.78rem; white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px;">
                🟢 متاح (${formatTime12Hour(minutesToTime(currentTimePointer))} - ${formatTime12Hour(minutesToTime(booking.start))})
              </div>
            `;
          }
        }

        timelineSegmentsHtml += `
          <button type="button" class="booked-slot-btn" data-booking-id="${booking.id}" style="background: #ef4444; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; font-size: 0.78rem; white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; font-weight: 600; cursor: pointer;">
            🔴 محجوز (${formatTime12Hour(minutesToTime(booking.start))})
          </button>
        `;

        if (booking.end > currentTimePointer) {
          currentTimePointer = booking.end;
        }
      });

      if (filterDuration > 0) {
        if (dayEndBoundary - currentTimePointer >= filterDuration) {
          timelineSegmentsHtml += `
            <div style="background: #22c55e; color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 0.78rem; white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px;">
              ✅ متاح (${formatTime12Hour(minutesToTime(currentTimePointer))} - ${formatTime12Hour(minutesToTime(dayEndBoundary))})
            </div>
          `;
        }
      } else {
        if (dayEndBoundary > currentTimePointer) {
          timelineSegmentsHtml += `
            <div style="background: #22c55e; color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 0.78rem; white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px;">
              🟢 متاح (${formatTime12Hour(minutesToTime(currentTimePointer))} - ${formatTime12Hour(minutesToTime(dayEndBoundary))})
            </div>
          `;
        }
      }

      daysHtml += `
        <div style="background: var(--card-bg, #fff); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; box-shadow: var(--shadow-sm); box-sizing: border-box; width: 100%;">
          <div style="font-weight: 700; margin-bottom: 10px; color: var(--text-main); font-size: 0.95rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
            <span>📅 ${dayConfigItem.name} <small style="color: var(--text-muted); font-weight: normal; font-size: 0.8rem;">(${dateString})</small></span>
          </div>
          <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; align-items: center; min-height: 46px; -webkit-overflow-scrolling: touch; width: 100%;">
            ${timelineSegmentsHtml || '<span style="color: var(--text-muted); font-size: 0.82rem;">لا توجد مواعيد مسجلة</span>'}
          </div>
        </div>
      `;
    }

    timelineEl.innerHTML = daysHtml;

    timelineEl.querySelectorAll(".booked-slot-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        const bId = e.currentTarget.getAttribute("data-booking-id");
        const booking = bookingsMapRegistry.get(bId);
        if (!booking) return;

        const modal = container.querySelector("#booking-detail-modal");
        const modalBody = container.querySelector("#booking-modal-body");
        if (!modal || !modalBody) return;

        const displayName = getShortDisplayName(booking);
        const startTimeStr = formatTime12Hour(minutesToTime(booking.start));
        const endTimeStr = booking.hasEnd ? formatTime12Hour(minutesToTime(booking.end)) : "غير محدد";

        modalBody.innerHTML = `
          <div>👤 <strong>الاسم:</strong> ${displayName}</div>
          <div>⏰ <strong>وقت البداية:</strong> ${startTimeStr}</div>
          <div>⌛ <strong>وقت النهاية:</strong> ${endTimeStr}</div>
          <div>🔴 <strong>حالة الحجز:</strong> محجوز فعلياً</div>
        `;

        modal.style.display = "flex";
      });
    });
  };

  await renderTimeline(0);

  const durationSelect = container.querySelector("#slot-duration-filter");
  if (durationSelect) {
    durationSelect.addEventListener("change", e => {
      const duration = Number(e.target.value) || 0;
      renderTimeline(duration);
    });
  }

  const modal = container.querySelector("#booking-detail-modal");
  const closeBtn = container.querySelector("#close-booking-modal");
  if (modal && closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });
    modal.addEventListener("click", ev => {
      if (ev.target === modal) {
        modal.style.display = "none";
      }
    });
  }
}
