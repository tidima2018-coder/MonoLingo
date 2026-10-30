'use strict';
(() => {
 const params=new URLSearchParams(location.search),tokenHash=params.get('token_hash'),type=params.get('type');
 const button=document.getElementById('confirm-button'),login=document.getElementById('login-button'),status=document.getElementById('confirm-status'),message=document.getElementById('confirm-message'),retry=document.getElementById('confirm-retry'),resendForm=document.getElementById('resend-form');
 let resendCooldownTimer=0;
 function showResend(){button.hidden=true;retry.hidden=false;resendForm.hidden=false;}
 function syncResendCooldown(submit){clearInterval(resendCooldownTimer);const update=()=>{const seconds=window.SupabaseApp.getSignupEmailCooldownSeconds?.()||0;submit.disabled=seconds>0;submit.textContent=seconds?'Отправить письмо повторно через '+seconds+' с':'Отправить новое письмо';if(!seconds)clearInterval(resendCooldownTimer);};update();if(submit.disabled)resendCooldownTimer=setInterval(update,1000);}
 if(!tokenHash||type!=='email'){
  showResend();status.classList.add('confirm-error');status.textContent='В ссылке нет действительного кода подтверждения.';
 }
 button.addEventListener('click',async()=>{
  button.disabled=true;status.classList.remove('confirm-error');status.textContent='Подтверждаю email…';
  try{
   if(typeof window.SupabaseApp?.verifyEmailToken!=='function')throw new Error('Клиент Supabase не загрузился. Обнови страницу и повтори попытку.');await window.SupabaseApp.verifyEmailToken(tokenHash,type);
   history.replaceState({},document.title,location.pathname);
   button.hidden=true;retry.hidden=true;resendForm.hidden=true;login.hidden=false;
   message.textContent='Твой email подтверждён. Аккаунт активирован.';
   status.textContent='Теперь можно войти в MonoLingo.';
  }catch(error){
   showResend();status.classList.add('confirm-error');
   status.textContent='Не удалось подтвердить email: ссылка недействительна или срок её действия истёк.';
   console.warn('Email confirmation failed:',error?.message||error);
  }
 });
 resendForm.addEventListener('submit',async event=>{
  event.preventDefault();const submit=resendForm.querySelector('button');submit.disabled=true;status.classList.remove('confirm-error');status.textContent='Отправляю письмо…';
  try{if(typeof window.SupabaseApp?.resendSignupConfirmation!=='function')throw new Error('Клиент Supabase не загрузился. Обнови страницу и повтори попытку.');await window.SupabaseApp.resendSignupConfirmation(document.getElementById('resend-email').value);status.textContent='Если для этого адреса ожидает подтверждения аккаунт, новое письмо отправлено.';}
  catch(error){status.classList.add('confirm-error');status.textContent=error?.message||'Не удалось отправить письмо. Попробуй позже.';}
  finally{syncResendCooldown(submit);}
 });
})();
