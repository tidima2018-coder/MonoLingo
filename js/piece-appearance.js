'use strict';
window.PieceAppearance=(()=>{
 const key='chess-piece-appearance-v1';const palettes={mono:{name:'Белые и чёрные',white:'#ffffff',black:'#141414'},ivory:{name:'Слоновая кость',white:'#f5dfb7',black:'#4b2c20'},blue:{name:'Лёд и сапфир',white:'#e3f2ff',black:'#233a80'},green:{name:'Жемчуг и нефрит',white:'#eef4e7',black:'#194b3c'}};
 let value={style:'classic',white:palettes.mono.white,black:palettes.mono.black};const validColor=v=>/^#[0-9a-f]{6}$/i.test(v||'');
 try{const stored=JSON.parse(localStorage.getItem(key));if(stored&&['classic','royal','modern'].includes(stored.style)&&validColor(stored.white)&&validColor(stored.black))value={style:stored.style,white:stored.white,black:stored.black};}catch(e){}
 function mix(hex,t){const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));return '#'+channels.map(v=>Math.round(t>0?v+(255-v)*t:v*(1+t)).toString(16).padStart(2,'0')).join('');}
 function apply(){const root=document.documentElement;root.dataset.pieceStyle=value.style;for(const [side,color] of [['w',value.white],['b',value.black]]){root.style.setProperty('--piece-'+side+'-light',mix(color,.25));root.style.setProperty('--piece-'+side+'-base',color);root.style.setProperty('--piece-'+side+'-shade',mix(color,-.3));} }
 function set(next){const candidate={...value,...next};if(!['classic','royal','modern'].includes(candidate.style)||!validColor(candidate.white)||!validColor(candidate.black))return;value=candidate;try{localStorage.setItem(key,JSON.stringify(value));}catch(e){}apply();document.dispatchEvent(new CustomEvent('piece-appearance-change',{detail:{...value}}));}
 function svg(p,style=value.style){
  const shapes={classic:{p:'<circle cx="50" cy="27" r="12"/><path d="M43 39 Q44 55 34 67 L66 67 Q56 55 57 39Z"/>',r:'<path d="M29 17H39V27H45V17H55V27H61V17H71V39L62 44L65 66H35L38 44L29 39Z"/>',b:'<path d="M50 12 Q27 30 35 43 Q39 49 44 49 L38 66H62L56 49 Q75 42 62 25Z"/><path class="piece-detail" d="M52 20L44 34"/>',n:'<path d="M31 66Q32 51 44 43L48 37L39 39L31 46L22 40L25 33L38 22L47 20L53 10L58 22Q75 34 70 66Z"/><path d="M58 24Q75 41 65 62L72 65Q83 38 62 23Z"/><circle class="piece-eye" cx="46" cy="29" r="2.5"/><path class="piece-detail" d="M28 38L34 39M58 35Q65 45 50 58"/>',q:'<path d="M31 32L40 43L50 26L60 43L69 32L63 65H37Z"/><circle cx="28" cy="27" r="5"/><circle cx="50" cy="20" r="5"/><circle cx="72" cy="27" r="5"/>',k:'<path d="M46 10H54V18H62V25H54V34H46V25H38V18H46Z"/><path d="M32 40Q30 29 43 34L50 40L57 34Q70 29 68 40L59 54L63 66H37L41 54Z"/>'},modern:{p:'<circle cx="50" cy="28" r="12"/><path d="M45 40H55L62 66H38Z"/>',r:'<path d="M28 19H38V29H45V19H55V29H62V19H72V43H62V66H38V43H28Z"/>',n:'<path d="M32 66L40 46L58 36L43 32L29 40L24 33L42 17L60 16L73 38L68 66Z"/><circle class="piece-eye" cx="47" cy="25" r="2"/>',b:'<path d="M50 12L66 33L55 48L63 66H37L45 48L34 33Z"/><path class="piece-detail" d="M52 20L45 31"/>',q:'<path d="M28 23L40 37L50 18L60 37L72 23L62 66H38Z"/>',k:'<path d="M46 10H54V21H65V29H54V42H46V29H35V21H46Z"/><path d="M39 43H61L65 66H35Z"/>'}};
  const shapesForPiece=style==='modern'?shapes.modern:shapes.classic,id='piece-shading-'+(svg.uid=(svg.uid||0)+1),appearance=value,base=p.color==='w'?appearance.white:appearance.black,colors=[mix(base,.25),base,mix(base,-.3)];
  return '<svg class="piece piece-'+p.color+'" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="'+id+'" x1="0" y1="0" x2="1" y2=".4"><stop stop-color="'+colors[0]+'"/><stop offset=".45" stop-color="'+colors[1]+'"/><stop offset="1" stop-color="'+colors[2]+'"/></linearGradient></defs><ellipse class="piece-shadow" cx="50" cy="87" rx="31" ry="7"/><g class="piece-body" style="fill:url(#'+id+')">'+shapesForPiece[p.type]+(style==='royal'?'<path d="M33 60H67L69 64H31Z"/><path d="M32 69H68" class="piece-shine"/>':'')+'<path d="M34 65H66L70 73H30Z"/><path d="M29 74H71L76 85Q50 91 24 85Z"/><path class="piece-shine" d="M32 79H66"/></g></svg>';
 }
 apply();window.addEventListener('storage',event=>{if(event.key!==key||!event.newValue)return;try{set(JSON.parse(event.newValue));}catch(e){}});
 return {get:()=>({...value}),set,palettes,mix,svg};
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

window.BoardCustomizer=(()=>{
 const viewKey='chess-board-view-v1',viewPalettes={wood:{name:'Обожжённый орех',light:'#756452',dark:'#302720'},graphite:{name:'Графит',light:'#62656b',dark:'#252830'},forest:{name:'Тёмный лес',light:'#617162',dark:'#263d31'},night:{name:'Ночной сапфир',light:'#626f85',dark:'#253147'}};
 function is3D(){try{const saved=localStorage.getItem(viewKey);if(saved==='3d')return true;if(saved==='2d')return false;}catch(error){}return document.documentElement.dataset.theme==='aristocrat';}
 function set3D(enabled){try{localStorage.setItem(viewKey,enabled?'3d':'2d');}catch(error){}document.dispatchEvent(new CustomEvent('board-view-change',{detail:{enabled}}));}
 function create(){
  const details=document.createElement('details');details.className='piece-customizer';
  details.innerHTML='<summary>♞ Доска и фигуры <span>Настроить</span></summary><div class="piece-customizer-content"><fieldset><legend>Вид доски</legend><button type="button" id="board-view-toggle" aria-pressed="false"></button><p class="small">Режим доски и оформления синхронизируется с партией, задачами и дебютами.</p></fieldset><fieldset><legend>Форма фигур</legend><div id="piece-style-options" class="piece-style-options"></div></fieldset><fieldset><legend>Цветовые наборы фигур</legend><div id="piece-palette-options" class="piece-palette-options"></div></fieldset><div class="piece-color-inputs"><label>Белые<input id="piece-white-color" type="color" aria-label="Цвет белых фигур"></label><label>Чёрные<input id="piece-black-color" type="color" aria-label="Цвет чёрных фигур"></label><button id="piece-apply-colors" type="button" disabled>Применить цвета</button><button id="piece-defaults" type="button">По умолчанию</button></div><p class="small">Цвета фигур сохраняются для всех режимов.</p><fieldset class="board-color-settings"><legend>Цвета доски</legend><div id="board-palette-options" class="piece-palette-options"></div><div class="piece-color-inputs"><label>Светлые клетки<input id="board-light-color" type="color" aria-label="Цвет светлых клеток"></label><label>Тёмные клетки<input id="board-dark-color" type="color" aria-label="Цвет тёмных клеток"></label><button id="board-apply-colors" type="button" disabled>Применить к доске</button><button id="board-defaults" type="button">Сбросить</button></div></fieldset></div>';
  const $=selector=>details.querySelector(selector),pieceStyle=$('#piece-style-options'),piecePalette=$('#piece-palette-options'),boardPalette=$('#board-palette-options');
  function sync(){
   const pieces=PieceAppearance.get(),board=BoardAppearance.get(),toggle=$('#board-view-toggle'),threeD=is3D();
   pieceStyle.innerHTML=[['classic','Классика'],['royal','Королевские'],['modern','Геометрия']].map(([key,label])=>'<button type="button" data-piece-style="'+key+'" aria-pressed="'+(pieces.style===key)+'"><span class="piece-preview">'+PieceAppearance.svg({type:'n',color:'w'},key)+PieceAppearance.svg({type:'k',color:'b'},key)+'</span><strong>'+label+'</strong></button>').join('');
   piecePalette.innerHTML=Object.entries(PieceAppearance.palettes).map(([key,p])=>'<button type="button" data-piece-palette="'+key+'" aria-pressed="'+(p.white===pieces.white&&p.black===pieces.black)+'"><span class="palette-swatches"><i style="background:'+p.white+'"></i><i style="background:'+p.black+'"></i></span><span>'+p.name+'</span></button>').join('');
   boardPalette.innerHTML=Object.entries(viewPalettes).map(([key,p])=>'<button type="button" data-board-palette="'+key+'" aria-pressed="'+(p.light===board.light&&p.dark===board.dark)+'"><span class="palette-swatches"><i style="background:'+p.light+'"></i><i style="background:'+p.dark+'"></i></span><span>'+p.name+'</span></button>').join('');
   $('#piece-white-color').value=pieces.white;$('#piece-black-color').value=pieces.black;$('#board-light-color').value=board.light;$('#board-dark-color').value=board.dark;$('#piece-apply-colors').disabled=true;$('#board-apply-colors').disabled=true;toggle.textContent=threeD?'Переключить на 2D':'Переключить на 3D';toggle.setAttribute('aria-pressed',String(threeD));
  }
  details.addEventListener('click',event=>{
   const target=event.target,style=target.closest('[data-piece-style]'),piece=target.closest('[data-piece-palette]'),board=target.closest('[data-board-palette]');
   if(style)PieceAppearance.set({style:style.dataset.pieceStyle});
   if(piece)PieceAppearance.set(PieceAppearance.palettes[piece.dataset.piecePalette]);
   if(board)BoardAppearance.set(viewPalettes[board.dataset.boardPalette]);
   if(target.closest('#piece-defaults'))PieceAppearance.set({style:'classic',white:'#ffffff',black:'#141414'});
   if(target.closest('#board-defaults'))BoardAppearance.set(BoardAppearance.palettes.wood);
   if(target.closest('#board-view-toggle'))set3D(!is3D());
  });
  function pieceDraft(){const current=PieceAppearance.get();$('#piece-apply-colors').disabled=$('#piece-white-color').value===current.white&&$('#piece-black-color').value===current.black;}
  function boardDraft(){const current=BoardAppearance.get();$('#board-apply-colors').disabled=$('#board-light-color').value===current.light&&$('#board-dark-color').value===current.dark;}
  $('#piece-white-color').addEventListener('input',pieceDraft);$('#piece-black-color').addEventListener('input',pieceDraft);$('#board-light-color').addEventListener('input',boardDraft);$('#board-dark-color').addEventListener('input',boardDraft);
  $('#piece-apply-colors').addEventListener('click',()=>PieceAppearance.set({white:$('#piece-white-color').value,black:$('#piece-black-color').value}));
  $('#board-apply-colors').addEventListener('click',()=>BoardAppearance.set({light:$('#board-light-color').value,dark:$('#board-dark-color').value}));
  document.addEventListener('piece-appearance-change',sync);document.addEventListener('board-appearance-change',sync);document.addEventListener('board-view-change',sync);new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  sync();return details;
 }
 return {create,is3D,set3D};
})();
