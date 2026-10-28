'use strict';
(() => {
 const SUPABASE_URL='https://cbgzoyzyqmrptsenpyrr.supabase.co';
 const SUPABASE_PUBLISHABLE_KEY='sb_publishable_MysMDgxoFpnGB8WYDe6F9A_5zfbePIZ';
 const configured=!SUPABASE_URL.includes('YOUR_')&&!SUPABASE_PUBLISHABLE_KEY.includes('YOUR_');
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
 async function signUp(email,password,username){const clean=String(username||'').trim();if(clean.length<1||clean.length>32)throw new Error('Никнейм должен содержать от 1 до 32 символов.');const {data,error}=await requireClient().auth.signUp({email:String(email).trim(),password,options:{data:{username:clean}}});if(error)throw error;return data;}
 async function signIn(email,password){const {data,error}=await requireClient().auth.signInWithPassword({email:String(email).trim(),password});if(error)throw error;return data;}
 async function signOut(){const {error}=await requireClient().auth.signOut();if(error)throw error;}
 async function getCurrentUser(){const {data,error}=await requireClient().auth.getSession();if(error)throw error;return data.session?.user||null;}
 async function updateGameStats(result){if(!['win','loss','draw'].includes(result))throw new Error('Неизвестный результат партии.');const {error}=await requireClient().rpc('record_game_result',{p_result:result});if(error)throw error;await refreshProfile();}
 async function incrementSolvedPuzzles(xpGained,puzzleId){if(!Number.isInteger(xpGained)||xpGained<0||xpGained>100)throw new Error('Некорректное количество XP.');if(typeof puzzleId!=='string'||!puzzleId.trim())throw new Error('Не указан идентификатор задачи.');const {data,error}=await requireClient().rpc('record_puzzle_solved',{p_puzzle_id:puzzleId,p_xp_gained:xpGained});if(error)throw error;await refreshProfile();return data;}
 async function saveProgress(progress){const {error}=await requireClient().rpc('sync_profile_progress',{p_completed_stages:progress.completed,p_daily_dates:progress.dailyDates,p_daily_streak:progress.dailyStreak,p_last_daily_date:progress.lastDailyDate,p_legacy_wins:progress.wins});if(error)throw error;}
 async function saveOpeningProgress(completed){const {error}=await requireClient().rpc('sync_opening_progress',{p_completed_openings:completed});if(error)throw error;}
 async function sendReview(text){const message=String(text||'').trim();if(message.length<3||message.length>2000)throw new Error('Отзыв должен содержать от 3 до 2000 символов.');const user=await getCurrentUser();if(!user)throw new Error('Войди, чтобы оставить отзыв.');const profile=await profileFor(user.id);const {error}=await requireClient().from('reviews').insert({user_id:user.id,username:profile.username,message});if(error)throw error;}
 async function getAdminDashboard(password){const {data,error}=await requireClient().rpc('admin_dashboard',{p_password:password});if(error){if(error.message?.includes('Invalid master password'))throw new Error('Неверный мастер-пароль.');throw error;}return {users:data?.users||[],reviews:data?.reviews||[]};}
 window.SupabaseApp={client,configured,signUp,signIn,signOut,getCurrentUser,profileFor,refreshProfile,updateGameStats,incrementSolvedPuzzles,saveProgress,saveOpeningProgress,sendReview,getAdminDashboard};
})();
