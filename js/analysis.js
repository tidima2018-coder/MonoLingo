'use strict';
(() => {
 const panel=document.querySelector('#analysis');
 if(!panel)return;
 let worker=null,runId=0;
 function stop(message){
  runId++;
  if(worker){worker.terminate();worker=null;}
  const progress=panel.querySelector('#engine-progress');
  if(progress)progress.textContent=message||'Анализ остановлен.';
  const run=panel.querySelector('#engine-run'),cancel=panel.querySelector('#engine-cancel');
  if(run)run.disabled=false;
  if(cancel)cancel.hidden=true;
 }
 function show(){
  if(panel.hidden||!panel.querySelector('.analysis-layout')||panel.querySelector('.engine-review'))return;
  const layout=panel.querySelector('.analysis-layout');
  const review=document.createElement('section');review.className='engine-review';
  review.innerHTML='<div class="engine-review-heading"><div><span class="eyebrow">Локальный движок</span><h3>Разбор ходов Stockfish</h3></div><div class="engine-review-actions"><button id="engine-run" class="primary" type="button">Запустить анализ</button><button id="engine-cancel" type="button" hidden>Остановить</button></div></div><p class="small">Оценка позиции и ориентировочная классификация каждого хода рассчитываются в браузере. На длинной партии расчёт может занять время.</p><div id="engine-progress" class="engine-progress" role="status" aria-live="polite">Глубина 9 · движок загружается только после нажатия.</div><div id="engine-results"></div>';
  layout.insertAdjacentElement('beforebegin',review);
  const run=review.querySelector('#engine-run'),cancel=review.querySelector('#engine-cancel'),progress=review.querySelector('#engine-progress'),resultsPanel=review.querySelector('#engine-results');
  let scores=[],bestMoves=[],resultLimit=0;
  cancel.onclick=()=>stop('Анализ остановлен.');
  resultsPanel.onclick=event=>{const row=event.target.closest('[data-review-index]');if(row&&window.showChessReviewPosition)window.showChessReviewPosition(Number(row.dataset.reviewIndex));};
  resultsPanel.onkeydown=event=>{const row=event.target.closest('[data-review-index]');if(row&&(event.key==='Enter'||event.key===' ')){event.preventDefault();if(window.showChessReviewPosition)window.showChessReviewPosition(Number(row.dataset.reviewIndex));}};
  run.onclick=()=>{
   const data=window.chessBoardReviewData;
   if(!data||!Array.isArray(data.positions)||!Array.isArray(data.moves)){progress.textContent='Нет данных партии для анализа.';return;}
   if(!data.moves.length){progress.textContent='В партии пока нет ходов для анализа.';return;}
   try{worker=new Worker('js/vendor/stockfish-19-lite-single.js');}catch(error){progress.textContent='Не удалось запустить Stockfish в этом браузере: '+error.message;return;}
   const activeRun=++runId,mobile=matchMedia('(max-width: 760px)').matches,depth=mobile?7:9,limit=Math.min(data.positions.length,121);
   resultLimit=limit;scores=[];bestMoves=[];
   run.disabled=true;cancel.hidden=false;resultsPanel.innerHTML='';progress.textContent='Загрузка Stockfish…';
   let index=-1,lastScore=null,uciStarted=false;
   const finish=message=>{if(activeRun!==runId)return;if(worker){worker.terminate();worker=null;}run.disabled=false;cancel.hidden=true;progress.textContent=message;renderResults();};
   function sendPosition(){
    index++;
    if(index>=limit){finish('Анализ завершён: '+(limit-1)+' из '+data.moves.length+' полуходов.');return;}
    lastScore=null;progress.textContent='Позиция '+(index+1)+' / '+limit+' · глубина '+depth;
    worker.postMessage('position fen '+data.positions[index]);
    worker.postMessage('go depth '+depth);
   }
   function fail(){if(activeRun!==runId)return;finish('Stockfish не смог запуститься. Проверьте, что сайт открыт через HTTP(S), а браузер поддерживает WebAssembly и Worker.');}
   worker.onmessage=event=>{
    if(activeRun!==runId)return;
    for(const raw of String(event.data).split(/\r?\n/)){
     const line=raw.trim();
     if(line==='uciok'&&!uciStarted){uciStarted=true;worker.postMessage('setoption name Skill Level value 20');sendPosition();continue;}
     if(line.startsWith('info ')&&line.includes('score ')){
      const score=line.match(/\bscore (cp|mate) (-?\d+)/),depthMatch=line.match(/\bdepth (\d+)/);
      if(score&&(!depthMatch||Number(depthMatch[1])>=Number(lastScore?.depth||0))){const value=Number(score[2]),cp=score[1]==='mate'?(value>0?10000-Math.abs(value):-(10000-Math.abs(value))):value;lastScore={cp,depth:Number(depthMatch?.[1]||0)};}
     }
     if(line.startsWith('bestmove ')){
      scores[index]=lastScore?.cp??null;bestMoves[index]=line.split(/\s+/)[1]||'';
      sendPosition();
     }
    }
   };
   worker.onerror=event=>{event.preventDefault?.();if(worker){worker.terminate();worker=null;}fail();};
   worker.postMessage('uci');
  };
  function renderResults(){
   const data=window.chessBoardReviewData;if(!data)return;
   const rows=[];let counts={best:0,accurate:0,inaccuracy:0,error:0,blunder:0};
   const evalWhite=(index)=>{
    if(scores[index]===null||scores[index]===undefined)return null;
    return data.positions[index].split(' ')[1]==='w'?scores[index]:-scores[index];
   };
   const labelFor=(index,move)=>{
    const uci=bestMoves[index]||'',played=move.from+move.to+(move.promotion||'');
    if(uci===played){counts.best++;return ['Лучший ход','best'];}
    const before=evalWhite(index),after=evalWhite(index+1);
    if(before===null||after===null)return ['Нет оценки','unknown'];
    const sign=move.color==='w'?1:-1,loss=Math.max(0,(before-after)*sign);
    if(loss<=25){counts.accurate++;return ['Точный','accurate'];}
    if(loss<=90){counts.inaccuracy++;return ['Неточность','inaccuracy'];}
    if(loss<=250){counts.error++;return ['Ошибка','error'];}
    counts.blunder++;return ['Зевок','blunder'];
   };
   for(let index=0;index<data.moves.length&&index<resultLimit-1;index++){
    const move=data.moves[index],[label,kind]=labelFor(index,move),score=evalWhite(index);
    const evalText=score===null?'—':(score>0?'+':'')+(score/100).toFixed(1);
    const best=bestMoves[index]&&bestMoves[index]!=='(none)'?bestMoves[index].slice(0,2)+'–'+bestMoves[index].slice(2,4):'—';
    rows.push('<tr data-review-index="'+(index+1)+'" tabindex="0"><td>'+(Math.floor(index/2)+1)+(move.color==='b'?'…':'.')+'</td><td>'+move.san+'</td><td><span class="move-grade '+kind+'">'+label+'</span></td><td>'+best+'</td><td>'+evalText+'</td></tr>');
   }
   resultsPanel.innerHTML='<div class="engine-review-summary"><span>Лучшие ходы: <strong>'+counts.best+'</strong></span><span>Точные: <strong>'+counts.accurate+'</strong></span><span>Неточности: <strong>'+counts.inaccuracy+'</strong></span><span>Ошибки: <strong>'+counts.error+'</strong></span><span>Зевки: <strong>'+counts.blunder+'</strong></span></div><div class="analysis-table-wrap"><table class="analysis-table engine-move-table"><thead><tr><th>№</th><th>Ход</th><th>Оценка</th><th>Лучше было</th><th>Позиция, пешки</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
  }
 }
 const observer=new MutationObserver(()=>{if(panel.hidden||!panel.querySelector('.analysis-layout')){if(worker)stop('Анализ остановлен.');return;}show();});
 observer.observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
})();
