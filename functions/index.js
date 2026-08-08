'use strict';

const crypto = require('crypto');
const zlib = require('zlib');
const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2/options');
const { normalizeStudentName, studentNameIdentity, hasAtLeastThreeNameParts } = require('./lib/student-name');
const {
  scheduledTimeMillis,
  assignmentIsReleased,
  assignmentDueDatePassed,
  assignmentSubmissionIsOpen
} = require('./lib/assignment-schedule');
const {
  sameAcademicValue,
  scheduleMatchesStudent,
  learningTargetMatchesStudent
} = require('./lib/academic-targeting');
const {
  getExamScheduleState,
  examDurationMinutes,
  examSessionExpiryMillis,
  examSessionTiming,
  examSessionTimingChanged
} = require('./lib/exam-schedule');
const { positiveScore, assignQuestionScores, scoreSummary } = require('./lib/exam-scoring');

admin.initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 10, memory: '256MiB' });

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;
const SUPPORTED_GRADES = Object.freeze(['أولى إعدادي', 'تانية إعدادي', 'تالتة إعدادي', 'أولى ثانوي', 'تانية ثانوي', 'تالتة ثانوي']);
const PRIMARY_GRADES = Object.freeze(['رابعة ابتدائي', 'خامسة ابتدائي', 'سادسة ابتدائي']);
// Callable endpoints must accept the browser's unauthenticated CORS preflight.
// Sensitive operations still enforce staff authentication inside each handler.
const CALLABLE_OPTIONS = { region: 'europe-west1', timeoutSeconds: 30, invoker: 'public' };

function cleanDocId(value) {
  return String(value || '').trim().replace(/[\\/#?\[\]]/g, '-');
}

function normalizeCode(value) {
  return normalizeDigits(value).trim().toUpperCase().replace(/\s+/g, '');
}

function validLegacyOrStrongCode(value) {
  return /^[A-Z0-9_-]{6,40}$/.test(normalizeCode(value));
}

function text(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

function supportedGrade(value) {
  return SUPPORTED_GRADES.some(grade => sameAcademicValue(grade, value));
}

function primaryGrade(value) {
  return PRIMARY_GRADES.some(grade => sameAcademicValue(grade, value));
}

function requireSupportedGrade(value) {
  const grade = text(value, 80);
  if (!supportedGrade(grade)) throw new HttpsError('invalid-argument', 'اختر صفًا من المرحلة الإعدادية أو الثانوية.');
  return grade;
}

function normalizeDigits(value) {
  return String(value || '')
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776));
}

function digits(value) {
  return normalizeDigits(value).replace(/\D/g, '');
}

function safePublicUrl(value) {
  const url = text(value, 2000);
  return /^https:\/\//i.test(url) ? url : '';
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function randomCode(prefix, bytes = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const raw = crypto.randomBytes(bytes);
  let body = '';
  for (let i = 0; i < raw.length; i += 1) body += alphabet[raw[i] % alphabet.length];
  return `${prefix}-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

function randomNumericCode(length = 8) {
  // Keep the first digit non-zero so spreadsheet/phone copy does not trim it.
  const first = String(crypto.randomInt(1, 10));
  let rest = '';
  while (rest.length < length - 1) rest += String(crypto.randomInt(0, 10));
  return first + rest;
}

function publicStudentName(value) {
  // The teacher requested the leaderboard to use the exact full student name
  // saved on the platform instead of shortening the family name to an initial.
  return text(value, 80).replace(/\s+/g, ' ').trim();
}

function duplicateStudentNameError() {
  return new HttpsError(
    'already-exists',
    'هذا الطالب مسجل بالفعل على المنصة. استخدم الكود السابق أو تواصل مع مستر محمود لتحديث بياناته.'
  );
}

async function assertStudentNameAvailable(name, options = {}) {
  const { normalizedName, nameKey } = studentNameIdentity(name);
  if (!hasAtLeastThreeNameParts(normalizedName) || !nameKey) {
    throw new HttpsError('invalid-argument', 'اكتب اسم الطالب ثلاثيًا على الأقل، وإذا تكرر الاسم الثلاثي اكتب الاسم الرباعي.');
  }
  const excludeStudentCode = text(options.excludeStudentCode, 40);
  const allowedRequestId = text(options.requestId, 80);
  const [claimed, keyedStudents, keyedBookings, exactStudents] = await Promise.all([
    db.collection('_student_name_claims').doc(nameKey).get(),
    db.collection('students').where('nameKey', '==', nameKey).limit(2).get(),
    db.collection('bookings').where('nameKey', '==', nameKey).limit(2).get(),
    db.collection('students').where('studentName', '==', text(name, 100).replace(/\s+/g, ' ').trim()).limit(5).get()
  ]);
  const activeStudentExists = [...keyedStudents.docs, ...exactStudents.docs]
    .some(doc => doc.id !== excludeStudentCode && doc.data().active !== false);
  const activeBookingExists = keyedBookings.docs.length > 0;
  const claimBelongsToOtherStudent = claimed.exists
    && text(claimed.data().studentCode, 40) !== excludeStudentCode
    && (!allowedRequestId || text(claimed.data().requestId, 80) !== allowedRequestId);
  if (activeStudentExists || activeBookingExists || claimBelongsToOtherStudent) throw duplicateStudentNameError();

  const [legacyStudents, legacyBookings] = await Promise.all([
    db.collection('students').select('name', 'studentName', 'active').limit(2000).get(),
    db.collection('bookings').select('name', 'studentName').limit(2000).get()
  ]);
  const legacyStudentExists = legacyStudents.docs.some(doc => doc.id !== excludeStudentCode
    && doc.data().active !== false
    && normalizeStudentName(doc.data().studentName || doc.data().name) === normalizedName);
  const legacyBookingExists = legacyBookings.docs.some(doc =>
    normalizeStudentName(doc.data().studentName || doc.data().name) === normalizedName);
  if (legacyStudentExists || legacyBookingExists) throw duplicateStudentNameError();
  return { normalizedName, nameKey, claimRef: db.collection('_student_name_claims').doc(nameKey) };
}

async function uniqueNumericCode(collection, length = 8) {
  for (let i = 0; i < 12; i += 1) {
    const code = randomNumericCode(length);
    const snap = await db.collection(collection).doc(code).get();
    if (!snap.exists) return code;
  }
  throw new HttpsError('resource-exhausted', 'تعذر إنشاء كود رقمي فريد، حاول مرة أخرى.');
}

async function uniqueUnifiedAccessCode(length = 8) {
  for (let i = 0; i < 12; i += 1) {
    const code = randomNumericCode(length);
    // Every current booking and approved account owns a students/{code}
    // document. One indexed lookup is enough; atomic create() writes below
    // remain the final collision guard under heavy concurrent registration.
    const studentRecord = await db.collection('students').doc(code).get();
    if (!studentRecord.exists) return code;
  }
  throw new HttpsError('resource-exhausted', 'تعذر إنشاء كود موحد فريد، حاول مرة أخرى.');
}

async function uniqueCode(collection, prefix) {
  for (let i = 0; i < 8; i += 1) {
    const code = randomCode(prefix, 8);
    const snap = await db.collection(collection).doc(cleanDocId(code)).get();
    if (!snap.exists) return code;
  }
  throw new HttpsError('resource-exhausted', 'تعذر إنشاء كود فريد، حاول مرة أخرى.');
}

async function rateLimit(action, identity, limit, windowMs) {
  const key = hash(`${action}:${identity}`).slice(0, 40);
  const ref = db.collection('_rate_limits').doc(key);
  const now = Date.now();
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const started = Number(data.windowStartedAt || 0);
    const count = Number(data.count || 0);
    if (!started || now - started >= windowMs) {
      tx.set(ref, { action, count: 1, windowStartedAt: now, expiresAt: Timestamp.fromMillis(now + windowMs * 2) });
      return;
    }
    if (count >= limit) throw new HttpsError('resource-exhausted', 'محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.');
    tx.update(ref, { count: count + 1 });
  });
}

function requestIp(request) {
  const forwarded = request.rawRequest && request.rawRequest.headers
    ? request.rawRequest.headers['x-forwarded-for']
    : '';
  return text(String(forwarded || request.rawRequest?.ip || 'unknown').split(',')[0], 100);
}

async function rateLimitPublic(action, identity, request, identityLimit, ipLimit, windowMs) {
  const normalizedIdentity = text(identity || 'empty', 160);
  const ip = requestIp(request);
  await Promise.all([
    rateLimit(`${action}-identity`, normalizedIdentity, identityLimit, windowMs),
    rateLimit(`${action}-ip`, ip, ipLimit, windowMs)
  ]);
}

function jsonByteSize(value) {
  try { return Buffer.byteLength(JSON.stringify(value), 'utf8'); }
  catch (_) { return Number.MAX_SAFE_INTEGER; }
}

async function requireStaff(request, allowedRoles = ['admin', 'teacher', 'assistant']) {
  if (!request.auth || !request.auth.uid) throw new HttpsError('unauthenticated', 'يجب تسجيل دخول فريق العمل.');
  const userSnap = await db.collection('users').doc(request.auth.uid).get();
  const profile = userSnap.exists ? userSnap.data() : {};
  if (profile.active === false || !allowedRoles.includes(profile.role)) {
    throw new HttpsError('permission-denied', 'الحساب غير مصرح له بهذه العملية.');
  }
  return { uid: request.auth.uid, email: request.auth.token?.email || '', ...profile };
}

async function notifyStaffAboutBooking(booking) {
  const snap = await db.collection('staff_push_tokens').where('active', '==', true).limit(500).get();
  const tokens = [...new Set(snap.docs.map(doc => text(doc.data().token, 500)).filter(Boolean))];
  if (!tokens.length) return;
  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    data: { type: 'new-booking', bookingCode: text(booking.code, 40), title: 'حجز طالب جديد', body: `${text(booking.name, 80)} · ${text(booking.grade, 60)} · ${text(booking.group, 80)}` },
    webpush: { fcmOptions: { link: '/teacher-login.html?section=bookings' } }
  });
  const invalid = [];
  response.responses.forEach((item, index) => {
    if (!item.success && /registration-token-not-registered|invalid-registration-token/.test(String(item.error?.code || ''))) invalid.push(tokens[index]);
  });
  if (invalid.length) {
    const batch = db.batch();
    snap.docs.filter(doc => invalid.includes(doc.data().token)).forEach(doc => batch.set(doc.ref, { active: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
    await batch.commit();
  }
}

exports.registerTeacherPushToken = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  const token = text(request.data && request.data.token, 500);
  if (token.length < 40) throw new HttpsError('invalid-argument', 'رمز الإشعارات غير صالح.');
  const tokenId = hash(token).slice(0, 48);
  await db.collection('staff_push_tokens').doc(tokenId).set({ token, uid: staff.uid, role: staff.role || '', active: true, userAgent: text(request.data?.userAgent, 250), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { registered: true };
});

// Push delivery runs independently from the public booking request. The
// student sees the success screen as soon as Firestore commits, even if FCM is
// temporarily slow or unavailable.
exports.notifyStaffOnBookingCreated = onDocumentCreated({ document: 'bookings/{bookingCode}', region: 'europe-west1', memory: '256MiB' }, async event => {
  const booking = event.data && event.data.data();
  if (booking) await notifyStaffAboutBooking(booking);
});

exports.registerStudentPushToken = onCall(CALLABLE_OPTIONS, async request => {
  const studentCode = normalizeCode(request.data && request.data.studentCode);
  const token = text(request.data && request.data.token, 500);
  await rateLimitPublic('student-push-token', studentCode, request, 6, 25, 60 * 60 * 1000);
  if (token.length < 40) throw new HttpsError('invalid-argument', 'رمز الإشعارات غير صالح.');
  const found = await getStudentPortalByCode(studentCode);
  const tokenId = hash(token).slice(0, 48);
  await db.collection('student_push_tokens').doc(tokenId).set({
    token,
    studentCode,
    grade: text(found.data.grade, 80),
    group: text(found.data.group, 100),
    scheduleId: text(found.data.scheduleId, 100),
    academicYear: text(found.data.academicYear, 20),
    term: text(found.data.term, 40),
    active: true,
    userAgent: text(request.data?.userAgent, 250),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { registered: true };
});

function notificationMessage(kind, before, after) {
  const updated = Boolean(before && Object.keys(before).length);
  const title = text(after?.title || after?.name, 160);
  if (kind === 'exam') return { title: updated ? 'تم تعديل امتحان' : 'امتحان جديد', body: title || 'افتح المنصة لمراجعة الامتحان.' };
  if (kind === 'homework') return { title: updated ? 'تم تعديل واجب' : 'واجب جديد', body: title || 'افتح ملفك لمعرفة المطلوب.' };
  if (kind === 'lecture') return { title: updated ? 'تم تعديل محاضرة' : 'محاضرة جديدة', body: title || 'افتح ملفك لمشاهدة المحاضرة.' };
  return { title: 'تم تغيير موعد المجموعة', body: text(after?.name || after?.days || 'افتح ملفك لمراجعة الموعد الجديد.', 180) };
}

function meaningfulContentChanged(before, after) {
  if (!before) return true;
  const ignored = new Set(['updatedAt', 'createdAt', 'contentVersion']);
  const clean = value => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !ignored.has(key)));
  try { return JSON.stringify(encodeBackupValue(clean(before))) !== JSON.stringify(encodeBackupValue(clean(after))); }
  catch (_) { return true; }
}

async function notifyTargetedStudents(kind, before, after, documentId) {
  if (!after || after.active === false || !meaningfulContentChanged(before, after)) return;
  const snap = await db.collection('student_push_tokens').where('active', '==', true).limit(1000).get();
  const eligible = snap.docs.filter(doc => {
    const token = doc.data() || {};
    if (kind === 'schedule') {
      return (token.scheduleId && token.scheduleId === documentId)
        || (sameAcademicValue(token.grade, after.grade) && sameAcademicValue(token.group, after.name));
    }
    return learningTargetMatchesStudent(after, token);
  });
  if (!eligible.length) return;
  const message = notificationMessage(kind, before, after);
  const invalid = [];
  for (let i = 0; i < eligible.length; i += 500) {
    const batch = eligible.slice(i, i + 500);
    const response = await admin.messaging().sendEachForMulticast({
      tokens: batch.map(doc => doc.data().token),
      notification: message,
      data: { type: kind, contentId: text(documentId, 100), title: message.title, body: message.body, url:'/student.html' },
      webpush: { fcmOptions: { link: '/student.html' } }
    });
    response.responses.forEach((item, index) => {
      if (!item.success && /registration-token-not-registered|invalid-registration-token/.test(String(item.error?.code || ''))) invalid.push(batch[index].ref);
    });
  }
  if (invalid.length) {
    const batch = db.batch();
    invalid.forEach(ref => batch.set(ref, { active: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
    await batch.commit();
  }
}

function studentContentTrigger(document, kind) {
  return onDocumentWritten({ document, region: 'europe-west1', memory: '256MiB' }, async event => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    await notifyTargetedStudents(kind, before, after, event.params.id);
  });
}

exports.notifyStudentsOnExamWrite = studentContentTrigger('exams/{id}', 'exam');
exports.notifyStudentsOnAssignmentWrite = studentContentTrigger('assignments/{id}', 'homework');
exports.notifyStudentsOnLectureWrite = studentContentTrigger('lectures/{id}', 'lecture');
exports.notifyStudentsOnScheduleWrite = studentContentTrigger('groups/{id}', 'schedule');

async function updateOpenExamSessions(examId, before, after) {
  if (!after || !examSessionTimingChanged(before, after)) return 0;
  const snap = await db.collection('exam_sessions').where('examId', '==', examId).limit(2000).get();
  const updates = snap.docs.map(doc => ({ doc, timing: examSessionTiming(after, doc.data()) }))
    .filter(item => item.timing);
  for (let offset = 0; offset < updates.length; offset += 400) {
    const batch = db.batch();
    updates.slice(offset, offset + 400).forEach(({ doc, timing }) => {
      batch.set(doc.ref, {
        duration: timing.duration,
        expiresAt: Timestamp.fromMillis(timing.expiresAtMs),
        scheduledCloseAt: timing.closeAtMs ? Timestamp.fromMillis(timing.closeAtMs) : null,
        scheduleVersion: timing.contentVersion,
        timingUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });
    await batch.commit();
  }
  return updates.length;
}

exports.syncExamSessionsOnExamWrite = onDocumentWritten({
  document: 'exams/{id}', region: 'europe-west1', memory: '256MiB'
}, async event => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  await updateOpenExamSessions(event.params.id, before, after);
});

function publicExamSession(sessionId, exam, questions, startedAtMs, expiresAtMs) {
  return {
    sessionId,
    exam: {
      id: text(exam.id, 100),
      title: text(exam.title, 200),
      instructions: text(exam.instructions, 1500),
      duration: Math.max(1, Math.min(240, Number(exam.duration || 20))),
      maxScore: positiveExamScore(exam.maxScore, questions.reduce((sum, q) => sum + positiveExamScore(q.points, 1), 0)),
      pdfUrl: safePublicUrl(exam.pdfUrl || exam.examPdfUrl),
      pdfName: text(exam.pdfName || exam.examPdfName, 220),
      contentVersion: Number(exam.contentVersion || 0)
    },
    startedAt: new Date(startedAtMs).toISOString(),
    expiresAt: expiresAtMs,
    questions: questions.map(q => ({
      type: q.type,
      question: q.question,
      points: positiveExamScore(q.points, 1),
      options: q.options,
      optionLabels: q.optionLabels
    }))
  };
}

function positiveExamScore(value, fallback = 1) {
  return positiveScore(value, fallback);
}

function examQuestionsWithScores(questions, configuredMaxScore) {
  return assignQuestionScores(questions, configuredMaxScore);
}

function cleanAnswerLine(line) {
  return String(line || '').replace(/^(answer|correct|الإجابة|الاجابة|الإجابة الصحيحة|الاجابة الصحيحة)\s*[:=：-]?\s*/i, '').trim();
}

function parseOptionLine(line) {
  const raw = normalizeDigits(line).trim();
  let match = raw.match(/^([A-Da-dأإابجدهـه]|[1-4])\s*[\)\.\-:：]\s*(.+)$/);
  if (match) return { label: match[1].replace('إ', 'أ').replace('هـ', 'ه'), text: match[2].trim() };
  match = raw.match(/^-\s*(.+)$/);
  if (match) return { label: '', text: match[1].trim() };
  return null;
}

function parseExamQuestions(source) {
  const blocks = normalizeDigits(source).split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).slice(0, 200);
  return blocks.map(block => {
    const lines = block.split('\n').map(x => x.trim()).filter(Boolean);
    const answerLine = lines.find(line => /^(answer|correct|الإجابة|الاجابة|الإجابة الصحيحة|الاجابة الصحيحة)\s*[:=：-]?/i.test(line));
    const pointsLine = lines.find(line => /^(points?|marks?|score|الدرجة|درجات)\s*[:=：-]?/i.test(line));
    const answer = answerLine ? cleanAnswerLine(answerLine) : '';
    const points = pointsLine ? positiveExamScore(normalizeDigits(pointsLine).replace(/^[^:=：\-]*[:=：-]?\s*/i, ''), 1) : null;
    const options = [];
    const questionLines = [];
    for (const line of lines) {
      if (line === answerLine || line === pointsLine) continue;
      const option = parseOptionLine(line);
      if (option) options.push(option);
      else questionLines.push(line.replace(/^س\d*\s*[:\-]?\s*/, '').trim());
    }
    const question = text(questionLines[0] || lines[0] || 'سؤال', 1500);
    if (options.length) {
      return {
        type: 'mcq',
        question,
        options: options.slice(0, 8).map(o => text(o.text, 700)),
        optionLabels: options.slice(0, 8).map(o => text(o.label, 10)),
        answer: text(answer, 700),
        points
      };
    }
    return { type: 'essay', question, options: [], optionLabels: [], answer: '', points };
  }).filter(q => q.question);
}

function normalizeAnswer(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[\)\.\-:：]/g, '').replace(/إ/g, 'أ').replace(/هـ/g, 'ه');
}

function mcqCorrect(question, chosenIndex) {
  const index = Number(chosenIndex);
  if (!Number.isInteger(index) || index < 0 || index >= question.options.length) return false;
  const explicit=Number(question.correctIndex);
  if(question.correctIndex!==null&&question.correctIndex!==undefined&&question.correctIndex!==''&&Number.isInteger(explicit))return index===explicit;
  const chosen = question.options[index] || '';
  const label = question.optionLabels[index] || String(index + 1);
  const correct = String(question.answer || '').trim();
  if (!correct) return null;
  const answerToken = (correct.match(/^([A-Da-dأإابجدهـه]|[1-4])(?:\s*[\)\.\-:：]|\s*$)/) || [])[1] || '';
  const normalized = normalizeAnswer(correct);
  return normalized === normalizeAnswer(label)
    || normalized === normalizeAnswer(chosen)
    || normalized === String(index + 1)
    || (answerToken && normalizeAnswer(answerToken) === normalizeAnswer(label));
}

function examQuestionList(exam = {}) {
  if (!Array.isArray(exam.questions) || !exam.questions.length) return parseExamQuestions(exam.text || exam.questionsText || '');
  return exam.questions.slice(0, 200).map(raw => {
    const source=raw&&typeof raw==='object'?raw:{},essay=source.type==='essay';
    const trueFalse=source.type==='truefalse';
    const options=essay?[]:(trueFalse?['صح','غلط']:(Array.isArray(source.options)?source.options:[]).slice(0,8).map(value=>text(value,700)));
    const explicit=source.correctIndex!==null&&source.correctIndex!==undefined&&source.correctIndex!==''?Number(source.correctIndex):null;
    const correctIndex=Number.isInteger(explicit)&&explicit>=0&&explicit<options.length?explicit:null;
    return {
      type:essay?'essay':'mcq',question:text(source.question||source.content,1500),options,
      optionLabels:(Array.isArray(source.optionLabels)&&source.optionLabels.length?source.optionLabels:['أ','ب','ج','د']).slice(0,options.length).map(value=>text(value,10)),
      answer:correctIndex===null?text(source.answer,700):text(options[correctIndex],700),correctIndex,points:positiveExamScore(source.points,1)
    };
  }).filter(question=>question.question&&(question.type==='essay'||question.options.length>=2));
}

function examCorrectAnswer(question){const index=Number(question.correctIndex);return Number.isInteger(index)&&index>=0?text(question.options?.[index],1000):text(question.answer,1000);}

function portalResponse(data, attempts, records = {}) {
  return {
    studentCode: text(data.studentCode || data.code, 40),
    name: text(data.studentName || data.name, 100),
    studentName: text(data.studentName || data.name, 100),
    grade: text(data.grade, 80),
    group: text(data.group, 100),
    month: text(data.month, 40),
    academicYear: text(data.academicYear, 20),
    term: text(data.term, 40),
    scheduleId: text(data.scheduleId, 100),
    bookingCode: text(data.bookingCode, 40),
    approvalStatus: text(data.approvalStatus || data.status, 100),
    scheduleDays: text(data.scheduleDays, 100),
    scheduleStartTime: text(data.scheduleStartTime, 20),
    scheduleEndTime: text(data.scheduleEndTime, 20),
    paid: data.paid === true,
    paymentDate: text(data.paymentDate, 40),
    notes: text(data.notes, 1500),
    attendance: Array.isArray(records.attendance) ? records.attendance.slice(-120) : (Array.isArray(data.attendance) ? data.attendance.slice(-120) : []),
    grades: Array.isArray(records.grades) ? records.grades.slice(-120) : (Array.isArray(data.grades) ? data.grades.slice(-120) : []),
    homeworks: Array.isArray(records.homeworks) ? records.homeworks.slice(-120) : (Array.isArray(data.homeworks) ? data.homeworks.slice(-120) : []),
    recitations: Array.isArray(records.recitations) ? records.recitations.slice(-120) : (Array.isArray(data.recitations) ? data.recitations.slice(-120) : []),
    assignments: Array.isArray(records.assignments) ? records.assignments.slice(-60) : [],
    lectures: Array.isArray(records.lectures) ? records.lectures.slice(-100) : [],
    examAttempts: Array.isArray(attempts) ? attempts.slice(-120) : []
  };
}

async function getStudentPortalByCode(code) {
  const normalized = normalizeCode(code);
  if (!validLegacyOrStrongCode(normalized)) throw new HttpsError('invalid-argument', 'كود غير صالح.');
  const id = cleanDocId(normalized);
  const portalRef = db.collection('student_portal').doc(id);
  const portalSnap = await portalRef.get();
  if (portalSnap.exists) {
    if (portalSnap.data().active === false) throw new HttpsError('not-found', 'حساب الطالب غير نشط.');
    const studentSnap = await db.collection('students').doc(id).get().catch(() => null);
    const canonical = studentSnap?.exists ? studentSnap.data() : {};
    if (canonical.active === false) throw new HttpsError('not-found', 'حساب الطالب غير نشط.');
    return { code: normalized, data: { ...portalSnap.data(), ...canonical, studentCode: normalized, code: normalized } };
  }
  // Older releases sometimes created the student record before the dedicated
  // portal document. Keep those real accounts working and repair them lazily.
  const studentSnap = await db.collection('students').doc(id).get();
  if (!studentSnap.exists || studentSnap.data().active === false) throw new HttpsError('not-found', 'لم يتم العثور على الطالب بهذا الكود.');
  const student = { ...studentSnap.data(), studentCode: normalized, code: normalized };
  const repaired = portalResponse(student, []);
  await portalRef.set({ ...repaired, parentCode: text(student.parentCode, 40), active: true, repairedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { code: normalized, data: student };
}

async function getParentPortalByCode(code) {
  const normalized = normalizeCode(code);
  if (!validLegacyOrStrongCode(normalized)) throw new HttpsError('invalid-argument', 'كود غير صالح.');
  const snap = await db.collection('parent_portal').doc(cleanDocId(normalized)).get();
  if (!snap.exists || snap.data().active === false) throw new HttpsError('not-found', 'لم يتم العثور على التقرير.');
  return { code: normalized, data: snap.data() };
}

async function attemptSummaries(studentCode) {
  const parentRef = db.collection('student_attempts').doc(cleanDocId(studentCode));
  const sub = await parentRef.collection('attempts').orderBy('submittedAt', 'desc').limit(120).get().catch(() => null);
  let attempts = sub && !sub.empty ? sub.docs.map(doc => ({ id:doc.id, ...doc.data() })) : [];
  if (!attempts.length) {
    const legacy = await parentRef.get();
    attempts = legacy.exists && Array.isArray(legacy.data().attempts) ? legacy.data().attempts.slice(-120).reverse() : [];
  }
  return attempts.map(a => ({
    id: text(a.id, 120),
    examId: text(a.examId, 100),
    examTitle: text(a.examTitle, 200),
    submittedAt: text(a.submittedAt, 60),
    score: a.score === null || a.score === undefined ? null : Number(a.score),
    autoScore: a.autoScore === null || a.autoScore === undefined ? null : Number(a.autoScore),
    autoMaxScore: a.autoMaxScore === null || a.autoMaxScore === undefined ? null : Number(a.autoMaxScore),
    percentage: a.percentage === null || a.percentage === undefined
      ? (a.score === null || a.score === undefined ? null : Math.round(Number(a.score) / positiveExamScore(a.maxScore, 100) * 100))
      : Number(a.percentage),
    autoPercentage: a.autoPercentage === null || a.autoPercentage === undefined ? null : Number(a.autoPercentage),
    maxScore: positiveExamScore(a.maxScore, 100),
    answers: Array.isArray(a.answers) ? a.answers.slice(0, 200).map(answer => ({
      question: text(answer.question, 1500),
      type: answer.type === 'essay' ? 'essay' : 'mcq',
      answer: text(answer.answer, 4000),
      correct: answer.correct === true ? true : answer.correct === false ? false : null,
      correctAnswer: text(answer.correctAnswer, 1000),
      points: positiveExamScore(answer.points, 1),
      awardedScore: answer.awardedScore === null || answer.awardedScore === undefined ? null : Number(answer.awardedScore)
    })) : [],
    needsManualReview: a.needsManualReview === true,
    status: text(a.status, 40)
  }));
}

async function studentRecords(studentCode, student = {}) {
  const normalized = normalizeCode(studentCode);
  const load = async (collection,orderBy) => {
    const base=db.collection(collection).where('studentCode','==',normalized);
    let snap=await base.orderBy(orderBy,'desc').limit(250).get().catch(()=>null);
    if(!snap)snap=await base.limit(250).get().catch(()=>null);
    return snap?snap.docs.map(doc=>({id:doc.id,...doc.data()})):[];
  };
  const [attendance, grades, homeworks, recitations, assignmentSnap, lectureSnap] = await Promise.all([
    load('attendance','date'), load('grades','date'), load('homework_submissions','submittedAt'), load('recitations','date'),
    db.collection('assignments').where('active','==',true).limit(250).get().catch(()=>null),
    db.collection('lectures').where('active','==',true).limit(250).get().catch(()=>null)
  ]);
  const byDate = rows => rows.sort((a, b) => String(a.date || a.submittedAt || a.createdAt || '').localeCompare(String(b.date || b.submittedAt || b.createdAt || '')));
  const assignments=assignmentSnap?assignmentSnap.docs.map(doc=>({id:doc.id,...doc.data()})).filter(item=>
    assignmentIsReleased(item) && learningTargetMatchesStudent(item, student)
  ).map(item=>({
    id:text(item.id,100),title:text(item.title,200),notes:text(item.notes,2000),grade:text(item.grade,80),group:text(item.group,100),
    academicYear:text(item.academicYear,20),term:text(item.term,40),dueDate:text(item.dueDate,30),publishAt:item.publishAt||'',
    questions:Array.isArray(item.questions)?item.questions.slice(0,100).map(question=>text(question,2500).split('\n').filter(line=>!/^(?:الإجابة|الاجابة|الدرجة)\s*:/i.test(line.trim())).join('\n').trim()).filter(Boolean):[],
    fileUrl:safePublicUrl(item.fileUrl),fileName:text(item.fileName,220),fileType:text(item.fileType,100),
    submissionClosed:assignmentDueDatePassed(item,cairoDateKey(new Date()))
  })).slice(-100):[];
  const lectures=lectureSnap?lectureSnap.docs.map(doc=>({id:doc.id,...doc.data()})).filter(item=>
    assignmentIsReleased(item) && learningTargetMatchesStudent(item, student)
  ).map(item=>({
    id:item.id,title:text(item.title,200),description:text(item.description||item.notes,2000),
    grade:text(item.grade,80),group:text(item.group,100),academicYear:text(item.academicYear,20),term:text(item.term,40),
    fileUrl:safePublicUrl(item.fileUrl),fileName:text(item.fileName,220),externalUrl:safePublicUrl(item.externalUrl),
    publishAt:item.publishAt||'',updatedAt:item.updatedAt||''
  })).slice(-100):[];
  return { attendance: byDate(attendance), grades: byDate(grades), homeworks: byDate(homeworks), recitations: byDate(recitations), assignments, lectures };
}

function publicSchedule(schedule) {
  return {
    id: text(schedule.id, 100),
    name: text(schedule.name, 100),
    grade: text(schedule.grade, 80),
    days: text(schedule.days, 100),
    startTime: text(schedule.startTime, 20),
    endTime: text(schedule.endTime, 20),
    capacity: Math.max(0, Math.min(500, Number(schedule.capacity || 0))),
    availableSeats: schedule.availableSeats === null || schedule.availableSeats === undefined
      ? null
      : Math.max(0, Number(schedule.availableSeats) || 0)
  };
}

function firestoreMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return Number(value.toMillis()) || 0;
  const millis = Date.parse(String(value));
  return Number.isFinite(millis) ? millis : 0;
}

function publicTransferRequest(item) {
  return {
    id: text(item.id, 120),
    studentCode: text(item.studentCode, 40),
    studentName: text(item.studentName, 100),
    grade: text(item.grade, 80),
    currentGroup: text(item.currentGroup, 100),
    currentScheduleId: text(item.currentScheduleId, 100),
    targetGroup: text(item.targetGroup, 100),
    targetScheduleId: text(item.targetScheduleId, 100),
    targetScheduleDays: text(item.targetScheduleDays, 100),
    targetScheduleStartTime: text(item.targetScheduleStartTime, 20),
    targetScheduleEndTime: text(item.targetScheduleEndTime, 20),
    reason: text(item.reason, 800),
    teacherNote: text(item.teacherNote, 800),
    status: ['approved','rejected'].includes(item.status) ? item.status : 'pending',
    createdAt: firestoreMillis(item.createdAt) ? new Date(firestoreMillis(item.createdAt)).toISOString() : '',
    reviewedAt: firestoreMillis(item.reviewedAt) ? new Date(firestoreMillis(item.reviewedAt)).toISOString() : ''
  };
}

async function scheduleEnrollment(schedule, scheduleId, excludeStudentCode = '') {
  const groupName = text(schedule.name, 100);
  if (!groupName) return [];
  const snap = await db.collection('students').where('group', '==', groupName).limit(1000).get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(student =>
    student.active !== false
    && normalizeCode(student.studentCode || student.id) !== normalizeCode(excludeStudentCode)
    && scheduleMatchesStudent(schedule, student)
    && (!student.scheduleId || text(student.scheduleId, 100) === scheduleId)
  );
}

exports.getPortalStudent = onCall(CALLABLE_OPTIONS, async request => {
  const code = normalizeCode(request.data && request.data.code);
  const mode = request.data && request.data.mode === 'parent' ? 'parent' : 'student';
  await rateLimitPublic(`portal-${mode}`, code, request, 8, 35, 60 * 1000);
  const found = mode === 'parent' ? await getParentPortalByCode(code) : await getStudentPortalByCode(code);
  const studentCode = found.data.studentCode || found.data.code;
  const canonicalSnap = await db.collection('students').doc(cleanDocId(normalizeCode(studentCode))).get().catch(() => null);
  const student = canonicalSnap?.exists ? { ...found.data, ...canonicalSnap.data() } : found.data;
  const transferBase=db.collection('student_transfer_requests').where('studentCode','==',normalizeCode(studentCode));
  const transferPromise=mode==='student'?transferBase.orderBy('createdAt','desc').limit(20).get().catch(()=>transferBase.limit(20).get().catch(()=>null)):Promise.resolve(null);
  const [attempts, records, groupSnap, transferSnap, assignmentSnap] = await Promise.all([
    attemptSummaries(studentCode),
    studentRecords(studentCode, student),
    mode === 'student' ? db.collection('groups').limit(300).get().catch(() => null) : Promise.resolve(null),
    transferPromise,
    db.collection('assignments').where('active', '==', true).limit(250).get().catch(() => null)
  ]);
  const matchingTransferSchedules = groupSnap
    ? groupSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(item => scheduleMatchesStudent(item, student))
      .filter(item => text(student.scheduleId, 100) ? item.id !== text(student.scheduleId, 100) : !sameAcademicValue(item.name, student.group))
    : [];
  const transferOptions = (await Promise.all(matchingTransferSchedules.map(async item => {
    const capacity = Math.max(0, Math.min(500, Number(item.capacity || 0)));
    if (!capacity) return publicSchedule({ ...item, availableSeats:null });
    const enrolled = await scheduleEnrollment(item, item.id, studentCode);
    if (enrolled.length >= capacity) return null;
    return publicSchedule({ ...item, capacity, availableSeats:capacity-enrolled.length });
  }))).filter(Boolean).sort((a,b) => `${a.days} ${a.startTime} ${a.name}`.localeCompare(`${b.days} ${b.startTime} ${b.name}`, 'ar'));
  const transferRequests = transferSnap
    ? transferSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => firestoreMillis(b.createdAt) - firestoreMillis(a.createdAt))
    : [];
  const nextAssignmentMillis = assignmentSnap
    ? assignmentSnap.docs.map(doc => ({ id:doc.id, ...doc.data() }))
      .filter(item => learningTargetMatchesStudent(item, student))
      .map(item => scheduledTimeMillis(item.publishAt)).filter(value => value > Date.now()).sort((a,b) => a-b)[0] || 0
    : 0;
  return {
    ...portalResponse(student, attempts, records),
    transferOptions,
    transferRequest: transferRequests.length ? publicTransferRequest(transferRequests[0]) : null,
    nextAssignmentPublishAt: nextAssignmentMillis ? new Date(nextAssignmentMillis).toISOString() : ''
  };
});

exports.createStudentTransferRequest = onCall(CALLABLE_OPTIONS, async request => {
  const body = request.data || {};
  const studentCode = normalizeCode(body.studentCode);
  await rateLimitPublic('student-transfer', studentCode, request, 3, 8, 60 * 60 * 1000);
  const found = await getStudentPortalByCode(studentCode);
  const targetScheduleId = cleanDocId(text(body.targetScheduleId, 100));
  const reason = text(body.reason, 800);
  if (!targetScheduleId) throw new HttpsError('invalid-argument', 'اختر المجموعة المطلوب النقل إليها.');
  if (reason.length < 3) throw new HttpsError('invalid-argument', 'اكتب سبب طلب النقل باختصار.');
  const [targetSnap, existingSnap] = await Promise.all([
    db.collection('groups').doc(targetScheduleId).get(),
    db.collection('student_transfer_requests').where('studentCode', '==', studentCode).limit(20).get()
  ]);
  if (!targetSnap.exists || targetSnap.data().active === false) throw new HttpsError('not-found', 'المجموعة المطلوبة لم تعد متاحة.');
  const target = { id: targetSnap.id, ...targetSnap.data() };
  if (!scheduleMatchesStudent(target, found.data)) throw new HttpsError('permission-denied', 'هذه المجموعة ليست مخصصة لصف الطالب أو الترم الحالي.');
  if ((found.data.scheduleId && target.id === found.data.scheduleId) || (!found.data.scheduleId && target.name === found.data.group)) throw new HttpsError('already-exists', 'الطالب موجود بالفعل في هذه المجموعة.');
  if (existingSnap.docs.some(doc => doc.data().status === 'pending')) throw new HttpsError('already-exists', 'يوجد طلب نقل قيد المراجعة بالفعل.');
  const capacity = Math.max(0, Math.min(500, Number(target.capacity || 0)));
  if (capacity && (await scheduleEnrollment(target, target.id, studentCode)).length >= capacity) throw new HttpsError('resource-exhausted', 'اكتمل عدد الطلاب في هذه المجموعة. اختر مجموعة أخرى.');
  const ref = db.collection('student_transfer_requests').doc();
  const payload = {
    id: ref.id,
    studentCode,
    studentName: text(found.data.studentName || found.data.name, 100),
    studentPhone: digits(found.data.studentPhone),
    parentPhone: digits(found.data.parentPhone),
    grade: text(found.data.grade, 80),
    academicYear: text(found.data.academicYear, 20),
    term: text(found.data.term, 40),
    currentGroup: text(found.data.group, 100),
    currentScheduleId: text(found.data.scheduleId, 100),
    targetGroup: text(target.name, 100),
    targetScheduleId: target.id,
    targetScheduleDays: text(target.days, 100),
    targetScheduleStartTime: text(target.startTime, 20),
    targetScheduleEndTime: text(target.endTime, 20),
    reason,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  await ref.create(payload);
  return publicTransferRequest({ ...payload, createdAt: new Date() });
});

exports.reviewStudentTransferRequest = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request, ['admin', 'teacher']);
  const requestId = cleanDocId(text(request.data?.requestId, 120));
  const action = request.data?.action === 'approve' ? 'approve' : (request.data?.action === 'reject' ? 'reject' : '');
  const teacherNote = text(request.data?.teacherNote, 800);
  if (!requestId || !action) throw new HttpsError('invalid-argument', 'بيانات مراجعة طلب النقل غير مكتملة.');
  const requestRef = db.collection('student_transfer_requests').doc(requestId);
  const result = await db.runTransaction(async tx => {
    const transferSnap = await tx.get(requestRef);
    if (!transferSnap.exists) throw new HttpsError('not-found', 'طلب النقل غير موجود.');
    const transfer = { id: transferSnap.id, ...transferSnap.data() };
    if (transfer.status !== 'pending') throw new HttpsError('failed-precondition', 'تم التعامل مع طلب النقل بالفعل.');
    if (action === 'reject') {
      tx.update(requestRef, { status:'rejected', teacherNote, reviewedBy:staff.email||staff.uid, reviewedAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() });
      return { ...transfer, status:'rejected', teacherNote, reviewedAt:new Date() };
    }
    const studentCode = normalizeCode(transfer.studentCode);
    const studentRef = db.collection('students').doc(cleanDocId(studentCode));
    const scheduleRef = db.collection('groups').doc(cleanDocId(transfer.targetScheduleId));
    const [studentSnap, scheduleSnap] = await Promise.all([tx.get(studentRef), tx.get(scheduleRef)]);
    if (!studentSnap.exists || studentSnap.data().active === false) throw new HttpsError('not-found', 'حساب الطالب غير موجود أو غير نشط.');
    if (!scheduleSnap.exists || scheduleSnap.data().active === false) throw new HttpsError('failed-precondition', 'المجموعة المطلوبة لم تعد متاحة.');
    const student = { id:studentSnap.id, ...studentSnap.data() };
    const schedule = { id:scheduleSnap.id, ...scheduleSnap.data() };
    if (!scheduleMatchesStudent(schedule, student)) throw new HttpsError('failed-precondition', 'المجموعة لم تعد مطابقة لصف الطالب أو الترم.');
    const capacity = Math.max(0, Math.min(500, Number(schedule.capacity || 0)));
    if (capacity) {
      const enrolledSnap = await tx.get(db.collection('students').where('group', '==', text(schedule.name, 100)).limit(1000));
      const enrolled = enrolledSnap.docs.filter(doc => {
        const row = doc.data() || {};
        return row.active !== false
          && normalizeCode(row.studentCode || doc.id) !== studentCode
          && scheduleMatchesStudent(schedule, row)
          && (!row.scheduleId || row.scheduleId === schedule.id);
      }).length;
      if (enrolled >= capacity) throw new HttpsError('resource-exhausted', 'اكتمل عدد الطلاب في المجموعة قبل اعتماد الطلب.');
    }
    const patch = {
      group:text(schedule.name,100),
      scheduleId:schedule.id,
      scheduleDays:text(schedule.days,100),
      scheduleStartTime:text(schedule.startTime,20),
      scheduleEndTime:text(schedule.endTime,20),
      schedulePending:false,
      updatedAt:FieldValue.serverTimestamp()
    };
    const parentCode = normalizeCode(student.parentCode || studentCode);
    tx.set(studentRef, patch, { merge:true });
    tx.set(db.collection('student_portal').doc(cleanDocId(studentCode)), { ...patch, studentCode, parentCode }, { merge:true });
    tx.set(db.collection('parent_portal').doc(cleanDocId(parentCode)), { ...patch, studentCode, parentCode }, { merge:true });
    tx.set(db.collection('payments').doc(cleanDocId(studentCode)), { group:patch.group, updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    tx.update(requestRef, {
      status:'approved',
      targetGroup:patch.group,
      targetScheduleDays:patch.scheduleDays,
      targetScheduleStartTime:patch.scheduleStartTime,
      targetScheduleEndTime:patch.scheduleEndTime,
      teacherNote,
      reviewedBy:staff.email||staff.uid,
      reviewedAt:FieldValue.serverTimestamp(),
      updatedAt:FieldValue.serverTimestamp()
    });
    return { ...transfer, status:'approved', targetGroup:patch.group, teacherNote, reviewedAt:new Date() };
  });
  await db.collection('activityLog').add({ action:action==='approve'?'تم اعتماد طلب نقل طالب':'تم رفض طلب نقل طالب', meta:{requestId,studentCode:result.studentCode,targetGroup:result.targetGroup}, actorUid:staff.uid, actorEmail:staff.email||'', createdAt:FieldValue.serverTimestamp() }).catch(()=>{});
  return publicTransferRequest(result);
});

const leaderboardStateRef = db.collection('_system').doc('leaderboard');
let leaderboardCache = { expiresAt: 0, version: -1, rows: [] };

async function markLeaderboardDirty(reason = 'activity') {
  try {
    await leaderboardStateRef.set({
      version: FieldValue.increment(1),
      reason: text(reason, 60),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('leaderboard-dirty-marker-failed', error?.message || error);
  }
}

function cairoDateKey(value = new Date()) {
  let date;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (value && typeof value.toDate === 'function') date = value.toDate();
  else date = value instanceof Date ? value : new Date(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function leaderboardRecordDate(row = {}) {
  return cairoDateKey(row.date || row.submittedAt || row.createdAt || row.updatedAt || '');
}

exports.getPublicLeaderboard = onCall(CALLABLE_OPTIONS, async request => {
  // The old shared identity "all" imposed one 30-request limit on the whole
  // website. Limit per visitor IP instead so simultaneous students can load it.
  await rateLimit('public-leaderboard-ip', requestIp(request), 60, 60 * 1000);
  const stateSnap = await leaderboardStateRef.get().catch(() => null);
  const stateVersion = stateSnap?.exists ? Number(stateSnap.data()?.version || 0) : 0;
  const requestedGrade = text(request.data?.grade, 50);
  if (!supportedGrade(requestedGrade)) return [];
  const selectGradeLeaders = items => (items || []).filter(row => sameAcademicValue(row.grade, requestedGrade)).slice(0, 5);
  if (leaderboardCache.expiresAt > Date.now() && leaderboardCache.version === stateVersion) return selectGradeLeaders(leaderboardCache.rows);
  const [studentsSnap, attendanceSnap, gradesSnap, homeworkSnap, recitationSnap] = await Promise.all([
    db.collection('students').where('active', '==', true).limit(500).get(),
    db.collection('attendance').limit(2000).get(),
    db.collection('grades').limit(2000).get(),
    db.collection('homework_submissions').limit(2000).get(),
    db.collection('recitations').limit(2000).get()
  ]);
  const grouped = snap => { const map = new Map(); snap.docs.forEach(doc => { const row=doc.data()||{},code=normalizeCode(row.studentCode); if(!code)return; if(!map.has(code))map.set(code,[]); map.get(code).push(row); }); return map; };
  const attendance=grouped(attendanceSnap),grades=grouped(gradesSnap),homeworks=grouped(homeworkSnap),recitations=grouped(recitationSnap);
  const complete=row=>row.completed===true||row.approved===true||String(row.status||'').startsWith('تم');
  const currentMonth=cairoDateKey(new Date()).slice(0,7);
  const currentMonthRows=items=>(items||[]).filter(row=>leaderboardRecordDate(row).slice(0,7)===currentMonth);
  const recordDate=leaderboardRecordDate;
  const rows=studentsSnap.docs.map(doc=>{
    const st=doc.data()||{},code=normalizeCode(st.studentCode||st.code||doc.id);
    const att=currentMonthRows(attendance.get(code)||st.attendance||[]),present=att.filter(x=>['present','حاضر','متأخر'].includes(x.status)).length,attendancePct=att.length?Math.round(present/att.length*100):0;
    const gradeRows=currentMonthRows(grades.get(code)||st.grades||[]).filter(x=>Number.isFinite(Number(x.score))),gradePct=gradeRows.length?Math.round(gradeRows.reduce((sum,x)=>sum+Number(x.score),0)/gradeRows.length):0;
    const hw=currentMonthRows(homeworks.get(code)||st.homeworks||[]).filter(complete),rec=currentMonthRows(recitations.get(code)||st.recitations||[]).filter(complete);
    const classDates=new Set(att.map(recordDate).filter(Boolean));hw.forEach(row=>{const date=recordDate(row);if(date)classDates.add(date);});rec.forEach(row=>{const date=recordDate(row);if(date)classDates.add(date);});
    const sessions=classDates.size,completedDates=items=>new Set(items.map(recordDate).filter(Boolean)).size;
    const homeworkPct=sessions?Math.min(100,Math.round(completedDates(hw)/sessions*100)):0,recitationPct=sessions?Math.min(100,Math.round(completedDates(rec)/sessions*100)):0;
    const score=Math.round(attendancePct*.30+gradePct*.40+homeworkPct*.15+recitationPct*.15);
    return {name:publicStudentName(st.studentName||st.name),grade:text(st.grade,50),score,attendancePct,gradePct,homeworkPct,recitationPct,activity:att.length+gradeRows.length+hw.length+rec.length};
  }).filter(x=>x.name&&x.activity>0).sort((a,b)=>b.score-a.score||b.attendancePct-a.attendancePct||b.gradePct-a.gradePct);
  leaderboardCache = { expiresAt: Date.now() + 5 * 60 * 1000, version: stateVersion, rows };
  return selectGradeLeaders(rows);
});

exports.createStudentAccess = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  const body = request.data || {};
  const name = text(body.studentName || body.name, 100).replace(/\s+/g, ' ').trim();
  const grade = requireSupportedGrade(body.grade);
  const parentPhone = digits(body.parentPhone);
  if (!hasAtLeastThreeNameParts(name)) throw new HttpsError('invalid-argument', 'اكتب اسم الطالب ثلاثيًا على الأقل، وإذا تكرر الاسم الثلاثي اكتب الاسم الرباعي.');
  if (digits(parentPhone).length < 10) throw new HttpsError('invalid-argument', 'اكتب رقم ولي أمر صحيحًا.');
  const nameIdentity = await assertStudentNameAvailable(name);

  for (let attemptNo = 0; attemptNo < 8; attemptNo += 1) {
    const studentCode = await uniqueUnifiedAccessCode(8);
    const parentCode = studentCode;
    const studentRef = db.collection('students').doc(cleanDocId(studentCode));
    const studentPortalRef = db.collection('student_portal').doc(cleanDocId(studentCode));
    const parentPortalRef = db.collection('parent_portal').doc(cleanDocId(parentCode));
    const paymentRef = db.collection('payments').doc(cleanDocId(studentCode));
    const student = {
      studentCode,
      code: studentCode,
      parentCode,
      studentName: name,
      name,
      nameKey: nameIdentity.nameKey,
      normalizedName: nameIdentity.normalizedName,
      studentPhone: digits(body.studentPhone),
      parentPhone,
      grade,
      month: text(body.month, 40),
      group: text(body.group, 100),
      academicYear: text(body.academicYear, 20),
      term: text(body.term, 40),
      notes: text(body.notes, 1500),
      paid: body.paid === true,
      paymentDate: text(body.paymentDate, 40),
      active: body.active !== false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    const portal = portalResponse(student, []);
    const batch = db.batch();
    batch.create(studentRef, student);
    batch.create(studentPortalRef, { ...portal, studentCode, parentCode, active: student.active, updatedAt: FieldValue.serverTimestamp() });
    batch.create(parentPortalRef, { ...portal, studentCode, parentCode, active: student.active, updatedAt: FieldValue.serverTimestamp() });
    batch.set(paymentRef, {
      studentCode,
      studentName: name,
      grade: student.grade,
      group: student.group,
      academicYear: student.academicYear,
      term: student.term,
      paid: student.paid,
      paymentDate: student.paymentDate,
      updatedAt: FieldValue.serverTimestamp()
    });
    const logRef = db.collection('activityLog').doc();
    batch.set(logRef, {
      action: 'تم تسجيل طالب جديد',
      meta: { studentCode },
      actorUid: staff.uid,
      actorEmail: staff.email || '',
      actorRole: staff.role || '',
      createdAt: FieldValue.serverTimestamp()
    });
    batch.create(nameIdentity.claimRef, {
      nameKey: nameIdentity.nameKey,
      normalizedName: nameIdentity.normalizedName,
      studentCode,
      source: 'staff',
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    try {
      await batch.commit();
      return { ...portal, studentCode, code: studentCode, parentCode, active: student.active };
    } catch (error) {
      const existingClaim = await nameIdentity.claimRef.get().catch(() => null);
      if (existingClaim?.exists) throw duplicateStudentNameError();
      if (attemptNo === 7) throw new HttpsError('aborted', 'تعذر إنشاء أكواد فريدة، حاول مرة أخرى.');
    }
  }
  throw new HttpsError('resource-exhausted', 'تعذر إنشاء أكواد فريدة، حاول مرة أخرى.');
});

exports.createBooking = onCall(CALLABLE_OPTIONS, async request => {
  const body = request.data || {};
  const rawRequestId = text(body.requestId, 80);
  const requestId = /^[A-Za-z0-9_-]{12,80}$/.test(rawRequestId) ? rawRequestId : '';
  const requestRef = requestId ? db.collection('_booking_requests').doc(cleanDocId(requestId)) : null;
  if (requestRef) {
    const previous = await requestRef.get();
    if (previous.exists && previous.data().response) return previous.data().response;
  }
  const identity = `${digits(body.parentPhone)}:${request.rawRequest.ip || ''}`;
  await rateLimitPublic('booking-v2', identity, request, 12, 60, 10 * 60 * 1000);
  const name = text(body.name, 80).replace(/\s+/g, ' ').trim();
  const studentPhone = digits(body.studentPhone);
  const parentPhone = digits(body.parentPhone);
  if (!hasAtLeastThreeNameParts(name)) throw new HttpsError('invalid-argument', 'اكتب اسم الطالب ثلاثيًا على الأقل، وإذا تكرر الاسم الثلاثي اكتب الاسم الرباعي.');
  if (studentPhone.length < 10 || parentPhone.length < 10) throw new HttpsError('invalid-argument', 'اكتب أرقام هاتف صحيحة.');
  const nameIdentity = await assertStudentNameAvailable(name, { requestId });
  const requestedGrade = requireSupportedGrade(body.grade);
  const requestedGroup = text(body.group, 100);
  const selectedScheduleId = cleanDocId(text(body.scheduleId, 100));
  // These reads do not depend on one another. Parallel execution removes one
  // complete Firestore round-trip from each registration request.
  const [scheduleSnap, code] = await Promise.all([
    selectedScheduleId ? db.collection('groups').doc(selectedScheduleId).get() : Promise.resolve(null),
    uniqueUnifiedAccessCode(8)
  ]);
  let schedule = null;
  if (selectedScheduleId) {
    if (!scheduleSnap?.exists || scheduleSnap.data().active === false) {
      throw new HttpsError('failed-precondition', 'هذا الموعد لم يعد متاحًا. حدّث الصفحة واختر موعدًا آخر.');
    }
    schedule = scheduleSnap.data();
    if (text(schedule.grade, 80) !== requestedGrade) throw new HttpsError('failed-precondition', 'الموعد المختار غير متاح لهذا الصف.');
    if (text(schedule.name, 100) !== requestedGroup) throw new HttpsError('failed-precondition', 'المجموعة المختارة تغيّرت. حدّث الصفحة واخترها من جديد.');
  }
  // All codes shown after booking are digits only and can be typed with Arabic
  // or English numerals. They are issued immediately and never change later.
  const studentCode = code;
  const parentCode = code;
  const payload = {
    id: code,
    code,
    name,
    studentName: name,
    nameKey: nameIdentity.nameKey,
    normalizedName: nameIdentity.normalizedName,
    studentPhone,
    parentPhone,
    grade: requestedGrade,
    month: text(body.month, 40),
    group: schedule ? text(schedule.name, 100) : '',
    scheduleId: selectedScheduleId,
    scheduleDays: schedule ? text(schedule.days, 100) : '',
    scheduleStartTime: schedule ? text(schedule.startTime, 20) : '',
    scheduleEndTime: schedule ? text(schedule.endTime, 20) : '',
    schedulePending: !schedule,
    academicYear: text(body.academicYear, 20),
    term: text(body.term, 40),
    notes: text(body.notes, 1000),
    studentCode,
    parentCode,
    status: 'قيد التسجيل',
    date: new Date().toISOString().slice(0, 10),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  const statusPayload = {
    code,
    name: payload.name,
    grade: payload.grade,
    month: payload.month,
    group: payload.group,
    scheduleId: payload.scheduleId,
    scheduleDays: payload.scheduleDays,
    scheduleStartTime: payload.scheduleStartTime,
    scheduleEndTime: payload.scheduleEndTime,
    academicYear: payload.academicYear,
    term: payload.term,
    status: payload.status,
    studentCode,
    parentCode,
    updatedAt: FieldValue.serverTimestamp()
  };
  const batch = db.batch();
  batch.create(db.collection('bookings').doc(cleanDocId(code)), payload);
  batch.create(db.collection('booking_status').doc(cleanDocId(code)), statusPayload);
  const provisionalStudent = {
    ...payload,
    bookingCode: code,
    code: studentCode,
    id: studentCode,
    studentCode,
    parentCode,
    paid: false,
    paymentDate: '',
    active: true,
    approvalStatus: 'قيد التسجيل'
  };
  const provisionalPortal = portalResponse(provisionalStudent, []);
  batch.create(db.collection('students').doc(studentCode), provisionalStudent);
  batch.create(db.collection('student_portal').doc(studentCode), { ...provisionalPortal, parentCode, active: true, updatedAt: FieldValue.serverTimestamp() });
  batch.create(db.collection('parent_portal').doc(parentCode), { ...provisionalPortal, parentCode, active: true, updatedAt: FieldValue.serverTimestamp() });
  batch.create(nameIdentity.claimRef, {
    nameKey: nameIdentity.nameKey,
    normalizedName: nameIdentity.normalizedName,
    studentCode,
    bookingCode: code,
    requestId,
    source: 'public-booking',
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  const response = { code, bookingCode: code, studentCode, parentCode, status: payload.status };
  if (requestRef) batch.create(requestRef, { requestId, response, createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000) });
  try {
    await batch.commit();
  } catch (error) {
    // A retried browser request can race the original request. The first batch
    // wins; the retry returns the exact same codes instead of creating a second
    // booking or showing a false failure.
    if (requestRef) {
      const previous = await requestRef.get().catch(() => null);
      if (previous?.exists && previous.data().response) return previous.data().response;
    }
    const existingClaim = await nameIdentity.claimRef.get().catch(() => null);
    if (existingClaim?.exists) throw duplicateStudentNameError();
    throw error;
  }
  return response;
});

exports.approveBooking = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  const bookingCode = normalizeCode(request.data && request.data.code);
  if (!validLegacyOrStrongCode(bookingCode)) throw new HttpsError('invalid-argument', 'كود الحجز غير صالح.');

  // Candidates also let legacy bookings be approved instead of forcing the
  // teacher to delete and recreate them. Existing V55 codes are preserved.
  // Current bookings already use their numeric booking code as the unified
  // access code. Avoid five unnecessary uniqueness reads on every approval;
  // only old alphanumeric bookings need a fresh fallback code.
  const fallbackStudentCode = /^\d{6,12}$/.test(bookingCode) ? bookingCode : await uniqueUnifiedAccessCode(8);

  const bookingRef = db.collection('bookings').doc(cleanDocId(bookingCode));
  const statusRef = db.collection('booking_status').doc(cleanDocId(bookingCode));
  return db.runTransaction(async tx => {
    // The normal path needs one read only. booking_status is consulted only
    // when the teacher taps an already-approved request again.
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists) {
      const statusSnap = await tx.get(statusRef);
      const status = statusSnap.exists ? statusSnap.data() : {};
      if (String(status.status || '').includes('القبول')) return { ...status, bookingCode, code: status.studentCode, alreadyApproved: true };
      throw new HttpsError('not-found', 'الحجز غير موجود أو تم التعامل معه من قبل.');
    }
    const status = {};
    const booking = bookingSnap.data() || {};
    if (!supportedGrade(booking.grade)) throw new HttpsError('failed-precondition', 'هذا الحجز تابع لصف غير متاح حاليًا على المنصة.');
    const existingStudentCode = text(booking.studentCode || status.studentCode, 40);
    const oldParentCode = text(booking.parentCode || status.parentCode, 40);
    const studentCode = /^\d{6,12}$/.test(existingStudentCode) ? existingStudentCode : fallbackStudentCode;
    const parentCode = studentCode;
    const name = text(booking.studentName || booking.name, 100);
    const student = {
      ...booking,
      id: studentCode,
      code: studentCode,
      studentCode,
      parentCode,
      bookingCode,
      name,
      studentName: name,
      paid: false,
      paymentDate: '',
      active: true,
      approvalStatus: 'تم القبول والتسجيل كطالب',
      acceptedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    const portal = portalResponse(student, []);
    tx.set(db.collection('students').doc(studentCode), student, { merge: true });
    tx.set(db.collection('student_portal').doc(studentCode), { ...portal, parentCode, active: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(db.collection('parent_portal').doc(parentCode), { ...portal, parentCode, active: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (oldParentCode && oldParentCode !== parentCode) tx.delete(db.collection('parent_portal').doc(cleanDocId(oldParentCode)));
    tx.set(db.collection('payments').doc(studentCode), { studentCode, studentName: name, grade: student.grade, group: student.group, academicYear: student.academicYear, term: student.term, paid: false, paymentDate: '', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(statusRef, { ...status, code: bookingCode, name, studentName: name, studentCode, parentCode, status: 'تم القبول والتسجيل كطالب', acceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.delete(bookingRef);
    tx.set(db.collection('activityLog').doc(), { action: 'تم قبول الحجز وتسجيل الطالب', meta: { bookingCode, studentCode }, actorUid: staff.uid, actorEmail: staff.email || '', actorRole: staff.role || '', createdAt: FieldValue.serverTimestamp() });
    return { ...student, bookingCode, code: studentCode };
  });
});

exports.getBookingStatus = onCall(CALLABLE_OPTIONS, async request => {
  const code = normalizeCode(request.data && request.data.code);
  await rateLimitPublic('booking-status', code, request, 10, 40, 60 * 1000);
  if (!validLegacyOrStrongCode(code)) throw new HttpsError('invalid-argument', 'كود الحجز غير صالح.');
  let snap = await db.collection('booking_status').doc(cleanDocId(code)).get();
  if (!snap.exists) snap = await db.collection('bookings').doc(cleanDocId(code)).get();
  if (!snap.exists) throw new HttpsError('not-found', 'لم يتم العثور على الحجز.');
  const data = snap.data();
  return {
    code,
    name: text(data.name || data.studentName, 80),
    grade: text(data.grade, 80),
    month: text(data.month, 40),
    group: text(data.group, 100),
    scheduleId: text(data.scheduleId, 100),
    scheduleDays: text(data.scheduleDays, 100),
    scheduleStartTime: text(data.scheduleStartTime, 20),
    scheduleEndTime: text(data.scheduleEndTime, 20),
    academicYear: text(data.academicYear, 20),
    term: text(data.term, 40),
    status: text(data.status, 100)
  };
});

exports.rejectBooking = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  const bookingCode = normalizeCode(request.data && request.data.code);
  if (!validLegacyOrStrongCode(bookingCode)) throw new HttpsError('invalid-argument', 'كود الحجز غير صالح.');
  const bookingRef = db.collection('bookings').doc(cleanDocId(bookingCode));
  const statusRef = db.collection('booking_status').doc(cleanDocId(bookingCode));
  return db.runTransaction(async tx => {
    const [bookingSnap, statusSnap] = await Promise.all([tx.get(bookingRef), tx.get(statusRef)]);
    const data = bookingSnap.exists ? bookingSnap.data() : (statusSnap.exists ? statusSnap.data() : null);
    if (!data) throw new HttpsError('not-found', 'الحجز غير موجود.');
    const studentCode = text(data.studentCode, 40);
    const parentCode = text(data.parentCode, 40);
    if (studentCode) {
      tx.set(db.collection('students').doc(cleanDocId(studentCode)), { active: false, approvalStatus: 'تم رفض الحجز', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(db.collection('student_portal').doc(cleanDocId(studentCode)), { active: false, approvalStatus: 'تم رفض الحجز', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    if (parentCode) tx.set(db.collection('parent_portal').doc(cleanDocId(parentCode)), { active: false, approvalStatus: 'تم رفض الحجز', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const { nameKey } = studentNameIdentity(data.studentName || data.name);
    if (nameKey) tx.delete(db.collection('_student_name_claims').doc(nameKey));
    tx.set(statusRef, { ...data, status: 'تم رفض الحجز', rejectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (bookingSnap.exists) tx.delete(bookingRef);
    tx.set(db.collection('activityLog').doc(), { action: 'تم رفض حجز طالب', meta: { bookingCode, studentCode }, actorUid: staff.uid, actorEmail: staff.email || '', actorRole: staff.role || '', createdAt: FieldValue.serverTimestamp() });
    return { code: bookingCode, status: 'تم رفض الحجز' };
  });
});

exports.createReview = onCall(CALLABLE_OPTIONS, async request => {
  const body = request.data || {};
  await rateLimitPublic('review', text(body.name, 60), request, 2, 8, 60 * 60 * 1000);
  const name = text(body.name, 60);
  const reviewText = text(body.text, 600);
  const rating = Math.max(1, Math.min(5, Number(body.rating || 5)));
  if (name.length < 2 || reviewText.length < 5) throw new HttpsError('invalid-argument', 'اكتب اسمًا وتقييمًا واضحًا.');
  const ref = db.collection('reviews').doc();
  await ref.set({
    id: ref.id,
    name,
    role: text(body.role, 30),
    text: reviewText,
    rating: String(rating),
    approved: false,
    date: new Date().toISOString().slice(0, 10),
    createdAt: FieldValue.serverTimestamp()
  });
  return { ok: true };
});

exports.recordClassProgress = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  const body = request.data || {};
  const type = body.type === 'recitation' ? 'recitation' : (body.type === 'homework' ? 'homework' : '');
  const studentCode = normalizeCode(body.studentCode);
  const date = text(body.date, 10);
  const completed = body.completed !== false;
  if (!type || !validLegacyOrStrongCode(studentCode) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpsError('invalid-argument', 'بيانات متابعة الحصة غير مكتملة.');
  }
  const studentSnap = await db.collection('students').doc(cleanDocId(studentCode)).get();
  if (!studentSnap.exists || studentSnap.data().active === false) throw new HttpsError('not-found', 'الطالب غير موجود أو غير نشط.');
  const student = studentSnap.data() || {};
  const collection = type === 'recitation' ? 'recitations' : 'homework_submissions';
  const id = cleanDocId(`${studentCode}_${date}_class`);
  const ref = db.collection(collection).doc(id);
  if (!completed) {
    await ref.delete().catch(() => {});
    await markLeaderboardDirty(`${type}-removed`);
    return { id, type, studentCode, date, completed: false, removed: true };
  }
  const payload = {
    id,
    type,
    studentCode,
    studentName: text(student.studentName || student.name, 100),
    grade: text(student.grade, 80),
    group: text(student.group, 100),
    academicYear: text(student.academicYear, 20),
    term: text(student.term, 40),
    date,
    time: text(body.time, 30),
    title: type === 'recitation' ? 'تسميع الحصة' : 'واجب الحصة',
    status: type === 'recitation' ? 'تم التسميع' : 'تم عمل الواجب',
    completed: true,
    approved: true,
    method: 'teacher_class_check',
    checkedBy: staff.email || staff.uid,
    updatedAt: FieldValue.serverTimestamp()
  };
  await ref.set(payload, { merge: true });
  await markLeaderboardDirty(type);
  return { ...payload, updatedAt: new Date().toISOString() };
});

function examMatchesStudent(exam, student) {
  return learningTargetMatchesStudent(exam, student);
}

function examIsOpen(exam, now = Date.now()) {
  return getExamScheduleState(exam, now).state === 'open';
}

function examAvailability(exam, now = Date.now()) {
  return getExamScheduleState(exam, now).state;
}

exports.getExamDashboard = onCall(CALLABLE_OPTIONS, async request => {
  const studentCode = normalizeCode(request.data && request.data.studentCode);
  await rateLimitPublic('exam-dashboard', studentCode, request, 10, 35, 60 * 1000);
  const found = await getStudentPortalByCode(studentCode);
  if (!supportedGrade(found.data.grade)) {
    const [attempts, records] = await Promise.all([attemptSummaries(studentCode), studentRecords(studentCode)]);
    return { student: portalResponse(found.data, attempts, records), exams: [], serverNow: Date.now(), dashboardVersion: Date.now() };
  }
  // Keep legacy exams that predate the explicit `active` field visible.
  const snap = await db.collection('exams').get();
  const now = Date.now();
  const exams = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(exam => examMatchesStudent(exam, found.data))
    .filter(exam => exam.active !== false)
    .map(exam => ({
      id: text(exam.id, 100),
      title: text(exam.title, 200),
      grade: text(exam.grade, 80),
      group: text(exam.group, 100),
      academicYear: text(exam.academicYear, 20),
      term: text(exam.term, 40),
      openAt: text(exam.openAt, 60),
      closeAt: text(exam.closeAt, 60),
      duration: Math.max(1, Math.min(240, Number(exam.duration || 20))),
      instructions: text(exam.instructions, 1500),
      pdfUrl: safePublicUrl(exam.pdfUrl || exam.examPdfUrl),
      pdfName: text(exam.pdfName || exam.examPdfName, 220),
      allowRetake: exam.allowRetake === true,
      questionCount: Number(exam.questionCount || examQuestionList(exam).length),
      maxScore: positiveExamScore(exam.maxScore, 100),
      contentVersion: Number(exam.contentVersion || 0),
      availability: examAvailability(exam, now)
    }))
    .sort((a, b) => {
      const order = { open: 0, upcoming: 1, closed: 2 };
      const stateOrder = (order[a.availability] ?? 3) - (order[b.availability] ?? 3);
      if (stateOrder) return stateOrder;
      const aTime = new Date(a.availability === 'closed' ? a.closeAt || 0 : a.openAt || 0).getTime() || 0;
      const bTime = new Date(b.availability === 'closed' ? b.closeAt || 0 : b.openAt || 0).getTime() || 0;
      return a.availability === 'closed' ? bTime - aTime : aTime - bTime;
    });
  const [attempts, records] = await Promise.all([attemptSummaries(studentCode), studentRecords(studentCode)]);
  return { student: portalResponse(found.data, attempts, records), exams, serverNow: now, dashboardVersion: now };
});

exports.startExam = onCall(CALLABLE_OPTIONS, async request => {
  const studentCode = normalizeCode(request.data && request.data.studentCode);
  const examId = cleanDocId(request.data && request.data.examId);
  await rateLimitPublic('exam-start', `${studentCode}:${examId}`, request, 5, 20, 10 * 60 * 1000);
  const found = await getStudentPortalByCode(studentCode);
  const examSnap = await db.collection('exams').doc(examId).get();
  if (!examSnap.exists) throw new HttpsError('not-found', 'الامتحان غير موجود.');
  const exam = { id: examSnap.id, ...examSnap.data() };
  const schedule = getExamScheduleState(exam);
  if (schedule.state === 'upcoming') throw new HttpsError('failed-precondition', 'الامتحان لم يبدأ بعد. ترقّب الموعد وذاكر ببراعة.');
  if (schedule.state === 'closed') throw new HttpsError('deadline-exceeded', 'انتهى وقت الامتحان، لم تستطع أداء الامتحان هذه المرة.');
  if (!examMatchesStudent(exam, found.data)) {
    throw new HttpsError('permission-denied', 'هذا الامتحان غير مخصص لصفك أو مجموعتك أو عامك الدراسي.');
  }
  const questions = examQuestionsWithScores(examQuestionList(exam), exam.maxScore);
  if (!questions.length) throw new HttpsError('failed-precondition', 'الامتحان لا يحتوي على أسئلة صالحة.');
  if (questions.length > 200) throw new HttpsError('failed-precondition', 'عدد أسئلة الامتحان أكبر من الحد المسموح.');

  const durationMinutes = examDurationMinutes(exam.duration);
  const now = Date.now();
  const sessionExpiresAt = examSessionExpiryMillis(exam, now);
  if (sessionExpiresAt <= now) throw new HttpsError('deadline-exceeded', 'انتهى وقت الامتحان، لم تستطع أداء الامتحان هذه المرة.');
  const sessionId = cleanDocId(`${examId}_${studentCode}`);
  const sessionRef = db.collection('exam_sessions').doc(sessionId);
  const lockRef = db.collection('exam_locks').doc(sessionId);

  const sessionData = await db.runTransaction(async tx => {
    const [existingSessionSnap, lockSnap] = await Promise.all([tx.get(sessionRef), tx.get(lockRef)]);
    if (lockSnap.exists && exam.allowRetake !== true) {
      throw new HttpsError('already-exists', 'تم تسليم الامتحان بالفعل.');
    }
    if (existingSessionSnap.exists) {
      const existing = existingSessionSnap.data();
      const synchronizedTiming = examSessionTiming(exam, existing);
      const existingExpiresAt = synchronizedTiming?.expiresAtMs
        || (existing.expiresAt?.toMillis ? existing.expiresAt.toMillis() : 0);
      if (existing.status === 'submitted' && exam.allowRetake !== true) {
        throw new HttpsError('already-exists', 'تم تسليم الامتحان بالفعل.');
      }
      if (existing.status === 'started' && existingExpiresAt > now) {
        const synchronized = synchronizedTiming ? {
          ...existing,
          duration: synchronizedTiming.duration,
          expiresAt: Timestamp.fromMillis(synchronizedTiming.expiresAtMs),
          scheduledCloseAt: synchronizedTiming.closeAtMs ? Timestamp.fromMillis(synchronizedTiming.closeAtMs) : null,
          scheduleVersion: synchronizedTiming.contentVersion
        } : existing;
        if (synchronizedTiming) tx.set(sessionRef, {
          duration: synchronizedTiming.duration,
          expiresAt: synchronized.expiresAt,
          scheduledCloseAt: synchronized.scheduledCloseAt,
          scheduleVersion: synchronizedTiming.contentVersion,
          timingUpdatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        return synchronized;
      }
      if (existing.status === 'started' && existingExpiresAt <= now && exam.allowRetake !== true) {
        throw new HttpsError('deadline-exceeded', 'انتهى وقت الامتحان ولا يمكن بدء الوقت من جديد. راجع المدرس.');
      }
    }

    const attemptSequence = existingSessionSnap.exists
      ? Number(existingSessionSnap.data().attemptSequence || 0) + 1
      : 1;
    const fresh = {
      sessionId,
      examId,
      studentCode,
      studentName: text(found.data.studentName || found.data.name, 100),
      grade: text(found.data.grade, 80),
      group: text(found.data.group, 100),
      academicYear: text(found.data.academicYear, 20),
      term: text(found.data.term, 40),
      examTitle: text(exam.title, 200),
      maxScore: Math.round(questions.reduce((sum, question) => sum + positiveExamScore(question.points, 1), 0) * 100) / 100,
      instructions: text(exam.instructions, 1500),
      pdfUrl: safePublicUrl(exam.pdfUrl || exam.examPdfUrl),
      pdfName: text(exam.pdfName || exam.examPdfName, 220),
      contentVersion: Number(exam.contentVersion || 0),
      duration: durationMinutes,
      allowRetake: exam.allowRetake === true,
      attemptSequence,
      status: 'started',
      questions,
      startedAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(sessionExpiresAt),
      deleteAt: Timestamp.fromMillis(now + 30 * 24 * 60 * 60 * 1000),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    tx.set(sessionRef, fresh);
    return fresh;
  });

  const startedAtMs = sessionData.startedAt?.toMillis ? sessionData.startedAt.toMillis() : now;
  const expiresAtMs = sessionData.expiresAt?.toMillis
    ? sessionData.expiresAt.toMillis()
    : startedAtMs + durationMinutes * 60 * 1000;
  const snapshotQuestions = Array.isArray(sessionData.questions) && sessionData.questions.length
    ? sessionData.questions
    : questions;
  return publicExamSession(sessionId, {
    id: examId,
    title: sessionData.examTitle || exam.title,
    instructions: sessionData.instructions || exam.instructions,
    duration: sessionData.duration || durationMinutes,
    maxScore: sessionData.maxScore || exam.maxScore,
    pdfUrl: sessionData.pdfUrl || exam.pdfUrl || exam.examPdfUrl,
    pdfName: sessionData.pdfName || exam.pdfName || exam.examPdfName,
    contentVersion: Number(sessionData.contentVersion || exam.contentVersion || 0)
  }, snapshotQuestions, startedAtMs, expiresAtMs);
});

exports.getExamSessionTiming = onCall(CALLABLE_OPTIONS, async request => {
  const sessionId = cleanDocId(request.data && request.data.sessionId);
  const studentCode = normalizeCode(request.data && request.data.studentCode);
  if (!sessionId || !validLegacyOrStrongCode(studentCode)) {
    throw new HttpsError('invalid-argument', 'بيانات جلسة الامتحان غير مكتملة.');
  }
  await rateLimitPublic('exam-session-timing', `${studentCode}:${sessionId}`, request, 30, 300, 15 * 60 * 1000);
  const sessionRef = db.collection('exam_sessions').doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new HttpsError('not-found', 'جلسة الامتحان غير موجودة.');
  const session = sessionSnap.data() || {};
  if (normalizeCode(session.studentCode) !== studentCode) {
    throw new HttpsError('permission-denied', 'كود الطالب لا يطابق جلسة الامتحان.');
  }
  const examSnap = await db.collection('exams').doc(cleanDocId(session.examId)).get();
  const exam = examSnap.exists ? { id: examSnap.id, ...examSnap.data() } : null;
  const timing = examSessionTiming(exam, session);
  if (timing) {
    await sessionRef.set({
      duration: timing.duration,
      expiresAt: Timestamp.fromMillis(timing.expiresAtMs),
      scheduledCloseAt: timing.closeAtMs ? Timestamp.fromMillis(timing.closeAtMs) : null,
      scheduleVersion: timing.contentVersion,
      timingUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  const savedExpiresAt = session.expiresAt?.toMillis ? session.expiresAt.toMillis() : 0;
  return {
    status: text(session.status, 30),
    expiresAt: timing?.expiresAtMs || savedExpiresAt,
    duration: timing?.duration || Number(session.duration || 20),
    contentVersion: timing?.contentVersion || Number(session.contentVersion || 0),
    serverNow: Date.now()
  };
});

exports.submitExam = onCall(CALLABLE_OPTIONS, async request => {
  const body = request.data || {};
  const sessionId = cleanDocId(body.sessionId);
  const studentCode = normalizeCode(body.studentCode);
  const rawAnswers = body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers) ? body.answers : {};
  const autoSubmit = body.autoSubmit === true;
  if (jsonByteSize(rawAnswers) > 64 * 1024) throw new HttpsError('invalid-argument', 'حجم الإجابات أكبر من الحد المسموح.');
  await rateLimitPublic('exam-submit', `${studentCode}:${sessionId}`, request, 4, 20, 10 * 60 * 1000);
  if (!sessionId || !validLegacyOrStrongCode(studentCode)) throw new HttpsError('invalid-argument', 'بيانات المحاولة غير مكتملة.');
  const sessionRef = db.collection('exam_sessions').doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new HttpsError('not-found', 'جلسة الامتحان غير موجودة.');
  const session = sessionSnap.data();
  if (session.studentCode !== studentCode) throw new HttpsError('permission-denied', 'كود الطالب لا يطابق جلسة الامتحان.');
  if (session.status === 'submitted' && session.result) return session.result;
  const expiresAt = session.expiresAt && session.expiresAt.toMillis ? session.expiresAt.toMillis() : 0;
  if (expiresAt && Date.now() > expiresAt + 120 * 1000) throw new HttpsError('deadline-exceeded', 'انتهى وقت الامتحان.');
  const examSnap = await db.collection('exams').doc(session.examId).get();
  const exam = examSnap.exists ? { id: examSnap.id, ...examSnap.data() } : {
    id: session.examId,
    title: session.examTitle || 'امتحان',
    allowRetake: session.allowRetake === true
  };
  const questions = examQuestionsWithScores(Array.isArray(session.questions) && session.questions.length
    ? session.questions
    : examQuestionList(exam), session.maxScore || exam.maxScore);
  if (!questions.length) throw new HttpsError('failed-precondition', 'تعذر قراءة أسئلة الامتحان.');
  if (Object.keys(rawAnswers).length > questions.length + 5) throw new HttpsError('invalid-argument', 'عدد الإجابات غير صالح.');

  let correctCount = 0;
  let awardedScore = 0;
  let autoMaxScore = 0;
  let mcqCount = 0;
  let essayCount = 0;
  let needsManualReview = false;
  const staffAnswers = [];
  questions.forEach((question, index) => {
    const value = rawAnswers[String(index)] ?? rawAnswers[index] ?? '';
    const points = positiveExamScore(question.points, 1);
    if (question.type === 'mcq') {
      mcqCount += 1;
      autoMaxScore += points;
      const chosenIndex = Number(value);
      const chosen = Number.isInteger(chosenIndex) ? question.options[chosenIndex] || '' : '';
      const correct = mcqCorrect(question, chosenIndex);
      if (correct === true) { correctCount += 1; awardedScore += points; }
      if (correct === null) needsManualReview = true;
      staffAnswers.push({
        question: question.question,
        type: 'mcq',
        answer: text(chosen, 1000),
        answerIndex: Number.isInteger(chosenIndex) ? chosenIndex : null,
        correct,
        points,
        awardedScore: correct === true ? points : 0,
        correctAnswer: examCorrectAnswer(question),
        options: question.options,
        optionLabels: question.optionLabels
      });
    } else {
      essayCount += 1;
      needsManualReview = true;
      staffAnswers.push({
        question: question.question,
        type: 'essay',
        answer: text(value, 4000),
        correct: null,
        points,
        awardedScore: null,
        correctAnswer: 'يصححها المدرس'
      });
    }
  });

  const scored = scoreSummary(questions, staffAnswers.map(answer => answer.awardedScore), needsManualReview);
  const maxScore = scored.maxScore;
  const autoScore = mcqCount ? Math.round(awardedScore * 100) / 100 : null;
  const autoPercentage = autoMaxScore ? Math.round((awardedScore / autoMaxScore) * 100) : null;
  const score = scored.score;
  const percentage = scored.percentage;
  const attemptRef = db.collection('exam_attempts').doc();
  const submittedAt = new Date().toISOString();
  const attempt = {
    id: attemptRef.id,
    examId: session.examId,
    examTitle: text(exam.title, 200),
    studentCode,
    studentName: text(session.studentName, 100),
    grade: text(session.grade, 80),
    group: text(session.group, 100),
    academicYear: text(session.academicYear, 20),
    term: text(session.term, 40),
    startedAt: session.startedAt && session.startedAt.toDate ? session.startedAt.toDate().toISOString() : submittedAt,
    submittedAt,
    score,
    autoScore,
    autoMaxScore,
    percentage,
    autoPercentage,
    maxScore,
    mcqCount,
    essayCount,
    questionCount: questions.length,
    correctCount,
    needsManualReview,
    status: needsManualReview ? 'pending_manual' : 'submitted',
    timedOut: Boolean(expiresAt && Date.now() >= expiresAt),
    autoSubmitted: autoSubmit,
    answers: staffAnswers,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  const summary = {
    id: attemptRef.id,
    examId: session.examId,
    examTitle: attempt.examTitle,
    submittedAt,
    score,
    autoScore,
    autoMaxScore,
    percentage,
    autoPercentage,
    maxScore,
    answers: staffAnswers,
    needsManualReview,
    status: attempt.status,
    academicYear: attempt.academicYear,
    term: attempt.term
  };
  const lockRef = db.collection('exam_locks').doc(cleanDocId(`${session.examId}_${studentCode}`));
  const studentAttemptsRef = db.collection('student_attempts').doc(cleanDocId(studentCode));
  const summaryRef = studentAttemptsRef.collection('attempts').doc(attemptRef.id);
  const committedResult = await db.runTransaction(async tx => {
    const latestSession = await tx.get(sessionRef);
    if (!latestSession.exists) throw new HttpsError('not-found', 'جلسة الامتحان غير موجودة.');
    const latestData = latestSession.data();
    if (latestData.status === 'submitted' && latestData.result) return latestData.result;
    if (session.allowRetake !== true) {
      const existingLock = await tx.get(lockRef);
      if (existingLock.exists) throw new HttpsError('already-exists', 'تم تسليم الامتحان بالفعل.');
    }
    tx.set(attemptRef, attempt);
    tx.set(summaryRef, summary);
    tx.set(studentAttemptsRef, { studentCode, lastAttempt:summary, count:FieldValue.increment(1), updatedAt:FieldValue.serverTimestamp() }, { merge: true });
    if (session.allowRetake !== true) tx.set(lockRef, { examId: session.examId, studentCode, attemptId: attemptRef.id, submittedAt: FieldValue.serverTimestamp() });
    tx.update(sessionRef, { status: 'submitted', result: summary, submittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), deleteAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    return summary;
  });
  return committedResult;
});

exports.prepareHomeworkUpload = onCall(CALLABLE_OPTIONS, async request => {
  const body = request.data || {};
  const studentCode = normalizeCode(body.studentCode);
  const assignmentId = text(body.assignmentId, 100);
  await rateLimitPublic('homework-prepare', studentCode, request, 5, 15, 60 * 60 * 1000);
  const found = await getStudentPortalByCode(studentCode);
  if (!assignmentId) throw new HttpsError('invalid-argument', 'اختر الواجب المطلوب تسليمه.');
  const assignmentSnap = await db.collection('assignments').doc(cleanDocId(assignmentId)).get();
  if (!assignmentSnap.exists || !learningTargetMatchesStudent(assignmentSnap.data(), found.data) || !assignmentSubmissionIsOpen(assignmentSnap.data(), Date.now(), cairoDateKey(new Date()))) {
    throw new HttpsError('failed-precondition', 'الواجب غير متاح للتسليم حاليًا.');
  }
  const fileName = text(body.fileName, 180).replace(/[\\/#?\[\]]/g, '-');
  const contentType = text(body.contentType, 100);
  const size = Number(body.size || 0);
  if (!fileName || !Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024) throw new HttpsError('invalid-argument', 'بيانات ملف الواجب غير صالحة.');
  if (!(['image/jpeg','image/png','image/webp','application/pdf'].includes(contentType))) throw new HttpsError('invalid-argument', 'مسموح بالصور وملفات PDF فقط.');
  const uploadId = crypto.randomBytes(18).toString('hex');
  const safeName = `${Date.now()}-${fileName}`.slice(0, 220);
  await db.collection('_homework_upload_tokens').doc(uploadId).set({
    studentCode,
    assignmentId,
    safeName,
    contentType,
    size,
    expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
    createdAt: FieldValue.serverTimestamp()
  });
  return { uploadId, safeName, path: `homework/${cleanDocId(studentCode)}/${uploadId}/${safeName}` };
});

exports.registerHomeworkSubmission = onCall(CALLABLE_OPTIONS, async request => {
  const body = request.data || {};
  const studentCode = normalizeCode(body.studentCode);
  await rateLimitPublic('homework-submit', studentCode, request, 5, 15, 60 * 60 * 1000);
  const found = await getStudentPortalByCode(studentCode);
  const assignmentId = text(body.assignmentId, 100);
  const uploadId = text(body.uploadId, 80);
  const tokenRef = db.collection('_homework_upload_tokens').doc(cleanDocId(uploadId));
  const tokenSnap = await tokenRef.get();
  if (!tokenSnap.exists) throw new HttpsError('permission-denied', 'انتهت صلاحية رفع الملف. ابدأ الرفع من جديد.');
  const token = tokenSnap.data() || {};
  const expiresAt = token.expiresAt?.toMillis?.() || 0;
  if (token.studentCode !== studentCode || text(token.assignmentId,100) !== assignmentId || expiresAt <= Date.now()) {
    await tokenRef.delete().catch(() => {});
    throw new HttpsError('permission-denied', 'انتهت صلاحية رفع الملف. ابدأ الرفع من جديد.');
  }
  const filePath = text(body.path || body.filePath, 500);
  const expectedPath = `homework/${cleanDocId(studentCode)}/${uploadId}/${token.safeName}`;
  if (filePath !== expectedPath) {
    throw new HttpsError('permission-denied', 'مسار ملف الواجب غير صالح.');
  }
  const bucket = admin.storage().bucket();
  let metadata;
  try{[metadata] = await bucket.file(filePath).getMetadata();}catch(error){throw new HttpsError('not-found', 'ملف الواجب لم يكتمل رفعه. حاول مرة أخرى.');}
  const size = Number(metadata.size || 0),contentType = text(metadata.contentType, 100);
  if (size !== Number(token.size) || contentType !== token.contentType) throw new HttpsError('permission-denied', 'بيانات الملف المرفوع لا تطابق طلب الرفع.');
  let downloadToken = text(metadata.metadata?.firebaseStorageDownloadTokens?.split(',')?.[0], 200);
  if (!downloadToken) {
    downloadToken = crypto.randomUUID();
    await bucket.file(filePath).setMetadata({ metadata: { ...(metadata.metadata || {}), firebaseStorageDownloadTokens: downloadToken } });
  }
  const fileUrl = downloadToken ? `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${encodeURIComponent(downloadToken)}` : '';
  if (!fileUrl) throw new HttpsError('internal', 'تعذر تجهيز رابط ملف الواجب. حاول مرة أخرى.');
  const ref = db.collection('homework_submissions').doc();
  let assignment={};
  if(assignmentId){
    const assignmentSnap=await db.collection('assignments').doc(cleanDocId(assignmentId)).get();
    if(!assignmentSnap.exists||!learningTargetMatchesStudent(assignmentSnap.data(),found.data)||!assignmentSubmissionIsOpen(assignmentSnap.data(),Date.now(),cairoDateKey(new Date())))throw new HttpsError('failed-precondition','الواجب غير متاح للتسليم حاليًا.');
    assignment=assignmentSnap.data()||{};
  }
  const batch = db.batch();
  const submittedAtIso = new Date().toISOString();
  const dueDate = text(assignment.dueDate, 20);
  const late = /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && cairoDateKey(new Date()) > dueDate;
  batch.set(ref, {
    id: ref.id,
    studentCode,
    studentName: text(found.data.studentName || found.data.name, 100),
    grade: text(found.data.grade, 80),
    group: text(found.data.group, 100),
    academicYear: text(found.data.academicYear, 20),
    term: text(found.data.term, 40),
    assignmentId,
    title: text(assignment.title || body.title || 'واجب', 200),
    fileName: text(body.fileName || token.safeName, 180),
    fileUrl,
    url: fileUrl,
    filePath,
    path: filePath,
    contentType,
    size,
    status: 'بانتظار مراجعة المدرس',
    submittedAt: submittedAtIso,
    dueDate,
    late,
    completed: false,
    approved: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  batch.delete(tokenRef);
  await batch.commit();
  return { id: ref.id, ok: true };
});

function publicHomeworkSubmission(item) {
  const submittedMillis = firestoreMillis(item.submittedAt || item.createdAt);
  return {
    id: text(item.id, 120),
    studentCode: text(item.studentCode, 40),
    studentName: text(item.studentName, 100),
    assignmentId: text(item.assignmentId, 100),
    fileName: text(item.fileName, 220),
    fileUrl: safePublicUrl(item.fileUrl || item.url),
    submittedAt: submittedMillis ? new Date(submittedMillis).toISOString() : text(item.submittedAt, 60),
    late: item.late === true,
    status: text(item.status, 100),
    score: item.score === null || item.score === undefined ? null : Number(item.score),
    maxScore: item.maxScore === null || item.maxScore === undefined ? null : Number(item.maxScore),
    teacherNote: text(item.teacherNote, 1500)
  };
}

exports.getAssignmentRoster = onCall(CALLABLE_OPTIONS, async request => {
  await requireStaff(request);
  const assignmentId = cleanDocId(text(request.data && request.data.assignmentId, 100));
  if (!assignmentId) throw new HttpsError('invalid-argument', 'معرّف الواجب غير صالح.');
  const assignmentSnap = await db.collection('assignments').doc(assignmentId).get();
  if (!assignmentSnap.exists) throw new HttpsError('not-found', 'الواجب غير موجود.');
  const assignment = { id: assignmentSnap.id, ...assignmentSnap.data() };
  const [studentSnap, submissionSnap] = await Promise.all([
    db.collection('students').where('active', '==', true).limit(2500).get(),
    db.collection('homework_submissions').where('assignmentId', '==', assignmentId).limit(2500).get()
  ]);
  const submissions = new Map();
  submissionSnap.docs.forEach(doc => {
    const item = { id: doc.id, ...doc.data() };
    const key = normalizeCode(item.studentCode);
    const previous = submissions.get(key);
    if (!previous || firestoreMillis(item.submittedAt || item.createdAt) >= firestoreMillis(previous.submittedAt || previous.createdAt)) submissions.set(key, item);
  });
  const dueDate = text(assignment.dueDate, 20);
  const students = studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(student => learningTargetMatchesStudent(assignment, student))
    .map(student => {
      const studentCode = normalizeCode(student.studentCode || student.id);
      const submission = submissions.get(studentCode);
      const publicSubmission = submission ? publicHomeworkSubmission(submission) : null;
      if (publicSubmission && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        const key = publicSubmission.submittedAt ? cairoDateKey(new Date(publicSubmission.submittedAt)) : '';
        publicSubmission.late = Boolean(key && key > dueDate);
      }
      return {
        studentCode,
        studentName: text(student.studentName || student.name, 100),
        grade: text(student.grade, 80),
        group: text(student.group, 100),
        submitted: Boolean(submission),
        late: publicSubmission?.late === true,
        overdue: !submission && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && cairoDateKey(new Date()) > dueDate,
        submission: publicSubmission
      };
    }).sort((a, b) => a.studentName.localeCompare(b.studentName, 'ar'));
  return {
    assignment: { id:assignment.id,title:text(assignment.title,200),grade:text(assignment.grade,80),group:text(assignment.group,100),dueDate },
    students,
    summary: { total:students.length, submitted:students.filter(item=>item.submitted).length, missing:students.filter(item=>!item.submitted).length, late:students.filter(item=>item.late).length, overdue:students.filter(item=>item.overdue).length }
  };
});

exports.gradeHomeworkSubmission = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request, ['admin', 'teacher']);
  const submissionId = cleanDocId(text(request.data && request.data.submissionId, 120));
  const score = Number(request.data && request.data.score);
  const maxScore = Number(request.data && request.data.maxScore);
  const teacherNote = text(request.data && request.data.teacherNote, 1500);
  if (!submissionId || !Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0 || score > maxScore) {
    throw new HttpsError('invalid-argument', 'راجع درجة الواجب والدرجة النهائية.');
  }
  const ref = db.collection('homework_submissions').doc(submissionId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'تسليم الواجب غير موجود.');
  await ref.set({
    score, maxScore, teacherNote, status:'تم التصحيح', completed:true, approved:true,
    gradedAt:FieldValue.serverTimestamp(), gradedBy:staff.uid, updatedAt:FieldValue.serverTimestamp()
  }, { merge:true });
  await markLeaderboardDirty('homework-graded');
  return { ok:true, submission:{ ...publicHomeworkSubmission({ id:snap.id, ...snap.data() }), score, maxScore, teacherNote, status:'تم التصحيح' } };
});

exports.reportClientError = onCall(CALLABLE_OPTIONS, async request => {
  const body = request.data || {};
  await rateLimitPublic('client-error', text(body.page, 120), request, 5, 15, 60 * 60 * 1000);
  await db.collection('client_errors').add({
    message: text(body.message, 1000),
    page: text(body.page, 500),
    userAgent: text(body.userAgent, 500),
    createdAt: FieldValue.serverTimestamp()
  });
  return { ok: true };
});


const BACKUP_COLLECTIONS = [
  'settings','users','students','student_portal','parent_portal','bookings','booking_status','reviews',
  'materials','questions','groups','assignments','lectures','exams','exam_attempts','exam_sessions','homework_submissions',
  'attendance','recitations','grades','payments','reports','activityLog','client_errors',
  'student_attempts','exam_locks','student_transfer_requests','student_push_tokens'
];

function encodeBackupValue(value) {
  if (value instanceof Timestamp) return { __mfType: 'timestamp', iso: value.toDate().toISOString() };
  if (value instanceof admin.firestore.GeoPoint) return { __mfType: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  if (Array.isArray(value)) return value.map(encodeBackupValue);
  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value)) output[key] = encodeBackupValue(item);
    return output;
  }
  return value;
}

function decodeBackupValue(value) {
  if (Array.isArray(value)) return value.map(decodeBackupValue);
  if (value && typeof value === 'object') {
    if (value.__mfType === 'timestamp' && value.iso) return Timestamp.fromDate(new Date(value.iso));
    if (value.__mfType === 'geopoint') return new admin.firestore.GeoPoint(Number(value.latitude), Number(value.longitude));
    const output = {};
    for (const [key, item] of Object.entries(value)) output[key] = decodeBackupValue(item);
    return output;
  }
  return value;
}

async function exportCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  const rows = [];
  for (const doc of snap.docs) {
    const row = { id: doc.id, data: encodeBackupValue(doc.data()) };
    if (collectionName === 'student_attempts') {
      const attempts = await doc.ref.collection('attempts').get();
      row.attempts = attempts.docs.map(attempt => ({ id: attempt.id, data: encodeBackupValue(attempt.data()) }));
    }
    if (collectionName === 'exams') {
      const versions = await doc.ref.collection('versions').get();
      row.versions = versions.docs.map(version => ({ id: version.id, data: encodeBackupValue(version.data()) }));
    }
    rows.push(row);
  }
  return rows;
}

async function createPlatformBackup(reason, actor = {}) {
  const collections = {};
  for (const name of BACKUP_COLLECTIONS) collections[name] = await exportCollection(name);
  const payload = {
    schemaVersion: 54,
    backupFormatVersion: 2,
    project: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'mahmoud-fawzy-science-platform',
    reason: text(reason, 100),
    createdAt: new Date().toISOString(),
    actor: { uid: text(actor.uid, 120), email: text(actor.email, 200), role: text(actor.role, 40) },
    collections
  };
  const buffer = zlib.gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'), { level: 9 });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `automatic-backups/${stamp}-${text(reason || 'scheduled', 40).replace(/[^a-zA-Z0-9_-]/g, '-')}.json.gz`;
  const bucket = admin.storage().bucket();
  await bucket.file(name).save(buffer, { resumable: false, contentType: 'application/gzip', metadata: { cacheControl: 'private, max-age=0', metadata: { schemaVersion: '54', reason: text(reason, 100) } } });
  await db.collection('backup_runs').add({ name, reason: text(reason, 100), size: buffer.length, createdAt: FieldValue.serverTimestamp(), actorUid: text(actor.uid, 120) });
  return { name, size: buffer.length, createdAt: payload.createdAt };
}

async function pruneBackups(retentionDays = 14) {
  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({ prefix: 'automatic-backups/' });
  const cutoff = Date.now() - Math.max(3, Math.min(90, Number(retentionDays) || 14)) * 24 * 60 * 60 * 1000;
  await Promise.all(files.filter(file => new Date(file.metadata.timeCreated || 0).getTime() < cutoff).map(file => file.delete().catch(() => null)));
}

exports.scheduledPlatformBackup = onSchedule({ schedule: '30 2 * * *', timeZone: 'Africa/Cairo', region: 'europe-west1', timeoutSeconds: 540, memory: '512MiB' }, async () => {
  const settings = await db.collection('settings').doc('platform').get().catch(() => null);
  const retentionDays = settings?.exists ? Number(settings.data().backupRetentionDays || 14) : 14;
  await createPlatformBackup('scheduled');
  await pruneBackups(retentionDays);
});

exports.createBackupNow = onCall({ region: 'europe-west1', timeoutSeconds: 540, memory: '512MiB' }, async request => {
  const staff = await requireStaff(request, ['admin', 'teacher']);
  const result = await createPlatformBackup('manual', staff);
  await pruneBackups(14);
  return result;
});

exports.listAutomaticBackups = onCall(CALLABLE_OPTIONS, async request => {
  await requireStaff(request, ['admin', 'teacher']);
  const [files] = await admin.storage().bucket().getFiles({ prefix: 'automatic-backups/' });
  const backups = files.map(file => ({ name: file.name, size: Number(file.metadata.size || 0), createdAt: file.metadata.timeCreated || '' }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 50);
  return { backups };
});

exports.getBackupDownloadUrl = onCall(CALLABLE_OPTIONS, async request => {
  await requireStaff(request, ['admin', 'teacher']);
  const name = text(request.data && request.data.name, 500);
  if (!name.startsWith('automatic-backups/')) throw new HttpsError('invalid-argument', 'مسار النسخة غير صالح.');
  const [url] = await admin.storage().bucket().file(name).getSignedUrl({ action: 'read', expires: Date.now() + 10 * 60 * 1000, version: 'v4' });
  return { url };
});


async function deleteRootCollection(collectionName) {
  while (true) {
    const snap = await db.collection(collectionName).limit(350).get();
    if (snap.empty) return;
    const refs = [];
    for (const doc of snap.docs) {
      if (collectionName === 'student_attempts') {
        const attempts = await doc.ref.collection('attempts').get().catch(() => null);
        if (attempts) refs.push(...attempts.docs.map(item => item.ref));
      }
      if (collectionName === 'exams') {
        const versions = await doc.ref.collection('versions').get().catch(() => null);
        if (versions) refs.push(...versions.docs.map(item => item.ref));
      }
      refs.push(doc.ref);
    }
    await commitDeleteRefs(refs);
    if (snap.size < 350) return;
  }
}

async function restoreCollection(collectionName, rows) {
  await deleteRootCollection(collectionName);
  const operations = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || !row.id || !row.data) continue;
    const ref = db.collection(collectionName).doc(cleanDocId(row.id));
    operations.push(batch => batch.set(ref, decodeBackupValue(row.data)));
    if (collectionName === 'student_attempts' || collectionName === 'exams') {
      const children = collectionName === 'student_attempts' ? row.attempts : row.versions;
      const subcollection = collectionName === 'student_attempts' ? 'attempts' : 'versions';
      for (const attempt of Array.isArray(children) ? children : []) {
        if (!attempt || !attempt.id || !attempt.data) continue;
        operations.push(batch => batch.set(ref.collection(subcollection).doc(cleanDocId(attempt.id)), decodeBackupValue(attempt.data)));
      }
    }
  }
  const queue = operations.slice();
  while (queue.length) {
    const batch = db.batch();
    queue.splice(0, 350).forEach(operation => operation(batch));
    await batch.commit();
  }
}

exports.restoreAutomaticBackup = onCall({ region: 'europe-west1', timeoutSeconds: 540, memory: '1GiB' }, async request => {
  const staff = await requireStaff(request, ['admin', 'teacher']);
  const name = text(request.data && request.data.name, 500);
  const confirmation = text(request.data && request.data.confirmation, 50);
  if (!name.startsWith('automatic-backups/') || !name.endsWith('.json.gz')) {
    throw new HttpsError('invalid-argument', 'مسار النسخة غير صالح.');
  }
  if (!['RESTORE-V53', 'RESTORE-V54'].includes(confirmation)) throw new HttpsError('failed-precondition', 'تأكيد الاستعادة غير صحيح.');

  const file = admin.storage().bucket().file(name);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError('not-found', 'النسخة الاحتياطية غير موجودة.');
  const [compressed] = await file.download();
  let payload;
  try { payload = JSON.parse(zlib.gunzipSync(compressed).toString('utf8')); }
  catch (_) { throw new HttpsError('data-loss', 'تعذر قراءة النسخة الاحتياطية.'); }
  if (!payload || ![53,54].includes(payload.schemaVersion) || payload.backupFormatVersion !== 2 || !payload.collections) {
    throw new HttpsError('failed-precondition', 'هذه النسخة ليست بصيغة الاستعادة الآمنة للإصدار 53.');
  }

  const safetyBackup = await createPlatformBackup('pre-restore', staff);
  for (const collectionName of BACKUP_COLLECTIONS) {
    await restoreCollection(collectionName, payload.collections[collectionName] || []);
  }
  await db.collection('activityLog').add({
    action: 'تمت استعادة نسخة احتياطية سحابية',
    meta: { restoredFrom: name, safetyBackup: safetyBackup.name },
    actorUid: staff.uid, actorEmail: staff.email || '', actorRole: staff.role || '', createdAt: FieldValue.serverTimestamp()
  });
  return { ok: true, restoredFrom: name, safetyBackup: safetyBackup.name };
});

async function queryStudentDocuments(collection, studentCode) {
  const snap = await db.collection(collection).where('studentCode', '==', studentCode).get().catch(() => null);
  return snap ? snap.docs : [];
}

async function commitDeleteRefs(refs) {
  const queue = refs.slice();
  while (queue.length) {
    const batch = db.batch();
    queue.splice(0, 400).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

exports.getPlatformHealth = onCall(CALLABLE_OPTIONS, async request => {
  await requireStaff(request, ['admin', 'teacher']);
  const started = Date.now();
  let database = { ok:false, message:'تعذر الاتصال' };
  let storage = { ok:false, message:'تعذر الاتصال' };
  try {
    await db.collection('settings').doc('platform').get();
    database = { ok:true, message:'قاعدة البيانات متصلة' };
  } catch (error) { database.message = text(error.message, 180); }
  try {
    const [metadata] = await admin.storage().bucket().getMetadata();
    storage = { ok:true, message:`الحاوية ${text(metadata.name, 120)} متاحة` };
  } catch (error) { storage.message = text(error.message, 180); }
  const [tokens, errors, backups] = await Promise.all([
    db.collection('student_push_tokens').where('active','==',true).limit(1000).get().catch(()=>null),
    db.collection('client_errors').orderBy('createdAt','desc').limit(10).get().catch(()=>null),
    db.collection('backup_runs').orderBy('createdAt','desc').limit(1).get().catch(()=>null)
  ]);
  const recentErrors = errors ? errors.docs.map(doc=>({ id:doc.id,message:text(doc.data().message,500),page:text(doc.data().page,500),createdAt:firestoreMillis(doc.data().createdAt)?new Date(firestoreMillis(doc.data().createdAt)).toISOString():'' })) : [];
  const latestBackup = backups && backups.docs[0] ? backups.docs[0].data() : null;
  return {
    release:'59.6.2', serverNow:new Date().toISOString(), latencyMs:Date.now()-started,
    services:{ functions:{ok:true,message:'Cloud Functions تعمل'}, database, storage, notifications:{ok:Boolean(tokens),message:tokens?`${tokens.size} جهاز طالب مسجل`:'تعذر فحص الإشعارات'} },
    latestBackup:latestBackup?{name:text(latestBackup.name,500),createdAt:firestoreMillis(latestBackup.createdAt)?new Date(firestoreMillis(latestBackup.createdAt)).toISOString():''}:null,
    recentErrors
  };
});

function storagePathFromDownloadUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (!/firebasestorage\.googleapis\.com$/i.test(url.hostname)) return '';
    const marker = '/o/';
    const index = url.pathname.indexOf(marker);
    return index >= 0 ? decodeURIComponent(url.pathname.slice(index + marker.length)) : '';
  } catch (_) { return ''; }
}

async function collectPrimarySchoolData() {
  const gradeCollections = ['students','student_portal','parent_portal','bookings','booking_status','groups','materials','questions','assignments','lectures','exams','reports','_booking_requests'];
  const archive = {};
  const refs = [];
  const studentCodes = new Set();
  const parentCodes = new Set();
  const filePaths = new Set();
  const primaryExamRefs = [];
  for (const name of gradeCollections) {
    const snap = await db.collection(name).get();
    const rows = snap.docs.filter(doc => primaryGrade(doc.data().grade || doc.data().response?.grade));
    archive[name] = rows.map(doc => ({ id:doc.id,data:encodeBackupValue(doc.data()) }));
    rows.forEach(doc => {
      refs.push(doc.ref);
      const data = doc.data();
      [data.filePath, data.path, data.pdfPath, storagePathFromDownloadUrl(data.fileUrl), storagePathFromDownloadUrl(data.pdfUrl)].map(value=>text(value,500)).filter(Boolean).forEach(value=>filePaths.add(value));
      if (name === 'students' || name === 'student_portal' || name === 'parent_portal' || name === 'bookings') {
        const code = normalizeCode(data.studentCode || data.code || data.response?.studentCode || data.response?.code || (name !== 'parent_portal' ? doc.id : ''));
        if (code) studentCodes.add(code);
        if (data.parentCode || name === 'parent_portal') parentCodes.add(normalizeCode(data.parentCode || doc.id));
      }
      if (name === 'exams') primaryExamRefs.push(doc.ref);
    });
  }
  const relatedCollections = ['attendance','grades','recitations','homework_submissions','exam_attempts','exam_sessions','exam_locks','student_transfer_requests','payments','student_push_tokens','_homework_upload_tokens'];
  for (const name of relatedCollections) {
    const snap = await db.collection(name).get();
    const rows = snap.docs.filter(doc => studentCodes.has(normalizeCode(doc.data().studentCode || doc.data().studentId || doc.id)) || primaryGrade(doc.data().grade));
    archive[name] = rows.map(doc => ({ id:doc.id,data:encodeBackupValue(doc.data()) }));
    rows.forEach(doc => {
      refs.push(doc.ref);
      const data=doc.data();
      [data.filePath, data.path, data.pdfPath, storagePathFromDownloadUrl(data.fileUrl), storagePathFromDownloadUrl(data.pdfUrl)].map(value=>text(value,500)).filter(Boolean).forEach(value=>filePaths.add(value));
    });
  }
  archive.student_attempts = [];
  for (const code of studentCodes) {
    const parent = db.collection('student_attempts').doc(cleanDocId(code));
    const [summary, attempts] = await Promise.all([parent.get(), parent.collection('attempts').get()]);
    if (summary.exists || !attempts.empty) archive.student_attempts.push({ id:parent.id,data:summary.exists?encodeBackupValue(summary.data()):{},attempts:attempts.docs.map(doc=>({id:doc.id,data:encodeBackupValue(doc.data())})) });
    attempts.docs.forEach(doc=>refs.push(doc.ref));
    if (summary.exists) refs.push(parent);
  }
  archive.exam_versions = [];
  for (const examRef of primaryExamRefs) {
    const versions = await examRef.collection('versions').get();
    versions.docs.forEach(doc=>refs.push(doc.ref));
    archive.exam_versions.push({ examId:examRef.id,versions:versions.docs.map(doc=>({id:doc.id,data:encodeBackupValue(doc.data())})) });
  }
  const claimSnap = await db.collection('_student_name_claims').get();
  const claims = claimSnap.docs.filter(doc=>studentCodes.has(normalizeCode(doc.data().studentCode)));
  archive._student_name_claims = claims.map(doc=>({id:doc.id,data:encodeBackupValue(doc.data())}));
  claims.forEach(doc=>refs.push(doc.ref));
  parentCodes.forEach(code=>{ if(code) refs.push(db.collection('parent_portal').doc(cleanDocId(code))); });
  studentCodes.forEach(code=>{
    refs.push(db.collection('student_portal').doc(cleanDocId(code)), db.collection('students').doc(cleanDocId(code)), db.collection('payments').doc(cleanDocId(code)));
  });
  return { archive, refs:[...new Map(refs.map(ref=>[ref.path,ref])).values()], studentCodes:[...studentCodes], filePaths:[...filePaths] };
}

exports.archiveAndDeletePrimaryData = onCall({ region:'europe-west1', timeoutSeconds:540, memory:'1GiB', invoker:'public' }, async request => {
  const staff = await requireStaff(request, ['admin', 'teacher']);
  if (text(request.data && request.data.confirmation, 60) !== 'DELETE-PRIMARY-DATA') throw new HttpsError('failed-precondition', 'تأكيد حذف بيانات الابتدائي غير صحيح.');
  const safetyBackup = await createPlatformBackup('pre-primary-purge', staff);
  const collected = await collectPrimarySchoolData();
  const payload = { schemaVersion:59,createdAt:new Date().toISOString(),reason:'primary-school-purge',actor:{uid:staff.uid,email:staff.email||'',role:staff.role||''},files:collected.filePaths,collections:collected.archive };
  const archiveName = `primary-school-archives/${new Date().toISOString().replace(/[:.]/g,'-')}-primary-data.json.gz`;
  await admin.storage().bucket().file(archiveName).save(zlib.gzipSync(Buffer.from(JSON.stringify(payload),'utf8'),{level:9}),{resumable:false,contentType:'application/gzip',metadata:{cacheControl:'private, max-age=0'}});
  const bucket = admin.storage().bucket();
  const archivePrefix = archiveName.replace(/\.json\.gz$/, '-files');
  for (const filePath of collected.filePaths) {
    const file = bucket.file(filePath);
    const [exists] = await file.exists().catch(()=>[false]);
    if (exists) await file.copy(bucket.file(`${archivePrefix}/${hash(filePath).slice(0,16)}-${filePath.split('/').pop()}`));
  }
  await commitDeleteRefs(collected.refs);
  let filesDeleted = 0;
  for (const filePath of collected.filePaths) await bucket.file(filePath).delete().then(()=>{filesDeleted+=1;}).catch(()=>null);
  for (const code of collected.studentCodes) {
    const [files] = await bucket.getFiles({prefix:`homework/${cleanDocId(code)}/`}).catch(()=>[[]]);
    await Promise.all(files.map(file=>file.delete().then(()=>{filesDeleted+=1;}).catch(()=>null)));
  }
  await db.collection('activityLog').add({ action:'أرشفة وحذف بيانات المرحلة الابتدائية',meta:{archiveName,safetyBackup:safetyBackup.name,documentsDeleted:collected.refs.length,filesDeleted},actorUid:staff.uid,actorEmail:staff.email||'',actorRole:staff.role||'',createdAt:FieldValue.serverTimestamp() });
  await markLeaderboardDirty('primary-data-purged');
  return { ok:true,archiveName,safetyBackup:safetyBackup.name,documentsDeleted:collected.refs.length,filesDeleted,studentCount:collected.studentCodes.length };
});

exports.deleteStudentSafely = onCall({ region: 'europe-west1', timeoutSeconds: 120, memory: '512MiB' }, async request => {
  const staff = await requireStaff(request, ['admin', 'teacher']);
  const studentCode = normalizeCode(request.data && request.data.studentCode);
  if (!validLegacyOrStrongCode(studentCode)) throw new HttpsError('invalid-argument', 'كود الطالب غير صالح.');
  const studentRef = db.collection('students').doc(cleanDocId(studentCode));
  const studentSnap = await studentRef.get();
  if (!studentSnap.exists) throw new HttpsError('not-found', 'الطالب غير موجود.');
  const student = studentSnap.data();
  const { nameKey } = studentNameIdentity(student.studentName || student.name);
  const relatedCollections = ['attendance','grades','recitations','homework_submissions','exam_attempts','student_transfer_requests'];
  const relatedEntries = {};
  const relatedDocs = [];
  for (const collection of relatedCollections) {
    const docs = await queryStudentDocuments(collection, studentCode);
    relatedEntries[collection] = docs.map(doc => ({ id: doc.id, data: doc.data() }));
    relatedDocs.push(...docs.map(doc => doc.ref));
  }
  const attemptsParent = db.collection('student_attempts').doc(cleanDocId(studentCode));
  const attemptsChildren = await attemptsParent.collection('attempts').get().catch(() => null);
  const deletionSnapshot = {
    schemaVersion: 54,
    deletedAt: new Date().toISOString(),
    deletedBy: { uid: staff.uid, email: staff.email || '', role: staff.role || '' },
    student: { id: studentSnap.id, data: student },
    related: relatedEntries,
    studentAttempts: attemptsChildren ? attemptsChildren.docs.map(doc => ({ id: doc.id, data: doc.data() })) : []
  };
  const archiveName = `deleted-students/${cleanDocId(studentCode)}/${new Date().toISOString().replace(/[:.]/g, '-')}.json.gz`;
  await admin.storage().bucket().file(archiveName).save(zlib.gzipSync(Buffer.from(JSON.stringify(deletionSnapshot), 'utf8')), { resumable: false, contentType: 'application/gzip' });
  const refs = [studentRef, db.collection('student_portal').doc(cleanDocId(studentCode)), db.collection('payments').doc(cleanDocId(studentCode)), attemptsParent, ...relatedDocs];
  if (nameKey) refs.push(db.collection('_student_name_claims').doc(nameKey));
  if (student.parentCode) refs.push(db.collection('parent_portal').doc(cleanDocId(student.parentCode)));
  if (attemptsChildren) refs.push(...attemptsChildren.docs.map(doc => doc.ref));
  await commitDeleteRefs(refs);
  await db.collection('activityLog').add({ action: 'تم حذف طالب مع نسخة استرجاع', meta: { studentCode, archiveName }, actorUid: staff.uid, actorEmail: staff.email || '', actorRole: staff.role || '', createdAt: FieldValue.serverTimestamp() });
  await markLeaderboardDirty('student-deleted');
  return { ok: true, archiveName };
});
