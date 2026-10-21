'use strict';
window.chooseBotMove=function(game,level){
 const values={p:100,n:320,b:330,r:500,q:900,k:0};
 const moves=game.moves({verbose:true});if(!moves.length)return null;
 if(level===0)return moves[Math.floor(Math.random()*moves.length)];
 if(level===1){const captures=moves.filter(m=>m.captured);return (captures.length?captures:moves)[Math.floor(Math.random()*(captures.length||moves.length))];}
 function evaluate(){if(game.in_checkmate())return game.turn()==='w'?-100000:100000;if(game.in_draw())return 0;let total=0;game.board().forEach((row,r)=>row.forEach((p,c)=>{if(p){const center=14-(Math.abs(3.5-r)+Math.abs(3.5-c))*2;total+=(p.color==='w'?1:-1)*(values[p.type]+(p.type==='k'?0:center));}}));return total;}
 function search(depth,alpha,beta){if(!depth||game.game_over())return evaluate();const white=game.turn()==='w';let best=white?-Infinity:Infinity;const options=game.moves({verbose:true}).sort((a,b)=>(values[b.captured]||0)-(values[a.captured]||0));for(const m of options){game.move(m);const score=search(depth-1,alpha,beta);game.undo();best=white?Math.max(best,score):Math.min(best,score);if(white)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);if(beta<=alpha)break;}return best;}
 const white=game.turn()==='w';let best=white?-Infinity:Infinity;let result=moves[0];for(const m of moves){game.move(m);const score=search(level===2?1:2,-Infinity,Infinity);game.undo();if(white?score>best:score<best){best=score;result=m;}}return result;
};

// Varied pacing: quick replies, ordinary decisions and occasional long thinks.
window.botThinkingDelay=function(game,level,remainingMs=Infinity){const roll=Math.random();const options=game.moves({verbose:true});let delay=roll<.22?650+Math.random()*1300:roll<.82?2200+Math.random()*4300:6500+Math.random()*5500;delay+=level*200;if(game.in_check()||options.filter(m=>m.captured).length>3)delay*=1.2;if(options.length===1)delay=500+Math.random()*800;if(Number.isFinite(remainingMs))delay=Math.min(delay,Math.max(120,remainingMs*(remainingMs<15000?.06:.2)));return Math.round(delay);};

// Cooperative fallback for browsers that disallow Workers (including some file:// setups).
window.chooseBotMoveAsync=async function(game,level,cancelled=()=>false){
 if(level<2)return chooseBotMove(game,level);
 const values={p:100,n:320,b:330,r:500,q:900,k:0};let slice=performance.now();
 async function checkpoint(){if(cancelled())throw new Error('cancelled');if(performance.now()-slice>8){await new Promise(resolve=>setTimeout(resolve,0));slice=performance.now();if(cancelled())throw new Error('cancelled');}}
 function evaluate(){if(game.in_checkmate())return game.turn()==='w'?-100000:100000;if(game.in_draw())return 0;let total=0;game.board().forEach((row,r)=>row.forEach((p,f)=>{if(p)total+=(p.color==='w'?1:-1)*(values[p.type]+(p.type==='k'?0:14-(Math.abs(3.5-r)+Math.abs(3.5-f))*2));}));return total;}
 async function search(depth,alpha,beta){await checkpoint();if(!depth||game.game_over())return evaluate();const white=game.turn()==='w';let best=white?-Infinity:Infinity;for(const move of game.moves({verbose:true}).sort((a,b)=>(values[b.captured]||0)-(values[a.captured]||0))){game.move(move);let score;try{score=await search(depth-1,alpha,beta);}finally{game.undo();}best=white?Math.max(best,score):Math.min(best,score);if(white)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);if(beta<=alpha)break;}return best;}
 const white=game.turn()==='w',moves=game.moves({verbose:true});let best=white?-Infinity:Infinity,result=moves[0]||null;for(const move of moves){await checkpoint();game.move(move);let score;try{score=await search(level===2?1:2,-Infinity,Infinity);}finally{game.undo();}if(white?score>best:score<best){best=score;result=move;}}return result;
};
