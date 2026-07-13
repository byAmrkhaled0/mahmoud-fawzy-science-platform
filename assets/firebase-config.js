// Firebase configuration for Mahmoud Fawzy Science Platform.
// Firebase web keys are public identifiers; security depends on Rules, App Check and Cloud Functions.
window.MF_FIREBASE_CONFIG = {
  enabled: true,
  apiKey: "AIzaSyANU2fln6kuYCtdm1WRMtG-AD5pUwV9a4g",
  authDomain: "mahmoud-fawzy-science-platform.firebaseapp.com",
  projectId: "mahmoud-fawzy-science-platform",
  storageBucket: "mahmoud-fawzy-science-platform.firebasestorage.app",
  messagingSenderId: "805108517684",
  appId: "1:805108517684:web:68c0cb7e506a583e3a7361",
  measurementId: "G-V5MR9BGCJQ",

  // Cloud Functions location used by the secure student portal and exam flow.
  functionsRegion: "europe-west1",
  useSecureFunctions: true,

  // ضع هنا reCAPTCHA v3 Site Key بعد تفعيل Firebase App Check.
  // اتركه فارغًا أثناء التجهيز المحلي فقط.
  appCheckSiteKey: "6LeYo1AtAAAAAJDMJAIduUWNn-2JoDYNaNm24VSx",

  // اختياري للاختبار المحلي فقط. لا ترفع Debug Token إلى GitHub أو الإنتاج.
  appCheckDebugToken: ""
};
