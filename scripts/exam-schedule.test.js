'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  cairoWallTimeMs,
  getExamScheduleState,
  examSessionExpiryMillis,
  examSessionTiming,
  examSessionTimingChanged
} = require('../functions/lib/exam-schedule');

const now = Date.UTC(2026, 6, 31, 15, 0, 0);

test('Cairo datetime-local values are converted consistently in summer and winter', () => {
  assert.equal(cairoWallTimeMs('2026-07-31T18:00'), Date.UTC(2026, 6, 31, 15, 0, 0));
  assert.equal(cairoWallTimeMs('2026-01-31T18:00'), Date.UTC(2026, 0, 31, 16, 0, 0));
});

test('exam schedule exposes the three student states at exact boundaries', () => {
  const exam = { active: true, openAt: '2026-07-31T17:30', closeAt: '2026-07-31T18:30' };
  assert.equal(getExamScheduleState(exam, Date.UTC(2026, 6, 31, 14, 29, 59)).state, 'upcoming');
  assert.equal(getExamScheduleState(exam, Date.UTC(2026, 6, 31, 14, 30, 0)).state, 'open');
  assert.equal(getExamScheduleState(exam, Date.UTC(2026, 6, 31, 15, 29, 59)).state, 'open');
  assert.equal(getExamScheduleState(exam, Date.UTC(2026, 6, 31, 15, 30, 0)).state, 'closed');
});

test('invalid, reversed and inactive schedules fail closed', () => {
  assert.equal(getExamScheduleState({ active: false }, now).state, 'closed');
  assert.equal(getExamScheduleState({ openAt: 'not-a-date' }, now).reason, 'invalid-schedule');
  assert.equal(getExamScheduleState({ openAt: '2026-07-31T19:00', closeAt: '2026-07-31T18:00' }, now).state, 'closed');
});

test('unscheduled exams remain open for backwards compatibility', () => {
  assert.equal(getExamScheduleState({ active: true }, now).state, 'open');
});

test('editing duration or closing time recalculates an already-open student session', () => {
  const startedAt = Date.UTC(2026, 6, 31, 15, 0, 0);
  const session = { status: 'started', startedAt };
  const original = { duration: 20, closeAt: '2026-07-31T18:30', contentVersion: 1 };
  const extended = { duration: 45, closeAt: '2026-07-31T19:00', contentVersion: 2 };
  assert.equal(examSessionExpiryMillis(original, startedAt), startedAt + 20 * 60 * 1000);
  assert.equal(examSessionTiming(extended, session).expiresAtMs, startedAt + 45 * 60 * 1000);
  assert.equal(examSessionTimingChanged(original, extended), true);
});

test('the edited closing time remains a hard cap for an active session', () => {
  const startedAt = Date.UTC(2026, 6, 31, 15, 0, 0);
  const exam = { duration: 90, closeAt: '2026-07-31T18:20' };
  assert.equal(examSessionExpiryMillis(exam, startedAt), Date.UTC(2026, 6, 31, 15, 20, 0));
});

test('student UI and callable enforce closed exam behavior', () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, '../assets/app.js'), 'utf8');
  const functionsSource = fs.readFileSync(path.resolve(__dirname, '../functions/index.js'), 'utf8');
  assert.match(appSource, /انتهى الوقت — لم تستطع أداء الامتحان هذه المرة/);
  assert.match(appSource, /ترقّب الامتحان وذاكر ببراعة/);
  assert.match(appSource, /الامتحان متاح الآن/);
  assert.match(appSource, /syncExamServerClock\(dashboard\.serverNow\)/);
  assert.match(functionsSource, /exams, serverNow: now/);
  assert.doesNotMatch(functionsSource, /filter\(exam => exam\.availability !== 'closed'\)/);
  assert.match(functionsSource, /examSessionExpiryMillis\(exam, now\)/);
  assert.match(functionsSource, /Date\.now\(\) > expiresAt \+ 120 \* 1000\)/);
  assert.match(functionsSource, /syncExamSessionsOnExamWrite/);
  assert.match(functionsSource, /getExamSessionTiming/);
  assert.match(appSource, /getSecureExamTiming/);
});
