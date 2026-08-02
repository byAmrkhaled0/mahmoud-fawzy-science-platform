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

function examDurationMinutes(value) {
  const parsed = Number(value);
  return Math.max(1, Math.min(240, Number.isFinite(parsed) ? parsed : 20));
}

function examSessionExpiryMillis(exam, startedAt) {
  const started = scheduleTime(startedAt);
  const close = scheduleTime(exam && exam.closeAt);
  if (!started.present || !started.valid || !close.valid) return NaN;
  return Math.min(
    started.ms + examDurationMinutes(exam && exam.duration) * 60 * 1000,
    close.present ? close.ms : Number.POSITIVE_INFINITY
  );
}

function examSessionTiming(exam, session) {
  if (!exam || !session || session.status !== 'started') return null;
  const expiresAtMs = examSessionExpiryMillis(exam, session.startedAt);
  if (!Number.isFinite(expiresAtMs)) return null;
  const close = scheduleTime(exam.closeAt);
  return {
    duration: examDurationMinutes(exam.duration),
    expiresAtMs,
    closeAtMs: close.present ? close.ms : 0,
    contentVersion: Number(exam.contentVersion || 0)
  };
}

function examSessionTimingChanged(before, after) {
  if (!after) return false;
  const beforeClose = scheduleTime(before && before.closeAt);
  const afterClose = scheduleTime(after.closeAt);
  return examDurationMinutes(before && before.duration) !== examDurationMinutes(after.duration)
    || beforeClose.present !== afterClose.present
    || beforeClose.valid !== afterClose.valid
    || beforeClose.ms !== afterClose.ms;
}

module.exports = {
  cairoWallTimeMs,
  scheduleTime,
  getExamScheduleState,
  examDurationMinutes,
  examSessionExpiryMillis,
  examSessionTiming,
  examSessionTimingChanged
};
