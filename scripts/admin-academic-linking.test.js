'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../assets/admin.js'), 'utf8');
const mobileStyles = fs.readFileSync(path.resolve(__dirname, '../assets/v60.css'), 'utf8');
const academicStart = source.indexOf('function stCode(');
const academicEnd = source.indexOf('function calcStudentAdmin(');
const requestStart = source.indexOf('function studentRequestLinkedStudent(');
const requestEnd = source.indexOf('function studentRequestRows(');

assert.ok(academicStart >= 0 && academicEnd > academicStart, 'academic helpers must exist');
assert.ok(requestStart >= 0 && requestEnd > requestStart, 'request linking helpers must exist');

const context = {
  GRADES: ['رابعة ابتدائي', 'أولى إعدادي', 'تانية إعدادي', 'تالتة ثانوي'],
  adminData: {
    groups: [
      { id: 'group-1', name: 'مجموعة السبت', grade: 'أولى إعدادي', active: true },
      { id: 'group-2', name: 'مجموعة الأحد', grade: 'أولى إعدادي', active: true },
      { id: 'group-3', name: 'مجموعة الإثنين', grade: 'تانية إعدادي', active: true }
    ],
    students: [{
      studentCode: '12345678',
      studentName: 'أحمد محمد علي',
      scheduleId: 'group-1',
      studentPhone: '01011112222',
      parentPhone: '01099998888',
      attendance: [
        { status: 'absent', date: '2026-07-20', scheduleId: 'group-1' },
        { status: 'absent', date: '2026-07-23', scheduleId: 'group-1' }
      ]
    }]
  },
  normalizeText(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  },
  toEnglishDigits(value) {
    return String(value || '');
  },
  phoneDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }
};

vm.createContext(context);
vm.runInContext(`${source.slice(academicStart, academicEnd)}\n${source.slice(requestStart, requestEnd)}`, context, {
  filename: 'admin-academic-linking-runtime.js'
});

test('legacy student academic data resolves from scheduleId', () => {
  const student = context.academicStudent(context.adminData.students[0]);
  assert.equal(student.grade, 'أولى إعدادي');
  assert.equal(student.group, 'مجموعة السبت');
  assert.equal(student.scheduleId, 'group-1');
});

test('grade and group catalogs include Firebase schedules', () => {
  const grades = context.adminGradeCatalog([]);
  assert.ok(grades.includes('تالتة ثانوي'));
  const firstGradeGroups = context.adminGroupCatalog('أولى إعدادي', []);
  assert.deepEqual([...firstGradeGroups].sort(), ['مجموعة الأحد', 'مجموعة السبت'].sort());
  assert.equal(firstGradeGroups.includes('مجموعة الإثنين'), false);
});

test('legacy transfer request inherits student and schedule data', () => {
  const request = context.studentRequestRecord({
    id: 'transfer-1',
    studentCode: '12345678',
    currentScheduleId: 'group-1',
    targetScheduleId: 'group-2',
    status: 'pending'
  });
  assert.equal(request.studentName, 'أحمد محمد علي');
  assert.equal(request.grade, 'أولى إعدادي');
  assert.equal(request.currentGroup, 'مجموعة السبت');
  assert.equal(request.targetGroup, 'مجموعة الأحد');
  assert.equal(request.parentPhone, '01099998888');
});

test('unified academic composer stays on one page and supports all question types', () => {
  assert.match(source, /id="academicInlineComposer"/);
  assert.match(source, /openAcademicInlineComposer/);
  assert.doesNotMatch(source.match(/function renderAcademics\(\)[\s\S]*?function academicExamRow/)?.[0] || '', /goAdmin\(/);
  assert.match(source, /value="mcq">اختيار من متعدد/);
  assert.match(source, /value="truefalse">صح أو غلط/);
  assert.match(source, /value="essay">سؤال مقالي/);
  assert.match(source, /saveUnifiedAcademicExam/);
  assert.match(source, /saveUnifiedAcademicAssignment/);
  assert.match(source, /assignment:'academics',exam:'academics'/);
  assert.match(source, /trigger\?\.click\(\)/);
});

test('unified forms persist grade and group targeting with schedule fields', () => {
  assert.match(source, /values\.grade=grade;values\.group=group/);
  assert.match(source, /name="openAt"/);
  assert.match(source, /name="closeAt"/);
  assert.match(source, /name="duration"/);
  assert.match(source, /data-academic-countdown-target/);
});

test('teacher can publish a complete PDF-only exam without building questions', () => {
  assert.match(source, /value="pdf"/);
  assert.match(source, /رفع الامتحان PDF كامل/);
  assert.match(source, /pdfOnly=form\.elements\.sourceMode\.value==='pdf'/);
  assert.match(source, /أجب عن أسئلة ملف الامتحان PDF بالترتيب/);
  assert.match(source, /values\.pdfOnly=pdfOnly/);
});

test('teacher can publish homework as questions or as an uploaded file', () => {
  assert.match(source, /id="unifiedAssignmentForm"[^>]*novalidate/);
  assert.match(source, /if\(!file&&!count\)return aToast/);
  assert.match(source, /values\.questions=text\?text\.split/);
  assert.match(source, /values\.questionCount=values\.questions\.length/);
});

test('exam countdowns expire once without a reload loop', () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, '../assets/app.js'), 'utf8');
  const functionsSource = fs.readFileSync(path.resolve(__dirname, '../functions/index.js'), 'utf8');
  const examScheduleSource = fs.readFileSync(path.resolve(__dirname, '../functions/lib/exam-schedule.js'), 'utf8');
  assert.match(appSource, /data-exam-countdown-mode/);
  assert.match(appSource, /dataset\.countdownExpired='1'/);
  const countdownSource=appSource.match(/function startLiveCountdowns[\s\S]*?var parentQrScanner/)?.[0] || '';
  assert.doesNotMatch(countdownSource, /location\.reload/);
  assert.match(countdownSource, /action\.disabled=false/);
  assert.match(countdownSource, /action\.disabled=true/);
  assert.match(functionsSource, /getExamScheduleState/);
  assert.match(examScheduleSource, /safeNow >= close\.ms/);
  assert.match(source, /__academicCountdownRefreshPending/);
  assert.doesNotMatch(fs.readFileSync(path.resolve(__dirname, '../assets/v53-upgrades.js'), 'utf8'), /setTimeout\(\(\)=>currentSection==='exams'&&renderExams\(\),1100\)/);
});

test('student and attendance administration are mobile-first and grade-linked', () => {
  assert.match(source, /student-management-card/);
  assert.match(source, /attendanceStudentSearch/);
  assert.match(source, /grade\.value==='all'\|\|sameAcademicValue\(item\.grade,grade\.value\)/);
  assert.match(source, /attendance-present/);
  assert.match(source, /attendance-absent/);
  assert.match(source, /confirm\(`سيتم تسجيل \$\{missing\.length\} طالب غائب/);
  assert.match(mobileStyles, /@media\(max-width:700px\)/);
  assert.match(mobileStyles, /\.student-management-card/);
  assert.match(mobileStyles, /\.attendance-row-actions/);
});
