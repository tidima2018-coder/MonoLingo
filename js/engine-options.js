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
 section.innerHTML='<legend>Сила соперника</legend><label class="engine-skill-label" for="engine-skill"><span>Уровень</span><output id="engine-skill-value" for="engine-skill">'+skill+'</output></label><input id="engine-skill" type="range" min="0" max="20" step="1" value="'+skill+'" aria-describedby="engine-skill-help"><p id="engine-skill-help" class="small">От 0 — самый простой уровень до 20 — максимальная сила.</p>';
 settings.insertAdjacentElement('afterend',section);
 const input=section.querySelector('#engine-skill'),output=section.querySelector('#engine-skill-value');
 function persist(){output.value=input.value;output.textContent=input.value;try{localStorage.setItem(key,input.value);}catch(error){}document.dispatchEvent(new CustomEvent('stockfish-skill-change',{detail:{skill:Number(input.value)}}));}
 document.addEventListener('account-settings-loaded',()=>{const value=Number(localStorage.getItem(key));if(validSkill(value)&&!params.has('skill')){input.value=String(value);persist();}});
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
 const opponentName=()=>{const names=window.App?.botPatronymics||['Михалыч','Петрович','Ильич','Сергеич','Андреич','Васильич','Николаич','Фёдорович','Григорьич','Алексеич','Макарыч','Степаныч'];const requested=Number(params.get('stage'));let index=Number.isInteger(requested)&&requested>=0&&requested<names.length?requested:0;if(!params.has('stage')){const skills=[0,2,4,6,8,10,12,14,16,18,19,20];index=skills.reduce((best,value,i)=>Math.abs(value-Number(input.value))<Math.abs(skills[best]-Number(input.value))?i:best,0);}return names[index]+' · сила '+input.value;};
 document.querySelector('#start')?.addEventListener('click',()=>{input.disabled=true;setTimeout(()=>{const name=document.querySelector('#top-name');if(name&&document.querySelector('#mode')?.value==='bot')name.textContent=opponentName();},0);},true);
 const topName=document.querySelector('#top-name');if(topName&&topName.textContent.startsWith('Бот ·'))topName.textContent=opponentName();
 document.querySelector('#reset')?.addEventListener('click',()=>{input.disabled=false;},true);
})();
