'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  normalizeAcademicValue,
  sameAcademicValue,
  scheduleMatchesStudent,
  learningTargetMatchesStudent
} = require('../functions/lib/academic-targeting');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Arabic grade values match despite digits, spacing, diacritics and Alef variants', () => {
  assert.equal(normalizeAcademicValue('  الصَّف الأوّل الإعدادي  '), 'الصف الاول الاعدادي');
  assert.equal(sameAcademicValue('الصف ١ الإعدادي', 'الصف 1 الاعدادي'), true);
});

test('student transfer options accept only active schedules from the same grade and term', () => {
  const student = { grade:'الصف ١ الإعدادي', term:'الترم الأول', academicYear:'2026 / 2027' };
  assert.equal(scheduleMatchesStudent({
    active:true,
    grade:'الصف 1 الاعدادي',
    term:'الترم الاول',
    academicYear:'2026 / 2027'
  }, student), true);
  assert.equal(scheduleMatchesStudent({
    active:true,
    grade:'الصف 1 الاعدادي',
    term:'كل الترمات',
    academicYear:'كل الأعوام'
  }, student), true);
  assert.equal(scheduleMatchesStudent({ active:true, grade:'الصف الثاني الإعدادي' }, student), false);
  assert.equal(scheduleMatchesStudent({ active:false, grade:'الصف 1 الاعدادي' }, student), false);
});

test('assignments and exams use the same normalized academic targeting', () => {
  const student = { grade:'الصف الثالث الإعدادي', group:'مجموعة السبت  ', term:'الترم الأول' };
  assert.equal(learningTargetMatchesStudent({
    grade:'الصف الثالث الاعدادي',
    group:'مجموعة  السبت',
    term:'الترم الاول'
  }, student), true);
  assert.equal(learningTargetMatchesStudent({ grade:'الصف الثاني الإعدادي', group:'كل المجموعات' }, student), false);
});

test('student portal and admin bundle contain the complete transfer workflow', () => {
  const app = read('assets/app.js');
  const sync = read('assets/firebase-sync.js');
  const admin = read('assets/admin.js');
  const functions = read('functions/index.js');
  assert.match(app, /data-student-tab="transfer"/);
  assert.match(app, /data-student-open-tab="transfer"/);
  assert.match(app, /bindStudentTransferForms/);
  assert.match(sync, /createStudentTransferRequest/);
  assert.match(sync, /studentTransferRequests:records\.studentTransferRequests/);
  assert.match(admin, /reviewStudentTransferRequestAdmin/);
  assert.match(functions, /exports\.createStudentTransferRequest/);
  assert.match(functions, /exports\.reviewStudentTransferRequest/);
});

test('transfer choices come from live groups and hide full schedules', () => {
  const app = read('assets/app.js');
  const functions = read('functions/index.js');
  assert.match(functions, /db\.collection\('groups'\)\.limit\(300\)/);
  assert.match(functions, /scheduleMatchesStudent\(item, student\)/);
  assert.match(functions, /scheduleEnrollment\(item, item\.id, studentCode\)/);
  assert.match(functions, /if \(enrolled\.length >= capacity\) return null/);
  assert.match(app, /متبقي \$\{esc\(item\.availableSeats\)\} مكان/);
});

test('Saad-style center admin navigation and mobile controls are included without online sections', () => {
  const admin = read('assets/admin.js');
  const css = read('assets/v60.css');
  assert.match(admin, /const adminSectionGroups/);
  assert.match(admin, /quickAdminCreate\('schedule'\)/);
  assert.match(admin, /quickAdminCreate\('attendance'\)/);
  assert.doesNotMatch(admin, /onlineContent/);
  assert.match(css, /\.admin-mobile-bottom\{/);
  assert.match(css, /display:grid!important/);
  assert.match(css, /\.student-transfer-form select\{min-height:54px\}/);
});
