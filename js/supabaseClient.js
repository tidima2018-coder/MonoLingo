'use strict';
(() => {
 const SUPABASE_URL='https://hvzqflrngprlgageztzz.supabase.co/rest/v1/  ';
 const SUPABASE_PUBLISHABLE_KEY='sb_publishable_sHmULUjwuPNK49u2XuknJw_eE4WXZMW';
 const configured=!SUPABASE_URL.includes('YOUR_')&&!SUPABASE_PUBLISHABLE_KEY.includes('YOUR_');
 const EMAIL_REQUEST_COOLDOWN_MS=60_000,EMAIL_REQUEST_COOLDOWN_KEY='monolingo-signup-email-last-request';
 let lastEmailRequestAt=0;
 const client=configured&&window.supabase?.createClient?window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY):null;
 function requireClient(){if(!client)throw new Error('Укажи Project URL и Publishable key в js/supabaseClient.js.');return client;}
 async function profileFor(userId){
  const sb=requireClient();
  const {data:{session},error:authError}=await sb.auth.getSession();
  if(authError)throw authError;
  const user=session?.user;
  if(!user||user.id!==userId)throw new Error('Нет доступа к этому профилю.');
  const {data:existing,error}=await sb.from('profiles').select('*').eq('id',user.id).maybeSingle();
  if(error)throw error;
  if(existing)return existing;
  const username=String(user.user_metadata?.username||'Игрок').trim().slice(0,32)||'Игрок';
  const {data:created,error:createError}=await sb.from('profiles').insert({id:user.id,username,email:user.email||''}).select('*').maybeSingle();
  if(!createError&&created)return created;
  if(createError?.code==='23505'){
   const {data:raceWinner,error:retryError}=await sb.from('profiles').select('*').eq('id',user.id).maybeSingle();
   if(!retryError&&raceWinner)return raceWinner;
  }
  if(createError)throw createError;
  throw new Error('Не удалось создать профиль. Проверь SQL-права profiles в Supabase.');
 }
 async function refreshProfile(){const user=await getCurrentUser();if(!user)return null;const profile=await profileFor(user.id);document.dispatchEvent(new CustomEvent('supabase-profile-updated',{detail:{profile}}));return profile;}
 function getSignupEmailCooldownSeconds(){let last=lastEmailRequestAt;try{last=Math.max(last,Number(localStorage.getItem(EMAIL_REQUEST_COOLDOWN_KEY))||0);}catch(error){}return Math.max(0,Math.ceil((EMAIL_REQUEST_COOLDOWN_MS-(Date.now()-last))/1000));}
 function beginSignupEmailRequest(){const remaining=getSignupEmailCooldownSeconds();if(remaining){const error=new Error('Подожди '+remaining+' сек. перед повторной отправкой письма.');error.code='confirmation_resend_cooldown';error.retryAfterSeconds=remaining;throw error;}lastEmailRequestAt=Date.now();try{localStorage.setItem(EMAIL_REQUEST_COOLDOWN_KEY,String(lastEmailRequestAt));}catch(error){}}
 function normalizeEmailSendError(error){const raw=String(error?.message||'').toLowerCase();if(error?.code==='over_email_send_rate_limit'||raw.includes('email rate limit exceeded')){const limited=new Error('Supabase ограничил отправку писем. Повторная попытка доступна после паузы; настрой custom SMTP в Supabase, чтобы отправлять письма пользователям.');limited.code='over_email_send_rate_limit';limited.status=429;return limited;}if(error?.status===429){const limited=new Error('Слишком много запросов к авторизации. Подожди перед следующей попыткой.');limited.code='auth_request_rate_limit';limited.status=429;return limited;}return error;}
 async function signUp(email,password,username){const clean=String(username||'').trim();if(clean.length<1||clean.length>32)throw new Error('Никнейм должен содержать от 1 до 32 символов.');beginSignupEmailRequest();try{const {data,error}=await requireClient().auth.signUp({email:String(email).trim(),password,options:{data:{username:clean}}});if(error)throw error;return data;}catch(error){throw normalizeEmailSendError(error);}}
 async function signIn(email,password){const sb=requireClient(),{data,error}=await sb.auth.signInWithPassword({email:String(email).trim(),password});if(error)throw error;if(!data.user?.email_confirmed_at){await sb.auth.signOut();const unconfirmed=new Error('Email not confirmed');unconfirmed.code='email_not_confirmed';throw unconfirmed;}return data;}
 async function verifyEmailToken(tokenHash,type){if(typeof tokenHash!=='string'||!tokenHash.trim()||type!=='email')throw new Error('Недействительная ссылка подтверждения. Запроси новое письмо.');const {data,error}=await requireClient().auth.verifyOtp({token_hash:tokenHash,type:'email'});if(error)throw error;return data;}
 async function resendSignupConfirmation(email){const clean=String(email||'').trim();if(!clean)throw new Error('Укажи email для отправки письма.');beginSignupEmailRequest();try{const {data,error}=await requireClient().auth.resend({type:'signup',email:clean});if(error)throw error;return data;}catch(error){throw normalizeEmailSendError(error);}}
 async function signOut(){const {error}=await requireClient().auth.signOut();if(error)throw error;}
 async function getCurrentUser(){const {data,error}=await requireClient().auth.getSession();if(error)throw error;return data.session?.user||null;}
 async function startGame(){const {error}=await requireClient().rpc('record_game_started');if(error)throw error;return refreshProfile();}
 async function updateGameStats(result){if(!['win','loss','draw'].includes(result))throw new Error('Неизвестный результат партии.');const {error}=await requireClient().rpc('record_game_result',{p_result:result});if(error)throw error;await refreshProfile();}
 async function incrementSolvedPuzzles(xpGained,puzzleId){if(!Number.isInteger(xpGained)||xpGained<0||xpGained>100)throw new Error('Некорректное количество XP.');if(typeof puzzleId!=='string'||!puzzleId.trim())throw new Error('Не указан идентификатор задачи.');const {data,error}=await requireClient().rpc('record_puzzle_solved',{p_puzzle_id:puzzleId,p_xp_gained:xpGained});if(error)throw error;await refreshProfile();return data;}
 async function saveProgress(progress){const {error}=await requireClient().rpc('sync_profile_progress',{p_completed_stages:progress.completed,p_daily_dates:progress.dailyDates,p_daily_streak:progress.dailyStreak,p_last_daily_date:progress.lastDailyDate,p_legacy_wins:progress.wins});if(error)throw error;}
 async function saveOpeningProgress(completed){const {error}=await requireClient().rpc('sync_opening_progress',{p_completed_openings:completed});if(error)throw error;}
 async function saveAccountData(value){const {data,error}=await requireClient().auth.updateUser({data:{chess_app_data:value}});if(error)throw error;return data.user;}
 async function sendReview(text){const message=String(text||'').trim();if(message.length<3||message.length>2000)throw new Error('Отзыв должен содержать от 3 до 2000 символов.');const user=await getCurrentUser();if(!user)throw new Error('Войди, чтобы оставить отзыв.');const profile=await profileFor(user.id);const {error}=await requireClient().from('reviews').insert({user_id:user.id,username:profile.username,message});if(error)throw error;}
 async function recordVisit(sessionId,pagePath){if(typeof sessionId!=='string'||!/^[0-9a-f-]{36}$/i.test(sessionId)||typeof pagePath!=='string')return;const {error}=await requireClient().rpc('record_site_visit',{p_session_id:sessionId,p_page_path:pagePath});if(error)throw error;}
 async function getAdminDashboard(){const {data,error}=await requireClient().rpc('admin_dashboard');if(error)throw error;return {users:data?.users||[],reviews:data?.reviews||[],analytics:data?.analytics||{}};}
 async function setAdminRole(userId,role){if(typeof userId!=='string'||!['admin','user'].includes(role))throw new Error('Некорректная роль.');const {data,error}=await requireClient().rpc('set_admin_role',{p_user_id:userId,p_role:role});if(error)throw error;return data;}
 async function searchUsers(query){const {data,error}=await requireClient().rpc('search_friend_users',{p_query:String(query||'').trim()});if(error)throw error;return data||[];}
 async function friendRequest(userId){const {data,error}=await requireClient().rpc('send_friend_request',{p_target:userId});if(error)throw error;return data;}
 async function friendRespond(requestId,accept){const {data,error}=await requireClient().rpc('respond_friend_request',{p_request:requestId,p_accept:!!accept});if(error)throw error;return data;}
 async function friendRemove(userId){const {data,error}=await requireClient().rpc('remove_friend',{p_friend:userId});if(error)throw error;return data;}
 async function friendshipStatus(userId){const {data,error}=await requireClient().rpc('friendship_status',{p_target:userId});if(error)throw error;return data?.[0]||{status:'none',sent_by_me:false};
 async function friendList(){const {data,error}=await requireClient().rpc('list_friends');if(error)throw error;return data||[];}
 async function friendRequests(){const {data,error}=await requireClient().rpc('list_friend_requests');if(error)throw error;return data||[];} window.SupabaseApp={client,configured,signUp,signIn,signOut,getCurrentUser,profileFor,refreshProfile,verifyEmailToken,resendSignupConfirmation,getSignupEmailCooldownSeconds,startGame,updateGameStats,incrementSolvedPuzzles,saveProgress,saveOpeningProgress,saveAccountData,sendReview,recordVisit,getAdminDashboard,setAdminRole,searchUsers,friendRequest,friendRespond,friendRemove,friendList,friendRequests,friendshipStatus};
})();
