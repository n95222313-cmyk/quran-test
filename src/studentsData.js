/**
 * Students Data & Business Logic Layer
 * طبقة بيانات محلية مؤقتة للطلاب ومنطق البحث المرن بالتطبيع العربي، الكروت الغنية بالبيانات الأساسية، وملف الطالب القابل للتوسع مستقبلًا
 */

let studentsList = [
  {
    id: 'st-1',
    name: 'أحمد محمد إبراهيم',
    age: 12,
    address:x 'السويس - حي السويس',
    parentPhone: '01012345678',
    level: 'المستوى الأول (جزء عم)',
    notes: 'منتظم وممتاز في الحفظ',
    // الهيكل المستقبلي المهيأ للربط لاحقاً بسجل الحصص والتقييمات دون اختراع بيانات حالية
    lessons: [],
    attendance: [],
    memorization: [],
    reviews: [],
    tajweed: [],
    evaluations: [],
    reports: []
  },
  {
    id: 'st-2',
    name: 'محمود علي حسن',
    age: 10,
    address: 'السويس - حي الأربعين',
    parentPhone: '01198765432',
    level: 'المستوى الثاني (تباركة والمجادلة)',
    notes: 'يحتاج تركيزاً أكثر في التجويد',
    lessons: [],
    attendance: [],
    memorization: [],
    reviews: [],
    tajweed: [],
    evaluations: [],
    reports: []
  },
  {
    id: 'st-3',
    name: 'عمر خالد محمود',
    age: 14,
    address: 'السويس - حي فيصل',
    parentPhone: '01233445566',
    level: 'المستوى الثالث (القرآن كاملاً)',
    notes: 'حافظ متقن ما شاء الله',
    lessons: [],
    attendance: [],
    memorization: [],
    reviews: [],
    tajweed: [],
    evaluations: [],
    reports: []
  },
  {
    id: 'st-4',
    name: 'إبراهيم حسن علي',
    age: 9,
    address: 'السويس - حي الجناين',
    parentPhone: '01055667788',
    level: 'المستوى الأول (قصار السور)',
    notes: 'طالب ذكي وسريع الحفظ',
    lessons: [],
    attendance: [],
    memorization: [],
    reviews: [],
    tajweed: [],
    evaluations: [],
    reports: []
  }
];

/**
 * دالة تطبيع النص العربي للبحث المرن (إزالة التشكيل، توحيد الهمزات والى/ى، وإزالة المسافات)
 */
function normalizeArabicText(text) {
  if (text === null || text === undefined) return '';
  let str = String(text).toLowerCase();
  
  // إزالة التشكيل والحركات العربية
  str = str.replace(/[\u064b-\u0652]/g, '');
  
  // توحيد الألفات (أ، إ، آ، ٱ -> ا)
  str = str.replace(/[أإآٱ]/g, 'ا');
  
  // توحيد ى إلى ي
  str = str.replace(/ى/g, 'ي');
  
  // إزالة التطويل (ـ)
  str = str.replace(/ـ/g, '');
  
  // إزالة المسافات الزائدة
  str = str.replace(/\s+/g, ' ').trim();
  
  return str;
}

export const studentsService = {
  getAllStudents() {
    return studentsList;
  },

  // فلترة وبحث متقدم يدمج البحث المرن (بالاسم، العنوان، المستوى) مع الفلاتر الأخرى
  filterStudents(filters = {}) {
    return studentsList.filter(st => {
      // 1. فلتر البحث المرن (يبحث في الاسم أو العنوان أو المستوى)
      if (filters.nameQuery) {
        const normQuery = normalizeArabicText(filters.nameQuery);
        const normName = normalizeArabicText(st.name);
        const normAddr = normalizeArabicText(st.address);
        const normLevel = normalizeArabicText(st.level);
        
        const matchesAny = normName.includes(normQuery) || 
                           normAddr.includes(normQuery) || 
                           normLevel.includes(normQuery);
        if (!matchesAny) return false;
      }

      // 2. فلتر العنوان المنفصل (مع التطبيع)
      if (filters.addressQuery) {
        const normAddr = normalizeArabicText(st.address);
        const normAddrQuery = normalizeArabicText(filters.addressQuery);
        if (!normAddr.includes(normAddrQuery)) return false;
      }

      // 3. فلتر السن
      if (filters.ageQuery !== undefined && filters.ageQuery !== '') {
        if (Number(st.age) !== Number(filters.ageQuery)) return false;
      }

      // 4. فلتر المستوى المنفصل (مع التطبيع)
      if (filters.levelQuery && filters.levelQuery !== 'all') {
        const normLevel = normalizeArabicText(st.level);
        const normLevelQuery = normalizeArabicText(filters.levelQuery);
        if (!normLevel.includes(normLevelQuery)) return false;
      }

      return true;
    });
  },

  addStudent(studentData) {
    const newStudent = {
      id: 'st-' + Date.now(),
      name: studentData.name,
      age: Number(studentData.age) || 0,
      address: studentData.address || '',
      parentPhone: studentData.parentPhone || '',
      level: studentData.level || 'المستوى الأول',
      notes: studentData.notes || '',
      lessons: [],
      attendance: [],
      memorization: [],
      reviews: [],
      tajweed: [],
      evaluations: [],
      reports: []
    };
    studentsList.unshift(newStudent);
    return newStudent;
  },

  updateStudent(id, studentData) {
    studentsList = studentsList.map(st => {
      if (st.id === id) {
        return {
          ...st,
          name: studentData.name,
          age: Number(studentData.age) || 0,
          address: studentData.address || '',
          parentPhone: studentData.parentPhone || '',
          level: studentData.level || st.level,
          notes: studentData.notes || ''
        };
      }
      return st;
    });
  },

  deleteStudent(id) {
    studentsList = studentsList.filter(st => st.id !== id);
  }
};

/**
 * دالة حقن وعرض واجهة تبويب الطلاب داخل محتوى الصفحة
 */
export function initStudentsModule(container) {
  if (!container) return;
  renderStudentsView(container, studentsList);
}

function renderStudentsView(container, list) {
  const uniqueLevels = [...new Set(studentsList.map(st => st.level))];

  container.innerHTML = `
    <div class="students-container">
      
      <!-- الهيدر العلوي للتبويب -->
      <div class="students-header-card">
        <div class="students-title-area">
          <h2>إدارة الطلاب 👥</h2>
          <p>إجمالي عدد الطلاب المسجلين: <span id="total-students-count">${studentsService.getAllStudents().length}</span> طالب</p>
        </div>
        <button type="button" id="open-add-modal-btn" class="primary-action-btn">+ إضافة طالب</button>
      </div>

      <!-- منطقة البحث والفلاتر المتقدمة -->
      <div class="filters-panel">
        <div class="search-bar-wrapper">
          <input type="text" id="student-search-input" class="search-input" placeholder="🔍 بحث مرن (الاسم، العنوان، المستوى)..." />
        </div>
        <div class="filters-grid">
          <input type="text" id="filter-address" class="filter-input" placeholder="فلتر حسب العنوان..." />
          <input type="number" id="filter-age" class="filter-input" placeholder="فلتر حسب العمر..." />
          <select id="filter-level" class="filter-select">
            <option value="all">جميع المستويات</option>
            ${uniqueLevels.map(lvl => `<option value="${lvl}">${lvl}</option>`).join('')}
          </select>
          <button type="button" id="reset-filters-btn" class="secondary-btn">مسح الفلاتر</button>
        </div>
      </div>

      <!-- قائمة الطلاب -->
      <div class="students-grid" id="students-grid-container">
        ${renderStudentsCards(list)}
      </div>

    </div>

    <!-- نافذة إضافة / تعديل طالب (Modal) -->
    <div id="add-student-modal" class="modal-overlay" style="display: none;">
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="modal-title">إضافة طالب جديد</h3>
          <button type="button" id="close-modal-btn" class="close-btn">&times;</button>
        </div>
        <form id="add-student-form" class="modal-form">
          <input type="hidden" id="st-edit-id" value="" />
          <div class="form-group">
            <label for="st-name">اسم الطالب ثلاثي*</label>
            <input type="text" id="st-name" required placeholder="أدخل اسم الطالب" />
          </div>
          <div class="form-group">
            <label for="st-age">العمر*</label>
            <input type="number" id="st-age" required placeholder="مثال: 10" />
          </div>
          <div class="form-group">
            <label for="st-address">العنوان*</label>
            <input type="text" id="st-address" required placeholder="مثال: السويس - حي فيصل" />
          </div>
          <div class="form-group">
            <label for="st-phone">رقم ولي الأمر*</label>
            <input type="tel" id="st-phone" required placeholder="01xxxxxxxxx" />
          </div>
          <div class="form-group">
            <label for="st-level">المستوى</label>
            <input type="text" id="st-level" placeholder="مثال: حفظ جزء عم" />
          </div>
          <div class="form-group">
            <label for="st-notes">ملاحظات</label>
            <textarea id="st-notes" placeholder="ملاحظات إضافية..."></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" id="cancel-modal-btn" class="secondary-btn">إلغاء</button>
            <button type="submit" id="form-submit-btn" class="primary-action-btn">حفظ الطالب</button>
          </div>
        </form>
      </div>
    </div>

    <!-- نافذة ملف الطالب التفصيلي (Student Profile Modal) -->
    <div id="student-profile-modal" class="modal-overlay" style="display: none;">
      <div class="modal-content">
        <div class="modal-header">
          <h3>ملف الطالب</h3>
          <button type="button" id="close-profile-btn" class="close-btn">&times;</button>
        </div>
        <div class="modal-form" id="student-profile-body">
          <!-- تفاصيل الطالب تملأ ديناميكياً -->
        </div>
        <div class="modal-actions" style="padding: 0 20px 20px 20px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; gap: 8px;">
            <button type="button" id="profile-edit-btn" class="secondary-btn" style="background: #e0f2fe; color: #0369a1;">✏️ تعديل الطالب</button>
            <button type="button" id="profile-delete-btn" class="secondary-btn" style="background: #fee2e2; color: #991b1b;">🗑️ حذف الطالب</button>
          </div>
          <button type="button" id="profile-close-action-btn" class="secondary-btn">إغلاق</button>
        </div>
      </div>
    </div>
  `;

  attachStudentsEvents(container);
}

function renderStudentsCards(list) {
  if (list.length === 0) {
    return `<div class="no-data">لا توجد نتائج مطابقة للبحث أو الفلاتر المحددة</div>`;
  }
  return list.map(st => `
    <div class="student-card clickable-card" data-id="${st.id}" style="cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease;">
      <div class="student-card-header" style="border-bottom: none; padding-bottom: 0;">
        <h3 class="student-name">👤 ${st.name}</h3>
      </div>
      <div class="student-card-body" style="display: flex; flex-direction: column; gap: 4px; font-size: 0.9rem; color: var(--text-muted);">
        <p class="student-age">🎂 <strong>العمر:</strong> ${st.age} سنوات</p>
        <p class="student-address">📍 <strong>العنوان:</strong> ${st.address || 'غير محدد'}</p>
        <p class="student-phone">📞 <strong>ولي الأمر:</strong> ${st.parentPhone || 'غير محدد'}</p>
        <p class="student-level">📚 <strong>المستوى:</strong> ${st.level || 'غير محدد'}</p>
      </div>
    </div>
  `).join('');
}

function attachStudentsEvents(container) {
  const searchInput = container.querySelector('#student-search-input');
  const filterAddress = container.querySelector('#filter-address');
  const filterAge = container.querySelector('#filter-age');
  const filterLevel = container.querySelector('#filter-level');
  const resetFiltersBtn = container.querySelector('#reset-filters-btn');
  
  const gridContainer = container.querySelector('#students-grid-container');
  
  // مودال الإضافة والتعديل
  const modal = container.querySelector('#add-student-modal');
  const openModalBtn = container.querySelector('#open-add-modal-btn');
  const closeModalBtn = container.querySelector('#close-modal-btn');
  const cancelModalBtn = container.querySelector('#cancel-modal-btn');
  const form = container.querySelector('#add-student-form');
  const modalTitle = container.querySelector('#modal-title');
  const formSubmitBtn = container.querySelector('#form-submit-btn');
  const editIdInput = container.querySelector('#st-edit-id');

  // مودال ملف الطالب
  const profileModal = container.querySelector('#student-profile-modal');
  const closeProfileBtn = container.querySelector('#close-profile-btn');
  const profileCloseActionBtn = container.querySelector('#profile-close-action-btn');
  const profileBody = container.querySelector('#student-profile-body');
  const profileEditBtn = container.querySelector('#profile-edit-btn');
  const profileDeleteBtn = container.querySelector('#profile-delete-btn');

  let activeStudentId = null;

  // دالة تحديث العرض والعدادات بناءً على الفلاتر النشطة
  const updateView = () => {
    const filters = {
      nameQuery: searchInput.value,
      addressQuery: filterAddress.value,
      ageQuery: filterAge.value,
      levelQuery: filterLevel.value
    };

    const results = studentsService.filterStudents(filters);
    
    // تحديث العدد الإجمالي للطلاب المسجلين بشكل صحيح ودائم
    const totalCountSpan = container.querySelector('#total-students-count');
    if (totalCountSpan) {
      totalCountSpan.textContent = studentsService.getAllStudents().length;
    }

    gridContainer.innerHTML = renderStudentsCards(results);
    attachCardClickEvents();
  };

  searchInput.addEventListener('input', updateView);
  filterAddress.addEventListener('input', updateView);
  filterAge.addEventListener('input', updateView);
  filterLevel.addEventListener('change', updateView);

  resetFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    filterAddress.value = '';
    filterAge.value = '';
    filterLevel.value = 'all';
    updateView();
  });

  // إدارة فتح/إغلاق نافذة الإضافة والتعديل
  const toggleModal = (show, isEditing = false, studentData = null) => {
    modal.style.display = show ? 'flex' : 'none';
    if (show) {
      if (isEditing && studentData) {
        modalTitle.textContent = 'تعديل بيانات الطالب';
        formSubmitBtn.textContent = 'حفظ التعديلات';
        editIdInput.value = studentData.id;
        container.querySelector('#st-name').value = studentData.name;
        container.querySelector('#st-age').value = studentData.age;
        container.querySelector('#st-address').value = studentData.address;
        container.querySelector('#st-phone').value = studentData.parentPhone;
        container.querySelector('#st-level').value = studentData.level;
        container.querySelector('#st-notes').value = studentData.notes || '';
      } else {
        modalTitle.textContent = 'إضافة طالب جديد';
        formSubmitBtn.textContent = 'حفظ الطالب';
        editIdInput.value = '';
        form.reset();
      }
    }
  };

  openModalBtn.addEventListener('click', () => toggleModal(true, false));
  closeModalBtn.addEventListener('click', () => toggleModal(false));
  cancelModalBtn.addEventListener('click', () => toggleModal(false));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) toggleModal(false);
  });

  // معالجة نموذج الحفظ (إضافة أو تعديل)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = editIdInput.value;
    const studentData = {
      name: container.querySelector('#st-name').value,
      age: container.querySelector('#st-age').value,
      address: container.querySelector('#st-address').value,
      parentPhone: container.querySelector('#st-phone').value,
      level: container.querySelector('#st-level').value,
      notes: container.querySelector('#st-notes').value
    };

    if (editId) {
      studentsService.updateStudent(editId, studentData);
      toggleModal(false);
      // إذا كان ملف الطالب مفتوحاً، قم بتحديث عرضه أيضاً
      if (profileModal.style.display === 'flex' && activeStudentId === editId) {
        openProfileModal(editId);
      }
    } else {
      studentsService.addStudent(studentData);
      toggleModal(false);
    }
    
    updateView();
  });

  // إدارة نافذة ملف الطالب مع تجهيز الأماكن المستقبلية للحصص والتقييمات
  const openProfileModal = (studentId) => {
    activeStudentId = studentId;
    const student = studentsService.getAllStudents().find(st => st.id === studentId);
    if (!student) return;

    profileBody.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.95rem;">
        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
          <p>👤 <strong>اسم الطالب:</strong> ${student.name}</p>
          <p>🎂 <strong>العمر:</strong> ${student.age} سنوات</p>
          <p>📍 <strong>العنوان:</strong> ${student.address || 'غير محدد'}</p>
          <p>📞 <strong>رقم ولي الأمر:</strong> ${student.parentPhone || 'غير محدد'}</p>
          <p>📚 <strong>المستوى:</strong> ${student.level || 'غير محدد'}</p>
          <p>💬 <strong>الملاحظات:</strong> ${student.notes || 'لا توجد ملاحظات'}</p>
        </div>
        
        <!-- الأماكن المستقبلية المرتقبة لسجل الطالب (مرتبطة بالهيكل دون اختراع بيانات) -->
        <div style="background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px dashed var(--border-color); display: flex; flex-direction: column; gap: 6px;">
          <h4 style="font-size: 0.9rem; color: var(--primary-color);">📊 ملخص سجل المتابعة (قريباً)</h4>
          <p style="font-size: 0.850rem; color: var(--text-muted);">📖 آخر حفظ: <span style="color: #64748b;">(سيظهر هنا لاحقاً)</span></p>
          <p style="font-size: 0.850rem; color: var(--text-muted);">🔄 آخر مراجعة: <span style="color: #64748b;">(سيظهر هنا لاحقاً)</span></p>
          <p style="font-size: 0.850rem; color: var(--text-muted);">🕌 آخر تقييم تجويد: <span style="color: #64748b;">(سيظهر هنا لاحقاً)</span></p>
          <p style="font-size: 0.850rem; color: var(--text-muted);">📅 آخر حصة: <span style="color: #64748b;">(سيظهر هنا لاحقاً)</span></p>
        </div>
      </div>
    `;
    profileModal.style.display = 'flex';
  };

  const closeProfileModal = () => {
    profileModal.style.display = 'none';
    activeStudentId = null;
  };

  closeProfileBtn.addEventListener('click', closeProfileModal);
  profileCloseActionBtn.addEventListener('click', closeProfileModal);
  profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) closeProfileModal();
  });

  // زر تعديل الطالب من داخل ملف الطالب
  profileEditBtn.addEventListener('click', () => {
    if (!activeStudentId) return;
    const student = studentsService.getAllStudents().find(st => st.id === activeStudentId);
    if (student) {
      closeProfileModal();
      toggleModal(true, true, student);
    }
  });

  // زر حذف الطالب من داخل ملف الطالب مع تأكيد واضح
  profileDeleteBtn.addEventListener('click', () => {
    if (!activeStudentId) return;
    const allStudents = studentsService.getAllStudents();
    const student = allStudents.find(st => st.id === activeStudentId);
    const studentName = student ? student.name : 'الطالب';

    const confirmed = confirm(`هل أنت متأكد من حذف الطالب "${studentName}"؟`);
    if (confirmed) {
      studentsService.deleteStudent(activeStudentId);
      closeProfileModal();
      updateView();
    }
  });

  // ربط النقر على كروت القائمة المختصرة لفتح ملف الطالب
  const attachCardClickEvents = () => {
    const cards = container.querySelectorAll('.clickable-card');
    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        const studentId = e.currentTarget.getAttribute('data-id');
        openProfileModal(studentId);
      });
    });
  };

  attachCardClickEvents();
}
