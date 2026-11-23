let REVIEW={},LINKS={};
let REQUESTS={};
const requestStatus={pending:'요청 접수',processing:'개선 중',completed:'개선본 준비',needs_input:'추가 확인 필요',failed:'처리 실패'};
function requestPanel(a){
 const r=REQUESTS[a.id],busy=r&&['pending','processing'].includes(r.status);
 return `<details class="improve" data-request="${esc(a.id)}" ${r?'open':''}><summary>AI에게 개선 요청${r?' · '+esc(requestStatus[r.status]||r.status):''}</summary><p class="muted">요청은 서버에 저장하고 다음 오전 9시 루틴에서 처리합니다. 지금 바로 처리하려면 이 채팅에서 요청해 주세요. 완료 체크는 개선본을 직접 확인한 뒤 해주세요.</p><label>개선 요청 내용<textarea class="requestnote" placeholder="예: 반복 문장을 줄이고 역할과 결과를 구분해 주세요.">${esc(r?.note||'')}</textarea></label><button class="btn submit-request" ${busy?'disabled':''}>${busy?'처리 대기 중':'이 항목 개선 요청'}</button><div class="saved" role="status"></div>${r?`<p><span class="badge">${esc(requestStatus[r.status]||r.status)}</span> <span class="muted">${esc(new Date(r.updatedAt||r.requestedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))}</span></p><p style="white-space:pre-line">${esc(r.result||'다음 실행에서 이 항목과 경력 기준 자료를 읽고 개선합니다.')}</p>${(r.files||[]).length?'<p class="muted">작성 파일 · 로컬 제출서류 폴더 및 채팅에서 확인</p><ul>'+r.files.map(f=>'<li>'+esc(typeof f==='string'?f:f.name)+'</li>').join('')+'</ul>':''}`:''}</details>`;
}
function bindRequests(){document.querySelectorAll('.submit-request').forEach(b=>b.onclick=async()=>{
 const box=b.closest('[data-request]'),id=box.dataset.request;
 const note=box.querySelector('.requestnote').value.trim();
 if(await save('/api/requests/'+id,{note},b,box.querySelector('[role=status]'))){
  REQUESTS[id]={note,status:'pending',updatedAt:new Date().toISOString()};
  reviews();$('#reviewfeedback').textContent='개선 요청을 접수했습니다. 다음 오전 9시 루틴에서 처리합니다.';
 }
});}

const referenceLinks=a=>(a.referenceLinks||[{label:"지원한 공고 원문",url:a.url}]).map(l=>`<div><a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.label)}</a></div>`).join('');
let reviewFilter='pending';
const safeUrl=u=>{try{const x=new URL(u);return ['https:','http:'].includes(x.protocol)?x.href:'#';}catch{return '#';}};
async function save(path,body,button,status){
 button.disabled=true;status.textContent='저장 중…';status.className='saved';
 try{const r=await fetch(path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw Error(result.error||'저장 실패');status.textContent='서버에 저장됨';return true;}
 catch(e){status.className='saved error';status.textContent=e.message+' · 입력 내용은 이 화면에 남아 있습니다.';return false;}finally{button.disabled=false;}
}
function reviews(){
 const done=DATA.issues.filter(a=>REVIEW[a.id]?.done).length;
 $('#issues').innerHTML=`<div class="toolbar reviewfilters" role="group" aria-label="점검 상태 필터"><button class="btn" data-reviewfilter="pending" aria-pressed="${reviewFilter==='pending'}">점검 예정 (${DATA.issues.length-done})</button><button class="btn" data-reviewfilter="done" aria-pressed="${reviewFilter==='done'}">점검 완료 (${done})</button><button class="btn" data-reviewfilter="all" aria-pressed="${reviewFilter==='all'}">전체 (${DATA.issues.length})</button></div><div class="saved" role="status" id="reviewfeedback"></div>`+DATA.issues.filter(a=>reviewFilter==='all'||!!REVIEW[a.id]?.done===(reviewFilter==='done')).sort((a,b)=>Number(!!REVIEW[a.id]?.done)-Number(!!REVIEW[b.id]?.done)).map((a,i)=>{const id=a.id||'issue_'+i,v=REVIEW[id]||{};return `<article class="card ${v.done?'reviewdone':''}" data-review="${esc(id)}"><span class="badge">${v.done?'점검 완료 · ':''}${esc(a.platform)} · ${esc(a.level)}</span><h3>${esc(a.title)}</h3><p>${esc(a.detail)}</p><p><label><input type="checkbox" ${v.done?'checked':''}> 점검 완료</label></p><label>내 메모<textarea placeholder="수정한 내용이나 다음에 확인할 내용을 적어 주세요.">${esc(v.note||'')}</textarea></label><button class="btn save-review">체크·메모 저장</button><span class="saved" role="status">${v.updatedAt?'저장된 기록':''}</span>${requestPanel(a)}</article>`;}).join('');
 bindRequests();
 if(!$('#issues').querySelector('article'))$('#issues').insertAdjacentHTML('beforeend','<div class="empty">이 상태의 점검 항목이 없습니다.</div>');
 document.querySelectorAll('[data-reviewfilter]').forEach(b=>b.onclick=()=>{reviewFilter=b.dataset.reviewfilter;reviews();});
 document.querySelectorAll('.save-review').forEach(b=>b.onclick=async()=>{const card=b.closest('[data-review]'),id=card.dataset.review,value={done:card.querySelector('input').checked,note:card.querySelector('textarea').value};if(await save('/api/reviews/'+id,value,b,card.querySelector('[role=status]'))){REVIEW[id]={...value,updatedAt:new Date().toISOString()};reviews();$('#reviewfeedback').textContent=value.done?'저장했습니다. 점검 완료 목록으로 이동했습니다.':'저장했습니다. 점검 예정 목록에서 관리합니다.';}});
}
const oldRender=render;
render=function(){oldRender();document.querySelectorAll('#rows tr').forEach(tr=>{const a=apps.find(a=>tr.querySelector('.company')?.textContent===a.company);if(!a)return;const box=document.createElement('div');box.innerHTML=`${referenceLinks(a)}<div class="userlinks">${(LINKS[a.id]||[]).map(l=>`<div><a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.label||'추가 링크')}</a></div>`).join('')}</div><details class="editlinks" data-id="${a.id}"><summary>지원·접수 링크 추가 및 수정</summary><p class="muted">공고, 접수 확인, 기업 채용 페이지 등을 연결하세요.</p><div class="linkfields"></div><button class="btn addlink">링크 추가</button> <button class="btn savelinks">링크 저장</button><div class="saved" role="status"></div></details>`;tr.firstElementChild.append(box);const details=box.querySelector('details'),fields=box.querySelector('.linkfields');const add=(l={})=>{const row=document.createElement('div');row.className='linkrow';row.innerHTML=`<input aria-label="링크 이름" placeholder="예: 기업 지원내역" value="${esc(l.label||'')}"><input aria-label="지원 링크 주소" type="url" placeholder="https://" value="${esc(l.url||'')}"><button class="btn remove">삭제</button>`;row.querySelector('button').onclick=()=>row.remove();fields.append(row);};(LINKS[a.id]||[]).forEach(add);box.querySelector('.addlink').onclick=()=>add();box.querySelector('.savelinks').onclick=async e=>{const links=[...fields.children].map(r=>({label:r.querySelectorAll('input')[0].value.trim(),url:r.querySelectorAll('input')[1].value.trim()})).filter(l=>l.url||l.label);if(links.some(l=>safeUrl(l.url)==='#')){details.querySelector('[role=status]').textContent='http 또는 https 주소를 입력하세요.';return;}if(await save('/api/links/'+a.id,links,e.target,details.querySelector('[role=status]'))){LINKS[a.id]=links;box.querySelector('.userlinks').innerHTML=links.map(l=>`<div><a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.label||'추가 링크')}</a></div>`).join('');}};});};
function candidates(){ $('#newjobs').innerHTML=DATA.candidates.length?DATA.candidates.map(a=>`<article class="card"><span class="badge">${esc(a.priority||'검토 후보')}</span><h3>${esc(a.company)} · ${esc(a.role)}</h3><p>${esc(a.fit||a.reason||'')}</p><p>마감: ${esc(a.deadline||'미확인')} · 경력: ${esc(a.experience||'미확인')}</p><p>${esc(a.conditions||'급여·출장·통근 조건은 원문 확인 결과에 따릅니다.')}</p><p class="muted">${esc(a.gaps||'')} · 확인: ${esc(a.verifiedAt||DATA.updatedAt)}</p><a class="btn" href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener">공고 원문 보기</a> <a class="btn" href="${esc(safeUrl(a.applyUrl||a.url))}" target="_blank" rel="noopener">직접 지원하기</a></article>`).join(''):'<div class="empty">현재 등록된 신규 지원 후보가 없습니다. 다음 검색에서 접수 중임을 확인한 공고와 직접 지원할 링크를 여기에 추가합니다.</div>'; }
async function loadState(){try{const r=await fetch('/api/state',{cache:'no-store'});if(!r.ok)throw Error();const state=await r.json();profileProgress=state.profileProgress||{};DATA=state.data;apps=DATA.applications;REVIEW=state.reviews;LINKS=state.links;REQUESTS=state.requests||{};reviews();render();candidates();$('#stamp').textContent='마지막 확인 '+DATA.updatedAt+' · 한국 시간';$('#notice').textContent=DATA.notice;}catch{$('#notice').textContent='서버 기록을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요. 아래 내용은 배포 당시 자료이며 저장 상태를 확인할 수 없습니다.';$('#issues').innerHTML='<div class="empty">서버 연결 후 체크·메모를 사용할 수 있습니다.</div>';}}
const originalLoadState=loadState;
$('#query').removeEventListener('input',oldRender);
$('#platform').removeEventListener('change',oldRender);
$('#query').addEventListener('input',()=>render());
$('#platform').addEventListener('change',()=>render());
loadState=async()=>{await originalLoadState();
 $('#stats').innerHTML=[['지원 회사',apps.length,'회사·동일 직무 중복 통합'],['진행 중',apps.filter(a=>!/불합격|철회|최종합격/.test(a.status)).length,'접수와 열람 상태 기준'],['면접 일정',apps.filter(a=>a.interview).length,'확인된 일정만 표시'],['중복 접수',apps.filter(a=>a.flag==='중복 접수').length,'추가 지원 전 확인']].map(x=>`<div class="stat"><span>${esc(x[0])}</span><strong>${x[1]}</strong><small>${esc(x[2])}</small></div>`).join('');
 $('#follow').innerHTML=[...new Set(apps.map(a=>a.checkDate))].sort().map(d=>`<article class="card"><h3>${esc(d)} · 상태 재확인</h3><p>${apps.filter(a=>a.checkDate===d).map(a=>esc(a.company)).join(' · ')}</p><p class="muted">내부 확인 일정입니다. 기업에 연락하는 동작은 별도 요청 시 진행합니다.</p></article>`).join('');
 $('#activitylog').innerHTML=DATA.activity.map(a=>`<p>${esc(a)}</p>`).join('');
};
loadState();

