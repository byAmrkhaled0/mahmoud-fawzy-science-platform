(function(){
  'use strict';

  const cfg = window.MF_FIREBASE_CONFIG || {};
  if(!cfg.enabled || typeof firebase === 'undefined'){
    window.MFCloud = { ready:false, error:'Firebase غير مفعل' };
    return;
  }

  const cleanDocId = value => String(value || '').trim().replace(/[\\/#?\[\]]/g,'-');
  const digits = value => String(value || '').replace(/\D/g,'');
  const normalizeCode = value => String(value || '').trim().toUpperCase().replace(/\s+/g,'');
  const serverTime = () => firebase.firestore.FieldValue.serverTimestamp();

  try{
    const app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();
    const functions = typeof app.functions === 'function' ? app.functions(cfg.functionsRegion || 'europe-west1') : null;
    const siteDoc = db.collection('settings').doc('siteData');

    const callable = name => {
      if(!functions) return null;
      const fn = functions.httpsCallable(name);
      return async payload => {
        const result = await fn(payload || {});
        return result && Object.prototype.hasOwnProperty.call(result,'data') ? result.data : result;
      };
    };

    const calls = {
      getPortalStudent: callable('getPortalStudent'),
      createBooking: callable('createBooking'),
      getBookingStatus: callable('getBookingStatus'),
      createReview: callable('createReview'),
      getExamDashboard: callable('getExamDashboard'),
      startExam: callable('startExam'),
      submitExam: callable('submitExam'),
      reportClientError: callable('reportClientError'),
      createStudentAccess: callable('createStudentAccess'),
      registerHomeworkSubmission: callable('registerHomeworkSubmission')
    };


    function randomCode(prefix){
      const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const bytes=new Uint8Array(8);
      if(self.crypto?.getRandomValues) self.crypto.getRandomValues(bytes);
      else for(let i=0;i<bytes.length;i+=1) bytes[i]=Math.floor(Math.random()*256);
      let body='';
      for(const byte of bytes) body+=alphabet[byte%alphabet.length];
      return `${prefix}-${body.slice(0,4)}-${body.slice(4,8)}`;
    }

    function publicBookingPayload(booking, code){
      const b=booking||{};
      return {
        id:code,
        code,
        name:String(b.name||b.studentName||'').trim().slice(0,80),
        studentName:String(b.name||b.studentName||'').trim().slice(0,80),
        studentPhone:String(b.studentPhone||'').trim().slice(0,20),
        parentPhone:String(b.parentPhone||'').trim().slice(0,20),
        grade:String(b.grade||'').trim().slice(0,80),
        month:String(b.month||'').trim().slice(0,40),
        group:String(b.group||'').trim().slice(0,100),
        notes:String(b.notes||'').trim().slice(0,1000),
        status:'بانتظار الموافقة',
        date:new Date().toISOString().slice(0,10),
        createdAt:serverTime(),
        updatedAt:serverTime()
      };
    }

    function publicBookingStatusPayload(payload){
      return {
        code:payload.code,
        name:payload.name,
        grade:payload.grade,
        month:payload.month,
        group:payload.group,
        status:payload.status,
        studentCode:String(payload.studentCode||''),
        parentCode:String(payload.parentCode||''),
        updatedAt:serverTime()
      };
    }

    async function createBookingDirect(booking){
      let lastError=null;
      for(let attempt=0;attempt<4;attempt+=1){
        const code=randomCode('BK');
        const payload=publicBookingPayload(booking,code);
        const batch=db.batch();
        batch.set(db.collection('bookings').doc(cleanDocId(code)),payload);
        batch.set(db.collection('booking_status').doc(cleanDocId(code)),publicBookingStatusPayload(payload));
        try{await batch.commit();return {code,status:payload.status};}
        catch(error){lastError=error;}
      }
      throw lastError||new Error('تعذر حفظ الحجز في Firebase');
    }

    function canFallbackToDirect(error){
      const raw=String(error?.code||'')+' '+String(error?.message||'');
      return !/(invalid-argument|resource-exhausted|already-exists)/i.test(raw);
    }

    async function createStudentAccessDirect(student){
      const profile=await getCurrentStaffProfile();
      if(!profile?.allowed) throw new Error('Not authorized');
      const studentCode=randomCode('ST');
      const parentCode=randomCode('PR');
      const source={...(student||{}),studentCode,code:studentCode,parentCode,active:student?.active!==false};
      const normalized=normalizedStudent(source);
      const batch=db.batch();
      mirrorStudent(normalized,batch);
      await batch.commit();
      return {...portalPayload(normalized),studentCode,code:studentCode,parentCode,active:normalized.active};
    }

    function normalizedStudent(raw){
      const s = raw || {};
      const code = normalizeCode(s.studentCode || s.code || s.id || '');
      return {
        ...s,
        id: code,
        code,
        studentCode: code,
        parentCode: normalizeCode(s.parentCode || ''),
        name: s.studentName || s.name || '',
        studentName: s.studentName || s.name || '',
        studentPhone: s.studentPhone || '',
        parentPhone: s.parentPhone || '',
        grade: s.grade || '',
        month: s.month || '',
        group: s.group || '',
        paid: !!s.paid,
        paymentDate: s.paymentDate || '',
        notes: s.notes || '',
        active: s.active !== false,
        attendance: Array.isArray(s.attendance) ? s.attendance : [],
        grades: Array.isArray(s.grades) ? s.grades : [],
        homeworks: Array.isArray(s.homeworks) ? s.homeworks : [],
        recitations: Array.isArray(s.recitations) ? s.recitations : []
      };
    }

    function portalPayload(student, extra){
      const s = normalizedStudent(student);
      return {
        studentId: s.id,
        studentCode: s.studentCode,
        code: s.studentCode,
        parentCode: s.parentCode,
        studentName: s.studentName,
        name: s.studentName,
        grade: s.grade,
        group: s.group,
        month: s.month,
        paid: s.paid,
        paymentDate: s.paymentDate || '',
        notes: s.notes || '',
        active: s.active !== false,
        attendance: s.attendance || [],
        grades: s.grades || [],
        homeworks: s.homeworks || [],
        recitations: s.recitations || [],
        ...(extra || {}),
        updatedAt: serverTime()
      };
    }

    async function upload(file, folder){
      if(!file) throw new Error('No file selected');
      const safeName = `${Date.now()}-${file.name}`.replace(/[\\/#?\[\]]/g,'-');
      const path = `${folder || 'public/uploads'}/${safeName}`;
      const ref = storage.ref(path);
      await ref.put(file, { contentType:file.type || 'application/octet-stream' });
      return { url: await ref.getDownloadURL(), path, fileName:file.name, size:file.size, contentType:file.type };
    }

    function mirrorStudent(student, batch){
      const s = normalizedStudent(student);
      if(!s.studentCode) return;
      const id = cleanDocId(s.studentCode);
      const studentRef = db.collection('students').doc(id);
      const studentData = { ...s, updatedAt:serverTime() };
      delete studentData.id;
      batch.set(studentRef, studentData, { merge:true });
      batch.set(db.collection('student_portal').doc(id), portalPayload(s), { merge:true });
      if(s.parentCode){
        batch.set(db.collection('parent_portal').doc(cleanDocId(s.parentCode)), portalPayload(s), { merge:true });
      }
      batch.set(db.collection('payments').doc(id), {
        studentId:id,
        studentCode:s.studentCode,
        studentName:s.studentName,
        grade:s.grade,
        group:s.group,
        paid:s.paid,
        paymentDate:s.paymentDate || '',
        updatedAt:serverTime()
      }, { merge:true });
    }

    async function mirrorPayloadToCollections(payload){
      const data = payload || {};
      const batch = db.batch();
      (data.students || []).forEach(st => mirrorStudent(st, batch));
      (data.bookings || []).forEach(b=>{
        const id = cleanDocId(b.code || b.id || `${Date.now()}`);
        const full={ ...b, id:b.id || id, code:b.code || id, updatedAt:serverTime() };
        batch.set(db.collection('bookings').doc(id), full, { merge:true });
        batch.set(db.collection('booking_status').doc(id), publicBookingStatusPayload(full), { merge:true });
      });
      (data.materials || []).forEach(m=>{
        const id = cleanDocId(m.id || m.title || `${Date.now()}`);
        batch.set(db.collection('materials').doc(id), { ...m, id, updatedAt:serverTime() }, { merge:true });
      });
      (data.questions || []).forEach(q=>{
        const id = cleanDocId(q.id || q.title || `${Date.now()}`);
        batch.set(db.collection('questions').doc(id), { ...q, id, updatedAt:serverTime() }, { merge:true });
      });
      (data.exams || []).forEach(e=>{
        const id = cleanDocId(e.id || e.title || `${Date.now()}`);
        batch.set(db.collection('exams').doc(id), { ...e, id, updatedAt:serverTime() }, { merge:true });
      });
      (data.reviews || []).forEach(r=>{
        const id = cleanDocId(r.id || `${Date.now()}-${r.name || 'review'}`);
        batch.set(db.collection('reviews').doc(id), { ...r, id, approved:r.approved === true, updatedAt:serverTime() }, { merge:true });
      });
      (data.groups || []).forEach(g=>{
        const id = cleanDocId(g.id || g.name || `${Date.now()}`);
        batch.set(db.collection('groups').doc(id), { ...g, id, updatedAt:serverTime() }, { merge:true });
      });
      (data.assignments || []).forEach(a=>{
        const id = cleanDocId(a.id || a.title || `${Date.now()}`);
        batch.set(db.collection('assignments').doc(id), { ...a, id, updatedAt:serverTime() }, { merge:true });
      });
      (data.grades || []).forEach(g=>{
        const id = cleanDocId(g.id || `${g.studentCode || g.code || 'student'}_${g.exam || g.examTitle || 'exam'}_${g.date || Date.now()}`);
        batch.set(db.collection('grades').doc(id), { ...g, id, updatedAt:serverTime() }, { merge:true });
      });
      (data.examAttempts || []).forEach(a=>{
        const id = cleanDocId(a.id || `${a.examId || 'exam'}_${a.studentCode || 'student'}_${Date.now()}`);
        batch.set(db.collection('exam_attempts').doc(id), { ...a, id, updatedAt:serverTime() }, { merge:true });
        if(a.studentCode){
          const studentCode=normalizeCode(a.studentCode);
          const parentRef=db.collection('student_attempts').doc(cleanDocId(studentCode));
          const summary={id,studentCode,examId:a.examId||'',examTitle:a.examTitle||a.exam||'امتحان',submittedAt:a.submittedAt||a.date||'',score:a.score??null,autoScore:a.autoScore??null,needsManualReview:a.needsManualReview===true,status:a.status||''};
          batch.set(parentRef,{studentCode,lastAttempt:summary,updatedAt:serverTime()},{merge:true});
          batch.set(parentRef.collection('attempts').doc(id),summary,{merge:true});
        }
      });
      await batch.commit();
    }

    async function getDocs(collection, limit){
      const ref = limit ? db.collection(collection).limit(limit) : db.collection(collection);
      const snap = await ref.get();
      return snap.docs.map(d=>({ id:d.id, ...d.data() }));
    }

    async function getApprovedReviews(){
      const snap = await db.collection('reviews').where('approved','==',true).limit(100).get();
      return snap.docs.map(d=>({ id:d.id, ...d.data() }));
    }


    async function deleteCollectionDocs(collectionRef, pageSize=300){
      while(true){
        const snap=await collectionRef.limit(pageSize).get();
        if(snap.empty) break;
        const batch=db.batch();
        snap.docs.forEach(doc=>batch.delete(doc.ref));
        await batch.commit();
        if(snap.size<pageSize) break;
      }
    }

    async function getCurrentStaffProfile(){
      const user = auth.currentUser;
      if(!user) return null;
      const userDoc = await db.collection('users').doc(user.uid).get();
      const profile = userDoc.exists ? userDoc.data() : {};
      const role = profile.role || '';
      const allowed = ['admin','teacher','assistant'].includes(role) && profile.active !== false;
      return { uid:user.uid, email:user.email, role, allowed, ...profile };
    }

    async function loadPublicCollections(){
      const [materials, questions, reviews, groups, assignments] = await Promise.all([
        getDocs('materials').catch(()=>[]),
        getDocs('questions').catch(()=>[]),
        getApprovedReviews().catch(()=>[]),
        getDocs('groups').catch(()=>[]),
        getDocs('assignments').catch(()=>[])
      ]);
      return { students:[], bookings:[], materials, questions, exams:[], reviews, groups, assignments, examAttempts:[], grades:[] };
    }

    async function loadStaffCollections(){
      const [students, bookings, materials, questions, exams, reviews, groups, assignments, attempts, grades] = await Promise.all([
        getDocs('students').catch(()=>[]),
        getDocs('bookings').catch(()=>[]),
        getDocs('materials').catch(()=>[]),
        getDocs('questions').catch(()=>[]),
        getDocs('exams').catch(()=>[]),
        getDocs('reviews').catch(()=>[]),
        getDocs('groups').catch(()=>[]),
        getDocs('assignments').catch(()=>[]),
        getDocs('exam_attempts', 1000).catch(()=>[]),
        getDocs('grades', 1000).catch(()=>[])
      ]);
      const normalizedStudents = students.map(normalizedStudent);
      (grades || []).forEach(g=>{
        const code = normalizeCode(g.studentCode || g.code || '');
        const st = normalizedStudents.find(s=>s.studentCode===code);
        if(st) st.grades = [...(st.grades || []), g];
      });
      return { students:normalizedStudents, bookings, materials, questions, exams, reviews, groups, assignments, examAttempts:attempts, grades };
    }

    async function loadFromCollections(){
      const profile = await getCurrentStaffProfile().catch(()=>null);
      return profile && profile.allowed ? loadStaffCollections() : loadPublicCollections();
    }

    async function upsertAttendance(record){
      const docId = cleanDocId(`${record.studentId || record.studentCode}_${record.date}`);
      const payload = { ...record, id:docId, updatedAt:serverTime() };
      await db.collection('attendance').doc(docId).set(payload, { merge:true });
      return { id:docId, ...payload };
    }

    async function getAttendanceForDate(date, grade, group){
      let q = db.collection('attendance').where('date','==',date);
      if(grade && grade !== 'all') q = q.where('grade','==',grade);
      if(group && group !== 'all') q = q.where('group','==',group);
      const snap = await q.get();
      return snap.docs.map(d=>({ id:d.id, ...d.data() }));
    }

    async function getStudentByCode(code){
      if(!calls.getPortalStudent) throw new Error('Secure student portal function is unavailable');
      return calls.getPortalStudent({ code:normalizeCode(code), mode:'student' });
    }

    async function getParentStudent(code){
      if(!calls.getPortalStudent) throw new Error('Secure parent portal function is unavailable');
      return calls.getPortalStudent({ code:normalizeCode(code), mode:'parent' });
    }

    async function logActivity(action, meta){
      const profile = await getCurrentStaffProfile().catch(()=>null);
      if(!profile || !profile.allowed) return;
      await db.collection('activityLog').add({
        action:String(action || '').slice(0,300),
        meta:meta && typeof meta === 'object' ? meta : {},
        actorUid:profile.uid,
        actorEmail:profile.email || '',
        actorRole:profile.role || '',
        createdAt:serverTime()
      });
    }

    window.MFCloud = {
      ready:true,
      app,
      auth,
      db,
      storage,
      functions,
      cleanDocId,
      normalizePhoneDigits:digits,
      currentUser:()=>auth.currentUser,
      signIn:(email,password)=>auth.signInWithEmailAndPassword(email,password),
      signOut:()=>auth.signOut(),
      getCurrentStaffProfile,
      loadSiteData: async()=>{
        const fromCollections = await loadFromCollections().catch(()=>null);
        if(fromCollections && Object.values(fromCollections).some(v=>Array.isArray(v) && v.length)) return fromCollections;
        const profile = await getCurrentStaffProfile().catch(()=>null);
        if(profile && profile.allowed){
          const site = await siteDoc.get().catch(()=>null);
          if(site && site.exists && site.data().payload) return site.data().payload;
        }
        return fromCollections || null;
      },
      saveSiteData: async(payload)=>{
        await siteDoc.set({ payload, updatedAt:serverTime() }, { merge:true });
        await mirrorPayloadToCollections(payload);
      },
      saveStudent: async(student)=>{
        const batch = db.batch();
        mirrorStudent(student, batch);
        await batch.commit();
      },
      createStudentAccess: async student => {
        if(calls.createStudentAccess){
          try{return await calls.createStudentAccess(student);}catch(error){
            console.warn('createStudentAccess callable failed; using authenticated Firestore fallback.',error);
            if(!canFallbackToDirect(error)) throw error;
          }
        }
        return createStudentAccessDirect(student);
      },
      createBooking: async booking => {
        if(cfg.useSecureFunctions !== false && calls.createBooking){
          try{return await calls.createBooking(booking);}catch(error){
            console.warn('createBooking callable failed; using Firestore fallback.',error);
            if(!canFallbackToDirect(error)) throw error;
          }
        }
        return createBookingDirect(booking);
      },
      getBookingStatus: async code => {
        const normalized=normalizeCode(code);
        if(calls.getBookingStatus){
          try{return await calls.getBookingStatus({code:normalized});}catch(error){
            if(!canFallbackToDirect(error)) throw error;
            console.warn('getBookingStatus callable failed; using Firestore fallback.',error);
          }
        }
        const snap=await db.collection('booking_status').doc(cleanDocId(normalized)).get();
        if(!snap.exists) return null;
        return {code:normalized,...snap.data()};
      },
      saveReview: async review => {
        if(cfg.useSecureFunctions !== false && calls.createReview){
          try{return await calls.createReview(review);}catch(error){
            if(!canFallbackToDirect(error)) throw error;
            console.warn('createReview callable failed; using Firestore fallback.',error);
          }
        }
        const id=cleanDocId(`REV-${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
        await db.collection('reviews').doc(id).set({
          id,
          name:String(review?.name||'').trim().slice(0,60),
          role:String(review?.role||'طالب').trim().slice(0,30),
          rating:String(review?.rating||'5'),
          text:String(review?.text||'').trim().slice(0,600),
          date:new Date().toISOString().slice(0,10),
          approved:false,
          createdAt:serverTime(),
          updatedAt:serverTime()
        });
        return {ok:true};
      },
      getExamDashboard: async studentCode => {
        if(!calls.getExamDashboard) throw new Error('Secure exam dashboard function is unavailable');
        return calls.getExamDashboard({ studentCode:normalizeCode(studentCode) });
      },
      startSecureExam: async (examId,studentCode) => {
        if(!calls.startExam) throw new Error('Secure start exam function is unavailable');
        return calls.startExam({ examId, studentCode:normalizeCode(studentCode) });
      },
      submitSecureExam: async (sessionId,studentCode,answers) => {
        if(!calls.submitExam) throw new Error('Secure submit exam function is unavailable');
        return calls.submitExam({ sessionId, studentCode:normalizeCode(studentCode), answers });
      },
      saveExamAttempt: async(attempt)=>{
        const profile = await getCurrentStaffProfile();
        if(!profile || !profile.allowed) throw new Error('Not authorized');
        const id = cleanDocId(attempt.id || `${attempt.examId}_${attempt.studentCode}`);
        const studentCode=normalizeCode(attempt.studentCode||'');
        const batch=db.batch();
        batch.set(db.collection('exam_attempts').doc(id),{...attempt,id,studentCode,updatedAt:serverTime()},{merge:true});
        if(studentCode){
          const parentRef=db.collection('student_attempts').doc(cleanDocId(studentCode));
          const summary={id,studentCode,examId:attempt.examId||'',examTitle:attempt.examTitle||attempt.exam||'امتحان',submittedAt:attempt.submittedAt||attempt.date||new Date().toISOString(),score:attempt.score??null,autoScore:attempt.autoScore??null,needsManualReview:attempt.needsManualReview===true,status:attempt.status||''};
          batch.set(parentRef,{studentCode,lastAttempt:summary,updatedAt:serverTime()},{merge:true});
          batch.set(parentRef.collection('attempts').doc(id),summary,{merge:true});
        }
        await batch.commit();
      },
      upsertAttendance,
      getAttendanceForDate,
      getStudentByCode,
      getParentStudent,
      uploadHomework: async(file, studentCode)=>{
        const normalized = normalizeCode(studentCode);
        if(!calls.registerHomeworkSubmission) throw new Error('Secure homework function is unavailable');
        const up = await upload(file, `homework/${cleanDocId(normalized)}`);
        await calls.registerHomeworkSubmission({ studentCode:normalized, ...up });
        return up;
      },
      uploadAttachment:(file, folder)=>upload(file, folder || 'teacher-uploads'),
      logActivity,
      reportClientError: payload => calls.reportClientError ? calls.reportClientError(payload) : Promise.resolve(null),
      deleteDocument: async(collection,id)=>{
        if(collection && id) await db.collection(collection).doc(cleanDocId(id)).delete();
      },
      deleteStudentPortals: async student => {
        const s = normalizedStudent(student);
        if(s.studentCode){
          const attemptsParent=db.collection('student_attempts').doc(cleanDocId(s.studentCode));
          await deleteCollectionDocs(attemptsParent.collection('attempts')).catch(()=>{});
          await Promise.all([
            window.MFCloud.deleteWhere('exam_attempts','studentCode',s.studentCode).catch(()=>{}),
            window.MFCloud.deleteWhere('grades','studentCode',s.studentCode).catch(()=>{}),
            window.MFCloud.deleteWhere('attendance','studentCode',s.studentCode).catch(()=>{}),
            window.MFCloud.deleteWhere('homework_submissions','studentCode',s.studentCode).catch(()=>{})
          ]);
          const batch=db.batch();
          batch.delete(db.collection('students').doc(cleanDocId(s.studentCode)));
          batch.delete(db.collection('student_portal').doc(cleanDocId(s.studentCode)));
          batch.delete(db.collection('payments').doc(cleanDocId(s.studentCode)));
          batch.delete(attemptsParent);
          if(s.parentCode) batch.delete(db.collection('parent_portal').doc(cleanDocId(s.parentCode)));
          await batch.commit();
        }else if(s.parentCode){
          await db.collection('parent_portal').doc(cleanDocId(s.parentCode)).delete();
        }
      },
      migrateStudentCode: async(oldCode,newCode,student)=>{
        const oldId=cleanDocId(normalizeCode(oldCode));
        const newId=cleanDocId(normalizeCode(newCode));
        if(!oldId||!newId||oldId===newId)return;
        const profile=await getCurrentStaffProfile();
        if(!profile?.allowed)throw new Error('Not authorized');
        const oldAttemptsParent=db.collection('student_attempts').doc(oldId);
        const newAttemptsParent=db.collection('student_attempts').doc(newId);
        const [attemptSummary,attemptSummaryDocs,attemptsSnap,gradesSnap,attendanceSnap,homeworkSnap]=await Promise.all([
          oldAttemptsParent.get().catch(()=>null),
          oldAttemptsParent.collection('attempts').get().catch(()=>null),
          db.collection('exam_attempts').where('studentCode','==',normalizeCode(oldCode)).get().catch(()=>null),
          db.collection('grades').where('studentCode','==',normalizeCode(oldCode)).get().catch(()=>null),
          db.collection('attendance').where('studentCode','==',normalizeCode(oldCode)).get().catch(()=>null),
          db.collection('homework_submissions').where('studentCode','==',normalizeCode(oldCode)).get().catch(()=>null)
        ]);
        const writes=[];
        const commitChunk=async()=>{if(!writes.length)return;const batch=db.batch();writes.splice(0,450).forEach(fn=>fn(batch));await batch.commit();if(writes.length)await commitChunk();};
        if(attemptSummary?.exists){writes.push(batch=>batch.set(newAttemptsParent,{...attemptSummary.data(),studentCode:normalizeCode(newCode),updatedAt:serverTime()},{merge:true}));}
        attemptSummaryDocs?.forEach(doc=>{
          writes.push(batch=>batch.set(newAttemptsParent.collection('attempts').doc(doc.id),{...doc.data(),studentCode:normalizeCode(newCode)},{merge:true}));
          writes.push(batch=>batch.delete(doc.ref));
        });
        if(attemptSummary?.exists)writes.push(batch=>batch.delete(attemptSummary.ref));
        [attemptsSnap,gradesSnap,attendanceSnap,homeworkSnap].forEach(snap=>snap?.forEach(doc=>writes.push(batch=>batch.update(doc.ref,{studentCode:normalizeCode(newCode),updatedAt:serverTime()}))));
        writes.push(batch=>batch.delete(db.collection('students').doc(oldId)));
        writes.push(batch=>batch.delete(db.collection('student_portal').doc(oldId)));
        writes.push(batch=>batch.delete(db.collection('payments').doc(oldId)));
        await commitChunk();
        if(student){const batch=db.batch();mirrorStudent(student,batch);await batch.commit();}
      },
      getActivityLog: async(limit=50)=>{
        const snap=await db.collection('activityLog').orderBy('createdAt','desc').limit(Math.min(Number(limit)||50,200)).get();
        return snap.docs.map(doc=>({id:doc.id,...doc.data()}));
      },
      deleteWhere: async(collection, field, value)=>{
        const snap = await db.collection(collection).where(field,'==',value).get();
        if(snap.empty) return;
        const batch = db.batch();
        snap.forEach(doc=>batch.delete(doc.ref));
        await batch.commit();
      }
    };
  }catch(err){
    console.error(err);
    window.MFCloud = { ready:false, error:err };
  }
})();
