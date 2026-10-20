/**
 * Settings Component (Sheikh Account, Name, Password & Prayer Times Location Management)
 * مكون واجهة الإعدادات وبيانات الشيخ والحساب، وتغيير كلمة المرور، وموقع الحلقة ومواقيت الصلاة
 */

import { auth } from "../config/firebase.js";
import { updatePassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { settingsService } from "../services/settingsService.js";
import { prayerService } from "../services/prayerService.js";

export async function initSettingsModule(container) {
  if (!container) return;

  const currentUser = auth.currentUser;
  const userEmail = currentUser ? currentUser.email : "غير متوفر";

  // جلب إعدادات الموقع الحالية
  const locationSettings = prayerService.getLocationSettings();

  const hasValidLocation =
    Number.isFinite(Number(locationSettings.latitude)) &&
    Number.isFinite(Number(locationSettings.longitude)) &&
    locationSettings.latitude !== null &&
    locationSettings.longitude !== null;

  container.innerHTML = `
    <div
      class="dashboard-container"
      style="max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;"
    >

      <!-- هيدر صفحة الإعدادات -->
      <div
        class="dash-welcome-card"
        style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);"
      >
        <h2>إعدادات النظام ⚙️</h2>
        <p class="dash-subtitle">
          لوحة التحكم المركزية لإدارة تفضيلات وخيارات الحساب والموقع الجغرافي.
        </p>
      </div>

      <!-- قسم بيانات الشيخ والحساب -->
      <div
        style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 16px;"
      >
        <h3
          style="font-size: 1.1rem; color: var(--primary-color); border-bottom: 2px solid var(--border-color); padding-bottom: 8px;"
        >
          👤 بيانات الشيخ والحساب
        </h3>

        <form
          id="sheikh-settings-form"
          style="display: flex; flex-direction: column; gap: 14px;"
        >

          <!-- البريد الإلكتروني -->
          <div
            class="form-group"
            style="display: flex; flex-direction: column; gap: 6px;"
          >
            <label
              style="font-weight: 700; color: var(--text-main);"
            >
              البريد الإلكتروني للحساب
            </label>

            <input
              type="email"
              value="${userEmail}"
              disabled
              style="background: #f1f5f9; color: var(--text-muted); cursor: not-allowed; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border-color);"
            />

            <span
              style="font-size: 0.78rem; color: var(--text-muted);"
            >
              البريد الإلكتروني مسجل رسمياً في نظام المصادقة ولا يمكن تعديله من هنا.
            </span>
          </div>

          <!-- اسم الشيخ -->
          <div
            class="form-group"
            style="display: flex; flex-direction: column; gap: 6px;"
          >
            <label
              for="sheikh-name-input"
              style="font-weight: 700; color: var(--text-main);"
            >
              اسم الشيخ*
            </label>

            <input
              type="text"
              id="sheikh-name-input"
              class="search-input"
              placeholder="أدخل اسم الشيخ (مثال: عبد الله)"
              required
              style="padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border-color);"
            />
          </div>

          <div
            id="settings-msg-box"
            style="font-size: 0.85rem; padding: 10px; border-radius: 8px; display: none;"
          ></div>

          <div style="display: flex; justify-content: flex-end;">
            <button
              type="submit"
              class="primary-action-btn"
              style="padding: 10px 20px;"
            >
              💾 حفظ البيانات
            </button>
          </div>
        </form>
      </div>

      <!-- قسم تغيير كلمة المرور -->
      <div
        style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 16px;"
      >
        <h3
          style="font-size: 1.1rem; color: var(--primary-color); border-bottom: 2px solid var(--border-color); padding-bottom: 8px;"
        >
          🔐 تغيير كلمة المرور
        </h3>

        <form
          id="change-password-form"
          style="display: flex; flex-direction: column; gap: 14px;"
        >

          <div
            class="form-group"
            style="display: flex; flex-direction: column; gap: 6px;"
          >
            <label
              for="new-password"
              style="font-weight: 700; color: var(--text-main);"
            >
              كلمة المرور الجديدة*
            </label>

            <input
              type="password"
              id="new-password"
              class="search-input"
              placeholder="••••••••"
              required
              minlength="6"
              style="padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border-color);"
            />
          </div>

          <div
            class="form-group"
            style="display: flex; flex-direction: column; gap: 6px;"
          >
            <label
              for="confirm-password"
              style="font-weight: 700; color: var(--text-main);"
            >
              تأكيد كلمة المرور الجديدة*
            </label>

            <input
              type="password"
              id="confirm-password"
              class="search-input"
              placeholder="••••••••"
              required
              minlength="6"
              style="padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border-color);"
            />
          </div>

          <div
            id="password-msg-box"
            style="font-size: 0.85rem; padding: 10px; border-radius: 8px; display: none;"
          ></div>

          <div style="display: flex; justify-content: flex-end;">
            <button
              type="submit"
              class="secondary-btn"
              style="padding: 10px 20px; background: #e0f2fe; color: #0369a1;"
            >
              تغيير كلمة المرور
            </button>
          </div>
        </form>
      </div>

      <!-- قسم موقع الحلقة ومواقيت الصلاة -->
      <div
        style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 16px;"
      >
        <h3
          style="font-size: 1.1rem; color: var(--primary-color); border-bottom: 2px solid var(--border-color); padding-bottom: 8px;"
        >
          📍 موقع الحلقة ومواقيت الصلاة
        </h3>

        <form
          id="prayer-location-form"
          style="display: flex; flex-direction: column; gap: 14px;"
        >

          <!-- المدينة والدولة -->
          <div
            style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;"
          >
            <div class="form-group">
              <label
                for="setting-city"
                style="font-weight: 700; color: var(--text-main);"
              >
                المدينة
              </label>

              <input
                type="text"
                id="setting-city"
                class="filter-input"
                value="${locationSettings.city || ""}"
                placeholder="مثال: السويس"
              />
            </div>

            <div class="form-group">
              <label
                for="setting-country"
                style="font-weight: 700; color: var(--text-main);"
              >
                الدولة
              </label>

              <input
                type="text"
                id="setting-country"
                class="filter-input"
                value="${locationSettings.country || ""}"
                placeholder="مثال: مصر"
              />
            </div>
          </div>

          <!-- الإحداثيات -->
          <div
            style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;"
          >
            <div class="form-group">
              <label
                for="setting-lat"
                style="font-weight: 700; color: var(--text-main);"
              >
                خط العرض (Latitude)*
              </label>

              <input
                type="number"
                step="any"
                id="setting-lat"
                class="filter-input"
                value="${hasValidLocation ? locationSettings.latitude : ""}"
                required
                placeholder="مثال: 29.9668"
              />
            </div>

            <div class="form-group">
              <label
                for="setting-lng"
                style="font-weight: 700; color: var(--text-main);"
              >
                خط الطول (Longitude)*
              </label>

              <input
                type="number"
                step="any"
                id="setting-lng"
                class="filter-input"
                value="${hasValidLocation ? locationSettings.longitude : ""}"
                required
                placeholder="مثال: 32.5498"
              />
            </div>
          </div>

          <!-- طريقة الحساب -->
          <div class="form-group">
            <label
              for="setting-method"
              style="font-weight: 700; color: var(--text-main);"
            >
              طريقة حساب مواقيت الصلاة*
            </label>

            <select id="setting-method" class="filter-select">
              <option
                value="5"
                ${Number(locationSettings.method) === 5 ? "selected" : ""}
              >
                الهيئة العامة المصرية للمساحة (5)
              </option>

              <option
                value="4"
                ${Number(locationSettings.method) === 4 ? "selected" : ""}
              >
                رابطة العالم الإسلامي (4)
              </option>

              <option
                value="2"
                ${Number(locationSettings.method) === 2 ? "selected" : ""}
              >
                جامعة العلوم الإسلامية بكراتشي (2)
              </option>

              <option
                value="3"
                ${Number(locationSettings.method) === 3 ? "selected" : ""}
              >
                الجمعية الإسلامية لأمريكا الشمالية (3)
              </option>

              <option
                value="1"
                ${Number(locationSettings.method) === 1 ? "selected" : ""}
              >
                أم القرى (1)
              </option>
            </select>
          </div>

          <!-- أزرار الموقع والحفظ -->
          <div
            style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-top: 6px;"
          >
            <button
              type="button"
              id="get-current-location-btn"
              class="secondary-btn"
              style="background: #e0f2fe; color: #0369a1;"
            >
              📍 استخدام موقعي الحالي
            </button>

            <button
              type="submit"
              class="primary-action-btn"
              style="padding: 10px 20px;"
            >
              💾 حفظ الموقع
            </button>
          </div>

          <div
            id="prayer-location-msg"
            style="display: none; padding: 10px; border-radius: 6px; font-size: 0.85rem;"
          ></div>
        </form>

        <!-- منطقة عرض مواقيت الصلاة -->
        <div
          style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; margin-top: 10px;"
        >
          <h4
            style="font-size: 0.95rem; color: var(--primary-color); margin-bottom: 8px;"
          >
            ⏰ مواقيت الصلاة اليوم
          </h4>

          <div
            id="prayer-times-content"
            style="font-size: 0.9rem; color: var(--text-muted);"
          >
            ${
              hasValidLocation
                ? "جاري تحميل مواقيت الصلاة..."
                : "📍 لم يتم تحديد موقع الحلقة بعد. استخدم زر «استخدام موقعي الحالي» أو أدخل الإحداثيات يدويًا."
            }
          </div>
        </div>
      </div>

    </div>
  `;

  // =========================================================
  // قسم بيانات الشيخ والحساب
  // =========================================================

  const nameInput = container.querySelector("#sheikh-name-input");
  const settingsMsgBox = container.querySelector("#settings-msg-box");
  const settingsForm = container.querySelector("#sheikh-settings-form");

  const passwordForm = container.querySelector("#change-password-form");
  const newPassInput = container.querySelector("#new-password");
  const confirmPassInput = container.querySelector("#confirm-password");
  const passwordMsgBox = container.querySelector("#password-msg-box");

  // تحميل بيانات الشيخ
  const res = await settingsService.getSheikhSettings();

  if (res.success && res.data && res.data.name) {
    nameInput.value = res.data.name;
  }

  // حفظ اسم الشيخ
  if (settingsForm) {
    settingsForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      settingsMsgBox.style.display = "none";

      const newName = nameInput.value.trim();

      if (!newName) {
        settingsMsgBox.textContent = "يرجى إدخال اسم الشيخ.";

        settingsMsgBox.style.cssText =
          "color: #991b1b; background: #fee2e2; border: 1px solid #fca5a5; display: block; padding: 10px; border-radius: 8px; font-size: 0.85rem;";

        return;
      }

      const saveRes = await settingsService.saveSheikhSettings({
        name: newName
      });

      if (saveRes.success) {
        settingsMsgBox.textContent =
          "تم حفظ بيانات الشيخ بنجاح!";

        settingsMsgBox.style.cssText =
          "color: #166534; background: #dcfce7; border: 1px solid #bbf7d0; display: block; padding: 10px; border-radius: 8px; font-size: 0.85rem;";
      } else {
        settingsMsgBox.textContent =
          "حدث خطأ أثناء الحفظ: " +
          (saveRes.error || "يرجى المحاولة لاحقاً.");

        settingsMsgBox.style.cssText =
          "color: #991b1b; background: #fee2e2; border: 1px solid #fca5a5; display: block; padding: 10px; border-radius: 8px; font-size: 0.85rem;";
      }
    });
  }

  // =========================================================
  // تغيير كلمة المرور
  // =========================================================

  if (passwordForm) {
    passwordForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      passwordMsgBox.style.display = "none";

      const newPass = newPassInput.value;
      const confirmPass = confirmPassInput.value;

      if (newPass !== confirmPass) {
        passwordMsgBox.textContent =
          "خطأ: كلمة المرور الجديدة وتأكيدها غير متطابقتين.";

        passwordMsgBox.style.cssText =
          "color: #991b1b; background: #fee2e2; border: 1px solid #fca5a5; display: block; padding: 10px; border-radius: 8px; font-size: 0.85rem;";

        return;
      }

      if (newPass.length < 6) {
        passwordMsgBox.textContent =
          "كلمة المرور يجب أن تكون 6 أحرف أو أكثر.";

        passwordMsgBox.style.cssText =
          "color: #991b1b; background: #fee2e2; border: 1px solid #fca5a5; display: block; padding: 10px; border-radius: 8px; font-size: 0.85rem;";

        return;
      }

      const user = auth.currentUser;

      if (!user) {
        passwordMsgBox.textContent =
          "خطأ: لا يوجد مستخدم مسجل الدخول حالياً.";

        passwordMsgBox.style.cssText =
          "color: #991b1b; background: #fee2e2; border: 1px solid #fca5a5; display: block; padding: 10px; border-radius: 8px; font-size: 0.85rem;";

        return;
      }

      try {
        await updatePassword(user, newPass);

        passwordMsgBox.textContent =
          "تم تغيير كلمة المرور بنجاح!";

        passwordMsgBox.style.cssText =
          "color: #166534; background: #dcfce7; border: 1px solid #bbf7d0; display: block; padding: 10px; border-radius: 8px; font-size: 0.85rem;";

        passwordForm.reset();
      } catch (err) {
        console.error(
          "Error updating password:",
          err
        );

        let errorText = err.message;

        if (err.code === "auth/requires-recent-login") {
          errorText =
            "أمان الحساب: يتطلب تغيير كلمة المرور تسجيلاً حديثاً للدخول. يرجى تسجيل الخروج ثم تسجيل الدخول مرة أخرى والمحاولة.";
        }

        passwordMsgBox.textContent =
          "فشل تغيير كلمة المرور: " + errorText;

        passwordMsgBox.style.cssText =
          "color: #991b1b; background: #fee2e2; border: 1px solid #fca5a5; display: block; padding: 10px; border-radius: 8px; font-size: 0.85rem;";
      }
    });
  }

  // =========================================================
  // موقع الحلقة ومواقيت الصلاة
  // =========================================================

  const getLocationBtn = container.querySelector(
    "#get-current-location-btn"
  );

  const latInput = container.querySelector(
    "#setting-lat"
  );

  const lngInput = container.querySelector(
    "#setting-lng"
  );

  const locationMsgBox = container.querySelector(
    "#prayer-location-msg"
  );

  const timesContent = container.querySelector(
    "#prayer-times-content"
  );

  // ---------------------------------------------------------
  // زر تحديد الموقع الحالي
  // ---------------------------------------------------------

  if (getLocationBtn) {
    getLocationBtn.addEventListener("click", () => {
      locationMsgBox.style.display = "none";

      if (!navigator.geolocation) {
        locationMsgBox.textContent =
          "متصفحك لا يدعم تحديد الموقع الجغرافي.";

        locationMsgBox.style.cssText =
          "color: #991b1b; background: #fee2e2; border: 1px solid #fca5a5; display: block; padding: 10px; border-radius: 8px; font-size: 0.85rem;";

        return;
      }

      getLocationBtn.textContent =
        "جاري تحديد الموقع...";

      navigator.geolocation.getCurrentPosition(
        (position) => {
          latInput.value =
            position.coords.latitude;

          lngInput.value =
            position.coords.longitude;

          getLocationBtn.textContent =
            "📍 استخدام موقعي الحالي";

          locationMsgBox.textContent =
            'تم تحديد إحداثيات موقعك بنجاح! اضغط على "💾 حفظ الموقع" لتثبيتها.';

          locationMsgBox.style.cssText =
            "color: #166534; background: #dcfce7; border: 1px solid #bbf7d0; display: block; padding: 10px; border-radius: 8px; font-size: 0.85rem;";
        },

        () => {
          getLocationBtn.textContent =
            "📍 استخدام موقعي الحالي";

          locationMsgBox.textContent =
            "تعذر الحصول على موقعك: تأكد من السماح بإذن الموقع في المتصفح.";

          locationMsgBox.style.cssText =
            "color: #991b1b; background: #fee2e2; border: 1px solid #fca5a5; display: block; padding: 10px; border-radius: 8px; font-size: 0.85rem;";
        },

        {
          timeout: 10000,
          enableHighAccuracy: true
        }
      );
    });
  }

  // ---------------------------------------------------------
  // تحميل وعرض مواقيت الصلاة
  // ---------------------------------------------------------

  const loadAndDisplayPrayerTimes = async () => {
    if (!timesContent) return;

    const currentSettings =
      prayerService.getLocationSettings();

    const latitude = Number(
      currentSettings.latitude
    );

    const longitude = Number(
      currentSettings.longitude
    );

    if (
      currentSettings.latitude === null ||
      currentSettings.longitude === null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      timesContent.innerHTML =
        "📍 لم يتم تحديد موقع الحلقة بعد. استخدم زر «استخدام موقعي الحالي» أو أدخل الإحداثيات يدويًا.";

      return;
    }

    timesContent.innerHTML =
      "جاري تحميل مواقيت الصلاة...";

    try {
      const res =
        await prayerService.getTodayPrayerTimes();

      if (res.success && res.timings) {
        const t = res.timings;

        timesContent.innerHTML = `
          <div
            style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px; text-align: center;"
          >
            <div
              style="background: #fff; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color);"
            >
              <strong>الفجر:</strong><br>
              ${t.fajr || "--:--"}
            </div>

            <div
              style="background: #fff; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color);"
            >
              <strong>الشروق:</strong><br>
              ${t.sunrise || "--:--"}
            </div>

            <div
              style="background: #fff; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color);"
            >
              <strong>الظهر:</strong><br>
              ${t.dhuhr || "--:--"}
            </div>

            <div
              style="background: #fff; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color);"
            >
              <strong>العصر:</strong><br>
              ${t.asr || "--:--"}
            </div>

            <div
              style="background: #fff; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color);"
            >
              <strong>المغرب:</strong><br>
              ${t.maghrib || "--:--"}
            </div>

            <div
              style="background: #fff; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color);"
            >
              <strong>العشاء:</strong><br>
              ${t.isha || "--:--"}
            </div>
          </div>

          <div
            style="font-size: 0.78rem; color: var(--text-muted); margin-top: 6px; text-align: center;"
          >
            مصدر البيانات:
            ${
              res.source === "cache"
                ? "التخزين المؤقت (بدون إنترنت)"
                : "الخادم المباشر"
            }
          </div>
        `;
      } else {
        timesContent.innerHTML = `
          <span style="color: #991b1b;">
            ${
              res.error ||
              "تعذر جلب مواقيت الصلاة. يرجى التحقق من إحداثيات الموقع والاتصال بالإنترنت."
            }
          </span>
        `;
      }
    } catch (error) {
      console.error(
        "Error loading prayer times:",
        error
      );

      timesContent.innerHTML = `
        <span style="color: #991b1b;">
          تعذر تحميل مواقيت الصلاة حاليًا.
        </span>
      `;
    }
  };

  // تحميل المواقيت عند فتح الإعدادات
  // فقط إذا كان الموقع محفوظًا بالفعل
  if (hasValidLocation) {
    await loadAndDisplayPrayerTimes();
  }

  // ---------------------------------------------------------
  // حفظ إعدادات الموقع
  // ---------------------------------------------------------

  const locationForm = container.querySelector(
    "#prayer-location-form"
  );

  if (locationForm) {
    locationForm.addEventListener(
      "submit",
      async (e) => {
        e.preventDefault();

        locationMsgBox.style.display = "none";

        const city = container
          .querySelector("#setting-city")
          .value
          .trim();

        const country = container
          .querySelector("#setting-country")
          .value
          .trim();

        const latitude = Number(
          latInput.value
        );

        const longitude = Number(
          lngInput.value
        );

        const method = Number(
          container.querySelector(
            "#setting-method"
          ).value
        );

        // التحقق الصارم من الإحداثيات
        if (
          !Number.isFinite(latitude) ||
          latitude < -90 ||
          latitude > 90 ||
          !Number.isFinite(longitude) ||
          longitude < -180 ||
          longitude > 180
        ) {
          locationMsgBox.textContent =
            "خطأ: خط العرض يجب أن يكون بين -90 و 90، وخط الطول بين -180 و 180.";

          locationMsgBox.style.cssText =
            "color: #991b1b; background: #fee2e2; border: 1px solid #fca5a5; display: block; padding: 10px; border-radius: 8px; font-size: 0.85rem;";

          return;
        }

        const saveRes =
          prayerService.saveLocationSettings({
            city,
            country,
            latitude,
            longitude,
            method
          });

        if (saveRes.success) {
          locationMsgBox.textContent =
            "💾 تم حفظ إعدادات الموقع بنجاح!";

          locationMsgBox.style.cssText =
            "color: #166534; background: #dcfce7; border: 1px solid #bbf7d0; display: block; padding: 10px; border-radius: 8px; font-size: 0.85rem;";

          await loadAndDisplayPrayerTimes();
        } else {
          locationMsgBox.textContent =
            "حدث خطأ أثناء الحفظ: " +
            (saveRes.error || "");

          locationMsgBox.style.cssText =
            "color: #991b1b; background: #fee2e2; border: 1px solid #fca5a5; display: block; padding: 10px; border-radius: 8px; font-size: 0.85rem;";
        }
      }
    );
  }
}
