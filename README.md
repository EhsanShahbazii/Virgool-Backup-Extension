# ویرگول بک‌آپ (Virgool Backup)

<p align="center">
  <img src="assets/icons/icon-128.png" width="96" height="96" alt="Virgool Backup Logo">
</p>

<p align="center">
  <b>افزونه قدرتمند و مدرن گوگل کروم جهت استخراج، بایگانی و پشتیبان‌گیری کامل از مقالات، تصاویر، فایل‌های صوتی و زنجیره نظرات تو در توی کاربران در ویرگول (Virgool.io)</b>
</p>

<p align="center">
  <a href="https://github.com/EhsanShahbazii"><img src="https://img.shields.io/badge/Developer-Ehsan%20Shahbazi-107abe?style=flat-square" alt="Developer"></a>
  <a href="https://github.com/EhsanShahbazii/virgool-backup"><img src="https://img.shields.io/badge/Release-v1.0.0-green?style=flat-square" alt="Version"></a>
  <img src="https://img.shields.io/badge/Manifest-V3-blue?style=flat-square" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Language-Persian%20%2F%20RTL-orange?style=flat-square" alt="Persian RTL">
</p>

---

## قابلیت‌های برجسته

- **استخراج کامل محتوای متنی و چندرسانه‌ای**: استخراج تیترها، پاراگراف‌ها، بلوک‌های کد، نقل‌قول‌ها، تصاویر باکیفیت و پیوندهای پادکست / فایل صوتی مقالات.
- **پشتیبانی بازگشتی از تمام سطوح نظرات (Recursive Comments Tree)**: استخراج پاسخ‌های تودرتو بدون محدودیت در عمق درخت نظرات با الگوریتم بازگشتی روی API ویرگول.
- **خروجی چاپی و PDF استاندارد**: طراحی RTL اختصاصی با فونت زیبای وزیرمتن (Vazirmatn)، صفحه جلد سفارشی شامل آواتار نویسنده و خلاصه آمار، و عدم به‌هم‌ریختگی حروف فارسی.
- **خروجی داده‌ای JSON و Markdown**: خروجی استاندارد و ساختاریافته به فرمت JSON برای مهاجرت داده و فایل‌های مجزای Markdown با فرانت‌متر YAML.
- **انتخاب چندگانه مقالات (Multi-Select Export)**: امکان انتخاب مقالات خاص و خروجی گرفتن دسته‌جمعی از مقالات انتخابی.
- **نسخه‌بندی خودکار نام‌های کاربری تکراری (v1, v2, v3, ...)**: نگهداری مستقل چند نسخه بک‌آپ از یک کاربر بدون بازنویسی یا از بین رفتن داده‌های پیشین.
- **داشبورد مدیریت حرفه‌ای**: سایدبار تاریخچه پشتیبان‌ها، امکان حذف نسخه‌های دلخواه، جستجوی زنده و فیلتر لحظه‌ای مقالات.
- **صفحه‌بندی واکنش‌گرا**: امکان تعیین تعداد مقالات در هر صفحه (۸، ۱۶، ۲۴، ۴۸ و ۹۶ مورد) و ناوبری نرم.
- **قابلیت لغو پشتیبان‌گیری (Cancel Support)**: امکان توقف سریع و ایمن درخواست‌های شبکه در هر مرحله با AbortController.
- **طراحی منطبق بر هویت بصری ویرگول**: استفاده از آیکون‌های وکتور SVG مدرن، فونت وزیرمتن و عدم استفاده از اموجی.

---

## راهنمای نصب و راه‌اندازی

1. این مخزن را دانلود یا کلون کنید:
   ```bash
   git clone https://github.com/EhsanShahbazii/virgool-backup.git
   ```
2. مرورگر مبتنی بر کرومیوم (Google Chrome, Brave, Edge) را باز کنید و وارد آدرس زیر شوید:
   ```
   chrome://extensions/
   ```
3. گزینه **Developer mode** را در بالای صفحه فعال کنید.
4. دکمه **Load unpacked** را بزنید و پوشه پروژه را انتخاب کنید.
5. افزونه با موفقیت نصب شده و در نوار ابزار شما آماده استفاده خواهد بود!

---

## معماری و ساختار پروژه

```
virgool-backup/
├── manifest.json              # فایل پیکربندی Manifest V3
├── assets/                    # آیکون‌های رسمی در ابعاد مختلف
├── background/                # سرویس‌ورکر پس‌زمینه (Service Worker)
├── content/                   # کانتنت اسکریپت تشخیص خودکار صفحه نویسنده
├── popup/                     # پنجره پاپ‌آپ اصلی و نوار پیشرفت زنده
├── manager/                   # داشبورد کامل مدیریت و بایگانی مقالات
├── print/                     # موتور رندر و قالب کتابچه چاپی PDF
├── lib/
│   ├── virgool-api.js         # ماژول ارتباط با API و استخراج بازگشتی نظرات
│   ├── body-parser.js         # پارسر استخراج ساختاریافته محتوای مقالات
│   ├── storage.js             # مدیریت پایگاه‌داده محلی با IndexedDB
│   ├── date-utils.js          # تبدیل تاریخ‌های شمسی و اعداد فارسی
│   └── exporters/             # ماژول‌های خروجی JSON و Markdown
└── test/                      # تست‌های خودکار یکپارچه‌سازی و اعتبارسنجی
```

---

## توسعه‌دهنده

توسعه‌داده‌شده با عشق توسط **احسان شهبازی (Ehsan Shahbazi)**  
گیت‌هاب: [https://github.com/EhsanShahbazii](https://github.com/EhsanShahbazii)

---

## لایسنس

این پروژه تحت مجوز MIT منتشر شده است.
