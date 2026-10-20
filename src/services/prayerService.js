/**
 * Prayer Times Service (Independent & Offline-Capable)
 * خدمة مستقلة لإدارة وجلب مواقيت الصلاة حسب التاريخ والموقع الجغرافي مع التخزين المحلي المنفصل لكل يوم
 */

const PRAYER_SETTINGS_KEY = "smart_quran_location_settings";
const PRAYER_CACHE_PREFIX = "smart_quran_prayer_cache_";

export const prayerService = {
  /**
   * جلب إعدادات الموقع وطريقة الحساب المحفوظة محلياً
   * @returns {Object} إعدادات الموقع والحساب
   */
  getLocationSettings() {
    try {
      const raw = localStorage.getItem(PRAYER_SETTINGS_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (error) {
      console.error("Error reading location settings:", error);
    }

    return {
      latitude: null,
      longitude: null,
      city: "",
      country: "",
      method: 5,
      tune: ""
    };
  },

  /**
   * حفظ إعدادات الموقع وطريقة الحساب
   * @param {Object} settings
   */
  saveLocationSettings(settings) {
    try {
      const current = this.getLocationSettings();
      const updated = Object.assign({}, current, settings || {});

      localStorage.setItem(
        PRAYER_SETTINGS_KEY,
        JSON.stringify(updated)
      );

      return {
        success: true,
        settings: updated
      };
    } catch (error) {
      console.error("Error saving location settings:", error);

      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * تحويل تاريخ من صيغة YYYY-MM-DD إلى صيغة API (DD-MM-YYYY)
   * @param {string} dateString
   * @returns {string}
   */
  _formatDateForApi(dateString) {
    const parts = dateString.split("-");

    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}-${month}-${year}`;
    }

    return dateString;
  },

  /**
   * جلب مواقيت الصلاة لتاريخ محدد (YYYY-MM-DD)
   * @param {string} dateString تاريخ بصيغة YYYY-MM-DD
   * @returns {Promise<Object>}
   */
  async getPrayerTimesForDate(dateString) {
    if (!dateString || typeof dateString !== "string") {
      return {
        success: false,
        date: dateString,
        error: "التاريخ غير صالح."
      };
    }

    const cacheKey = PRAYER_CACHE_PREFIX + dateString;

    // 1. التحقق من وجود الكاش الخاص بهذا اليوم تحديداً مسبقاً
    try {
      const cachedRaw = localStorage.getItem(cacheKey);

      if (cachedRaw) {
        const cachedData = JSON.parse(cachedRaw);

        if (cachedData && cachedData.date === dateString) {
          return {
            success: true,
            date: dateString,
            timings: cachedData.timings,
            source: "cache"
          };
        }
      }
    } catch (error) {
      console.error("Error reading prayer cache:", error);
    }

    // 2. التحقق من توفر إعدادات الموقع
    const settings = this.getLocationSettings();

    if (
      settings.latitude === null ||
      settings.longitude === null
    ) {
      return {
        success: false,
        date: dateString,
        error: "موقع الحلقة (الإحداثيات) غير محدد في الإعدادات."
      };
    }

    // 3. جلب البيانات من Aladhan API
    const apiDate = this._formatDateForApi(dateString);
    const method = Number(settings.method) || 5;

    let url =
      `https://api.aladhan.com/v1/timings/${apiDate}` +
      `?latitude=${settings.latitude}` +
      `&longitude=${settings.longitude}` +
      `&method=${method}`;

    if (settings.tune) {
      url += `&tune=${encodeURIComponent(settings.tune)}`;
    }

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `فشل الاتصال بالخادم (HTTP ${response.status})`
        );
      }

      const json = await response.json();

      if (
        !json ||
        json.code !== 200 ||
        !json.data ||
        !json.data.timings
      ) {
        throw new Error(
          "تنسيق استجابة خادم مواقيت الصلاة غير صالح."
        );
      }

      const timingsData = json.data.timings;

      const apiResponseDateFormatted =
        json.data &&
        json.data.date &&
        json.data.date.gregorian &&
        json.data.date.gregorian.date
          ? json.data.date.gregorian.date
          : null;

      // 4. التحقق من أن التاريخ الراجع من API يطابق التاريخ المطلوب
      if (
        apiResponseDateFormatted &&
        apiResponseDateFormatted !== apiDate
      ) {
        return {
          success: false,
          date: dateString,
          error:
            "تحذير: التاريخ المسترجع من الخادم لا يطابق التاريخ المطلوب."
        };
      }

      // استخلاص أوقات الصلوات الأساسية والشروق بصيغة HH:MM
      const cleanTimings = {
        fajr: (timingsData.Fajr || "").slice(0, 5),
        sunrise: (timingsData.Sunrise || "").slice(0, 5),
        dhuhr: (timingsData.Dhuhr || "").slice(0, 5),
        asr: (timingsData.Asr || "").slice(0, 5),
        maghrib: (timingsData.Maghrib || "").slice(0, 5),
        isha: (timingsData.Isha || "").slice(0, 5)
      };

      const resultPayload = {
        date: dateString,
        timings: cleanTimings
      };

      // 5. تخزين مواقيت هذا اليوم بشكل منفصل تماماً
      localStorage.setItem(
        cacheKey,
        JSON.stringify(resultPayload)
      );

      return {
        success: true,
        date: dateString,
        timings: cleanTimings,
        source: "api"
      };

    } catch (error) {
      console.error(
        "Error fetching prayer times from API:",
        error
      );

      return {
        success: false,
        date: dateString,
        error:
          "تعذر جلب مواقيت الصلاة لعدم توفر إنترنت وعدم وجود بيانات مخزنة لهذا التاريخ بالتحديد. التفاصيل: " +
          error.message
      };
    }
  },

  /**
   * جلب مواقيت صلاة اليوم الحالي
   * @returns {Promise<Object>}
   */
  async getTodayPrayerTimes() {
    const now = new Date();

    const year = now.getFullYear();

    const month = String(
      now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      now.getDate()
    ).padStart(2, "0");

    const todayDateString = `${year}-${month}-${day}`;

    return await this.getPrayerTimesForDate(
      todayDateString
    );
  }
};
