# إصلاح ونشر Cloud Functions — V44

هذه النسخة تستخدم Node.js 22 في:

- `functions/package.json`
- `firebase.json`

## الأوامر من مجلد المشروع الرئيسي

```powershell
node -v
npm install -g firebase-tools@latest

Remove-Item -Recurse -Force .\functions\node_modules -ErrorAction SilentlyContinue
cd .\functions
npm ci
npm ls firebase-functions firebase-admin
cd ..

firebase login
firebase use mahmoud-fawzy-science-platform
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only functions
```

يجب أن يظهر أمر `npm ls` الحزمتين بدون `missing` أو `empty`.

إذا فشل `npm ci` بسبب ملف قفل قديم:

```powershell
cd .\functions
Remove-Item .\package-lock.json -Force
npm install
npm ls firebase-functions firebase-admin
cd ..
```
