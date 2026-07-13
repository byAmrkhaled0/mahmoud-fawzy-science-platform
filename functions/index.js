'use strict';

const crypto = require('crypto');
const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2/options');

admin.initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 10, memory: '256MiB' });

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;
const CALLABLE_OPTIONS = {
  region: 'europe-west1',
  timeoutSeconds: 30
};

function cleanDocId(value) {
  return String(value || '').trim().replace(/[\\/#?\[\]]/g, '-');
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function validLegacyOrStrongCode(value) {
  return /^[A-Z0-9_-]{6,40}$/.test(normalizeCode(value));
}

function text(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
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
      duration: Math.max(1, Math.min(240, Number(exam.duration || 20)))
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
  const raw = String(line || '').trim();
  let match = raw.match(/^([A-Da-dأإابجدهـه]|[1-4])\s*[\)\.\-:：]\s*(.+)$/);
  if (match) return { label: match[1].replace('إ', 'أ').replace('هـ', 'ه'), text: match[2].trim() };
  match = raw.match(/^-\s*(.+)$/);
  if (match) return { label: '', text: match[1].trim() };
  return null;
}

function parseExamQuestions(source) {
  const blocks = String(source || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).slice(0, 200);
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

function portalResponse(data, attempts) {
  return {
    studentCode: text(data.studentCode || data.code, 40),
    name: text(data.studentName || data.name, 100),
    studentName: text(data.studentName || data.name, 100),
    grade: text(data.grade, 80),
    group: text(data.group, 100),
    month: text(data.month, 40),
    paid: data.paid === true,
    paymentDate: text(data.paymentDate, 40),
    notes: text(data.notes, 1500),
    attendance: Array.isArray(data.attendance) ? data.attendance.slice(-120) : [],
    grades: Array.isArray(data.grades) ? data.grades.slice(-120) : [],
    homeworks: Array.isArray(data.homeworks) ? data.homeworks.slice(-120) : [],
    recitations: Array.isArray(data.recitations) ? data.recitations.slice(-120) : [],
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

exports.getPortalStudent = onCall(CALLABLE_OPTIONS, async request => {
  const code = normalizeCode(request.data && request.data.code);
  const mode = request.data && request.data.mode === 'parent' ? 'parent' : 'student';
  await rateLimitPublic(`portal-${mode}`, code, request, 8, 35, 60 * 1000);
  const found = mode === 'parent' ? await getParentPortalByCode(code) : await getStudentPortalByCode(code);
  const attempts = await attemptSummaries(found.data.studentCode || found.data.code);
  return portalResponse(found.data, attempts);
});

exports.createStudentAccess = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  const body = request.data || {};
  const name = text(body.studentName || body.name, 100);
  const parentPhone = text(body.parentPhone, 20);
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
      studentPhone: text(body.studentPhone, 20),
      parentPhone,
      grade: text(body.grade, 80),
      month: text(body.month, 40),
      group: text(body.group, 100),
      notes: text(body.notes, 1500),
      paid: body.paid === true,
      paymentDate: text(body.paymentDate, 40),
      active: body.active !== false,
      attendance: [],
      grades: [],
      homeworks: [],
      recitations: [],
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
  await rateLimitPublic('booking', identity, request, 4, 15, 60 * 60 * 1000);
  const name = text(body.name, 80);
  const studentPhone = digits(body.studentPhone);
  const parentPhone = digits(body.parentPhone);
  if (name.length < 3) throw new HttpsError('invalid-argument', 'اكتب اسم الطالب كاملًا.');
  if (studentPhone.length < 10 || parentPhone.length < 10) throw new HttpsError('invalid-argument', 'اكتب أرقام هاتف صحيحة.');
  if (studentPhone === parentPhone) throw new HttpsError('invalid-argument', 'رقم الطالب يجب أن يختلف عن رقم ولي الأمر.');
  const code = await uniqueCode('bookings', 'BK');
  const payload = {
    id: code,
    code,
    name,
    studentName: name,
    studentPhone: text(body.studentPhone, 20),
    parentPhone: text(body.parentPhone, 20),
    grade: text(body.grade, 80),
    month: text(body.month, 40),
    group: text(body.group, 100),
    notes: text(body.notes, 1000),
    status: 'بانتظار الموافقة',
    date: new Date().toISOString().slice(0, 10),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  await db.collection('bookings').doc(cleanDocId(code)).set(payload);
  return { code, status: payload.status };
});

exports.getBookingStatus = onCall(CALLABLE_OPTIONS, async request => {
  const code = normalizeCode(request.data && request.data.code);
  await rateLimitPublic('booking-status', code, request, 10, 40, 60 * 1000);
  if (!validLegacyOrStrongCode(code)) throw new HttpsError('invalid-argument', 'كود الحجز غير صالح.');
  const snap = await db.collection('bookings').doc(cleanDocId(code)).get();
  if (!snap.exists) throw new HttpsError('not-found', 'لم يتم العثور على الحجز.');
  const data = snap.data();
  return {
    code,
    name: text(data.name || data.studentName, 80),
    grade: text(data.grade, 80),
    month: text(data.month, 40),
    group: text(data.group, 100),
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

exports.getExamDashboard = onCall(CALLABLE_OPTIONS, async request => {
  const studentCode = normalizeCode(request.data && request.data.studentCode);
  await rateLimitPublic('exam-dashboard', studentCode, request, 10, 35, 60 * 1000);
  const found = await getStudentPortalByCode(studentCode);
  const grade = text(found.data.grade, 80);
  const snap = await db.collection('exams').get();
  const exams = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(exam => !exam.grade || exam.grade === grade || exam.grade === 'كل الصفوف')
    .filter(exam => exam.active !== false)
    .map(exam => ({
      id: text(exam.id, 100),
      title: text(exam.title, 200),
      grade: text(exam.grade, 80),
      duration: Math.max(1, Math.min(240, Number(exam.duration || 20))),
      instructions: text(exam.instructions, 1500),
      allowRetake: exam.allowRetake === true,
      questionCount: Number(exam.questionCount || parseExamQuestions(exam.text || exam.questionsText).length)
    }));
  return { student: portalResponse(found.data, await attemptSummaries(studentCode)), exams };
});

exports.startExam = onCall(CALLABLE_OPTIONS, async request => {
  const studentCode = normalizeCode(request.data && request.data.studentCode);
  const examId = cleanDocId(request.data && request.data.examId);
  await rateLimitPublic('exam-start', `${studentCode}:${examId}`, request, 5, 20, 10 * 60 * 1000);
  const found = await getStudentPortalByCode(studentCode);
  const examSnap = await db.collection('exams').doc(examId).get();
  if (!examSnap.exists) throw new HttpsError('not-found', 'الامتحان غير موجود.');
  const exam = { id: examSnap.id, ...examSnap.data() };
  if (exam.active === false) throw new HttpsError('failed-precondition', 'الامتحان غير متاح حاليًا.');
  if (exam.grade && exam.grade !== 'كل الصفوف' && exam.grade !== found.data.grade) {
    throw new HttpsError('permission-denied', 'هذا الامتحان غير مخصص لصفك.');
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
      examTitle: text(exam.title, 200),
      instructions: text(exam.instructions, 1500),
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
    duration: sessionData.duration || durationMinutes
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
    status: attempt.status
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
