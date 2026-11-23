let profileFilter='all';
function profiles(){
 const list=DATA.profiles||[];
 const labels={all:'전체',unfinished:'작성 중단·미완료',updated:'사용자 수정 이력',login:'로그인 필요'};
 $('#profilefilters').innerHTML=Object.entries(labels).map(([k,v])=>`<button class="btn" data-profilefilter="${k}" aria-pressed="${profileFilter===k}">${v} (${k==='all'?list.length:list.filter(p=>p.group===k).length})</button>`).join('');
 const shown=list.filter(p=>profileFilter==='all'||p.group===profileFilter);
 $('#profilelist').innerHTML=shown.map(p=>`<article class="card profilecard"><div class="sectionhead"><h3>${esc(p.name)}</h3><span class="badge ${p.group==='login'?'profilewait':'profileneeds'}">${esc(p.status)}</span></div><p class="muted">${esc(p.history)} · 확인 ${esc(p.verifiedAt)} (한국 시간)</p><p><span class="profilelabel">반영 확인</span>${esc(p.reflected)}</p><p><span class="profilelabel">남은 작업</span>${esc(p.remaining)}</p><p class="muted">첨부 상태: ${esc(p.files)}</p><div class="toolbar"><a class="btn" href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener">${esc(p.name)} 프로필 열기</a>${p.manageUrl?`<a href="${esc(safeUrl(p.manageUrl))}" target="_blank" rel="noopener">이력서·파일 목록</a>`:''}</div><details><summary>확인 근거</summary><p class="muted">${esc(p.evidence)}</p></details></article>`).join('')||'<div class="empty">해당 상태의 플랫폼이 없습니다.</div>';
 document.querySelectorAll('[data-profilefilter]').forEach(b=>b.onclick=()=>{profileFilter=b.dataset.profilefilter;profiles();});
}
const loadBeforeProfiles=loadState;
loadState=async()=>{await loadBeforeProfiles();profiles();};
profiles();
function selectProfileHash(){if(location.hash==='#profiles')document.querySelector('[data-tab="profiles"]').click();}
window.addEventListener('hashchange',selectProfileHash);
selectProfileHash();

