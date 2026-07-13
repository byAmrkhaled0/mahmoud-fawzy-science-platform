'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
  'index.html', 'student.html', 'parent.html', 'exams.html', 'teacher-login.html',
  'assets/app.js', 'assets/admin.js', 'assets/v53-upgrades.js',
  'assets/firebase-sync.js', 'assets/firebase-config.js', 'assets/icon-maskable-512.png',
  'firestore.rules', 'storage.rules', 'firestore.indexes.json', 'firebase.json',
  'functions/index.js', 'functions/package.json', 'service-worker.js', 'site.webmanifest', 'teacher.webmanifest', 'offline.html'
];

const failures = [];
const ok = message => console.log(`✓ ${message}`);
const fail = message => failures.push(message);
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) fail(`Missing required file: ${relative}`);
}
if (!failures.length) ok('Required files exist');

const jsFiles = [
  'assets/app.js', 'assets/admin.js', 'assets/v53-upgrades.js',
  'assets/firebase-sync.js', 'assets/firebase-config.js',
  'functions/index.js', 'local-server.js', 'scripts/build.js'
];
for (const relative of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, relative)], { encoding: 'utf8' });
  if (result.status !== 0) fail(`JavaScript syntax failed: ${relative}\n${result.stderr}`);
}
if (!failures.some(x => x.startsWith('JavaScript syntax'))) ok('JavaScript syntax checks passed');

const jsonFiles = ['package.json', 'package-lock.json', 'firebase.json', 'firestore.indexes.json', 'site.webmanifest', 'teacher.webmanifest', 'vercel.json', 'functions/package.json'];
for (const relative of jsonFiles) {
  try { JSON.parse(read(relative)); }
  catch (error) { fail(`Invalid JSON: ${relative} (${error.message})`); }
}
if (!failures.some(x => x.startsWith('Invalid JSON'))) ok('JSON files are valid');

const htmlFiles = fs.readdirSync(root).filter(name => name.endsWith('.html'));
const localRefPattern = /(?:src|href)=["']([^"'#?]+)["']/g;
for (const htmlFile of htmlFiles) {
  const html = read(htmlFile);
  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map(match => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) fail(`Duplicate IDs in ${htmlFile}: ${[...new Set(duplicates)].join(', ')}`);

  for (const match of html.matchAll(localRefPattern)) {
    const ref = match[1];
    if (/^(https?:|mailto:|tel:|javascript:|data:)/i.test(ref)) continue;
    const clean = ref.replace(/^\//, '');
    if (!clean || clean.endsWith('/')) continue;
    if (!fs.existsSync(path.join(root, clean))) fail(`Broken local reference in ${htmlFile}: ${ref}`);
  }
}
if (!failures.some(x => x.startsWith('Duplicate IDs') || x.startsWith('Broken local reference'))) ok('HTML IDs and local references passed');

const appCheckScanFiles = ['assets/firebase-config.js', 'assets/firebase-sync.js', 'functions/index.js', ...htmlFiles];
for (const relative of appCheckScanFiles) {
  const content = read(relative);
  if (/firebase-app-check|appCheckSiteKey|enforceAppCheck|ENFORCE_APP_CHECK|ReCaptchaV3Provider/i.test(content)) {
    fail(`App Check/reCAPTCHA reference remains in: ${relative}`);
  }
}
if (!failures.some(x => x.includes('App Check/reCAPTCHA'))) ok('App Check and reCAPTCHA are fully removed');

const syncSource = read('assets/firebase-sync.js');
if (/createBookingDirect|createReviewDirect/.test(syncSource)) fail('A public direct-write fallback still exists for booking or reviews');
if (!syncSource.includes("throw new Error('Secure booking function is unavailable')") || !syncSource.includes("throw new Error('Secure review function is unavailable')")) {
  fail('Booking/review Cloud Function enforcement is missing');
}
if (!syncSource.includes("doc('platform')") || syncSource.includes("legacySiteDoc.set")) {
  fail('Collection-backed settings migration is incomplete');
}
if (!failures.some(x => x.includes('public direct-write') || x.includes('Cloud Function enforcement') || x.includes('settings migration'))) {
  ok('Public forms use secure Cloud Functions and v54 collection storage');
}

const functionsSource = read('functions/index.js');
const callableNames = [
  'getPortalStudent', 'createStudentAccess', 'createBooking', 'approveBooking', 'getBookingStatus', 'createReview',
  'getExamDashboard', 'startExam', 'submitExam', 'registerHomeworkSubmission', 'reportClientError',
  'createBackupNow', 'listAutomaticBackups', 'getBackupDownloadUrl', 'restoreAutomaticBackup', 'deleteStudentSafely'
];
for (const name of callableNames) {
  if (!functionsSource.includes(`exports.${name} = onCall`)) fail(`Missing callable function export: ${name}`);
}
if (!functionsSource.includes('exports.scheduledPlatformBackup = onSchedule')) fail('Scheduled daily backup export is missing');
if (/questions:\s*questions\.map\(q\s*=>\s*\(\{[^}]*answer/s.test(functionsSource)) fail('startExam response appears to expose answers');
if (!functionsSource.includes("backupFormatVersion: 2") || !functionsSource.includes("createPlatformBackup('pre-restore'")) {
  fail('Safe backup restore protection is incomplete');
}
if (!failures.some(x => x.startsWith('Missing callable') || x.includes('Scheduled daily') || x.includes('expose answers') || x.includes('backup restore'))) {
  ok('Secure callable, exam, backup, and safe-delete checks passed');
}

const rules = read('firestore.rules');
if (!rules.includes('match /exam_sessions/{id}') || !rules.includes('allow read, write: if false;')) fail('Exam session rules are not closed');
if (!rules.includes('match /bookings/{bookingCode}') || !rules.includes('allow create: if false;')) fail('Public booking direct creation is not closed');
if (!rules.includes('match /reviews/{reviewId}') || !rules.includes('allow create: if false;')) fail('Public review direct creation is not closed');
if (!rules.includes('match /homework_submissions/{id}') || !rules.includes('allow create: if false;')) fail('Homework metadata creation is not restricted to Cloud Functions');
if (!rules.includes('request.resource.data.parentCode == resource.data.parentCode')) fail('Assistant code immutability rule is missing');
if (!failures.some(x => x.includes('rules are not') || x.includes('direct creation') || x.includes('metadata creation') || x.includes('immutability'))) {
  ok('Firestore security and assistant-permission checks passed');
}

const manifest = JSON.parse(read('site.webmanifest'));
if (manifest.display !== 'standalone' || manifest.scope !== '/' || !Array.isArray(manifest.icons)) fail('PWA manifest is incomplete');
if (!manifest.icons.some(icon => String(icon.purpose || '').includes('maskable') && icon.sizes === '512x512')) fail('Maskable PWA icon is missing');
const sw = read('service-worker.js');
if (!/mf-science-v\d+-production/.test(sw) || !sw.includes('/assets/v53-upgrades.js') || !sw.includes('/assets/icon-maskable-512.png') || !sw.includes('/teacher.webmanifest')) fail('Service worker app shell is incomplete');
const upgrade = read('assets/v53-upgrades.js');
if (!upgrade.includes('beforeinstallprompt') || !upgrade.includes('إضافة إلى الشاشة الرئيسية') || !upgrade.includes('navigator.standalone')) fail('Mobile install handling is incomplete');
if (!read('assets/app.js').includes('renderBookingScheduleOptions') || !read('index.html').includes('bookingScheduleId')) fail('Booking schedule linkage is incomplete');
if (!read('index.html').includes('bookingGroupSearch') || !read('assets/app.js').includes('لا توجد مجموعة مطابقة للبحث')) fail('Booking group search is incomplete');
if (!read('assets/firebase-sync.js').includes('saveGroup:async group') || !upgrade.includes('MFCloud?.saveGroup')) fail('Focused group persistence is incomplete');
if (!read('functions/index.js').includes("db.collection('groups').doc(selectedScheduleId).get()") || !read('functions/index.js').includes("where('name', '==', requestedGroup)") || !read('functions/index.js').includes('scheduleStartTime')) fail('Secure booking schedule validation is incomplete');
if (!read('functions/index.js').includes("invoker: 'public'")) fail('Callable browser/CORS invoker configuration is missing');
if (read('assets/app.js').includes('رقم ولي الأمر لازم يكون مختلف') || read('functions/index.js').includes('studentPhone === parentPhone')) fail('Same-number parent/student booking is still blocked');
if (!read('assets/app.js').includes('toEnglishDigits') || !read('functions/index.js').includes('normalizeDigits')) fail('Arabic and English digit normalization is incomplete');
if (!read('assets/admin.js').includes('MFCloud?.approveBooking') || !read('functions/index.js').includes('tx.delete(bookingRef)')) fail('Atomic booking approval and queue removal are incomplete');
if (/مجموعة السبت والثلاثاء|مجموعة الأحد والأربعاء|مجموعة الاثنين والخميس|أونلاين متابعة/.test(read('index.html'))) fail('Static booking groups must not appear in the booking form');
if (!failures.some(x => x.includes('PWA') || x.includes('Service worker') || x.includes('Mobile install'))) ok('Android and iPhone PWA installation checks passed');

const adminSource = read('assets/admin.js') + '\n' + upgrade;
for (const feature of ['importStudentsFile', 'exportStudentsCSV', 'exportAttendanceCSV', 'exportGradesCSV', 'academicYear', 'openAt', 'closeAt', 'renderClientErrors', 'pdfFile', 'showIssuedCodes']) {
  if (!adminSource.includes(feature)) fail(`Admin v54 feature is missing: ${feature}`);
}
if (!adminSource.includes('اشتراكات السنتر') || adminSource.includes('بوابة دفع')) fail('Center subscription wording is incomplete');
if (!failures.some(x => x.includes('Admin v54 feature') || x.includes('subscription wording'))) ok('Academic-year, export, error-monitoring, and center-subscription checks passed');

if (failures.length) {
  console.error('\nVerification failed:');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log('\nAll verification checks passed.');
