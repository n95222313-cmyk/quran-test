/**
 * Payments Component
 * تبويب حسابات الطلاب
 *
 * يدعم:
 * - اختيار الشهر
 * - معرفة من دفع ومن لم يدفع
 * - إجمالي المبالغ المحصلة
 * - البحث عن طالب
 * - فلترة المدفوع / غير المدفوع
 * - تسجيل دفعة
 * - عرض سجل مدفوعات الطالب
 * - حذف دفعة
 */

import {
  paymentService
} from "../services/paymentService.js";

import {
  studentService
} from "../services/studentService.js";


function getCurrentMonth() {

  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}`;
}


function formatMonthLabel(
  month
) {

  if (!month) {
    return "";
  }

  const parts =
    month.split("-");

  if (parts.length !== 2) {
    return month;
  }

  const year =
    Number(parts[0]);

  const monthNumber =
    Number(parts[1]);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(monthNumber)
  ) {

    return month;

  }

  const date =
    new Date(
      year,
      monthNumber - 1,
      1
    );

  return date.toLocaleDateString(
    "ar-EG",
    {
      year: "numeric",
      month: "long"
    }
  );
}


function formatMoney(
  amount
) {

  const value =
    Number(amount) || 0;

  return value.toLocaleString(
    "ar-EG",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  );
}


function formatDate(
  dateValue
) {

  if (!dateValue) {
    return "غير محدد";
  }

  const date =
    new Date(
      `${dateValue}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return String(
      dateValue
    );

  }

  return date.toLocaleDateString(
    "ar-EG",
    {
      year: "numeric",
      month: "long",
      day: "numeric"
    }
  );
}


function getPaymentMethodLabel(
  method
) {

  const methods = {

    cash:
      "💵 نقدي",

    transfer:
      "🏦 تحويل بنكي",

    vodafone:
      "📱 فودافون كاش",

    instapay:
      "💳 إنستا باي",

    other:
      "💰 أخرى"

  };

  return (
    methods[method] ||
    "💰 أخرى"
  );
}


function normalizeArabicText(
  text
) {

  if (
    text === null ||
    text === undefined
  ) {

    return "";

  }

  let value =
    String(text)
      .toLowerCase();

  value =
    value.replace(
      /[\u064b-\u0652]/g,
      ""
    );

  value =
    value.replace(
      /[أإآٱ]/g,
      "ا"
    );

  value =
    value.replace(
      /ى/g,
      "ي"
    );

  value =
    value.replace(
      /ـ/g,
      ""
    );

  value =
    value.replace(
      /\s+/g,
      " "
    );

  return value.trim();
}


function buildPaymentMap(
  payments
) {

  const map =
    new Map();

  payments.forEach(
    payment => {

      const studentId =
        payment.studentId;

      if (!studentId) {
        return;
      }

      const current =
        map.get(
          studentId
        ) || {

          total:
            0,

          payments:
            []

        };


      current.total +=
        Number(
          payment.amount
        ) || 0;


      current.payments.push(
        payment
      );


      map.set(
        studentId,
        current
      );

    }
  );

  return map;
}


export async function initPaymentsModule(
  container
) {

  if (!container) {
    return;
  }


  container.innerHTML = `

    <div class="payments-container">

      <div class="payments-header-card">

        <div class="payments-title-area">

          <h2>
            الحسابات 💰
          </h2>

          <p>
            متابعة مدفوعات الطلاب للشهر المحدد.
          </p>

        </div>

        <div class="payments-month-wrapper">

          <label
            for="payments-month"
          >
            الشهر
          </label>

          <input
            type="month"
            id="payments-month"
            class="filter-input"
            value="${getCurrentMonth()}"
          />

        </div>

      </div>


      <div
        class="payments-summary-grid"
        id="payments-summary-grid"
      >

        <div class="payments-summary-card">

          <span class="payments-summary-icon">
            👥
          </span>

          <div>

            <strong id="payments-total-students">
              0
            </strong>

            <span>
              إجمالي الطلاب
            </span>

          </div>

        </div>


        <div class="payments-summary-card paid">

          <span class="payments-summary-icon">
            ✅
          </span>

          <div>

            <strong id="payments-paid-count">
              0
            </strong>

            <span>
              دفعوا هذا الشهر
            </span>

          </div>

        </div>


        <div class="payments-summary-card unpaid">

          <span class="payments-summary-icon">
            ⏳
          </span>

          <div>

            <strong id="payments-unpaid-count">
              0
            </strong>

            <span>
              لم يدفعوا
            </span>

          </div>

        </div>

      </div>


      <div class="payments-filters-panel">

        <div class="payments-search-wrapper">

          <input
            type="text"
            id="payments-search-input"
            class="search-input"
            placeholder="🔍 ابحث باسم الطالب..."
          />

        </div>


        <div class="payments-status-filter">

          <button
            type="button"
            class="payments-filter-btn active"
            data-payment-filter="all"
          >
            الكل
          </button>

          <button
            type="button"
            class="payments-filter-btn"
            data-payment-filter="paid"
          >
            ✅ دفع
          </button>

          <button
            type="button"
            class="payments-filter-btn"
            data-payment-filter="unpaid"
          >
            ⏳ لم يدفع
          </button>

        </div>

      </div>


      <div
        id="payments-loading"
        class="no-data"
      >
        جاري تحميل بيانات الحسابات...
      </div>


      <div
        id="payments-list"
        class="payments-list"
        style="display:none;"
      ></div>

    </div>


    <!-- تسجيل دفعة -->

    <div
      id="payment-form-modal"
      class="modal-overlay"
      style="display:none;"
    >

      <div class="modal-content">

        <div class="modal-header">

          <h3>
            💵 تسجيل دفعة
          </h3>

          <button
            type="button"
            id="close-payment-form-btn"
            class="close-btn"
          >
            &times;
          </button>

        </div>


        <form
          id="payment-form"
          class="modal-form"
        >

          <input
            type="hidden"
            id="payment-student-id"
            value=""
          />


          <div
            style="
              background:#f8fafc;
              border:1px solid var(--border-color);
              border-radius:10px;
              padding:12px;
              margin-bottom:4px;
            "
          >

            <strong>
              الطالب:
            </strong>

            <span
              id="payment-student-name"
            >
              -
            </span>

          </div>


          <div class="form-group">

            <label for="payment-month">
              الشهر*
            </label>

            <input
              type="month"
              id="payment-month"
              required
            />

          </div>


          <div class="form-group">

            <label for="payment-amount">
              المبلغ*
            </label>

            <input
              type="number"
              id="payment-amount"
              min="0.01"
              step="0.01"
              required
              placeholder="مثال: 300"
            />

          </div>


          <div class="form-group">

            <label for="payment-date">
              تاريخ الدفع*
            </label>

            <input
              type="date"
              id="payment-date"
              required
            />

          </div>


          <div class="form-group">

            <label for="payment-method">
              طريقة الدفع
            </label>

            <select
              id="payment-method"
              class="filter-select"
            >

              <option value="cash">
                💵 نقدي
              </option>

              <option value="transfer">
                🏦 تحويل بنكي
              </option>

              <option value="vodafone">
                📱 فودافون كاش
              </option>

              <option value="instapay">
                💳 إنستا باي
              </option>

              <option value="other">
                💰 أخرى
              </option>

            </select>

          </div>


          <div class="form-group">

            <label for="payment-notes">
              ملاحظات
            </label>

            <textarea
              id="payment-notes"
              placeholder="مثال: دفع شهر سبتمبر نقداً..."
            ></textarea>

          </div>


          <div class="modal-actions">

            <button
              type="button"
              id="cancel-payment-form-btn"
              class="secondary-btn"
            >
              إلغاء
            </button>

            <button
              type="submit"
              id="save-payment-btn"
              class="primary-action-btn"
            >
              💵 حفظ الدفعة
            </button>

          </div>

        </form>

      </div>

    </div>


    <!-- سجل المدفوعات -->

    <div
      id="payment-history-modal"
      class="modal-overlay"
      style="display:none;"
    >

      <div class="modal-content">

        <div class="modal-header">

          <h3>
            📋 سجل المدفوعات
          </h3>

          <button
            type="button"
            id="close-payment-history-btn"
            class="close-btn"
          >
            &times;
          </button>

        </div>


        <div
          id="payment-history-body"
          class="modal-form"
        ></div>


        <div class="modal-actions">

          <button
            type="button"
            id="payment-history-close-action-btn"
            class="secondary-btn"
          >
            إغلاق
          </button>

        </div>

      </div>

    </div>

  `;


  const monthInput =
    container.querySelector(
      "#payments-month"
    );

  const searchInput =
    container.querySelector(
      "#payments-search-input"
    );

  const loading =
    container.querySelector(
      "#payments-loading"
    );

  const list =
    container.querySelector(
      "#payments-list"
    );

  const totalStudentsEl =
    container.querySelector(
      "#payments-total-students"
    );

  const paidCountEl =
    container.querySelector(
      "#payments-paid-count"
    );

  const unpaidCountEl =
    container.querySelector(
      "#payments-unpaid-count"
    );


  const paymentFormModal =
    container.querySelector(
      "#payment-form-modal"
    );

  const paymentHistoryModal =
    container.querySelector(
      "#payment-history-modal"
    );

  const paymentForm =
    container.querySelector(
      "#payment-form"
    );


  const paymentStudentId =
    container.querySelector(
      "#payment-student-id"
    );

  const paymentStudentName =
    container.querySelector(
      "#payment-student-name"
    );

  const paymentMonth =
    container.querySelector(
      "#payment-month"
    );

  const paymentAmount =
    container.querySelector(
      "#payment-amount"
    );

  const paymentDate =
    container.querySelector(
      "#payment-date"
    );

  const paymentMethod =
    container.querySelector(
      "#payment-method"
    );

  const paymentNotes =
    container.querySelector(
      "#payment-notes"
    );

  const savePaymentBtn =
    container.querySelector(
      "#save-payment-btn"
    );

  const paymentHistoryBody =
    container.querySelector(
      "#payment-history-body"
    );


  let students =
    [];

  let payments =
    [];

  let currentFilter =
    "all";

  let activeHistoryStudentId =
    null;


  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      );


  paymentDate.value =
    today;


  paymentMonth.value =
    monthInput.value;


  function getStudentById(
    studentId
  ) {

    return students.find(
      student =>
        student.id ===
        studentId
    );

  }


  function render() {

    const selectedMonth =
      monthInput.value;

    const paymentMap =
      buildPaymentMap(
        payments
      );


    const search =
      normalizeArabicText(
        searchInput.value
      );


    const filtered =
      students.filter(
        student => {

          const name =
            normalizeArabicText(
              student.name
            );


          if (
            search &&
            !name.includes(
              search
            )
          ) {

            return false;

          }


          const paymentInfo =
            paymentMap.get(
              student.id
            );


          const paid =
            paymentInfo &&
            paymentInfo.total > 0;


          if (
            currentFilter ===
            "paid" &&
            !paid
          ) {

            return false;

          }


          if (
            currentFilter ===
            "unpaid" &&
            paid
          ) {

            return false;

          }


          return true;

        }
      );


    totalStudentsEl.textContent =
      students.length;


    let paidCount =
      0;

    let totalCollected =
      0;


    students.forEach(
      student => {

        const info =
          paymentMap.get(
            student.id
          );


        if (
          info &&
          info.total > 0
        ) {

          paidCount++;

          totalCollected +=
            info.total;

        }

      }
    );


    paidCountEl.textContent =
      paidCount;


    unpaidCountEl.textContent =
      Math.max(
        0,
        students.length -
        paidCount
      );


    if (
      filtered.length === 0
    ) {

      list.innerHTML = `

        <div class="no-data">

          لا توجد نتائج مطابقة.

        </div>

      `;

      return;

    }


    list.innerHTML =
      filtered
        .map(
          student => {

            const info =
              paymentMap.get(
                student.id
              );


            const totalPaid =
              info
                ? info.total
                : 0;


            const paid =
              totalPaid > 0;


            const studentPayments =
              info
                ? info.payments
                : [];


            const latestPayment =
              studentPayments.length > 0
                ? studentPayments
                    .slice()
                    .sort(
                      (a, b) =>
                        String(
                          b.paymentDate || ""
                        ).localeCompare(
                          String(
                            a.paymentDate || ""
                          )
                        )
                    )[0]
                : null;


            return `

              <div
                class="
                  payment-student-card
                  ${paid ? "is-paid" : "is-unpaid"}
                "
              >

                <div class="payment-student-main">

                  <div
                    class="payment-student-avatar"
                  >
                    👤
                  </div>


                  <div
                    class="payment-student-info"
                  >

                    <h3>
                      ${student.name || "بدون اسم"}
                    </h3>

                    <p>
                      ${
                        student.level
                          ? `📚 ${student.level}`
                          : "📚 المستوى غير محدد"
                      }
                    </p>

                    ${
                      student.parentPhone
                        ? `
                          <p>
                            📞 ${student.parentPhone}
                          </p>
                        `
                        : ""
                    }

                  </div>

                </div>


                <div class="payment-student-status">

                  ${
                    paid
                      ? `
                        <span
                          class="payment-status-badge paid"
                        >
                          ✅ مدفوع
                        </span>

                        <strong
                          class="payment-amount-value"
                        >
                          ${formatMoney(totalPaid)}
                          جنيه
                        </strong>

                        ${
                          latestPayment
                            ? `
                              <small>
                                آخر دفع:
                                ${formatDate(
                                  latestPayment.paymentDate
                                )}
                              </small>
                            `
                            : ""
                        }
                      `
                      : `
                        <span
                          class="payment-status-badge unpaid"
                        >
                          ⏳ لم يدفع
                        </span>

                        <strong
                          class="payment-amount-value empty"
                        >
                          0 جنيه
                        </strong>
                      `
                  }

                </div>


                <div
                  class="payment-student-actions"
                >

                  <button
                    type="button"
                    class="primary-action-btn open-payment-btn"
                    data-student-id="${student.id}"
                  >
                    💵 تسجيل دفع
                  </button>


                  <button
                    type="button"
                    class="secondary-btn open-history-btn"
                    data-student-id="${student.id}"
                  >
                    📋 السجل
                  </button>

                </div>

              </div>

            `;

          }
        )
        .join("");


    attachListEvents();

  }


  function attachListEvents() {

    list
      .querySelectorAll(
        ".open-payment-btn"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              openPaymentModal(
                button.dataset.studentId
              );

            }
          );

        }
      );


    list
      .querySelectorAll(
        ".open-history-btn"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              openHistoryModal(
                button.dataset.studentId
              );

            }
          );

        }
      );

  }


  function openPaymentModal(
    studentId
  ) {

    const student =
      getStudentById(
        studentId
      );


    if (!student) {
      return;
    }


    paymentStudentId.value =
      studentId;


    paymentStudentName.textContent =
      student.name ||
      "الطالب";


    paymentMonth.value =
      monthInput.value ||
      getCurrentMonth();


    paymentDate.value =
      new Date()
        .toISOString()
        .slice(
          0,
          10
        );


    paymentAmount.value =
      "";


    paymentMethod.value =
      "cash";


    paymentNotes.value =
      "";


    paymentFormModal.style.display =
      "flex";


    setTimeout(
      () => {

        paymentAmount.focus();

      },
      0
    );

  }


  function closePaymentModal() {

    paymentFormModal.style.display =
      "none";

  }


  async function openHistoryModal(
    studentId
  ) {

    const student =
      getStudentById(
        studentId
      );


    if (!student) {
      return;
    }


    activeHistoryStudentId =
      studentId;


    paymentHistoryBody.innerHTML = `

      <div class="no-data">
        جاري تحميل سجل المدفوعات...
      </div>

    `;


    paymentHistoryModal.style.display =
      "flex";


    const result =
      await paymentService.getStudentPayments(
        studentId
      );


    if (!result.success) {

      paymentHistoryBody.innerHTML = `

        <div
          class="no-data"
          style="
            color:#991b1b;
            background:#fee2e2;
          "
        >
          ${
            result.error ||
            "حدث خطأ أثناء تحميل السجل."
          }
        </div>

      `;

      return;

    }


    const history =
      result.data || [];


    if (
      history.length === 0
    ) {

      paymentHistoryBody.innerHTML = `

        <div class="no-data">

          لا توجد مدفوعات مسجلة للطالب
          <strong>${student.name}</strong>.

        </div>

      `;

      return;

    }


    const total =
      history.reduce(
        (sum, payment) =>
          sum +
          (
            Number(
              payment.amount
            ) || 0
          ),
        0
      );


    paymentHistoryBody.innerHTML = `

      <div
        style="
          background:#f8fafc;
          border:1px solid var(--border-color);
          border-radius:10px;
          padding:12px;
          margin-bottom:12px;
        "
      >

        <p>
          👤
          <strong>
            الطالب:
          </strong>
          ${student.name}
        </p>

        <p>
          💵
          <strong>
            إجمالي المدفوعات:
          </strong>
          ${formatMoney(total)}
          جنيه
        </p>

      </div>


      <div class="payment-history-list">

        ${history
          .map(
            payment => `

              <div
                class="payment-history-item"
              >

                <div>

                  <strong>
                    شهر الاشتراك: ${formatMonthLabel(
                      payment.billingMonth || payment.month
                    )}
                  </strong>

                  <p>
                    تاريخ الدفع: ${formatDate(                       payment.paymentDate                     )} \vert{}${getPaymentMethodLabel(
                      payment.method
                    )}
                  </p>

                  ${
                    payment.notes
                      ? `
                        <small>
                          📝 ${payment.notes}
                        </small>
                      `
                      : ""
                  }

                </div>


                <div
                  class="payment-history-amount"
                >

                  <strong>
                    ${formatMoney(
                      payment.amount
                    )}
                    جنيه
                  </strong>

                  <button
                    type="button"
                    class="secondary-btn delete-payment-btn"
                    data-payment-id="${payment.id}"
                    style="
                      margin-top:6px;
                      background:#fee2e2;
                      color:#991b1b;
                      border:1px solid #fecaca;
                      padding:4px 9px;
                      font-size:.78rem;
                    "
                  >
                    🗑️ حذف
                  </button>

                </div>

              </div>

            `
          )
          .join("")}

      </div>

    `;


    paymentHistoryBody
      .querySelectorAll(
        ".delete-payment-btn"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            async () => {

              const confirmed =
                confirm(
                  "هل أنت متأكد من حذف هذه الدفعة؟"
                );


              if (!confirmed) {
                return;
              }


              button.disabled =
                true;


              const result =
                await paymentService.deletePayment(
                  button.dataset.paymentId
                );


              if (!result.success) {

                alert(
                  result.error ||
                  "تعذر حذف الدفعة."
                );

                button.disabled =
                  false;

                return;

              }


              await loadData();


              await openHistoryModal(
                activeHistoryStudentId
              );

            }
          );

        }
      );

  }


  async function loadData() {

    loading.style.display =
      "block";

    list.style.display =
      "none";


    const [
      studentsResult,
      paymentsResult
    ] =
      await Promise.all([
        studentService.getSheikhStudents(),
        paymentService.getPaymentsByMonth(
          monthInput.value
        )
      ]);


    if (
      !studentsResult.success
    ) {

      loading.innerHTML = `

        <div
          style="
            color:#991b1b;
          "
        >
          حدث خطأ أثناء تحميل الطلاب:
          ${
            studentsResult.error ||
            "خطأ غير معروف"
          }
        </div>

      `;

      return;

    }


    if (
      !paymentsResult.success
    ) {

      loading.innerHTML = `

        <div
          style="
            color:#991b1b;
          "
        >
          حدث خطأ أثناء تحميل المدفوعات:
          ${
            paymentsResult.error ||
            "خطأ غير معروف"
          }
        </div>

      `;

      return;

    }


    students =
      studentsResult.data || [];


    payments =
      paymentsResult.data || [];


    loading.style.display =
      "none";


    list.style.display =
      "grid";


    render();

  }


  monthInput.addEventListener(
    "change",
    async () => {

      await loadData();

    }
  );


  searchInput.addEventListener(
    "input",
    render
  );


  container
    .querySelectorAll(
      ".payments-filter-btn"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            currentFilter =
              button.dataset.paymentFilter;


            container
              .querySelectorAll(
                ".payments-filter-btn"
              )
              .forEach(
                item =>
                  item.classList.remove(
                    "active"
                  )
              );


            button.classList.add(
              "active"
            );


            render();

          }
        );

      }
    );


  paymentForm.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const studentId =
        paymentStudentId.value;


      const amount =
        Number(
          paymentAmount.value
        );


      if (
        !studentId
      ) {

        alert(
          "لم يتم تحديد الطالب."
        );

        return;

      }


      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {

        alert(
          "أدخل مبلغاً صحيحاً أكبر من صفر."
        );

        paymentAmount.focus();

        return;

      }


      savePaymentBtn.disabled =
        true;

      savePaymentBtn.textContent =
        "⏳ جاري الحفظ...";


      try {

        const result =
          await paymentService.addPayment({

            studentId,

            month:
              paymentMonth.value,

            amount,

            paymentDate:
              paymentDate.value,

            method:
              paymentMethod.value,

            notes:
              paymentNotes.value.trim()

          });


        if (!result.success) {

          alert(
            result.error ||
            "تعذر تسجيل الدفعة."
          );

          return;

        }


        closePaymentModal();


        await loadData();


        alert(
          "تم تسجيل الدفعة بنجاح ✅"
        );

      } catch (error) {

        console.error(
          "Payment form error:",
          error
        );


        alert(
          error.message ||
          "حدث خطأ أثناء تسجيل الدفعة."
        );

      } finally {

        savePaymentBtn.disabled =
          false;

        savePaymentBtn.textContent =
          "💵 حفظ الدفعة";

      }

    }
  );


  container
    .querySelector(
      "#close-payment-form-btn"
    )
    .addEventListener(
      "click",
      closePaymentModal
    );


  container
    .querySelector(
      "#cancel-payment-form-btn"
    )
    .addEventListener(
      "click",
      closePaymentModal
    );


  paymentFormModal.addEventListener(
    "click",
    event => {

      if (
        event.target ===
        paymentFormModal
      ) {

        closePaymentModal();

      }

    }
  );


  container
    .querySelector(
      "#close-payment-history-btn"
    )
    .addEventListener(
      "click",
      () => {

        paymentHistoryModal.style.display =
          "none";

        activeHistoryStudentId =
          null;

      }
    );


  container
    .querySelector(
      "#payment-history-close-action-btn"
    )
    .addEventListener(
      "click",
      () => {

        paymentHistoryModal.style.display =
          "none";

        activeHistoryStudentId =
          null;

      }
    );


  paymentHistoryModal.addEventListener(
    "click",
    event => {

      if (
        event.target ===
        paymentHistoryModal
      ) {

        paymentHistoryModal.style.display =
          "none";

        activeHistoryStudentId =
          null;

      }

    }
  );


  await loadData();

}
