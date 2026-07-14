(function(){
  'use strict';

  const cfg=window.MF_FIREBASE_CONFIG||{};
  if(!cfg.enabled||typeof firebase==='undefined'){
    window.MFCloud={ready:false,error:'Firebase غير مفعل'};
    return;
  }

  const cleanDocId=value=>String(value||'').trim().replace(/[\\/#?\[\]]/g,'-');
  const normalizeDigits=value=>String(value||'').replace(/[٠-٩]/g,digit=>String(digit.charCodeAt(0)-1632)).replace(/[۰-۹]/g,digit=>String(digit.charCodeAt(0)-1776));
  const digits=value=>normalizeDigits(value).replace(/\D/g,'');
  const normalizeCode=value=>normalizeDigits(value).trim().toUpperCase().replace(/\s+/g,'');
  const serverTime=()=>firebase.firestore.FieldValue.serverTimestamp();
  const nowIso=()=>new Date().toISOString();

  try{
    const app=firebase.apps&&firebase.apps.length?firebase.app():firebase.initializeApp(cfg);
    const auth=firebase.auth();
    const db=firebase.firestore();
    const storage=firebase.storage();
    const functions=typeof app.functions==='function'?app.functions(cfg.functionsRegion||'europe-west1'):null;
    const legacySiteDoc=db.collection('settings').doc('siteData');
    const platformSettingsDoc=db.collection('settings').doc('platform');

    const callable=name=>{
      if(!functions)return null;
      const fn=functions.httpsCallable(name);
      return async payload=>{
        const result=await fn(payload||{});
        return result&&Object.prototype.hasOwnProperty.call(result,'data')?result.data:result;
      };
    };

    const calls={
      getPortalStudent:callable('getPortalStudent'),
      getPublicLeaderboard:callable('getPublicLeaderboard'),
      createBooking:callable('createBooking'),
      approveBooking:callable('approveBooking'),
      rejectBooking:callable('rejectBooking'),
      registerTeacherPushToken:callable('registerTeacherPushToken'),
      getBookingStatus:callable('getBookingStatus'),
      createReview:callable('createReview'),
      getExamDashboard:callable('getExamDashboard'),
      startExam:callable('startExam'),
      submitExam:callable('submitExam'),
      reportClientError:callable('reportClientError'),
      createStudentAccess:callable('createStudentAccess'),
      registerHomeworkSubmission:callable('registerHomeworkSubmission'),
      createBackupNow:callable('createBackupNow'),
      listAutomaticBackups:callable('listAutomaticBackups'),
      getBackupDownloadUrl:callable('getBackupDownloadUrl'),
      restoreAutomaticBackup:callable('restoreAutomaticBackup'),
      deleteStudentSafely:callable('deleteStudentSafely')
    };

    function randomCode(prefix){
      const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const bytes=new Uint8Array(8);
      if(self.crypto?.getRandomValues)self.crypto.getRandomValues(bytes);
      else for(let i=0;i<bytes.length;i+=1)bytes[i]=Math.floor(Math.random()*256);
      let body='';for(const byte of bytes)body+=alphabet[byte%alphabet.length];
      return `${prefix}-${body.slice(0,4)}-${body.slice(4,8)}`;
    }

    function randomNumericAccessCode(){
      const bytes=new Uint32Array(8);
      if(self.crypto?.getRandomValues)self.crypto.getRandomValues(bytes);
      else for(let i=0;i<bytes.length;i+=1)bytes[i]=Math.floor(Math.random()*0xffffffff);
      return String((bytes[0]%9)+1)+[...bytes.slice(1)].map(byte=>String(byte%10)).join('');
    }

    function normalizedStudent(raw){
      const s=raw||{};
      const code=normalizeCode(s.studentCode||s.code||s.id||'');
      return {
        ...s,id:code,code,studentCode:code,parentCode:normalizeCode(s.parentCode||''),
        name:s.studentName||s.name||'',studentName:s.studentName||s.name||'',
        studentPhone:digits(s.studentPhone),parentPhone:digits(s.parentPhone),grade:s.grade||'',month:s.month||'',group:s.group||'',
        academicYear:s.academicYear||'',term:s.term||'',paid:s.paid===true,paymentDate:s.paymentDate||'',notes:s.notes||'',active:s.active!==false,
        attendance:Array.isArray(s.attendance)?s.attendance:[],grades:Array.isArray(s.grades)?s.grades:[],
        homeworks:Array.isArray(s.homeworks)?s.homeworks:[],recitations:Array.isArray(s.recitations)?s.recitations:[]
      };
    }

    const syncFingerprints=new Map();
    function stableJSON(value){
      const normalize=item=>Array.isArray(item)?item.map(normalize):(item&&typeof item==='object'?Object.keys(item).sort().reduce((out,key)=>{if(!['updatedAt','createdAt'].includes(key))out[key]=normalize(item[key]);return out;},{}):item);
      try{return JSON.stringify(normalize(value));}catch(_){return String(Date.now());}
    }
    function changed(key,value){const next=stableJSON(value);if(syncFingerprints.get(key)===next)return false;syncFingerprints.set(key,next);return true;}
    function seedFingerprint(collection,id,value){syncFingerprints.set(`${collection}/${id}`,stableJSON(value));}

    function studentProfile(student){
      const s=normalizedStudent(student);
      return {
        studentCode:s.studentCode,code:s.studentCode,parentCode:s.parentCode,name:s.name,studentName:s.studentName,
        studentPhone:s.studentPhone,parentPhone:s.parentPhone,grade:s.grade,month:s.month,group:s.group,
        academicYear:s.academicYear,term:s.term,paid:s.paid,paymentDate:s.paymentDate,notes:s.notes,active:s.active
      };
    }

    function portalProfile(student){
      const s=studentProfile(student);
      return {...s,updatedAt:serverTime()};
    }

    function publicBookingStatusPayload(payload){
      return {
        code:payload.code,name:payload.name,grade:payload.grade,month:payload.month,group:payload.group,
        academicYear:payload.academicYear||'',term:payload.term||'',status:payload.status,
        studentCode:String(payload.studentCode||''),parentCode:String(payload.parentCode||''),updatedAt:serverTime()
      };
    }

    async function upload(file,folder){
      if(!file)throw new Error('No file selected');
      const safeName=`${Date.now()}-${file.name}`.replace(/[\\/#?\[\]]/g,'-');
      const path=`${folder||'public/uploads'}/${safeName}`;
      const ref=storage.ref(path);
      await ref.put(file,{contentType:file.type||'application/octet-stream'});
      return {url:await ref.getDownloadURL(),path,fileName:file.name,size:file.size,contentType:file.type};
    }

    async function getCurrentStaffProfile(){
      const user=auth.currentUser;if(!user)return null;
      const userDoc=await db.collection('users').doc(user.uid).get();
      const profile=userDoc.exists?userDoc.data():{};
      const role=profile.role||'';
      const allowed=['admin','teacher','assistant'].includes(role)&&profile.active!==false;
      return {uid:user.uid,email:user.email,role,allowed,...profile};
    }

    function pushStudentOps(ops,student){
      const s=normalizedStudent(student);if(!s.studentCode)return;
      const id=cleanDocId(s.studentCode);const profile=studentProfile(s);
      if(changed(`students/${id}`,profile))ops.push(batch=>batch.set(db.collection('students').doc(id),{...profile,updatedAt:serverTime()},{merge:true}));
      const portal=studentProfile(s);
      if(changed(`student_portal/${id}`,portal))ops.push(batch=>batch.set(db.collection('student_portal').doc(id),{...portal,updatedAt:serverTime()},{merge:true}));
      if(s.parentCode&&changed(`parent_portal/${cleanDocId(s.parentCode)}`,portal))ops.push(batch=>batch.set(db.collection('parent_portal').doc(cleanDocId(s.parentCode)),{...portal,updatedAt:serverTime()},{merge:true}));
      const payment={studentId:id,studentCode:s.studentCode,studentName:s.studentName,grade:s.grade,group:s.group,academicYear:s.academicYear,term:s.term,paid:s.paid,paymentDate:s.paymentDate||''};
      if(changed(`payments/${id}`,payment))ops.push(batch=>batch.set(db.collection('payments').doc(id),{...payment,updatedAt:serverTime()},{merge:true}));

      s.attendance.forEach(record=>{
        const rid=cleanDocId(record.id||`${s.studentCode}_${record.date||Date.now()}`);const body={...record,id:rid,studentId:s.studentCode,studentCode:s.studentCode,studentName:s.name,grade:s.grade,group:s.group,academicYear:record.academicYear||s.academicYear,term:record.term||s.term};
        if(changed(`attendance/${rid}`,body))ops.push(batch=>batch.set(db.collection('attendance').doc(rid),{...body,updatedAt:serverTime()},{merge:true}));
      });
      s.grades.forEach(record=>{
        const rid=cleanDocId(record.id||`${s.studentCode}_${record.examId||record.exam||'exam'}_${record.date||record.submittedAt||Date.now()}`);const body={...record,id:rid,studentCode:s.studentCode,studentName:s.name,academicYear:record.academicYear||s.academicYear,term:record.term||s.term};
        if(changed(`grades/${rid}`,body))ops.push(batch=>batch.set(db.collection('grades').doc(rid),{...body,updatedAt:serverTime()},{merge:true}));
      });
      s.recitations.forEach(record=>{
        const rid=cleanDocId(record.id||`${s.studentCode}_${record.date||Date.now()}`);const body={...record,id:rid,studentCode:s.studentCode,studentName:s.name,academicYear:record.academicYear||s.academicYear,term:record.term||s.term};
        if(changed(`recitations/${rid}`,body))ops.push(batch=>batch.set(db.collection('recitations').doc(rid),{...body,updatedAt:serverTime()},{merge:true}));
      });
    }

    async function commitOperations(operations,chunkSize=380){
      const queue=operations.slice();
      while(queue.length){
        const batch=db.batch();queue.splice(0,chunkSize).forEach(write=>write(batch));await batch.commit();
      }
    }

    async function syncPayloadToCollections(payload){
      const data=payload||{};const ops=[];
      (data.students||[]).forEach(st=>pushStudentOps(ops,st));
      (data.bookings||[]).forEach(item=>{
        const id=cleanDocId(item.code||item.id||`${Date.now()}`);const full={...item,id:item.id||id,code:item.code||id,updatedAt:serverTime()};
        ops.push(batch=>batch.set(db.collection('bookings').doc(id),full,{merge:true}));
        ops.push(batch=>batch.set(db.collection('booking_status').doc(id),publicBookingStatusPayload(full),{merge:true}));
      });
      const mappings=[['materials','title'],['questions','title'],['exams','title'],['reviews','name'],['groups','name'],['assignments','title']];
      mappings.forEach(([collection,fallback])=>(data[collection]||[]).forEach(item=>{
        const id=cleanDocId(item.id||item[fallback]||`${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
        const body={...item,id,updatedAt:serverTime()};if(collection==='reviews')body.approved=item.approved===true;
        ops.push(batch=>batch.set(db.collection(collection).doc(id),body,{merge:true}));
      }));
      (data.grades||[]).forEach(item=>{
        const id=cleanDocId(item.id||`${item.studentCode||'student'}_${item.examId||item.exam||'exam'}_${item.date||Date.now()}`);
        ops.push(batch=>batch.set(db.collection('grades').doc(id),{...item,id,updatedAt:serverTime()},{merge:true}));
      });
      (data.examAttempts||[]).forEach(item=>{
        const id=cleanDocId(item.id||`${item.examId||'exam'}_${item.studentCode||'student'}_${Date.now()}`);
        const studentCode=normalizeCode(item.studentCode||'');
        ops.push(batch=>batch.set(db.collection('exam_attempts').doc(id),{...item,id,studentCode,updatedAt:serverTime()},{merge:true}));
        if(studentCode){
          const parent=db.collection('student_attempts').doc(cleanDocId(studentCode));
          const summary={id,studentCode,examId:item.examId||'',examTitle:item.examTitle||item.exam||'امتحان',submittedAt:item.submittedAt||item.date||'',score:item.score??null,autoScore:item.autoScore??null,needsManualReview:item.needsManualReview===true,status:item.status||'',academicYear:item.academicYear||'',term:item.term||''};
          ops.push(batch=>batch.set(parent,{studentCode,lastAttempt:summary,updatedAt:serverTime()},{merge:true}));
          ops.push(batch=>batch.set(parent.collection('attempts').doc(id),summary,{merge:true}));
        }
      });
      ops.push(batch=>batch.set(platformSettingsDoc,{...(data.settings||{}),schemaVersion:54,updatedAt:serverTime()},{merge:true}));
      await commitOperations(ops);
    }

    async function getDocs(collection,limit){
      const ref=limit?db.collection(collection).limit(limit):db.collection(collection);
      const snap=await ref.get();return snap.docs.map(doc=>({id:doc.id,...doc.data()}));
    }
    async function getSettings(){const snap=await platformSettingsDoc.get().catch(()=>null);return snap?.exists?snap.data():{};}
    async function getApprovedReviews(){const snap=await db.collection('reviews').where('approved','==',true).limit(100).get();return snap.docs.map(doc=>({id:doc.id,...doc.data()}));}

    async function loadPublicCollections(){
      const [materials,questions,reviews,groups,assignments,settings]=await Promise.all([
        getDocs('materials').catch(()=>[]),getDocs('questions').catch(()=>[]),getApprovedReviews().catch(()=>[]),
        getDocs('groups').catch(()=>[]),getDocs('assignments').catch(()=>[]),getSettings().catch(()=>({}))
      ]);
      return {students:[],bookings:[],materials,questions,exams:[],reviews,groups,assignments,examAttempts:[],grades:[],settings};
    }

    async function loadStaffCollections(){
      const [students,bookings,materials,questions,exams,reviews,groups,assignments,attempts,grades,attendance,recitations,homeworks,payments,settings]=await Promise.all([
        getDocs('students').catch(()=>[]),getDocs('bookings').catch(()=>[]),getDocs('materials').catch(()=>[]),getDocs('questions').catch(()=>[]),
        getDocs('exams').catch(()=>[]),getDocs('reviews').catch(()=>[]),getDocs('groups').catch(()=>[]),getDocs('assignments').catch(()=>[]),
        getDocs('exam_attempts',3000).catch(()=>[]),getDocs('grades',5000).catch(()=>[]),getDocs('attendance',5000).catch(()=>[]),
        getDocs('recitations',3000).catch(()=>[]),getDocs('homework_submissions',3000).catch(()=>[]),getDocs('payments',3000).catch(()=>[]),getSettings().catch(()=>({}))
      ]);
      const normalized=students.map(normalizedStudent);const map=new Map(normalized.map(st=>[st.studentCode,st]));
      const ensure=code=>map.get(normalizeCode(code||''));
      attendance.forEach(row=>{const st=ensure(row.studentCode||row.studentId);if(st)st.attendance.push(row);});
      grades.forEach(row=>{const st=ensure(row.studentCode||row.code);if(st)st.grades.push(row);});
      recitations.forEach(row=>{const st=ensure(row.studentCode);if(st)st.recitations.push(row);});
      homeworks.forEach(row=>{const st=ensure(row.studentCode);if(st)st.homeworks.push(row);});
      payments.forEach(row=>{const st=ensure(row.studentCode||row.studentId);if(st){st.paid=row.paid===true;st.paymentDate=row.paymentDate||st.paymentDate;}});
      normalized.forEach(st=>{
        st.attendance.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
        st.grades.sort((a,b)=>String(a.date||a.submittedAt||'').localeCompare(String(b.date||b.submittedAt||'')));
      });
      normalized.forEach(st=>{
        const id=cleanDocId(st.studentCode);seedFingerprint('students',id,studentProfile(st));seedFingerprint('student_portal',id,studentProfile(st));
        if(st.parentCode)seedFingerprint('parent_portal',cleanDocId(st.parentCode),studentProfile(st));
      });
      bookings.forEach(item=>seedFingerprint('bookings',cleanDocId(item.code||item.id),item));
      attendance.forEach(item=>seedFingerprint('attendance',cleanDocId(item.id),item));
      grades.forEach(item=>seedFingerprint('grades',cleanDocId(item.id),item));
      recitations.forEach(item=>seedFingerprint('recitations',cleanDocId(item.id),item));
      payments.forEach(item=>seedFingerprint('payments',cleanDocId(item.studentCode||item.studentId||item.id),item));
      return {students:normalized,bookings,materials,questions,exams,reviews,groups,assignments,examAttempts:attempts,grades,settings};
    }

    async function loadFromCollections(){const profile=await getCurrentStaffProfile().catch(()=>null);return profile?.allowed?loadStaffCollections():loadPublicCollections();}

    async function createStudentAccessDirect(student){
      const profile=await getCurrentStaffProfile();if(!profile?.allowed)throw new Error('Not authorized');
      let studentCode='',parentCode='';
      for(let i=0;i<12&&!studentCode;i+=1){const code=randomNumericAccessCode();if(!(await db.collection('student_portal').doc(code).get()).exists)studentCode=code;}
      for(let i=0;i<12&&!parentCode;i+=1){const code=randomNumericAccessCode();if(code!==studentCode&&!(await db.collection('parent_portal').doc(code).get()).exists)parentCode=code;}
      if(!studentCode||!parentCode)throw new Error('تعذر إنشاء أكواد جديدة');
      const source=normalizedStudent({...student,studentCode,code:studentCode,parentCode,active:student?.active!==false});
      const ops=[];pushStudentOps(ops,source);await commitOperations(ops);return {...studentProfile(source),studentCode,code:studentCode,parentCode};
    }

    async function upsertAttendance(record){
      const docId=cleanDocId(record.id||`${record.studentId||record.studentCode}_${record.date}`);
      const payload={...record,id:docId,updatedAt:serverTime()};
      await db.collection('attendance').doc(docId).set(payload,{merge:true});return {id:docId,...payload};
    }
    async function getAttendanceForDate(date,grade,group){
      let query=db.collection('attendance').where('date','==',date);if(grade&&grade!=='all')query=query.where('grade','==',grade);if(group&&group!=='all')query=query.where('group','==',group);
      const snap=await query.get();return snap.docs.map(doc=>({id:doc.id,...doc.data()}));
    }
    async function logActivity(action,meta){
      const profile=await getCurrentStaffProfile().catch(()=>null);if(!profile?.allowed)return;
      await db.collection('activityLog').add({action:String(action||'').slice(0,300),meta:meta&&typeof meta==='object'?meta:{},actorUid:profile.uid,actorEmail:profile.email||'',actorRole:profile.role||'',createdAt:serverTime()});
    }
    async function deleteCollectionDocs(ref,pageSize=300){
      while(true){const snap=await ref.limit(pageSize).get();if(snap.empty)break;const batch=db.batch();snap.docs.forEach(doc=>batch.delete(doc.ref));await batch.commit();if(snap.size<pageSize)break;}
    }
    async function deleteWhere(collection,field,value){
      const snap=await db.collection(collection).where(field,'==',value).get();const ops=[];snap.forEach(doc=>ops.push(batch=>batch.delete(doc.ref)));await commitOperations(ops);
    }

    window.MFCloud={
      ready:true,app,auth,db,storage,functions,cleanDocId,normalizePhoneDigits:digits,currentUser:()=>auth.currentUser,
      signIn:(email,password)=>auth.signInWithEmailAndPassword(email,password),signOut:()=>auth.signOut(),
      sendPasswordReset:email=>auth.sendPasswordResetEmail(String(email||'').trim()),getCurrentStaffProfile,
      loadSiteData:async()=>{
        const profile=await getCurrentStaffProfile().catch(()=>null);
        const data=await (profile?.allowed?loadStaffCollections():loadPublicCollections()).catch(()=>null);
        const hasData=data&&['students','bookings','materials','questions','exams','reviews','groups','assignments'].some(key=>Array.isArray(data[key])&&data[key].length);
        if(profile?.allowed&&!hasData){
          const legacy=await legacySiteDoc.get().catch(()=>null);
          if(legacy?.exists&&legacy.data().payload){
            await syncPayloadToCollections(legacy.data().payload);
            await db.collection('settings').doc('migration_v53').set({migratedAt:serverTime(),source:'settings/siteData',schemaVersion:53},{merge:true});
            await legacySiteDoc.delete().catch(()=>{});
            return loadStaffCollections();
          }
        }
        return data;
      },
      saveSiteData:async payload=>syncPayloadToCollections(payload),
      saveStudent:async student=>{const ops=[];pushStudentOps(ops,student);await commitOperations(ops);},
      saveGroup:async group=>{const id=cleanDocId(group?.id||'');if(!id)throw new Error('Invalid group');const profile=await getCurrentStaffProfile();if(!profile?.allowed||!['admin','teacher'].includes(profile.role))throw new Error('Not authorized');await db.collection('groups').doc(id).set({...group,id,updatedAt:serverTime()},{merge:true});return {...group,id};},
      deleteGroup:async id=>{const profile=await getCurrentStaffProfile();if(!profile?.allowed||!['admin','teacher'].includes(profile.role))throw new Error('Not authorized');await db.collection('groups').doc(cleanDocId(id)).delete();},
      createStudentAccess:async student=>{
        if(calls.createStudentAccess){try{return await calls.createStudentAccess(student);}catch(error){
          const raw=String(error?.code||'')+' '+String(error?.message||'');if(/invalid-argument|permission-denied|unauthenticated/i.test(raw))throw error;
        }}
        return createStudentAccessDirect(student);
      },
      createBooking:async booking=>{
        if(!calls.createBooking)throw new Error('Secure booking function is unavailable');
        return calls.createBooking(booking);
      },
      approveBooking:async code=>{
        if(!calls.approveBooking)throw new Error('Secure booking approval function is unavailable');
        return calls.approveBooking({code:normalizeCode(code)});
      },
      rejectBooking:async code=>{if(!calls.rejectBooking)throw new Error('Secure booking rejection function is unavailable');return calls.rejectBooking({code:normalizeCode(code)});},
      subscribeToBookings:handler=>db.collection('bookings').orderBy('createdAt','desc').limit(100).onSnapshot(snap=>handler(snap.docs.map(doc=>({id:doc.id,...doc.data()})),snap.docChanges()),error=>console.warn('booking-listener',error)),
      registerTeacherPushToken:async()=>{if(!cfg.messagingVapidKey||!firebase.messaging||!calls.registerTeacherPushToken)throw new Error('VAPID_KEY_REQUIRED');const registration=await navigator.serviceWorker.ready;const token=await firebase.messaging().getToken({vapidKey:cfg.messagingVapidKey,serviceWorkerRegistration:registration});if(!token)throw new Error('TOKEN_UNAVAILABLE');return calls.registerTeacherPushToken({token,userAgent:navigator.userAgent});},
      getBookingStatus:async code=>{
        const normalized=normalizeCode(code);
        if(calls.getBookingStatus){try{return await calls.getBookingStatus({code:normalized});}catch(error){
          const raw=String(error?.code||'')+' '+String(error?.message||'');if(/invalid-argument|resource-exhausted/i.test(raw))throw error;
        }}
        const snap=await db.collection('booking_status').doc(cleanDocId(normalized)).get();return snap.exists?{code:normalized,...snap.data()}:null;
      },
      saveReview:async review=>{if(!calls.createReview)throw new Error('Secure review function is unavailable');return calls.createReview(review);},
      getExamDashboard:async studentCode=>{if(!calls.getExamDashboard)throw new Error('Secure exam dashboard function is unavailable');return calls.getExamDashboard({studentCode:normalizeCode(studentCode)});},
      startSecureExam:async(examId,studentCode)=>{if(!calls.startExam)throw new Error('Secure start exam function is unavailable');return calls.startExam({examId,studentCode:normalizeCode(studentCode)});},
      submitSecureExam:async(sessionId,studentCode,answers)=>{if(!calls.submitExam)throw new Error('Secure submit exam function is unavailable');return calls.submitExam({sessionId,studentCode:normalizeCode(studentCode),answers});},
      saveExamAttempt:async attempt=>{
        const profile=await getCurrentStaffProfile();if(!profile?.allowed)throw new Error('Not authorized');
        const id=cleanDocId(attempt.id||`${attempt.examId}_${attempt.studentCode}`),studentCode=normalizeCode(attempt.studentCode||'');const ops=[];
        ops.push(batch=>batch.set(db.collection('exam_attempts').doc(id),{...attempt,id,studentCode,updatedAt:serverTime()},{merge:true}));
        if(studentCode){const parent=db.collection('student_attempts').doc(cleanDocId(studentCode));const summary={id,studentCode,examId:attempt.examId||'',examTitle:attempt.examTitle||attempt.exam||'امتحان',submittedAt:attempt.submittedAt||attempt.date||nowIso(),score:attempt.score??null,autoScore:attempt.autoScore??null,needsManualReview:attempt.needsManualReview===true,status:attempt.status||'',academicYear:attempt.academicYear||'',term:attempt.term||''};ops.push(batch=>batch.set(parent,{studentCode,lastAttempt:summary,updatedAt:serverTime()},{merge:true}));ops.push(batch=>batch.set(parent.collection('attempts').doc(id),summary,{merge:true}));}
        await commitOperations(ops);
      },
      upsertAttendance,getAttendanceForDate,
      getStudentByCode:code=>{if(!calls.getPortalStudent)throw new Error('Secure student portal function is unavailable');return calls.getPortalStudent({code:normalizeCode(code),mode:'student'});},
      getPublicLeaderboard:()=>calls.getPublicLeaderboard?calls.getPublicLeaderboard({}):Promise.resolve([]),
      getParentStudent:code=>{if(!calls.getPortalStudent)throw new Error('Secure parent portal function is unavailable');return calls.getPortalStudent({code:normalizeCode(code),mode:'parent'});},
      uploadHomework:async(file,studentCode)=>{const normalized=normalizeCode(studentCode);if(!calls.registerHomeworkSubmission)throw new Error('Secure homework function is unavailable');const uploaded=await upload(file,`homework/${cleanDocId(normalized)}`);await calls.registerHomeworkSubmission({studentCode:normalized,...uploaded});return uploaded;},
      uploadAttachment:(file,folder)=>upload(file,folder||'teacher-uploads'),logActivity,
      reportClientError:payload=>calls.reportClientError?calls.reportClientError(payload):Promise.resolve(null),
      deleteDocument:async(collection,id)=>{if(collection&&id)await db.collection(collection).doc(cleanDocId(id)).delete();},
      deleteStudentSafely:async student=>{if(!calls.deleteStudentSafely)throw new Error('Safe deletion function is unavailable');return calls.deleteStudentSafely({studentCode:normalizeCode(student?.studentCode||student?.code||student?.id)});},
      deleteStudentPortals:async student=>window.MFCloud.deleteStudentSafely(student),
      migrateStudentCode:async(oldCode,newCode,student)=>{
        const oldId=cleanDocId(normalizeCode(oldCode)),newId=cleanDocId(normalizeCode(newCode));if(!oldId||!newId||oldId===newId)return;
        const profile=await getCurrentStaffProfile();if(!profile?.allowed)throw new Error('Not authorized');
        const oldAttempts=db.collection('student_attempts').doc(oldId),newAttempts=db.collection('student_attempts').doc(newId);
        const [summary,summaryDocs,attempts,grades,attendance,homeworks,recitations]=await Promise.all([
          oldAttempts.get().catch(()=>null),oldAttempts.collection('attempts').get().catch(()=>null),db.collection('exam_attempts').where('studentCode','==',normalizeCode(oldCode)).get().catch(()=>null),
          db.collection('grades').where('studentCode','==',normalizeCode(oldCode)).get().catch(()=>null),db.collection('attendance').where('studentCode','==',normalizeCode(oldCode)).get().catch(()=>null),
          db.collection('homework_submissions').where('studentCode','==',normalizeCode(oldCode)).get().catch(()=>null),db.collection('recitations').where('studentCode','==',normalizeCode(oldCode)).get().catch(()=>null)
        ]);
        const ops=[];if(summary?.exists)ops.push(batch=>batch.set(newAttempts,{...summary.data(),studentCode:normalizeCode(newCode),updatedAt:serverTime()},{merge:true}));
        summaryDocs?.forEach(doc=>{ops.push(batch=>batch.set(newAttempts.collection('attempts').doc(doc.id),{...doc.data(),studentCode:normalizeCode(newCode)},{merge:true}));ops.push(batch=>batch.delete(doc.ref));});if(summary?.exists)ops.push(batch=>batch.delete(summary.ref));
        [attempts,grades,attendance,homeworks,recitations].forEach(snap=>snap?.forEach(doc=>ops.push(batch=>batch.update(doc.ref,{studentCode:normalizeCode(newCode),updatedAt:serverTime()}))));
        ops.push(batch=>batch.delete(db.collection('students').doc(oldId)));ops.push(batch=>batch.delete(db.collection('student_portal').doc(oldId)));ops.push(batch=>batch.delete(db.collection('payments').doc(oldId)));await commitOperations(ops);
        if(student){const writes=[];pushStudentOps(writes,student);await commitOperations(writes);}
      },
      getActivityLog:async(limit=50)=>{const snap=await db.collection('activityLog').orderBy('createdAt','desc').limit(Math.min(Number(limit)||50,200)).get();return snap.docs.map(doc=>({id:doc.id,...doc.data()}));},
      getClientErrors:async(limit=100)=>{const snap=await db.collection('client_errors').orderBy('createdAt','desc').limit(Math.min(Number(limit)||100,300)).get();return snap.docs.map(doc=>({id:doc.id,...doc.data()}));},
      deleteClientError:id=>db.collection('client_errors').doc(cleanDocId(id)).delete(),
      clearClientErrors:async()=>deleteCollectionDocs(db.collection('client_errors')),
      createBackupNow:()=>{if(!calls.createBackupNow)throw new Error('Backup function unavailable');return calls.createBackupNow({});},
      listAutomaticBackups:()=>{if(!calls.listAutomaticBackups)throw new Error('Backup function unavailable');return calls.listAutomaticBackups({});},
      getBackupDownloadUrl:name=>{if(!calls.getBackupDownloadUrl)throw new Error('Backup function unavailable');return calls.getBackupDownloadUrl({name});},
      restoreAutomaticBackup:name=>{if(!calls.restoreAutomaticBackup)throw new Error('Restore function unavailable');return calls.restoreAutomaticBackup({name,confirmation:'RESTORE-V54'});},
      deleteWhere
    };
  }catch(error){console.error(error);window.MFCloud={ready:false,error};}
})();
