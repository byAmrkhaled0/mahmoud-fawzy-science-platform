(function(){
  const cfg = window.MF_FIREBASE_CONFIG || {};
  if(!cfg.enabled){ window.MFCloud = { ready:false }; return; }
  if(!window.firebase){ console.warn('Firebase SDK not loaded'); window.MFCloud = { ready:false }; return; }
  try{
    const app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

    // Main backup document. It is inside settings because Firestore Rules allow admin write and public read.
    const siteDoc = db.collection('settings').doc('siteData');

    function cleanDocId(value, fallback){
      const raw = String(value || fallback || Date.now()).trim();
      return raw.replace(/[\\/#?\[\]]/g,'-').slice(0,140) || String(Date.now());
    }

    async function getRole(){
      const user = auth.currentUser;
      if(!user) return null;
      try{
        const snap = await db.collection('users').doc(user.uid).get();
        return snap.exists ? snap.data() : null;
      }catch(e){
        console.warn('Unable to read user role', e);
        return null;
      }
    }

    async function upload(file, basePath){
      const cleanName = String(file.name || 'file').replace(/[^a-zA-Z0-9._-]/g,'-');
      const path = `${basePath}/${Date.now()}-${cleanName}`;
      const ref = storage.ref(path);
      await ref.put(file, { contentType: file.type || undefined });
      const url = await ref.getDownloadURL();
      return { url, path, fileName:file.name, contentType:file.type || '', size:file.size || 0 };
    }

    async function batchSetCollection(batch, collection, items, idGetter, extraGetter){
      (items || []).forEach((item, index)=>{
        const id = cleanDocId(idGetter(item, index), `${collection}-${index}`);
        const ref = db.collection(collection).doc(id);
        batch.set(ref, {
          ...item,
          ...(extraGetter ? extraGetter(item, index) : {}),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });
      });
    }

    async function mirrorPayloadToCollections(payload){
      const user = auth.currentUser;
      if(!user) return;
      const role = await getRole();
      if(!role || !['admin','assistant'].includes(role.role)) return;

      const batch = db.batch();

      await batchSetCollection(batch, 'students', payload.students, s=>s.code, s=>({
        studentCode: s.code,
        paid: !!s.paid,
        paymentStatus: s.paid ? 'تم الدفع' : 'لم يدفع'
      }));

      await batchSetCollection(batch, 'bookings', payload.bookings, b=>b.code || b.id);
      await batchSetCollection(batch, 'materials', payload.materials, m=>m.id);
      await batchSetCollection(batch, 'questions', payload.questions, q=>q.id);
      await batchSetCollection(batch, 'exams', payload.exams, e=>e.id);
      await batchSetCollection(batch, 'reviews', payload.reviews, r=>r.id);
      await batchSetCollection(batch, 'exam_attempts', payload.examAttempts, a=>`${a.studentCode || 'student'}-${a.examId || a.examTitle || 'exam'}-${a.date || Date.now()}`);
      await batchSetCollection(batch, 'groups', payload.groups, g=>g.id || g.name);
      await batchSetCollection(batch, 'assignments', payload.assignments, a=>a.id || a.title);

      // Flatten student attendance, grades, payments and homework so they appear as real Firestore collections.
      (payload.students || []).forEach(st=>{
        (st.attendance || []).forEach((a, i)=>{
          const ref = db.collection('attendance').doc(cleanDocId(`${st.code}-${a.date || i}`));
          batch.set(ref, {
            studentCode: st.code,
            studentName: st.name,
            grade: st.grade,
            date: a.date || '',
            status: a.status || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge:true });
        });
        (st.grades || []).forEach((g, i)=>{
          const ref = db.collection('grades').doc(cleanDocId(`${st.code}-${g.exam || i}`));
          batch.set(ref, {
            studentCode: st.code,
            studentName: st.name,
            grade: st.grade,
            exam: g.exam || '',
            score: g.score ?? null,
            type: g.type || '',
            date: g.date || '',
            status: g.status || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge:true });
        });
        const payRef = db.collection('payments').doc(cleanDocId(st.code));
        batch.set(payRef, {
          studentCode: st.code,
          studentName: st.name,
          grade: st.grade,
          month: st.month || '',
          paid: !!st.paid,
          status: st.paid ? 'تم الدفع' : 'لم يدفع',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });
        (st.homeworks || []).forEach((h, i)=>{
          const ref = db.collection('homework_submissions').doc(cleanDocId(`${st.code}-${h.title || i}`));
          batch.set(ref, {
            studentCode: st.code,
            studentName: st.name,
            grade: st.grade,
            title: h.title || '',
            status: h.status || '',
            fileName: h.fileName || '',
            fileUrl: h.fileUrl || h.fileData || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge:true });
        });
        (st.recitations || []).forEach((r, i)=>{
          const ref = db.collection('recitations').doc(cleanDocId(`${st.code}-${r.date || i}-${r.lesson || 'lesson'}`));
          batch.set(ref, {
            studentCode: st.code,
            studentName: st.name,
            grade: st.grade,
            lesson: r.lesson || '',
            date: r.date || '',
            status: r.status || '',
            attendanceStatus: r.attendanceStatus || '',
            note: r.note || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge:true });
        });
      });

      await batch.commit();
    }

    async function loadFromCollections(){
      const [students, bookings, materials, questions, exams, reviews, groups, assignments] = await Promise.all([
        db.collection('students').get().catch(()=>null),
        db.collection('bookings').get().catch(()=>null),
        db.collection('materials').get().catch(()=>null),
        db.collection('questions').get().catch(()=>null),
        db.collection('exams').get().catch(()=>null),
        db.collection('reviews').get().catch(()=>null),
        db.collection('groups').get().catch(()=>null),
        db.collection('assignments').get().catch(()=>null)
      ]);
      const toArr = snap => snap ? snap.docs.map(d=>({id:d.id, ...d.data()})) : [];
      const data = {
        students: toArr(students).map(s=>({code:s.code || s.studentCode || s.id, ...s})),
        bookings: toArr(bookings),
        materials: toArr(materials),
        questions: toArr(questions),
        exams: toArr(exams),
        reviews: toArr(reviews),
        groups: toArr(groups),
        assignments: toArr(assignments)
      };
      return (data.students.length || data.bookings.length || data.materials.length || data.questions.length || data.exams.length || data.reviews.length || data.groups.length || data.assignments.length) ? data : null;
    }

    window.MFCloud = {
      ready:true,
      app, auth, db, storage,
      currentUser:()=>auth.currentUser,
      signIn:(email,password)=>auth.signInWithEmailAndPassword(email,password),
      signUp:(email,password)=>auth.createUserWithEmailAndPassword(email,password),
      signOut:()=>auth.signOut(),
      loadSiteData: async()=>{
        const snap = await siteDoc.get();
        if(snap.exists && snap.data().payload) return snap.data().payload;
        return await loadFromCollections();
      },
      saveSiteData: async(payload)=>{
        await siteDoc.set({payload, updatedAt: firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
        await mirrorPayloadToCollections(payload);
      },
      createBooking: async(booking)=>{
        const id = cleanDocId(booking.code || booking.id);
        await db.collection('bookings').doc(id).set({
          ...booking,
          id: booking.id || id,
          code: booking.code || id,
          status: booking.status || 'حجز جديد',
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });
      },
      syncCollections: mirrorPayloadToCollections,
      uploadHomework: async(file,studentCode)=>{
        const up = await upload(file,`homework/${studentCode}`);
        try{
          await db.collection('homework_submissions').add({
            studentCode,
            fileName: up.fileName,
            fileUrl: up.url,
            filePath: up.path,
            contentType: up.contentType,
            size: up.size,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }catch(e){ console.warn('Homework submission mirror failed', e); }
        return up;
      },
      uploadAttachment:(file,folder)=>upload(file,folder||'public/uploads'),
      deleteDocument: async(collection,id)=>{
        if(!collection || !id) return;
        await db.collection(collection).doc(cleanDocId(id)).delete();
      },
      deleteWhere: async(collection,field,value)=>{
        if(!collection || !field || value===undefined || value===null) return;
        const snap = await db.collection(collection).where(field,'==',value).get();
        if(snap.empty) return;
        const batch = db.batch();
        snap.forEach(doc=>batch.delete(doc.ref));
        await batch.commit();
      }
    };
    console.info('Firebase connected with real Firestore collections: mahmoud-fawzy-science-platform');
  }catch(err){
    console.warn('Firebase init failed',err);
    window.MFCloud = { ready:false, error: err };
  }
})();
