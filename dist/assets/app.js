var TEACHER_WHATSAPP = '201554930313';
var ENGINEER_WHATSAPP = '201008454029';
var GRADES = ['أولى إعدادي','تانية إعدادي','تالتة إعدادي','أولى ثانوي','تالتة ثانوي'];
var MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
var STORAGE_KEY = 'mf_science_v12_data';
var OLD_STORAGE_KEY = 'mf_science_v11_data';
var cloudSaveTimer = null;
var icons = {
  atom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="2"></circle><path d="M12 2c3 3.8 5 7.1 5 10s-2 6.2-5 10c-3-3.8-5-7.1-5-10s2-6.2 5-10Z"></path><path d="M2 12c3.8-3 7.1-5 10-5s6.2 2 10 5c-3.8 3-7.1 5-10 5S5.8 15 2 12Z"></path></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M8 2v4M16 2v4M3 10h18"></path><rect x="3" y="5" width="18" height="17" rx="3"></rect></svg>',
  bookOpen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 7v14"></path><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H12V5H6.5A2.5 2.5 0 0 0 4 7.5v12Z"></path><path d="M20 19.5a2.5 2.5 0 0 0-2.5-2.5H12V5h5.5A2.5 2.5 0 0 1 20 7.5v12Z"></path></svg>',
  clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="5" y="4" width="14" height="18" rx="2"></rect><path d="M9 4a3 3 0 0 1 6 0"></path><path d="M9 12h6M9 16h4"></path></svg>',
  barChart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 20V4"></path><path d="M4 20h17"></path><rect x="7" y="11" width="3" height="6" rx="1"></rect><rect x="12" y="7" width="3" height="10" rx="1"></rect><rect x="17" y="13" width="3" height="4" rx="1"></rect></svg>',
  userCheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path><circle cx="9.5" cy="7" r="4"></circle><path d="m16 11 2 2 4-5"></path></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.45c1 .35 1.9.6 2.9.7A2 2 0 0 1 22 16.9Z"></path></svg>',
  sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"></path><path d="M19 14l.9 2.6L22 17.5l-2.1.9L19 21l-.9-2.6-2.1-.9 2.1-.9L19 14ZM4 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"></path></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m22 2-7 20-4-9-9-4 20-7Z"></path><path d="M22 2 11 13"></path></svg>',
  database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><ellipse cx="12" cy="5" rx="8" ry="3"></ellipse><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"></path><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"></path></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21a8 8 0 0 0-16 0"></path><circle cx="12" cy="7" r="4"></circle></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>',
  fileText: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6M8 13h8M8 17h6"></path></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m12 2 3.1 6.3 6.9 1-5 4.8 1.2 6.9L12 17.8 5.8 21 7 14.1 2 9.3l6.9-1L12 2Z"></path></svg>',
  externalLink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"></path></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1"></circle></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.25 10.44 22v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.77l-.44 2.91h-2.33V22C18.34 21.25 22 17.08 22 12.06Z"/></svg>',
  helpCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><path d="M9.1 9a3 3 0 1 1 5.6 1.5c-.8 1.2-2.7 1.5-2.7 3"></path><path d="M12 17h.01"></path></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><path d="M14 14h3v3h-3zM18 14h3M14 19h7M19 18v3"></path></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 15H6L5 6"></path><path d="M10 11v6M14 11v6"></path></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M17 8l-5-5-5 5"></path><path d="M12 3v12"></path></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"></path></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>'
};


function iconNameToKey(name){return String(name||'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());}
function hydrateIcons(){document.querySelectorAll('[data-icon]').forEach(el=>{const key=iconNameToKey(el.dataset.icon); if(icons[key]) el.innerHTML=icons[key];});}
function today(){return new Date().toLocaleDateString('ar-EG');}
function toast(msg){const t=document.getElementById('toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2600);}
function whatsappLink(phone,msg){return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;}
function uid(prefix='MF-SCI'){return `${prefix}-${Math.floor(1000+Math.random()*9000)}`;}
function getLevel(score){if(score>=90)return 'ممتاز'; if(score>=75)return 'جيد جدًا'; if(score>=60)return 'جيد'; return 'محتاج متابعة';}
function calcStudent(st){const attendance=(st.attendance||[]).filter(a=>a.status==='حاضر').length; const totalAtt=Math.max((st.attendance||[]).length,1); const attendancePct=Math.round(attendance/totalAtt*100); const graded=(st.grades||[]).filter(g=>g.score!==null && g.score!==undefined && g.score!=='' && !isNaN(Number(g.score))); const avg=Math.round((graded.reduce((s,g)=>s+Number(g.score||0),0)/Math.max(graded.length,1))||0); const hwPct=Math.round(((st.homeworks||[]).filter(h=>h.status==='تم التسليم').length/Math.max((st.homeworks||[]).length,1))*100); const final=Math.round(attendancePct*.3+avg*.5+hwPct*.2); return {attendancePct,avg,hwPct,final,level:getLevel(final),lastGrade:graded.length?graded[graded.length-1]:null};}
function defaultData(){
  return {
    students:[
      {code:'MF-SCI-1001',name:'أحمد محمد',studentPhone:'01011111111',parentPhone:'01022222222',grade:'أولى إعدادي',month:'يونيو',group:'مجموعة السبت والثلاثاء',paid:true,notes:'ملتزم ومحتاج مراجعة على الدرس الثالث',attendance:[{date:'2026/6/1',status:'حاضر'},{date:'2026/6/4',status:'حاضر'},{date:'2026/6/8',status:'متأخر'}],grades:[{exam:'امتحان شهر يونيو',score:88,type:'ورقي',date:'2026/6/20'},{exam:'اختبار الوحدة الأولى',score:82,type:'أونلاين',date:'2026/6/12'}],homeworks:[{title:'واجب الحركة',status:'تم التسليم'},{title:'مراجعة الوحدة',status:'لم يتم'}]},
      {code:'MF-SCI-1002',name:'ملك أحمد',studentPhone:'01033333333',parentPhone:'01044444444',grade:'تانية إعدادي',month:'يونيو',group:'مجموعة الأحد والأربعاء',paid:false,notes:'مستوى جيد لكن تحتاج انتظام في الواجبات',attendance:[{date:'2026/6/2',status:'حاضر'},{date:'2026/6/5',status:'غائب'}],grades:[{exam:'امتحان شهر يونيو',score:74,type:'ورقي',date:'2026/6/20'},{exam:'اختبار سريع',score:79,type:'أونلاين',date:'2026/6/10'}],homeworks:[{title:'واجب الكهرباء',status:'تم التسليم'},{title:'أسئلة اختيار',status:'لم يتم'}]},
      {code:'MF-SCI-1003',name:'يوسف علي',studentPhone:'01055555555',parentPhone:'01066666666',grade:'تالتة ثانوي',month:'يونيو',group:'مجموعة الاثنين والخميس',paid:true,notes:'ممتاز في الحل ويحتاج تثبيت القوانين',attendance:[{date:'2026/6/1',status:'حاضر'},{date:'2026/6/3',status:'حاضر'},{date:'2026/6/7',status:'حاضر'}],grades:[{exam:'امتحان شهر يونيو',score:92,type:'ورقي',date:'2026/6/20'},{exam:'مراجعة نهائية',score:89,type:'أونلاين',date:'2026/6/11'}],homeworks:[{title:'واجب الباب الأول',status:'تم التسليم'},{title:'نماذج امتحان',status:'تم التسليم'}]}
    ],
    bookings:[],
    materials:[
      {id:'mat-1',title:'مراجعة قوانين الحركة',grade:'أولى إعدادي',type:'PDF',desc:'ملخص منظم لأهم التعريفات والقوانين.',content:'ملاحظات سريعة: ركز على تعريف السرعة والعجلة ووحدات القياس.',fileName:'motion-review.pdf',fileData:''},
      {id:'mat-2',title:'مراجعة الكهرباء',grade:'تانية إعدادي',type:'PDF',desc:'أسئلة تدريبية ونقاط مهمة قبل الامتحان.',content:'تدريب على شدة التيار والمقاومة وقراءة الدائرة.',fileName:'electricity.pdf',fileData:''},
      {id:'mat-3',title:'مراجعة نهائية علوم',grade:'تالتة ثانوي',type:'مراجعة مكتوبة',desc:'خطة مراجعة شهرية للطلاب المتقدمين.',content:'اقرأ القوانين ثم حل نماذج الاختيار من متعدد.',fileName:'',fileData:''}
    ],
    questions:[
      {id:'q-1',grade:'أولى إعدادي',unit:'الوحدة الأولى',question:'ما المقصود بالحركة؟',answer:'تغير موضع الجسم بمرور الزمن بالنسبة لنقطة مرجعية.',fileName:'',fileData:''},
      {id:'q-2',grade:'تانية إعدادي',unit:'الكهرباء',question:'اذكر وظيفة المقاومة في الدائرة.',answer:'تقليل شدة التيار وتنظيم مروره.',fileName:'',fileData:''},
      {id:'q-3',grade:'تالتة ثانوي',unit:'المراجعة النهائية',question:'ما أهمية التجربة في إثبات القانون العلمي؟',answer:'تأكيد العلاقة بين المتغيرات وفق قياس منظم.',fileName:'',fileData:''}
    ],
    exams:[
      {id:'ex-1',title:'امتحان شهر يونيو',grade:'أولى إعدادي',date:'2026-06-20',questions:20,duration:20,status:'مفتوح',instructions:'اقرأ الأسئلة جيدًا ولا تخرج من صفحة الامتحان قبل التسليم.',text:'Q: ما المقصود بالحركة؟\nA) تغير موضع الجسم بمرور الزمن\nB) ثبات الجسم دائمًا\nC) تغير لون الجسم\nD) زيادة كتلة الجسم\nAnswer: A\n---\nQ: وحدة قياس السرعة هي؟\nA) نيوتن\nB) متر/ثانية\nC) كيلوجرام\nD) جول\nAnswer: B',fileName:'june-exam.pdf',fileData:''},
      {id:'ex-2',title:'اختبار الوحدة الثانية',grade:'تانية إعدادي',date:'2026-06-22',questions:25,duration:25,status:'مفتوح',instructions:'الوقت 25 دقيقة، وبعد النهاية يتم إغلاق الامتحان تلقائيًا.',text:'Q: وظيفة المقاومة في الدائرة؟\nA) زيادة الجهد فقط\nB) تنظيم مرور التيار\nC) إضاءة المصباح فقط\nD) تخزين الشحنة\nAnswer: B\n---\nQ: في التوصيل على التوالي يمر التيار في؟\nA) مسار واحد\nB) عدة مسارات\nC) لا يوجد تيار\nD) مسار عشوائي\nAnswer: A',fileName:'',fileData:''},
      {id:'ex-3',title:'مراجعة نهائية شهرية',grade:'تالتة ثانوي',date:'2026-06-25',questions:30,duration:30,status:'متاح قريبًا',instructions:'سيتم فتح الامتحان قبل الموعد.',text:'الامتحان غير متاح حاليًا.',fileName:'',fileData:''}
    ],
    examAttempts:[],
    reviews:[
      {id:'rev-1',name:'ولي أمر أحمد',role:'ولي أمر',rating:5,text:'متابعة محترمة وتقرير المستوى بيوضح كل حاجة.'},
      {id:'rev-2',name:'يوسف علي',role:'طالب',rating:5,text:'المراجعات والأسئلة ساعدتني أراجع بسرعة.'}
    ],
    settings:{heroTitle:'رحلة تفوق واضحة مع مستر محمود ابراهيم فوزي', siteUrl:'https://mahmoud-fawzy-science-platform.vercel.app'}
  };
}
function mergeData(parsed){const d=defaultData(); const out={...d,...parsed}; out.students=parsed.students||d.students; out.bookings=parsed.bookings||d.bookings; out.materials=(parsed.materials||d.materials).map((m,i)=>({id:m.id||`mat-${i+1}`,...m})); out.questions=(parsed.questions||d.questions).map((q,i)=>({id:q.id||`q-${i+1}`,...q})); out.exams=(parsed.exams||d.exams).map((e,i)=>({id:e.id||`ex-${i+1}`,duration:e.duration||20,instructions:e.instructions||'',text:e.text||'',...e})); out.examAttempts=parsed.examAttempts||d.examAttempts; out.reviews=(parsed.reviews||d.reviews).map((r,i)=>({id:r.id||`rev-${Date.now()}-${i}`,...r})); return out;}
function loadData(){try{let raw=localStorage.getItem(STORAGE_KEY); if(!raw) raw=localStorage.getItem(OLD_STORAGE_KEY); if(!raw){const d=defaultData();saveData(d);return d;} const parsed=JSON.parse(raw); const merged=mergeData(parsed); saveData(merged); return merged;}catch(e){const d=defaultData();saveData(d);return d;}}
function saveData(data){localStorage.setItem(STORAGE_KEY,JSON.stringify(data)); queueCloudSave(data);}
function queueCloudSave(payload){
  if(!window.MFCloud || !window.MFCloud.ready || !window.MFCloud.saveSiteData) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer=setTimeout(()=>{
    window.MFCloud.saveSiteData(payload).catch(err=>console.warn('Firebase save failed',err));
  },700);
}
function refreshActiveViews(){
  try{renderHomeCounts();renderBookingPreview();renderReviews();renderMaterialsPage();renderQuestionsPage();const q=document.querySelector('#studentSearchForm [name="query"]'); if(q&&q.value){const box=document.getElementById('studentResult'); const st=findStudent(q.value); if(box&&st) box.innerHTML=studentCard(st);} }catch(e){console.warn('refresh failed',e);}
}
async function initFirebaseData(){
  if(!window.MFCloud || !window.MFCloud.ready || !window.MFCloud.loadSiteData) return;
  try{
    const cloud=await window.MFCloud.loadSiteData();
    if(cloud){data=mergeData(cloud); localStorage.setItem(STORAGE_KEY,JSON.stringify(data)); refreshActiveViews();}
    else await window.MFCloud.saveSiteData(data);
  }catch(err){console.warn('Firebase load failed',err);}
}

let data=loadData();
function setupTheme(){const root=document.documentElement; const saved=localStorage.getItem('mf_theme_v12')||localStorage.getItem('mf_theme_v11')||'light'; root.dataset.theme=saved; const btn=document.getElementById('themeToggle'); const render=()=>{if(btn)btn.innerHTML=root.dataset.theme==='dark'?icons.sun:icons.moon;}; render(); btn?.addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark'; localStorage.setItem('mf_theme_v12',root.dataset.theme); render();});}
function fillSelects(){document.querySelectorAll('[data-grade-select]').forEach(g=>g.innerHTML=GRADES.map(x=>`<option>${x}</option>`).join('')); const g=document.getElementById('bookingGrade'); const m=document.getElementById('bookingMonth'); if(g)g.innerHTML=GRADES.map(x=>`<option>${x}</option>`).join(''); if(m)m.innerHTML=MONTHS.map(x=>`<option>${x}</option>`).join('');}
function setupBooking(){const form=document.getElementById('bookingForm'); if(!form)return; form.addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(form); const b=Object.fromEntries(fd.entries()); b.id=b.code=uid(); b.date=today(); b.status='حجز جديد'; data.bookings=data.bookings||[]; data.bookings.push(b); saveData(data); if(window.MFCloud?.createBooking){try{await window.MFCloud.createBooking(b);}catch(err){console.warn('Public booking save failed',err);}} renderBookingPreview(); renderHomeCounts(); form.reset(); fillSelects(); toast('تم تسجيل الحجز على الموقع بنجاح، وسيظهر للمدرس في لوحة التحكم');});}
function renderBookingPreview(){const el=document.getElementById('bookingPreview'); if(!el)return; const rows=[...data.bookings].slice(-5).reverse(); el.innerHTML=`<table><thead><tr><th>الكود</th><th>الطالب</th><th>الصف</th><th>الشهر</th><th>المجموعة</th></tr></thead><tbody>${rows.length?rows.map(b=>`<tr><td>${b.code}</td><td>${b.name}</td><td>${b.grade}</td><td>${b.month}</td><td>${b.group}</td></tr>`).join(''):`<tr><td colspan="5">لسه مفيش حجوزات جديدة في هذه النسخة.</td></tr>`}</tbody></table>`;}
function renderHomeCounts(){const el=document.getElementById('liveCounts'); if(!el)return; const openExams=data.exams.filter(e=>e.status==='مفتوح').length; el.innerHTML=`<div class="stat"><b>${data.materials.length}</b><small>ملفات مراجعة</small></div><div class="stat"><b>${data.questions.length}</b><small>سؤال تدريبي</small></div><div class="stat"><b>${openExams}</b><small>امتحانات مفتوحة</small></div>`;}
function makeQR(){return `<div class="qr-card" aria-label="QR">${Array.from({length:25}).map(()=>'<i></i>').join('')}</div>`;}
function findStudent(query){const q=(query||'').trim().toLowerCase(); return data.students.find(s=>s.code.toLowerCase()===q || s.name.toLowerCase().includes(q) || String(s.parentPhone||'')===q || String(s.studentPhone||'')===q);}
function studentCard(st){
  const c=calcStudent(st);
  const last=c.lastGrade;
  const absentCount=(st.attendance||[]).filter(a=>a.status==='غائب').length;
  const lateCount=(st.attendance||[]).filter(a=>a.status==='متأخر').length;
  const attendanceRows=(st.attendance||[]).slice().reverse().map(a=>`<tr><td>${a.date}</td><td><span class="badge ${a.status==='حاضر'?'good':a.status==='غائب'?'danger':'warn'}">${a.status}</span></td></tr>`).join('') || '<tr><td colspan="2">لا توجد سجلات حضور بعد</td></tr>';
  const gradeRows=(st.grades||[]).length?(st.grades||[]).slice().reverse().map(g=>`<tr><td>${g.exam}</td><td>${g.score===null||g.score===undefined?'في انتظار التصحيح':g.score+'%'}</td><td>${g.type||'-'}</td><td>${g.date||'-'}</td></tr>`).join(''):'<tr><td colspan="4">لم يتم تسجيل درجات بعد</td></tr>';
  const homeworkRows=(st.homeworks||[]).length?(st.homeworks||[]).slice().reverse().map(h=>`<tr><td>${h.title}</td><td><span class="badge ${h.status==='تم التسليم'?'good':'warn'}">${h.status||'-'}</span></td><td>${h.date||'-'}</td></tr>`).join(''):'<tr><td colspan="3">لا توجد واجبات مسجلة</td></tr>';
  const safeCode=String(st.code).replace(/[^a-zA-Z0-9_-]/g,'');
  return `<div class="student-profile student-dashboard">
    <div class="student-identity-card">
      <div class="profile-top student-dashboard-head">
        <div><span class="badge good">${st.code}</span><h3>${st.name}</h3><p>${st.grade} - ${st.group}</p><span class="badge ${st.paid?'good':'danger'}">${st.paid?'تم الدفع':'لم يتم الدفع'}</span></div>
        ${makeQR(st.code)}
      </div>
    </div>
    <div class="metric-grid">
      <div class="metric"><b>${c.attendancePct}%</b><small>الحضور</small></div>
      <div class="metric"><b>${absentCount}</b><small>غياب</small></div>
      <div class="metric"><b>${c.avg}%</b><small>متوسط الدرجات</small></div>
      <div class="metric"><b>${last?last.score+'%':'-'}</b><small>آخر نتيجة</small></div>
    </div>
    <div class="level-card"><div class="level-row"><b>المستوى العام</b><span>${c.level}</span></div><div class="progress"><span style="width:${c.final}%"></span></div></div>
    <div class="student-actions">
      <button class="btn primary" onclick="markAttendance('${st.code}')"><span data-icon="user-check"></span> تسجيل حضور اليوم</button>
      <button class="btn ghost" onclick="toggleStudentPanel('attendance-${safeCode}')"><span data-icon="calendar"></span> سجل الحضور والغياب</button>
      <a class="btn gold" href="exams.html?code=${encodeURIComponent(st.code)}"><span data-icon="clipboard"></span> الامتحانات والنتائج</a>
      <label class="btn ghost" style="cursor:pointer"><span data-icon="file-text"></span> رفع / تصوير واجب<input type="file" accept="image/*,.pdf" capture="environment" style="display:none" onchange="submitHomework('${st.code}', this)"></label>
    </div>
    <div class="student-panels pro-student-sections">
      <div class="mini-panel attendance-summary wide-panel student-wide-box"><h3>الحضور والغياب</h3><div class="mini-stats"><span>حضور ${c.attendancePct}%</span><span>غياب ${absentCount}</span><span>تأخير ${lateCount}</span></div><button class="btn ghost small" onclick="toggleStudentPanel('attendance-${safeCode}')"><span data-icon="calendar"></span> عرض الأيام</button><div id="attendance-${safeCode}" class="student-hidden-panel"><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحالة</th></tr></thead><tbody>${attendanceRows}</tbody></table></div></div></div>
      <div class="mini-panel wide-panel student-wide-box"><h3>الدرجات</h3><div class="table-wrap"><table><thead><tr><th>الامتحان</th><th>الدرجة</th><th>النوع</th><th>التاريخ</th></tr></thead><tbody>${gradeRows}</tbody></table></div></div>
      <div class="mini-panel wide-panel student-wide-box homework-wide-box"><h3>الواجبات</h3><p class="muted-note">ارفع ملف PDF أو صورة من المعرض أو الكاميرا.</p><div class="homework-wide-layout"><label class="upload-zone"><span data-icon="file-text"></span><strong>رفع / تصوير واجب</strong><small>PDF أو صورة</small><input type="file" accept="image/*,.pdf" capture="environment" onchange="submitHomework('${st.code}', this)"></label><div class="table-wrap"><table><thead><tr><th>الواجب</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${homeworkRows}</tbody></table></div></div></div>
      <div class="mini-panel teacher-note"><h3>ملاحظة المدرس</h3><p>${st.notes||'لا توجد ملاحظات حالية'}</p></div>
    </div>
  </div>`;
}
window.toggleStudentPanel=function(id){const el=document.getElementById(id); if(!el)return; el.classList.toggle('show');}
window.markAttendance=function(code){const st=data.students.find(s=>s.code===code); if(!st)return; st.attendance=st.attendance||[]; st.attendance.push({date:today(),status:'حاضر'}); saveData(data); const q=document.querySelector('#studentSearchForm [name="query"]'); if(q) q.value=code; const r=document.getElementById('studentResult'); if(r) r.innerHTML=studentCard(st); hydrateIcons(); toast('تم تسجيل الحضور بنجاح');}
window.submitHomework=async function(code,input){const st=data.students.find(s=>s.code===code); if(!st)return; const file=input.files?.[0]; const filename=file?.name||'ملف واجب'; st.homeworks=st.homeworks||[]; const hw={title:filename,status:'تم التسليم',date:today()}; st.homeworks.push(hw); saveData(data); if(file && window.MFCloud?.uploadHomework){try{const up=await window.MFCloud.uploadHomework(file,code); Object.assign(hw,{fileUrl:up.url,filePath:up.path}); saveData(data);}catch(e){console.warn('Homework upload failed',e);}} const r=document.getElementById('studentResult'); if(r) r.innerHTML=studentCard(st); hydrateIcons(); toast('تم رفع الواجب بنجاح');}
function setupStudent(){const form=document.getElementById('studentSearchForm'); if(!form)return; form.addEventListener('submit',e=>{e.preventDefault(); const st=findStudent(new FormData(form).get('query')); const box=document.getElementById('studentResult'); box.innerHTML=st?studentCard(st):'<h3>لم يتم العثور على الطالب</h3><p style="color:var(--muted);font-weight:800">تأكد من كتابة الكود أو الاسم بشكل صحيح.</p>'; hydrateIcons();});}
function parentReport(st){const c=calcStudent(st); const absent=(st.attendance||[]).filter(a=>a.status==='غائب').length; return `<div id="printReport"><div class="profile-top"><div><span class="badge">تقرير شهري</span><h3 style="font-size:1.6rem;margin:10px 0 0">${st.name}</h3><p style="color:var(--muted);font-weight:800">${st.grade} - ${st.code}</p></div><span class="badge ${st.paid?'good':'danger'}">${st.paid?'تم الدفع':'لم يتم الدفع'}</span></div><div class="metric-grid"><div class="metric"><b>${c.attendancePct}%</b><small>الحضور</small></div><div class="metric"><b>${absent}</b><small>غياب</small></div><div class="metric"><b>${c.avg}%</b><small>الدرجات</small></div><div class="metric"><b>${c.level}</b><small>المستوى</small></div></div><div class="table-wrap"><table><thead><tr><th>الامتحان</th><th>الدرجة</th></tr></thead><tbody>${(st.grades||[]).map(g=>`<tr><td>${g.exam}</td><td>${g.score===null||g.score===undefined?'في انتظار التصحيح':g.score+'%'}</td></tr>`).join('')||'<tr><td colspan="2">لا توجد درجات</td></tr>'}</tbody></table></div><p style="font-weight:900">ملاحظات المدرس: ${st.notes||'لا توجد ملاحظات'}</p><p style="color:var(--muted);font-weight:800">نصيحة الشهر: الاستمرار في حل بنك الأسئلة ومراجعة الامتحانات الشهرية.</p></div><button class="btn primary" onclick="window.print()"><span data-icon="file-text"></span> طباعة / حفظ PDF</button>`;}
function setupParent(){const form=document.getElementById('parentSearchForm'); if(!form)return; form.addEventListener('submit',e=>{e.preventDefault(); const st=findStudent(new FormData(form).get('query')); const box=document.getElementById('parentResult'); box.innerHTML=st?parentReport(st):'<h3>لم يتم العثور على تقرير</h3><p style="color:var(--muted);font-weight:800">جرب كود الطالب أو رقم ولي الأمر المسجل.</p>'; hydrateIcons();});}
function stars(n){return '★'.repeat(Number(n)||5)+'☆'.repeat(5-(Number(n)||5));}
function renderReviews(){const el=document.getElementById('reviewsList'); if(!el)return; el.innerHTML=data.reviews.slice(-8).reverse().map(r=>`<div class="card"><div class="review-stars">${stars(r.rating)}</div><h3 style="margin:8px 0 4px">${r.name}</h3><span class="badge">${r.role}</span><p style="color:var(--muted);font-weight:800">${r.text}</p></div>`).join('');}
function setupReviews(){const form=document.getElementById('reviewForm'); if(!form)return; form.addEventListener('submit',e=>{e.preventDefault(); const r=Object.fromEntries(new FormData(form).entries()); r.id=`rev-${Date.now()}`; r.date=today(); data.reviews.push(r); saveData(data); form.reset(); renderReviews(); toast('تم إضافة التقييم');});}
function setupContact(){const a=document.getElementById('teacherWhatsapp'); if(a)a.href=whatsappLink(TEACHER_WHATSAPP,'السلام عليكم مستر محمود ابراهيم فوزي، أريد التواصل بخصوص حجز العلوم.'); const eng=document.getElementById('engineerWhatsapp'); if(eng)eng.href=whatsappLink(ENGINEER_WHATSAPP,'السلام عليكم مهندس عمرو، أريد التواصل بخصوص موقع مستر محمود ابراهيم فوزي.');}
function attachmentHtml(item){
  const src=item.fileData||item.fileUrl||'';
  const name=item.fileName||'ملف مرفق';
  if(src){
    const isImg=String(src).startsWith('data:image') || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(String(src));
    if(isImg) return `<div class="attachment-box"><img class="attach-preview" src="${src}" alt="${item.title||item.question||name}"><a class="btn ghost" href="${src}" target="_blank" rel="noopener"><span data-icon="external-link"></span> فتح الصورة</a></div>`;
    return `<div class="attachment-box"><span class="badge"><span data-icon="file-text"></span>${name}</span><a class="btn ghost" href="${src}" target="_blank" rel="noopener"><span data-icon="file-text"></span> فتح PDF</a><a class="btn ghost" href="${src}" download="${name}"><span data-icon="upload"></span> تحميل</a></div>`;
  }
  return item.fileName?`<span class="badge"><span data-icon="file-text"></span>${item.fileName}</span>`:'';
}
function gradeFilterControls(id){return `<div class="grade-filter" id="${id}"><button class="active" data-grade="all">الكل</button>${GRADES.map(g=>`<button data-grade="${g}">${g}</button>`).join('')}</div>`;}
function bindGradeFilter(containerId, render){document.querySelectorAll(`#${containerId} [data-grade]`).forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll(`#${containerId} [data-grade]`).forEach(b=>b.classList.remove('active')); btn.classList.add('active'); render(btn.dataset.grade);}));}
function renderMaterialsPage(grade='all'){const el=document.getElementById('materialsPageGrid'); if(!el)return; const items=data.materials.filter(x=>grade==='all'||x.grade===grade); el.innerHTML=items.map(m=>`<div class="card resource-card"><div class="resource-top"><span class="iconbox" data-icon="book-open"></span><span class="badge">${m.grade}</span></div><h3>${m.title}</h3><p>${m.desc||''}</p>${m.content?`<div class="written-box">${m.content}</div>`:''}${attachmentHtml(m)}</div>`).join('')||'<div class="card"><h3>لا توجد ملفات لهذا الصف حاليًا</h3></div>'; hydrateIcons();}
function setupMaterialsPage(){if(!document.getElementById('materialsPageGrid'))return; const wrapper=document.getElementById('materialsFilters'); wrapper.innerHTML=gradeFilterControls('materialsFilterBox'); bindGradeFilter('materialsFilterBox',renderMaterialsPage); renderMaterialsPage();}
function renderQuestionsPage(grade='all'){const el=document.getElementById('questionsPageGrid'); if(!el)return; const items=data.questions.filter(x=>grade==='all'||x.grade===grade); el.innerHTML=items.map(q=>`<div class="card resource-card"><div class="resource-top"><span class="iconbox" data-icon="help-circle"></span><span class="badge">${q.grade}</span></div><small class="badge warn">${q.unit||'عام'}</small><h3>${q.question}</h3><p><b>الإجابة:</b> ${q.answer}</p>${attachmentHtml(q)}</div>`).join('')||'<div class="card"><h3>لا توجد أسئلة لهذا الصف حاليًا</h3></div>'; hydrateIcons();}
function setupQuestionsPage(){if(!document.getElementById('questionsPageGrid'))return; document.getElementById('questionsFilters').innerHTML=gradeFilterControls('questionsFilterBox'); bindGradeFilter('questionsFilterBox',renderQuestionsPage); renderQuestionsPage();}
function getGradeForCode(code){const st=findStudent(code); return st?st.grade:null;}
function getStudentGradeForExam(st, examTitle){return (st.grades||[]).find(g=>g.exam===examTitle || g.exam===String(examTitle).trim());}
function renderExamPortal(st){const el=document.getElementById('examStudentResult'); if(!el)return; if(!st){el.innerHTML='<p style="color:var(--muted);font-weight:800">اكتب كود الطالب لعرض امتحانات صفك ودرجاتك.</p>';return;} const c=calcStudent(st); const exams=data.exams.filter(e=>e.grade===st.grade); el.innerHTML=`<div class="profile-top"><div><span class="badge good">${st.code}</span><h3>${st.name}</h3><p style="color:var(--muted);font-weight:800">${st.grade} - آخر درجة: ${c.lastGrade?c.lastGrade.score+'%':'لا توجد'}</p></div>${makeQR(st.code)}</div><div class="grid grid-2">${exams.map(ex=>{const gr=getStudentGradeForExam(st,ex.title); return `<div class="card exam-card"><span class="badge ${ex.status==='مفتوح'?'good':'warn'}">${ex.status}</span><h3>${ex.title}</h3><p>${ex.questions||0} سؤال - الوقت: ${ex.duration||20} دقيقة</p><p>${ex.instructions||''}</p>${attachmentHtml(ex)}<div class="exam-grade">درجتك: <b>${gr?(gr.score===null||gr.score===undefined?'في انتظار التصحيح':gr.score+'%'):'لم يتم التسجيل بعد'}</b></div><button class="btn primary" ${ex.status==='مفتوح'?'':'disabled'} onclick="startExam('${st.code}','${ex.id}')"><span data-icon="clipboard"></span> بدء الامتحان</button></div>`;}).join('')||'<div class="card"><h3>لا توجد امتحانات لهذا الصف حاليًا</h3></div>'}</div>`; hydrateIcons();}
function setupExamsPage(){const form=document.getElementById('examCodeForm'); if(!form)return; const params=new URLSearchParams(location.search); const code=params.get('code'); if(code){form.query.value=code; renderExamPortal(findStudent(code));} else renderExamPortal(null); form.addEventListener('submit',e=>{e.preventDefault(); const st=findStudent(new FormData(form).get('query')); renderExamPortal(st); if(!st) toast('لم يتم العثور على الطالب');});}
let examTimer=null, activeExamSession=null;
window.startExam=function(code,examId){const st=data.students.find(s=>s.code===code); const ex=data.exams.find(e=>e.id===examId); if(!st||!ex)return; activeExamSession={code,examId,start:Date.now(),exitCount:0}; const overlay=document.getElementById('examOverlay'); const box=document.getElementById('examBox'); if(!overlay||!box)return; const mins=Number(ex.duration||20); box.innerHTML=`<div class="exam-live-head"><div><span class="badge good">امتحان نشط</span><h2>${ex.title}</h2><p>${ex.instructions||'لا تخرج من الصفحة قبل التسليم.'}</p></div><div class="timer" id="examTimer">${mins}:00</div></div><div class="written-box exam-text">${String(ex.text||'').replace(/\n/g,'<br>')}</div>${attachmentHtml(ex)}<textarea id="examAnswer" placeholder="اكتب إجابتك هنا أو اكتب: تم الحل ورقيًا"></textarea><div class="exam-warning" id="examWarning">تنبيه: الخروج من الصفحة أثناء الامتحان يتم تسجيله كمحاولة خروج.</div><button class="btn primary" onclick="submitExamAttempt(false)"><span data-icon="send"></span> تسليم الامتحان</button>`; hydrateIcons(); overlay.classList.add('show'); try{document.documentElement.requestFullscreen?.();}catch(e){} let remaining=mins*60; clearInterval(examTimer); examTimer=setInterval(()=>{remaining--; const t=document.getElementById('examTimer'); if(t)t.textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`; if(remaining<=0)submitExamAttempt(true);},1000);}
window.submitExamAttempt=function(auto=false){if(!activeExamSession)return; clearInterval(examTimer); const ans=document.getElementById('examAnswer')?.value||''; const st=data.students.find(s=>s.code===activeExamSession.code); const ex=data.exams.find(e=>e.id===activeExamSession.examId); data.examAttempts=data.examAttempts||[]; data.examAttempts.push({studentCode:activeExamSession.code,studentName:st?.name,examId:ex?.id,examTitle:ex?.title,date:today(),answer:ans,status:auto?'انتهى الوقت':'تم التسليم',exitCount:activeExamSession.exitCount}); if(st&&ex){st.grades=st.grades||[]; if(!st.grades.some(g=>g.exam===ex.title)) st.grades.push({exam:ex.title,score:null,type:'أونلاين',date:today(),status:'في انتظار التصحيح'});} saveData(data); activeExamSession=null; document.getElementById('examOverlay')?.classList.remove('show'); try{document.exitFullscreen?.();}catch(e){} toast(auto?'انتهى وقت الامتحان وتم التسليم':'تم تسليم الامتحان وفي انتظار التصحيح'); const code=st?.code; if(code)renderExamPortal(st);}
document.addEventListener('visibilitychange',()=>{if(activeExamSession && document.hidden){activeExamSession.exitCount++; const w=document.getElementById('examWarning'); if(w)w.textContent=`تم تسجيل محاولة خروج رقم ${activeExamSession.exitCount}. الرجاء الرجوع للامتحان فورًا.`;}});
window.addEventListener('beforeunload',e=>{if(activeExamSession){e.preventDefault(); e.returnValue='';}});
function setupAdminLink(){document.querySelectorAll('[data-private-admin]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault(); toast('رابط المدرس خاص: teacher-login.html');}));}
function init(){setupTheme(); fillSelects(); hydrateIcons(); setupBooking(); renderBookingPreview(); renderHomeCounts(); setupStudent(); setupParent(); renderReviews(); setupReviews(); setupContact(); setupMaterialsPage(); setupQuestionsPage(); setupExamsPage(); setupAdminLink();}
init();
initFirebaseData();

/* v13 pro overrides: approvals, stronger student/parent reports, MCQ exams */
function normalizeText(v){return String(v||'').trim().toLowerCase().replace(/[أإآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ');}
function findStudent(query){const q=normalizeText(query); return data.students.find(s=>normalizeText(s.code)===q || normalizeText(s.name).includes(q) || String(s.parentPhone||'').trim()===String(query||'').trim() || String(s.studentPhone||'').trim()===String(query||'').trim());}
function setupBooking(){const form=document.getElementById('bookingForm'); if(!form)return; form.addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(form); const b=Object.fromEntries(fd.entries()); b.id=b.code=uid(); b.date=today(); b.status='حجز جديد'; data.bookings=data.bookings||[]; data.bookings.push(b); saveData(data); if(window.MFCloud?.createBooking){try{await window.MFCloud.createBooking(b);}catch(err){console.warn('Public booking save failed',err);}} renderBookingPreview(); renderHomeCounts(); form.reset(); fillSelects(); toast('تم تسجيل الحجز على الموقع بنجاح، وسيظهر للمدرس في لوحة التحكم');});}
function renderBookingPreview(){const el=document.getElementById('bookingPreview'); if(!el)return; const rows=[...data.bookings].slice(-6).reverse(); el.innerHTML=`<table><thead><tr><th>الكود</th><th>الطالب</th><th>الصف</th><th>الشهر</th><th>المجموعة</th><th>الحالة</th></tr></thead><tbody>${rows.length?rows.map(b=>`<tr><td>${b.code}</td><td>${b.name}</td><td>${b.grade}</td><td>${b.month}</td><td>${b.group}</td><td><span class="status-dot ${b.status==='تم القبول'?'good':b.status==='مرفوض'?'danger':''}">${b.status||'حجز جديد'}</span></td></tr>`).join(''):`<tr><td colspan="6">لسه مفيش حجوزات جديدة.</td></tr>`}</tbody></table>`;}
function renderHomeCounts(){const el=document.getElementById('liveCounts'); if(!el)return; const openExams=data.exams.filter(e=>e.status==='مفتوح').length; const approved=data.reviews.filter(r=>r.approved!==false).length; el.innerHTML=`<div class="stat"><b>${data.students.length}</b><small>طالب مسجل</small></div><div class="stat"><b>${data.materials.length}</b><small>ملفات مراجعة</small></div><div class="stat"><b>${openExams}</b><small>امتحانات مفتوحة</small></div><div class="stat"><b>${approved}</b><small>تقييم منشور</small></div>`;}
function renderReviews(){const el=document.getElementById('reviewsList'); if(!el)return; const rows=data.reviews.filter(r=>r.approved!==false).slice(-8).reverse(); el.innerHTML=rows.map(r=>`<div class="card"><div class="review-stars">${stars(r.rating)}</div><h3 style="margin:8px 0 4px">${r.name}</h3><span class="badge">${r.role}</span><p style="color:var(--muted);font-weight:800">${r.text}</p></div>`).join('') || '<div class="card"><h3>لا توجد تقييمات منشورة حاليًا</h3><p>سيتم نشر التقييمات بعد مراجعة المدرس.</p></div>';}
function setupReviews(){const form=document.getElementById('reviewForm'); if(!form)return; form.addEventListener('submit',e=>{e.preventDefault(); const r=Object.fromEntries(new FormData(form).entries()); r.id=`rev-${Date.now()}`; r.date=today(); r.approved=false; data.reviews.push(r); saveData(data); form.reset(); renderReviews(); toast('تم إرسال التقييم وسيظهر بعد موافقة المدرس');});}
function setupStudent(){const form=document.getElementById('studentSearchForm'); if(!form)return; const params=new URLSearchParams(location.search); const code=params.get('code'); if(code){form.query.value=code; const st=findStudent(code); const box=document.getElementById('studentResult'); if(st&&box){box.innerHTML=studentCard(st); hydrateIcons();}} form.addEventListener('submit',e=>{e.preventDefault(); const st=findStudent(new FormData(form).get('query')); const box=document.getElementById('studentResult'); box.innerHTML=st?studentCard(st):'<h3>لم يتم العثور على الطالب</h3><p style="color:var(--muted);font-weight:800">تأكد من كتابة الكود أو الاسم أو رقم ولي الأمر بشكل صحيح.</p>'; hydrateIcons();});}
function parentReport(st){const c=calcStudent(st); const absent=(st.attendance||[]).filter(a=>a.status==='غائب').length; const late=(st.attendance||[]).filter(a=>a.status==='متأخر').length; const gradeRows=(st.grades||[]).map(g=>`<tr><td>${g.exam}</td><td>${g.score===null||g.score===undefined?'في انتظار التصحيح':g.score+'%'}</td><td>${g.type||'-'}</td><td>${g.date||'-'}</td></tr>`).join('')||'<tr><td colspan="4">لا توجد درجات</td></tr>'; const attRows=(st.attendance||[]).slice(-8).reverse().map(a=>`<tr><td>${a.date}</td><td>${a.status}</td></tr>`).join('')||'<tr><td colspan="2">لا توجد سجلات حضور</td></tr>'; return `<div class="print-area" id="printReport"><div class="profile-top"><div><span class="badge">تقرير شهري</span><h3 style="font-size:1.6rem;margin:10px 0 0">${st.name}</h3><p style="color:var(--muted);font-weight:800">${st.grade} - ${st.code}</p></div><span class="badge ${st.paid?'good':'danger'}">${st.paid?'تم الدفع':'لم يتم الدفع'}</span></div><div class="metric-grid"><div class="metric"><b>${c.attendancePct}%</b><small>الحضور</small></div><div class="metric"><b>${absent}</b><small>غياب</small></div><div class="metric"><b>${late}</b><small>تأخير</small></div><div class="metric"><b>${c.level}</b><small>المستوى</small></div></div><div class="grid grid-2"><div class="mini-panel"><h3>آخر الحضور</h3><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحالة</th></tr></thead><tbody>${attRows}</tbody></table></div></div><div class="mini-panel"><h3>الدرجات</h3><div class="table-wrap"><table><thead><tr><th>الامتحان</th><th>الدرجة</th><th>النوع</th><th>التاريخ</th></tr></thead><tbody>${gradeRows}</tbody></table></div></div></div><p style="font-weight:900">ملاحظات المدرس: ${st.notes||'لا توجد ملاحظات'}</p><p style="color:var(--muted);font-weight:800">نصيحة الشهر: الاستمرار في حل بنك الأسئلة ومراجعة الامتحانات الشهرية.</p></div><button class="btn primary" onclick="window.print()"><span data-icon="file-text"></span> طباعة / حفظ PDF</button>`;}
function parseExamQuestions(text){const blocks=String(text||'').split(/\n\s*---\s*\n/g).map(x=>x.trim()).filter(Boolean); const parsed=blocks.map((block,idx)=>{const lines=block.split(/\n+/).map(x=>x.trim()).filter(Boolean); const qLine=lines.find(l=>/^q[:：\-]/i.test(l)) || lines[0] || `سؤال ${idx+1}`; const options=lines.filter(l=>/^[A-Dأبجده]\)|^[A-Dأبجده][\-\.]/i.test(l)).map(l=>l.replace(/^[A-Dأبجده][\)\-\.]\s*/i,'')); const ans=(lines.find(l=>/^(answer|ans|الإجابة|اجابة)[:：\-]/i.test(l))||'').split(/[:：\-]/).pop().trim().toUpperCase(); return {question:qLine.replace(/^q[:：\-]\s*/i,''),options,answer:ans};}); return parsed.filter(q=>q.options.length>=2);}
function renderExamQuestionsHtml(questions){return `<form id="liveExamForm">${questions.map((q,i)=>`<div class="exam-question"><h4>${i+1}) ${q.question}</h4>${q.options.map((op,j)=>{const letters=['A','B','C','D']; return `<label class="exam-option"><input type="radio" name="q${i}" value="${letters[j]}"><span>${letters[j]}) ${op}</span></label>`}).join('')}</div>`).join('')}</form>`;}
window.startExam=function(code,examId){const st=data.students.find(s=>s.code===code); const ex=data.exams.find(e=>e.id===examId); if(!st||!ex)return; const questions=parseExamQuestions(ex.text); activeExamSession={code,examId,start:Date.now(),exitCount:0,questions}; const overlay=document.getElementById('examOverlay'); const box=document.getElementById('examBox'); if(!overlay||!box)return; const mins=Number(ex.duration||20); box.innerHTML=`<div class="exam-live-head"><div><span class="badge good">امتحان نشط</span><h2>${ex.title}</h2><p>${ex.instructions||'لا تخرج من الصفحة قبل التسليم.'}</p></div><div class="timer" id="examTimer">${mins}:00</div></div>${questions.length?renderExamQuestionsHtml(questions):`<div class="written-box exam-text">${String(ex.text||'').replace(/\n/g,'<br>')}</div><textarea id="examAnswer" placeholder="اكتب إجابتك هنا أو اكتب: تم الحل ورقيًا"></textarea>`}${attachmentHtml(ex)}<div class="exam-warning" id="examWarning">تنبيه: الخروج من الصفحة أثناء الامتحان يتم تسجيله كمحاولة خروج.</div><button class="btn primary" onclick="submitExamAttempt(false)"><span data-icon="send"></span> تسليم الامتحان</button>`; hydrateIcons(); overlay.classList.add('show'); try{document.documentElement.requestFullscreen?.();}catch(e){} let remaining=mins*60; clearInterval(examTimer); examTimer=setInterval(()=>{remaining--; const t=document.getElementById('examTimer'); if(t)t.textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`; if(remaining<=0)submitExamAttempt(true);},1000);}
window.submitExamAttempt=function(auto=false){if(!activeExamSession)return; clearInterval(examTimer); const st=data.students.find(s=>s.code===activeExamSession.code); const ex=data.exams.find(e=>e.id===activeExamSession.examId); let ans=document.getElementById('examAnswer')?.value||''; let score=null; if(activeExamSession.questions?.length){const answers={}; activeExamSession.questions.forEach((q,i)=>{answers[`q${i}`]=document.querySelector(`input[name="q${i}"]:checked`)?.value||'';}); ans=JSON.stringify(answers); const correct=activeExamSession.questions.filter((q,i)=>String(q.answer||'').toUpperCase()===String(answers[`q${i}`]||'').toUpperCase()).length; score=Math.round(correct/Math.max(activeExamSession.questions.length,1)*100);}
 data.examAttempts=data.examAttempts||[]; data.examAttempts.push({studentCode:activeExamSession.code,studentName:st?.name,examId:ex?.id,examTitle:ex?.title,date:today(),answer:ans,score,status:auto?'انتهى الوقت':'تم التسليم',exitCount:activeExamSession.exitCount}); if(st&&ex){st.grades=st.grades||[]; const existing=st.grades.find(g=>g.exam===ex.title); const gradePayload={exam:ex.title,score,type:'أونلاين',date:today(),status:score===null?'في انتظار التصحيح':'تم التصحيح تلقائيًا'}; if(existing) Object.assign(existing,gradePayload); else st.grades.push(gradePayload);} saveData(data); activeExamSession=null; document.getElementById('examOverlay')?.classList.remove('show'); try{document.exitFullscreen?.();}catch(e){} toast(score===null?(auto?'انتهى وقت الامتحان وتم التسليم':'تم التسليم وفي انتظار التصحيح'):`تم التسليم، درجتك ${score}%`); if(st)renderExamPortal(st);}

/* v14 public premium widgets */
function renderPublicLeaderboard(){
  const el=document.getElementById('publicLeaderboard');
  if(!el)return;
  const rows=[...(data.students||[])].map(st=>({st,calc:calcStudent(st)})).sort((a,b)=>b.calc.final-a.calc.final).slice(0,3);
  if(!rows.length){el.innerHTML='<div class="card"><h3>لا توجد بيانات طلاب بعد</h3><p style="color:var(--muted);font-weight:850">ستظهر لوحة الأوائل بعد إضافة الطلاب والدرجات من لوحة المدرس.</p></div>';return;}
  el.innerHTML=rows.map((row,i)=>`<div class="card leader-card"><div class="leader-rank">${i+1}</div><h3 class="leader-name">${row.st.name}</h3><p class="leader-meta">${row.st.grade} - ${row.st.group||'بدون مجموعة'}</p><div class="leader-score">${row.calc.final}%</div><p style="color:var(--muted);font-weight:850">حضور ${row.calc.attendancePct}% · متوسط درجات ${row.calc.avg}% · واجبات ${row.calc.hwPct}%</p><span class="badge good">${row.calc.level}</span></div>`).join('');
}
renderPublicLeaderboard();
setTimeout(renderPublicLeaderboard,1200);


/* v15 cleanup upgrades: floating FAQ, scroll top, star ratings, real QR, QR scanner */
icons.arrowUp = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"></path><path d="M5 12l7-7 7 7"></path></svg>';
icons.messageCircle = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.1A8.5 8.5 0 1 1 21 11.5Z"></path></svg>';
icons.robot = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="7" width="14" height="11" rx="4"></rect><path d="M12 7V4"></path><circle cx="12" cy="3" r="1"></circle><path d="M8.5 12h.01"></path><path d="M15.5 12h.01"></path><path d="M9.5 15h5"></path><path d="M3.5 12H5"></path><path d="M19 12h1.5"></path></svg>';
icons.camera = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"></path><circle cx="12" cy="13" r="4"></circle></svg>';
function setupFloatingTools(){
  if(document.getElementById('floatingChatTools')) return;
  const chatWrap=document.createElement('div');
  chatWrap.className='floating-chat-tools'; chatWrap.id='floatingChatTools';
  chatWrap.innerHTML=`<button class="float-btn faq-open-btn robot-faq-btn" type="button" aria-label="المساعد الذكي" title="المساعد الذكي" data-open-faq><span data-icon="robot"></span></button>`;
  const topWrap=document.createElement('div');
  topWrap.className='floating-top-tools'; topWrap.id='floatingTopTools';
  topWrap.innerHTML=`<button class="float-btn scroll-top-btn pro-scroll-top" id="scrollTopBtn" type="button" aria-label="العودة لأول الموقع" title="العودة لأول الموقع"><span data-icon="arrow-up"></span></button>`;
  const panel=document.createElement('div'); panel.className='faq-chat-panel robot-chat-panel'; panel.id='faqChatPanel';
  panel.innerHTML=`<div class="faq-chat-head"><div class="robot-head-icon"><span data-icon="robot"></span></div><div><h3>مساعد مستر محمود</h3><p>إجابات سريعة عن الحجز وبوابة الطالب وولي الأمر</p></div><button class="faq-close" type="button" data-close-faq>×</button></div><div class="faq-chat-body"><details open><summary>الحجز بيتم إزاي؟</summary><p>الحجز من نموذج الموقع فقط. الطلب يظهر للمدرس في لوحة التحكم، وبعد القبول يتحول الطالب لقائمة الطلاب.</p></details><details><summary>هل الحجز يفتح واتساب؟</summary><p>لا، الحجز داخل الموقع فقط بدون فتح واتساب تلقائي. بيانات الطالب محفوظة في صفحة الحجوزات.</p></details><details><summary>أدخل بوابة الطالب بإيه؟</summary><p>تقدر تدخل بالكود، الاسم، رقم ولي الأمر، أو QR الموجود في كارت الطالب.</p></details><details><summary>QR الطالب بيعمل إيه؟</summary><p>يفتح بوابة الطالب مباشرة على ملفه باستخدام الرابط student.html?code= كود الطالب.</p></details><details><summary>ولي الأمر يقدر يتابع إيه؟</summary><p>تقرير مفصل فيه بيانات الطالب، حضور وغياب وتأخير، درجات، واجبات، حالة الدفع، وملاحظات المدرس.</p></details></div>`;
  document.body.append(panel,chatWrap,topWrap); hydrateIcons();
  const open=()=>panel.classList.add('show'); const close=()=>panel.classList.remove('show');
  document.querySelectorAll('[data-open-faq]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault(); open();}));
  document.querySelectorAll('[data-close-faq]').forEach(b=>b.addEventListener('click',close));
  const topBtn=document.getElementById('scrollTopBtn');
  topBtn?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
  const toggleTop=()=>{if(!topBtn)return; topBtn.classList.toggle('show',window.scrollY>420);};
  window.addEventListener('scroll',toggleTop,{passive:true}); toggleTop();
}
function setupStarInputs(){
  document.querySelectorAll('[data-star-input]').forEach(w=>{
    const hidden=w.querySelector('input[name="rating"]'); const label=w.querySelector('span'); const buttons=[...w.querySelectorAll('button[data-rate]')];
    const set=(v)=>{hidden.value=v; buttons.forEach(b=>b.classList.toggle('active',Number(b.dataset.rate)<=Number(v))); if(label)label.textContent=v+' نجوم';};
    buttons.forEach(b=>b.addEventListener('click',()=>set(b.dataset.rate))); set(hidden?.value||5);
  });
}
function renderReviewsV15(){
  const el=document.getElementById('reviewsList'); if(!el)return;
  const rows=(data.reviews||[]).filter(r=>r.approved!==false).slice(-8).reverse();
  el.innerHTML=rows.map(r=>{const rating=Number(r.rating||5); const initial=String(r.name||'زائر').trim().slice(0,1)||'★'; const role=r.role||'طالب'; return `<div class="card review-card-pro real-review-card"><div class="review-card-head"><div class="review-avatar">${initial}</div><div><h3>${r.name||'زائر'}</h3><span class="badge">${role}</span></div></div><div class="review-stars" aria-label="${rating} نجوم">${stars(rating)}</div><p class="review-text">“${r.text||''}”</p><div class="review-meta"><span>تقييم موثق</span><b>${rating}/5</b></div></div>`;}).join('') || '<div class="card review-card-pro real-review-card"><h3>لا توجد تقييمات منشورة حاليًا</h3><p class="review-text">سيتم نشر التقييمات بعد مراجعة المدرس.</p></div>';
}
function setupReviewsV15(){
  document.querySelectorAll('#reviewForm').forEach(old=>{
    const form=old.cloneNode(true); old.parentNode.replaceChild(form,old); form.classList.add('review-form-pro');
    setupStarInputs();
    form.addEventListener('submit',e=>{e.preventDefault(); const r=Object.fromEntries(new FormData(form).entries()); r.id=`rev-${Date.now()}`; r.date=today(); r.approved=false; data.reviews=data.reviews||[]; data.reviews.push(r); saveData(data); form.reset(); setupStarInputs(); renderReviewsV15(); toast('تم إرسال التقييم وسيظهر بعد موافقة المدرس');});
  });
  renderReviewsV15();
}
let qrLibLoading=null;
function loadQrLib(){
  if(window.QRCode) return Promise.resolve();
  if(qrLibLoading) return qrLibLoading;
  qrLibLoading=new Promise((res,rej)=>{const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s);});
  return qrLibLoading;
}
function studentQrValue(code){
  const base=location.origin + location.pathname.replace(/[^\/]*$/, '');
  return `${base}student.html?code=${encodeURIComponent(code||'')}`;
}
function makeQR(code=''){
  const value=studentQrValue(code);
  return `<div class="real-qr-wrap polished-qr" aria-label="QR الطالب"><div class="qr-frame"><canvas class="real-qr" data-qr="${value}" data-code="${code}"></canvas></div><div class="qr-caption"><b>${code||'كود الطالب'}</b><small>امسح الكود لفتح بوابة الطالب</small></div><a class="qr-link" href="${value}">فتح ملف الطالب</a></div>`;
}
async function renderRealQRCodes(){
  const canvases=[...document.querySelectorAll('canvas.real-qr[data-qr]')].filter(c=>!c.dataset.done);
  if(!canvases.length) return;
  try{await loadQrLib(); canvases.forEach(c=>{QRCode.toCanvas(c,c.dataset.qr,{width:150,margin:2,errorCorrectionLevel:'H',color:{dark:'#0d1730',light:'#ffffff'}},()=>{c.dataset.done='1';});});}
  catch(e){canvases.forEach(c=>{const img=document.createElement('img'); img.alt='QR الطالب'; img.className='real-qr-img'; img.src='https://api.qrserver.com/v1/create-qr-code/?size=180x180&data='+encodeURIComponent(c.dataset.qr); c.replaceWith(img);});}
}
const oldStudentCardV15 = studentCard;
studentCard=function(st){ return oldStudentCardV15(st); };
function renderStudentResult(st, box){ if(!box)return; box.innerHTML=st?studentCard(st):'<div class="empty-state"><span class="iconbox" data-icon="search"></span><h3>لم يتم العثور على الطالب</h3><p>تأكد من كتابة الكود أو الاسم أو رقم ولي الأمر بشكل صحيح.</p></div>'; hydrateIcons(); renderRealQRCodes(); }
setupStudent=function(){const form=document.getElementById('studentSearchForm'); if(!form)return; const params=new URLSearchParams(location.search); const code=params.get('code'); const box=document.getElementById('studentResult'); if(code){form.query.value=code; const st=findStudent(code); if(st&&box)renderStudentResult(st,box);} form.addEventListener('submit',e=>{e.preventDefault(); const st=findStudent(new FormData(form).get('query')); renderStudentResult(st,box);});};
const oldMarkAttendance=window.markAttendance;
window.markAttendance=function(code){ oldMarkAttendance(code); renderRealQRCodes(); };
const oldSubmitHomework=window.submitHomework;
window.submitHomework=async function(code,input){ await oldSubmitHomework(code,input); renderRealQRCodes(); };
let qrScanStream=null, qrScanLoop=null;
window.startStudentScanner=async function(){
  const box=document.getElementById('qrScannerBox'); const video=document.getElementById('qrScannerVideo'); const input=document.getElementById('studentQuery');
  if(!box||!video){toast('مسح QR متاح من صفحة بوابة الطالب'); return;}
  if(!('BarcodeDetector' in window)){toast('المتصفح لا يدعم مسح QR تلقائيًا، اكتب الكود يدويًا'); box.hidden=false; return;}
  try{
    box.hidden=false; qrScanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}); video.srcObject=qrScanStream; await video.play(); const detector=new BarcodeDetector({formats:['qr_code']});
    const scan=async()=>{ if(!qrScanStream)return; try{const codes=await detector.detect(video); if(codes&&codes.length){let raw=codes[0].rawValue||''; let code=raw; try{code=new URL(raw).searchParams.get('code')||raw;}catch(e){} if(input){input.value=code; document.getElementById('studentSearchForm')?.requestSubmit();} stopStudentScanner(); toast('تم قراءة QR بنجاح'); return;}}catch(e){} qrScanLoop=requestAnimationFrame(scan);}; scan();
  }catch(e){toast('لم يتم فتح الكاميرا. اكتب الكود يدويًا أو امنح صلاحية الكاميرا.');}
};
window.stopStudentScanner=function(){ if(qrScanLoop)cancelAnimationFrame(qrScanLoop); qrScanLoop=null; if(qrScanStream){qrScanStream.getTracks().forEach(t=>t.stop()); qrScanStream=null;} const box=document.getElementById('qrScannerBox'); if(box)box.hidden=true; };

/* v16 detailed parent report + mobile polished student card */
function attendanceSummary(st){
  const rows=st.attendance||[]; return {present:rows.filter(a=>a.status==='حاضر').length,absent:rows.filter(a=>a.status==='غائب').length,late:rows.filter(a=>a.status==='متأخر').length,total:rows.length};
}
function parentReport(st){
  const c=calcStudent(st); const att=attendanceSummary(st); const hw=st.homeworks||[]; const done=hw.filter(h=>h.status==='تم التسليم').length; const pending=Math.max(hw.length-done,0);
  const payClass=st.paid?'good':'danger'; const payText=st.paid?'مدفوع':'متأخر / غير مدفوع';
  const gradeRows=(st.grades||[]).slice().reverse().map(g=>`<tr><td>${g.exam}</td><td>${g.score===null||g.score===undefined?'في انتظار التصحيح':g.score+'%'}</td><td>${g.type||'-'}</td><td>${g.date||'-'}</td></tr>`).join('')||'<tr><td colspan="4">لا توجد درجات مسجلة</td></tr>';
  const attRows=(st.attendance||[]).slice().reverse().map(a=>`<tr><td>${a.date}</td><td><span class="badge ${a.status==='حاضر'?'good':a.status==='غائب'?'danger':'warn'}">${a.status}</span></td></tr>`).join('')||'<tr><td colspan="2">لا توجد سجلات حضور بعد</td></tr>';
  const hwRows=hw.slice().reverse().map(h=>`<tr><td>${h.title}</td><td><span class="badge ${h.status==='تم التسليم'?'good':'warn'}">${h.status||'-'}</span></td><td>${h.date||'-'}</td></tr>`).join('')||'<tr><td colspan="3">لا توجد واجبات مسجلة</td></tr>';
  const advice=c.final>=85?'ممتاز، حافظ على نفس مستوى الحل والمراجعة.':c.final>=70?'المستوى جيد، ركز على الواجبات والأسئلة المتكررة.':'محتاج خطة متابعة أقوى ومراجعة أسبوعية على الأساسيات.';
  return `<div class="print-area parent-report-pro" id="printReport"><div class="report-cover"><div><span class="badge good">تقرير ولي الأمر</span><h3>${st.name}</h3><p>${st.grade} · ${st.group||'بدون مجموعة'} · كود ${st.code}</p></div><span class="badge ${payClass}">${payText}</span></div><div class="metric-grid report-metrics"><div class="metric"><b>${c.attendancePct}%</b><small>نسبة الحضور</small></div><div class="metric"><b>${c.avg}%</b><small>متوسط الدرجات</small></div><div class="metric"><b>${done}/${hw.length||0}</b><small>الواجبات المسلمة</small></div><div class="metric"><b>${c.level}</b><small>المستوى العام</small></div></div><div class="grid grid-2 report-detail-grid"><div class="mini-panel"><h3>ملخص الحضور</h3><div class="mini-stats"><span>حاضر ${att.present}</span><span>غياب ${att.absent}</span><span>تأخير ${att.late}</span></div><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحالة</th></tr></thead><tbody>${attRows}</tbody></table></div></div><div class="mini-panel"><h3>الدرجات والامتحانات</h3><div class="table-wrap"><table><thead><tr><th>الامتحان</th><th>الدرجة</th><th>النوع</th><th>التاريخ</th></tr></thead><tbody>${gradeRows}</tbody></table></div></div><div class="mini-panel"><h3>الواجبات والمتابعة</h3><div class="mini-stats"><span>مسلم ${done}</span><span>متبقي ${pending}</span></div><div class="table-wrap"><table><thead><tr><th>الواجب</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${hwRows}</tbody></table></div></div><div class="mini-panel teacher-note"><h3>ملاحظات وخطة الشهر</h3><p><b>ملاحظة المدرس:</b> ${st.notes||'لا توجد ملاحظات حالية'}</p><p><b>التوصية:</b> ${advice}</p><p><b>حالة الدفع:</b> ${payText}</p></div></div></div><button class="btn primary report-print-btn" onclick="window.print()"><span data-icon="file-text"></span> طباعة / حفظ التقرير PDF</button>`;
}
const oldStudentCardV16 = studentCard;
studentCard=function(st){
  const html=oldStudentCardV16(st);
  return html.replace('class="student-profile student-dashboard"','class="student-profile student-dashboard student-dashboard-pro"');
};

function applyV15(){setupFloatingTools(); setupReviewsV15(); setupStarInputs(); setupStudent(); renderRealQRCodes(); setTimeout(renderRealQRCodes,500);}
applyV15();


/* v24: secure student portal, teacher-only attendance, recitation tracking, robust QR */
function v24Escape(v){
  return String(v ?? '').replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
}
function studentQrValue(code){
  const root = location.origin || '';
  const portal = new URL('/student.html', root || location.href);
  portal.searchParams.set('code', String(code || '').trim());
  return portal.href;
}
function makeQR(code=''){
  const value = studentQrValue(code);
  return `<div class="real-qr-wrap polished-qr student-qr-card-v24" aria-label="QR الطالب">
    <div class="qr-frame"><canvas class="real-qr" data-qr="${v24Escape(value)}" data-code="${v24Escape(code)}"></canvas></div>
    <div class="qr-caption"><b>${v24Escape(code || 'كود الطالب')}</b><small>يفتح بوابة الطالب مباشرة</small></div>
    <a class="qr-link" href="${v24Escape(value)}">فتح الملف</a>
  </div>`;
}
function recitationSummary(st){
  const rows = st.recitations || [];
  const heard = rows.filter(r => r.status === 'سمع').length;
  const notHeard = rows.filter(r => r.status === 'لم يسمع').length;
  const absent = rows.filter(r => r.status === 'لم يحضر' || r.status === 'غائب').length;
  const total = Math.max(rows.filter(r => r.status !== 'غير مطلوب').length, 1);
  return {heard, notHeard, absent, total: rows.length, pct: Math.round((heard / total) * 100)};
}
function studentCard(st){
  const c = calcStudent(st);
  const att = attendanceSummary(st);
  const rec = recitationSummary(st);
  const graded = (st.grades || []).filter(g => g.score !== null && g.score !== undefined && g.score !== '' && !isNaN(Number(g.score)));
  const lastGrade = graded.length ? graded[graded.length - 1] : null;
  const payClass = st.paid ? 'good' : 'danger';
  const payText = st.paid ? 'مدفوع' : 'غير مدفوع / يحتاج متابعة';
  const attendanceRows = (st.attendance || []).slice().reverse().map(a => `<tr><td>${v24Escape(a.date || '-')}</td><td><span class="badge ${a.status === 'حاضر' ? 'good' : a.status === 'غائب' ? 'danger' : 'warn'}">${v24Escape(a.status || '-')}</span></td><td>${v24Escape(a.note || '')}</td></tr>`).join('') || '<tr><td colspan="3">لم يسجل المدرس حضورًا بعد</td></tr>';
  const recitationRows = (st.recitations || []).slice().reverse().map(r => `<tr><td>${v24Escape(r.date || '-')}</td><td>${v24Escape(r.lesson || 'حصة')}</td><td><span class="badge ${r.status === 'سمع' ? 'good' : r.status === 'لم يسمع' ? 'warn' : r.status === 'لم يحضر' ? 'danger' : ''}">${v24Escape(r.status || '-')}</span></td><td>${v24Escape(r.note || '')}</td></tr>`).join('') || '<tr><td colspan="4">لم يسجل المدرس تسميعًا بعد</td></tr>';
  const gradeRows = (st.grades || []).slice().reverse().map(g => `<tr><td>${v24Escape(g.exam || '-')}</td><td>${g.score === null || g.score === undefined ? 'في انتظار التصحيح' : v24Escape(g.score) + '%'}</td><td>${v24Escape(g.type || '-')}</td><td>${v24Escape(g.date || '-')}</td></tr>`).join('') || '<tr><td colspan="4">لا توجد درجات مسجلة</td></tr>';
  const homeworkRows = (st.homeworks || []).slice().reverse().map(h => `<tr><td>${v24Escape(h.title || 'واجب')}</td><td><span class="badge ${h.status === 'تم التسليم' ? 'good' : 'warn'}">${v24Escape(h.status || '-')}</span></td><td>${v24Escape(h.date || '-')}</td></tr>`).join('') || '<tr><td colspan="3">لا توجد واجبات مسجلة</td></tr>';
  const safeCode = String(st.code || '').replace(/[^a-zA-Z0-9_-]/g,'');
  return `<div class="student-profile-v24">
    <div class="student-top-v24">
      <div class="student-main-v24">
        <span class="badge good">${v24Escape(st.code)}</span>
        <h2>${v24Escape(st.name)}</h2>
        <p>${v24Escape(st.grade)} · ${v24Escape(st.group || 'بدون مجموعة')} · ${v24Escape(st.month || 'الشهر الحالي')}</p>
        <div class="student-tags-v24"><span class="badge ${payClass}">${payText}</span><span class="badge">الحضور والتسميع يسجلهم المدرس فقط</span></div>
      </div>
      ${makeQR(st.code)}
    </div>
    <div class="metric-grid student-metrics-v24">
      <div class="metric"><b>${c.attendancePct}%</b><small>نسبة الحضور</small></div>
      <div class="metric"><b>${att.absent}</b><small>أيام الغياب</small></div>
      <div class="metric"><b>${rec.pct}%</b><small>التسميع</small></div>
      <div class="metric"><b>${c.avg}%</b><small>متوسط الدرجات</small></div>
    </div>
    <div class="student-status-card-v24"><div><b>المستوى العام</b><span>${v24Escape(c.level)}</span></div><div class="progress"><span style="width:${Math.max(4, Math.min(100, c.final))}%"></span></div><p>${lastGrade ? 'آخر نتيجة: ' + v24Escape(lastGrade.exam || 'امتحان') + ' - ' + v24Escape(lastGrade.score) + '%' : 'لم يتم تسجيل نتيجة حديثة بعد.'}</p></div>
    <div class="student-actions student-actions-v24">
      <a class="btn gold" href="exams.html?code=${encodeURIComponent(st.code)}"><span data-icon="clipboard"></span> الامتحانات والنتائج</a>
      <button class="btn ghost" onclick="toggleStudentPanel('attendance-${safeCode}')"><span data-icon="calendar"></span> الحضور</button>
      <button class="btn ghost" onclick="toggleStudentPanel('recitation-${safeCode}')"><span data-icon="user-check"></span> التسميع</button>
      <label class="btn ghost" style="cursor:pointer"><span data-icon="file-text"></span> رفع واجب<input type="file" accept="image/*,.pdf" capture="environment" style="display:none" onchange="submitHomework('${v24Escape(st.code)}', this)"></label>
    </div>
    <div class="student-sections-v24">
      <section class="mini-panel" id="attendance-${safeCode}"><h3>سجل الحضور</h3><div class="mini-stats"><span>حاضر ${att.present}</span><span>غياب ${att.absent}</span><span>تأخير ${att.late}</span></div><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحالة</th><th>ملاحظة</th></tr></thead><tbody>${attendanceRows}</tbody></table></div></section>
      <section class="mini-panel" id="recitation-${safeCode}"><h3>سجل التسميع</h3><div class="mini-stats"><span>سمع ${rec.heard}</span><span>لم يسمع ${rec.notHeard}</span><span>لم يحضر ${rec.absent}</span></div><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحصة</th><th>الحالة</th><th>ملاحظة</th></tr></thead><tbody>${recitationRows}</tbody></table></div></section>
      <section class="mini-panel"><h3>الدرجات</h3><div class="table-wrap"><table><thead><tr><th>الامتحان</th><th>الدرجة</th><th>النوع</th><th>التاريخ</th></tr></thead><tbody>${gradeRows}</tbody></table></div></section>
      <section class="mini-panel"><h3>الواجبات</h3><div class="homework-wide-layout"><label class="upload-zone"><span data-icon="file-text"></span><strong>رفع واجب</strong><small>PDF أو صورة</small><input type="file" accept="image/*,.pdf" capture="environment" onchange="submitHomework('${v24Escape(st.code)}', this)"></label><div class="table-wrap"><table><thead><tr><th>الواجب</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${homeworkRows}</tbody></table></div></div></section>
      <section class="mini-panel teacher-note"><h3>ملاحظات المدرس</h3><p>${v24Escape(st.notes || 'لا توجد ملاحظات حالية')}</p></section>
    </div>
  </div>`;
}
window.markAttendance = function(){
  toast('الحضور والغياب والتسميع يتم تسجيلهم من لوحة المدرس فقط أثناء الحصة');
};
function renderStudentResult(st, box){
  if(!box) return;
  box.innerHTML = st ? studentCard(st) : '<div class="empty-state"><span class="iconbox" data-icon="search"></span><h3>لم يتم العثور على الطالب</h3><p>تأكد من كتابة الكود أو الاسم أو رقم ولي الأمر بشكل صحيح.</p></div>';
  hydrateIcons(); renderRealQRCodes();
}
setupStudent=function(){
  const form=document.getElementById('studentSearchForm'); if(!form)return;
  const params=new URLSearchParams(location.search); const code=params.get('code'); const box=document.getElementById('studentResult');
  if(code){form.query.value=code; const st=findStudent(code); if(st&&box)renderStudentResult(st,box);}
  form.addEventListener('submit',e=>{e.preventDefault(); const st=findStudent(new FormData(form).get('query')); renderStudentResult(st,box);});
};
window.startStudentScanner=async function(){
  const box=document.getElementById('qrScannerBox'); const video=document.getElementById('qrScannerVideo'); const input=document.getElementById('studentQuery');
  if(!box||!video){toast('مسح QR متاح من صفحة بوابة الطالب'); return;}
  if(!('BarcodeDetector' in window)){toast('المتصفح لا يدعم مسح QR تلقائيًا، اكتب الكود يدويًا'); box.hidden=false; return;}
  try{
    box.hidden=false; qrScanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}); video.srcObject=qrScanStream; await video.play(); const detector=new BarcodeDetector({formats:['qr_code']});
    const scan=async()=>{ if(!qrScanStream)return; try{const codes=await detector.detect(video); if(codes&&codes.length){let raw=(codes[0].rawValue||'').trim(); let code=raw; try{const u=new URL(raw); code=u.searchParams.get('code') || raw;}catch(e){} if(input){input.value=code; document.getElementById('studentSearchForm')?.requestSubmit();} stopStudentScanner(); toast('تم قراءة QR وفتح ملف الطالب'); return;}}catch(e){} qrScanLoop=requestAnimationFrame(scan);}; scan();
  }catch(e){toast('لم يتم فتح الكاميرا. اكتب الكود يدويًا أو امنح صلاحية الكاميرا.');}
};
try{setupStudent(); renderRealQRCodes();}catch(e){console.warn('v24 student setup failed',e);}


/* v25: simplified platform, stable QR domain, groups schedule, payments, assignments and parent report */
var DEFAULT_SITE_URL = 'https://mahmoud-fawzy-science-platform.vercel.app';
function v25Safe(v){return String(v ?? '').replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
function isoDate(){return new Date().toISOString().slice(0,10);}
function normalizeSiteUrl(url){
  let value = String(url || '').trim();
  if(!value) return DEFAULT_SITE_URL;
  if(!/^https?:\/\//i.test(value)) value = 'https://' + value;
  return value.replace(/\/+$/,'');
}
function getSiteBase(){
  const fromSettings = data?.settings?.siteUrl || DEFAULT_SITE_URL;
  if(location.hostname === 'localhost' || location.hostname === '127.0.0.1') return normalizeSiteUrl(fromSettings);
  return normalizeSiteUrl(fromSettings || location.origin);
}
function v25Defaults(d){
  d = d || {};
  d.settings = {...(d.settings||{}), heroTitle: d.settings?.heroTitle || 'رحلة تفوق واضحة مع مستر محمود ابراهيم فوزي', siteUrl: d.settings?.siteUrl || DEFAULT_SITE_URL};
  d.groups = d.groups && d.groups.length ? d.groups : [
    {id:'grp-1', name:'مجموعة السبت والثلاثاء', grade:'أولى إعدادي', days:'السبت والثلاثاء', time:'5:00 مساءً', place:'السنتر', notes:'علوم'},
    {id:'grp-2', name:'مجموعة الأحد والأربعاء', grade:'تانية إعدادي', days:'الأحد والأربعاء', time:'6:00 مساءً', place:'السنتر', notes:'علوم'},
    {id:'grp-3', name:'مجموعة الاثنين والخميس', grade:'تالتة ثانوي', days:'الاثنين والخميس', time:'7:00 مساءً', place:'السنتر', notes:'أحياء'}
  ];
  d.assignments = d.assignments && d.assignments.length ? d.assignments : [
    {id:'ass-1', title:'واجب الدرس الأول', grade:'أولى إعدادي', group:'كل المجموعات', dueDate:'', desc:'حل أسئلة الدرس ورفع صورة الحل من بوابة الطالب.'},
    {id:'ass-2', title:'تسميع مصطلحات الباب الأول', grade:'تالتة ثانوي', group:'كل المجموعات', dueDate:'', desc:'مراجعة المصطلحات الأساسية قبل الحصة القادمة.'}
  ];
  (d.students||[]).forEach(st=>{
    if(st.grade === 'تانية ثانوي') st.grade = 'أولى ثانوي';
    st.recitations = st.recitations || [];
    st.homeworks = st.homeworks || [];
    st.attendance = st.attendance || [];
    st.paid = !!st.paid;
    st.paymentDate = st.paymentDate || '';
    st.paymentNote = st.paymentNote || '';
  });
  (d.bookings||[]).forEach(b=>{ if(b.grade === 'تانية ثانوي') b.grade = 'أولى ثانوي'; });
  ['materials','questions','exams'].forEach(k=>(d[k]||[]).forEach(x=>{ if(x.grade === 'تانية ثانوي') x.grade='أولى ثانوي'; }));
  return d;
}
const oldMergeDataV25 = mergeData;
mergeData = function(parsed){ return v25Defaults(oldMergeDataV25(parsed || {})); };
data = v25Defaults(data);
saveData(data);
function fillSelects(){
  document.querySelectorAll('[data-grade-select]').forEach(g=>g.innerHTML=GRADES.map(x=>`<option>${x}</option>`).join(''));
  const g=document.getElementById('bookingGrade'); const m=document.getElementById('bookingMonth'); const groupSelect=document.querySelector('#bookingForm select[name="group"]');
  if(g)g.innerHTML=GRADES.map(x=>`<option>${x}</option>`).join('');
  if(m)m.innerHTML=MONTHS.map(x=>`<option>${x}</option>`).join('');
  if(groupSelect){
    const groups = (data.groups||[]).map(x=>x.name).filter(Boolean);
    const uniq=[...new Set([...groups,'أونلاين متابعة'])];
    groupSelect.innerHTML=uniq.map(x=>`<option>${v25Safe(x)}</option>`).join('');
  }
}
function renderHomeCounts(){
  const el=document.getElementById('liveCounts'); if(!el)return;
  const openExams=(data.exams||[]).filter(e=>e.status==='مفتوح').length;
  el.innerHTML=`<div class="stat"><b>${(data.groups||[]).length}</b><small>مجموعات منظمة</small></div><div class="stat"><b>${(data.assignments||[]).length}</b><small>واجبات متابعة</small></div><div class="stat"><b>${openExams}</b><small>امتحانات مفتوحة</small></div>`;
}
function renderBookingPreview(){
  const el=document.getElementById('bookingPreview'); if(!el)return; const rows=[...(data.bookings||[])].slice(-5).reverse();
  el.innerHTML=`<table><thead><tr><th>الكود</th><th>الطالب</th><th>الصف</th><th>الشهر</th><th>المجموعة</th><th>الحالة</th></tr></thead><tbody>${rows.length?rows.map(b=>`<tr><td>${v25Safe(b.code)}</td><td>${v25Safe(b.name)}</td><td>${v25Safe(b.grade)}</td><td>${v25Safe(b.month)}</td><td>${v25Safe(b.group)}</td><td>${v25Safe(b.status||'حجز جديد')}</td></tr>`).join(''):`<tr><td colspan="6">لسه مفيش حجوزات جديدة.</td></tr>`}</tbody></table>`;
}
function studentQrValue(code){
  const portal = new URL('/student.html', getSiteBase() + '/');
  portal.searchParams.set('code', String(code || '').trim());
  return portal.href;
}
function makeQR(code=''){
  const value = studentQrValue(code);
  return `<div class="real-qr-wrap polished-qr student-qr-card-v25" aria-label="QR الطالب">
    <div class="qr-frame"><canvas class="real-qr" data-qr="${v25Safe(value)}" data-code="${v25Safe(code)}"></canvas></div>
    <div class="qr-caption"><b>${v25Safe(code || 'كود الطالب')}</b><small>يفتح بوابة الطالب على الدومين الأساسي</small></div>
    <a class="qr-link" href="${v25Safe(value)}" target="_blank" rel="noreferrer">فتح الملف</a>
  </div>`;
}
function findGroupForStudent(st){
  const groups=data.groups||[];
  return groups.find(g=>g.name===st.group && (!g.grade || g.grade===st.grade)) || groups.find(g=>g.name===st.group) || null;
}
function getAssignmentsForStudent(st){
  return (data.assignments||[]).filter(a => (!a.grade || a.grade===st.grade) && (!a.group || a.group==='كل المجموعات' || a.group===st.group));
}
function assignmentStatus(st, assignment){
  const rows=st.homeworks||[];
  const found=rows.find(h=>h.assignmentId===assignment.id || h.title===assignment.title);
  return found || null;
}
function recitationSummary(st){
  const rows = st.recitations || [];
  const heard = rows.filter(r => r.status === 'سمع').length;
  const notHeard = rows.filter(r => r.status === 'لم يسمع').length;
  const absent = rows.filter(r => r.status === 'لم يحضر' || r.status === 'غائب').length;
  const total = Math.max(rows.filter(r => r.status !== 'غير مطلوب').length, 1);
  return {heard, notHeard, absent, total: rows.length, pct: Math.round((heard / total) * 100)};
}
function studentCard(st){
  const c=calcStudent(st); const att=attendanceSummary(st); const rec=recitationSummary(st); const group=findGroupForStudent(st); const assignments=getAssignmentsForStudent(st);
  const safeCode=String(st.code||'').replace(/[^a-zA-Z0-9_-]/g,'');
  const payText=st.paid?'مدفوع':'لم يدفع';
  const payClass=st.paid?'good':'danger';
  const lastGrade=(st.grades||[]).filter(g=>g.score!==null && g.score!==undefined && g.score!=='' && !isNaN(Number(g.score))).slice(-1)[0];
  const attendanceRows=(st.attendance||[]).slice().reverse().map(a=>`<tr><td>${v25Safe(a.date||'-')}</td><td><span class="badge ${a.status==='حاضر'?'good':a.status==='غائب'?'danger':'warn'}">${v25Safe(a.status||'-')}</span></td><td>${v25Safe(a.lesson||'-')}</td><td>${v25Safe(a.note||'')}</td></tr>`).join('')||'<tr><td colspan="4">لم يسجل المدرس حضورًا بعد</td></tr>';
  const recitationRows=(st.recitations||[]).slice().reverse().map(r=>`<tr><td>${v25Safe(r.date||'-')}</td><td>${v25Safe(r.lesson||'حصة')}</td><td><span class="badge ${r.status==='سمع'?'good':r.status==='لم يسمع'?'warn':r.status==='لم يحضر'?'danger':''}">${v25Safe(r.status||'-')}</span></td><td>${v25Safe(r.note||'')}</td></tr>`).join('')||'<tr><td colspan="4">لم يسجل المدرس تسميعًا بعد</td></tr>';
  const gradeRows=(st.grades||[]).slice().reverse().map(g=>`<tr><td>${v25Safe(g.exam||'-')}</td><td>${g.score===null||g.score===undefined?'في انتظار التصحيح':v25Safe(g.score)+'%'}</td><td>${v25Safe(g.type||'-')}</td><td>${v25Safe(g.date||'-')}</td></tr>`).join('')||'<tr><td colspan="4">لا توجد درجات مسجلة</td></tr>';
  const assignmentRows=assignments.map(a=>{const sub=assignmentStatus(st,a); return `<tr><td><b>${v25Safe(a.title)}</b><br><small>${v25Safe(a.desc||'')}</small></td><td>${v25Safe(a.dueDate||'بدون موعد')}</td><td><span class="badge ${sub?'good':'warn'}">${sub?'تم التسليم':'مطلوب'}</span></td><td><label class="small-btn primary" style="cursor:pointer">رفع<input type="file" accept="image/*,.pdf" capture="environment" style="display:none" onchange="submitAssignment('${v25Safe(st.code)}','${v25Safe(a.id)}', this)"></label></td></tr>`;}).join('') || '<tr><td colspan="4">لا توجد واجبات مطلوبة حاليًا</td></tr>';
  const homeworkRows=(st.homeworks||[]).slice().reverse().map(h=>`<tr><td>${v25Safe(h.title||'واجب')}</td><td><span class="badge ${h.status==='تم التسليم'?'good':'warn'}">${v25Safe(h.status||'-')}</span></td><td>${v25Safe(h.date||'-')}</td></tr>`).join('')||'<tr><td colspan="3">لا توجد تسليمات بعد</td></tr>';
  const groupBox=group?`<div class="mini-panel student-schedule-box"><h3>جدول المجموعة</h3><div class="mini-stats"><span>${v25Safe(group.days||'-')}</span><span>${v25Safe(group.time||'-')}</span><span>${v25Safe(group.place||'-')}</span></div><p>${v25Safe(group.notes||'')}</p></div>`:`<div class="mini-panel student-schedule-box"><h3>جدول المجموعة</h3><p>لم يتم تحديد جدول لهذه المجموعة بعد.</p></div>`;
  return `<div class="student-profile-v25">
    <div class="student-cover-v25">
      <div><span class="badge good">${v25Safe(st.code)}</span><h2>${v25Safe(st.name)}</h2><p>${v25Safe(st.grade)} · ${v25Safe(st.group||'بدون مجموعة')} · ${v25Safe(st.month||'الشهر الحالي')}</p><div class="student-tags-v24"><span class="badge ${payClass}">${payText}</span><span class="badge">الحضور والتسميع من المدرس فقط</span></div></div>
      ${makeQR(st.code)}
    </div>
    <div class="metric-grid student-metrics-v25"><div class="metric"><b>${c.attendancePct}%</b><small>الحضور</small></div><div class="metric"><b>${att.absent}</b><small>غياب</small></div><div class="metric"><b>${rec.pct}%</b><small>التسميع</small></div><div class="metric"><b>${c.avg}%</b><small>الدرجات</small></div></div>
    <div class="student-status-card-v24"><div><b>المستوى العام</b><span>${v25Safe(c.level)}</span></div><div class="progress"><span style="width:${Math.max(4,Math.min(100,c.final))}%"></span></div><p>${lastGrade?'آخر نتيجة: '+v25Safe(lastGrade.exam)+' - '+v25Safe(lastGrade.score)+'%':'لم يتم تسجيل نتيجة حديثة بعد.'}</p></div>
    <div class="student-actions student-actions-v25"><button class="btn ghost" onclick="toggleStudentPanel('attendance-${safeCode}')"><span data-icon="calendar"></span> الحضور</button><button class="btn ghost" onclick="toggleStudentPanel('recitation-${safeCode}')"><span data-icon="user-check"></span> التسميع</button><button class="btn ghost" onclick="toggleStudentPanel('assignments-${safeCode}')"><span data-icon="file-text"></span> الواجبات</button><button class="btn primary" onclick="window.print()"><span data-icon="file-text"></span> طباعة التقرير</button></div>
    <div class="student-sections-v25">
      ${groupBox}
      <section class="mini-panel" id="attendance-${safeCode}"><h3>الحضور</h3><div class="mini-stats"><span>حاضر ${att.present}</span><span>غياب ${att.absent}</span><span>تأخير ${att.late}</span></div><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحالة</th><th>الحصة</th><th>ملاحظة</th></tr></thead><tbody>${attendanceRows}</tbody></table></div></section>
      <section class="mini-panel" id="recitation-${safeCode}"><h3>التسميع</h3><div class="mini-stats"><span>سمع ${rec.heard}</span><span>لم يسمع ${rec.notHeard}</span><span>لم يحضر ${rec.absent}</span></div><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحصة</th><th>الحالة</th><th>ملاحظة</th></tr></thead><tbody>${recitationRows}</tbody></table></div></section>
      <section class="mini-panel"><h3>الدرجات</h3><div class="table-wrap"><table><thead><tr><th>الامتحان</th><th>الدرجة</th><th>النوع</th><th>التاريخ</th></tr></thead><tbody>${gradeRows}</tbody></table></div></section>
      <section class="mini-panel" id="assignments-${safeCode}"><h3>الواجبات المطلوبة</h3><div class="table-wrap"><table><thead><tr><th>الواجب</th><th>آخر موعد</th><th>الحالة</th><th>رفع</th></tr></thead><tbody>${assignmentRows}</tbody></table></div><h3 style="margin-top:16px">تسليمات الطالب</h3><div class="table-wrap"><table><thead><tr><th>الملف</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${homeworkRows}</tbody></table></div></section>
      <section class="mini-panel teacher-note"><h3>ملاحظات المدرس</h3><p>${v25Safe(st.notes||'لا توجد ملاحظات حالية')}</p><p><b>حالة الدفع:</b> ${payText}${st.paymentDate?' · آخر دفع: '+v25Safe(st.paymentDate):''}</p></section>
    </div>
  </div>`;
}
window.submitAssignment=async function(code, assignmentId, input){
  const st=data.students.find(s=>s.code===code); if(!st)return; const assignment=(data.assignments||[]).find(a=>a.id===assignmentId); const file=input.files?.[0];
  st.homeworks=st.homeworks||[]; const hw={assignmentId, title: assignment?.title || file?.name || 'واجب', status:'تم التسليم', date:today(), fileName:file?.name||''}; st.homeworks.push(hw); saveData(data);
  if(file && window.MFCloud?.uploadHomework){try{const up=await window.MFCloud.uploadHomework(file,code); Object.assign(hw,{fileUrl:up.url,filePath:up.path}); saveData(data);}catch(e){console.warn('Homework upload failed',e);}}
  const r=document.getElementById('studentResult'); if(r) r.innerHTML=studentCard(st); hydrateIcons(); renderRealQRCodes(); toast('تم رفع الواجب بنجاح');
};
window.submitHomework=async function(code,input){return window.submitAssignment(code,'manual-'+Date.now(),input)};
function parentReport(st){
  return studentCard(st) + `<button class="btn primary report-print-btn" onclick="window.print()"><span data-icon="file-text"></span> طباعة / حفظ التقرير PDF</button>`;
}
function setupStudent(){
  const form=document.getElementById('studentSearchForm'); if(!form)return; const params=new URLSearchParams(location.search); const code=params.get('code'); const box=document.getElementById('studentResult');
  if(code){form.query.value=code; const st=findStudent(code); renderStudentResult(st,box);}
  form.addEventListener('submit',e=>{e.preventDefault(); const st=findStudent(new FormData(form).get('query')); renderStudentResult(st,box);});
}
function renderStudentResult(st, box){
  if(!box)return; box.innerHTML=st?studentCard(st):'<div class="empty-state"><span class="iconbox" data-icon="search"></span><h3>لم يتم العثور على الطالب</h3><p>تأكد من كتابة الكود أو الاسم أو رقم ولي الأمر بشكل صحيح.</p></div>'; hydrateIcons(); renderRealQRCodes();
}
function setupParent(){const form=document.getElementById('parentSearchForm'); if(!form)return; form.addEventListener('submit',e=>{e.preventDefault(); const st=findStudent(new FormData(form).get('query')); const box=document.getElementById('parentResult'); box.innerHTML=st?parentReport(st):'<p style="color:var(--muted);font-weight:800">لم يتم العثور على الطالب.</p>'; hydrateIcons(); renderRealQRCodes();});}
function setupBooking(){
  const form=document.getElementById('bookingForm'); if(!form)return;
  form.addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(form); const b=Object.fromEntries(fd.entries()); b.id=b.code=uid(); b.date=today(); b.status='حجز جديد'; b.subject='علوم'; data.bookings=data.bookings||[]; data.bookings.push(b); saveData(data); if(window.MFCloud?.createBooking){try{await window.MFCloud.createBooking(b);}catch(err){console.warn('Public booking save failed',err);}} renderBookingPreview(); renderHomeCounts(); form.reset(); fillSelects(); toast('تم تسجيل الحجز على الموقع بنجاح');});
}
function setupV25(){data=v25Defaults(data); saveData(data); fillSelects(); renderHomeCounts(); renderBookingPreview(); setupStudent(); setupParent(); renderRealQRCodes(); setTimeout(renderRealQRCodes,500);}
try{setupV25();}catch(e){console.warn('v25 setup failed',e);}


/* v28 booking privacy + student booking code */
function bookingSafe(value){return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
function findBookingByCode(code){
  const q=String(code||'').trim().toLowerCase();
  if(!q) return null;
  return (data.bookings||[]).find(b=>String(b.code||b.id||'').trim().toLowerCase()===q) || null;
}
function bookingStatusBadge(status){
  const s=status||'حجز جديد';
  const cls=s==='تم القبول'?'good':(s==='مرفوض'?'danger':(s==='تم التواصل'?'warn':''));
  return `<span class="badge ${cls}">${bookingSafe(s)}</span>`;
}
function renderBookingPreview(){
  const el=document.getElementById('bookingPreview');
  if(!el)return;
  el.innerHTML='<span data-icon="user-check"></span><b>خصوصية كاملة:</b> لا يتم عرض أي قائمة حجوزات أو أسماء طلاب على الصفحة العامة. كل طالب يتابع حالة طلبه بالكود فقط.';
  hydrateIcons();
}
function renderBookingSuccess(b){
  const box=document.getElementById('bookingSuccess');
  if(!box)return;
  const code=bookingSafe(b.code||b.id||'');
  box.hidden=false;
  box.innerHTML=`<div class="booking-success-inner">
    <span class="success-mark" data-icon="user-check"></span>
    <div><h4>تم تسجيل طلب الحجز بنجاح</h4><p>احتفظ بالكود التالي لمتابعة حالة الحجز.</p></div>
  </div>
  <div class="booking-code-pill"><b id="lastBookingCode">${code}</b><button type="button" class="small-btn primary" onclick="copyBookingCode('${code}')">نسخ</button></div>`;
  hydrateIcons();
}
window.copyBookingCode=function(code){
  const value=String(code||'');
  if(navigator.clipboard){navigator.clipboard.writeText(value).then(()=>toast('تم نسخ كود الحجز'));}
  else {toast('كود الحجز: '+value);}
};
function renderBookingStatusResult(b){
  const box=document.getElementById('bookingStatusResult');
  if(!box)return;
  if(!b){box.innerHTML='<div class="booking-status-card warn"><b>لم يتم العثور على حجز بهذا الكود</b><small>تأكد من كتابة الكود كما ظهر بعد التسجيل.</small></div>';return;}
  box.innerHTML=`<div class="booking-status-card">
    <div><small>كود الحجز</small><b>${bookingSafe(b.code||b.id)}</b></div>
    <div><small>اسم الطالب</small><b>${bookingSafe(b.name||'-')}</b></div>
    <div><small>الصف</small><b>${bookingSafe(b.grade||'-')}</b></div>
    <div><small>الحالة</small>${bookingStatusBadge(b.status)}</div>
  </div>`;
}
function setupBooking(){
  const form=document.getElementById('bookingForm');
  if(form && !form.dataset.v28Ready){
    form.dataset.v28Ready='1';
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const fd=new FormData(form);
      const b=Object.fromEntries(fd.entries());
      b.id=b.code=uid();
      b.date=today();
      b.status='حجز جديد';
      b.subject='علوم';
      data.bookings=data.bookings||[];
      data.bookings.push(b);
      saveData(data);
      if(window.MFCloud?.createBooking){
        try{await window.MFCloud.createBooking(b);}catch(err){console.warn('Public booking save failed',err);}
      }
      renderBookingSuccess(b);
      renderBookingPreview();
      renderHomeCounts();
      form.reset();
      fillSelects();
      toast('تم تسجيل الحجز، احتفظ بالكود لمتابعة الطلب');
      document.getElementById('bookingSuccess')?.scrollIntoView({behavior:'smooth',block:'center'});
    });
  }
  const statusForm=document.getElementById('bookingStatusForm');
  if(statusForm && !statusForm.dataset.v28Ready){
    statusForm.dataset.v28Ready='1';
    statusForm.addEventListener('submit',e=>{
      e.preventDefault();
      const code=new FormData(statusForm).get('code');
      renderBookingStatusResult(findBookingByCode(code));
    });
  }
}


/* v29: separate parent page + cleaner student portal */
function v29Esc(v){return String(v ?? '').replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
function v29BadgeStatus(status){return `<span class="badge ${status==='حاضر'||status==='سمع'||status==='تم التسليم'?'good':status==='غائب'||status==='لم يحضر'||status==='لم يدفع'?'danger':status==='متأخر'||status==='لم يسمع'||status==='مطلوب'?'warn':''}">${v29Esc(status||'-')}</span>`;}
function v29Rows(rows, cols){return rows && rows.length ? rows.join('') : `<tr><td colspan="${cols}">لا توجد بيانات مسجلة حاليًا</td></tr>`;}
function studentCard(st){
  const c=calcStudent(st), att=attendanceSummary(st), rec=recitationSummary(st), group=findGroupForStudent(st), assignments=getAssignmentsForStudent(st);
  const safeCode=String(st.code||'').replace(/[^a-zA-Z0-9_-]/g,'');
  const payText=st.paid?'تم الدفع':'لم يدفع';
  const lastGrade=(st.grades||[]).filter(g=>g.score!==null && g.score!==undefined && g.score!=='' && !isNaN(Number(g.score))).slice(-1)[0];
  const attendanceRows=(st.attendance||[]).slice().reverse().map(a=>`<tr><td>${v29Esc(a.date||'-')}</td><td>${v29BadgeStatus(a.status)}</td><td>${v29Esc(a.lesson||'-')}</td><td>${v29Esc(a.note||'')}</td></tr>`);
  const recitationRows=(st.recitations||[]).slice().reverse().map(r=>`<tr><td>${v29Esc(r.date||'-')}</td><td>${v29Esc(r.lesson||'حصة')}</td><td>${v29BadgeStatus(r.status)}</td><td>${v29Esc(r.note||'')}</td></tr>`);
  const gradeRows=(st.grades||[]).slice().reverse().map(g=>`<tr><td>${v29Esc(g.exam||'-')}</td><td>${g.score===null||g.score===undefined?'في انتظار التصحيح':v29Esc(g.score)+'%'}</td><td>${v29Esc(g.type||'-')}</td><td>${v29Esc(g.date||'-')}</td></tr>`);
  const assignmentRows=assignments.map(a=>{const sub=assignmentStatus(st,a); return `<tr><td><b>${v29Esc(a.title)}</b><small>${v29Esc(a.desc||'')}</small></td><td>${v29Esc(a.dueDate||'بدون موعد')}</td><td>${v29BadgeStatus(sub?'تم التسليم':'مطلوب')}</td><td><label class="small-btn primary" style="cursor:pointer">رفع<input type="file" accept="image/*,.pdf" capture="environment" style="display:none" onchange="submitAssignment('${v29Esc(st.code)}','${v29Esc(a.id)}', this)"></label></td></tr>`;});
  const homeworkRows=(st.homeworks||[]).slice().reverse().map(h=>`<tr><td>${v29Esc(h.title||'واجب')}</td><td>${v29BadgeStatus(h.status)}</td><td>${v29Esc(h.date||'-')}</td></tr>`);
  const schedule = group ? `${v29Esc(group.days||'-')} · ${v29Esc(group.time||'-')} · ${v29Esc(group.place||'-')}` : 'لم يتم تحديد جدول لهذه المجموعة بعد';
  return `<div class="student-clean-card-v29">
    <div class="student-clean-cover-v29">
      <div class="student-main-info-v29"><span class="badge good">${v29Esc(st.code)}</span><h2>${v29Esc(st.name)}</h2><p>${v29Esc(st.grade)} · ${v29Esc(st.group||'بدون مجموعة')}</p><div class="student-tags-v24"><span class="badge ${st.paid?'good':'danger'}">${payText}</span><span class="badge">الحضور من المدرس فقط</span></div></div>
      <div class="student-qr-mini-v29">${makeQR(st.code)}</div>
    </div>
    <div class="student-summary-grid-v29"><div><b>${c.attendancePct}%</b><span>الحضور</span></div><div><b>${att.absent}</b><span>غياب</span></div><div><b>${rec.pct}%</b><span>التسميع</span></div><div><b>${c.avg}%</b><span>الدرجات</span></div></div>
    <div class="student-progress-v29"><div><b>المستوى العام: ${v29Esc(c.level)}</b><span>${lastGrade?'آخر نتيجة: '+v29Esc(lastGrade.exam)+' - '+v29Esc(lastGrade.score)+'%':'لا توجد نتيجة حديثة'}</span></div><div class="progress"><span style="width:${Math.max(4,Math.min(100,c.final))}%"></span></div></div>
    <div class="student-info-strip-v29"><div><b>جدول المجموعة</b><span>${schedule}</span></div><div><b>ملاحظة المدرس</b><span>${v29Esc(st.notes||'لا توجد ملاحظات حالية')}</span></div></div>
    <div class="student-actions-v29"><button class="btn ghost" onclick="toggleStudentPanel('attendance-${safeCode}')"><span data-icon="calendar"></span> الحضور</button><button class="btn ghost" onclick="toggleStudentPanel('recitation-${safeCode}')"><span data-icon="user-check"></span> التسميع</button><button class="btn ghost" onclick="toggleStudentPanel('grades-${safeCode}')"><span data-icon="bar-chart"></span> الدرجات</button><button class="btn ghost" onclick="toggleStudentPanel('assignments-${safeCode}')"><span data-icon="file-text"></span> الواجبات</button><button class="btn primary" onclick="window.print()"><span data-icon="file-text"></span> طباعة</button></div>
    <section class="mini-panel student-details-panel-v29" id="attendance-${safeCode}"><h3>سجل الحضور</h3><div class="mini-stats"><span>حاضر ${att.present}</span><span>غياب ${att.absent}</span><span>تأخير ${att.late}</span></div><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحالة</th><th>الحصة</th><th>ملاحظة</th></tr></thead><tbody>${v29Rows(attendanceRows,4)}</tbody></table></div></section>
    <section class="mini-panel student-details-panel-v29" id="recitation-${safeCode}"><h3>سجل التسميع</h3><div class="mini-stats"><span>سمع ${rec.heard}</span><span>لم يسمع ${rec.notHeard}</span><span>لم يحضر ${rec.absent}</span></div><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحصة</th><th>الحالة</th><th>ملاحظة</th></tr></thead><tbody>${v29Rows(recitationRows,4)}</tbody></table></div></section>
    <section class="mini-panel student-details-panel-v29" id="grades-${safeCode}"><h3>الدرجات</h3><div class="table-wrap"><table><thead><tr><th>الامتحان</th><th>الدرجة</th><th>النوع</th><th>التاريخ</th></tr></thead><tbody>${v29Rows(gradeRows,4)}</tbody></table></div></section>
    <section class="mini-panel student-details-panel-v29" id="assignments-${safeCode}"><h3>الواجبات المطلوبة</h3><div class="table-wrap"><table><thead><tr><th>الواجب</th><th>آخر موعد</th><th>الحالة</th><th>رفع</th></tr></thead><tbody>${v29Rows(assignmentRows,4)}</tbody></table></div><h3>تسليمات الطالب</h3><div class="table-wrap"><table><thead><tr><th>الواجب</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${v29Rows(homeworkRows,3)}</tbody></table></div></section>
  </div>`;
}
function parentReport(st){
  const c=calcStudent(st), att=attendanceSummary(st), rec=recitationSummary(st), group=findGroupForStudent(st);
  const gradeRows=(st.grades||[]).slice().reverse().map(g=>`<tr><td>${v29Esc(g.exam||'-')}</td><td>${g.score===null||g.score===undefined?'في انتظار التصحيح':v29Esc(g.score)+'%'}</td><td>${v29Esc(g.date||'-')}</td></tr>`);
  const hwDone=(st.homeworks||[]).filter(h=>h.status==='تم التسليم').length;
  const hwTotal=(st.homeworks||[]).length;
  const advice=c.final>=85?'المستوى ممتاز. المطلوب الحفاظ على نفس الانتظام.':c.final>=70?'المستوى جيد. الأفضل زيادة حل الواجبات والتدريب.':'الطالب يحتاج متابعة أقوى ومراجعة أسبوعية.';
  const schedule=group?`${v29Esc(group.days||'-')} · ${v29Esc(group.time||'-')} · ${v29Esc(group.place||'-')}`:'لم يتم تحديد جدول المجموعة بعد';
  return `<div class="parent-report-full-v29 print-area"><div class="parent-report-cover-v29"><div><span class="badge good">تقرير ولي الأمر</span><h2>${v29Esc(st.name)}</h2><p>${v29Esc(st.grade)} · ${v29Esc(st.group||'بدون مجموعة')} · كود ${v29Esc(st.code)}</p></div><span class="badge ${st.paid?'good':'danger'}">${st.paid?'تم الدفع':'لم يدفع'}</span></div><div class="parent-metrics-v29"><div><b>${c.attendancePct}%</b><span>نسبة الحضور</span></div><div><b>${att.absent}</b><span>مرات الغياب</span></div><div><b>${rec.pct}%</b><span>التسميع</span></div><div><b>${c.avg}%</b><span>متوسط الدرجات</span></div><div><b>${hwDone}/${hwTotal||0}</b><span>الواجبات</span></div><div><b>${v29Esc(c.level)}</b><span>المستوى العام</span></div></div><div class="parent-detail-grid-v29"><section class="mini-panel"><h3>جدول الطالب</h3><p>${schedule}</p></section><section class="mini-panel"><h3>ملخص المدرس</h3><p><b>ملاحظة:</b> ${v29Esc(st.notes||'لا توجد ملاحظات حالية')}</p><p><b>التوصية:</b> ${advice}</p></section><section class="mini-panel"><h3>الحضور والتسميع</h3><div class="mini-stats"><span>حاضر ${att.present}</span><span>غياب ${att.absent}</span><span>تأخير ${att.late}</span><span>سمع ${rec.heard}</span><span>لم يسمع ${rec.notHeard}</span></div></section><section class="mini-panel"><h3>آخر الدرجات</h3><div class="table-wrap"><table><thead><tr><th>الامتحان</th><th>الدرجة</th><th>التاريخ</th></tr></thead><tbody>${v29Rows(gradeRows,3)}</tbody></table></div></section></div></div><button class="btn primary report-print-btn" onclick="window.print()"><span data-icon="file-text"></span> طباعة / حفظ التقرير PDF</button>`;
}
function setupParent(){
  const form=document.getElementById('parentSearchForm'); if(!form)return;
  const box=document.getElementById('parentResult');
  const params=new URLSearchParams(location.search); const code=params.get('code');
  if(code){form.query.value=code; const st=findStudent(code); if(box) box.innerHTML=st?parentReport(st):'<div class="empty-state"><h3>لم يتم العثور على الطالب</h3><p>تأكد من الكود أو رقم ولي الأمر.</p></div>'; hydrateIcons(); renderRealQRCodes();}
  if(!form.dataset.v29Ready){form.dataset.v29Ready='1'; form.addEventListener('submit',e=>{e.preventDefault(); const st=findStudent(new FormData(form).get('query')); if(box) box.innerHTML=st?parentReport(st):'<div class="empty-state"><h3>لم يتم العثور على الطالب</h3><p>تأكد من الكود أو رقم ولي الأمر.</p></div>'; hydrateIcons(); renderRealQRCodes();});}
}
try{setupParent(); setupStudent(); hydrateIcons(); renderRealQRCodes();}catch(e){console.warn('v29 setup failed', e);}

/* v31: one page for reviews + question bank */
function setupUnifiedResourcesPage(){
  const materialsGrid=document.getElementById('materialsPageGrid');
  const questionsGrid=document.getElementById('questionsPageGrid');
  if(!materialsGrid || !questionsGrid) return;
  const wrapper=document.getElementById('materialsFilters');
  if(wrapper && !wrapper.dataset.v31Ready){
    wrapper.dataset.v31Ready='1';
    wrapper.innerHTML=gradeFilterControls('unifiedResourcesFilterBox');
    bindGradeFilter('unifiedResourcesFilterBox', grade=>{ renderMaterialsPage(grade); renderQuestionsPage(grade); });
  }
  renderMaterialsPage('all');
  renderQuestionsPage('all');
  hydrateIcons();
}
try{setupUnifiedResourcesPage();}catch(e){console.warn('v31 unified resources failed', e);}


/* v32: same professional report layout for student and parent + strict parent phone validation */
function v32PhoneDigits(v){return String(v||'').replace(/[٠-٩]/g, d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g,'');}
function v32IsEgyptPhone(v){const d=v32PhoneDigits(v); return /^01\d{9}$/.test(d) || /^201\d{9}$/.test(d);}
function v32Table(rows, cols){return rows && rows.length ? rows.join('') : `<tr><td colspan="${cols}">لا توجد بيانات مسجلة حاليًا</td></tr>`;}
function v32Schedule(st){const group=findGroupForStudent(st); return group?`${v29Esc(group.days||'-')} · ${v29Esc(group.time||'-')} · ${v29Esc(group.place||'-')}`:'لم يتم تحديد جدول المجموعة بعد';}
function v32StudentRows(st){
  const assignments=getAssignmentsForStudent(st);
  return {
    attendance:(st.attendance||[]).slice().reverse().map(a=>`<tr><td>${v29Esc(a.date||'-')}</td><td>${v29BadgeStatus(a.status)}</td><td>${v29Esc(a.lesson||'-')}</td><td>${v29Esc(a.note||'')}</td></tr>`),
    recitation:(st.recitations||[]).slice().reverse().map(r=>`<tr><td>${v29Esc(r.date||'-')}</td><td>${v29Esc(r.lesson||'حصة')}</td><td>${v29BadgeStatus(r.status)}</td><td>${v29Esc(r.note||'')}</td></tr>`),
    grades:(st.grades||[]).slice().reverse().map(g=>`<tr><td>${v29Esc(g.exam||'-')}</td><td>${g.score===null||g.score===undefined?'في انتظار التصحيح':v29Esc(g.score)+'%'}</td><td>${v29Esc(g.type||'-')}</td><td>${v29Esc(g.date||'-')}</td></tr>`),
    assignments:assignments.map(a=>{const sub=assignmentStatus(st,a);return `<tr><td><b>${v29Esc(a.title)}</b><small>${v29Esc(a.desc||'')}</small></td><td>${v29Esc(a.dueDate||'بدون موعد')}</td><td>${v29BadgeStatus(sub?'تم التسليم':'مطلوب')}</td><td><label class="small-btn primary" style="cursor:pointer">رفع<input type="file" accept="image/*,.pdf" capture="environment" style="display:none" onchange="submitAssignment('${v29Esc(st.code)}','${v29Esc(a.id)}', this)"></label></td></tr>`;}),
    homeworks:(st.homeworks||[]).slice().reverse().map(h=>`<tr><td>${v29Esc(h.title||'واجب')}</td><td>${v29BadgeStatus(h.status)}</td><td>${v29Esc(h.date||'-')}</td></tr>`)
  };
}
function studentCard(st){
  const c=calcStudent(st), att=attendanceSummary(st), rec=recitationSummary(st), rows=v32StudentRows(st);
  const safeCode=String(st.code||'').replace(/[^a-zA-Z0-9_-]/g,'');
  const hwDone=(st.homeworks||[]).filter(h=>h.status==='تم التسليم').length;
  const hwTotal=(st.homeworks||[]).length;
  const lastGrade=(st.grades||[]).filter(g=>g.score!==null && g.score!==undefined && g.score!=='' && !isNaN(Number(g.score))).slice(-1)[0];
  return `<div class="student-report-full-v32 print-area">
    <div class="parent-report-cover-v29"><div class="parent-report-cover-content-v32"><div class="parent-report-main-v32"><span class="badge good">بوابة الطالب</span><h2>${v29Esc(st.name)}</h2><p>${v29Esc(st.grade)} · ${v29Esc(st.group||'بدون مجموعة')} · كود ${v29Esc(st.code)}</p><div class="student-tags-v24"><span class="badge ${st.paid?'good':'danger'}">${st.paid?'تم الدفع':'لم يدفع'}</span><span class="badge">الحضور من المدرس فقط</span></div></div><div class="student-report-qr-v32">${makeQR(st.code)}</div></div></div>
    <div class="parent-metrics-v29"><div><b>${c.attendancePct}%</b><span>نسبة الحضور</span></div><div><b>${att.absent}</b><span>مرات الغياب</span></div><div><b>${rec.pct}%</b><span>التسميع</span></div><div><b>${c.avg}%</b><span>متوسط الدرجات</span></div><div><b>${hwDone}/${hwTotal||0}</b><span>الواجبات</span></div><div><b>${v29Esc(c.level)}</b><span>المستوى العام</span></div></div>
    <div class="student-detail-grid-v32"><section class="mini-panel"><h3>بيانات أساسية</h3><p><b>رقم الطالب:</b> ${v29Esc(st.studentPhone||'-')}</p><p><b>رقم ولي الأمر:</b> ${v29Esc(st.parentPhone||'-')}</p><p><b>حالة الدفع:</b> ${st.paid?'تم الدفع':'لم يدفع'}</p></section><section class="mini-panel"><h3>جدول وملاحظة</h3><p><b>جدول المجموعة:</b> ${v32Schedule(st)}</p><p><b>ملاحظة المدرس:</b> ${v29Esc(st.notes||'لا توجد ملاحظات حالية')}</p><p><b>آخر نتيجة:</b> ${lastGrade?v29Esc(lastGrade.exam)+' - '+v29Esc(lastGrade.score)+'%':'لا توجد نتيجة حديثة'}</p></section></div>
    <div class="student-actions-v32"><button class="btn ghost" onclick="toggleStudentPanel('attendance-${safeCode}')"><span data-icon="calendar"></span> الحضور</button><button class="btn ghost" onclick="toggleStudentPanel('recitation-${safeCode}')"><span data-icon="user-check"></span> التسميع</button><button class="btn ghost" onclick="toggleStudentPanel('grades-${safeCode}')"><span data-icon="bar-chart"></span> الدرجات</button><button class="btn ghost" onclick="toggleStudentPanel('assignments-${safeCode}')"><span data-icon="file-text"></span> الواجبات</button></div>
    <section class="mini-panel student-detail-panel-v32" id="attendance-${safeCode}"><h3>سجل الحضور</h3><div class="mini-stats"><span>حاضر ${att.present}</span><span>غياب ${att.absent}</span><span>تأخير ${att.late}</span></div><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحالة</th><th>الحصة</th><th>ملاحظة</th></tr></thead><tbody>${v32Table(rows.attendance,4)}</tbody></table></div></section>
    <section class="mini-panel student-detail-panel-v32" id="recitation-${safeCode}"><h3>سجل التسميع</h3><div class="mini-stats"><span>سمع ${rec.heard}</span><span>لم يسمع ${rec.notHeard}</span><span>لم يحضر ${rec.absent}</span></div><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحصة</th><th>الحالة</th><th>ملاحظة</th></tr></thead><tbody>${v32Table(rows.recitation,4)}</tbody></table></div></section>
    <section class="mini-panel student-detail-panel-v32" id="grades-${safeCode}"><h3>الدرجات</h3><div class="table-wrap"><table><thead><tr><th>الامتحان</th><th>الدرجة</th><th>النوع</th><th>التاريخ</th></tr></thead><tbody>${v32Table(rows.grades,4)}</tbody></table></div></section>
    <section class="mini-panel student-detail-panel-v32" id="assignments-${safeCode}"><h3>الواجبات المطلوبة</h3><div class="table-wrap"><table><thead><tr><th>الواجب</th><th>آخر موعد</th><th>الحالة</th><th>رفع</th></tr></thead><tbody>${v32Table(rows.assignments,4)}</tbody></table></div><h3>تسليمات الطالب</h3><div class="table-wrap"><table><thead><tr><th>الواجب</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${v32Table(rows.homeworks,3)}</tbody></table></div></section>
    <button class="btn primary report-print-btn print-student-v32" onclick="window.print()"><span data-icon="file-text"></span> طباعة / حفظ الملف PDF</button>
  </div>`;
}
function parentReport(st){
  const c=calcStudent(st), att=attendanceSummary(st), rec=recitationSummary(st), rows=v32StudentRows(st);
  const hwDone=(st.homeworks||[]).filter(h=>h.status==='تم التسليم').length;
  const hwTotal=(st.homeworks||[]).length;
  const advice=c.final>=85?'المستوى ممتاز. المطلوب الحفاظ على نفس الانتظام.':c.final>=70?'المستوى جيد. الأفضل زيادة حل الواجبات والتدريب.':'الطالب يحتاج متابعة أقوى ومراجعة أسبوعية.';
  return `<div class="parent-report-full-v29 print-area"><div class="parent-report-cover-v29"><div class="parent-report-cover-content-v32"><div class="parent-report-main-v32"><span class="badge good">تقرير ولي الأمر</span><h2>${v29Esc(st.name)}</h2><p>${v29Esc(st.grade)} · ${v29Esc(st.group||'بدون مجموعة')} · كود ${v29Esc(st.code)}</p><span class="badge ${st.paid?'good':'danger'}">${st.paid?'تم الدفع':'لم يدفع'}</span></div><div class="parent-report-qr-v32">${makeQR(st.code)}</div></div></div>
  <div class="parent-metrics-v29"><div><b>${c.attendancePct}%</b><span>نسبة الحضور</span></div><div><b>${att.absent}</b><span>مرات الغياب</span></div><div><b>${rec.pct}%</b><span>التسميع</span></div><div><b>${c.avg}%</b><span>متوسط الدرجات</span></div><div><b>${hwDone}/${hwTotal||0}</b><span>الواجبات</span></div><div><b>${v29Esc(c.level)}</b><span>المستوى العام</span></div></div>
  <div class="parent-detail-grid-v29 wide-details-v32"><section class="mini-panel"><h3>بيانات الطالب</h3><p><b>رقم الطالب:</b> ${v29Esc(st.studentPhone||'-')}</p><p><b>رقم ولي الأمر:</b> ${v29Esc(st.parentPhone||'-')}</p><p><b>جدول المجموعة:</b> ${v32Schedule(st)}</p></section><section class="mini-panel"><h3>ملخص المدرس</h3><p><b>ملاحظة:</b> ${v29Esc(st.notes||'لا توجد ملاحظات حالية')}</p><p><b>التوصية:</b> ${advice}</p><p><b>حالة الدفع:</b> ${st.paid?'تم الدفع':'لم يدفع'}</p></section><section class="mini-panel"><h3>الحضور والتسميع</h3><div class="mini-stats"><span>حاضر ${att.present}</span><span>غياب ${att.absent}</span><span>تأخير ${att.late}</span><span>سمع ${rec.heard}</span><span>لم يسمع ${rec.notHeard}</span></div><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحضور</th><th>الحصة</th><th>ملاحظة</th></tr></thead><tbody>${v32Table(rows.attendance,4)}</tbody></table></div></section><section class="mini-panel"><h3>الدرجات</h3><div class="table-wrap"><table><thead><tr><th>الامتحان</th><th>الدرجة</th><th>النوع</th><th>التاريخ</th></tr></thead><tbody>${v32Table(rows.grades,4)}</tbody></table></div></section><section class="mini-panel"><h3>التسميع التفصيلي</h3><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحصة</th><th>الحالة</th><th>ملاحظة</th></tr></thead><tbody>${v32Table(rows.recitation,4)}</tbody></table></div></section><section class="mini-panel"><h3>الواجبات</h3><div class="table-wrap"><table><thead><tr><th>الواجب</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${v32Table(rows.homeworks,3)}</tbody></table></div></section></div></div><button class="btn primary report-print-btn" onclick="window.print()"><span data-icon="file-text"></span> طباعة / حفظ التقرير PDF</button>`;
}
function setupBooking(){
  const form=document.getElementById('bookingForm');
  if(form && !form.dataset.v32Ready){
    form.dataset.v32Ready='1';
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const fd=new FormData(form); const b=Object.fromEntries(fd.entries());
      const studentDigits=v32PhoneDigits(b.studentPhone), parentDigits=v32PhoneDigits(b.parentPhone);
      if(!v32IsEgyptPhone(b.studentPhone)||!v32IsEgyptPhone(b.parentPhone)){toast('اكتب أرقام تليفون صحيحة بصيغة مصرية مثل 010xxxxxxxx'); return;}
      if(studentDigits===parentDigits){toast('رقم ولي الأمر لازم يكون مختلف عن رقم الطالب'); const inp=form.querySelector('[name="parentPhone"]'); if(inp) inp.focus(); return;}
      b.id=b.code=uid(); b.date=today(); b.status='حجز جديد'; b.subject='علوم';
      data.bookings=data.bookings||[]; data.bookings.push(b); saveData(data);
      if(window.MFCloud?.createBooking){try{await window.MFCloud.createBooking(b);}catch(err){console.warn('Public booking save failed',err);}}
      renderBookingSuccess(b); renderBookingPreview(); renderHomeCounts(); form.reset(); fillSelects(); toast('تم تسجيل الحجز، احتفظ بالكود لمتابعة الطلب');
      document.getElementById('bookingSuccess')?.scrollIntoView({behavior:'smooth',block:'center'});
    });
  }
  const statusForm=document.getElementById('bookingStatusForm');
  if(statusForm && !statusForm.dataset.v28Ready){statusForm.dataset.v28Ready='1'; statusForm.addEventListener('submit',e=>{e.preventDefault(); const code=new FormData(statusForm).get('code'); renderBookingStatusResult(findBookingByCode(code));});}
}
try{setupBooking(); setupParent(); setupStudent(); hydrateIcons(); renderRealQRCodes();}catch(e){console.warn('v32 setup failed', e);}

/* v34: exam correction rules - MCQ only auto, any essay waits for teacher */
function v34Escape(v){return String(v ?? '').replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
function parseExamBlocksV34(text){
  const blocks=String(text||'').split(/\n\s*---\s*\n/g).map(x=>x.trim()).filter(Boolean);
  return blocks.map((block,idx)=>{
    const lines=block.split(/\n+/).map(x=>x.trim()).filter(Boolean);
    const qLine=lines.find(l=>/^(q|س|سؤال|essay|مقالي)[:：\-]/i.test(l)) || lines[0] || `سؤال ${idx+1}`;
    const rawOptions=lines.filter(l=>/^[A-Dأبجده]\)|^[A-Dأبجده][\-\.]/i.test(l));
    const options=rawOptions.map(l=>l.replace(/^[A-Dأبجده][\)\-\.]\s*/i,''));
    const answerLine=lines.find(l=>/^(answer|ans|الإجابة|اجابة)[:：\-]/i.test(l))||'';
    const answer=answerLine ? answerLine.split(/[:：\-]/).pop().trim().toUpperCase() : '';
    const isEssay=/^(essay|مقالي)[:：\-]/i.test(qLine) || !answer || options.length<2;
    return {type:isEssay?'essay':'mcq', question:qLine.replace(/^(q|س|سؤال|essay|مقالي)[:：\-]\s*/i,''), options, answer, block};
  }).filter(q=>q.question || q.options.length);
}
function examHasEssayV34(ex){
  if(String(ex?.mode||'').includes('مقالي')) return true;
  const qs=parseExamBlocksV34(ex?.text||'');
  return qs.some(q=>q.type==='essay') || (!qs.length && String(ex?.text||'').trim());
}
function renderExamQuestionsHtmlV34(questions){
  return `<form id="liveExamForm" class="exam-form-v34">${questions.map((q,i)=>q.type==='mcq'
    ? `<div class="exam-question"><span class="badge good">اختياري</span><h4>${i+1}) ${v34Escape(q.question)}</h4>${q.options.map((op,j)=>{const letters=['A','B','C','D']; return `<label class="exam-option"><input type="radio" name="q${i}" value="${letters[j]}"><span>${letters[j]}) ${v34Escape(op)}</span></label>`}).join('')}</div>`
    : `<div class="exam-question essay-question-v34"><span class="badge warn">مقالي</span><h4>${i+1}) ${v34Escape(q.question)}</h4><textarea name="q${i}" placeholder="اكتب إجابتك المقالية هنا"></textarea></div>`
  ).join('')}</form>`;
}
function getExamGradeLabelV34(gr){
  if(!gr) return 'لم يتم الحل بعد';
  if(gr.score===null || gr.score===undefined || gr.score==='') return 'في انتظار تصحيح المدرس';
  return gr.score+'%';
}
function renderExamPortal(st){
  const el=document.getElementById('examStudentResult'); if(!el)return;
  if(!st){el.innerHTML='<p style="color:var(--muted);font-weight:800">اكتب كود الطالب لعرض امتحانات صفك ودرجاتك.</p>';return;}
  const c=calcStudent(st); const exams=data.exams.filter(e=>e.grade===st.grade);
  el.innerHTML=`<div class="profile-top"><div><span class="badge good">${v34Escape(st.code)}</span><h3>${v34Escape(st.name)}</h3><p style="color:var(--muted);font-weight:800">${v34Escape(st.grade)} - آخر درجة: ${c.lastGrade?c.lastGrade.score+'%':'لا توجد'}</p></div>${makeQR(st.code)}</div><div class="grid grid-2">${exams.map(ex=>{const gr=getStudentGradeForExam(st,ex.title); const essay=examHasEssayV34(ex); return `<div class="card exam-card"><span class="badge ${ex.status==='مفتوح'?'good':'warn'}">${v34Escape(ex.status)}</span><span class="badge ${essay?'warn':'good'}">${essay?'تصحيح المدرس':'تصحيح فوري'}</span><h3>${v34Escape(ex.title)}</h3><p>${ex.questions||0} سؤال - الوقت: ${ex.duration||20} دقيقة</p><p>${v34Escape(ex.instructions||'')}</p>${attachmentHtml(ex)}<div class="exam-grade">النتيجة: <b>${getExamGradeLabelV34(gr)}</b></div>${essay?'<p class="exam-note-v34">هذا الامتحان يحتوي على مقالي، لذلك النتيجة تظهر بعد تصحيح المدرس.</p>':'<p class="exam-note-v34">اختياري فقط: النتيجة تظهر فور التسليم.</p>'}<button class="btn primary" ${ex.status==='مفتوح'?'':'disabled'} onclick="startExam('${v34Escape(st.code)}','${v34Escape(ex.id)}')"><span data-icon="clipboard"></span> بدء الامتحان</button></div>`;}).join('')||'<div class="card"><h3>لا توجد امتحانات لهذا الصف حاليًا</h3></div>'}</div>`;
  hydrateIcons(); renderRealQRCodes?.();
}
window.startExam=function(code,examId){
  const st=data.students.find(s=>s.code===code); const ex=data.exams.find(e=>e.id===examId); if(!st||!ex)return;
  const questions=parseExamBlocksV34(ex.text); const hasEssay=examHasEssayV34(ex);
  activeExamSession={code,examId,start:Date.now(),exitCount:0,questions,hasEssay};
  const overlay=document.getElementById('examOverlay'); const box=document.getElementById('examBox'); if(!overlay||!box)return;
  const mins=Number(ex.duration||20);
  box.innerHTML=`<div class="exam-live-head"><div><span class="badge ${hasEssay?'warn':'good'}">${hasEssay?'تصحيح المدرس بعد التسليم':'تصحيح فوري'}</span><h2>${v34Escape(ex.title)}</h2><p>${v34Escape(ex.instructions||'لا تخرج من الصفحة قبل التسليم.')}</p></div><div class="timer" id="examTimer">${mins}:00</div></div>${questions.length?renderExamQuestionsHtmlV34(questions):`<div class="written-box exam-text">${String(ex.text||'').replace(/\n/g,'<br>')}</div><textarea id="examAnswer" placeholder="اكتب إجابتك هنا"></textarea>`}${attachmentHtml(ex)}<div class="exam-warning" id="examWarning">تنبيه: الخروج من الصفحة أثناء الامتحان يتم تسجيله كمحاولة خروج.</div><button class="btn primary" onclick="submitExamAttempt(false)"><span data-icon="send"></span> تسليم الامتحان</button>`;
  hydrateIcons(); overlay.classList.add('show'); try{document.documentElement.requestFullscreen?.();}catch(e){}
  let remaining=mins*60; clearInterval(examTimer); examTimer=setInterval(()=>{remaining--; const t=document.getElementById('examTimer'); if(t)t.textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`; if(remaining<=0)submitExamAttempt(true);},1000);
};
window.submitExamAttempt=function(auto=false){
  if(!activeExamSession)return; clearInterval(examTimer);
  const st=data.students.find(s=>s.code===activeExamSession.code); const ex=data.exams.find(e=>e.id===activeExamSession.examId);
  let answers={}; let correct=0; let mcqTotal=0; let rawAnswer='';
  if(activeExamSession.questions?.length){
    activeExamSession.questions.forEach((q,i)=>{
      if(q.type==='mcq'){
        mcqTotal++; const val=document.querySelector(`input[name="q${i}"]:checked`)?.value||''; answers[`q${i}`]=val; if(String(q.answer||'').toUpperCase()===String(val).toUpperCase()) correct++;
      } else {
        answers[`q${i}`]=document.querySelector(`textarea[name="q${i}"]`)?.value||'';
      }
    });
    rawAnswer=JSON.stringify(answers);
  } else rawAnswer=document.getElementById('examAnswer')?.value||'';
  const hasEssay=activeExamSession.hasEssay;
  const autoScore=mcqTotal?Math.round(correct/Math.max(mcqTotal,1)*100):null;
  const finalScore=hasEssay?null:autoScore;
  const status=hasEssay?'في انتظار تصحيح المدرس':(auto?'تم التصحيح تلقائيًا بعد انتهاء الوقت':'تم التصحيح تلقائيًا');
  data.examAttempts=data.examAttempts||[];
  const attempt={id:'attempt-'+Date.now(),studentCode:activeExamSession.code,studentName:st?.name,examId:ex?.id,examTitle:ex?.title,date:today(),answer:rawAnswer,answers,autoScore,score:finalScore,status,needsManual:!!hasEssay,hasEssay:!!hasEssay,exitCount:activeExamSession.exitCount};
  data.examAttempts.push(attempt);
  if(st&&ex){st.grades=st.grades||[]; const existing=st.grades.find(g=>g.exam===ex.title); const gradePayload={exam:ex.title,score:finalScore,type:'أونلاين',date:today(),status:hasEssay?'في انتظار التصحيح':'تم التصحيح تلقائيًا'}; if(existing) Object.assign(existing,gradePayload); else st.grades.push(gradePayload);}
  saveData(data); activeExamSession=null; document.getElementById('examOverlay')?.classList.remove('show'); try{document.exitFullscreen?.();}catch(e){}
  toast(hasEssay?'تم تسليم الامتحان، النتيجة في انتظار تصحيح المدرس':`تم التسليم، درجتك ${finalScore}%`); if(st)renderExamPortal(st);
};

/* v35: prevent exam reattempt + simpler home */
function hasSubmittedExamV35(code, examId){
  return (data.examAttempts||[]).some(a=>String(a.studentCode)===String(code) && String(a.examId)===String(examId));
}
const oldStartExamV35 = window.startExam;
window.startExam=function(code, examId){
  if(hasSubmittedExamV35(code, examId)){
    toast('تم تسليم هذا الامتحان من قبل. لا يمكن إعادة الامتحان بنفس الكود.');
    const st=data.students.find(s=>s.code===code); if(st) renderExamPortal(st);
    return;
  }
  return oldStartExamV35(code, examId);
};
const oldRenderExamPortalV35 = renderExamPortal;
renderExamPortal=function(st){
  oldRenderExamPortalV35(st);
  if(!st) return;
  document.querySelectorAll('.exam-card').forEach(card=>{
    const btn=card.querySelector('button[onclick^="startExam"]');
    if(!btn) return;
    const m=btn.getAttribute('onclick').match(/startExam\('([^']+)'\,'([^']+)'\)/);
    if(m && hasSubmittedExamV35(m[1],m[2])){btn.disabled=true; btn.innerHTML='<span data-icon="clipboard"></span> تم التسليم من قبل'; card.classList.add('submitted-exam-v35');}
  });
  hydrateIcons();
};
function applyV35HomeSimplify(){
  document.querySelectorAll('.v35-hidden-home').forEach(el=>el.remove());
  const services=document.querySelector('.service-preview-grid');
  if(services){ [...services.children].forEach((c,i)=>{ if(i>3)c.remove(); }); }
}
try{applyV35HomeSimplify();}catch(e){}

/* v37: simpler home + student summary-first portal */
(function v37PublicSimplify(){
  function s37(v){
    if(typeof v29Esc === 'function') return v29Esc(v);
    return String(v ?? '').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  }
  function rowsOrEmpty(rows,cols){return rows&&rows.length?rows.join(''):`<tr><td colspan="${cols}">لا توجد بيانات حتى الآن</td></tr>`;}
  function attSum(st){return typeof attendanceSummary==='function'?attendanceSummary(st):{present:(st.attendance||[]).filter(a=>a.status==='حاضر').length,absent:(st.attendance||[]).filter(a=>a.status==='غائب').length,late:(st.attendance||[]).filter(a=>a.status==='متأخر').length};}
  function recSum(st){return typeof recitationSummary==='function'?recitationSummary(st):{pct:0,heard:(st.recitations||[]).filter(r=>r.status==='سمع').length,notHeard:(st.recitations||[]).filter(r=>r.status==='لم يسمع').length,absent:(st.recitations||[]).filter(r=>r.status==='لم يحضر').length};}
  function assFor(st){try{return typeof getAssignmentsForStudent==='function'?getAssignmentsForStudent(st):[]}catch(e){return []}}
  window.openStudentDetailV37=function(id){
    document.querySelectorAll('.student-detail-panel-v37').forEach(x=>x.classList.remove('show'));
    const el=document.getElementById(id); if(el) el.classList.add('show');
  };
  window.studentCard=function(st){
    const c=calcStudent(st), att=attSum(st), rec=recSum(st);
    const safe=String(st.code||'').replace(/[^a-zA-Z0-9_-]/g,'');
    const assignments=assFor(st);
    const homeRows=(st.homeworks||[]).slice().reverse().map(h=>`<tr><td>${s37(h.title||'واجب')}</td><td>${typeof v29BadgeStatus==='function'?v29BadgeStatus(h.status):s37(h.status||'-')}</td><td>${s37(h.date||'-')}</td></tr>`);
    const assignmentRows=assignments.map(a=>{let submitted=false;try{submitted=typeof assignmentStatus==='function'&&assignmentStatus(st,a)}catch(e){} return `<tr><td><b>${s37(a.title)}</b><small>${s37(a.desc||'')}</small></td><td>${s37(a.dueDate||'بدون موعد')}</td><td>${typeof v29BadgeStatus==='function'?v29BadgeStatus(submitted?'تم التسليم':'مطلوب'):(submitted?'تم التسليم':'مطلوب')}</td><td><label class="small-btn primary" style="cursor:pointer">رفع<input type="file" accept="image/*,.pdf" capture="environment" style="display:none" onchange="submitAssignment?submitAssignment('${s37(st.code)}','${s37(a.id)}', this):submitHomework('${s37(st.code)}', this)"></label></td></tr>`;});
    const gradeRows=(st.grades||[]).slice().reverse().map(g=>`<tr><td>${s37(g.exam||'-')}</td><td>${g.score===null||g.score===undefined?'في انتظار التصحيح':s37(g.score)+'%'}</td><td>${s37(g.type||'-')}</td><td>${s37(g.date||'-')}</td></tr>`);
    const attendanceRows=(st.attendance||[]).slice().reverse().map(a=>`<tr><td>${s37(a.date||'-')}</td><td>${typeof v29BadgeStatus==='function'?v29BadgeStatus(a.status):s37(a.status||'-')}</td><td>${s37(a.lesson||'-')}</td><td>${s37(a.note||'')}</td></tr>`);
    const recRows=(st.recitations||[]).slice().reverse().map(r=>`<tr><td>${s37(r.date||'-')}</td><td>${s37(r.lesson||'حصة')}</td><td>${typeof v29BadgeStatus==='function'?v29BadgeStatus(r.status):s37(r.status||'-')}</td><td>${s37(r.note||'')}</td></tr>`);
    const last=(st.grades||[]).filter(g=>g.score!==null&&g.score!==undefined&&g.score!==''&&!isNaN(Number(g.score))).slice(-1)[0];
    const groupText=typeof v32Schedule==='function'?v32Schedule(st):(st.group||'-');
    return `<div class="student-v37-wrap student-card-v37 print-area">
      <section class="student-top-v37 card">
        <div class="student-title-v37"><span class="badge good">${s37(st.code)}</span><h2>${s37(st.name)}</h2><p>${s37(st.grade)} · ${s37(st.group||'بدون مجموعة')}</p><div class="student-tags-v24"><span class="badge ${st.paid?'good':'danger'}">${st.paid?'تم الدفع':'لم يدفع'}</span><span class="badge">الحضور والتسميع من المدرس فقط</span></div></div>
        <div class="student-qr-v37">${makeQR(st.code)}</div>
      </section>
      <section class="student-summary-grid-v37">
        <div class="metric"><b>${c.attendancePct}%</b><small>الحضور</small></div>
        <div class="metric"><b>${att.absent||0}</b><small>غياب</small></div>
        <div class="metric"><b>${rec.pct||0}%</b><small>التسميع</small></div>
        <div class="metric"><b>${c.avg||0}%</b><small>متوسط الدرجات</small></div>
        <div class="metric"><b>${last?last.score+'%':'-'}</b><small>آخر نتيجة</small></div>
        <div class="metric"><b>${s37(c.level)}</b><small>المستوى</small></div>
      </section>
      <section class="student-info-grid-v37">
        <div class="mini-panel"><h3>بيانات الطالب</h3><p><b>رقم الطالب:</b> ${s37(st.studentPhone||'-')}</p><p><b>رقم ولي الأمر:</b> ${s37(st.parentPhone||'-')}</p><p><b>حالة الدفع:</b> ${st.paid?'تم الدفع':'لم يدفع'}</p></div>
        <div class="mini-panel"><h3>الجدول والملاحظات</h3><p><b>جدول المجموعة:</b> ${s37(groupText)}</p><p><b>ملاحظة المدرس:</b> ${s37(st.notes||'لا توجد ملاحظات')}</p></div>
      </section>
      <section class="student-actions-tabs-v37">
        <button class="btn ghost" onclick="openStudentDetailV37('att-${safe}')"><span data-icon="calendar"></span> الحضور</button>
        <button class="btn ghost" onclick="openStudentDetailV37('rec-${safe}')"><span data-icon="user-check"></span> التسميع</button>
        <button class="btn ghost" onclick="openStudentDetailV37('gr-${safe}')"><span data-icon="bar-chart"></span> الدرجات</button>
        <button class="btn ghost" onclick="openStudentDetailV37('hw-${safe}')"><span data-icon="file-text"></span> الواجبات</button>
      </section>
      <section class="card student-detail-panel-v37 show" id="att-${safe}"><h3>سجل الحضور</h3><div class="mini-stats"><span>حاضر ${att.present||0}</span><span>غياب ${att.absent||0}</span><span>تأخير ${att.late||0}</span></div><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحالة</th><th>الحصة</th><th>ملاحظة</th></tr></thead><tbody>${rowsOrEmpty(attendanceRows,4)}</tbody></table></div></section>
      <section class="card student-detail-panel-v37" id="rec-${safe}"><h3>سجل التسميع</h3><div class="mini-stats"><span>سمع ${rec.heard||0}</span><span>لم يسمع ${rec.notHeard||0}</span><span>لم يحضر ${rec.absent||0}</span></div><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحصة</th><th>الحالة</th><th>ملاحظة</th></tr></thead><tbody>${rowsOrEmpty(recRows,4)}</tbody></table></div></section>
      <section class="card student-detail-panel-v37" id="gr-${safe}"><h3>الدرجات والنتائج</h3><div class="table-wrap"><table><thead><tr><th>الامتحان</th><th>الدرجة</th><th>النوع</th><th>التاريخ</th></tr></thead><tbody>${rowsOrEmpty(gradeRows,4)}</tbody></table></div><a class="btn primary" href="exams.html?code=${encodeURIComponent(st.code)}"><span data-icon="clipboard"></span> فتح الامتحانات</a></section>
      <section class="card student-detail-panel-v37" id="hw-${safe}"><h3>الواجبات المطلوبة</h3><div class="table-wrap"><table><thead><tr><th>الواجب</th><th>آخر موعد</th><th>الحالة</th><th>رفع</th></tr></thead><tbody>${rowsOrEmpty(assignmentRows,4)}</tbody></table></div><h3>تسليمات الطالب</h3><div class="table-wrap"><table><thead><tr><th>الواجب</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${rowsOrEmpty(homeRows,3)}</tbody></table></div></section>
      <button class="btn primary report-print-btn" onclick="window.print()"><span data-icon="file-text"></span> طباعة الملف</button>
    </div>`;
  };
  const oldSetupStudentV37 = window.setupStudent || setupStudent;
  window.setupStudent = function(){
    oldSetupStudentV37?.();
    const box=document.getElementById('studentResult'); const params=new URLSearchParams(location.search); const code=params.get('code');
    if(code&&box){const st=findStudent(code); box.innerHTML=st?studentCard(st):'<div class="empty-state"><h3>لم يتم العثور على الطالب</h3></div>'; hydrateIcons(); renderRealQRCodes?.();}
  };
  function applyHeaderActiveV37(){
    const file=location.pathname.split('/').pop()||'index.html';
    document.querySelectorAll('.navlinks a,.mobile-bottom a').forEach(a=>{const href=a.getAttribute('href')||''; a.classList.toggle('active', href===file || (file==='index.html'&&href==='index.html'));});
  }
  try{applyHeaderActiveV37(); setupStudent(); hydrateIcons(); renderRealQRCodes?.();}catch(e){console.warn('v37 public simplify failed',e);}
})();
