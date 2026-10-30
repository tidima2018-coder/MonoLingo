import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Chess from 'npm:chess.js@0.10.3';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: cors });
function canMateOnTime(chess: any, color: string) {
  const own: Array<{type:string;color:string;squareColor:number}> = [], other: Array<{type:string;color:string;squareColor:number}> = [];
  chess.board().forEach((row: Array<{type:string;color:string}|null>, r: number) => row.forEach((piece, f) => { if (piece && piece.type !== 'k') (piece.color === color ? own : other).push({ ...piece, squareColor: (r + f) % 2 }); }));
  if (!own.length || chess.insufficient_material()) return false;
  if (own.some(piece => 'pqr'.includes(piece.type))) return true;
  const knights = own.filter(piece => piece.type === 'n'), bishops = own.filter(piece => piece.type === 'b');
  if (knights.length >= 2 || (knights.length && bishops.length)) return true;
  if (knights.length === 1) return other.length > 0;
  const colors = new Set(bishops.map(piece => piece.squareColor));
  if (colors.size > 1) return true;
  return other.some(piece => piece.type !== 'b' || !colors.has(piece.squareColor));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const bearer = req.headers.get('Authorization');
  if (!url || !anon || !service || !bearer) return json({ error: 'Supabase server configuration or sign-in is missing' }, 401);
  const authClient = createClient(url, anon, { global: { headers: { Authorization: bearer } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ error: 'Authentication required' }, 401);
  const db = createClient(url, service, { auth: { persistSession: false } });
  try {
    const body = await req.json();
    const id = String(body.match_id || ''), revision = Number(body.revision), action = String(body.action || '');
    if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isSafeInteger(revision) || revision < 0) return json({ error: 'Invalid match request' }, 400);
    const { data: match, error } = await db.from('online_matches').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!match || ![match.white_player, match.black_player].includes(user.id)) return json({ error: 'Match unavailable' }, 404);
    if (match.revision !== revision) return json({ error: 'This position has already changed. The board will sync.' }, 409);
    if (match.status !== 'active') return json({ error: 'This match is already finished' }, 409);

    const moves = Array.isArray(match.moves) ? match.moves : [];
    const chess = new Chess(match.initial_fen);
    for (const saved of moves) {
      const applied = chess.move({ from: saved.from, to: saved.to, promotion: saved.promotion || 'q' });
      if (!applied || applied.san !== saved.san) return json({ error: 'Saved move history failed server validation' }, 500);
    }
    const side = chess.turn(), actorSide = user.id === match.white_player ? 'w' : 'b';
    let patch: Record<string, unknown> = { revision: revision + 1, updated_at: new Date().toISOString() };
    let elapsed = 0;
    if (match.clock_started_at && match.white_time_ms !== null) elapsed = Math.max(0, Date.now() - Date.parse(match.clock_started_at));
    let white = match.white_time_ms as number | null, black = match.black_time_ms as number | null;
    if (side === 'w' && white !== null) white = Math.max(0, white - elapsed);
    if (side === 'b' && black !== null) black = Math.max(0, black - elapsed);

    if (action === 'move') {
      if (actorSide !== side) return json({ error: 'It is not your turn' }, 403);
      if (side === 'w' ? white === 0 : black === 0) {
        patch = { ...patch, status: 'completed', result: side === 'w' ? 'black_win' : 'white_win', termination: 'timeout', completed_at: new Date().toISOString(), white_time_ms: white, black_time_ms: black, clock_started_at: null };
      } else {
        const from = String(body.move?.from || ''), to = String(body.move?.to || ''), promotion = String(body.move?.promotion || 'q');
        if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to) || !['q','r','b','n'].includes(promotion)) return json({ error: 'Invalid move format' }, 400);
        const applied = chess.move({ from, to, promotion });
        if (!applied) return json({ error: 'Illegal chess move' }, 400);
        const nextMoves = [...moves, { from, to, promotion, san: applied.san, at: new Date().toISOString() }];
        const terminal = chess.in_checkmate() || chess.in_draw();
        const result = chess.in_checkmate() ? (chess.turn() === 'w' ? 'black_win' : 'white_win') : chess.in_draw() ? 'draw' : null;
        patch = { ...patch, fen: chess.fen(), moves: nextMoves, white_time_ms: white, black_time_ms: black, clock_started_at: terminal || white === null ? null : new Date().toISOString(), ...(terminal ? { status: 'completed', result, termination: chess.in_checkmate() ? 'checkmate' : chess.in_stalemate() ? 'stalemate' : 'draw', completed_at: new Date().toISOString() } : {}) };
      }
    } else if (action === 'claim_timeout') {
      const flagged = chess.turn() === 'w' ? white === 0 : black === 0;
      if (!flagged) return json({ error: 'The active clock has not expired' }, 409);
      const winnerSide = chess.turn() === 'w' ? 'b' : 'w';
      const winner = canMateOnTime(chess, winnerSide) ? (winnerSide === 'w' ? 'white_win' : 'black_win') : 'draw';
      patch = { ...patch, status: 'completed', result: winner, termination: 'timeout', completed_at: new Date().toISOString(), white_time_ms: white, black_time_ms: black, clock_started_at: null };
    } else if (action === 'resign') {
      patch = { ...patch, status: 'completed', result: actorSide === 'w' ? 'black_win' : 'white_win', termination: 'resignation', completed_at: new Date().toISOString(), white_time_ms: white, black_time_ms: black, clock_started_at: null };
    } else if (action === 'offer_draw') {
      patch = { ...patch, draw_offered_by: user.id, white_time_ms: white, black_time_ms: black, clock_started_at: match.clock_started_at ? new Date().toISOString() : null };
    } else if (action === 'accept_draw') {
      if (!match.draw_offered_by || match.draw_offered_by === user.id) return json({ error: 'No draw offer from your opponent' }, 409);
      patch = { ...patch, status: 'completed', result: 'draw', termination: 'agreement', completed_at: new Date().toISOString(), white_time_ms: white, black_time_ms: black, clock_started_at: null };
    } else return json({ error: 'Unknown action' }, 400);

    const { data: updated, error: updateError } = await db.from('online_matches').update(patch).eq('id', id).eq('revision', revision).eq('status', 'active').select('*').maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return json({ error: 'This position has already changed. The board will sync.' }, 409);
    return json({ match: updated });
  } catch (e) {
    console.error('online-action failed:', e);
    return json({ error: e instanceof Error ? e.message : 'Unable to process action' }, 500);
  }
});
