'use strict';
(() => {
 const settings=document.querySelector('#difficulty-section');
 if(!settings)return;
 const key='chess-stockfish-skill-v1',defaults=[0,5,12,18],params=new URLSearchParams(location.search);
 let level=Number(document.querySelector('#level')?.value)||0,saved=null,requested=params.has('skill')?Number(params.get('skill')):null;
 try{const stored=localStorage.getItem(key);if(stored!==null)saved=Number(stored);}catch(error){}
 const validSkill=value=>Number.isInteger(value)&&value>=0&&value<=20;
 const skill=validSkill(requested)?requested:validSkill(saved)?saved:defaults[level]||0;
 const section=document.createElement('fieldset');section.className='setting-section engine-skill-setting';
 section.innerHTML='<legend>Сила движка Stockfish</legend><label class="engine-skill-label" for="engine-skill"><span>Уровень</span><output id="engine-skill-value" for="engine-skill">'+skill+'</output></label><input id="engine-skill" type="range" min="0" max="20" step="1" value="'+skill+'" aria-describedby="engine-skill-help"><p id="engine-skill-help" class="small">Stockfish Skill Level: 0 — самый простой, 20 — максимальная сила. Это уровень движка, а не рейтинг Elo.</p>';
 settings.insertAdjacentElement('afterend',section);
 const input=section.querySelector('#engine-skill'),output=section.querySelector('#engine-skill-value');
 function persist(){output.value=input.value;output.textContent=input.value;try{localStorage.setItem(key,input.value);}catch(error){}document.dispatchEvent(new CustomEvent('stockfish-skill-change',{detail:{skill:Number(input.value)}}));}
 function syncVisibility(mode=document.querySelector('#mode')?.value){section.hidden=mode==='friend';}
 input.addEventListener('input',persist);persist();
 document.querySelector('#settings')?.addEventListener('click',event=>{
  const preset=event.target.closest('[data-setting="level"]');
  const mode=event.target.closest('[data-setting="mode"]');
  if(mode)syncVisibility(mode.dataset.value);
  if(preset&&!input.disabled){input.value=String(defaults[Number(preset.dataset.value)]||0);persist();}
 },true);
 document.querySelector('#mode')?.addEventListener('change',()=>syncVisibility());
 syncVisibility();
 document.querySelector('#start')?.addEventListener('click',()=>{input.disabled=true;setTimeout(()=>{const name=document.querySelector('#top-name');if(name&&document.querySelector('#mode')?.value==='bot')name.textContent='Stockfish · сила '+input.value;},0);},true);
 const topName=document.querySelector('#top-name');if(topName&&topName.textContent.startsWith('Бот ·'))topName.textContent='Stockfish · сила '+input.value;
 document.querySelector('#reset')?.addEventListener('click',()=>{input.disabled=false;},true);
})();
