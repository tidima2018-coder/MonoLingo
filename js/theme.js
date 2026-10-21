'use strict';
(() => {
 const isHome=location.pathname.endsWith('/')||location.pathname.endsWith('/index.html');
 const key='chess-theme';let active=false,ready=false,photo=null,photoLoaded=false,layout=null;
 try{active=localStorage.getItem(key)==='aristocrat';}catch(e){}
 function ensurePhoto(){if(!isHome||!ready||!active||photo)return;
 layout=document.createElement('section');layout.className='portrait-layout';layout.hidden=true;
 const quotes=document.createElement('div');quotes.className='portrait-quotes';quotes.innerHTML='<span class="eyebrow">Мысли за доской</span><h2>Хорошая партия<br>начинается с мысли.</h2><blockquote>«Сначала найди идею.<br>Потом сделай ход.»</blockquote><p>Терпение — тоже часть стратегии.</p><p class="quote-last">На доске важен не самый громкий ход,<br>а самый точный.</p>';layout.appendChild(quotes);
 photo=document.createElement('figure');photo.className='aristocrat-photo';const image=document.createElement('img');image.alt='Двое в костюмах сидят в креслах; между ними небольшой столик.';image.decoding='async';image.onload=()=>{photoLoaded=true;layout.hidden=!active;};image.onerror=()=>{photoLoaded=false;layout.hidden=true;};photo.appendChild(image);layout.appendChild(photo);document.getElementById('app').before(layout);image.src='assets/aristocrat-portrait.png';}
 function apply(){document.documentElement.dataset.theme=active?'aristocrat':'classic';const button=document.getElementById('theme-toggle');if(button){button.textContent=active?'☀ Обычная тема':'♛ Тема аристократа';button.setAttribute('aria-pressed',String(active));button.title=active?'Вернуться к обычному дизайну':'Открыть шахматный кабинет';}if(layout)layout.hidden=!active||!photoLoaded;ensurePhoto();}
 apply();document.addEventListener('DOMContentLoaded',()=>{ready=true;apply();document.getElementById('theme-toggle').addEventListener('click',()=>{active=!active;try{localStorage.setItem(key,active?'aristocrat':'classic');}catch(e){}apply();});});window.addEventListener('storage',event=>{if(event.key===key){active=event.newValue==='aristocrat';apply();}});
})();
