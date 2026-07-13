# تعديلات Secure Mobile V43

## أمان الأكواد

- إنشاء كود الطالب وكود ولي الأمر داخل Cloud Function بدل الاعتماد على المتصفح.
- أكواد قوية عشوائية بالشكل `ST-XXXX-XXXX` و`PR-XXXX-XXXX`.
- التحقق من صلاحية حساب المدرس قبل إنشاء الطالب.
- Rate Limiting مزدوج: للكود نفسه ولعنوان IP.

## أمان الامتحانات

- الإجابات الصحيحة لا تُرسل للطالب.
- التصحيح يتم داخل Cloud Functions.
- جلسة الامتحان أصبحت ثابتة لكل طالب وامتحان.
- إعادة فتح الامتحان لا تعيد الوقت من البداية.
- تخزين Snapshot للأسئلة داخل جلسة خاصة غير قابلة للقراءة من الواجهة.
- حد أقصى لحجم Payload الإجابات.
- منع عدد إجابات أكبر من عدد الأسئلة.
- منع التسليم المكرر عند تعطيل Retake.

## أمان الواجبات

- Storage Rules تسمح فقط بصورة أو PDF حتى 10MB.
- Metadata الواجب لا تُكتب مباشرة من المتصفح إلى Firestore.
- Cloud Function تتحقق من كود الطالب ومسار الملف ونوعه وحجمه.

## Firebase

- Firestore Rules مغلقة افتراضيًا.
- Exam sessions وlocks وrate limits غير قابلة للقراءة العامة.
- App Check جاهز للـFunctions وFirestore وStorage.
- TTL Fields مضافة إلى rate limits وجلسات الامتحان.
- firebase-config.js لا يتم تخزينه طويلًا في Cache حتى تصل تحديثات App Check بسرعة.

## الجودة

- `npm test` يفحص JavaScript وJSON والروابط المحلية وDuplicate IDs والـCloud Functions المطلوبة.
- `npm run build` يبني نسخة `dist`.
- تم تثبيت override آمن لـ`uuid` لإزالة تحذيرات npm audit في dependencies الخاصة بالـFunctions.
