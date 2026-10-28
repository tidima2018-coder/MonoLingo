'use strict';
document.documentElement.classList.add('auth-pending');
(() => {
 const api=window.SupabaseApp;
 let profile=null,ready=false,syncTimer=0,authCheckActive=true;
 const el=(tag,attrs={},text='')=>{const node=document.createElement(tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);if(text)node.textContent=text;return node;};
 const message=error=>{
  const raw=String(error?.message||''),code=String(error?.code||'');
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
  themeButton.textContent=document.documentElement.dataset.theme==='aristocrat'?'☀ Обычная тема':'♛ Тема аристократа';
  themeButton.onclick=()=>document.getElementById('theme-toggle')?.click();
  card.append(themeButton);
  card.append(el('span',{class:'eyebrow'},'Ход вперёд'),el('h1',{},'Вход в аккаунт'),el('p',{},'Войди или создай аккаунт, чтобы сохранять прогресс на всех устройствах.'));
  const error=el('p',{class:'auth-error',role:'alert'});error.textContent=errorText;
  const form=el('form',{id:'auth-form'}),usernameLabel=el('label',{for:'auth-username'},'Никнейм'),username=el('input',{id:'auth-username',name:'username',autocomplete:'nickname',maxlength:'32',required:'',hidden:'','aria-label':'Никнейм'}),emailLabel=el('label',{for:'auth-email'},'Email'),email=el('input',{id:'auth-email',name:'email',type:'email',autocomplete:'email',required:''}),passwordLabel=el('label',{for:'auth-password'},'Пароль'),password=el('input',{id:'auth-password',name:'password',type:'password',autocomplete:'current-password',minlength:'8',required:''}),submit=el('button',{class:'primary',type:'submit'},'Войти'),toggle=el('button',{class:'auth-mode-toggle',type:'button'},'Создать аккаунт');
  usernameLabel.hidden=true;
  form.append(usernameLabel,username,emailLabel,email,passwordLabel,password,submit,toggle);card.append(error,form);gate.append(card);document.body.append(gate);
  let registering=false;
  toggle.onclick=()=>{registering=!registering;username.hidden=!registering;username.required=registering;usernameLabel.hidden=!registering;password.autocomplete=registering?'new-password':'current-password';submit.textContent=registering?'Зарегистрироваться':'Войти';toggle.textContent=registering?'Уже есть аккаунт? Войти':'Создать аккаунт';error.textContent='';};
  form.onsubmit=async event=>{event.preventDefault();authCheckActive=false;submit.disabled=true;error.textContent='';try{const result=registering?await api.signUp(email.value,password.value,username.value):await api.signIn(email.value,password.value);if(registering&&!result.session){error.textContent='Аккаунт создан. Подтверди email по ссылке из письма, затем войди.';toggle.click();return;}location.reload();}catch(exception){error.textContent=message(exception);}finally{submit.disabled=false;}};
 }
 function openReviewDialog(){
  let dialog=document.getElementById('review-dialog');if(dialog){dialog.showModal();return;}
  dialog=el('dialog',{id:'review-dialog',class:'review-dialog'});const form=el('form',{id:'review-form'});form.append(el('span',{class:'eyebrow'},'Твоё мнение важно'),el('h2',{},'Оставить отзыв'));
  const label=el('label',{for:'review-message'},'Отзыв'),textarea=el('textarea',{id:'review-message',maxlength:'2000',minlength:'3',required:''});textarea.placeholder='Что понравилось или что стоит улучшить?';
  const status=el('p',{role:'status',class:'review-status'}),submit=el('button',{type:'submit',class:'primary'},'Отправить отзыв'),cancel=el('button',{type:'button'},'Отмена'),actions=el('div',{class:'actions'});cancel.onclick=()=>dialog.close();actions.append(submit,cancel);form.append(label,textarea,status,actions);dialog.append(form);document.body.append(dialog);
  form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;status.textContent='';try{await api.sendReview(textarea.value);status.textContent='Спасибо! Отзыв сохранён.';textarea.value='';setTimeout(()=>dialog.close(),900);}catch(error){status.textContent=message(error);}finally{submit.disabled=false;}};dialog.showModal();
 }
 function addAccountControls(){const header=document.querySelector('header');if(!header||document.getElementById('account-controls'))return;const controls=el('div',{id:'account-controls',class:'account-controls'});controls.append(el('span',{class:'account-name'},profile.username),el('span',{class:'account-xp'},'XP '+profile.xp));const review=el('button',{type:'button'},'Оставить отзыв'),signOut=el('button',{type:'button'},'Выйти');review.onclick=openReviewDialog;signOut.onclick=async()=>{signOut.disabled=true;try{await api.signOut();location.reload();}catch(error){signOut.disabled=false;alert(message(error));}};controls.append(review,signOut);controls.append(el('a',{class:'button compact',href:'admin.html'},'Админ-панель'));header.append(controls);}
 document.addEventListener('supabase-profile-updated',event=>{profile=event.detail.profile;const name=document.querySelector('.account-name'),xp=document.querySelector('.account-xp');if(name)name.textContent=profile.username;if(xp)xp.textContent='XP '+profile.xp;});
 async function loadProfile(user){
  const activeId=localStorage.getItem('chess-active-profile-id');
  if(activeId&&activeId!==user.id){localStorage.setItem('chess-active-profile-id',user.id);location.reload();return false;}
  if(!activeId){for(const key of ['chess-active-game-v1','chess-openings-v1']){const legacy=localStorage.getItem(key);if(legacy&&!localStorage.getItem(key+':'+user.id))localStorage.setItem(key+':'+user.id,legacy);if(legacy)localStorage.removeItem(key);}localStorage.setItem('chess-active-profile-id',user.id);}
  profile=await api.profileFor(user.id);if(!profile||profile.id!==user.id)throw new Error('Профиль не найден. Проверь SQL-схему и триггер создания профиля.');
  const home=/\/(?:index\.html)?$/.test(location.pathname);if(window.App?.hydrateCloudProgress&&window.App.hydrateCloudProgress(profile)&&home){location.reload();return false;}
  ready=true;addAccountControls();window.dispatchEvent(new CustomEvent('supabase-profile-loaded',{detail:{profile}}));document.documentElement.classList.remove('auth-pending');if(location.pathname.endsWith('/admin.html'))window.dispatchEvent(new CustomEvent('supabase-admin-ready',{detail:{profile}}));scheduleProgressSync();return true;
 }
 function scheduleProgressSync(){if(!ready||!window.App?.getProgressSnapshot)return;clearTimeout(syncTimer);syncTimer=setTimeout(async()=>{try{await api.saveProgress(window.App.getProgressSnapshot());}catch(error){console.error('Не удалось сохранить прогресс в Supabase:',error);document.dispatchEvent(new CustomEvent('cloud-sync-error',{detail:{message:message(error)}}));}},250);}
 async function start(){if(!api?.configured||!api.client){showGate('Подключи Supabase: заполни Project URL и Publishable key в js/supabaseClient.js.');return;}showGate();try{const user=await api.getCurrentUser();if(!authCheckActive)return;if(!user)return;await loadProfile(user);}catch(error){if(authCheckActive)showGate(message(error));}}
 document.addEventListener('app-progress-change',scheduleProgressSync);document.addEventListener('DOMContentLoaded',start,{once:true});
 api?.client?.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){ready=false;showGate();}});
 window.SupabaseAuth={get profile(){return profile;},get ready(){return ready;}};
})();
