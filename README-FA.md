<div align="center">
  <img src="./assets/preview.png" alt="پیش‌نمایش پچر راست‌چین کلاود" width="100%">
  
  <h1>پچر راست‌چین و فونت Claude Desktop</h1>
  <p><strong>چیدمان راست‌چین (RTL)، فونت زیبای وزیرمتن و ویجت تنظیمات برای اپلیکیشن رسمی کلود دسکتاپ.</strong></p>

  [![npm version](https://img.shields.io/npm/v/@seyedalida/claude-rtl-patcher?color=blue)](https://www.npmjs.com/package/@seyedalida/claude-rtl-patcher)
  [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
  [![GitHub stars](https://img.shields.io/github/stars/seyedalida/claude-rtl-patcher?style=flat&color=yellow)](https://github.com/seyedalida/claude-rtl-patcher/stargazers)

  [Read in English](./README.md)
</div>

---

**Claude RTL Patcher** یک ابزار سبک و خودکار است که پشتیبانی از متون راست‌چین (RTL)، فونت زیبای **وزیرمتن** و ویجت تنظیمات درون‌برنامه را به نرم‌افزار رسمی **Claude Desktop** در سیستم‌عامل‌های **macOS**، **Windows** و **Linux** اضافه می‌کند.

این پچر بدون تغییر تاریخچه چت‌ها یا اطلاعات حساب کاربری، متن‌های فارسی را مرتب کرده و بلوک‌های کد، فرمول‌ها و متون انگلیسی را کاملاً دست‌نخورده حفظ می‌کند.

---

## نصب و راه‌اندازی

کافی است این دستور را در ترمینال سیستم خود (Terminal / PowerShell / CMD) اجرا کنید:

```bash
npx @seyedalida/claude-rtl-patcher
```

مراحل نصب خودکار انجام می‌شود؛ پس از اتمام، یک‌بار کلود را کامل ببندید (`Cmd + Q` در مک یا `Ctrl + Q` در ویندوز/لینوکس) و دوباره باز کنید.

> **نکته ویندوز:** اگر کلود را از مایکروسافت استور نصب کرده‌اید، از نسخه استاندارد نصبی در [claude.ai/download](https://claude.ai/download) استفاده کنید.

جهت بازگردانی کلود به وضعیت اورجینال در هر زمان:

```bash
npx @seyedalida/claude-rtl-patcher --restore
```

---

## امکانات کلیدی

- **ویجت تنظیمات داخل برنامه:** ویجت شناور در گوشه پایین کلود برای تنظیم زنده اندازه قلم، فاصله خطوط، فونت دلخواه سیستمی یا خاموش کردن موقت استایل‌ها.
- **فونت متغیر وزیرمتن:** تایپوگرافی مدرن با ضخامت‌های طبیعی (`100` تا `900`) و اولویت استفاده از فونت نصب‌شده روی سیستم‌عامل.
- **راست‌چین هوشمند:** تشخیص خودکار زبان به ازای هر پاراگراف بدون برعکس شدن جملات انگلیسی.
- **سازگار با کد و برنامه‌نویسی:** عدم تغییر بلوک‌های کد، کدهای خطی، سینتکس هایلایت، فرمول‌های ریاضی (KaTeX) و بخش‌های تفکر مدل (Extended Thinking).
- **تناسب ابعاد تیترها:** اصلاح اندازه تیترها (`h1` تا `h6`) برای خوانایی عناوین فرعی در متن‌های فارسی.
- **میانبرها و کلیدها:**
  - `Alt + R`: سوییچ سریع میان حالت‌های چیدمان (خودکار، اجباری، غیرفعال).
  - `Shift + 2`: تایپ مستقیم کاراکتر `@` روی کیبورد فارسی به جای علامت «٬».

---

## گزینه‌های خط فرمان (CLI)

```bash
npx @seyedalida/claude-rtl-patcher [گزینه‌ها] [مسیر_برنامه]
```

| گزینه | توضیحات |
|---|---|
| *(بدون گزینه)* | اجرای تعاملی با تشخیص خودکار مسیر و سیستم‌عامل. |
| `--restore` | بازگردانی آنی نسخه پشتیبان اورجینال. |
| `--font-only` | فقط اعمال فونت وزیرمتن بدون تغییر جهت متن. |
| `--full` | اعمال پچ کامل روی تمام نسخه‌ها. |
| `--yes`, `-y` | تایید خودکار و رد شدن از پرسش‌ها. |

---

## لایسنس و قدردانی

- منتشرشده تحت لایسنس آزاد [MIT](./LICENSE).
- بر پایه پروژه اصلی [claude-rtl-patcher](https://github.com/m4tinbeigi-official/claude-rtl-patcher) اثر [متین بیگی](https://github.com/m4tinbeigi-official).
- فونت: [وزیرمتن](https://github.com/rastikerdar/vazirmatn) اثر جاودان زنده‌یاد صابر راستی‌کردار (تحت لایسنس OFL).
