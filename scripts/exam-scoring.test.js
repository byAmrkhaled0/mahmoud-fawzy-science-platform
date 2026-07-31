'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assignQuestionScores, scoreSummary } = require('../functions/lib/exam-scoring');

test('explicit question marks produce a real score out of the configured total', () => {
  const questions = assignQuestionScores([{ points: 2 }, { points: 3 }, { points: 5 }], 10);
  assert.deepEqual(scoreSummary(questions, [2, 0, 5]), { score: 7, maxScore: 10, percentage: 70 });
});

test('legacy exams without marks remain compatible as a 100-mark exam', () => {
  const questions = assignQuestionScores([{}, {}, {}]);
  assert.equal(Math.round(questions.reduce((sum, q) => sum + q.points, 0)), 100);
  assert.deepEqual(scoreSummary(questions, [questions[0].points, 0, questions[2].points]), { score: 66.67, maxScore: 100, percentage: 67 });
});

test('manual questions keep the final score pending while automatic feedback is retained', () => {
  const questions = assignQuestionScores([{ points: 4 }, { points: 6 }], 10);
  assert.deepEqual(scoreSummary(questions, [4, 0], true), { score: null, maxScore: 10, percentage: null });
});

test('student, parent and admin interfaces expose marks, percentages and detailed correction', () => {
  const root = path.resolve(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
  const admin = fs.readFileSync(path.join(root, 'assets/admin.js'), 'utf8');
  const functions = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
  assert.match(admin, /data-question-points/);
  assert.match(admin, /الدرجة النهائية للامتحان/);
  assert.match(admin, /data-awarded-index/);
  assert.match(app, /عرض تصحيح الأسئلة/);
  assert.match(app, /gradeMark\(g\)/);
  assert.match(app, /متوسط مستوى الامتحانات/);
  assert.match(functions, /answers: staffAnswers/);
  assert.match(functions, /percentage/);
});

test('teacher exam results update live and remain responsive on mobile', () => {
  const root = path.resolve(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
  const admin = fs.readFileSync(path.join(root, 'assets/admin.js'), 'utf8');
  const sync = fs.readFileSync(path.join(root, 'assets/firebase-sync.js'), 'utf8');
  const fixes = fs.readFileSync(path.join(root, 'assets/v56-fixes.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'assets/v60.css'), 'utf8');
  assert.match(sync, /subscribeToExamAttempts/);
  assert.match(admin, /startExamAttemptUpdates/);
  assert.match(admin, /admin-row-removing/);
  assert.match(fixes, /الطلاب الذين أدّوا الامتحانات/);
  assert.match(fixes, /examResultsSearch/);
  assert.match(fixes, /examAttemptScoreText/);
  assert.match(css, /@media\(max-width:560px\).*exam-results-dashboard/s);
  assert.match(app, /requestAnimationFrame\(\(\)=>setTimeout\(\(\)=>renderExamPortal/);
});
