'use strict';

function scheduleTime(value) {
  if (value === undefined || value === null || value === '') {
    return { present: false, valid: true, ms: 0 };
  }
  let ms = NaN;
  if (typeof value?.toMillis === 'function') ms = Number(value.toMillis());
  else if (typeof value?.toDate === 'function') ms = value.toDate().getTime();
  else if (typeof value === 'number') ms = value;
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(String(value))) ms = cairoWallTimeMs(value);
  else ms = new Date(value).getTime();
  return { present: true, valid: Number.isFinite(ms), ms: Number.isFinite(ms) ? ms : 0 };
}

function cairoWallTimeMs(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return NaN;
  const target = Date.UTC(
    Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4]), Number(match[5]), Number(match[6] || 0)
  );
  let guess = target;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  for (let i = 0; i < 3; i += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess))
      .filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    const shown = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second)
    );
    guess += target - shown;
  }
  return guess;
}

function getExamScheduleState(exam, now = Date.now()) {
  const current = Number(now);
  const safeNow = Number.isFinite(current) ? current : Date.now();
  const open = scheduleTime(exam && exam.openAt);
  const close = scheduleTime(exam && exam.closeAt);

  if (exam && exam.active === false) {
    return { state: 'closed', reason: 'inactive', openAtMs: open.ms, closeAtMs: close.ms };
  }
  if (!open.valid || !close.valid || (open.present && close.present && close.ms <= open.ms)) {
    return { state: 'closed', reason: 'invalid-schedule', openAtMs: open.ms, closeAtMs: close.ms };
  }
  if (open.present && safeNow < open.ms) {
    return { state: 'upcoming', reason: 'before-open', openAtMs: open.ms, closeAtMs: close.ms };
  }
  if (close.present && safeNow >= close.ms) {
    return { state: 'closed', reason: 'after-close', openAtMs: open.ms, closeAtMs: close.ms };
  }
  return { state: 'open', reason: 'within-window', openAtMs: open.ms, closeAtMs: close.ms };
}

module.exports = { cairoWallTimeMs, scheduleTime, getExamScheduleState };
