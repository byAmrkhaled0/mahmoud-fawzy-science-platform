(function(){
  'use strict';

  function connectLabels(){
    document.querySelectorAll('.field').forEach((field,index)=>{
      const label=field.querySelector(':scope > label');
      const control=field.querySelector('input:not([type="hidden"]),select,textarea');
      if(!label||!control)return;
      if(!control.id)control.id=`mf-field-${index+1}`;
      if(!label.htmlFor)label.htmlFor=control.id;
    });
    document.querySelectorAll('[data-star-input] button[data-rate]').forEach(button=>{
      const rate=Number(button.dataset.rate||0);
      button.setAttribute('aria-label',`${rate} ${rate===1?'نجمة':'نجوم'}`);
      button.setAttribute('aria-pressed',String(Number(button.parentElement?.querySelector('input')?.value||5)===rate));
      button.addEventListener('click',()=>{
        button.parentElement?.querySelectorAll('button[data-rate]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
      });
    });
    document.querySelectorAll('.theme-toggle').forEach(button=>{
      if(!button.getAttribute('aria-label'))button.setAttribute('aria-label','تغيير ألوان العرض');
    });
    const toast=document.getElementById('toast');
    if(toast){toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');}
  }

  function applyAdminStudentList(){
    if(typeof studentsTable!=='function'||typeof normalizeStudent!=='function')return;
    studentsTable=function(rows){
      const normalized=(rows||[]).map(normalizeStudent);
      const paid=normalized.filter(student=>student.paid).length;
      const manager=typeof currentStaff!=='undefined'&&['admin','teacher'].includes(currentStaff?.role);
      const cards=normalized.map(student=>{
        const result=typeof calcStudentAdmin==='function'?calcStudentAdmin(student):{attendancePct:0,avg:0};
        const initial=String(student.name||'ط').trim().charAt(0)||'ط';
        return `<article class="v56-student-row">
          <div class="v56-student-identity"><span class="student-avatar">${safe(initial)}</span><div><b>${safe(student.name)}</b><small>${safe(student.studentCode)} · ${safe(student.grade||'-')} · ${safe(student.group||'-')}</small></div></div>
          <div class="v56-student-kpis"><span class="badge ${student.paid?'good':'warn'}">${student.paid?'مشترك':'غير مشترك'}</span><span><small>الحضور</small><b>${Number(result.attendancePct||0)}%</b></span><span><small>الدرجات</small><b>${Number(result.avg||0)}%</b></span></div>
          <div class="v56-student-actions"><button class="small-btn primary" type="button" onclick="editStudent('${safe(student.studentCode)}')">تعديل</button><button class="small-btn" type="button" onclick="printStudentReport('${safe(student.studentCode)}')">الملف</button><details><summary class="small-btn" aria-label="إجراءات الطالب">إجراءات</summary><div class="v56-action-menu"><button type="button" onclick="quickPresent('${safe(student.studentCode)}')">تسجيل حضور</button><button type="button" onclick="sendParentMonthlyReport('${safe(student.studentCode)}')">إرسال واتساب</button><button type="button" onclick="copyStudentCodes('${safe(student.studentCode)}')">نسخ الأكواد</button>${manager?`<button type="button" onclick="regenerateParentCode('${safe(student.studentCode)}')">كود ولي أمر جديد</button><button type="button" onclick="regenerateStudentCode('${safe(student.studentCode)}')">تغيير كود الطالب</button><button class="danger" type="button" onclick="deleteStudent('${safe(student.studentCode)}')">حذف الطالب</button>`:''}</div></details></div>
        </article>`;
      }).join('');
      return `<div class="v56-student-summary"><span><b>${normalized.length}</b><small>طالب ظاهر</small></span><span><b>${paid}</b><small>مشترك</small></span><span><b>${normalized.length-paid}</b><small>غير مشترك</small></span></div><div class="v56-student-list">${cards||'<div class="empty-state"><h3>لا يوجد طلاب مطابقون</h3><p>غيّر البحث أو أضف طالبًا جديدًا.</p></div>'}</div>`;
    };
  }

  function enhanceStudentTools(){
    const section=document.querySelector('.admin-section');
    const form=document.getElementById('addStudentForm');
    const toolbar=document.querySelector('.admin-toolbar');
    if(!section||!form||!toolbar||section.querySelector('.v56-student-tools'))return;
    const head=section.querySelector(':scope > .section-head');
    const addPanel=form.parentElement;
    const reportPanel=section.querySelector('.monthly-report-help-v38');
    const importPanel=document.getElementById('studentImportTools');
    const legacyButton=[...(head?.querySelectorAll('button')||[])].find(button=>button.textContent.includes('ترقية الأكواد'));
    head?.querySelectorAll('button').forEach(button=>button.hidden=true);
    [addPanel,reportPanel,importPanel].forEach(panel=>{if(panel){panel.hidden=true;panel.classList.add('v56-tool-panel');}});
    toolbar.classList.add('v56-student-filterbar');
    toolbar.insertAdjacentHTML('afterbegin','<div class="v56-filter-title"><span data-icon="search"></span><div><b>ابحث وصفّي الطلاب</b><small>اكتب الكود أو رقم ولي الأمر، ثم حدّد الصف والدفع والعام والترم.</small></div></div>');
    head?.insertAdjacentHTML('afterend',`<div class="v56-student-tools" aria-label="أدوات إدارة الطلاب">
      <button type="button" data-student-tool="add"><span class="iconbox" data-icon="user"></span><span><b>إضافة طالب</b><small>تسجيل وإصدار الأكواد</small></span></button>
      <button type="button" data-student-tool="report"><span class="iconbox" data-icon="send"></span><span><b>تقارير الشهر</b><small>رسالة واتساب جاهزة</small></span></button>
      <button type="button" data-student-tool="import"><span class="iconbox" data-icon="file-text"></span><span><b>استيراد وتصدير</b><small>CSV وExcel</small></span></button>
      <button type="button" data-student-tool="upgrade"><span class="iconbox" data-icon="refresh-cw"></span><span><b>ترقية الأكواد</b><small>تحديث الأكواد القديمة</small></span></button>
    </div>`);
    const panels={add:addPanel,report:reportPanel,import:importPanel};
    section.querySelectorAll('[data-student-tool]').forEach(button=>button.addEventListener('click',()=>{
      const key=button.dataset.studentTool;
      if(key==='upgrade'){legacyButton?.click();return;}
      const target=panels[key];if(!target)return;
      const willOpen=target.hidden;
      Object.values(panels).forEach(panel=>{if(panel)panel.hidden=true;});
      section.querySelectorAll('[data-student-tool]').forEach(item=>item.classList.remove('active'));
      target.hidden=!willOpen;
      if(willOpen){button.classList.add('active');target.scrollIntoView({behavior:'smooth',block:'nearest'});}
    }));
    if(typeof hydrateIcons==='function')hydrateIcons();
  }

  function installStudentPageEnhancement(){
    if(typeof renderStudents!=='function'||renderStudents.v56Enhanced)return;
    const base=renderStudents;
    renderStudents=function(){base();enhanceStudentTools();};
    renderStudents.v56Enhanced=true;
    if(document.getElementById('addStudentForm'))enhanceStudentTools();
  }

  function closeOpenMenus(event){
    if(event.target.closest('.v56-student-actions details'))return;
    document.querySelectorAll('.v56-student-actions details[open]').forEach(item=>item.removeAttribute('open'));
  }

  document.addEventListener('DOMContentLoaded',()=>{
    connectLabels();
    setTimeout(()=>{applyAdminStudentList();installStudentPageEnhancement();},30);
    document.addEventListener('click',closeOpenMenus);
  });
})();
