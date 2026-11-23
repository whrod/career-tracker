export function createWorker(html, seed) {
 const seedTodos={};
 const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 const postingUrl=value=>String(value).split('#',1)[0].replace(/^https?:\/\/(?:www\.)?/i,'').replace(/\/(?=\?|$)/,'');
 const samePosting=(a,b)=>[a.url,a.applyUrl].filter(Boolean).some(url=>[b.url,b.applyUrl].filter(Boolean).some(other=>postingUrl(url)===postingUrl(other)));
 function applicationsWithRecordedCandidates(data,recorded){
  const applications=[...data.applications];
  for(const application of Object.values(recorded)){
   if(!applications.some(a=>a.id===application.id||samePosting(a,application)))applications.unshift(application);
  }
  return applications;
 }
 const koreaDate=date=>date.toISOString().slice(0,10);
 return {async fetch(req,env){
  const u=new URL(req.url);
  if(!u.pathname.startsWith('/api/')) return new Response(html,{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'}});
  try {
   if(req.method==='GET'&&u.pathname==='/api/state'){
    const rows=await env.DB.prepare('SELECT key,value FROM career_records').all();
    const records=Object.fromEntries(rows.results.map(r=>[r.key,JSON.parse(r.value)]));
    const data=JSON.parse(JSON.stringify(records.snapshot||seed));
    data.applications=applicationsWithRecordedCandidates(data,records.candidateApplications||{});
    data.candidates=data.candidates.filter(candidate=>!data.applications.some(application=>samePosting(candidate,application)||application.id==='candidate-'+candidate.id));
    const applicationStatuses=records.applicationStatuses||{};
    for(const a of data.applications){const v=applicationStatuses[a.id];if(v){a.status=v.status;a.statusNote=v.note;a.statusUpdatedAt=v.updatedAt;a.result=/탈락|불합격|최종합격|철회/.test(v.status)?v.status:null;if(/탈락|불합격|철회/.test(v.status)){a.interview=null;a.nextAction='전형 종료. 제출 서류와 확인된 피드백을 보관합니다.';}}}
    return json({data,reviews:records.reviews||{},links:records.links||{},requests:records.requests||{},todos:records.todos||seedTodos,applicationStatuses,profileProgress:records.profileProgress||{}});
   }
   if(req.method!=='PUT')return json({error:'허용되지 않은 요청'},405);
   if(req.headers.get('Origin')&&req.headers.get('Origin')!==u.origin)return json({error:'다른 출처의 요청'},403);
   const text=await req.text();if(text.length>500000)return json({error:'입력이 너무 큽니다'},413);
   const body=JSON.parse(text);
   const candidateMatch=u.pathname.match(/^\/api\/candidate-applications\/([\w-]{1,100})$/);
   if(candidateMatch){
    if(body?.confirmed!==true)return json({error:'지원 완료 여부를 확인해 주세요.'},400);
    const candidateId=candidateMatch[1];
    const rows=await env.DB.prepare("SELECT key,value FROM career_records WHERE key IN ('snapshot','candidateApplications')").all();
    const records=Object.fromEntries(rows.results.map(row=>[row.key,JSON.parse(row.value)]));
    const recorded=records.candidateApplications||{};
    if(Object.hasOwn(recorded,candidateId))return json({ok:true});
    const data=records.snapshot||seed;
    const candidate=data.candidates.find(a=>String(a.id)===candidateId);
    if(!candidate)return json({error:'등록된 지원 후보가 아닙니다.'},404);
    if(applicationsWithRecordedCandidates(data,recorded).some(a=>samePosting(a,candidate)))return json({ok:true});
    const now=new Date();
    const localDate=new Date(now.getTime()+9*60*60*1000);
    const followUp=new Date(localDate);
    followUp.setUTCDate(followUp.getUTCDate()+7);
    const application={
     id:'candidate-'+candidateId,company:candidate.company,role:candidate.role,platform:candidate.platform,
     url:candidate.url,applyUrl:candidate.applyUrl,status:'접수',flag:'',
     applied:'미확인',checkedAt:now.toISOString(),checkDate:koreaDate(followUp),interview:null,result:null,
     source:koreaDate(localDate)+' 직접 지원 완료 체크',
     nextAction:'접수 확인과 전형 안내를 확인합니다.',documents:'제출 서류 미확인',
     referenceLinks:[{label:'지원한 공고 원문',url:candidate.url}]
    };
    const path='$."'+candidateId+'"';
    const value=JSON.stringify(application);
    await env.DB.prepare("INSERT INTO career_records(key,value) VALUES('candidateApplications',json_object(?,json(?))) ON CONFLICT(key) DO UPDATE SET value=json_insert(career_records.value,?,json(?))").bind(candidateId,value,path,value).run();
    return json({ok:true});
   }
   const profileMatch=u.pathname.match(/^\/api\/profile-progress\/([\w-]{1,100})\/(edited|completed)$/);
   if(profileMatch){
    if(typeof body?.checked!=='boolean')return json({error:'체크 상태를 확인해 주세요.'},400);
    const [,id,field]=profileMatch;
    const row=await env.DB.prepare("SELECT value FROM career_records WHERE key='snapshot'").first();
    const data=row?JSON.parse(row.value):seed;
    if(!data.profiles?.some(profile=>profile.id===id))return json({error:'등록된 플랫폼이 아닙니다.'},404);
    const path='$."'+id+'"';
    const value=JSON.stringify({[field]:body.checked});
    await env.DB.prepare("INSERT INTO career_records(key,value) VALUES('profileProgress',json_object(?,json(?))) ON CONFLICT(key) DO UPDATE SET value=json_set(career_records.value,?,json_patch(COALESCE(json_extract(career_records.value,?),'{}'),?))").bind(id,value,path,path,value).run();
    return json({ok:true});
   }
   const statusMatch=u.pathname.match(/^\/api\/application-status\/(\d+|candidate-[\w-]{1,100})$/);
   if(statusMatch){
    const allowed=['접수','서류 검토 중','서류 통과','1차 면접','2차 면접','최종 면접','최종합격','서류 탈락','면접 탈락','지원 철회'];
    if(!allowed.includes(body.status)||typeof body.note!=='string'||body.note.length>5000)return json({error:'지원 상태와 메모를 확인해 주세요.'},400);
    const row=await env.DB.prepare("SELECT value FROM career_records WHERE key='snapshot'").first();const data=row?JSON.parse(row.value):seed;
    const recorded=await env.DB.prepare("SELECT value FROM career_records WHERE key='candidateApplications'").first();
    const app=applicationsWithRecordedCandidates(data,recorded?JSON.parse(recorded.value):{}).find(a=>String(a.id)===statusMatch[1]);if(!app)return json({error:'등록된 지원이 아닙니다.'},404);
    const existing=await env.DB.prepare("SELECT value FROM career_records WHERE key='applicationStatuses'").first();
    const prev=existing?JSON.parse(existing.value)[statusMatch[1]]:null;
    const entry={status:body.status,note:body.note,updatedAt:new Date().toISOString()};
    const value={...entry,history:[...(prev?.history||[]),{...entry,previousStatus:prev?.status||app.status}].slice(-50)};
    await env.DB.prepare("INSERT INTO career_records(key,value) VALUES('applicationStatuses',json_object(?,json(?))) ON CONFLICT(key) DO UPDATE SET value=json_set(career_records.value,?,json(?))").bind(statusMatch[1],JSON.stringify(value),'$."'+statusMatch[1]+'"',JSON.stringify(value)).run();
    return json({ok:true,value});
   }
   const todoMatch=u.pathname.match(/^\/api\/todos\/([\w-]{1,100})$/);
   if(todoMatch){
    if(typeof body.title!=='string'||!body.title.trim()||body.title.length>200||typeof body.note!=='string'||body.note.length>10000||typeof body.done!=='boolean'||typeof body.due!=='string'||(body.due&&!/^\d{4}-\d{2}-\d{2}$/.test(body.due)))return json({error:'할 일 제목·날짜·메모를 확인해 주세요.'},400);
    const todo={title:body.title.trim(),due:body.due,note:body.note,done:body.done,updatedAt:new Date().toISOString()};
    await env.DB.prepare("INSERT INTO career_records(key,value) VALUES('todos',json_set(json(?),?,json(?))) ON CONFLICT(key) DO UPDATE SET value=json_set(career_records.value,?,json(?))").bind(JSON.stringify(seedTodos),'$."'+todoMatch[1]+'"',JSON.stringify(todo),'$."'+todoMatch[1]+'"',JSON.stringify(todo)).run();
    return json({ok:true,todo});
   }
   let key,value;
   if(u.pathname==='/api/snapshot'){
    if(!Array.isArray(body.applications)||!Array.isArray(body.issues)||!Array.isArray(body.candidates))return json({error:'데이터 형식 오류'},400);
    key='snapshot';value=body;
   }else{
    const m=u.pathname.match(/^\/api\/(reviews|links|requests)\/([\w-]+)$/);if(!m)return json({error:'없는 경로'},404);
    key=m[1];
    if(key==='requests'){
     const snapshot=await env.DB.prepare("SELECT value FROM career_records WHERE key='snapshot'").first();
     const data=snapshot?JSON.parse(snapshot.value):seed;
     if(!data.issues.some(x=>x.id===m[2]))return json({error:'등록된 점검 항목만 요청할 수 있습니다'},400);
     if(typeof body.note!=='string'||body.note.length>10000)return json({error:'요청 내용을 10000자 이내로 입력하세요'},400);
     const existing=await env.DB.prepare("SELECT value FROM career_records WHERE key='requests'").first();
     const previous=existing?JSON.parse(existing.value)[m[2]]:null;
     if(!body.agentUpdate&&previous&&['pending','processing'].includes(previous.status))return json({error:'이미 접수된 요청입니다. 처리 상태를 확인해 주세요.'},409);
     if(body.agentUpdate){
      if(!['pending','processing','completed','needs_input','failed'].includes(body.status))return json({error:'상태 오류'},400);
      value={...previous,note:body.note,status:body.status,result:String(body.result||'').slice(0,20000),files:Array.isArray(body.files)?body.files.slice(0,10):[],updatedAt:new Date().toISOString()};
     }else value={note:body.note,status:'pending',requestedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),result:'',files:[]};
    }else if(key==='reviews'){
     if(typeof body.done!=='boolean'||typeof body.note!=='string'||body.note.length>10000)return json({error:'메모 형식 오류'},400);
     value={done:body.done,note:body.note,updatedAt:new Date().toISOString()};
    }else{
     if(!Array.isArray(body)||body.length>20||body.some(l=>typeof l.label!=='string'||l.label.length>100||typeof l.url!=='string'||l.url.length>2000||!/^https?:\/\//i.test(l.url)))return json({error:'http 또는 https 링크를 입력하세요'},400);
     value=body;
    }
    // json_set updates only this item, preserving simultaneous edits to other cards.
    await env.DB.prepare("INSERT INTO career_records(key,value) VALUES(?,json_object(?,json(?))) ON CONFLICT(key) DO UPDATE SET value=json_set(career_records.value,?,json(?))").bind(key,m[2],JSON.stringify(value),'$."'+m[2]+'"',JSON.stringify(value)).run();
    return json({ok:true});
   }
   await env.DB.prepare('INSERT INTO career_records(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(value)).run();
   return json({ok:true});
  }catch(e){return json({error:'저장 또는 조회 실패. 다시 시도해 주세요.'},500);}
 }};
}

