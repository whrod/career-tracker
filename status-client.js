let APPLICATION_STATUSES={},applicationFilter='active';
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
 try{const r=await fetch('/api/state',{cache:'no-store'});if(!r.ok)throw Error();APPLICATION_STATUSES=(await r.json()).applicationStatuses||{};}catch{}
 await loadBeforeStatuses();render();
 $('#stats').innerHTML=[['지원 회사',apps.length,'회사·동일 직무 중복 통합'],['진행 중',apps.filter(a=>!isClosed(a)).length,'종료된 전형 제외'],['면접 일정',apps.filter(a=>a.interview&&!isClosed(a)).length,'확인된 일정만 표시'],['탈락',apps.filter(isRejected).length,'서류·면접 탈락 기록']].map(x=>`<div class="stat"><span>${esc(x[0])}</span><strong>${x[1]}</strong><small>${esc(x[2])}</small></div>`).join('');
 const active=apps.filter(a=>!isClosed(a));$('#follow').innerHTML=[...new Set(active.map(a=>a.checkDate).filter(Boolean))].sort().map(d=>`<article class="card"><h3>${esc(d)} · 상태 재확인</h3><p>${active.filter(a=>a.checkDate===d).map(a=>esc(a.company)).join(' · ')}</p><p class="muted">진행 중인 지원만 표시합니다.</p></article>`).join('')||'<div class="empty">진행 중인 후속 일정이 없습니다.</div>';
};

