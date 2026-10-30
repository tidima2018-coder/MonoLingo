'use strict';
document.documentElement.classList.add('auth-pending');
(() => {
 const api=window.SupabaseApp;
 let profile=null,ready=false,syncTimer=0,accountDataTimer=0,authCheckActive=true;
 const accountKeys=['chess-theme','chess-piece-appearance-v1','chess-board-colors-v1','chess-board-view-v1','chess-stockfish-skill-v1','chess-openings-v1','chess-active-game-v1'];
 function authThemeChoice(){try{const choice=sessionStorage.getItem('chess-auth-theme-choice');return choice==='classic'||choice==='aristocrat'?choice:null;}catch(error){return null;}}
 function readAccountData(){const data={};for(const key of accountKeys){try{const value=localStorage.getItem(key);if(value!==null)data[key]=value;}catch(error){}}return data;}
 function applyAccountData(data){if(!data||typeof data!=='object')return;for(const key of accountKeys){const value=key==='chess-theme'?authThemeChoice()||data[key]:data[key];if(typeof value!=='string')continue;try{localStorage.setItem(key,value);}catch(error){}}document.dispatchEvent(new CustomEvent('account-settings-loaded',{detail:{data}}));}
 function scheduleAccountDataSync(){if(!ready)return;clearTimeout(accountDataTimer);accountDataTimer=setTimeout(async()=>{try{await api.saveAccountData(readAccountData());try{sessionStorage.removeItem('chess-auth-theme-choice');}catch(error){}}catch(error){console.error('Не удалось сохранить настройки аккаунта:',error);document.dispatchEvent(new CustomEvent('cloud-sync-error',{detail:{message:message(error)}}));}},5000);}
 const el=(tag,attrs={},text='')=>{const node=document.createElement(tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);if(text)node.textContent=text;return node;};
 const message=error=>{
  const raw=String(error?.message||''),code=String(error?.code||'');
  if(code==='confirmation_resend_cooldown')return error?.message||'Подожди перед повторной отправкой письма.';
  if(code==='over_email_send_rate_limit'||raw.toLowerCase().includes('email rate limit exceeded'))return 'Сейчас исчерпан лимит отправки писем. Подожди и используй кнопку «Отправить письмо повторно»; для восстановления обычной отправки подключи SMTP в Supabase. Подтверждение почты отключать не нужно.';
  if(code==='auth_request_rate_limit')return 'Слишком много запросов. Подожди перед следующей попыткой.';
  if(code==='email_not_confirmed'||raw.toLowerCase().includes('email not confirmed'))return 'Сначала подтверди email по ссылке из письма. Если ссылка истекла, запроси новое письмо.';
  if(code==='over_email_send_rate_limit'||raw.toLowerCase().includes('email rate limit exceeded'))return 'Supabase временно ограничил отправку писем подтверждения. Встроенная почта проекта имеет низкий лимит. Не нажимай регистрацию повторно: дождись сброса лимита или подключи собственный SMTP в Supabase → Authentication → SMTP Settings. Если первая попытка уже создала аккаунт, переключись на «Войти».';
  if(raw==='Failed to fetch')return 'Не удалось подключиться к Supabase. Проверь Project URL, Publishable key и интернет.';
  if(raw==='Invalid login credentials')return 'Неверный email или пароль. Если аккаунта ещё нет, выбери «Создать аккаунт».';
  if(raw==='User already registered')return 'Этот email уже зарегистрирован. Переключись на «Войти».';
  return raw||'Произошла ошибка. Попробуй ещё раз.';
 };
 function showGate(errorText=''){
  document.documentElement.classList.add('auth-pending');
  if(document.getElementById('auth-gate')){document.getElementById('auth-gate').hidden=false;const existingError=document.querySelector('.auth-error');if(existingError)existingError.textContent=errorText;document.querySelectorAll('#auth-form input,#auth-form button').forEach(control=>control.disabled=false);return;}
  const gate=el('section',{id:'auth-gate','aria-label':'Вход'}),card=el('div',{class:'auth-card'}),themeButton=el('button',{class:'auth-theme-toggle',type:'button','aria-pressed':'false'});
  const rain=el('div',{class:'auth-chess-rain','aria-hidden':'true'}),pieces=['♟','♞','♝','♜','♛','♚'];for(let i=0;i<22;i++){const piece=el('span',{},pieces[i%pieces.length]);piece.style.setProperty('--piece-x',Math.round(Math.random()*100)+'%');piece.style.setProperty('--piece-delay',(-Math.random()*26).toFixed(2)+'s');piece.style.setProperty('--piece-duration',(18+Math.random()*12).toFixed(2)+'s');piece.style.setProperty('--piece-drift',Math.round(-44+Math.random()*88)+'px');piece.style.setProperty('--piece-size',Math.round(26+Math.random()*24)+'px');rain.append(piece);}gate.append(rain);
  themeButton.textContent=document.documentElement.dataset.theme==='aristocrat'?'☀ Обычная тема':'♛ Тема аристократа';
  themeButton.onclick=()=>document.getElementById('theme-toggle')?.click();
  card.append(themeButton);
  card.append(el('span',{class:'eyebrow'},'Ход вперёд'),el('h1',{},'Вход в аккаунт'),el('p',{},'Войди или создай аккаунт, чтобы сохранять прогресс на всех устройствах.'));
  const error=el('p',{class:'auth-error',role:'alert'});error.textContent=errorText;
  const form=el('form',{id:'auth-form'}),usernameLabel=el('label',{for:'auth-username'},'Никнейм'),username=el('input',{id:'auth-username',name:'username',autocomplete:'nickname',maxlength:'32',hidden:'','aria-label':'Никнейм'}),emailLabel=el('label',{for:'auth-email'},'Email'),email=el('input',{id:'auth-email',name:'email',type:'email',autocomplete:'email',required:''}),passwordLabel=el('label',{for:'auth-password'},'Пароль'),password=el('input',{id:'auth-password',name:'password',type:'password',autocomplete:'current-password',minlength:'8',required:''}),submit=el('button',{class:'primary',type:'submit'},'Войти'),toggle=el('button',{class:'auth-mode-toggle',type:'button'},'Создать аккаунт');
  username.required=false;
 const resendButton=el('button',{class:'auth-mode-toggle',type:'button'},'Отправить письмо повторно');resendButton.hidden=true;
 let resendCooldownTimer=0;
 function syncResendCooldown(){clearInterval(resendCooldownTimer);const update=()=>{const seconds=api.getSignupEmailCooldownSeconds?.()||0;resendButton.disabled=seconds>0;resendButton.textContent=seconds?'Отправить письмо повторно через '+seconds+' с':'Отправить письмо повторно';if(!seconds)clearInterval(resendCooldownTimer);};update();if(resendButton.disabled)resendCooldownTimer=setInterval(update,1000);}
  usernameLabel.hidden=true;
  form.append(usernameLabel,username,emailLabel,email,passwordLabel,password,submit,toggle,resendButton);card.append(error,form);gate.append(card);document.body.append(gate);
  let registering=false;
  toggle.onclick=()=>{registering=!registering;username.hidden=!registering;username.required=registering;usernameLabel.hidden=!registering;password.autocomplete=registering?'new-password':'current-password';submit.textContent=registering?'Зарегистрироваться':'Войти';toggle.textContent=registering?'Уже есть аккаунт? Войти':'Создать аккаунт';error.textContent='';};
  resendButton.onclick=async()=>{resendButton.disabled=true;try{if(typeof api?.resendSignupConfirmation!=='function')throw new Error('Модуль Supabase не загрузился. Обнови страницу и повтори попытку.');await api.resendSignupConfirmation(email.value);error.textContent='Если аккаунт с таким email ожидает подтверждения, письмо отправлено.';}catch(exception){error.textContent=message(exception);}finally{syncResendCooldown();}};
  form.onsubmit=async event=>{event.preventDefault();authCheckActive=false;submit.disabled=true;error.textContent='';try{const authMethod=registering?api?.signUp:api?.signIn;if(typeof authMethod!=='function')throw new Error('Модуль авторизации Supabase не загрузился. Обнови страницу; если ошибка повторится, проверь подключение js/supabaseClient.js.');const result=registering?await authMethod(email.value,password.value,username.value):await authMethod(email.value,password.value);if(registering&&!result.session){toggle.click();error.textContent='Аккаунт создан. Подтверди email по ссылке из письма, затем войди.';resendButton.hidden=false;syncResendCooldown();return;}location.reload();}catch(exception){error.textContent=message(exception);if(['over_email_send_rate_limit','email_not_confirmed'].includes(exception?.code)){resendButton.hidden=false;syncResendCooldown();}}finally{submit.disabled=false;}};
 }
 function openReviewDialog(){
  let dialog=document.getElementById('review-dialog');if(dialog){dialog.showModal();return;}
  dialog=el('dialog',{id:'review-dialog',class:'review-dialog'});const form=el('form',{id:'review-form'});form.append(el('span',{class:'eyebrow'},'Твоё мнение важно'),el('h2',{},'Оставить отзыв'));
  const label=el('label',{for:'review-message'},'Отзыв'),textarea=el('textarea',{id:'review-message',maxlength:'2000',minlength:'3',required:''});textarea.placeholder='Что понравилось или что стоит улучшить?';
  const status=el('p',{role:'status',class:'review-status'}),submit=el('button',{type:'submit',class:'primary'},'Отправить отзыв'),cancel=el('button',{type:'button'},'Отмена'),actions=el('div',{class:'actions'});cancel.onclick=()=>dialog.close();actions.append(submit,cancel);form.append(label,textarea,status,actions);dialog.append(form);document.body.append(dialog);
  form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;status.textContent='';try{await api.sendReview(textarea.value);status.textContent='Спасибо! Отзыв сохранён.';textarea.value='';setTimeout(()=>dialog.close(),900);}catch(error){status.textContent=message(error);}finally{submit.disabled=false;}};dialog.showModal();
 }
 let friendsRenderer=null,friendActivityTimer=0,lastSeenTimer=0;
 async function openFriendsDialog(){
  let dialog=document.getElementById('friends-dialog');
  if(dialog){dialog.showModal();await friendsRenderer?.();startFriendActivityRefresh();return;}
  dialog=el('dialog',{id:'friends-dialog',class:'friends-dialog'});
  const wrap=el('section',{class:'friends-panel'});
  wrap.append(el('span',{class:'eyebrow'},'Социальная игра'),el('h2',{},'Друзья'));
  const status=el('p',{class:'friends-status',role:'status'});
  const searchSection=el('section',{class:'friends-section'});
  searchSection.append(el('h3',{},'Поиск игроков'));
  const label=el('label',{for:'friends-search'},'Найти по никнейму');
  const input=el('input',{id:'friends-search',type:'search',maxlength:'32',autocomplete:'off',placeholder:'Введите никнейм'});
  const results=el('div',{class:'friends-results'});searchSection.append(label,input,results);
  const incoming=el('section',{class:'friends-section'}),outgoing=el('section',{class:'friends-section'}),list=el('section',{class:'friends-section'}),onlineHistory=el('section',{class:'friends-section'});
  const close=el('button',{type:'button',class:'friends-close'},'Закрыть');close.onclick=()=>dialog.close();
  wrap.append(status,searchSection,incoming,outgoing,list,onlineHistory,close);dialog.append(wrap);document.body.append(dialog);
  const friendError=e=>{
   if(e?.code==='PGRST202')return 'Функция друзей отсутствует в Supabase. Выполните supabase/friends.sql и supabase/friends_activity.sql в SQL Editor.';
   if(e?.code==='42501')return 'Supabase отклонил запрос по правилам доступа. Проверьте применение миграций друзей.';
   const raw=String(e?.message||'');
   if(raw.includes('Friend request already exists'))return 'Заявка уже отправлена или вы уже друзья.';
   if(raw.includes('Friend request unavailable'))return 'Эта заявка уже обработана. Обновите список.';
   if(raw==='Failed to fetch')return 'Нет соединения с Supabase. Проверьте интернет; после подключения данные обновятся.';
   return raw||'Не удалось выполнить действие. Повторите попытку.';
  };
  const minuteWord=n=>n===1?'минуту':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'минуты':'минут';
  const hourWord=n=>n===1?'час':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'часа':'часов';
  const dayWord=n=>n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'дня':'дней';
  function lastSeenLabel(value){if(!value)return 'Активность неизвестна';const elapsed=Math.max(0,Date.now()-new Date(value).getTime());if(!Number.isFinite(elapsed))return 'Активность неизвестна';if(elapsed<60_000)return 'Был только что';const minutes=Math.floor(elapsed/60_000);if(minutes<60)return 'Был '+minutes+' '+minuteWord(minutes)+' назад';const hours=Math.floor(minutes/60);if(hours<24)return 'Был '+hours+' '+hourWord(hours)+' назад';const days=Math.floor(hours/24);return days===1?'Был вчера':'Был '+days+' '+dayWord(days)+' назад';}
  function setSearchStatusHint(){const hint=el('p',{class:'friends-search-hint friends-setup-hint'},'Чтобы видеть состояние заявки, примените supabase/friends_activity.sql в Supabase.');results.append(hint);}
  let searchTimer=0,searchSequence=0;
  async function showSearchResults(query,sequence){
   results.replaceChildren();if(query.length<2){if(query)results.append(el('p',{class:'friends-search-hint'},'Введите ещё хотя бы один символ для поиска.'));return;}
   results.append(el('p',{class:'friends-search-hint'},'Ищем «'+query+'»…'));
   try{
    const people=await api.searchUsers(query);if(sequence!==searchSequence)return;
    if(!people.length){results.replaceChildren(el('p',{class:'friends-search-hint'},'Игрок «'+query+'» не найден.'));return;}
    const states=await Promise.all(people.map(async person=>{try{return await api.friendshipStatus(person.user_id);}catch(error){return null;}}));
    if(sequence!==searchSequence)return;
    results.replaceChildren(el('p',{class:'friends-search-hint'},'Найденные игроки:'));
    people.forEach((person,index)=>{
     const relation=states[index],row=el('div',{class:'friend-row friend-search-result'});
     row.append(el('strong',{class:'friend-result-name'},person.username||'Игрок'));
     let label='+ Добавить в друзья',mode='add',disabled=false;
     if(relation?.status==='accepted'){label='В друзьях';disabled=true;}
     else if(relation?.status==='pending'&&relation.sent_by_me){label='Отменить заявку';mode='cancel';}
     else if(relation?.status==='pending'){label='Принять заявку';mode='accept';}
     const action=el('button',{type:'button',class:'compact friend-add-button'},label);action.disabled=disabled;
     if(!disabled)action.onclick=async()=>{action.disabled=true;try{
      if(mode==='cancel')await api.cancelFriendRequest(relation.friendship_id);
      else if(mode==='accept')await api.friendRespond(relation.friendship_id,true);
      else await api.friendRequest(person.user_id);
      status.textContent=mode==='add'?'Заявка отправлена.':mode==='cancel'?'Исходящая заявка отменена.':'Заявка принята. Теперь вы друзья.';
      const current=++searchSequence;await friendsRenderer();await showSearchResults(input.value.trim(),current);
     }catch(error){action.disabled=false;status.textContent=friendError(error);if(String(error?.message||'').includes('already exists')){const current=++searchSequence;await showSearchResults(input.value.trim(),current);}}
     };
     row.append(action);results.append(row);
    });
    if(states.some((value,index)=>!value&&people[index].user_id))setSearchStatusHint();
   }catch(error){if(sequence!==searchSequence)return;results.replaceChildren(el('p',{class:'friends-search-hint'},friendError(error)));}
  }
  input.oninput=()=>{clearTimeout(searchTimer);const query=input.value.trim(),sequence=++searchSequence;results.replaceChildren();if(query.length<2){if(query)results.append(el('p',{class:'friends-search-hint'},'Введите ещё хотя бы один символ для поиска.'));return;}results.append(el('p',{class:'friends-search-hint'},'Ищем «'+query+'»…'));searchTimer=setTimeout(()=>showSearchResults(query,sequence),250);};
  friendsRenderer=async function(){
   try{
    const [incomingRows,outgoingRows,friendRows]=await Promise.all([api.friendRequests(),api.outgoingFriendRequests(),api.friendActivity()]);
    incoming.replaceChildren(el('h3',{},'Входящие заявки'+(incomingRows.length?' ('+incomingRows.length+')':'')));
    if(!incomingRows.length)incoming.append(el('p',{class:'small'},'Новых заявок нет.'));
    for(const request of incomingRows){const row=el('div',{class:'friend-row'});row.append(el('strong',{class:'friend-result-name'},request.username));
     for(const [accept,title] of [[true,'Принять'],[false,'Отклонить']]){const button=el('button',{type:'button',class:accept?'primary compact':'compact'},title);button.onclick=async()=>{button.disabled=true;try{await api.friendRespond(request.request_id,accept);status.textContent=accept?'Заявка принята.':'Заявка отклонена.';await friendsRenderer();if(input.value.trim().length>=2){const seq=++searchSequence;await showSearchResults(input.value.trim(),seq);}}catch(error){status.textContent=friendError(error);button.disabled=false;}};row.append(button);}incoming.append(row);
    }
    outgoing.replaceChildren(el('h3',{},'Исходящие заявки'+(outgoingRows.length?' ('+outgoingRows.length+')':'')));
    if(!outgoingRows.length)outgoing.append(el('p',{class:'small'},'Нет ожидающих заявок.'));
    for(const request of outgoingRows){const row=el('div',{class:'friend-row'});row.append(el('strong',{class:'friend-result-name'},request.username),el('span',{class:'friend-request-state'},'Ожидает подтверждения'));const cancel=el('button',{type:'button',class:'compact'},'Отменить');cancel.onclick=async()=>{cancel.disabled=true;try{await api.cancelFriendRequest(request.request_id);status.textContent='Исходящая заявка отменена.';await friendsRenderer();if(input.value.trim().length>=2){const seq=++searchSequence;await showSearchResults(input.value.trim(),seq);}}catch(error){status.textContent=friendError(error);cancel.disabled=false;}};row.append(cancel);outgoing.append(row);}
    list.replaceChildren(el('h3',{},'Мои друзья'));
    if(!friendRows.length)list.append(el('p',{class:'small'},'Пока никого нет.'));
    for(const friend of friendRows){const row=el('div',{class:'friend-row'});row.append(el('strong',{class:'friend-result-name friend-name'},friend.username));const presence=el('span',{class:'friend-presence','data-user-id':friend.user_id},lastSeenLabel(friend.last_seen_at));row.append(presence);const play=el('button',{type:'button',class:'compact primary'},'Играть');play.onclick=()=>openDuelInvite(friend);row.append(play);const remove=el('button',{type:'button',class:'compact'},'Удалить');remove.onclick=async()=>{remove.disabled=true;try{await api.friendRemove(friend.user_id);status.textContent='Друг удалён из списка.';await friendsRenderer();if(input.value.trim().length>=2){const seq=++searchSequence;await showSearchResults(input.value.trim(),seq);}}catch(error){status.textContent=friendError(error);remove.disabled=false;}};row.append(remove);list.append(row);}
    await renderOnlineHistory(onlineHistory);
    refreshPresence(friendRows);
   }catch(error){status.textContent=friendError(error);}
  };
  dialog.addEventListener('close',()=>{clearInterval(friendActivityTimer);friendActivityTimer=0;presenceChannels.forEach(channel=>api.client.removeChannel(channel));presenceChannels=[];});
  dialog.showModal();await friendsRenderer();startFriendActivityRefresh();
  function startFriendActivityRefresh(){clearInterval(friendActivityTimer);friendActivityTimer=setInterval(()=>{if(dialog.open)friendsRenderer();},60_000);}
 }
 let presenceChannels=[];
 let onlineInviteChannel=null,onlineInviteDialog=null,onlineInviteHandled=new Set();
 function openDuelInvite(friend){
  let dialog=document.getElementById('duel-invite-dialog');if(dialog)dialog.remove();dialog=el('dialog',{id:'duel-invite-dialog',class:'friends-dialog'});const panel=el('section',{class:'friends-panel'});panel.append(el('span',{class:'eyebrow'},'Онлайн-дуэль'),el('h2',{},'Вызов: '+friend.username));
  const form=el('form',{method:'dialog'}),modeLabel=el('label',{},'Режим'),mode=el('select',{});mode.append(new Option('Классические шахматы','classic'));const timeLabel=el('label',{},'Время каждому'),time=el('select',{});[['0','Без ограничения'],['180','3 минуты'],['300','5 минут'],['600','10 минут'],['custom','Своё время']].forEach(([value,label])=>time.append(new Option(label,value)));const custom=el('input',{type:'number',min:'1',max:'10800',step:'1',value:'300',inputmode:'numeric','aria-label':'Время в секундах'});custom.hidden=true;time.onchange=()=>custom.hidden=time.value!=='custom';const colorLabel=el('label',{},'Твои фигуры'),color=el('select',{});[['random','Случайно'],['white','Белые'],['black','Чёрные']].forEach(([value,label])=>color.append(new Option(label,value)));const hint=el('p',{class:'friends-status',role:'status'}),send=el('button',{type:'button',class:'primary'},'Отправить приглашение'),cancel=el('button',{type:'button'},'Закрыть');modeLabel.append(mode);timeLabel.append(time,custom);colorLabel.append(color);send.onclick=async()=>{send.disabled=true;try{const seconds=time.value==='custom'?Number(custom.value):Number(time.value);if(!Number.isInteger(seconds)||seconds<0||seconds>10800||(time.value==='custom'&&seconds<1))throw new Error('Время должно быть от 1 секунды до 3 часов.');await api.createOnlineInvite(friend.user_id,{mode:mode.value,seconds,color:color.value});hint.textContent='Приглашение отправлено. Ждём ответ соперника.';send.hidden=true;}catch(error){hint.textContent=message(error);send.disabled=false;}};cancel.onclick=()=>dialog.close();form.append(modeLabel,timeLabel,colorLabel,hint,send,cancel);panel.append(form);dialog.append(panel);document.body.append(dialog);dialog.showModal();
 }
 async function renderOnlineHistory(section){
  try{const rows=await api.onlineMatches();section.replaceChildren(el('h3',{},'История онлайн-партий'));if(!rows.length){section.append(el('p',{class:'small'},'Онлайн-партий пока нет.'));return;}for(const match of rows.slice(0,20)){const name=match.white_player===profile.id?match.black_username:match.white_username;const row=el('div',{class:'friend-row online-history-row'});const result=match.status==='active'?'Партия продолжается':match.result==='draw'?'Ничья':(match.result==='white_win'&&match.white_player===profile.id)||(match.result==='black_win'&&match.black_player===profile.id)?'Победа':'Поражение';row.append(el('strong',{class:'friend-result-name friend-name'},(name||'Друг')+' · '+result),el('span',{class:'small'},new Date(match.created_at).toLocaleDateString('ru-RU')));if(match.status==='active'){const resume=el('a',{class:'button compact',href:'game.html?online='+encodeURIComponent(match.id)},'Продолжить');row.append(resume);}section.append(row);}}catch(error){section.replaceChildren(el('h3',{},'История онлайн-партий'),el('p',{class:'small'},message(error)));}
 }
 function showIncomingOnlineInvite(invite){
  if(onlineInviteHandled.has(invite.invite_id))return;onlineInviteHandled.add(invite.invite_id);onlineInviteDialog?.remove();const dialog=el('dialog',{class:'friends-dialog online-invite-dialog'}),panel=el('section',{class:'friends-panel'});panel.append(el('span',{class:'eyebrow'},'Вызов на дуэль'),el('h2',{},invite.sender_name+' приглашает сыграть'),el('p',{class:'small'},'Классические шахматы · '+(Number(invite.settings?.seconds)?Math.floor(Number(invite.settings.seconds)/60)+' мин':'без ограничения времени')));const status=el('p',{class:'friends-status',role:'status'}),accept=el('button',{type:'button',class:'primary'},'Принять'),reject=el('button',{type:'button'},'Отклонить');accept.onclick=async()=>{accept.disabled=reject.disabled=true;try{const matchId=await api.respondOnlineInvite(invite.invite_id,true);if(!matchId)throw new Error('Не удалось создать партию.');location.href='game.html?online='+encodeURIComponent(matchId);}catch(error){status.textContent=message(error);accept.disabled=reject.disabled=false;}};reject.onclick=async()=>{accept.disabled=reject.disabled=true;try{await api.respondOnlineInvite(invite.invite_id,false);dialog.close();refreshOnlineInvites();}catch(error){status.textContent=message(error);accept.disabled=reject.disabled=false;}};panel.append(status,accept,reject);dialog.append(panel);document.body.append(dialog);dialog.showModal();onlineInviteDialog=dialog;
 }
 async function refreshOnlineInvites(){try{const rows=await api.onlineInvites(),pending=rows.filter(row=>row.recipient_id===profile.id&&row.status==='pending');if(!onlineInviteDialog?.open&&pending.length){const next=pending.find(row=>!onlineInviteHandled.has(row.invite_id))||pending[0];showIncomingOnlineInvite(next);}const resume=rows.filter(row=>row.sender_id===profile.id&&row.status==='accepted'&&row.match_status==='active'&&row.match_id).sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at))[0];const isGamePage=/\/game\.html$/i.test(location.pathname);if(isGamePage&&resume&&new URLSearchParams(location.search).get('online')!==resume.match_id)location.href='game.html?online='+encodeURIComponent(resume.match_id);}catch(error){console.warn('Не удалось загрузить вызовы на дуэль:',error);}}
 function startOnlineNotifications(){if(onlineInviteChannel||!api?.client||!profile?.id)return;onlineInviteChannel=api.client.channel('online-invites:'+profile.id);onlineInviteChannel.on('postgres_changes',{event:'*',schema:'public',table:'online_invites',filter:'recipient=eq.'+profile.id},payload=>{if(payload.new?.status==='pending')refreshOnlineInvites();});onlineInviteChannel.on('postgres_changes',{event:'UPDATE',schema:'public',table:'online_invites',filter:'sender=eq.'+profile.id},payload=>{if(payload.new?.status==='accepted'&&payload.new?.match_id)location.href='game.html?online='+encodeURIComponent(payload.new.match_id);else if(payload.new?.status==='rejected'){showFriendToast('Приглашение на дуэль отклонено.');refreshOnlineInvites();}});onlineInviteChannel.subscribe(state=>{if(state==='SUBSCRIBED')refreshOnlineInvites();});refreshOnlineInvites();}
 function refreshPresence(friends){
  presenceChannels.forEach(channel=>api.client.removeChannel(channel));presenceChannels=[];
  for(const friend of friends){const node=document.querySelector('.friend-presence[data-user-id="'+friend.user_id+'"]');if(!node)continue;
   const channel=api.client.channel('user:'+friend.user_id,{config:{private:true,presence:{key:friend.user_id}}});
   const sync=()=>{const online=Object.keys(channel.presenceState()).length>0;node.textContent=online?'В сети':lastSeenLabel(friend.last_seen_at);node.classList.toggle('is-online',online);node.classList.toggle('is-offline',!online);};
   channel.on('presence',{event:'sync'},sync);channel.on('presence',{event:'join'},sync);channel.on('presence',{event:'leave'},sync);
   channel.subscribe(state=>{if(state==='SUBSCRIBED')sync();else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'){node.textContent=lastSeenLabel(friend.last_seen_at);node.classList.remove('is-online');node.classList.add('is-offline');}});presenceChannels.push(channel);
  }
 } function startOwnPresence(){const id=profile?.id;if(!id||window.__monoPresenceStarted)return;window.__monoPresenceStarted=true;const channel=api.client.channel('user:'+id,{config:{private:true,presence:{key:id}}});channel.subscribe(async state=>{if(state==='SUBSCRIBED')await channel.track({online:true,at:new Date().toISOString()});});}
 function startLastSeenHeartbeat(){if(lastSeenTimer)return;const touch=()=>api.touchLastSeen().catch(error=>console.warn('Не удалось обновить время активности:',error));touch();lastSeenTimer=setInterval(touch,60_000);if(!window.__monoLastSeenPagehide){window.__monoLastSeenPagehide=true;window.addEventListener('pagehide',()=>{api.touchLastSeen().catch(()=>{});});}}
 let friendNotifyChannel=null,friendOutgoingNotifyChannel=null;
 async function refreshFriendBadge(){try{const pending=await api.friendRequests(),button=document.querySelector('#account-controls [data-friends-button]');if(button)button.textContent=pending.length?'Друзья · '+pending.length:'Друзья';}catch(error){}}
 function showFriendToast(text){let toast=document.getElementById('friend-toast');if(!toast){toast=el('div',{id:'friend-toast',role:'status'});document.body.append(toast);}toast.textContent=text;toast.classList.add('friend-toast-visible');setTimeout(()=>toast.classList.remove('friend-toast-visible'),4500);}
 function refreshOpenFriends(){const dialog=document.getElementById('friends-dialog');if(dialog?.open&&friendsRenderer)friendsRenderer();}
 function startFriendNotifications(){if(friendNotifyChannel)return;const handleIncoming=async payload=>{await refreshFriendBadge();refreshOpenFriends();if(payload.eventType==='INSERT'&&payload.new?.status==='pending')showFriendToast('Новая заявка в друзья');};const handleOutgoing=async payload=>{refreshOpenFriends();if(payload.eventType==='UPDATE'&&payload.new?.status==='accepted')showFriendToast('Заявка принята — вы теперь друзья');else if(payload.eventType==='UPDATE'&&payload.new?.status==='rejected')showFriendToast('Заявка отклонена');};friendNotifyChannel=api.client.channel('friend-notifications-in:'+profile.id);friendNotifyChannel.on('postgres_changes',{event:'*',schema:'public',table:'friendships',filter:'recipient=eq.'+profile.id},handleIncoming).subscribe();friendOutgoingNotifyChannel=api.client.channel('friend-notifications-out:'+profile.id);friendOutgoingNotifyChannel.on('postgres_changes',{event:'*',schema:'public',table:'friendships',filter:'requester=eq.'+profile.id},handleOutgoing).subscribe();refreshFriendBadge();}function addAccountControls(){const header=document.querySelector('header');if(!header||document.getElementById('account-controls'))return;const controls=el('div',{id:'account-controls',class:'account-controls'});controls.append(el('span',{class:'account-name'},profile.username),el('span',{class:'account-xp'},'XP '+profile.xp));const friends=el('button',{type:'button','data-friends-button':''},'Друзья'),review=el('button',{type:'button'},'Оставить отзыв'),signOut=el('button',{type:'button'},'Выйти');friends.onclick=openFriendsDialog;review.onclick=openReviewDialog;controls.append(friends);signOut.onclick=async()=>{signOut.disabled=true;try{await api.signOut();location.reload();}catch(error){signOut.disabled=false;alert(message(error));}};controls.append(review,signOut);if(['admin','super_admin'].includes(profile.role))controls.append(el('a',{class:'button compact',href:'admin.html'},'Админ-панель'));header.append(controls);}
 document.addEventListener('supabase-profile-updated',event=>{profile=event.detail.profile;const name=document.querySelector('.account-name'),xp=document.querySelector('.account-xp');if(name)name.textContent=profile.username;if(xp)xp.textContent='XP '+profile.xp;});
 async function loadProfile(user){
  const selectedTheme=authThemeChoice();if(selectedTheme)try{localStorage.setItem('chess-theme',selectedTheme);}catch(error){}
  const activeId=localStorage.getItem('chess-active-profile-id');
  if(activeId&&activeId!==user.id){for(const key of accountKeys){if(key==='chess-theme'&&selectedTheme)continue;try{localStorage.removeItem(key);}catch(error){}}localStorage.setItem('chess-active-profile-id',user.id);location.reload();return false;}
  if(!activeId){for(const key of ['chess-active-game-v1','chess-openings-v1']){const scoped=localStorage.getItem(key+':'+user.id);if(scoped&&!localStorage.getItem(key))localStorage.setItem(key,scoped);}localStorage.setItem('chess-active-profile-id',user.id);}
  profile=await api.profileFor(user.id);if(!profile||profile.id!==user.id)throw new Error('Профиль не найден. Проверь SQL-схему и триггер создания профиля.');
  const accountData=user.user_metadata?.chess_app_data;if(accountData&&typeof accountData==='object')applyAccountData(accountData);else scheduleAccountDataSync();
  const home=/\/(?:index\.html)?$/.test(location.pathname);if(window.App?.hydrateCloudProgress&&window.App.hydrateCloudProgress(profile)&&home){location.reload();return false;}
  ready=true;if(selectedTheme||!accountData||typeof accountData!=='object')scheduleAccountDataSync();addAccountControls();startOwnPresence();startLastSeenHeartbeat();startFriendNotifications();startOnlineNotifications();window.dispatchEvent(new CustomEvent('supabase-profile-loaded',{detail:{profile}}));const gate=document.getElementById('auth-gate');if(gate)gate.hidden=true;document.documentElement.classList.remove('auth-pending');if(location.pathname.endsWith('/admin.html'))window.dispatchEvent(new CustomEvent('supabase-admin-ready',{detail:{profile}}));scheduleProgressSync();return true;
 }
 function scheduleProgressSync(){if(!ready||!window.App?.getProgressSnapshot)return;clearTimeout(syncTimer);syncTimer=setTimeout(async()=>{try{await api.saveProgress(window.App.getProgressSnapshot());}catch(error){console.error('Не удалось сохранить прогресс в Supabase:',error);document.dispatchEvent(new CustomEvent('cloud-sync-error',{detail:{message:message(error)}}));}},250);}
 async function start(){if(!api){showGate('Не загрузился js/supabaseClient.js. Обнови страницу; если ошибка повторится, проверь порядок скриптов в HTML.');return;}if(!api.configured||!api.client){showGate('Не удалось запустить Supabase. Проверь Project URL, Publishable key и загрузку CDN-библиотеки.');return;}try{const user=await api.getCurrentUser();if(!authCheckActive)return;if(!user){showGate();return;}document.documentElement.classList.remove('auth-pending');await loadProfile(user);}catch(error){if(authCheckActive)showGate(message(error));}}
 document.addEventListener('app-progress-change',scheduleProgressSync);for(const eventName of ['piece-appearance-change','board-appearance-change','board-view-change','stockfish-skill-change','app-account-data-change'])document.addEventListener(eventName,scheduleAccountDataSync);document.addEventListener('DOMContentLoaded',start,{once:true});
 api?.client?.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){ready=false;clearInterval(lastSeenTimer);lastSeenTimer=0;clearInterval(friendActivityTimer);friendActivityTimer=0;showGate();}});
 window.SupabaseAuth={get profile(){return profile;},get ready(){return ready;}};
})();
