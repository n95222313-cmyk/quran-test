/**
 * Payment Service
 * إدارة مدفوعات الطلاب
 *
 * يدعم:
 * - تسجيل دفعة
 * - جلب دفعات الشيخ
 * - جلب دفعات شهر محدد
 * - جلب سجل مدفوعات طالب
 * - تعديل دفعة
 * - حذف دفعة
 *
 * ملاحظات:
 * - لا يتم تعديل بيانات students.
 * - كل دفعة مستقلة داخل payments.
 * - كل دفعة مرتبطة بالشيخ الحالي عبر sheikhId.
 * - billingMonth هو الشهر المحاسبي بصيغة YYYY-MM.
 */

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  db,
  auth
} from "../config/firebase.js";

const COLLECTION_NAME = "payments";

export const paymentService = {

  /**
   * الحصول على UID الشيخ الحالي
   */
  _getCurrentSheikhId() {
    const user = auth.currentUser;

    if (!user) {
      throw new Error(
        "لا يوجد مستخدم مسجل الدخول حالياً. يرجى تسجيل الدخول أولاً."
      );
    }

    return user.uid;
  },


  /**
   * التأكد من صحة الشهر
   *
   * الشكل:
   * YYYY-MM
   */
  _normalizeMonth(month) {
    if (!month) {
      return "";
    }

    const value = String(month).trim();

    if (!/^\d{4}-\d{2}$/.test(value)) {
      throw new Error(
        "صيغة الشهر غير صحيحة."
      );
    }

    return value;
  },


  /**
   * تسجيل دفعة جديدة
   */
  async addPayment(paymentData) {
    try {
      const sheikhId =
        this._getCurrentSheikhId();

      if (!paymentData.studentId) {
        return {
          success: false,
          error: "معرف الطالب مطلوب."
        };
      }

      const month =
        this._normalizeMonth(
          paymentData.month ||
          paymentData.billingMonth
        );

      if (!month) {
        return {
          success: false,
          error: "الشهر مطلوب."
        };
      }

      const amount =
        Number(paymentData.amount);

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return {
          success: false,
          error:
            "يجب إدخال مبلغ صحيح أكبر من صفر."
        };
      }

      const paymentDate =
        paymentData.paymentDate
          ? String(
              paymentData.paymentDate
            ).trim()
          : new Date()
              .toISOString()
              .slice(0, 10);

      const method =
        paymentData.method
          ? String(
              paymentData.method
            ).trim()
          : "cash";

      const notes =
        paymentData.notes
          ? String(
              paymentData.notes
            ).trim()
          : "";

      const now =
        Timestamp.now();

      const payload = {
        sheikhId,

        studentId:
          String(
            paymentData.studentId
          ),

        billingMonth:
          month,

        amount,

        paymentDate,

        method,

        notes,

        createdAt:
          now,

        updatedAt:
          now
      };

      const docRef =
        await addDoc(
          collection(
            db,
            COLLECTION_NAME
          ),
          payload
        );

      return {
        success: true,

        id:
          docRef.id,

        data: {
          id: docRef.id,
          ...payload
        }
      };

    } catch (error) {
      console.error(
        "Error adding payment:",
        error
      );

      return {
        success: false,
        error:
          error.message ||
          "حدث خطأ أثناء تسجيل الدفعة."
      };
    }
  },


  /**
   * جلب جميع دفعات الشيخ
   */
  async getSheikhPayments() {
    try {
      const sheikhId =
        this._getCurrentSheikhId();

      const q =
        query(
          collection(
            db,
            COLLECTION_NAME
          ),
          where(
            "sheikhId",
            "==",
            sheikhId
          )
        );

      const snapshot =
        await getDocs(q);

      const payments = [];

      snapshot.forEach(
        paymentDoc => {
          payments.push({
            id:
              paymentDoc.id,

            ...paymentDoc.data()
          });
        }
      );

      payments.sort(
        (a, b) => {
          const dateA =
            String(
              a.paymentDate || ""
            );

          const dateB =
            String(
              b.paymentDate || ""
            );

          return dateB.localeCompare(
            dateA
          );
        }
      );

      return {
        success: true,
        data: payments
      };

    } catch (error) {
      console.error(
        "Error fetching payments:",
        error
      );

      return {
        success: false,

        error:
          error.message ||
          "حدث خطأ أثناء تحميل المدفوعات.",

        data: []
      };
    }
  },


  /**
   * جلب دفعات شهر محدد
   */
  async getPaymentsByMonth(month) {
    try {
      const normalizedMonth =
        this._normalizeMonth(month);

      const result =
        await this.getSheikhPayments();

      if (!result.success) {
        return result;
      }

      const payments =
        result.data.filter(
          payment =>
            payment.billingMonth ===
            normalizedMonth
        );

      return {
        success: true,
        data: payments
      };

    } catch (error) {
      console.error(
        "Error fetching monthly payments:",
        error
      );

      return {
        success: false,

        error:
          error.message ||
          "حدث خطأ أثناء تحميل مدفوعات الشهر.",

        data: []
      };
    }
  },


  /**
   * جلب سجل مدفوعات طالب
   */
  async getStudentPayments(studentId) {
    try {
      const sheikhId =
        this._getCurrentSheikhId();

      if (!studentId) {
        return {
          success: false,
          error:
            "معرف الطالب مطلوب.",
          data: []
        };
      }

      const q =
        query(
          collection(
            db,
            COLLECTION_NAME
          ),

          where(
            "sheikhId",
            "==",
            sheikhId
          ),

          where(
            "studentId",
            "==",
            studentId
          )
        );

      const snapshot =
        await getDocs(q);

      const payments = [];

      snapshot.forEach(
        paymentDoc => {
          payments.push({
            id:
              paymentDoc.id,

            ...paymentDoc.data()
          });
        }
      );

      payments.sort(
        (a, b) => {
          const dateA =
            String(
              a.paymentDate || ""
            );

          const dateB =
            String(
              b.paymentDate || ""
            );

          if (
            dateA !== dateB
          ) {
            return dateB.localeCompare(
              dateA
            );
          }

          return String(
            b.billingMonth || ""
          ).localeCompare(
            String(
              a.billingMonth || ""
            )
          );
        }
      );

      return {
        success: true,
        data: payments
      };

    } catch (error) {
      console.error(
        "Error fetching student payments:",
        error
      );

      return {
        success: false,

        error:
          error.message ||
          "حدث خطأ أثناء تحميل سجل المدفوعات.",

        data: []
      };
    }
  },


  /**
   * الحصول على دفعة واحدة
   */
  async getPayment(paymentId) {
    try {
      const sheikhId =
        this._getCurrentSheikhId();

      if (!paymentId) {
        return {
          success: false,
          error:
            "معرف الدفعة مطلوب."
        };
      }

      const paymentRef =
        doc(
          db,
          COLLECTION_NAME,
          paymentId
        );

      const snapshot =
        await getDoc(
          paymentRef
        );

      if (!snapshot.exists()) {
        return {
          success: false,
          error:
            "الدفعة غير موجودة."
        };
      }

      const data =
        snapshot.data();

      if (
        data.sheikhId !==
        sheikhId
      ) {
        return {
          success: false,
          error:
            "غير مصرح لك بالوصول إلى هذه الدفعة."
        };
      }

      return {
        success: true,

        data: {
          id:
            snapshot.id,

          ...data
        }
      };

    } catch (error) {
      console.error(
        "Error fetching payment:",
        error
      );

      return {
        success: false,
        error:
          error.message
      };
    }
  },


  /**
   * تعديل دفعة
   */
  async updatePayment(
    paymentId,
    updateData
  ) {
    try {
      const sheikhId =
        this._getCurrentSheikhId();

      if (!paymentId) {
        return {
          success: false,
          error:
            "معرف الدفعة مطلوب."
        };
      }

      const paymentRef =
        doc(
          db,
          COLLECTION_NAME,
          paymentId
        );

      const snapshot =
        await getDoc(
          paymentRef
        );

      if (!snapshot.exists()) {
        return {
          success: false,
          error:
            "الدفعة غير موجودة."
        };
      }

      const existing =
        snapshot.data();

      if (
        existing.sheikhId !==
        sheikhId
      ) {
        return {
          success: false,
          error:
            "غير مصرح لك بتعديل هذه الدفعة."
        };
      }

      const payload = {
        updatedAt:
          Timestamp.now()
      };


      if (
        updateData.amount !==
        undefined
      ) {
        const amount =
          Number(
            updateData.amount
          );

        if (
          !Number.isFinite(amount) ||
          amount <= 0
        ) {
          return {
            success: false,
            error:
              "المبلغ غير صحيح."
          };
        }

        payload.amount =
          amount;
      }


      if (
        updateData.month !==
        undefined ||
        updateData.billingMonth !==
        undefined
      ) {
        payload.billingMonth =
          this._normalizeMonth(
            updateData.month ||
            updateData.billingMonth
          );
      }


      if (
        updateData.paymentDate !==
        undefined
      ) {
        payload.paymentDate =
          String(
            updateData.paymentDate
          ).trim();
      }


      if (
        updateData.method !==
        undefined
      ) {
        payload.method =
          String(
            updateData.method
          ).trim();
      }


      if (
        updateData.notes !==
        undefined
      ) {
        payload.notes =
          String(
            updateData.notes
          ).trim();
      }


      await updateDoc(
        paymentRef,
        payload
      );

      return {
        success: true
      };

    } catch (error) {
      console.error(
        "Error updating payment:",
        error
      );

      return {
        success: false,

        error:
          error.message ||
          "حدث خطأ أثناء تعديل الدفعة."
      };
    }
  },


  /**
   * حذف دفعة
   */
  async deletePayment(paymentId) {
    try {
      const sheikhId =
        this._getCurrentSheikhId();

      if (!paymentId) {
        return {
          success: false,
          error:
            "معرف الدفعة مطلوب."
        };
      }

      const paymentRef =
        doc(
          db,
          COLLECTION_NAME,
          paymentId
        );

      const snapshot =
        await getDoc(
          paymentRef
        );

      if (!snapshot.exists()) {
        return {
          success: false,
          error:
            "الدفعة غير موجودة."
        };
      }

      const paymentData =
        snapshot.data();

      if (
        paymentData.sheikhId !==
        sheikhId
      ) {
        return {
          success: false,
          error:
            "غير مصرح لك بحذف هذه الدفعة."
        };
      }

      await deleteDoc(
        paymentRef
      );

      return {
        success: true
      };

    } catch (error) {
      console.error(
        "Error deleting payment:",
        error
      );

      return {
        success: false,

        error:
          error.message ||
          "حدث خطأ أثناء حذف الدفعة."
      };
    }
  }

};
