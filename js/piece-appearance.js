'use strict';
window.PieceAppearance=(()=>{
 const key='chess-piece-appearance-v1';const palettes={mono:{name:'Белые и чёрные',white:'#ffffff',black:'#141414'},ivory:{name:'Слоновая кость',white:'#f5dfb7',black:'#4b2c20'},blue:{name:'Лёд и сапфир',white:'#e3f2ff',black:'#233a80'},green:{name:'Жемчуг и нефрит',white:'#eef4e7',black:'#194b3c'}};
 let value={style:'classic',white:palettes.mono.white,black:palettes.mono.black};const validColor=v=>/^#[0-9a-f]{6}$/i.test(v||'');
 try{const stored=JSON.parse(localStorage.getItem(key));if(stored&&['classic','royal','modern'].includes(stored.style)&&validColor(stored.white)&&validColor(stored.black))value={style:stored.style,white:stored.white,black:stored.black};}catch(e){}
 function mix(hex,t){const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));return '#'+channels.map(v=>Math.round(t>0?v+(255-v)*t:v*(1+t)).toString(16).padStart(2,'0')).join('');}
 function apply(){const root=document.documentElement;root.dataset.pieceStyle=value.style;for(const [side,color] of [['w',value.white],['b',value.black]]){root.style.setProperty('--piece-'+side+'-light',mix(color,.25));root.style.setProperty('--piece-'+side+'-base',color);root.style.setProperty('--piece-'+side+'-shade',mix(color,-.3));} }
 function set(next){const candidate={...value,...next};if(!['classic','royal','modern'].includes(candidate.style)||!validColor(candidate.white)||!validColor(candidate.black))return;value=candidate;try{localStorage.setItem(key,JSON.stringify(value));}catch(e){}apply();document.dispatchEvent(new CustomEvent('piece-appearance-change',{detail:{...value}}));}
 apply();window.addEventListener('storage',event=>{if(event.key!==key||!event.newValue)return;try{set(JSON.parse(event.newValue));}catch(e){}});
 return {get:()=>({...value}),set,palettes,mix};
})();

window.BoardAppearance=(()=>{
 const key='chess-board-colors-v1';const palettes={wood:{name:'Обожжённый орех',light:'#756452',dark:'#302720'},graphite:{name:'Графит',light:'#62656b',dark:'#252830'},forest:{name:'Тёмный лес',light:'#617162',dark:'#263d31'},night:{name:'Ночной сапфир',light:'#626f85',dark:'#253147'}};
 let value={light:palettes.wood.light,dark:palettes.wood.dark};const valid=v=>/^#[0-9a-f]{6}$/i.test(v||'');
 try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&valid(saved.light)&&valid(saved.dark))value={light:saved.light,dark:saved.dark};}catch(e){}
 function ink(hex){const p=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));return p[0]*.299+p[1]*.587+p[2]*.114>145?'#241e18':'#f5e4cb';}
 function apply(){const root=document.documentElement;for(const side of ['light','dark']){root.style.setProperty('--chess-cell-'+side,value[side]);root.style.setProperty('--chess-ink-'+side,ink(value[side]));}}
 function set(next){if(!valid(next.light)||!valid(next.dark))return;value={light:next.light,dark:next.dark};try{localStorage.setItem(key,JSON.stringify(value));}catch(e){}apply();document.dispatchEvent(new CustomEvent('board-appearance-change',{detail:{...value}}));}
 apply();window.addEventListener('storage',event=>{if(event.key===key&&event.newValue)try{set(JSON.parse(event.newValue));}catch(e){}});
 return {get:()=>({...value}),set,palettes};
})();
