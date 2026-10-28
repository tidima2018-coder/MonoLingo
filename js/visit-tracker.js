'use strict';
(() => {
 const path=location.pathname;
 if(path.endsWith('/admin.html')||path.endsWith('/admin')||!window.SupabaseApp?.client)return;
 const allowed=new Set(['/','/index.html','/game.html','/puzzles.html','/openings.html','/lesson.html']);
 const page=allowed.has(path)?path:null;
 if(!page)return;
 let sessionId;
 try{
  sessionId=sessionStorage.getItem('mono-visit-session-v1');
  if(!sessionId){sessionId=crypto.randomUUID();sessionStorage.setItem('mono-visit-session-v1',sessionId);}
 }catch(error){return;}
 window.SupabaseApp.recordVisit(sessionId,page).catch(()=>{});
})();
