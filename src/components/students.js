/**
 * Students Data & Business Logic Layer (Firestore Integration)
 * طبقة إدارة الطلاب متكاملة مباشرة مع Firestore عبر studentService
 *
 * يدعم:
 * - إضافة طالب
 * - تعديل طالب
 * - حذف طالب
 * - عرض ملف الطالب
 * - عرض آخر تقرير
 * - إرسال آخر تقرير عبر WhatsApp
 * - إنشاء حساب دخول مستقل للطالب
 */

import { studentService } from '../services/studentService.js';
import { reportService } from '../services/reportService.js';


function normalizeArabicText(text) {
  if (text === null || text === undefined) return '';

  let str = String(text).toLowerCase();

  str = str.replace(/[\u064b-\u0652]/g, '');
  str = str.replace(/[أإآٱ]/g, 'ا');
  str = str.replace(/ى/g, 'ي');
  str = str.replace(/ـ/g, '');
  str = str.replace(/\s+/g, ' ').trim();

  return str;
}


function filterStudents(studentsList, filters = {}) {
  return studentsList.filter(st => {

    if (filters.nameQuery) {
      const normQuery =
        normalizeArabicText(filters.nameQuery);

      const normName =
        normalizeArabicText(st.name);

      const normAddr =
        normalizeArabicText(st.address);

      const normLevel =
        normalizeArabicText(st.level);

      const matchesAny =
        normName.includes(normQuery) ||
        normAddr.includes(normQuery) ||
        normLevel.includes(normQuery);

      if (!matchesAny) return false;
    }


    if (filters.addressQuery) {
      const normAddr =
        normalizeArabicText(st.address);

      const normAddrQuery =
        normalizeArabicText(filters.addressQuery);

      if (!normAddr.includes(normAddrQuery)) {
        return false;
      }
    }


    if (
      filters.ageQuery !== undefined &&
      filters.ageQuery !== ''
    ) {
      if (
        Number(st.age) !==
        Number(filters.ageQuery)
      ) {
        return false;
      }
    }


    if (
      filters.levelQuery &&
      filters.levelQuery !== 'all'
    ) {
      const normLevel =
        normalizeArabicText(st.level);

      const normLevelQuery =
        normalizeArabicText(
          filters.levelQuery
        );

      if (
        !normLevel.includes(
          normLevelQuery
        )
      ) {
        return false;
      }
    }


    return true;
  });
}


export async function initStudentsModule(container) {
  if (!container) return;

  const result =
    await studentService.getSheikhStudents();

  if (!result.success) {

    console.error(
      'Error fetching students from Firestore:',
      result.error
    );

    container.innerHTML = `
      <div class="no-data">
        عذراً، حدث خطأ أثناء تحميل بيانات الطلاب من قاعدة البيانات.
      </div>
    `;

    return;
  }


  const studentsList =
    result.data || [];

  renderStudentsView(
    container,
    studentsList
  );
}


function renderStudentsView(
  container,
  studentsList
) {

  const uniqueLevels = [
    ...new Set(
      studentsList
        .map(st => st.level)
        .filter(Boolean)
    )
  ];


  container.innerHTML = `

    <div class="students-container">

      <div class="students-header-card">

        <div class="students-title-area">

          <h2>
            إدارة الطلاب 👥
          </h2>

          <p>
            إجمالي عدد الطلاب المسجلين:
            <span id="total-students-count">
              ${studentsList.length}
            </span>
            طالب
          </p>

        </div>


        <button
          type="button"
          id="open-add-modal-btn"
          class="primary-action-btn"
        >
          + إضافة طالب
        </button>

      </div>


      <div class="filters-panel">

        <div class="search-bar-wrapper">

          <input
            type="text"
            id="student-search-input"
            class="search-input"
            placeholder="🔍 بحث مرن (الاسم، العنوان، المستوى)..."
          />

        </div>


        <div class="filters-grid">

          <input
            type="text"
            id="filter-address"
            class="filter-input"
            placeholder="فلتر حسب العنوان..."
          />


          <input
            type="number"
            id="filter-age"
            class="filter-input"
            placeholder="فلتر حسب العمر..."
          />


          <select
            id="filter-level"
            class="filter-select"
          >

            <option value="all">
              جميع المستويات
            </option>

            ${uniqueLevels
              .map(
                lvl =>
                  `<option value="${lvl}">
                    ${lvl}
                  </option>`
              )
              .join('')}

          </select>


          <button
            type="button"
            id="reset-filters-btn"
            class="secondary-btn"
          >
            مسح الفلاتر
          </button>

        </div>

      </div>


      <div
        class="students-grid"
        id="students-grid-container"
      >
        ${renderStudentsCards(studentsList)}
      </div>

    </div>


    <!-- إضافة / تعديل طالب -->

    <div
      id="add-student-modal"
      class="modal-overlay"
      style="display: none;"
    >

      <div class="modal-content">

        <div class="modal-header">

          <h3 id="modal-title">
            إضافة طالب جديد
          </h3>

          <button
            type="button"
            id="close-modal-btn"
            class="close-btn"
          >
            &times;
          </button>

        </div>


        <form
          id="add-student-form"
          class="modal-form"
        >

          <input
            type="hidden"
            id="st-edit-id"
            value=""
          />


          <div class="form-group">

            <label for="st-name">
              اسم الطالب ثلاثي*
            </label>

            <input
              type="text"
              id="st-name"
              required
              placeholder="أدخل اسم الطالب"
            />

          </div>


          <div class="form-group">

            <label for="st-age">
              العمر
            </label>

            <input
              type="number"
              id="st-age"
              placeholder="مثال: 10"
            />

          </div>


          <div class="form-group">

            <label for="st-address">
              العنوان
            </label>

            <input
              type="text"
              id="st-address"
              placeholder="مثال: السويس - حي فيصل"
            />

          </div>


          <div class="form-group">

            <label for="st-phone">
              رقم ولي الأمر
            </label>

            <input
              type="tel"
              id="st-phone"
              placeholder="01xxxxxxxxx"
            />

          </div>


          <div class="form-group">

            <label for="st-level">
              المستوى
            </label>

            <input
              type="text"
              id="st-level"
              placeholder="مثال: حفظ جزء عم"
            />

          </div>


          <div class="form-group">
            <label for="st-subscription">قيمة الاشتراك الشهري (اختياري)</label>
            <input type="number" id="st-subscription" step="0.01" placeholder="مثال: 300" />
          </div>

          <div class="form-group">
            <label for="st-target-lessons">عدد الحصص المستهدف شهرياً (اختياري)</label>
            <input type="number" id="st-target-lessons" min="1" step="1" placeholder="مثال: 8" />
          </div>


          <div class="form-group">

            <label for="st-notes">
              ملاحظات
            </label>

            <textarea
              id="st-notes"
              placeholder="ملاحظات إضافية..."
            ></textarea>

          </div>


          <div class="modal-actions">

            <button
              type="button"
              id="cancel-modal-btn"
              class="secondary-btn"
            >
              إلغاء
            </button>


            <button
              type="submit"
              id="form-submit-btn"
              class="primary-action-btn"
            >
              حفظ الطالب
            </button>

          </div>

        </form>

      </div>

    </div>


    <!-- ملف الطالب -->

    <div
      id="student-profile-modal"
      class="modal-overlay"
      style="display: none;"
    >

      <div class="modal-content">

        <div class="modal-header">

          <h3>
            ملف الطالب
          </h3>

          <button
            type="button"
            id="close-profile-btn"
            class="close-btn"
          >
            &times;
          </button>

        </div>


        <div
          class="modal-form"
          id="student-profile-body"
        ></div>


        <div
          class="modal-actions"
          style="
            padding: 0 20px 20px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
          "
        >

          <div
            style="
              display: flex;
              gap: 8px;
              flex-wrap: wrap;
            "
          >

            <button
              type="button"
              id="profile-whatsapp-btn"
              class="secondary-btn"
              style="
                background: #dcfce7;
                color: #166534;
                border: 1px solid #bbf7d0;
              "
            >
              📱 إرسال آخر تقرير
            </button>


            <button
              type="button"
              id="profile-account-btn"
              class="secondary-btn"
              style="
                background: #ede9fe;
                color: #5b21b6;
                border: 1px solid #ddd6fe;
              "
            >
              🔐 إنشاء حساب الطالب
            </button>


            <button
              type="button"
              id="profile-edit-btn"
              class="secondary-btn"
              style="
                background: #e0f2fe;
                color: #0369a1;
              "
            >
              ✏️ تعديل الطالب
            </button>


            <button
              type="button"
              id="profile-delete-btn"
              class="secondary-btn"
              style="
                background: #fee2e2;
                color: #991b1b;
              "
            >
              🗑️ حذف الطالب
            </button>

          </div>


          <button
            type="button"
            id="profile-close-action-btn"
            class="secondary-btn"
          >
            إغلاق
          </button>

        </div>

      </div>

    </div>

  `;


  attachStudentsEvents(
    container,
    studentsList
  );
}


function renderStudentsCards(list) {

  if (list.length === 0) {

    return `
      <div class="no-data">
        لا توجد نتائج مطابقة للبحث أو الفلاتر المحددة
      </div>
    `;
  }


  return list
    .map(
      st => `

        <div
          class="student-card clickable-card"
          data-id="${st.id}"
          style="
            cursor: pointer;
            transition:
              transform 0.2s ease,
              box-shadow 0.2s ease;
          "
        >

          <div
            class="student-card-header"
            style="
              border-bottom: none;
              padding-bottom: 0;
            "
          >

            <h3 class="student-name">
              👤 ${st.name}
            </h3>

          </div>


          <div
            class="student-card-body"
            style="
              display: flex;
              flex-direction: column;
              gap: 4px;
              font-size: 0.9rem;
              color: var(--text-muted);
            "
          >

            <p class="student-age">
              🎂 <strong>العمر:</strong>
              ${st.age !== undefined && st.age !== null && st.age !== ''
                ? `${st.age} سنوات`
                : 'غير محدد'}
            </p>


            <p class="student-address">
              📍 <strong>العنوان:</strong>
              ${st.address || 'غير محدد'}
            </p>


            <p class="student-phone">
              📞 <strong>ولي الأمر:</strong>
              ${st.parentPhone || 'غير محدد'}
            </p>


            <p class="student-level">
              📚 <strong>المستوى:</strong>
              ${st.level || 'غير محدد'}
            </p>

            ${st.monthlySubscription !== undefined && st.monthlySubscription !== null && st.monthlySubscription !== '' ? `<p class="student-sub">💰 <strong>الاشتراك:</strong> ${st.monthlySubscription}</p>` : ''}
            ${st.targetLessonsCount !== undefined && st.targetLessonsCount !== null && st.targetLessonsCount !== '' ? `<p class="student-target">🎯 <strong>الهدف الشهري:</strong> ${st.targetLessonsCount} حصص</p>` : ''}


            <p
              class="student-account-status"
              style="
                margin-top: 6px;
                font-size: 0.82rem;
                font-weight: 700;
                color: ${
                  st.studentAuthUid
                    ? '#166534'
                    : '#64748b'
                };
              "
            >
              ${
                st.studentAuthUid
                  ? '🔐 حساب الطالب مفعل'
                  : '🔓 لا يوجد حساب دخول'
              }
            </p>

          </div>

        </div>

      `
    )
    .join('');
}


function attachStudentsEvents(
  container,
  initialStudentsList
) {

  let currentStudentsList =
    [...initialStudentsList];


  const searchInput =
    container.querySelector(
      '#student-search-input'
    );

  const filterAddress =
    container.querySelector(
      '#filter-address'
    );

  const filterAge =
    container.querySelector(
      '#filter-age'
    );

  const filterLevel =
    container.querySelector(
      '#filter-level'
    );

  const resetFiltersBtn =
    container.querySelector(
      '#reset-filters-btn'
    );

  const gridContainer =
    container.querySelector(
      '#students-grid-container'
    );


  const modal =
    container.querySelector(
      '#add-student-modal'
    );

  const openModalBtn =
    container.querySelector(
      '#open-add-modal-btn'
    );

  const closeModalBtn =
    container.querySelector(
      '#close-modal-btn'
    );

  const cancelModalBtn =
    container.querySelector(
      '#cancel-modal-btn'
    );

  const form =
    container.querySelector(
      '#add-student-form'
    );

  const modalTitle =
    container.querySelector(
      '#modal-title'
    );

  const formSubmitBtn =
    container.querySelector(
      '#form-submit-btn'
    );

  const editIdInput =
    container.querySelector(
      '#st-edit-id'
    );

  const phoneInput =
    container.querySelector(
      '#st-phone'
    );

  const subscriptionInput =
    container.querySelector(
      '#st-subscription'
    );

  const targetLessonsInput =
    container.querySelector(
      '#st-target-lessons'
    );


  const profileModal =
    container.querySelector(
      '#student-profile-modal'
    );

  const closeProfileBtn =
    container.querySelector(
      '#close-profile-btn'
    );

  const profileCloseActionBtn =
    container.querySelector(
      '#profile-close-action-btn'
    );

  const profileBody =
    container.querySelector(
      '#student-profile-body'
    );

  const profileEditBtn =
    container.querySelector(
      '#profile-edit-btn'
    );

  const profileDeleteBtn =
    container.querySelector(
      '#profile-delete-btn'
    );

  const profileWhatsappBtn =
    container.querySelector(
      '#profile-whatsapp-btn'
    );

  const profileAccountBtn =
    container.querySelector(
      '#profile-account-btn'
    );


  let activeStudentId =
    null;


  const reloadStudentsFromFirestore =
    async () => {

      const result =
        await studentService.getSheikhStudents();

      if (result.success) {

        currentStudentsList =
          result.data || [];

        updateView();
      }
    };


  const updateView = () => {

    const filters = {

      nameQuery:
        searchInput.value,

      addressQuery:
        filterAddress.value,

      ageQuery:
        filterAge.value,

      levelQuery:
        filterLevel.value

    };


    const results =
      filterStudents(
        currentStudentsList,
        filters
      );


    const totalCountSpan =
      container.querySelector(
        '#total-students-count'
      );


    if (totalCountSpan) {

      totalCountSpan.textContent =
        currentStudentsList.length;
    }


    gridContainer.innerHTML =
      renderStudentsCards(results);


    attachCardClickEvents();
  };


  searchInput.addEventListener(
    'input',
    updateView
  );


  filterAddress.addEventListener(
    'input',
    updateView
  );


  filterAge.addEventListener(
    'input',
    updateView
  );


  filterLevel.addEventListener(
    'change',
    updateView
  );


  resetFiltersBtn.addEventListener(
    'click',
    () => {

      searchInput.value = '';

      filterAddress.value = '';

      filterAge.value = '';

      filterLevel.value = 'all';

      updateView();
    }
  );


  const toggleModal = (
    show,
    isEditing = false,
    studentData = null
  ) => {

    modal.style.display =
      show ? 'flex' : 'none';


    if (!show) return;


    if (
      isEditing &&
      studentData
    ) {

      modalTitle.textContent =
        'تعديل بيانات الطالب';


      formSubmitBtn.textContent =
        'حفظ التعديلات';


      editIdInput.value =
        studentData.id;


      container.querySelector(
        '#st-name'
      ).value =
        studentData.name || '';


      container.querySelector(
        '#st-age'
      ).value =
        studentData.age !== undefined &&
        studentData.age !== null &&
        studentData.age !== ''
          ? studentData.age
          : '';


      container.querySelector(
        '#st-address'
      ).value =
        studentData.address || '';


      phoneInput.value =
        studentData.parentPhone || '';


      container.querySelector(
        '#st-level'
      ).value =
        studentData.level || '';

      if (subscriptionInput) {
        subscriptionInput.value = studentData.monthlySubscription !== undefined && studentData.monthlySubscription !== null ? studentData.monthlySubscription : '';
      }

      if (targetLessonsInput) {
        targetLessonsInput.value = studentData.targetLessonsCount !== undefined && studentData.targetLessonsCount !== null ? studentData.targetLessonsCount : '';
      }


      container.querySelector(
        '#st-notes'
      ).value =
        studentData.notes || '';

    } else {

      modalTitle.textContent =
        'إضافة طالب جديد';


      formSubmitBtn.textContent =
        'حفظ الطالب';


      editIdInput.value = '';

      form.reset();
    }
  };


  openModalBtn.addEventListener(
    'click',
    () =>
      toggleModal(
        true,
        false
      )
  );


  closeModalBtn.addEventListener(
    'click',
    () =>
      toggleModal(false)
  );


  cancelModalBtn.addEventListener(
    'click',
    () =>
      toggleModal(false)
  );


  modal.addEventListener(
    'click',
    e => {

      if (e.target === modal) {
        toggleModal(false);
      }

    }
  );


  form.addEventListener(
    'submit',
    async e => {

      e.preventDefault();


      const editId =
        editIdInput.value;


      const phoneVal =
        phoneInput.value.trim();


      const ageInput =
        container.querySelector(
          '#st-age'
        );


      const ageValue =
        ageInput.value.trim();


      const studentData = {

        name:
          container.querySelector(
            '#st-name'
          ).value.trim(),

        age:
          ageValue === ''
            ? ''
            : Number(ageValue),

        address:
          container.querySelector(
            '#st-address'
          ).value.trim(),

        parentPhone:
          phoneVal,

        level:
          container.querySelector(
            '#st-level'
          ).value.trim(),

        monthlySubscription:
          subscriptionInput && subscriptionInput.value.trim() !== '' ? subscriptionInput.value.trim() : null,

        targetLessonsCount:
          targetLessonsInput && targetLessonsInput.value.trim() !== '' ? targetLessonsInput.value.trim() : null,

        notes:
          container.querySelector(
            '#st-notes'
          ).value.trim()

      };


      if (editId) {

        const result =
          await studentService.updateStudent(
            editId,
            studentData
          );


        if (result.success) {

          toggleModal(false);

          await reloadStudentsFromFirestore();


          if (
            profileModal.style.display === 'flex' &&
            activeStudentId === editId
          ) {

            await openProfileModal(
              editId
            );
          }

        } else {

          alert(
            'حدث خطأ أثناء التعديل: ' +
              (
                result.error ||
                'يرجى المحاولة لاحقاً.'
              )
          );
        }


      } else {

        const result =
          await studentService.addStudent(
            studentData
          );


        if (result.success) {

          toggleModal(false);

          await reloadStudentsFromFirestore();

        } else {

          alert(
            'حدث خطأ أثناء إضافة الطالب: ' +
              (
                result.error ||
                'يرجى المحاولة لاحقاً.'
              )
          );
        }
      }
    }
  );


  const openProfileModal =
    async studentId => {

      activeStudentId =
        studentId;


      const student =
        currentStudentsList.find(
          st => st.id === studentId
        );


      if (!student) return;


      /*
       * تحديث حالة زر حساب الطالب
       */
      if (profileAccountBtn) {

        if (student.studentAuthUid) {

          profileAccountBtn.textContent =
            '✅ حساب الطالب موجود';

          profileAccountBtn.disabled =
            true;

          profileAccountBtn.style.opacity =
            '0.75';

          profileAccountBtn.style.cursor =
            'default';

        } else {

          profileAccountBtn.textContent =
            '🔐 إنشاء حساب الطالب';

          profileAccountBtn.disabled =
            false;

          profileAccountBtn.style.opacity =
            '1';

          profileAccountBtn.style.cursor =
            'pointer';
        }
      }


      profileBody.innerHTML = `

        <div
          style="
            display: flex;
            flex-direction: column;
            gap: 12px;
            font-size: 0.95rem;
          "
        >

          <div
            style="
              border-bottom: 1px solid var(--border-color);
              padding-bottom: 10px;
            "
          >

            <p>
              👤
              <strong>اسم الطالب:</strong>
              ${student.name}
            </p>


            <p>
              🎂
              <strong>العمر:</strong>
              ${
                student.age !== undefined &&
                student.age !== null &&
                student.age !== ''
                  ? `${student.age} سنوات`
                  : 'غير محدد'
              }
            </p>


            <p>
              📍
              <strong>العنوان:</strong>
              ${student.address || 'غير محدد'}
            </p>


            <p>
              📞
              <strong>رقم ولي الأمر:</strong>
              ${student.parentPhone || 'غير محدد'}
            </p>


            <p>
              📚
              <strong>المستوى:</strong>
              ${student.level || 'غير محدد'}
            </p>

            ${student.monthlySubscription !== undefined && student.monthlySubscription !== null && student.monthlySubscription !== '' ? `<p>💰 <strong>الاشتراك الشهري:</strong> ${student.monthlySubscription}</p>` : ''}
            ${student.targetLessonsCount !== undefined && student.targetLessonsCount !== null && student.targetLessonsCount !== '' ? `<p>🎯 <strong>الهدف الشهري:</strong> ${student.targetLessonsCount} حصص</p>` : ''}


            <p>
              💬
              <strong>الملاحظات:</strong>
              ${student.notes || 'لا توجد ملاحظات'}
            </p>


            <p>
              🔐
              <strong>حساب الطالب:</strong>

              ${
                student.studentAuthUid
                  ? '<span style="color:#166534;font-weight:700;">مفعل</span>'
                  : '<span style="color:#64748b;">غير موجود</span>'
              }
            </p>

          </div>


          <div
            style="
              background: #f8fafc;
              padding: 12px;
              border-radius: 10px;
              border: 1px dashed var(--border-color);
              display: flex;
              flex-direction: column;
              gap: 6px;
            "
            id="student-report-summary-box"
          >

            <h4
              style="
                font-size: 0.9rem;
                color: var(--primary-color);
              "
            >
              📊 ملخص سجل المتابعة
            </h4>


            <p
              style="
                font-size: 0.850rem;
                color: var(--text-muted);
              "
            >
              جاري تحميل سجل المتابعة...
            </p>

          </div>

        </div>

      `;


      profileModal.style.display =
        'flex';


      const summaryBox =
        container.querySelector(
          '#student-report-summary-box'
        );


      try {

        const lastReport =
          await reportService.getLastStudentReport(
            studentId
          );


        if (
          !summaryBox ||
          !summaryBox.isConnected
        ) {
          return;
        }


        if (!lastReport) {

          summaryBox.innerHTML = `

            <h4
              style="
                font-size: 0.9rem;
                color: var(--primary-color);
              "
            >
              📊 ملخص سجل المتابعة
            </h4>


            <p
              style="
                font-size: 0.850rem;
                color: var(--text-muted);
              "
            >
              لا توجد تقارير مسجلة بعد
            </p>

          `;

          return;
        }


        let memorizationHtml =
          'لا يوجد';


        if (
          lastReport.memorization &&
          lastReport.memorization.length > 0
        ) {

          memorizationHtml =
            lastReport.memorization
              .map(
                m =>
                  `سورة ${m.surah} (من آية ${m.fromAyah} إلى آية ${m.toAyah})`
              )
              .join('<br>');
        }


        let reviewHtml =
          'لا يوجد';


        if (
          lastReport.review &&
          lastReport.review.length > 0
        ) {

          reviewHtml =
            lastReport.review
              .map(
                r =>
                  `سورة ${r.surah} (من آية ${r.fromAyah} إلى آية ${r.toAyah})`
              )
              .join('<br>');
        }


        let ratingSummaryHtml = "";
        if (
          lastReport.memorizationRating !== null &&
          lastReport.memorizationRating !== undefined
        ) {
          ratingSummaryHtml += `<p style="font-size: 0.850rem; color: var(--text-muted);">📖 <strong>تقييم الحفظ:</strong> <span style="color: #1e293b;">${lastReport.memorizationRating} من 10</span></p>`;
        } else {
          ratingSummaryHtml += `<p style="font-size: 0.850rem; color: var(--text-muted);">📖 <strong>تقييم الحفظ:</strong> <span style="color: #1e293b;">بدون تقييم</span></p>`;
        }

        if (
          lastReport.reviewRating !== null &&
          lastReport.reviewRating !== undefined
        ) {
          ratingSummaryHtml += `<p style="font-size: 0.850rem; color: var(--text-muted);">🔄 <strong>تقييم المراجعة:</strong> <span style="color: #1e293b;">${lastReport.reviewRating} من 10</span></p>`;
        } else {
          ratingSummaryHtml += `<p style="font-size: 0.850rem; color: var(--text-muted);">🔄 <strong>تقييم المراجعة:</strong> <span style="color: #1e293b;">بدون تقييم</span></p>`;
        }

        if (
          lastReport.rating !== null &&
          lastReport.rating !== undefined &&
          lastReport.memorizationRating === undefined &&
          lastReport.reviewRating === undefined
        ) {
          ratingSummaryHtml += `<p style="font-size: 0.850rem; color: var(--text-muted);">⭐ <strong>التقييم العام القديم:</strong> <span style="color: #1e293b;">${lastReport.rating} من 5</span></p>`;
        }

        const lessonNumSummary = lastReport.lessonNumber ? `<p style="font-size: 0.850rem; color: var(--text-muted);">🔢 <strong>رقم الحصة:</strong> <span style="color: #1e293b; font-weight:700;">${lastReport.lessonNumber}</span></p>` : "";


        let lessonDateStr =
          'غير متوفر';


        if (lastReport.completedAt) {

          const dateObj =
            typeof lastReport.completedAt.toDate ===
            'function'
              ? lastReport.completedAt.toDate()
              : new Date(
                  lastReport.completedAt
                );


          lessonDateStr =
            dateObj.toLocaleDateString(
              'ar-EG',
              {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }
            );

        } else if (lastReport.date) {

          lessonDateStr =
            String(
              lastReport.date
            );
        }


        const notesText =
          lastReport.notes
            ? lastReport.notes
            : 'لا توجد ملاحظات';


        summaryBox.innerHTML = `

          <h4
            style="
              font-size: 0.9rem;
              color: var(--primary-color);
            "
          >
            📊 ملخص سجل المتابعة
          </h4>

          ${lessonNumSummary}


          <p
            style="
              font-size: 0.850rem;
              color: var(--text-muted);
            "
          >
            📖
            <strong>آخر حفظ:</strong>

            <span style="color: #1e293b;">
              ${memorizationHtml}
            </span>
          </p>


          <p
            style="
              font-size: 0.850rem;
              color: var(--text-muted);
            "
          >
            🔄
            <strong>آخر مراجعة:</strong>

            <span style="color: #1e293b;">
              ${reviewHtml}
            </span>
          </p>


          ${ratingSummaryHtml}


          <p
            style="
              font-size: 0.850rem;
              color: var(--text-muted);
            "
          >
            📅
            <strong>آخر حصة:</strong>

            <span style="color: #1e293b;">
              ${lessonDateStr}
            </span>
          </p>


          <p
            style="
              font-size: 0.850rem;
              color: var(--text-muted);
            "
          >
            📝
            <strong>آخر ملاحظة:</strong>

            <span style="color: #1e293b;">
              ${notesText}
            </span>
          </p>

        `;

      } catch (error) {

        console.error(
          'Error loading student report summary:',
          error
        );


        if (
          summaryBox &&
          summaryBox.isConnected
        ) {

          summaryBox.innerHTML = `

            <h4
              style="
                font-size: 0.9rem;
                color: var(--primary-color);
              "
            >
              📊 ملخص سجل المتابعة
            </h4>


            <p
              style="
                font-size: 0.850rem;
                color: #991b1b;
              "
            >
              عذراً، حدث خطأ أثناء تحميل سجل متابعة الطالب.
            </p>

          `;
        }
      }
    };


  const closeProfileModal =
    () => {

      profileModal.style.display =
        'none';

      activeStudentId =
        null;
    };


  closeProfileBtn.addEventListener(
    'click',
    closeProfileModal
  );


  profileCloseActionBtn.addEventListener(
    'click',
    closeProfileModal
  );


  profileModal.addEventListener(
    'click',
    e => {

      if (
        e.target ===
        profileModal
      ) {
        closeProfileModal();
      }

    }
  );


  /*
   * إنشاء حساب الطالب
   */
  if (profileAccountBtn) {

    profileAccountBtn.addEventListener(
      'click',
      async () => {

        if (!activeStudentId) {
          return;
        }


        const student =
          currentStudentsList.find(
            st =>
              st.id ===
              activeStudentId
          );


        if (!student) {
          return;
        }


        if (student.studentAuthUid) {

          alert(
            'هذا الطالب لديه حساب دخول بالفعل.'
          );

          return;
        }


        /*
         * اسم المستخدم
         */
        const username =
          prompt(
            `إنشاء حساب للطالب: ${student.name}\n\nأدخل اسم المستخدم الذي سيستخدمه الطالب لتسجيل الدخول:`
          );


        if (
          username === null
        ) {
          return;
        }


        const cleanUsername =
          username.trim();


        if (!cleanUsername) {

          alert(
            'يجب إدخال اسم مستخدم.'
          );

          return;
        }


        if (
          cleanUsername.length < 3
        ) {

          alert(
            'اسم المستخدم يجب أن يكون 3 أحرف أو أكثر.'
          );

          return;
        }


        /*
         * كلمة المرور
         */
        const password =
          prompt(
            `إنشاء حساب للطالب: ${student.name}\n\nأدخل كلمة المرور:\n(يجب أن تكون 6 أحرف أو أكثر)`
          );


        if (
          password === null
        ) {
          return;
        }


        if (
          password.length < 6
        ) {

          alert(
            'كلمة المرور يجب أن تكون 6 أحرف أو أكثر.'
          );

          return;
        }


        /*
         * تأكيد كلمة المرور
         */
        const confirmPassword =
          prompt(
            'أعد كتابة كلمة المرور للتأكيد:'
          );


        if (
          confirmPassword === null
        ) {
          return;
        }


        if (
          password !==
          confirmPassword
        ) {

          alert(
            'كلمتا المرور غير متطابقتين.'
          );

          return;
        }


        /*
         * منع الضغط المتكرر
         */
        profileAccountBtn.disabled =
          true;

        profileAccountBtn.textContent =
          '⏳ جاري إنشاء الحساب...';


        try {

          const result =
            await studentService.createStudentAccount(
              activeStudentId,
              cleanUsername,
              password
            );


          if (!result.success) {

            alert(
              'تعذر إنشاء حساب الطالب:\n\n' +
              (
                result.error ||
                'حدث خطأ غير معروف.'
              )
            );

            return;
          }


          /*
           * تحديث بيانات الطالب محلياً
           */
          student.studentAuthUid =
            result.studentUid;

          student.studentUsername =
            result.username ||
            cleanUsername;


          alert(
            `تم إنشاء حساب الطالب بنجاح.\n\n` +
            `الطالب: ${student.name}\n` +
            `اسم المستخدم: ${student.studentUsername}\n\n` +
            `احتفظ ببيانات الدخول للطالب.`
          );


          /*
           * إعادة تحميل البيانات من Firestore
           */
          await reloadStudentsFromFirestore();


          /*
           * إعادة فتح ملف الطالب
           * لإظهار أن الحساب أصبح موجوداً.
           */
          if (
            currentStudentsList.some(
              st =>
                st.id ===
                activeStudentId
            )
          ) {

            await openProfileModal(
              activeStudentId
            );
          }

        } catch (error) {

          console.error(
            'Error creating student account:',
            error
          );


          alert(
            'حدث خطأ أثناء إنشاء حساب الطالب:\n\n' +
            (
              error.message ||
              'يرجى المحاولة لاحقاً.'
            )
          );

        } finally {

          if (
            profileAccountBtn &&
            !profileAccountBtn.disabled
          ) {
            profileAccountBtn.textContent =
              '🔐 إنشاء حساب الطالب';
          }
        }

      }
    );
  }


  /*
   * تعديل الطالب
   */
  profileEditBtn.addEventListener(
    'click',
    () => {

      if (!activeStudentId) {
        return;
      }


      const student =
        currentStudentsList.find(
          st =>
            st.id ===
            activeStudentId
        );


      if (student) {

        closeProfileModal();

        toggleModal(
          true,
          true,
          student
        );
      }
    }
  );


  /*
   * حذف الطالب
   */
  profileDeleteBtn.addEventListener(
    'click',
    async () => {

      if (!activeStudentId) {
        return;
      }


      const student =
        currentStudentsList.find(
          st =>
            st.id ===
            activeStudentId
        );


      const studentName =
        student
          ? student.name
          : 'الطالب';


      const confirmed =
        confirm(
          `هل أنت متأكد من حذف الطالب "${studentName}"؟`
        );


      if (!confirmed) {
        return;
      }


      const result =
        await studentService.deleteStudent(
          activeStudentId
        );


      if (result.success) {

        closeProfileModal();

        await reloadStudentsFromFirestore();

      } else {

        alert(
          'حدث خطأ أثناء الحذف: ' +
            (
              result.error ||
              'يرجى المحاولة لاحقاً.'
            )
        );
      }

    }
  );


  /*
   * إرسال آخر تقرير عبر WhatsApp بفاصل ASCII القياسي
   */
  if (profileWhatsappBtn) {

    profileWhatsappBtn.addEventListener(
      'click',
      async () => {

        if (!activeStudentId) {
          return;
        }


        const student =
          currentStudentsList.find(
            st =>
              st.id ===
              activeStudentId
          );


        let whatsappPhone =
          String(
            student &&
            student.parentPhone
              ? student.parentPhone
              : ''
          ).replace(
            /\D/g,
            ''
          );


        if (
          whatsappPhone.startsWith('01')
        ) {

          whatsappPhone =
            '20' +
            whatsappPhone.substring(1);
        }


        if (!whatsappPhone) {

          alert(
            'تنبيه: لا يوجد رقم ولي أمر مسجل لهذا الطالب.'
          );

          return;
        }


        const lastReport =
          await reportService.getLastStudentReport(
            activeStudentId
          );


        if (!lastReport) {

          alert(
            'تنبيه: لا توجد تقارير مسجلة لهذا الطالب ليتم إرسالها.'
          );

          return;
        }


        const memText =
          lastReport.memorization &&
          lastReport.memorization.length > 0
            ? lastReport.memorization
                .map(
                  m =>
                    `• سورة ${m.surah} (من آية ${m.fromAyah} إلى آية ${m.toAyah})`
                )
                .join('\n')
            : 'لا يوجد';


        const revText =
          lastReport.review &&
          lastReport.review.length > 0
            ? lastReport.review
                .map(
                  r =>
                    `• سورة ${r.surah} (من آية ${r.fromAyah} إلى آية ${r.toAyah})`
                )
                .join('\n')
            : 'لا يوجد';


        let ratingMsg = "";
        if (
          lastReport.memorizationRating !== null &&
          lastReport.memorizationRating !== undefined
        ) {
          ratingMsg += `📖 تقييم الحفظ: ${lastReport.memorizationRating} من 10\n`;
        }
        if (
          lastReport.reviewRating !== null &&
          lastReport.reviewRating !== undefined
        ) {
          ratingMsg += `🔄 تقييم المراجعة: ${lastReport.reviewRating} من 10\n`;
        }


        const notesText =
          lastReport.notes
            ? lastReport.notes
            : 'لا توجد ملاحظات';


        const dateStr =
          lastReport.date ||
          'اليوم';


        const studentName =
          student
            ? student.name
            : 'الطالب';

        const lessonNumStr =
          lastReport.lessonNumber
            ? `🔢 رقم الحصة: ${lastReport.lessonNumber}\n`
            : '';


        const message =
          `السلام عليكم 🌷\n\n` +
          `📌 *تقرير متابعة الحصة القرآنية*\n\n` +
          `👤 الطالب: *${studentName}*\n\n` +
          `📅 التاريخ: ${dateStr}\n\n` +
          lessonNumStr +
          (lessonNumStr ? `\n` : ``) +
          `--------------------\n\n` +
          `📖 *الحفظ الجديد:*\n\n${memText}\n\n` +
          `--------------------\n\n` +
          `🔄 *المراجعة:*\n\n${revText}\n\n` +
          (ratingMsg ? `--------------------\n\n${ratingMsg}\n` : ``) +
          `--------------------\n\n` +
          `📝 *ملاحظات المحفظ:*\n\n${notesText}\n\n` +
          `--------------------\n\n` +
          `مع تمنياتنا بدوام التوفيق والنجاح 🌹`;


        const whatsappUrl =
          `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
            message
          )}`;


        window.open(
          whatsappUrl,
          '_blank'
        );

      }
    );
  }


  /*
   * فتح ملف الطالب عند الضغط على الكارت
   */
  const attachCardClickEvents =
    () => {

      const cards =
        container.querySelectorAll(
          '.clickable-card'
        );


      cards.forEach(card => {

        card.addEventListener(
          'click',
          e => {

            const studentId =
              e.currentTarget.getAttribute(
                'data-id'
              );


            openProfileModal(
              studentId
            );

          }
        );

      });
    };


  attachCardClickEvents();
}
