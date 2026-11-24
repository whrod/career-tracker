let APPLICATION_STATUSES={},applicationFilter='active';
let interviewSchedules={},canManageInterviews=false;
const interviewTime=schedule=>schedule.date+' '+schedule.time+' (한국 시간)';
function interviewEditor(app){
 const schedule=interviewSchedules[app.id];
 const box=document.createElement('div');
 if(!canManageInterviews){
  box.innerHTML='<a href="/signin-with-chatgpt?return_to=%2F" target="_top">로그인하여 면접 일정 추가</a>';
  return box;
 }
 const saved=schedule?`<p><span class="badge">면접</span> ${esc(interviewTime(schedule))}</p>`:'';
 box.innerHTML=`${saved}<details class="statuseditor"><summary>${schedule?'면접 일정 수정':'면접 일정 추가'}</summary>
 <form>
 <label>면접 날짜 <input name="date" type="date" value="${esc(schedule?.date||'')}" required></label>
 <label>면접 시간 (한국 시간) <input name="time" type="time" value="${esc(schedule?.time||'')}" required></label>
 <label>장소 또는 접속 링크 (선택) <input name="location" maxlength="500" value="${esc(schedule?.location||'')}"></label>
 <label>면접 메모 (선택) <textarea name="note" maxlength="2000">${esc(schedule?.note||'')}</textarea></label>
 <button class="btn" type="submit">면접 일정 저장</button><div role="status" class="saved"></div>
 </form></details>`;
 const form=box.querySelector('form');
 form.onsubmit=async event=>{
  event.preventDefault();
  const value=Object.fromEntries(new FormData(form));
  if(!await save('/api/interviews/'+encodeURIComponent(app.id),value,form.querySelector('button'),form.querySelector('[role=status]')))return;
  await loadState();
  $('#applicationfeedback').textContent=app.company+' 면접 일정을 저장했습니다. 후속 관리에서 확인할 수 있습니다.';
 };
 return box;
}
const isRejected=a=>/탈락|불합격/.test(a.status);
const isClosed=a=>/탈락|불합격|최종합격|철회/.test(a.status);
const applicationGroup=a=>isRejected(a)?'rejected':/최종합격/.test(a.status)?'accepted':/철회/.test(a.status)?'withdrawn':'active';
function statusFilters(){
 const groups=[['active','진행 중'],['rejected','탈락'],['accepted','합격'],['withdrawn','철회'],['all','전체']];
 $('#applicationfilters').innerHTML=groups.map(([id,label])=>`<button class="btn" data-appfilter="${id}" aria-pressed="${applicationFilter===id}">${label} (${id==='all'?apps.length:apps.filter(a=>applicationGroup(a)===id).length})</button>`).join('');
 document.querySelectorAll('[data-appfilter]').forEach(b=>b.onclick=()=>{applicationFilter=b.dataset.appfilter;render();});
 $('#applicationtitle').textContent=({active:'진행 중인 지원',rejected:'탈락한 지원',accepted:'합격한 지원',withdrawn:'철회한 지원',all:'전체 지원 기록'})[applicationFilter];
}
const renderWithLinks=render;
render=function(){
 statusFilters();
 const all=apps;
 try{apps=all.filter(a=>applicationFilter==='all'||applicationGroup(a)===applicationFilter);renderWithLinks();}finally{apps=all;}
 document.querySelectorAll('#rows tr').forEach(tr=>{
  const app=apps.find(a=>String(a.id)===tr.dataset.applicationId);if(!app)return;
  const cell=tr.children[1],v=APPLICATION_STATUSES[app.id];
  if(!isClosed(app))tr.children[3].append(interviewEditor(app));
  if(isRejected(app))tr.classList.add('rejectedrow');
  const box=document.createElement('div');
  const options=['접수','서류 검토 중','서류 통과','1차 면접','2차 면접','최종 면접','최종합격','서류 탈락','면접 탈락','지원 철회'];if(!options.includes(app.status))options.unshift(app.status);
  box.innerHTML=`${v?.note?`<p class="muted">${esc(v.note)}</p>`:''}<details class="statuseditor"><summary>지원 상태 변경</summary><label>전형 상태<select aria-label="${esc(app.company)} 전형 상태">${options.map(s=>`<option ${s===app.status?'selected':''}>${esc(s)}</option>`).join('')}</select></label><label>변경 메모<textarea maxlength="5000" aria-label="${esc(app.company)} 상태 메모" placeholder="예: 서류 탈락 안내 확인">${esc(v?.note||'')}</textarea></label><button class="btn savestatus">상태 저장</button><div role="status" class="saved"></div>${v?.history?.length?`<details><summary>변경 이력 (${v.history.length})</summary>${v.history.slice().reverse().map(h=>`<p class="muted">${esc(new Date(h.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))}<br>${esc(h.previousStatus)} → ${esc(h.status)}<br>${esc(h.note)}</p>`).join('')}</details>`:''}</details>`;
  cell.append(box);box.querySelector('.savestatus').onclick=async e=>{
   const value={status:box.querySelector('select').value,note:box.querySelector('textarea').value};
   if(!await save('/api/application-status/'+app.id,value,e.target,box.querySelector('[role=status]')))return;
   await loadState();$('#applicationfeedback').textContent='저장했습니다. '+(/탈락|불합격/.test(value.status)?'탈락 목록에서 확인할 수 있습니다.':'변경한 상태의 목록에서 확인할 수 있습니다.');
  };
 });
}
const loadBeforeStatuses=loadState;
loadState=async()=>{
 try{
  const r=await fetch('/api/state',{cache:'no-store'});if(!r.ok)throw Error();
  const state=await r.json();
  APPLICATION_STATUSES=state.applicationStatuses||{};
  interviewSchedules=state.interviewSchedules||{};
  canManageInterviews=state.canManageInterviews===true;
 }catch{}
 await loadBeforeStatuses();render();
 $('#stats').innerHTML=[['지원 회사',apps.length,'회사·동일 직무 중복 통합'],['진행 중',apps.filter(a=>!isClosed(a)).length,'종료된 전형 제외'],['면접 일정',apps.filter(a=>(a.interview||interviewSchedules[a.id])&&!isClosed(a)).length,'확인된 일정만 표시'],['탈락',apps.filter(isRejected).length,'서류·면접 탈락 기록']].map(x=>`<div class="stat"><span>${esc(x[0])}</span><strong>${x[1]}</strong><small>${esc(x[2])}</small></div>`).join('');
 const active=apps.filter(a=>!isClosed(a));
 const followCards=[...new Set(active.map(a=>a.checkDate).filter(Boolean))].sort().map(d=>`<article class="card"><h3>${esc(d)} · 상태 재확인</h3><p>${active.filter(a=>a.checkDate===d).map(a=>esc(a.company)).join(' · ')}</p><p class="muted">진행 중인 지원만 표시합니다.</p></article>`);
 const interviews=active.filter(a=>interviewSchedules[a.id])
  .sort((a,b)=>interviewTime(interviewSchedules[a.id]).localeCompare(interviewTime(interviewSchedules[b.id])));
 const interviewCards=interviews.map(a=>{
  const schedule=interviewSchedules[a.id];
  const location=schedule.location ? `<p>${esc(schedule.location)}</p>` : '';
  const note=schedule.note ? `<p style="white-space:pre-wrap">${esc(schedule.note)}</p>` : '';
  return `<article class="card"><h3>${esc(a.company)} · 면접</h3><p>${esc(a.role)}<br>${esc(interviewTime(schedule))}</p>${location}${note}</article>`;
 });
 $('#follow').innerHTML=[...interviewCards,...followCards].join('')||'<div class="empty">진행 중인 후속 일정이 없습니다.</div>';
};

