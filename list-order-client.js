let listOrders=null;
const savingOrders=new Set();
const reorderViews={
 applications:{container:'#rows',selector:'[data-application-id]',key:'applicationId',feedback:'#applicationfeedback',
  keys:()=>apps.map(app=>String(app.id)),host:row=>row.cells[0]},
 candidates:{container:'#newjobs',selector:'[data-order-candidate]',key:'orderCandidate',feedback:'#candidatefeedback',
  keys:()=>[...reviewingCandidates().map(item=>String(item.id)),...Object.values(skippedCandidates)
   .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(record=>String(record.candidate.id))]},
 todos:{container:'#todolist',selector:'[data-todo]',key:'todo',feedback:'#todofeedback',priority:true,
  keys:()=>Object.entries(TODOS).sort(([,a],[,b])=>(a.due||'9999').localeCompare(b.due||'9999')).map(([id])=>id)}
};
function orderedKeys(name){
 const defaults=[...new Set(reorderViews[name].keys())];
 const saved=listOrders?.[name]||[];
 const current=new Set(defaults),known=new Set(saved);
 return [...saved.filter(id=>current.has(id)),...defaults.filter(id=>!known.has(id))];
}
function decorateOrder(name){
 const view=reorderViews[name];
 const container=$(view.container);
 const items=new Map([...container.querySelectorAll(view.selector)].map(item=>[item.dataset[view.key],item]));
 const all=orderedKeys(name);
 const visible=all.filter(id=>items.has(id));
 // Move existing elements so expanded forms and unsaved edits stay with their items.
 visible.forEach((id,index)=>{
  const item=items.get(id);
  if(container.children[index]!==item)container.insertBefore(item,container.children[index]||null);
 });
 for(const [index,id] of visible.entries()){
  const item=items.get(id);
  const host=view.host?.(item)||item;
  host.querySelector(':scope > .ordercontrols')?.remove();
  if(listOrders===null)continue;
  const controls=document.createElement('div');
  controls.className='ordercontrols';
  const label=view.priority?'우선순위':'위치';
  controls.innerHTML=`<span class="orderhandle" draggable="true" title="드래그하여 순서 변경" aria-hidden="true">⠿</span>
   <label>${label} <select aria-label="${label} 변경">${visible.map((other,i)=>`<option value="${i}" ${other===id?'selected':''}>${i+1}</option>`).join('')}</select></label>`;
  const select=controls.querySelector('select');
  const handle=controls.querySelector('.orderhandle');
  const disabled=visible.length<2||savingOrders.has(name);
  select.disabled=disabled;
  handle.draggable=!disabled;
  select.onchange=()=>{
   const target=Number(select.value);
   const next=[...visible];
   next.splice(target,0,...next.splice(index,1));
   saveOrder(name,all,visible,next,id);
  };
  handle.ondragstart=event=>{
   if(!handle.draggable||savingOrders.has(name)){event.preventDefault();return;}
   container.dataset.dragId=id;
   event.dataTransfer.effectAllowed='move';
   event.dataTransfer.setData('text/plain',id);
   item.classList.add('orderdragging');
  };
  handle.ondragend=()=>{
   delete container.dataset.dragId;
   clearOrderMarks(container);
  };
  let touchId;
  handle.onpointerdown=event=>{
   if(event.pointerType!=='touch'||!handle.draggable)return;
   touchId=event.pointerId;
   handle.setPointerCapture(touchId);
   item.classList.add('orderdragging');
  };
  const touchTarget=event=>document.elementFromPoint(event.clientX,event.clientY)?.closest(view.selector);
  handle.onpointermove=event=>{
   if(event.pointerId!==touchId)return;
   const target=touchTarget(event);
   clearDropMarks(container);
   if(target&&target!==item&&container.contains(target))target.classList.add(dropAfter(event,target)?'orderafter':'orderbefore');
  };
  handle.onpointerup=event=>{
   if(event.pointerId!==touchId)return;
   touchId=undefined;
   clearOrderMarks(container);
   const target=touchTarget(event);
   if(target&&container.contains(target))moveOrderItem(name,all,visible,id,target.dataset[view.key],dropAfter(event,target));
  };
  handle.onlostpointercapture=()=>{
   touchId=undefined;
   clearOrderMarks(container);
  };
  host.prepend(controls);
 }
 container.ondragover=event=>{
  const target=event.target.closest(view.selector);
  const source=container.dataset.dragId;
  clearDropMarks(container);
  if(!source||!target||target.dataset[view.key]===source)return;
  event.preventDefault();
  event.dataTransfer.dropEffect='move';
  target.classList.add(dropAfter(event,target)?'orderafter':'orderbefore');
 };
 container.ondragleave=event=>{
  if(!container.contains(event.relatedTarget))clearDropMarks(container);
 };
 container.ondrop=event=>{
  const source=container.dataset.dragId;
  const target=event.target.closest(view.selector);
  if(!source||!target)return;
  event.preventDefault();
  delete container.dataset.dragId;
  clearOrderMarks(container);
  moveOrderItem(name,all,visible,source,target.dataset[view.key],dropAfter(event,target));
 };
}
function dropAfter(event,item){
 const rect=item.getBoundingClientRect();
 return event.clientY>=rect.top+rect.height/2;
}
function clearDropMarks(container){
 container.querySelectorAll('.orderbefore,.orderafter').forEach(item=>item.classList.remove('orderbefore','orderafter'));
}
function clearOrderMarks(container){
 clearDropMarks(container);
 container.querySelector('.orderdragging')?.classList.remove('orderdragging');
}
function moveOrderItem(name,all,visible,source,target,after){
 if(source===target||!visible.includes(source)||!visible.includes(target))return;
 const next=visible.filter(id=>id!==source);
 next.splice(next.indexOf(target)+Number(after),0,source);
 saveOrder(name,all,visible,next);
}
async function saveOrder(name,all,visible,next,focusId){
 if(savingOrders.has(name)||next.every((id,index)=>id===visible[index]))return;
 const visibleIds=new Set(visible);
 let index=0;
 const ids=all.map(id=>visibleIds.has(id)?next[index++]:id);
 const view=reorderViews[name];
 const status=$(view.feedback);
 savingOrders.add(name);
 decorateOrder(name);
 try{
  const response=await fetch('/api/list-order/'+name,{
   method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})
  });
  if(!response.ok)throw Error();
  listOrders[name]=ids;
  status.textContent=view.priority?'우선순위를 저장했습니다.':'순서를 저장했습니다.';
 }catch{
  status.textContent='순서를 저장하지 못했습니다. 다시 시도해 주세요.';
 }finally{
  savingOrders.delete(name);
  decorateOrder(name);
  if(focusId){
   const item=[...$(view.container).querySelectorAll(view.selector)].find(row=>row.dataset[view.key]===focusId);
   item?.querySelector('.ordercontrols select')?.focus();
  }
 }
}
const renderBeforeOrdering=render;
render=function(){renderBeforeOrdering();decorateOrder('applications');};
const candidatesBeforeOrdering=candidates;
candidates=function(){candidatesBeforeOrdering();decorateOrder('candidates');};
const todosBeforeOrdering=todos;
todos=function(){todosBeforeOrdering();decorateOrder('todos');};
function selectOrderedHash(){
 const target=location.hash.slice(1);
 if(['applications','candidates','activity'].includes(target))document.querySelector('[data-tab="'+target+'"]').click();
}
window.addEventListener('hashchange',selectOrderedHash);
selectOrderedHash();


