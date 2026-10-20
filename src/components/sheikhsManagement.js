/**
 * Sheikhs Management Component (Center Admin View)
 * واجهة إدارة الشيوخ الخاصة بالإدارة المركزية
 */
import { adminService } from "../services/adminService.js";

export async function initSheikhsManagementModule(container) {
  if (!container) return;
  await renderSheikhsManagementView(container);
}

async function renderSheikhsManagementView(container) {
  container.innerHTML = `
    <div class="students-container">
      
      <div class="students-header-card">
        <div class="students-title-area">
          <h2>إدارة الشيوخ 👨‍🏫</h2>
          <p>إنشاء ومتابعة حسابات الشيوخ في المنظومة</p>
        </div>
        <button type="button" id="open-add-sheikh-modal-btn" class="primary-action-btn">+ إضافة شيخ جديد</button>
      </div>

      <div class="students-grid" id="sheikhs-grid-container">
        <div class="no-data">جاري تحميل قائمة الشيوخ...</div>
      </div>

    </div>

    <!-- نافذة إضافة شيخ جديد -->
    <div id="add-sheikh-modal" class="modal-overlay" style="display: none;">
      <div class="modal-content">
        <div class="modal-header">
          <h3>إضافة شيخ جديد</h3>
          <button type="button" id="close-sheikh-modal-btn" class="close-btn">&times;</button>
        </div>
        <form id="add-sheikh-form" class="modal-form">
          <div class="form-group">
            <label for="sheikh-name">اسم الشيخ*</label>
            <input type="text" id="sheikh-name" required placeholder="أدخل اسم الشيخ" />
          </div>
          <div class="form-group">
            <label for="sheikh-email">البريد الإلكتروني*</label>
            <input type="email" id="sheikh-email" required placeholder="sheikh@test.com" />
          </div>
          <div class="form-group">
            <label for="sheikh-password">كلمة المرور*</label>
            <input type="password" id="sheikh-password" required placeholder="6 أحرف على الأقل" minlength="6" />
          </div>
          <div id="sheikh-form-error" style="color: #991b1b; background: #fee2e2; border: 1px solid #fca5a5; padding: 10px; border-radius: 8px; font-size: 0.85rem; display: none;"></div>
          <div class="modal-actions">
            <button type="button" id="cancel-sheikh-modal-btn" class="secondary-btn">إلغاء</button>
            <button type="submit" id="form-sheikh-submit-btn" class="primary-action-btn">حفظ وإنشاء الحساب</button>
          </div>
        </form>
      </div>
    </div>
  `;

  await loadAndRenderSheikhsList(container);
  attachSheikhsEvents(container);
}

async function loadAndRenderSheikhsList(container) {
  const gridContainer = container.querySelector("#sheikhs-grid-container");
  const res = await adminService.getSheikhs();

  if (!res.success) {
    gridContainer.innerHTML = `<div class="no-data" style="color:#991b1b;">فشل تحميل قائمة الشيوخ: ${res.error}</div>`;
    return;
  }

  const sheikhs = res.data || [];

  if (sheikhs.length === 0) {
    gridContainer.innerHTML = `<div class="no-data">لا توجد حسابات شيوخ مسجلة حتى الآن.</div>`;
    return;
  }

  // جلب عدد الطلاب لكل شيخ باستخدام getCountFromServer بشكل متزامن وآمن
  const sheikhsWithCounts = await Promise.all(
    sheikhs.map(async (sh) => {
      let count = 0;
      try {
        count = await adminService.getSheikhStudentCount(sh.sheikhId);
      } catch (err) {
        console.error(`Failed to fetch student count for sheikh ${sh.sheikhId}:`, err);
      }
      return { ...sh, studentCount: count };
    })
  );

  gridContainer.innerHTML = sheikhsWithCounts.map(sh => `
    <div class="student-card" style="display: flex; flex-direction: column; gap: 8px;">
      <div class="student-card-header" style="border-bottom: none; padding-bottom: 0; display: flex; justify-content: space-between; align-items: center;">
        <h3 class="student-name">👤 ${sh.name || "بدون اسم"}</h3>
        <span class="badge ${sh.disabled ? 'unpaid' : 'completed'}" style="font-size: 0.75rem;">
          ${sh.disabled ? 'معطل' : 'نشط'}
        </span>
      </div>
      <div class="student-card-body" style="display: flex; flex-direction: column; gap: 4px; font-size: 0.88rem; color: var(--text-muted);">
        <p>📧 <strong>البريد:</strong> ${sh.email || "غير متوفر"}</p>
        <p>👥 <strong>عدد الطلاب:</strong> ${sh.studentCount}</p>
        <p style="word-break: break-all;">🔑 <strong>UID:</strong> <span style="font-family: monospace; font-size: 0.8rem;">${sh.sheikhId}</span></p>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; border-top: 1px solid var(--border-color); padding-top: 8px;">
        <button type="button" class="secondary-btn toggle-status-btn" data-id="${sh.sheikhId}" data-disabled="${sh.disabled ? 'true' : 'false'}" style="font-size: 0.78rem; padding: 5px 10px; background: ${sh.disabled ? '#dcfce7; color: #166534;' : '#fee2e2; color: #991b1b;'}">
          ${sh.disabled ? '✅ تفعيل الحساب' : '🚫 تعطيل الحساب'}
        </button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll(".toggle-status-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const sheikhUid = e.currentTarget.getAttribute("data-id");
      const currentDisabled = e.currentTarget.getAttribute("data-disabled") === "true";
      const newStatus = !currentDisabled;

      const confirmed = confirm(`هل أنت متأكد من رغبتك في ${newStatus ? 'تعطيل' : 'تفعيل'} هذا الشيخ؟`);
      if (!confirmed) return;

      const updateRes = await adminService.updateSheikhStatus(sheikhUid, newStatus);
      if (updateRes.success) {
        await loadAndRenderSheikhsList(container);
      } else {
        alert("فشل تحديث الحالة: " + updateRes.error);
      }
    });
  });
}

function attachSheikhsEvents(container) {
  const modal = container.querySelector("#add-sheikh-modal");
  const openBtn = container.querySelector("#open-add-sheikh-modal-btn");
  const closeBtn = container.querySelector("#close-sheikh-modal-btn");
  const cancelBtn = container.querySelector("#cancel-sheikh-modal-btn");
  const form = container.querySelector("#add-sheikh-form");
  const errorBox = container.querySelector("#sheikh-form-error");
  const submitBtn = container.querySelector("#form-sheikh-submit-btn");

  const toggleModal = (show) => {
    modal.style.display = show ? "flex" : "none";
    if (show) {
      form.reset();
      errorBox.style.display = "none";
      errorBox.textContent = "";
    }
  };

  openBtn.addEventListener("click", () => toggleModal(true));
  closeBtn.addEventListener("click", () => toggleModal(false));
  cancelBtn.addEventListener("click", () => toggleModal(false));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) toggleModal(false);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.style.display = "none";
    errorBox.textContent = "";

    const name = container.querySelector("#sheikh-name").value.trim();
    const email = container.querySelector("#sheikh-email").value.trim();
    const password = container.querySelector("#sheikh-password").value;

    if (!name || !email || !password) {
      errorBox.textContent = "جميع الحقول مطلوبة.";
      errorBox.style.display = "block";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "جاري الإنشاء...";

    try {
      const result = await adminService.createSheikhAccount({ name, email, password });

      if (result.success) {
        toggleModal(false);
        await loadAndRenderSheikhsList(container);
        alert("تم إنشاء حساب الشيخ بنجاح ✅");
      } else {
        errorBox.textContent = result.error || "فشل إنشاء حساب الشيخ.";
        errorBox.style.display = "block";
      }
    } catch (err) {
      errorBox.textContent = err.message || "حدث خطأ غير متوقع.";
      errorBox.style.display = "block";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "حفظ وإنشاء الحساب";
    }
  });
}
