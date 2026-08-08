/**
 * UI translations — errors (auto-split from translations.js)
 * Stage 199.4: failedToLoad is generic; finances use failedToLoadTransactions.
 */
export const errorsUi = {
    ru: {
      loginError: "Неверный email или пароль",
      loadError: "Ошибка загрузки",
      failedToLoad: "Не удалось загрузить",
      failedToLoadTransactions: "Не удалось загрузить транзакции",
      failedToLoadListing: "Не удалось загрузить объявление",
      invalidCoords: "Широта: -90…90, Долгота: -180…180",
      partnerCal_urlError: "Не удалось получить ссылку. Обновите страницу или войдите снова.",
      bookingErr_priceMismatch:
        "Сумма обновилась. Обновите даты или количество гостей и попробуйте снова — так цена совпадёт с расчётом.",
      bookingErr_datesConflict:
        "К сожалению, эти даты только что были забронированы другим пользователем. Пожалуйста, выберите другие.",
      bookingErr_guestsExceed: "Превышено максимальное число гостей для этого объекта. Уменьшите количество.",
      bookingErr_priceAttestationRequired:
        "Укажите корректную сумму бронирования (обновите страницу и выберите даты снова).",
      bookingErr_bookingMinTotal:
        "Минимальная сумма к оплате с учётом сервисного сбора — 100 THB. Увеличьте длительность или выберите другой объект.",
      bookingErr_generic: "Не удалось завершить бронирование. Попробуйте ещё раз.",
      rootNotFound_title: "Страница не найдена",
      rootNotFound_body: "Такой страницы нет или она была перемещена. Вернитесь на главную и продолжите поиск.",
      rootError_title: "Что-то пошло не так",
      rootError_body: "Не удалось загрузить страницу. Попробуйте обновить или вернуться на главную.",
      checkoutSegmentError_body:
        "Не удалось загрузить оплату. Обновите страницу или вернитесь к бронированиям — средства не списаны повторно из‑за этой ошибки.",
    },
    en: {
      loginError: "Invalid email or password",
      loadError: "Loading error",
      failedToLoad: "Failed to load",
      failedToLoadTransactions: "Failed to load transactions",
      failedToLoadListing: "Failed to load listing",
      invalidCoords: "Latitude: -90…90, Longitude: -180…180",
      partnerCal_urlError: "Could not load link. Refresh or sign in again.",
      bookingErr_priceMismatch:
        "The price was updated. Refresh your dates or guest count and try again so the total matches our quote.",
      bookingErr_datesConflict:
        "Unfortunately, those dates were just booked by another guest. Please choose different dates.",
      bookingErr_guestsExceed: "This listing allows fewer guests. Please reduce the number of guests.",
      bookingErr_priceAttestationRequired:
        "We need a fresh price quote. Refresh the page and select your dates again.",
      bookingErr_bookingMinTotal:
        "The minimum payable total (subtotal + service fee) is 100 THB. Extend the stay or pick another listing.",
      bookingErr_generic: "We couldn’t complete the booking. Please try again.",
      rootNotFound_title: "Page not found",
      rootNotFound_body: "This page does not exist or was moved. Go home and continue browsing.",
      rootError_title: "Something went wrong",
      rootError_body: "We could not load this page. Try again or go back home.",
      checkoutSegmentError_body:
        "Checkout could not load. Refresh or return to your bookings — this error does not charge you again.",
    },
    zh: {
      loginError: "邮箱或密码错误",
      loadError: "加载错误",
      failedToLoad: "加载失败",
      failedToLoadTransactions: "加载交易失败",
      failedToLoadListing: "无法加载房源",
      invalidCoords: "纬度：-90…90，经度：-180…180",
      partnerCal_urlError: "无法获取链接。请刷新页面或重新登录。",
      bookingErr_priceMismatch: "价格已更新。请刷新日期或人数后重试，使总额与系统一致。",
      bookingErr_datesConflict: "抱歉，这些日期刚被其他用户预订。请选择其他日期。",
      bookingErr_guestsExceed: "超过此房源允许的最大人数，请减少人数。",
      bookingErr_priceAttestationRequired: "需要最新的价格。请刷新页面并重新选择日期。",
      bookingErr_bookingMinTotal: "含服务费最低应付金额为 100 THB。请延长入住或选择其他房源。",
      bookingErr_generic: "无法完成预订，请重试。",
      rootNotFound_title: "页面未找到",
      rootNotFound_body: "该页面不存在或已移动。请返回首页继续浏览。",
      rootError_title: "出错了",
      rootError_body: "无法加载此页面。请重试或返回首页。",
      checkoutSegmentError_body: "无法加载结账页。请刷新或返回订单 — 此错误不会重复扣款。",
    },
    th: {
      loginError: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      loadError: "เกิดข้อผิดพลาดในการโหลด",
      failedToLoad: "โหลดไม่สำเร็จ",
      failedToLoadTransactions: "โหลดธุรกรรมไม่สำเร็จ",
      failedToLoadListing: "โหลดประกาศไม่สำเร็จ",
      invalidCoords: "ละติจูด: -90…90 ลองจิจูด: -180…180",
      partnerCal_urlError: "โหลดลิงก์ไม่ได้ ลองรีเฟรชหรือเข้าสู่ระบบใหม่",
      bookingErr_priceMismatch:
        "ราคามีการอัปเดต ลองเปลี่ยนวันที่หรือจำนวนผู้เข้าพักแล้วลองอีกครั้งเพื่อให้ยอดตรงกับระบบ",
      bookingErr_datesConflict:
        "ขออภัย วันที่นี้เพิ่งถูกจองโดยผู้ใช้อื่น กรุณาเลือกวันอื่น",
      bookingErr_guestsExceed: "เกินจำนวนผู้เข้าพักสูงสุดของประกาศนี้ กรุณาลดจำนวน",
      bookingErr_priceAttestationRequired: "ต้องการใบเสนอราคาใหม่ รีเฟรชแล้วเลือกวันที่อีกครั้ง",
      bookingErr_bookingMinTotal:
        "ยอดที่ต้องชำระขั้นต่ำ (รวมค่าบริการ) คือ 100 THB ลองพักนานขึ้นหรือเลือกประกาศอื่น",
      bookingErr_generic: "ดำเนินการจองไม่สำเร็จ กรุณาลองอีกครั้ง",
      rootNotFound_title: "ไม่พบหน้านี้",
      rootNotFound_body: "ไม่มีหน้านี้หรือถูกย้ายแล้ว กลับหน้าแรกเพื่อค้นหาต่อ",
      rootError_title: "เกิดข้อผิดพลาด",
      rootError_body: "โหลดหน้านี้ไม่สำเร็จ ลองใหม่หรือกลับหน้าแรก",
      checkoutSegmentError_body:
        "โหลดหน้าชำระเงินไม่สำเร็จ รีเฟรชหรือกลับรายการจอง — ข้อผิดพลาดนี้ไม่ตัดเงินซ้ำ",
    },
}
