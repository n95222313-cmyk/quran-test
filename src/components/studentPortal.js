/**
 * Student Portal Component
 * واجهة الطالب داخل صفحة الدخول الموحدة
 */

import { studentAuthService } from "../services/studentAuthService.js";
import { studentPortalService } from "../services/studentPortalService.js";

/**
 * تشغيل بوابة الطالب
 *
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {Function} options.onLogout
 */
export async function initStudentPortal(container, options = {}) {
  if (!container) return;

  const onLogout =
    typeof options.onLogout === "function"
      ? options.onLogout
      : null;

  /* =========================================================
     Portal Shell
     ========================================================= */

  container.innerHTML = `
    <section class="student-portal">

      <div class="student-portal-header">

        <div class="student-portal-brand">
          <div class="student-portal-brand-icon">
            📖
          </div>

          <div>
            <div class="student-portal-brand-title">
              منظم الحفظ
            </div>

            <div class="student-portal-brand-subtitle">
              بوابة الطالب
            </div>
          </div>
        </div>

      </div>

      <div
        id="student-loading"
        class="student-message student-loading"
      >
        <div class="student-loading-icon">
          ⏳
        </div>

        <div>
          جاري تحميل بياناتك...
        </div>
      </div>

      <div
        id="student-content"
        class="student-content"
        style="display:none;"
      ></div>

    </section>
  `;

  const loading =
    container.querySelector("#student-loading");

  const content =
    container.querySelector("#student-content");

  /* =========================================================
     Load Student
     ========================================================= */

  const studentRes =
    await studentPortalService.getCurrentStudent();

  if (!studentRes.success) {

    loading.innerHTML = `
      <div class="student-error-icon">
        ⚠️
      </div>

      <div class="student-error-title">
        تعذر تحميل بيانات الطالب
      </div>

      <div class="student-error-text">
        ${escapeHtml(studentRes.error)}
      </div>
    `;

    return;
  }

  const student =
    studentRes.data;

  /* =========================================================
     Load Reports
     ========================================================= */

  const reportsRes =
    await studentPortalService.getStudentReports();

  const reports =
    reportsRes.success
      ? reportsRes.data
      : [];

  /* =========================================================
     Render
     ========================================================= */

  loading.style.display = "none";
  content.style.display = "block";

  renderStudentContent(
    content,
    student,
    reports,
    reportsRes,
    onLogout
  );
}


/* ============================================================
   Student Content
   ============================================================ */

function renderStudentContent(
  container,
  student,
  reports,
  reportsRes,
  onLogout
) {

  const reportsHtml =
    reports.length === 0

      ? `
        <div class="student-empty-state">

          <div class="student-empty-icon">
            📖
          </div>

          <div class="student-empty-title">
            لا توجد تقارير مسجلة لك حتى الآن
          </div>

          <div class="student-empty-text">
            ستظهر تقارير حصصك هنا بعد تسجيلها من المحفظ.
          </div>

        </div>
      `

      : reports
          .map(renderReport)
          .join("");

  let lastReportRatingDisplay = "-";
  if (reports.length > 0) {
    const rep = reports[0];
    const parts = [];
    if (rep.memorizationRating !== null && rep.memorizationRating !== undefined) {
      parts.text = `حفظ: ${rep.memorizationRating}/10`;
      parts.push(`حفظ: ${rep.memorizationRating}/10`);
    }
    if (rep.reviewRating !== null && rep.reviewRating !== undefined) {
      if (!parts.push) {
        // safety
      } else {
        parts.push(`مراجعة: ${rep.reviewRating}/10`);
      }
    }
    if (parts.length > 0) {
      lastReportRatingDisplay = parts.join(" | ");
    } else if (rep.rating !== null && rep.rating !== undefined) {
      lastReportRatingDisplay = `عام: ${rep.rating}/5`;
    }
  }


  container.innerHTML = `

    <!-- =====================================================
         Student Header
         ===================================================== -->

    <div
      class="student-welcome-card"
      style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:20px;
        flex-wrap:wrap;
      "
    >

      <div class="student-welcome-main">

        <div class="student-avatar">
          👤
        </div>

        <div class="student-welcome-text">

          <div class="student-small-label">
            الطالب
          </div>

          <h1>
            أهلاً بك يا
            ${escapeHtml(student.name || "طالب")}
          </h1>

          <div class="student-level">

            ${
              student.level
                ? `المستوى: ${escapeHtml(student.level)}`
                : "متابعة القرآن الكريم"
            }

          </div>

        </div>

      </div>


      <!-- ===================================================
           Student Logout Button
           =================================================== -->

      <button
        type="button"
        id="student-logout-btn"
        class="student-logout-btn"
        aria-label="تسجيل الخروج"
        style="
          display:inline-flex !important;
          align-items:center !important;
          justify-content:center !important;
          gap:8px !important;
          visibility:visible !important;
          opacity:1 !important;
          position:relative !important;
          z-index:99999 !important;
          cursor:pointer !important;
          padding:12px 20px !important;
          min-width:150px !important;
          min-height:46px !important;
          border:1px solid #d1d5db !important;
          border-radius:10px !important;
          background:#ffffff !important;
          color:#b91c1c !important;
          font-size:15px !important;
          font-weight:700 !important;
          line-height:1.4 !important;
          text-align:center !important;
          box-sizing:border-box !important;
        "
      >
        <span
          aria-hidden="true"
          style="
            display:inline-block !important;
            font-size:18px !important;
            line-height:1 !important;
          "
        >
          ↩
        </span>

        <span>
          تسجيل الخروج
        </span>

      </button>

    </div>


    <!-- =====================================================
         Statistics
         ===================================================== -->

    <div class="student-statistics">

      <div class="student-stat-card">

        <div class="student-stat-icon">
          📊
        </div>

        <div class="student-stat-info">

          <div class="student-stat-number">
            ${reports.length}
          </div>

          <div class="student-stat-label">
            إجمالي التقارير
          </div>

        </div>

      </div>


      <div class="student-stat-card">

        <div class="student-stat-icon">
          📖
        </div>

        <div class="student-stat-info">

          <div class="student-stat-number student-stat-date">
            ${
              reports.length
                ? escapeHtml(reports[0].date || "-")
                : "-"
            }
          </div>

          <div class="student-stat-label">
            آخر حصة
          </div>

        </div>

      </div>


      <div class="student-stat-card">

        <div class="student-stat-icon">
          ⭐
        </div>

        <div class="student-stat-info">

          <div class="student-stat-number" style="font-size: 1rem;">
            ${escapeHtml(lastReportRatingDisplay)}
          </div>

          <div class="student-stat-label">
            تقييم آخر حصة
          </div>

        </div>

      </div>

    </div>


    <!-- =====================================================
         Reports
         ===================================================== -->

    <div class="student-reports-section">

      <div class="student-section-header">

        <div>

          <div class="student-section-kicker">
            سجل المتابعة
          </div>

          <h2>
            📋 تقارير الحصص
          </h2>

        </div>

      </div>


      ${
        !reportsRes.success

          ? `
            <div class="student-error-box">

              <span>
                ⚠️
              </span>

              <span>
                ${escapeHtml(reportsRes.error)}
              </span>

            </div>
          `

          : reportsHtml
      }

    </div>

  `;


  /* =========================================================
     Logout
     ========================================================= */

  const logoutBtn =
    container.querySelector("#student-logout-btn");

  if (!logoutBtn) {
    console.error(
      "Student logout button was not found."
    );

    return;
  }


  logoutBtn.addEventListener(
    "click",
    async () => {

      if (logoutBtn.disabled) {
        return;
      }

      logoutBtn.disabled = true;

      logoutBtn.style.opacity = "0.7";

      logoutBtn.style.cursor = "wait";

      logoutBtn.innerHTML = `
        <span
          aria-hidden="true"
          style="
            display:inline-block !important;
            font-size:18px !important;
          "
        >
          ⏳
        </span>

        <span>
          جاري تسجيل الخروج...
        </span>
      `;


      try {

        await studentAuthService.logout();

      } catch (error) {

        console.error(
          "Student logout error:",
          error
        );

      } finally {

        if (onLogout) {

          try {

            await onLogout();

          } catch (error) {

            console.error(
              "Student logout callback error:",
              error
            );

          }

        }

      }

    }
  );

}


/* ============================================================
   Report
   ============================================================ */

function renderReport(report) {

  /* =========================================================
     Cancellation Report
     ========================================================= */

  if (
    report &&
    report.status === "cancelled"
  ) {

    return `

      <article
        class="student-report-card student-cancelled-report"
        style="
          border:1px solid #fecaca;
          background:#fff7f7;
        "
      >

        <div
          class="student-report-header"
          style="
            align-items:center;
            gap:12px;
          "
        >

          <div class="student-report-date">

            📅

            <strong>
              ${escapeHtml(report.date || "-")}
            </strong>

          </div>

          <div
            style="
              color:#b91c1c;
              font-weight:800;
            "
          >
            🚫 حصة ملغاة
          </div>

        </div>


        <div
          class="student-report-body"
          style="
            padding-top:10px;
          "
        >

          <div
            style="
              padding:18px;
              border-radius:12px;
              background:#fee2e2;
              color:#991b1b;
              text-align:center;
            "
          >

            <div
              style="
                font-size:34px;
                margin-bottom:8px;
              "
            >
              🚫
            </div>

            <div
              style="
                font-size:20px;
                font-weight:800;
                margin-bottom:8px;
              "
            >
              تم إلغاء هذه الحصة
            </div>

            <div
              style="
                font-size:14px;
                line-height:1.8;
              "
            >
              ${escapeHtml(
                report.notes ||
                "تم إلغاء الحصة من قِبل الشيخ."
              )}
            </div>

          </div>

        </div>

      </article>

    `;
  }


  /* =========================================================
     Normal Report
     ========================================================= */

  const memorization =
    Array.isArray(report.memorization)
      ? report.memorization
      : [];


  const review =
    Array.isArray(report.review)
      ? report.review
      : [];


  /* =========================================================
     Memorization
     ========================================================= */

  const memorizationHtml =
    memorization.length

      ? memorization
          .map(
            item => `
              <div class="quran-item">

                <div class="quran-item-icon">
                  📖
                </div>

                <div class="quran-item-text">

                  سورة
                  <strong>
                    ${escapeHtml(item.surah || "")}
                  </strong>

                  من آية
                  <strong>
                    ${escapeHtml(item.fromAyah || "")}
                  </strong>

                  إلى
                  <strong>
                    ${escapeHtml(item.toAyah || "")}
                  </strong>

                </div>

              </div>
            `
          )
          .join("")

      : `
          <div class="student-no-data">
            لا يوجد حفظ جديد مسجل
          </div>
        `;


  /* =========================================================
     Review
     ========================================================= */

  const reviewHtml =
    review.length

      ? review
          .map(
            item => `
              <div class="quran-item">

                <div class="quran-item-icon">
                  🔄
                </div>

                <div class="quran-item-text">

                  سورة
                  <strong>
                    ${escapeHtml(item.surah || "")}
                  </strong>

                  من آية
                  <strong>
                    ${escapeHtml(item.fromAyah || "")}
                  </strong>

                  إلى
                  <strong>
                    ${escapeHtml(item.toAyah || "")}
                  </strong>

                </div>

              </div>
            `
          )
          .join("")

      : `
          <div class="student-no-data">
            لا توجد مراجعة مسجلة
          </div>
        `;


  /* =========================================================
     Rating Display
     ========================================================= */

  let ratingHtml = "";
  if (
    report.memorizationRating !== null &&
    report.memorizationRating !== undefined
  ) {
    ratingHtml += `<div>📖 الحفظ: ${report.memorizationRating}/10</div>`;
  } else {
    ratingHtml += `<div>📖 الحفظ: بدون تقييم</div>`;
  }

  if (
    report.reviewRating !== null &&
    report.reviewRating !== undefined
  ) {
    ratingHtml += `<div>🔄 المراجعة: ${report.reviewRating}/10</div>`;
  } else {
    ratingHtml += `<div>🔄 المراجعة: بدون تقييم</div>`;
  }

  if (
    report.rating !== null &&
    report.rating !== undefined &&
    report.memorizationRating === undefined &&
    report.reviewRating === undefined
  ) {
    ratingHtml += `<div>⭐ تقييم عام قديم: ${report.rating}/5</div>`;
  }

  const lessonNumBadge = report.lessonNumber ? `<div style="background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:4px;font-weight:bold;margin-bottom:4px;">🔢 الحصة رقم ${report.lessonNumber}</div>` : "";


  /* =========================================================
     Final Report Card
     ========================================================= */

  return `

    <article class="student-report-card">

      <div class="student-report-header">

        <div class="student-report-date">

          📅

          <strong>
            ${escapeHtml(report.date || "-")}
          </strong>

        </div>

        <div class="student-report-rating" style="display:flex; flex-direction:column; gap:2px; font-size:0.75rem; text-align:left;">

          ${lessonNumBadge}

          ${ratingHtml}

        </div>

      </div>


      <div class="student-report-body">


        <!-- الحفظ -->

        <div class="student-report-section">

          <div class="student-report-section-title">
            📖 الحفظ الجديد
          </div>

          <div class="student-report-items">

            ${memorizationHtml}

          </div>

        </div>


        <!-- المراجعة -->

        <div class="student-report-section">

          <div class="student-report-section-title">
            🔄 المراجعة
          </div>

          <div class="student-report-items">

            ${reviewHtml}

          </div>

        </div>


        <!-- الملاحظات -->

        <div class="student-report-section">

          <div class="student-report-section-title">
            📝 ملاحظات المحفظ
          </div>

          <div class="student-notes">

            ${escapeHtml(
              report.notes || "لا توجد ملاحظات"
            )}

          </div>

        </div>


      </div>

    </article>

  `;
}


/* ============================================================
   Escape HTML
   ============================================================ */

function escapeHtml(value) {

  return String(value ?? "")

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#039;");
}
