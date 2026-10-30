-- Repairs the friend-search RPC when friend_directory already exists.
-- If friend_directory does not exist yet, apply supabase/friends.sql first.
BEGIN;

CREATE OR REPLACE FUNCTION public.search_friend_users(p_query TEXT)
RETURNS TABLE (
    user_id UUID,
    username TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT d.user_id, d.username
    FROM public.friend_directory AS d
    WHERE auth.uid() IS NOT NULL
      AND char_length(btrim(coalesce(p_query, ''))) >= 2
      AND lower(d.username) LIKE
          '%' || lower(btrim(p_query)) || '%'
      AND d.user_id <> auth.uid()
    ORDER BY lower(d.username)
    LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.search_friend_users(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_friend_users(TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
