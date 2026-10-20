/**
 * Parent Portal Component (Independent Parent Interface)
 * مكون واجهة بوابة ولي الأمر لعرض الأبناء وتقاريرهم
 */
import { parentService } from '../services/parentService.js';
import { parentAuth, parentAuthService } from '../services/parentAuthService.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

export function initParentPortalModule(container) {
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const sheikhIdFromUrl = urlParams.get('sheikh');

  container.innerHTML = `
    <div class="dashboard-container" style="max-width: 700px; margin: 40px auto; padding: 24px; background: var(--card-bg, #fff); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid var(--border-color);">
      
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid var(--border-color); padding-bottom: 16px;">
        <h2 style="color: var(--primary-color); font-size: 1.5rem; margin-bottom: 6px;">👨‍👩‍👧 بوابة ولي الأمر</h2>
        <p style="color: var(--text-muted); font-size: 0.9rem;">متابعة تقارير ومستوى الطالب في حلقة القرآن الكريم</p>
      </div>

      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 0.9rem; display: flex; flex-direction: column; gap: 6px;">
        <h4 style="color: var(--primary-color); font-size: 0.95rem; margin-bottom: 4px;">📞 معلومات التواصل مع المحفظ</h4>
        <p>👤 <strong>اسم المحفظ:</strong> الشيخ المسؤول</p>
        <p>🏛️ <strong>الحلقة:</strong> تحفيظ القرآن الكريم</p>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">ملاحظة: يمكنك التواصل مباشرة في أوقات الحلقات الرسمية.</p>
      </div>

      ${!sheikhIdFromUrl ? `
        <div style="color: #991b1b; background: #fee2e2; border: 1px solid #fca5a5; padding: 16px; border-radius: 8px; font-size: 0.95rem; text-align: center; font-weight: 600;">
          ⚠️ عذراً، رابط بوابة ولي الأمر غير مكتمل (معرّف الشيخ مفقود في الرابط). يرجى مراجعة المحفظ للحصول على الرابط الصحيح.
        </div>
      ` : `
        <form id="parent-login-form" style="display: flex; flex-direction: column; gap: 16px;">
          <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
            <label for="parent-phone-input" style="font-weight: 700; color: var(--text-main);">📱 أدخل رقم ولي الأمر (رقم الهاتف)</label>
            <input type="tel" id="parent-phone-input" class="search-input" placeholder="مثال: 01012345678" style="padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 1rem;" required />
          </div>

          <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
            <label for="parent-password-input" style="font-weight: 700; color: var(--text-main);">🔑 كلمة المرور</label>
            <input type="password" id="parent-password-input" class="search-input" placeholder="كلمة المرور الخاصة بولي الأمر" style="padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 1rem;" required />
          </div>

          <div id="parent-error-msg" style="color: #991b1b; background: #fee2e2; border: 1px solid #fca5a5; padding: 10px; border-radius: 6px; font-size: 0.85rem; display: none;"></div>

          <button type="submit" class="primary-action-btn" style="padding: 10px 20px; font-size: 1rem; width: 100%;">تسجيل الدخول ومتابعة</button>
        </form>
      `}

      <div id="parent-results-area" style="margin-top: 24px; display: none;"></div>

    </div>
  `;

  if (!sheikhIdFromUrl) return;

  const form = container.querySelector('#parent-login-form');
  const phoneInput = container.querySelector('#parent-phone-input');
  const passwordInput = container.querySelector('#parent-password-input');
  const errorMsg = container.querySelector('#parent-error-msg');
  const resultsArea = container.querySelector('#parent-results-area');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.style.display = 'none';
    errorMsg.textContent = '';
    resultsArea.style.display = 'none';
    resultsArea.innerHTML = '';

    const phone = phoneInput.value.trim();
    const password = passwordInput.value;

    try {
      const syntheticEmail = parentAuthService.generateSyntheticEmail(sheikhIdFromUrl, phone);
      await signInWithEmailAndPassword(parentAuth, syntheticEmail, password);

      const authStudentsRes = await parentService.getAuthenticatedParentStudents();
      if (!authStudentsRes.success) {
        errorMsg.textContent = authStudentsRes.error || "فشل تحميل بيانات الأبناء.";
        errorMsg.style.display = 'block';
        return;
      }

      const students = authStudentsRes.students;

      if (students.length === 0) {
        errorMsg.textContent = "لا توجد حسابات طلاب مرتبطة بهذه البيانات.";
        errorMsg.style.display = 'block';
        return;
      }

      if (students.length === 1) {
        await loadAndDisplayStudentReports(students[0], resultsArea);
      } else {
        let html = `
          <h3 style="font-size: 1.1rem; color: var(--primary-color); margin-bottom: 12px;">اختر الابن لعرض تقاريره:</h3>
          <div style="display: flex; flex-direction: column; gap: 10px;" id="students-selection-list">
            ${students.map(st => `
              <button type="button" class="secondary-btn select-student-btn" data-id="${st.id}" style="text-align: right; padding: 12px; font-size: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <span>👤 ${st.name} (${st.level || 'بدون مستوى'})</span>
                <span style="font-size: 0.85rem; color: var(--primary-color);">عرض التقارير ←</span>
              </button>
            `).join('')}
          </div>
        `;
        resultsArea.innerHTML = html;
        resultsArea.style.display = 'block';

        resultsArea.querySelectorAll('.select-student-btn').forEach(btn => {
          btn.addEventListener('click', async (evt) => {
            const studentId = evt.currentTarget.getAttribute('data-id');
            const selectedStudent = students.find(s => s.id === studentId);
            await loadAndDisplayStudentReports(selectedStudent, resultsArea);
          });
        });
      }

    } catch (authError) {
      console.error("Parent login error:", authError);
      errorMsg.textContent = "فشل تسجيل الدخول: تأكد من صحة رقم الهاتف أو كلمة المرور.";
      errorMsg.style.display = 'block';
    }
  });

  async function loadAndDisplayStudentReports(student, targetContainer) {
    targetContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 20px;">جاري تحميل تقارير الطالب ${student.name}...</p>`;
    targetContainer.style.display = 'block';

    const reportsRes = await parentService.getParentStudentReports(student.id);
    const reports = (reportsRes.success && reportsRes.data) ? reportsRes.data : [];

    let reportsHtml = `
      <div style="border-top: 2px solid var(--border-color); padding-top: 16px; margin-top: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="color: var(--primary-color); font-size: 1.2rem;">📊 تقارير الطالب: ${student.name}</h3>
          <button type="button" id="back-to-search-btn" class="secondary-btn" style="font-size: 0.8rem; padding: 4px 10px;">تسجيل خروج / بحث آخر</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px;">
    `;

    if (reports.length === 0) {
      reportsHtml += `<div class="no-data" style="padding: 20px; text-align: center; color: var(--text-muted);">لا توجد تقارير مسجلة لهذا الطالب حتى الآن.</div>`;
    } else {
      reportsHtml += reports.map(rep => {
        let dateStr = rep.date || '';
        let memText = (rep.memorization && rep.memorization.length > 0) ? rep.memorization.map(m => `سورة ${m.surah} (من آية ${m.fromAyah} إلى ${m.toAyah})`).join('<br>') : 'لا يوجد';
        let revText = (rep.review && rep.review.length > 0) ? rep.review.map(r => `سورة ${r.surah} (من آية ${r.fromAyah} إلى ${r.toAyah})`).join('<br>') : 'لا يوجد';
        let ratingText = (rep.rating !== null && rep.rating !== undefined) ? `${rep.rating} من 5 ⭐` : 'بدون تقييم';
        let notesText = rep.notes ? rep.notes : 'لا توجد ملاحظات';

        return `
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem;">
            <div style="display: flex; justify-content: space-between; font-weight: 700; color: var(--primary-color); border-bottom: 1px dashed var(--border-color); padding-bottom: 6px;">
              <span>📅 تاريخ الحصة: ${dateStr}</span>
              <span>⭐ التقييم: ${ratingText}</span>
            </div>
            <p>📖 <strong>الحفظ الجديد:</strong> ${memText}</p>
            <p>🔄 <strong>المراجعة:</strong> ${revText}</p>
            <p>📝 <strong>ملاحظات المحفظ:</strong> ${notesText}</p>
          </div>
        `;
      }).join('');
    }

    reportsHtml += `</div></div>`;
    targetContainer.innerHTML = reportsHtml;

    const backBtn = targetContainer.querySelector('#back-to-search-btn');
    if (backBtn) {
      backBtn.addEventListener('click', async () => {
        await parentAuth.signOut().catch(() => {});
        form.reset();
        targetContainer.style.display = 'none';
        targetContainer.innerHTML = '';
      });
    }
  }
}
