'use strict';
(() => {
 const learning=document.querySelector('#learning');
 if(!learning||!window.App)return;
 const gameStages=App.lessons.map((lesson,index)=>({lesson,index})).filter(item=>item.lesson[2].startsWith('game.html'));
 const puzzleStages=App.lessons.map((lesson,index)=>({lesson,index})).filter(item=>item.lesson[2].startsWith('puzzles.html'));
 const challenge=App.dailyPuzzle();
 const completedToday=App.data.dailyDates.includes(App.localDate());
 function track(items){
  return items.map(({lesson,index},step)=>{
   const complete=App.data.completed.includes(index),open=App.unlocked(index);
   return '<article class="card lesson '+(complete?'is-complete':open?'is-current':'is-locked')+'"><span class="step">'+(complete?'✓':open?'♟':'♙')+'</span><div class="lesson-copy"><span class="lesson-meta">Этап '+(step+1)+' из '+items.length+'</span><h3>'+lesson[0]+'</h3><p>'+lesson[1]+'</p></div>'+(open?'<a class="button '+(!complete?'primary':'')+'" href="'+App.theoryUrl(index)+'">'+(complete?'Повторить':'Изучить')+' теорию →</a>':'<span class="locked-label">Закрыто</span>')+'</article>';
  }).join('');
 }
 const oldLayout=learning.querySelector('.layout');
 if(!oldLayout)return;
 oldLayout.id='activities';oldLayout.className='activity-hub';
 oldLayout.innerHTML='<section class="activity-group"><span class="eyebrow">Играй</span><h2>Партии против ботов</h2><p>Полноценная партия на шахматной доске — не задача на один ход.</p><div class="activity-tiles"><a class="activity-tile mode-bot" href="game.html"><span class="mode-icon">♞</span><strong>12 шахматных соперников</strong><small>От Михалыча до Борисыча · сила 0–20</small></a><a class="activity-tile mode-friend" href="game.html?mode=friend"><span class="mode-icon">♚</span><strong>С другом</strong><small>Два игрока за одним устройством</small></a></div><details class="activity-track"><summary>Этапы игры против ботов <span>'+gameStages.filter(({index})=>App.data.completed.includes(index)).length+' / '+gameStages.length+'</span></summary><div class="path">'+track(gameStages)+'</div></details></section><section class="activity-group"><span class="eyebrow">Тренируйся</span><h2>Тактические задачи — отдельно от партий</h2><a class="activity-tile daily-card" href="puzzles.html?daily=1"><span class="mode-icon daily-icon">'+(completedToday?'✓':'♟')+'</span><span class="activity-copy"><strong>Задача на каждый день</strong><small>'+(completedToday?'Решена сегодня':'Задача дня: '+challenge.title)+' · '+App.dailyStreakLabel()+'</small></span><span class="activity-arrow" aria-hidden="true">→</span></a><a class="activity-tile mode-puzzle" href="puzzles.html"><span class="mode-icon">♝</span><span class="activity-copy"><strong>Все тактические задачи</strong><small>'+App.puzzles.length+' отдельных позиций с разными целями</small></span><span class="activity-arrow" aria-hidden="true">→</span></a><a class="activity-tile mode-opening" href="openings.html"><span class="mode-icon">♜</span><span class="activity-copy"><strong>Интерактивный учебник дебютов</strong><small>Разбирай планы и варианты по ходам</small></span><span class="activity-arrow" aria-hidden="true">→</span></a><details class="activity-track"><summary>Маршрут тактических задач <span>'+puzzleStages.filter(({index})=>App.data.completed.includes(index)).length+' / '+puzzleStages.length+'</span></summary><div class="path">'+track(puzzleStages)+'</div></details></section>';
 const dailyInfo=learning.querySelector('.daily-card small');if(dailyInfo)dailyInfo.textContent=(completedToday?'Решена сегодня · ':'Задача дня: '+challenge.title+' · ')+App.dailyStreakLabel();
 const heading=learning.querySelector('.learning-heading');
 if(heading){heading.querySelector('h1').textContent='Выбирай, что тренировать';heading.querySelector('p').textContent='Партии с ботами, тактика и дебюты — в отдельных разделах.';const action=heading.querySelector('a');if(action){action.href='#activities';action.textContent='Выбрать раздел →';}}
})();
