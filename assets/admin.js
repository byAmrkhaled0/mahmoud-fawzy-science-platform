'use strict';

let adminData = typeof loadData === 'function' ? loadData() : {students:[],bookings:[],materials:[],questions:[],exams:[],examAttempts:[],reviews:[],groups:[],assignments:[],settings:{}};
let currentSection = 'overview';
let currentStaff = null;
let qrScanner = null;
let attendanceDate = new Date().toISOString().slice(0,10);
let adminCloudSaveTimer = null;
let bookingNotificationUnsubscribe = null;
let bookingListenerReady = false;

const adminSections = [
  ['overview','bar-chart','الرئيسية'],
  ['students','users','الطلاب'],
  ['bookings','calendar','الحجوزات'],
  ['schedules','calendar','المواعيد'],
  ['attendance','qr','الحضور والغياب'],
  ['payments','database','اشتراك السنتر'],
  ['exams','clipboard','الامتحانات'],
  ['materials','book-open','المراجعات والأسئلة'],
  ['reviews','star','التقييمات']
];

function aToast(msg){const t=document.getElementById('toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2800);}
function safe(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function fresh(){adminData=typeof loadData==='function'?loadData():adminData; ensureCollections();}
function ensureCollections(){['students','bookings','materials','questions','exams','examAttempts','grades','reviews','groups','assignments'].forEach(k=>{if(!Array.isArray(adminData[k]))adminData[k]=[];}); adminData.settings=adminData.settings||{};}
function persist(msg,meta){
  ensureCollections();
  saveData(adminData);
  clearTimeout(adminCloudSaveTimer);
  adminCloudSaveTimer=setTimeout(()=>{
    window.MFCloud?.saveSiteData?.(adminData).catch(()=>aToast('تم حفظ التغييرات على الجهاز، وسنحاول رفعها عند عودة الاتصال'));
  },350);
  if(msg){
    aToast(msg);
    setTimeout(()=>window.MFCloud?.logActivity?.(msg,meta||{}).catch(()=>{}),0);
  }
}
function deferAdminRender(fn){setTimeout(fn,40);}
function phoneDigits(v){return (typeof toEnglishDigits==='function'?toEnglishDigits(v):String(v||'').replace(/[٠-٩]/g,digit=>String(digit.charCodeAt(0)-1632)).replace(/[۰-۹]/g,digit=>String(digit.charCodeAt(0)-1776))).replace(/\D/g,'');}
function isoDateAdmin(d=new Date()){return d.toISOString().slice(0,10);}
function timeNow(){return new Date().toLocaleTimeString('ar-EG',{hour:'numeric',minute:'2-digit'});}
function randomAccessCode(prefix){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const bytes=new Uint8Array(8);if(window.crypto?.getRandomValues)window.crypto.getRandomValues(bytes);else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);const body=[...bytes].map(x=>alphabet[x%alphabet.length]).join('');return `${prefix}-${body.slice(0,4)}-${body.slice(4,8)}`;}
function uniqueAccessCode(prefix,field){let code;do{code=randomAccessCode(prefix);}while(adminData.students.some(s=>String(s[field]||'').toUpperCase()===code));return code;}
function newStudentCode(){return uniqueAccessCode('ST','studentCode');}
function newParentCode(){return uniqueAccessCode('PR','parentCode');}
function isWeakAccessCode(code){return !/^[A-Z]{2}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(String(code||'').toUpperCase());}
function adminWhatsAppPhone(v){const d=phoneDigits(v); if(!d) return ''; if(d.startsWith('20')) return d; if(d.startsWith('0')) return '2'+d; return d;}
function monthlyReportTextForStudent(st){const s=normalizeStudent(st); if(typeof parentReportText==='function') return parentReportText(s); const c=calcStudentAdmin(s); return `تقرير متابعة شهر ${s.month||''}\n\nالطالب: ${s.name}\nالكود: ${s.studentCode}\nالصف: ${s.grade||'-'}\nالمجموعة: ${s.group||'-'}\n\nالمستوى العام: ${c.final||0}%\nنسبة الحضور: ${c.attendancePct||0}%\nمتوسط الدرجات: ${c.avg||0}%\nاشتراك السنتر: ${s.paid?'تم الدفع في السنتر':'لم يتم الدفع في السنتر'}\n\nملاحظات المدرس:\n${s.notes||'لا توجد ملاحظات حالية.'}`;}
function issuedCodesText(student){const s=normalizeStudent(student);return `اسم الطالب: ${s.name}\nكود الطالب: ${s.studentCode}\nكود ولي الأمر: ${s.parentCode}`;}
window.closeIssuedCodes=function(){document.getElementById('issuedCodesModal')?.remove();};
window.copyIssuedCodes=async function(){const modal=document.getElementById('issuedCodesModal'),text=modal?.dataset.copyText||'';try{await navigator.clipboard.writeText(text);aToast('تم نسخ الأكواد');}catch(_){prompt('انسخ الأكواد',text);}};
window.showIssuedCodes=function(student,title='تم تسجيل الطالب بنجاح'){
  const s=normalizeStudent(student);closeIssuedCodes();document.body.insertAdjacentHTML('beforeend',`<div class="issued-codes-modal" id="issuedCodesModal" role="dialog" aria-modal="true" data-copy-text="${safe(issuedCodesText(s))}"><div class="card issued-codes-card"><button class="issued-codes-close" type="button" onclick="closeIssuedCodes()" aria-label="إغلاق">×</button><span class="badge good">تم الحفظ على النظام</span><h2>${safe(title)}</h2><p>${safe(s.name)} · ${safe(s.grade||'')}</p><div class="issued-code-row"><small>كود الطالب</small><code>${safe(s.studentCode)}</code></div><div class="issued-code-row"><small>كود ولي الأمر</small><code>${safe(s.parentCode)}</code></div><div class="mobile-actions"><button class="btn primary" type="button" onclick="copyIssuedCodes()"><span data-icon="clipboard"></span> نسخ الكودين</button><button class="btn ghost" type="button" onclick="closeIssuedCodes()">تم</button></div></div></div>`);hydrateIcons();
};
function stCode(st){return st.studentCode||st.code||st.id||'';}
function stName(st){return st.studentName||st.name||'';}
function normalizeStudent(st){const normalize=typeof toEnglishDigits==='function'?toEnglishDigits:value=>String(value||'');const code=normalize(stCode(st)||'').toUpperCase(); return {...st,id:code,code,studentCode:code,parentCode:normalize(st.parentCode||'').toUpperCase(),studentPhone:phoneDigits(st.studentPhone),parentPhone:phoneDigits(st.parentPhone),name:stName(st),studentName:stName(st),active:st.active!==false};}
function groupOptions(){const data=[...(adminData.groups||[]).filter(g=>g.active!==false).map(g=>g.name),...(adminData.students||[]).map(s=>s.group)].filter(Boolean); return [...new Set(data)];}
function calcStudentAdmin(st){const c=typeof calcStudent==='function'?calcStudent(st):{attendancePct:0,avg:0,final:0,level:'-'}; return c;}
function badgeStatus(v){return v===true||v==='present'||v==='حاضر'||v==='تم الدفع'?'good':v===false||v==='absent'||v==='غائب'||v==='لم يدفع'?'danger':'warn';}
function content(html){const el=document.getElementById('adminContent'); if(el) el.innerHTML=`<section class="admin-section active">${html}</section>`; hydrateIcons();}
function selectedGrade(){return document.getElementById('attendanceGrade')?.value || 'all';}
function selectedGroup(){return document.getElementById('attendanceGroup')?.value || 'all';}
function filterStudents(grade='all', group='all'){return (adminData.students||[]).map(normalizeStudent).filter(s=>(grade==='all'||s.grade===grade)&&(group==='all'||s.group===group));}

async function cloudDelete(collection,id){try{if(window.MFCloud?.deleteDocument) await window.MFCloud.deleteDocument(collection,id);}catch(e){}}
async function reloadFromCloud(){
  if(!window.MFCloud?.loadSiteData) return;
  const data = await window.MFCloud.loadSiteData();
  if(data){ adminData = mergeData(data); saveData(adminData); }
}

function unauthorized(message='غير مصرح لك بالدخول.'){
  const root=document.getElementById('adminRoot');
  root.className='login-page';
  root.innerHTML=`<div class="card login-card"><div class="logo"><span class="logo-mark" data-icon="atom"></span><span>مستر محمود إبراهيم فوزي <small>صفحة المدرس الخاصة</small></span></div><h1 class="section-title" style="font-size:2rem;margin:22px 0 8px">${safe(message)}</h1><p class="section-desc">هذه الصفحة مخصصة فقط لحسابات فريق العمل المعتمدة.</p><button class="btn ghost" onclick="location.reload()">رجوع لتسجيل الدخول</button></div>`;
  hydrateIcons();
}

function adminLogin(){
  const form=document.getElementById('loginForm'); if(!form) return;
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const email=form.email.value.trim(); const pass=form.password.value;
    if(!window.MFCloud?.ready || !window.MFCloud.signIn) return aToast('خدمة تسجيل الدخول غير متاحة الآن. تحقق من الإنترنت وحاول مرة أخرى.');
    try{
      await window.MFCloud.signIn(email,pass);
      currentStaff = await window.MFCloud.getCurrentStaffProfile();
      if(!currentStaff?.allowed){ await window.MFCloud.signOut?.(); unauthorized('غير مصرح لك بالدخول.'); return; }
      await reloadFromCloud();
      renderAdmin();
      aToast('تم الدخول إلى لوحة المدرس');
    }catch(err){ aToast('بيانات الدخول غير صحيحة أو الحساب غير مصرح له'); }
  });
}

async function tryRestoreSession(){
  if(!window.MFCloud?.auth?.onAuthStateChanged) return;
  window.MFCloud.auth.onAuthStateChanged(async user=>{
    if(!user || document.querySelector('.admin-page')) return;
    try{
      currentStaff = await window.MFCloud.getCurrentStaffProfile();
      if(currentStaff?.allowed){ await reloadFromCloud(); renderAdmin(); }
    }catch(e){}
  });
}

function adminSectionName(id){return adminSections.find(([sectionId])=>sectionId===id)?.[2]||'الرئيسية';}
function setAdminDrawer(open){
  document.body.classList.toggle('admin-drawer-open',!!open);
  document.getElementById('adminDrawerBackdrop')?.classList.toggle('show',!!open);
  const mobile=window.matchMedia?.('(max-width:980px)').matches;
  document.getElementById('adminSidebar')?.setAttribute('aria-hidden',mobile&&!open?'true':'false');
}
window.toggleAdminDrawer=function(open){setAdminDrawer(open ?? !document.body.classList.contains('admin-drawer-open'));};
function syncAdminChrome(){
  document.querySelectorAll('[data-admin-nav]').forEach(btn=>btn.classList.toggle('active',btn.dataset.adminNav===currentSection));
  const label=document.getElementById('adminCurrentSectionLabel');
  if(label) label.textContent=adminSectionName(currentSection);
}
window.goAdminSection=function(id){
  if(!adminSections.some(([sectionId])=>sectionId===id))return;
  currentSection=id;
  syncAdminChrome();
  setAdminDrawer(false);
  renderSection();
  window.scrollTo({top:0,behavior:'smooth'});
};

function renderAdmin(){
  fresh();
  document.body.classList.add('admin-dashboard-active');
  const root=document.getElementById('adminRoot');
  root.className='admin-page admin-page-v37';
  root.innerHTML=`
    <div class="admin-drawer-backdrop" id="adminDrawerBackdrop" onclick="toggleAdminDrawer(false)"></div>
    <aside class="admin-sidebar" id="adminSidebar" aria-label="أقسام لوحة التحكم">
      <div class="admin-sidebar-head">
        <div class="logo"><span class="logo-mark" data-icon="atom"></span><span>لوحة مستر محمود <small>حساب ${safe(currentStaff?.role||'staff')}</small></span></div>
        <button class="admin-sidebar-close" type="button" aria-label="إغلاق القائمة" onclick="toggleAdminDrawer(false)">×</button>
      </div>
      <div class="admin-nav">${adminSections.map(([id,ic,name])=>`<button type="button" data-admin-nav="${id}" class="${id===currentSection?'active':''}"><span data-icon="${ic}"></span><span>${name}</span></button>`).join('')}</div>
      <div class="admin-sidebar-footer"><button class="btn ghost" type="button" onclick="location.href='index.html'"><span data-icon="external-link"></span> معاينة الموقع</button></div>
    </aside>
    <main class="admin-main">
      <header class="admin-mobile-header">
        <button class="admin-menu-button" type="button" aria-label="فتح قائمة لوحة التحكم" onclick="toggleAdminDrawer(true)"><span aria-hidden="true">☰</span></button>
        <div><small>مرحبًا مستر محمود</small><strong id="adminCurrentSectionLabel">${safe(adminSectionName(currentSection))}</strong></div>
        <button class="admin-mobile-home" type="button" aria-label="معاينة الموقع" onclick="location.href='index.html'"><span data-icon="external-link"></span></button>
      </header>
      <div class="admin-top">
        <div class="admin-welcome"><span class="kicker"><span data-icon="sparkles"></span> لوحة المدرس</span><h1 class="section-title">أهلًا يا مستر محمود 👋</h1><p>يوم موفق! طلابك وحجوزاتك ومتابعتك كلها جاهزة من هنا.</p></div>
        <div class="header-actions"><button class="theme-toggle" id="themeToggleAdmin" aria-label="تغيير الوضع"></button><button class="btn ghost" type="button" onclick="enableBookingNotifications()"><span data-icon="calendar"></span><span>تنبيهات الحجز</span></button><button class="btn ghost" type="button" onclick="forceFirestoreSync()"><span data-icon="refresh-cw"></span><span>حفظ ومزامنة</span></button><button class="btn dark" type="button" onclick="adminLogout()">خروج</button></div>
      </div>
      <div id="adminContent"></div>
    </main>
    <nav class="admin-mobile-bottom" aria-label="التنقل السريع في لوحة التحكم">
      ${[['overview','bar-chart','الرئيسية'],['bookings','calendar','الحجوزات'],['schedules','calendar','المواعيد'],['students','users','الطلاب']].map(([id,ic,name])=>`<button type="button" data-admin-nav="${id}" class="${id===currentSection?'active':''}"><span data-icon="${ic}"></span><span>${name}</span></button>`).join('')}
      <button type="button" onclick="toggleAdminDrawer(true)"><span aria-hidden="true">☰</span><span>المزيد</span></button>
    </nav>`;
  setupTheme();
  bindNav();
  setAdminDrawer(false);
  renderSection();
  syncAdminChrome();
  hydrateIcons();
  startBookingNotifications();
}

window.enableBookingNotifications=async function(){if(!('Notification' in window))return aToast('المتصفح لا يدعم إشعارات الهاتف');const permission=await Notification.requestPermission();if(permission!=='granted')return aToast('اسمح بالإشعارات من إعدادات المتصفح');localStorage.setItem('mf-booking-notifications','1');startBookingNotifications();try{await window.MFCloud?.registerTeacherPushToken?.();aToast('تم تفعيل التنبيهات حتى عند إغلاق اللوحة');}catch(error){aToast(String(error?.message||'').includes('VAPID')?'التنبيه أثناء فتح اللوحة مفعل؛ أضف مفتاح Web Push لتعمل وهي مغلقة':'تم تفعيل تنبيهات الحجوزات على هذا الجهاز');}};
function startBookingNotifications(){if(bookingNotificationUnsubscribe||!window.MFCloud?.subscribeToBookings)return;bookingNotificationUnsubscribe=window.MFCloud.subscribeToBookings((rows,changes)=>{adminData.bookings=rows;saveData(adminData);if(bookingListenerReady){changes.filter(change=>change.type==='added').forEach(change=>{const b=change.doc.data();aToast(`حجز جديد: ${b.name||b.studentName||'طالب جديد'}`);if(Notification.permission==='granted'&&localStorage.getItem('mf-booking-notifications')==='1'){const n=new Notification('حجز طالب جديد',{body:`${b.name||b.studentName||''} · ${b.grade||''} · ${b.group||''}`,icon:'assets/icon-192.png',tag:`booking-${b.code||change.doc.id}`});n.onclick=()=>{window.focus();goAdminSection('bookings');};}});}bookingListenerReady=true;if(currentSection==='bookings')renderBookings();});}

function bindNav(){
  document.querySelectorAll('[data-admin-nav]').forEach(btn=>{btn.onclick=()=>goAdminSection(btn.dataset.adminNav);});
  if(!window.__adminEscapeBound){
    document.addEventListener('keydown',event=>{if(event.key==='Escape')setAdminDrawer(false);});
    window.addEventListener('resize',()=>{if(!window.matchMedia('(max-width:980px)').matches)setAdminDrawer(false);});
    window.__adminEscapeBound=true;
  }
}
window.adminLogout=async function(){try{await window.MFCloud?.signOut?.();}catch(e){} location.reload();};
window.forceFirestoreSync=async function(){try{persist(); await window.MFCloud?.saveSiteData?.(adminData); aToast('تم حفظ ومزامنة جميع البيانات');}catch(e){aToast('تعذر إكمال المزامنة. تحقق من الإنترنت وحاول مرة أخرى.');}};

function stats(){fresh(); const today=isoDateAdmin(); const att=(adminData.students||[]).filter(s=>(s.attendance||[]).some(a=>String(a.date)===today&&a.status==='present')).length; const bookings=adminData.bookings.filter(b=>!String(b.status||'').includes('تم القبول')).length; return {students:adminData.students.length,bookings,unpaid:adminData.students.filter(s=>!s.paid).length,att};}
function renderOverview(){const s=stats(); content(`<div class="section-head"><div><span class="kicker"><span data-icon="bar-chart"></span> ملخص المنصة</span><h2 class="section-title">جاهزية الموقع للتشغيل الحقيقي</h2><p class="section-desc">كل بيانات الطلاب والحضور محفوظة ومتاحة لفريق العمل حسب الصلاحيات.</p></div></div><div class="grid grid-4"><div class="card"><h3>الطلاب</h3><b class="big-num">${s.students}</b></div><div class="card"><h3>الحجوزات</h3><b class="big-num">${s.bookings}</b></div><div class="card"><h3>غير مشترك</h3><b class="big-num">${s.unpaid}</b></div><div class="card"><h3>حضور اليوم</h3><b class="big-num">${s.att}</b></div></div><div class="grid grid-2" style="margin-top:18px"><div class="card"><h3>اختصارات سريعة</h3><div class="admin-task-grid-v37"><button class="btn primary" onclick="goAdminSection('attendance')"><span data-icon="qr"></span> فتح ماسح QR</button><button class="btn ghost" onclick="goAdminSection('students')"><span data-icon="users"></span> إدارة الطلاب</button><button class="btn ghost" onclick="goAdminSection('bookings')"><span data-icon="calendar"></span> مراجعة الحجوزات</button></div></div><div class="card"><h3>حماية الحساب</h3><p class="section-desc">لوحة المدرس لا تفتح إلا لحسابات فريق العمل المعتمدة، وتظهر الأدوات المناسبة لصلاحية كل حساب.</p></div></div>`);}

function studentRow(st){const s=normalizeStudent(st), c=calcStudentAdmin(s); return `<tr><td><b>${safe(s.studentCode)}</b><small style="display:block">ولي الأمر: ${safe(s.parentCode||'غير منشأ')}</small></td><td>${safe(s.name)}</td><td>${safe(s.grade)}</td><td>${safe(s.group||'-')}</td><td><span class="badge ${badgeStatus(s.paid)}">${s.paid?'تم الدفع في السنتر':'لم يتم الدفع في السنتر'}</span></td><td>${c.attendancePct||0}%</td><td>${c.avg||0}%</td><td><div class="pay-row"><button class="small-btn primary" onclick="editStudent('${safe(s.studentCode)}')">تعديل</button><button class="small-btn" onclick="copyStudentCodes('${safe(s.studentCode)}')">نسخ الأكواد</button><button class="small-btn" onclick="regenerateParentCode('${safe(s.studentCode)}')">كود ولي أمر جديد</button><button class="small-btn danger" onclick="regenerateStudentCode('${safe(s.studentCode)}')">تغيير كود الطالب</button><button class="small-btn" onclick="quickPresent('${safe(s.studentCode)}')">حضور</button><button class="small-btn" onclick="printStudentReport('${safe(s.studentCode)}')">تفاصيل</button><button class="small-btn whatsapp-report-btn" onclick="sendParentMonthlyReport('${safe(s.studentCode)}')">واتساب</button><button class="small-btn danger" onclick="deleteStudent('${safe(s.studentCode)}')">حذف</button></div></td></tr>`;}
function studentMobileCards(rows){return `<div class="student-mobile-cards">${rows.map(st=>{const s=normalizeStudent(st),c=calcStudentAdmin(s); return `<article class="mobile-admin-card"><div class="mobile-admin-card-head"><div><b>${safe(s.name)}</b><small>${safe(s.studentCode)} · ${safe(s.grade)} · ${safe(s.group||'-')}</small></div><span class="badge ${badgeStatus(s.paid)}">${s.paid?'تم الدفع في السنتر':'لم يتم الدفع في السنتر'}</span></div><div class="mobile-card-kpis"><span><small>الحضور</small><b>${c.attendancePct||0}%</b></span><span><small>الدرجات</small><b>${c.avg||0}%</b></span><span><small>كود ولي الأمر</small><b>${safe(s.parentCode||'غير منشأ')}</b></span></div><div class="mobile-primary-actions"><button type="button" class="small-btn primary" onclick="editStudent('${safe(s.studentCode)}')">تعديل</button><button type="button" class="small-btn" onclick="quickPresent('${safe(s.studentCode)}')">حضور</button><button type="button" class="small-btn whatsapp-report-btn" onclick="sendParentMonthlyReport('${safe(s.studentCode)}')">واتساب</button></div><details class="admin-more-actions"><summary>المزيد من الإجراءات</summary><div class="mobile-actions"><button type="button" class="small-btn" onclick="copyStudentCodes('${safe(s.studentCode)}')">نسخ الأكواد</button><button type="button" class="small-btn" onclick="regenerateParentCode('${safe(s.studentCode)}')">كود ولي أمر جديد</button><button type="button" class="small-btn danger" onclick="regenerateStudentCode('${safe(s.studentCode)}')">تغيير كود الطالب</button><button type="button" class="small-btn" onclick="printStudentReport('${safe(s.studentCode)}')">التفاصيل</button><button type="button" class="small-btn danger" onclick="deleteStudent('${safe(s.studentCode)}')">حذف الطالب</button></div></details></article>`;}).join('')||'<p class="section-desc">لا يوجد طلاب.</p>'}</div>`;}
function renderStudents(){fresh(); const rows=adminData.students.map(normalizeStudent); content(`<div class="section-head"><div><span class="kicker"><span data-icon="users"></span> الطلاب</span><h2 class="section-title">بيانات الطلاب والمتابعة</h2><p class="section-desc">لكل طالب كود قوي، ولكل ولي أمر كود منفصل. يمكن تكرار نفس رقم ولي الأمر لأكثر من طالب.</p></div><button class="btn ghost" onclick="upgradeLegacyAccessCodes()">ترقية الأكواد القديمة</button></div><div class="card monthly-report-help-v38"><h3>تقارير أول الشهر</h3><p>زر واتساب بجوار كل طالب يفتح رسالة جاهزة لولي الأمر فيها الحضور، الدرجات، اشتراك السنتر، وملاحظات المدرس.</p></div><div class="card" style="margin-bottom:18px"><form id="addStudentForm" class="grid grid-4"><input name="name" placeholder="اسم الطالب" required><input name="studentPhone" inputmode="tel" placeholder="رقم الطالب"><input name="parentPhone" inputmode="tel" placeholder="رقم ولي الأمر" required><select name="grade">${GRADES.map(g=>`<option>${safe(g)}</option>`).join('')}</select><select name="month">${MONTHS.map(m=>`<option>${safe(m)}</option>`).join('')}</select><select name="group">${groupOptions().map(g=>`<option>${safe(g)}</option>`).join('')}</select><textarea name="notes" placeholder="ملاحظات المدرس"></textarea><button class="btn primary" type="submit"><span data-icon="user"></span> تسجيل طالب وإظهار الأكواد</button></form></div><div class="admin-toolbar"><input id="studentSearchAdmin" placeholder="بحث بالكود أو رقم ولي الأمر"><select id="studentGradeAdmin"><option value="all">كل الصفوف</option>${GRADES.map(g=>`<option>${safe(g)}</option>`).join('')}</select><select id="studentPayAdmin"><option value="all">كل حالات اشتراك السنتر</option><option value="paid">تم الدفع في السنتر</option><option value="unpaid">لم يتم الدفع في السنتر</option></select><button class="btn ghost" onclick="refreshStudentsTable()"><span data-icon="search"></span> بحث</button></div><div id="studentsTableBox">${studentsTable(rows)}</div>`); document.getElementById('addStudentForm').onsubmit=async e=>{e.preventDefault(); const form=e.target; const button=form.querySelector('button[type="submit"]'); const input=Object.fromEntries(new FormData(form).entries()); input.studentPhone=phoneDigits(input.studentPhone); input.parentPhone=phoneDigits(input.parentPhone); input.studentName=input.name; input.paid=false; input.active=true; input.attendance=[]; input.grades=[]; input.homeworks=[]; input.recitations=[]; button.disabled=true; button.classList.add('is-loading'); try{const created=await window.MFCloud?.createStudentAccess?.(input); if(!created?.studentCode)throw new Error('تعذر إنشاء الأكواد'); const s={...input,...created,code:created.studentCode,id:created.studentCode}; adminData.students.push(s); saveData(adminData); aToast('تم تسجيل الطالب وإنشاء كود طالب وكود ولي أمر'); window.MFCloud?.logActivity?.('تم تسجيل طالب جديد',{studentCode:s.studentCode}).catch(()=>{}); form.reset(); renderStudents(); showIssuedCodes(s,'تم تسجيل الطالب وإصدار الأكواد');}catch(err){aToast(err?.message?.split(':').pop()?.trim()||'تعذر تسجيل الطالب. راجع Firebase Functions.');}finally{button.disabled=false; button.classList.remove('is-loading');}}; ['studentSearchAdmin','studentGradeAdmin','studentPayAdmin'].forEach(id=>document.getElementById(id)?.addEventListener('input',refreshStudentsTable));}
function studentsTable(rows){return `${studentMobileCards(rows)}<div class="table-wrap admin-table-desktop"><table><thead><tr><th>الكود</th><th>الطالب</th><th>الصف</th><th>المجموعة</th><th>اشتراك السنتر</th><th>الحضور</th><th>الدرجات</th><th>إجراء</th></tr></thead><tbody>${rows.map(studentRow).join('')||'<tr><td colspan="8">لا يوجد طلاب</td></tr>'}</tbody></table></div>`;}
window.refreshStudentsTable=function(){let rows=adminData.students.map(normalizeStudent); const q=normalizeText(document.getElementById('studentSearchAdmin')?.value||''); const g=document.getElementById('studentGradeAdmin')?.value||'all'; const pay=document.getElementById('studentPayAdmin')?.value||'all'; if(q) rows=rows.filter(s=>normalizeText([s.name,s.studentCode,s.parentCode,s.parentPhone,s.studentPhone,s.group].join(' ')).includes(q)); if(g!=='all') rows=rows.filter(s=>s.grade===g); if(pay==='paid') rows=rows.filter(s=>s.paid); if(pay==='unpaid') rows=rows.filter(s=>!s.paid); document.getElementById('studentsTableBox').innerHTML=studentsTable(rows); hydrateIcons();};
window.editStudent=function(code){const s=adminData.students.find(x=>stCode(x)===code); if(!s)return; const name=prompt('اسم الطالب',stName(s)); if(name===null)return; const parentPhone=prompt('رقم ولي الأمر',s.parentPhone||''); if(parentPhone===null)return; s.name=s.studentName=name; s.parentPhone=parentPhone; s.notes=prompt('ملاحظات المدرس',s.notes||'')||s.notes||''; persist('تم تحديث بيانات الطالب'); renderStudents();};
window.deleteStudent=function(code){if(!confirm('حذف الطالب وكل بياناته؟'))return; const student=adminData.students.find(s=>stCode(s)===code); adminData.students=adminData.students.filter(s=>stCode(s)!==code); persist('تم حذف الطالب',{studentCode:code}); deferAdminRender(renderStudents); window.MFCloud?.deleteStudentPortals?.(student||{studentCode:code}).catch(()=>{});};
window.printStudentReport=function(code){const s=adminData.students.find(x=>stCode(x)===code); if(!s)return; const w=window.open('','_blank'); w.document.write(`<html dir="rtl"><head><title>تقرير ${safe(stName(s))}</title><link rel="stylesheet" href="assets/site.css"></head><body><main class="section"><div class="container">${studentProfileHTML(normalizeStudent(s),true)}</div></main></body></html>`); w.document.close();};
window.sendParentMonthlyReport=function(code){const s=adminData.students.find(x=>stCode(x)===code); if(!s)return aToast('لم يتم العثور على الطالب'); const phone=adminWhatsAppPhone(s.parentPhone); if(!phone)return aToast('رقم ولي الأمر غير موجود'); window.open(whatsappLink(phone, monthlyReportTextForStudent(s)),'_blank');};
window.copyParentMonthlyReport=function(code){const s=adminData.students.find(x=>stCode(x)===code); if(!s)return aToast('لم يتم العثور على الطالب'); navigator.clipboard?.writeText(monthlyReportTextForStudent(s)).then(()=>aToast('تم نسخ التقرير')).catch(()=>aToast('تعذر النسخ'));};

window.copyStudentCodes=async function(code){
  const raw=adminData.students.find(x=>stCode(x)===code);if(!raw)return aToast('لم يتم العثور على الطالب');const s=normalizeStudent(raw);
  const text=`اسم الطالب: ${s.name}\nكود الطالب: ${s.studentCode}\nكود ولي الأمر: ${s.parentCode||'غير منشأ'}`;
  try{await navigator.clipboard.writeText(text);aToast('تم نسخ كود الطالب وكود ولي الأمر');}catch(e){prompt('انسخ الأكواد',text);}
};
window.regenerateParentCode=async function(code){
  const s=adminData.students.find(x=>stCode(x)===code);if(!s)return;
  if(!confirm('إنشاء كود ولي أمر جديد؟ سيتوقف الكود السابق فور اكتمال الحفظ.'))return;
  const oldParentCode=String(s.parentCode||'').toUpperCase();
  s.parentCode=newParentCode();persist('تم إنشاء كود ولي أمر جديد',{studentCode:code});
  try{
    await window.MFCloud?.saveStudent?.(s);
    if(oldParentCode&&oldParentCode!==s.parentCode)await window.MFCloud?.deleteDocument?.('parent_portal',oldParentCode);
  }catch(e){aToast('تم تحديث الكود على الجهاز، لكن تعذر اعتماده الآن. تحقق من الإنترنت ثم أعد المحاولة.');}
  renderStudents();
};
window.regenerateStudentCode=async function(code){
  const s=adminData.students.find(x=>stCode(x)===code);if(!s)return;
  if(!confirm('سيتم تغيير كود الطالب وتحديث جميع سجلاته. يجب إرسال الكود الجديد للطالب. متابعة؟'))return;
  const oldCode=stCode(s),newCode=newStudentCode();
  s.studentCode=s.code=s.id=newCode;
  (adminData.bookings||[]).forEach(b=>{if(b.studentCode===oldCode)b.studentCode=newCode;});
  (adminData.examAttempts||[]).forEach(a=>{if(a.studentCode===oldCode)a.studentCode=newCode;});
  (adminData.grades||[]).forEach(g=>{if(g.studentCode===oldCode)g.studentCode=newCode;});
  persist('تم تغيير كود الطالب',{oldCode,newCode});
  try{await window.MFCloud?.migrateStudentCode?.(oldCode,newCode,s);}catch(e){aToast('تم تغيير الكود على الجهاز، لكن بعض السجلات لم تُحدّث بعد. تحقق من الإنترنت وأعد المحاولة.');}
  renderStudents();
};
window.upgradeLegacyAccessCodes=async function(){
  fresh();const targets=adminData.students.filter(s=>isWeakAccessCode(stCode(s))||!s.parentCode);
  if(!targets.length)return aToast('كل الأكواد قوية ومكتملة بالفعل');
  if(!confirm(`سيتم ترقية أكواد ${targets.length} طالب وإنشاء أكواد منفصلة لولي الأمر. احفظ نسخة احتياطية أولًا. متابعة؟`))return;
  for(const student of targets){
    const oldCode=stCode(student);if(!student.parentCode)student.parentCode=newParentCode();
    if(isWeakAccessCode(oldCode)){
      const newCode=newStudentCode();student.studentCode=student.code=student.id=newCode;
      (adminData.bookings||[]).forEach(b=>{if(b.studentCode===oldCode)b.studentCode=newCode;});
      (adminData.examAttempts||[]).forEach(a=>{if(a.studentCode===oldCode)a.studentCode=newCode;});
      (adminData.grades||[]).forEach(g=>{if(g.studentCode===oldCode)g.studentCode=newCode;});
      try{await window.MFCloud?.migrateStudentCode?.(oldCode,newCode,student);}catch(e){}
    }else{try{await window.MFCloud?.saveStudent?.(student);}catch(e){}}
  }
  persist('تمت ترقية أكواد الطلاب القديمة',{count:targets.length});renderStudents();
};

function pendingBookings(){return (adminData.bookings||[]).filter(b=>!String(b.status||'').includes('تم القبول'));}
function renderBookings(){fresh();const rows=pendingBookings();content(`<div class="section-head"><div><span class="kicker"><span data-icon="calendar"></span> طلبات التسجيل</span><h2 class="section-title">قبول الطلاب الجدد</h2><p class="section-desc">اقبل الطلب مرة واحدة؛ بعدها ينتقل الطالب تلقائيًا لقائمة الطلاب ويختفي من هنا.</p></div><button class="btn ghost" onclick="exportBookingsCSV()"><span data-icon="database"></span> تصدير CSV</button></div><div class="grid grid-3 booking-admin-summary"><div class="card"><small>طلبات تنتظر القبول</small><b class="big-num">${rows.length}</b></div><div class="card"><label for="bookingSearchAdmin">بحث سريع</label><input id="bookingSearchAdmin" placeholder="الاسم أو الكود أو الهاتف"></div><div class="card"><label for="bookingGradeAdmin">الصف</label><select id="bookingGradeAdmin"><option value="all">كل الصفوف</option>${GRADES.map(g=>`<option>${safe(g)}</option>`).join('')}</select></div></div><div class="card" style="margin-top:14px"><div id="bookingRowsAdmin" class="booking-admin-list">${rows.map(bookingCard).join('')||'<div class="empty-state"><h3>لا توجد طلبات جديدة</h3><p>أي حجز جديد من الموقع سيظهر هنا فورًا.</p></div>'}</div></div>`);['bookingSearchAdmin','bookingGradeAdmin'].forEach(id=>document.getElementById(id)?.addEventListener('input',refreshBookingsTable));}

function scheduleCard(g){return `<article class="mobile-row schedule-admin-row"><div><b>${safe(g.name||'مجموعة بدون اسم')}</b><small>${safe(g.grade||'كل الصفوف')} · ${safe(g.days||'-')} · ${safe(g.startTime||'-')} — ${safe(g.endTime||'-')}</small></div><span class="badge ${g.active===false?'danger':'good'}">${g.active===false?'متوقفة':'متاحة للحجز'}</span><div class="mobile-actions"><button class="small-btn" type="button" onclick="editSchedule('${safe(g.id)}')">تعديل</button><button class="small-btn ${g.active===false?'primary':'danger'}" type="button" onclick="toggleSchedule('${safe(g.id)}')">${g.active===false?'تفعيل':'إيقاف'}</button></div></article>`;}
function renderSchedules(){fresh();content(`<div class="section-head"><div><span class="kicker"><span data-icon="calendar"></span> المواعيد والمجموعات</span><h2 class="section-title">إدارة المواعيد بسهولة</h2><p class="section-desc">المواعيد المفعلة فقط هي التي تظهر للطالب في صفحة الحجز.</p></div></div><div class="grid grid-2 schedule-admin-layout"><form id="scheduleForm" class="card grid"><h3 id="scheduleFormTitle">إضافة مجموعة جديدة</h3><input name="id" type="hidden"><div class="field"><label>اسم المجموعة</label><input name="name" required placeholder="مثال: مجموعة السبت والثلاثاء"></div><div class="field"><label>الصف</label><select name="grade"><option>كل الصفوف</option>${GRADES.map(g=>`<option>${safe(g)}</option>`).join('')}</select></div><div class="field"><label>الأيام</label><input name="days" required placeholder="السبت والثلاثاء"></div><div class="grid grid-2"><div class="field"><label>من</label><input name="startTime" type="time" required></div><div class="field"><label>إلى</label><input name="endTime" type="time" required></div></div><label class="option-card"><input name="active" type="checkbox" checked> متاح للحجز الآن</label><button class="btn primary" type="submit"><span data-icon="calendar"></span> حفظ الموعد</button><button class="btn ghost" type="reset" onclick="resetScheduleForm()">إلغاء التعديل</button></form><div class="card"><h3>المواعيد الحالية</h3><div class="schedule-admin-list">${(adminData.groups||[]).map(scheduleCard).join('')||'<p class="section-desc">لا توجد مواعيد بعد. أضف أول مجموعة من النموذج.</p>'}</div></div></div>`);document.getElementById('scheduleForm').onsubmit=saveSchedule;}
window.resetScheduleForm=function(){const form=document.getElementById('scheduleForm');if(form){form.reset();form.elements.id.value='';form.elements.active.checked=true;}const title=document.getElementById('scheduleFormTitle');if(title)title.textContent='إضافة مجموعة جديدة';};
window.editSchedule=function(id){const g=(adminData.groups||[]).find(x=>String(x.id)===String(id)),form=document.getElementById('scheduleForm');if(!g||!form)return;['id','name','grade','days','startTime','endTime'].forEach(k=>{if(form.elements[k])form.elements[k].value=g[k]||'';});form.active.checked=g.active!==false;document.getElementById('scheduleFormTitle').textContent='تعديل الموعد';form.scrollIntoView({behavior:'smooth',block:'start'});};
window.toggleSchedule=async function(id){const g=(adminData.groups||[]).find(x=>String(x.id)===String(id));if(!g)return;g.active=g.active===false;persist(g.active?'تم تفعيل الموعد':'تم إيقاف الموعد');try{await window.MFCloud?.saveGroup?.(g);}catch(e){}renderSchedules();};
async function saveSchedule(event){event.preventDefault();const form=event.currentTarget,data=Object.fromEntries(new FormData(form).entries());data.id=data.id||`group-${Date.now()}`;data.active=form.active.checked;const index=(adminData.groups||[]).findIndex(x=>String(x.id)===String(data.id));if(index>=0)adminData.groups[index]={...adminData.groups[index],...data};else adminData.groups.push(data);persist('تم حفظ الموعد');try{await window.MFCloud?.saveGroup?.(data);}catch(e){aToast('تم الحفظ محليًا وتعذرت المزامنة الآن');}renderSchedules();}
window.refreshBookingsTable=function(){let rows=pendingBookings();const query=(document.getElementById('bookingSearchAdmin')?.value||'').trim().toLowerCase(),grade=document.getElementById('bookingGradeAdmin')?.value||'all';if(query)rows=rows.filter(b=>[b.code,b.name,b.studentName,b.parentPhone,b.studentPhone].some(value=>String(value||'').toLowerCase().includes(query)));if(grade!=='all')rows=rows.filter(b=>b.grade===grade);const box=document.getElementById('bookingRowsAdmin');if(box)box.innerHTML=rows.map(bookingCard).join('')||'<div class="empty-state"><h3>لا توجد نتائج</h3><p>غيّر البحث أو الصف.</p></div>';};
function bookingCard(b){return `<article class="booking-admin-card compact-booking-card"><div class="compact-booking-main"><span class="student-avatar">${safe(String(b.name||b.studentName||'ط').charAt(0))}</span><div><div class="compact-booking-title"><h3>${safe(b.name||b.studentName)}</h3><span class="badge warn">قيد التسجيل</span></div><small>${safe(b.code)} · ${safe(b.grade)} · ${safe(b.group)}</small></div></div><div class="compact-booking-meta"><span><small>الطالب</small><b dir="ltr">${safe(b.studentPhone||'-')}</b></span><span><small>ولي الأمر</small><b dir="ltr">${safe(b.parentPhone||'-')}</b></span><span><small>الشهر</small><b>${safe(b.month||'-')}</b></span></div><div class="compact-booking-actions"><button class="small-btn primary" type="button" onclick="approveBooking('${safe(b.code)}')"><span data-icon="user-check"></span> قبول</button><button class="small-btn danger" type="button" onclick="deleteBooking('${safe(b.code)}')"><span data-icon="trash"></span> رفض</button></div></article>`;}
window.approveBooking=async function(code){
  const b=adminData.bookings.find(x=>(x.code||x.id)===code);if(!b)return false;
  try{
    aToast('جاري قبول الطالب وإنشاء الأكواد...');
    const created=await window.MFCloud?.approveBooking?.(code);
    if(!created?.studentCode||!created?.parentCode)throw new Error('تعذر إنشاء الأكواد');
    let student=adminData.students.find(s=>stCode(s)===created.studentCode||String(s.bookingCode||'')===String(code));
    const data={...b,...created,bookingCode:code,studentName:created.studentName||created.name||b.studentName||b.name,name:created.name||created.studentName||b.name,studentPhone:phoneDigits(created.studentPhone||b.studentPhone),parentPhone:phoneDigits(created.parentPhone||b.parentPhone),paid:false,active:true,attendance:student?.attendance||[],grades:student?.grades||[],homeworks:student?.homeworks||[],recitations:student?.recitations||[]};
    if(student)Object.assign(student,data);else{student=data;adminData.students.push(student);}
    adminData.bookings=adminData.bookings.filter(item=>(item.code||item.id)!==code);
    saveData(adminData);
    window.MFCloud?.logActivity?.('تم قبول الحجز وتسجيل الطالب',{bookingCode:code,studentCode:student.studentCode}).catch(()=>{});
    renderBookings();showIssuedCodes(student,'تم قبول الحجز وتسجيل الطالب');return true;
  }catch(error){const raw=String(error?.code||'')+' '+String(error?.message||'');const message=/unauthenticated/i.test(raw)?'انتهت جلسة الدخول. سجّل دخول المدرس من جديد.':/permission-denied/i.test(raw)?'حساب المدرس غير مفعّل أو لا يملك صلاحية القبول.':/not-found/i.test(raw)?'الحجز غير موجود أو تم التعامل معه بالفعل.':/internal|unavailable|function.*unavailable/i.test(raw)?'دوال Firebase الجديدة لم تُنشر أو غير متاحة.':(error?.message?.split(':').pop()?.trim()||'تعذر قبول الحجز.');aToast(message);return false;}
};
window.deleteBooking=async function(code){if(!confirm('رفض الحجز وإيقاف الأكواد التي صدرت له؟'))return;try{await window.MFCloud?.rejectBooking?.(code);adminData.bookings=adminData.bookings.filter(b=>String(b.code||b.id)!==String(code));saveData(adminData);aToast('تم رفض الحجز وإيقاف الأكواد');deferAdminRender(renderBookings);}catch(error){const raw=String(error?.code||'')+' '+String(error?.message||'');const message=/unauthenticated/i.test(raw)?'انتهت جلسة الدخول. سجّل الدخول من جديد.':/permission-denied/i.test(raw)?'الحساب لا يملك صلاحية رفض الحجوزات.':/not-found/i.test(raw)?'الحجز غير موجود أو تم التعامل معه بالفعل.':/internal|unavailable|function.*unavailable/i.test(raw)?'دالة رفض الحجز لم تُنشر على Firebase بعد.':(error?.message?.split(':').pop()?.trim()||'تعذر رفض الحجز.');aToast(message);}};

function findAttendance(st,date){return (st.attendance||[]).find(a=>String(a.date)===date);}
function attendanceRecord(st,status,method){const s=normalizeStudent(st); st.studentCode=s.studentCode; st.code=s.studentCode; st.name=s.name; st.studentName=s.name; return {studentId:s.studentCode,studentCode:s.studentCode,studentName:s.name,grade:s.grade,group:s.group,status,date:attendanceDate,time:status==='present'?timeNow():null,method,scannedBy:currentStaff?.email||currentStaff?.uid||'teacher',createdAt:new Date().toISOString()};}
async function saveAttendanceRecord(st,status,method){st.attendance=st.attendance||[]; const existing=findAttendance(st,attendanceDate); if(existing){Object.assign(existing, attendanceRecord(st,status,method));} else st.attendance.push(attendanceRecord(st,status,method)); persist(); try{await window.MFCloud?.upsertAttendance?.(attendanceRecord(st,status,method)); await window.MFCloud?.saveStudent?.(st);}catch(e){} }
async function registerQrAttendance(code){fresh(); const st=adminData.students.map(normalizeStudent).find(s=>String(s.studentCode).trim()===String(code).trim()); if(!st){aToast('لم يتم العثور على طالب بهذا الكود.'); return;} const original=adminData.students.find(s=>stCode(s)===st.studentCode); const existing=findAttendance(original,attendanceDate); if(existing?.status==='present'){aToast('الطالب مسجل حضور بالفعل اليوم.'); return;} await saveAttendanceRecord(original,'present','qr_scan'); aToast(`تم تسجيل حضور ${st.name}`); renderAttendance();}
window.quickPresent=function(code){attendanceDate=isoDateAdmin(); registerQrAttendance(code);};
window.markAbsentForMissing=async function(){fresh(); const grade=selectedGrade(), group=selectedGroup(); const students=filterStudents(grade,group); let count=0; for(const st of students){const original=adminData.students.find(s=>stCode(s)===st.studentCode); if(!findAttendance(original,attendanceDate)){await saveAttendanceRecord(original,'absent','auto_absent'); count++;}} aToast(`تم تسجيل غياب ${count} طالب غير حاضر`); renderAttendance();};
function todayAttendanceRows(){const grade=selectedGrade(), group=selectedGroup(); return filterStudents(grade,group).flatMap(st=>(st.attendance||[]).filter(a=>String(a.date)===attendanceDate).map(a=>({...a,studentName:st.name,studentCode:st.studentCode,grade:st.grade,group:st.group})));}
function attendanceRosterHTML(){const rows=filterStudents(selectedGrade(),selectedGroup());return `<div class="attendance-roster">${rows.map(st=>{const record=findAttendance(st,attendanceDate),status=record?.status||'';return `<article class="attendance-student ${status||'pending'}"><span class="student-avatar">${safe(String(st.name||'ط').trim().charAt(0))}</span><div><b>${safe(st.name)}</b><small>${safe(st.studentCode)} · ${safe(st.group||'-')}</small></div><span class="badge ${status?badgeStatus(status):'warn'}">${status==='present'?'حاضر':status==='absent'?'غائب':'لم يسجل'}</span><div class="attendance-row-actions"><button class="small-btn primary" onclick="setAttendanceStatus('${safe(st.studentCode)}','present')">حاضر</button><button class="small-btn danger" onclick="setAttendanceStatus('${safe(st.studentCode)}','absent')">غائب</button></div></article>`;}).join('')||'<p class="section-desc">لا يوجد طلاب مطابقون للاختيار.</p>'}</div>`;}
window.setAttendanceStatus=async function(code,status){const st=adminData.students.find(item=>String(stCode(item))===String(code));if(!st)return aToast('الطالب غير موجود');await saveAttendanceRecord(st,status,'manual_button');aToast(status==='present'?'تم تسجيل الحضور':'تم تسجيل الغياب');renderAttendance();};
function renderAttendance(){fresh(); const gOpts=['all',...GRADES], grpOpts=['all',...groupOptions()]; content(`<div class="section-head"><div><span class="kicker"><span data-icon="qr"></span> الحضور والغياب</span><h2 class="section-title">ماسح QR وتسجيل حضور اليوم</h2><p class="section-desc">الـ QR يحتوي على studentCode فقط، والمسح يسجل present. الغياب من زر منفصل.</p></div></div><div class="card attendance-control-card"><div class="grid grid-4"><select id="attendanceGrade">${gOpts.map(g=>`<option value="${safe(g)}">${g==='all'?'كل الصفوف':safe(g)}</option>`).join('')}</select><select id="attendanceGroup">${grpOpts.map(g=>`<option value="${safe(g)}">${g==='all'?'كل المجموعات':safe(g)}</option>`).join('')}</select><input id="attendanceDate" type="date" value="${attendanceDate}"><button class="btn ghost" onclick="renderAttendance()"><span data-icon="search"></span> عرض</button></div><div class="attendance-actions"><button class="btn primary qr-open-btn" onclick="openQrScanner()"><span data-icon="qr"></span> فتح ماسح QR Code</button><button class="btn ghost" onclick="manualAttendancePrompt()"><span data-icon="user-check"></span> إدخال كود يدوي</button><button class="btn dark" onclick="markAbsentForMissing()"><span data-icon="calendar"></span> تسجيل غياب الطلاب غير الحاضرين</button></div></div><div class="grid grid-2" style="margin-top:18px"><div class="card"><h3>سجل حضور اليوم</h3>${attendanceLogHTML()}</div><div class="card"><h3>تقرير سريع</h3>${attendanceReportHTML()}</div></div><div id="qrScannerModal" class="qr-modal" hidden><div class="card qr-modal-card"><div class="profile-top"><h3>ماسح QR الطالب</h3><button class="small-btn danger" onclick="closeQrScanner()">إغلاق</button></div><div id="adminQrReader"></div><p class="section-desc">وجّه كاميرا الموبايل على QR الطالب لتسجيل الحضور.</p></div></div>`); const gd=document.getElementById('attendanceGrade'), gr=document.getElementById('attendanceGroup'), date=document.getElementById('attendanceDate'); if(gd)gd.value=sessionStorage.getItem('attGrade')||'all'; if(gr)gr.value=sessionStorage.getItem('attGroup')||'all'; if(date)date.onchange=()=>{attendanceDate=date.value; renderAttendance();}; if(gd)gd.onchange=()=>{sessionStorage.setItem('attGrade',gd.value); renderAttendance();}; if(gr)gr.onchange=()=>{sessionStorage.setItem('attGroup',gr.value); renderAttendance();};}
function attendanceLogHTML(){const rows=todayAttendanceRows(); return `<div class="mobile-card-table">${rows.map(r=>`<div class="mobile-row"><b>${safe(r.studentName)}</b><span class="badge ${badgeStatus(r.status)}">${r.status==='present'?'حاضر':'غائب'}</span><small>${safe(r.studentCode)} · ${safe(r.time||'-')} · ${safe(r.group||'-')}</small></div>`).join('')||'<p class="section-desc">لا توجد سجلات اليوم.</p>'}</div><div class="table-wrap admin-table-desktop"><table><thead><tr><th>الطالب</th><th>الكود</th><th>الحالة</th><th>الوقت</th><th>الطريقة</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${safe(r.studentName)}</td><td>${safe(r.studentCode)}</td><td><span class="badge ${badgeStatus(r.status)}">${r.status==='present'?'حاضر':'غائب'}</span></td><td>${safe(r.time||'-')}</td><td>${safe(r.method||'-')}</td></tr>`).join('')||'<tr><td colspan="5">لا توجد سجلات اليوم</td></tr>'}</tbody></table></div>`;}
function attendanceReportHTML(){const rows=todayAttendanceRows(); const present=rows.filter(r=>r.status==='present').length, absent=rows.filter(r=>r.status==='absent').length; return `<div class="metric-grid"><div class="metric"><b>${rows.length}</b><small>إجمالي مسجل</small></div><div class="metric"><b>${present}</b><small>حاضر</small></div><div class="metric"><b>${absent}</b><small>غائب</small></div><div class="metric"><b>${rows.length?Math.round(present/rows.length*100):0}%</b><small>نسبة الحضور</small></div></div>`;}
window.manualAttendancePrompt=function(){const code=prompt('اكتب كود الطالب الموجود في QR'); if(code) registerQrAttendance(code.trim());};
window.openQrScanner=async function(){document.getElementById('qrScannerModal').hidden=false; const reader=document.getElementById('adminQrReader'); if(!reader)return; try{ if(window.Html5Qrcode){ qrScanner = new Html5Qrcode('adminQrReader'); await qrScanner.start({facingMode:'environment'},{fps:10,qrbox:{width:250,height:250}}, decoded=>{registerQrAttendance(decoded);}); } else if('BarcodeDetector' in window){ reader.innerHTML='<video id="adminQrVideo" autoplay playsinline></video>'; const video=document.getElementById('adminQrVideo'); const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}); video.srcObject=stream; const detector=new BarcodeDetector({formats:['qr_code']}); const loop=async()=>{if(document.getElementById('qrScannerModal').hidden) return; const codes=await detector.detect(video).catch(()=>[]); if(codes.length) await registerQrAttendance(codes[0].rawValue); setTimeout(loop,800);}; loop(); } else {reader.innerHTML='<p class="section-desc">المتصفح لا يدعم ماسح QR. استخدم إدخال كود يدوي.</p>';}}catch(e){reader.innerHTML='<p class="section-desc">تعذر فتح الكاميرا. تأكد من السماح للمتصفح باستخدام الكاميرا.</p>';}};
window.closeQrScanner=async function(){try{if(qrScanner){await qrScanner.stop(); qrScanner.clear(); qrScanner=null;}}catch(e){} const v=document.getElementById('adminQrVideo'); if(v?.srcObject) v.srcObject.getTracks().forEach(t=>t.stop()); const m=document.getElementById('qrScannerModal'); if(m)m.hidden=true;};

function renderPayments(){fresh(); content(`<div class="section-head"><div><span class="kicker"><span data-icon="database"></span> اشتراك السنتر</span><h2 class="section-title">حالة الاشتراك داخل السنتر</h2></div></div><div class="grid">${GRADES.map(g=>{const rows=adminData.students.filter(s=>s.grade===g).map(normalizeStudent); return `<div class="card"><h3>${safe(g)}</h3>${rows.map(s=>`<div class="mobile-row"><b>${safe(s.name)}</b><span class="badge ${badgeStatus(s.paid)}">${s.paid?'تم الدفع في السنتر':'لم يتم الدفع في السنتر'}</span><small>${safe(s.studentCode)} · ${safe(s.month||'-')}</small><div class="mobile-actions"><button class="small-btn primary" onclick="setPaid('${safe(s.studentCode)}',true)">تم الدفع في السنتر</button><button class="small-btn danger" onclick="setPaid('${safe(s.studentCode)}',false)">لم يتم الدفع</button></div></div>`).join('')||'<p class="section-desc">لا يوجد طلاب.</p>'}</div>`;}).join('')}</div>`);}
window.setPaid=function(code,val){const s=adminData.students.find(x=>stCode(x)===code); if(!s)return; s.paid=val; s.paymentDate=val?isoDateAdmin():''; persist(val?'تم تسجيل الدفع في السنتر':'تم تسجيل عدم الدفع في السنتر'); renderPayments();};

function renderMaterials(){fresh(); content(`<div class="section-head"><div><span class="kicker"><span data-icon="book-open"></span> المحتوى</span><h2 class="section-title">المراجعات وبنك الأسئلة</h2></div></div><div class="grid grid-2"><form id="materialForm" class="card grid"><h3>إضافة مراجعة / ملف</h3><input name="title" placeholder="العنوان" required><select name="grade"><option>كل الصفوف</option>${GRADES.map(g=>`<option>${safe(g)}</option>`).join('')}</select><textarea name="desc" placeholder="وصف مختصر"></textarea><input type="file" name="file" accept="image/*,application/pdf"><button class="btn primary"><span data-icon="upload"></span> إضافة</button></form><form id="questionForm" class="card grid"><h3>إضافة سؤال</h3><input name="title" placeholder="عنوان السؤال" required><select name="grade"><option>كل الصفوف</option>${GRADES.map(g=>`<option>${safe(g)}</option>`).join('')}</select><textarea name="content" placeholder="نص السؤال"></textarea><textarea name="answer" placeholder="الإجابة النموذجية"></textarea><button class="btn primary"><span data-icon="help-circle"></span> إضافة سؤال</button></form></div><div class="grid grid-2" style="margin-top:18px"><div class="card"><h3>المراجعات</h3>${adminData.materials.map(m=>`<div class="mobile-row"><b>${safe(m.title)}</b><small>${safe(m.grade||'')}</small><button class="small-btn danger" onclick="deleteItem('materials','${safe(m.id)}')">حذف</button></div>`).join('')||'<p class="section-desc">لا توجد مراجعات.</p>'}</div><div class="card"><h3>الأسئلة</h3>${adminData.questions.map(q=>`<div class="mobile-row"><b>${safe(q.title)}</b><small>${safe(q.grade||'')}</small><button class="small-btn danger" onclick="deleteItem('questions','${safe(q.id)}')">حذف</button></div>`).join('')||'<p class="section-desc">لا توجد أسئلة.</p>'}</div></div>`); document.getElementById('materialForm').onsubmit=async e=>{e.preventDefault(); const f=e.target.file.files[0]; const m=Object.fromEntries(new FormData(e.target).entries()); m.id='mat-'+Date.now(); if(f&&window.MFCloud?.uploadAttachment){try{const up=await window.MFCloud.uploadAttachment(f,'teacher-uploads'); m.fileUrl=up.url; m.fileName=up.fileName;}catch(err){aToast('تعذر رفع الملف');}} adminData.materials.push(m); persist('تم إضافة المراجعة'); renderMaterials();}; document.getElementById('questionForm').onsubmit=e=>{e.preventDefault(); const q=Object.fromEntries(new FormData(e.target).entries()); q.id='q-'+Date.now(); adminData.questions.push(q); persist('تم إضافة السؤال'); renderMaterials();};}
window.deleteItem=function(collection,id){if(!confirm('حذف العنصر؟'))return; adminData[collection]=adminData[collection].filter(x=>x.id!==id); persist('تم الحذف'); deferAdminRender(renderSection); cloudDelete(collection,id).catch(()=>{});};


function scoreIsReady(row){return row && row.score !== null && row.score !== undefined && row.score !== '' && !isNaN(Number(row.score));}
function scoreText(row){
  if(!scoreIsReady(row)) return 'بانتظار التصحيح';
  const score = Number(row.score);
  const max = row.maxScore || row.totalScore || row.fullMark || 100;
  if(max && !isNaN(Number(max)) && Number(max) !== 100) return `${score} من ${Number(max)}`;
  return `${score}%`;
}
function gradeRowDateValue(row){return row.submittedAt || row.date || row.createdAt || row.updatedAt || '';}
function studentForGradeRow(row){const code=String(row?.studentCode||row?.code||''); return (adminData.students||[]).map(normalizeStudent).find(s=>normalizeText(s.studentCode)===normalizeText(code));}
function examGradeRows(){
  const rows = [];
  (adminData.examAttempts||[]).forEach((a,i)=>{
    const code = a.studentCode || a.code || '';
    rows.push({...a,rowKind:'attempt',rowId:String(a.id||`attempt-${code}-${a.examId||a.examTitle||i}-${i}`),studentCode:code,studentName:a.studentName||'',examTitle:a.examTitle||a.exam||'امتحان',date:gradeRowDateValue(a)});
  });
  (adminData.grades||[]).forEach((g,i)=>{
    const code = g.studentCode || g.code || '';
    rows.push({...g,rowKind:'grade',rowId:String(g.id||`grade-${code}-${g.exam||g.examTitle||i}-${i}`),studentCode:code,studentName:g.studentName||g.name||'',examTitle:g.examTitle||g.exam||'امتحان',date:gradeRowDateValue(g)});
  });
  (adminData.students||[]).map(normalizeStudent).forEach(st=>{
    (st.grades||[]).forEach((g,i)=>{
      rows.push({...g,rowKind:'student-grade',rowId:String(g.id||`${st.studentCode}-student-grade-${i}`),studentCode:st.studentCode,studentName:st.name,examTitle:g.examTitle||g.exam||'امتحان',date:gradeRowDateValue(g)});
    });
  });
  const seen = new Set();
  return rows.filter(r=>{
    const key = `${r.rowKind}|${r.rowId}|${r.studentCode}|${r.examTitle}|${r.score}|${r.date}`;
    if(seen.has(key)) return false;
    seen.add(key);
    return r.studentCode || r.studentName || r.examTitle;
  }).sort((a,b)=>String(gradeRowDateValue(b)).localeCompare(String(gradeRowDateValue(a))));
}
function examGradeWhatsappText(row, st){
  const s = st || studentForGradeRow(row) || {};
  return `السلام عليكم ورحمة الله وبركاته

تقرير درجة الطالب

الطالب: ${row.studentName || s.name || '-'}
كود الطالب: ${row.studentCode || s.studentCode || '-'}
الصف: ${s.grade || row.grade || '-'}
المجموعة: ${s.group || row.group || '-'}

الامتحان: ${row.examTitle || row.exam || 'امتحان'}
الدرجة: ${scoreText(row)}
تاريخ التسليم: ${row.submittedAt || row.date || '-'}

مستر محمود إبراهيم فوزي`;
}
function examGradeRowHTML(row){
  const st = studentForGradeRow(row) || {};
  const parentPhone = st.parentPhone || row.parentPhone || '';
  const canSend = !!parentPhone && scoreIsReady(row);
  const badge = scoreIsReady(row) ? 'good' : 'warn';
  return `<div class="mobile-row exam-grade-row-v39"><div><b>${safe(row.studentName || st.name || '-')} — ${safe(row.examTitle || row.exam || 'امتحان')}</b><small>${safe(row.studentCode || st.studentCode || '-')} · ${safe(row.submittedAt || row.date || '-')}</small></div><span class="badge ${badge}">${safe(scoreText(row))}</span><div class="mobile-actions exam-grade-actions-v39"><button class="small-btn whatsapp-report-btn" ${canSend?'':'disabled'} onclick="sendExamGradeToParent('${safe(row.rowId)}')">واتساب ولي الأمر</button></div></div>`;
}
window.sendExamGradeToParent=function(rowId){
  const rows = window.__adminExamGradeRows || examGradeRows();
  const row = rows.find(r=>String(r.rowId)===String(rowId));
  if(!row) return aToast('لم يتم العثور على درجة الامتحان');
  if(!scoreIsReady(row)) return aToast('الدرجة لم يتم تصحيحها بعد');
  const st = studentForGradeRow(row);
  const phone = adminWhatsAppPhone(st?.parentPhone || row.parentPhone || '');
  if(!phone) return aToast('رقم ولي الأمر غير موجود لهذا الطالب');
  window.open(whatsappLink(phone, examGradeWhatsappText(row, st)), '_blank');
};

function examHelpSample(){return `<div class="exam-help-v40"><h3>طريقة كتابة الأسئلة الصحيحة</h3><p>للاختياري لازم تكتب الاختيارات وسطر <b>الإجابة:</b> عشان الموقع يصحح تلقائيًا. للمقالي اكتب السؤال فقط بدون اختيارات وسيظهر كاملًا للمدرس للتصحيح.</p><pre>ما عاصمة مصر؟
أ) القاهرة
ب) الإسكندرية
ج) طنطا
د) أسوان
الإجابة: أ

اشرح أهمية الضوء للنبات.</pre></div>`;}
function examAttemptBadge(a){if(a.needsManualReview||a.status==='pending_manual')return '<span class="badge warn">بانتظار التصحيح</span>'; if(a.status==='corrected')return '<span class="badge good">تم التصحيح</span>'; return '<span class="badge good">مصحح تلقائيًا</span>';}
function examAttemptScoreText(a){return (a.score!==null&&a.score!==undefined&&a.score!=='')?`${a.score}%`:(a.autoScore!==null&&a.autoScore!==undefined?`تلقائي ${a.autoScore}% · ينتظر النهائي`:'بانتظار التصحيح');}
function examAttemptRowHTML(a){return `<div class="mobile-row exam-review-row-v40"><div><b>${safe(a.studentName||'-')} — ${safe(a.examTitle||'امتحان')}</b><small>${safe(a.studentCode||'-')} · ${safe(a.submittedAt||'-')}</small></div>${examAttemptBadge(a)}<span class="badge ${a.score!==null&&a.score!==undefined?'good':'warn'}">${safe(examAttemptScoreText(a))}</span><div class="mobile-actions"><button class="small-btn primary" onclick="correctAttempt('${safe(a.id)}')">عرض وتصحيح</button></div></div>`;}
function renderExams(){fresh(); const attempts=(adminData.examAttempts||[]).slice().reverse(); const pending=attempts.filter(a=>a.needsManualReview||a.status==='pending_manual'); const gradeRows=examGradeRows(); window.__adminExamGradeRows=gradeRows; content(`<div class="section-head"><div><span class="kicker"><span data-icon="clipboard"></span> الامتحانات</span><h2 class="section-title">إدارة الامتحانات والتصحيح</h2><p class="section-desc">الاختياري يتصحح تلقائيًا عند كتابة الإجابة الصحيحة، والمقالي يظهر كاملًا للمدرس للتصحيح.</p></div></div><div class="grid grid-2"><form id="examForm" class="card grid"><h3>إضافة امتحان</h3><input name="title" placeholder="عنوان الامتحان" required><select name="grade"><option>كل الصفوف</option>${GRADES.map(g=>`<option>${safe(g)}</option>`).join('')}</select><input name="duration" type="number" min="1" value="20" placeholder="المدة بالدقائق"><label class="option-card"><input type="checkbox" name="allowRetake" value="true"> السماح بإعادة التسليم</label><textarea name="instructions" placeholder="تعليمات الامتحان"></textarea><textarea name="text" rows="10" placeholder="مثال اختياري:
ما عاصمة مصر؟
أ) القاهرة
ب) الإسكندرية
ج) طنطا
د) أسوان
الإجابة: أ

مثال مقالي:
اشرح أهمية الضوء للنبات."></textarea><button class="btn primary"><span data-icon="clipboard"></span> حفظ الامتحان</button></form><div class="card">${examHelpSample()}<h3 style="margin-top:16px">الامتحانات الحالية</h3>${adminData.exams.map(e=>`<div class="mobile-row"><b>${safe(e.title)}</b><small>${safe(e.grade)} · ${safe(e.duration)} دقيقة · ${safe(e.questionCount||'')} سؤال</small><button class="small-btn danger" onclick="deleteItem('exams','${safe(e.id)}')">حذف</button></div>`).join('')||'<p class="section-desc">لا توجد امتحانات.</p>'}</div></div><div class="card exam-review-list-v40" style="margin-top:18px"><h3>محاولات الطلاب والتصحيح</h3><p class="section-desc">اضغط عرض وتصحيح لعرض إجابات الطالب كاملة، علّم كل إجابة صح أو غلط، ثم اكتب الدرجة النهائية.</p>${attempts.map(examAttemptRowHTML).join('')||'<p class="section-desc">لا توجد محاولات بعد.</p>'}</div><div class="card" style="margin-top:18px"><h3>أسئلة مقالية بانتظار التصحيح</h3>${pending.map(a=>`<div class="mobile-row"><b>${safe(a.studentName)} — ${safe(a.examTitle)}</b><small>${safe(a.studentCode)} · ${safe(a.submittedAt)}</small><button class="small-btn primary" onclick="correctAttempt('${safe(a.id)}')">تصحيح</button></div>`).join('')||'<p class="section-desc">لا توجد محاولات تحتاج تصحيح.</p>'}</div><div class="card exam-grade-list-v39" style="margin-top:18px"><h3>درجات الطلاب وإرسال واتساب</h3><p class="section-desc">بعد تصحيح الامتحان، اضغط زر واتساب بجانب درجة الطالب لإرسال النتيجة لولي الأمر برسالة جاهزة.</p>${gradeRows.map(examGradeRowHTML).join('')||'<p class="section-desc">لا توجد درجات أو محاولات امتحانات بعد.</p>'}</div>`); document.getElementById('examForm').onsubmit=e=>{e.preventDefault(); const ex=Object.fromEntries(new FormData(e.target).entries()); const qs=typeof parseExamQuestions==='function'?parseExamQuestions(ex.text||''):[]; if(!qs.length)return aToast('اكتب أسئلة الامتحان أولًا'); const missing=qs.filter(q=>q.type==='mcq'&&!String(q.answer||'').trim()).length; if(missing)return aToast('لازم تكتب الإجابة الصحيحة لكل سؤال اختياري بصيغة: الإجابة: أ'); ex.id='ex-'+Date.now(); ex.allowRetake=!!ex.allowRetake; ex.questionCount=qs.length; ex.mcqCount=qs.filter(q=>q.type==='mcq').length; ex.essayCount=qs.filter(q=>q.type==='essay').length; adminData.exams.push(ex); persist('تم حفظ الامتحان'); renderExams();};}
window.correctAttempt=function(id){const a=adminData.examAttempts.find(x=>String(x.id)===String(id)); if(!a)return; document.querySelector('.correction-modal-v40')?.remove(); const answers=Array.isArray(a.answers)?a.answers:[]; const checkedDefault=x=>x.correct===true?'checked':''; const html=`<div class="correction-modal-v40"><div class="correction-card-v40 card"><div class="profile-top"><div><span class="kicker">تصحيح امتحان</span><h2>${safe(a.studentName||'-')}</h2><p class="section-desc">${safe(a.examTitle||'امتحان')} · ${safe(a.studentCode||'-')}</p></div><button class="small-btn danger" onclick="closeCorrectionModal()">إغلاق</button></div><div class="correction-list-v40">${answers.map((ans,i)=>`<div class="correction-question-v40"><h3>${i+1}. ${safe(ans.question||'سؤال')}</h3><div class="correction-answer-grid-v40"><div><span>إجابة الطالب</span><p>${safe(ans.answer||'-')}</p></div><div><span>الإجابة الصحيحة / النموذجية</span><p>${safe(ans.correctAnswer||ans.modelAnswer||'يصَححها المدرس')}</p></div></div><label class="correction-toggle-v40"><input type="checkbox" data-correct-index="${i}" ${checkedDefault(ans)} onchange="recalculateCorrectionScore()"> الإجابة صحيحة</label></div>`).join('')||'<p class="section-desc">لا توجد إجابات محفوظة.</p>'}</div><div class="correction-final-v40"><button class="small-btn" type="button" onclick="recalculateCorrectionScore()">حساب الدرجة من الصح والغلط</button><label>الدرجة النهائية من 100<input id="manualFinalScore" type="number" min="0" max="100" value="${safe(a.score??a.autoScore??0)}"></label><button class="btn primary" onclick="saveAttemptCorrection('${safe(a.id)}')">حفظ التصحيح والنتيجة</button></div></div></div>`; document.body.insertAdjacentHTML('beforeend',html); recalculateCorrectionScore();};
window.closeCorrectionModal=function(){document.querySelector('.correction-modal-v40')?.remove();};
window.recalculateCorrectionScore=function(){const checks=[...document.querySelectorAll('.correction-modal-v40 [data-correct-index]')]; if(!checks.length)return; const correct=checks.filter(c=>c.checked).length; const score=Math.round(correct/checks.length*100); const input=document.getElementById('manualFinalScore'); if(input && !input.dataset.touched){input.value=score;} if(input){input.oninput=()=>{input.dataset.touched='1';};}};
window.saveAttemptCorrection=async function(id){const a=adminData.examAttempts.find(x=>String(x.id)===String(id)); if(!a)return; const checks=[...document.querySelectorAll('.correction-modal-v40 [data-correct-index]')]; let correct=0; checks.forEach(ch=>{const i=Number(ch.dataset.correctIndex); const ok=!!ch.checked; if(a.answers&&a.answers[i]){a.answers[i].correct=ok; a.answers[i].teacherReviewed=true;} if(ok)correct++;}); const score=Number(document.getElementById('manualFinalScore')?.value); if(Number.isNaN(score)||score<0||score>100)return aToast('اكتب درجة صحيحة من 0 إلى 100'); a.score=score; a.maxScore=100; a.correctCount=correct; a.questionCount=checks.length||a.questionCount||0; a.needsManualReview=false; a.status='corrected'; a.teacherCorrectedAt=new Date().toISOString(); persist('تم حفظ التصحيح والنتيجة'); try{await window.MFCloud?.saveExamAttempt?.(a);}catch(e){} closeCorrectionModal(); renderExams();};

function renderReviewsAdmin(){fresh(); content(`<div class="section-head"><div><span class="kicker"><span data-icon="star"></span> التقييمات</span><h2 class="section-title">مراجعة تقييمات الطلاب</h2></div></div><div class="grid grid-2">${adminData.reviews.map(r=>`<div class="card"><div class="review-stars">${'★'.repeat(Number(r.rating||5))}</div><h3>${safe(r.name)}</h3><p>${safe(r.text||'')}</p><span class="badge ${r.approved!==false?'good':'warn'}">${r.approved!==false?'منشور':'بانتظار الموافقة'}</span><div class="mobile-actions"><button class="small-btn primary" onclick="approveReview('${safe(r.id)}')">نشر</button><button class="small-btn danger" onclick="deleteItem('reviews','${safe(r.id)}')">حذف</button></div></div>`).join('')||'<p class="section-desc">لا توجد تقييمات.</p>'}</div>`);}
window.approveReview=function(id){const r=adminData.reviews.find(x=>x.id===id); if(!r)return; r.approved=true; persist('تم نشر التقييم'); renderReviewsAdmin();};


function backupPayload(){fresh();return {schemaVersion:2,exportedAt:new Date().toISOString(),project:'mahmoud-fawzy-science-platform',data:adminData};}
function downloadJson(filename,payload){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
window.exportFullBackup=function(){const stamp=new Date().toISOString().replace(/[:.]/g,'-');downloadJson(`mf-platform-backup-${stamp}.json`,backupPayload());persist('تم تصدير نسخة احتياطية كاملة');};
function validateBackupData(value){const data=value?.data||value;if(!data||typeof data!=='object')throw new Error('ملف غير صالح');for(const key of ['students','bookings','materials','questions','exams','examAttempts','reviews','groups','assignments'])if(data[key]!==undefined&&!Array.isArray(data[key]))throw new Error(`القسم ${key} غير صالح`);return mergeData(data);}
window.importFullBackup=async function(input){const file=input?.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text());const restored=validateBackupData(parsed);if(!confirm(`استعادة نسخة تحتوي على ${restored.students.length} طالب و${restored.exams.length} امتحان؟ سيتم استبدال البيانات الحالية.`))return;downloadJson(`mf-platform-before-restore-${Date.now()}.json`,backupPayload());adminData=restored;saveData(adminData);await window.MFCloud?.saveSiteData?.(adminData);persist('تمت استعادة النسخة الاحتياطية');renderBackup();}catch(e){aToast(`تعذر الاستعادة: ${e.message||'ملف غير صالح'}`);}finally{if(input)input.value='';}};
window.refreshActivityLog=async function(){renderBackup(true);};
async function renderBackup(loading=false){
  fresh();
  content(`<div class="section-head"><div><span class="kicker"><span data-icon="database"></span> النسخ الاحتياطي</span><h2 class="section-title">حماية بيانات المنصة</h2><p class="section-desc">نزّل نسخة كاملة قبل أي تعديل كبير أو ترقية للأكواد.</p></div></div><div class="grid grid-2"><div class="card backup-action-card"><h3>تصدير نسخة كاملة</h3><p>تشمل الطلاب والحجوزات والحضور والدرجات والامتحانات والمحتوى والإعدادات.</p><button class="btn primary" onclick="exportFullBackup()"><span data-icon="database"></span> تنزيل النسخة الاحتياطية</button></div><div class="card backup-action-card"><h3>استعادة نسخة</h3><p>سيتم تنزيل نسخة تلقائية من الوضع الحالي قبل الاستعادة.</p><label class="btn ghost file-button">اختيار ملف النسخة<input type="file" accept="application/json,.json" onchange="importFullBackup(this)" hidden></label></div></div><div class="card" style="margin-top:18px"><div class="section-head mini"><div><h3>سجل العمليات</h3><p class="section-desc">آخر التعديلات التي نفذها فريق الإدارة.</p></div><button class="small-btn" onclick="refreshActivityLog()">تحديث</button></div><div id="activityLogBox">${loading?'<div class="skeleton" style="height:140px"></div>':'جاري التحميل...'}</div></div>`);
  try{const rows=await window.MFCloud?.getActivityLog?.(50)||[];const box=document.getElementById('activityLogBox');if(box)box.innerHTML=rows.length?rows.map(row=>`<div class="mobile-row"><b>${safe(row.action||'عملية')}</b><small>${safe(row.actorEmail||row.actorRole||'')} · ${safe(row.createdAt?.toDate?row.createdAt.toDate().toLocaleString('ar-EG'):'')}</small></div>`).join(''):'<p class="section-desc">لا توجد عمليات مسجلة بعد.</p>';}catch(e){const box=document.getElementById('activityLogBox');if(box)box.innerHTML='<p class="section-desc">تعذر تحميل السجل.</p>';}
}

function renderSettings(){fresh(); content(`<div class="section-head"><div><span class="kicker"><span data-icon="sparkles"></span> الإعدادات</span><h2 class="section-title">إعدادات الموقع والرابط</h2></div></div><div class="card"><form id="settingsForm" class="grid"><input name="siteUrl" value="${safe(adminData.settings.siteUrl||DEFAULT_SITE_URL||'')}" placeholder="رابط الموقع الأساسي"><input name="teacherPhone" value="${safe(adminData.settings.teacherPhone||TEACHER_WHATSAPP||'')}" placeholder="رقم واتساب المدرس"><textarea name="homeNotice" placeholder="رسالة تنبيه للطلاب">${safe(adminData.settings.homeNotice||'')}</textarea><button class="btn primary"><span data-icon="sparkles"></span> حفظ الإعدادات</button></form></div><div class="grid grid-2" style="margin-top:18px"><div class="seo-card"><h3>الظهور في البحث</h3><p>صفحة المدرس خاصة ولا تظهر في نتائج البحث أو داخل الموقع العام.</p></div><div class="seo-card"><h3>حماية المنصة</h3><p>صلاحيات الدخول والحفظ مفعّلة لحماية بيانات الطلاب وفريق العمل.</p></div></div>`); document.getElementById('settingsForm').onsubmit=e=>{e.preventDefault(); adminData.settings={...adminData.settings,...Object.fromEntries(new FormData(e.target).entries())}; persist('تم حفظ الإعدادات');};}

function renderAttendance(){fresh();const gOpts=['all',...GRADES],grpOpts=['all',...groupOptions()];content(`<div class="section-head compact-admin-head"><div><span class="kicker"><span data-icon="qr"></span> الحضور والغياب</span><h2 class="section-title">حضور الحصة</h2><p class="section-desc">امسح QR أو سجّل الطالب حاضرًا أو غائبًا بضغطة واحدة.</p></div></div><div class="card attendance-control-card"><div class="attendance-filters"><select id="attendanceGrade">${gOpts.map(g=>`<option value="${safe(g)}">${g==='all'?'كل الصفوف':safe(g)}</option>`).join('')}</select><select id="attendanceGroup">${grpOpts.map(g=>`<option value="${safe(g)}">${g==='all'?'كل المجموعات':safe(g)}</option>`).join('')}</select><input id="attendanceDate" type="date" value="${attendanceDate}"></div><div class="attendance-actions"><button class="btn primary qr-open-btn" onclick="openQrScanner()"><span data-icon="qr"></span> مسح QR</button><button class="btn ghost" onclick="manualAttendancePrompt()"><span data-icon="user-check"></span> إدخال الكود</button><button class="btn ghost" onclick="markAbsentForMissing()"><span data-icon="calendar"></span> الباقي غياب</button></div></div><div class="attendance-summary-card card">${attendanceReportHTML()}</div><div class="card attendance-roster-card"><div class="profile-top"><div><h3>طلاب المجموعة</h3><p class="section-desc">غيّر الحالة في أي وقت بالضغط على حاضر أو غائب.</p></div></div>${attendanceRosterHTML()}</div><details class="card attendance-history"><summary>عرض سجل اليوم بالتفصيل</summary>${attendanceLogHTML()}</details><div id="qrScannerModal" class="qr-modal" hidden><div class="card qr-modal-card"><div class="profile-top"><h3>ماسح QR الطالب</h3><button class="small-btn danger" onclick="closeQrScanner()">إغلاق</button></div><div id="adminQrReader"></div><p class="section-desc">وجّه كاميرا الموبايل على QR الطالب لتسجيل الحضور.</p></div></div>`);const gd=document.getElementById('attendanceGrade'),gr=document.getElementById('attendanceGroup'),date=document.getElementById('attendanceDate');if(gd)gd.value=sessionStorage.getItem('attGrade')||'all';if(gr)gr.value=sessionStorage.getItem('attGroup')||'all';if(date)date.onchange=()=>{attendanceDate=date.value;renderAttendance();};if(gd)gd.onchange=()=>{sessionStorage.setItem('attGrade',gd.value);renderAttendance();};if(gr)gr.onchange=()=>{sessionStorage.setItem('attGroup',gr.value);renderAttendance();};hydrateIcons();}
function examBuilderCard(index){return `<article class="exam-builder-question" data-exam-question><div class="exam-question-head"><b>السؤال <span data-question-number>${index+1}</span></b><button class="small-btn danger" type="button" onclick="removeExamQuestion(this)">حذف</button></div><div class="field"><label>نص السؤال</label><textarea data-question-text rows="2" required placeholder="اكتب السؤال هنا"></textarea></div><div class="exam-options-grid">${['أ','ب','ج','د'].map((label,i)=>`<label><span>${label}</span><input data-question-option="${i}" required placeholder="الإجابة ${label}"></label>`).join('')}</div><div class="field correct-answer-field"><label>الإجابة الصحيحة للتصحيح التلقائي</label><select data-correct-answer required><option value="">اختار الإجابة الصحيحة</option>${['أ','ب','ج','د'].map(label=>`<option value="${label}">${label}</option>`).join('')}</select></div></article>`;}
function renumberExamQuestions(){document.querySelectorAll('[data-exam-question]').forEach((card,index)=>{const number=card.querySelector('[data-question-number]');if(number)number.textContent=index+1;});}
window.addExamQuestion=function(){const list=document.getElementById('examQuestionsBuilder');if(!list)return;list.insertAdjacentHTML('beforeend',examBuilderCard(list.children.length));renumberExamQuestions();list.lastElementChild?.scrollIntoView({behavior:'smooth',block:'center'});};
window.removeExamQuestion=function(button){const list=document.getElementById('examQuestionsBuilder');if(!list)return;if(list.children.length===1)return aToast('لازم الامتحان يحتوي على سؤال واحد على الأقل');button.closest('[data-exam-question]')?.remove();renumberExamQuestions();};
function serializeExamQuestions(){const cards=[...document.querySelectorAll('[data-exam-question]')];return cards.map(card=>{const question=card.querySelector('[data-question-text]')?.value.trim(),options=[...card.querySelectorAll('[data-question-option]')].map(input=>input.value.trim()),answer=card.querySelector('[data-correct-answer]')?.value;if(!question||options.some(value=>!value)||!answer)return null;return `${question}\nأ) ${options[0]}\nب) ${options[1]}\nج) ${options[2]}\nد) ${options[3]}\nالإجابة: ${answer}`;}).filter(Boolean).join('\n\n');}
function renderExams(){fresh();const attempts=(adminData.examAttempts||[]).slice().reverse(),pending=attempts.filter(a=>a.needsManualReview||a.status==='pending_manual'),gradeRows=examGradeRows();window.__adminExamGradeRows=gradeRows;content(`<div class="section-head compact-admin-head"><div><span class="kicker"><span data-icon="clipboard"></span> الامتحانات</span><h2 class="section-title">إنشاء امتحان</h2><p class="section-desc">اكتب السؤال وأربع إجابات، ثم اختار الإجابة الصحيحة للتصحيح التلقائي.</p></div></div><div class="exam-admin-layout"><form id="examForm" class="card exam-builder-form"><div class="exam-meta-grid"><div class="field"><label>اسم الامتحان</label><input name="title" required placeholder="مثال: امتحان الوحدة الأولى"></div><div class="field"><label>الصف</label><select name="grade"><option>كل الصفوف</option>${GRADES.map(g=>`<option>${safe(g)}</option>`).join('')}</select></div><div class="field"><label>المدة بالدقائق</label><input name="duration" type="number" min="1" value="20"></div></div><div class="field"><label>تعليمات للطلاب</label><textarea name="instructions" rows="2" placeholder="تعليمات اختيارية"></textarea></div><label class="exam-pdf-upload"><span><b>ملف PDF اختياري</b><small>يمكن إرفاق ملف مع الأسئلة بحجم أقصى 15MB.</small></span><input name="pdfFile" type="file" accept="application/pdf,.pdf"></label><textarea name="text" hidden></textarea><div class="exam-builder-title"><div><h3>الأسئلة</h3><small>كل سؤال له أربع اختيارات وإجابة صحيحة.</small></div><button class="btn ghost" type="button" onclick="addExamQuestion()">+ إضافة سؤال</button></div><div id="examQuestionsBuilder" class="exam-questions-builder">${examBuilderCard(0)}</div><label class="option-card"><input type="checkbox" name="allowRetake" value="true"> السماح للطالب بإعادة الامتحان</label><button class="btn primary full-width" type="submit"><span data-icon="clipboard"></span> حفظ ونشر الامتحان</button></form><aside class="card compact-exam-list"><h3>الامتحانات الحالية</h3>${adminData.exams.map(e=>`<div class="mobile-row"><div><b>${safe(e.title)}</b><small>${safe(e.grade)} · ${safe(e.duration)} دقيقة · ${safe(e.questionCount||0)} سؤال</small></div>${e.pdfUrl?`<a class="small-btn" href="${safe(e.pdfUrl)}" target="_blank">PDF</a>`:''}<button class="small-btn danger" onclick="deleteItem('exams','${safe(e.id)}')">حذف</button></div>`).join('')||'<p class="section-desc">لا توجد امتحانات بعد.</p>'}</aside></div><details class="card admin-collapsible" ${pending.length?'open':''}><summary>محاولات تحتاج تصحيح <span class="badge warn">${pending.length}</span></summary>${pending.map(examAttemptRowHTML).join('')||'<p class="section-desc">لا توجد محاولات معلقة.</p>'}</details><details class="card admin-collapsible"><summary>كل المحاولات والنتائج <span class="badge">${attempts.length}</span></summary>${attempts.map(examAttemptRowHTML).join('')||'<p class="section-desc">لا توجد محاولات.</p>'}</details><details class="card admin-collapsible"><summary>درجات الطلاب وإرسال واتساب</summary>${gradeRows.map(examGradeRowHTML).join('')||'<p class="section-desc">لا توجد درجات بعد.</p>'}</details>`);const form=document.getElementById('examForm');form.addEventListener('submit',event=>{const text=serializeExamQuestions(),count=document.querySelectorAll('[data-exam-question]').length;if(!text||text.split('\n\n').length!==count){event.preventDefault();event.stopImmediatePropagation();return aToast('كمّل السؤال والاختيارات وحدد الإجابة الصحيحة لكل سؤال');}form.elements.text.value=text;},true);hydrateIcons();}
function renderSection(){({overview:renderOverview,students:renderStudents,bookings:renderBookings,schedules:renderSchedules,attendance:renderAttendance,payments:renderPayments,exams:renderExams,materials:renderMaterials,reviews:renderReviewsAdmin}[currentSection]||renderOverview)();}
function exportCSV(name, rows){const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'})); a.download=name; a.click();}
window.exportBookingsCSV=function(){exportCSV('bookings.csv',[['code','name','grade','month','group','parentPhone','status'],...adminData.bookings.map(b=>[b.code,b.name,b.grade,b.month,b.group,b.parentPhone,b.status])]);};

function initAdmin(){const requested=new URLSearchParams(location.search).get('section');if(adminSections.some(([id])=>id===requested))currentSection=requested;setupTheme(); hydrateIcons(); adminLogin(); tryRestoreSession();}
document.addEventListener('DOMContentLoaded',initAdmin);
