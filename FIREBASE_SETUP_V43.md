# إعداد Firebase للنسخة Secure Mobile V43

هذه النسخة تحافظ على دخول الطالب **بالكود فقط**، بدون حسابات أو كلمات مرور للطلاب وأولياء الأمور. حسابات Firebase Authentication مخصصة للمدرس وفريق العمل فقط.

## ما تم تنفيذه داخل الكود

- Cloud Functions لدخول الطالب وولي الأمر، الحجز، متابعة الحجز، التقييمات، الامتحانات، وتسليم الواجبات.
- منع إرسال الإجابات الصحيحة إلى متصفح الطالب.
- تصحيح الاختياري على السيرفر.
- جلسة امتحان ثابتة تمنع إعادة تشغيل الوقت من البداية بالضغط على Refresh أو Start مرة ثانية.
- حفظ نسخة الأسئلة داخل جلسة الامتحان حتى لا تتغير نتيجة الطالب إذا عدّل المدرس الامتحان أثناء الحل.
- Rate Limiting مزدوج حسب الكود وحسب IP.
- أكواد قوية مستقلة للطالب وولي الأمر تُنشأ من السيرفر.
- قواعد Firestore وStorage مغلقة افتراضيًا.
- App Check جاهز للتفعيل.
- TTL جاهز لمستندات Rate Limiting وجلسات الامتحان المؤقتة.
- Metadata الواجبات تُسجل من Cloud Function بدل الكتابة العامة المباشرة إلى Firestore.

---

## 1) المتطلبات

ثبّت Node.js 20 وFirebase CLI:

```powershell
npm install -g firebase-tools
firebase login
```

ثم من داخل مجلد المشروع:

```powershell
cd functions
npm install
cd ..
```

> نشر Cloud Functions يتطلب عادةً خطة Blaze في مشروع Firebase.

---

## 2) اختيار مشروع Firebase

المشروع مضبوط على:

```text
mahmoud-fawzy-science-platform
```

تحقق بالأمر:

```powershell
firebase use mahmoud-fawzy-science-platform
```

---

## 3) تشغيل الاختبارات والبناء

```powershell
npm test
npm run build
```

النسخة الجاهزة للنشر ستظهر داخل:

```text
dist
```

---

## 4) إعداد Authentication لفريق العمل فقط

من Firebase Console:

1. افتح **Authentication**.
2. افتح **Sign-in method**.
3. فعّل **Email/Password**.
4. أنشئ حساب المدرس.
5. انسخ UID الخاص بالحساب.
6. في Firestore أنشئ collection باسم `users`.
7. أنشئ document اسمه نفس UID.

بيانات حساب المدير:

```json
{
  "role": "admin",
  "active": true,
  "name": "مستر محمود إبراهيم فوزي"
}
```

الأدوار المتاحة:

- `admin`: كل الصلاحيات.
- `teacher`: إدارة الطلاب والمحتوى والحذف.
- `assistant`: متابعة وإضافة بيانات بدون الحذف الحساس.

لا تنشئ حسابات Firebase للطلاب أو أولياء الأمور.

---

## 5) نشر Firestore Rules وIndexes وStorage Rules

```powershell
firebase deploy --only firestore:rules,firestore:indexes,storage
```

بعد النشر انتظر حتى تصبح الفهارس بحالة Enabled.

---

## 6) أول نشر لـ Cloud Functions

اترك الملف:

```text
functions/.env
```

بهذا الشكل مؤقتًا:

```env
ENFORCE_APP_CHECK=false
```

ثم انشر:

```powershell
firebase deploy --only functions
```

الـFunctions تعمل في المنطقة:

```text
europe-west1
```

ونفس المنطقة موجودة في:

```text
assets/firebase-config.js
```

---

## 7) تفعيل Firebase App Check

بعد التأكد أن الموقع والـFunctions يعملان:

1. افتح **Firebase Console → App Check**.
2. اختر تطبيق الويب الحالي.
3. سجله باستخدام **reCAPTCHA v3**.
4. أضف دومين Vercel أو الدومين النهائي ضمن الدومينات المسموحة.
5. انسخ Site Key.
6. ضعه في:

```javascript
// assets/firebase-config.js
appCheckSiteKey: "SITE_KEY_HERE"
```

7. شغّل:

```powershell
npm test
npm run build
```

8. انشر الموقع الجديد.
9. راقب App Check Metrics وتأكد أن الطلبات Verified.
10. غيّر:

```env
ENFORCE_APP_CHECK=true
```

11. أعد نشر Functions:

```powershell
firebase deploy --only functions
```

12. من App Check فعّل Enforcement تدريجيًا للخدمات التالية:

- Cloud Functions
- Cloud Firestore
- Cloud Storage

لا تفعل Enforcement قبل نشر Site Key في الموقع، وإلا ستتوقف طلبات الطلاب.

### الاختبار المحلي بعد تفعيل App Check

في `assets/firebase-config.js` يوجد:

```javascript
appCheckDebugToken: ""
```

ضع Debug Token محليًا فقط، ولا ترفعه إلى GitHub أو الإنتاج. بعد الاختبار أعده إلى قيمة فارغة.

---

## 8) إعداد TTL Policies

من Firestore افتح **TTL Policies** وأنشئ سياستين:

### الأولى

- Collection group: `_rate_limits`
- Field: `expiresAt`

### الثانية

- Collection group: `exam_sessions`
- Field: `deleteAt`

وظيفتهما حذف البيانات المؤقتة تلقائيًا ومنع تراكمها.

---

## 9) مزامنة البيانات القديمة

بعد نشر القواعد والـFunctions:

1. افتح `teacher-login.html`.
2. سجّل الدخول بحساب المدرس.
3. اضغط **مزامنة Firebase** مرة واحدة.
4. افتح قسم **النسخ الاحتياطي** ونزّل Backup كامل.
5. افتح قسم **الطلاب**.
6. اضغط **ترقية الأكواد القديمة**.
7. تأكد أن كل طالب لديه:
   - كود طالب يبدأ بـ `ST-`
   - كود ولي أمر مختلف يبدأ بـ `PR-`

لا ترسل كود ولي الأمر للطالب.

---

## 10) نشر الموقع

### Vercel

```powershell
npm run build
```

الإعدادات:

- Framework: Other
- Build Command: `npm run build`
- Output Directory: `dist`

### Firebase Hosting

```powershell
npm run build
firebase deploy --only hosting
```

### نشر كل شيء مرة واحدة

بعد إتمام App Check والإعدادات:

```powershell
npm run firebase:deploy:all
```

---

## 11) إعداد Budget Alerts

من Google Cloud Billing:

1. افتح Billing.
2. أنشئ Budget صغير مناسب لك.
3. فعّل تنبيهات عند 50% و90% و100%.

هذا لا يوقف الخدمة تلقائيًا، لكنه ينبهك عند ارتفاع الاستهلاك.

---

## 12) اختبار نهائي إلزامي

نفذ السيناريو التالي كاملًا:

1. تسجيل دخول المدرس.
2. إنشاء طالب جديد من لوحة التحكم.
3. التأكد أن الأكواد تم إنشاؤها من Cloud Function.
4. دخول الطالب بكود الطالب.
5. رفض كود ولي الأمر في بوابة الطالب.
6. دخول ولي الأمر بكوده المنفصل.
7. إنشاء امتحان.
8. بدء الامتحان ثم Refresh والتأكد أن الوقت لم يبدأ من جديد.
9. فتح Network والتأكد أن `startExam` لا يعيد `answer` أو `correctAnswer`.
10. تسليم الامتحان.
11. التأكد من منع التسليم الثاني إذا كانت الإعادة غير مفعلة.
12. رفع صورة واجب أو PDF أقل من 10MB.
13. اختبار الموقع بعد App Check Enforcement.
14. تنزيل Backup جديد بعد نجاح الاختبار.

---

## أوامر النشر المختصرة

```powershell
npm test
npm run build
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only functions
```

واستخدم التالي فقط إذا كنت تستضيف على Firebase Hosting:

```powershell
firebase deploy --only hosting
```
