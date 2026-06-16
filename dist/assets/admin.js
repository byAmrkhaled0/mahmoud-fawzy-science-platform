let adminData = loadData();
let currentSection = 'overview';
const adminSections = [
  ['overview','bar-chart','نظرة عامة'],
  ['students','users','الطلاب'],
  ['bookings','calendar','الحجوزات'],
  ['attendance','user-check','حضور وتسميع'],
  ['payments','database','المدفوعات'],
  ['materials','book-open','مراجعات العلوم'],
  ['questions','help-circle','بنك الأسئلة'],
  ['exams','clipboard','الامتحانات'],
  ['reviews','star','التقييمات'],
  ['settings','sparkles','إعدادات الموقع']
];
function aToast(msg){toast(msg)}
function esc(v){return String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
function fresh(){adminData=loadData();}
function persist(msg){saveData(adminData); if(msg)aToast(msg);}
function cloudDelete(collection,id){
  if(window.MFCloud?.deleteDocument) return window.MFCloud.deleteDocument(collection,id).catch(e=>{console.warn('Firestore delete failed',collection,id,e); aToast('تم الحذف محليًا لكن تعذر الحذف من Firestore');});
}
function cloudDeleteWhere(collection,field,value){
  if(window.MFCloud?.deleteWhere) return window.MFCloud.deleteWhere(collection,field,value).catch(e=>{console.warn('Firestore delete query failed',collection,field,value,e); aToast('تم الحذف محليًا لكن تعذر تحديث Firestore');});
}
window.forceFirestoreSync=async function(){ fresh(); if(!window.MFCloud?.syncCollections){ return aToast('Firebase غير مفعل في هذه النسخة'); } try{ await window.MFCloud.saveSiteData(adminData); aToast('تمت مزامنة البيانات مع Firestore'); }catch(e){ console.warn(e); aToast('تعذر المزامنة: راجع Rules أو Console'); } };
function fileToData(file){return new Promise(async (resolve)=>{if(!file || !file.name){resolve({fileName:'',fileData:'',fileUrl:'',filePath:''});return;} if(window.MFCloud?.uploadAttachment){try{const up=await window.MFCloud.uploadAttachment(file,'teacher-uploads'); resolve({fileName:file.name,fileData:up.url,fileUrl:up.url,filePath:up.path}); return;}catch(e){console.warn('Firebase upload failed',e);}} const reader=new FileReader(); reader.onload=()=>resolve({fileName:file.name,fileData:reader.result,fileUrl:'',filePath:''}); reader.onerror=()=>resolve({fileName:file.name,fileData:'',fileUrl:'',filePath:''}); reader.readAsDataURL(file);});}
function adminLogin(){
  const form=document.getElementById('loginForm');
  document.getElementById('fakeSignup')?.addEventListener('click',async()=>{
    const fd=new FormData(form); const email=fd.get('email'); const pass=fd.get('password');
    if(window.MFCloud?.signUp){try{await window.MFCloud.signUp(email,pass); renderAdmin(); aToast('تم إنشاء حساب المدرس'); return;}catch(err){aToast('تعذر إنشاء الحساب: '+(err.message||'راجع إعدادات Firebase')); return;}}
    aToast('فعّل Firebase لإنشاء حساب حقيقي');
  });
  form?.addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(form); const email=fd.get('email'); const pass=fd.get('password');
    if(window.MFCloud?.signIn){try{await window.MFCloud.signIn(email,pass); if(window.MFCloud?.syncCollections){ try{ await window.MFCloud.syncCollections(adminData); }catch(e){ console.warn('Initial Firestore sync failed', e); } } renderAdmin(); aToast('تم الدخول ومزامنة Firestore'); return;}catch(err){aToast('بيانات الدخول غير صحيحة'); return;}}
    if(email==='teacher@mahmoud.local' && pass==='123456'){renderAdmin(); aToast('تم الدخول إلى لوحة المدرس');} else {aToast('بيانات الدخول غير صحيحة');}
  });
}
function renderAdmin(){
  const root=document.getElementById('adminRoot');
  root.className='admin-page';
  root.innerHTML=`<aside class="admin-sidebar"><div class="logo"><span class="logo-mark" data-icon="atom"></span><span>لوحة مستر محمود <small>تحكم كامل في الموقع</small></span></div><div class="admin-nav">${adminSections.map(([id,ic,name])=>`<button data-admin-nav="${id}" class="${id===currentSection?'active':''}"><span data-icon="${ic}"></span>${name}</button>`).join('')}</div><div style="margin-top:20px"><button class="btn ghost" style="width:100%" onclick="location.href='index.html'"><span data-icon="external-link"></span> معاينة الموقع</button></div></aside><main class="admin-main"><div class="admin-top"><div><span class="kicker"><span data-icon="sparkles"></span> Admin Dashboard</span><h1 class="section-title" style="font-size:2.45rem">لوحة تحكم مستر محمود ابراهيم فوزي</h1></div><div class="header-actions"><button class="theme-toggle" id="themeToggleAdmin"></button><button class="btn ghost" onclick="forceFirestoreSync()"><span data-icon="database"></span> مزامنة Firebase</button><button class="btn dark" onclick="location.reload()">خروج</button></div></div><div id="adminContent"></div></main>`;
  hydrateIcons(); setupAdminTheme(); bindNav(); renderSection();
}
function setupAdminTheme(){const btn=document.getElementById('themeToggleAdmin'); const root=document.documentElement; const render=()=>{btn.innerHTML=root.dataset.theme==='dark'?icons.sun:icons.moon}; render(); btn.addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark'; localStorage.setItem('mf_theme_v12',root.dataset.theme); render();});}
function bindNav(){document.querySelectorAll('[data-admin-nav]').forEach(btn=>btn.addEventListener('click',()=>{currentSection=btn.dataset.adminNav; document.querySelectorAll('[data-admin-nav]').forEach(b=>b.classList.toggle('active',b===btn)); renderSection();}));}
function content(html){document.getElementById('adminContent').innerHTML=html; hydrateIcons();}
function stats(){fresh(); const bookings=adminData.bookings.length; const unpaid=adminData.students.filter(s=>!s.paid).length; const paid=adminData.students.filter(s=>s.paid).length; const attendToday=adminData.students.filter(s=>(s.attendance||[]).some(a=>a.date===today() && a.status==='حاضر')).length; return {bookings,unpaid,paid,attendToday,total:adminData.students.length};}
function gradeCounts(){return GRADES.map(g=>({grade:g,count:adminData.students.filter(s=>s.grade===g).length}));}
function renderOverview(){const s=stats(); const max=Math.max(...gradeCounts().map(x=>x.count),1); content(`<div class="grid grid-4"><div class="card"><span class="iconbox" data-icon="users"></span><h3>إجمالي الطلاب</h3><div class="section-title" style="font-size:2.2rem">${s.total}</div></div><div class="card"><span class="iconbox" data-icon="calendar"></span><h3>حجوزات جديدة</h3><div class="section-title" style="font-size:2.2rem">${s.bookings}</div></div><div class="card"><span class="iconbox" data-icon="database"></span><h3>تم الدفع</h3><div class="section-title" style="font-size:2.2rem;color:var(--green)">${s.paid}</div></div><div class="card"><span class="iconbox" data-icon="user-check"></span><h3>حضور اليوم</h3><div class="section-title" style="font-size:2.2rem">${s.attendToday}</div></div></div><div class="grid grid-2" style="margin-top:18px"><div class="card"><h3>عدد الطلاب حسب الصف</h3>${gradeCounts().map(x=>`<div style="margin:14px 0"><div style="display:flex;justify-content:space-between;font-weight:1000"><span>${x.grade}</span><span>${x.count}</span></div><div class="progress"><span style="width:${Math.round(x.count/max*100)}%"></span></div></div>`).join('')}</div><div class="card"><h3>تنبيهات سريعة</h3><p><span class="badge danger">${s.unpaid} طالب لم يدفعوا</span></p><p><span class="badge warn">راجع الطلاب منخفضي الحضور</span></p><p><span class="badge good">استخدم الأقسام لإضافة أو حذف المحتوى</span></p></div></div>`);}
function studentRow(s){const c=calcStudent(s); return `<tr><td>${s.code}</td><td>${esc(s.name)}</td><td>${s.grade}</td><td>${s.month||'-'}</td><td>${c.attendancePct}%</td><td>${c.lastGrade?c.lastGrade.score+'%':'-'}</td><td><span class="badge ${c.final>=75?'good':c.final>=60?'warn':'danger'}">${c.level}</span></td><td><span class="badge ${s.paid?'good':'danger'}">${s.paid?'تم الدفع':'لم يدفع'}</span></td><td><button class="small-btn danger" onclick="deleteStudent('${s.code}')"><span data-icon="trash"></span> حذف</button></td></tr>`}
function studentsTable(){return `<div class="table-wrap"><table><thead><tr><th>الكود</th><th>الطالب</th><th>الصف</th><th>الشهر</th><th>الحضور</th><th>آخر درجة</th><th>المستوى</th><th>الدفع</th><th>إجراء</th></tr></thead><tbody>${adminData.students.map(studentRow).join('')||'<tr><td colspan="9">لا يوجد طلاب</td></tr>'}</tbody></table></div>`}
function renderStudents(){content(`<div class="section-head"><div><span class="kicker"><span data-icon="users"></span> إدارة الطلاب</span><h2 class="section-title">إضافة وحذف الطلاب</h2></div></div><div class="card" style="margin-bottom:18px"><form id="addStudentForm" class="grid grid-4"><input name="name" placeholder="اسم الطالب" required><input name="studentPhone" placeholder="رقم الطالب" required><input name="parentPhone" placeholder="رقم ولي الأمر" required><select name="grade">${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><input name="month" placeholder="الشهر" value="يونيو"><input name="group" placeholder="المجموعة" value="مجموعة السبت والثلاثاء"><button class="btn primary" type="submit"><span data-icon="user"></span> تسجيل طالب</button></form></div>${studentsTable()}`); document.getElementById('addStudentForm').addEventListener('submit',e=>{e.preventDefault(); const s=Object.fromEntries(new FormData(e.target).entries()); s.code=uid(); s.paid=false; s.attendance=[]; s.grades=[]; s.homeworks=[]; adminData.students.push(s); persist('تم تسجيل الطالب'); renderStudents();});}
window.deleteStudent=async function(code){if(!confirm('حذف الطالب وكل بياناته؟'))return; adminData.students=adminData.students.filter(s=>s.code!==code); adminData.bookings=adminData.bookings.filter(b=>b.code!==code); persist('تم حذف الطالب'); await Promise.all([cloudDelete('students',code),cloudDelete('bookings',code),cloudDelete('payments',code),cloudDeleteWhere('bookings','code',code),cloudDeleteWhere('attendance','studentCode',code),cloudDeleteWhere('grades','studentCode',code),cloudDeleteWhere('homework_submissions','studentCode',code)]); renderStudents();}
function renderBookings(){content(`<div class="section-head"><div><span class="kicker"><span data-icon="calendar"></span> الحجوزات الشهرية</span><h2 class="section-title">جدول الحجوزات حسب الصف</h2></div></div><div class="grid">${GRADES.map(g=>{const rows=adminData.bookings.filter(b=>b.grade===g);return `<div class="card"><h3>${g}</h3><div class="table-wrap"><table><thead><tr><th>الكود</th><th>الاسم</th><th>الشهر</th><th>المجموعة</th><th>ولي الأمر</th><th>إجراء</th></tr></thead><tbody>${rows.length?rows.map(b=>`<tr><td>${b.code}</td><td>${esc(b.name)}</td><td>${b.month}</td><td>${b.group}</td><td>${b.parentPhone}</td><td><button class="small-btn danger" onclick="deleteBooking('${b.code}')"><span data-icon="trash"></span> حذف</button></td></tr>`).join(''):'<tr><td colspan="6">لا توجد حجوزات لهذا الصف</td></tr>'}</tbody></table></div></div>`}).join('')}</div>`);}
window.deleteBooking=async function(code){adminData.bookings=adminData.bookings.filter(b=>b.code!==code); persist('تم حذف الحجز'); await Promise.all([cloudDelete('bookings',code),cloudDeleteWhere('bookings','code',code)]); renderBookings();}
function renderAttendance(){const rows=adminData.students.flatMap(s=>(s.attendance||[]).map((a,i)=>({s,a,i}))).slice(-40).reverse(); content(`<div class="section-head"><div><span class="kicker"><span data-icon="user-check"></span> الحضور والباركود</span><h2 class="section-title">تسجيل ومراجعة الحضور</h2></div></div><div class="portal-shell"><div class="card"><form id="attForm" class="grid"><div class="field"><label>كود الطالب</label><input name="code" placeholder="MF-SCI-1001" required></div><div class="grid grid-3"><button class="btn primary" name="status" value="حاضر"><span data-icon="user-check"></span> حاضر</button><button class="btn gold" name="status" value="متأخر">متأخر</button><button class="btn ghost" name="status" value="غائب">غائب</button></div></form></div><div class="card"><h3>سجلات الحضور</h3><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>التاريخ</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>${r.s.name}</td><td>${r.a.date}</td><td>${r.a.status}</td><td><button class="small-btn danger" onclick="deleteAttendance('${r.s.code}',${r.i})">حذف</button></td></tr>`).join(''):'<tr><td colspan="4">لا توجد سجلات</td></tr>'}</tbody></table></div></div></div>`); document.getElementById('attForm').addEventListener('submit',e=>{e.preventDefault(); const fd=new FormData(e.submitter.form); const st=adminData.students.find(s=>s.code===fd.get('code')); if(!st)return aToast('الكود غير موجود'); st.attendance=st.attendance||[]; st.attendance.push({date:today(),status:e.submitter.value}); persist('تم تسجيل الحضور'); renderAttendance();});}
window.deleteAttendance=async function(code,index){const st=adminData.students.find(s=>s.code===code); if(!st)return; const removed=(st.attendance||[])[index]; st.attendance.splice(index,1); persist('تم حذف السجل'); if(removed) await cloudDelete('attendance',`${code}-${removed.date||index}`); renderAttendance();}
function renderPayments(){content(`<div class="section-head"><div><span class="kicker"><span data-icon="database"></span> المدفوعات</span><h2 class="section-title">كل صف دراسي في جدول مستقل</h2></div></div><div class="grade-payment-list">${GRADES.map(g=>{const rows=adminData.students.filter(s=>s.grade===g); return `<div class="card payment-grade-card"><div class="profile-top"><h3>${g}</h3><span class="badge">${rows.length} طالب</span></div><div class="table-wrap"><table><thead><tr><th>الكود</th><th>الطالب</th><th>الشهر</th><th>ولي الأمر</th><th>الحالة</th><th>تحكم</th></tr></thead><tbody>${rows.length?rows.map(s=>`<tr><td>${s.code}</td><td>${s.name}</td><td>${s.month||'-'}</td><td>${s.parentPhone||'-'}</td><td><span class="badge ${s.paid?'good':'danger'}">${s.paid?'تم الدفع':'لم يدفع'}</span></td><td><button class="small-btn primary" onclick="togglePaid('${s.code}',true)">تم الدفع</button><button class="small-btn danger" onclick="togglePaid('${s.code}',false)">لم يدفع</button></td></tr>`).join(''):'<tr><td colspan="6">لا يوجد طلاب في هذا الصف</td></tr>'}</tbody></table></div></div>`}).join('')}</div>`);}
window.togglePaid=function(code,val){const st=adminData.students.find(s=>s.code===code); if(st){st.paid=val; persist(val?'تم تعليم الطالب: تم الدفع':'تم تعليم الطالب: لم يدفع'); renderPayments();}}
function fileInfoHtml(item){return item.fileData||item.fileUrl?attachmentHtml(item):(item.fileName?`<span class="badge"><span data-icon="file-text"></span>${item.fileName}</span>`:'');}
function itemCard(item,kind){const del=`<button class="small-btn danger" onclick="deleteContent('${kind}','${item.id}')"><span data-icon="trash"></span> حذف</button>`; if(kind==='materials')return `<div class="card"><h3>${esc(item.title)}</h3><p>${esc(item.desc||'')}</p>${item.content?`<div class="written-box">${esc(item.content)}</div>`:''}${fileInfoHtml(item)}<div class="admin-card-actions"><span class="badge">${item.grade}</span><span class="badge good">${item.type}</span>${del}</div></div>`; if(kind==='questions')return `<div class="card"><span class="badge">${item.grade}</span> <span class="badge warn">${esc(item.unit||'عام')}</span><h3>${esc(item.question)}</h3><p>${esc(item.answer)}</p>${fileInfoHtml(item)}<div class="admin-card-actions">${del}</div></div>`; return `<div class="card"><span class="badge ${item.status==='مفتوح'?'good':'warn'}">${item.status}</span><h3>${esc(item.title)}</h3><p>${item.grade} - ${item.questions||0} سؤال - ${item.duration||20} دقيقة</p>${item.text?`<div class="written-box">${esc(item.text)}</div>`:''}${fileInfoHtml(item)}<div class="admin-card-actions">${del}</div></div>`;}
window.deleteContent=async function(kind,id){const map={materials:'materials',questions:'questions',exams:'exams'}; const key=map[kind]; if(!key)return; adminData[key]=adminData[key].filter(x=>x.id!==id); persist('تم الحذف'); await cloudDelete(key,id); renderSection();}
function renderMaterials(){content(`<div class="section-head"><div><span class="kicker"><span data-icon="book-open"></span> المراجعات والملفات</span><h2 class="section-title">إضافة وحذف المراجعات</h2></div></div><div class="portal-shell"><form id="matForm" class="card grid"><input name="title" placeholder="عنوان الملف" required><select name="grade">${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><select name="type"><option>PDF</option><option>صورة</option><option>مراجعة مكتوبة</option><option>رابط فيديو</option></select><textarea name="desc" placeholder="وصف مختصر"></textarea><textarea name="content" placeholder="محتوى مكتوب"></textarea><input name="file" type="file" accept="image/*,.pdf"><button class="btn primary"><span data-icon="upload"></span> إضافة</button></form><div class="grid">${adminData.materials.map(m=>itemCard(m,'materials')).join('')||'<div class="card"><h3>لا توجد مراجعات</h3></div>'}</div></div>`); document.getElementById('matForm').addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(e.target); const f=await fileToData(fd.get('file')); adminData.materials.push({id:`mat-${Date.now()}`,title:fd.get('title'),grade:fd.get('grade'),type:fd.get('type'),desc:fd.get('desc'),content:fd.get('content'),...f}); persist('تم إضافة الملف'); renderMaterials();});}
function renderQuestions(){content(`<div class="section-head"><div><span class="kicker"><span data-icon="help-circle"></span> بنك الأسئلة</span><h2 class="section-title">إضافة وحذف الأسئلة</h2></div></div><div class="portal-shell"><form id="qForm" class="card grid"><select name="grade">${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><input name="unit" placeholder="الوحدة / الدرس"><textarea name="question" placeholder="السؤال" required></textarea><textarea name="answer" placeholder="الإجابة النموذجية" required></textarea><input name="file" type="file" accept="image/*,.pdf"><button class="btn primary"><span data-icon="upload"></span> إضافة</button></form><div class="grid">${adminData.questions.map(q=>itemCard(q,'questions')).join('')||'<div class="card"><h3>لا توجد أسئلة</h3></div>'}</div></div>`); document.getElementById('qForm').addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(e.target); const f=await fileToData(fd.get('file')); adminData.questions.push({id:`q-${Date.now()}`,grade:fd.get('grade'),unit:fd.get('unit'),question:fd.get('question'),answer:fd.get('answer'),...f}); persist('تم إضافة السؤال'); renderQuestions();});}
function renderAttemptsTable(){const attempts=adminData.examAttempts||[]; return `<div class="card" style="margin-top:18px"><h3>محاولات الامتحان الأونلاين</h3><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الامتحان</th><th>التاريخ</th><th>الحالة</th><th>محاولات خروج</th></tr></thead><tbody>${attempts.length?attempts.slice(-12).reverse().map(a=>`<tr><td>${a.studentName||a.studentCode}</td><td>${a.examTitle}</td><td>${a.date}</td><td>${a.status}</td><td>${a.exitCount||0}</td></tr>`).join(''):'<tr><td colspan="5">لا توجد محاولات حتى الآن</td></tr>'}</tbody></table></div></div>`;}
function renderExams(){content(`<div class="section-head"><div><span class="kicker"><span data-icon="clipboard"></span> الامتحانات الشهرية</span><h2 class="section-title">إضافة وحذف الامتحانات والدرجات</h2></div></div><div class="portal-shell"><form id="examForm" class="card grid"><input name="title" placeholder="عنوان الامتحان" required><select name="grade">${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><input name="date" type="date" required><input name="questions" type="number" placeholder="عدد الأسئلة" value="20"><input name="duration" type="number" placeholder="الوقت بالدقائق" value="20"><select name="status"><option>مفتوح</option><option>متاح قريبًا</option><option>مغلق</option></select><textarea name="instructions" placeholder="تعليمات الامتحان"></textarea><textarea name="text" placeholder="أسئلة الامتحان"></textarea><input name="file" type="file" accept="image/*,.pdf"><button class="btn primary"><span data-icon="upload"></span> إضافة امتحان</button></form><div class="grid">${adminData.exams.map(ex=>itemCard(ex,'exams')).join('')||'<div class="card"><h3>لا توجد امتحانات</h3></div>'}</div></div><div class="card" style="margin-top:18px"><h3>إضافة درجة طالب</h3><form id="gradeForm" class="grid grid-4"><input name="code" placeholder="كود الطالب" required><input name="exam" placeholder="اسم الامتحان" required><input name="score" type="number" min="0" max="100" placeholder="الدرجة" required><select name="type"><option>ورقي</option><option>أونلاين</option></select><button class="btn gold"><span data-icon="bar-chart"></span> حفظ الدرجة</button></form></div>${renderAttemptsTable()}`); document.getElementById('examForm').addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(e.target); const f=await fileToData(fd.get('file')); adminData.exams.push({id:`ex-${Date.now()}`,title:fd.get('title'),grade:fd.get('grade'),date:fd.get('date'),questions:fd.get('questions'),duration:Number(fd.get('duration')||20),status:fd.get('status'),instructions:fd.get('instructions'),text:fd.get('text'),...f}); persist('تم إضافة الامتحان'); renderExams();}); document.getElementById('gradeForm').addEventListener('submit',e=>{e.preventDefault(); const fd=Object.fromEntries(new FormData(e.target).entries()); const st=adminData.students.find(s=>s.code===fd.code); if(!st)return aToast('كود الطالب غير موجود'); st.grades=st.grades||[]; const existing=st.grades.find(g=>g.exam===fd.exam); if(existing){existing.score=Number(fd.score); existing.type=fd.type; existing.date=today(); existing.status='تم التصحيح';} else st.grades.push({exam:fd.exam,score:Number(fd.score),type:fd.type,date:today(),status:'تم التصحيح'}); persist('تم حفظ الدرجة'); e.target.reset();});}
function renderReviewsAdmin(){content(`<div class="section-head"><div><span class="kicker"><span data-icon="star"></span> تقييمات الطلاب</span><h2 class="section-title">مراجعة أو حذف التقييمات</h2></div></div><div class="grid grid-3">${adminData.reviews.map(r=>`<div class="card"><div class="review-stars">${stars(r.rating)}</div><h3>${esc(r.name)}</h3><span class="badge">${esc(r.role)}</span><p>${esc(r.text)}</p><button class="small-btn danger" onclick="deleteReview('${r.id}')"><span data-icon="trash"></span> حذف التقييم</button></div>`).join('')||'<div class="card"><h3>لا توجد تقييمات</h3></div>'}</div>`);}
window.deleteReview=async function(id){adminData.reviews=adminData.reviews.filter(r=>r.id!==id); persist('تم حذف التقييم'); await cloudDelete('reviews',id); renderReviewsAdmin();}
function renderSettings(){content(`<div class="section-head"><div><span class="kicker"><span data-icon="sparkles"></span> إعدادات الموقع</span><h2 class="section-title">تحكم في محتوى الصفحة الرئيسية</h2></div></div><div class="card"><form id="setForm" class="grid"><input name="heroTitle" value="${esc(adminData.settings?.heroTitle||'')}" placeholder="عنوان الهيرو"><button class="btn primary"><span data-icon="sparkles"></span> حفظ الإعدادات</button></form></div>`); document.getElementById('setForm').addEventListener('submit',e=>{e.preventDefault(); adminData.settings={...adminData.settings,...Object.fromEntries(new FormData(e.target).entries())}; persist('تم حفظ الإعدادات');});}
function renderSection(){fresh(); if(currentSection==='overview')renderOverview(); if(currentSection==='students')renderStudents(); if(currentSection==='bookings')renderBookings(); if(currentSection==='attendance')renderAttendance(); if(currentSection==='payments')renderPayments(); if(currentSection==='materials')renderMaterials(); if(currentSection==='questions')renderQuestions(); if(currentSection==='exams')renderExams(); if(currentSection==='reviews')renderReviewsAdmin(); if(currentSection==='settings')renderSettings();}
adminLogin();
hydrateIcons();

/* v13 pro admin overrides: filters, edit, export, booking workflow, review approval */
function adminLogin(){
  const form=document.getElementById('loginForm');
  document.getElementById('fakeSignup')?.addEventListener('click',async()=>{
    const fd=new FormData(form); const email=fd.get('email'); const pass=fd.get('password');
    if(!email || !pass) return aToast('اكتب البريد وكلمة المرور أولًا');
    if(window.MFCloud?.signUp){try{await window.MFCloud.signUp(email,pass); renderAdmin(); aToast('تم إنشاء الحساب من Firebase'); return;}catch(err){aToast('تعذر إنشاء الحساب: '+(err.message||'راجع إعدادات Firebase')); return;}}
    aToast('فعّل Firebase لإنشاء حساب حقيقي');
  });
  form?.addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(form); const email=fd.get('email'); const pass=fd.get('password');
    if(window.MFCloud?.signIn){try{await window.MFCloud.signIn(email,pass); if(window.MFCloud?.syncCollections){ try{ await window.MFCloud.syncCollections(adminData); }catch(e){ console.warn('Initial Firestore sync failed', e); } } renderAdmin(); aToast('تم الدخول ومزامنة Firestore'); return;}catch(err){aToast('بيانات الدخول غير صحيحة'); return;}}
    if(email==='teacher@mahmoud.local' && pass==='123456'){renderAdmin(); aToast('وضع تجريبي محلي فقط. اربطه بـ Firebase قبل التسليم.');} else {aToast('بيانات الدخول غير صحيحة أو Firebase غير مفعل');}
  });
}
function csvEscape(v){return '"'+String(v??'').replace(/"/g,'""')+'"';}
function downloadText(filename,text){const blob=new Blob([text],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href);}
function exportStudentsCSV(){fresh(); const headers=['الكود','الاسم','رقم الطالب','رقم ولي الأمر','الصف','الشهر','المجموعة','الدفع','ملاحظات']; const rows=adminData.students.map(s=>[s.code,s.name,s.studentPhone,s.parentPhone,s.grade,s.month,s.group,s.paid?'تم الدفع':'لم يدفع',s.notes]); downloadText('students.csv',[headers,...rows].map(r=>r.map(csvEscape).join(',')).join('\n')); aToast('تم تجهيز ملف الطلاب CSV');}
function exportBookingsCSV(){fresh(); const headers=['الكود','الاسم','رقم الطالب','رقم ولي الأمر','الصف','الشهر','المجموعة','الحالة','التاريخ']; const rows=adminData.bookings.map(b=>[b.code,b.name,b.studentPhone,b.parentPhone,b.grade,b.month,b.group,b.status,b.date]); downloadText('bookings.csv',[headers,...rows].map(r=>r.map(csvEscape).join(',')).join('\n')); aToast('تم تجهيز ملف الحجوزات CSV');}
function printStudentReport(code){const st=adminData.students.find(s=>s.code===code); if(!st)return; const c=calcStudent(st); const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير ${st.name}</title><style>body{font-family:Arial,sans-serif;padding:24px;line-height:1.8}table{width:100%;border-collapse:collapse;margin:14px 0}td,th{border:1px solid #ddd;padding:8px}.badge{display:inline-block;padding:6px 10px;border-radius:999px;background:#eef}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.m{border:1px solid #ddd;border-radius:12px;padding:12px;text-align:center}.m b{font-size:24px}</style></head><body><h1>تقرير الطالب الشهري</h1><h2>${st.name}</h2><p><b>الكود:</b> ${st.code} | <b>الصف:</b> ${st.grade} | <b>المجموعة:</b> ${st.group||'-'}</p><p><span class="badge">${st.paid?'تم الدفع':'لم يتم الدفع'}</span></p><div class="metrics"><div class="m"><b>${c.attendancePct}%</b><br>الحضور</div><div class="m"><b>${c.avg}%</b><br>متوسط الدرجات</div><div class="m"><b>${c.hwPct}%</b><br>الواجبات</div><div class="m"><b>${c.level}</b><br>المستوى</div></div><h3>الدرجات</h3><table><tr><th>الامتحان</th><th>الدرجة</th><th>النوع</th><th>التاريخ</th></tr>${(st.grades||[]).map(g=>`<tr><td>${g.exam}</td><td>${g.score??'في انتظار التصحيح'}</td><td>${g.type||'-'}</td><td>${g.date||'-'}</td></tr>`).join('')||'<tr><td colspan="4">لا توجد درجات</td></tr>'}</table><h3>الحضور</h3><table><tr><th>التاريخ</th><th>الحالة</th></tr>${(st.attendance||[]).map(a=>`<tr><td>${a.date}</td><td>${a.status}</td></tr>`).join('')||'<tr><td colspan="2">لا توجد سجلات حضور</td></tr>'}</table><p><b>ملاحظات المدرس:</b> ${st.notes||'لا توجد'}</p><script>print()<\/script></body></html>`; const w=open('','_blank'); w.document.write(html); w.document.close();}
function filteredStudents(){const q=normalizeText(document.getElementById('studentAdminSearch')?.value||''); const grade=document.getElementById('studentAdminGrade')?.value||'all'; const pay=document.getElementById('studentAdminPay')?.value||'all'; return adminData.students.filter(s=>(!q || normalizeText(s.name).includes(q) || normalizeText(s.code).includes(q) || String(s.parentPhone||'').includes(q)) && (grade==='all'||s.grade===grade) && (pay==='all'||String(!!s.paid)===pay));}
function studentRow(s){const c=calcStudent(s); return `<tr><td>${s.code}</td><td>${esc(s.name)}</td><td>${s.grade}</td><td>${s.month||'-'}</td><td>${c.attendancePct}%</td><td>${c.lastGrade?c.lastGrade.score+'%':'-'}</td><td><span class="badge ${c.final>=75?'good':c.final>=60?'warn':'danger'}">${c.level}</span></td><td><span class="badge ${s.paid?'good':'danger'}">${s.paid?'تم الدفع':'لم يدفع'}</span></td><td><div class="admin-card-actions"><button class="small-btn primary" onclick="editStudent('${s.code}')">تعديل</button><button class="small-btn" onclick="printStudentReport('${s.code}')">PDF</button><button class="small-btn danger" onclick="deleteStudent('${s.code}')"><span data-icon="trash"></span> حذف</button></div></td></tr>`}
function studentsTable(rows=adminData.students){return `<div class="table-wrap"><table><thead><tr><th>الكود</th><th>الطالب</th><th>الصف</th><th>الشهر</th><th>الحضور</th><th>آخر درجة</th><th>المستوى</th><th>الدفع</th><th>إجراء</th></tr></thead><tbody>${rows.map(studentRow).join('')||'<tr><td colspan="9">لا يوجد طلاب</td></tr>'}</tbody></table></div>`}
function refreshStudentsTable(){const box=document.getElementById('studentsTableBox'); if(box){box.innerHTML=studentsTable(filteredStudents()); hydrateIcons();}}
function renderStudents(){content(`<div class="section-head"><div><span class="kicker"><span data-icon="users"></span> إدارة الطلاب</span><h2 class="section-title">إضافة وتعديل وحذف الطلاب</h2></div><div class="header-actions"><button class="btn ghost" onclick="exportStudentsCSV()"><span data-icon="database"></span> تصدير Excel</button></div></div><div class="card" style="margin-bottom:18px"><form id="addStudentForm" class="grid grid-4"><input name="name" placeholder="اسم الطالب" required><input name="studentPhone" placeholder="رقم الطالب" required><input name="parentPhone" placeholder="رقم ولي الأمر" required><select name="grade">${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><select name="month">${MONTHS.map(m=>`<option>${m}</option>`).join('')}</select><input name="group" placeholder="المجموعة" value="مجموعة السبت والثلاثاء"><textarea name="notes" placeholder="ملاحظات المدرس"></textarea><button class="btn primary" type="submit"><span data-icon="user"></span> تسجيل طالب</button></form></div><div class="admin-toolbar"><input id="studentAdminSearch" placeholder="بحث بالاسم / الكود / رقم ولي الأمر"><select id="studentAdminGrade"><option value="all">كل الصفوف</option>${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><select id="studentAdminPay"><option value="all">كل حالات الدفع</option><option value="true">تم الدفع</option><option value="false">لم يدفع</option></select><button class="btn ghost" onclick="refreshStudentsTable()"><span data-icon="search"></span> بحث</button></div><div id="studentsTableBox">${studentsTable(adminData.students)}</div>`); document.getElementById('addStudentForm').addEventListener('submit',e=>{e.preventDefault(); const s=Object.fromEntries(new FormData(e.target).entries()); s.code=uid(); s.paid=false; s.attendance=[]; s.grades=[]; s.homeworks=[]; adminData.students.push(s); persist('تم تسجيل الطالب'); renderStudents();}); ['studentAdminSearch','studentAdminGrade','studentAdminPay'].forEach(id=>document.getElementById(id)?.addEventListener('input',refreshStudentsTable));}
window.editStudent=function(code){const st=adminData.students.find(s=>s.code===code); if(!st)return; const name=prompt('اسم الطالب',st.name); if(name===null)return; const phone=prompt('رقم الطالب',st.studentPhone||''); if(phone===null)return; const parent=prompt('رقم ولي الأمر',st.parentPhone||''); if(parent===null)return; const notes=prompt('ملاحظات المدرس',st.notes||''); Object.assign(st,{name,studentPhone:phone,parentPhone:parent,notes}); persist('تم تعديل بيانات الطالب'); renderStudents();}
function renderBookings(){const rows=[...adminData.bookings].reverse(); content(`<div class="section-head"><div><span class="kicker"><span data-icon="calendar"></span> الحجوزات الشهرية</span><h2 class="section-title">متابعة حالة الحجز</h2></div><button class="btn ghost" onclick="exportBookingsCSV()"><span data-icon="database"></span> تصدير الحجوزات</button></div><div class="admin-hint">الحجز بيتسجل على الموقع فقط بدون واتساب. عند الضغط على قبول يتم تحويل الحجز لطالب داخل جدول الطلاب تلقائيًا.</div><div class="table-wrap"><table><thead><tr><th>الكود</th><th>الطالب</th><th>الصف</th><th>الشهر</th><th>المجموعة</th><th>الحالة</th><th>تحكم</th></tr></thead><tbody>${rows.length?rows.map(b=>`<tr><td>${b.code}</td><td>${esc(b.name)}</td><td>${b.grade}</td><td>${b.month}</td><td>${b.group}</td><td><span class="status-dot ${b.status==='تم القبول'?'good':b.status==='مرفوض'?'danger':''}">${b.status||'حجز جديد'}</span></td><td><div class="admin-card-actions"><button class="small-btn primary" onclick="setBookingStatus('${b.code}','تم القبول')">قبول وتحويل لطالب</button><button class="small-btn" onclick="setBookingStatus('${b.code}','تم التواصل')">تم التواصل</button><button class="small-btn danger" onclick="setBookingStatus('${b.code}','مرفوض')">رفض</button><button class="small-btn danger" onclick="deleteBooking('${b.code}')">حذف</button></div></td></tr>`).join(''):'<tr><td colspan="7">لا توجد حجوزات</td></tr>'}</tbody></table></div>`); hydrateIcons();}
window.setBookingStatus=function(code,status){const b=adminData.bookings.find(x=>x.code===code); if(!b)return; b.status=status; if(status==='تم القبول'){const exists=adminData.students.some(s=>s.code===b.code || (s.name===b.name && s.parentPhone===b.parentPhone)); if(!exists){adminData.students.push({code:b.code,name:b.name,studentPhone:b.studentPhone,parentPhone:b.parentPhone,grade:b.grade,month:b.month,group:b.group,paid:false,notes:b.notes||'',attendance:[],grades:[],homeworks:[{title:'واجب الشهر الأول',status:'لم يتم'}]});}} persist(status==='تم القبول'?'تم قبول الحجز وتحويله لطالب':'تم تحديث حالة الحجز'); renderBookings();}
window.deleteBooking=async function(code){if(!confirm('حذف الحجز؟'))return; adminData.bookings=adminData.bookings.filter(b=>b.code!==code); persist('تم حذف الحجز'); await cloudDelete('bookings',code); renderBookings();}
function renderAttendance(){content(`<div class="section-head"><div><span class="kicker"><span data-icon="user-check"></span> الحضور والغياب</span><h2 class="section-title">تسجيل حضور يومي بكود الطالب</h2></div></div><div class="portal-shell"><form id="attForm" class="card"><div class="field"><label>كود الطالب أو الاسم</label><input name="query" required placeholder="MF-SCI-1001"></div><div class="field"><label>الحالة</label><select name="status"><option>حاضر</option><option>غائب</option><option>متأخر</option></select></div><button class="btn primary" style="margin-top:14px"><span data-icon="user-check"></span> تسجيل</button></form><div class="card"><h3>حضور اليوم</h3><div class="table-wrap"><table><thead><tr><th>الكود</th><th>الطالب</th><th>الحالة</th></tr></thead><tbody>${adminData.students.filter(s=>(s.attendance||[]).some(a=>a.date===today())).map(s=>{const a=[...(s.attendance||[])].reverse().find(x=>x.date===today());return `<tr><td>${s.code}</td><td>${esc(s.name)}</td><td>${a?.status||'-'}</td></tr>`}).join('')||'<tr><td colspan="3">لا توجد سجلات اليوم</td></tr>'}</tbody></table></div></div></div>`); document.getElementById('attForm').addEventListener('submit',e=>{e.preventDefault(); const fd=Object.fromEntries(new FormData(e.target).entries()); const st=findStudent(fd.query); if(!st)return aToast('لم يتم العثور على الطالب'); st.attendance=st.attendance||[]; st.attendance.push({date:today(),status:fd.status}); persist('تم تسجيل الحضور'); renderAttendance();});}
function renderOverview(){const s=stats(); const counts=gradeCounts(); const max=Math.max(...counts.map(x=>x.count),1); const avgGrade=Math.round(adminData.students.reduce((sum,st)=>sum+calcStudent(st).avg,0)/Math.max(adminData.students.length,1)); content(`<div class="grid grid-4"><div class="card"><span class="iconbox" data-icon="users"></span><h3>إجمالي الطلاب</h3><div class="section-title" style="font-size:2.2rem">${s.total}</div></div><div class="card"><span class="iconbox" data-icon="calendar"></span><h3>حجوزات جديدة</h3><div class="section-title" style="font-size:2.2rem">${adminData.bookings.filter(b=>(b.status||'حجز جديد')==='حجز جديد').length}</div></div><div class="card"><span class="iconbox" data-icon="database"></span><h3>تم الدفع</h3><div class="section-title" style="font-size:2.2rem;color:var(--green)">${s.paid}</div></div><div class="card"><span class="iconbox" data-icon="bar-chart"></span><h3>متوسط الدرجات</h3><div class="section-title" style="font-size:2.2rem">${avgGrade}%</div></div></div><div class="grid grid-2" style="margin-top:18px"><div class="card"><h3>عدد الطلاب حسب الصف</h3><div class="dashboard-chart">${counts.map(x=>`<div class="chart-row"><span>${x.grade}</span><div class="chart-bar"><span style="width:${Math.round(x.count/max*100)}%"></span></div><b>${x.count}</b></div>`).join('')}</div></div><div class="card"><h3>اختصارات سريعة</h3><p><span class="badge danger">${s.unpaid} طالب لم يدفعوا</span></p><p><span class="badge warn">${adminData.reviews.filter(r=>r.approved===false).length} تقييم في انتظار الموافقة</span></p><div class="quick-actions"><button class="btn ghost" onclick="currentSection='students';renderAdmin()">الطلاب</button><button class="btn ghost" onclick="currentSection='bookings';renderAdmin()">الحجوزات</button><button class="btn ghost" onclick="currentSection='exams';renderAdmin()">الامتحانات</button></div></div></div>`);}
function renderReviewsAdmin(){content(`<div class="section-head"><div><span class="kicker"><span data-icon="star"></span> تقييمات الطلاب</span><h2 class="section-title">مراجعة أو نشر أو حذف التقييمات</h2></div></div><div class="grid grid-3">${adminData.reviews.map(r=>`<div class="card"><div class="review-stars">${stars(r.rating)}</div><h3>${esc(r.name)}</h3><span class="badge">${esc(r.role)}</span> <span class="badge ${r.approved!==false?'good':'warn'}">${r.approved!==false?'منشور':'بانتظار الموافقة'}</span><p>${esc(r.text)}</p><div class="admin-card-actions"><button class="small-btn primary" onclick="approveReview('${r.id}',true)">نشر</button><button class="small-btn" onclick="approveReview('${r.id}',false)">إخفاء</button><button class="small-btn danger" onclick="deleteReview('${r.id}')"><span data-icon="trash"></span> حذف</button></div></div>`).join('')||'<div class="card"><h3>لا توجد تقييمات</h3></div>'}</div>`); hydrateIcons();}
window.approveReview=function(id,val){const r=adminData.reviews.find(x=>x.id===id); if(r){r.approved=val; persist(val?'تم نشر التقييم':'تم إخفاء التقييم'); renderReviewsAdmin();}}
function renderSettings(){content(`<div class="section-head"><div><span class="kicker"><span data-icon="sparkles"></span> إعدادات الموقع</span><h2 class="section-title">تحكم في محتوى الصفحة الرئيسية و SEO</h2></div></div><div class="card"><form id="setForm" class="grid"><input name="heroTitle" value="${esc(adminData.settings?.heroTitle||'')}" placeholder="عنوان الهيرو"><input name="teacherPhone" value="${esc(adminData.settings?.teacherPhone||TEACHER_WHATSAPP)}" placeholder="رقم واتساب المدرس"><textarea name="homeNotice" placeholder="رسالة تنبيه تظهر للطلاب">${esc(adminData.settings?.homeNotice||'')}</textarea><button class="btn primary"><span data-icon="sparkles"></span> حفظ الإعدادات</button></form></div><div class="seo-card" style="margin-top:18px"><h3>نصائح SEO جاهزة</h3><p>العناوين والوصف و sitemap و robots موجودين. بعد الديبلاوي اربط الدومين وقدم sitemap في Google Search Console.</p></div>`); document.getElementById('setForm').addEventListener('submit',e=>{e.preventDefault(); adminData.settings={...adminData.settings,...Object.fromEntries(new FormData(e.target).entries())}; if(adminData.settings.teacherPhone) TEACHER_WHATSAPP=adminData.settings.teacherPhone; persist('تم حفظ الإعدادات');});}
function renderSection(){fresh(); if(currentSection==='overview')renderOverview(); if(currentSection==='students')renderStudents(); if(currentSection==='bookings')renderBookings(); if(currentSection==='attendance')renderAttendance(); if(currentSection==='payments')renderPayments(); if(currentSection==='materials')renderMaterials(); if(currentSection==='questions')renderQuestions(); if(currentSection==='exams')renderExams(); if(currentSection==='reviews')renderReviewsAdmin(); if(currentSection==='settings')renderSettings(); hydrateIcons();}
function renderExams(){content(`<div class="section-head"><div><span class="kicker"><span data-icon="clipboard"></span> الامتحانات الشهرية</span><h2 class="section-title">إضافة امتحانات ورقية أو أونلاين بتصحيح تلقائي</h2></div></div><div class="admin-hint">للتصحيح التلقائي اكتب الأسئلة بهذا الشكل: Q: نص السؤال ثم A) اختيار B) اختيار C) اختيار D) اختيار ثم Answer: A وافصل بين الأسئلة بسطر فيه ---</div><div class="portal-shell"><form id="examForm" class="card grid"><input name="title" placeholder="عنوان الامتحان" required><select name="grade">${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><input name="date" type="date" required><input name="questions" type="number" placeholder="عدد الأسئلة" value="20"><input name="duration" type="number" placeholder="الوقت بالدقائق" value="20"><select name="status"><option>مفتوح</option><option>متاح قريبًا</option><option>مغلق</option></select><textarea name="instructions" placeholder="تعليمات الامتحان"></textarea><textarea name="text" placeholder="Q: ما وحدة قياس السرعة؟\nA) نيوتن\nB) متر/ثانية\nC) كيلوجرام\nD) جول\nAnswer: B\n---\nQ: ..."></textarea><input name="file" type="file" accept="image/*,.pdf"><button class="btn primary"><span data-icon="upload"></span> إضافة امتحان</button></form><div class="grid">${adminData.exams.map(ex=>itemCard(ex,'exams')).join('')||'<div class="card"><h3>لا توجد امتحانات</h3></div>'}</div></div><div class="card" style="margin-top:18px"><h3>إضافة درجة طالب</h3><form id="gradeForm" class="grid grid-4"><input name="code" placeholder="كود الطالب" required><input name="exam" placeholder="اسم الامتحان" required><input name="score" type="number" min="0" max="100" placeholder="الدرجة" required><select name="type"><option>ورقي</option><option>أونلاين</option></select><button class="btn gold"><span data-icon="bar-chart"></span> حفظ الدرجة</button></form></div>${renderAttemptsTable()}`); document.getElementById('examForm').addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(e.target); const f=await fileToData(fd.get('file')); adminData.exams.push({id:`ex-${Date.now()}`,title:fd.get('title'),grade:fd.get('grade'),date:fd.get('date'),questions:fd.get('questions'),duration:Number(fd.get('duration')||20),status:fd.get('status'),instructions:fd.get('instructions'),text:fd.get('text'),...f}); persist('تم إضافة الامتحان'); renderExams();}); document.getElementById('gradeForm').addEventListener('submit',e=>{e.preventDefault(); const fd=Object.fromEntries(new FormData(e.target).entries()); const st=adminData.students.find(s=>s.code===fd.code); if(!st)return aToast('كود الطالب غير موجود'); st.grades=st.grades||[]; const existing=st.grades.find(g=>g.exam===fd.exam); if(existing){existing.score=Number(fd.score); existing.type=fd.type; existing.date=today(); existing.status='تم التصحيح';} else st.grades.push({exam:fd.exam,score:Number(fd.score),type:fd.type,date:today(),status:'تم التصحيح'}); persist('تم حفظ الدرجة'); e.target.reset();}); hydrateIcons();}

/* v14 premium dashboard overview */
function renderOverview(){
  const s=stats();
  const counts=gradeCounts();
  const max=Math.max(...counts.map(x=>x.count),1);
  const avgGrade=Math.round(adminData.students.reduce((sum,st)=>sum+calcStudent(st).avg,0)/Math.max(adminData.students.length,1));
  const top=[...(adminData.students||[])].map(st=>({st,calc:calcStudent(st)})).sort((a,b)=>b.calc.final-a.calc.final).slice(0,5);
  const latestBookings=[...(adminData.bookings||[])].slice(-5).reverse();
  content(`<div class="grid grid-4"><div class="card"><span class="iconbox" data-icon="users"></span><h3>إجمالي الطلاب</h3><div class="section-title" style="font-size:2.2rem">${s.total}</div></div><div class="card"><span class="iconbox" data-icon="calendar"></span><h3>حجوزات جديدة</h3><div class="section-title" style="font-size:2.2rem">${adminData.bookings.filter(b=>(b.status||'حجز جديد')==='حجز جديد').length}</div></div><div class="card"><span class="iconbox" data-icon="database"></span><h3>طلاب لم يدفعوا</h3><div class="section-title" style="font-size:2.2rem;color:var(--red)">${s.unpaid}</div></div><div class="card"><span class="iconbox" data-icon="bar-chart"></span><h3>متوسط الدرجات</h3><div class="section-title" style="font-size:2.2rem">${avgGrade}%</div></div></div><div class="grid grid-2" style="margin-top:18px"><div class="card"><h3>عدد الطلاب حسب الصف</h3><div class="dashboard-chart">${counts.map(x=>`<div class="chart-row"><span>${x.grade}</span><div class="chart-bar"><span style="width:${Math.round(x.count/max*100)}%"></span></div><b>${x.count}</b></div>`).join('')}</div></div><div class="card"><h3>اختصارات سريعة</h3><p><span class="badge danger">${s.unpaid} طالب لم يدفعوا</span></p><p><span class="badge warn">${adminData.reviews.filter(r=>r.approved===false).length} تقييم في انتظار الموافقة</span></p><p><span class="badge good">${top[0]?`الأول: ${esc(top[0].st.name)} (${top[0].calc.final}%)`:'لا توجد درجات كافية'}</span></p><div class="quick-actions"><button class="btn ghost" onclick="currentSection='students';renderAdmin()">الطلاب</button><button class="btn ghost" onclick="currentSection='bookings';renderAdmin()">الحجوزات</button><button class="btn ghost" onclick="currentSection='exams';renderAdmin()">الامتحانات</button></div></div></div><div class="grid grid-2" style="margin-top:18px"><div class="card"><h3>لوحة أوائل الطلاب</h3><div class="table-wrap"><table><thead><tr><th>#</th><th>الطالب</th><th>الصف</th><th>المستوى</th><th>النتيجة</th></tr></thead><tbody>${top.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.st.name)}</td><td>${esc(x.st.grade)}</td><td>${x.calc.level}</td><td>${x.calc.final}%</td></tr>`).join('')||'<tr><td colspan="5">لا توجد بيانات كافية</td></tr>'}</tbody></table></div></div><div class="card"><h3>آخر الحجوزات</h3><div class="table-wrap"><table><thead><tr><th>الكود</th><th>الطالب</th><th>الصف</th><th>الحالة</th></tr></thead><tbody>${latestBookings.map(b=>`<tr><td>${b.code}</td><td>${esc(b.name)}</td><td>${esc(b.grade)}</td><td>${b.status||'حجز جديد'}</td></tr>`).join('')||'<tr><td colspan="4">لا توجد حجوزات</td></tr>'}</tbody></table></div></div></div>`);
  hydrateIcons();
}


/* v24: teacher-only attendance + recitation management */
function v24RecitationSummary(st){
  const rows = st.recitations || [];
  const heard = rows.filter(r => r.status === 'سمع').length;
  const notHeard = rows.filter(r => r.status === 'لم يسمع').length;
  const absent = rows.filter(r => r.status === 'لم يحضر' || r.status === 'غائب').length;
  const counted = Math.max(rows.filter(r => r.status !== 'غير مطلوب').length, 1);
  return {heard, notHeard, absent, total: rows.length, pct: Math.round((heard / counted) * 100)};
}
function stats(){
  fresh();
  const bookings = adminData.bookings.length;
  const unpaid = adminData.students.filter(s=>!s.paid).length;
  const paid = adminData.students.filter(s=>s.paid).length;
  const attendToday = adminData.students.filter(s=>(s.attendance||[]).some(a=>a.date===today() && a.status==='حاضر')).length;
  const reciteToday = adminData.students.filter(s=>(s.recitations||[]).some(r=>r.date===today() && r.status==='سمع')).length;
  return {bookings, unpaid, paid, attendToday, reciteToday, total:adminData.students.length};
}
function studentRow(s){
  const c=calcStudent(s); const rec=v24RecitationSummary(s);
  return `<tr><td>${esc(s.code)}</td><td>${esc(s.name)}</td><td>${esc(s.grade)}</td><td>${esc(s.month||'-')}</td><td>${c.attendancePct}%</td><td>${rec.pct}%</td><td>${c.lastGrade?esc(c.lastGrade.score)+'%':'-'}</td><td><span class="badge ${s.paid?'good':'danger'}">${s.paid?'تم الدفع':'لم يدفع'}</span></td><td><div class="admin-card-actions"><button class="small-btn primary" onclick="editStudent('${esc(s.code)}')">تعديل</button><button class="small-btn" onclick="currentSection='attendance';renderAdmin();setTimeout(()=>{const i=document.querySelector('[name=code]'); if(i)i.value='${esc(s.code)}'},100)">حضور/تسميع</button><button class="small-btn" onclick="printStudentReport('${esc(s.code)}')">PDF</button><button class="small-btn danger" onclick="deleteStudent('${esc(s.code)}')"><span data-icon="trash"></span> حذف</button></div></td></tr>`;
}
function studentsTable(rows=adminData.students){
  return `<div class="table-wrap"><table><thead><tr><th>الكود</th><th>الطالب</th><th>الصف</th><th>الشهر</th><th>الحضور</th><th>التسميع</th><th>آخر درجة</th><th>الدفع</th><th>إجراء</th></tr></thead><tbody>${rows.map(studentRow).join('')||'<tr><td colspan="9">لا يوجد طلاب</td></tr>'}</tbody></table></div>`;
}
function renderStudents(){
  content(`<div class="section-head"><div><span class="kicker"><span data-icon="users"></span> إدارة الطلاب</span><h2 class="section-title">بيانات الطلاب والمتابعة</h2></div><div class="header-actions"><button class="btn ghost" onclick="exportStudentsCSV()"><span data-icon="database"></span> تصدير Excel</button></div></div><div class="card" style="margin-bottom:18px"><form id="addStudentForm" class="grid grid-4"><input name="name" placeholder="اسم الطالب" required><input name="studentPhone" placeholder="رقم الطالب" required><input name="parentPhone" placeholder="رقم ولي الأمر" required><select name="grade">${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><select name="month">${MONTHS.map(m=>`<option>${m}</option>`).join('')}</select><input name="group" placeholder="المجموعة" value="مجموعة السبت والثلاثاء"><textarea name="notes" placeholder="ملاحظات المدرس"></textarea><button class="btn primary" type="submit"><span data-icon="user"></span> تسجيل طالب</button></form></div><div class="admin-toolbar"><input id="studentAdminSearch" placeholder="بحث بالاسم / الكود / رقم ولي الأمر"><select id="studentAdminGrade"><option value="all">كل الصفوف</option>${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><select id="studentAdminPay"><option value="all">كل حالات الدفع</option><option value="true">تم الدفع</option><option value="false">لم يدفع</option></select><button class="btn ghost" onclick="refreshStudentsTable()"><span data-icon="search"></span> بحث</button></div><div id="studentsTableBox">${studentsTable(adminData.students)}</div>`);
  document.getElementById('addStudentForm').addEventListener('submit',e=>{e.preventDefault(); const s=Object.fromEntries(new FormData(e.target).entries()); s.code=uid(); s.paid=false; s.attendance=[]; s.recitations=[]; s.grades=[]; s.homeworks=[]; adminData.students.push(s); persist('تم تسجيل الطالب'); renderStudents();});
  ['studentAdminSearch','studentAdminGrade','studentAdminPay'].forEach(id=>document.getElementById(id)?.addEventListener('input',refreshStudentsTable));
}
function renderOverview(){
  const s=stats(); const counts=gradeCounts(); const max=Math.max(...counts.map(x=>x.count),1);
  const avgGrade=Math.round(adminData.students.reduce((sum,st)=>sum+calcStudent(st).avg,0)/Math.max(adminData.students.length,1));
  const top=[...(adminData.students||[])].map(st=>({st,calc:calcStudent(st),rec:v24RecitationSummary(st)})).sort((a,b)=>b.calc.final-a.calc.final).slice(0,5);
  content(`<div class="grid grid-4"><div class="card"><span class="iconbox" data-icon="users"></span><h3>إجمالي الطلاب</h3><div class="section-title" style="font-size:2.2rem">${s.total}</div></div><div class="card"><span class="iconbox" data-icon="user-check"></span><h3>حضور اليوم</h3><div class="section-title" style="font-size:2.2rem">${s.attendToday}</div></div><div class="card"><span class="iconbox" data-icon="clipboard"></span><h3>تسميع اليوم</h3><div class="section-title" style="font-size:2.2rem;color:var(--green)">${s.reciteToday}</div></div><div class="card"><span class="iconbox" data-icon="bar-chart"></span><h3>متوسط الدرجات</h3><div class="section-title" style="font-size:2.2rem">${avgGrade}%</div></div></div><div class="grid grid-2" style="margin-top:18px"><div class="card"><h3>عدد الطلاب حسب الصف</h3><div class="dashboard-chart">${counts.map(x=>`<div class="chart-row"><span>${x.grade}</span><div class="chart-bar"><span style="width:${Math.round(x.count/max*100)}%"></span></div><b>${x.count}</b></div>`).join('')}</div></div><div class="card"><h3>تنبيهات سريعة</h3><p><span class="badge danger">${s.unpaid} طالب لم يدفعوا</span></p><p><span class="badge good">الحضور والتسميع من لوحة المدرس فقط</span></p><p><span class="badge warn">أي طالب لا يظهر في بوابة الطالب راجع الكود أو Firebase</span></p><div class="quick-actions"><button class="btn ghost" onclick="currentSection='attendance';renderAdmin()">تسجيل الحضور</button><button class="btn ghost" onclick="currentSection='students';renderAdmin()">الطلاب</button></div></div></div><div class="card" style="margin-top:18px"><h3>أعلى الطلاب</h3><div class="table-wrap"><table><thead><tr><th>#</th><th>الطالب</th><th>الصف</th><th>تسميع</th><th>المستوى</th></tr></thead><tbody>${top.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.st.name)}</td><td>${esc(x.st.grade)}</td><td>${x.rec.pct}%</td><td>${x.calc.final}%</td></tr>`).join('')||'<tr><td colspan="5">لا توجد بيانات كافية</td></tr>'}</tbody></table></div></div>`); hydrateIcons();
}
function renderAttendance(){
  const students = adminData.students || [];
  const records = students.flatMap(st=>[
    ...(st.recitations||[]).map((r,i)=>({type:'rec', st, r, i, date:r.date||'', lesson:r.lesson||'حصة', attendance:r.attendanceStatus||'-', recitation:r.status||'-', note:r.note||''})),
    ...(st.attendance||[]).filter(a=>!(st.recitations||[]).some(r=>r.date===a.date && r.attendanceStatus===a.status)).map((a,i)=>({type:'att', st, r:a, i, date:a.date||'', lesson:a.lesson||'حصة', attendance:a.status||'-', recitation:'-', note:a.note||''}))
  ]).slice(-80).reverse();
  const options = students.map(s=>`<option value="${esc(s.code)}">${esc(s.code)} - ${esc(s.name)} - ${esc(s.grade)}</option>`).join('');
  content(`<div class="section-head"><div><span class="kicker"><span data-icon="user-check"></span> حضور وتسميع</span><h2 class="section-title">المدرس يسجل الحضور والتسميع أثناء الحصة</h2><p class="section-desc">تم إلغاء تسجيل الحضور من بوابة الطالب؛ التسجيل هنا فقط لمنع أي طالب من تسجيل نفسه وهو غير حاضر.</p></div></div><div class="portal-shell attendance-recitation-shell"><form id="sessionForm" class="card grid"><div class="field"><label>الطالب</label><input name="code" list="studentsCodes" placeholder="اكتب أو اختار كود الطالب" required><datalist id="studentsCodes">${options}</datalist></div><div class="field"><label>تاريخ الحصة</label><input name="date" type="date" value="${today()}" required></div><div class="field"><label>عنوان الحصة / الدرس</label><input name="lesson" placeholder="مثال: الحصة الأولى - الحركة" value="حصة اليوم"></div><div class="field"><label>الحضور</label><select name="attendanceStatus"><option>حاضر</option><option>متأخر</option><option>غائب</option></select></div><div class="field"><label>التسميع</label><select name="recitationStatus"><option>سمع</option><option>لم يسمع</option><option>غير مطلوب</option><option>لم يحضر</option></select></div><div class="field"><label>ملاحظة</label><input name="note" placeholder="اختياري: ممتاز / يحتاج مراجعة / لم يحضر"></div><button class="btn primary"><span data-icon="user-check"></span> حفظ الحصة</button></form><div class="card"><h3>آخر سجلات الحصص</h3><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>التاريخ</th><th>الحصة</th><th>الحضور</th><th>التسميع</th><th>ملاحظة</th><th>إجراء</th></tr></thead><tbody>${records.length?records.map(x=>`<tr><td>${esc(x.st.name)}</td><td>${esc(x.date)}</td><td>${esc(x.lesson)}</td><td><span class="badge ${x.attendance==='حاضر'?'good':x.attendance==='غائب'?'danger':'warn'}">${esc(x.attendance)}</span></td><td><span class="badge ${x.recitation==='سمع'?'good':x.recitation==='لم يسمع'?'warn':x.recitation==='لم يحضر'?'danger':''}">${esc(x.recitation)}</span></td><td>${esc(x.note)}</td><td><button class="small-btn danger" onclick="deleteSessionRecord('${esc(x.st.code)}','${x.type}',${x.i})">حذف</button></td></tr>`).join(''):'<tr><td colspan="7">لا توجد سجلات بعد</td></tr>'}</tbody></table></div></div></div>`);
  document.getElementById('sessionForm').addEventListener('submit',e=>{e.preventDefault(); const fd=Object.fromEntries(new FormData(e.target).entries()); const st=adminData.students.find(s=>String(s.code).trim()===String(fd.code).trim()); if(!st)return aToast('كود الطالب غير موجود'); st.attendance=st.attendance||[]; st.recitations=st.recitations||[]; const recStatus = fd.attendanceStatus==='غائب' ? 'لم يحضر' : fd.recitationStatus; const id='sess-'+Date.now(); st.attendance.push({id,date:fd.date,status:fd.attendanceStatus,lesson:fd.lesson,note:fd.note,source:'teacher'}); st.recitations.push({id,date:fd.date,lesson:fd.lesson,status:recStatus,attendanceStatus:fd.attendanceStatus,note:fd.note}); persist('تم حفظ الحضور والتسميع'); renderAttendance();});
  hydrateIcons();
}
window.deleteSessionRecord=async function(code,type,index){
  const st=adminData.students.find(s=>s.code===code); if(!st)return;
  if(type==='rec'){
    const rec=(st.recitations||[])[index]; st.recitations.splice(index,1);
    if(rec?.id) st.attendance=(st.attendance||[]).filter(a=>a.id!==rec.id);
  } else {
    st.attendance.splice(index,1);
  }
  persist('تم حذف السجل'); renderAttendance();
};
function renderAdmin(){
  const root=document.getElementById('adminRoot');
  const sections=adminSections.map(s=>s[0]==='attendance' ? ['attendance','user-check','حضور وتسميع'] : s);
  root.className='admin-page';
  root.innerHTML=`<aside class="admin-sidebar"><div class="logo"><span class="logo-mark" data-icon="atom"></span><span>لوحة مستر محمود <small>تحكم كامل في الموقع</small></span></div><div class="admin-nav">${sections.map(([id,ic,name])=>`<button data-admin-nav="${id}" class="${id===currentSection?'active':''}"><span data-icon="${ic}"></span>${name}</button>`).join('')}</div><div style="margin-top:20px"><button class="btn ghost" style="width:100%" onclick="location.href='index.html'"><span data-icon="external-link"></span> معاينة الموقع</button></div></aside><main class="admin-main"><div class="admin-top"><div><span class="kicker"><span data-icon="sparkles"></span> Admin Dashboard</span><h1 class="section-title" style="font-size:2.45rem">لوحة تحكم مستر محمود ابراهيم فوزي</h1></div><div class="header-actions"><button class="theme-toggle" id="themeToggleAdmin"></button><button class="btn ghost" onclick="forceFirestoreSync()"><span data-icon="database"></span> مزامنة Firebase</button><button class="btn dark" onclick="location.reload()">خروج</button></div></div><div id="adminContent"></div></main>`;
  hydrateIcons(); setupAdminTheme(); bindNav(); renderSection();
}


/* v25: admin simplified dashboard + bulk attendance + groups + assignments + stable QR settings */
(function(){
  try{
    const ids=adminSections.map(x=>x[0]);
    if(!ids.includes('groups')) adminSections.splice(3,0,['groups','calendar','المجموعات والحصص']);
    if(!ids.includes('assignments')) adminSections.splice(6,0,['assignments','file-text','الواجبات']);
    const m=adminSections.find(x=>x[0]==='materials'); if(m) m[2]='مراجعات العلوم';
    const a=adminSections.find(x=>x[0]==='attendance'); if(a) a[2]='حضور وتسميع';
  }catch(e){}
})();
function v25SafeAdmin(v){return String(v ?? '').replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
function isoDateAdmin(){return new Date().toISOString().slice(0,10);}
function ensureAdminCollections(){
  adminData.groups = adminData.groups && adminData.groups.length ? adminData.groups : [
    {id:'grp-1',name:'مجموعة السبت والثلاثاء',grade:'أولى إعدادي',days:'السبت والثلاثاء',time:'5:00 مساءً',place:'السنتر',notes:'علوم'},
    {id:'grp-2',name:'مجموعة الأحد والأربعاء',grade:'تانية إعدادي',days:'الأحد والأربعاء',time:'6:00 مساءً',place:'السنتر',notes:'علوم'},
    {id:'grp-3',name:'مجموعة الاثنين والخميس',grade:'تالتة ثانوي',days:'الاثنين والخميس',time:'7:00 مساءً',place:'السنتر',notes:'أحياء'}
  ];
  adminData.assignments = adminData.assignments || [];
  adminData.settings = {...(adminData.settings||{}), siteUrl: adminData.settings?.siteUrl || 'https://mahmoud-fawzy-science-platform.vercel.app'};
  (adminData.students||[]).forEach(st=>{ if(st.grade==='تانية ثانوي')st.grade='أولى ثانوي'; st.recitations=st.recitations||[]; st.homeworks=st.homeworks||[]; st.attendance=st.attendance||[]; });
}
function groupOptions(){ensureAdminCollections(); return [...new Set((adminData.groups||[]).map(g=>g.name).filter(Boolean))];}
function renderOverview(){
  fresh(); ensureAdminCollections(); const s=stats(); const avgGrade=Math.round(adminData.students.reduce((sum,st)=>sum+calcStudent(st).avg,0)/Math.max(adminData.students.length,1));
  const pendingHw=(adminData.assignments||[]).length;
  content(`<div class="admin-simple-welcome card"><span class="kicker"><span data-icon="sparkles"></span> لوحة مبسطة</span><h2>إدارة الطلاب والحصص من مكان واحد</h2><p>ابدأ من حضور وتسميع أثناء الحصة، أو راجع الدفع والواجبات والحجوزات.</p></div><div class="grid grid-4"><div class="card"><span class="iconbox" data-icon="users"></span><h3>الطلاب</h3><div class="section-title" style="font-size:2.2rem">${s.total}</div></div><div class="card"><span class="iconbox" data-icon="user-check"></span><h3>حضور اليوم</h3><div class="section-title" style="font-size:2.2rem">${s.attendToday}</div></div><div class="card"><span class="iconbox" data-icon="clipboard"></span><h3>تسميع اليوم</h3><div class="section-title" style="font-size:2.2rem;color:var(--green)">${s.reciteToday||0}</div></div><div class="card"><span class="iconbox" data-icon="database"></span><h3>لم يدفعوا</h3><div class="section-title" style="font-size:2.2rem;color:var(--red)">${s.unpaid}</div></div></div><div class="grid grid-2" style="margin-top:18px"><div class="card"><h3>اختصارات الحصة</h3><div class="quick-actions"><button class="btn primary" onclick="currentSection='attendance';renderAdmin()">تسجيل حضور وتسميع</button><button class="btn ghost" onclick="currentSection='groups';renderAdmin()">المجموعات</button><button class="btn ghost" onclick="currentSection='assignments';renderAdmin()">الواجبات</button><button class="btn ghost" onclick="currentSection='payments';renderAdmin()">الدفع</button></div></div><div class="card"><h3>ملخص سريع</h3><p><span class="badge good">${(adminData.groups||[]).length} مجموعة</span></p><p><span class="badge warn">${pendingHw} واجب منشور</span></p><p><span class="badge">متوسط الدرجات ${avgGrade}%</span></p></div></div>`); hydrateIcons();
}
function renderGroups(){
  fresh(); ensureAdminCollections();
  const rows=adminData.groups||[];
  content(`<div class="section-head"><div><span class="kicker"><span data-icon="calendar"></span> المجموعات والحصص</span><h2 class="section-title">جدول المجموعات</h2><p class="section-desc">اكتب المجموعات اللي المدرس شغال بيها، والطالب هيشوف ميعاد مجموعته في بوابته.</p></div></div><div class="portal-shell"><form id="groupForm" class="card grid"><input name="name" placeholder="اسم المجموعة" required><select name="grade">${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><input name="days" placeholder="الأيام: السبت والثلاثاء"><input name="time" placeholder="الساعة"><input name="place" placeholder="المكان"><textarea name="notes" placeholder="ملاحظات"></textarea><button class="btn primary"><span data-icon="calendar"></span> إضافة مجموعة</button></form><div class="card"><h3>المجموعات الحالية</h3><div class="table-wrap"><table><thead><tr><th>المجموعة</th><th>الصف</th><th>الأيام</th><th>الساعة</th><th>المكان</th><th>إجراء</th></tr></thead><tbody>${rows.map(g=>`<tr><td>${v25SafeAdmin(g.name)}</td><td>${v25SafeAdmin(g.grade)}</td><td>${v25SafeAdmin(g.days)}</td><td>${v25SafeAdmin(g.time)}</td><td>${v25SafeAdmin(g.place)}</td><td><button class="small-btn danger" onclick="deleteGroup('${v25SafeAdmin(g.id)}')">حذف</button></td></tr>`).join('')||'<tr><td colspan="6">لا توجد مجموعات</td></tr>'}</tbody></table></div></div></div>`);
  document.getElementById('groupForm').addEventListener('submit',e=>{e.preventDefault(); const g=Object.fromEntries(new FormData(e.target).entries()); g.id='grp-'+Date.now(); adminData.groups.push(g); persist('تم إضافة المجموعة'); renderGroups();}); hydrateIcons();
}
window.deleteGroup=function(id){adminData.groups=(adminData.groups||[]).filter(g=>g.id!==id); persist('تم حذف المجموعة'); renderGroups();};
function renderAttendance(){
  fresh(); ensureAdminCollections(); const groups=groupOptions(); const selectedGrade=sessionStorage.getItem('attGrade')||GRADES[0]; const selectedGroup=sessionStorage.getItem('attGroup')||'all';
  const students=(adminData.students||[]).filter(st=>(selectedGrade==='all'||st.grade===selectedGrade)&&(selectedGroup==='all'||st.group===selectedGroup));
  content(`<div class="section-head"><div><span class="kicker"><span data-icon="user-check"></span> حضور وتسميع جماعي</span><h2 class="section-title">تسجيل الحصة كلها مرة واحدة</h2><p class="section-desc">اختار الصف والمجموعة، علّم الحضور والتسميع لكل طالب، وبعدين اضغط حفظ الكل.</p></div></div><div class="card attendance-filter-card"><div class="admin-toolbar"><select id="attGrade"><option value="all">كل الصفوف</option>${GRADES.map(g=>`<option ${g===selectedGrade?'selected':''}>${g}</option>`).join('')}</select><select id="attGroup"><option value="all">كل المجموعات</option>${groups.map(g=>`<option ${g===selectedGroup?'selected':''}>${v25SafeAdmin(g)}</option>`).join('')}</select><input id="attDate" type="date" value="${isoDateAdmin()}"><input id="attLesson" placeholder="اسم الحصة / الدرس" value="حصة اليوم"><button class="btn ghost" onclick="applyAttendanceFilter()"><span data-icon="search"></span> عرض الطلاب</button></div></div><form id="bulkAttendanceForm" class="card bulk-session-card"><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الكود</th><th>الحضور</th><th>التسميع</th><th>ملاحظة</th></tr></thead><tbody>${students.map(st=>`<tr class="session-student-row" data-code="${v25SafeAdmin(st.code)}"><td>${v25SafeAdmin(st.name)}</td><td>${v25SafeAdmin(st.code)}</td><td><select class="att-status"><option>حاضر</option><option>متأخر</option><option>غائب</option></select></td><td><select class="rec-status"><option>سمع</option><option>لم يسمع</option><option>غير مطلوب</option><option>لم يحضر</option></select></td><td><input class="session-note" placeholder="ملاحظة سريعة"></td></tr>`).join('')||'<tr><td colspan="5">لا يوجد طلاب بهذه الفلاتر</td></tr>'}</tbody></table></div><button class="btn primary" style="margin-top:16px" type="submit"><span data-icon="user-check"></span> حفظ حضور وتسميع الحصة</button></form><div class="card" style="margin-top:18px"><h3>آخر سجلات الحصص</h3>${sessionRecordsTable()}</div>`);
  document.getElementById('bulkAttendanceForm').addEventListener('submit',e=>{e.preventDefault(); saveBulkSession();}); hydrateIcons();
}
window.applyAttendanceFilter=function(){sessionStorage.setItem('attGrade',document.getElementById('attGrade').value); sessionStorage.setItem('attGroup',document.getElementById('attGroup').value); renderAttendance();};
function sessionRecordsTable(){
  const rows=(adminData.students||[]).flatMap(st=>(st.recitations||[]).map((r,i)=>({st,r,i}))).slice(-50).reverse();
  return `<div class="table-wrap"><table><thead><tr><th>الطالب</th><th>التاريخ</th><th>الحصة</th><th>الحضور</th><th>التسميع</th><th>ملاحظة</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${v25SafeAdmin(x.st.name)}</td><td>${v25SafeAdmin(x.r.date)}</td><td>${v25SafeAdmin(x.r.lesson)}</td><td>${v25SafeAdmin(x.r.attendanceStatus||'-')}</td><td>${v25SafeAdmin(x.r.status)}</td><td>${v25SafeAdmin(x.r.note||'')}</td></tr>`).join('')||'<tr><td colspan="6">لا توجد سجلات بعد</td></tr>'}</tbody></table></div>`;
}
function saveBulkSession(){
  const date=document.getElementById('attDate')?.value || isoDateAdmin(); const lesson=document.getElementById('attLesson')?.value || 'حصة اليوم';
  document.querySelectorAll('.session-student-row').forEach(row=>{const code=row.dataset.code; const st=adminData.students.find(s=>s.code===code); if(!st)return; const attendanceStatus=row.querySelector('.att-status').value; let recitationStatus=row.querySelector('.rec-status').value; const note=row.querySelector('.session-note').value; if(attendanceStatus==='غائب') recitationStatus='لم يحضر'; const id='sess-'+date+'-'+lesson+'-'+code; st.attendance=st.attendance||[]; st.recitations=st.recitations||[]; st.attendance=st.attendance.filter(a=>a.id!==id); st.recitations=st.recitations.filter(r=>r.id!==id); st.attendance.push({id,date,status:attendanceStatus,lesson,note,source:'teacher'}); st.recitations.push({id,date,lesson,status:recitationStatus,attendanceStatus,note});});
  persist('تم حفظ الحضور والتسميع للحصة'); renderAttendance();
}
function renderPayments(){
  fresh(); ensureAdminCollections();
  content(`<div class="section-head"><div><span class="kicker"><span data-icon="database"></span> الدفع</span><h2 class="section-title">مدفوع / لم يدفع فقط</h2><p class="section-desc">اختار حالة الدفع للطالب: تم الدفع أو لم يدفع.</p></div></div><div class="grade-payment-list">${GRADES.map(g=>{const rows=adminData.students.filter(s=>s.grade===g); return `<div class="card payment-grade-card"><div class="profile-top"><h3>${g}</h3><span class="badge">${rows.length} طالب</span></div><div class="table-wrap"><table><thead><tr><th>الكود</th><th>الطالب</th><th>الشهر</th><th>الحالة</th><th>آخر دفع</th><th>تحكم</th></tr></thead><tbody>${rows.map(s=>`<tr><td>${s.code}</td><td>${v25SafeAdmin(s.name)}</td><td>${v25SafeAdmin(s.month||'-')}</td><td><span class="badge ${s.paid?'good':'danger'}">${s.paid?'تم الدفع':'لم يدفع'}</span></td><td>${v25SafeAdmin(s.paymentDate||'-')}</td><td><button class="small-btn primary" onclick="setPaid('${s.code}',true)">تم الدفع</button><button class="small-btn danger" onclick="setPaid('${s.code}',false)">لم يدفع</button></td></tr>`).join('')||'<tr><td colspan="6">لا يوجد طلاب في هذا الصف</td></tr>'}</tbody></table></div></div>`}).join('')}</div>`); hydrateIcons();
}
window.setPaid=function(code,val){const st=adminData.students.find(s=>s.code===code); if(!st)return; st.paid=val; st.paymentDate=val?isoDateAdmin():''; persist(val?'تم تسجيل الدفع':'تم تعليم الطالب لم يدفع'); renderPayments();};
window.togglePaid=window.setPaid;
function renderAssignments(){
  fresh(); ensureAdminCollections(); const groupOpts=['كل المجموعات',...groupOptions()];
  content(`<div class="section-head"><div><span class="kicker"><span data-icon="file-text"></span> الواجبات</span><h2 class="section-title">إضافة واجب للصف أو المجموعة</h2><p class="section-desc">الواجب يظهر تلقائيًا للطالب في بوابته حسب الصف والمجموعة.</p></div></div><div class="portal-shell"><form id="assignmentForm" class="card grid"><input name="title" placeholder="عنوان الواجب" required><select name="grade">${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><select name="group">${groupOpts.map(g=>`<option>${v25SafeAdmin(g)}</option>`).join('')}</select><input name="dueDate" type="date"><textarea name="desc" placeholder="تفاصيل الواجب"></textarea><button class="btn primary"><span data-icon="file-text"></span> إضافة واجب</button></form><div class="card"><h3>الواجبات الحالية</h3><div class="table-wrap"><table><thead><tr><th>الواجب</th><th>الصف</th><th>المجموعة</th><th>آخر موعد</th><th>إجراء</th></tr></thead><tbody>${(adminData.assignments||[]).map(a=>`<tr><td>${v25SafeAdmin(a.title)}</td><td>${v25SafeAdmin(a.grade)}</td><td>${v25SafeAdmin(a.group||'كل المجموعات')}</td><td>${v25SafeAdmin(a.dueDate||'-')}</td><td><button class="small-btn danger" onclick="deleteAssignment('${v25SafeAdmin(a.id)}')">حذف</button></td></tr>`).join('')||'<tr><td colspan="5">لا توجد واجبات</td></tr>'}</tbody></table></div></div></div>`);
  document.getElementById('assignmentForm').addEventListener('submit',e=>{e.preventDefault(); const a=Object.fromEntries(new FormData(e.target).entries()); a.id='ass-'+Date.now(); adminData.assignments.push(a); persist('تم إضافة الواجب'); renderAssignments();}); hydrateIcons();
}
window.deleteAssignment=function(id){adminData.assignments=(adminData.assignments||[]).filter(a=>a.id!==id); persist('تم حذف الواجب'); renderAssignments();};
function renderStudents(){
  fresh(); ensureAdminCollections();
  content(`<div class="section-head"><div><span class="kicker"><span data-icon="users"></span> الطلاب</span><h2 class="section-title">بيانات الطلاب والمتابعة</h2></div><div class="header-actions"><button class="btn ghost" onclick="exportStudentsCSV()"><span data-icon="database"></span> تصدير Excel</button></div></div><div class="card" style="margin-bottom:18px"><form id="addStudentForm" class="grid grid-4"><input name="name" placeholder="اسم الطالب" required><input name="studentPhone" placeholder="رقم الطالب" required><input name="parentPhone" placeholder="رقم ولي الأمر" required><select name="grade">${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><select name="month">${MONTHS.map(m=>`<option>${m}</option>`).join('')}</select><select name="group">${groupOptions().map(g=>`<option>${v25SafeAdmin(g)}</option>`).join('')}</select><textarea name="notes" placeholder="ملاحظات المدرس"></textarea><button class="btn primary" type="submit"><span data-icon="user"></span> تسجيل طالب</button></form></div><div class="admin-toolbar"><input id="studentAdminSearch" placeholder="بحث بالاسم / الكود / رقم ولي الأمر"><select id="studentAdminGrade"><option value="all">كل الصفوف</option>${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><select id="studentAdminPay"><option value="all">كل حالات الدفع</option><option value="true">تم الدفع</option><option value="false">لم يدفع</option></select><button class="btn ghost" onclick="refreshStudentsTable()"><span data-icon="search"></span> بحث</button></div><div id="studentsTableBox">${studentsTable(adminData.students)}</div>`);
  document.getElementById('addStudentForm').addEventListener('submit',e=>{e.preventDefault(); const s=Object.fromEntries(new FormData(e.target).entries()); s.code=uid(); s.paid=false; s.paymentDate=''; s.attendance=[]; s.recitations=[]; s.grades=[]; s.homeworks=[]; adminData.students.push(s); persist('تم تسجيل الطالب'); renderStudents();}); ['studentAdminSearch','studentAdminGrade','studentAdminPay'].forEach(id=>document.getElementById(id)?.addEventListener('input',refreshStudentsTable)); hydrateIcons();
}
function renderSettings(){
  fresh(); ensureAdminCollections();
  content(`<div class="section-head"><div><span class="kicker"><span data-icon="sparkles"></span> إعدادات الموقع</span><h2 class="section-title">رابط الموقع وبيانات أساسية</h2></div></div><div class="card"><form id="setForm" class="grid"><input name="heroTitle" value="${v25SafeAdmin(adminData.settings?.heroTitle||'')}" placeholder="عنوان الهيرو"><input name="siteUrl" value="${v25SafeAdmin(adminData.settings?.siteUrl||'')}" placeholder="رابط الموقع الأساسي للـ QR"><input name="teacherPhone" value="${v25SafeAdmin(adminData.settings?.teacherPhone||TEACHER_WHATSAPP)}" placeholder="رقم واتساب المدرس"><textarea name="homeNotice" placeholder="رسالة تنبيه تظهر للطلاب">${v25SafeAdmin(adminData.settings?.homeNotice||'')}</textarea><button class="btn primary"><span data-icon="sparkles"></span> حفظ الإعدادات</button></form></div><div class="seo-card" style="margin-top:18px"><h3>مهم للـ QR</h3><p>اكتب رابط الدومين الأساسي مثل: https://mahmoud-fawzy-science-platform.vercel.app عشان الباركود يفتح بوابة الطالب على الرابط الصحيح.</p></div>`);
  document.getElementById('setForm').addEventListener('submit',e=>{e.preventDefault(); adminData.settings={...adminData.settings,...Object.fromEntries(new FormData(e.target).entries())}; if(adminData.settings.teacherPhone) TEACHER_WHATSAPP=adminData.settings.teacherPhone; persist('تم حفظ الإعدادات');}); hydrateIcons();
}
function renderSection(){fresh(); ensureAdminCollections(); if(currentSection==='overview')renderOverview(); else if(currentSection==='students')renderStudents(); else if(currentSection==='bookings')renderBookings(); else if(currentSection==='groups')renderGroups(); else if(currentSection==='attendance')renderAttendance(); else if(currentSection==='payments')renderPayments(); else if(currentSection==='assignments')renderAssignments(); else if(currentSection==='materials')renderMaterials(); else if(currentSection==='questions')renderQuestions(); else if(currentSection==='exams')renderExams(); else if(currentSection==='reviews')renderReviewsAdmin(); else if(currentSection==='settings')renderSettings(); hydrateIcons();}
function renderAdmin(){
  const root=document.getElementById('adminRoot'); ensureAdminCollections(); root.className='admin-page';
  root.innerHTML=`<aside class="admin-sidebar"><div class="logo"><span class="logo-mark" data-icon="atom"></span><span>لوحة مستر محمود <small>إدارة الحصص والمتابعة</small></span></div><div class="admin-nav">${adminSections.map(([id,ic,name])=>`<button data-admin-nav="${id}" class="${id===currentSection?'active':''}"><span data-icon="${ic}"></span>${name}</button>`).join('')}</div><div style="margin-top:20px"><button class="btn ghost" style="width:100%" onclick="location.href='index.html'"><span data-icon="external-link"></span> معاينة الموقع</button></div></aside><main class="admin-main"><div class="admin-top"><div><span class="kicker"><span data-icon="sparkles"></span> Dashboard</span><h1 class="section-title" style="font-size:2.25rem">لوحة مستر محمود ابراهيم فوزي</h1></div><div class="header-actions"><button class="theme-toggle" id="themeToggleAdmin"></button><button class="btn ghost" onclick="forceFirestoreSync()"><span data-icon="database"></span> مزامنة Firebase</button><button class="btn dark" onclick="location.reload()">خروج</button></div></div><div id="adminContent"></div></main>`;
  hydrateIcons(); setupAdminTheme(); bindNav(); renderSection();
}

/* v31: manual WhatsApp parent report + unified resources in admin */
function adminNormalizeEgyptPhone(phone){
  let p=String(phone||'').replace(/[^0-9]/g,'');
  if(!p) return '';
  if(p.startsWith('00')) p=p.slice(2);
  if(p.startsWith('0')) p='20'+p.slice(1);
  if(!p.startsWith('20') && p.length===10) p='20'+p;
  return p;
}
function buildParentWhatsAppReport(st){
  const c=calcStudent(st); const att=typeof attendanceSummary==='function'?attendanceSummary(st):{present:0,absent:0,late:0};
  const rec=typeof recitationSummary==='function'?recitationSummary(st):{heard:0,notHeard:0,pct:0};
  const last=(st.grades||[]).filter(g=>g.score!==null&&g.score!==undefined&&g.score!=='').slice(-1)[0];
  const base=(adminData.settings?.siteUrl||location.origin||'').replace(/\/$/,'');
  const reportLink=base ? `${base}/parent.html?code=${encodeURIComponent(st.code)}` : `parent.html?code=${encodeURIComponent(st.code)}`;
  return `السلام عليكم، تقرير الطالب ${st.name}\n\nالكود: ${st.code}\nالصف: ${st.grade}\nالمجموعة: ${st.group||'-'}\n\nالحضور: ${c.attendancePct}%\nحاضر: ${att.present||0} / غياب: ${att.absent||0} / تأخير: ${att.late||0}\nالتسميع: ${rec.pct||0}% - سمع: ${rec.heard||0} / لم يسمع: ${rec.notHeard||0}\nمتوسط الدرجات: ${c.avg||0}%\nآخر نتيجة: ${last ? `${last.exam} - ${last.score}%` : 'لا توجد نتيجة حديثة'}\nحالة الدفع: ${st.paid?'تم الدفع':'لم يدفع'}\nملاحظة المدرس: ${st.notes||'لا توجد ملاحظات'}\n\nرابط التقرير الكامل:\n${reportLink}`;
}
window.sendParentWhatsAppReport=function(code){
  fresh(); const st=adminData.students.find(s=>s.code===code); if(!st) return aToast('لم يتم العثور على الطالب');
  const phone=adminNormalizeEgyptPhone(st.parentPhone); if(!phone) return aToast('رقم ولي الأمر غير موجود أو غير صحيح');
  const url=`https://wa.me/${phone}?text=${encodeURIComponent(buildParentWhatsAppReport(st))}`;
  window.open(url,'_blank','noopener,noreferrer');
};
const v31OldStudentRow = typeof studentRow==='function' ? studentRow : null;
studentRow=function(s){
  const c=calcStudent(s); return `<tr><td>${s.code}</td><td>${safeV31Admin(s.name)}</td><td>${s.grade}</td><td>${s.month||'-'}</td><td>${c.attendancePct}%</td><td>${c.lastGrade?c.lastGrade.score+'%':'-'}</td><td><span class="badge ${c.final>=75?'good':c.final>=60?'warn':'danger'}">${c.level}</span></td><td><span class="badge ${s.paid?'good':'danger'}">${s.paid?'تم الدفع':'لم يدفع'}</span></td><td><div class="admin-card-actions"><button class="small-btn whatsapp-report-btn" onclick="sendParentWhatsAppReport('${s.code}')">تقرير واتساب</button><button class="small-btn" onclick="printStudentReport('${s.code}')">طباعة</button><button class="small-btn danger" onclick="deleteStudent('${s.code}')"><span data-icon="trash"></span> حذف</button></div></td></tr>`;
};
function safeV31Admin(v){return String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
studentsTable=function(rows){
  const list=rows||adminData.students||[];
  return `<div class="table-wrap"><table><thead><tr><th>الكود</th><th>الطالب</th><th>الصف</th><th>الشهر</th><th>الحضور</th><th>آخر درجة</th><th>المستوى</th><th>الدفع</th><th>إجراء</th></tr></thead><tbody>${list.map(studentRow).join('')||'<tr><td colspan="9">لا يوجد طلاب</td></tr>'}</tbody></table></div>`;
};
(function unifyAdminResources(){
  try{
    const qi=adminSections.findIndex(x=>x[0]==='questions'); if(qi>-1) adminSections.splice(qi,1);
    const m=adminSections.find(x=>x[0]==='materials'); if(m){m[2]='المراجعات والأسئلة'; m[1]='book-open';}
  }catch(e){}
})();
renderMaterials=function(){
  fresh(); ensureAdminCollections?.();
  content(`<div class="section-head"><div><span class="kicker"><span data-icon="book-open"></span> المراجعات والأسئلة</span><h2 class="section-title">إدارة مراجعات العلوم وبنك الأسئلة من مكان واحد</h2><p class="section-desc">أضف ملف مراجعة أو سؤال تدريبي، وسيظهروا للطالب في صفحة واحدة منظمة حسب الصف.</p></div></div>
  <div class="admin-resource-tabs-v31">
    <form id="matForm" class="card grid"><span class="kicker"><span data-icon="book-open"></span> إضافة مراجعة</span><input name="title" placeholder="عنوان الملف" required><select name="grade">${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><select name="type"><option>PDF</option><option>صورة</option><option>مراجعة مكتوبة</option><option>رابط فيديو</option></select><textarea name="desc" placeholder="وصف مختصر"></textarea><textarea name="content" placeholder="محتوى مكتوب أو رابط"></textarea><input name="file" type="file" accept="image/*,.pdf"><button class="btn primary"><span data-icon="upload"></span> إضافة المراجعة</button></form>
    <form id="qForm" class="card grid"><span class="kicker"><span data-icon="help-circle"></span> إضافة سؤال</span><select name="grade">${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><input name="unit" placeholder="الوحدة / الدرس"><textarea name="question" placeholder="السؤال" required></textarea><textarea name="answer" placeholder="الإجابة النموذجية" required></textarea><input name="file" type="file" accept="image/*,.pdf"><button class="btn gold"><span data-icon="upload"></span> إضافة السؤال</button></form>
  </div>
  <div class="admin-resource-list-v31"><div><h3>المراجعات الحالية</h3><div class="grid">${(adminData.materials||[]).map(m=>itemCard(m,'materials')).join('')||'<div class="card"><h3>لا توجد مراجعات</h3></div>'}</div></div><div><h3>أسئلة البنك الحالية</h3><div class="grid">${(adminData.questions||[]).map(q=>itemCard(q,'questions')).join('')||'<div class="card"><h3>لا توجد أسئلة</h3></div>'}</div></div></div>`);
  document.getElementById('matForm')?.addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(e.target); const f=await fileToData(fd.get('file')); adminData.materials.push({id:`mat-${Date.now()}`,title:fd.get('title'),grade:fd.get('grade'),type:fd.get('type'),desc:fd.get('desc'),content:fd.get('content'),...f}); persist('تم إضافة المراجعة'); renderMaterials();});
  document.getElementById('qForm')?.addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(e.target); const f=await fileToData(fd.get('file')); adminData.questions.push({id:`q-${Date.now()}`,grade:fd.get('grade'),unit:fd.get('unit'),question:fd.get('question'),answer:fd.get('answer'),...f}); persist('تم إضافة السؤال'); renderMaterials();});
  hydrateIcons();
};
renderSection=function(){fresh(); ensureAdminCollections?.(); if(currentSection==='overview')renderOverview(); else if(currentSection==='students')renderStudents(); else if(currentSection==='bookings')renderBookings(); else if(currentSection==='groups')renderGroups(); else if(currentSection==='attendance')renderAttendance(); else if(currentSection==='payments')renderPayments(); else if(currentSection==='assignments')renderAssignments(); else if(currentSection==='materials')renderMaterials(); else if(currentSection==='exams')renderExams(); else if(currentSection==='reviews')renderReviewsAdmin(); else if(currentSection==='settings')renderSettings(); hydrateIcons();};

/* v34: PDF-only resources, grade-filtered payments, manual essay exam correction */
function v34AdminEsc(v){return String(v ?? '').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
function isPdfFileV34(file){return file && file.name && (/\.pdf$/i.test(file.name) || file.type==='application/pdf');}
function parseAttemptAnswersV34(attempt, exam){
  let answers=attempt.answers||{};
  if(!attempt.answers && attempt.answer){try{answers=JSON.parse(attempt.answer);}catch(e){answers={raw:attempt.answer};}}
  const questions=typeof parseExamBlocksV34==='function'?parseExamBlocksV34(exam?.text||''):[];
  if(!questions.length) return `<div class="written-box">${v34AdminEsc(attempt.answer||'لا توجد إجابة مكتوبة')}</div>`;
  return `<div class="attempt-answer-list-v34">${questions.map((q,i)=>`<div class="attempt-answer-v34"><b>${i+1}) ${v34AdminEsc(q.question)}</b><small>${q.type==='mcq'?'اختياري':'مقالي'}</small><p>${v34AdminEsc(answers[`q${i}`]||'لم تتم الإجابة')}</p></div>`).join('')}</div>`;
}
function pendingAttemptsV34(){return (adminData.examAttempts||[]).filter(a=>a.needsManual || a.status==='في انتظار تصحيح المدرس' || a.status==='في انتظار التصحيح');}
function renderAttemptsTable(){
  const attempts=adminData.examAttempts||[];
  const pending=pendingAttemptsV34();
  const pendingHtml=`<div class="card manual-correction-v34" style="margin-top:18px"><h3>تصحيح امتحانات المقالي</h3><p class="section-desc">أي امتحان فيه سؤال مقالي لا تظهر نتيجته للطالب إلا بعد تصحيح المدرس وحفظ الدرجة النهائية.</p><div class="grid">${pending.length?pending.slice().reverse().map(a=>{const st=(adminData.students||[]).find(s=>s.code===a.studentCode)||{}; const ex=(adminData.exams||[]).find(e=>e.id===a.examId || e.title===a.examTitle)||{}; return `<div class="card correction-card-v34"><div class="profile-top"><div><span class="badge warn">في انتظار التصحيح</span><h3>${v34AdminEsc(a.examTitle)}</h3><p>${v34AdminEsc(a.studentName||st.name||a.studentCode)} - ${v34AdminEsc(a.studentCode)}</p></div><span class="badge">MCQ مبدئي: ${a.autoScore??'-'}%</span></div>${parseAttemptAnswersV34(a,ex)}<form class="grid grid-3" onsubmit="saveManualExamScore(event,'${v34AdminEsc(a.id||'')}','${v34AdminEsc(a.studentCode)}','${v34AdminEsc(a.examTitle)}')"><input name="score" type="number" min="0" max="100" placeholder="الدرجة النهائية من 100" required><input name="note" placeholder="ملاحظة للطالب / ولي الأمر"><button class="btn primary"><span data-icon="bar-chart"></span> حفظ التصحيح</button></form></div>`;}).join(''):'<div class="card"><h3>لا توجد امتحانات مقالية في انتظار التصحيح</h3></div>'}</div></div>`;
  const allHtml=`<div class="card" style="margin-top:18px"><h3>كل محاولات الامتحان</h3><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الامتحان</th><th>التاريخ</th><th>الحالة</th><th>الدرجة</th><th>محاولات خروج</th></tr></thead><tbody>${attempts.length?attempts.slice(-20).reverse().map(a=>`<tr><td>${v34AdminEsc(a.studentName||a.studentCode)}</td><td>${v34AdminEsc(a.examTitle)}</td><td>${v34AdminEsc(a.date)}</td><td>${v34AdminEsc(a.status)}</td><td>${a.score===null||a.score===undefined?'في انتظار التصحيح':a.score+'%'}</td><td>${a.exitCount||0}</td></tr>`).join(''):'<tr><td colspan="6">لا توجد محاولات حتى الآن</td></tr>'}</tbody></table></div></div>`;
  return pendingHtml+allHtml;
}
window.saveManualExamScore=function(ev,attemptId,studentCode,examTitle){
  ev.preventDefault(); const fd=Object.fromEntries(new FormData(ev.target).entries()); const score=Number(fd.score);
  const attempt=(adminData.examAttempts||[]).find(a=>String(a.id||'')===String(attemptId)) || (adminData.examAttempts||[]).find(a=>a.studentCode===studentCode&&a.examTitle===examTitle&&a.needsManual);
  if(attempt){attempt.score=score; attempt.finalScore=score; attempt.status='تم التصحيح بواسطة المدرس'; attempt.needsManual=false; attempt.teacherNote=fd.note||''; attempt.correctedAt=today();}
  const st=(adminData.students||[]).find(s=>s.code===studentCode); if(st){st.grades=st.grades||[]; const existing=st.grades.find(g=>g.exam===examTitle); const payload={exam:examTitle,score,type:'أونلاين',date:today(),status:'تم التصحيح بواسطة المدرس',note:fd.note||''}; if(existing)Object.assign(existing,payload); else st.grades.push(payload);}
  persist('تم حفظ تصحيح الامتحان وظهرت النتيجة للطالب'); renderExams();
};
renderExams=function(){
  content(`<div class="section-head"><div><span class="kicker"><span data-icon="clipboard"></span> الامتحانات الشهرية</span><h2 class="section-title">اختياري فوري، والمقالي بتصحيح المدرس</h2><p class="section-desc">لو الامتحان اختياري فقط، الموقع يصحح فورًا. لو فيه أي سؤال مقالي، المدرس يصحح الامتحان بالكامل ثم تظهر النتيجة للطالب.</p></div></div><div class="admin-hint">طريقة كتابة الأسئلة: الاختياري Q: ثم A/B/C/D و Answer. السؤال المقالي ابدأه بـ Essay: أو مقالي: وافصل بين الأسئلة بسطر ---</div><div class="portal-shell"><form id="examForm" class="card grid"><input name="title" placeholder="عنوان الامتحان" required><select name="grade">${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><input name="date" type="date" required><input name="questions" type="number" placeholder="عدد الأسئلة" value="20"><input name="duration" type="number" placeholder="الوقت بالدقائق" value="20"><select name="status"><option>مفتوح</option><option>متاح قريبًا</option><option>مغلق</option></select><select name="mode"><option>اختياري فقط</option><option>اختياري + مقالي</option><option>مقالي فقط</option></select><textarea name="instructions" placeholder="تعليمات الامتحان"></textarea><textarea name="text" placeholder="Q: ما وحدة قياس السرعة؟\nA) نيوتن\nB) متر/ثانية\nC) كيلوجرام\nD) جول\nAnswer: B\n---\nEssay: اشرح مفهوم الحركة في سطرين"></textarea><input name="file" type="file" accept="image/*,.pdf"><button class="btn primary"><span data-icon="upload"></span> إضافة امتحان</button></form><div class="grid">${adminData.exams.map(ex=>itemCard(ex,'exams')).join('')||'<div class="card"><h3>لا توجد امتحانات</h3></div>'}</div></div><div class="card" style="margin-top:18px"><h3>إضافة درجة يدوية</h3><form id="gradeForm" class="grid grid-4"><input name="code" placeholder="كود الطالب" required><input name="exam" placeholder="اسم الامتحان" required><input name="score" type="number" min="0" max="100" placeholder="الدرجة" required><select name="type"><option>ورقي</option><option>أونلاين</option></select><button class="btn gold"><span data-icon="bar-chart"></span> حفظ الدرجة</button></form></div>${renderAttemptsTable()}`);
  document.getElementById('examForm').addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(e.target); const f=await fileToData(fd.get('file')); adminData.exams.push({id:`ex-${Date.now()}`,title:fd.get('title'),grade:fd.get('grade'),date:fd.get('date'),questions:fd.get('questions'),duration:Number(fd.get('duration')||20),status:fd.get('status'),mode:fd.get('mode'),instructions:fd.get('instructions'),text:fd.get('text'),...f}); persist('تم إضافة الامتحان'); renderExams();});
  document.getElementById('gradeForm').addEventListener('submit',e=>{e.preventDefault(); const fd=Object.fromEntries(new FormData(e.target).entries()); const st=adminData.students.find(s=>s.code===fd.code); if(!st)return aToast('كود الطالب غير موجود'); st.grades=st.grades||[]; const existing=st.grades.find(g=>g.exam===fd.exam); if(existing){existing.score=Number(fd.score); existing.type=fd.type; existing.date=today(); existing.status='تم التصحيح';} else st.grades.push({exam:fd.exam,score:Number(fd.score),type:fd.type,date:today(),status:'تم التصحيح'}); persist('تم حفظ الدرجة'); e.target.reset(); renderExams();});
  hydrateIcons();
};
renderPayments=function(){
  fresh(); ensureAdminCollections?.(); const selected=sessionStorage.getItem('payGradeV34')||GRADES[0]; const rows=(adminData.students||[]).filter(s=>s.grade===selected);
  content(`<div class="section-head"><div><span class="kicker"><span data-icon="database"></span> المدفوعات</span><h2 class="section-title">اختار الصف لعرض طلابه فقط</h2><p class="section-desc">عشان عدد الطلاب مايبقاش كبير في جدول واحد، اختار الصف الأول ثم عدل حالة الدفع.</p></div></div><div class="card payment-filter-v34"><div class="admin-toolbar"><select id="payGradeSelect">${GRADES.map(g=>`<option ${g===selected?'selected':''}>${g}</option>`).join('')}</select><button class="btn ghost" onclick="applyPaymentGradeV34()"><span data-icon="search"></span> عرض الطلاب</button><span class="badge">${rows.length} طالب</span></div></div><div class="card"><h3>${v34AdminEsc(selected)}</h3><div class="table-wrap"><table><thead><tr><th>الكود</th><th>الطالب</th><th>الشهر</th><th>ولي الأمر</th><th>الحالة</th><th>آخر دفع</th><th>تحكم</th></tr></thead><tbody>${rows.map(s=>`<tr><td>${v34AdminEsc(s.code)}</td><td>${v34AdminEsc(s.name)}</td><td>${v34AdminEsc(s.month||'-')}</td><td>${v34AdminEsc(s.parentPhone||'-')}</td><td><span class="badge ${s.paid?'good':'danger'}">${s.paid?'تم الدفع':'لم يدفع'}</span></td><td>${v34AdminEsc(s.paymentDate||'-')}</td><td><button class="small-btn primary" onclick="setPaid('${v34AdminEsc(s.code)}',true)">تم الدفع</button><button class="small-btn danger" onclick="setPaid('${v34AdminEsc(s.code)}',false)">لم يدفع</button></td></tr>`).join('')||'<tr><td colspan="7">لا يوجد طلاب في هذا الصف</td></tr>'}</tbody></table></div></div>`);
  hydrateIcons();
};
window.applyPaymentGradeV34=function(){sessionStorage.setItem('payGradeV34',document.getElementById('payGradeSelect').value); renderPayments();};
renderMaterials=function(){
  fresh(); ensureAdminCollections?.();
  content(`<div class="section-head"><div><span class="kicker"><span data-icon="book-open"></span> المراجعات والأسئلة</span><h2 class="section-title">رفع ملفات PDF فقط</h2><p class="section-desc">المراجعات وبنك الأسئلة يظهروا للطالب كملفات PDF منظمة حسب الصف.</p></div></div><div class="admin-resource-tabs-v31"><form id="matForm" class="card grid"><span class="kicker"><span data-icon="book-open"></span> إضافة مراجعة PDF</span><input name="title" placeholder="عنوان الملف" required><select name="grade">${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><textarea name="desc" placeholder="وصف مختصر"></textarea><input name="file" type="file" accept="application/pdf,.pdf" required><button class="btn primary"><span data-icon="upload"></span> إضافة PDF</button></form><form id="qForm" class="card grid"><span class="kicker"><span data-icon="help-circle"></span> إضافة بنك أسئلة PDF</span><select name="grade">${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><input name="unit" placeholder="الوحدة / الدرس"><input name="title" placeholder="عنوان ملف الأسئلة" required><textarea name="desc" placeholder="وصف مختصر"></textarea><input name="file" type="file" accept="application/pdf,.pdf" required><button class="btn gold"><span data-icon="upload"></span> إضافة PDF</button></form></div><div class="admin-resource-list-v31"><div><h3>المراجعات الحالية</h3><div class="grid">${(adminData.materials||[]).map(m=>itemCard(m,'materials')).join('')||'<div class="card"><h3>لا توجد مراجعات</h3></div>'}</div></div><div><h3>ملفات الأسئلة الحالية</h3><div class="grid">${(adminData.questions||[]).map(q=>itemCard(q,'questions')).join('')||'<div class="card"><h3>لا توجد أسئلة</h3></div>'}</div></div></div>`);
  document.getElementById('matForm')?.addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(e.target); const file=fd.get('file'); if(!isPdfFileV34(file))return aToast('ارفع ملف PDF فقط'); const f=await fileToData(file); adminData.materials.push({id:`mat-${Date.now()}`,title:fd.get('title'),grade:fd.get('grade'),type:'PDF',desc:fd.get('desc'),content:'',...f}); persist('تم إضافة ملف PDF'); renderMaterials();});
  document.getElementById('qForm')?.addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(e.target); const file=fd.get('file'); if(!isPdfFileV34(file))return aToast('ارفع ملف PDF فقط'); const f=await fileToData(file); adminData.questions.push({id:`q-${Date.now()}`,grade:fd.get('grade'),unit:fd.get('unit'),question:fd.get('title'),answer:fd.get('desc')||'ملف PDF',...f}); persist('تم إضافة ملف أسئلة PDF'); renderMaterials();});
  hydrateIcons();
};
renderSection=function(){fresh(); ensureAdminCollections?.(); if(currentSection==='overview')renderOverview(); else if(currentSection==='students')renderStudents(); else if(currentSection==='bookings')renderBookings(); else if(currentSection==='groups')renderGroups(); else if(currentSection==='attendance')renderAttendance(); else if(currentSection==='payments')renderPayments(); else if(currentSection==='assignments')renderAssignments(); else if(currentSection==='materials')renderMaterials(); else if(currentSection==='exams')renderExams(); else if(currentSection==='reviews')renderReviewsAdmin(); else if(currentSection==='settings')renderSettings(); hydrateIcons();};

/* v35: Secure Exams + Admin UX */
(function v35AdminUpgrade(){
  window.ensureAdminCollections = window.ensureAdminCollections || function(){
    adminData.activityLog = adminData.activityLog || [];
    adminData.examAttempts = adminData.examAttempts || [];
    adminData.settings = adminData.settings || {};
  };
  function esc35(v){return String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
  function logActionV35(action, detail=''){
    try{
      adminData.activityLog = adminData.activityLog || [];
      adminData.activityLog.push({id:'log-'+Date.now(), action, detail, date:new Date().toLocaleString('ar-EG')});
      if(adminData.activityLog.length>300) adminData.activityLog = adminData.activityLog.slice(-300);
    }catch(e){}
  }
  const oldPersistV35 = persist;
  persist = function(msg){
    if(msg) logActionV35(msg, currentSection || 'admin');
    oldPersistV35(msg);
  };
  try{
    if(!adminSections.some(x=>x[0]==='activity')){
      const settingsIndex = adminSections.findIndex(x=>x[0]==='settings');
      const row=['activity','file-text','السجل والنسخ'];
      if(settingsIndex>-1) adminSections.splice(settingsIndex,0,row); else adminSections.push(row);
    }
  }catch(e){}
  window.exportBackupV35=function(){
    fresh();
    const payload={exportedAt:new Date().toISOString(), version:'v35', data:adminData};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='mahmoud-fawzy-platform-backup-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    logActionV35('تصدير نسخة احتياطية','JSON'); saveData(adminData); aToast('تم تحميل النسخة الاحتياطية');
  };
  window.printStudentQrV35=function(code){
    fresh(); const st=(adminData.students||[]).find(s=>s.code===code); if(!st)return aToast('كود الطالب غير موجود');
    const base=(adminData.settings?.siteUrl || location.origin).replace(/\/$/,'');
    const url=base + '/student.html?code=' + encodeURIComponent(st.code);
    const qr='https://api.qrserver.com/v1/create-qr-code/?size=220x220&data='+encodeURIComponent(url);
    const w=open('','_blank');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>QR ${esc35(st.name)}</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:32px;line-height:1.8} .card{max-width:420px;margin:auto;border:1px solid #ddd;border-radius:22px;padding:24px} img{width:220px;height:220px} h1{margin:8px 0}</style></head><body><div class="card"><h1>كود الطالب</h1><h2>${esc35(st.name)}</h2><p>${esc35(st.grade)} - ${esc35(st.group||'')}</p><img src="${qr}" alt="QR"><h3>${esc35(st.code)}</h3><p>امسح الكود لفتح بوابة الطالب مباشرة</p></div><script>setTimeout(()=>print(),600)<\/script></body></html>`);
    w.document.close();
  };
  const oldStudentRowV35 = studentRow;
  studentRow=function(s){
    const html = oldStudentRowV35(s);
    return html.replace('</div></td></tr>', `<button class="small-btn" onclick="printStudentQrV35('${esc35(s.code)}')"><span data-icon="qr"></span> QR</button></div></td></tr>`);
  };
  function examTemplateBuilderV35(){return `<div class="exam-builder-v35 card"><h3>منشئ سؤال سريع</h3><div class="grid grid-3"><select id="builderType"><option value="mcq">اختياري</option><option value="essay">مقالي</option></select><input id="builderQuestion" placeholder="نص السؤال"><input id="builderAnswer" placeholder="الإجابة الصحيحة للاختياري: A/B/C/D"></div><div class="grid grid-4 builder-options-v35"><input id="builderA" placeholder="A"><input id="builderB" placeholder="B"><input id="builderC" placeholder="C"><input id="builderD" placeholder="D"></div><div class="hero-cta"><button class="btn primary" type="button" onclick="addQuestionToExamV35()"><span data-icon="plus"></span> إضافة السؤال للنص</button><button class="btn ghost" type="button" onclick="clearExamTextV35()">مسح النص</button></div><p class="section-desc">لو أضفت سؤال مقالي واحد، الامتحان كله ينتظر تصحيح المدرس.</p></div>`;}
  window.addQuestionToExamV35=function(){
    const t=document.getElementById('builderType')?.value; const q=document.getElementById('builderQuestion')?.value.trim(); const area=document.querySelector('#examForm textarea[name="text"]'); if(!q||!area)return aToast('اكتب نص السؤال الأول');
    let block='';
    if(t==='essay') block=`Essay: ${q}`;
    else {const A=document.getElementById('builderA')?.value||''; const B=document.getElementById('builderB')?.value||''; const C=document.getElementById('builderC')?.value||''; const D=document.getElementById('builderD')?.value||''; const ans=(document.getElementById('builderAnswer')?.value||'').toUpperCase(); if(!A||!B||!ans)return aToast('اكتب الاختيارات والإجابة الصحيحة'); block=`Q: ${q}\nA) ${A}\nB) ${B}\nC) ${C}\nD) ${D}\nAnswer: ${ans}`;}
    area.value = (area.value.trim()? area.value.trim()+'\n---\n':'') + block;
    ['builderQuestion','builderAnswer','builderA','builderB','builderC','builderD'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
  };
  window.clearExamTextV35=function(){const a=document.querySelector('#examForm textarea[name="text"]'); if(a&&confirm('مسح نص الامتحان؟')) a.value='';};
  function getAttemptCategoryV35(a){ if(a.needsManual || String(a.status||'').includes('انتظار')) return 'pending'; if(String(a.status||'').includes('بواسطة المدرس')) return 'manualDone'; return 'auto'; }
  function renderAttemptsDashboardV35(){
    const attempts=adminData.examAttempts||[];
    const groups={pending:[],auto:[],manualDone:[]}; attempts.forEach(a=>groups[getAttemptCategoryV35(a)].push(a));
    const table=(rows,title)=>`<div class="card exam-attempt-list-v35"><h3>${title}</h3><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الامتحان</th><th>التاريخ</th><th>الحالة</th><th>الدرجة</th><th>خروج</th></tr></thead><tbody>${rows.length?rows.slice().reverse().map(a=>`<tr><td>${esc35(a.studentName||a.studentCode)}</td><td>${esc35(a.examTitle)}</td><td>${esc35(a.date)}</td><td>${esc35(a.status)}</td><td>${a.score===null||a.score===undefined?'في انتظار التصحيح':a.score+'%'}</td><td>${a.exitCount||0}</td></tr>`).join(''):'<tr><td colspan="6">لا توجد بيانات</td></tr>'}</tbody></table></div></div>`;
    return `<div class="exam-tabs-v35">${table(groups.pending,'في انتظار تصحيح المدرس')}${table(groups.auto,'تم التصحيح تلقائيًا')}${table(groups.manualDone,'تم تصحيحه يدويًا')}</div>`;
  }
  const oldRenderAttemptsTableV35 = renderAttemptsTable;
  renderAttemptsTable=function(){return oldRenderAttemptsTableV35()+renderAttemptsDashboardV35();};
  const oldRenderExamsV35 = renderExams;
  renderExams=function(){
    oldRenderExamsV35();
    const form=document.getElementById('examForm');
    if(form && !document.querySelector('.exam-builder-v35')) form.insertAdjacentHTML('afterend', examTemplateBuilderV35());
    const h2=document.querySelector('#adminContent .section-title'); if(h2) h2.textContent='إنشاء الامتحانات وتصحيح التسليمات';
    hydrateIcons();
  };
  window.renderActivityV35=function(){
    fresh(); ensureAdminCollections();
    content(`<div class="section-head"><div><span class="kicker"><span data-icon="file-text"></span> السجل والنسخ الاحتياطي</span><h2 class="section-title">آخر عمليات المدرس وتصدير البيانات</h2><p class="section-desc">استخدم النسخة الاحتياطية قبل أي تعديل كبير أو قبل نهاية الشهر.</p></div><button class="btn primary" onclick="exportBackupV35()"><span data-icon="download"></span> تصدير نسخة احتياطية</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>الوقت</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>${(adminData.activityLog||[]).slice().reverse().map(l=>`<tr><td>${esc35(l.date)}</td><td>${esc35(l.action)}</td><td>${esc35(l.detail||'-')}</td></tr>`).join('')||'<tr><td colspan="3">لا توجد عمليات مسجلة بعد</td></tr>'}</tbody></table></div></div>`);
    hydrateIcons();
  };
  renderSection=function(){fresh(); ensureAdminCollections?.(); if(currentSection==='overview')renderOverview(); else if(currentSection==='students')renderStudents(); else if(currentSection==='bookings')renderBookings(); else if(currentSection==='groups')renderGroups(); else if(currentSection==='attendance')renderAttendance(); else if(currentSection==='payments')renderPayments(); else if(currentSection==='assignments')renderAssignments(); else if(currentSection==='materials')renderMaterials(); else if(currentSection==='exams')renderExams(); else if(currentSection==='reviews')renderReviewsAdmin(); else if(currentSection==='activity')renderActivityV35(); else if(currentSection==='settings')renderSettings(); hydrateIcons();};
})();
try{
  icons.plus = icons.plus || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14"></path></svg>';
  icons.download = icons.download || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>';
}catch(e){}

/* v36: Simplified Admin + Clear Pending Exam Corrections + Mobile polish */
(function v36AdminPolish(){
  function e36(v){return String(v ?? '').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
  function pendingExamAttemptsV36(){
    fresh();
    return (adminData.examAttempts||[]).filter(a=>{
      const status=String(a.status||'');
      const noScore=a.score===null || a.score===undefined || a.score==='';
      return !!a.needsManual || !!a.hasEssay || status.includes('انتظار') || (noScore && status.includes('تسليم'));
    });
  }
  function attemptStatusClassV36(a){
    if(a.needsManual || String(a.status||'').includes('انتظار')) return 'warn';
    if(a.score!==null && a.score!==undefined) return 'good';
    return '';
  }
  function shortExamAnswerV36(attempt, ex){
    if(typeof parseAttemptAnswersV34==='function') return parseAttemptAnswersV34(attempt, ex);
    return `<div class="written-box">${e36(attempt.answer||'لا توجد إجابة')}</div>`;
  }
  window.saveManualExamScoreV36=function(ev,attemptId,studentCode,examTitle){
    ev.preventDefault();
    const fd=Object.fromEntries(new FormData(ev.target).entries());
    const score=Number(fd.score);
    if(Number.isNaN(score) || score<0 || score>100) return aToast('اكتب درجة صحيحة من 0 إلى 100');
    const attempt=(adminData.examAttempts||[]).find(a=>String(a.id||'')===String(attemptId)) || (adminData.examAttempts||[]).find(a=>String(a.studentCode)===String(studentCode)&&String(a.examTitle)===String(examTitle)&&(a.needsManual || String(a.status||'').includes('انتظار')));
    if(attempt){
      attempt.score=score;
      attempt.finalScore=score;
      attempt.status='تم التصحيح بواسطة المدرس';
      attempt.needsManual=false;
      attempt.hasEssay=!!attempt.hasEssay;
      attempt.teacherNote=fd.note||'';
      attempt.correctedAt=today();
    }
    const st=(adminData.students||[]).find(s=>String(s.code)===String(studentCode));
    if(st){
      st.grades=st.grades||[];
      const existing=st.grades.find(g=>String(g.exam)===String(examTitle));
      const payload={exam:examTitle,score,type:'أونلاين',date:today(),status:'تم التصحيح بواسطة المدرس',note:fd.note||''};
      if(existing) Object.assign(existing,payload); else st.grades.push(payload);
    }
    persist('تم تصحيح الامتحان وظهرت النتيجة للطالب');
    renderExams();
  };
  function renderPendingExamCorrectionsV36(){
    const pending=pendingExamAttemptsV36();
    return `<section class="admin-focus-card-v36 ${pending.length?'has-pending':''}">
      <div class="focus-head-v36">
        <div>
          <span class="kicker"><span data-icon="clipboard"></span> تصحيح مطلوب</span>
          <h2>امتحانات في انتظار تصحيح المدرس</h2>
          <p>أي امتحان فيه سؤال مقالي هيظهر هنا فور تسليم الطالب. اكتب الدرجة النهائية واضغط حفظ التصحيح.</p>
        </div>
        <span class="focus-count-v36">${pending.length}</span>
      </div>
      <div class="pending-grid-v36">
        ${pending.length?pending.slice().reverse().map(a=>{const st=(adminData.students||[]).find(s=>String(s.code)===String(a.studentCode))||{}; const ex=(adminData.exams||[]).find(e=>String(e.id)===String(a.examId)||String(e.title)===String(a.examTitle))||{}; return `<article class="card pending-correction-card-v36">
          <div class="profile-top">
            <div>
              <span class="badge warn">في انتظار التصحيح</span>
              <h3>${e36(a.examTitle||ex.title||'امتحان')}</h3>
              <p>${e36(a.studentName||st.name||'طالب')} - ${e36(a.studentCode||'-')}</p>
            </div>
            <span class="badge">اختياري مبدئي: ${a.autoScore??'-'}%</span>
          </div>
          ${shortExamAnswerV36(a,ex)}
          <form class="correction-form-v36" onsubmit="saveManualExamScoreV36(event,'${e36(a.id||'')}','${e36(a.studentCode||'')}','${e36(a.examTitle||ex.title||'')}')">
            <input name="score" type="number" min="0" max="100" placeholder="الدرجة النهائية / 100" required>
            <input name="note" placeholder="ملاحظة تظهر للطالب وولي الأمر">
            <button class="btn primary"><span data-icon="bar-chart"></span> حفظ التصحيح</button>
          </form>
        </article>`}).join(''):`<div class="empty-state-v36"><span data-icon="clipboard"></span><h3>لا توجد امتحانات منتظرة الآن</h3><p>لما طالب يسلم امتحان فيه مقالي، هيظهر هنا مباشرة.</p></div>`}
      </div>
    </section>`;
  }
  function renderExamAttemptsSummaryV36(){
    const attempts=(adminData.examAttempts||[]).slice().reverse();
    return `<div class="card compact-admin-card-v36"><div class="profile-top"><h3>كل تسليمات الامتحانات</h3><span class="badge">${attempts.length} تسليم</span></div><div class="table-wrap compact-table-v36"><table><thead><tr><th>الطالب</th><th>الامتحان</th><th>الحالة</th><th>الدرجة</th><th>التاريخ</th></tr></thead><tbody>${attempts.length?attempts.slice(0,30).map(a=>`<tr><td>${e36(a.studentName||a.studentCode)}</td><td>${e36(a.examTitle)}</td><td><span class="badge ${attemptStatusClassV36(a)}">${e36(a.status||'-')}</span></td><td>${a.score===null||a.score===undefined?'في انتظار التصحيح':a.score+'%'}</td><td>${e36(a.date||'-')}</td></tr>`).join(''):'<tr><td colspan="5">لا توجد تسليمات حتى الآن</td></tr>'}</tbody></table></div></div>`;
  }
  function examCardV36(ex){
    const isEssay = typeof examHasEssayV34==='function' ? examHasEssayV34(ex) : String(ex.mode||'').includes('مقالي');
    return `<article class="card exam-admin-card-v36"><div class="profile-top"><div><span class="badge ${ex.status==='مفتوح'?'good':'warn'}">${e36(ex.status||'-')}</span><span class="badge ${isEssay?'warn':'good'}">${isEssay?'تصحيح المدرس':'تصحيح فوري'}</span><h3>${e36(ex.title)}</h3><p>${e36(ex.grade||'-')} - ${ex.duration||20} دقيقة</p></div></div><p class="section-desc">${e36(ex.instructions||'لا توجد تعليمات')}</p><div class="admin-card-actions"><button class="small-btn danger" onclick="deleteContent('exams','${e36(ex.id)}')">حذف</button></div></article>`;
  }
  window.renderExams=function(){
    fresh(); ensureAdminCollections?.();
    content(`<div class="section-head admin-section-head-v36"><div><span class="kicker"><span data-icon="clipboard"></span> الامتحانات</span><h2 class="section-title">إنشاء الامتحانات وتصحيح التسليمات</h2><p class="section-desc">التصحيح المطلوب ظاهر في أول الصفحة عشان المدرس يوصله بسرعة.</p></div></div>${renderPendingExamCorrectionsV36()}<div class="admin-split-v36"><form id="examForm" class="card compact-admin-card-v36 grid"><h3>إضافة امتحان جديد</h3><input name="title" placeholder="عنوان الامتحان" required><select name="grade">${GRADES.map(g=>`<option>${g}</option>`).join('')}</select><div class="grid grid-2"><input name="date" type="date" required><input name="duration" type="number" placeholder="الوقت بالدقائق" value="20"></div><div class="grid grid-2"><input name="questions" type="number" placeholder="عدد الأسئلة" value="20"><select name="status"><option>مفتوح</option><option>متاح قريبًا</option><option>مغلق</option></select></div><select name="mode"><option>اختياري فقط</option><option>اختياري + مقالي</option><option>مقالي فقط</option></select><textarea name="instructions" placeholder="تعليمات الامتحان"></textarea><textarea name="text" placeholder="Q: نص السؤال\nA) اختيار\nB) اختيار\nC) اختيار\nD) اختيار\nAnswer: B\n---\nEssay: سؤال مقالي"></textarea><input name="file" type="file" accept="image/*,.pdf"><button class="btn primary"><span data-icon="upload"></span> إضافة امتحان</button></form><div><div class="card compact-admin-card-v36"><div class="profile-top"><h3>الامتحانات الحالية</h3><span class="badge">${(adminData.exams||[]).length}</span></div><div class="exam-admin-list-v36">${(adminData.exams||[]).map(examCardV36).join('')||'<div class="empty-state-v36"><h3>لا توجد امتحانات</h3></div>'}</div></div></div></div><div class="grid grid-2 admin-lower-grid-v36"><div class="card compact-admin-card-v36"><h3>إضافة درجة يدوية</h3><form id="gradeForm" class="grid"><input name="code" placeholder="كود الطالب" required><input name="exam" placeholder="اسم الامتحان" required><input name="score" type="number" min="0" max="100" placeholder="الدرجة" required><select name="type"><option>ورقي</option><option>أونلاين</option></select><button class="btn gold"><span data-icon="bar-chart"></span> حفظ الدرجة</button></form></div>${renderExamAttemptsSummaryV36()}</div>`);
    document.getElementById('examForm')?.addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(e.target); const f=await fileToData(fd.get('file')); adminData.exams.push({id:`ex-${Date.now()}`,title:fd.get('title'),grade:fd.get('grade'),date:fd.get('date'),questions:fd.get('questions'),duration:Number(fd.get('duration')||20),status:fd.get('status'),mode:fd.get('mode'),instructions:fd.get('instructions'),text:fd.get('text'),...f}); persist('تم إضافة الامتحان'); renderExams();});
    document.getElementById('gradeForm')?.addEventListener('submit',e=>{e.preventDefault(); const fd=Object.fromEntries(new FormData(e.target).entries()); const st=(adminData.students||[]).find(s=>s.code===fd.code); if(!st)return aToast('كود الطالب غير موجود'); st.grades=st.grades||[]; const existing=st.grades.find(g=>g.exam===fd.exam); const payload={exam:fd.exam,score:Number(fd.score),type:fd.type,date:today(),status:'تم التصحيح'}; if(existing)Object.assign(existing,payload); else st.grades.push(payload); persist('تم حفظ الدرجة'); e.target.reset(); renderExams();});
    hydrateIcons();
  };
  function pendingCountV36(){return pendingExamAttemptsV36().length;}
  function navNameV36(id,name){ if(id==='overview')return 'الرئيسية'; if(id==='materials')return 'المراجعات'; if(id==='activity')return 'السجل'; if(id==='exams'){const p=pendingCountV36(); return `الامتحانات${p?` <b class="nav-badge-v36">${p}</b>`:''}`;} return name; }
  const oldRenderAdminV36 = window.renderAdmin || renderAdmin;
  window.renderAdmin=function(){
    fresh(); ensureAdminCollections?.();
    const root=document.getElementById('adminRoot');
    const visibleSections=adminSections.filter(([id])=>id!=='questions');
    root.className='admin-page admin-page-v36';
    root.innerHTML=`<aside class="admin-sidebar"><div class="logo admin-logo-v36"><span class="logo-mark" data-icon="atom"></span><span>لوحة المدرس <small>إدارة مبسطة</small></span></div><div class="admin-nav admin-nav-v36">${visibleSections.map(([id,ic,name])=>`<button data-admin-nav="${id}" class="${id===currentSection?'active':''}"><span data-icon="${ic}"></span><span>${navNameV36(id,name)}</span></button>`).join('')}</div><button class="btn ghost admin-preview-btn-v36" onclick="location.href='index.html'"><span data-icon="external-link"></span> معاينة الموقع</button></aside><main class="admin-main"><div class="admin-top admin-top-v36"><div><span class="kicker"><span data-icon="sparkles"></span> لوحة التحكم</span><h1>مستر محمود ابراهيم فوزي</h1></div><div class="header-actions"><button class="theme-toggle" id="themeToggleAdmin"></button><button class="btn ghost admin-sync-btn-v36" onclick="forceFirestoreSync()"><span data-icon="database"></span> مزامنة</button><button class="btn dark" onclick="location.reload()">خروج</button></div></div><div id="adminContent"></div></main>`;
    hydrateIcons(); setupAdminTheme(); bindNav(); renderSection();
  };
  const previousRenderSectionV36 = renderSection;
  renderSection=function(){
    fresh(); ensureAdminCollections?.();
    if(currentSection==='exams') renderExams();
    else previousRenderSectionV36();
    document.querySelectorAll('[data-admin-nav]').forEach(b=>b.classList.toggle('active',b.dataset.adminNav===currentSection));
    hydrateIcons();
  };
})();

/* v37 Simple Admin: task cards, fewer links, mobile-first */
(function v37SimpleAdmin(){
  function e37(v){return String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
  function pendingAttempts37(){
    try{fresh();}catch(e){}
    return (adminData.examAttempts||[]).filter(a=>!!a.needsManual || !!a.hasEssay || String(a.status||'').includes('انتظار') || ((a.score===null||a.score===undefined||a.score==='') && String(a.status||'').includes('تسليم')));
  }
  window.openAdminSectionV37=function(id){currentSection=id; renderAdmin();};
  const coreSections37 = [
    ['overview','bar-chart','الرئيسية'],
    ['bookings','calendar','الحجوزات'],
    ['students','users','الطلاب'],
    ['attendance','user-check','حضور وتسميع'],
    ['payments','database','الدفع'],
    ['assignments','file-text','الواجبات'],
    ['exams','clipboard','الامتحانات'],
    ['materials','book-open','المراجعات'],
    ['reviews','star','التقييمات'],
    ['activity','file-text','السجل'],
    ['settings','sparkles','الإعدادات']
  ];
  window.renderOverview=function(){
    fresh(); ensureAdminCollections?.();
    const s=typeof stats==='function'?stats():{total:(adminData.students||[]).length,unpaid:(adminData.students||[]).filter(x=>!x.paid).length};
    const pending=pendingAttempts37().length;
    const attendToday=(adminData.students||[]).filter(st=>(st.attendance||[]).some(a=>a.date===today())).length;
    const reciteToday=(adminData.students||[]).filter(st=>(st.recitations||[]).some(r=>r.date===today()&&r.status==='سمع')).length;
    content(`<div class="admin-dashboard-v37">
      <div class="admin-simple-welcome card"><span class="kicker"><span data-icon="sparkles"></span> لوحة مبسطة</span><h2>ابدأ بالمهمة المطلوبة فقط</h2><p>اللوحة مقسمة حسب الاستخدام اليومي: حجز، طلاب، حضور وتسميع، دفع، واجبات، وامتحانات.</p></div>
      <div class="admin-quick-grid-v37">
        <div class="card"><span class="iconbox" data-icon="users"></span><h3>الطلاب</h3><div class="section-title" style="font-size:2rem">${s.total||0}</div></div>
        <div class="card"><span class="iconbox" data-icon="user-check"></span><h3>حضور اليوم</h3><div class="section-title" style="font-size:2rem">${attendToday}</div></div>
        <div class="card"><span class="iconbox" data-icon="clipboard"></span><h3>تسميع اليوم</h3><div class="section-title" style="font-size:2rem;color:var(--green)">${reciteToday}</div></div>
        <div class="card"><span class="iconbox" data-icon="database"></span><h3>لم يدفعوا</h3><div class="section-title" style="font-size:2rem;color:var(--red)">${s.unpaid||0}</div></div>
      </div>
      <div class="card"><h3>اختصارات الإدارة</h3><div class="admin-task-grid-v37">
        <button class="btn primary" onclick="openAdminSectionV37('attendance')"><span data-icon="user-check"></span> تسجيل الحصة</button>
        <button class="btn ghost" onclick="openAdminSectionV37('bookings')"><span data-icon="calendar"></span> الحجوزات</button>
        <button class="btn ghost" onclick="openAdminSectionV37('students')"><span data-icon="users"></span> الطلاب</button>
        <button class="btn ghost" onclick="openAdminSectionV37('payments')"><span data-icon="database"></span> الدفع</button>
        <button class="btn ghost" onclick="openAdminSectionV37('assignments')"><span data-icon="file-text"></span> الواجبات</button>
        <button class="btn ${pending?'gold':'ghost'}" onclick="openAdminSectionV37('exams')"><span data-icon="clipboard"></span> تصحيح الامتحانات ${pending?`(${pending})`:''}</button>
        <button class="btn ghost" onclick="openAdminSectionV37('materials')"><span data-icon="book-open"></span> المراجعات</button>
        <button class="btn ghost" onclick="openAdminSectionV37('activity')"><span data-icon="file-text"></span> النسخ والسجل</button>
      </div></div>
      ${pending?`<div class="card pending-alert-v37"><span class="badge warn">مهم</span><h3>يوجد ${pending} امتحان في انتظار التصحيح</h3><p>افتح قسم الامتحانات، ستجد التسليمات المنتظرة في أول الصفحة.</p><button class="btn primary" onclick="openAdminSectionV37('exams')">فتح التصحيح الآن</button></div>`:''}
    </div>`);
    hydrateIcons();
  };
  const oldRenderPayments37 = window.renderPayments || renderPayments;
  window.renderPayments=function(){
    if(typeof renderPayments==='function') return oldRenderPayments37();
  };
  function navLabel37(id,name){
    if(id==='exams'){const p=pendingAttempts37().length; return `الامتحانات${p?` <b class="nav-badge-v36">${p}</b>`:''}`;}
    return name;
  }
  const previousRenderSection37 = renderSection;
  window.renderAdmin=function(){
    fresh(); ensureAdminCollections?.();
    const root=document.getElementById('adminRoot'); if(!root) return;
    const sections=coreSections37.filter(([id])=>{
      if(id==='activity') return !!adminSections.some(x=>x[0]==='activity');
      if(id==='assignments') return !!adminSections.some(x=>x[0]==='assignments');
      return true;
    });
    root.className='admin-page admin-page-v37';
    root.innerHTML=`<aside class="admin-sidebar"><div class="logo admin-logo-v36"><span class="logo-mark" data-icon="atom"></span><span>لوحة المدرس <small>مبسطة</small></span></div><div class="admin-nav admin-nav-v36">${sections.map(([id,ic,name])=>`<button data-admin-nav="${id}" class="${id===currentSection?'active':''}"><span data-icon="${ic}"></span><span>${navLabel37(id,name)}</span></button>`).join('')}</div><button class="btn ghost admin-preview-btn-v36" onclick="location.href='index.html'"><span data-icon="external-link"></span> معاينة الموقع</button></aside><main class="admin-main"><div class="admin-top admin-top-v36"><div><span class="kicker"><span data-icon="sparkles"></span> لوحة التحكم</span><h1>مستر محمود ابراهيم فوزي</h1></div><div class="header-actions"><button class="theme-toggle" id="themeToggleAdmin"></button><button class="btn ghost admin-sync-btn-v36" onclick="forceFirestoreSync()"><span data-icon="database"></span> مزامنة</button><button class="btn dark" onclick="location.reload()">خروج</button></div></div><div id="adminContent"></div></main>`;
    hydrateIcons(); setupAdminTheme(); bindNav(); renderSection();
  };
  renderSection=function(){
    fresh(); ensureAdminCollections?.();
    if(currentSection==='overview') renderOverview();
    else if(currentSection==='students') renderStudents();
    else if(currentSection==='bookings') renderBookings();
    else if(currentSection==='groups') renderGroups?.();
    else if(currentSection==='attendance') renderAttendance();
    else if(currentSection==='payments') renderPayments();
    else if(currentSection==='assignments') renderAssignments?.();
    else if(currentSection==='materials') renderMaterials();
    else if(currentSection==='exams') renderExams();
    else if(currentSection==='reviews') renderReviewsAdmin();
    else if(currentSection==='activity') (typeof renderActivityV35==='function'?renderActivityV35():previousRenderSection37());
    else if(currentSection==='settings') renderSettings();
    document.querySelectorAll('[data-admin-nav]').forEach(b=>b.classList.toggle('active',b.dataset.adminNav===currentSection));
    hydrateIcons();
  };
})();
