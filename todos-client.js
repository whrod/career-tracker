let TODOS={},todoFilter='pending';
function todos(){
 const entries=Object.entries(TODOS),done=entries.filter(([,t])=>t.done).length;
 $('#todofilters').innerHTML=[['pending','할 일',entries.length-done],['done','완료',done],['all','전체',entries.length]].map(([id,label,count])=>`<button class="btn" data-todofilter="${id}" aria-pressed="${todoFilter===id}">${label} (${count})</button>`).join('');
 $('#todolist').innerHTML=entries.filter(([,t])=>todoFilter==='all'||t.done===(todoFilter==='done')).sort((a,b)=>(a[1].due||'9999').localeCompare(b[1].due||'9999')).map(([id,t])=>`<article class="card ${t.done?'reviewdone':''}" data-todo="${esc(id)}"><div class="sectionhead"><h3>${esc(t.title)}</h3><span class="badge">${t.done?'완료':'할 일'} · ${esc(t.due||'날짜 미지정')}</span></div><label><input type="checkbox" class="todocheck" ${t.done?'checked':''}> 완료 처리</label><p style="white-space:pre-line">${esc(t.note)}</p><details><summary>내용과 날짜 수정</summary><label>할 일 제목<input class="todotitle" maxlength="200" value="${esc(t.title)}"></label><label>예정일<input class="tododue" type="date" value="${esc(t.due)}"></label><label>메모<textarea class="todonote">${esc(t.note)}</textarea></label><button class="btn todoedit">수정 저장</button></details><div class="saved" role="status"></div></article>`).join('')||'<div class="empty">이 목록에 등록된 할 일이 없습니다.</div>';
 document.querySelectorAll('[data-todofilter]').forEach(b=>b.onclick=()=>{todoFilter=b.dataset.todofilter;todos();});
 document.querySelectorAll('[data-todo]').forEach(card=>{
  const id=card.dataset.todo,check=card.querySelector('.todocheck'),status=card.querySelector('[role=status]');
  check.onchange=async()=>{const value={...TODOS[id],done:check.checked};if(await save('/api/todos/'+id,value,check,status)){TODOS[id]=value;todos();$('#todofeedback').textContent=value.done?'완료 목록으로 이동했습니다.':'할 일 목록으로 되돌렸습니다.';}else check.checked=TODOS[id].done;};
  card.querySelector('.todoedit').onclick=async e=>{const value={title:card.querySelector('.todotitle').value.trim(),due:card.querySelector('.tododue').value,note:card.querySelector('.todonote').value,done:TODOS[id].done};if(!value.title){status.textContent='할 일 제목을 입력해 주세요.';return;}if(await save('/api/todos/'+id,value,e.target,status)){TODOS[id]=value;todos();$('#todofeedback').textContent='수정 내용을 저장했습니다.';}};
 });
}
$('#addtodo').onsubmit=async e=>{e.preventDefault();const title=$('#newtodotitle').value.trim();if(!title)return;const value={title,due:$('#newtododue').value,note:$('#newtodonote').value,done:false},id='todo-'+crypto.randomUUID();if(await save('/api/todos/'+id,value,$('#addtodobutton'),$('#todofeedback'))){TODOS[id]=value;$('#addtodo').reset();todoFilter='pending';todos();$('#todofeedback').textContent='새 할 일을 저장했습니다.';}};
const loadBeforeTodos=loadState;
loadState=async()=>{await loadBeforeTodos();try{const r=await fetch('/api/state',{cache:'no-store'});if(!r.ok)throw Error();TODOS=(await r.json()).todos||{};todos();}catch{$('#todolist').innerHTML='<div class="empty">할 일을 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.</div>';}};
function selectTodoHash(){if(location.hash==='#todos')document.querySelector('[data-tab="todos"]').click();}
window.addEventListener('hashchange',selectTodoHash);selectTodoHash();

