'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
  'index.html', 'student.html', 'parent.html', 'exams.html', 'teacher-login.html',
  'assets/app.js', 'assets/admin.js', 'assets/firebase-sync.js', 'assets/firebase-config.js',
  'firestore.rules', 'storage.rules', 'firestore.indexes.json', 'firebase.json',
  'functions/index.js', 'functions/package.json', 'service-worker.js', 'offline.html'
];

const failures = [];
const ok = message => console.log(`✓ ${message}`);
const fail = message => failures.push(message);

for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) fail(`Missing required file: ${relative}`);
}
if (!failures.length) ok('Required files exist');

const jsFiles = [
  'assets/app.js', 'assets/admin.js', 'assets/firebase-sync.js', 'assets/firebase-config.js',
  'functions/index.js', 'local-server.js', 'scripts/build.js'
];
for (const relative of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, relative)], { encoding: 'utf8' });
  if (result.status !== 0) fail(`JavaScript syntax failed: ${relative}\n${result.stderr}`);
}
if (!failures.some(x => x.startsWith('JavaScript syntax'))) ok('JavaScript syntax checks passed');

const jsonFiles = ['package.json', 'firebase.json', 'firestore.indexes.json', 'site.webmanifest', 'vercel.json', 'functions/package.json'];
for (const relative of jsonFiles) {
  try { JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')); }
  catch (error) { fail(`Invalid JSON: ${relative} (${error.message})`); }
}
if (!failures.some(x => x.startsWith('Invalid JSON'))) ok('JSON files are valid');

const htmlFiles = fs.readdirSync(root).filter(name => name.endsWith('.html'));
const localRefPattern = /(?:src|href)=["']([^"'#?]+)["']/g;
for (const htmlFile of htmlFiles) {
  const html = fs.readFileSync(path.join(root, htmlFile), 'utf8');
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

const functionsSource = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
for (const name of ['getPortalStudent', 'createStudentAccess', 'createBooking', 'getBookingStatus', 'createReview', 'getExamDashboard', 'startExam', 'submitExam', 'registerHomeworkSubmission', 'reportClientError']) {
  if (!functionsSource.includes(`exports.${name} = onCall`)) fail(`Missing callable function export: ${name}`);
}
if (/questions:\s*questions\.map\(q\s*=>\s*\(\{[^}]*answer/s.test(functionsSource)) {
  fail('startExam response appears to expose answers');
}
if (!failures.some(x => x.startsWith('Missing callable') || x.includes('expose answers'))) ok('Secure callable function checks passed');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
if (!rules.includes('match /exam_sessions/{id}') || !rules.includes('allow read, write: if false;')) {
  fail('Exam session rules are not closed');
}
if (!rules.includes('match /homework_submissions/{id}') || !rules.includes('allow create: if false;')) {
  fail('Homework metadata creation is not restricted to Cloud Functions');
}
if (!failures.some(x => x.includes('rules are not') || x.includes('metadata creation'))) ok('Firestore security rule checks passed');

if (failures.length) {
  console.error('\nVerification failed:');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log('\nAll verification checks passed.');
