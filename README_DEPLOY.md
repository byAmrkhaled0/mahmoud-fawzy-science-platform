# نشر الإصدار 59.6.2

هذا الإصدار يغيّر الواجهة وFirebase Functions معًا. يجب نشر الدوال والقواعد ثم رفع المصدر إلى GitHub ليبني Vercel مجلد `dist`.

## الإعداد على Vercel

- Framework Preset: `Other`
- Build Command: `npm run build`
- Output Directory: `dist`
- Root Directory: اتركه فارغًا

## أوامر PowerShell الكاملة

نفّذ من مجلد المشروع بعد تسجيل الدخول في Firebase وGitHub:

```powershell
$ErrorActionPreference = "Stop"
$env:FUNCTIONS_DISCOVERY_TIMEOUT = "60"

npm test
npm run build
npm --prefix functions ci --no-audit --no-fund
npm --prefix functions run lint

firebase deploy --only functions
firebase deploy --only firestore:rules,firestore:indexes,storage

git add -A
git commit -m "Fix exam editor and add staged admin loading"
git push origin main
```

بعد أن تصبح عملية Vercel `Ready` افتح المسارات التالية واختبر Refresh لكل واحد:

```text
/
/student.html
/parent.html
/exams.html
/materials.html
/teacher-login.html
```

## اختبار مزامنة الامتحان

1. افتح صفحة الامتحانات بكود طالب دون بدء الامتحان.
2. ابدأ الامتحان من جهاز الطالب واترك العداد ظاهرًا.
3. عدّل مدة الامتحان أو موعد الإغلاق من لوحة المدرس واحفظ.
4. يتحدث عداد الطالب تلقائيًا خلال 45 ثانية، أو فور الخروج والمتابعة من جديد.
5. تظل إجابات الطالب ونسخة الأسئلة كما هي؛ الذي يتغير هو الوقت فقط.

## اختبار منشئ الامتحان والسرعة

1. افتح «الامتحانات»، وأنشئ عدة أسئلة واختر الإجابة الصحيحة لكل سؤال ثم احفظ مرة واحدة.
2. افتح الامتحان للتعديل وتأكد أن نفس الإجابات المختارة والمواعيد رجعت كما هي.
3. انتقل بين «الطلاب» و«الحضور» و«الامتحانات»؛ أحدث السجلات تظهر أولًا والباقي يُحمّل تدريجيًا.
4. إذا احتجت كل السجل فورًا اضغط «تحميل الكل الآن» داخل شريط حالة التحميل.
5. بعد نشر `firestore:indexes` قد يستغرق Firebase عدة دقائق حتى تصبح الفهارس جاهزة؛ يوجد مسار احتياطي أثناء بنائها.

## اختبار ماسح الحضور

1. افتح «متابعة الحصة» من هاتف المدرس واضغط «مسح QR».
2. اسمح بالكاميرا ثم وجّه الكاميرا الخلفية إلى QR طالب.
3. قرّب الرمز حتى يملأ مربع القراءة؛ يجب أن يظهر اسم الطالب وتُسجل حالة الحضور.
4. جرّب رمز طالب آخر دون إغلاق الماسح للتأكد من المسح المتتابع.

مهم: رفع الواجهة إلى Vercel وحده لا يكفي لتفعيل التحقق الجديد من الصفوف وإصدار نسخة الامتحان؛ يجب نشر Firebase Functions أيضًا.
