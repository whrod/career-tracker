let profileFilter='all';
let profileProgress=null;
const profileSaves=new Map();
function profiles(){
 const list=DATA.profiles||[];
 const labels={all:'전체',pending:'미완료',completed:'완료'};
 const matches=(p,filter)=>filter==='all'||Boolean(profileProgress?.[p.id]?.completed)===(filter==='completed');
 $('#profilefilters').innerHTML=Object.entries(labels).map(([k,v])=>`<button class="btn" data-profilefilter="${k}" aria-pressed="${profileFilter===k}">${v} (${k==='all'?list.length:list.filter(p=>matches(p,k)).length})</button>`).join('');
 const shown=list.filter(p=>matches(p,profileFilter));
 $('#profilelist').innerHTML=shown.map(p=>`<article class="card profilecard"><div class="sectionhead"><h3>${esc(p.name)}</h3><span class="badge ${profileProgress?.[p.id]?.completed?'':p.group==='login'?'profilewait':'profileneeds'}">${profileProgress?.[p.id]?.completed?'완료':esc(p.status)}</span></div><div class="profilechecks">${Object.entries({edited:'직접 수정함',completed:'완료'}).map(([field,label])=>`<label><input type="checkbox" data-profile="${esc(p.id)}" data-field="${field}" ${(profileSaves.get(p.id+'/'+field)??profileProgress?.[p.id]?.[field])?'checked':''} ${!profileProgress||profileSaves.has(p.id+'/'+field)?'disabled':''}>${label}</label>`).join('')}</div><div class="toolbar"><a class="btn" href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener">${esc(p.name)} 프로필 열기</a>${p.manageUrl?`<a href="${esc(safeUrl(p.manageUrl))}" target="_blank" rel="noopener">이력서·파일 목록</a>`:''}</div><details ${profileProgress?.[p.id]?.completed?'':'open'}><summary>이전 점검 기록</summary><p class="muted">${esc(p.history)} · 확인 ${esc(p.verifiedAt)} (한국 시간)</p><p><span class="profilelabel">반영 확인</span>${esc(p.reflected)}</p><p><span class="profilelabel">남은 작업</span>${esc(p.remaining)}</p><p class="muted">첨부 상태: ${esc(p.files)}</p><details><summary>확인 근거</summary><p class="muted">${esc(p.evidence)}</p></details></details></article>`).join('')||'<div class="empty">해당 상태의 플랫폼이 없습니다.</div>';
 document.querySelectorAll('[data-profile]').forEach(input=>input.onchange=async()=>{
  const {profile,field}=input.dataset;
  const checked=input.checked;
  const feedback=$('#profilefeedback');
  const key=profile+'/'+field;
  profileSaves.set(key,checked);
  input.disabled=true;
  try {
   const response=await fetch('/api/profile-progress/'+encodeURIComponent(profile)+'/'+field,{
    method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({checked})
   });
   if(!response.ok)throw Error();
   (profileProgress[profile]??={})[field]=checked;
   feedback.textContent='저장했습니다.';
  } catch {
   feedback.textContent='저장하지 못했습니다. 다시 시도해 주세요.';
  } finally {
   profileSaves.delete(key);
   const restoreFocus=document.activeElement===input||document.activeElement===document.body;
   profiles();
   if(restoreFocus)document.querySelector('[data-profile="'+profile+'"][data-field="'+field+'"]')?.focus();
  }
 });
 document.querySelectorAll('[data-profilefilter]').forEach(b=>b.onclick=()=>{profileFilter=b.dataset.profilefilter;profiles();});
}
const loadBeforeProfiles=loadState;
loadState=async()=>{await loadBeforeProfiles();profiles();};
profiles();
function selectProfileHash(){if(location.hash==='#profiles')document.querySelector('[data-tab="profiles"]').click();}
window.addEventListener('hashchange',selectProfileHash);
selectProfileHash();

