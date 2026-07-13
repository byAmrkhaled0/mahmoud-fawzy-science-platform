# Stable V51 deployment

This release removes Firebase App Check/reCAPTCHA from the web app and callable functions.
Public booking first uses `createBooking`; if the callable is temporarily unavailable it falls back to a tightly validated Firestore write.

Run from the project root:

```powershell
npm run deploy:production
```

In Firebase Console → App Check → APIs, leave Enforcement disabled. The registered reCAPTCHA provider may be deleted because the code no longer uses it.

In Vercel, the production branch must be `main`, Framework Preset `Other`, Build Command `npm run build`, Output Directory `dist`, Node.js `24.x`.
