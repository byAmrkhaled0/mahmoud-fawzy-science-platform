var DEFAULT_SITE_URL = 'https://mahmoud-fawzy-science-platform.vercel.app';
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

var PRODUCTION_MODE = true;
var appDataLoadFailed = false;

function iconNameToKey(name){return String(name||'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());}
function hydrateIcons(){document.querySelectorAll('[data-icon]').forEach(el=>{const key=iconNameToKey(el.dataset.icon); if(icons[key]) el.innerHTML=icons[key];});}
function toast(msg){const t=document.getElementById('toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2800);}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function normalizeText(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,' ');}
function phoneDigits(v){return String(v||'').replace(/\D/g,'');}
function uid(prefix='ST'){return `${prefix}-${Math.floor(1000+Math.random()*9000)}`;}
function isoDate(d=new Date()){return d.toISOString().slice(0,10);}
function arStatus(status){return status==='present'?'حاضر':status==='absent'?'غائب':(status||'-');}
function statusClass(status){return status==='present'||status==='حاضر'||status===true?'good':status==='absent'||status==='غائب'||status===false?'danger':'warn';}
function whatsappLink(phone,msg){return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;}
function whatsappPhone(v){const d=phoneDigits(v); if(!d) return ''; if(d.startsWith('20')) return d; if(d.startsWith('0')) return '2'+d; return d;}
function monthLabel(st){return st?.month || MONTHS[new Date().getMonth()] || '';}
function getSiteBase(){return (appData.settings?.siteUrl || DEFAULT_SITE_URL || location.origin).replace(/\/$/,'');}
function defaultData(){return {students:[],bookings:[],materials:[],questions:[],exams:[],examAttempts:[],grades:[],reviews:[],groups:[],assignments:[],settings:{siteUrl:DEFAULT_SITE_URL||'',teacherPhone:TEACHER_WHATSAPP||''}};}
function mergeData(data){const d=defaultData(); const p=data||{}; return {...d,...p,settings:{...d.settings,...(p.settings||{})},students:Array.isArray(p.students)?p.students:[],bookings:Array.isArray(p.bookings)?p.bookings:[],materials:Array.isArray(p.materials)?p.materials:[],questions:Array.isArray(p.questions)?p.questions:[],exams:Array.isArray(p.exams)?p.exams:[],examAttempts:Array.isArray(p.examAttempts)?p.examAttempts:[],grades:Array.isArray(p.grades)?p.grades:[],reviews:Array.isArray(p.reviews)?p.reviews:[],groups:Array.isArray(p.groups)?p.groups:[],assignments:Array.isArray(p.assignments)?p.assignments:[]};}
function loadData(){try{return mergeData(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'));}catch(e){return defaultData();}}
function saveData(data){localStorage.setItem(STORAGE_KEY,JSON.stringify(mergeData(data)));}
var appData = loadData();
function queueCloudSave(){ if(!window.MFCloud?.ready || !window.MFCloud.saveSiteData) return; clearTimeout(cloudSaveTimer); cloudSaveTimer=setTimeout(()=>window.MFCloud.saveSiteData(appData).catch(()=>{}),500); }
function persist(msg){saveData(appData); queueCloudSave(); if(msg) toast(msg); refreshActiveViews();}
function dataErrorHTML(){return `<div class="empty-state compact-empty-v29"><span class="iconbox" data-icon="database"></span><h3>تعذر تحميل البيانات، حاول لاحقًا.</h3><p>لم يتم عرض أي بيانات وهمية في نسخة الإنتاج.</p></div>`;}
async function initFirebaseData(){
  if(!window.MFCloud?.ready || !window.MFCloud.loadSiteData) return;
  try{
    const cloudData = await window.MFCloud.loadSiteData();
    if(cloudData){ appData = mergeData(cloudData); saveData(appData); refreshActiveViews(); }
  }catch(e){ appDataLoadFailed=true; refreshActiveViews(); }
}
function refreshActiveViews(){
  const path=(location.pathname.split('/').pop()||'index.html');
  try{
    if(document.getElementById('liveCounts')) renderHomeCounts();
    if(document.getElementById('publicLeaderboard')) renderPublicLeaderboard();
    if(document.getElementById('reviewsList')) renderReviews();
    if(document.getElementById('bookingPreview')) renderBookingPreview();
    if(path==='materials.html') renderUnifiedResourcesPage();
  }catch(e){}
}
function setupTheme(){
  const saved=localStorage.getItem('theme')||'light'; document.documentElement.dataset.theme=saved;
  document.querySelectorAll('#themeToggle,#themeToggleAdmin').forEach(btn=>{btn.innerHTML=icons[saved==='dark'?'sun':'moon']; btn.onclick=()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark'; document.documentElement.dataset.theme=next; localStorage.setItem('theme',next); setupTheme();};});
}
function fillSelects(){
  const grade=document.getElementById('bookingGrade'); if(grade) grade.innerHTML=GRADES.map(g=>`<option>${esc(g)}</option>`).join('');
  const month=document.getElementById('bookingMonth'); if(month) month.innerHTML=MONTHS.map(m=>`<option>${esc(m)}</option>`).join('');
}
function groupOptions(){const base=['مجموعة السبت والثلاثاء','مجموعة الأحد والأربعاء','مجموعة الاثنين والخميس','أونلاين متابعة']; const fromData=(appData.groups||[]).map(g=>g.name||g.group||g.title).filter(Boolean); const fromStudents=(appData.students||[]).map(s=>s.group).filter(Boolean); return [...new Set([...base,...fromData,...fromStudents])];}
function calcStudent(st){
  const attendance = getAttendanceRows(st);
  const total = attendance.length;
  const present = attendance.filter(a=>(a.status==='present'||a.status==='حاضر'||a.status==='متأخر')).length;
  const attendancePct = total ? Math.round((present/total)*100) : 0;
  const graded=(st.grades||[]).filter(g=>g.score!==''&&g.score!==undefined&&g.score!==null&&!isNaN(Number(g.score)));
  const avg=graded.length?Math.round(graded.reduce((s,g)=>s+Number(g.score),0)/graded.length):0;
  const hw=(st.homeworks||[]); const hwPct=hw.length?Math.round(hw.filter(h=>String(h.status||'').includes('تم')).length/hw.length*100):0;
  const final=Math.round(attendancePct*.3+avg*.5+hwPct*.2);
  const level= final>=90?'ممتاز':final>=75?'جيد جدًا':final>=60?'جيد':'محتاج متابعة';
  return {attendancePct,avg,hwPct,final,level,totalAttendance:total,present,absent:attendance.filter(a=>(a.status==='absent'||a.status==='غائب')).length,lastGrade:graded.at(-1)};
}
function normalizedStudent(st){const code=st?.studentCode||st?.code||st?.id||''; return {...(st||{}),id:code,code,studentCode:code,name:st?.studentName||st?.name||'',studentName:st?.studentName||st?.name||''};}
function findStudentByCode(code){const q=normalizeText(code); return (appData.students||[]).map(normalizedStudent).find(s=>normalizeText(s.code)===q || normalizeText(s.studentCode)===q) || null;}
function attendanceDocId(st,date){return `${st.studentCode||st.code}_${date}`.replace(/[\\/#?\[\]]/g,'-');}
function getAttendanceRows(st){
  const legacy=(st.attendance||[]).map(a=>({...a,status:a.status==='حاضر'?'present':a.status==='غائب'?'absent':a.status,date:String(a.date||'').replaceAll('/','-'),time:a.time||'',group:a.group||st.group}));
  return legacy.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
function attendanceSummaryHTML(st){
  const rows=getAttendanceRows(st); const total=rows.length; const present=rows.filter(a=>a.status==='present'||a.status==='حاضر'||a.status==='متأخر').length; const absent=rows.filter(a=>a.status==='absent'||a.status==='غائب').length; const pct=total?Math.round(present/total*100):0;
  return `<div class="attendance-public-card"><div class="section-head mini"><div><span class="kicker"><span data-icon="calendar"></span> الحضور والغياب</span><h3>ملخص حضور الطالب</h3></div></div><div class="metric-grid parent-metrics-v29"><div class="metric"><b>${total}</b><small>إجمالي الحصص</small></div><div class="metric"><b>${present}</b><small>أيام الحضور</small></div><div class="metric"><b>${absent}</b><small>أيام الغياب</small></div><div class="metric"><b>${pct}%</b><small>نسبة الحضور</small></div></div><div class="mobile-card-table">${rows.slice(0,12).map(r=>`<div class="mobile-row"><b>${esc(r.date||'-')}</b><span class="badge ${statusClass(r.status)}">${arStatus(r.status)}</span><small>${esc(r.time||'-')} · ${esc(r.group||st.group||'-')}</small></div>`).join('')||'<p class="section-desc">لا توجد سجلات حضور بعد.</p>'}</div><div class="table-wrap attendance-table"><table><thead><tr><th>التاريخ</th><th>الحالة</th><th>الوقت</th><th>المجموعة</th></tr></thead><tbody>${rows.slice(0,12).map(r=>`<tr><td>${esc(r.date||'-')}</td><td><span class="badge ${statusClass(r.status)}">${arStatus(r.status)}</span></td><td>${esc(r.time||'-')}</td><td>${esc(r.group||st.group||'-')}</td></tr>`).join('')||'<tr><td colspan="4">لا توجد سجلات حضور بعد</td></tr>'}</tbody></table></div></div>`;
}
function qrValue(st){return st.studentCode||st.code||'';}
const QR_ALPHA='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
function qrGfTables(){
  const exp=new Array(512).fill(0), log=new Array(256).fill(0); let x=1;
  for(let i=0;i<255;i++){exp[i]=x; log[x]=i; x<<=1; if(x&0x100) x^=0x11d;}
  for(let i=255;i<512;i++) exp[i]=exp[i-255];
  return {exp,log};
}
const QR_GF=qrGfTables();
function qrGfMul(x,y){return (!x||!y)?0:QR_GF.exp[(QR_GF.log[x]+QR_GF.log[y])%255];}
function qrRsDivisor(deg){
  const res=new Array(deg).fill(0); res[deg-1]=1; let root=1;
  for(let i=0;i<deg;i++){
    for(let j=0;j<deg;j++){res[j]=qrGfMul(res[j],root); if(j+1<deg) res[j]^=res[j+1];}
    root=qrGfMul(root,2);
  }
  return res;
}
function qrRsRemainder(data,deg){
  const div=qrRsDivisor(deg), rem=new Array(deg).fill(0);
  for(const b of data){const factor=b^rem.shift(); rem.push(0); for(let i=0;i<deg;i++) rem[i]^=qrGfMul(div[i],factor);}
  return rem;
}
function qrAppendBits(arr,val,len){for(let i=len-1;i>=0;i--) arr.push((val>>>i)&1);}
function qrDataCodewords(text){
  const bits=[]; qrAppendBits(bits,0b0010,4); qrAppendBits(bits,text.length,9);
  for(let i=0;i<text.length;i+=2){
    if(i+1<text.length) qrAppendBits(bits,QR_ALPHA.indexOf(text[i])*45+QR_ALPHA.indexOf(text[i+1]),11);
    else qrAppendBits(bits,QR_ALPHA.indexOf(text[i]),6);
  }
  const capacity=19*8; qrAppendBits(bits,0,Math.min(4,capacity-bits.length));
  while(bits.length%8) bits.push(0);
  const data=[]; for(let i=0;i<bits.length;i+=8){let b=0; for(let j=0;j<8;j++) b=(b<<1)|bits[i+j]; data.push(b);}
  for(let p=0;data.length<19;p++) data.push(p%2?0x11:0xec);
  return data;
}
function qrFormatBits(ecl,mask){
  const data=(ecl<<3)|mask; let rem=data;
  for(let i=0;i<10;i++) rem=(rem<<1)^(((rem>>>9)&1)*0x537);
  return ((data<<10)|rem)^0x5412;
}
function qrMatrix(value){
  const size=21, modules=Array.from({length:size},()=>Array(size).fill(false)), reserved=Array.from({length:size},()=>Array(size).fill(false));
  const set=(x,y,v)=>{if(x>=0&&x<size&&y>=0&&y<size){modules[y][x]=!!v; reserved[y][x]=true;}};
  const finder=(x,y)=>{for(let dy=-1;dy<=7;dy++)for(let dx=-1;dx<=7;dx++){const xx=x+dx, yy=y+dy; if(xx<0||xx>=size||yy<0||yy>=size) continue; const dark=dx>=0&&dx<=6&&dy>=0&&dy<=6&&(dx===0||dx===6||dy===0||dy===6||(dx>=2&&dx<=4&&dy>=2&&dy<=4)); set(xx,yy,dark);}};
  finder(0,0); finder(size-7,0); finder(0,size-7);
  for(let i=8;i<size-8;i++){set(i,6,i%2===0); set(6,i,i%2===0);}
  const f=qrFormatBits(1,0), bit=i=>((f>>>i)&1)===1;
  for(let i=0;i<6;i++) set(8,i,bit(i)); set(8,7,bit(6)); set(8,8,bit(7)); set(7,8,bit(8));
  for(let i=9;i<15;i++) set(14-i,8,bit(i));
  for(let i=0;i<8;i++) set(size-1-i,8,bit(i));
  for(let i=8;i<15;i++) set(8,size-15+i,bit(i));
  set(8,size-8,true);
  const data=qrDataCodewords(value), all=data.concat(qrRsRemainder(data,7)), bits=[];
  for(const b of all) for(let i=7;i>=0;i--) bits.push((b>>>i)&1);
  let idx=0, upward=true;
  for(let x=size-1;x>0;x-=2){
    if(x===6) x--;
    for(let step=0;step<size;step++){
      const y=upward ? size-1-step : step;
      for(const dx of [0,1]){const xx=x-dx; if(!reserved[y][xx]){let v=idx<bits.length?bits[idx++]:0; if((xx+y)%2===0) v^=1; modules[y][xx]=!!v;}}
    }
    upward=!upward;
  }
  return modules;
}
function makeQR(value){
  const text=String(value||'').trim().toUpperCase();
  if(!text || text.length>25 || ![...text].every(ch=>QR_ALPHA.includes(ch))) return `<div class="qr-card real-qr-svg"><span>${esc(text||'NO CODE')}</span></div>`;
  const m=qrMatrix(text), size=21, border=4, total=size+border*2, cell=5;
  let rects='';
  m.forEach((row,y)=>row.forEach((dark,x)=>{if(dark) rects+=`<rect x="${(x+border)*cell}" y="${(y+border)*cell}" width="${cell}" height="${cell}"/>`;}));
  return `<div class="qr-card real-qr-svg" title="${esc(text)}"><svg viewBox="0 0 ${total*cell} ${total*cell}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QR ${esc(text)}"><rect width="100%" height="100%" fill="#fff"/><g fill="#0d1730">${rects}</g></svg></div>`;
}
function studentProfileHTML(raw, isParent=false){
  const st=normalizedStudent(raw); const c=calcStudent(st);
  const attempts=[...(st.examAttempts||[]),...(appData.examAttempts||[]).filter(a=>a.studentCode===st.studentCode||a.studentCode===st.code)];
  return `<div class="student-profile student-report-full-v32"><div class="profile-top"><div><span class="kicker"><span data-icon="user-check"></span> ${isParent?'تقرير ولي الأمر':'ملف الطالب'}</span><h2>${esc(st.name)}</h2><p class="section-desc">الكود: <b>${esc(st.studentCode)}</b> · ${esc(st.grade||'-')} · ${esc(st.group||'-')}</p></div><div class="real-qr-wrap"><b>QR الطالب</b>${makeQR(qrValue(st))}<small>${esc(qrValue(st))}</small></div></div><div class="metric-grid student-summary-grid-v37"><div class="metric"><b>${c.final}%</b><small>المستوى العام</small></div><div class="metric"><b>${c.avg}%</b><small>متوسط الدرجات</small></div><div class="metric"><b>${c.attendancePct}%</b><small>نسبة الحضور</small></div><div class="metric"><b>${st.paid?'تم الدفع':'لم يدفع'}</b><small>حالة الدفع</small></div></div><div class="grid grid-2 student-info-grid-v37"><div class="mini-panel"><h3>ملاحظات المدرس</h3><p>${esc(st.notes||'لا توجد ملاحظات حالية.')}</p></div><div class="mini-panel"><h3>آخر درجة</h3><p>${c.lastGrade?`${esc(c.lastGrade.exam||'امتحان')} — ${esc(c.lastGrade.score)}%`:'لا توجد درجات بعد.'}</p></div></div>${attendanceSummaryHTML(st)}<div class="grid grid-2"><div class="card"><h3>سجل الامتحانات والدرجات</h3>${[...(st.grades||[]),...attempts].length?[...(st.grades||[]),...attempts].slice(-8).reverse().map(g=>`<div class="mobile-row"><b>${esc(g.exam||g.examTitle||'امتحان')}</b><span class="badge ${statusClass(true)}">${g.score!==null&&g.score!==undefined?esc(g.score)+'%':'بانتظار التصحيح'}</span><small>${esc(g.date||g.submittedAt||'')}</small></div>`).join(''):'<p class="section-desc">لا توجد امتحانات مسجلة.</p>'}</div><div class="card"><h3>الواجبات</h3>${(st.homeworks||[]).length?(st.homeworks||[]).map(h=>`<div class="mobile-row"><b>${esc(h.title||'واجب')}</b><span class="badge ${String(h.status||'').includes('تم')?'good':'warn'}">${esc(h.status||'-')}</span></div>`).join(''):'<p class="section-desc">لا توجد واجبات مسجلة.</p>'}<form class="homework-upload-form" data-student-code="${esc(st.studentCode)}"><input type="file" name="file" accept="image/*,application/pdf"><button class="btn ghost" type="submit"><span data-icon="upload"></span> رفع واجب</button></form></div></div></div>`;
}
async function loadStudentForPortal(code){
  if(window.MFCloud?.ready && window.MFCloud.getStudentByCode){try{return await window.MFCloud.getStudentByCode(code);}catch(e){}}
  return findStudentByCode(code);
}
async function setupStudent(){
  const form=document.getElementById('studentSearchForm'); if(!form) return;
  form.addEventListener('submit', async e=>{e.preventDefault(); const code=form.querySelector('[name="query"],#studentQuery')?.value.trim(); const box=document.getElementById('studentResult'); if(!code) return; box.innerHTML='<div class="skeleton" style="height:160px"></div>'; const st=await loadStudentForPortal(code); if(!st){box.innerHTML=`<div class="empty-state compact-empty-v29"><span class="iconbox" data-icon="search"></span><h3>لم يتم العثور على طالب بهذا الكود.</h3><p>دخول الطالب أصبح بالكود فقط لحماية البيانات.</p></div>`; hydrateIcons(); return;} box.innerHTML=studentProfileHTML(st,false); bindHomeworkForms(); hydrateIcons();});
}
var parentQrScanner = null;
var lastParentStudent = null;

function studentReportRows(st){
  const attendance = getAttendanceRows(st);
  const grades = [...(st.grades||[]),...(st.examAttempts||[])];
  const homeworks = st.homeworks || [];
  return { attendance, grades, homeworks };
}

function parentReportText(raw){
  const st = normalizedStudent(raw);
  const c = calcStudent(st);
  const rows = studentReportRows(st);
  const lastGrade = rows.grades.filter(g=>g.score!==undefined && g.score!==null && g.score!=='').slice(-1)[0];
  const lastAttendance = rows.attendance.slice(0,6).map(r=>`- ${r.date || '-'}: ${arStatus(r.status)} ${r.time ? '('+r.time+')' : ''}`).join('\n') || '- لا توجد سجلات حضور بعد';
  return `تقرير متابعة شهر ${monthLabel(st)}\n\nالطالب: ${st.name || '-'}\nالكود: ${st.studentCode || '-'}\nالصف: ${st.grade || '-'}\nالمجموعة: ${st.group || '-'}\n\nملخص الحالة:\n- المستوى العام: ${c.final}% - ${c.level}\n- نسبة الحضور: ${c.attendancePct}%\n- متوسط الدرجات: ${c.avg}%\n- حالة الدفع: ${st.paid ? 'تم الدفع' : 'لم يدفع'}\n\nآخر درجة: ${lastGrade ? (lastGrade.exam || lastGrade.examTitle || 'امتحان') + ' - ' + (lastGrade.score ?? 'بانتظار التصحيح') : 'لا توجد درجات بعد'}\n\nالحضور والغياب:\n${lastAttendance}\n\nملاحظات المدرس:\n${st.notes || 'لا توجد ملاحظات حالية.'}\n\nمع تحيات مستر محمود إبراهيم فوزي`;
}

function parentReportHTML(raw){
  const st = normalizedStudent(raw);
  const c = calcStudent(st);
  const rows = studentReportRows(st);
  const grades = rows.grades.slice(-8).reverse();
  const hw = rows.homeworks.slice(-6).reverse();
  const payClass = st.paid ? 'good' : 'danger';
  const teacherName = appData.settings?.teacherName || 'مستر محمود إبراهيم فوزي';
  const today = new Date().toLocaleDateString('ar-EG');
  return `<div class="parent-monthly-report-v40" id="parentMonthlyReport">
    <div class="parent-report-cover-v40">
      <div class="parent-report-brand-v40">
        <span class="teacher-name-v40">${esc(teacherName)}</span>
        <span class="report-date-v40">${esc(today)}</span>
      </div>
      <div class="parent-report-cover-content-v40">
        <div class="parent-report-main-v40">
          <span class="kicker"><span data-icon="file-text"></span> تقرير ولي الأمر الشهري</span>
          <h2>${esc(st.name || '-')}</h2>
          <p>تقرير متابعة شهر <b>${esc(monthLabel(st))}</b> · كود الطالب: <b>${esc(st.studentCode)}</b></p>
          <div class="parent-report-tags-v40">
            <span>${esc(st.grade || '-')}</span>
            <span>${esc(st.group || '-')}</span>
            <span class="badge ${payClass}">${st.paid?'تم الدفع':'لم يدفع'}</span>
          </div>
        </div>
        <div class="parent-report-qr-v40"><b>QR الطالب</b>${makeQR(qrValue(st))}<small>${esc(qrValue(st))}</small></div>
      </div>
    </div>
    <div class="parent-actions-v38 no-print">
      <button class="btn primary" onclick="window.print()"><span data-icon="file-text"></span> طباعة / حفظ PDF</button>
      <button class="btn ghost" onclick="copyParentReport('${esc(st.studentCode)}')"><span data-icon="clipboard"></span> نسخ التقرير</button>
      <button class="btn whatsapp-report-btn" onclick="openParentWhatsApp('${esc(st.studentCode)}')"><span data-icon="phone"></span> إرسال واتساب</button>
    </div>
    <div class="metric-grid parent-report-metrics-v40">
      <div class="metric main-metric-v40"><b>${c.final}%</b><small>المستوى العام</small></div>
      <div class="metric"><b>${c.attendancePct}%</b><small>نسبة الحضور</small></div>
      <div class="metric"><b>${c.avg}%</b><small>متوسط الدرجات</small></div>
      <div class="metric"><b>${c.totalAttendance}</b><small>إجمالي الحصص</small></div>
      <div class="metric"><b>${c.present}</b><small>حضور</small></div>
      <div class="metric"><b>${c.absent}</b><small>غياب</small></div>
    </div>
    <div class="parent-status-card-v40 ${c.final>=75?'good':'warn'}">
      <div><span>الحالة العامة</span><h3>${esc(c.level)}</h3></div>
      <p>${c.final>=75?'المستوى مطمئن، حافظوا على نفس الالتزام.':'محتاج متابعة منتظمة في الحضور والواجبات والدرجات.'}</p>
    </div>
    ${attendanceSummaryHTML(st)}
    <div class="parent-detail-grid-v40">
      <div class="mini-panel parent-panel-v40">
        <h3>الدرجات والامتحانات</h3>
        ${grades.length?grades.map(g=>`<div class="report-list-row-v40"><div><b>${esc(g.exam||g.examTitle||'امتحان')}</b><small>${esc(g.date||g.submittedAt||'')}</small></div><span class="badge ${g.score!==null&&g.score!==undefined?'good':'warn'}">${g.score!==null&&g.score!==undefined?esc(g.score)+'%':'بانتظار التصحيح'}</span></div>`).join(''):'<p class="section-desc">لا توجد درجات مسجلة بعد.</p>'}
      </div>
      <div class="mini-panel parent-panel-v40">
        <h3>الواجبات والمتابعة</h3>
        ${hw.length?hw.map(h=>`<div class="report-list-row-v40"><div><b>${esc(h.title||h.homeworkTitle||'واجب')}</b><small>${esc(h.date||'')}</small></div><span class="badge ${String(h.status||'').includes('تم')?'good':'warn'}">${esc(h.status||'-')}</span></div>`).join(''):'<p class="section-desc">لا توجد واجبات مسجلة بعد.</p>'}
      </div>
      <div class="mini-panel parent-panel-v40 parent-notes-v40">
        <h3>ملاحظات ${esc(teacherName)}</h3>
        <p>${esc(st.notes||'لا توجد ملاحظات حالية.')}</p>
      </div>
      <div class="mini-panel parent-panel-v40 parent-pay-v40">
        <h3>الدفع والشهر</h3>
        <p><b>الشهر:</b> ${esc(monthLabel(st))}</p>
        <p><b>حالة الدفع:</b> <span class="badge ${payClass}">${st.paid?'تم الدفع':'لم يدفع'}</span></p>
        ${st.paymentDate?`<p><b>تاريخ الدفع:</b> ${esc(st.paymentDate)}</p>`:''}
      </div>
    </div>
    <div class="report-footer-v40">مع تحيات ${esc(teacherName)}</div>
  </div>`;
}

async function showParentReportByCode(code){
  const box=document.getElementById('parentResult');
  if(!code){toast('اكتب كود الطالب أو امسح QR'); return;}
  if(box) box.innerHTML='<div class="skeleton" style="height:160px"></div>';
  let st=null;
  if(window.MFCloud?.ready && window.MFCloud.getParentStudent){
    try{st=await window.MFCloud.getParentStudent(code);}catch(e){}
  }
  if(!st) st=findStudentByCode(code);
  if(!st){
    if(box) box.innerHTML=`<div class="empty-state compact-empty-v29"><span class="iconbox" data-icon="search"></span><h3>لم يتم العثور على طالب بهذا الكود.</h3><p>تأكد من كتابة كود الطالب أو امسح QR الصحيح.</p></div>`;
    hydrateIcons();
    return;
  }
  lastParentStudent = normalizedStudent(st);
  const input=document.querySelector('#parentSearchForm [name="studentCode"]'); if(input) input.value=lastParentStudent.studentCode;
  if(box) box.innerHTML=parentReportHTML(lastParentStudent);
  hydrateIcons();
}

async function setupParent(){
  const form=document.getElementById('parentSearchForm'); if(!form) return;
  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const code=form.querySelector('[name="studentCode"],[name="code"],[name="query"]')?.value.trim();
    await showParentReportByCode(code);
  });
}

window.copyParentReport = async function(code){
  const st = (lastParentStudent && lastParentStudent.studentCode===code) ? lastParentStudent : findStudentByCode(code);
  if(!st) return toast('لم يتم العثور على الطالب');
  try{await navigator.clipboard.writeText(parentReportText(st)); toast('تم نسخ التقرير');}
  catch(e){toast('تعذر النسخ، جرّب من متصفح أحدث');}
};

window.openParentWhatsApp = function(code){
  const st = (lastParentStudent && lastParentStudent.studentCode===code) ? lastParentStudent : findStudentByCode(code);
  if(!st) return toast('لم يتم العثور على الطالب');
  const phone = whatsappPhone(st.parentPhone);
  if(!phone) return toast('رقم ولي الأمر غير موجود في بيانات الطالب');
  window.open(whatsappLink(phone, parentReportText(st)), '_blank');
};

window.openParentQrScanner = async function(){
  const modal=document.getElementById('parentQrModal'); const reader=document.getElementById('parentQrReader');
  if(!modal || !reader) return;
  modal.hidden=false; reader.innerHTML='';
  try{
    const onDecoded = async decoded => { await closeParentQrScanner(); await showParentReportByCode(String(decoded||'').trim()); };
    if(window.Html5Qrcode){
      parentQrScanner = new Html5Qrcode('parentQrReader');
      await parentQrScanner.start({facingMode:'environment'},{fps:10,qrbox:{width:250,height:250}}, onDecoded);
    } else if('BarcodeDetector' in window){
      reader.innerHTML='<video id="parentQrVideo" autoplay playsinline></video>';
      const video=document.getElementById('parentQrVideo');
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
      video.srcObject=stream;
      const detector=new BarcodeDetector({formats:['qr_code']});
      const loop=async()=>{ if(modal.hidden) return; const codes=await detector.detect(video).catch(()=>[]); if(codes.length) return onDecoded(codes[0].rawValue); setTimeout(loop,700); };
      loop();
    } else {
      reader.innerHTML='<p class="section-desc">المتصفح لا يدعم ماسح QR. استخدم إدخال الكود اليدوي.</p>';
    }
  }catch(e){
    reader.innerHTML='<p class="section-desc">تعذر فتح الكاميرا. افتح الموقع من HTTPS واسمح باستخدام الكاميرا.</p>';
  }
};

window.closeParentQrScanner = async function(){
  try{ if(parentQrScanner){ await parentQrScanner.stop(); parentQrScanner.clear(); parentQrScanner=null; } }catch(e){}
  const v=document.getElementById('parentQrVideo'); if(v?.srcObject) v.srcObject.getTracks().forEach(t=>t.stop());
  const modal=document.getElementById('parentQrModal'); if(modal) modal.hidden=true;
};
function bindHomeworkForms(){document.querySelectorAll('.homework-upload-form').forEach(form=>{form.onsubmit=async e=>{e.preventDefault(); const file=form.querySelector('input[type=file]').files[0]; const code=form.dataset.studentCode; if(!file) return toast('اختار ملف الواجب أولًا'); if(file.size>10*1024*1024) return toast('حجم الملف أكبر من المسموح'); try{if(window.MFCloud?.uploadHomework){await window.MFCloud.uploadHomework(file,code); toast('تم رفع الواجب بنجاح');} else toast('تعذر رفع الواجب، حاول لاحقًا.');}catch(err){toast('تعذر رفع الواجب، حاول لاحقًا.');}};});}
function setupBooking(){
  const form=document.getElementById('bookingForm'); if(form){form.addEventListener('submit',async e=>{
    e.preventDefault();
    const b=Object.fromEntries(new FormData(form).entries());
    if(phoneDigits(b.studentPhone)===phoneDigits(b.parentPhone)) return toast('رقم ولي الأمر لازم يكون مختلف عن رقم الطالب');
    b.code=uid('ST');
    b.id=b.code;
    b.studentCode=b.code;
    b.studentName=b.name;
    b.date=isoDate();
    b.status='بانتظار الموافقة';

    // مهم: لا نعرض نجاح وهمي. لازم الحجز يتسجل في Firebase عشان يظهر في لوحة المدرس من أي جهاز.
    let savedToCloud=false;
    try{
      if(window.MFCloud?.ready && window.MFCloud?.createBooking){
        await window.MFCloud.createBooking(b);
        savedToCloud=true;
      }
    }catch(err){ savedToCloud=false; }

    if(!savedToCloud){
      toast('تعذر إرسال الحجز للمدرس. تأكد من اتصال Firebase وقواعد Firestore.');
      return;
    }

    appData.bookings=Array.isArray(appData.bookings)?appData.bookings:[];
    appData.bookings.push(b);
    saveData(appData);
    renderBookingSuccess(b);
    renderBookingPreview();
    toast('تم تسجيل الحجز بنجاح وهو الآن بانتظار موافقة المدرس');
    form.reset();
    fillSelects();
  });}
  const statusForm=document.getElementById('bookingStatusForm'); if(statusForm){statusForm.addEventListener('submit',e=>{e.preventDefault(); const code=statusForm.querySelector('[name="code"]').value.trim(); renderBookingStatusResult(code);});}
}
function renderBookingSuccess(b){const box=document.getElementById('bookingSuccess'); if(!box) return; box.hidden=false; box.innerHTML=`<div class="booking-success-card"><span class="badge good">تم تسجيل الحجز بنجاح</span><h3>${esc(b.name)}</h3><div class="grid grid-2"><p><b>كود الطالب/الحجز:</b> ${esc(b.code)}</p><p><b>الصف:</b> ${esc(b.grade)}</p><p><b>الشهر:</b> ${esc(b.month)}</p><p><b>المجموعة:</b> ${esc(b.group)}</p></div><div class="hero-cta"><button class="btn ghost" onclick="copyBookingCode('${esc(b.code)}')"><span data-icon="clipboard"></span> نسخ الكود</button><a class="btn primary" target="_blank" rel="noreferrer" href="${whatsappLink(appData.settings?.teacherPhone||TEACHER_WHATSAPP,`تم تسجيل حجز للطالب ${b.name} - الكود ${b.code}`)}"><span data-icon="send"></span> تواصل واتساب</a></div></div>`; hydrateIcons();}
window.copyBookingCode=function(code){navigator.clipboard?.writeText(code); toast('تم نسخ الكود');};
function renderBookingPreview(){const box=document.getElementById('bookingPreview'); if(!box) return; const count=(appData.bookings||[]).length; box.innerHTML=count?`آخر الحجوزات المسجلة: <b>${count}</b> — لا تظهر بيانات الحجز كاملة إلا للمدرس.`:'لا توجد حجوزات مسجلة حاليًا.';}
function renderBookingStatusResult(code){const box=document.getElementById('bookingStatusResult'); if(!box) return; const b=(appData.bookings||[]).find(x=>normalizeText(x.code)===normalizeText(code)); box.innerHTML=b?`<div class="mobile-row"><b>${esc(b.name)}</b><span class="badge warn">${esc(b.status||'حجز جديد')}</span><small>${esc(b.grade)} · ${esc(b.month)} · ${esc(b.group)}</small></div>`:`<p class="section-desc">لم يتم العثور على حجز بهذا الكود.</p>`;}
function renderHomeCounts(){const el=document.getElementById('liveCounts'); if(!el)return; el.innerHTML=`<div class="stat"><b>${GRADES.length}</b><small>صفوف دراسية</small></div><div class="stat"><b>${(appData.students||[]).length}</b><small>طلاب مسجلين</small></div><div class="stat"><b>QR</b><small>حضور وامتحانات</small></div>`;}
function renderPublicLeaderboard(){const box=document.getElementById('publicLeaderboard'); if(!box) return; const rows=(appData.students||[]).map(normalizedStudent).map(st=>({st,c:calcStudent(st)})).sort((a,b)=>b.c.final-a.c.final).slice(0,3); box.innerHTML=rows.length?rows.map((x,i)=>`<div class="card"><span class="badge good">#${i+1}</span><h3>${esc(x.st.name)}</h3><p>${esc(x.st.grade||'')}</p><div class="progress"><span style="width:${x.c.final}%"></span></div><b>${x.c.final}%</b></div>`).join(''):`<div class="empty-state compact-empty-v29"><span class="iconbox" data-icon="star"></span><h3>لا توجد بيانات طلاب بعد</h3><p>لن يتم عرض بيانات تجريبية في الإنتاج.</p></div>`; hydrateIcons();}
function setupReviews(){const form=document.getElementById('reviewForm'); if(!form) return; setupStarInputs(); form.addEventListener('submit',async e=>{e.preventDefault(); const r=Object.fromEntries(new FormData(form).entries()); r.id='rev-'+Date.now(); r.date=isoDate(); r.approved=false; appData.reviews.push(r); saveData(appData); try{if(window.MFCloud?.saveReview) await window.MFCloud.saveReview(r);}catch(err){} toast('تم إرسال التقييم وينتظر المراجعة'); form.reset(); renderReviews();});}
function setupStarInputs(){document.querySelectorAll('[data-star-input]').forEach(w=>{const input=w.querySelector('input'); const label=w.querySelector('span'); const buttons=[...w.querySelectorAll('button')]; const paint=n=>{buttons.forEach(b=>b.classList.toggle('active',Number(b.dataset.rate)<=n)); if(label) label.textContent=n+' نجوم';}; buttons.forEach(b=>b.onclick=()=>{input.value=b.dataset.rate; paint(Number(b.dataset.rate));}); paint(Number(input?.value||5));});}
function renderReviews(){const box=document.getElementById('reviewsList'); if(!box) return; const rows=(appData.reviews||[]).filter(r=>r.approved!==false).slice(-6).reverse(); box.innerHTML=rows.length?rows.map(r=>`<div class="card"><div class="review-stars">${'★'.repeat(Number(r.rating||5))}</div><h3>${esc(r.name)}</h3><span class="badge">${esc(r.role||'طالب')}</span><p>${esc(r.text||'')}</p></div>`).join(''):`<div class="empty-state compact-empty-v29"><span class="iconbox" data-icon="star"></span><h3>لا توجد تقييمات منشورة بعد</h3><p>التقييمات الجديدة تظهر بعد مراجعة المدرس.</p></div>`; hydrateIcons();}
function attachmentHtml(item){if(item.fileData||item.fileUrl){const url=item.fileData||item.fileUrl; if(String(item.fileType||item.type||'').includes('image')||/\.(png|jpe?g|webp|gif)$/i.test(url)) return `<img class="attach-preview" src="${esc(url)}" alt="${esc(item.title||'ملف')}">`; return `<a class="btn ghost" target="_blank" rel="noreferrer" href="${esc(url)}"><span data-icon="external-link"></span> فتح الملف</a>`;} return '';}
function resourceCard(x, kind){return `<div class="card resource-card"><div class="resource-top"><span class="iconbox" data-icon="${kind==='question'?'help-circle':'book-open'}"></span><span class="badge">${esc(x.grade||'كل الصفوف')}</span></div><h3>${esc(x.title||'بدون عنوان')}</h3><p>${esc(x.desc||x.content||'')}</p>${attachmentHtml(x)}${x.answer?`<div class="written-box">الإجابة: ${esc(x.answer)}</div>`:''}</div>`;}
function renderUnifiedResourcesPage(){const m=document.getElementById('materialsPageGrid'); const q=document.getElementById('questionsPageGrid'); if(m) m.innerHTML=(appData.materials||[]).length?(appData.materials||[]).map(x=>resourceCard(x,'material')).join(''):'<p class="section-desc">لا توجد مراجعات مضافة حاليًا.</p>'; if(q) q.innerHTML=(appData.questions||[]).length?(appData.questions||[]).map(x=>resourceCard(x,'question')).join(''):'<p class="section-desc">لا توجد أسئلة مضافة حاليًا.</p>'; hydrateIcons();}
function renderExamQuestionsHtml(questions){return questions.map((q,i)=>`<div class="exam-question"><h3>${i+1}. ${esc(q.question)}</h3>${q.type==='essay'?`<textarea name="q${i}" placeholder="اكتب إجابتك هنا" required></textarea>`:`<div class="grid">${q.options.map((o,oi)=>`<label class="option-card"><input type="radio" name="q${i}" value="${oi}" required> ${esc(q.optionLabels?.[oi] ? q.optionLabels[oi] + ') ' : '')}${esc(o)}</label>`).join('')}</div>`}</div>`).join('');}
function cleanAnswerLine(line){return String(line||'').replace(/^(answer|correct|الإجابة|الاجابة|الإجابة الصحيحة|الاجابة الصحيحة)\s*[:=：-]?\s*/i,'').trim();}
function parseOptionLine(line){
  const raw=String(line||'').trim();
  let m=raw.match(/^([A-Da-dأإابجدهـه]|[1-4])\s*[\)\.\-:：]\s*(.+)$/);
  if(m) return {label:m[1].replace('إ','أ').replace('هـ','ه'), text:m[2].trim()};
  m=raw.match(/^-\s*(.+)$/);
  if(m) return {label:'', text:m[1].trim()};
  return null;
}
function parseExamQuestions(text){
  const blocks=String(text||'').split(/\n\s*\n/).map(b=>b.trim()).filter(Boolean);
  return blocks.map(block=>{
    const lines=block.split('\n').map(x=>x.trim()).filter(Boolean);
    const answerLine=lines.find(l=>/^(answer|correct|الإجابة|الاجابة|الإجابة الصحيحة|الاجابة الصحيحة)\s*[:=：-]?/i.test(l));
    const answer=answerLine?cleanAnswerLine(answerLine):'';
    const optionObjs=[];
    const questionLines=[];
    lines.forEach(l=>{
      if(l===answerLine) return;
      const opt=parseOptionLine(l);
      if(opt) optionObjs.push(opt); else questionLines.push(l.replace(/^س\d*\s*[:\-]?\s*/,'').trim());
    });
    const q=(questionLines[0]||lines[0]||'سؤال').replace(/^س\d*\s*[:\-]?\s*/,'').trim();
    if(optionObjs.length){
      return {type:'mcq',question:q,options:optionObjs.map(o=>o.text),optionLabels:optionObjs.map(o=>o.label),answer};
    }
    return {type:'essay',question:q,answer:''};
  });
}
function normalizeExamAnswerValue(v){return normalizeText(String(v||'').replace(/[\)\.\-:：]/g,'').trim()).replace(/إ/g,'أ').replace(/هـ/g,'ه');}
function mcqAnswerIsCorrect(q, chosenIndex){
  const chosen=q.options?.[Number(chosenIndex)]||'';
  const label=q.optionLabels?.[Number(chosenIndex)]||String(Number(chosenIndex)+1);
  const correct=String(q.answer||'').trim();
  if(!correct) return null;
  const c=normalizeExamAnswerValue(correct);
  const labelNorm=normalizeExamAnswerValue(label);
  const chosenNorm=normalizeExamAnswerValue(chosen);
  const numberNorm=String(Number(chosenIndex)+1);
  const answerToken=(correct.match(/^([A-Da-dأإابجدهـه]|[1-4])/)||[])[1]||'';
  const tokenNorm=normalizeExamAnswerValue(answerToken);
  return c===labelNorm || c===chosenNorm || c===numberNorm || (tokenNorm && tokenNorm===labelNorm);
}
function hasSubmitted(examId, code){return (appData.examAttempts||[]).some(a=>a.examId===examId && normalizeText(a.studentCode)===normalizeText(code) && a.status!=='started');}
function renderExamPortal(st){const box=document.getElementById('examStudentResult'); if(!box)return; const exams=(appData.exams||[]).filter(e=>!e.grade || e.grade===st.grade || e.grade==='كل الصفوف'); const attempts=(appData.examAttempts||[]).filter(a=>normalizeText(a.studentCode)===normalizeText(st.studentCode)); box.innerHTML=`<div class="profile-top"><div><h2>${esc(st.name)}</h2><p class="section-desc">${esc(st.grade||'')} · ${esc(st.studentCode)}</p></div></div><h3>الامتحانات المتاحة</h3><div class="grid grid-2">${exams.map(ex=>{const done=hasSubmitted(ex.id,st.studentCode)&&!ex.allowRetake; return `<div class="card exam-card"><span class="badge">${esc(ex.duration||20)} دقيقة</span><h3>${esc(ex.title)}</h3><p>${esc(ex.instructions||'')}</p><button class="btn primary" ${done?'disabled':''} onclick="startExam('${esc(ex.id)}','${esc(st.studentCode)}')">${done?'تم تسليم الامتحان':'بدء الامتحان'}</button></div>`;}).join('')||'<p class="section-desc">لا توجد امتحانات لهذا الصف حاليًا.</p>'}</div><h3 style="margin-top:20px">سجل الامتحانات والدرجات</h3>${attempts.length?attempts.slice().reverse().map(a=>`<div class="mobile-row"><b>${esc(a.examTitle||'امتحان')}</b><span class="badge ${a.needsManualReview?'warn':'good'}">${a.needsManualReview?'بانتظار التصحيح':esc(a.score)+'%'}</span><small>بدأ: ${esc(a.startedAt||'-')} · تسليم: ${esc(a.submittedAt||'-')}</small></div>`).join(''):'<p class="section-desc">لا توجد محاولات بعد.</p>'}`; hydrateIcons();}
function setupExamsPage(){const form=document.getElementById('examCodeForm'); if(!form)return; form.addEventListener('submit',async e=>{e.preventDefault(); const code=form.querySelector('[name="query"]').value.trim(); const st=await loadStudentForPortal(code); const box=document.getElementById('examStudentResult'); if(!st){box.innerHTML='<p class="section-desc">لم يتم العثور على طالب بهذا الكود.</p>'; return;} renderExamPortal(st);});}
window.startExam=function(examId, studentCode){const ex=(appData.exams||[]).find(e=>String(e.id)===String(examId)); const st=findStudentByCode(studentCode) || {studentCode}; if(!ex) return; if(hasSubmitted(examId,studentCode)&&!ex.allowRetake) return toast('تم تسليم الامتحان.'); const qs=parseExamQuestions(ex.text||ex.questionsText||''); if(!qs.length) return toast('الامتحان لا يحتوي على أسئلة صالحة'); const startedAt=new Date().toISOString(); const overlay=document.getElementById('examOverlay'), box=document.getElementById('examBox'); overlay.classList.add('show'); box.innerHTML=`<div class="profile-top"><h2>${esc(ex.title)}</h2><span class="badge warn" id="examTimer">${esc(ex.duration||20)}:00</span></div><form id="liveExamForm">${renderExamQuestionsHtml(qs)}<button class="btn primary"><span data-icon="send"></span> تسليم الامتحان</button></form>`; hydrateIcons(); let left=Number(ex.duration||20)*60; const timer=setInterval(()=>{left--; const m=Math.max(0,Math.floor(left/60)), s=Math.max(0,left%60); const t=document.getElementById('examTimer'); if(t)t.textContent=`${m}:${String(s).padStart(2,'0')}`; if(left<=0){clearInterval(timer); document.getElementById('liveExamForm')?.requestSubmit();}},1000); document.getElementById('liveExamForm').onsubmit=e=>{e.preventDefault(); clearInterval(timer); submitExamAttempt(ex, st, qs, new FormData(e.target), startedAt); overlay.classList.remove('show');};};
async function submitExamAttempt(ex, st, qs, fd, startedAt){
  let auto=0, mcqTotal=0, essayTotal=0, needsManual=false;
  const answers=[];
  qs.forEach((q,i)=>{
    const val=fd.get(`q${i}`);
    if(q.type==='mcq'){
      mcqTotal++;
      const chosenIndex=Number(val);
      const chosen=q.options?.[chosenIndex]||'';
      const ok=mcqAnswerIsCorrect(q, chosenIndex);
      if(ok===true) auto++;
      if(ok===null) needsManual=true;
      answers.push({question:q.question,type:q.type,answer:chosen,answerIndex:chosenIndex,correct:ok,correctAnswer:q.answer||'',options:q.options||[],optionLabels:q.optionLabels||[]});
    }else{
      essayTotal++;
      needsManual=true;
      answers.push({question:q.question,type:q.type,answer:val||'',correct:null,correctAnswer:'يصححها المدرس'});
    }
  });
  const autoScore=mcqTotal?Math.round(auto/mcqTotal*100):null;
  const finalScore=needsManual?null:(autoScore??0);
  const attempt={
    id:`${ex.id}_${st.studentCode}_${Date.now()}`,
    examId:ex.id,examTitle:ex.title,studentCode:st.studentCode||st.code,studentName:st.name||'',grade:st.grade||'',group:st.group||'',
    startedAt,submittedAt:new Date().toISOString(),score:finalScore,autoScore,maxScore:100,mcqCount:mcqTotal,essayCount:essayTotal,questionCount:qs.length,correctCount:auto,
    needsManualReview:needsManual,status:needsManual?'pending_manual':'submitted',answers
  };
  appData.examAttempts.push(attempt);
  persist(needsManual?'تم تسليم الامتحان وينتظر تصحيح المدرس':'تم تسليم الامتحان وتصحيحه تلقائيًا');
  try{if(window.MFCloud?.saveExamAttempt) await window.MFCloud.saveExamAttempt(attempt);}catch(e){}
  renderExamPortal(st);
}

function setupContact(){const a=document.getElementById('teacherWhatsapp'); if(a) a.href=whatsappLink(appData.settings?.teacherPhone||TEACHER_WHATSAPP,'مرحبًا مستر محمود، أريد الاستفسار عن الحجز.');}
function setupAdminLink(){document.querySelectorAll('a[href="teacher-login.html"]').forEach(a=>a.remove());}
window.startStudentScanner=async function(){const box=document.getElementById('qrScannerBox'), video=document.getElementById('qrScannerVideo'); if(!box||!video) return; box.hidden=false; try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}); video.srcObject=stream; await video.play(); toast('وجّه الكاميرا على QR الطالب'); if('BarcodeDetector' in window){const detector=new BarcodeDetector({formats:['qr_code']}); const loop=async()=>{if(box.hidden) return; try{const codes=await detector.detect(video); if(codes.length){document.getElementById('studentQuery').value=codes[0].rawValue; stopStudentScanner(); document.getElementById('studentSearchForm').requestSubmit(); return;}}catch(e){} requestAnimationFrame(loop);}; loop();} }catch(e){toast('تعذر فتح الكاميرا');}};
window.stopStudentScanner=function(){const box=document.getElementById('qrScannerBox'), video=document.getElementById('qrScannerVideo'); if(video?.srcObject) video.srcObject.getTracks().forEach(t=>t.stop()); if(box) box.hidden=true;};
function init(){setupTheme(); hydrateIcons(); fillSelects(); setupBooking(); setupStudent(); setupParent(); setupExamsPage(); setupReviews(); setupContact(); setupAdminLink(); renderHomeCounts(); renderPublicLeaderboard(); renderReviews(); renderBookingPreview(); renderUnifiedResourcesPage(); initFirebaseData();}
document.addEventListener('DOMContentLoaded',init);
