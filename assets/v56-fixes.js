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

  function closeOpenMenus(event){
    if(event.target.closest('.v56-student-actions details'))return;
    document.querySelectorAll('.v56-student-actions details[open]').forEach(item=>item.removeAttribute('open'));
  }

  document.addEventListener('DOMContentLoaded',()=>{
    connectLabels();
    applyAdminStudentList();
    document.addEventListener('click',closeOpenMenus);
  });
})();
