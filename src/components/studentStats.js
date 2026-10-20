/**
 * Student Statistics Component
 * تبويب إحصائيات الطلاب - عرض للقراءة فقط يعتمد على البيانات الحقيقية للطلاب والتقارير.
 */

import { studentService } from "../services/studentService.js";
import { reportService } from "../services/reportService.js";

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

export async function initStudentStatsModule(containerId) {
  const container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
  if (!container) return;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const defaultMonthValue = `${currentYear}-${currentMonth}`;

  container.innerHTML = `
    <div style="padding: 16px; display: flex; flex-direction: column; gap: 16px; max-width: 1200px; margin: 0 auto; direction: rtl; box-sizing: border-box; width: 100%;">
      
      <div style="background: var(--card-bg, #fff); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; box-shadow: var(--shadow-sm); box-sizing: border-box;">
        <h2 style="margin: 0 0 8px 0; color: var(--primary-color); font-size: 1.2rem;">📊 إحصائيات وسجل الطلاب</h2>
        <p style="margin: 0; color: var(--text-muted); font-size: 0.85rem; line-height: 1.5;">
          عرض تقارير الحفظ والمراجعة والسجل التاريخي للطالب خلال فترة زمنية محددة (للقراءة فقط).
        </p>

        <div style="margin-top: 14px; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label for="stats-student-select" style="font-weight: 700; font-size: 0.88rem;">👤 اختر الطالب:</label>
            <select id="stats-student-select" style="padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: #fff; font-size: 0.9rem; width: 100%; box-sizing: border-box;">
              <option value="">جاري تحميل الطلاب...</option>
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label for="stats-period-type" style="font-weight: 700; font-size: 0.88rem;">📅 الفترة الزمنية:</label>
            <select id="stats-period-type" style="padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: #fff; font-size: 0.9rem; width: 100%; box-sizing: border-box;">
              <option value="current_month">الشهر الحالي</option>
              <option value="prev_month">الشهر السابق</option>
              <option value="custom">فترة مخصصة</option>
            </select>
          </div>

          <div id="custom-date-range-container" style="display: none; gap: 8px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 140px; display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 0.8rem; font-weight: 600;">من تاريخ:</label>
              <input type="date" id="stats-start-date" style="padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); width: 100%; box-sizing: border-box;">
            </div>
            <div style="flex: 1; min-width: 140px; display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 0.8rem; font-weight: 600;">إلى تاريخ:</label>
              <input type="date" id="stats-end-date" style="padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); width: 100%; box-sizing: border-box;">
            </div>
          </div>
        </div>
      </div>

      <div id="stats-results-container" style="display: flex; flex-direction: column; gap: 16px; box-sizing: border-box; width: 100%;">
        <div style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 0.9rem;">الرجاء اختيار الطالب لعرض الإحصائيات...</div>
      </div>

    </div>
  `;

  let studentsList = [];
  try {
    const studRes = await studentService.getSheikhStudents();
    if (studRes.success && Array.isArray(studRes.data)) {
      studentsList = studRes.data;
    }
  } catch (err) {
    console.error("Error loading students for stats:", err);
  }

  const studentSelect = container.querySelector("#stats-student-select");
  if (studentSelect) {
    if (studentsList.length === 0) {
      studentSelect.innerHTML = `<option value="">لا يوجد طلاب مسجلون</option>`;
    } else {
      studentSelect.innerHTML = `<option value="">-- اضغط لاختيار طالب --</option>` + 
        studentsList.map(st => `<option value="${st.id}">${st.name || "طالب بدون اسم"}</option>`).join("");
    }
  }

  const periodSelect = container.querySelector("#stats-period-type");
  const customDateContainer = container.querySelector("#custom-date-range-container");

  if (periodSelect && customDateContainer) {
    periodSelect.addEventListener("change", e => {
      if (e.target.value === "custom") {
        customDateContainer.style.display = "flex";
      } else {
        customDateContainer.style.display = "none";
        triggerLoadStats();
      }
    });
  }

  const startDateInput = container.querySelector("#stats-start-date");
  const endDateInput = container.querySelector("#stats-end-date");
  if (startDateInput) startDateInput.addEventListener("change", triggerLoadStats);
  if (endDateInput) endDateInput.addEventListener("change", triggerLoadStats);
  if (studentSelect) studentSelect.addEventListener("change", triggerLoadStats);

  function getDateRange() {
    const periodType = periodSelect ? periodSelect.value : "current_month";
    let startStr = "";
    let endStr = "";

    const d = new Date();
    if (periodType === "current_month") {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
      startStr = `${y}-${m}-01`;
      endStr = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
    } else if (periodType === "prev_month") {
      d.setMonth(d.getMonth() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
      startStr = `${y}-${m}-01`;
      endStr = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
    } else if (periodType === "custom") {
      startStr = startDateInput ? startDateInput.value : "";
      endStr = endDateInput ? endDateInput.value : "";
    }
    return { startStr, endStr };
  }

  async function triggerLoadStats() {
    const studentId = studentSelect ? studentSelect.value : "";
    const resultsContainer = container.querySelector("#stats-results-container");
    if (!resultsContainer) return;

    if (!studentId) {
      resultsContainer.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 0.9rem;">الرجاء اختيار طالب لعرض الإحصائيات.</div>`;
      return;
    }

    resultsContainer.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 0.9rem;">جاري جلب التقارير وإحصائيات الطالب...</div>`;

    const { startStr, endStr } = getDateRange();

    let reports = [];
    try {
      reports = await reportService.getStudentReports(studentId);
      if (!Array.isArray(reports)) reports = [];
    } catch (err) {
      console.error("Error fetching reports for student stats:", err);
    }

    // فلترة التقارير حسب الفترة الزمنية الفعلية (باستخدام حقل date)
    const filteredReports = reports.filter(rep => {
      const repDate = String(rep.date || "").trim();
      if (!repDate) return false;
      if (startStr && repDate < startStr) return false;
      if (endStr && repDate > endStr) return false;
      return true;
    });

    // فرز التقارير تصاعدياً أو تنازلياً حسب التاريخ
    filteredReports.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    const totalReportsCount = filteredReports.length;
    const cancelledReportsCount = filteredReports.filter(r => r.status === "cancelled").length;
    const completedOrStandardCount = totalReportsCount - cancelledReportsCount;

    // تجميع الحفظ والمراجعة
    const memorizationList = [];
    const reviewList = [];

    filteredReports.forEach(rep => {
      if (rep.status !== "cancelled") {
        if (Array.isArray(rep.memorization)) {
          rep.memorization.forEach(item => {
            if (item) memorizationList.push({ date: rep.date, ...item });
          });
        }
        if (Array.isArray(rep.review)) {
          rep.review.forEach(item => {
            if (item) reviewList.push({ date: rep.date, ...item });
          });
        }
      }
    });

    let summaryHtml = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
        <div style="background: var(--card-bg, #fff); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; text-align: center; box-shadow: var(--shadow-sm);">
          <div style="font-size: 1.4rem; font-weight: 700; color: var(--primary-color);">${totalReportsCount}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">إجمالي التقارير المسجلة</div>
        </div>
        <div style="background: var(--card-bg, #fff); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; text-align: center; box-shadow: var(--shadow-sm);">
          <div style="font-size: 1.4rem; font-weight: 700; color: #22c55e;">${completedOrStandardCount}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">تقارير إتمام / عادية</div>
        </div>
        <div style="background: var(--card-bg, #fff); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; text-align: center; box-shadow: var(--shadow-sm);">
          <div style="font-size: 1.4rem; font-weight: 700; color: #ef4444;">${cancelledReportsCount}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">تقارير ملغاة</div>
        </div>
      </div>
    `;

    let memHtml = memorizationList.length === 0 
      ? `<div style="color: var(--text-muted); font-size: 0.85rem;">لا توجد مقاطع حفظ مسجلة في هذه الفترة.</div>`
      : memorizationList.map(item => `
          <div style="padding: 8px 12px; background: #f9fafb; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
            <span>📖 سورة <strong>${item.surah || "غير محددة"}</strong> (من آية ${item.fromAyah || "-"} إلى ${item.toAyah || "-"})</span>
            <span style="color: var(--text-muted); font-size: 0.78rem;">${item.date || ""}</span>
          </div>
        `).join("");

    let revHtml = reviewList.length === 0 
      ? `<div style="color: var(--text-muted); font-size: 0.85rem;">لا توجد مقاطع مراجعة مسجلة في هذه الفترة.</div>`
      : reviewList.map(item => `
          <div style="padding: 8px 12px; background: #f9fafb; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
            <span>🔄 سورة <strong>${item.surah || "غير محددة"}</strong> (من آية ${item.fromAyah || "-"} إلى ${item.toAyah || "-"})</span>
            <span style="color: var(--text-muted); font-size: 0.78rem;">${item.date || ""}</span>
          </div>
        `).join("");

    let historyHtml = filteredReports.length === 0
      ? `<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">لا توجد سجلات تاريخية في هذه الفترة.</div>`
      : filteredReports.map(rep => {
          const isCancelled = rep.status === "cancelled";
          const statusBadge = isCancelled 
            ? `<span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">ملغي</span>`
            : `<span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">تم التسجيل</span>`;
          
          return `
            <div style="background: var(--card-bg, #fff); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 6px; box-sizing: border-box;">
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
                <span style="font-weight: 700;">📅 التاريخ: ${rep.date || "غير معروف"}</span>
                ${statusBadge}
              </div>
              <div style="font-size: 0.82rem; color: var(--text-main); line-height: 1.5;">
                ${isCancelled ? `<div><strong>سبب الإلغاء:</strong> ${rep.cancellationReason || "بدون سبب"}</div>` : `
                  <div><strong>الحفظ:</strong> ${Array.isArray(rep.memorization) && rep.memorization.length > 0 ? rep.memorization.map(m => `سورة ${m.surah} (${m.fromAyah}-${m.toAyah})`).join("، ") : "لا يوجد"}</div>
                  <div><strong>المراجعة:</strong> ${Array.isArray(rep.review) && rep.review.length > 0 ? rep.review.map(r => `سورة ${r.surah} (${r.fromAyah}-${r.toAyah})`).join("، ") : "لا يوجد"}</div>
                `}
                ${rep.notes ? `<div><strong>ملاحظات:</strong> ${rep.notes}</div>` : ""}
              </div>
            </div>
          `;
        }).join("");

    resultsContainer.innerHTML = `
      ${summaryHtml}

      <div style="background: var(--card-bg, #fff); border: 1px solid var(--border-color); border-radius: 10px; padding: 16px; box-shadow: var(--shadow-sm);">
        <h3 style="margin: 0 0 12px 0; font-size: 1rem; color: var(--primary-color);">📖 سجل الحفظ خلال الفترة</h3>
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 250px; overflow-y: auto;">
          ${memHtml}
        </div>
      </div>

      <div style="background: var(--card-bg, #fff); border: 1px solid var(--border-color); border-radius: 10px; padding: 16px; box-shadow: var(--shadow-sm);">
        <h3 style="margin: 0 0 12px 0; font-size: 1rem; color: var(--primary-color);">🔄 سجل المراجعة خلال الفترة</h3>
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 250px; overflow-y: auto;">
          ${revHtml}
        </div>
      </div>

      <div style="background: var(--card-bg, #fff); border: 1px solid var(--border-color); border-radius: 10px; padding: 16px; box-shadow: var(--shadow-sm);">
        <h3 style="margin: 0 0 12px 0; font-size: 1rem; color: var(--primary-color);">📜 السجل التاريخي للحصص والتقارير</h3>
        <div style="display: flex; flex-direction: column; gap: 10px; max-height: 350px; overflow-y: auto;">
          ${historyHtml}
        </div>
      </div>
    `;
  }
}
