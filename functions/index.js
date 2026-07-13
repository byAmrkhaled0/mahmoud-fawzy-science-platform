'use strict';

const crypto = require('crypto');
const zlib = require('zlib');
const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2/options');

admin.initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 10, memory: '256MiB' });

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;
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

function publicExamSession(sessionId, exam, questions, startedAtMs, expiresAtMs) {
  return {
    sessionId,
    exam: {
      id: text(exam.id, 100),
      title: text(exam.title, 200),
      instructions: text(exam.instructions, 1500),
      duration: Math.max(1, Math.min(240, Number(exam.duration || 20))),
      pdfUrl: safePublicUrl(exam.pdfUrl || exam.examPdfUrl),
      pdfName: text(exam.pdfName || exam.examPdfName, 220)
    },
    startedAt: new Date(startedAtMs).toISOString(),
    expiresAt: expiresAtMs,
    questions: questions.map(q => ({
      type: q.type,
      question: q.question,
      options: q.options,
      optionLabels: q.optionLabels
    }))
  };
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
    const answer = answerLine ? cleanAnswerLine(answerLine) : '';
    const options = [];
    const questionLines = [];
    for (const line of lines) {
      if (line === answerLine) continue;
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
        answer: text(answer, 700)
      };
    }
    return { type: 'essay', question, options: [], optionLabels: [], answer: '' };
  }).filter(q => q.question);
}

function normalizeAnswer(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[\)\.\-:：]/g, '').replace(/إ/g, 'أ').replace(/هـ/g, 'ه');
}

function mcqCorrect(question, chosenIndex) {
  const index = Number(chosenIndex);
  if (!Number.isInteger(index) || index < 0 || index >= question.options.length) return false;
  const chosen = question.options[index] || '';
  const label = question.optionLabels[index] || String(index + 1);
  const correct = String(question.answer || '').trim();
  if (!correct) return null;
  const answerToken = (correct.match(/^([A-Da-dأإابجدهـه]|[1-4])/) || [])[1] || '';
  const normalized = normalizeAnswer(correct);
  return normalized === normalizeAnswer(label)
    || normalized === normalizeAnswer(chosen)
    || normalized === String(index + 1)
    || (answerToken && normalizeAnswer(answerToken) === normalizeAnswer(label));
}

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
    paid: data.paid === true,
    paymentDate: text(data.paymentDate, 40),
    notes: text(data.notes, 1500),
    attendance: Array.isArray(records.attendance) ? records.attendance.slice(-120) : (Array.isArray(data.attendance) ? data.attendance.slice(-120) : []),
    grades: Array.isArray(records.grades) ? records.grades.slice(-120) : (Array.isArray(data.grades) ? data.grades.slice(-120) : []),
    homeworks: Array.isArray(records.homeworks) ? records.homeworks.slice(-120) : (Array.isArray(data.homeworks) ? data.homeworks.slice(-120) : []),
    recitations: Array.isArray(records.recitations) ? records.recitations.slice(-120) : (Array.isArray(data.recitations) ? data.recitations.slice(-120) : []),
    examAttempts: Array.isArray(attempts) ? attempts.slice(-120) : []
  };
}

async function getStudentPortalByCode(code) {
  const normalized = normalizeCode(code);
  if (!validLegacyOrStrongCode(normalized)) throw new HttpsError('invalid-argument', 'كود غير صالح.');
  const snap = await db.collection('student_portal').doc(cleanDocId(normalized)).get();
  if (!snap.exists || snap.data().active === false) throw new HttpsError('not-found', 'لم يتم العثور على الطالب.');
  return { code: normalized, data: snap.data() };
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
    needsManualReview: a.needsManualReview === true,
    status: text(a.status, 40)
  }));
}

async function studentRecords(studentCode) {
  const normalized = normalizeCode(studentCode);
  const load = async collection => {
    const snap = await db.collection(collection).where('studentCode', '==', normalized).get().catch(() => null);
    return snap ? snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) : [];
  };
  const [attendance, grades, homeworks, recitations] = await Promise.all([
    load('attendance'), load('grades'), load('homework_submissions'), load('recitations')
  ]);
  const byDate = rows => rows.sort((a, b) => String(a.date || a.submittedAt || a.createdAt || '').localeCompare(String(b.date || b.submittedAt || b.createdAt || '')));
  return { attendance: byDate(attendance), grades: byDate(grades), homeworks: byDate(homeworks), recitations: byDate(recitations) };
}

exports.getPortalStudent = onCall(CALLABLE_OPTIONS, async request => {
  const code = normalizeCode(request.data && request.data.code);
  const mode = request.data && request.data.mode === 'parent' ? 'parent' : 'student';
  await rateLimitPublic(`portal-${mode}`, code, request, 8, 35, 60 * 1000);
  const found = mode === 'parent' ? await getParentPortalByCode(code) : await getStudentPortalByCode(code);
  const studentCode = found.data.studentCode || found.data.code;
  const [attempts, records] = await Promise.all([attemptSummaries(studentCode), studentRecords(studentCode)]);
  return portalResponse(found.data, attempts, records);
});

exports.createStudentAccess = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  const body = request.data || {};
  const name = text(body.studentName || body.name, 100);
  const parentPhone = digits(body.parentPhone);
  if (name.length < 3) throw new HttpsError('invalid-argument', 'اكتب اسم الطالب كاملًا.');
  if (digits(parentPhone).length < 10) throw new HttpsError('invalid-argument', 'اكتب رقم ولي أمر صحيحًا.');

  for (let attemptNo = 0; attemptNo < 8; attemptNo += 1) {
    const studentCode = randomCode('ST', 8);
    const parentCode = randomCode('PR', 8);
    const studentRef = db.collection('students').doc(cleanDocId(studentCode));
    const studentPortalRef = db.collection('student_portal').doc(cleanDocId(studentCode));
    const parentPortalRef = db.collection('parent_portal').doc(cleanDocId(parentCode));
    const paymentRef = db.collection('payments').doc(cleanDocId(studentCode));
    const [studentExists, parentExists] = await Promise.all([studentPortalRef.get(), parentPortalRef.get()]);
    if (studentExists.exists || parentExists.exists) continue;

    const student = {
      studentCode,
      code: studentCode,
      parentCode,
      studentName: name,
      name,
      studentPhone: digits(body.studentPhone),
      parentPhone,
      grade: text(body.grade, 80),
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
    try {
      await batch.commit();
      return { ...portal, studentCode, code: studentCode, parentCode, active: student.active };
    } catch (error) {
      if (attemptNo === 7) throw new HttpsError('aborted', 'تعذر إنشاء أكواد فريدة، حاول مرة أخرى.');
    }
  }
  throw new HttpsError('resource-exhausted', 'تعذر إنشاء أكواد فريدة، حاول مرة أخرى.');
});

exports.createBooking = onCall(CALLABLE_OPTIONS, async request => {
  const body = request.data || {};
  const identity = `${digits(body.parentPhone)}:${request.rawRequest.ip || ''}`;
  await rateLimitPublic('booking-v2', identity, request, 12, 60, 10 * 60 * 1000);
  const name = text(body.name, 80);
  const studentPhone = digits(body.studentPhone);
  const parentPhone = digits(body.parentPhone);
  if (name.length < 3) throw new HttpsError('invalid-argument', 'اكتب اسم الطالب كاملًا.');
  if (studentPhone.length < 10 || parentPhone.length < 10) throw new HttpsError('invalid-argument', 'اكتب أرقام هاتف صحيحة.');
  const requestedGrade = text(body.grade, 80);
  const requestedGroup = text(body.group, 100);
  let selectedScheduleId = cleanDocId(text(body.scheduleId, 100));
  let scheduleSnap = selectedScheduleId ? await db.collection('groups').doc(selectedScheduleId).get() : null;

  // Resolve a current Firestore group when the browser retained an older local id.
  // The exact name, active flag and grade are still validated before booking.
  if ((!scheduleSnap || !scheduleSnap.exists) && requestedGroup) {
    const candidates = await db.collection('groups').where('name', '==', requestedGroup).limit(20).get();
    const matching = candidates.docs.find(doc => {
      const item = doc.data() || {};
      return item.active !== false && (!item.grade || item.grade === 'كل الصفوف' || item.grade === requestedGrade);
    });
    if (matching) {
      scheduleSnap = matching;
      selectedScheduleId = matching.id;
    }
  }
  if (!scheduleSnap || !scheduleSnap.exists || scheduleSnap.data().active === false) {
    throw new HttpsError('failed-precondition', 'هذا الموعد لم يعد متاحًا. حدّث الصفحة واختر موعدًا آخر.');
  }
  const schedule = scheduleSnap.data();
  if (schedule.grade && schedule.grade !== 'كل الصفوف' && schedule.grade !== requestedGrade) throw new HttpsError('failed-precondition', 'الموعد المختار غير متاح لهذا الصف.');
  const code = await uniqueCode('bookings', 'BK');
  const payload = {
    id: code,
    code,
    name,
    studentName: name,
    studentPhone,
    parentPhone,
    grade: requestedGrade,
    month: text(body.month, 40),
    group: text(schedule.name, 100),
    scheduleId: selectedScheduleId,
    scheduleDays: text(schedule.days, 100),
    scheduleStartTime: text(schedule.startTime, 20),
    scheduleEndTime: text(schedule.endTime, 20),
    academicYear: text(body.academicYear, 20),
    term: text(body.term, 40),
    notes: text(body.notes, 1000),
    status: 'بانتظار الموافقة',
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
    studentCode: '',
    parentCode: '',
    updatedAt: FieldValue.serverTimestamp()
  };
  const batch = db.batch();
  batch.set(db.collection('bookings').doc(cleanDocId(code)), payload);
  batch.set(db.collection('booking_status').doc(cleanDocId(code)), statusPayload);
  await batch.commit();
  return { code, status: payload.status };
});

exports.approveBooking = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  const bookingCode = normalizeCode(request.data && request.data.code);
  if (!validLegacyOrStrongCode(bookingCode)) throw new HttpsError('invalid-argument', 'كود الحجز غير صالح.');

  const bookingRef = db.collection('bookings').doc(cleanDocId(bookingCode));
  const statusRef = db.collection('booking_status').doc(cleanDocId(bookingCode));

  for (let attemptNo = 0; attemptNo < 8; attemptNo += 1) {
    const studentCode = randomCode('ST', 8);
    const parentCode = randomCode('PR', 8);
    const studentRef = db.collection('students').doc(cleanDocId(studentCode));
    const studentPortalRef = db.collection('student_portal').doc(cleanDocId(studentCode));
    const parentPortalRef = db.collection('parent_portal').doc(cleanDocId(parentCode));
    const paymentRef = db.collection('payments').doc(cleanDocId(studentCode));

    try {
      const result = await db.runTransaction(async tx => {
        const [bookingSnap, statusSnap, studentExists, parentExists] = await Promise.all([
          tx.get(bookingRef), tx.get(statusRef), tx.get(studentPortalRef), tx.get(parentPortalRef)
        ]);
        const existingStatus = statusSnap.exists ? statusSnap.data() : {};
        if (existingStatus.studentCode) {
          return {
            alreadyApproved: true,
            bookingCode,
            studentCode: text(existingStatus.studentCode, 40),
            code: text(existingStatus.studentCode, 40),
            parentCode: text(existingStatus.parentCode, 40),
            name: text(existingStatus.name || existingStatus.studentName, 100),
            studentName: text(existingStatus.name || existingStatus.studentName, 100),
            grade: text(existingStatus.grade, 80),
            group: text(existingStatus.group, 100),
            month: text(existingStatus.month, 40),
            academicYear: text(existingStatus.academicYear, 20),
            term: text(existingStatus.term, 40),
            active: true,
            paid: false
          };
        }
        if (!bookingSnap.exists) throw new HttpsError('not-found', 'الحجز غير موجود أو تم قبوله من قبل.');
        if (studentExists.exists || parentExists.exists) throw new HttpsError('aborted', 'code-collision');

        const booking = bookingSnap.data() || {};
        const name = text(booking.studentName || booking.name, 100);
        const student = {
          studentCode,
          code: studentCode,
          parentCode,
          bookingCode,
          studentName: name,
          name,
          studentPhone: digits(booking.studentPhone),
          parentPhone: digits(booking.parentPhone),
          grade: text(booking.grade, 80),
          month: text(booking.month, 40),
          group: text(booking.group, 100),
          academicYear: text(booking.academicYear, 20),
          term: text(booking.term, 40),
          notes: text(booking.notes, 1500),
          paid: false,
          paymentDate: '',
          active: true,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        };
        const portal = portalResponse(student, []);
        const acceptedStatus = {
          code: bookingCode,
          name,
          studentName: name,
          grade: student.grade,
          month: student.month,
          group: student.group,
          scheduleId: text(booking.scheduleId, 100),
          scheduleDays: text(booking.scheduleDays, 100),
          scheduleStartTime: text(booking.scheduleStartTime, 20),
          scheduleEndTime: text(booking.scheduleEndTime, 20),
          academicYear: student.academicYear,
          term: student.term,
          status: 'تم القبول والتسجيل كطالب',
          studentCode,
          parentCode,
          acceptedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        };

        tx.set(studentRef, student);
        tx.set(studentPortalRef, { ...portal, studentCode, parentCode, active: true, updatedAt: FieldValue.serverTimestamp() });
        tx.set(parentPortalRef, { ...portal, studentCode, parentCode, active: true, updatedAt: FieldValue.serverTimestamp() });
        tx.set(paymentRef, { studentCode, studentName: name, grade: student.grade, group: student.group, academicYear: student.academicYear, term: student.term, paid: false, paymentDate: '', updatedAt: FieldValue.serverTimestamp() });
        tx.set(statusRef, acceptedStatus, { merge: true });
        tx.delete(bookingRef);
        tx.set(db.collection('activityLog').doc(), { action: 'تم قبول الحجز وتسجيل الطالب', meta: { bookingCode, studentCode }, actorUid: staff.uid, actorEmail: staff.email || '', actorRole: staff.role || '', createdAt: FieldValue.serverTimestamp() });

        return {
          bookingCode,
          studentCode,
          code: studentCode,
          parentCode,
          name,
          studentName: name,
          studentPhone: student.studentPhone,
          parentPhone: student.parentPhone,
          grade: student.grade,
          month: student.month,
          group: student.group,
          academicYear: student.academicYear,
          term: student.term,
          notes: student.notes,
          active: true,
          paid: false
        };
      });
      return result;
    } catch (error) {
      if (String(error?.message || '').includes('code-collision') && attemptNo < 7) continue;
      throw error;
    }
  }
  throw new HttpsError('resource-exhausted', 'تعذر إنشاء أكواد فريدة، حاول مرة أخرى.');
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
    status: text(data.status, 100),
    studentCode: text(data.studentCode, 40),
    parentCode: text(data.parentCode, 40)
  };
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

function examMatchesStudent(exam, student) {
  const gradeOk = !exam.grade || exam.grade === 'كل الصفوف' || exam.grade === student.grade;
  const groupOk = !exam.group || exam.group === 'كل المجموعات' || exam.group === student.group;
  const yearOk = !exam.academicYear || !student.academicYear || exam.academicYear === student.academicYear;
  const termOk = !exam.term || !student.term || exam.term === student.term;
  return gradeOk && groupOk && yearOk && termOk;
}

function examIsOpen(exam, now = Date.now()) {
  if (exam.active === false) return false;
  const openAt = exam.openAt ? new Date(exam.openAt).getTime() : 0;
  const closeAt = exam.closeAt ? new Date(exam.closeAt).getTime() : 0;
  if (openAt && Number.isFinite(openAt) && now < openAt) return false;
  if (closeAt && Number.isFinite(closeAt) && now > closeAt) return false;
  return true;
}

exports.getExamDashboard = onCall(CALLABLE_OPTIONS, async request => {
  const studentCode = normalizeCode(request.data && request.data.studentCode);
  await rateLimitPublic('exam-dashboard', studentCode, request, 10, 35, 60 * 1000);
  const found = await getStudentPortalByCode(studentCode);
  const grade = text(found.data.grade, 80);
  const snap = await db.collection('exams').get();
  const exams = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(exam => examMatchesStudent(exam, found.data))
    .filter(exam => examIsOpen(exam))
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
      questionCount: Number(exam.questionCount || parseExamQuestions(exam.text || exam.questionsText).length)
    }));
  const [attempts, records] = await Promise.all([attemptSummaries(studentCode), studentRecords(studentCode)]);
  return { student: portalResponse(found.data, attempts, records), exams };
});

exports.startExam = onCall(CALLABLE_OPTIONS, async request => {
  const studentCode = normalizeCode(request.data && request.data.studentCode);
  const examId = cleanDocId(request.data && request.data.examId);
  await rateLimitPublic('exam-start', `${studentCode}:${examId}`, request, 5, 20, 10 * 60 * 1000);
  const found = await getStudentPortalByCode(studentCode);
  const examSnap = await db.collection('exams').doc(examId).get();
  if (!examSnap.exists) throw new HttpsError('not-found', 'الامتحان غير موجود.');
  const exam = { id: examSnap.id, ...examSnap.data() };
  if (!examIsOpen(exam)) throw new HttpsError('failed-precondition', 'الامتحان غير متاح في الوقت الحالي.');
  if (!examMatchesStudent(exam, found.data)) {
    throw new HttpsError('permission-denied', 'هذا الامتحان غير مخصص لصفك أو مجموعتك أو عامك الدراسي.');
  }
  const questions = parseExamQuestions(exam.text || exam.questionsText || '');
  if (!questions.length) throw new HttpsError('failed-precondition', 'الامتحان لا يحتوي على أسئلة صالحة.');
  if (questions.length > 200) throw new HttpsError('failed-precondition', 'عدد أسئلة الامتحان أكبر من الحد المسموح.');

  const durationMinutes = Math.max(1, Math.min(240, Number(exam.duration || 20)));
  const now = Date.now();
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
      const existingExpiresAt = existing.expiresAt?.toMillis ? existing.expiresAt.toMillis() : 0;
      if (existing.status === 'submitted' && exam.allowRetake !== true) {
        throw new HttpsError('already-exists', 'تم تسليم الامتحان بالفعل.');
      }
      if (existing.status === 'started' && existingExpiresAt > now) {
        return existing;
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
      instructions: text(exam.instructions, 1500),
      pdfUrl: safePublicUrl(exam.pdfUrl || exam.examPdfUrl),
      pdfName: text(exam.pdfName || exam.examPdfName, 220),
      duration: durationMinutes,
      allowRetake: exam.allowRetake === true,
      attemptSequence,
      status: 'started',
      questions,
      startedAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + durationMinutes * 60 * 1000),
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
    pdfUrl: sessionData.pdfUrl || exam.pdfUrl || exam.examPdfUrl,
    pdfName: sessionData.pdfName || exam.pdfName || exam.examPdfName
  }, snapshotQuestions, startedAtMs, expiresAtMs);
});

exports.submitExam = onCall(CALLABLE_OPTIONS, async request => {
  const body = request.data || {};
  const sessionId = cleanDocId(body.sessionId);
  const studentCode = normalizeCode(body.studentCode);
  const rawAnswers = body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers) ? body.answers : {};
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
  const questions = Array.isArray(session.questions) && session.questions.length
    ? session.questions
    : parseExamQuestions(exam.text || exam.questionsText || '');
  if (!questions.length) throw new HttpsError('failed-precondition', 'تعذر قراءة أسئلة الامتحان.');
  if (Object.keys(rawAnswers).length > questions.length + 5) throw new HttpsError('invalid-argument', 'عدد الإجابات غير صالح.');

  let correctCount = 0;
  let mcqCount = 0;
  let essayCount = 0;
  let needsManualReview = false;
  const staffAnswers = [];
  questions.forEach((question, index) => {
    const value = rawAnswers[String(index)] ?? rawAnswers[index] ?? '';
    if (question.type === 'mcq') {
      mcqCount += 1;
      const chosenIndex = Number(value);
      const chosen = Number.isInteger(chosenIndex) ? question.options[chosenIndex] || '' : '';
      const correct = mcqCorrect(question, chosenIndex);
      if (correct === true) correctCount += 1;
      if (correct === null) needsManualReview = true;
      staffAnswers.push({
        question: question.question,
        type: 'mcq',
        answer: text(chosen, 1000),
        answerIndex: Number.isInteger(chosenIndex) ? chosenIndex : null,
        correct,
        correctAnswer: question.answer,
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
        correctAnswer: 'يصححها المدرس'
      });
    }
  });

  const autoScore = mcqCount ? Math.round((correctCount / mcqCount) * 100) : null;
  const score = needsManualReview ? null : (autoScore || 0);
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
    maxScore: 100,
    mcqCount,
    essayCount,
    questionCount: questions.length,
    correctCount,
    needsManualReview,
    status: needsManualReview ? 'pending_manual' : 'submitted',
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

exports.registerHomeworkSubmission = onCall(CALLABLE_OPTIONS, async request => {
  const body = request.data || {};
  const studentCode = normalizeCode(body.studentCode);
  await rateLimitPublic('homework-submit', studentCode, request, 5, 15, 60 * 60 * 1000);
  const found = await getStudentPortalByCode(studentCode);
  const filePath = text(body.path || body.filePath, 500);
  const fileName = text(body.fileName, 180);
  const fileUrl = text(body.url || body.fileUrl, 1500);
  const contentType = text(body.contentType, 100);
  const size = Number(body.size || 0);
  if (!filePath.startsWith(`homework/${cleanDocId(studentCode)}/`)) {
    throw new HttpsError('permission-denied', 'مسار ملف الواجب غير صالح.');
  }
  if (!fileName || !fileUrl || !Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024) {
    throw new HttpsError('invalid-argument', 'بيانات ملف الواجب غير صالحة.');
  }
  if (!(contentType.startsWith('image/') || contentType === 'application/pdf')) {
    throw new HttpsError('invalid-argument', 'مسموح بالصور وملفات PDF فقط.');
  }
  const ref = db.collection('homework_submissions').doc();
  await ref.set({
    id: ref.id,
    studentCode,
    studentName: text(found.data.studentName || found.data.name, 100),
    grade: text(found.data.grade, 80),
    group: text(found.data.group, 100),
    academicYear: text(found.data.academicYear, 20),
    term: text(found.data.term, 40),
    fileName,
    fileUrl,
    url: fileUrl,
    filePath,
    path: filePath,
    contentType,
    size,
    status: 'تم الرفع',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return { id: ref.id, ok: true };
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
  'materials','questions','groups','assignments','exams','exam_attempts','homework_submissions',
  'attendance','recitations','grades','payments','reports','activityLog','client_errors',
  'student_attempts','exam_locks'
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
  await bucket.file(name).save(buffer, { resumable: false, contentType: 'application/gzip', metadata: { cacheControl: 'private, max-age=0', metadata: { schemaVersion: '53', reason: text(reason, 100) } } });
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
    if (collectionName === 'student_attempts') {
      for (const attempt of Array.isArray(row.attempts) ? row.attempts : []) {
        if (!attempt || !attempt.id || !attempt.data) continue;
        operations.push(batch => batch.set(ref.collection('attempts').doc(cleanDocId(attempt.id)), decodeBackupValue(attempt.data)));
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
  if (!payload || payload.schemaVersion !== 53 || payload.backupFormatVersion !== 2 || !payload.collections) {
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

exports.deleteStudentSafely = onCall({ region: 'europe-west1', timeoutSeconds: 120, memory: '512MiB' }, async request => {
  const staff = await requireStaff(request, ['admin', 'teacher']);
  const studentCode = normalizeCode(request.data && request.data.studentCode);
  if (!validLegacyOrStrongCode(studentCode)) throw new HttpsError('invalid-argument', 'كود الطالب غير صالح.');
  const studentRef = db.collection('students').doc(cleanDocId(studentCode));
  const studentSnap = await studentRef.get();
  if (!studentSnap.exists) throw new HttpsError('not-found', 'الطالب غير موجود.');
  const student = studentSnap.data();
  const relatedCollections = ['attendance','grades','recitations','homework_submissions','exam_attempts'];
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
  if (student.parentCode) refs.push(db.collection('parent_portal').doc(cleanDocId(student.parentCode)));
  if (attemptsChildren) refs.push(...attemptsChildren.docs.map(doc => doc.ref));
  await commitDeleteRefs(refs);
  await db.collection('activityLog').add({ action: 'تم حذف طالب مع نسخة استرجاع', meta: { studentCode, archiveName }, actorUid: staff.uid, actorEmail: staff.email || '', actorRole: staff.role || '', createdAt: FieldValue.serverTimestamp() });
  return { ok: true, archiveName };
});
