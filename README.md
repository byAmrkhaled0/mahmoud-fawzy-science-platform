# منصة مستر محمود إبراهيم فوزي — Secure Mobile V43

منصة تعليمية عربية مبنية بـHTML/CSS/JavaScript وFirebase، وتعمل بنظام كود الطالب فقط بدون Accounts أو Passwords للطلاب.

## التشغيل المحلي

```powershell
npm run dev
```

ثم افتح:

```text
http://127.0.0.1:5173
```

## الاختبار والبناء

```powershell
npm test
npm run build
```

نسخة النشر تُنشأ داخل `dist/`.

## إعداد Firebase

ابدأ من الملف:

```text
FIREBASE_SETUP_V43.md
```

## أهم خصائص الأمان

- كود الطالب منفصل عن كود ولي الأمر.
- حسابات Firebase Authentication للمدرس وفريق العمل فقط.
- الأكواد القوية تُنشأ داخل Cloud Function.
- الإجابات الصحيحة لا تصل إلى متصفح الطالب.
- التصحيح والتسليم ومنع تكرار المحاولة تتم على السيرفر.
- App Check وRules وRate Limiting وTTL جاهزة للتفعيل.
