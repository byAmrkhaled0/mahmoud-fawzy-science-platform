# نشر الإصدار 54

## Vercel

- Framework: Other
- Build Command: `npm run build`
- Output Directory: `dist`
- Root Directory: empty

## Firebase backend

نفّذ بالترتيب من مجلد المشروع:

```powershell
firebase deploy --only functions
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only hosting
```

صفحة المدرس الخاصة:

```text
/teacher-login.html
```

يمكن أيضًا تنفيذ كل الاختبارات والنشر بالأمر:

```powershell
npm run firebase:deploy:all
```

راجع `UPGRADE_V54_AR.md` للاختبار بعد النشر.
