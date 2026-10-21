'use strict';
// A possible mating position matters on timeout, not whether mate can be forced.
window.canMateOnTime=function(game,color){
 const own=[],other=[];game.board().forEach((row,r)=>row.forEach((p,f)=>{if(p&&p.type!=='k')(p.color===color?own:other).push({...p,squareColor:(r+f)%2});}));
 if(!own.length||game.insufficient_material())return false;
 if(own.some(p=>'pqr'.includes(p.type)))return true;
 const knights=own.filter(p=>p.type==='n'),bishops=own.filter(p=>p.type==='b');
 if(knights.length>=2||(knights.length&&bishops.length))return true;
 if(knights.length===1)return other.length>0;
 const colors=new Set(bishops.map(p=>p.squareColor));if(colors.size>1)return true;
 return other.some(p=>p.type!=='b'||!colors.has(p.squareColor));
};
