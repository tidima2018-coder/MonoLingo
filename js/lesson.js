'use strict';
(() => {
 const app=document.querySelector('#app'),params=new URLSearchParams(location.search),stage=Number(params.get('stage'));
 if(!app||!Number.isInteger(stage)||!App.lessons[stage]){
  if(app)app.innerHTML='<a class="small" href="index.html">← К обучению</a><section class="panel"><h1>Теория не найдена</h1><p>Вернись к маршруту и выбери этап.</p></section>';
  return;
 }
 const lesson=App.lessons[stage],theory=lesson[3];
 if(!App.unlocked(stage)){
  app.innerHTML='<a class="small" href="index.html#learning">← К обучению</a><section class="panel"><h1>Этот этап пока закрыт</h1><p>Заверши предыдущий этап своего маршрута.</p></section>';
  return;
 }
 const title=Array.isArray(theory)?theory[0]:theory.title;
 const lead=Array.isArray(theory)?theory[1]:theory.lead;
 const body=Array.isArray(theory)?theory[2]:theory.body;
 const points=Array.isArray(theory)?theory[3]:theory.points;
 const explanation=Array.isArray(theory)?'':theory.explanation;
 const destination=lesson[2];
 const routeLabel=stage<App.botCount?'Этап '+(stage+1)+' · Партия':'Задача '+(stage-App.botCount+1)+' · Тактика';
 app.innerHTML='<a class="small" href="index.html#learning">← К маршруту обучения</a><section class="panel theory-page"><span class="eyebrow">'+routeLabel+' · '+lesson[0]+'</span><h1>'+title+'</h1><p class="theory-lead">'+lead+'</p><p>'+body+'</p>'+(explanation?'<p>'+explanation+'</p>':'')+'<h2>Запомни</h2><ul>'+points.map(point=>'<li>'+point+'</li>').join('')+'</ul><div class="actions"><a class="button" href="'+destination+'">Пропустить теорию</a><a class="button primary" href="'+destination+'">Перейти к уроку →</a></div></section>';
})();
