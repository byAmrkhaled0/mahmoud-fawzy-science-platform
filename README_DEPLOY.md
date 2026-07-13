# Deploy Secure Mobile V43

## Vercel

- Framework: Other
- Build Command: `npm run build`
- Output Directory: `dist`
- Root Directory: empty

## Firebase backend

راجع `FIREBASE_SETUP_V43.md` ثم نفذ:

```powershell
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only functions
```

صفحة المدرس الخاصة:

```text
/teacher-login.html
```
