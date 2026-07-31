'use strict';

let adminData = typeof loadData === 'function' ? loadData() : {students:[],bookings:[],materials:[],questions:[],exams:[],examAttempts:[],reviews:[],groups:[],assignments:[],studentTransferRequests:[],settings:{}};
let currentSection = 'overview';
let currentStaff = null;
let qrScanner = null;
let qrAttendanceProcessing = false;
let qrAttendanceLastValue = '';
let qrAttendanceLastTime = 0;
let qrAttendanceSessionCount = 0;
let attendanceDate = new Date().toISOString().slice(0,10);
let adminCloudSaveTimer = null;
let bookingNotificationUnsubscribe = null;
let bookingListenerReady = false;
let adminRecordsLoadToken = 0;
const bookingActionPending = new Set();
const acceptedBookingCodes = new Set();
const classProgressActionPending = new Set();
const studentDeletionPending = new Set();
let adminDrawerReturnFocus = null;
let absenceWarningRowsCache = [];

const adminSections = [
  ['overview','bar-chart','الرئيسية'],
  ['students','users','الطلاب'],
  ['bookings','calendar','الحجوزات'],
  ['schedules','calendar','المجموعات والمواعيد'],
  ['attendance','qr','الحضور والغياب'],
  ['warnings','alert-triangle','تحذيرات الغياب'],
  ['studentRequests','user-check','طلبات الطلاب'],
  ['payments','database','اشتراك السنتر'],
  ['academics','book-open','الواجبات والامتحانات'],
  ['assignments','file-text','الواجبات حسب الصف'],
  ['exams','clipboard','الامتحانات حسب الصف'],
  ['materials','book-open','المراجعات والأسئلة'],
  ['reviews','star','التقييمات']
];
const adminSectionGroups = [
  ['التشغيل اليومي',['overview','bookings','students','schedules','attendance','warnings','studentRequests','payments']],
  ['التعليم والمتابعة',['academics','materials']],
  ['تجربة المنصة',['reviews']]
];
function adminNavMarkup(){
  return adminSectionGroups.map(([label,ids],index)=>{
    const active=ids.includes(currentSection),stored=localStorage.getItem(`mf-admin-nav-group-${index}`),open=active||stored!=='closed';
    return `<details class="admin-nav-group" data-admin-nav-group="${index}" ${open?'open':''}><summary><span>${label}</span><span data-icon="chevron-down"></span></summary><div>${ids.map(id=>{const section=adminSections.find(item=>item[0]===id);if(!section)return '';const [,icon,name]=section;return `<button type="button" data-admin-nav="${id}" class="${id===currentSection?'active':''}"><span data-icon="${icon}"></span><span>${name}</span></button>`;}).join('')}</div></details>`;
  }).join('');
}

function aToast(msg){const t=document.getElementById('toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2800);}
function safe(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function adminActionErrorMessage(error,fallback='تعذر تنفيذ العملية. حاول مرة أخرى.'){
  const nested=[error,error?.directError,error?.callableError].filter(Boolean);
  const raw=nested.map(item=>`${item?.code||''} ${item?.message||''}`).join(' | ');
  if(/الطالب غير موجود|student.*not found/i.test(raw))return 'الطالب غير موجود على قاعدة البيانات أو الحساب غير نشط.';
  if(/functions\/not-found|function.*unavailable|service.*unavailable|not found$/i.test(raw))return 'الخدمة المطلوبة غير منشورة. انشر Firebase Functions والقواعد من النسخة الجديدة.';
  if(/unauthenticated|auth\/user-token-expired/i.test(raw))return 'انتهت جلسة الدخول. سجّل دخول المدرس مرة أخرى.';
  if(/permission-denied|insufficient permissions|not authorized/i.test(raw))return 'الحساب لا يملك الصلاحية أو قواعد Firebase الجديدة لم تُنشر بعد.';
  if(/invalid-argument|كود.*غير صالح|بيانات.*غير مكتملة/i.test(raw))return 'البيانات غير مكتملة أو غير صحيحة. راجع المدخلات وحاول مرة أخرى.';
  if(/resource-exhausted|too many/i.test(raw))return 'تم تنفيذ محاولات كثيرة بسرعة. انتظر قليلًا ثم حاول مرة أخرى.';
  if(/already-exists|مسجل بالفعل/i.test(raw))return 'هذا الطالب مسجل بالفعل على المنصة. استخدم الكود السابق أو حدّث بيانات الطالب بدل إنشاء حساب جديد.';
  if(/unavailable|network|fetch|offline|deadline-exceeded|timeout/i.test(raw))return 'الاتصال بقاعدة البيانات غير متاح الآن. تحقق من الإنترنت وحاول مرة أخرى.';
  return fallback;
}
window.adminActionErrorMessage=adminActionErrorMessage;
// adminData is the in-memory source of truth after login. Re-parsing the full
// session cache on every render used to freeze slower phones and duplicate work.
function fresh(){ensureCollections();}
function ensureCollections(){['students','bookings','materials','questions','exams','examAttempts','grades','reviews','groups','assignments','studentTransferRequests'].forEach(k=>{if(!Array.isArray(adminData[k]))adminData[k]=[];}); adminData.settings=adminData.settings||{};}
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
function timeNow(){return new Date().toLocaleTimeString('ar-EG',{hour:'numeric',minute:'2-digit',hour12:true});}
function randomAccessCode(){const bytes=new Uint32Array(8);if(window.crypto?.getRandomValues)window.crypto.getRandomValues(bytes);else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*0xffffffff);return String((bytes[0]%9)+1)+[...bytes.slice(1)].map(x=>String(x%10)).join('');}
function uniqueAccessCode(prefix,field){let code;do{code=randomAccessCode(prefix);}while(adminData.students.some(s=>String(s[field]||'').toUpperCase()===code));return code;}
function newStudentCode(){return uniqueAccessCode('ST','studentCode');}
function newParentCode(){return uniqueAccessCode('PR','parentCode');}
function isWeakAccessCode(code){return !/^\d{8}$/.test(String(code||''));}
function adminWhatsAppPhone(v){const d=phoneDigits(v); if(!d) return ''; if(d.startsWith('20')) return d; if(d.startsWith('0')) return '2'+d; return d;}
function assignmentPublishMillisAdmin(value){if(!value)return 0;if(typeof value.toMillis==='function'){const millis=Number(value.toMillis());return Number.isFinite(millis)?millis:0;}if(typeof value.toDate==='function')return value.toDate().getTime();const millis=Date.parse(String(value));return Number.isFinite(millis)?millis:0;}
function assignmentPublishStateAdmin(item,now=Date.now()){if(item?.active===false)return {key:'draft',label:'مسودة',className:'warn'};const millis=assignmentPublishMillisAdmin(item?.publishAt);if(millis>now)return {key:'scheduled',label:'مجدول',className:'scheduled',millis};return {key:'published',label:'منشور',className:'good',millis};}
function assignmentPublishLabelAdmin(item){const state=assignmentPublishStateAdmin(item);if(state.key==='scheduled')return `يظهر للطلاب ${new Date(state.millis).toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'})}`;if(state.key==='published'&&state.millis)return `ظهر للطلاب ${new Date(state.millis).toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'})}`;return state.key==='draft'?'غير ظاهر للطلاب':'متاح للطلاب الآن';}
function monthlyReportTextForStudent(st){const s=normalizeStudent(st); if(typeof parentReportText==='function') return parentReportText(s); const c=calcStudentAdmin(s); return `تقرير متابعة شهر ${s.month||''}\n\nالطالب: ${s.name}\nالكود: ${s.studentCode}\nالصف: ${s.grade||'-'}\nالمجموعة: ${s.group||'-'}\n\nالمستوى العام: ${c.final||0}%\nنسبة الحضور: ${c.attendancePct||0}%\nمتوسط الدرجات: ${c.avg||0}%\nاشتراك السنتر: ${s.paid?'تم الدفع في السنتر':'لم يتم الدفع في السنتر'}\n\nملاحظات المدرس:\n${s.notes||'لا توجد ملاحظات حالية.'}`;}
function issuedCodesText(student){const s=normalizeStudent(student);return `اسم الطالب: ${s.name}\nكود الطالب وولي الأمر: ${s.studentCode}`;}
window.closeIssuedCodes=function(){document.getElementById('issuedCodesModal')?.remove();};
window.copyIssuedCodes=async function(){const modal=document.getElementById('issuedCodesModal'),text=modal?.dataset.copyText||'';try{await navigator.clipboard.writeText(text);aToast('تم نسخ الكود الموحّد');}catch(_){prompt('انسخ الكود',text);}};
window.showIssuedCodes=function(student,title='تم تسجيل الطالب بنجاح'){
  const s=normalizeStudent(student);closeIssuedCodes();document.body.insertAdjacentHTML('beforeend',`<div class="issued-codes-modal" id="issuedCodesModal" role="dialog" aria-modal="true" data-copy-text="${safe(issuedCodesText(s))}"><div class="card issued-codes-card"><button class="issued-codes-close" type="button" onclick="closeIssuedCodes()" aria-label="إغلاق">×</button><span class="badge good">تم الحفظ على النظام</span><h2>${safe(title)}</h2><p>${safe(s.name)} · ${safe(s.grade||'')}</p><div class="issued-code-row"><small>الكود الموحد للطالب وولي الأمر</small><code>${safe(s.studentCode)}</code></div><div class="mobile-actions"><button class="btn primary" type="button" onclick="copyIssuedCodes()"><span data-icon="clipboard"></span> نسخ الكود</button><button class="btn ghost" type="button" onclick="closeIssuedCodes()">تم</button></div></div></div>`);hydrateIcons();
};
function stCode(st){return st.studentCode||st.code||st.id||'';}
function stName(st){return st.studentName||st.name||'';}
function normalizeStudent(st){const normalize=typeof toEnglishDigits==='function'?toEnglishDigits:value=>String(value||'');const code=normalize(stCode(st)||'').toUpperCase(); return {...st,id:code,code,studentCode:code,parentCode:normalize(st.parentCode||'').toUpperCase(),studentPhone:phoneDigits(st.studentPhone),parentPhone:phoneDigits(st.parentPhone),name:stName(st),studentName:stName(st),active:st.active!==false};}
function sameAcademicValue(left,right){return normalizeText(String(left||''))===normalizeText(String(right||''));}
function academicValue(value){return String(value||'').trim();}
function uniqueAcademicValues(values){const found=new Map();(values||[]).forEach(value=>{const shown=academicValue(value),key=normalizeText(shown);if(shown&&key&&!found.has(key))found.set(key,shown);});return [...found.values()];}
function scheduleByIdentity(scheduleId,group,grade=''){const schedules=adminData.groups||[],wantedId=String(scheduleId||'').trim();if(wantedId){const direct=schedules.find(item=>String(item.id||item.firestoreId||'')===wantedId);if(direct)return direct;}const wantedGroup=academicValue(group);if(!wantedGroup)return null;return schedules.find(item=>sameAcademicValue(item.name,wantedGroup)&&(!grade||!item.grade||sameAcademicValue(item.grade,grade)))||schedules.find(item=>sameAcademicValue(item.name,wantedGroup))||null;}
function academicStudent(raw){const student=normalizeStudent(raw||{}),history=[...(student.attendance||[])].reverse(),record=history.find(item=>item&&(item.scheduleId||item.group||item.grade))||{},schedule=scheduleByIdentity(student.scheduleId||record.scheduleId,student.group||record.group,student.grade||record.grade),grade=academicValue(student.grade||record.grade||schedule?.grade),group=academicValue(student.group||record.group||schedule?.name);return {...student,grade,group,scheduleId:student.scheduleId||record.scheduleId||schedule?.id||''};}
function adminGradeCatalog(extra=[]){const configured=Array.isArray(GRADES)?GRADES:[],scheduleGrades=(adminData.groups||[]).map(item=>item.grade),studentGrades=(adminData.students||[]).map(item=>academicStudent(item).grade),additional=(extra||[]).map(item=>item?.student?academicStudent(item.student).grade:item?.grade),values=uniqueAcademicValues([...configured,...scheduleGrades,...studentGrades,...additional]),order=new Map(configured.map((value,index)=>[normalizeText(value),index]));return values.sort((left,right)=>(order.has(normalizeText(left))?order.get(normalizeText(left)):1000)-(order.has(normalizeText(right))?order.get(normalizeText(right)):1000)||left.localeCompare(right,'ar'));}
function adminGroupCatalog(grade='all',extra=[]){const matchesGrade=value=>grade==='all'||sameAcademicValue(value,grade),scheduleGroups=(adminData.groups||[]).filter(item=>item.active!==false&&matchesGrade(item.grade)).map(item=>item.name),studentGroups=(adminData.students||[]).map(academicStudent).filter(item=>matchesGrade(item.grade)).map(item=>item.group),additional=[];(extra||[]).forEach(item=>{const student=item?.student?academicStudent(item.student):null,itemGrade=item?.grade||student?.grade;if(!matchesGrade(itemGrade))return;additional.push(item?.group,item?.currentGroup,item?.targetGroup,student?.group);});return uniqueAcademicValues([...scheduleGroups,...studentGroups,...additional]).sort((a,b)=>a.localeCompare(b,'ar'));}
function groupOptions(){return adminGroupCatalog('all');}
function calcStudentAdmin(st){const c=typeof calcStudent==='function'?calcStudent(st):{attendancePct:0,avg:0,final:0,level:'-'}; return c;}
function badgeStatus(v){return v===true||v==='present'||v==='حاضر'||v==='تم الدفع'?'good':v===false||v==='absent'||v==='غائب'||v==='لم يدفع'?'danger':'warn';}
function content(html){const el=document.getElementById('adminContent'); if(el) el.innerHTML=`<section class="admin-section active">${html}</section>`; hydrateIcons();}
function selectedGrade(){return document.getElementById('attendanceGrade')?.value || 'all';}
function selectedGroup(){return document.getElementById('attendanceGroup')?.value || 'all';}
function filterStudents(grade='all', group='all'){return (adminData.students||[]).map(academicStudent).filter(s=>(grade==='all'||sameAcademicValue(s.grade,grade))&&(group==='all'||sameAcademicValue(s.group,group)));}

async function cloudDelete(collection,id){if(!window.MFCloud?.deleteDocument)throw new Error('Delete service unavailable');await window.MFCloud.deleteDocument(collection,id);return true;}
async function saveAdminDataNow(){if(!window.MFCloud?.saveSiteData)throw new Error('Sync service unavailable');await window.MFCloud.saveSiteData(adminData);saveData(adminData);return true;}
async function reloadFromCloud(){
  if(!window.MFCloud?.loadSiteData) return;
  const data = await window.MFCloud.loadSiteData({fast:true});
  if(data){ adminData = mergeData(data); saveData(adminData); }
  const token=++adminRecordsLoadToken;
  setTimeout(()=>hydrateAdminRecords(token),80);
}

async function hydrateAdminRecords(token){
  if(!window.MFCloud?.loadStaffRecords)return;
  try{
    const records=await window.MFCloud.loadStaffRecords();
    if(token!==adminRecordsLoadToken||!records)return;
    const students=(adminData.students||[]).map(student=>({...student,attendance:[],grades:[],homeworks:[],recitations:[]}));
    const map=new Map(students.map(student=>[String(student.studentCode||student.code||student.id||'').toUpperCase(),student]));
    const getStudent=code=>map.get(String(code||'').toUpperCase());
    (records.attendance||[]).forEach(row=>{const student=getStudent(row.studentCode||row.studentId);if(student)student.attendance.push(row);});
    (records.grades||[]).forEach(row=>{const student=getStudent(row.studentCode||row.code);if(student)student.grades.push(row);});
    (records.recitations||[]).forEach(row=>{const student=getStudent(row.studentCode);if(student)student.recitations.push(row);});
    (records.homeworks||[]).forEach(row=>{const student=getStudent(row.studentCode);if(student)student.homeworks.push(row);});
    students.forEach(student=>{student.attendance.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));student.grades.sort((a,b)=>String(a.date||a.submittedAt||'').localeCompare(String(b.date||b.submittedAt||'')));});
    adminData.students=students;adminData.examAttempts=records.attempts||[];adminData.grades=records.grades||[];adminData.studentTransferRequests=records.studentTransferRequests||[];
    saveData(adminData);
    const focused=document.activeElement?.matches?.('input,textarea,select');
    const recordDrivenSection=['attendance','warnings','studentRequests'].includes(currentSection);
    if(document.querySelector('.admin-page')&&(!focused||recordDrivenSection)&&!document.querySelector('[role="dialog"],.correction-modal-v40'))renderSection();
  }catch(error){console.warn('admin-records-background-load',error);}
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
  const shouldOpen=!!open;
  document.body.classList.toggle('admin-drawer-open',shouldOpen);
  document.getElementById('adminDrawerBackdrop')?.classList.toggle('show',shouldOpen);
  const mobile=window.matchMedia?.('(max-width:980px)').matches;
  const sidebar=document.getElementById('adminSidebar');
  if(!sidebar)return;
  const shouldHide=!!mobile&&!shouldOpen;
  if(shouldOpen&&mobile&&document.activeElement instanceof HTMLElement&&!sidebar.contains(document.activeElement)){
    adminDrawerReturnFocus=document.activeElement;
  }
  // Move focus outside before hiding the drawer. Hiding a focused descendant
  // caused Edge's aria-hidden warning and trapped keyboard focus in a closed menu.
  if(shouldHide&&sidebar.contains(document.activeElement)){
    const fallback=document.querySelector('.admin-menu-button');
    const target=adminDrawerReturnFocus?.isConnected?adminDrawerReturnFocus:fallback;
    if(target instanceof HTMLElement)target.focus({preventScroll:true});
    else if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
  }
  sidebar.toggleAttribute('inert',shouldHide);
  sidebar.setAttribute('aria-hidden',shouldHide?'true':'false');
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
      <div class="admin-nav">${adminNavMarkup()}</div>
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
        <div class="admin-top-tools">
          <label class="admin-global-search"><span data-icon="search"></span><input id="adminGlobalSearch" type="search" autocomplete="off" placeholder="ابحث عن طالب أو حجز أو طلب نقل"><span class="admin-search-shortcut">Ctrl K</span></label>
          <div id="adminSearchResults" class="admin-search-results" hidden></div>
          <div class="header-actions"><button class="theme-toggle" id="themeToggleAdmin" aria-label="تغيير الوضع"></button><button class="btn ghost" type="button" onclick="enableBookingNotifications()"><span data-icon="calendar"></span><span>تنبيهات الحجز</span></button><button class="btn ghost" type="button" onclick="forceFirestoreSync()"><span data-icon="refresh-cw"></span><span>حفظ</span></button><button class="btn dark" type="button" onclick="adminLogout()">خروج</button></div>
        </div>
      </div>
      <div id="adminContent"></div>
    </main>
    <div class="admin-quick-add" id="adminQuickAdd">
      <div class="admin-quick-add-menu" id="adminQuickAddMenu" hidden>
        <button type="button" onclick="quickAdminCreate('student')"><span data-icon="user"></span> طالب جديد</button>
        <button type="button" onclick="quickAdminCreate('schedule')"><span data-icon="calendar"></span> مجموعة وموعد</button>
        <button type="button" onclick="quickAdminCreate('assignment')"><span data-icon="file-text"></span> واجب جديد</button>
        <button type="button" onclick="quickAdminCreate('exam')"><span data-icon="clipboard"></span> امتحان جديد</button>
        <button type="button" onclick="quickAdminCreate('attendance')"><span data-icon="qr"></span> مسح حضور</button>
      </div>
      <button class="admin-quick-add-button" type="button" aria-label="إضافة سريعة" aria-expanded="false" onclick="toggleAdminQuickAdd()"><span aria-hidden="true">+</span></button>
    </div>
    <nav class="admin-mobile-bottom" aria-label="التنقل السريع في لوحة التحكم">
      ${[['overview','bar-chart','الرئيسية'],['bookings','calendar','الحجوزات'],['students','users','الطلاب'],['attendance','qr','الحضور']].map(([id,ic,name])=>`<button type="button" data-admin-nav="${id}" class="${id===currentSection?'active':''}"><span data-icon="${ic}"></span><span>${name}</span></button>`).join('')}
      <button type="button" onclick="toggleAdminDrawer(true)"><span aria-hidden="true">☰</span><span>المزيد</span></button>
    </nav>`;
  setupTheme();
  bindNav();
  setupAdminGlobalSearch();
  setAdminDrawer(false);
  renderSection();
  syncAdminChrome();
  hydrateIcons();
  startBookingNotifications();
}

window.enableBookingNotifications=async function(){if(!('Notification' in window))return aToast('المتصفح لا يدعم إشعارات الهاتف');const permission=await Notification.requestPermission();if(permission!=='granted')return aToast('اسمح بالإشعارات من إعدادات المتصفح');localStorage.setItem('mf-booking-notifications','1');startBookingNotifications();try{await window.MFCloud?.registerTeacherPushToken?.();aToast('تم تفعيل التنبيهات حتى عند إغلاق اللوحة');}catch(error){aToast('تم تفعيل تنبيهات الحجوزات أثناء فتح لوحة الإدارة');}};
function startBookingNotifications(){if(bookingNotificationUnsubscribe||!window.MFCloud?.subscribeToBookings)return;bookingNotificationUnsubscribe=window.MFCloud.subscribeToBookings((rows,changes)=>{adminData.bookings=rows.filter(row=>{const code=String(row.code||row.id||'');return !bookingActionPending.has(code)&&!acceptedBookingCodes.has(code);});saveData(adminData);if(bookingListenerReady){changes.filter(change=>change.type==='added').forEach(change=>{const b=change.doc.data();const code=String(b.code||change.doc.id||'');if(bookingActionPending.has(code)||acceptedBookingCodes.has(code))return;aToast(`حجز جديد: ${b.name||b.studentName||'طالب جديد'}`);if(Notification.permission==='granted'&&localStorage.getItem('mf-booking-notifications')==='1'){const n=new Notification('حجز طالب جديد',{body:`${b.name||b.studentName||''} · ${b.grade||''} · ${b.group||''}`,icon:'assets/icon-192.png',tag:`booking-${code}`});n.onclick=()=>{window.focus();goAdminSection('bookings');};}});}bookingListenerReady=true;if(currentSection==='bookings'&&!bookingActionPending.size)renderBookings();});}

function bindNav(){
  document.querySelectorAll('[data-admin-nav]').forEach(btn=>{btn.onclick=()=>goAdminSection(btn.dataset.adminNav);});
  document.querySelectorAll('[data-admin-nav-group]').forEach(group=>group.addEventListener('toggle',()=>localStorage.setItem(`mf-admin-nav-group-${group.dataset.adminNavGroup}`,group.open?'open':'closed')));
  if(!window.__adminEscapeBound){
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){setAdminDrawer(false);toggleAdminQuickAdd(false);document.getElementById('adminSearchResults')?.setAttribute('hidden','');}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();document.getElementById('adminGlobalSearch')?.focus();}});
    window.addEventListener('resize',()=>{if(!window.matchMedia('(max-width:980px)').matches)setAdminDrawer(false);});
    window.__adminEscapeBound=true;
  }
}
window.adminLogout=async function(){try{await window.MFCloud?.signOut?.();}catch(e){} location.reload();};
window.forceFirestoreSync=async function(){try{if(!window.MFCloud?.saveSiteData)throw new Error('Sync service unavailable');await window.MFCloud.saveSiteData(adminData);saveData(adminData);aToast('تم حفظ جميع التغييرات');}catch(error){aToast(adminActionErrorMessage(error,'تعذر حفظ التغييرات.'));}};

function adminSearchRows(query){
  const q=normalizeText(query);if(q.length<2)return [];
  const rows=[];
  (adminData.students||[]).map(academicStudent).forEach(item=>{if(normalizeText(`${item.name} ${item.studentCode} ${item.parentPhone} ${item.studentPhone} ${item.grade} ${item.group}`).includes(q))rows.push({section:'students',icon:'user',title:item.name,meta:`طالب · ${item.studentCode} · ${item.grade||''} · ${item.group||''}`,query:item.studentCode});});
  (adminData.bookings||[]).forEach(item=>{if(normalizeText(`${item.name||item.studentName} ${item.code||''} ${item.parentPhone||''} ${item.studentPhone||''} ${item.grade||''} ${item.group||''}`).includes(q))rows.push({section:'bookings',icon:'calendar',title:item.name||item.studentName||'حجز',meta:`حجز · ${item.grade||''} · ${item.group||''}`,query:item.code||item.parentPhone||item.name});});
  studentRequestRows().forEach(item=>{if(normalizeText(`${item.studentName} ${item.studentCode} ${item.parentPhone} ${item.currentGroup} ${item.targetGroup}`).includes(q))rows.push({section:'studentRequests',icon:'user-check',title:item.studentName||'طلب نقل',meta:`طلب نقل · ${item.currentGroup||'-'} ← ${item.targetGroup||'-'}`,query:item.studentCode});});
  return rows.slice(0,10);
}
function setupAdminGlobalSearch(){
  const input=document.getElementById('adminGlobalSearch'),box=document.getElementById('adminSearchResults');if(!input||!box)return;
  input.addEventListener('input',()=>{const rows=adminSearchRows(input.value);box.hidden=!input.value.trim();box.innerHTML=rows.map((row,index)=>`<button type="button" data-admin-result="${index}"><span data-icon="${row.icon}"></span><span><b>${safe(row.title)}</b><small>${safe(row.meta)}</small></span></button>`).join('')||(input.value.trim()?'<p>لا توجد نتائج مطابقة</p>':'');box.querySelectorAll('[data-admin-result]').forEach(button=>button.onclick=()=>openAdminSearchResult(rows[Number(button.dataset.adminResult)]));hydrateIcons();});
  input.addEventListener('focus',()=>{if(input.value.trim())input.dispatchEvent(new Event('input'));});
}
function openAdminSearchResult(row){
  if(!row)return;goAdminSection(row.section);const input=document.getElementById('adminGlobalSearch'),box=document.getElementById('adminSearchResults');if(input)input.value='';if(box)box.hidden=true;
  setTimeout(()=>{const filter=row.section==='students'?document.getElementById('studentSearchAdmin'):row.section==='bookings'?document.getElementById('bookingSearchAdmin'):row.section==='studentRequests'?document.getElementById('studentRequestSearch'):null;if(filter&&row.query){filter.value=row.query;filter.dispatchEvent(new Event('input',{bubbles:true}));filter.focus();}},80);
}
window.toggleAdminQuickAdd=function(force){const menu=document.getElementById('adminQuickAddMenu'),button=document.querySelector('.admin-quick-add-button');if(!menu||!button)return;const open=typeof force==='boolean'?force:menu.hidden;menu.hidden=!open;button.setAttribute('aria-expanded',String(open));document.getElementById('adminQuickAdd')?.classList.toggle('open',open);};
window.quickAdminCreate=function(type){
  toggleAdminQuickAdd(false);
  const target={student:'students',schedule:'schedules',assignment:'assignments',exam:'exams',attendance:'attendance'}[type];if(!target)return;goAdminSection(target);
  setTimeout(()=>{const focusTarget={student:'#addStudentForm [name="name"]',schedule:'#scheduleForm [name="name"]',assignment:'#assignmentForm [name="title"]',exam:'#examForm [name="title"]'}[type];if(type==='attendance')return openQrScanner();const field=document.querySelector(focusTarget||'');field?.focus();field?.scrollIntoView({behavior:'smooth',block:'center'});},90);
};

function stats(){
  fresh();const today=isoDateAdmin(),students=adminData.students||[],bookings=(adminData.bookings||[]).filter(b=>!String(b.status||'').includes('تم القبول'));
  const att=students.filter(s=>(s.attendance||[]).some(a=>String(a.date)===today&&['present','حاضر'].includes(a.status))).length;
  const corrections=(adminData.examAttempts||[]).filter(item=>item.needsManualReview||item.status==='pending_manual').length;
  const homework=students.flatMap(student=>student.homeworks||[]).filter(item=>!item.approved&&item.status!=='تمت المراجعة').length;
  return {students:students.length,bookings:bookings.length,unpaid:students.filter(s=>!s.paid).length,att,corrections,homework,warnings:absenceWarnings().length,studentRequests:(adminData.studentTransferRequests||[]).filter(item=>item.status==='pending').length};
}
function renderOverview(){
  const s=stats(),attention=[
    ['bookings','calendar','حجوزات جديدة',s.bookings,'راجع بيانات الطالب والصف والمجموعة'],
    ['warnings','alert-triangle','تحذيرات غياب متتالي',s.warnings,'أرسل تنبيه واتساب لولي الأمر'],
    ['studentRequests','user-check','طلبات نقل مجموعات',s.studentRequests,'راجع المجموعة والميعاد قبل الموافقة'],
    ['exams','clipboard','امتحانات تحتاج تصحيح',s.corrections,'راجع الأسئلة المقالية وانشر الدرجة'],
    ['assignments','file-text','واجبات تحتاج مراجعة',s.homework,'تابع تسليمات الطلاب']
  ];
  content(`<div class="section-head admin-overview-head"><div><span class="kicker"><span data-icon="bar-chart"></span> نظرة سريعة</span><h2 class="section-title">كل المهم قدامك بدون زحمة</h2><p class="section-desc">ابدأ بالمهام التي تحتاج تدخلك، وكل قسم مرتبط ببيانات Firebase الخاصة بالطلاب والصفوف والمجموعات.</p></div><button class="btn primary" type="button" onclick="toggleAdminQuickAdd(true)">+ إضافة سريعة</button></div>
  <div class="admin-overview-kpis">
    <button class="card" type="button" onclick="goAdminSection('students')"><span data-icon="users"></span><small>إجمالي الطلاب</small><b>${s.students}</b></button>
    <button class="card" type="button" onclick="goAdminSection('bookings')"><span data-icon="calendar"></span><small>حجوزات معلقة</small><b>${s.bookings}</b></button>
    <button class="card" type="button" onclick="goAdminSection('payments')"><span data-icon="database"></span><small>غير مشترك</small><b>${s.unpaid}</b></button>
    <button class="card" type="button" onclick="goAdminSection('attendance')"><span data-icon="qr"></span><small>حضور اليوم</small><b>${s.att}</b></button>
  </div>
  <div class="admin-overview-layout">
    <section class="card admin-attention-panel"><div class="admin-panel-title"><div><span class="kicker">يحتاج تدخلك</span><h3>المهام الحالية</h3></div><span class="badge warn">${attention.reduce((sum,item)=>sum+item[3],0)}</span></div><div class="admin-attention-list">${attention.map(([section,icon,title,count,desc])=>`<button type="button" onclick="goAdminSection('${section}')"><span class="admin-attention-icon" data-icon="${icon}"></span><span><b>${title}</b><small>${desc}</small></span><strong>${count}</strong></button>`).join('')}</div></section>
    <section class="card admin-quick-panel"><span class="kicker">اختصارات</span><h3>إدارة أسرع</h3><div class="admin-quick-grid"><button type="button" onclick="quickAdminCreate('student')"><span data-icon="user"></span>طالب جديد</button><button type="button" onclick="quickAdminCreate('schedule')"><span data-icon="calendar"></span>مجموعة</button><button type="button" onclick="quickAdminCreate('assignment')"><span data-icon="file-text"></span>واجب</button><button type="button" onclick="quickAdminCreate('exam')"><span data-icon="clipboard"></span>امتحان</button><button type="button" onclick="quickAdminCreate('attendance')"><span data-icon="qr"></span>ماسح QR</button><button type="button" onclick="goAdminSection('studentRequests')"><span data-icon="user-check"></span>طلبات النقل</button></div></section>
  </div>`);
}

function studentRow(st){const s=normalizeStudent(st), c=calcStudentAdmin(s); return `<tr><td><b>${safe(s.studentCode)}</b><small style="display:block">موحّد للطالب وولي الأمر</small></td><td>${safe(s.name)}</td><td>${safe(s.grade)}</td><td>${safe(s.group||'-')}</td><td><span class="badge ${badgeStatus(s.paid)}">${s.paid?'تم الدفع في السنتر':'لم يتم الدفع في السنتر'}</span></td><td>${c.attendancePct||0}%</td><td>${c.avg||0}%</td><td><div class="pay-row"><button class="small-btn primary" onclick="editStudent('${safe(s.studentCode)}')">تعديل</button><button class="small-btn" onclick="copyStudentCodes('${safe(s.studentCode)}')">نسخ الكود</button><button class="small-btn danger" onclick="regenerateStudentCode('${safe(s.studentCode)}')">تغيير الكود الموحّد</button><button class="small-btn" onclick="quickPresent('${safe(s.studentCode)}')">حضور</button><button class="small-btn" onclick="printStudentReport('${safe(s.studentCode)}')">تفاصيل</button><button class="small-btn whatsapp-report-btn" onclick="sendParentMonthlyReport('${safe(s.studentCode)}')">واتساب</button><button class="small-btn danger" onclick="deleteStudent('${safe(s.studentCode)}')">حذف</button></div></td></tr>`;}
function studentMobileCards(rows){return `<div class="student-mobile-cards">${rows.map(st=>{const s=normalizeStudent(st),c=calcStudentAdmin(s),initials=String(s.name||'ط').trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join(''); return `<article class="mobile-admin-card student-management-card"><div class="mobile-admin-card-head"><div class="student-card-identity"><span class="student-avatar">${safe(initials||'ط')}</span><div><b>${safe(s.name)}</b><small><strong dir="ltr">${safe(s.studentCode)}</strong></small><div class="student-card-tags"><span>${safe(s.grade)}</span><span>${safe(s.group||'بدون مجموعة')}</span></div></div></div><span class="badge ${badgeStatus(s.paid)}">${s.paid?'مشترك':'غير مشترك'}</span></div><div class="mobile-card-kpis"><span><small>الحضور</small><b>${c.attendancePct||0}%</b></span><span><small>الدرجات</small><b>${c.avg||0}%</b></span><span><small>التسميع</small><b>${c.recitationPct||0}%</b></span><span><small>الواجب</small><b>${c.homeworkPct||0}%</b></span></div><div class="mobile-primary-actions"><button type="button" class="small-btn primary" onclick="editStudent('${safe(s.studentCode)}')"><span data-icon="user"></span> تعديل</button><button type="button" class="small-btn attendance-quick-button" onclick="quickPresent('${safe(s.studentCode)}')"><span data-icon="user-check"></span> حضور</button><button type="button" class="small-btn whatsapp-report-btn" onclick="sendParentMonthlyReport('${safe(s.studentCode)}')"><span data-icon="phone"></span> واتساب</button></div><details class="admin-more-actions"><summary><span>المزيد من الإجراءات</span><span data-icon="chevron-down"></span></summary><div class="mobile-actions"><button type="button" class="small-btn" onclick="copyStudentCodes('${safe(s.studentCode)}')">نسخ الكود</button><button type="button" class="small-btn danger" onclick="regenerateStudentCode('${safe(s.studentCode)}')">تغيير الكود</button><button type="button" class="small-btn" onclick="printStudentReport('${safe(s.studentCode)}')">فتح التفاصيل</button><button type="button" class="small-btn danger" onclick="deleteStudent('${safe(s.studentCode)}')">حذف الطالب</button></div></details></article>`;}).join('')||'<div class="card empty-state"><span data-icon="users"></span><h3>لا يوجد طلاب مطابقون</h3><p>غيّر البحث أو الصف أو حالة الاشتراك.</p></div>'}</div>`;}
function renderStudents(){fresh(); const rows=adminData.students.map(normalizeStudent); content(`<div class="section-head"><div><span class="kicker"><span data-icon="users"></span> الطلاب</span><h2 class="section-title">بيانات الطلاب والمتابعة</h2><p class="section-desc">لكل طالب كود وباركود موحّدان يفتحان بوابة الطالب وبوابة ولي الأمر.</p></div><button class="btn ghost" onclick="upgradeLegacyAccessCodes()">توحيد الأكواد القديمة</button></div><div class="card monthly-report-help-v38"><h3>تقارير أول الشهر</h3><p>زر واتساب بجوار كل طالب يفتح رسالة جاهزة لولي الأمر فيها الحضور والتسميع والدرجات والواجب والدفع وملاحظات المدرس.</p></div><div class="card" style="margin-bottom:18px"><form id="addStudentForm" class="grid grid-4"><input name="name" placeholder="اسم الطالب الثلاثي" minlength="8" required><input name="studentPhone" inputmode="tel" placeholder="رقم الطالب"><input name="parentPhone" inputmode="tel" placeholder="رقم ولي الأمر" required><select name="grade">${GRADES.map(g=>`<option>${safe(g)}</option>`).join('')}</select><select name="month">${MONTHS.map(m=>`<option>${safe(m)}</option>`).join('')}</select><select name="group">${groupOptions().map(g=>`<option>${safe(g)}</option>`).join('')}</select><textarea name="notes" placeholder="ملاحظات المدرس"></textarea><button class="btn primary" type="submit"><span data-icon="user"></span> تسجيل طالب وإظهار الكود الموحّد</button></form><p class="form-security-note">يجب كتابة الاسم ثلاثيًا على الأقل. إذا تشابه الاسم الثلاثي اكتب الاسم الرباعي.</p></div><div class="admin-toolbar"><input id="studentSearchAdmin" placeholder="بحث بالكود أو رقم ولي الأمر"><select id="studentGradeAdmin"><option value="all">كل الصفوف</option>${GRADES.map(g=>`<option>${safe(g)}</option>`).join('')}</select><select id="studentPayAdmin"><option value="all">كل حالات اشتراك السنتر</option><option value="paid">تم الدفع في السنتر</option><option value="unpaid">لم يتم الدفع في السنتر</option></select><button class="btn ghost" onclick="refreshStudentsTable()"><span data-icon="search"></span> بحث</button></div><div id="studentsTableBox">${studentsTable(rows)}</div>`); document.getElementById('addStudentForm').onsubmit=async e=>{e.preventDefault(); const form=e.target; const button=form.querySelector('button[type="submit"]'); const input=Object.fromEntries(new FormData(form).entries()); input.name=String(input.name||'').replace(/\s+/g,' ').trim();if(input.name.split(/\s+/).filter(Boolean).length<3)return aToast('اكتب اسم الطالب ثلاثيًا على الأقل، وإذا تكرر الاسم الثلاثي اكتب الاسم الرباعي.');input.studentPhone=phoneDigits(input.studentPhone); input.parentPhone=phoneDigits(input.parentPhone); input.studentName=input.name; input.paid=false; input.active=true; input.attendance=[]; input.grades=[]; input.homeworks=[]; input.recitations=[]; button.disabled=true; button.classList.add('is-loading'); try{const created=await window.MFCloud?.createStudentAccess?.(input); if(!created?.studentCode)throw new Error('تعذر إنشاء الكود'); const s={...input,...created,parentCode:created.studentCode,code:created.studentCode,id:created.studentCode}; adminData.students.push(s); saveData(adminData); aToast('تم تسجيل الطالب وإنشاء الكود الموحّد'); window.MFCloud?.logActivity?.('تم تسجيل طالب جديد',{studentCode:s.studentCode}).catch(()=>{}); form.reset(); renderStudents(); showIssuedCodes(s,'تم تسجيل الطالب وإصدار الكود الموحّد');}catch(error){aToast(adminActionErrorMessage(error,'تعذر تسجيل الطالب وإنشاء الكود.'));}finally{button.disabled=false; button.classList.remove('is-loading');}}; ['studentSearchAdmin','studentGradeAdmin','studentPayAdmin'].forEach(id=>document.getElementById(id)?.addEventListener('input',refreshStudentsTable));}
function studentsTable(rows){return `${studentMobileCards(rows)}<div class="table-wrap admin-table-desktop"><table><thead><tr><th>الكود</th><th>الطالب</th><th>الصف</th><th>المجموعة</th><th>اشتراك السنتر</th><th>الحضور</th><th>الدرجات</th><th>إجراء</th></tr></thead><tbody>${rows.map(studentRow).join('')||'<tr><td colspan="8">لا يوجد طلاب</td></tr>'}</tbody></table></div>`;}
window.refreshStudentsTable=function(){let rows=adminData.students.map(academicStudent); const q=normalizeText(document.getElementById('studentSearchAdmin')?.value||''); const g=document.getElementById('studentGradeAdmin')?.value||'all'; const pay=document.getElementById('studentPayAdmin')?.value||'all'; if(q) rows=rows.filter(s=>normalizeText([s.name,s.studentCode,s.parentCode,s.parentPhone,s.studentPhone,s.group].join(' ')).includes(q)); if(g!=='all') rows=rows.filter(s=>sameAcademicValue(s.grade,g)); if(pay==='paid') rows=rows.filter(s=>s.paid); if(pay==='unpaid') rows=rows.filter(s=>!s.paid); document.getElementById('studentsTableBox').innerHTML=studentsTable(rows); hydrateIcons();};
window.editStudent=function(code){const s=adminData.students.find(x=>stCode(x)===code); if(!s)return; const name=prompt('اسم الطالب',stName(s)); if(name===null)return; const parentPhone=prompt('رقم ولي الأمر',s.parentPhone||''); if(parentPhone===null)return; s.name=s.studentName=name; s.parentPhone=parentPhone; s.notes=prompt('ملاحظات المدرس',s.notes||'')||s.notes||''; persist('تم تحديث بيانات الطالب'); renderStudents();};
window.deleteStudent=async function(code){code=String(code||'');if(studentDeletionPending.has(code)||!confirm('سيتم إنشاء نسخة استرجاع ثم حذف الطالب وكل بياناته. متابعة؟'))return;const student=adminData.students.find(s=>stCode(s)===code);studentDeletionPending.add(code);try{const result=await window.MFCloud?.deleteStudentSafely?.(student||{studentCode:code});if(!result?.ok)throw new Error('تعذر تأكيد الحذف');adminData.students=adminData.students.filter(s=>stCode(s)!==code);saveData(adminData);aToast(result.backupMode==='browser'?'تم تنزيل نسخة استرجاع وحذف الطالب':'تم حفظ نسخة استرجاع وحذف الطالب');renderStudents();}catch(error){aToast(adminActionErrorMessage(error,'تعذر حذف الطالب بأمان، ولم يتم حذفه من القائمة.'));}finally{studentDeletionPending.delete(code);}};
window.printStudentReport=function(code){const s=adminData.students.find(x=>stCode(x)===code);if(!s)return;const w=window.open('','_blank');w.document.write(`<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>تقرير ${safe(stName(s))}</title><link rel="stylesheet" href="assets/site.css"><style>@page{size:A4;margin:10mm}body{background:#fff!important;color:#102333;font-family:Arial,Tahoma,sans-serif}.no-print,header,footer,nav,button{display:none!important}.student-app-dashboard{box-shadow:none!important;border:0!important;width:100%!important}.student-tab-panel{display:block!important;break-inside:avoid}.student-tabbar{display:none!important}</style></head><body><main>${studentProfileHTML(normalizeStudent(s),true)}</main><script>addEventListener('load',()=>setTimeout(()=>print(),400))<\/script></body></html>`);w.document.close();};
window.sendParentMonthlyReport=async function(code){const s=adminData.students.find(x=>stCode(x)===code);if(!s)return aToast('لم يتم العثور على الطالب');const phone=adminWhatsAppPhone(s.parentPhone);if(!phone)return aToast('رقم ولي الأمر غير موجود');try{if(!window.shareParentReportPdf)throw new Error('PDF service unavailable');await window.shareParentReportPdf(s,phone);aToast('تم تجهيز تقرير PDF للمشاركة على واتساب');}catch(error){aToast('تعذر إنشاء PDF؛ استخدم زر التفاصيل ثم اطبع التقرير.');}};
window.copyParentMonthlyReport=function(code){const s=adminData.students.find(x=>stCode(x)===code); if(!s)return aToast('لم يتم العثور على الطالب'); navigator.clipboard?.writeText(monthlyReportTextForStudent(s)).then(()=>aToast('تم نسخ التقرير')).catch(()=>aToast('تعذر النسخ'));};

window.copyStudentCodes=async function(code){
  const raw=adminData.students.find(x=>stCode(x)===code);if(!raw)return aToast('لم يتم العثور على الطالب');const s=normalizeStudent(raw);
  const text=`اسم الطالب: ${s.name}\nالكود الموحد للطالب وولي الأمر: ${s.studentCode}`;
  try{await navigator.clipboard.writeText(text);aToast('تم نسخ الكود الموحد');}catch(e){prompt('انسخ الكود',text);}
};
window.regenerateParentCode=async function(code){
  return window.regenerateStudentCode(code);
};
window.regenerateStudentCode=async function(code){
  const s=adminData.students.find(x=>stCode(x)===code);if(!s)return;
  if(!confirm('سيتم تغيير الكود الموحّد للطالب وولي الأمر وتحديث جميع السجلات. يجب إرسال الكود الجديد للأسرة. متابعة؟'))return;
  const oldCode=stCode(s),oldParentCode=String(s.parentCode||oldCode).toUpperCase(),newCode=newStudentCode();
  const proposed={...s,studentCode:newCode,code:newCode,id:newCode,parentCode:newCode};
  try{if(!window.MFCloud?.migrateStudentCode)throw new Error('Student migration service unavailable');await window.MFCloud.migrateStudentCode(oldCode,newCode,proposed);if(oldParentCode&&oldParentCode!==oldCode&&oldParentCode!==newCode)await window.MFCloud?.deleteDocument?.('parent_portal',oldParentCode);Object.assign(s,proposed);(adminData.bookings||[]).forEach(item=>{if(item.studentCode===oldCode)item.studentCode=newCode;});(adminData.examAttempts||[]).forEach(item=>{if(item.studentCode===oldCode)item.studentCode=newCode;});(adminData.grades||[]).forEach(item=>{if(item.studentCode===oldCode)item.studentCode=newCode;});saveData(adminData);aToast('تم تغيير الكود الموحّد وتحديث جميع السجلات');renderStudents();}
  catch(error){aToast(adminActionErrorMessage(error,'تعذر تغيير الكود؛ ظل الكود القديم كما هو.'));}
};
window.upgradeLegacyAccessCodes=async function(){
  fresh();const targets=adminData.students.filter(s=>isWeakAccessCode(stCode(s))||String(s.parentCode||'').toUpperCase()!==String(stCode(s)).toUpperCase());
  if(!targets.length)return aToast('كل الطلاب يستخدمون الكود الموحّد بالفعل');
  if(!confirm(`سيتم توحيد كود الطالب وولي الأمر لعدد ${targets.length} طالب. احفظ نسخة احتياطية أولًا. متابعة؟`))return;
  let success=0,failed=0,cleanupFailed=0;
  for(const student of targets){
    const oldCode=stCode(student),oldParentCode=String(student.parentCode||'').toUpperCase();
    try{
      if(isWeakAccessCode(oldCode)){
        if(!window.MFCloud?.migrateStudentCode)throw new Error('Student migration service unavailable');
        const newCode=newStudentCode(),proposed={...student,studentCode:newCode,code:newCode,id:newCode,parentCode:newCode};
        await window.MFCloud.migrateStudentCode(oldCode,newCode,proposed);Object.assign(student,proposed);
        (adminData.bookings||[]).forEach(item=>{if(item.studentCode===oldCode)item.studentCode=newCode;});
        (adminData.examAttempts||[]).forEach(item=>{if(item.studentCode===oldCode)item.studentCode=newCode;});
        (adminData.grades||[]).forEach(item=>{if(item.studentCode===oldCode)item.studentCode=newCode;});
      }else{
        if(!window.MFCloud?.saveStudent)throw new Error('Student service unavailable');
        const proposed={...student,parentCode:oldCode};await window.MFCloud.saveStudent(proposed);Object.assign(student,proposed);
      }
      success+=1;
      if(oldParentCode&&oldParentCode!==String(student.parentCode||'')){try{await window.MFCloud?.deleteDocument?.('parent_portal',oldParentCode);}catch(error){cleanupFailed+=1;}}
    }catch(error){failed+=1;}
  }
  saveData(adminData);aToast(failed?`تم توحيد ${success} وتعذر ${failed}${cleanupFailed?`، ويوجد ${cleanupFailed} كود قديم يحتاج تنظيف`:''}`:`تم توحيد أكواد ${success} طالب بنجاح`);renderStudents();
};

function pendingBookings(){return (adminData.bookings||[]).filter(b=>!String(b.status||'').includes('تم القبول'));}
function renderBookings(){fresh();const rows=pendingBookings(),grades=adminGradeCatalog(rows),groups=adminGroupCatalog('all',rows);content(`<div class="section-head"><div><span class="kicker"><span data-icon="calendar"></span> طلبات التسجيل</span><h2 class="section-title">قبول الطلاب الجدد</h2><p class="section-desc">ابحث بالاسم أو الكود أو الهاتف، ثم فلتر بالصف والمجموعة قبل قبول الطلب.</p></div><button class="btn ghost" onclick="exportBookingsCSV()"><span data-icon="database"></span> تصدير CSV</button></div><div class="card booking-admin-filters"><div class="booking-filter-count"><small>طلبات تنتظر القبول</small><b class="big-num">${rows.length}</b></div><label><span>بحث عن الطالب</span><input id="bookingSearchAdmin" type="search" placeholder="الاسم أو الكود أو رقم الهاتف"></label><label><span>الصف</span><select id="bookingGradeAdmin"><option value="all">كل الصفوف</option>${grades.map(g=>`<option value="${safe(g)}">${safe(g)}</option>`).join('')}</select></label><label><span>المجموعة</span><select id="bookingGroupAdmin"><option value="all">كل المجموعات</option>${groups.map(g=>`<option value="${safe(g)}">${safe(g)}</option>`).join('')}</select></label></div><div class="card booking-admin-results"><div id="bookingRowsAdmin" class="booking-admin-list">${rows.map(bookingCard).join('')||'<div class="empty-state"><h3>لا توجد طلبات جديدة</h3><p>أي حجز جديد من الموقع سيظهر هنا فورًا.</p></div>'}</div></div>`);document.getElementById('bookingSearchAdmin')?.addEventListener('input',refreshBookingsTable);document.getElementById('bookingGroupAdmin')?.addEventListener('change',refreshBookingsTable);document.getElementById('bookingGradeAdmin')?.addEventListener('change',syncBookingGroupFilter);}

function scheduleCard(g){const capacity=Math.max(0,Number(g.capacity)||0);return `<article class="mobile-row schedule-admin-row"><div><b>${safe(g.name||'مجموعة بدون اسم')}</b><small>${safe(g.grade||'كل الصفوف')} · ${safe(g.term||'كل الترمات')} · ${safe(g.days||'-')} · ${safe(formatTime12(g.startTime)||'-')} ${g.endTime?`— ${safe(formatTime12(g.endTime))}`:''}${capacity?` · السعة ${capacity} طالب`:''}</small></div><span class="badge ${g.active===false?'danger':'good'}">${g.active===false?'متوقفة':'متاحة للحجز والنقل'}</span><div class="mobile-actions"><button class="small-btn" type="button" onclick="editSchedule('${safe(g.id)}')">تعديل</button><button class="small-btn ${g.active===false?'primary':'danger'}" type="button" onclick="toggleSchedule('${safe(g.id)}')">${g.active===false?'تفعيل':'إيقاف'}</button></div></article>`;}
function renderSchedules(){fresh();content(`<div class="section-head"><div><span class="kicker"><span data-icon="calendar"></span> المجموعات والمواعيد</span><h2 class="section-title">إدارة مجموعات كل صف</h2><p class="section-desc">المجموعة النشطة تظهر في الحجز وطلب النقل فقط للطالب المطابق لنفس الصف والترم والعام الدراسي.</p></div></div><div class="grid grid-2 schedule-admin-layout"><form id="scheduleForm" class="card grid"><h3 id="scheduleFormTitle">إضافة مجموعة جديدة</h3><input name="id" type="hidden"><div class="field"><label>اسم المجموعة</label><input name="name" required placeholder="مثال: مجموعة السبت والثلاثاء"></div><div class="field"><label>الصف</label><select name="grade" required>${GRADES.map(g=>`<option>${safe(g)}</option>`).join('')}</select></div><div class="grid grid-2"><div class="field"><label>الترم</label><select name="term"><option>كل الترمات</option><option>الترم الأول</option><option>الترم الثاني</option></select></div><div class="field"><label>العام الدراسي</label><input name="academicYear" value="${safe(adminData.settings?.academicYear||'')}" placeholder="مثال: 2026 / 2027"></div></div><div class="field"><label>الأيام</label><input name="days" required placeholder="السبت والثلاثاء"></div><div class="grid grid-2"><div class="field"><label>من</label><input name="startTime" type="time" required></div><div class="field"><label>إلى</label><input name="endTime" type="time" required></div></div><div class="field"><label>السعة القصوى — اختياري</label><input name="capacity" type="number" min="0" max="500" value="0"><small>اكتب 0 لو المجموعة بدون حد أقصى.</small></div><label class="option-card"><input name="active" type="checkbox" checked> متاحة للحجز وطلب النقل الآن</label><button class="btn primary" type="submit"><span data-icon="calendar"></span> حفظ المجموعة والميعاد</button><button class="btn ghost" type="reset" onclick="resetScheduleForm()">إلغاء التعديل</button></form><div class="card"><h3>المجموعات الحالية</h3><div class="schedule-admin-list">${(adminData.groups||[]).slice().sort((a,b)=>`${a.grade||''} ${a.days||''} ${a.startTime||''}`.localeCompare(`${b.grade||''} ${b.days||''} ${b.startTime||''}`,'ar')).map(scheduleCard).join('')||'<p class="section-desc">لا توجد مجموعات بعد. أضف أول مجموعة من النموذج.</p>'}</div></div></div>`);document.getElementById('scheduleForm').onsubmit=saveSchedule;}
window.resetScheduleForm=function(){const form=document.getElementById('scheduleForm');if(form){form.reset();form.elements.id.value='';form.elements.active.checked=true;}const title=document.getElementById('scheduleFormTitle');if(title)title.textContent='إضافة مجموعة جديدة';};
window.editSchedule=function(id){const g=(adminData.groups||[]).find(x=>String(x.id)===String(id)),form=document.getElementById('scheduleForm');if(!g||!form)return;['id','name','grade','days','startTime','endTime','academicYear','capacity'].forEach(k=>{if(form.elements[k])form.elements[k].value=g[k]||'';});if(form.elements.term)form.elements.term.value=g.term||'كل الترمات';form.active.checked=g.active!==false;document.getElementById('scheduleFormTitle').textContent='تعديل المجموعة والميعاد';form.scrollIntoView({behavior:'smooth',block:'start'});};
window.toggleSchedule=async function(id){const g=(adminData.groups||[]).find(x=>String(x.id)===String(id));if(!g)return;g.active=g.active===false;persist(g.active?'تم تفعيل الموعد':'تم إيقاف الموعد');try{await window.MFCloud?.saveGroup?.(g);}catch(e){}renderSchedules();};
async function saveSchedule(event){event.preventDefault();const form=event.currentTarget,data=Object.fromEntries(new FormData(form).entries());data.id=data.id||`group-${Date.now()}`;data.active=form.active.checked;data.capacity=Math.max(0,Math.min(500,Number(data.capacity)||0));const index=(adminData.groups||[]).findIndex(x=>String(x.id)===String(data.id));if(index>=0)adminData.groups[index]={...adminData.groups[index],...data};else adminData.groups.push(data);persist('تم حفظ المجموعة والميعاد');try{await window.MFCloud?.saveGroup?.(data);}catch(e){aToast('تم الحفظ محليًا وتعذرت المزامنة الآن');}renderSchedules();}
window.refreshBookingsTable=function(){let rows=pendingBookings();const query=normalizeText(document.getElementById('bookingSearchAdmin')?.value||''),grade=document.getElementById('bookingGradeAdmin')?.value||'all',group=document.getElementById('bookingGroupAdmin')?.value||'all';if(query)rows=rows.filter(b=>normalizeText(`${b.code||b.id||''} ${b.name||b.studentName||''} ${b.parentPhone||''} ${b.studentPhone||''}`).includes(query));if(grade!=='all')rows=rows.filter(b=>sameAcademicValue(b.grade,grade));if(group!=='all')rows=rows.filter(b=>sameAcademicValue(b.group,group));const box=document.getElementById('bookingRowsAdmin');if(box)box.innerHTML=rows.map(bookingCard).join('')||'<div class="empty-state"><h3>لا توجد نتائج</h3><p>غيّر البحث أو الصف أو المجموعة.</p></div>';};
function syncBookingGroupFilter(){const grade=document.getElementById('bookingGradeAdmin')?.value||'all',select=document.getElementById('bookingGroupAdmin');if(!select)return;const previous=select.value||'all',groups=adminGroupCatalog(grade,pendingBookings());select.innerHTML=`<option value="all">كل المجموعات</option>${groups.map(group=>`<option value="${safe(group)}">${safe(group)}</option>`).join('')}`;select.value=groups.some(value=>sameAcademicValue(value,previous))?groups.find(value=>sameAcademicValue(value,previous)):'all';refreshBookingsTable();}
function bookingCard(b){return `<article class="booking-admin-card compact-booking-card" data-booking-code="${safe(b.code||b.id)}"><div class="compact-booking-main"><span class="student-avatar">${safe(String(b.name||b.studentName||'ط').charAt(0))}</span><div><div class="compact-booking-title"><h3>${safe(b.name||b.studentName)}</h3><span class="badge warn">قيد التسجيل</span></div><small>${safe(b.code)} · ${safe(b.grade)} · ${safe(b.group)}</small></div></div><div class="compact-booking-meta"><span><small>الطالب</small><b dir="ltr">${safe(b.studentPhone||'-')}</b></span><span><small>ولي الأمر</small><b dir="ltr">${safe(b.parentPhone||'-')}</b></span><span><small>الشهر</small><b>${safe(b.month||'-')}</b></span></div><div class="compact-booking-actions"><button class="small-btn primary" type="button" onclick="approveBooking('${safe(b.code)}')"><span data-icon="user-check"></span> قبول</button><button class="small-btn danger" type="button" onclick="deleteBooking('${safe(b.code)}')"><span data-icon="trash"></span> رفض</button></div></article>`;}
window.approveBooking=async function(code){
  code=String(code||'');
  if(bookingActionPending.has(code)||acceptedBookingCodes.has(code))return false;
  const b=adminData.bookings.find(x=>String(x.code||x.id)===code);if(!b)return false;
  bookingActionPending.add(code);
  const card=document.querySelector(`[data-booking-code="${CSS.escape(code)}"]`);
  card?.classList.add('is-processing');
  card?.querySelectorAll('button').forEach(button=>button.disabled=true);
  adminData.bookings=adminData.bookings.filter(item=>String(item.code||item.id)!==code);
  saveData(adminData);
  requestAnimationFrame(()=>{card?.remove();const count=document.querySelector('.booking-admin-summary .big-num');if(count)count.textContent=String(pendingBookings().length);});
  try{
    const created=await window.MFCloud?.approveBooking?.(code);
    if(!created?.studentCode||!created?.parentCode)throw new Error('تعذر إنشاء الأكواد');
    let student=adminData.students.find(s=>stCode(s)===created.studentCode||String(s.bookingCode||'')===String(code));
    const data={...b,...created,bookingCode:code,studentName:created.studentName||created.name||b.studentName||b.name,name:created.name||created.studentName||b.name,studentPhone:phoneDigits(created.studentPhone||b.studentPhone),parentPhone:phoneDigits(created.parentPhone||b.parentPhone),paid:false,active:true,attendance:student?.attendance||[],grades:student?.grades||[],homeworks:student?.homeworks||[],recitations:student?.recitations||[]};
    if(student)Object.assign(student,data);else{student=data;adminData.students.push(student);}
    acceptedBookingCodes.add(code);
    saveData(adminData);
    return true;
  }catch(error){adminData.bookings.unshift(b);saveData(adminData);renderBookings();const raw=String(error?.code||'')+' '+String(error?.message||'');const message=/unauthenticated/i.test(raw)?'انتهت جلسة الدخول. سجّل دخول المدرس من جديد.':/permission-denied/i.test(raw)?'حساب المدرس غير مفعّل أو لا يملك صلاحية القبول.':/not-found/i.test(raw)?'الحجز غير موجود أو تم التعامل معه بالفعل.':/internal|unavailable|function.*unavailable/i.test(raw)?'خدمة قبول الحجز غير متاحة حاليًا.':(error?.message?.split(':').pop()?.trim()||'تعذر قبول الحجز.');aToast(message);return false;}
  finally{bookingActionPending.delete(code);}
};
window.deleteBooking=async function(code){if(!confirm('رفض الحجز وإيقاف الأكواد التي صدرت له؟'))return;try{await window.MFCloud?.rejectBooking?.(code);adminData.bookings=adminData.bookings.filter(b=>String(b.code||b.id)!==String(code));saveData(adminData);aToast('تم رفض الحجز وإيقاف الأكواد');deferAdminRender(renderBookings);}catch(error){const raw=String(error?.code||'')+' '+String(error?.message||'');const message=/unauthenticated/i.test(raw)?'انتهت جلسة الدخول. سجّل الدخول من جديد.':/permission-denied/i.test(raw)?'الحساب لا يملك صلاحية رفض الحجوزات.':/not-found/i.test(raw)?'الحجز غير موجود أو تم التعامل معه بالفعل.':/internal|unavailable|function.*unavailable/i.test(raw)?'خدمة رفض الحجز غير متاحة حاليًا.':(error?.message?.split(':').pop()?.trim()||'تعذر رفض الحجز.');aToast(message);}};

function findAttendance(st,date){return (st.attendance||[]).find(a=>String(a.date)===date);}
function classProgressRows(st,type){return type==='recitation'?(st.recitations||[]):(st.homeworks||[]);}
function findClassProgress(st,type,date=attendanceDate){return classProgressRows(st,type).find(row=>String(row.date||'')===String(date)&&(row.completed===true||row.approved===true||String(row.status||'').startsWith('تم')));}
function attendanceRecord(st,status,method){const s=normalizeStudent(st); st.studentCode=s.studentCode; st.code=s.studentCode; st.name=s.name; st.studentName=s.name; return {studentId:s.studentCode,studentCode:s.studentCode,studentName:s.name,grade:s.grade,group:s.group,status,date:attendanceDate,time:status==='present'?timeNow():null,method,scannedBy:currentStaff?.email||currentStaff?.uid||'teacher',createdAt:new Date().toISOString()};}
async function saveAttendanceRecord(st,status,method){st.attendance=st.attendance||[];const before=st.attendance.map(item=>({...item})),record=attendanceRecord(st,status,method),existing=findAttendance(st,attendanceDate);if(existing)Object.assign(existing,record);else st.attendance.push(record);saveData(adminData);try{if(!window.MFCloud?.upsertAttendance)throw new Error('Attendance service unavailable');const saved=await window.MFCloud.upsertAttendance(record);if(!saved?.id)throw new Error('تعذر تأكيد حفظ الحضور');return saved;}catch(error){st.attendance=before;saveData(adminData);throw error;}}
async function registerQrAttendance(code,options={}){fresh();const keepScannerOpen=options.keepScannerOpen===true,normalizedCode=String(code||'').trim().toUpperCase(),st=adminData.students.map(normalizeStudent).find(s=>String(s.studentCode).trim().toUpperCase()===normalizedCode);if(!st){aToast('لم يتم العثور على طالب بهذا الكود.');return {ok:false,message:'لم يتم العثور على طالب بهذا الكود'};}const original=adminData.students.find(s=>stCode(s)===st.studentCode),existing=findAttendance(original,attendanceDate);if(existing?.status==='present'){aToast(`${st.name} مسجل حضور بالفعل اليوم.`);return {ok:false,alreadyPresent:true,studentName:st.name,message:'مسجل حضور بالفعل'};}try{await saveAttendanceRecord(original,'present','qr_scan');aToast(`تم تسجيل حضور ${st.name}`);if(!keepScannerOpen)renderAttendance();return {ok:true,studentName:st.name,studentCode:st.studentCode,time:timeNow()};}catch(error){const message=adminActionErrorMessage(error,'تعذر تسجيل الحضور.');aToast(message);return {ok:false,message};}}
window.quickPresent=function(code){attendanceDate=isoDateAdmin(); registerQrAttendance(code);};
window.markAbsentForMissing=async function(){fresh();const grade=selectedGrade(),group=selectedGroup(),students=filterStudents(grade,group),missing=students.filter(student=>!findAttendance(student,attendanceDate)),records=[];if(!missing.length)return aToast('كل الطلاب لديهم حالة مسجلة لهذا اليوم');if(!confirm(`سيتم تسجيل ${missing.length} طالب غائب في ${grade} — ${group} بتاريخ ${attendanceDate}. هل أنت متأكد؟`))return;for(const st of missing){const original=adminData.students.find(s=>stCode(s)===st.studentCode);if(original){const record=attendanceRecord(original,'absent','auto_absent');original.attendance=original.attendance||[];original.attendance.push(record);records.push(record);}}saveData(adminData);const results=[];for(let index=0;index<records.length;index+=20){const chunk=records.slice(index,index+20);if(!window.MFCloud?.upsertAttendance){chunk.forEach(()=>results.push({status:'rejected',reason:new Error('Attendance service unavailable')}));continue;}results.push(...await Promise.allSettled(chunk.map(record=>window.MFCloud.upsertAttendance(record))));}let saved=0;results.forEach((result,index)=>{if(result.status==='fulfilled')saved+=1;else{const record=records[index],student=adminData.students.find(item=>stCode(item)===record.studentCode);if(student)student.attendance=(student.attendance||[]).filter(item=>!(item.date===record.date&&item.method==='auto_absent'));}});saveData(adminData);if(saved)window.MFCloud?.logActivity?.('تم تسجيل الغياب الجماعي',{date:attendanceDate,count:saved}).catch(()=>{});aToast(saved===records.length?`تم تسجيل غياب ${saved} طالب غير حاضر`:`تم حفظ غياب ${saved} وتعذر ${records.length-saved}؛ راجع الاتصال والصلاحيات`);renderAttendance();};
function todayAttendanceRows(){const grade=selectedGrade(), group=selectedGroup(); return filterStudents(grade,group).flatMap(st=>(st.attendance||[]).filter(a=>String(a.date)===attendanceDate).map(a=>({...a,studentName:st.name,studentCode:st.studentCode,grade:st.grade,group:st.group})));}
function attendanceRosterHTML(){const query=normalizeText(sessionStorage.getItem('attendanceStudentSearch')||''),rows=filterStudents(selectedGrade(),selectedGroup()).filter(student=>!query||normalizeText(`${student.name} ${student.studentCode} ${student.parentPhone||''}`).includes(query));return `<div class="attendance-roster">${rows.map(st=>{const record=findAttendance(st,attendanceDate),status=record?.status||'',recited=!!findClassProgress(st,'recitation'),homework=!!findClassProgress(st,'homework'),initials=String(st.name||'ط').trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('');return `<article class="attendance-student ${status||'pending'}"><span class="student-avatar">${safe(initials||'ط')}</span><div class="attendance-student-info"><b>${safe(st.name)}</b><small><strong dir="ltr">${safe(st.studentCode)}</strong> · ${safe(st.group||'-')}</small><div class="attendance-progress-tags"><span class="${recited?'done':''}">${recited?'✓ تم التسميع':'لم يسمّع'}</span><span class="${homework?'done':''}">${homework?'✓ تم الواجب':'لم يعمل الواجب'}</span></div></div><span class="badge ${status?badgeStatus(status):'warn'}">${status==='present'?'حاضر':status==='absent'?'غائب':'لم يسجل'}</span><div class="attendance-row-actions class-progress-actions"><button class="small-btn attendance-present ${status==='present'?'selected':''}" onclick="setAttendanceStatus('${safe(st.studentCode)}','present')"><span data-icon="user-check"></span> حاضر</button><button class="small-btn attendance-absent ${status==='absent'?'selected':''}" onclick="setAttendanceStatus('${safe(st.studentCode)}','absent')">غائب</button><button class="small-btn ${recited?'primary':'ghost'}" onclick="toggleClassProgress('${safe(st.studentCode)}','recitation')">${recited?'التسميع ✓':'تسميع'}</button><button class="small-btn ${homework?'primary':'ghost'}" onclick="toggleClassProgress('${safe(st.studentCode)}','homework')">${homework?'الواجب ✓':'الواجب'}</button></div></article>`;}).join('')||'<div class="empty-state"><span data-icon="search"></span><h3>لا يوجد طلاب مطابقون</h3><p>راجع الصف والمجموعة أو كلمة البحث.</p></div>'}</div>`;}
window.setAttendanceStatus=async function(code,status){const st=adminData.students.find(item=>String(stCode(item))===String(code));if(!st)return aToast('الطالب غير موجود');try{await saveAttendanceRecord(st,status,'manual_button');aToast(status==='present'?'تم تسجيل الحضور':'تم تسجيل الغياب');}catch(error){aToast(adminActionErrorMessage(error,'تعذر حفظ حالة الحضور.'));}renderAttendance();};
window.toggleClassProgress=async function(code,type){
  const student=adminData.students.find(item=>String(stCode(item))===String(code));if(!student)return aToast('الطالب غير موجود');
  const actionKey=`${code}:${type}:${attendanceDate}`;
  if(classProgressActionPending.has(actionKey))return;
  const existing=findClassProgress(student,type),completed=!existing,key=type==='recitation'?'recitations':'homeworks';
  student[key]=student[key]||[];
  const before=student[key].slice();
  const record={id:`${code}_${attendanceDate}_class`,studentCode:code,studentName:stName(student),grade:student.grade||'',group:student.group||'',academicYear:student.academicYear||'',term:student.term||'',type,date:attendanceDate,time:timeNow(),completed,approved:completed,method:'teacher_class_check',status:completed?(type==='recitation'?'تم التسميع':'تم عمل الواجب'):''};
  student[key]=student[key].filter(row=>!(String(row.date||'')===String(attendanceDate)&&(row.type===type||row.method==='teacher_class_check')));
  if(completed)student[key].push(record);
  classProgressActionPending.add(actionKey);
  saveData(adminData);
  renderAttendance();
  try{
    const result=await window.MFCloud?.recordClassProgress?.(record);
    if(!result)throw new Error('تعذر الحفظ');
    student[key]=student[key].filter(row=>!(String(row.date||'')===String(attendanceDate)&&(row.type===type||row.method==='teacher_class_check')));
    if(completed)student[key].push({...result,completed:true,approved:true});
    saveData(adminData);
    aToast(completed?(type==='recitation'?`تم تسجيل تسميع ${stName(student)}`:`تم تسجيل واجب ${stName(student)}`):(type==='recitation'?'تم إلغاء علامة التسميع':'تم إلغاء علامة الواجب'));
  }catch(error){
    student[key]=before;saveData(adminData);renderAttendance();
    aToast(adminActionErrorMessage(error,'تعذر حفظ متابعة الحصة.'));
  }finally{classProgressActionPending.delete(actionKey);}
};
function attendanceLogHTML(){const rows=todayAttendanceRows(); return `<div class="mobile-card-table">${rows.map(r=>`<div class="mobile-row"><b>${safe(r.studentName)}</b><span class="badge ${badgeStatus(r.status)}">${r.status==='present'?'حاضر':'غائب'}</span><small>${safe(r.studentCode)} · ${safe(formatTime12(r.time)||'-')} · ${safe(r.group||'-')}</small></div>`).join('')||'<p class="section-desc">لا توجد سجلات اليوم.</p>'}</div><div class="table-wrap admin-table-desktop"><table><thead><tr><th>الطالب</th><th>الكود</th><th>الحالة</th><th>الوقت</th><th>الطريقة</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${safe(r.studentName)}</td><td>${safe(r.studentCode)}</td><td><span class="badge ${badgeStatus(r.status)}">${r.status==='present'?'حاضر':'غائب'}</span></td><td>${safe(formatTime12(r.time)||'-')}</td><td>${safe(r.method||'-')}</td></tr>`).join('')||'<tr><td colspan="5">لا توجد سجلات اليوم</td></tr>'}</tbody></table></div>`;}
function attendanceReportHTML(){const rows=todayAttendanceRows(); const present=rows.filter(r=>r.status==='present').length, absent=rows.filter(r=>r.status==='absent').length; return `<div class="metric-grid"><div class="metric"><b>${rows.length}</b><small>إجمالي مسجل</small></div><div class="metric"><b>${present}</b><small>حاضر</small></div><div class="metric"><b>${absent}</b><small>غائب</small></div><div class="metric"><b>${rows.length?Math.round(present/rows.length*100):0}%</b><small>نسبة الحضور</small></div></div>`;}
window.manualAttendancePrompt=function(){const code=prompt('اكتب كود الطالب الموجود في QR'); if(code) registerQrAttendance(code.trim());};
function updateContinuousQrStatus(message,state='ready'){const box=document.getElementById('continuousQrStatus');if(!box)return;box.className=`continuous-qr-status ${state}`;box.innerHTML=`<b>${safe(message)}</b><small>تم تسجيل ${qrAttendanceSessionCount} طالب في جلسة المسح الحالية</small>`;}
async function handleContinuousQrScan(rawValue){const value=String(rawValue||'').trim(),now=Date.now();if(!value||qrAttendanceProcessing)return;if(value===qrAttendanceLastValue&&now-qrAttendanceLastTime<3000)return;qrAttendanceProcessing=true;qrAttendanceLastValue=value;qrAttendanceLastTime=now;updateContinuousQrStatus('جاري تسجيل الحضور…','processing');try{const result=await registerQrAttendance(value,{keepScannerOpen:true});if(result?.ok){qrAttendanceSessionCount+=1;updateContinuousQrStatus(`✓ تم تسجيل ${result.studentName} — الطالب التالي`,'success');if(navigator.vibrate)navigator.vibrate(120);}else updateContinuousQrStatus(result?.alreadyPresent?`${result.studentName} مسجل بالفعل — الطالب التالي`:result?.message||'تعذر قراءة الطالب — حاول مرة أخرى',result?.alreadyPresent?'warning':'error');}finally{setTimeout(()=>{qrAttendanceProcessing=false;},500);}}
window.openQrScanner=async function(){
  const modal=document.getElementById('qrScannerModal'),reader=document.getElementById('adminQrReader');
  if(!modal||!reader)return;
  modal.hidden=false;qrAttendanceProcessing=false;qrAttendanceLastValue='';qrAttendanceLastTime=0;qrAttendanceSessionCount=0;
  document.getElementById('continuousQrStatus')?.remove();
  reader.insertAdjacentHTML('beforebegin','<div id="continuousQrStatus" class="continuous-qr-status ready"><b>جاهز لمسح الطالب الأول</b><small>سيظل الماسح مفتوحًا لتسجيل الطلاب واحدًا وراء الآخر</small></div>');
  reader.innerHTML='<p class="section-desc">جاري تجهيز الكاميرا…</p>';
  try{
    if(typeof ensureQrScannerLibrary==='function')await ensureQrScannerLibrary();
    reader.innerHTML='';
    if(typeof window.Html5Qrcode==='function'){
      qrScanner=new window.Html5Qrcode('adminQrReader');
      await qrScanner.start({facingMode:{ideal:'environment'}},{fps:10,qrbox:{width:250,height:250}},decoded=>{handleContinuousQrScan(decoded);},()=>{});
      return;
    }
    if(!navigator.mediaDevices?.getUserMedia||!('BarcodeDetector'in window))throw new Error('scanner-unavailable');
    reader.innerHTML='<video id="adminQrVideo" autoplay playsinline muted></video>';
    const video=document.getElementById('adminQrVideo');
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    video.srcObject=stream;await video.play();
    const detector=new BarcodeDetector({formats:['qr_code']});
    const loop=async()=>{if(document.getElementById('qrScannerModal')?.hidden)return;const codes=await detector.detect(video).catch(()=>[]);if(codes.length)await handleContinuousQrScan(codes[0].rawValue);setTimeout(loop,500);};
    loop();
  }catch(error){
    const video=document.getElementById('adminQrVideo');if(video?.srcObject)video.srcObject.getTracks().forEach(track=>track.stop());
    reader.innerHTML='<p class="section-desc">تعذر تشغيل الماسح. اسمح باستخدام الكاميرا، أو استخدم إدخال الكود اليدوي.</p>';
    updateContinuousQrStatus('تعذر تشغيل الكاميرا أو قارئ QR','error');
    console.warn('Admin QR scanner failed',error);
  }
};
window.closeQrScanner=async function(){try{if(qrScanner){await qrScanner.stop();qrScanner.clear();qrScanner=null;}}catch(e){}const v=document.getElementById('adminQrVideo');if(v?.srcObject)v.srcObject.getTracks().forEach(t=>t.stop());const m=document.getElementById('qrScannerModal');if(m)m.hidden=true;qrAttendanceProcessing=false;if(currentSection==='attendance')renderAttendance();};

function attendanceWarningHistory(student){
  const unique=new Map();
  (student?.attendance||[]).forEach((record,index)=>{
    const status=String(record?.status||'').trim();
    if(!['present','absent','حاضر','غائب'].includes(status))return;
    const date=String(record.date||record.createdAt||'').slice(0,10);if(!date)return;
    const key=String(record.sessionId||record.sessionKey||record.id||`${date}:${record.scheduleId||record.group||''}:${record.time||index}`);
    unique.set(key,{...record,date,status:status==='غائب'?'absent':status==='حاضر'?'present':status});
  });
  return [...unique.values()].sort((a,b)=>`${a.date} ${a.createdAt||a.time||''}`.localeCompare(`${b.date} ${b.createdAt||b.time||''}`));
}
function consecutiveAbsenceWarning(student){const history=attendanceWarningHistory(student),dates=[];for(let index=history.length-1;index>=0;index-=1){if(history[index].status!=='absent')break;dates.push(history[index].date);}return dates.length>=2?{count:dates.length,dates,latestDate:dates[0]}:null;}
function absenceWarnings(){return (adminData.students||[]).map(academicStudent).filter(student=>student.active!==false).map(student=>({student,warning:consecutiveAbsenceWarning(student)})).filter(item=>item.warning).sort((a,b)=>b.warning.count-a.warning.count||String(b.warning.latestDate).localeCompare(String(a.warning.latestDate)));}
function absenceWarningMessage(student,warning=consecutiveAbsenceWarning(student)){const count=warning?.count||2,dates=(warning?.dates||[]).slice(0,3).reverse().join('، ');return `السلام عليكم، نود تنبيه حضرتك أن الطالب ${student.name||student.studentName||''} تغيب عن ${count===2?'حصتين متتاليتين':`${count} حصص متتالية`}${dates?` بتاريخ ${dates}`:''}. برجاء متابعة سبب الغياب والتواصل مع مستر محمود إبراهيم فوزي. شكرًا لحضرتك.`;}
window.sendAbsenceWarningWhatsApp=function(code){const student=(adminData.students||[]).map(academicStudent).find(item=>String(item.studentCode)===String(code));if(!student)return aToast('الطالب غير موجود');const warning=consecutiveAbsenceWarning(student),phone=adminWhatsAppPhone(student.parentPhone);if(!warning)return aToast('لا يوجد غياب متتالٍ لهذا الطالب حاليًا');if(!phone)return aToast('رقم ولي الأمر غير مسجل');window.MFCloud?.logActivity?.('تم فتح تحذير غياب على واتساب',{studentCode:student.studentCode,absenceCount:warning.count}).catch(()=>{});window.open(whatsappLink(phone,absenceWarningMessage(student,warning)),'_blank','noopener');};
window.copyAbsenceWarningMessage=async function(code){const student=(adminData.students||[]).map(academicStudent).find(item=>String(item.studentCode)===String(code)),warning=consecutiveAbsenceWarning(student);if(!student||!warning)return aToast('لا يوجد تحذير صالح للنسخ');try{await navigator.clipboard.writeText(absenceWarningMessage(student,warning));aToast('تم نسخ رسالة التنبيه');}catch(error){aToast('تعذر النسخ التلقائي');}};
function filterAbsenceWarnings(rows,filters={}){const query=normalizeText(filters.query||''),grade=String(filters.grade||'all'),group=String(filters.group||'all'),phone=String(filters.phone||'all'),minimum=Math.max(2,Number(filters.minimum)||2);return (rows||[]).filter(({student,warning})=>{const matchesQuery=!query||normalizeText(`${student.name||student.studentName||''} ${student.studentCode||''} ${student.parentPhone||''} ${student.studentPhone||''}`).includes(query),matchesGrade=grade==='all'||sameAcademicValue(student.grade,grade),matchesGroup=group==='all'||sameAcademicValue(student.group,group),hasPhone=Boolean(adminWhatsAppPhone(student.parentPhone)),matchesPhone=phone==='all'||(phone==='with'&&hasPhone)||(phone==='without'&&!hasPhone);return matchesQuery&&matchesGrade&&matchesGroup&&matchesPhone&&Number(warning?.count||0)>=minimum;});}
function absenceWarningCard({student,warning}){const code=safe(student.studentCode),phone=adminWhatsAppPhone(student.parentPhone),displayedPhone=phone?student.parentPhone:'غير مسجل';return `<article class="card absence-warning-card"><header class="absence-warning-card-head"><div class="absence-warning-identity"><div class="absence-warning-icon"><span data-icon="alert-triangle"></span></div><div><h3>${safe(student.name)}</h3><small>كود الطالب: <b dir="ltr">${code}</b></small></div></div><span class="badge danger">${warning.count} غياب متتالي</span></header><div class="absence-warning-meta"><span><small>الصف</small><b>${safe(student.grade||'-')}</b></span><span><small>المجموعة</small><b>${safe(student.group||'-')}</b></span><span><small>عدد الغياب</small><b>${warning.count} حصص</b></span><span><small>رقم ولي الأمر</small><b dir="ltr">${safe(displayedPhone)}</b></span></div><p class="absence-warning-dates">آخر غياب: ${safe(warning.latestDate)} · الحصص: ${warning.dates.slice(0,4).reverse().map(safe).join('، ')}</p><div class="absence-warning-actions"><button class="small-btn ghost" type="button" onclick="copyAbsenceWarningMessage('${code}')">نسخ الرسالة</button>${phone?`<button class="small-btn whatsapp-report-btn" type="button" onclick="sendAbsenceWarningWhatsApp('${code}')">إرسال واتساب</button>`:'<button class="small-btn" type="button" disabled>أضف رقم ولي الأمر</button>'}</div></article>`;}
function applyAbsenceWarningFilters(){const allRows=absenceWarningRowsCache,gradeSelect=document.getElementById('warningGradeFilter'),groupSelect=document.getElementById('warningGroupFilter');if(!gradeSelect||!groupSelect)return;const grade=gradeSelect.value||'all',previousGroup=groupSelect.value||'all',groups=adminGroupCatalog(grade,allRows);groupSelect.innerHTML=`<option value="all">كل المجموعات</option>${groups.map(value=>`<option value="${safe(value)}">${safe(value)}</option>`).join('')}`;groupSelect.value=groups.some(value=>sameAcademicValue(value,previousGroup))?groups.find(value=>sameAcademicValue(value,previousGroup)):'all';const filtered=filterAbsenceWarnings(allRows,{query:document.getElementById('warningSearchFilter')?.value,grade,group:groupSelect.value,minimum:document.getElementById('warningCountFilter')?.value,phone:document.getElementById('warningPhoneFilter')?.value}),withoutPhone=filtered.filter(({student})=>!adminWhatsAppPhone(student.parentPhone)).length,totalAbsences=filtered.reduce((sum,item)=>sum+item.warning.count,0);document.getElementById('warningFilterResult').textContent=`عرض ${filtered.length} من ${allRows.length}`;document.getElementById('warningVisibleStudents').textContent=String(filtered.length);document.getElementById('warningVisibleAbsences').textContent=String(totalAbsences);document.getElementById('warningVisibleMissingPhones').textContent=String(withoutPhone);document.getElementById('absenceWarningList').innerHTML=filtered.map(absenceWarningCard).join('')||(allRows.length?'<div class="card empty-state"><h3>لا توجد نتائج مطابقة</h3><p>غيّر الفلاتر لعرض باقي التحذيرات.</p></div>':'<div class="card empty-state"><h3>لا توجد تحذيرات غياب حاليًا</h3><p>سيظهر الطالب تلقائيًا عندما تكون آخر حالتي حضور له غياب.</p></div>');hydrateIcons();}
function renderWarnings(){fresh();const rows=absenceWarnings(),grades=adminGradeCatalog(rows);absenceWarningRowsCache=rows;content(`<div class="section-head absence-warning-head"><div><span class="kicker"><span data-icon="alert-triangle"></span> تحذيرات الغياب</span><h2 class="section-title">طلاب غابوا حصتين متتاليتين أو أكثر</h2><p class="section-desc">القائمة تتحدث تلقائيًا من سجل الحضور، ورسالة واتساب جاهزة لولي الأمر.</p></div><span class="absence-warning-total" id="warningFilterResult">عرض ${rows.length} من ${rows.length}</span></div><div class="card absence-warning-filters"><label class="warning-search-field"><span>بحث عن الطالب</span><input id="warningSearchFilter" type="search" placeholder="الاسم أو الكود أو رقم الهاتف"></label><label><span>الصف</span><select id="warningGradeFilter"><option value="all">كل الصفوف</option>${grades.map(value=>`<option value="${safe(value)}">${safe(value)}</option>`).join('')}</select></label><label><span>المجموعة</span><select id="warningGroupFilter"><option value="all">كل المجموعات</option></select></label><label><span>عدد الغياب</span><select id="warningCountFilter"><option value="2">حصتان أو أكثر</option><option value="3">3 حصص أو أكثر</option><option value="4">4 حصص أو أكثر</option></select></label><label><span>رقم ولي الأمر</span><select id="warningPhoneFilter"><option value="all">الكل</option><option value="with">يوجد رقم</option><option value="without">بدون رقم</option></select></label><button class="small-btn ghost warning-filter-reset" id="warningFilterReset" type="button">مسح الفلاتر</button></div><div class="absence-warning-summary"><article class="card"><b id="warningVisibleStudents">0</b><small>طلاب في النتائج</small></article><article class="card"><b id="warningVisibleAbsences">0</b><small>إجمالي حصص الغياب</small></article><article class="card"><b id="warningVisibleMissingPhones">0</b><small>بدون رقم ولي أمر</small></article></div><div class="absence-warning-list" id="absenceWarningList"></div>`);['warningSearchFilter','warningGradeFilter','warningGroupFilter','warningCountFilter','warningPhoneFilter'].forEach(id=>document.getElementById(id)?.addEventListener(id==='warningSearchFilter'?'input':'change',applyAbsenceWarningFilters));document.getElementById('warningFilterReset')?.addEventListener('click',()=>{document.getElementById('warningSearchFilter').value='';['warningGradeFilter','warningGroupFilter','warningPhoneFilter'].forEach(id=>document.getElementById(id).value='all');document.getElementById('warningCountFilter').value='2';applyAbsenceWarningFilters();});applyAbsenceWarningFilters();}

function studentTransferRequests(){return [...(adminData.studentTransferRequests||[])].sort((a,b)=>Number(b.status==='pending')-Number(a.status==='pending')||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));}
function studentRequestStatusLabel(status){return status==='approved'?'تمت الموافقة':status==='rejected'?'مرفوض':'قيد المراجعة';}
function studentRequestStatusClass(status){return status==='approved'?'good':status==='rejected'?'danger':'warn';}
function studentRequestLinkedStudent(item){const linked=(adminData.students||[]).find(student=>String(stCode(student))===String(item.studentCode||''));return academicStudent(linked||{studentCode:item.studentCode,studentName:item.studentName,grade:item.grade,group:item.currentGroup,studentPhone:item.studentPhone,parentPhone:item.parentPhone});}
function studentRequestRecord(item){const student=studentRequestLinkedStudent(item),targetSchedule=scheduleByIdentity(item.targetScheduleId,item.targetGroup,item.grade||student.grade),currentSchedule=scheduleByIdentity(item.currentScheduleId,item.currentGroup,item.grade||student.grade);return {...item,studentName:item.studentName||student.name,studentPhone:item.studentPhone||student.studentPhone,parentPhone:item.parentPhone||student.parentPhone,grade:academicValue(item.grade||student.grade||targetSchedule?.grade||currentSchedule?.grade),currentGroup:academicValue(item.currentGroup||currentSchedule?.name||student.group),targetGroup:academicValue(item.targetGroup||targetSchedule?.name),targetScheduleDays:item.targetScheduleDays||targetSchedule?.days||'',targetScheduleStartTime:item.targetScheduleStartTime||targetSchedule?.startTime||'',targetScheduleEndTime:item.targetScheduleEndTime||targetSchedule?.endTime||''};}
function studentRequestRows(){return studentTransferRequests().map(studentRequestRecord);}
function studentRequestCard(item){const pending=item.status==='pending',requestId=safe(item.id),student=studentRequestLinkedStudent(item),studentPhone=item.studentPhone||student.studentPhone,parentPhone=item.parentPhone||student.parentPhone,search=normalizeText(`${item.studentName} ${item.studentCode} ${studentPhone} ${parentPhone} ${item.currentGroup} ${item.targetGroup} ${item.reason}`);return `<article class="card student-transfer-request-card" data-request-status="${safe(item.status||'pending')}" data-request-grade="${safe(item.grade||'')}" data-request-current-group="${safe(item.currentGroup||'')}" data-request-target-group="${safe(item.targetGroup||'')}" data-request-search="${safe(search)}"><div class="student-transfer-request-head"><div class="compact-student-identity"><span class="student-avatar">${safe(String(item.studentName||'ط').trim().charAt(0))}</span><div><b>${safe(item.studentName||'طالب')}</b><small>كود الطالب: <strong dir="ltr">${safe(item.studentCode)}</strong></small></div></div><span class="badge ${studentRequestStatusClass(item.status)}">${studentRequestStatusLabel(item.status)}</span></div><div class="student-transfer-contact-grid"><span><small>الصف</small><b>${safe(item.grade||'-')}</b></span><span><small>هاتف الطالب</small><b dir="ltr">${safe(studentPhone||'غير مسجل')}</b></span><span><small>رقم ولي الأمر</small><b dir="ltr">${safe(parentPhone||'غير مسجل')}</b></span></div><div class="student-transfer-route"><span><small>من المجموعة</small><b>${safe(item.currentGroup||'-')}</b></span><span data-icon="chevron-left"></span><span><small>إلى المجموعة</small><b>${safe(item.targetGroup||'-')}</b><em>${safe(item.targetScheduleDays||'')} ${item.targetScheduleStartTime?`· ${safe(formatTime12(item.targetScheduleStartTime))}`:''}</em></span></div><div class="student-transfer-reason"><small>سبب الطلب</small><p>${safe(item.reason||'لم يكتب سببًا')}</p>${item.teacherNote?`<small>ملاحظة المدرس: ${safe(item.teacherNote)}</small>`:''}</div>${pending?`<div class="student-transfer-actions"><button class="small-btn primary" type="button" onclick="reviewStudentTransferRequestAdmin('${requestId}','approve')">موافقة ونقل الطالب</button><button class="small-btn danger" type="button" onclick="reviewStudentTransferRequestAdmin('${requestId}','reject')">رفض الطلب</button></div>`:''}</article>`;}
function applyStudentRequestFilters(){const query=normalizeText(document.getElementById('studentRequestSearch')?.value||''),status=document.getElementById('studentRequestStatus')?.value||'all',grade=document.getElementById('studentRequestGrade')?.value||'all',group=document.getElementById('studentRequestGroup')?.value||'all';let visible=0;document.querySelectorAll('#studentTransferRequestList [data-request-status]').forEach(card=>{const matchesGroup=group==='all'||sameAcademicValue(card.dataset.requestCurrentGroup,group)||sameAcademicValue(card.dataset.requestTargetGroup,group),show=(!query||String(card.dataset.requestSearch||'').includes(query))&&(status==='all'||card.dataset.requestStatus===status)&&(grade==='all'||sameAcademicValue(card.dataset.requestGrade,grade))&&matchesGroup;card.hidden=!show;if(show)visible+=1;});document.getElementById('studentRequestFilterCount').textContent=`${visible} طلب`;}
function syncStudentRequestGroupFilter(){const rows=studentRequestRows(),grade=document.getElementById('studentRequestGrade')?.value||'all',select=document.getElementById('studentRequestGroup');if(!select)return;const previous=select.value||'all',groups=adminGroupCatalog(grade,rows);select.innerHTML=`<option value="all">كل المجموعات</option>${groups.map(group=>`<option value="${safe(group)}">${safe(group)}</option>`).join('')}`;select.value=groups.some(value=>sameAcademicValue(value,previous))?groups.find(value=>sameAcademicValue(value,previous)):'all';applyStudentRequestFilters();}
function renderStudentRequests(){fresh();const rows=studentRequestRows(),pending=rows.filter(item=>item.status==='pending').length,approved=rows.filter(item=>item.status==='approved').length,rejected=rows.filter(item=>item.status==='rejected').length,grades=adminGradeCatalog(rows),groups=adminGroupCatalog('all',rows);content(`<div class="section-head student-request-headline"><div><span class="kicker"><span data-icon="user-check"></span> طلبات الطلاب</span><h2 class="section-title">طلبات نقل المجموعات</h2><p class="section-desc">الموافقة تنقل الطالب وتحدّث مجموعته وميعاده في بوابته وبوابة ولي الأمر.</p></div><span class="absence-warning-total">${pending} قيد المراجعة</span></div><div class="student-request-summary"><article class="card"><b>${pending}</b><small>قيد المراجعة</small></article><article class="card"><b>${approved}</b><small>تمت الموافقة</small></article><article class="card"><b>${rejected}</b><small>طلبات مرفوضة</small></article></div><div class="card student-request-filters"><label class="student-request-search-field"><span>بحث عن الطالب</span><input id="studentRequestSearch" type="search" placeholder="الاسم أو الكود أو رقم الهاتف"></label><label><span>الصف</span><select id="studentRequestGrade"><option value="all">كل الصفوف</option>${grades.map(grade=>`<option value="${safe(grade)}">${safe(grade)}</option>`).join('')}</select></label><label><span>المجموعة الحالية أو المطلوبة</span><select id="studentRequestGroup"><option value="all">كل المجموعات</option>${groups.map(group=>`<option value="${safe(group)}">${safe(group)}</option>`).join('')}</select></label><label><span>حالة الطلب</span><select id="studentRequestStatus"><option value="all">كل الحالات</option><option value="pending">قيد المراجعة</option><option value="approved">تمت الموافقة</option><option value="rejected">مرفوض</option></select></label><button class="small-btn ghost student-request-reset" id="studentRequestReset" type="button">مسح الفلاتر</button><span id="studentRequestFilterCount">${rows.length} طلب</span></div><div class="student-transfer-request-list" id="studentTransferRequestList">${rows.map(studentRequestCard).join('')||'<div class="card empty-state"><h3>لا توجد طلبات نقل</h3><p>ستظهر هنا الطلبات التي يرسلها الطلاب.</p></div>'}</div>`);document.getElementById('studentRequestSearch')?.addEventListener('input',applyStudentRequestFilters);document.getElementById('studentRequestStatus')?.addEventListener('change',applyStudentRequestFilters);document.getElementById('studentRequestGroup')?.addEventListener('change',applyStudentRequestFilters);document.getElementById('studentRequestGrade')?.addEventListener('change',syncStudentRequestGroupFilter);document.getElementById('studentRequestReset')?.addEventListener('click',()=>{document.getElementById('studentRequestSearch').value='';['studentRequestGrade','studentRequestGroup','studentRequestStatus'].forEach(id=>document.getElementById(id).value='all');syncStudentRequestGroupFilter();});hydrateIcons();}
window.reviewStudentTransferRequestAdmin=async function(requestId,action){const item=(adminData.studentTransferRequests||[]).find(row=>String(row.id)===String(requestId));if(!item)return aToast('طلب النقل غير موجود');const approve=action==='approve';if(!confirm(approve?`نقل ${item.studentName||'الطالب'} من ${item.currentGroup||'-'} إلى ${item.targetGroup||'-'}؟`:`رفض طلب نقل ${item.studentName||'الطالب'}؟`))return;const teacherNote=prompt('ملاحظة للطالب — اختيارية',item.teacherNote||'');if(teacherNote===null)return;try{if(!window.MFCloud?.reviewStudentTransferRequest)throw new Error('Student transfer review service unavailable');const result=await window.MFCloud.reviewStudentTransferRequest({requestId,action:approve?'approve':'reject',teacherNote});Object.assign(item,result,{status:approve?'approved':'rejected',teacherNote});if(approve){const student=(adminData.students||[]).find(row=>String(stCode(row))===String(item.studentCode)),schedule=(adminData.groups||[]).find(row=>String(row.id)===String(item.targetScheduleId));if(student&&schedule)Object.assign(student,{group:schedule.name,scheduleId:schedule.id,scheduleDays:schedule.days||'',scheduleStartTime:schedule.startTime||'',scheduleEndTime:schedule.endTime||'',schedulePending:false});}saveData(adminData);aToast(approve?'تمت الموافقة ونقل الطالب للمجموعة الجديدة':'تم رفض طلب النقل');renderStudentRequests();}catch(error){aToast(adminActionErrorMessage(error,approve?'تعذر نقل الطالب.':'تعذر رفض الطلب.'));}};

function renderPayments(){fresh(); content(`<div class="section-head"><div><span class="kicker"><span data-icon="database"></span> اشتراك السنتر</span><h2 class="section-title">حالة الاشتراك داخل السنتر</h2></div></div><div class="grid">${GRADES.map(g=>{const rows=adminData.students.map(academicStudent).filter(s=>sameAcademicValue(s.grade,g)); return `<div class="card"><h3>${safe(g)}</h3>${rows.map(s=>`<div class="mobile-row"><b>${safe(s.name)}</b><span class="badge ${badgeStatus(s.paid)}">${s.paid?'تم الدفع في السنتر':'لم يتم الدفع في السنتر'}</span><small>${safe(s.studentCode)} · ${safe(s.month||'-')}</small><div class="mobile-actions"><button class="small-btn primary" onclick="setPaid('${safe(s.studentCode)}',true)">تم الدفع في السنتر</button><button class="small-btn danger" onclick="setPaid('${safe(s.studentCode)}',false)">لم يتم الدفع</button></div></div>`).join('')||'<p class="section-desc">لا يوجد طلاب.</p>'}</div>`;}).join('')}</div>`);}
window.setPaid=function(code,val){const s=adminData.students.find(x=>stCode(x)===code); if(!s)return; s.paid=val; s.paymentDate=val?isoDateAdmin():''; persist(val?'تم تسجيل الدفع في السنتر':'تم تسجيل عدم الدفع في السنتر'); renderPayments();};

function assignmentQuestions(item){return Array.isArray(item?.questions)?item.questions.filter(Boolean):String(item?.questionsText||'').split(/\n+/).map(value=>value.trim()).filter(Boolean);}
function assignmentRow(item){const questions=assignmentQuestions(item),state=assignmentPublishStateAdmin(item);return `<article class="card assignment-admin-row"><div><span class="badge ${state.className}">${state.label}</span><h3>${safe(item.title||'واجب')}</h3><small>${safe(item.grade||'كل الصفوف')} · ${safe(item.group||'كل المجموعات')} · ${safe(item.term||'كل الترمات')} · ${questions.length} سؤال</small><small class="assignment-publish-note">${safe(assignmentPublishLabelAdmin(item))}${item.dueDate?` · آخر تسليم ${safe(item.dueDate)}`:''}</small></div><div class="mobile-actions">${item.fileUrl?`<a class="small-btn" href="${safe(item.fileUrl)}" target="_blank" rel="noopener">فتح الملف</a>`:''}<button class="small-btn danger" onclick="deleteItem('assignments','${safe(item.id)}')">حذف</button></div></article>`;}
function renderAssignments(){fresh();content(`<div class="section-head"><div><span class="kicker"><span data-icon="file-text"></span> الواجبات</span><h2 class="section-title">جدولة واجبات السنة</h2><p class="section-desc">أنشئ الواجب الآن وحدد تاريخ ووقت ظهوره؛ لن يراه الطالب قبل الموعد المحدد.</p></div></div><form id="assignmentForm" class="card admin-form-grid assignment-schedule-form"><div class="field"><label>عنوان الواجب</label><input name="title" required></div><div class="field"><label>الصف</label><select name="grade"><option>كل الصفوف</option>${GRADES.map(g=>`<option>${safe(g)}</option>`).join('')}</select></div><div class="field"><label>العام الدراسي</label><input name="academicYear" value="${safe(adminData.settings?.academicYear||'')}"></div><div class="field"><label>الترم</label><select name="term"><option>كل الترمات</option><option>الترم الأول</option><option>الترم الثاني</option></select></div><div class="field"><label>المجموعة</label><select name="group"><option>كل المجموعات</option>${groupOptions().map(g=>`<option>${safe(g)}</option>`).join('')}</select></div><div class="field"><label>موعد ظهور الواجب</label><input name="publishAt" type="datetime-local"><small class="assignment-schedule-help">اتركه فارغًا ليظهر فور الحفظ.</small></div><div class="field"><label>آخر موعد للتسليم</label><input name="dueDate" type="date"></div><div class="field full-span"><label>تعليمات الواجب</label><textarea name="notes" placeholder="اكتب المطلوب من الطالب"></textarea></div><div class="field full-span"><label>الأسئلة — سؤال في كل سطر</label><textarea name="questionsText" rows="6" placeholder="السؤال الأول&#10;السؤال الثاني"></textarea></div><label class="exam-pdf-upload full-span"><span><b>PDF أو صورة من الموبايل</b><small>اختياري، بحد أقصى 15MB.</small></span><input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"></label><label class="option-card full-span"><input name="active" type="checkbox" checked> تفعيل الواجب (سيظهر في الموعد المحدد)</label><button class="btn primary full-span" type="submit">حفظ الواجب</button></form><div class="admin-clean-list assignment-schedule-list">${(adminData.assignments||[]).slice().sort((a,b)=>assignmentPublishMillisAdmin(a.publishAt)-assignmentPublishMillisAdmin(b.publishAt)).map(assignmentRow).join('')||'<div class="card empty-state"><h3>لا توجد واجبات بعد</h3></div>'}</div>`);document.getElementById('assignmentForm').onsubmit=saveAssignment;}
async function saveAssignment(event){event.preventDefault();const form=event.currentTarget,values=Object.fromEntries(new FormData(form).entries()),file=form.file.files[0],button=form.querySelector('[type=submit]');delete values.file;values.questions=String(values.questionsText||'').split(/\n+/).map(value=>value.trim()).filter(Boolean);delete values.questionsText;if(!values.questions.length&&!file)return aToast('أضف سؤالًا واحدًا على الأقل أو ارفع ملفًا');if(file&&file.size>15*1024*1024)return aToast('حجم الملف أكبر من 15MB');values.id=`as-${Date.now()}`;values.active=form.active.checked;values.publishAt=values.publishAt?new Date(values.publishAt).toISOString():new Date().toISOString();if(values.dueDate&&values.publishAt&&values.dueDate<values.publishAt.slice(0,10))return aToast('آخر موعد للتسليم يجب أن يكون بعد موعد ظهور الواجب');values.createdAt=new Date().toISOString();button.disabled=true;try{if(file){const uploaded=await window.MFCloud.uploadAttachment(file,'teacher-uploads');values.fileUrl=uploaded.url;values.fileName=file.name;values.fileType=file.type;}adminData.assignments.push(values);await saveAdminDataNow();aToast(assignmentPublishMillisAdmin(values.publishAt)>Date.now()?'تم حفظ وجدولة الواجب':'تم حفظ ونشر الواجب');renderAssignments();}catch(error){adminData.assignments=adminData.assignments.filter(item=>item.id!==values.id);aToast(adminActionErrorMessage(error,'تعذر حفظ الواجب.'));}finally{button.disabled=false;}}

function renderMaterials(){fresh(); content(`<div class="section-head"><div><span class="kicker"><span data-icon="book-open"></span> المحتوى</span><h2 class="section-title">المراجعات وبنك الأسئلة</h2></div></div><div class="grid grid-2"><form id="materialForm" class="card grid"><h3>إضافة مراجعة / ملف</h3><input name="title" placeholder="العنوان" required><select name="grade"><option>كل الصفوف</option>${GRADES.map(g=>`<option>${safe(g)}</option>`).join('')}</select><textarea name="desc" placeholder="وصف مختصر"></textarea><input type="file" name="file" accept="image/*,application/pdf"><button class="btn primary"><span data-icon="upload"></span> إضافة</button></form><form id="questionForm" class="card grid"><h3>إضافة سؤال</h3><input name="title" placeholder="عنوان السؤال" required><select name="grade"><option>كل الصفوف</option>${GRADES.map(g=>`<option>${safe(g)}</option>`).join('')}</select><textarea name="content" placeholder="نص السؤال"></textarea><textarea name="answer" placeholder="الإجابة النموذجية"></textarea><button class="btn primary"><span data-icon="help-circle"></span> إضافة سؤال</button></form></div><div class="grid grid-2" style="margin-top:18px"><div class="card"><h3>المراجعات</h3>${adminData.materials.map(m=>`<div class="mobile-row"><b>${safe(m.title)}</b><small>${safe(m.grade||'')}</small><button class="small-btn danger" onclick="deleteItem('materials','${safe(m.id)}')">حذف</button></div>`).join('')||'<p class="section-desc">لا توجد مراجعات.</p>'}</div><div class="card"><h3>الأسئلة</h3>${adminData.questions.map(q=>`<div class="mobile-row"><b>${safe(q.title)}</b><small>${safe(q.grade||'')}</small><button class="small-btn danger" onclick="deleteItem('questions','${safe(q.id)}')">حذف</button></div>`).join('')||'<p class="section-desc">لا توجد أسئلة.</p>'}</div></div>`); document.getElementById('materialForm').onsubmit=async e=>{e.preventDefault();const form=e.target,button=form.querySelector('[type="submit"]'),f=form.file.files[0],m=Object.fromEntries(new FormData(form).entries());m.id='mat-'+Date.now();button.disabled=true;button.classList.add('is-loading');try{if(f){if(!window.MFCloud?.uploadAttachment)throw new Error('Upload service unavailable');const up=await window.MFCloud.uploadAttachment(f,'teacher-uploads');m.fileUrl=up.url;m.fileName=up.fileName;}adminData.materials.push(m);await saveAdminDataNow();aToast('تم إضافة المراجعة');renderMaterials();}catch(error){adminData.materials=adminData.materials.filter(item=>item.id!==m.id);aToast(adminActionErrorMessage(error,'تعذر رفع وحفظ المراجعة.'));}finally{button.disabled=false;button.classList.remove('is-loading');}}; document.getElementById('questionForm').onsubmit=async e=>{e.preventDefault();const form=e.target,button=form.querySelector('[type="submit"]'),q=Object.fromEntries(new FormData(form).entries());q.id='q-'+Date.now();button.disabled=true;try{adminData.questions.push(q);await saveAdminDataNow();aToast('تم إضافة السؤال');renderMaterials();}catch(error){adminData.questions=adminData.questions.filter(item=>item.id!==q.id);aToast(adminActionErrorMessage(error,'تعذر حفظ السؤال.'));}finally{button.disabled=false;}};}
window.deleteItem=async function(collection,id){if(!confirm('حذف العنصر؟'))return;const before=(adminData[collection]||[]).slice();try{await cloudDelete(collection,id);adminData[collection]=before.filter(item=>String(item.id)!==String(id));saveData(adminData);aToast('تم الحذف');deferAdminRender(renderSection);}catch(error){adminData[collection]=before;aToast(adminActionErrorMessage(error,'تعذر حذف العنصر، ولم يتم حذفه من القائمة.'));}};


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
window.correctAttempt=function(id){const a=adminData.examAttempts.find(x=>String(x.id)===String(id)); if(!a)return; document.querySelector('.correction-modal-v40')?.remove(); const answers=Array.isArray(a.answers)?a.answers:[]; const checkedDefault=x=>x.correct===true?'checked':''; const html=`<div class="correction-modal-v40"><div class="correction-card-v40 card"><div class="profile-top"><div><span class="kicker">تصحيح امتحان</span><h2>${safe(a.studentName||'-')}</h2><p class="section-desc">${safe(a.examTitle||'امتحان')} · ${safe(a.studentCode||'-')}</p></div><button class="small-btn danger" onclick="closeCorrectionModal()">إغلاق</button></div><div class="correction-list-v40">${answers.map((ans,i)=>`<div class="correction-question-v40"><h3>${i+1}. ${safe(ans.question||'سؤال')}</h3><div class="correction-answer-grid-v40"><div><span>إجابة الطالب</span><p>${safe(ans.answer||'-')}</p></div><div><span>الإجابة الصحيحة / النموذجية</span><p>${safe(ans.correctAnswer||ans.modelAnswer||'يصَححها المدرس')}</p></div></div><label class="correction-toggle-v40"><input type="checkbox" data-correct-index="${i}" ${checkedDefault(ans)} onchange="recalculateCorrectionScore()"> الإجابة صحيحة</label></div>`).join('')||'<p class="section-desc">لا توجد إجابات محفوظة.</p>'}</div><div class="correction-final-v40"><button class="small-btn" type="button" onclick="recalculateCorrectionScore()">حساب الدرجة من الصح والغلط</button><label>الدرجة النهائية من 100<input id="manualFinalScore" type="number" min="0" max="100" value="${safe(a.score??a.autoScore??0)}"></label><button class="btn primary" onclick="saveAttemptCorrection('${safe(a.id)}')">حفظ التصحيح والنتيجة</button></div></div></div>`; document.body.insertAdjacentHTML('beforeend',html); recalculateCorrectionScore();};
window.closeCorrectionModal=function(){document.querySelector('.correction-modal-v40')?.remove();};
window.recalculateCorrectionScore=function(){const checks=[...document.querySelectorAll('.correction-modal-v40 [data-correct-index]')]; if(!checks.length)return; const correct=checks.filter(c=>c.checked).length; const score=Math.round(correct/checks.length*100); const input=document.getElementById('manualFinalScore'); if(input && !input.dataset.touched){input.value=score;} if(input){input.oninput=()=>{input.dataset.touched='1';};}};
window.saveAttemptCorrection=async function(id){const attempt=adminData.examAttempts.find(item=>String(item.id)===String(id));if(!attempt)return;const before=JSON.parse(JSON.stringify(attempt)),checks=[...document.querySelectorAll('.correction-modal-v40 [data-correct-index]')];let correct=0;checks.forEach(check=>{const index=Number(check.dataset.correctIndex),ok=!!check.checked;if(attempt.answers&&attempt.answers[index]){attempt.answers[index].correct=ok;attempt.answers[index].teacherReviewed=true;}if(ok)correct++;});const score=Number(document.getElementById('manualFinalScore')?.value);if(Number.isNaN(score)||score<0||score>100){Object.assign(attempt,before);return aToast('اكتب درجة صحيحة من 0 إلى 100');}attempt.score=score;attempt.maxScore=100;attempt.correctCount=correct;attempt.questionCount=checks.length||attempt.questionCount||0;attempt.needsManualReview=false;attempt.status='corrected';attempt.teacherCorrectedAt=new Date().toISOString();try{if(!window.MFCloud?.saveExamAttempt)throw new Error('Exam correction service unavailable');await window.MFCloud.saveExamAttempt(attempt);saveData(adminData);aToast('تم حفظ التصحيح والنتيجة');closeCorrectionModal();renderExams();}catch(error){Object.keys(attempt).forEach(key=>delete attempt[key]);Object.assign(attempt,before);saveData(adminData);aToast(adminActionErrorMessage(error,'تعذر حفظ التصحيح.'));}};

function renderReviewsAdmin(){fresh(); content(`<div class="section-head"><div><span class="kicker"><span data-icon="star"></span> التقييمات</span><h2 class="section-title">مراجعة تقييمات الطلاب</h2></div></div><div class="grid grid-2">${adminData.reviews.map(r=>`<div class="card"><div class="review-stars">${'★'.repeat(Number(r.rating||5))}</div><h3>${safe(r.name)}</h3><p>${safe(r.text||'')}</p><span class="badge ${r.approved!==false?'good':'warn'}">${r.approved!==false?'منشور':'بانتظار الموافقة'}</span><div class="mobile-actions"><button class="small-btn primary" onclick="approveReview('${safe(r.id)}')">نشر</button><button class="small-btn danger" onclick="deleteItem('reviews','${safe(r.id)}')">حذف</button></div></div>`).join('')||'<p class="section-desc">لا توجد تقييمات.</p>'}</div>`);}
window.approveReview=function(id){const r=adminData.reviews.find(x=>x.id===id); if(!r)return; r.approved=true; persist('تم نشر التقييم'); renderReviewsAdmin();};


function backupPayload(){fresh();return {schemaVersion:2,exportedAt:new Date().toISOString(),project:'mahmoud-fawzy-science-platform',data:adminData};}
function downloadJson(filename,payload){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
window.exportFullBackup=function(){const stamp=new Date().toISOString().replace(/[:.]/g,'-');downloadJson(`mf-platform-backup-${stamp}.json`,backupPayload());aToast('تم تنزيل النسخة الاحتياطية');};
function validateBackupData(value){const data=value?.data||value;if(!data||typeof data!=='object')throw new Error('ملف غير صالح');for(const key of ['students','bookings','materials','questions','exams','examAttempts','reviews','groups','assignments'])if(data[key]!==undefined&&!Array.isArray(data[key]))throw new Error(`القسم ${key} غير صالح`);return mergeData(data);}
window.importFullBackup=async function(input){const file=input?.files?.[0];if(!file)return;const before=adminData;try{const parsed=JSON.parse(await file.text()),restored=validateBackupData(parsed);if(!confirm(`استعادة نسخة تحتوي على ${restored.students.length} طالب و${restored.exams.length} امتحان؟ سيتم استبدال البيانات الحالية.`))return;downloadJson(`mf-platform-before-restore-${Date.now()}.json`,backupPayload());if(!window.MFCloud?.saveSiteData)throw new Error('Restore service unavailable');await window.MFCloud.saveSiteData(restored,{full:true});adminData=restored;saveData(adminData);aToast('تمت استعادة النسخة الاحتياطية');renderBackup();}catch(error){adminData=before;saveData(adminData);aToast(adminActionErrorMessage(error,'تعذر استعادة النسخة؛ لم تتغير البيانات الحالية.'));}finally{if(input)input.value='';}};
window.refreshActivityLog=async function(){renderBackup(true);};
async function renderBackup(loading=false){
  fresh();
  content(`<div class="section-head"><div><span class="kicker"><span data-icon="database"></span> النسخ الاحتياطي</span><h2 class="section-title">حماية بيانات المنصة</h2><p class="section-desc">نزّل نسخة كاملة قبل أي تعديل كبير أو ترقية للأكواد.</p></div></div><div class="grid grid-2"><div class="card backup-action-card"><h3>تصدير نسخة كاملة</h3><p>تشمل الطلاب والحجوزات والحضور والدرجات والامتحانات والمحتوى والإعدادات.</p><button class="btn primary" onclick="exportFullBackup()"><span data-icon="database"></span> تنزيل النسخة الاحتياطية</button></div><div class="card backup-action-card"><h3>استعادة نسخة</h3><p>سيتم تنزيل نسخة تلقائية من الوضع الحالي قبل الاستعادة.</p><label class="btn ghost file-button">اختيار ملف النسخة<input type="file" accept="application/json,.json" onchange="importFullBackup(this)" hidden></label></div></div><div class="card" style="margin-top:18px"><div class="section-head mini"><div><h3>سجل العمليات</h3><p class="section-desc">آخر التعديلات التي نفذها فريق الإدارة.</p></div><button class="small-btn" onclick="refreshActivityLog()">تحديث</button></div><div id="activityLogBox">${loading?'<div class="skeleton" style="height:140px"></div>':'جاري التحميل...'}</div></div>`);
  try{const rows=await window.MFCloud?.getActivityLog?.(50)||[];const box=document.getElementById('activityLogBox');if(box)box.innerHTML=rows.length?rows.map(row=>`<div class="mobile-row"><b>${safe(row.action||'عملية')}</b><small>${safe(row.actorEmail||row.actorRole||'')} · ${safe(row.createdAt?.toDate?row.createdAt.toDate().toLocaleString('ar-EG'):'')}</small></div>`).join(''):'<p class="section-desc">لا توجد عمليات مسجلة بعد.</p>';}catch(e){const box=document.getElementById('activityLogBox');if(box)box.innerHTML='<p class="section-desc">تعذر تحميل السجل.</p>';}
}

function renderSettings(){fresh(); content(`<div class="section-head"><div><span class="kicker"><span data-icon="sparkles"></span> الإعدادات</span><h2 class="section-title">إعدادات الموقع والرابط</h2></div></div><div class="card"><form id="settingsForm" class="grid"><input name="siteUrl" value="${safe(adminData.settings.siteUrl||DEFAULT_SITE_URL||'')}" placeholder="رابط الموقع الأساسي"><input name="teacherPhone" value="${safe(adminData.settings.teacherPhone||TEACHER_WHATSAPP||'')}" placeholder="رقم واتساب المدرس"><textarea name="homeNotice" placeholder="رسالة تنبيه للطلاب">${safe(adminData.settings.homeNotice||'')}</textarea><button class="btn primary"><span data-icon="sparkles"></span> حفظ الإعدادات</button></form></div><div class="grid grid-2" style="margin-top:18px"><div class="seo-card"><h3>الظهور في البحث</h3><p>صفحة المدرس خاصة ولا تظهر في نتائج البحث أو داخل الموقع العام.</p></div><div class="seo-card"><h3>حماية المنصة</h3><p>صلاحيات الدخول والحفظ مفعّلة لحماية بيانات الطلاب وفريق العمل.</p></div></div>`); document.getElementById('settingsForm').onsubmit=e=>{e.preventDefault(); adminData.settings={...adminData.settings,...Object.fromEntries(new FormData(e.target).entries())}; persist('تم حفظ الإعدادات');};}

function renderAttendance(){fresh();const gOpts=['all',...GRADES],grpOpts=['all',...groupOptions()];content(`<div class="section-head compact-admin-head"><div><span class="kicker"><span data-icon="qr"></span> متابعة الحصة</span><h2 class="section-title">الحضور والتسميع والواجب</h2><p class="section-desc">سجّل حضور الطالب، ثم علّم على التسميع والواجب؛ كل علامة تُضاف لملفه وتدخل في ترتيب الانتظام.</p></div></div><div class="card attendance-control-card"><div class="attendance-filters"><select id="attendanceGrade">${gOpts.map(g=>`<option value="${safe(g)}">${g==='all'?'كل الصفوف':safe(g)}</option>`).join('')}</select><select id="attendanceGroup">${grpOpts.map(g=>`<option value="${safe(g)}">${g==='all'?'كل المجموعات':safe(g)}</option>`).join('')}</select><input id="attendanceDate" type="date" value="${attendanceDate}"></div><div class="attendance-actions"><button class="btn primary qr-open-btn" onclick="openQrScanner()"><span data-icon="qr"></span> مسح QR</button><button class="btn ghost" onclick="manualAttendancePrompt()"><span data-icon="user-check"></span> إدخال الكود</button><button class="btn ghost" onclick="markAbsentForMissing()"><span data-icon="calendar"></span> الباقي غياب</button></div></div><div class="attendance-summary-card card">${attendanceReportHTML()}</div><div class="card attendance-roster-card"><div class="profile-top"><div><h3>طلاب المجموعة</h3><p class="section-desc">الأزرار المعلّمة بعلامة ✓ محفوظة في ملف الطالب لنفس تاريخ الحصة.</p></div></div>${attendanceRosterHTML()}</div><details class="card attendance-history"><summary>عرض سجل اليوم بالتفصيل</summary>${attendanceLogHTML()}</details><div id="qrScannerModal" class="qr-modal" hidden><div class="card qr-modal-card"><div class="profile-top"><h3>ماسح QR الطالب</h3><button class="small-btn danger" onclick="closeQrScanner()">إغلاق</button></div><div id="adminQrReader"></div><p class="section-desc">وجّه كاميرا الموبايل على QR الطالب لتسجيل الحضور.</p></div></div>`);const gd=document.getElementById('attendanceGrade'),gr=document.getElementById('attendanceGroup'),date=document.getElementById('attendanceDate');if(gd)gd.value=sessionStorage.getItem('attGrade')||'all';if(gr)gr.value=sessionStorage.getItem('attGroup')||'all';if(date)date.onchange=()=>{attendanceDate=date.value;renderAttendance();};if(gd)gd.onchange=()=>{sessionStorage.setItem('attGrade',gd.value);renderAttendance();};if(gr)gr.onchange=()=>{sessionStorage.setItem('attGroup',gr.value);renderAttendance();};hydrateIcons();}
function examBuilderCard(index){return `<article class="exam-builder-question" data-exam-question><div class="exam-question-head"><b>السؤال <span data-question-number>${index+1}</span></b><div class="exam-question-head-actions"><select data-question-type onchange="toggleExamQuestionType(this)" aria-label="نوع السؤال"><option value="mcq">اختيار من متعدد</option><option value="truefalse">صح أو غلط</option><option value="essay">سؤال مقالي</option></select><button class="small-btn danger" type="button" onclick="removeExamQuestion(this)">حذف</button></div></div><div class="field"><label>نص السؤال</label><textarea data-question-text rows="2" required placeholder="اكتب السؤال هنا"></textarea></div><div data-mcq-fields><div class="exam-options-grid">${['أ','ب','ج','د'].map((label,i)=>`<label><span>${label}</span><input data-question-option="${i}" required placeholder="الإجابة ${label}"></label>`).join('')}</div><div class="field correct-answer-field"><label>الإجابة الصحيحة للتصحيح التلقائي</label><select data-correct-answer required><option value="">اختار الإجابة الصحيحة</option>${['أ','ب','ج','د'].map(label=>`<option value="${label}">${label}</option>`).join('')}</select></div></div><div class="field" data-truefalse-fields hidden><label>الإجابة الصحيحة</label><select data-truefalse-answer><option value="أ">صح</option><option value="ب">غلط</option></select></div><p class="exam-essay-note" data-essay-note hidden>سيكتب الطالب إجابته، وتظهر المحاولة في قائمة التصحيح اليدوي.</p></article>`;}
function renumberExamQuestions(root=document){root.querySelectorAll('[data-exam-question]').forEach((card,index)=>{const number=card.querySelector('[data-question-number]');if(number)number.textContent=index+1;});}
window.addExamQuestion=function(listId='examQuestionsBuilder'){const list=document.getElementById(listId);if(!list)return;list.insertAdjacentHTML('beforeend',examBuilderCard(list.children.length));renumberExamQuestions(list);list.lastElementChild?.scrollIntoView({behavior:'smooth',block:'center'});};
window.removeExamQuestion=function(button){const list=button.closest('.exam-questions-builder');if(!list)return;if(list.children.length===1)return aToast('لازم المحتوى يحتوي على سؤال واحد على الأقل');button.closest('[data-exam-question]')?.remove();renumberExamQuestions(list);};
window.toggleExamQuestionType=function(select){const card=select.closest('[data-exam-question]'),type=select.value,isEssay=type==='essay',isTrueFalse=type==='truefalse',mcq=card?.querySelector('[data-mcq-fields]'),tf=card?.querySelector('[data-truefalse-fields]'),note=card?.querySelector('[data-essay-note]');if(mcq)mcq.hidden=isEssay||isTrueFalse;if(tf)tf.hidden=!isTrueFalse;if(note)note.hidden=!isEssay;card?.querySelectorAll('[data-question-option],[data-correct-answer]').forEach(input=>{input.required=type==='mcq';});};
function serializeExamQuestions(root=document){const cards=[...root.querySelectorAll('[data-exam-question]')];return cards.map(card=>{const question=card.querySelector('[data-question-text]')?.value.trim(),type=card.querySelector('[data-question-type]')?.value||'mcq';if(!question)return null;if(type==='essay')return question;if(type==='truefalse'){const answer=card.querySelector('[data-truefalse-answer]')?.value||'أ';return `${question}\nأ) صح\nب) غلط\nالإجابة: ${answer}`;}const options=[...card.querySelectorAll('[data-question-option]')].map(input=>input.value.trim()),answer=card.querySelector('[data-correct-answer]')?.value;if(options.some(value=>!value)||!answer)return null;return `${question}\nأ) ${options[0]}\nب) ${options[1]}\nج) ${options[2]}\nد) ${options[3]}\nالإجابة: ${answer}`;}).filter(Boolean).join('\n\n');}
function renderExams(){fresh();const attempts=(adminData.examAttempts||[]).slice().reverse(),pending=attempts.filter(a=>a.needsManualReview||a.status==='pending_manual'),gradeRows=examGradeRows();window.__adminExamGradeRows=gradeRows;content(`<div class="section-head compact-admin-head"><div><span class="kicker"><span data-icon="clipboard"></span> الامتحانات</span><h2 class="section-title">إنشاء امتحان متطور</h2><p class="section-desc">أنشئ أسئلة اختيار من متعدد تُصحح تلقائيًا، وأسئلة مقالية تُراجع يدويًا، مع PDF ومواعيد إتاحة.</p></div></div><div class="exam-admin-layout"><form id="examForm" class="card exam-builder-form"><div class="exam-meta-grid"><div class="field"><label>اسم الامتحان</label><input name="title" required placeholder="مثال: امتحان الوحدة الأولى"></div><div class="field"><label>الصف</label><select name="grade"><option>كل الصفوف</option>${GRADES.map(g=>`<option>${safe(g)}</option>`).join('')}</select></div><div class="field"><label>المدة بالدقائق</label><input name="duration" type="number" min="1" value="20"></div></div><div class="field"><label>تعليمات للطلاب</label><textarea name="instructions" rows="2" placeholder="تعليمات اختيارية"></textarea></div><label class="exam-pdf-upload"><span><b>ملف PDF اختياري</b><small>يمكن إرفاق ملف مع الأسئلة بحجم أقصى 15MB.</small></span><input name="pdfFile" type="file" accept="application/pdf,.pdf"></label><textarea name="text" hidden></textarea><div class="exam-builder-title"><div><h3>الأسئلة</h3><small>اختار نوع كل سؤال: تلقائي أو مقالي.</small></div><button class="btn ghost" type="button" onclick="addExamQuestion()">+ إضافة سؤال</button></div><div id="examQuestionsBuilder" class="exam-questions-builder">${examBuilderCard(0)}</div><label class="option-card"><input type="checkbox" name="allowRetake" value="true"> السماح للطالب بإعادة الامتحان</label><button class="btn primary full-width" type="submit"><span data-icon="clipboard"></span> حفظ ونشر الامتحان</button></form><aside class="card compact-exam-list"><h3>الامتحانات الحالية</h3>${adminData.exams.map(e=>`<div class="mobile-row"><div><b>${safe(e.title)}</b><small>${safe(e.grade)} · ${safe(e.duration)} دقيقة · ${safe(e.questionCount||0)} سؤال</small></div>${e.pdfUrl?`<a class="small-btn" href="${safe(e.pdfUrl)}" target="_blank">PDF</a>`:''}<button class="small-btn danger" onclick="deleteItem('exams','${safe(e.id)}')">حذف</button></div>`).join('')||'<p class="section-desc">لا توجد امتحانات بعد.</p>'}</aside></div><details class="card admin-collapsible" ${pending.length?'open':''}><summary>محاولات تحتاج تصحيح <span class="badge warn">${pending.length}</span></summary>${pending.map(examAttemptRowHTML).join('')||'<p class="section-desc">لا توجد محاولات معلقة.</p>'}</details><details class="card admin-collapsible"><summary>كل المحاولات والنتائج <span class="badge">${attempts.length}</span></summary>${attempts.map(examAttemptRowHTML).join('')||'<p class="section-desc">لا توجد محاولات.</p>'}</details><details class="card admin-collapsible"><summary>درجات الطلاب وإرسال واتساب</summary>${gradeRows.map(examGradeRowHTML).join('')||'<p class="section-desc">لا توجد درجات بعد.</p>'}</details>`);const form=document.getElementById('examForm');form.addEventListener('submit',event=>{const text=serializeExamQuestions(),count=document.querySelectorAll('[data-exam-question]').length;if(!text||text.split('\n\n').length!==count){event.preventDefault();event.stopImmediatePropagation();return aToast('كمّل نص كل سؤال، وللسؤال الاختياري أكمل الاختيارات وحدد الإجابة الصحيحة');}form.elements.text.value=text;},true);hydrateIcons();}
function bindAdminGradeGroupPicker(){
  const form=document.getElementById('addStudentForm'),grade=form?.elements?.grade,group=form?.elements?.group;
  if(!form||!grade||!group)return;
  const refresh=()=>{
    const rows=(adminData.groups||[]).filter(item=>item&&item.active!==false&&normalizeText(item.grade)===normalizeText(grade.value));
    group.innerHTML=rows.length?'<option value="">اختر موعد الصف</option>'+rows.map(item=>`<option value="${safe(item.name||'')}">${safe(scheduleOptionLabel(item))}</option>`).join(''):'<option value="">لا توجد مواعيد لهذا الصف</option>';
    group.required=true;group.disabled=!rows.length;
  };
  grade.addEventListener('change',refresh);refresh();
}
function bindLearningTargetPicker(form){
  const grade=form?.elements?.grade,group=form?.elements?.group;if(!grade||!group)return;
  const refresh=()=>{const selected=group.value,rows=(adminData.groups||[]).filter(item=>item&&item.active!==false&&(grade.value==='كل الصفوف'||normalizeText(item.grade)===normalizeText(grade.value)));group.innerHTML='<option>كل المجموعات</option>'+rows.map(item=>`<option value="${safe(item.name||'')}" ${item.name===selected?'selected':''}>${safe(scheduleOptionLabel(item))}</option>`).join('');};
  grade.addEventListener('change',refresh);refresh();
}
function enhanceAttendanceMobileUI(){
  const roster=document.querySelector('.attendance-roster-card');if(!roster||document.getElementById('attendanceStudentSearch'))return;
  const grade=document.getElementById('attendanceGrade'),group=document.getElementById('attendanceGroup');
  if(grade&&group){
    const selected=sessionStorage.getItem('attGroup')||'all',rows=(adminData.groups||[]).filter(item=>item&&item.active!==false&&(grade.value==='all'||sameAcademicValue(item.grade,grade.value)));
    group.innerHTML='<option value="all">كل مجموعات الصف</option>'+rows.map(item=>`<option value="${safe(item.name||'')}">${safe(scheduleOptionLabel(item))}</option>`).join('');
    group.value=[...group.options].some(option=>option.value===selected)?selected:'all';
    grade.onchange=()=>{sessionStorage.setItem('attGrade',grade.value);sessionStorage.setItem('attGroup','all');renderAttendance();};
  }
  const value=sessionStorage.getItem('attendanceStudentSearch')||'';
  roster.insertAdjacentHTML('afterbegin',`<label class="attendance-student-search"><span data-icon="search"></span><input id="attendanceStudentSearch" value="${safe(value)}" placeholder="ابحث باسم الطالب أو الكود أو رقم ولي الأمر" autocomplete="off"></label>`);
  const input=document.getElementById('attendanceStudentSearch');
  input?.addEventListener('input',()=>{sessionStorage.setItem('attendanceStudentSearch',input.value);const list=roster.querySelector('.attendance-roster');if(list)list.outerHTML=attendanceRosterHTML();hydrateIcons();});
  hydrateIcons();
}
const renderAttendanceBaseMobile=renderAttendance;
renderAttendance=function(){renderAttendanceBaseMobile();enhanceAttendanceMobileUI();};
function renderAcademics(){
  fresh();const savedGrade=sessionStorage.getItem('academicComposerGrade')||GRADES[0],groups=(adminData.groups||[]).filter(item=>item&&item.active!==false&&normalizeText(item.grade)===normalizeText(savedGrade));
  const ctx={academicYear:adminData.settings?.academicYear||'',term:adminData.settings?.term||'الترم الأول'};
  content(`<div class="section-head"><div><span class="kicker"><span data-icon="book-open"></span> المحتوى الدراسي</span><h2 class="section-title">الواجبات والامتحانات في صفحة واحدة</h2><p class="section-desc">اختار الصف والمجموعة مرة واحدة، ثم افتح النموذج المطلوب داخل نفس الصفحة. الاستهداف يُراجع مرة أخرى داخل Firebase.</p></div></div>
  <section class="card academic-target-bar"><div class="academic-target-title"><span class="iconbox" data-icon="users"></span><div><b>المستهدفون</b><small>لن يصل المحتوى لغير الصف والمجموعة المختارين</small></div></div><div class="academic-target-fields"><label><span>الصف</span><select id="academicComposerGrade">${GRADES.map(grade=>`<option ${grade===savedGrade?'selected':''}>${safe(grade)}</option>`).join('')}</select></label><label><span>المجموعة</span><select id="academicComposerGroup"><option>كل المجموعات</option>${groups.map(item=>`<option value="${safe(item.name||'')}">${safe(scheduleOptionLabel(item))}</option>`).join('')}</select></label></div></section>
  <div class="academic-composer-actions"><button class="academic-action-card primary" type="button" data-open-composer="exam"><span class="iconbox" data-icon="clipboard"></span><span><b>إضافة امتحان</b><small>موعد، مدة، PDF وأسئلة متنوعة</small></span><span class="academic-plus">+</span></button><button class="academic-action-card" type="button" data-open-composer="assignment"><span class="iconbox" data-icon="file-text"></span><span><b>إضافة واجب</b><small>موعد نشر، ملف وأسئلة</small></span><span class="academic-plus">+</span></button></div>
  <section id="academicInlineComposer" class="academic-inline-composer" hidden></section>
  <div class="grid grid-2 academic-overview-lists"><article class="card"><div class="academic-list-head"><h3>الامتحانات المنشورة</h3><span class="badge">${(adminData.exams||[]).length}</span></div>${(adminData.exams||[]).slice().reverse().map(academicExamRow).join('')||'<p class="section-desc">لا توجد امتحانات.</p>'}</article><article class="card"><div class="academic-list-head"><h3>الواجبات المنشورة</h3><span class="badge">${(adminData.assignments||[]).length}</span></div>${(adminData.assignments||[]).slice().reverse().map(item=>`<div class="mobile-row academic-content-row"><div><b>${safe(item.title)}</b><small>${safe(item.grade)} · ${safe(item.group||'كل المجموعات')}</small><small>${assignmentPublishMillisAdmin(item.publishAt)>Date.now()?'ينشر: '+safe(new Date(item.publishAt).toLocaleString('ar-EG')):'منشور الآن'}</small></div>${item.fileUrl?`<a class="small-btn" href="${safe(item.fileUrl)}" target="_blank">الملف</a>`:''}<button class="small-btn danger" onclick="deleteItem('assignments','${safe(item.id)}')">حذف</button></div>`).join('')||'<p class="section-desc">لا توجد واجبات.</p>'}</article></div>`);
  const grade=document.getElementById('academicComposerGrade'),group=document.getElementById('academicComposerGroup');
  grade.onchange=()=>{sessionStorage.setItem('academicComposerGrade',grade.value);renderAcademics();};
  group.onchange=()=>sessionStorage.setItem('academicComposerGroup',group.value);
  const savedGroup=sessionStorage.getItem('academicComposerGroup');if(savedGroup&&[...group.options].some(option=>option.value===savedGroup))group.value=savedGroup;
  document.querySelectorAll('[data-open-composer]').forEach(button=>button.onclick=()=>openAcademicInlineComposer(button.dataset.openComposer,ctx));
  startAcademicAdminCountdowns();hydrateIcons();
}
function academicExamRow(item){
  const now=Date.now(),open=new Date(item.openAt||0).getTime(),close=new Date(item.closeAt||0).getTime(),target=open&&now<open?open:close&&now<close?close:0,label=open&&now<open?'يفتح بعد':close&&now<close?'يغلق بعد':'مغلق';
  return `<div class="mobile-row academic-content-row" data-academic-countdown-target="${target}"><div><b>${safe(item.title)}</b><small>${safe(item.grade)} · ${safe(item.group||'كل المجموعات')} · ${safe(item.duration||20)} دقيقة</small><small>${item.openAt?'يفتح: '+safe(new Date(item.openAt).toLocaleString('ar-EG')):'متاح فورًا'}${item.closeAt?' · يغلق: '+safe(new Date(item.closeAt).toLocaleString('ar-EG')):''}</small></div><span class="badge ${target?'good':'danger'}">${label} <b data-academic-countdown>${target?'--:--:--':'انتهى'}</b></span>${item.pdfUrl?`<a class="small-btn" href="${safe(item.pdfUrl)}" target="_blank">PDF</a>`:''}<button class="small-btn danger" onclick="deleteItem('exams','${safe(item.id)}')">حذف</button></div>`;
}
function startAcademicAdminCountdowns(){
  clearInterval(window.__academicCountdownTimer);
  const tick=()=>document.querySelectorAll('[data-academic-countdown-target]').forEach(row=>{const target=Number(row.dataset.academicCountdownTarget||0),out=row.querySelector('[data-academic-countdown]');if(!target||!out)return;const left=Math.max(0,target-Date.now()),total=Math.ceil(left/1000),days=Math.floor(total/86400),hours=Math.floor(total%86400/3600),minutes=Math.floor(total%3600/60),seconds=total%60;out.textContent=days?`${days}ي ${hours}س`:`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;if(!left){out.textContent='انتهى';clearInterval(window.__academicCountdownTimer);setTimeout(()=>currentSection==='academics'&&renderAcademics(),900);}});
  tick();window.__academicCountdownTimer=setInterval(tick,1000);
}
function academicQuestionBuilderHTML(listId){return `<div class="exam-builder-title"><div><h3>الأسئلة</h3><small>يمكن خلط الاختياري والمقالي والصح والغلط معًا.</small></div><button class="btn ghost" type="button" onclick="addExamQuestion('${listId}')"><span>+</span> إضافة سؤال</button></div><div id="${listId}" class="exam-questions-builder">${examBuilderCard(0)}</div>`;}
function openAcademicInlineComposer(kind,ctx){
  const panel=document.getElementById('academicInlineComposer'),grade=document.getElementById('academicComposerGrade')?.value,group=document.getElementById('academicComposerGroup')?.value||'كل المجموعات';if(!panel||!grade)return;
  document.querySelectorAll('[data-open-composer]').forEach(button=>button.classList.toggle('active',button.dataset.openComposer===kind));
  if(kind==='exam')panel.innerHTML=`<form id="unifiedExamForm" class="card unified-academic-form" novalidate><div class="unified-form-head"><div><span class="kicker"><span data-icon="clipboard"></span> امتحان جديد</span><h3>${safe(grade)} · ${safe(group)}</h3></div><button class="small-btn" type="button" onclick="closeAcademicComposer()">إغلاق</button></div><div class="admin-form-grid"><div class="field"><label>اسم الامتحان</label><input name="title" required placeholder="مثال: امتحان الوحدة الأولى"></div><div class="field"><label>مدة الامتحان بالدقائق</label><input name="duration" type="number" min="1" max="240" value="20" required></div><div class="field"><label>موعد الفتح</label><input name="openAt" type="datetime-local"></div><div class="field"><label>موعد الإغلاق</label><input name="closeAt" type="datetime-local"></div><div class="field"><label>العام الدراسي</label><input name="academicYear" value="${safe(ctx.academicYear||'')}"></div><div class="field"><label>الترم</label><select name="term"><option>الترم الأول</option><option>الترم الثاني</option><option>كل الترمات</option></select></div></div><div class="field"><label>تعليمات للطالب</label><textarea name="instructions" rows="3" placeholder="تعليمات اختيارية"></textarea></div><fieldset class="exam-source-switch"><legend>طريقة إضافة الامتحان</legend><label><input type="radio" name="sourceMode" value="builder" checked><span><b>إنشاء الأسئلة هنا</b><small>اختياري، مقالي وصح أو غلط</small></span></label><label><input type="radio" name="sourceMode" value="pdf"><span><b>رفع الامتحان PDF كامل</b><small>بدون كتابة الأسئلة داخل المنصة</small></span></label></fieldset><label class="exam-pdf-upload"><span><b>ملف الامتحان PDF</b><small data-pdf-help>اختياري مع الأسئلة، وإجباري عند اختيار امتحان PDF كامل — بحد أقصى 15MB</small></span><input name="pdfFile" type="file" accept="application/pdf,.pdf"></label><div data-exam-builder-source>${academicQuestionBuilderHTML('unifiedExamQuestions')}</div><div class="pdf-exam-answer-note" data-pdf-answer-note hidden><span data-icon="file-text"></span><div><b>الطالب سيشاهد ملف الـ PDF</b><small>وتظهر له خانة كبيرة لكتابة إجابته، ثم تصل المحاولة للمستر للتصحيح اليدوي.</small></div></div><label class="option-card"><input name="allowRetake" type="checkbox"> السماح بإعادة الامتحان</label><button class="btn primary unified-publish-button" type="submit"><span data-icon="send"></span> حفظ ونشر الامتحان</button></form>`;
  else panel.innerHTML=`<form id="unifiedAssignmentForm" class="card unified-academic-form"><div class="unified-form-head"><div><span class="kicker"><span data-icon="file-text"></span> واجب جديد</span><h3>${safe(grade)} · ${safe(group)}</h3></div><button class="small-btn" type="button" onclick="closeAcademicComposer()">إغلاق</button></div><div class="admin-form-grid"><div class="field"><label>عنوان الواجب</label><input name="title" required placeholder="مثال: واجب الدرس الثالث"></div><div class="field"><label>موعد النشر</label><input name="publishAt" type="datetime-local"></div><div class="field"><label>آخر موعد للتسليم</label><input name="dueDate" type="date"></div><div class="field"><label>الترم</label><select name="term"><option>الترم الأول</option><option>الترم الثاني</option><option>كل الترمات</option></select></div><div class="field full-span"><label>تعليمات الواجب</label><textarea name="notes" rows="3" placeholder="اكتب المطلوب من الطالب"></textarea></div></div><label class="exam-pdf-upload"><span><b>PDF أو صورة اختيارية</b><small>بحد أقصى 15MB</small></span><input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"></label>${academicQuestionBuilderHTML('unifiedAssignmentQuestions')}<button class="btn primary unified-publish-button" type="submit"><span data-icon="send"></span> حفظ ونشر الواجب</button></form>`;
  panel.hidden=false;const examForm=panel.querySelector('#unifiedExamForm');examForm?.addEventListener('submit',saveUnifiedAcademicExam);examForm?.querySelectorAll('[name="sourceMode"]').forEach(input=>input.addEventListener('change',()=>syncUnifiedExamSource(examForm)));if(examForm)syncUnifiedExamSource(examForm);panel.querySelector('#unifiedAssignmentForm')?.addEventListener('submit',saveUnifiedAcademicAssignment);hydrateIcons();panel.scrollIntoView({behavior:'smooth',block:'start'});
}
function syncUnifiedExamSource(form){
  const pdfOnly=form?.elements?.sourceMode?.value==='pdf',builder=form?.querySelector('[data-exam-builder-source]'),note=form?.querySelector('[data-pdf-answer-note]'),file=form?.elements?.pdfFile,help=form?.querySelector('[data-pdf-help]');
  if(builder)builder.hidden=pdfOnly;if(note)note.hidden=!pdfOnly;if(file)file.required=pdfOnly;if(help)help.textContent=pdfOnly?'ارفع ملف الامتحان PDF كاملًا — بحد أقصى 15MB':'اختياري مع الأسئلة — بحد أقصى 15MB';
  builder?.querySelectorAll('[required]').forEach(field=>{field.required=!pdfOnly;});
}
window.closeAcademicComposer=function(){const panel=document.getElementById('academicInlineComposer');if(panel){panel.hidden=true;panel.innerHTML='';}document.querySelectorAll('[data-open-composer]').forEach(button=>button.classList.remove('active'));};
async function saveUnifiedAcademicExam(event){
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),grade=document.getElementById('academicComposerGrade')?.value,group=document.getElementById('academicComposerGroup')?.value||'كل المجموعات',file=form.pdfFile.files[0],list=form.querySelector('#unifiedExamQuestions'),pdfOnly=form.elements.sourceMode.value==='pdf';let text=pdfOnly?'أجب عن أسئلة ملف الامتحان PDF بالترتيب، واكتب رقم كل سؤال قبل إجابته.':serializeExamQuestions(list);const count=list.querySelectorAll('[data-exam-question]').length;
  if(!String(form.title.value||'').trim())return aToast('اكتب اسم الامتحان');
  if(pdfOnly&&!file)return aToast('ارفع ملف الامتحان PDF أولًا');
  if(!pdfOnly&&(!text||text.split('\n\n').length!==count))return aToast('كمّل كل سؤال وحدد نوعه وإجابته الصحيحة');
  if(form.openAt.value&&form.closeAt.value&&new Date(form.closeAt.value)<=new Date(form.openAt.value))return aToast('موعد الإغلاق يجب أن يكون بعد موعد الفتح');
  if(file&&(file.type!=='application/pdf'||file.size>15*1024*1024))return aToast('اختار PDF صحيحًا بحجم لا يزيد عن 15MB');
  const parsed=parseExamQuestions(text),values=Object.fromEntries(new FormData(form).entries());delete values.pdfFile;delete values.sourceMode;values.id=`ex-${Date.now()}`;values.grade=grade;values.group=group;values.text=text;values.pdfOnly=pdfOnly;values.duration=Math.max(1,Math.min(240,Number(values.duration||20)));values.openAt=values.openAt?new Date(values.openAt).toISOString():'';values.closeAt=values.closeAt?new Date(values.closeAt).toISOString():'';values.allowRetake=form.allowRetake.checked;values.active=true;values.questionCount=parsed.length;values.mcqCount=parsed.filter(q=>q.type==='mcq').length;values.essayCount=parsed.filter(q=>q.type==='essay').length;values.createdAt=new Date().toISOString();
  button.disabled=true;button.classList.add('is-loading');try{if(file){const upload=await window.MFCloud.uploadAttachment(file,'teacher-uploads');values.pdfUrl=upload.url;values.pdfName=upload.fileName||file.name;values.pdfPath=upload.path||'';}adminData.exams.push(values);await saveAdminDataNow();aToast('تم حفظ ونشر الامتحان للصف والمجموعة المحددين');renderAcademics();}catch(error){adminData.exams=adminData.exams.filter(item=>item.id!==values.id);aToast(adminActionErrorMessage(error,'تعذر حفظ الامتحان.'));}finally{button.disabled=false;button.classList.remove('is-loading');}
}
async function saveUnifiedAcademicAssignment(event){
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),grade=document.getElementById('academicComposerGrade')?.value,group=document.getElementById('academicComposerGroup')?.value||'كل المجموعات',file=form.file.files[0],list=form.querySelector('#unifiedAssignmentQuestions'),text=serializeExamQuestions(list),count=list.querySelectorAll('[data-exam-question]').length;
  if(!text||text.split('\n\n').length!==count)return aToast('كمّل أسئلة الواجب وحدد نوع كل سؤال');
  if(file&&file.size>15*1024*1024)return aToast('حجم الملف أكبر من 15MB');
  const values=Object.fromEntries(new FormData(form).entries());delete values.file;values.id=`as-${Date.now()}`;values.grade=grade;values.group=group;values.academicYear=adminData.settings?.academicYear||'';values.questions=text.split(/\n\s*\n/).map(value=>value.replace(/\n(?:الإجابة|الاجابة)\s*:[^\n]*$/i,'').trim()).filter(Boolean);values.publishAt=values.publishAt?new Date(values.publishAt).toISOString():new Date().toISOString();values.active=true;values.createdAt=new Date().toISOString();
  if(values.dueDate&&values.dueDate<values.publishAt.slice(0,10))return aToast('آخر موعد للتسليم يجب أن يكون بعد موعد النشر');
  button.disabled=true;button.classList.add('is-loading');try{if(file){const upload=await window.MFCloud.uploadAttachment(file,'teacher-uploads');values.fileUrl=upload.url;values.fileName=upload.fileName||file.name;values.fileType=file.type;}adminData.assignments.push(values);await saveAdminDataNow();aToast('تم حفظ الواجب للصف والمجموعة المحددين');renderAcademics();}catch(error){adminData.assignments=adminData.assignments.filter(item=>item.id!==values.id);aToast(adminActionErrorMessage(error,'تعذر حفظ الواجب.'));}finally{button.disabled=false;button.classList.remove('is-loading');}
}
function applyAcademicComposerTarget(form){
  const grade=sessionStorage.getItem('academicComposerGrade'),group=sessionStorage.getItem('academicComposerGroup');if(!form||!grade)return;
  if(form.elements.grade){form.elements.grade.value=grade;form.elements.grade.dispatchEvent(new Event('change'));}
  setTimeout(()=>{if(form.elements.group&&group)form.elements.group.value=group;},0);
}
function renderSection(){({overview:renderOverview,students:renderStudents,bookings:renderBookings,schedules:renderSchedules,attendance:renderAttendance,warnings:renderWarnings,studentRequests:renderStudentRequests,payments:renderPayments,academics:renderAcademics,assignments:renderAssignments,exams:renderExams,materials:renderMaterials,reviews:renderReviewsAdmin}[currentSection]||renderOverview)();if(currentSection==='students')bindAdminGradeGroupPicker();if(currentSection==='attendance')enhanceAttendanceMobileUI();if(['assignments','exams'].includes(currentSection)){const form=document.getElementById(currentSection==='exams'?'examForm':'assignmentForm');bindLearningTargetPicker(form);applyAcademicComposerTarget(form);}}
function exportCSV(name, rows){const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'})); a.download=name; a.click();}
window.exportBookingsCSV=function(){exportCSV('bookings.csv',[['code','name','grade','month','group','parentPhone','status'],...adminData.bookings.map(b=>[b.code,b.name,b.grade,b.month,b.group,b.parentPhone,b.status])]);};

function initAdmin(){const requested=new URLSearchParams(location.search).get('section');if(adminSections.some(([id])=>id===requested))currentSection=requested;setupTheme(); hydrateIcons(); adminLogin(); tryRestoreSession();}
document.addEventListener('DOMContentLoaded',initAdmin);
